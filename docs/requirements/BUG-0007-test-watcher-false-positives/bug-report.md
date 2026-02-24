# Bug Report: BUG-0007

## Title
Test watcher circuit breaker trips on unparseable output (false positives)

## Severity
Medium

## Priority
High (blocks reliable workflow iteration)

## Environment
- iSDLC Framework v0.1.0-alpha
- Hook: `src/claude/hooks/test-watcher.cjs`
- Node.js 20+

## Description
The test-watcher hook's `parseTestResult()` function incorrectly classifies unparseable test output as `FAILED` with `error: "Unable to determine test result"`. This causes false positives in the circuit breaker mechanism, which trips after 3 "identical" failures -- even though no actual test failure occurred.

## Steps to Reproduce
1. Start an iSDLC fix or feature workflow (active_workflow present in state.json)
2. Run a test command that produces unparseable output, e.g.:
   - `npm run test:char` (script does not exist)
   - `npm run test:e2e` (script does not exist)
   - Any test command that produces output matching neither SUCCESS_PATTERNS nor FAILURE_PATTERNS
3. Observe test-watcher records result as `FAILED` with `failures: 0` and `error: "Unable to determine test result"`
4. Repeat the unparseable command 3 times
5. Circuit breaker triggers with "Same error repeated 3 times" -- despite no actual test failures

## Expected Behavior
- Unparseable output (no success patterns, no failure patterns, no exit code available) should be classified as `"inconclusive"` rather than `"FAILED"`
- Inconclusive results should NOT increment `identical_failure_count`
- Inconclusive results should NOT count toward circuit breaker threshold
- The history entry should record `result: "INCONCLUSIVE"` (not `"FAILED"`)

## Actual Behavior
- `parseTestResult()` falls through all pattern matching and reaches the default return at line 207: `{ passed: false, error: 'Unable to determine test result' }`
- This is treated as a regular failure by the `check()` function
- `identical_failure_count` increments because the normalized error "Unable to determine test result" is identical each time
- After 3 runs (default `circuit_breaker_threshold`), the circuit breaker triggers and marks the iteration as `escalated`

## Root Cause
In `parseTestResult()` (line 160-208):
```javascript
// Default to failure if uncertain
return { passed: false, error: 'Unable to determine test result' };
```

The function has no concept of "inconclusive" -- it is binary (passed/failed). When neither success nor failure patterns match and no exit code is available, it defaults to failure. The `check()` function then treats this like any other failure, incrementing counters and checking circuit breaker conditions.

## Affected Components
1. `parseTestResult()` function -- needs an `inconclusive` result type
2. `check()` function -- needs to handle inconclusive results differently from failures
3. History entry creation -- needs `INCONCLUSIVE` result variant
4. Circuit breaker logic -- needs to skip inconclusive results

## Impact
- False circuit breaker trips interrupt legitimate workflows
- Users get escalated to "human review" for non-issues
- Reduces trust in the iteration enforcement system
- Any test command that doesn't exist or produces non-standard output triggers this

## External Link
N/A (internal framework bug discovered during REQ-0009 workflow)
