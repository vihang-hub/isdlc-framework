# ADR-0024: Partial Analysis 3-Option Menu Design

## Status

Accepted

## Context

When a backlog item has partial analysis (1-4 of 5 analysis phases complete), the build verb must decide what to do. The requirements specify an explicit user-facing menu rather than automatic behavior (DEC-001 from requirements-spec.md). The menu presents three options:

- `[R] Resume analysis` -- continue from the next incomplete analysis phase
- `[S] Skip to implementation` -- jump to Phase 05, skipping remaining analysis
- `[F] Full restart` -- clear all analysis and start from Phase 00

## Decision

Implement the 3-option menu as specified, with Resume as the first/default option.

## Rationale

1. **Explicit over implicit (Article IV)**: Auto-resuming could surprise users who intentionally stopped analysis. The menu gives explicit control.
2. **Safety of Skip**: Skipping remaining analysis phases is a valid power-user action but carries risk (lower-quality output). The menu warns about this explicitly (AC-003-04).
3. **Full restart necessity**: Required for cases where analysis is outdated or the user wants a fresh start. This resets meta.json before delegating.

## Menu Interaction

Uses `AskUserQuestion` with three labeled options. The response determines the `START_PHASE` passed to the orchestrator:

| Choice | START_PHASE | Meta.json Action |
|--------|-------------|------------------|
| `[R] Resume` | Next incomplete analysis phase (from `computeStartPhase().startPhase`) | No change |
| `[S] Skip` | `"05-test-strategy"` | No change; warning displayed |
| `[F] Full restart` | null (full workflow) | Clear `phases_completed`, set `analysis_status` to `"raw"`, update `codebase_hash` |

## Consequences

**Positive:**
- User always has explicit control. No surprises.
- Common case (Resume) is the first option, reducing friction.
- Each option maps cleanly to a single `START_PHASE` value.

**Negative:**
- Extra prompt for partial-analysis cases. Acceptable because partial analysis is the minority case, and the prompt provides valuable information about what was completed.

## Traces

- FR-003 (Partial Analysis Handling)
- AC-003-01 through AC-003-06
- Article IV (Explicit Over Implicit)
