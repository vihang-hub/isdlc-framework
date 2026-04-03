# Task Plan: REQ-GH-219 post-finalize-validation-hook

## Progress Summary

| Phase | Tasks | Complete | % |
|-------|-------|----------|---|
| 05 | 1 | 0 | 0% |
| 06 | 10 | 0 | 0% |
| 16 | 2 | 0 | 0% |
| 08 | 2 | 0 | 0% |
| **Total** | **15** | **0** | **0%** |

## Phase 05: Test Strategy -- PENDING

- [ ] T0001 Design test strategy for finalize-runner, task-reader metadata extension, and finalize-utils | traces: FR-001, FR-002, FR-005, NFR-004

## Phase 06: Implementation -- PENDING

- [ ] T0002 Extend task-reader.js metadata parsing for critical, fail_open, max_retries, type annotations | traces: FR-001, AC-001-02, NFR-004
  files: src/core/tasks/task-reader.js (MODIFY)

- [ ] T0003 Create default finalize-steps.default.md template with all current finalization steps | traces: FR-001, AC-001-01, AC-001-02, AC-001-03
  files: src/core/finalize/finalize-steps.default.md (CREATE)
  blocked_by: [T0002]

- [ ] T0004 Extract common finalize functions from workflow-finalize.cjs into finalize-utils.js | traces: FR-005, AC-005-01, AC-005-02
  files: src/core/finalize/finalize-utils.js (CREATE), src/antigravity/workflow-finalize.cjs (MODIFY)

- [ ] T0005 Implement finalize-runner.js reusing task-reader and task-dispatcher retry pattern | traces: FR-002, AC-002-01, AC-002-02, AC-002-03, AC-002-04, AC-002-05, AC-002-06, NFR-004
  files: src/core/finalize/finalize-runner.js (CREATE)
  blocked_by: [T0002, T0003, T0004]

- [ ] T0006 Write unit tests for finalize-runner, finalize-utils, and task-reader extension | traces: FR-002, FR-005, NFR-004
  files: src/core/finalize/__tests__/finalize-runner.test.js (CREATE), src/core/finalize/__tests__/finalize-utils.test.js (CREATE), src/core/tasks/__tests__/task-reader-metadata.test.js (CREATE)
  blocked_by: [T0002, T0004, T0005]

- [ ] T0007 Rewrite Phase-Loop Controller STEP 4 to call finalize runner instead of orchestrator delegation | traces: FR-003, AC-003-01, AC-003-02, AC-003-03
  files: src/claude/commands/isdlc.md (MODIFY)
  blocked_by: [T0005]

- [ ] T0008 Update init-project.sh to copy default finalize-steps.md during setup | traces: FR-004, AC-004-01
  files: bin/init-project.sh (MODIFY)
  blocked_by: [T0003]

- [ ] T0009 Add finalize-steps.md to updater preserve-list | traces: FR-004, AC-004-02
  files: lib/updater.js (MODIFY)

- [ ] T0010 Copy default finalize-steps.md to .isdlc/config/ for dogfooding | traces: FR-001
  files: .isdlc/config/finalize-steps.md (CREATE)
  blocked_by: [T0003]

- [ ] T0011 Update README Configuration section and CLAUDE.md Key Files | traces: FR-006, AC-006-01, AC-006-02, AC-006-03
  files: README.md (MODIFY), CLAUDE.md (MODIFY)

## Phase 16: Quality Loop -- PENDING

- [ ] T0012 Run test suite and verify all tests pass | traces: FR-002, NFR-001
  blocked_by: [T0006]

- [ ] T0013 Verify dual-file parity between src/ and .isdlc/config/ | traces: FR-001
  blocked_by: [T0010]

## Phase 08: Code Review -- PENDING

- [ ] T0014 Constitutional review against Articles II, V, IX, X, XIII, XIV | traces: FR-002, NFR-002
  blocked_by: [T0012]

- [ ] T0015 Dual-file and provider-neutrality check | traces: FR-005, NFR-003
  blocked_by: [T0012]

## Dependency Graph

- T0003 (default template) blocked by T0002 (task-reader extension)
- T0005 (finalize-runner) blocked by T0002 (task-reader extension), T0003 (default template), T0004 (extract finalize-utils)
- T0006 (unit tests) blocked by T0002 (task-reader extension), T0004 (extract finalize-utils), T0005 (finalize-runner)
- T0007 (STEP 4 rewrite) blocked by T0005 (finalize-runner)
- T0008 (init-project.sh) blocked by T0003 (default template)
- T0010 (dogfooding copy) blocked by T0003 (default template)
- T0012 (test suite) blocked by T0006 (unit tests)
- T0013 (dual-file parity) blocked by T0010 (dogfooding copy)
- T0014 (constitutional review) blocked by T0012 (test suite)
- T0015 (provider-neutrality check) blocked by T0012 (test suite)
- T0001 (test strategy), T0004 (extract finalize-utils), T0009 (updater preserve-list), T0011 (README/CLAUDE.md) -- no blockers

Critical path: T0002 (task-reader extension) -> T0003 (default template) -> T0005 (finalize-runner) -> T0006 (unit tests) -> T0012 (test suite) -> T0014 (constitutional review)

## Traceability Matrix

- FR-001 (Config file): T0002 (task-reader extension), T0003 (default template), T0010 (dogfooding copy)
- FR-002 (Checklist runner): T0005 (finalize-runner), T0006 (unit tests), T0012 (test suite)
- FR-003 (STEP 4 rewrite): T0007 (STEP 4 rewrite)
- FR-004 (Installer/updater): T0008 (init-project.sh), T0009 (updater preserve-list)
- FR-005 (Migrate to core): T0004 (extract finalize-utils)
- FR-006 (Documentation): T0011 (README/CLAUDE.md)
- NFR-004 (Reuse #220 patterns): T0002 (task-reader extension), T0005 (finalize-runner), T0006 (unit tests)
