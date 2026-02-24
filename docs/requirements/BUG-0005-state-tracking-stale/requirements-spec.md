# Requirements Specification: BUG-0005 - Redundant State Tracking Fix

**Bug ID:** BUG-0005-state-tracking-stale
**Type:** Bug Fix
**Severity:** High
**Created:** 2026-02-12

---

## 1. Bug Summary

state.json has 3 redundant locations tracking phase status (`active_workflow.phase_status`, top-level `current_phase`/`active_agent`, top-level `phases{}`). The phase-loop controller (isdlc.md STEP 3e) only partially updates these, causing staleness. Hooks read from inconsistent locations with wrong priority, causing false blocks. Additionally, tasks.md is never updated after plan generation -- completed phases still show `[ ]`.

---

## 2. Fix Requirements

### FR-01: STEP 3e must update `active_workflow.phase_status`

When the phase-loop controller completes a phase and advances to the next:

**AC-01a:** STEP 3e sets `active_workflow.phase_status[completed_phase]` = `"completed"`
**AC-01b:** STEP 3e sets `active_workflow.phase_status[next_phase]` = `"in_progress"` (if more phases remain)
**AC-01c:** The `active_workflow.phase_status` object reflects the true state of all phases at every transition

### FR-02: STEP 3e must update top-level `active_agent`

**AC-02a:** STEP 3e sets top-level `active_agent` to the agent name for the next phase
**AC-02b:** Agent name resolution uses the phase-to-agent mapping (phase key prefix maps to agent)

### FR-03: Hooks must prefer `active_workflow.current_phase` over top-level `current_phase`

All hooks that read phase information must use this priority order:
1. `state.active_workflow.current_phase` (primary)
2. `state.current_phase` (fallback for backward compatibility)

**AC-03a:** `constitution-validator.cjs` reads from `active_workflow.current_phase` first, falls back to `current_phase`
**AC-03b:** `delegation-gate.cjs` reads from `active_workflow.current_phase` first (fix inverted priority on line 133)
**AC-03c:** `log-skill-usage.cjs` reads from `active_workflow.current_phase` first, falls back to `current_phase`
**AC-03d:** `skill-validator.cjs` reads from `active_workflow.current_phase` first, falls back to `current_phase`
**AC-03e:** `gate-blocker.cjs` fallback branch reads from `active_workflow.current_phase` first
**AC-03f:** `model-provider-router.cjs` / `provider-utils.cjs` reads from `active_workflow.current_phase` first

### FR-04: STEP 3e must mark completed tasks in tasks.md

When a phase completes, its corresponding task(s) in tasks.md must be checked off.

**AC-04a:** After setting phase status to "completed" in state.json, STEP 3e reads `docs/isdlc/tasks.md` (if it exists)
**AC-04b:** For the completed phase, STEP 3e changes `- [ ] TNNNN ...` to `- [X] TNNNN ...` for all tasks in that phase's section
**AC-04c:** STEP 3e updates the Progress Summary table at the top of tasks.md (completed count, percentage)
**AC-04d:** If tasks.md does not exist (e.g., test-run workflow), STEP 3e skips this update silently

### FR-05: Top-level fields remain for backward compatibility

**AC-05a:** Top-level `current_phase` continues to be written by STEP 3e (already done)
**AC-05b:** Top-level `phases{}` continues to be written by STEP 3e (already done)
**AC-05c:** Top-level `active_agent` is updated by STEP 3e (new -- FR-02)
**AC-05d:** No hooks or agents are broken by the change in read priority

### FR-06: Hooks that write to `state.phases` must continue working

Several hooks write iteration state, constitutional validation, and gate validation into `state.phases[currentPhase]`. These writes must continue to function correctly.

**AC-06a:** `constitution-validator.cjs` writes to `state.phases[currentPhase].constitutional_validation` using the correctly resolved phase key
**AC-06b:** `test-watcher.cjs` writes to `state.phases[currentPhase].iteration_requirements.test_iteration` using the correctly resolved phase key
**AC-06c:** `menu-tracker.cjs` writes to `state.phases[currentPhase].iteration_requirements.interactive_elicitation` using the correctly resolved phase key
**AC-06d:** `gate-blocker.cjs` writes to `state.phases[currentPhase].gate_validation` using the correctly resolved phase key

---

## 3. Affected Files

### Hooks (read-priority fix):
1. `src/claude/hooks/constitution-validator.cjs` (line 245) -- AC-03a
2. `src/claude/hooks/delegation-gate.cjs` (line 133) -- AC-03b
3. `src/claude/hooks/log-skill-usage.cjs` (line 87) -- AC-03c
4. `src/claude/hooks/skill-validator.cjs` (line 95) -- AC-03d
5. `src/claude/hooks/gate-blocker.cjs` (line 578) -- AC-03e
6. `src/claude/hooks/lib/provider-utils.cjs` (line 323) -- AC-03f

### Command (STEP 3e updates):
7. `src/claude/commands/isdlc.md` (lines 813-819) -- FR-01, FR-02, FR-04

### Already correct (no changes needed):
- `src/claude/hooks/phase-sequence-guard.cjs` -- reads `active_workflow.current_phase`
- `src/claude/hooks/plan-surfacer.cjs` -- reads `active_workflow.current_phase`
- `src/claude/hooks/constitutional-iteration-validator.cjs` -- reads `active_workflow.current_phase`
- `src/claude/hooks/phase-transition-enforcer.cjs` -- reads `active_workflow.current_phase`
- `src/claude/hooks/iteration-corridor.cjs` -- reads `active_workflow` first
- `src/claude/hooks/menu-tracker.cjs` -- reads `active_workflow` first
- `src/claude/hooks/test-watcher.cjs` -- reads `active_workflow` first

---

## 4. Constraints

1. **Backward compatibility**: Top-level fields (`current_phase`, `active_agent`, `phases{}`) must continue to be written. Hooks may still be invoked standalone (outside dispatcher) and need fallback reads.
2. **Fail-open**: All hooks already fail-open on missing state. The read-priority change must preserve this behavior.
3. **No new dependencies**: This is a fix to existing prompt text (isdlc.md) and hook logic -- no new files or modules.
4. **Test coverage**: All hook changes must have corresponding test updates to verify the new read priority.

---

## 5. Out of Scope

- Removing top-level fields entirely (would break backward compat and standalone hook execution)
- Refactoring the state.json schema (separate initiative)
- Changing the hook dispatcher architecture
- Changing how the orchestrator writes initial `active_workflow` state
