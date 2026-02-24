# Implementation Notes: BUG-0013 -- Phase-loop-controller false blocks

**Phase**: 06-implementation
**Date**: 2026-02-13
**Author**: software-developer agent
**Version**: 1.2.0 (phase-loop-controller.cjs)

---

## Summary

Added a same-phase bypass to `phase-loop-controller.cjs` that prevents false blocks
when sub-agent Task calls are made within the currently active phase. The fix is 11 lines
of code inserted between the `currentPhase` null check and the `phaseState` lookup.

## Root Cause

`detectPhaseDelegation()` resolves sub-agents (e.g., `symptom-analyzer`, `execution-path-tracer`)
to their parent phase. When the resolved `targetPhase` matches `currentPhase`, the call is an
intra-phase sub-agent spawn, not a cross-phase delegation. The hook was incorrectly treating
these as cross-phase delegations and blocking them when `phases[currentPhase].status` was not
`in_progress`.

## Fix Applied

**File**: `src/claude/hooks/phase-loop-controller.cjs` (lines 68-81)

After the `currentPhase` null guard (line 62-66), before the `phaseState` lookup (line 83):

```javascript
// BUG-0013: Same-phase bypass
if (delegation.targetPhase === currentPhase) {
    debugLog('Same-phase delegation detected (targetPhase === currentPhase), allowing');
    logHookEvent('phase-loop-controller', 'same-phase-bypass', {
        phase: currentPhase,
        agent: delegation.agentName || 'unknown',
        reason: 'targetPhase matches currentPhase -- intra-phase sub-agent call'
    });
    return { decision: 'allow' };
}
```

## Design Decisions

1. **Strict equality (`===`)**: Both `targetPhase` and `currentPhase` are strings from the same
   namespace (phase keys like `06-implementation`). No normalization needed.

2. **Observability via logHookEvent**: The bypass logs a `same-phase-bypass` event to
   `hook-activity.log` so operators can audit intra-phase delegation traffic. This satisfies
   FR-04 (AC-11, AC-12).

3. **Position before phaseState check**: The bypass fires before looking up phase status,
   meaning same-phase calls are allowed regardless of status value (pending, in_progress,
   completed, or any other value). This is correct because the phase-loop-controller's purpose
   is to prevent cross-phase delegation without progress tracking, not to gate intra-phase calls.

4. **No status value dependency**: The bypass does not check `phaseStatus` at all. Even with
   status `pending` or `some_unknown_status`, same-phase calls are allowed. This is validated
   by T16.

## Test Results

- **23/23 tests pass** (18 existing + 5 new from Phase 05)
- **1140/1140 CJS tests pass** (full hook suite, zero regressions)
- **TDD cycle**: Red (5 failing) -> Green (0 failing) in 1 iteration

## Files Modified

| File | Change | Lines |
|------|--------|-------|
| `src/claude/hooks/phase-loop-controller.cjs` | Same-phase bypass + version bump | +13 lines |

## Traceability

| Requirement | Status |
|-------------|--------|
| FR-01 (same-phase bypass) | Implemented |
| FR-02 (cross-phase preserved) | Verified (T17-T19) |
| FR-03 (null safety) | Verified (T20-T22) |
| FR-04 (observability) | Implemented (T23) |
| AC-01 thru AC-04 | Green (T13-T16) |
| AC-05 thru AC-07 | Green (T17-T19) |
| AC-08 thru AC-10 | Green (T20-T22) |
| AC-11, AC-12 | Green (T23) |
| NFR-01 (performance) | Met (<1ms for bypass path) |
| NFR-02 (fail-open) | Preserved (error catch unchanged) |
| NFR-03 (backward compat) | Verified (1140 CJS pass, 0 regressions) |
