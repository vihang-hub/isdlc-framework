# Test Cases: BUG-0008 -- Hook Delegation Guard

**Version**: 1.0.0
**Created**: 2026-02-12
**Workflow**: Fix (BUG-0008-constitution-validator-false-positive)
**Phase**: 05-test-strategy

---

## Test Data Fixtures (Shared Across All Hook Tests)

### Delegation Prompts (Should be ALLOWED by all hooks)

```javascript
// Standard delegation prompt template (isdlc.md STEP 3d)
const DELEGATION_PROMPTS = {
    tracing: {
        prompt: 'Execute Phase 02 - Tracing for fix workflow.\nArtifact folder: BUG-0008-constitution-validator-false-positive\nPhase key: 02-tracing\nValidate GATE-02 on completion.',
        subagent_type: 'trace-analyst'
    },
    implementation: {
        prompt: 'Execute Phase 06 - Implementation for feature workflow.\nArtifact folder: REQ-0001-discover-enhancements\nPhase key: 06-implementation\nValidate GATE-06 on completion.',
        subagent_type: 'software-developer'
    },
    testStrategy: {
        prompt: 'Execute Phase 05 - Test Strategy for fix workflow.\nPhase key: 05-test-strategy\nValidate GATE-05 on completion.',
        subagent_type: 'test-design-engineer'
    },
    requirements: {
        prompt: 'Execute Phase 01 - Requirements for feature workflow.\nPhase key: 01-requirements.',
        subagent_type: 'requirements-analyst'
    },
    codeReview: {
        prompt: 'Execute Phase 08 - Code Review.\nValidate GATE-08 on completion.',
        subagent_type: 'code-reviewer'
    }
};
```

### Genuine Completion/Advance Prompts (Should STILL be BLOCKED)

```javascript
const COMPLETION_PROMPTS = {
    phaseComplete: 'The phase complete. Ready to move on.',
    advancePhase: 'advance to next phase',
    gateCheck: 'run gate check for phase 06',
    proceed: 'proceed to the testing phase',
    gateValidation: 'gate validation passed, submit for review',
    declareComplete: 'declare complete',
    implementationComplete: 'The implementation complete, all tests passing',
    testingComplete: 'testing complete',
    markComplete: 'mark as complete'
};
```

---

## Test Suite 1: constitution-validator.cjs

### File: `src/claude/hooks/tests/test-constitution-validator.test.cjs`
### Section: `describe('BUG-0008: Delegation guard')`

---

### TC-CV-D01: Delegation with known phase agent subagent_type bypasses completion check
**Requirement**: FIX-001, AC-01
**Priority**: P0

**Preconditions**:
- State: `phaseWithConstitutionalRequired()` (06-implementation, constitutional not started)
- Hook: constitution-validator.cjs installed in test env

**Input**:
```javascript
{
    tool_name: 'Task',
    tool_input: {
        prompt: 'Execute Phase 06 - Implementation for feature workflow.\nValidate GATE-06 on completion.',
        subagent_type: 'software-developer'
    }
}
```

**Expected Result**:
- Exit code: 0
- stdout: empty string (allowed, NOT blocked)
- The delegation is detected via `subagent_type: 'software-developer'` matching a known phase agent

**Rationale**: Before the fix, this prompt would trigger `COMPLETION_PATTERNS` matching (contains "implementation" near "complete" context, and "GATE" keyword). After the fix, `detectPhaseDelegation()` returns `isDelegation: true` and the function returns `false` before reaching pattern matching.

---

### TC-CV-D02: Delegation with agent name in prompt bypasses completion check
**Requirement**: FIX-001, AC-02
**Priority**: P0

**Preconditions**:
- State: `phaseWithConstitutionalRequired()`

**Input**:
```javascript
{
    tool_name: 'Task',
    tool_input: {
        prompt: 'Execute Phase 02 - Tracing for fix workflow.\nArtifact folder: BUG-0008\nValidate GATE-02 on completion.',
        subagent_type: 'trace-analyst'
    }
}
```

