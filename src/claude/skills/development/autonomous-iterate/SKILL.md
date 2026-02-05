---
name: autonomous-iterate
description: Enable agents to autonomously retry tasks until success or max iterations reached
skill_id: DEV-014
owner: software-developer
collaborators: [integration-tester]
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

This skill prevents agents from stopping at first failure and enables true autonomous development workflows.

---

## When to Use

### Phase 05: Implementation (Software Developer)
- **After writing code**: Run unit tests, if fail then iterate
- **TDD workflow**: Write test, implement, run test, iterate until passing
- **Bug fixes**: Fix code, run regression tests, iterate until all pass

### Phase 06: Integration & Testing (Integration Tester)
- **After running integration tests**: Analyze failures, fix, re-run, iterate
- **API contract tests**: Fix contract mismatches, retry, iterate until aligned
- **E2E test failures**: Debug, fix, re-run, iterate until passing

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
- All tests pass: Exit loop (SUCCESS)
- Tests fail: Proceed to Step 3
- Max iterations reached: Exit loop (ESCALATE)

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

Each iteration should update `.isdlc/state.json` under the `iteration_requirements.test_iteration` path:

```json
{
  "phases": {
    "05-implementation": {
      "status": "in_progress",
      "iteration_requirements": {
        "test_iteration": {
          "required": true,
          "completed": false,
          "current_iteration": 3,
          "max_iterations": 10,
          "last_test_result": "passed",
          "last_test_command": "npm test -- user.test.js",
          "failures_count": 2,
          "identical_failure_count": 0,
          "history": []
        }
      }
    }
  }
}
```

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

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| task | String | Yes | The implementation task to complete |
| test_command | String | Yes | Command to run tests |
| max_iterations | Integer | No | Override default max (default: 10) |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| status | String | success, escalated, or blocked |
| iterations_used | Integer | Number of iterations taken |
| final_test_result | Object | Last test run results |
| iteration_history | Array | Log of all iterations |

---

## Integration with Gates

### GATE-05 (Implementation)

**Autonomous Iteration Fields**:
- Iteration count logged
- All iterations documented in state.json
- Final status recorded (success/escalated)
- If escalated, failure report attached

### GATE-06 (Testing)

**Autonomous Iteration Fields**:
- Integration test iterations logged
- All test runs documented
- Final status recorded
- If escalated, failure analysis attached

---

## Related Skills

- **code-implementation** (DEV-001) - Primary implementation skill
- **unit-test-writing** (DEV-002) - Writing unit tests
- **coverage-analysis** (TEST-006) - Analyzing test coverage
- **autonomous-constitution-validate** (ORCH-011) - Similar pattern for constitution

---

**Skill Version**: 1.0.0
**Last Updated**: 2026-02-05
