# Requirements Specification: Embedding Scale-Out

**Item**: REQ-GH-227 (bundles GH-227, GH-229)
**Status**: Draft
**Confidence**: High (user-confirmed direction)

---

## 1. Business Context

A real 1M+ LOC project will use the iSDLC embedding pipeline next week. Two scale concerns must be addressed anticipatorily so users don't hit pain on first use:

- **Query-side** (GH-227): current `findNearest()` does brute-force O(n) cosine similarity over all vectors — will not scale to 50K+ chunks expected from 1M LOC
- **Index-side** (GH-229): full re-embed on every change is impractical at that scale — incremental update via VCS diff is needed

Both ship together as one coherent "embedding scale-out" story. Quality bar: users don't experience visible latency pain on day one.

## 2. Stakeholders and Personas

- **Framework user on large codebase** (primary): developer running semantic_search across 1M+ LOC, expects sub-second query response
- **Package maintainer**: runs `isdlc embedding generate` regularly, cannot afford multi-minute full re-embeds on every change
- **Next-week project team** (concrete driver): 1M LOC codebase, multi-session usage from day one

## 3. User Journeys

**Journey 1: First-time embed (existing)**
1. User runs `isdlc embedding generate`
2. Pipeline chunks + embeds full codebase, builds HNSW index alongside vectors
3. System computes SHA-256 of every indexed file and records in `.emb` manifest
4. `.emb` package written with HNSW bundled + `file_hashes: { path: sha256 }` + `hnsw_index_present: true`

**Journey 2: Incremental re-embed (new)**
1. User edits files on disk (no commit needed), runs `isdlc embedding generate --incremental`
2. System loads prior `.emb`, reads `file_hashes` manifest
3. System walks the filesystem under embedding roots, computes current SHA-256 for each file
4. Diff: files whose current hash ≠ manifest hash → re-embed; files not in manifest → new → embed; files in manifest but missing from disk → deletion → abort (Journey 6)
5. Unchanged files' vectors copied forward; new/changed files embedded fresh
6. New `.emb` written with updated HNSW index + refreshed `file_hashes` manifest

**Journey 3: Query at scale (new path)**
1. Server loads `.emb` → detects HNSW index present → uses FAISS backend
2. `semantic_search` calls `findNearest()` which uses HNSW internally
3. User sees sub-second response on 1M+ vectors

**Journey 4: Fallback path (graceful degradation)**
1. Server loads `.emb` → HNSW index missing or version-mismatched
2. Emits one-time warning: "HNSW index missing/stale, falling back to linear scan. Run 'isdlc embedding generate' to rebuild."
3. Queries still work (linear scan), just slower

**Journey 5: First-run incremental (new, error path)**
1. User runs `--incremental` with no prior `.emb` package
2. System detects no prior package, errors with `NO_PRIOR_PACKAGE`
3. Prompts user: "No prior package to diff against. Run full generate now? [Y/n]"
4. On Y: runs full generation; on n: exits

**Journey 6: Deletions detected (new, block path)**
1. User runs `--incremental` after deleting files from disk
2. System finds paths in the `.emb` manifest that no longer exist on disk
3. System exits with `DELETIONS_DETECTED`: "File deletions detected ({N} files). Incremental cannot clean orphan vectors — search would return dead paths. Run full `isdlc embedding generate` to rebuild."

## 4. Technical Context

- `findNearest()` lives at `lib/embedding/mcp-server/store-manager.js:63` — isolated O(n) loop, one function, narrow blast radius
- `cosineSimilarity()` at `store-manager.js:37` is the only hot path inside
- `faiss-node ^0.5.1` already dep in `package.json:63` — zero new dependencies needed for HNSW
- Incremental uses **filesystem-hash manifest** stored in `.emb`, not VCS diff — VCS-agnostic by design
- Hash algorithm: SHA-256 of raw file bytes (Node.js `crypto` built-in, no new deps)
- `bin/isdlc-embedding.js` has no `--incremental` flag today — wiring missing
- `.emb` package format is versioned: `{moduleId}-{version}.emb` per `lib/embedding/distribution/index.js:63`
- Existing VCS adapters at `lib/embedding/vcs/` remain in the tree for other consumers but are NOT used by the embedding incremental path

