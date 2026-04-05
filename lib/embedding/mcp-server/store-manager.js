/**
 * Store Manager — loads and manages .emb packages in memory.
 *
 * Provides nearest-neighbor search via cosine similarity on flat
 * Float32Array indexes (no native FAISS dependency required).
 *
 * REQ-0045 / FR-003 / AC-003-01, AC-003-04, AC-003-05 / M7
 * REQ-0045 / FR-008 / AC-008-01, AC-008-02, AC-008-03, AC-008-04 / M7
 * @module lib/embedding/mcp-server/store-manager
 */

import { readPackage } from '../package/reader.js';
import { deserializeHnswIndex, searchHnsw } from '../hnsw/index.js';

/**
 * @typedef {Object} StoreHandle
 * @property {string} moduleId
 * @property {Object} manifest
 * @property {Float32Array[]} vectors
 * @property {Object[]} metadata - Chunk metadata rows
 * @property {number} dimensions
 * @property {string} packagePath
 */

/**
 * @typedef {Object} SearchResult
 * @property {string} chunkId
 * @property {number} score - Cosine similarity score [0, 1]
 * @property {Object} chunk - Chunk metadata (filePath, startLine, endLine, content, etc.)
 */

/**
 * Compute cosine similarity between two vectors.
 * @param {Float32Array} a
 * @param {Float32Array} b
 * @returns {number} Cosine similarity in [0, 1] range (clamped)
 */
export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;

  return Math.max(0, Math.min(1, dot / denom));
}

/**
 * Find the k nearest neighbors by cosine similarity.
 * @param {Float32Array} query - Query vector
 * @param {Float32Array[]} vectors - Corpus vectors
 * @param {number} k - Number of results
 * @returns {{ index: number, score: number }[]} Sorted by score descending
 */
