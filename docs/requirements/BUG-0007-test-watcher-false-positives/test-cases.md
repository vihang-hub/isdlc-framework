# Test Cases: BUG-0007 - Test Watcher False Positives Fix

**Version**: 1.0.0
**Date**: 2026-02-12
**Total Test Cases**: 18
**Target File**: `src/claude/hooks/tests/test-test-watcher.test.cjs`

---

## Test Helpers (to be added to test file)

```javascript
/**
 * Build a check() context that will produce an inconclusive result.
 * Output matches NO success/failure patterns, NO exit code available.
 * @param {object} [iterOverrides] - Overrides for the test_iteration state
 * @returns {{ input: object, state: object, requirements: object }}
 */
function buildInconclusiveCtx(iterOverrides) {
    const state = {
        current_phase: '06-implementation',
        iteration_enforcement: { enabled: true },
        active_workflow: {
            type: 'feature',
            current_phase: '06-implementation',
            current_phase_index: 5
        },
        phases: {
            '06-implementation': {
                status: 'in_progress',
                iteration_requirements: {
                    test_iteration: {
                        required: true,
                        completed: false,
                        current_iteration: 0,
                        max_iterations: 10,
                        failures_count: 0,
                        identical_failure_count: 0,
                        history: [],
                        started_at: '2026-01-01T00:00:00.000Z',
                        ...(iterOverrides || {})
                    }
                }
            }
        }
    };

    const input = {
        tool_name: 'Bash',
        tool_input: { command: 'npm test' },
        tool_result: 'Running checks... Done. Summary complete.'
    };

    const requirements = {
        phase_requirements: {
            '06-implementation': {
                test_iteration: {
                    enabled: true,
                    max_iterations: 10,
                    circuit_breaker_threshold: 3
                }
            }
        }
    };

    return { input, state, requirements };
}

/**
 * Extract test_iteration state from context after check() call.
 */
function getIterState(ctx) {
    return ctx.state.phases['06-implementation'].iteration_requirements.test_iteration;
}
```

---

## Describe Block 1: parseTestResult -- inconclusive result type (BUG-0007)

### TC-INC-01: Inconclusive for unmatched output with no exit code

**Requirement**: FR-1, AC-1.1
**Priority**: P0 (Critical)

```javascript
it('returns inconclusive when no patterns match and no exit code (AC-1.1)', () => {
    const { parseTestResult } = require(hookSrcPath);
    const output = 'Running checks... Done. Summary complete.';
    const result = parseTestResult(output, undefined);
    assert.equal(result.passed, null, 'passed must be null for inconclusive');
    assert.equal(result.inconclusive, true, 'inconclusive must be true');
    assert.equal(result.error, 'Unable to determine test result');
});
```

---

### TC-INC-02: Exit code 0 still returns PASSED (not inconclusive)

**Requirement**: FR-1, AC-1.2
**Priority**: P0 (Critical)

```javascript
it('returns PASSED when exit code is 0 even if no patterns match (AC-1.2)', () => {
    const { parseTestResult } = require(hookSrcPath);
    const output = 'Running checks... Done. Summary complete.';
    const result = parseTestResult(output, 0);
    assert.equal(result.passed, true, 'passed must be true when exitCode is 0');
    assert.ok(!result.inconclusive, 'inconclusive must not be true');
});
```

---

### TC-INC-03: Exit code non-zero still returns FAILED (not inconclusive)

**Requirement**: FR-1, AC-1.2
**Priority**: P0 (Critical)

```javascript
it('returns FAILED when exit code is non-zero even if no patterns match (AC-1.2)', () => {
    const { parseTestResult } = require(hookSrcPath);
    const output = 'Running checks... Done. Summary complete.';
    const result = parseTestResult(output, 1);
    assert.equal(result.passed, false, 'passed must be false when exitCode is 1');
    assert.ok(!result.inconclusive, 'inconclusive must not be true');
    assert.equal(result.error, 'Exit code: 1');
});
```

---

### TC-INC-04: Failure patterns still return FAILED