### Constraints

- **Article X (Fail-Safe Defaults)**: HNSW missing/stale → fall back to linear scan, never fail the query
- **Article XI (Integration Testing Integrity)**: scale claims need real execution validation, not mocked
- **Backward compat**: existing `.emb` files without HNSW / without `file_hashes` manifest must still work (fallback path covers HNSW; missing manifest forces full rebuild on first incremental)
- **Provider neutrality**: changes are in `lib/embedding/`, transparent to Claude/Codex
- **VCS-agnostic**: works identically on git, svn, hg, or no VCS at all — filesystem is the source of truth

## 5. Quality Attributes and Risks

| Attribute | Priority | Threshold |
|-----------|----------|-----------|
| Query latency p95 | Critical | <1s at 1M chunks (sub-second target) |
| Incremental re-index | Critical | <60s for changed-file set |
| Index build time | Medium | acceptable one-time cost at package generation |
| Memory footprint | Medium | FAISS HNSW index + vectors fit alongside existing .emb load |
| Query recall | High | ≥95% (industry HNSW default) |

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Can't validate 1M p95 locally without real project | High | High | Synthetic corpus harness (Phase 05 task) |
| FAISS binary compatibility across platforms | Medium | Medium | faiss-node already optional dep; fallback to linear if load fails |
| `.emb` format bump breaks older servers | Low | Medium | Additive metadata fields only; HNSW presence detected via flag |
| HNSW params wrong for this corpus | Medium | Medium | Start with M=16/efC=200/efS=50; make configurable in .isdlc/config.json |

---

## 6. Functional Requirements

### FR-001: HNSW index built at package generation (GH-227)
**Confidence**: High
- **AC-001-01**: `isdlc embedding generate` builds FAISS HNSW index alongside vectors
- **AC-001-02**: HNSW index serialized into `.emb` package (bundled, not sidecar)
- **AC-001-03**: Index uses params M=16, efConstruction=200, efSearch=50 by default

### FR-002: findNearest() uses HNSW backend transparently (GH-227)
**Confidence**: High
- **AC-002-01**: `findNearest(query, vectors, k)` signature unchanged
- **AC-002-02**: When HNSW index is loaded, queries use FAISS search instead of linear scan
- **AC-002-03**: Existing callers of `findNearest()` and `semantic_search` work without changes

### FR-003: Graceful fallback when HNSW missing or stale (GH-227)
**Confidence**: High
- **AC-003-01**: Server startup detects absence of HNSW index in .emb
- **AC-003-02**: Falls back to linear scan without failing
- **AC-003-03**: Emits one-time warning: "HNSW index missing/stale, falling back to linear scan. Run 'isdlc embedding generate' to rebuild."
- **AC-003-04**: Warning emitted once per server startup, not per query
- **AC-003-05**: Error code `HNSW_INDEX_UNAVAILABLE` surfaces in logs

### FR-004: `--incremental` uses filesystem-hash diff to re-embed changed files (GH-229)
**Confidence**: High
- **AC-004-01**: `isdlc embedding generate --incremental` loads prior `.emb` manifest `file_hashes` map
- **AC-004-02**: Walks the filesystem under configured embedding roots, computes SHA-256 of each file's raw bytes
- **AC-004-03**: Diff produces three sets: **changed** (hash mismatch), **added** (in filesystem, not in manifest), **deleted** (in manifest, not on filesystem)
- **AC-004-04**: Re-embeds changed + added files; copies unchanged vectors forward from prior .emb
- **AC-004-05**: Does NOT require any VCS — works on plain directories, git, svn, or any filesystem
- **AC-004-06**: Does NOT require user to commit changes — working-copy state is what gets embedded
- **AC-004-07**: New `.emb` written with updated HNSW index + refreshed `file_hashes` manifest
- **AC-004-08**: When prior `.emb` has no `file_hashes` manifest (legacy), exits with `LEGACY_PACKAGE_NO_HASHES` and prompts full rebuild

