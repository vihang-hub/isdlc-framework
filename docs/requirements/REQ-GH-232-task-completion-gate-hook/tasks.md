# Task Plan: REQ-GH-232 task-completion-gate-hook

## Progress Summary

| Phase | Tasks | Complete | Status |
|-------|-------|----------|--------|
| 05 | 5 | 0 | PENDING |
| 06 | 11 | 0 | PENDING |
| 16 | 2 | 0 | PENDING |
| 08 | 2 | 0 | PENDING |
| **Total** | **20** | **0** | **0%** |

## Phase 05: Test Strategy -- PENDING

- [ ] T001 Design unit test cases for task-completion-logic pure functions | traces: FR-001, FR-002, AC-001-01, AC-001-02, AC-002-01, AC-002-02, AC-002-03, AC-002-04, AC-002-05, AC-002-06
  files: docs/requirements/REQ-GH-232-task-completion-gate-hook/test-cases.md (CREATE)
  blocks: [T008, T009]
- [ ] T002 Design unit test cases for task-completion-gate hook entry (copy-to-temp pattern per Article XIII) | traces: FR-001, AC-001-03
  files: docs/requirements/REQ-GH-232-task-completion-gate-hook/test-cases.md (MODIFY)
  blocked_by: [T001]
  blocks: [T010, T011]
- [ ] T003 Design unit test cases for tasks bridge (dynamic ESM import, fail-open) | traces: ADR-002
  files: docs/requirements/REQ-GH-232-task-completion-gate-hook/test-cases.md (MODIFY)
  blocked_by: [T001]
  blocks: [T006, T007]
- [ ] T004 Design integration test for 3f-task-completion dispatch routing | traces: FR-004, AC-004-01, AC-004-02
  files: docs/requirements/REQ-GH-232-task-completion-gate-hook/test-cases.md (MODIFY)
  blocked_by: [T001]
  blocks: [T014, T015]
- [ ] T005 Design test fixtures (sample tasks.md files, state.json diff scenarios) | traces: FR-001, FR-002
  files: docs/requirements/REQ-GH-232-task-completion-gate-hook/test-fixtures.md (CREATE)
  blocked_by: [T001]
  blocks: [T007, T009, T011, T015]

## Phase 06: Implementation -- PENDING

- [ ] T006 Create tasks bridge src/core/bridge/tasks.cjs with dynamic ESM import of readTaskPlan (setup) | traces: ADR-002
  files: src/core/bridge/tasks.cjs (CREATE)
  blocked_by: [T003]
  blocks: [T007, T008, T010]
- [ ] T007 Write unit tests for tasks bridge (unit_tests) | traces: ADR-002
  files: src/claude/hooks/tests/tasks-bridge.test.cjs (CREATE)
  blocked_by: [T005, T006]
- [ ] T008 Create task-completion-logic.cjs with check, detectPhaseCompletionTransition, countUnfinishedTopLevelTasks, formatBlockMessage pure functions (core_implementation) | traces: FR-001, FR-002, AC-001-01, AC-001-02, AC-002-05
  files: src/claude/hooks/lib/task-completion-logic.cjs (CREATE)
  blocked_by: [T001, T006]
  blocks: [T009, T010]
- [ ] T009 Write unit tests for task-completion-logic covering all 9 error codes TCG-001 through TCG-009 (unit_tests) | traces: FR-001, FR-002, AC-001-01, AC-001-02, AC-002-01, AC-002-02, AC-002-03, AC-002-04, AC-002-05, AC-002-06
  files: src/claude/hooks/tests/task-completion-logic.test.cjs (CREATE)
  blocked_by: [T005, T008]
- [ ] T010 Create task-completion-gate.cjs hook entry (stdin read, delegate to logic, outputBlockResponse on block) (core_implementation) | traces: FR-001, FR-002
  files: src/claude/hooks/task-completion-gate.cjs (CREATE)
  blocked_by: [T002, T006, T008]
  blocks: [T011, T012]
- [ ] T011 Write unit tests for task-completion-gate hook entry using copy-to-temp pattern (unit_tests) | traces: FR-001, FR-002, AC-002-06
  files: src/claude/hooks/tests/task-completion-gate.test.cjs (CREATE)
  blocked_by: [T005, T010]
- [ ] T012 Register task-completion-gate in src/claude/settings.json PreToolUse hooks with matcher Edit|Write (wiring_claude) | traces: ADR-001
  files: src/claude/settings.json (MODIFY)
  blocked_by: [T010]
