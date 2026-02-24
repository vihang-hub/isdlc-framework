# Implementation Notes: REQ-0011 Adaptive Workflow Sizing

**Phase**: 06-implementation
**Date**: 2026-02-12
**Branch**: feature/REQ-0011-adaptive-workflow-sizing

---

## Summary

Implemented three pure utility functions for adaptive workflow sizing in `common.cjs`,
plus configuration and agent file changes across 5 files. All 1076 CJS hook tests pass
(including 72 new sizing tests). All 489 ESM tests pass (1 pre-existing failure TC-E09
unrelated to this work).

## Files Modified

### Source Code

1. **`src/claude/hooks/lib/common.cjs`** (MODIFY)
   - Added ~230 lines in new "Sizing Utilities (REQ-0011)" section
   - 3 exported functions: `parseSizingFromImpactAnalysis`, `computeSizingRecommendation`, `applySizingDecision`
   - 3 private helpers: `_safeNonNegInt`, `_validateAndNormalizeSizingMetrics`, `_checkSizingInvariants`
   - Placed between "Dispatcher helpers (REQ-0010)" section and `module.exports`
   - Added 3 exports to `module.exports` block

2. **`src/isdlc/config/workflows.json`** (MODIFY)
   - Added `light` option to `feature.options` block
   - Added `sizing` configuration block with thresholds, skip phases, and risk override
   - Renamed `no_phase_skipping` rule to `no_agent_phase_skipping` with explanatory comment

3. **`src/claude/commands/isdlc.md`** (MODIFY)
   - Added `-light` flag usage examples to feature command section
   - Added flag parsing step (step 3) in feature initialization flow
   - Added `flags` field to `active_workflow` initialization
   - Added STEP 3e-sizing block (sizing decision point) between STEP 3e and 3e-refine
   - Full UX specification: recommendation banner, user menu, override sub-menu

4. **`src/claude/agents/impact-analysis/impact-analysis-orchestrator.md`** (MODIFY)
   - Updated JSON metadata block to include 5 sizing-required fields
   - Added `files_directly_affected`, `modules_affected`, `risk_level`, `blast_radius`, `coverage_gaps`
   - Added `coverage_gaps` derivation instructions

5. **`src/claude/hooks/workflow-completion-enforcer.cjs`** (MODIFY)
   - Added REQ-0011 comments documenting variable-length phase array support
   - Added `sizingRecord` capture from workflow_history entry
   - Passes sizing record to reconstructed `active_workflow` for snapshot collection

### Test Code

6. **`src/claude/hooks/tests/test-sizing.test.cjs`** (CREATE)
   - 72 test cases in 5 describe blocks
   - Covers all 3 functions: parseSizing (19), computeSizing (16), applySizing (26)
   - Integration tests (8), Error path tests (3)
   - Test helpers: `buildFeatureState`, `buildMinimalState`, `buildStateWithHighIndex`, `buildIAContent`
   - Pre-built metric objects: `lowMetrics`, `mediumMetrics`, `epicMetrics`
   - stderr capture helpers for testing diagnostic output

## Key Implementation Decisions

1. **No new dependencies**: All functions use JavaScript built-ins only (String, Array, RegExp, JSON, parseInt, Number, Date). Traces to NFR-03.

2. **Mutation-in-place pattern**: `applySizingDecision` follows the same mutation pattern as `resetPhasesForWorkflow()` and `pruneCompletedPhases()`. Returns the mutated state reference.

3. **Invariant rollback**: When light intensity triggers invariant violations (too few phases, index out of bounds, orphan status entries, next phase not pending), the function rolls back all changes and falls back to standard. The `fallback_reason` field records this for auditability.

4. **Epic deferred**: Epic intensity sets `effective_intensity: 'standard'` and `epic_deferred: true` since epic decomposition is not yet implemented (FR-06 is deferred).

5. **Rule rename**: `no_phase_skipping` -> `no_agent_phase_skipping` with comment clarifying that framework-level sizing modifications are permitted. This is purely semantic -- no behavioral change in gate-blocker.cjs (which does not reference the rule name directly).

6. **workflows.json source location**: The canonical source is `src/isdlc/config/workflows.json`. No runtime copies were found at `.isdlc/config/` or `.claude/hooks/config/` to sync.

## Test Results

```
CJS hooks: 1076 tests, 1076 pass, 0 fail
ESM:        490 tests, 489 pass, 1 fail (pre-existing TC-E09)
Sizing:      72 tests,  72 pass, 0 fail
```

## Traceability

| AC | Implementation |
|----|---------------|
| AC-01 | `parseSizingFromImpactAnalysis` in common.cjs, JSON metadata in IA orchestrator |
| AC-03 | `parseSizingFromImpactAnalysis` + `computeSizingRecommendation` (pure, deterministic) |
| AC-04 | `computeSizingRecommendation` light threshold logic |
| AC-05 | `computeSizingRecommendation` standard range logic |
| AC-07 | `sizing.thresholds` in workflows.json, threshold sanitization in compute function |
| AC-12-14 | `-light` flag in isdlc.md feature command section |
| AC-02, AC-08-11 | STEP 3e-sizing in isdlc.md Phase-Loop Controller |
| AC-15-18 | `applySizingDecision` light phase removal + invariant checks |
| AC-24 | Sizing record in `applySizingDecision` |
| AC-25 | `workflow-completion-enforcer.cjs` variable-length guard |
| ADR-0004 | `no_agent_phase_skipping` rename in workflows.json |
