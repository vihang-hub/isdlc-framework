# ADR-0023: START_PHASE Parameter for Phase-Skip Mechanism

## Status

Accepted

## Context

When analysis phases are pre-completed via `/isdlc analyze`, the build workflow should start from a later phase. Three mechanisms were evaluated for how the build verb communicates the starting point to the orchestrator:

- **Option A**: Build verb pre-filters the phases array and passes the complete subset to the orchestrator
- **Option B**: Build verb passes a single `START_PHASE` string; orchestrator slices the array from that index
- **Option C**: Build verb passes a `SKIP_PHASES` array; orchestrator filters those out

## Decision

Option B: Pass a single `START_PHASE` string parameter to the orchestrator's `init-and-phase-01` mode.

The build verb determines the appropriate start phase (e.g., `"05-test-strategy"` for fully analyzed items, `"02-impact-analysis"` for partial analysis resume) and passes it to the orchestrator. The orchestrator looks up the phase in the workflow's full phases array (from `workflows.json`), slices from that index onward, and calls `resetPhasesForWorkflow(state, slicedPhases)`.

## Rationale

1. **Simplicity (Article V)**: A single string parameter is simpler than constructing a filtered array or a skip-list. The orchestrator already owns the workflow definition from `workflows.json` and knows how to slice it.
2. **Validation**: The orchestrator can validate that `START_PHASE` is a real phase key in the workflow. With Option A, validation would need to happen in the build verb, which does not own workflow definitions.
3. **Single source of truth**: The phases array is always derived from `workflows.json` by the orchestrator. The build verb never constructs phase arrays.
4. **Backward compatibility (AC-006-05)**: When `START_PHASE` is absent, the orchestrator uses the full phases array. The parameter is optional with a clean fallback.

## Compatibility with `resetPhasesForWorkflow`

The existing `resetPhasesForWorkflow(state, workflowPhases)` function in `common.cjs` already accepts any array of phase keys and creates fresh skeleton entries. No modification is needed. The orchestrator simply passes the sliced array instead of the full array.

## Alternatives Rejected

- **Option A** (pre-filtered array): Duplicates workflow-definition logic. The build verb should not construct phase arrays from `workflows.json`.
- **Option C** (SKIP_PHASES array): More complex than `START_PHASE` for the common case (skipping a contiguous prefix). Ambiguous for non-contiguous skip patterns.

## Consequences

**Positive:**
- Minimal parameter surface (one string). Orchestrator owns all phase-array logic. Easy to validate.
- Invalid `START_PHASE` values are caught by the orchestrator with `ERR-ORCH-INVALID-START-PHASE` and fall back to full workflow.

**Negative:**
- Cannot express arbitrary phase subsets (e.g., "skip Phase 03 but run Phase 02"). This is acceptable because the feature only supports skipping a contiguous prefix of analysis phases.

## Traces

- FR-002 (Phase-Skip for Fully Analyzed)
- FR-006 (Orchestrator START_PHASE)
- FR-007 (Artifact Folder Naming)
- AC-006-01 through AC-006-05
