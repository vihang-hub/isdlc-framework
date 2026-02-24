# ADR-001: Introduce MODE: init-only and Deprecate init-and-phase-01

## Status

Proposed

## Date

2026-02-20

## Context

The iSDLC orchestrator currently supports `MODE: init-and-phase-01`, which bundles workflow initialization (state.json setup, branch creation, counter increment) with first-phase execution, gate validation, and plan generation. This creates a dual-path execution model:

- **Path A**: Phase 01 is executed inside the orchestrator (via init-and-phase-01)
- **Path B**: Phases 02+ are executed by the Phase-Loop Controller in isdlc.md (via MODE: single-phase)

With the three-verb model (`add`/`analyze`/`build`), the `analyze` verb completes phases 00-04 before `build` is invoked. When `build` consumes pre-analyzed work with `START_PHASE`, the init mode forces the START_PHASE to be executed inside the orchestrator rather than uniformly in the Phase-Loop Controller. This coupling:

1. Prevents the Phase-Loop Controller from being the single execution path for all phases
2. Requires STEP 2 to pre-mark Phase 01 as completed (special-case logic)
3. Means plan generation happens inside init, coupling it to initialization timing

### Requirements Driving This Decision

- **FR-001**: MODE: init-only must perform all initialization without phase delegation
- **FR-002**: Phase-Loop Controller must handle all phases including Phase 01
- **FR-003**: init-and-phase-01 must remain functional (backward compat)
- **FR-007**: init-only return format must include all fields for Phase-Loop Controller
- **NFR-005**: Single execution path for all phase delegations
- **CON-001**: Backward compatibility during deprecation period

## Decision

Introduce a new `MODE: init-only` that performs all workflow initialization steps but does NOT delegate to any phase agent, validate any gate, or generate the plan. The orchestrator returns immediately after initialization with:

```json
{
  "status": "init_complete",
  "phases": ["01-requirements", ...],
  "artifact_folder": "REQ-0001-feature-name",
  "workflow_type": "feature",
  "next_phase_index": 0
}
```

The `next_phase_index: 0` signals that no phases have been executed. The Phase-Loop Controller starts its loop from index 0 (Phase 01).

`MODE: init-and-phase-01` remains fully functional but is marked as deprecated in the orchestrator's mode table. A deprecation notice is emitted to stderr when invoked.

The primary call path in isdlc.md STEP 1 switches from `init-and-phase-01` to `init-only`.

### init-only Scope (What It Does)

1. Validate prerequisites (constitution, no active workflow)
2. Load workflow definition from workflows.json
3. Handle START_PHASE and ARTIFACT_FOLDER parameters
4. Reset phases for new workflow
5. Write active_workflow to state.json
6. Update top-level current_phase
7. Parse --supervised flag
8. Create branch (if requires_branch: true)
9. Update meta.json with build tracking

### init-only Exclusions (What It Does NOT Do)

- Phase agent delegation
- Gate validation
- Plan generation (deferred to post-Phase-01 in the Phase-Loop Controller)

## Consequences

### Positive

- **Single execution path**: The Phase-Loop Controller handles ALL phases uniformly, eliminating the dual-path model
- **Simpler STEP 2**: No special-case "pre-mark Phase 01 as completed" logic
- **Cleaner separation**: Initialization is pure infrastructure (state, branch, counters); execution is Phase-Loop Controller
- **Pre-analyzed item support**: When `build` consumes a fully-analyzed item with `START_PHASE`, the Phase-Loop Controller starts at the correct phase without the orchestrator running an unnecessary first phase
- **Testability**: init-only's behavior is a strict subset of init-and-phase-01, easier to reason about

### Negative

- **Plan generation timing**: Plan generation must move out of the init mode and into a post-Phase-01 hook in the Phase-Loop Controller. This adds minor complexity to STEP 3e (design phase will specify the exact mechanism).
- **Deprecation overhead**: init-and-phase-01 must be maintained during the deprecation period, adding a small documentation burden.
- **Two round-trips for Phase 01**: Previously, init-and-phase-01 was one orchestrator call. Now, init-only is one call, then Phase 01 is a second call (via single-phase from the Phase-Loop Controller). The latency difference is negligible since the orchestrator delegation overhead is minimal compared to actual phase execution time.

## Alternatives Considered

### A: Modify init-and-phase-01 to Skip Phase Execution Conditionally

Add a `SKIP_PHASE_EXECUTION` flag to init-and-phase-01 that skips the phase delegation step. Rejected because:
- Overloads the existing mode with conditional behavior
- Makes the mode name misleading (it says "phase-01" but might not run it)
- Harder to reason about and test

### B: Remove init-and-phase-01 Immediately

Switch to init-only and remove init-and-phase-01 in the same change. Rejected because:
- Violates CON-001 (backward compatibility)
- Risk of breaking in-flight workflows
- No graceful deprecation path

### C: Keep Dual-Path Architecture, Add START_PHASE Awareness to init-and-phase-01

Modify init-and-phase-01 to handle START_PHASE by running the START_PHASE instead of Phase 01. This is already the current behavior (REQ-0026). Rejected because:
- Does not solve the fundamental problem: Phase-Loop Controller is not the single execution path
- STEP 2 still needs special-case logic
- The dual-path architecture remains

## Traces

- FR-001 (AC-001-01 through AC-001-06)
- FR-002 (AC-002-01 through AC-002-05)
- FR-003 (AC-003-01 through AC-003-04)
- FR-007 (AC-007-01 through AC-007-03)
- NFR-001 (AC-NFR-001-01 through AC-NFR-001-03)
- NFR-005 (AC-NFR-005-01, AC-NFR-005-02)
- CON-001
