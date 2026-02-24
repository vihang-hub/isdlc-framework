# ADR-0002: Sizing Functions Placement in common.cjs

## Status
Accepted

## Context

Three new utility functions are needed for adaptive workflow sizing:
- `parseSizingFromImpactAnalysis(content)` - parses impact analysis output
- `computeSizingRecommendation(metrics, thresholds)` - applies threshold logic
- `applySizingDecision(state, intensity, sizingData)` - mutates state

These functions need a home. Two options were considered:
1. Add to the existing `src/claude/hooks/lib/common.cjs` shared library
2. Create a new `src/claude/hooks/lib/sizing-utils.cjs` module

## Decision

Add all three functions to the existing `common.cjs` shared library.

## Consequences

**Positive:**
- Follows existing patterns: `collectPhaseSnapshots()`, `resetPhasesForWorkflow()`, `pruneCompletedPhases()` are all state-mutation functions already in common.cjs
- No new require() paths needed in consuming files
- Shares existing imports (`fs`, `path`)
- Existing test infrastructure (`common.test.cjs` with 61 tests) can be extended
- Module.exports addition is backward-compatible

**Negative:**
- common.cjs grows larger (currently 2132 lines, adding ~120 lines)
- common.cjs is imported by all 28 hooks + 5 dispatchers (larger parse footprint)
- Conceptual coupling: sizing-specific logic in a generic utility module

**Mitigations:**
- The 120-line addition is proportionally small (~5.6% growth)
- Node.js require() caches modules after first load -- no repeated parse cost
- Functions are grouped under a clear section header (`// Sizing Utilities (REQ-0011)`)
- Future refactoring into a separate module is trivial (move functions, update exports)

## Alternatives Considered

**New file: `sizing-utils.cjs`**
- Rejected: premature abstraction for 3 functions (~120 lines). Would require a new file, new require() statements in isdlc.md's common.cjs import, and a new test file. Adds complexity without proportional benefit. Violates Article V (Simplicity First). The functions follow the exact same in-memory state mutation pattern as 5+ existing functions in common.cjs.

## Traces To
FR-01 (AC-01, AC-03), FR-02 (AC-04, AC-07), FR-05 (AC-15 through AC-18), FR-07 (AC-24)