**Expected Result**:
- Exit code: 0
- stdout: empty string (allowed)

**Rationale**: The prompt contains "gate" in "GATE-02" which could match completion patterns. The agent name `trace-analyst` in subagent_type triggers delegation detection.

---

### TC-CV-D03: Delegation with phase pattern in prompt bypasses completion check
**Requirement**: FIX-001, AC-03
**Priority**: P0

**Preconditions**:
- State: `phaseWithConstitutionalRequired()`

**Input**:
```javascript
{
    tool_name: 'Task',
    tool_input: {
        prompt: 'Execute Phase 05 - Test Strategy for fix workflow.\nPhase key: 05-test-strategy\nValidate GATE-05 on completion.',
        subagent_type: 'test-design-engineer'
    }
}
```

**Expected Result**:
- Exit code: 0
- stdout: empty string (allowed)

**Rationale**: Contains both phase pattern `05-test-strategy` and "GATE-05". Delegation detection uses the phase pattern match.

---

### TC-CV-D04: Genuine completion still detected after delegation guard added
**Requirement**: FIX-001, AC-04
**Priority**: P0

**Preconditions**:
- State: `phaseWithConstitutionalRequired()`

**Input**:
```javascript
{
    tool_name: 'Task',
    tool_input: {
        prompt: 'The phase complete. Ready to move on.'
    }
}
```

**Expected Result**:
- Exit code: 0
- stdout: JSON with `{ continue: false }` and stopReason including "PHASE COMPLETION BLOCKED"

**Rationale**: This is a genuine completion declaration with no delegation markers. The delegation guard returns `isDelegation: false`, and the hook falls through to pattern matching as before.

**Note**: This test already exists as test #4 in the existing suite. We include it here explicitly to verify it still passes after the guard is added.

---

### TC-CV-D05: Setup command bypass remains unchanged after delegation guard
**Requirement**: FIX-001, AC-05
**Priority**: P1

**Preconditions**:
- State: `phaseWithConstitutionalRequired()`

**Input**:
```javascript
{
    tool_name: 'Task',
    tool_input: {
        prompt: 'discover the project and phase complete'
    }
}
```

**Expected Result**:
- Exit code: 0
- stdout: empty string (allowed via setup keyword bypass)

**Rationale**: Setup keywords are checked AFTER the delegation guard. If delegation guard is not triggered (no phase agent markers), the existing setup bypass still works. This verifies the guard does not interfere with the existing bypass mechanism.

**Note**: This test already exists as test #3. We include it in the delegation guard section to verify the guard does not break setup bypasses.

---

## Test Suite 2: iteration-corridor.cjs

### File: `src/claude/hooks/tests/test-iteration-corridor.test.cjs`
### Section: `describe('BUG-0008: Delegation guard')`

---

### TC-IC-D01: Delegation bypasses TEST_CORRIDOR advance keyword check
**Requirement**: FIX-002, AC-06
**Priority**: P0

**Preconditions**:
- State: `testCorridorState()` (06-implementation, test iteration failing, TEST_CORRIDOR active)

**Input**:
```javascript
{
    tool_name: 'Task',
    tool_input: {
        prompt: 'Execute Phase 06 - Implementation for fix workflow.\nValidate GATE-06 on completion.',
        subagent_type: 'software-developer'
    }
}
```

**Expected Result**:
- Exit code: 0
- stdout: empty string (allowed, NOT blocked by corridor)

**Rationale**: The prompt contains "GATE" which matches `/gate/i` in ADVANCE_PATTERNS. Before the fix, this would be blocked by TEST_CORRIDOR. After the fix, `detectPhaseDelegation()` returns `isDelegation: true` and `taskHasAdvanceKeywords()` returns `false`.

---

### TC-IC-D02: Delegation bypasses CONST_CORRIDOR advance keyword check
**Requirement**: FIX-002, AC-06
**Priority**: P0

**Preconditions**:
- State: `constCorridorState()` (06-implementation, tests passed, constitutional validation pending)

