# Module Design: Embedding Scale-Out

**Item**: REQ-GH-227 (bundles GH-227, GH-229)
**Status**: Draft

---

## 1. Module Overview

Two new modules, three existing modules extended.

### New modules
| Module | Responsibility | Path |
|--------|---------------|------|
| `HnswIndex` | Build, serialize, deserialize, and query FAISS HNSW index | `lib/embedding/hnsw/index.js` |
| `FileHashManifest` | Compute SHA-256 hashes of files; diff current FS state vs prior manifest | `lib/embedding/incremental/file-hash.js` |
| `incrementalDiff` | Orchestrate incremental generation: load prior .emb, diff, merge, rebuild | `lib/embedding/incremental/index.js` |

### Modified modules
| Module | Change | Path |
|--------|--------|------|
| `StoreManager` | Detect HNSW presence on load; route `findNearest()` to HNSW or linear | `lib/embedding/mcp-server/store-manager.js` |
| `.emb` writer | Serialize `hnsw_index` + `file_hashes` alongside vectors | `lib/embedding/distribution/index.js` + `lib/embedding/package/writer.js` |
| CLI `generate` | Parse `--incremental` + `--since=<ref>` flags; dispatch to full or incremental path | `bin/isdlc-embedding.js` |

---

## 2. Module Design

### 2.1 `HnswIndex` (new) — `lib/embedding/hnsw/index.js`

**Responsibility**: Wrap faiss-node to provide a clean build/serialize/search API for HNSW indexes. Hides FAISS specifics from the rest of the codebase.

**Public Interface**:
```js
/**
 * Build a new HNSW index from a vector set.
 * @param {Float32Array[]} vectors - Array of embedding vectors (all same dimension)
 * @param {object} [params] - HNSW parameters
 * @param {number} [params.M=16] - Graph connectivity
 * @param {number} [params.efConstruction=200] - Build-time neighbor exploration
 * @param {number} [params.efSearch=50] - Query-time neighbor exploration
 * @returns {HnswIndex} In-memory HNSW index ready for search
 */
export function buildHnswIndex(vectors, params = { M: 16, efConstruction: 200, efSearch: 50 }): HnswIndex

/**
 * Serialize HNSW index to Buffer for inclusion in .emb package.
 * @param {HnswIndex} index
 * @returns {Buffer} Binary serialized HNSW state
 */
export function serializeHnswIndex(index): Buffer

/**
 * Deserialize HNSW index from Buffer (at server load).
 * @param {Buffer} buffer
 * @returns {HnswIndex}
 * @throws {HnswLoadError} If buffer is corrupt or version-mismatched
 */
export function deserializeHnswIndex(buffer): HnswIndex

/**
 * Search for k nearest neighbors.
 * @param {HnswIndex} index
 * @param {Float32Array} query - Query vector
 * @param {number} k - Number of results
 * @returns {{ index: number, score: number }[]} Sorted by score descending
 */
export function searchHnsw(index, query, k): SearchResult[]
```

**Dependencies**: `faiss-node` (existing)
**Error types**: `HnswLoadError`, `HnswBuildError`

---

### 2.2 `FileHashManifest` (new) — `lib/embedding/incremental/file-hash.js`

**Responsibility**: Compute content hashes for files; produce diff between two manifests.

**Public Interface**:
```js
/**
 * @typedef {Object} FileHashManifest
 * @property {string} hash_algorithm - "sha256"
 * @property {Object<string, string>} file_hashes - { relativePath: sha256Hex }
 */

/**
 * Walk filesystem under given roots, compute SHA-256 of each file.
 * @param {string[]} rootPaths - Absolute paths to scan
 * @param {object} [options]
 * @param {string[]} [options.excludePatterns] - Glob patterns to exclude
 * @returns {Promise<FileHashManifest>}
 */
export async function computeManifest(rootPaths, options = {}): Promise<FileHashManifest>

/**
 * Diff two manifests to identify changed/added/deleted files.
 * @param {FileHashManifest} prior - From existing .emb
 * @param {FileHashManifest} current - From current filesystem
 * @returns {ManifestDiff}
 */
export function diffManifests(prior, current): ManifestDiff

/**
 * @typedef {Object} ManifestDiff
 * @property {string[]} changed - Files present in both but hashes differ
 * @property {string[]} added - Files in current, not in prior
 * @property {string[]} deleted - Files in prior, not in current
 */
```

