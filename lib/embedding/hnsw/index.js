/**
 * HnswIndex — FAISS HNSW wrapper for approximate nearest neighbor search.
 *
 * Uses faiss-node's `Index` with HNSW factory string ("HNSW{M},Flat").
 * Assumes input vectors are normalized to unit length (standard for
 * embedding models like OpenAI/Cohere). Uses L2 distance on unit vectors,
 * which is order-equivalent to cosine similarity: for unit vectors,
 * `||a - b||^2 = 2(1 - a·b)`, so nearest L2 == nearest cosine.
 *
 * REQ-GH-227 / FR-001, FR-002 / AC-001-01..03, AC-002-01..02
 * @module lib/embedding/hnsw/index
 */

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Index } = require('faiss-node');

/**
 * Default HNSW parameters (AC-001-03).
 */
export const DEFAULT_HNSW_PARAMS = Object.freeze({
  M: 16,
  efConstruction: 200,
  efSearch: 50
});

/**
 * Convert L2 distance (on unit vectors) to cosine similarity score in [0, 1].
 * For unit vectors: cos = 1 - L2^2 / 2
 */
function l2ToCosine(l2Distance) {
  const cos = 1 - l2Distance / 2;
  return Math.max(0, Math.min(1, cos));
}

/**
 * L2-normalize a vector to unit length in place (into output array).
 */
function normalize(v, out, base) {
  let norm = 0;
  for (let d = 0; d < v.length; d++) norm += v[d] * v[d];
  norm = Math.sqrt(norm);
  if (norm === 0) {
    for (let d = 0; d < v.length; d++) out[base + d] = 0;
    return;
  }
  for (let d = 0; d < v.length; d++) out[base + d] = v[d] / norm;
}

/**
 * Flatten an array of Float32Array vectors into a single plain number array,
 * normalizing each vector to unit length. Required for L2-distance HNSW
 * to produce cosine-equivalent results.
 * faiss-node's `add()` expects a plain array, not Float32Array.
 */
function flatten(vectors) {
  const dim = vectors[0].length;
  const flat = new Array(vectors.length * dim);
  for (let i = 0; i < vectors.length; i++) {
    normalize(vectors[i], flat, i * dim);
  }
  return flat;
}

/**
 * Build an HNSW index from vectors.
 *
 * @param {Float32Array[]} vectors - Corpus vectors (assumed unit-normalized)
 * @param {number} dimensions - Vector dimension
 * @param {{M?: number, efConstruction?: number, efSearch?: number}} [params]
 * @returns {Index|null} faiss-node Index, or null on invalid input
 */
export function buildHnswIndex(vectors, dimensions, params = {}) {
  if (!Array.isArray(vectors) || vectors.length === 0) return null;
  if (!Number.isFinite(dimensions) || dimensions <= 0) return null;

  const M = params.M ?? DEFAULT_HNSW_PARAMS.M;
  // Factory string: "HNSW{M},Flat" uses L2 metric by default
  const factoryStr = `HNSW${M},Flat`;

  try {
    const index = new Index(dimensions, factoryStr);
    const flat = flatten(vectors);
    index.add(flat);
    return index;
  } catch (e) {
    return null;
  }
}

/**
 * Serialize an HNSW index to a Buffer for bundling in .emb packages.
 *
 * @param {Index|null} index
 * @returns {Buffer|null}
 */
export function serializeHnswIndex(index) {
  if (!index) return null;
  try {
    return index.toBuffer();
  } catch {
    return null;
  }
}

/**
 * Deserialize an HNSW index from a Buffer.
 *
 * @param {Buffer} buf
 * @param {number} expectedDim - Expected vector dimension for validation
 * @returns {Index|null}
 */
export function deserializeHnswIndex(buf, expectedDim) {
  if (!buf || buf.length === 0) return null;
  try {
    const index = Index.fromBuffer(buf);
    if (expectedDim && index.getDimension() !== expectedDim) return null;
    return index;
  } catch {
    return null;
  }
}

/**
 * Query an HNSW index.
 *
 * @param {Index|null} index
 * @param {Float32Array} queryVector - Query vector (assumed unit-normalized)
 * @param {number} k - Number of results
 * @returns {{index: number, score: number}[]} Sorted by score descending
 */
export function searchHnsw(index, queryVector, k) {
  if (!index || !queryVector || k <= 0) return [];
  try {
    // Normalize query to match indexed vectors
    const query = new Array(queryVector.length);
    normalize(queryVector, query, 0);
    const result = index.search(query, k);
    // faiss-node returns { distances: number[], labels: number[] } (L2 distances)
    const out = [];
    for (let i = 0; i < result.labels.length; i++) {
      out.push({
        index: result.labels[i],
        score: l2ToCosine(result.distances[i])
      });
    }
    // Already sorted by L2 ascending (best first); map to score descending
    return out;
  } catch {
    return [];
  }
}