**Input**:
```javascript
{
    tool_name: 'Task',
    tool_input: {
        prompt: 'Execute Phase 08 - Code Review.\nValidate GATE-08 on completion.',
        subagent_type: 'code-reviewer'
    }
}
```

**Expected Result**:
- Exit code: 0
- stdout: empty string (allowed, NOT blocked by corridor)

**Rationale**: The prompt contains "GATE" matching `/gate/i`. In CONST_CORRIDOR, advance keywords are blocked for non-delegation calls. The delegation guard prevents the false positive.

---

### TC-IC-D03: "GATE-NN" in delegation prompt no longer triggers /gate/i false positive
**Requirement**: FIX-002, AC-06
**Priority**: P0

**Preconditions**:
- State: `testCorridorState()`

**Input**:
```javascript
{
    tool_name: 'Task',
    tool_input: {
        prompt: 'Execute Phase 02 - Tracing for fix workflow.\nArtifact folder: BUG-0008\nPhase key: 02-tracing\nValidate GATE-02 on completion.',
        subagent_type: 'trace-analyst'
    }
}
```

**Expected Result**:
- Exit code: 0
- stdout: empty string (allowed)

**Rationale**: This is the MOST LIKELY trigger scenario identified in the trace analysis. The word "GATE" in "Validate GATE-02" deterministically matches `/gate/i`. The delegation guard must catch this.

---

### TC-IC-D04: Genuine advance keywords still blocked in TEST_CORRIDOR
**Requirement**: FIX-002, AC-07
**Priority**: P0

**Preconditions**:
- State: `testCorridorState()`

**Input**:
```javascript
{
    tool_name: 'Task',
    tool_input: {
        prompt: 'advance to next phase'
    }
}
```

**Expected Result**:
- Exit code: 0
- stdout: JSON with `{ continue: false }` and stopReason including "ITERATION CORRIDOR"

**Rationale**: No delegation markers (no subagent_type, no agent name, no phase pattern). `detectPhaseDelegation()` returns `isDelegation: false`. Existing pattern matching proceeds and correctly blocks the advance attempt.

---

### TC-IC-D05: Genuine advance keywords still blocked in CONST_CORRIDOR
**Requirement**: FIX-002, AC-08
**Priority**: P0

**Preconditions**:
- State: `constCorridorState()`

**Input**:
```javascript
{
    tool_name: 'Task',
    tool_input: {
        prompt: 'proceed to next phase'
    }
}
```

**Expected Result**:
- Exit code: 0
- stdout: JSON with `{ continue: false }` and stopReason including "Constitutional validation in progress"

**Rationale**: No delegation markers. Falls through to ADVANCE_PATTERNS which correctly matches `/proceed/i`.

---

### TC-IC-D06: Delegation with description field also bypasses corridor
**Requirement**: FIX-002, AC-06
**Priority**: P1

**Preconditions**:
- State: `testCorridorState()`

**Input**:
```javascript
{
    tool_name: 'Task',
    tool_input: {
        prompt: 'Execute Phase 01 - Requirements for feature workflow.',
        description: 'Phase key: 01-requirements. Validate GATE-01 on completion.',
        subagent_type: 'requirements-analyst'
    }
}
```

**Expected Result**:
- Exit code: 0
- stdout: empty string (allowed)

**Rationale**: The "GATE" keyword appears in the `description` field. `taskHasAdvanceKeywords()` concatenates `prompt + ' ' + description` for pattern matching. The delegation guard must also handle inputs where trigger words are in `description`.

---

## Test Suite 3: gate-blocker.cjs

### File: `src/claude/hooks/tests/test-gate-blocker-extended.test.cjs`
### Section: `describe('BUG-0008: Delegation guard')`

---

### TC-GB-D01: Delegation bypasses gate advancement check (orchestrator subagent)
**Requirement**: FIX-003, AC-09
**Priority**: P0

**Preconditions**:
- State: 06-implementation, iteration enforcement enabled, test_iteration not started
- Iteration requirements configured for 06-implementation

