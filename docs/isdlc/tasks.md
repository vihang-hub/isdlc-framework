# Task Plan: REQ-GH-227 embedding-scale-out

## Progress Summary

| Phase | Tasks | Complete | Status |
|-------|-------|----------|--------|
| 05 | 7 | 7 | PENDING |
| 06 | 7 | 7 | PENDING |
| 16 | 3 | 3 | PENDING |
| 08 | 2 | 2 | PENDING |
| **Total** | **19** | **19** | **100%** |

## Phase 05: Test Strategy -- COMPLETE

- [X] T001 Design test cases for HnswIndex (build, serialize, deserialize roundtrip, search recall vs linear ground truth) | traces: FR-001, FR-002, AC-001-01, AC-001-02, AC-001-03, AC-002-01, AC-002-02, NFR-003
  files: tests/embedding/hnsw/index.test.js (CREATE)
- [X] T002 Design test cases for FileHashManifest (computeManifest over temp dir, diffManifests returning changed+added+deleted sets) | traces: FR-004, AC-004-01, AC-004-02, AC-004-03
  files: tests/embedding/incremental/file-hash.test.js (CREATE)
- [X] T003 Design test cases for incrementalDiff orchestrator (happy path + error paths NoPriorPackage, LegacyPackage, DeletionsDetected) | traces: FR-004, FR-005, FR-006, AC-004-04, AC-004-07, AC-004-08, AC-005-01, AC-006-01, AC-006-02
  files: tests/embedding/incremental/index.test.js (CREATE)
- [X] T004 Design test cases for StoreManager HNSW routing (load HNSW, load legacy, fallback to linear, deduped warning) | traces: FR-002, FR-003, AC-002-02, AC-003-01, AC-003-02, AC-003-03, AC-003-04, AC-003-05
  files: tests/embedding/mcp-server/store-manager-hnsw.test.js (CREATE)
- [X] T005 Design test cases for CLI --incremental flag (flag parse, error translation, interactive prompt Y/n) | traces: FR-004, FR-005, FR-006, AC-004-05, AC-005-02, AC-005-03, AC-005-04, AC-006-02, AC-006-03
  files: tests/bin/isdlc-embedding-incremental.test.js (CREATE)
- [X] T006 Design test cases for .emb manifest backward compat (legacy package loads, new fields write, round-trip) | traces: FR-007, NFR-004, AC-007-01, AC-007-02, AC-007-03, AC-007-04, AC-007-05
  files: tests/embedding/package/manifest-compat.test.js (CREATE)
- [X] T007 Design synthetic corpus harness for scale validation (generate 50K fake files, measure p95 query, recall vs linear) | traces: NFR-001, NFR-002, NFR-003
  files: tests/embedding/scale/synthetic-corpus.test.js (CREATE)

## Phase 06: Implementation -- COMPLETE

- [X] T008 Create HnswIndex module (buildHnswIndex with defaults M=16 efC=200 efS=50, serializeHnswIndex, deserializeHnswIndex, searchHnsw) | traces: FR-001, FR-002, AC-001-01, AC-001-03, AC-002-01, AC-002-02
  files: lib/embedding/hnsw/index.js (CREATE)
  blocks: [T010, T011, T012, T013]
- [X] T009 Create FileHashManifest module (computeManifest via fs/promises + Node crypto SHA-256, diffManifests into changed+added+deleted) | traces: FR-004, AC-004-01, AC-004-02, AC-004-03
  files: lib/embedding/incremental/file-hash.js (CREATE)
  blocks: [T010]
- [X] T010 Create incrementalDiff orchestrator runIncremental (load prior emb, diff hashes, embed delta, merge unchanged vectors, rebuild HNSW, write new emb) | traces: FR-004, FR-005, FR-006, AC-004-04, AC-004-06, AC-004-07, AC-005-01, AC-006-01, AC-006-04
  files: lib/embedding/incremental/index.js (CREATE)
  blocked_by: [T008, T009, T012]
  blocks: [T014]
