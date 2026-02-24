# Bug Report: BUG-0006 — Phase-Loop Controller Delegates Before Marking State as in_progress

**ID**: BUG-0006
**Severity**: HIGH
**Component**: `src/claude/commands/isdlc.md` (Phase-Loop Controller, STEP 3)
**Related**: BUG-0005 (state tracking stale — partially fixed this area)
**Reporter**: Developer (dogfooding)
**Date**: 2026-02-12

---

## Summary

The Phase-Loop Controller in `isdlc.md` fires the `Task` tool delegation (STEP 3d) before writing `phases[key].status = "in_progress"` to `state.json`. The `phase-loop-controller.cjs` hook correctly blocks the delegation because the phase status is not `"in_progress"`, but the ordering violation means the hook must intervene on every phase transition.

## Reproduction Steps

1. Start a workflow: `/isdlc feature "any feature"`
2. Phase 01 completes via `init-and-phase-01` mode
3. Phase-Loop Controller enters STEP 3 loop for remaining phases
4. STEP 3a marks TaskUpdate as `in_progress` (UI spinner only — no state.json write)
5. STEP 3d fires `Task` tool to delegate to the next phase agent
6. `phase-loop-controller.cjs` hook intercepts the Task call
7. Hook reads `state.phases[currentPhase].status` — finds `"pending"` (not `"in_progress"`)
8. Hook BLOCKS the delegation with: "phase task has not been marked as in_progress"

## Expected Behavior

- `phases[key].status` in `state.json` should be `"in_progress"` BEFORE the Task delegation fires
- `active_workflow.current_phase` should match the phase being delegated
- `active_workflow.phase_status[key]` should be `"in_progress"`
- Top-level `current_phase` and `active_agent` should be set
- The `phase-loop-controller.cjs` hook should find status `"in_progress"` and allow the delegation

## Actual Behavior

- STEP 3a only calls `TaskUpdate` (UI task tracker, not state.json)
- No state.json write occurs between STEP 3a and STEP 3d
- STEP 3d fires Task delegation with stale state
- Hook correctly blocks because `phases[key].status` is still `"pending"` or whatever the previous STEP 3e left it as
- The BUG-0005 fix added writes to STEP 3e (post-phase), but those only run AFTER the phase completes — they set the NEXT phase's status, not the CURRENT one before delegation

## Root Cause

The execution order in STEP 3 is:

```
3a. TaskUpdate (UI only — no state.json)
3b. Read state.json, check escalations
3c. Handle escalations if any
3d. Task delegation → HOOK FIRES HERE, reads state.json → status is NOT in_progress
3e. Post-phase: write phases[completed].status = "completed", phases[next].status = "in_progress"
```

The state.json write for the CURRENT phase's `in_progress` status is missing entirely from the pre-delegation sequence. STEP 3e sets the NEXT phase to `in_progress`, but only after the CURRENT phase has already completed. This creates a gap: the very first iteration of the loop after init always has stale state.

## Affected Files

1. `src/claude/commands/isdlc.md` — STEP 3 ordering (PRIMARY FIX)
2. `.claude/commands/isdlc.md` — Runtime copy (must sync)

## Impact

- Every phase delegation in the loop is potentially blocked by `phase-loop-controller.cjs`
- The hook correctly identifies the inconsistency — it's a real state ordering bug
- Agents may have already partially completed work before the hook blocks
- Wastes compute on failed delegations that get retried

## Fix Strategy

Insert a state.json write between STEP 3a and STEP 3d:

**New STEP 3a-prime (between 3a and 3b, or integrated into 3b):**
1. Read `.isdlc/state.json`
2. Set `phases[phase_key].status` = `"in_progress"`
3. Set `phases[phase_key].started` = current ISO timestamp (if null)
4. Set `active_workflow.current_phase` = phase_key
5. Set `active_workflow.phase_status[phase_key]` = `"in_progress"`
6. Set top-level `current_phase` = phase_key
7. Set top-level `active_agent` = agent name (from PHASE_AGENT_MAP)
8. Write `.isdlc/state.json`

This mirrors the writes that STEP 3e does for the NEXT phase, but applies them to the CURRENT phase BEFORE delegation.
