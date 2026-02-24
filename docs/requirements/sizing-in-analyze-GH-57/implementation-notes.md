# Implementation Notes: Sizing Decision in Analyze Verb (GH-57)

**Phase**: 06-implementation
**Date**: 2026-02-20
**Feature**: Add sizing decision (light/standard) to the analyze workflow after Phase 02 completes

---

## Changes Made

### 1. `src/claude/hooks/lib/three-verb-utils.cjs`

**deriveAnalysisStatus(phasesCompleted, sizingDecision?)** (lines 154-178)
- Added optional `sizingDecision` parameter (backward-compatible: undefined skips new logic)
- New sizing-aware block: when `sizingDecision.effective_intensity === 'light'` and `light_skip_phases` is a valid array, checks if all required (non-skipped) analysis phases are completed
- If all required phases present, returns `'analyzed'` even with fewer than 5 phases
- Three-part guard pattern ensures fail-safe behavior for missing/malformed data
- Traces: FR-007, ADR-002

**writeMetaJson(slugDir, meta)** (lines 304-317)
- Replaced 6 lines of inline status derivation with single call to `deriveAnalysisStatus(meta.phases_completed, meta.sizing_decision)`
- Net code reduction: 6 lines removed, 3 lines added
- `sizing_decision` is preserved in JSON output via `JSON.stringify(meta, null, 2)` -- no explicit handling needed
- Traces: FR-008, ADR-004

**computeStartPhase(meta, workflowPhases)** (lines 419-449)
- Inserted Step 3.5 between Step 3 (no valid phases -> raw) and Step 4 (all 5 -> analyzed)
- When `meta.sizing_decision.effective_intensity === 'light'` with valid skip list:
  - Checks all required analysis phases are completed
  - Filters workflow phases to exclude skipped phases
  - Returns `status: 'analyzed'` with `startPhase` pointing to first implementation phase
  - `completedPhases` contains only actually-executed phases (not skipped ones)
  - `remainingPhases` excludes both completed and skipped phases
- Signature unchanged (reads `meta.sizing_decision` directly)
- Traces: FR-009, ADR-003

### 2. `src/claude/commands/isdlc.md`

**Step 2.5: Flag parsing** (line 579)
- Extracts `-light` flag from analyze command arguments
- Removes flag from args before passing to `resolveItem()`
- Mirrors build handler flag parsing pattern

**Step 7.5: Sizing decision block** (lines 598-627)
- Triggers after Phase 02 completes, before step 7d
- Guard: only fires when `phase_key === '02-impact-analysis'` AND `meta.sizing_decision` is NOT already set
- PATH A (forced light via `-light` flag): builds sizing_decision record inline, writes via `writeMetaJson()`, breaks loop
- PATH B (interactive): parses IA metrics, computes recommendation, presents menu, builds record
- Never calls `applySizingDecision()` (CON-002, NFR-001)
- Never writes to `state.json` (NFR-001)

**Step 7d update**: Now passes `meta.sizing_decision` to `deriveAnalysisStatus()`

**Utility reference update**: Updated `deriveAnalysisStatus` signature documentation

### 3. `src/claude/hooks/tests/test-three-verb-utils.test.cjs`

Added 24 new test cases in 3 new describe blocks:
- **deriveAnalysisStatus() -- sizing-aware (GH-57)**: 10 tests (TC-DAS-S01 through TC-DAS-S10)
- **writeMetaJson() -- sizing-aware (GH-57)**: 5 tests (TC-WMJ-S01 through TC-WMJ-S05)
- **computeStartPhase() -- sizing-aware (GH-57)**: 9 tests (TC-CSP-S01 through TC-CSP-S09)

### 4. `src/claude/hooks/tests/sizing-consent.test.cjs` (new file)

Added 3 constraint-verification tests:
- **TC-SC-S01**: Verify `sizing_decision.context === 'analyze'`
- **TC-SC-S02**: Verify `applySizingDecision` is NOT exported from `three-verb-utils.cjs`
- **TC-SC-S03**: Verify `light_skip_phases` records which phases were skipped

---

## Test Results

| Test File | Total | Pass | Fail |
|-----------|-------|------|------|
| test-three-verb-utils.test.cjs | 208 | 208 | 0 |
| sizing-consent.test.cjs | 3 | 3 | 0 |
| test-sizing.test.cjs (unchanged) | 72 | 72 | 0 |
| **Total** | **283** | **283** | **0** |

All 184 pre-existing tests continue to pass without modification.

## Coverage

| File | Line % | Branch % | Function % |
|------|--------|----------|------------|
| three-verb-utils.cjs | 96.85% | 92.39% | 100% |

---

## Key Design Decisions

1. **Optional parameter for backward compatibility**: `deriveAnalysisStatus(phasesCompleted, sizingDecision)` defaults to original behavior when `sizingDecision` is undefined, null, or non-light.

2. **Delegation over duplication**: `writeMetaJson()` now delegates to `deriveAnalysisStatus()` instead of inlining identical logic (ADR-004).

3. **No signature change for computeStartPhase**: Reads `meta.sizing_decision` directly from the meta object rather than adding a parameter (ADR-003).

4. **Three-part guard pattern**: All sizing-aware code uses the same defensive check: `sizingDecision truthy` + `effective_intensity === 'light'` + `Array.isArray(light_skip_phases)`. If any check fails, fall through to existing logic (Article X fail-safe).

5. **Analyze never calls applySizingDecision()**: The analyze handler builds sizing_decision records inline and writes via `writeMetaJson()`. This preserves the NFR-001 constraint (no state.json writes from analyze context).