**Dependencies**: Node `crypto` (built-in), Node `fs/promises` (built-in)
**Error types**: none (IO errors bubble up)

---

### 2.3 `incrementalDiff` orchestrator (new) — `lib/embedding/incremental/index.js`

**Responsibility**: Drive the end-to-end incremental generation flow.

**Public Interface**:
```js
/**
 * Run incremental embedding generation.
 * @param {object} params
 * @param {string} params.priorPackagePath - Path to existing .emb file
 * @param {string[]} params.rootPaths - Directories to scan
 * @param {EmbeddingProvider} params.embedder - Embedding adapter to use
 * @returns {Promise<IncrementalResult>}
 * @throws {NoPriorPackageError} If priorPackagePath does not exist
 * @throws {LegacyPackageError} If prior .emb has no file_hashes manifest
 * @throws {DeletionsDetectedError} If any files deleted from disk
 */
export async function runIncremental(params): Promise<IncrementalResult>

/**
 * @typedef {Object} IncrementalResult
 * @property {number} changedCount
 * @property {number} addedCount
 * @property {number} unchangedCount
 * @property {Float32Array[]} mergedVectors
 * @property {FileHashManifest} newManifest
 * @property {HnswIndex} newHnswIndex
 * @property {string} outputPackagePath
 */
```

**Sequence**:
1. Read prior .emb → extract `file_hashes` manifest, vectors, chunks
2. If no `file_hashes` → throw `LegacyPackageError`
3. Compute current manifest via `computeManifest(rootPaths)`
4. Call `diffManifests(prior, current)` → `{changed, added, deleted}`
5. If `deleted.length > 0` → throw `DeletionsDetectedError` with file list
6. Chunk + embed files in `changed ∪ added` via `embedder`
7. Copy unchanged vectors from prior .emb (filtered by path)
8. Merge: `unchangedVectors ∪ newVectors`
9. Call `buildHnswIndex(mergedVectors)`
10. Write new .emb via existing writer with updated manifest

---

### 2.4 `StoreManager` extension — `lib/embedding/mcp-server/store-manager.js`

**Changes**:
- `loadPackage(path)`: detect `manifest.hnsw_index_present`; if true, deserialize HNSW; if false or deserialize fails, set `hnswIndex: null` and log one-time warning
- `findNearest(query, vectors, k)`: if store has loaded HNSW, call `searchHnsw(hnswIndex, query, k)`; else existing linear path
- New `StoreHandle` field: `hnswIndex?: HnswIndex | null`
- New warning log: `HNSW_INDEX_UNAVAILABLE: {reason}` — emitted once per store load (deduped via Set in StoreManager instance)

**Signature stays identical** — callers of `findNearest()` and `semantic_search` don't change.

---

### 2.5 `.emb` writer extension — `lib/embedding/package/writer.js` + `distribution/index.js`

**Changes**:
- Writer accepts new fields: `hnswIndex: Buffer`, `fileHashes: Object<string, string>`
- Writer serializes them into .emb manifest/binary section
- Manifest JSON extends with: `hnsw_index_present`, `hnsw_params`, `file_hashes`, `hash_algorithm`

**Schema** (added fields in `.emb` manifest JSON):
```json
{
  "hnsw_index_present": true,
  "hnsw_params": { "M": 16, "efConstruction": 200, "efSearch": 50 },
  "file_hashes": {
    "src/auth.js": "abc123...",
    "src/db.js": "def456..."
  },
  "hash_algorithm": "sha256"
}
```

---

### 2.6 CLI extension — `bin/isdlc-embedding.js`

**New flags**:
- `--incremental`: dispatch to `runIncremental()` instead of full generate
- `--since=<ref>`: deprecated/reserved (not used now that approach is filesystem-hash; flag parsed and accepted for future; emits warning "--since ignored: filesystem-hash does not need a reference point")