- [ ] T013 Verify no Codex wiring needed — Claude Code hooks are provider-specific; document decision in codex-notes (wiring_codex) | traces: ADR-000
  files: docs/requirements/REQ-GH-232-task-completion-gate-hook/codex-notes.md (CREATE)
- [ ] T014 Add 3f-task-completion handler section to src/claude/commands/isdlc.md STEP 3f and update dispatch table entry for TASKS INCOMPLETE routing (core_implementation) | traces: FR-003, FR-004, AC-003-01, AC-003-02, AC-003-03, AC-003-04, AC-003-05, AC-004-01, AC-004-02
  files: src/claude/commands/isdlc.md (MODIFY)
  blocked_by: [T004]
  blocks: [T015]
- [ ] T015 Write integration test verifying 3f dispatch routes TASKS INCOMPLETE to 3f-task-completion handler (unit_tests) | traces: FR-004, AC-004-01, AC-004-02
  files: src/claude/hooks/tests/task-completion-dispatch.test.cjs (CREATE)
  blocked_by: [T005, T014]
- [ ] T016 Document active_workflow.skipped_tasks[] schema addition in state-schema-notes (cleanup) | traces: AC-003-04
  files: docs/requirements/REQ-GH-232-task-completion-gate-hook/state-schema-notes.md (CREATE)
  blocked_by: [T014]

## Phase 16: Quality Loop -- PENDING

- [ ] T017 Run full hook test suite and verify all tests pass (test_execution) | traces: FR-001, FR-002, FR-003, FR-004
  files: src/claude/hooks/tests/task-completion-logic.test.cjs (MODIFY), src/claude/hooks/tests/task-completion-gate.test.cjs (MODIFY), src/claude/hooks/tests/tasks-bridge.test.cjs (MODIFY), src/claude/hooks/tests/task-completion-dispatch.test.cjs (MODIFY)
  blocked_by: [T007, T009, T011, T015]
- [ ] T018 Verify test coverage >= 80% for task-completion-logic.cjs and >= 85% for task-completion-gate.cjs (parity_verification) | traces: Article II
  files: src/claude/hooks/lib/task-completion-logic.cjs (MODIFY), src/claude/hooks/task-completion-gate.cjs (MODIFY)
  blocked_by: [T017]

## Phase 08: Code Review -- PENDING

- [ ] T019 Constitutional review — verify Article I.5 enforcement intent, Article III security (no user input eval), Article X fail-open on 8 of 9 error codes, Article XIII CJS/ESM bridge pattern, Article XIV state integrity (constitutional_review) | traces: Article I, III, X, XIII, XIV
  files: src/claude/hooks/task-completion-gate.cjs (MODIFY), src/claude/hooks/lib/task-completion-logic.cjs (MODIFY), src/core/bridge/tasks.cjs (MODIFY)
  blocked_by: [T018]
- [ ] T020 Dual-file check — verify src/claude/ changes propagate correctly to .claude/ symlinks after install (dual_file_check) | traces: Article VIII
  files: .claude/hooks/task-completion-gate.cjs (MODIFY), .claude/hooks/lib/task-completion-logic.cjs (MODIFY)
  blocked_by: [T019]

## Dependency Graph

```
T001 ---> T002, T003, T004, T005
T003 ---> T006
T005 ---> T007, T009, T011, T015
T006 ---> T007, T008, T010
T008 ---> T009, T010
T002 ---> T010, T011
T010 ---> T011, T012
T004 ---> T014
T014 ---> T015, T016
T007, T009, T011, T015 ---> T017
T017 ---> T018
T018 ---> T019
T019 ---> T020
```

**Critical path** (longest chain, 9 tasks): T001 → T003 → T006 → T008 → T010 → T011 → T017 → T018 → T019 → T020

## Traceability Matrix

| FR | Related ACs | Phase 05 tasks | Phase 06 tasks | Phase 16 tasks | Phase 08 tasks |
|----|-------------|----------------|----------------|----------------|----------------|
| FR-001 | AC-001-01, AC-001-02, AC-001-03 | T001, T002 | T008, T009, T010, T011 | T017 | T019 |
| FR-002 | AC-002-01..06 | T001 | T008, T009, T010, T011 | T017, T018 | T019 |
| FR-003 | AC-003-01..05 | T004 | T014 | T017 | T019 |
| FR-004 | AC-004-01, AC-004-02 | T004 | T014, T015 | T017 | T019 |

**Coverage**: 4/4 FRs covered, 16/16 ACs covered. No orphan tasks.
