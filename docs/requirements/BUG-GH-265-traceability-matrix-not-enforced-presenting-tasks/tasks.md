# Task Plan: SLUG BUG-GH-265-traceability-matrix-not-enforced-presenting-tasks

## Progress Summary

| Phase | Tasks | Completed | Percentage |
| --- | --- | --- | --- |
| 05-test-strategy | 8 | 0 | 0% |
| 06-implementation | 9 | 0 | 0% |
| 16-quality-loop | 2 | 0 | 0% |
| 08-code-review | 2 | 0 | 0% |
| TOTAL | 21 | 0 | 0% |

---

## Phase 05: Test Strategy -- PENDING

- [ ] T001 Test design — state-card composer renderCard inlining tests (rendering_mandate, content_coverage, template_ref body) | traces: FR-001, AC-001-01, AC-001-02, AC-001-03
  files: tests/core/roundtable/composers/state-card-composer.test.js (MODIFY)
- [ ] T002 Test design — state-card composer accepted_payloads inlining tests | traces: FR-002, AC-002-01, AC-002-02
  files: tests/core/roundtable/composers/state-card-composer.test.js (MODIFY)
- [ ] T003 Test design — task-card composer skill-body inlining tests per delivery_type | traces: FR-003, AC-003-01, AC-003-02, AC-003-03
  files: tests/core/roundtable/composers/task-card-composer.test.js (MODIFY)
- [ ] T004 Test design — soft per-section budget and truncation pointer tests | traces: FR-004, AC-004-01, AC-004-02
  files: tests/core/roundtable/composers/state-card-composer.test.js (MODIFY), tests/core/roundtable/composers/task-card-composer.test.js (MODIFY)
- [ ] T005 Test design — rolling-state accepted_payloads CRUD and migration tests | traces: FR-005, AC-005-01, AC-005-02, AC-005-03
  files: tests/core/roundtable/rolling-state/rolling-state.test.js (MODIFY)
- [ ] T006 Test design — bridge composeForTurn payload propagation test | traces: FR-006, AC-006-01
  files: tests/core/bridge/roundtable-payload-propagation.test.cjs (CREATE)
- [ ] T007 Test design — Article X fail-open regression tests across new file reads | traces: FR-007, AC-007-01, AC-007-02
  files: tests/core/roundtable/composers/state-card-composer.test.js (MODIFY), tests/core/roundtable/composers/task-card-composer.test.js (MODIFY)
- [ ] T008 Test design — provider parity test (Claude bridge vs Codex projection) | traces: FR-006, AC-006-02
  files: tests/parity/roundtable-composer-parity.test.js (CREATE)

---

## Phase 06: Implementation -- PENDING

- [ ] T010 Implement renderCard rendering_mandate + content_coverage inlining | traces: FR-001, AC-001-01, AC-001-02
  files: src/core/roundtable/state-card-composer.js (MODIFY)
  blocked_by: [T001]
  blocks: [T011, T013, T018]
- [ ] T011 Implement renderCard template_ref body inlining (columns, rendering, content_guidance, examples) | traces: FR-001, AC-001-03
  files: src/core/roundtable/state-card-composer.js (MODIFY)
  blocked_by: [T010]
  blocks: [T012, T013, T018]
- [ ] T012 Implement renderCard accepted_payloads inlining from context | traces: FR-002, AC-002-01, AC-002-02
  files: src/core/roundtable/state-card-composer.js (MODIFY)
  blocked_by: [T002, T011, T015]
  blocks: [T013, T018]
- [ ] T013 Convert MAX_TOTAL_LINES hard cap to soft per-section budget with truncation pointer | traces: FR-004, AC-004-01, AC-004-02
  files: src/core/roundtable/state-card-composer.js (MODIFY), src/core/roundtable/task-card-composer.js (MODIFY)
  blocked_by: [T004, T012, T014]
  blocks: [T018]
- [ ] T014 Implement renderTaskCard skill-body inlining per delivery_type | traces: FR-003, AC-003-01, AC-003-02, AC-003-03
  files: src/core/roundtable/task-card-composer.js (MODIFY)
  blocked_by: [T003]
  blocks: [T013, T018]
- [ ] T015 Implement rolling-state accepted_payloads field + applyAcceptedPayload writer + defensive init | traces: FR-005, AC-005-01, AC-005-02, AC-005-03
  files: src/core/roundtable/rolling-state.js (MODIFY)
  blocked_by: [T005]
  blocks: [T012, T016]
