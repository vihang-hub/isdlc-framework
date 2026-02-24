# Requirements Specification: BUG-0007

## Test Watcher Circuit Breaker False Positives Fix

**Version**: 1.0.0
**Date**: 2026-02-12
**Status**: Approved
**Workflow**: fix

---

## 1. Problem Statement

The test-watcher hook classifies unparseable test output as `FAILED`, causing false positive circuit breaker trips. The fix must introduce an `inconclusive` result classification that prevents unparseable output from affecting iteration enforcement state.

---

## 2. Functional Requirements

### FR-1: Introduce inconclusive result type in parseTestResult()

**Acceptance Criteria**:
- AC-1.1: `parseTestResult()` returns `{ passed: null, inconclusive: true, error: 'Unable to determine test result' }` when no success patterns, no failure patterns match, AND no exit code is available
- AC-1.2: When exit code IS available (0 or non-zero), `parseTestResult()` continues to use exit code for determination (no change to existing behavior)
- AC-1.3: When failure patterns match, result is still `FAILED` (no change)
- AC-1.4: When success patterns match, result is still `PASSED` (no change)
- AC-1.5: The `inconclusive` property is only set to `true` on inconclusive results; it is absent or false on determinate results

### FR-2: Handle inconclusive results in check() function

**Acceptance Criteria**:
- AC-2.1: When `testResult.inconclusive === true`, the history entry records `result: "INCONCLUSIVE"` (not `"FAILED"`)
- AC-2.2: When `testResult.inconclusive === true`, `failures_count` is NOT incremented
- AC-2.3: When `testResult.inconclusive === true`, `identical_failure_count` is NOT incremented
- AC-2.4: When `testResult.inconclusive === true`, the circuit breaker check is skipped entirely
- AC-2.5: When `testResult.inconclusive === true`, `last_test_result` is set to `"inconclusive"` (not `"failed"`)
- AC-2.6: The output message for inconclusive results is a warning (not an error), indicating the output could not be parsed and suggesting the user verify the test command

### FR-3: Iteration counter behavior for inconclusive results

**Acceptance Criteria**:
- AC-3.1: `current_iteration` IS incremented for inconclusive results (the run happened, it counts toward max iterations)
- AC-3.2: Max iterations check still applies to inconclusive results (if you hit max_iterations with all inconclusive, escalate)
- AC-3.3: The escalation reason for max iterations with inconclusive results is `"max_iterations"` (same as failures)

### FR-4: Backward compatibility

**Acceptance Criteria**:
- AC-4.1: All existing test cases in `test-test-watcher.test.cjs` continue to pass without modification
- AC-4.2: The `check()` function signature and return type are unchanged
- AC-4.3: The exports from `test-watcher.cjs` are unchanged (check, normalizeErrorForComparison, isIdenticalFailure, parseCoverage)
- AC-4.4: State.json schema for `test_iteration` is backward compatible (new `inconclusive` values in existing fields, no structural changes)

---

## 3. Non-Functional Requirements

### NFR-1: Test Coverage
- All new behavior must have unit tests
- Minimum 6 new test cases covering all inconclusive paths
- Existing 43 tests must continue to pass (regression-safe)

### NFR-2: Fail-Open Principle (Article X)
- The fix must maintain fail-open behavior: if the hook encounters an error, it exits cleanly (exit 0, no output)
- Inconclusive is a graceful degradation, not an error

### NFR-3: Performance
- No additional file I/O introduced
- No new dependencies

### NFR-4: Constitutional Compliance
- Article I: Implementation matches this spec exactly
- Article V: Minimal change -- only modify what's necessary
- Article X: Fail-open behavior preserved
- Article XIV: State schema backward compatible

---

## 4. Constraints

- C-1: Changes limited to `src/claude/hooks/test-watcher.cjs` and its test file
- C-2: No changes to `common.cjs` or any other hook
- C-3: No changes to iteration-requirements.json schema
- C-4: The `.cjs` extension must be preserved (CommonJS requirement)

---

## 5. Out of Scope

- Improving test output parsing patterns (separate enhancement)
- Adding new test framework detection patterns
- Changing circuit breaker threshold behavior
- Modifying the ATDD mode logic
- Coverage enforcement changes

---

## 6. Traceability

| Requirement | Test Cases | Source Files |
|-------------|-----------|--------------|
| FR-1 (AC-1.1 to AC-1.5) | TC-INC-01 to TC-INC-05 | test-watcher.cjs:parseTestResult() |
| FR-2 (AC-2.1 to AC-2.6) | TC-INC-06 to TC-INC-11 | test-watcher.cjs:check() |
| FR-3 (AC-3.1 to AC-3.3) | TC-INC-12 to TC-INC-14 | test-watcher.cjs:check() |
| FR-4 (AC-4.1 to AC-4.4) | Existing 43 tests | test-watcher.cjs (all) |
