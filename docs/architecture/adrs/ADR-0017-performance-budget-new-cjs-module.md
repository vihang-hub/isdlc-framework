# ADR-0017: New CJS Module for Performance Budget Utilities

## Status
Accepted

## Context
REQ-0025 (Performance Budget and Guardrail System) requires 7 new utility functions for budget computation, degradation logic, regression detection, and dashboard formatting. The existing `common.cjs` is 3453 lines with approximately 86 exports and has been flagged in impact analysis as approaching technical debt threshold.

Two options were evaluated:
1. Add functions to `common.cjs`
2. Create a new `performance-budget.cjs` module in `hooks/lib/`

## Decision
Create a new `src/claude/hooks/lib/performance-budget.cjs` module containing all 7 functions as a cohesive, independently-testable unit.

The only change to `common.cjs` is a 3-line extension to `collectPhaseSnapshots()` to include the `timing` object from phase data. `collectPhaseSnapshots()` stays in `common.cjs` because it is already exported there and called by 3 consumers; moving it would be a breaking change with no benefit.

## Rationale
- The 7 functions form a single-responsibility module (performance budget computation)
- Follows the exact pattern of `gate-requirements-injector.cjs`: standalone CJS, fail-open, reads config files
- `common.cjs` is already at technical debt threshold
- New module is independently testable with its own test file
- Callers in `isdlc.md` reference the module conceptually (markdown instructions), not via `require()`, minimizing coupling

## Consequences
**Positive:**
- Keeps `common.cjs` from growing further
- New module is independently testable (~37 unit tests)
- Clear module boundary and single responsibility
- Follows established project pattern

**Negative:**
- `workflow-completion-enforcer.cjs` must import from a new path
- Minor additional file in `hooks/lib/` directory

## Traces
- FR-002 through FR-007 (all utility functions)
- NFR-003 (module isolation helps footprint management)
- Article V (Simplicity First): Avoids bloating common.cjs
