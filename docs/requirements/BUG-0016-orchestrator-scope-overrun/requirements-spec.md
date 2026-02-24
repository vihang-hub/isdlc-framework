# Bug Report: BUG-0016 - Orchestrator Exceeds init-and-phase-01 Scope

**ID**: BUG-0016
**Type**: Bug Fix
**Severity**: High
**Priority**: P1
**Status**: Open
**Reported**: 2026-02-14
**Reporter**: Internal dogfooding (BUG-0015/0016 workflow observation)

---

## Summary

The SDLC Orchestrator, when invoked in `init-and-phase-01` execution mode, runs all workflow phases internally instead of returning control after Phase 01. This completely bypasses the phase-loop controller in `isdlc.md`, eliminating per-phase task visibility, hook enforcement between phases, escalation handling, and supervised review gates.

## Reproduction Steps

1. User invokes `/isdlc fix "some bug description"`
2. `isdlc.md` (phase-loop controller) creates an orchestrator Task with `MODE: init-and-phase-01`
3. The orchestrator is supposed to: initialize workflow, run Phase 01, validate GATE-01, then STOP and return a JSON result
4. Instead, the orchestrator continues to Phase 02, 05, 06, 16, and 08 internally
5. All 6 phases complete inside a single orchestrator Task call
6. The phase-loop controller never gets to manage individual phases

## Expected Behavior

When `MODE: init-and-phase-01` is specified:
1. Orchestrator initializes the workflow (validate constitution, create branch, set up state)
2. Orchestrator runs Phase 01 ONLY (requirements/bug-report capture)
3. Orchestrator validates GATE-01
4. Orchestrator STOPS and returns a structured JSON result:
   ```json
   {
     "status": "phase_01_complete",
     "phases": ["01-requirements", "02-tracing", ...],
     "artifact_folder": "BUG-NNNN-...",
     "workflow_type": "fix",
     "next_phase_index": 1
   }
   ```
5. Control returns to `isdlc.md` which manages remaining phases one at a time

## Actual Behavior

The orchestrator ignores the `MODE: init-and-phase-01` constraint and autonomously runs all phases (01 -> 02 -> 05 -> 06 -> 16 -> 08) in a single call, only returning after the entire workflow completes.

## Impact

- **No per-phase task visibility**: Users cannot see which phase is active (TaskCreate/TaskUpdate never called per-phase by the controller)
- **No hook enforcement between phases**: Pre-task/post-task hooks that run between phase delegations are bypassed
- **No escalation handling**: The phase-loop controller's error handling and escalation logic is never invoked
- **No supervised review gates**: When `--supervised` mode is active, review gates between phases are skipped
- **Stale state.json**: Phase status updates happen inside the orchestrator without the controller's state management

## Root Cause Analysis

The orchestrator's agent definition (`src/claude/agents/00-sdlc-orchestrator.md`) contains comprehensive instructions for managing all phases. When the orchestrator is given a MODE parameter, it should respect the execution boundary, but the "Automatic Phase Transitions (NO PERMISSION PROMPTS)" instruction (Section 4a) causes it to automatically advance through all phases without stopping.

The MODE parameter and its constraints are documented in Section 3c of the orchestrator, but the automatic-transition behavior in Section 4a overrides this -- the orchestrator sees gate passes and automatically proceeds.

---

## Functional Requirements

### FR-01: MODE Parameter Enforcement
The orchestrator MUST respect the `MODE` parameter when present in the Task prompt. When `MODE: init-and-phase-01` is specified, the orchestrator MUST NOT proceed past Phase 01.

**Acceptance Criteria:**
- AC-01.1: When MODE is `init-and-phase-01`, orchestrator runs Phase 01 only
- AC-01.2: When MODE is `init-and-phase-01`, orchestrator returns structured JSON after GATE-01
- AC-01.3: When MODE is `single-phase`, orchestrator runs only the specified PHASE
- AC-01.4: When MODE is `finalize`, orchestrator runs only merge/completion logic
- AC-01.5: When no MODE is present, orchestrator runs full workflow (backward compatible)

### FR-02: Explicit Stop-After-Phase-01 Instruction
The orchestrator MUST contain an explicit, unambiguous instruction to STOP after Phase 01 when in `init-and-phase-01` mode, positioned to override the automatic-transition instruction.

**Acceptance Criteria:**
- AC-02.1: Stop instruction appears BEFORE the automatic-transition section
- AC-02.2: Stop instruction uses CRITICAL/MANDATORY language that cannot be overridden
- AC-02.3: Stop instruction explicitly references the JSON return format
- AC-02.4: Stop instruction explicitly says "DO NOT delegate to Phase 02 or any subsequent agent"

### FR-03: Mode-Aware Phase Transition Guard
The automatic phase transition logic (Section 4a) MUST check the current MODE before advancing.

**Acceptance Criteria:**
- AC-03.1: Phase transition logic checks MODE before advancing
- AC-03.2: In `init-and-phase-01` mode, transition is blocked after Phase 01
- AC-03.3: In `single-phase` mode, transition is blocked after the specified phase
- AC-03.4: In `finalize` mode, no phase transitions occur (only merge logic)

### FR-04: Return Format Compliance
The orchestrator MUST return the exact JSON structure specified in the MODE documentation when operating in controlled modes.

**Acceptance Criteria:**
- AC-04.1: `init-and-phase-01` returns `{ status, phases, artifact_folder, workflow_type, next_phase_index }`
- AC-04.2: `single-phase` returns `{ status, phase_completed, gate_result, blockers }`
- AC-04.3: `finalize` returns `{ status, merged, pr_url, workflow_id, metrics }`

---

## Non-Functional Requirements

### NFR-01: No Regression in Full-Workflow Mode
When no MODE parameter is present, the orchestrator MUST continue to work exactly as before (autonomous full workflow execution).

### NFR-02: Instruction Positioning
The mode-enforcement instructions MUST be positioned at the TOP of the orchestrator's execution flow, BEFORE any phase delegation logic, to ensure they take precedence.

### NFR-03: Clarity of Stop Conditions
The stop conditions MUST be expressed in imperative language that leaves no room for interpretation (e.g., "STOP HERE", "DO NOT PROCEED", "RETURN IMMEDIATELY").

---

## Files Affected

1. `src/claude/agents/00-sdlc-orchestrator.md` -- Primary fix location
2. `src/claude/commands/isdlc.md` -- May need reinforcement of MODE expectations

---

## Traceability

| Requirement | Design | Test | Code |
|-------------|--------|------|------|
| FR-01 | Section 3c enforcement | T01-T05 | orchestrator.md |
| FR-02 | Stop instruction placement | T06-T09 | orchestrator.md |
| FR-03 | Transition guard | T10-T13 | orchestrator.md |
| FR-04 | Return format | T14-T17 | orchestrator.md |
