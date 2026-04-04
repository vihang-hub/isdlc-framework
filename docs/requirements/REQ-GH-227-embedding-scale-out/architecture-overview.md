# Architecture Overview: Embedding Scale-Out

**Item**: REQ-GH-227 (bundles GH-227, GH-229)
**Status**: Draft

---

## 1. Architecture Options

### Decision 1: HNSW library

| Option | Summary | Pros | Cons | Verdict |
|--------|---------|------|------|---------|
| A. faiss-node | FAISS C++ library via Node binding; mature, production-grade | Already in `package.json:63` as optional dep; zero new deps; handles 1M+ vectors; industry standard | C++ native binary (needs compile/prebuilt for target platform) | **Selected** |
| B. hnswlib-node | Dedicated HNSW impl, lighter weight | Simpler API; smaller binary | Not in deps (new dependency); overkill to add when faiss is already there | Eliminated |
| C. usearch | Newer HNSW impl, zero deps | Fastest; tiny binary | Less battle-tested; would be new dep | Eliminated |

### Decision 2: HNSW index bundling

| Option | Summary | Pros | Cons | Verdict |
|--------|---------|------|------|---------|
| A. Bundle into .emb | HNSW serialized alongside vectors in single `.emb` file | Atomic unit; one file to distribute; no sync issues between vectors/index | Slightly larger package size | **Selected** |
| B. Sidecar file | `.emb.hnsw` next to `.emb` | Smaller base package; fetchable separately | Two files to keep in sync; extra distribution complexity; orphan risk | Eliminated |

### Decision 3: Incremental diff strategy

| Option | Summary | Pros | Cons | Verdict |
|--------|---------|------|------|---------|
| A. Filesystem-hash manifest | `.emb` stores per-file SHA-256; re-scan disk and diff hashes | No VCS coupling; no commit required; works on any filesystem; working-copy changes embedded immediately | Full filesystem walk + hash per incremental (<1s at 50K files) | **Selected** |
| B. VCS diff (git/svn adapters) | Use `git diff` / `svn diff` between prior revision and HEAD | Fast diff (no hashing); VCS knows exactly what changed | Requires commit before incremental sees changes; couples embedding to VCS; separate adapter code paths per VCS | Eliminated (bad UX, over-coupled) |
| C. mtime + size heuristic | Track file modification time and size, diff against manifest | Fastest (no hashing) | Unreliable (touch/copy can change mtime without content change; git checkout resets mtime) | Eliminated (too fragile) |

### Decision 4: HNSW build timing

| Option | Summary | Pros | Cons | Verdict |
|--------|---------|------|------|---------|
| A. Build at package generation | HNSW index built once by `isdlc embedding generate`, serialized into .emb | One-time cost; server loads pre-built index in milliseconds | `generate` is slightly slower | **Selected** |
| B. Build on server load | Server rebuilds HNSW from vectors at startup | .emb stays smaller; always-fresh index | Slow server startup at 1M vectors; HNSW build is not free | Eliminated |
| C. Build on first query | Lazy build at query time | Smallest .emb; no upfront cost | First query blocks for seconds/minutes at scale | Eliminated |

---

## 2. Selected Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  isdlc embedding generate [--incremental]                       │
│  ─────────────────────────────────────────                      │
│  Full mode:                                                     │
│    1. Walk FS, chunk, embed → vectors                           │
│    2. Compute SHA-256 of every file → file_hashes               │
│    3. Build FAISS HNSW index from vectors (M=16, efC=200)       │
│    4. Serialize {vectors, hnsw_index, file_hashes, manifest}    │
│       → write {moduleId}-{version}.emb                          │
│                                                                 │
│  Incremental mode:                                              │
│    1. Load prior .emb → file_hashes manifest                    │
│    2. Walk FS, SHA-256 each file                                │
│    3. Diff: {changed, added, deleted}                           │
│    4. If deleted.length > 0 → EXIT DELETIONS_DETECTED           │
│    5. Chunk+embed {changed ∪ added} files only                  │
│    6. Copy unchanged vectors forward from prior .emb            │
│    7. Rebuild HNSW from merged vector set                       │
│    8. Write new .emb with refreshed file_hashes                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  .emb package    │
                    │  ──────────────  │
                    │  vectors[]       │
                    │  chunks[]        │
                    │  hnsw_index      │  ← FAISS serialized
                    │  file_hashes{}   │  ← path → sha256
                    │  manifest:       │
                    │    hash_algo     │
                    │    hnsw_params   │
                    │    hnsw_present  │
                    └──────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  embedding server (loads .emb on startup)                       │
