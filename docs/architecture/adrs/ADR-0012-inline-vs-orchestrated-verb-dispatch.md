# ADR-0012: Inline vs. Orchestrated Verb Dispatch

## Status
Accepted

## Context
The three-verb backlog model (REQ-0023) introduces three new commands: `add`, `analyze`, and `build`. These verbs have fundamentally different execution requirements:

- `add` creates files on disk (draft.md, meta.json, BACKLOG.md entry) but must not create workflows or modify state.json (NFR-002).
- `analyze` delegates to phase agents (00-04) for interactive analysis but must not create workflows or modify state.json (NFR-002).
- `build` creates a full feature workflow with branch creation, state.json initialization, and phase-loop progression.

The existing framework has two execution modes:
1. **Orchestrated**: Commands delegate to the orchestrator agent via Task tool, which manages workflow state. Used by `feature`, `fix`, `upgrade`.
2. **Inline**: Commands execute directly within isdlc.md without orchestrator delegation. Precedent: the BUG-0021 Phase A `analyze` carve-out.

## Decision
Use **inline execution** for `add` and `analyze`, and **orchestrated execution** for `build`.

- `add` and `analyze` are added to `EXEMPT_ACTIONS` in both `skill-delegation-enforcer.cjs` and `delegation-gate.cjs`, preventing the hook system from requiring orchestrator delegation.
- `build` is NOT added to EXEMPT_ACTIONS. It routes through the standard orchestrator delegation flow, identical to the current `feature` command.
- `/isdlc feature` is preserved as a hidden alias for `build`.

## Consequences

**Positive:**
- `add` and `analyze` can run without an active workflow, enabling pre-analysis before committing to a build
- `add` and `analyze` can run in parallel with an active `build` workflow (zero shared state)
- The state.json write protection invariant (NFR-002) is enforced architecturally, not just by convention
- The existing hook enforcement chain works with a one-line change (add `'add'` to EXEMPT_ACTIONS)

**Negative:**
- Inline handlers in isdlc.md must manage their own error handling (no orchestrator error recovery)
- The `analyze` handler must delegate to phase agents directly, duplicating some of the Phase-Loop Controller's delegation logic

## Alternatives Considered
- **All verbs through orchestrator**: Would require state.json writes for add/analyze, violating NFR-002. The orchestrator always initializes `active_workflow`.
- **New lightweight orchestrator for analyze**: Over-engineering for a sequential 5-phase pipeline. Article V (Simplicity First) applies.
- **Separate command files (add.md, analyze.md, build.md)**: Would fragment the command surface. The existing single-file dispatch in isdlc.md is simpler and proven.

## Traces
- FR-001 (Add verb), FR-002 (Analyze verb), FR-003 (Build verb)
- FR-008 (Hook updates)
- NFR-002 (Zero state corruption)
- Article V (Simplicity First), Article X (Fail-Safe Defaults)
