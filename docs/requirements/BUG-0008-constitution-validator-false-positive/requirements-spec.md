# Requirements Specification: BUG-0008 — Hook Delegation Guard

**Version**: 1.0.0
**Created**: 2026-02-12
**Workflow**: Fix (BUG-0008-constitution-validator-false-positive)

---

## Functional Requirements

### FIX-001: Delegation Detection Guard for constitution-validator.cjs
**Priority**: P0 (Critical)

The `isPhaseCompletionAttempt()` function in constitution-validator.cjs MUST skip COMPLETION_PATTERNS matching when the Task tool call is a phase delegation (as identified by `detectPhaseDelegation()` returning `isDelegation: true`).

**Acceptance Criteria:**
- AC-01: When a Task call has `subagent_type` matching a known phase agent, `isPhaseCompletionAttempt()` returns `false`
- AC-02: When a Task call prompt contains a phase agent name from the manifest, `isPhaseCompletionAttempt()` returns `false`
- AC-03: When a Task call prompt contains a phase pattern like `"01-requirements"`, `isPhaseCompletionAttempt()` returns `false`
- AC-04: Genuine completion declarations (no delegation markers) continue to be detected correctly
- AC-05: Setup command bypass (SETUP_COMMAND_KEYWORDS) remains unchanged and still works

### FIX-002: Delegation Detection Guard for iteration-corridor.cjs
**Priority**: P0 (Critical)

The `taskHasAdvanceKeywords()` function in iteration-corridor.cjs MUST skip ADVANCE_PATTERNS matching when the Task tool call is a phase delegation.

**Acceptance Criteria:**
- AC-06: When a Task call is a delegation, `taskHasAdvanceKeywords()` returns `false`
- AC-07: Genuine advance/escape attempts during active corridors continue to be blocked
- AC-08: Both TEST_CORRIDOR and CONST_CORRIDOR enforcement remain functional for non-delegation Task calls

### FIX-003: Delegation Detection Guard for gate-blocker.cjs
**Priority**: P1 (High)

The `isGateAdvancementAttempt()` function in gate-blocker.cjs MUST skip gate keyword matching when the Task tool call is a phase delegation.

**Acceptance Criteria:**
- AC-09: When a Task call is a delegation, `isGateAdvancementAttempt()` returns `false`
- AC-10: Genuine gate advancement attempts (orchestrator calls with advance/gate keywords) continue to be detected
- AC-11: The existing `subagent_type` check for orchestrator invocations remains functional

### FIX-004: No Regression in Existing Hook Behavior
**Priority**: P0 (Critical)

All existing hook behavior MUST be preserved. The delegation guard is an early-exit optimization, not a logic change.

**Acceptance Criteria:**
- AC-12: All existing test cases for constitution-validator continue to pass
- AC-13: All existing test cases for iteration-corridor continue to pass
- AC-14: All existing test cases for gate-blocker continue to pass
- AC-15: The `detectPhaseDelegation()` function in common.cjs is NOT modified
- AC-16: The pre-task-dispatcher execution order is NOT modified
- AC-17: Hooks that already use `detectPhaseDelegation()` correctly (phase-loop-controller, phase-sequence-guard) are NOT modified

---

## Non-Functional Requirements

### NFR-001: Performance
Each hook's delegation guard MUST add less than 5ms overhead. `detectPhaseDelegation()` is already optimized for <100ms.

### NFR-002: Fail-Open Behavior
If `detectPhaseDelegation()` throws an error, the hook MUST fall through to existing pattern matching (fail-open). The guard MUST NOT introduce new failure modes.

### NFR-003: Code Consistency
The delegation guard pattern MUST be consistent across all three hooks. Use the same import and call pattern.

### NFR-004: Runtime Sync
Changes to `src/claude/hooks/` MUST be synced to `.claude/hooks/` for runtime use.

---

## Constraints

### CON-001: No Changes to common.cjs
The `detectPhaseDelegation()` function in `lib/common.cjs` MUST NOT be modified. It already works correctly.

### CON-002: No Changes to Dispatcher
The `pre-task-dispatcher.cjs` MUST NOT be modified. Hook execution order is correct.

### CON-003: Minimal Code Change
Each fix is 3-5 lines of code added to the detection function. No refactoring of surrounding code.

### CON-004: Backward Compatibility
The fix MUST be backward-compatible with all existing callers. No API changes.

---

## Assumptions

1. `detectPhaseDelegation()` from common.cjs is already imported or available via require in all three hooks
2. The function correctly distinguishes delegations from non-delegation Task calls
3. No other hooks in the pre-task-dispatcher pipeline are affected by this bug
4. The plan-surfacer and skill-validator hooks are not affected (they do not use completion/gate pattern matching)
