# Test Strategy: BUG-0012 -- Premature Git Commit During Implementation

**Bug ID**: BUG-0012
**Phase**: 05-test-strategy
**Created**: 2026-02-13
**Traces to**: requirements-spec.md (FR-01 through FR-05, NFR-01 through NFR-03)

---

## 1. Existing Infrastructure (from test evaluation)

- **Framework**: Node.js built-in `node:test` + `node:assert/strict` (Node 18+)
- **Hook Test Pattern**: CJS files in `src/claude/hooks/tests/*.test.cjs`
- **Test Helpers**: `src/claude/hooks/tests/hook-test-utils.cjs` (setupTestEnv, runHook, prepareHook)
- **Existing branch-guard Tests**: 14 tests (T1-T14) in `src/claude/hooks/tests/branch-guard.test.cjs`
- **Test Runner**: `npm run test:hooks` (CJS stream)
- **Current branch-guard.test.cjs Pattern**: Uses its own local `setupTestEnv()`, `writeState()`, `setupGitRepo()`, and `runHook()` helpers (not shared hook-test-utils.cjs)

## 2. Strategy: Extend Existing Test Suite

**Approach**: ADD new test cases to the existing `branch-guard.test.cjs` file. Do NOT replace or restructure the existing 14 tests (T1-T14). Follow the same test patterns: local `setupTestEnv()`, `writeState()`, `setupGitRepo()`, `runHook()`, and `makeStdin()` helpers already in the file.

**New Test Scope**: 17 new test cases (T15-T31) covering:
- Phase-aware commit blocking on feature/bugfix branches (core fix)
- Commit allowance during final phase and no-workflow scenarios (boundary)
- Preserved main/master blocking behavior (regression)
- Error message quality (UX)
- Agent file content validation (defense-in-depth)

## 3. Test Types

### 3.1 Unit Tests (Hook Logic) -- 12 tests

These tests exercise the enhanced `branch-guard.cjs` hook directly by spawning it as a child process with controlled stdin, state.json, and git repo. They validate the phase-aware commit blocking logic.

| ID | Requirement | Scenario |
|----|-------------|----------|
| T15 | AC-07, AC-09 | Block commit on feature branch during phase `06-implementation` |
| T16 | AC-07, AC-09 | Block commit on bugfix branch during phase `16-quality-loop` |
| T17 | AC-07, AC-09 | Block commit on feature branch during phase `05-test-strategy` |
| T18 | AC-08, AC-10, AC-15 | Allow commit during final phase `08-code-review` |
| T19 | AC-11 | Allow commit when no active_workflow (fail-open) |
| T20 | AC-12 | Allow commit on non-workflow branch (e.g., `hotfix/urgent`) |
| T21 | AC-14 | Fail-open when `current_phase` is missing from state |
| T22 | AC-14 | Fail-open when `phases` array is missing from state |
| T23 | AC-18 | Allow `git add` without `git commit` during blocked phases |
| T24 | AC-13, AC-19, AC-20 | Block message includes phase name, stash suggestion, orchestrator note |
| T25 | AC-16 | Allow commit during last phase even for non-standard workflows |
| T26 | NFR-03 | Regression: still blocks commits to main/master (existing T1 coverage extended) |

### 3.2 Agent Content Tests -- 5 tests

These tests validate that agent markdown files contain the required no-commit instructions. They are file-content assertions (read file, check for required strings).

| ID | Requirement | Scenario |
|----|-------------|----------|
| T27 | AC-01, AC-02 | software-developer agent contains "Do NOT run git add or git commit" |
| T28 | AC-03 | software-developer agent explains WHY commits are prohibited |
| T29 | AC-04 | software-developer agent mentions orchestrator manages git operations |
| T30 | AC-05 | quality-loop-engineer agent contains "Do NOT run git add or git commit" |
| T31 | AC-06 | quality-loop-engineer agent explains code review not yet run |

## 4. Test Data Strategy

### 4.1 State Fixtures

All tests use `writeState(tmpDir, stateObject)` to inject controlled state.json configurations.

**Standard workflow state** (used by most tests):
```json
{
  "active_workflow": {
    "type": "fix",
    "current_phase": "<varies>",
    "phases": ["01-requirements", "02-tracing", "05-test-strategy", "06-implementation", "16-quality-loop", "08-code-review"],
    "git_branch": { "name": "bugfix/BUG-0012-test", "status": "active" }
  }
}
```

**Variations**: no active_workflow, missing phases array, missing current_phase, different workflow types (feature vs fix).

### 4.2 Git Repo Fixtures

Tests use `setupGitRepo(tmpDir, branchName)` to create a minimal git repo on the specified branch. Branch names used:
- `feature/REQ-NNNN-test` (feature workflow branch)
- `bugfix/BUG-NNNN-test` (fix workflow branch)
- `main` / `master` (protected branches)
- `hotfix/urgent` (non-workflow branch)

### 4.3 Stdin Fixtures

Tests use `makeStdin(command)` to create hook input. Commands tested:
- `git commit -m "msg"` (standard commit)
- `git add -A && git commit -m "msg"` (chained add+commit)
- `git add -A` (add without commit -- should never be blocked)
- `git stash` (alternative operation -- should never be blocked)

## 5. Coverage Targets

| Metric | Target |
|--------|--------|
| Line coverage for new branch-guard.cjs logic | >= 95% |
| Branch coverage for new decision paths | 100% (all phase-aware branches exercised) |
| Requirement coverage | 100% (all 20 ACs mapped to at least one test) |
| Regression coverage | Existing 14 tests (T1-T14) continue to pass |

## 6. Test Execution

### 6.1 Run Commands

```bash
# Run only branch-guard tests
node --test src/claude/hooks/tests/branch-guard.test.cjs

# Run all CJS hook tests (includes branch-guard)
npm run test:hooks

# Run all tests (ESM + CJS)
npm run test:all
```

### 6.2 Expected Results After Implementation

- T1-T14: PASS (existing, unchanged)
- T15-T31: FAIL initially (TDD red), then PASS after implementation

## 7. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Git repo setup adds latency | Tests use minimal repos (1 commit + branch) |
| Phase-aware logic errors | Test all phase positions: beginning, middle, last |
| Fail-open regression | Dedicated tests for missing state fields |
| Agent instruction drift | Content tests anchored to specific phrases |
| Performance regression (NFR-01) | No new subprocess calls; phase check is pure state.json read |

## 8. Constitutional Compliance

| Article | How Addressed |
|---------|---------------|
| Article II (Test-First) | Tests designed before implementation; TDD red-green |
| Article VII (Traceability) | Every test maps to at least one AC in traceability-matrix.csv |
| Article IX (Quality Gate) | GATE-05 requires 100% AC coverage before implementation proceeds |
| Article XI (Integration Testing) | Tests validate hook interacts correctly with state.json and git |