**Requirement**: FR-1, AC-1.3
**Priority**: P1 (High)

```javascript
it('returns FAILED when failure patterns match, not inconclusive (AC-1.3)', () => {
    const { parseTestResult } = require(hookSrcPath);
    const output = 'FAIL src/app.test.js\n2 failed\nError: assertion failed';
    const result = parseTestResult(output, undefined);
    assert.equal(result.passed, false);
    assert.ok(result.failures >= 1);
    assert.ok(!result.inconclusive, 'inconclusive must not be true when failure patterns match');
});
```

---

### TC-INC-05: Success patterns still return PASSED

**Requirement**: FR-1, AC-1.4
**Priority**: P1 (High)

```javascript
it('returns PASSED when success patterns match, not inconclusive (AC-1.4)', () => {
    const { parseTestResult } = require(hookSrcPath);
    const output = 'All tests passed\nTests: 5 passed, 0 failed, 5 total';
    const result = parseTestResult(output, undefined);
    assert.equal(result.passed, true);
    assert.ok(!result.inconclusive, 'inconclusive must not be true when success patterns match');
});
```

---

### TC-INC-05b: Inconclusive property absent on all determinate results

**Requirement**: FR-1, AC-1.5
**Priority**: P1 (High)

```javascript
it('inconclusive is absent or false on all determinate results (AC-1.5)', () => {
    const { parseTestResult } = require(hookSrcPath);

    // PASSED via pattern
    const passResult = parseTestResult('All tests passed', undefined);
    assert.ok(!passResult.inconclusive, 'PASSED result must not be inconclusive');

    // FAILED via pattern
    const failResult = parseTestResult('FAIL\n1 failed\nError: bad', undefined);
    assert.ok(!failResult.inconclusive, 'FAILED result must not be inconclusive');

    // PASSED via exit code 0
    const exit0Result = parseTestResult('some output', 0);
    assert.ok(!exit0Result.inconclusive, 'exit code 0 result must not be inconclusive');

    // FAILED via exit code 1
    const exit1Result = parseTestResult('some output', 1);
    assert.ok(!exit1Result.inconclusive, 'exit code 1 result must not be inconclusive');
});
```

---

## Describe Block 2: check() -- inconclusive handling (BUG-0007)

### TC-INC-06: History entry records "INCONCLUSIVE" result

**Requirement**: FR-2, AC-2.1
**Priority**: P0 (Critical)

```javascript
it('records INCONCLUSIVE in history entry, not FAILED (AC-2.1)', () => {
    const { check: checkFn } = require(hookSrcPath);
    const ctx = buildInconclusiveCtx();
    checkFn(ctx);
    const iterState = getIterState(ctx);
    assert.equal(iterState.history.length, 1);
    assert.equal(iterState.history[0].result, 'INCONCLUSIVE');
});
```

---

### TC-INC-07: failures_count is NOT incremented

**Requirement**: FR-2, AC-2.2
**Priority**: P0 (Critical)

```javascript
it('does not increment failures_count for inconclusive results (AC-2.2)', () => {
    const { check: checkFn } = require(hookSrcPath);
    const ctx = buildInconclusiveCtx({ failures_count: 2 });
    checkFn(ctx);
    const iterState = getIterState(ctx);
    assert.equal(iterState.failures_count, 2, 'failures_count must remain unchanged');
});
```

---

### TC-INC-08: identical_failure_count is NOT incremented

**Requirement**: FR-2, AC-2.3
**Priority**: P0 (Critical)

```javascript
it('does not increment identical_failure_count for inconclusive results (AC-2.3)', () => {
    const { check: checkFn } = require(hookSrcPath);
    const ctx = buildInconclusiveCtx({ identical_failure_count: 2 });
    checkFn(ctx);
    const iterState = getIterState(ctx);
    assert.equal(iterState.identical_failure_count, 2, 'identical_failure_count must remain unchanged');
});
```

---

### TC-INC-09: Circuit breaker is skipped entirely

