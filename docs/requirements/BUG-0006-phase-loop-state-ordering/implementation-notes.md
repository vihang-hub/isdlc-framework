# Implementation Notes: BUG-0006 -- Phase-Loop State Ordering Fix

**Bug ID**: BUG-0006
**Phase**: 06-implementation
**Date**: 2026-02-12
**Artifact Folder**: BUG-0006-phase-loop-state-ordering

---

## Summary

Fixed the Phase-Loop Controller state ordering bug where STEP 3d (Task delegation) fired before state.json was updated with the current phase's `"in_progress"` status. The `phase-loop-controller.cjs` hook correctly enforced that `phases[key].status` must be `"in_progress"` before allowing delegation, causing every phase transition to be blocked.

## Changes Made

### 1. Added STEP 3c-prime: Pre-Delegation State Update (T0007, FR-01)

**File**: `src/claude/commands/isdlc.md`

Inserted a new step **3c-prime** between STEP 3c (escalation handling) and STEP 3d (Task delegation). This step writes the following fields to `state.json` BEFORE the Task tool delegation fires:

1. `phases[phase_key].status` = `"in_progress"` (AC-01a)
2. `phases[phase_key].started` = ISO-8601 timestamp, only if not already set (AC-01b)
3. `active_workflow.current_phase` = `phase_key` (AC-01c)
4. `active_workflow.phase_status[phase_key]` = `"in_progress"` (AC-01d)
5. Top-level `current_phase` = `phase_key` (AC-01e)
6. Top-level `active_agent` = agent name from PHASE_AGENT_MAP (AC-01f)
7. Write `.isdlc/state.json` to disk (AC-01g)

### 2. Removed Redundant Next-Phase Activation from STEP 3e Step 6 (T0008, FR-02)

**File**: `src/claude/commands/isdlc.md`

STEP 3e step 6 previously set the NEXT phase to `"in_progress"` after the CURRENT phase completed. This was redundant because the new STEP 3c-prime handles phase activation at the START of each iteration. Removed:

- `active_workflow.phase_status[new_phase]` = `"in_progress"` (AC-02a, AC-02b)
- `phases[new_phase].status` = `"in_progress"` (AC-02a)
- `active_workflow.current_phase` = `phases[new_index]` (AC-02c)
- Top-level `current_phase` = new phase key (AC-02d)
- Top-level `active_agent` = new phase agent (AC-02d)

Preserved:
- `active_workflow.current_phase_index` += 1 (AC-02e, at step 4)
- Steps 1-5 and 7-8 unchanged (AC-02f): completed status marking, summary, phase_status "completed", state write, tasks.md update

### 3. Runtime Copy Sync (T0009, FR-04)

The source file (`src/claude/commands/isdlc.md`) and runtime copy (`.claude/commands/isdlc.md`) share the same inode (hardlinked), so changes to the source file are automatically reflected in the runtime copy. Verified identical via `diff` and inode comparison.

## Design Decisions

1. **Named the new step "3c-prime" rather than "3a-prime"**: The step was placed between 3c and 3d, so 3c-prime is the natural label. The trace analysis suggested "3a-prime" but placing it after the escalation check (3c) ensures escalations are handled before state activation.

2. **Used shared state.json read from STEP 3b**: The instruction notes "Using the state.json already read in step 3b" to minimize I/O, per constraint C-04.

3. **Conditional started timestamp**: The started timestamp only sets if not already present, preserving the original start time on phase retries (per AC-01b).

4. **Updated PHASE_AGENT_MAP reference**: Changed the parenthetical from "for step 6 active_agent resolution" to "for STEP 3c-prime active_agent resolution" since step 6 no longer uses it.

## Test Results

- **New tests**: 18 tests in `isdlc-step3-ordering.test.cjs` -- all passing
- **Existing hook tests**: 883 tests -- all passing
- **Existing ESM tests**: 489/490 passing (1 pre-existing failure: TC-E09 unrelated to this fix)
- **Total**: 1372 tests passing

## Files Modified

| File | Action | Traces To |
|------|--------|-----------|
| `src/claude/commands/isdlc.md` | MODIFY | FR-01, FR-02 |
| `.claude/commands/isdlc.md` | AUTO-SYNCED (hardlink) | FR-04 |
| `src/claude/hooks/tests/isdlc-step3-ordering.test.cjs` | CREATE | All test cases |
| `docs/isdlc/tasks.md` | MODIFY | Progress tracking |