│  ────────────────────────────────────────                       │
│  if (manifest.hnsw_index_present):                              │
│      load FAISS HNSW index → findNearest() uses HNSW backend    │
│  else:                                                          │
│      log warning "HNSW missing/stale, using linear scan"        │
│      findNearest() uses O(n) cosineSimilarity fallback          │
└─────────────────────────────────────────────────────────────────┘
```

## 3. ADRs

### ADR-001: FAISS via faiss-node for HNSW backend
- **Status**: Accepted
- **Context**: GH-227 requires ANN search at 1M+ vectors, brute-force O(n) won't scale
- **Decision**: Use FAISS through `faiss-node` (already in `package.json:63`)
- **Rationale**: Zero new deps; FAISS is industry-standard for large-scale vector search; handles 1M+ vectors comfortably; used in production by Pinecone, Milvus, others
- **Consequences**: Binary dep needs prebuilts for target platforms (macOS/Linux verified; Windows TBD in Phase 05)

### ADR-002: Filesystem-hash manifest for incremental diff (no VCS)
- **Status**: Accepted
- **Context**: GH-229 wants incremental re-embed; originally proposed VCS-diff, rejected because (a) bad UX (forces commits), (b) couples embedding to VCS, (c) working-copy changes should be embedable
- **Decision**: Store per-file SHA-256 in `.emb` manifest; re-scan filesystem and diff hashes on `--incremental`
- **Rationale**: Filesystem is the source of truth; VCS-agnostic; no commit required; identical flow for git/svn/plain dirs
- **Consequences**: Full FS scan + hashing per incremental (benchmarked <1s at 50K files); `.emb` manifest grows by ~70 bytes/file (negligible at 50K files → ~3.5MB)

### ADR-003: HNSW index bundled into .emb (not sidecar)
- **Status**: Accepted
- **Context**: HNSW index must be persisted between server restarts
- **Decision**: Serialize HNSW state inside .emb package alongside vectors
- **Rationale**: Single atomic unit; no sync issues between vectors and index; one file to distribute
- **Consequences**: .emb packages ~20% larger (HNSW graph structure); acceptable tradeoff

### ADR-004: Deletions block incremental, require full rebuild
- **Status**: Accepted
- **Context**: Incremental could theoretically clean orphan vectors, but that adds rebuild complexity
- **Decision**: Any detected deletion causes exit; user must run full `generate`
- **Rationale**: Stale vectors = `semantic_search` returns dead paths = version consistency problem; safer to force rebuild than maintain cleanup logic
- **Consequences**: Users doing refactors with deletions must do a full rebuild (acceptable — deletions are less frequent than edits)

### ADR-005: HNSW built at package generation (not runtime)
- **Status**: Accepted
- **Context**: HNSW build takes seconds to minutes at scale
- **Decision**: Build index during `isdlc embedding generate`, serialize into .emb
- **Rationale**: One-time cost amortized across many server loads; fast server startup; HNSW is deterministic so build-once is fine
- **Consequences**: Incremental must rebuild HNSW (new vectors added); acceptable since HNSW build for delta-size sets is fast

---

## 4. Technology Decisions

| Tech | Version | Rationale | Alternatives Considered |
|------|---------|-----------|-------------------------|
| faiss-node | ^0.5.1 (existing) | Already in deps; production-grade | hnswlib-node, usearch |
| Node crypto (SHA-256) | built-in | Zero new deps; standard; fast enough | xxhash, md5 |
| HNSW params | M=16, efConstruction=200, efSearch=50 | Standard defaults for ~1M vectors, ~95% recall | Tunable later via .isdlc/config.json |
| Hash scope | raw file bytes | Content-addressable; stable across mtime changes | mtime+size (too fragile), chunk-level hashes (overkill) |

---

## 5. Integration Architecture

| Integration Point | Source | Target | Interface | Data Format | Error Handling |
|-------------------|--------|--------|-----------|-------------|----------------|
| Generate → .emb | CLI `generate` | `.emb` writer | existing distribution module | binary (JSON manifest + FAISS binary + vectors) | Fail loudly on write error |
| Incremental → prior .emb | CLI `generate --incremental` | `.emb` reader | new helper in `lib/embedding/incremental/` | read manifest, diff hashes | `NO_PRIOR_PACKAGE`, `LEGACY_PACKAGE_NO_HASHES`, `DELETIONS_DETECTED` |
| Server load → HNSW | server startup | StoreManager | extend StoreManager.loadPackage() | detect `hnsw_index_present` flag | fallback to linear + warn once |
| Query → HNSW | `findNearest()` call | FAISS API | internal, same signature | (query vec, k) → top-k indices | fallback to linear on FAISS error |

### Data Flow

```
User edit → FS hash scan → diff vs manifest → {changed, added, deleted}
                                            ↓
                                     (if deleted) → EXIT
                                            ↓
                             chunk+embed (changed ∪ added)
                                            ↓
                        merge with unchanged vectors from prior .emb
                                            ↓
                             rebuild HNSW from merged vectors
                                            ↓
                              write new .emb with fresh manifest
```