**Input**:
```javascript
{
    tool_name: 'Task',
    tool_input: {
        prompt: 'Execute Phase 06 - Implementation for fix workflow.\nValidate GATE-06 on completion.',
        subagent_type: 'sdlc-orchestrator'
    }
}
```

**Expected Result**:
- Exit code: 0
- stdout: empty string (allowed)

**Rationale**: This is an edge case where subagent_type is "sdlc-orchestrator" (which normally triggers gate checking) but the prompt is a delegation (contains phase pattern "06-implementation" and "GATE-06"). The delegation guard should override the orchestrator check.

**Note**: The `sdlc-orchestrator` subagent_type has phase "all" in the manifest, so `detectPhaseDelegation()` returns `isDelegation: false` for this input. However, the prompt contains phase pattern `06-implementation` which triggers delegation detection via Step 4. The guard should catch this.

---

### TC-GB-D02: Delegation bypasses gate check for non-orchestrator subagent
**Requirement**: FIX-003, AC-09
**Priority**: P0

**Preconditions**:
- State: 06-implementation, iteration enforcement enabled
- Iteration requirements configured

**Input**:
```javascript
{
    tool_name: 'Task',
    tool_input: {
        prompt: 'Execute Phase 05 - Test Strategy for fix workflow.\nValidate GATE-05 on completion.',
        subagent_type: 'test-design-engineer'
    }
}
```

**Expected Result**:
- Exit code: 0
- stdout: empty string (allowed)

**Rationale**: Non-orchestrator subagent_type already bypasses the gate keyword check in the current code (line 137 only triggers for orchestrator). This test verifies the delegation guard does not break this existing behavior.

---

### TC-GB-D03: Genuine gate advancement by orchestrator still detected
**Requirement**: FIX-003, AC-10
**Priority**: P0

**Preconditions**:
- State: 06-implementation, iteration enforcement enabled, test_iteration not started
- Iteration requirements configured for 06-implementation

**Input**:
```javascript
{
    tool_name: 'Task',
    tool_input: {
        prompt: 'Please advance to the next phase',
        subagent_type: 'sdlc-orchestrator'
    }
}
```

**Expected Result**:
- Exit code: 0
- stdout: JSON with `{ continue: false }` and stopReason including "GATE BLOCKED"

**Rationale**: No delegation markers in the prompt (no phase pattern, no agent name other than "orchestrator"). `detectPhaseDelegation()` returns `isDelegation: false` (orchestrator has phase "all", treated as setup). Existing gate keyword matching proceeds correctly.

---

### TC-GB-D04: Orchestrator subagent_type check still functional
**Requirement**: FIX-003, AC-11
**Priority**: P1

**Preconditions**:
- State: 06-implementation, iteration enforcement enabled
- Iteration requirements configured

**Input**:
```javascript
{
    tool_name: 'Task',
    tool_input: {
        prompt: 'run gate check for phase 06',
        subagent_type: 'sdlc-orchestrator'
    }
}
```

**Expected Result**:
- Exit code: 0
- stdout: JSON with `{ continue: false }` and stopReason including "GATE BLOCKED"

**Rationale**: Orchestrator call with "gate" keyword is a genuine gate advancement attempt. The delegation guard allows this through because "sdlc-orchestrator" has phase "all" and the prompt does not contain specific phase agent names.

---

### TC-GB-D05: Delegation with phase pattern in prompt bypasses gate check
**Requirement**: FIX-003, AC-09
**Priority**: P1

**Preconditions**:
- State: 06-implementation, iteration enforcement enabled
- Iteration requirements configured

**Input**:
```javascript
{
    tool_name: 'Task',
    tool_input: {
        prompt: 'Execute Phase 02 - Tracing for fix workflow.\nPhase key: 02-tracing\nValidate GATE-02 on completion.',
        subagent_type: 'trace-analyst'
    }
}
```

**Expected Result**:
- Exit code: 0
- stdout: empty string (allowed)

