# Requirements Specification: BUG-0013

## Bug Report: Phase-loop-controller false blocks on sub-agent Task calls

**ID**: BUG-0013
**Severity**: High
**Priority**: P1
**Status**: Open
**Reporter**: Developer
**Date**: 2026-02-13

---

## 1. Problem Statement

The `phase-loop-controller.cjs` hook fires on ALL `Task` tool calls when a workflow is active. When a phase agent spawns sub-agents (e.g., tracing-orchestrator spawning T1/T2/T3, or impact-analysis-orchestrator spawning M1/M2/M3), the `detectPhaseDelegation()` function resolves those sub-agents to their parent phase via `normalizeAgentName()` + `getAgentPhase()`. The hook then treats these as top-level phase delegations and checks whether `state.phases[currentPhase].status` is `in_progress`. If the status is `pending` or missing, it blocks the Task call.

### Root Cause

The hook does not distinguish between:
1. **Top-level phase delegations** -- the orchestrator or phase-loop-controller delegating TO a phase agent (e.g., orchestrator -> tracing-orchestrator)
2. **Intra-phase sub-agent calls** -- a phase agent delegating to its own sub-agents (e.g., tracing-orchestrator -> trace-code-analyzer)

Both resolve to the same `targetPhase` because sub-agents map to their parent phase in the skills manifest. The hook lacks a same-phase bypass: when the delegation target resolves to the currently active phase (`active_workflow.current_phase`), it should be allowed because the phase is already executing.

### Observed Behavior

- Sub-agent Task calls within an active phase are falsely blocked
- Error message: "Phase status is 'pending', expected 'in_progress'"
- This occurs even when the phase IS the current active phase and work is underway
- Workaround: Manually setting phase status to `in_progress` before sub-agent calls

### Expected Behavior

- Sub-agent Task calls within the current active phase should be allowed
- Only cross-phase delegations should be subject to the `in_progress` status check
- The hook should recognize that if `delegation.targetPhase === active_workflow.current_phase`, the phase is already executing

---

## 2. Affected Component

- **File**: `src/claude/hooks/phase-loop-controller.cjs`
- **Function**: `check(ctx)` (lines 26-99)
- **Dependency**: `detectPhaseDelegation()` in `src/claude/hooks/lib/common.cjs`

---

## 3. Reproduction Steps

1. Start a fix workflow (`/isdlc fix`)
2. Advance to Phase 02-tracing (tracing-orchestrator)
3. Tracing-orchestrator spawns sub-agent T1 (trace-code-analyzer) via Task tool
4. `detectPhaseDelegation()` resolves T1 to phase `02-tracing`
5. Hook checks `state.phases['02-tracing'].status`
6. If status is not `in_progress`, the Task call is blocked
7. Error: "Phase status is 'pending', expected 'in_progress'"

---

## 4. Functional Requirements

### FR-01: Same-Phase Bypass
When `detectPhaseDelegation()` identifies a Task call as a phase delegation, and the resolved `targetPhase` matches `active_workflow.current_phase`, the hook MUST allow the call without checking `state.phases` status.

**Acceptance Criteria:**
- AC-01: If `delegation.targetPhase === active_workflow.current_phase`, return `{ decision: 'allow' }`
- AC-02: The bypass MUST be checked AFTER confirming an active workflow exists (not before)
- AC-03: The bypass MUST be checked AFTER confirming `currentPhase` is non-null
- AC-04: The same-phase bypass MUST log a debug message: "Same-phase delegation to {targetPhase}, allowing"

### FR-02: Cross-Phase Delegation Preserved
The existing blocking behavior for cross-phase delegations MUST remain unchanged.

**Acceptance Criteria:**
- AC-05: If `delegation.targetPhase !== active_workflow.current_phase`, the existing status check logic applies
- AC-06: Cross-phase delegations to phases with status `pending` MUST still be blocked
- AC-07: Cross-phase delegations to phases with status `in_progress` or `completed` MUST still be allowed

### FR-03: Null Safety
The same-phase bypass comparison MUST handle null/undefined values safely.

**Acceptance Criteria:**
- AC-08: If `delegation.targetPhase` is null, the bypass MUST NOT trigger (fall through to existing logic)
- AC-09: If `active_workflow.current_phase` is null, the bypass MUST NOT trigger
- AC-10: If both are null, the bypass MUST NOT trigger (null === null should not match)

### FR-04: Observability
The bypass decision MUST be observable in hook activity logs.

**Acceptance Criteria:**
- AC-11: Same-phase bypass events MUST be logged via `logHookEvent()` with event type 'same-phase-bypass'
- AC-12: The log entry MUST include: phase name, agent name, decision ('allow')

---

## 5. Non-Functional Requirements

### NFR-01: Performance
- The same-phase bypass check MUST add < 1ms to hook execution time
- The check is a simple string comparison, well within the 100ms performance budget

### NFR-02: Fail-Open Behavior
- If the same-phase comparison throws (e.g., type coercion error), the hook MUST fail-open (allow)
- Consistent with Article X: Fail-Safe Defaults

### NFR-03: Backward Compatibility
- No changes to the `detectPhaseDelegation()` function signature or return type
- No changes to state.json schema
- No changes to hook protocol (stdin/stdout format)

---

## 6. Fix Location

The fix is a 3-line addition in `phase-loop-controller.cjs`, inserted between the `currentPhase` null check (line 63) and the `phaseState` lookup (line 67):

```javascript
// Same-phase bypass: sub-agent calls within the current phase are allowed
if (delegation.targetPhase === currentPhase) {
    debugLog('Same-phase delegation to', currentPhase, '- allowing');
    return { decision: 'allow' };
}
```

---

## 7. Test Strategy Reference

- Failing tests MUST be written before the fix (TDD, per Article II)
- Unit tests for the `check()` function with same-phase delegation scenarios
- Unit tests for cross-phase delegation to confirm no regression
- See test-strategy.md for detailed test plan