**Requirement**: FR-2, AC-2.4
**Priority**: P0 (Critical -- the exact bug scenario)

```javascript
it('skips circuit breaker entirely for inconclusive results (AC-2.4)', () => {
    const { check: checkFn } = require(hookSrcPath);
    // Set up state that would trigger circuit breaker if this were a FAILED result:
    // identical_failure_count=2 (threshold=3), two prior identical errors in history
    const ctx = buildInconclusiveCtx({
        current_iteration: 2,
        failures_count: 2,
        identical_failure_count: 2,
        history: [
            { iteration: 1, result: 'FAILED', error: 'Unable to determine test result' },
            { iteration: 2, result: 'FAILED', error: 'Unable to determine test result' }
        ]
    });
    const result = checkFn(ctx);
    const iterState = getIterState(ctx);

    // Circuit breaker must NOT trigger
    assert.ok(!result.stdout.includes('CIRCUIT BREAKER'), 'Circuit breaker must not trigger for inconclusive');
    assert.notEqual(iterState.status, 'escalated', 'Must not escalate');
    assert.equal(iterState.completed, false, 'Must not mark completed');
    // Failure counts must not change
    assert.equal(iterState.failures_count, 2, 'failures_count must not increment');
    assert.equal(iterState.identical_failure_count, 2, 'identical_failure_count must not increment');
});
```

---

### TC-INC-10: last_test_result set to "inconclusive"

**Requirement**: FR-2, AC-2.5
**Priority**: P1 (High)

```javascript
it('sets last_test_result to "inconclusive" (AC-2.5)', () => {
    const { check: checkFn } = require(hookSrcPath);
    const ctx = buildInconclusiveCtx();
    checkFn(ctx);
    const iterState = getIterState(ctx);
    assert.equal(iterState.last_test_result, 'inconclusive');
});
```

---

### TC-INC-11: Output message is a warning about unparseable output

**Requirement**: FR-2, AC-2.6
**Priority**: P1 (High)

```javascript
it('outputs a warning about unparseable output, not an error (AC-2.6)', () => {
    const { check: checkFn } = require(hookSrcPath);
    const ctx = buildInconclusiveCtx();
    const result = checkFn(ctx);

    // Must NOT contain error-level messages
    assert.ok(!result.stdout.includes('TESTS FAILED'), 'Must not say TESTS FAILED');
    assert.ok(!result.stdout.includes('CIRCUIT BREAKER'), 'Must not say CIRCUIT BREAKER');
    assert.ok(!result.stdout.includes('MAX ITERATIONS EXCEEDED'), 'Must not say MAX ITERATIONS');

    // Must contain some indication of inconclusive/warning
    const hasWarning = result.stdout.includes('INCONCLUSIVE') ||
                       result.stdout.includes('could not be parsed') ||
                       result.stdout.includes('WARNING') ||
                       result.stdout.includes('verify');
    assert.ok(hasWarning, 'Output should warn about unparseable output');
});
```

---

### TC-INC-12: current_iteration IS incremented

**Requirement**: FR-3, AC-3.1
**Priority**: P0 (Critical)

```javascript
it('increments current_iteration for inconclusive results (AC-3.1)', () => {
    const { check: checkFn } = require(hookSrcPath);
    const ctx = buildInconclusiveCtx({ current_iteration: 3 });
    checkFn(ctx);
    const iterState = getIterState(ctx);
    assert.equal(iterState.current_iteration, 4, 'current_iteration must increment from 3 to 4');
});
```

---

### TC-INC-13: Max iterations check still applies to inconclusive

**Requirement**: FR-3, AC-3.2
**Priority**: P0 (Critical)

```javascript
it('escalates when max iterations reached with inconclusive results (AC-3.2)', () => {
    const { check: checkFn } = require(hookSrcPath);
    const ctx = buildInconclusiveCtx({ current_iteration: 9, max_iterations: 10 });
    const result = checkFn(ctx);
    const iterState = getIterState(ctx);

    assert.equal(iterState.completed, true);
    assert.equal(iterState.status, 'escalated');
    assert.equal(iterState.escalation_reason, 'max_iterations');
    assert.ok(result.stdout.includes('MAX ITERATIONS') || result.stdout.includes('max iterations'),
        'Should announce max iterations exceeded');
});
```

