# ADR-0001: Sizing Insertion Point in Phase-Loop Controller

## Status
Accepted

## Context

Adaptive Workflow Sizing (REQ-0011) requires a decision point after Impact Analysis (Phase 02) completes and before Phase 03 (Architecture) begins. This decision point must:

1. Read Impact Analysis outputs (FR-01)
2. Compute a sizing recommendation (FR-01)
3. Present an interactive UX menu to the user (FR-03)
4. Modify the phase array if light intensity is chosen (FR-05)
5. Handle the -light flag bypass (FR-04)

Three insertion strategies were considered:
- A new hook (PreToolUse on Task delegation)
- A new standalone agent (Phase 02.5)
- A new micro-step in the Phase-Loop Controller (STEP 3e-sizing)

## Decision

Insert sizing logic as a **conditional micro-step (STEP 3e-sizing)** in the Phase-Loop Controller (isdlc.md), triggered only when `phase_key === '02-impact-analysis'` AND `active_workflow.type === 'feature'`.

The step is placed after STEP 3e (post-phase state update) and before STEP 3e-refine (task refinement). This mirrors the existing pattern for STEP 3e-refine which was added as a conditional step after Phase 04 completion.

Pure computational logic (parsing, recommendation algorithm, state mutation) is extracted into three functions in `common.cjs`. The Phase-Loop Controller handles orchestration and UX.

## Consequences

**Positive:**
- Follows the established pattern (STEP 3e-refine is an identical insertion model)
- Keeps interactive UX in the conversation thread (hooks cannot present menus)
- Pure functions in common.cjs are independently testable
- No new files or agents needed
- Minimal disruption to existing Phase-Loop Controller flow

**Negative:**
- The Phase-Loop Controller (isdlc.md) grows larger (already ~960 lines)
- Markdown specification is not unit-testable (only the extracted common.cjs functions are)
- Adding more conditional steps increases cognitive complexity of the Phase-Loop Controller

**Mitigations:**
- The sizing step is clearly bounded with trigger checks (only feature workflow, only after Phase 02, only if sizing not already set)
- Future technical debt item: consider extracting the Phase-Loop Controller into executable JS

## Alternatives Considered

**Hook (PreToolUse on Task delegation to Phase 03 agent)**
- Rejected: hooks cannot present interactive UX menus. They produce JSON protocol output on stdout and exit. Sizing requires a user accept/override interaction.

**Standalone Agent (Phase 02.5)**
- Rejected: excessive overhead for a lightweight operation (read one file, apply thresholds, present menu). Would require a new agent file, a new phase entry, workflow definition changes, and Phase-Loop Controller changes. Violates Article V (Simplicity First).

## Traces To
FR-01 (AC-01, AC-02), FR-03 (AC-08, AC-09), FR-04 (AC-12, AC-13)