- [X] T011 Extend .emb package writer to serialize hnsw_index, file_hashes, hnsw_params, hash_algorithm fields | traces: FR-001, FR-007, AC-001-02, AC-007-01, AC-007-02, AC-007-03, AC-007-04
  files: lib/embedding/package/writer.js (MODIFY)
  blocked_by: [T008]
- [X] T012 Extend .emb package reader with backward-compat for missing new fields (legacy packages still load) | traces: FR-007, NFR-004, AC-007-05
  files: lib/embedding/package/reader.js (MODIFY)
  blocked_by: [T008]
  blocks: [T010, T013]
- [X] T013 Extend StoreManager detect hnsw_index_present on load, route findNearest to HNSW or linear, emit deduped HNSW_INDEX_UNAVAILABLE warning | traces: FR-002, FR-003, AC-002-02, AC-002-03, AC-003-01, AC-003-02, AC-003-03, AC-003-04, AC-003-05
  files: lib/embedding/mcp-server/store-manager.js (MODIFY)
  blocked_by: [T008, T012]
  blocks: [T015]
- [X] T014 Extend bin/isdlc-embedding.js with --incremental flag, error code translation, interactive prompt for NO_PRIOR_PACKAGE | traces: FR-004, FR-005, FR-006, AC-004-05, AC-005-02, AC-005-03, AC-005-04, AC-006-02, AC-006-03
  files: bin/isdlc-embedding.js (MODIFY)
  blocked_by: [T010]
  blocks: [T015, T017]

## Phase 16: Quality Loop -- COMPLETE

- [X] T015 Run full test suite, fix regressions from HNSW integration and manifest changes | traces: all
  blocked_by: [T008, T009, T010, T011, T012, T013, T014]
- [X] T016 Run synthetic corpus scale validation (50K files, measure p95 <1s, recall >=95%) | traces: NFR-001, NFR-002, NFR-003
  blocked_by: [T013, T015]
- [X] T017 Dogfood smoke test regenerate this project emb with HNSW, run --incremental after edits, verify semantic_search results | traces: FR-001, FR-002, FR-004, FR-005
  blocked_by: [T014, T015]

## Phase 08: Code Review -- COMPLETE

- [X] T018 Constitutional review Articles X (fail-open), XI (integration testing integrity), XIII (ESM), XIV (emb package integrity) | traces: all
  blocked_by: [T015, T016, T017]
- [X] T019 Provider parity verification (lib/embedding/ is provider-neutral, confirm no provider-specific changes needed) | traces: none
  blocked_by: [T015, T016, T017]

## Dependency Graph

```
T008 (HnswIndex) ──┬──> T011 (writer)
                   ├──> T012 (reader) ─┬──> T013 (StoreManager)
                   │                    └──> T010 (runIncremental)
                   └──> T013
T009 (FileHashManifest) ──> T010

T010 ──> T014 (CLI --incremental)

All implementation (T008-T014) ──> T015 (test suite)
T015 + T013 ──> T016 (scale validation)
T015 + T014 ──> T017 (dogfood)
T015, T016, T017 ──> T018 (constitutional), T019 (parity)
```

**Critical path**: T008 → T012 → T010 → T014 → T017 → T018

## Traceability Matrix

| FR/NFR | ACs | Tasks |
|--------|-----|-------|
| FR-001 | AC-001-01/02/03 | T001, T008, T011 |
| FR-002 | AC-002-01/02/03 | T001, T004, T008, T013 |
| FR-003 | AC-003-01/02/03/04/05 | T004, T013 |
| FR-004 | AC-004-01 through AC-004-08 | T002, T003, T005, T009, T010, T014 |
| FR-005 | AC-005-01/02/03/04 | T003, T005, T010, T014 |
| FR-006 | AC-006-01/02/03/04/05 | T003, T005, T010, T014 |
| FR-007 | AC-007-01/02/03/04/05 | T006, T011, T012 |
| NFR-001 | p95 <1s | T007, T016 |
| NFR-002 | <60s incremental | T007, T016 |
| NFR-003 | ≥95% recall | T001, T007, T016 |
| NFR-004 | backward compat | T006, T012 |