export function findNearest(query, vectors, k) {
  if (!query || !vectors || vectors.length === 0 || k <= 0) return [];

  const scored = vectors.map((v, i) => ({
    index: i,
    score: cosineSimilarity(query, v),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

/**
 * Deserialize vectors from a flat index buffer.
 * Buffer format: [4-byte dimensions LE][4-byte count LE][float32 data...]
 * @param {Buffer} indexBuf
 * @returns {{ vectors: Float32Array[], dimensions: number }}
 */
function deserializeIndex(indexBuf) {
  if (!indexBuf || indexBuf.length < 4) {
    return { vectors: [], dimensions: 0 };
  }

  const dimensions = indexBuf.readUInt32LE(0);

  if (indexBuf.length < 8) {
    return { vectors: [], dimensions };
  }

  const count = indexBuf.readUInt32LE(4);
  const vectors = [];
  let offset = 8;

  for (let i = 0; i < count; i++) {
    const vec = new Float32Array(dimensions);
    for (let d = 0; d < dimensions; d++) {
      vec[d] = indexBuf.readFloatLE(offset);
      offset += 4;
    }
    vectors.push(vec);
  }

  return { vectors, dimensions };
}

/**
 * Search using HNSW if available on the store, else fall back to linear.
 * Emits a deduped warning via the provided logger on first HNSW-unavailable
 * query per store.
 *
 * @param {Object} store - StoreHandle with optional hnswIndex
 * @param {Float32Array} query
 * @param {number} k
 * @param {{ logger?: Function, warnedSet?: Set }} [opts]
 * @returns {{ index: number, score: number }[]}
 */
export function searchWithHnsw(store, query, k, opts = {}) {
  if (!store || !query || k <= 0) return [];
  if (store.hnswIndex) {
    return searchHnsw(store.hnswIndex, query, k);
  }
  // Fallback path — emit one-time warning per module (AC-003-03, AC-003-04, AC-003-05)
  if (opts.logger && opts.warnedSet && !opts.warnedSet.has(store.moduleId)) {
    opts.warnedSet.add(store.moduleId);
    opts.logger(`HNSW_INDEX_UNAVAILABLE: HNSW index missing/stale for module ${store.moduleId}, falling back to linear scan. Run 'isdlc embedding generate' to rebuild.`);
  }
  return findNearest(query, store.vectors, k);
}

/**
 * Create a StoreManager instance.
 * @param {{ logger?: Function }} [options]
 * @returns {Object} StoreManager API
 */
export function createStoreManager(options = {}) {
  /** @type {Map<string, StoreHandle>} */
  const stores = new Map();
  const logger = options.logger || (() => {});
  const warnedModules = new Set();

  /**
   * Load a .emb package into memory.
   * @param {string} packagePath - Path to .emb file
   * @param {Object} [options]
   * @param {Buffer} [options.decryptionKey] - 32-byte AES key for encrypted packages
   * @returns {Promise<StoreHandle>}
   */
  async function loadPackage(packagePath, options = {}) {
    const loaded = await readPackage(packagePath, {
      decryptionKey: options.decryptionKey,
    });

    const { vectors, dimensions } = deserializeIndex(loaded.index);
    const moduleId = loaded.manifest.moduleId;

    // AC-003-01: detect HNSW index presence; deserialize if present
    let hnswIndex = null;
    if (loaded.manifest.hnsw_index_present && loaded.hnswIndex) {
      hnswIndex = deserializeHnswIndex(loaded.hnswIndex, dimensions);
    }

    const handle = {
      moduleId,
      manifest: loaded.manifest,
      vectors,
      metadata: loaded.db || [],
      dimensions,
      packagePath,
      hnswIndex,
    };

    stores.set(moduleId, handle);
    return handle;
  }

  /**
   * Unload a package from memory.
   * @param {string} moduleId
   */
  function unloadPackage(moduleId) {
    stores.delete(moduleId);
  }

  /**
   * Hot-reload a package without server restart.
   * @param {string} moduleId
   * @param {string} newPath - Path to updated .emb file
   * @param {Object} [options]
   * @param {Buffer} [options.decryptionKey]
   * @returns {Promise<void>}
   */
  async function reloadPackage(moduleId, newPath, options = {}) {
    unloadPackage(moduleId);
    await loadPackage(newPath, options);
  }

  /**
   * List all loaded stores.
   * @returns {{ moduleId: string, version: string, dimensions: number, chunkCount: number, encrypted: boolean }[]}
   */
  function listStores() {
    return Array.from(stores.values()).map(s => ({
      moduleId: s.moduleId,
      version: s.manifest.version,
      dimensions: s.dimensions,
      chunkCount: s.metadata.length,
      encrypted: !!s.manifest.encrypted,
      keyId: s.manifest.keyId || null,
    }));
  }

  /**
   * Search a single store by cosine similarity.
   * @param {string} moduleId
   * @param {Float32Array} queryVector
   * @param {number} [k=10]
   * @returns {SearchResult[]}
   */
  function search(moduleId, queryVector, k = 10) {
    const store = stores.get(moduleId);
    if (!store) return [];

    // AC-002-02, AC-003-02: route to HNSW if available, fallback to linear
    const nearest = searchWithHnsw(store, queryVector, k, {
      logger,
      warnedSet: warnedModules
    });

    return nearest.map(({ index, score }) => {
      const chunk = store.metadata[index] || {};
      return {
        chunkId: chunk.id || `chunk-${index}`,
        score,
        chunk: {
          filePath: chunk.filePath || '',
          startLine: chunk.startLine || 0,
          endLine: chunk.endLine || 0,
          content: chunk.content || '',
          type: chunk.type || 'unknown',
          language: chunk.language || 'unknown',
        },
        moduleId: store.moduleId,
      };
    });
  }

  /**
   * Get a store handle by module ID.
   * @param {string} moduleId
   * @returns {StoreHandle|null}
   */
  function getStore(moduleId) {
    return stores.get(moduleId) || null;
  }

  /**
   * Check if any stores are loaded.
   * @returns {boolean}
   */
  function hasStores() {
    return stores.size > 0;
  }

  return {
    loadPackage,
    unloadPackage,
    reloadPackage,
    listStores,
    search,
    getStore,
    hasStores,
  };
}