**Error handling** (translated from exceptions to CLI output):
- `NoPriorPackageError` → exit code 2, prompt: "No prior package to diff against. Run full generate now? [Y/n]"
  - On Y: invoke full generate inline, exit 0 on success
  - On n: exit 2
- `LegacyPackageError` → exit code 3, message: "Prior .emb package has no file_hashes manifest (legacy). Run full `isdlc embedding generate` to rebuild."
- `DeletionsDetectedError` → exit code 4, message: "File deletions detected ({N} files). Incremental cannot clean orphan vectors — search would return dead paths. Run full `isdlc embedding generate` to rebuild."

---

## 3. Changes to Existing Modules

| File | Lines of Change | Change Type |
|------|-----------------|-------------|
| `lib/embedding/mcp-server/store-manager.js` | ~30 lines | Extend `loadPackage`, `findNearest`; add `hnswIndex` field |
| `lib/embedding/package/writer.js` | ~15 lines | Add new manifest fields to serialization |
| `lib/embedding/package/reader.js` | ~10 lines | Add backward-compat for missing new fields |
| `lib/embedding/distribution/index.js` | ~5 lines | Pass-through new fields to writer |
| `bin/isdlc-embedding.js` | ~60 lines | Add `--incremental` flag + error translation |

**Blast radius**: 5 existing files, narrow, all within `lib/embedding/`. No cross-cutting framework changes. No hook changes. No agent/skill changes.

---

## 4. Wiring Summary

**Full flow** (`isdlc embedding generate`):
```
bin/isdlc-embedding.js
  → lib/embedding/knowledge/pipeline.js  (chunk+embed)
  → lib/embedding/hnsw/index.js          (buildHnswIndex)   ← NEW
  → lib/embedding/incremental/file-hash.js (computeManifest) ← NEW
  → lib/embedding/package/writer.js       (write .emb with new fields)
```

**Incremental flow** (`isdlc embedding generate --incremental`):
```
bin/isdlc-embedding.js
  → lib/embedding/incremental/index.js           (runIncremental)     ← NEW
    → lib/embedding/package/reader.js             (load prior .emb)
    → lib/embedding/incremental/file-hash.js     (computeManifest + diffManifests) ← NEW
    → lib/embedding/knowledge/pipeline.js         (embed changed+added)
    → lib/embedding/hnsw/index.js                 (buildHnswIndex for merged set) ← NEW
    → lib/embedding/package/writer.js             (write new .emb)
```

**Query flow** (server handling `semantic_search`):
```
mcp-server/server.js
  → store-manager.findNearest(query, vectors, k)
    → if hnswIndex loaded: hnsw.searchHnsw(hnswIndex, query, k)   ← NEW branch
    → else: existing linear cosineSimilarity loop                  ← FALLBACK
```

---

## 5. Error Taxonomy

| Code | Severity | Trigger | Recovery |
|------|----------|---------|----------|
| `HNSW_INDEX_UNAVAILABLE` | warning | HNSW missing/corrupt on server load | Fall back to linear scan; log once; prompt user to rebuild |
| `HNSW_BUILD_FAILED` | error | FAISS fails to build index during `generate` | Abort generate, surface FAISS error; `.emb` not written |
| `NO_PRIOR_PACKAGE` | info | `--incremental` with no prior .emb | Interactive prompt: run full generate now? |
| `LEGACY_PACKAGE_NO_HASHES` | error | Prior .emb has no `file_hashes` manifest | Tell user to run full generate |
| `DELETIONS_DETECTED` | error | Files in manifest missing from disk | Tell user to run full generate (version consistency) |

---

## 6. Testability

- `HnswIndex`: unit tests with small synthetic vector sets; recall validation against linear scan ground truth
- `FileHashManifest`: unit tests with temp dirs (fixture files, modified, added, deleted)
- `incrementalDiff`: integration tests with real .emb round-trip
- `StoreManager`: existing tests continue to pass (HNSW is additive); new tests for fallback path
- Scale validation: synthetic corpus fixture (50K generated files) for p95 latency + incremental timing (Phase 05 task)
