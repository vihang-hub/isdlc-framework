# ADR-0022: Build Detection Logic Location

## Status

Accepted

## Context

The build auto-detection feature (REQ-0026) requires logic to read `meta.json`, compute analysis completion status, and present interactive menus to the user before delegating to the orchestrator. The question is where this detection logic should live. Three options were evaluated:

- **Option A**: All in `isdlc.md` build verb handler (detection + UX + phase-array construction)
- **Option B**: All in the orchestrator `00-sdlc-orchestrator.md` (detection after delegation)
- **Option C**: Split -- detection and UX in the build verb handler, phase-skip (array slicing) in the orchestrator, pure utility functions in `three-verb-utils.cjs`

## Decision

Option C: Split responsibility across three layers.

1. **Pure utility functions** (`three-verb-utils.cjs`): `computeStartPhase()`, `checkStaleness()`, `validatePhasesCompleted()` -- no side effects, trivially testable.
2. **User interaction** (`isdlc.md` build verb handler): Calls utility functions, presents staleness/partial-analysis menus, displays BUILD SUMMARY banner, gets user confirmation.
3. **Phase-array slicing** (`00-sdlc-orchestrator.md`): Receives `START_PHASE` parameter, slices the workflow phases array from that index onward, calls `resetPhasesForWorkflow()` with the subset.

## Rationale

1. **Separation of concerns**: The build verb owns user interaction. The orchestrator owns workflow initialization. Utility functions own pure computation. Each component has a single reason to change.
2. **Testability (NFR-006)**: The 3 detection functions are pure (no I/O except `checkStaleness` which takes the hash as input). They are unit-testable without mocking filesystem or git.
3. **Backward compatibility (NFR-003)**: If detection fails, the build verb simply omits `START_PHASE`, and the orchestrator falls back to the full workflow. The failure path is invisible to the orchestrator.
4. **No state.json writes during detection (CON-001)**: Detection happens before orchestrator delegation, before any state.json writes.

## Alternatives Rejected

- **Option A** (all in build verb): Would require the build verb to construct phase arrays, duplicating workflow-definition logic that belongs in the orchestrator.
- **Option B** (all in orchestrator): The orchestrator is a background Task agent and cannot reliably conduct multi-step interactive menus (staleness + partial analysis menus).

## Consequences

**Positive:**
- Clean separation. Each component has a single concern.
- Utility functions are pure and testable in isolation.
- Orchestrator changes are minimal (one new optional parameter).

**Negative:**
- The build verb handler grows by ~80-120 lines of conditional logic. This is acceptable because the logic is straightforward if/else on status and delegates computation to utility functions.

## Traces

- FR-001 (Analysis Status Detection)
- FR-005 (Phase Summary Display)
- FR-006 (Orchestrator START_PHASE)
- NFR-003 (Backward Compatibility)
- NFR-006 (Testability)
- CON-001 (No state.json writes during detection)