### FR-005: First-run error with interactive auto-full-generate (GH-229)
**Confidence**: High
- **AC-005-01**: `--incremental` with no prior .emb errors with `NO_PRIOR_PACKAGE`
- **AC-005-02**: Interactive prompt: "No prior package to diff against. Run full generate now? [Y/n]"
- **AC-005-03**: On Y: runs full `isdlc embedding generate` and exits on completion
- **AC-005-04**: On n: exits without side effects

### FR-006: Deletion detection blocks incremental with rebuild prompt (GH-229)
**Confidence**: High
- **AC-006-01**: During filesystem walk, any path present in prior `.emb` `file_hashes` manifest but not on disk is flagged as deleted
- **AC-006-02**: Any deletion count ≥ 1 causes exit with `DELETIONS_DETECTED` error
- **AC-006-03**: Error message: "File deletions detected ({N} files). Incremental cannot clean orphan vectors — search would return dead paths. Run full `isdlc embedding generate` to rebuild."
- **AC-006-04**: Rationale (data integrity): keeping vectors for deleted files causes `semantic_search` to return results pointing to non-existent paths — a version consistency problem that requires full regeneration to fix
- **AC-006-05**: Renames are treated as delete + add → also triggers full rebuild (by design, not a bug)

### FR-007: .emb manifest fields for HNSW + filesystem-hash incremental (GH-227, GH-229)
**Confidence**: High
- **AC-007-01**: `.emb` manifest includes `hnsw_index_present: boolean`
- **AC-007-02**: `.emb` manifest includes `file_hashes: { <relative-path>: <sha256-hex> }` — one entry per indexed file
- **AC-007-03**: `.emb` manifest includes `hnsw_params: { M, efConstruction, efSearch }` for version tracking
- **AC-007-04**: `.emb` manifest includes `hash_algorithm: "sha256"` for forward compatibility
- **AC-007-05**: Legacy `.emb` without these fields still loads for queries (HNSW fallback path per FR-003); incremental rejects them with `LEGACY_PACKAGE_NO_HASHES` per AC-004-08

---

## 7. Non-Functional Requirements

### NFR-001: Query latency <1s p95 at 1M vectors
- Measured: p95 of `findNearest()` calls via HNSW backend over 1M-vector corpus

### NFR-002: Incremental re-index <60s for changed-file batch
- Measured: wall-clock time for `--incremental` run with representative change set (<500 changed files)

### NFR-003: Recall ≥95% on HNSW queries
- Measured: top-k results overlap vs linear-scan ground truth on test corpus

### NFR-004: Backward compatibility
- .emb packages written before HNSW introduction load without error (fallback path)

---

## 8. Out of Scope

- Memory-layer vector store scaling (covered by separate #133)
- Remote vector database integration
- Rename detection (treated as delete + add → triggers full rebuild via FR-006)
- Any VCS integration (design is VCS-agnostic via filesystem hashing)
- Dynamic HNSW index updates at runtime (rebuild-at-packaging only)
- Configurable HNSW params via CLI flags (config file only; future enhancement)

---

## 9. Assumptions

- **VCS-agnostic by design** — filesystem is the source of truth, no VCS coupling; works on git (dogfooding), SVN (next-week project), or any plain directory
- **No commit required** — user edits files, runs `--incremental`, changes are picked up from working-copy state
- `faiss-node ^0.5.1` binary builds successfully on target platform (macOS/Linux confirmed; Windows TBD in Phase 05)
- HNSW default params (M=16, efC=200, efS=50) give adequate recall/latency for this corpus
- User tolerates interactive prompt for first-run auto-generate (not a fully automated CI flow)
- Filesystem hash scan at 1M LOC (~50K files) completes in <1s (SHA-256 via Node crypto)

---

## 10. MoSCoW Prioritization

| FR | Title | Priority |
|----|-------|----------|
| FR-001 | HNSW built at generation | Must |
| FR-002 | findNearest() HNSW backend | Must |
| FR-003 | Graceful fallback | Must |
| FR-004 | --incremental with VCS diff | Must |
| FR-005 | First-run auto-offer | Must |
| FR-006 | Deletion → rebuild | Must |
| FR-007 | .emb metadata fields | Must |
| NFR-001 | p95 <1s query latency | Must |
| NFR-002 | <60s incremental re-index | Must |
| NFR-003 | ≥95% recall | Should |
| NFR-004 | Backward compat .emb | Must |
