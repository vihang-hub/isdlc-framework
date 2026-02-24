# Bug Report: BUG-0005 - Redundant State Tracking Causes Stale Fields and Hook Blocks

**Bug ID:** BUG-0005-state-tracking-stale
**External Link:** None (internal dogfooding discovery)
**External ID:** MAN
**Severity:** High
**Reported:** 2026-02-12
**Discovered During:** REQ-0009-enhanced-plan-to-tasks workflow execution

---

## Summary

state.json has 3 redundant locations tracking phase status. The phase-loop controller (isdlc.md STEP 3e) only updates `active_workflow.*` fields and top-level `phases{}` -- it does NOT update `active_workflow.phase_status{}` and does not consistently keep top-level `current_phase`/`active_agent` in sync. Multiple hooks read from different locations with inconsistent priority, causing false blocks when fields go stale.

Additionally, `docs/isdlc/tasks.md` is never updated after plan generation -- phases complete but tasks remain unchecked `[ ]`, giving a false PENDING status to anyone reading the plan.

---

## Root Cause Analysis

### Problem 1: Three redundant phase-tracking locations

state.json tracks the "current phase" and "phase status" in THREE places:

| Location | What it tracks | Who writes it | Who reads it |
|----------|---------------|---------------|--------------|
| `active_workflow.current_phase` | Current active phase key | STEP 3e (line 818) | phase-sequence-guard, plan-surfacer, constitutional-iteration-validator, phase-transition-enforcer, test-adequacy-blocker |
| `active_workflow.phase_status{}` | Status per phase (pending/in_progress/completed) | Orchestrator at init only | Nobody reads it during execution |
| `current_phase` (top-level) | Current active phase key | STEP 3e (line 818) | constitution-validator (line 245), delegation-gate (line 133), log-skill-usage (line 87), skill-validator (line 95), gate-blocker (line 578), model-provider-router (line 72) |
| `active_agent` (top-level) | Current active agent name | Orchestrator at init only | Not read by hooks, but visible in status |
| `phases{}` (top-level) | Full phase objects with status, timestamps, artifacts, iteration state | STEP 3e (lines 815-816), hooks (constitution-validator, test-watcher, menu-tracker, gate-blocker) | delegation-gate (line 134), constitutional-iteration-validator (line 104), gate-blocker (line 404), constitution-validator (line 276), iteration-corridor (line 109) |

### Problem 2: STEP 3e update gaps

The phase-loop controller STEP 3e (isdlc.md lines 813-819) performs these updates:

**What it DOES update:**
1. `phases[phase_key].status` = "completed"
2. `phases[phase_key].summary` = extracted summary
3. `active_workflow.current_phase_index` += 1
4. `active_workflow.current_phase` = next phase key
5. `phases[new_phase].status` = "in_progress"
6. Top-level `current_phase` = new phase key

**What it does NOT update:**
1. `active_workflow.phase_status[completed_phase]` -- remains "in_progress" forever
2. `active_workflow.phase_status[next_phase]` -- remains "pending" forever
3. Top-level `active_agent` -- remains as whatever was set at init

### Problem 3: Hook read-priority inversion

Several hooks read `state.current_phase` (top-level) BEFORE or INSTEAD of `state.active_workflow.current_phase`:

- **delegation-gate.cjs line 133**: `state.current_phase || (state.active_workflow && state.active_workflow.current_phase)` -- top-level first!
- **constitution-validator.cjs line 245**: `state.current_phase` -- ONLY reads top-level, never checks active_workflow
- **log-skill-usage.cjs line 87**: `state.current_phase || '01-requirements'` -- ONLY reads top-level
- **skill-validator.cjs line 95**: `state.current_phase || '01-requirements'` -- ONLY reads top-level
- **gate-blocker.cjs line 578**: `state.current_phase` -- fallback branch, only top-level

Other hooks correctly prioritize `active_workflow.current_phase`:
- phase-sequence-guard.cjs (line 58) -- correct
- plan-surfacer.cjs (line 232) -- correct
- iteration-corridor.cjs (line 248) -- correct (active_workflow first)
- menu-tracker.cjs (line 146) -- correct (active_workflow first)
- test-watcher.cjs (line 441) -- correct (active_workflow first)

### Problem 4: tasks.md never updated post-generation

After the orchestrator generates `docs/isdlc/tasks.md` (via ORCH-012 generate-plan skill), no mechanism exists to mark tasks as `[X]` when their corresponding phases complete. The plan-surfacer hook reads tasks.md for format validation but never writes to it. STEP 3e does not reference tasks.md at all.

---

## Expected Behavior

1. A single source of truth for phase status: `active_workflow.current_phase`, `active_workflow.phase_status{}`, and `active_workflow.current_phase_index`
2. All hooks read phase info from `active_workflow.*` with top-level fields as backward-compatible fallbacks only
3. STEP 3e updates ALL tracking locations consistently (or better: eliminates redundant ones)
4. When a phase completes, its corresponding task(s) in tasks.md are marked `[X]` and the Progress Summary table is updated

## Actual Behavior

1. Three tracking locations diverge after the first phase transition
2. `active_workflow.phase_status` never reflects completed phases
3. Top-level `active_agent` stays stale
4. Hooks using top-level fields may read stale values after phase transitions
5. tasks.md tasks remain `[ ]` even after phases complete, showing false PENDING status

## Reproduction Steps

1. Start any workflow: `/isdlc feature "test feature"`
2. Complete Phase 01 requirements
3. Phase-loop controller (STEP 3e) advances to Phase 02
4. Inspect state.json:
   - `active_workflow.phase_status["01-requirements"]` still says "in_progress" (should be "completed")
   - `active_workflow.phase_status["02-impact-analysis"]` still says "pending" (should be "in_progress")
   - Top-level `active_agent` still says "requirements-analyst" (should be "solution-architect")
5. Observe tasks.md: all tasks still show `[ ]` even though Phase 01 is done

---

## Fix Requirement

Consolidate phase tracking to `active_workflow.*` as the single source of truth. Update all hooks that read `state.current_phase` or `state.phases` to prefer `active_workflow.*`. Update STEP 3e to also update `active_workflow.phase_status`, top-level `active_agent`, and mark completed tasks as `[X]` in tasks.md with Progress Summary table updates.

---

## Environment

- iSDLC Framework 0.1.0-alpha
- Node.js 20+
- CommonJS hooks (.cjs)
- ESM CLI (lib/)
