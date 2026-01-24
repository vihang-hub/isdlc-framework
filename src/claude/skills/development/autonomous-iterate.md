---
name: autonomous-iterate
description: Enable agents to autonomously retry tasks until success or max iterations reached
skill_id: DEV-014
owner: software-developer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Implementation phase, TDD workflow, bug fixes
dependencies: []
---

# Autonomous Iteration

**Category**: Development
**Agents**: Software Developer (Agent 05), Integration Tester (Agent 06)
**Phases**: Phase 05 (Implementation), Phase 06 (Integration & Testing)
**Purpose**: Enable agents to autonomously retry tasks until success or max iterations reached

---

## Skill Description

This skill enables self-correcting behavior in development and testing phases. When tests fail, agents automatically analyze the failure, learn from the errors, and retry the task with corrections until either:
1. All tests pass (success)
2. Maximum iterations reached (escalate to human)

Inspired by Ralph Wiggum's autonomous iteration loops, this skill prevents agents from stopping at first failure and enables true autonomous development workflows.

---

## When to Use

### Phase 05: Implementation (Software Developer)
- **After writing code**: Run unit tests → if fail, iterate
- **TDD workflow**: Write test → implement → run test → iterate until passing
- **Bug fixes**: Fix code → run regression tests → iterate until all pass

### Phase 06: Integration & Testing (Integration Tester)
- **After running integration tests**: Analyze failures → fix → re-run → iterate
- **API contract tests**: Fix contract mismatches → retry → iterate until aligned
- **E2E test failures**: Debug → fix → re-run → iterate until passing

---

## Iteration Protocol

### 1. Initialization
```
iteration_count = 0
max_iterations = 10  # Configurable per track
completion_criteria = "all tests passing"
exit_on_failure = false  # Continue on failure
```

### 2. Iteration Loop

**Step 1: Execute Task**
- Write/modify code
- Run relevant tests
- Capture test output and results

**Step 2: Evaluate Results**
- ✅ **All tests pass** → Exit loop (SUCCESS)
- ❌ **Tests fail** → Proceed to Step 3
- ⚠️  **Max iterations reached** → Exit loop (ESCALATE)

**Step 3: Learn from Failure**
- Read full test output (stdout, stderr)
- Analyze error messages and stack traces
- Identify root cause (logic error, type mismatch, missing dependency, etc.)
- Review previous iteration attempts (avoid repeating same fix)

**Step 4: Adjust Approach**
- Modify code based on learnings
- Update tests if needed (only if requirements misunderstood)
- Document what was changed and why
- Increment iteration_count

**Step 5: Retry**
- Return to Step 1

### 3. Exit Conditions

**Success**: `test_results.all_passing == true`
- Update state.json with success status
- Proceed to gate validation
- Document iterations_used in gate report

**Max Iterations Exceeded**: `iteration_count >= max_iterations`
- Update state.json with failure status
- Document all iteration attempts
- Escalate to human with detailed failure report
- Provide recommendations for manual intervention

