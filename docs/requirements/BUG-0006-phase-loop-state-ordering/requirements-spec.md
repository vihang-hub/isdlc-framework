# Requirements Specification: BUG-0006 — Phase-Loop State Ordering Fix

**Bug ID**: BUG-0006
**Type**: Bug Fix
**Priority**: HIGH
**Artifact Folder**: BUG-0006-phase-loop-state-ordering
**Date**: 2026-02-12

---

## Problem Statement

The Phase-Loop Controller in `isdlc.md` delegates to phase agents (STEP 3d) without first writing the phase's `in_progress` status to `state.json`. The `phase-loop-controller.cjs` hook correctly enforces that `phases[key].status` must be `"in_progress"` before allowing delegation, causing every phase transition to be blocked.

## Functional Requirements

### FR-01: Pre-delegation state write

**Description**: Before the Task tool delegation in STEP 3d, the Phase-Loop Controller MUST write the current phase's `in_progress` status to `state.json`.

**Acceptance Criteria**:
- AC-01a: `phases[phase_key].status` is set to `"in_progress"` before Task delegation
- AC-01b: `phases[phase_key].started` is set to current ISO-8601 timestamp (only if currently null — preserve existing start time on retries)
- AC-01c: `active_workflow.current_phase` is set to the phase being delegated
- AC-01d: `active_workflow.phase_status[phase_key]` is set to `"in_progress"`
- AC-01e: Top-level `current_phase` is set to the phase key
- AC-01f: Top-level `active_agent` is set to the agent name (resolved from PHASE_AGENT_MAP)
- AC-01g: `state.json` is written to disk BEFORE the Task tool call fires

### FR-02: Eliminate redundant writes in STEP 3e

**Description**: STEP 3e currently sets the NEXT phase to `in_progress`. Since the new pre-delegation write (FR-01) now handles this, STEP 3e should ONLY handle marking the COMPLETED phase and incrementing the index. The "set next phase to in_progress" writes in STEP 3e step 6 should be REMOVED to avoid double-writes and ensure a single source of truth for phase activation.

**Acceptance Criteria**:
- AC-02a: STEP 3e step 6 no longer sets `phases[new_phase].status = "in_progress"`
- AC-02b: STEP 3e step 6 no longer sets `active_workflow.phase_status[new_phase] = "in_progress"`
- AC-02c: STEP 3e step 6 no longer sets `active_workflow.current_phase` to the new phase
- AC-02d: STEP 3e step 6 no longer sets top-level `current_phase` or `active_agent` to the new phase
- AC-02e: STEP 3e step 6 STILL increments `active_workflow.current_phase_index` (required for loop progression)
- AC-02f: STEP 3e steps 1-5 and 7-8 remain unchanged (completed phase marking, state write, tasks.md update)

### FR-03: State consistency between pre-delegation and post-phase

**Description**: The state.json written pre-delegation (FR-01) and post-phase (FR-02) must not conflict. The pre-delegation write activates the phase; the post-phase write deactivates it.

**Acceptance Criteria**:
- AC-03a: After pre-delegation write: `phases[key].status == "in_progress"` AND `active_workflow.phase_status[key] == "in_progress"` AND `active_workflow.current_phase == key`
- AC-03b: After post-phase write: `phases[key].status == "completed"` AND `active_workflow.phase_status[key] == "completed"` AND `active_workflow.current_phase_index` incremented by 1
- AC-03c: No state field is written in both FR-01 and FR-02 for the SAME phase key (no double-writes)
- AC-03d: The `phase-loop-controller.cjs` hook allows delegation after FR-01 write (status is `"in_progress"`)

### FR-04: Runtime copy sync

**Description**: Changes to `src/claude/commands/isdlc.md` must be synced to `.claude/commands/isdlc.md`.

**Acceptance Criteria**:
- AC-04a: `.claude/commands/isdlc.md` is identical to `src/claude/commands/isdlc.md` after the fix

## Non-Functional Requirements

- NFR-01: The fix must not change the external behavior visible to users (same task spinners, same phase progression)
- NFR-02: The fix must not break existing hook enforcement (phase-loop-controller.cjs, delegation-gate, etc.)
- NFR-03: No new hooks or files are created — this is a documentation/instruction fix in isdlc.md only
- NFR-04: The fix must be backward compatible with the BUG-0005 state sync improvements

## Constraints

- C-01: Only `isdlc.md` (src + .claude) needs modification — no hook code changes
- C-02: STEP 3e must still handle tasks.md updates and completed phase marking
- C-03: The PHASE_AGENT_MAP in isdlc.md is the source of truth for active_agent resolution
- C-04: State.json reads in STEP 3b can be shared with the new pre-delegation write to minimize I/O

## Traceability

| Requirement | Traces To | Verified By |
|-------------|-----------|-------------|
| FR-01 | BUG-0006 root cause | Manual review of isdlc.md STEP 3 ordering |
| FR-02 | FR-01 (eliminates redundancy) | Verify STEP 3e no longer has next-phase activation |
| FR-03 | FR-01 + FR-02 consistency | State file inspection after each write |
| FR-04 | Dogfooding sync requirement | File diff comparison |