- [ ] T016 Implement bridge composeForTurn passing accepted_payloads via context | traces: FR-006, AC-006-01, AC-006-02
  files: src/core/bridge/roundtable.cjs (MODIFY)
  blocked_by: [T006, T015]
  blocks: [T019]
- [ ] T017 Update isdlc.md prose description of card contents (lines 757, 905) | traces: FR-008, AC-008-01
  files: src/claude/commands/isdlc.md (MODIFY)
  blocked_by: [T013]
- [ ] T018 Article X fail-open audit — wrap every new file read in try/catch with referenceFallback helper | traces: FR-007, AC-007-01, AC-007-02
  files: src/core/roundtable/state-card-composer.js (MODIFY), src/core/roundtable/task-card-composer.js (MODIFY)
  blocked_by: [T007, T010, T011, T012, T013, T014]
  blocks: [T019]

---

## Phase 16: Quality Loop -- PENDING

- [ ] T019 Run full test suite — composer, rolling-state, bridge, parity tests all green | traces: FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007
  files: (test execution — no file mutation)
  blocked_by: [T016, T018]
  blocks: [T020]
- [ ] T020 Provider parity verification — assert Claude bridge and Codex projection composer output identical | traces: FR-006, AC-006-02
  files: (test execution — no file mutation)
  blocked_by: [T019]
  blocks: [T021]

---

## Phase 08: Code Review -- PENDING

- [ ] T021 Constitutional review — Article X (fail-open), Article XIII (ESM), no schema change to source JSON | traces: FR-007
  files: (review — no file mutation)
  blocked_by: [T020]
  blocks: [T022]
- [ ] T022 Dual-file check — verify .claude/ symlinks reflect changes; verify Codex projection bundle inherits new composer output | traces: FR-006
  files: (verification — no file mutation)
  blocked_by: [T021]

---

## Dependency Graph

```
Phase 05 (parallel test design):
  T001, T002, T003, T004, T005, T006, T007, T008  (no dependencies)

Phase 06 (sequential by file dependency):
  T010 -> T011 -> T012 -> T013 -> T018
  T015 -> T012, T016
  T014 -> T013, T018
  T017 follows T013
  T016 -> T019

Phase 16:
  T019 -> T020

Phase 08:
  T021 -> T022
```

**Critical path**: T005 -> T015 -> T012 -> T013 -> T018 -> T019 -> T020 -> T021 -> T022 (9 tasks)

---

## Traceability Matrix

| FR | ACs | Phase 05 | Phase 06 | Phase 16 | Phase 08 |
| --- | --- | --- | --- | --- | --- |
| FR-001 | AC-001-01, AC-001-02, AC-001-03 | T001 | T010, T011 | T019 | T021 |
| FR-002 | AC-002-01, AC-002-02 | T002 | T012 | T019 | T021 |
| FR-003 | AC-003-01, AC-003-02, AC-003-03 | T003 | T014 | T019 | T021 |
| FR-004 | AC-004-01, AC-004-02 | T004 | T013 | T019 | T021 |
| FR-005 | AC-005-01, AC-005-02, AC-005-03 | T005 | T015 | T019 | T021 |
| FR-006 | AC-006-01, AC-006-02 | T006, T008 | T016 | T019, T020 | T022 |
| FR-007 | AC-007-01, AC-007-02 | T007 | T018 | T019 | T021 |
| FR-008 | AC-008-01 | (none — doc-touch) | T017 | (none) | T021 |

Coverage: 8/8 FRs, 18/18 ACs, all phases — 100%.

---

## Assumptions and Inferences

- Phase coverage limited to 05/06/16/08 — REQ-GH-253 boundary is fix workflow, not full feature pipeline.
- Soft budget cap placeholder of 200 lines per payload digest — actual cap tuned during T013 implementation against measured PRESENTING_TASKS output. Configurable via getRoundtableConfig.
- Provider parity assumed automatic via shared ESM composer imports — verified by T008 + T020.
- No source JSON changes — bug is in renderers; configs are correct.
- T017 doc-touch is paired with T013 budget conversion to keep prose aligned with renderer behavior.
- Out of scope tracked separately: tasks-as-table-validator.cjs replacement, build-workflow injection, Codex projection refactors, new PRESENTING_* states.