**Blocker Detected**: Unresolvable dependency or environmental issue
- Exit immediately (don't waste iterations)
- Document blocker
- Escalate to human

---

## Iteration Tracking

### State Management

Each iteration should update `.isdlc/state.json`:

```json
{
  "phases": {
    "05-implementation": {
      "status": "in_progress",
      "iterations": {
        "current": 3,
        "max": 10,
        "history": [
          {
            "iteration": 1,
            "timestamp": "2026-01-17T10:15:00Z",
            "action": "Implemented getUserById function",
            "test_command": "npm test -- user.test.js",
            "result": "FAILED",
            "failures": 2,
            "errors": ["TypeError: Cannot read property 'id' of undefined"],
            "fix_applied": "Added null check for user object"
          },
          {
            "iteration": 2,
            "timestamp": "2026-01-17T10:17:00Z",
            "action": "Fixed null check, re-ran tests",
            "test_command": "npm test -- user.test.js",
            "result": "FAILED",
            "failures": 1,
            "errors": ["AssertionError: expected 200 to equal 404"],
            "fix_applied": "Updated error handling for missing user"
          },
          {
            "iteration": 3,
            "timestamp": "2026-01-17T10:20:00Z",
            "action": "Fixed error status code",
            "test_command": "npm test -- user.test.js",
            "result": "PASSED",
            "failures": 0,
            "errors": []
          }
        ],
        "final_status": "success",
        "total_duration_minutes": 5
      }
    }
  }
}
```

### Logging Best Practices

For each iteration, log:
1. **What changed**: Code modifications made
2. **Why it changed**: Root cause analysis from test failure
3. **Test command**: Exact command run
4. **Test output**: Full results (pass/fail counts, error messages)
5. **Next action**: What will be tried next iteration

---

## Failure Learning Strategies

### Common Failure Patterns

**1. Type Errors**
- **Symptom**: `TypeError`, `undefined is not a function`, type mismatches
- **Learning**: Review function signatures, add type guards
- **Fix**: Add TypeScript types, runtime validation, null checks

**2. Logic Errors**
- **Symptom**: Assertion failures, wrong output values
- **Learning**: Review algorithm, trace execution mentally
- **Fix**: Correct logic, add edge case handling

**3. Missing Dependencies**
- **Symptom**: `Module not found`, `Cannot resolve`
- **Learning**: Check package.json, import paths
- **Fix**: Install missing packages, fix import statements

**4. Async Issues**
- **Symptom**: Tests timeout, race conditions, unhandled promises
- **Learning**: Review async/await usage, promise chains
- **Fix**: Add proper awaits, handle promise rejections

**5. Test Environment Issues**
- **Symptom**: Tests pass locally but fail in CI, environment variables missing
- **Learning**: Check .env files, test fixtures, database state
- **Fix**: Setup proper test environment, add missing config

### Learning from Iteration History

**Before each iteration, review**:
- Previous fixes attempted (avoid repeating same approach)
- Error message changes (are we making progress?)
- Test pass/fail trends (are failures decreasing?)

**Adapt strategy if**:
- Same error repeats 3+ times → Try different approach
- New errors appear → Rollback last change
- No progress after 5 iterations → Consider blocker escalation

---

## Iteration Limits

### Default Limits
- **Max Iterations**: 10
- **Timeout per Iteration**: 5 minutes
- **Circuit Breaker**: 3 identical failures triggers escalation

### Escalation Triggers
- **After 10 iterations**: Complex issue, may need human review
- **Same error 3+ times**: Likely architectural or environment issue
- **Total time > 30 minutes**: Consider pausing for review

---

## Integration with Gates

### GATE-05 (Implementation)

**Autonomous Iteration Fields**:
- ✅ Iteration count logged
- ✅ All iterations documented in state.json
- ✅ Final status recorded (success/escalated)
- ✅ If escalated, failure report attached

**Gate Validation**:
```yaml
gate_criteria:
  - unit_tests_passing: true
  - iterations_within_limit: true  # NEW
  - iteration_history_documented: true  # NEW
  - no_unresolved_failures: true  # NEW
```

### GATE-06 (Testing)

**Autonomous Iteration Fields**:
- ✅ Integration test iterations logged
- ✅ All test runs documented
- ✅ Final status recorded
- ✅ If escalated, failure analysis attached

**Gate Validation**:
```yaml
gate_criteria:
  - integration_tests_passing: true
  - iterations_within_limit: true  # NEW
  - iteration_history_documented: true  # NEW
  - no_unresolved_failures: true  # NEW
```

---

## Safety Mechanisms

### 1. Infinite Loop Prevention
- **Hard limit**: Max iterations (5/10/15 based on track)
- **Timeout**: Each iteration has 5-minute timeout
- **Circuit breaker**: If 3 consecutive iterations produce same error, escalate

### 2. Resource Protection
- **Test duration limit**: Single test run max 2 minutes
- **File size check**: Prevent creating massive files
- **Memory monitoring**: Detect memory leaks in tests

### 3. Blocker Detection
Auto-detect and escalate on:
- Missing external dependencies (APIs down, databases unreachable)
- Environmental issues (permissions, file system errors)
- Fundamental design flaws (requirements contradictory)

---

## Agent Responsibilities

### Software Developer (Agent 05)

**Must Do**:
1. Enable autonomous iteration for all implementation tasks
2. Track iterations in state.json
3. Document each iteration's changes and learnings
4. Escalate if max iterations exceeded
5. Include iteration summary in GATE-05 report

**Iteration Workflow**:
```
1. Write test (if TDD)
2. Implement code
3. Run unit tests
4. IF tests fail:
   - Analyze failure
   - Fix code
   - Increment iteration
   - Retry from step 3
5. IF tests pass OR max iterations:
   - Exit loop
   - Document results
```

### Integration Tester (Agent 06)

**Must Do**:
1. Enable autonomous iteration for all test execution
2. Track test run iterations in state.json
3. Document each iteration's failures and fixes
4. Escalate if max iterations exceeded
5. Include iteration summary in GATE-06 report

**Iteration Workflow**:
```
1. Run integration tests
2. Run E2E tests
3. Run API contract tests
4. IF any tests fail:
   - Analyze failures
   - Fix tests OR code (depending on root cause)
   - Increment iteration
   - Retry from step 1
5. IF all tests pass OR max iterations:
   - Exit loop
   - Document results
```

---

## Example Scenarios

### Scenario 1: Unit Test Failure (Agent 05)

**Task**: Implement `calculateDiscount(price, couponCode)` function

**Iteration 1**:
- Write test: `expect(calculateDiscount(100, 'SAVE20')).toBe(80)`
- Implement: `return price - 20`
- Run test: ❌ FAILED (hardcoded discount)
- Learning: Need to parse coupon code
- Fix: Add coupon lookup logic

**Iteration 2**:
- Update: `const discount = lookupCoupon(couponCode); return price - discount`
- Run test: ❌ FAILED (`lookupCoupon is not defined`)
- Learning: Missing helper function
- Fix: Implement `lookupCoupon` function

**Iteration 3**:
- Update: Add `lookupCoupon` function with coupon map
- Run test: ✅ PASSED
- **Result**: Success in 3 iterations

### Scenario 2: Integration Test Failure (Agent 06)

**Task**: Test `POST /api/users` endpoint

**Iteration 1**:
- Run test: `POST /api/users` with valid data
- Result: ❌ FAILED (500 Internal Server Error)
- Learning: Check server logs
- Fix: Database connection string incorrect

**Iteration 2**:
- Update: Fix database connection in test environment
- Run test: ❌ FAILED (422 Validation Error - email required)
- Learning: Test data missing required field
- Fix: Add email to test payload

**Iteration 3**:
- Update: Test payload includes email
- Run test: ✅ PASSED
- **Result**: Success in 3 iterations

### Scenario 3: Max Iterations Exceeded

**Task**: Fix failing authentication tests

**Iterations 1-10**:
- Various fixes attempted (token refresh, cookie handling, session storage)
- Errors change but tests never fully pass
- After iteration 10: Max limit reached

**Result**:
- **Status**: ESCALATED
- **Report**: "Authentication tests fail due to session timeout configuration mismatch between test environment and production. Requires architectural review of session management strategy."
- **Recommendation**: Architect review session design, update test strategy

---

## Best Practices

### Do's ✅
- **Do** read full test output before making changes
- **Do** make incremental changes (one fix per iteration)
- **Do** document your reasoning for each change
- **Do** check iteration history to avoid repeating fixes
- **Do** escalate early if blocker detected

### Don'ts ❌
- **Don't** make multiple unrelated changes in one iteration
- **Don't** skip documenting iteration results
- **Don't** ignore warnings (they often predict failures)
- **Don't** exceed max iterations without escalating
- **Don't** change tests to make them pass (unless requirements misunderstood)

---

## Metrics and Reporting

### Success Metrics
- **Iteration Efficiency**: Average iterations to success
- **First-Pass Rate**: % of tasks passing without iteration
- **Convergence Rate**: % of tasks succeeding within max iterations
- **Common Failure Types**: Category breakdown

### Escalation Metrics
- **Escalation Rate**: % of tasks exceeding max iterations
- **Escalation Reasons**: Categorized (blocker, complexity, environment)
- **Time to Resolution**: Human intervention duration

### Reporting Template

```markdown
## Autonomous Iteration Summary

**Phase**: 05-Implementation
**Task**: Implement user authentication

### Iteration Statistics
- Total Iterations: 4
- Max Allowed: 10
- Final Status: ✅ Success
- Total Duration: 12 minutes

### Iteration Breakdown
| Iteration | Action | Test Result | Errors | Fix Applied |
|-----------|--------|-------------|--------|-------------|
| 1 | Implemented login endpoint | FAILED | 2 failures | Added password hashing |
| 2 | Fixed password handling | FAILED | 1 failure | Added JWT generation |
| 3 | Added token generation | FAILED | 1 failure | Fixed token expiry |
| 4 | Fixed token configuration | PASSED | 0 failures | - |

### Key Learnings
- Initial implementation missing security considerations (hashing, JWT)
- Token configuration required environment variable setup
- All tests passing after 4 iterations

### Recommendation
✅ Proceed to GATE-05 validation
```

---

## Configuration

### Track-Specific Settings

Located in `src/isdlc/config/tracks.yaml`:

```yaml
tracks:
  quick:
    autonomous_iteration:
      enabled: true
      max_iterations: 5
      timeout_per_iteration_minutes: 5

  standard:
    autonomous_iteration:
      enabled: true
      max_iterations: 10
      timeout_per_iteration_minutes: 5

  enterprise:
    autonomous_iteration:
      enabled: true
      max_iterations: 15
      timeout_per_iteration_minutes: 10
```

---

## Related Skills

- **run-unit-tests** - Execute unit test suite
- **run-integration-tests** - Execute integration test suite
- **analyze-test-failures** - Parse and categorize test failures
- **generate-test-report** - Create test execution report

---

## References

- **Inspired by**: Ralph Wiggum autonomous iteration loops
- **Gate Integration**: GATE-05, GATE-06
- **State Management**: `.isdlc/state.json`
- **Configuration**: `src/isdlc/config/tracks.yaml`

---

**Version**: 1.0
**Created**: 2026-01-17
**Last Updated**: 2026-01-17
**Status**: Active