**Rationale**: Prompt contains phase pattern `02-tracing` and agent name `trace-analyst`. Delegation detection succeeds via subagent_type matching.

---

### TC-GB-D06: Delegation with agent name in description bypasses gate check
**Requirement**: FIX-003, AC-09
**Priority**: P1

**Preconditions**:
- State: 06-implementation, iteration enforcement enabled
- Iteration requirements configured

**Input**:
```javascript
{
    tool_name: 'Task',
    tool_input: {
        prompt: 'Execute Phase 08 - Code Review.',
        description: 'Validate GATE-08 on completion. Delegate to code-reviewer.',
        subagent_type: 'code-reviewer'
    }
}
```

**Expected Result**:
- Exit code: 0
- stdout: empty string (allowed)

**Rationale**: Agent name "code-reviewer" appears in both subagent_type and description. Delegation detection succeeds.

---

## Regression Test Coverage (AC-12 through AC-17)

### AC-12: constitution-validator regression
**Verification**: Run `node --test src/claude/hooks/tests/test-constitution-validator.test.cjs` -- all 19 existing tests pass.
**Tests**: #1 through #19 in the existing suite (non-Task passthrough, completion patterns, setup bypass, fail-open, enforcement disabled, constitutional status checks, self-healing, BUG-0005 read priority).

### AC-13: iteration-corridor regression
**Verification**: Run `node --test src/claude/hooks/tests/test-iteration-corridor.test.cjs` -- all 24 existing tests pass.
**Tests**: #1 through #24 in the existing suite (non-Task passthrough, fail-open, enforcement disabled, TEST_CORRIDOR blocks, CONST_CORRIDOR blocks, escalated exit, self-healing, setup bypass).

### AC-14: gate-blocker regression
**Verification**: Run `node --test src/claude/hooks/tests/test-gate-blocker-extended.test.cjs` -- all 26 existing tests pass.
**Tests**: #1 through #26 in the existing suite (non-Task passthrough, non-orchestrator passthrough, gate keywords, setup bypass, requirement checks, fail-open, self-healing, BUG-0005 fallback branch).

### AC-15: common.cjs not modified
**Verification**: `git diff src/claude/hooks/lib/common.cjs` shows no changes. Verified in code review (Phase 08).

### AC-16: pre-task-dispatcher not modified
**Verification**: `git diff src/claude/hooks/dispatchers/pre-task-dispatcher.cjs` shows no changes. Verified in code review (Phase 08).

### AC-17: phase-loop-controller and phase-sequence-guard not modified
**Verification**: `git diff src/claude/hooks/phase-loop-controller.cjs src/claude/hooks/phase-sequence-guard.cjs` shows no changes. Verified in code review (Phase 08).

---

## NFR Validation

### NFR-001: Performance (<5ms overhead)
**Method**: Manual timing in test output. The `detectPhaseDelegation()` function is documented to run in <100ms; the guard adds a single function call.
**Test approach**: Not tested via unit tests. Observed in CI run times.

### NFR-002: Fail-Open Behavior
**Method**: If `detectPhaseDelegation()` is wrapped in try-catch, the guard falls through to existing pattern matching on error.
**Test approach**: Verified by code inspection in Phase 08. The try-catch pattern is specified in the trace analysis.

### NFR-003: Code Consistency
**Method**: All three hooks use the same import + guard pattern.
**Test approach**: Verified by code inspection in Phase 08.

### NFR-004: Runtime Sync
**Method**: Changes to `src/claude/hooks/` synced to `.claude/hooks/`.
**Test approach**: Part of the implementation phase, verified in Phase 16.

---

## Test Summary

| Category | Count | Files |
|----------|-------|-------|
| New unit tests (delegation guard) | 17 | 3 test files (5 + 6 + 6) |
| Existing regression tests | 69 | 3 test files (19 + 24 + 26) |
| Constraint validations (code review) | 3 | N/A (git diff in Phase 08) |
| **Total test assertions** | **86+** | **3 test files** |