---

### TC-INC-14: Escalation reason is "max_iterations" for all-inconclusive exhaustion

**Requirement**: FR-3, AC-3.3
**Priority**: P1 (High)

```javascript
it('uses "max_iterations" escalation reason even when all results were inconclusive (AC-3.3)', () => {
    const { check: checkFn } = require(hookSrcPath);
    const ctx = buildInconclusiveCtx({
        current_iteration: 9,
        max_iterations: 10,
        failures_count: 0,
        identical_failure_count: 0,
        history: Array.from({ length: 9 }, (_, i) => ({
            iteration: i + 1,
            timestamp: '2026-01-01T00:00:00.000Z',
            command: 'npm test',
            result: 'INCONCLUSIVE',
            failures: 0,
            error: 'Unable to determine test result'
        }))
    });
    const result = checkFn(ctx);
    const iterState = getIterState(ctx);

    assert.equal(iterState.escalation_reason, 'max_iterations',
        'Escalation reason must be max_iterations even when all were inconclusive');
    assert.equal(iterState.failures_count, 0,
        'failures_count should still be 0 after all inconclusive runs');
});
```

---

## Describe Block 3: Backward compatibility (BUG-0007)

### TC-INC-15: All existing tests pass

**Requirement**: FR-4, AC-4.1
**Priority**: P0 (Critical)

Validated by running the full test suite. No explicit new test needed -- the entire existing suite serves as the regression test.

```bash
node --test src/claude/hooks/tests/test-test-watcher.test.cjs
# Expected: 0 failures, all 31+ existing tests pass
```

---

### TC-INC-16: check() function signature unchanged

**Requirement**: FR-4, AC-4.2
**Priority**: P2 (Medium)

Implicitly validated by all existing tests calling `check()` with `{ input, state, requirements }` and receiving `{ decision, stdout?, stateModified? }`. No explicit new test required.

---

### TC-INC-17: Module exports unchanged (plus new parseTestResult)

**Requirement**: FR-4, AC-4.3
**Priority**: P2 (Medium)

```javascript
it('exports all existing functions plus parseTestResult (AC-4.3)', () => {
    const mod = require(hookSrcPath);
    assert.equal(typeof mod.check, 'function', 'check must be exported');
    assert.equal(typeof mod.normalizeErrorForComparison, 'function',
        'normalizeErrorForComparison must be exported');
    assert.equal(typeof mod.isIdenticalFailure, 'function',
        'isIdenticalFailure must be exported');
    assert.equal(typeof mod.parseCoverage, 'function',
        'parseCoverage must be exported');
    assert.equal(typeof mod.parseTestResult, 'function',
        'parseTestResult must be exported (new)');
});
```

---

### TC-INC-18: State schema backward compatible

**Requirement**: FR-4, AC-4.4
**Priority**: P2 (Medium)

Implicitly validated by TC-INC-06 (history entry structure), TC-INC-10 (last_test_result field), and TC-INC-12 (iteration state fields). The `test_iteration` object uses existing field names with new string values in existing string-typed fields. No structural schema changes are introduced.

---

## Summary

| Describe Block | Test Cases | AC Coverage |
|---|---|---|
| parseTestResult -- inconclusive (BUG-0007) | TC-INC-01 to TC-INC-05b (6 tests) | AC-1.1 to AC-1.5 |
| check() -- inconclusive handling (BUG-0007) | TC-INC-06 to TC-INC-14 (9 tests) | AC-2.1 to AC-2.6, AC-3.1 to AC-3.3 |
| Backward compatibility (BUG-0007) | TC-INC-15 to TC-INC-18 (3 explicit + 1 implicit) | AC-4.1 to AC-4.4 |
| **TOTAL** | **18 test cases** | **18 acceptance criteria (100%)** |
