# Test Cases: FR-04 - tasks.md Update Logic

**Requirement:** FR-04 (AC-04a, AC-04b, AC-04c, AC-04d)
**Test Type:** Integration Tests
**Scope:** Verify that tasks.md checkboxes and Progress Summary are updated after phase completion
**File:** `src/claude/hooks/tests/test-state-sync-integration.test.cjs` (new)

---

## Test Data Fixtures

### Fixture: Sample tasks.md content
```markdown
# Task Plan: fix BUG-0005-state-tracking-stale

**Workflow:** fix

---

## Progress Summary

| Phase | Status | Tasks |
|-------|--------|-------|
| Phase 01: Bug Report | COMPLETE | 4/4 |
| Phase 02: Tracing | PENDING | 0/3 |
| Phase 05: Test Strategy | PENDING | 0/3 |
| Phase 06: Implementation | PENDING | 0/8 |
| **Total** | **4/18 (22%)** | |

---

## Phase 01: Bug Report -- COMPLETE

- [X] T0001 Identify bug
- [X] T0002 Analyze root cause
- [X] T0003 Draft bug report
- [X] T0004 Save artifacts

## Phase 02: Tracing -- PENDING

- [ ] T0005 Trace hook reads
- [ ] T0006 Trace STEP 3e updates
- [ ] T0007 Trace tasks.md lifecycle

## Phase 05: Test Strategy -- PENDING

- [ ] T0008 Design test cases for hooks
- [ ] T0009 Design test cases for state sync
- [ ] T0010 Design test cases for tasks.md
```

---

## TC-04a: STEP 3e reads tasks.md if it exists

### TC-04a-01: tasks.md exists and is readable
- **Given**: `docs/isdlc/tasks.md` exists in the test directory with valid content.
- **When**: STEP 3e tasks.md update logic runs for completed phase `"02-tracing"`.
- **Then**: The logic successfully reads the file without error. The file is modified.

### TC-04a-02: tasks.md is empty
- **Given**: `docs/isdlc/tasks.md` exists but is empty (0 bytes).
- **When**: STEP 3e tasks.md update logic runs.
- **Then**: Logic does not crash. File is left as-is (nothing to update).

---

## TC-04b: Completed phase tasks changed from [ ] to [X]

### TC-04b-01: All tasks in completed phase section marked [X]
- **Given**: tasks.md with Phase 02 section containing 3 tasks: `- [ ] T0005 ...`, `- [ ] T0006 ...`, `- [ ] T0007 ...`.
- **When**: Phase `"02-tracing"` completes.
- **Then**: All 3 tasks become `- [X] T0005 ...`, `- [X] T0006 ...`, `- [X] T0007 ...`.

### TC-04b-02: Tasks with annotations preserved
- **Given**: tasks.md with task `- [ ] T0011 Fix constitution-validator.cjs | traces: AC-03a`.
- **When**: Phase `"06-implementation"` completes.
- **Then**: Task becomes `- [X] T0011 Fix constitution-validator.cjs | traces: AC-03a`. The pipe-delimited annotation is preserved.

### TC-04b-03: Already-checked tasks not double-checked
- **Given**: tasks.md with Phase 01 tasks already `[X]` and Phase 02 completing.
- **When**: Phase `"02-tracing"` completes.
- **Then**: Phase 01 tasks remain `[X]` (not modified). Phase 02 tasks change to `[X]`.

### TC-04b-04: Section header updated from PENDING to COMPLETE
- **Given**: tasks.md with `## Phase 02: Tracing -- PENDING`.
- **When**: Phase `"02-tracing"` completes.
- **Then**: Header becomes `## Phase 02: Tracing -- COMPLETE`.

### TC-04b-05: Tasks in non-completed phases remain [ ]
- **Given**: tasks.md with Phase 05 tasks as `[ ]`.
- **When**: Phase `"02-tracing"` completes (Phase 05 still pending).
- **Then**: Phase 05 tasks remain `[ ]`.

---

## TC-04c: Progress Summary table updated

### TC-04c-01: Completed count increases
- **Given**: Progress Summary shows `Phase 02: Tracing | PENDING | 0/3`.
- **When**: Phase `"02-tracing"` completes (3 tasks marked [X]).
- **Then**: Row becomes `Phase 02: Tracing | COMPLETE | 3/3`.

### TC-04c-02: Total row recalculated
- **Given**: Progress Summary total is `4/18 (22%)`.
- **When**: Phase `"02-tracing"` completes (3 more tasks done, total now 7/18).
- **Then**: Total row becomes `7/18 (39%)` (or nearest integer percentage).

### TC-04c-03: Multiple phases completed - cumulative accuracy
- **Given**: Phases 01, 02, and 05 all completed (4 + 3 + 3 = 10 tasks).
- **When**: Checking Progress Summary after Phase 05 completion.
- **Then**: Total shows `10/18 (56%)`. Each completed phase shows its full task count.

---

## TC-04d: tasks.md missing - silent skip

### TC-04d-01: No tasks.md file - no error
- **Given**: `docs/isdlc/tasks.md` does NOT exist in the project directory.
- **When**: STEP 3e tasks.md update logic runs.
- **Then**: No error is thrown. No file is created. State.json updates proceed normally.

### TC-04d-02: docs/isdlc/ directory missing - no error
- **Given**: The `docs/isdlc/` directory does not exist.
- **When**: STEP 3e tasks.md update logic runs.
- **Then**: No error. No directory or file created.

---

## Summary

| AC | Test Cases | Count |
|----|-----------|-------|
| AC-04a | TC-04a-01, TC-04a-02 | 2 |
| AC-04b | TC-04b-01, TC-04b-02, TC-04b-03, TC-04b-04, TC-04b-05 | 5 |
| AC-04c | TC-04c-01, TC-04c-02, TC-04c-03 | 3 |
| AC-04d | TC-04d-01, TC-04d-02 | 2 |
| **Total** | | **12** |
