# Task Plan: REQ-GH-237 replace-codebert-with-jina-v2-base-code

## Progress Summary

| Phase | Total | Done | Remaining |
|-------|-------|------|-----------|
| 05    | 3     | 0    | 3         |
| 06    | 9     | 0    | 9         |
| 16    | 2     | 0    | 2         |
| 08    | 2     | 0    | 2         |
| **Total** | **16** | **0** | **16** |

## Phase 05: Test Strategy -- PENDING

- [ ] T001 Design test cases for Jina adapter (embed, healthCheck, dispose, fail-open) | traces: FR-001, AC-001-01, AC-001-02, AC-001-03, AC-001-04
  files: lib/embedding/engine/jina-code-adapter.test.js (CREATE)
- [ ] T002 Design test cases for engine provider routing (jina-code default, codebert removal error) | traces: FR-002, AC-002-01, AC-002-02, AC-002-03
  files: lib/embedding/engine/index.test.js (MODIFY)
- [ ] T003 Design test cases for discover pre-warm step (success, fail-open) | traces: FR-005, AC-005-01, AC-005-02
  files: lib/setup-project-knowledge.js (MODIFY)

## Phase 06: Implementation -- PENDING

- [ ] T004 Create jina-code-adapter.js with Transformers.js pipeline | traces: FR-001, AC-001-01, AC-001-02, AC-001-03, AC-001-04
  files: lib/embedding/engine/jina-code-adapter.js (CREATE)
  blocked_by: []
  blocks: [T005, T008]
- [ ] T005 Update engine/index.js provider routing — add jina-code, remove codebert, update exports | traces: FR-002, AC-002-01, AC-002-02, AC-002-03
  files: lib/embedding/engine/index.js (MODIFY)
  blocked_by: [T004]
  blocks: [T007, T010]
- [ ] T006 Update package.json — remove onnxruntime-node, add @huggingface/transformers | traces: FR-003, AC-003-01, AC-003-02
  files: package.json (MODIFY)
  blocked_by: []
  blocks: [T004]
- [ ] T007 Delete codebert-adapter.js, codebert-adapter.test.js, model-downloader.js, model-downloader.test.js | traces: FR-004, AC-004-01, AC-004-02
  files: lib/embedding/engine/codebert-adapter.js (DELETE), lib/embedding/engine/codebert-adapter.test.js (DELETE), lib/embedding/installer/model-downloader.js (DELETE), lib/embedding/installer/model-downloader.test.js (DELETE)
  blocked_by: [T005]
  blocks: []
- [ ] T008 Add discover pre-warm step in setup-project-knowledge.js | traces: FR-005, AC-005-01, AC-005-02
  files: lib/setup-project-knowledge.js (MODIFY)
  blocked_by: [T004]
  blocks: []
- [ ] T009 Add stale embedding warning — model_id in builder metadata, check in reader | traces: FR-006, AC-006-01, AC-006-02
  files: lib/embedding/package/builder.js (MODIFY), lib/embedding/package/reader.js (MODIFY)
  blocked_by: []
  blocks: []
- [ ] T010 Update test fixtures — replace codebert references in discover-integration.test.js and index.test.js | traces: FR-007, AC-007-01, AC-007-02
  files: lib/embedding/discover-integration.test.js (MODIFY), lib/embedding/engine/index.test.js (MODIFY)
  blocked_by: [T005]
  blocks: []
- [ ] T011 Write unit tests for jina-code-adapter (embed, healthCheck, dispose, fail-open) | traces: FR-001, AC-001-01, AC-001-02, AC-001-03, AC-001-04
  files: lib/embedding/engine/jina-code-adapter.test.js (CREATE)
  blocked_by: [T004]
  blocks: []
- [ ] T012 Write unit tests for updated engine index routing | traces: FR-002, AC-002-01, AC-002-02, AC-002-03
  files: lib/embedding/engine/index.test.js (MODIFY)
  blocked_by: [T005]
  blocks: []

## Phase 16: Quality Loop -- PENDING

- [ ] T013 Run full test suite — verify all embedding tests pass | traces: FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007
- [ ] T014 Verify no CodeBERT references remain in production code | traces: FR-004, AC-004-01

## Phase 08: Code Review -- PENDING

- [ ] T015 Constitutional compliance review (Articles II, III, V, X, XIII) | traces: FR-001, FR-002, FR-003, FR-004
- [ ] T016 Dual-file check — verify changes apply to both src/ and .isdlc/.claude/ where applicable | traces: FR-001, FR-002

## Dependency Graph

```
T006 (package.json) → T004 (jina adapter) → T005 (engine index) → T007 (delete CodeBERT)
                                           → T008 (pre-warm)       → T010 (test fixtures)
                       T004 → T011 (adapter tests)                  → T012 (routing tests)
T009 (stale warning) — independent
```

Critical path: T006 → T004 → T005 → T007 (4 tasks)

## Traceability Matrix

| FR | ACs | Tasks |
|----|-----|-------|
| FR-001 | AC-001-01, AC-001-02, AC-001-03, AC-001-04 | T001, T004, T011 |
| FR-002 | AC-002-01, AC-002-02, AC-002-03 | T002, T005, T012 |
| FR-003 | AC-003-01, AC-003-02 | T006 |
| FR-004 | AC-004-01, AC-004-02 | T007, T014 |
| FR-005 | AC-005-01, AC-005-02 | T003, T008 |
| FR-006 | AC-006-01, AC-006-02 | T009 |
| FR-007 | AC-007-01, AC-007-02 | T010 |

## Assumptions and Inferences

- A11: `installer/lifecycle.test.js` may need inspection during T007 — if it has non-CodeBERT tests, preserve them
- A12: T005 blocked by T004 (adapter must exist before routing can reference it)
