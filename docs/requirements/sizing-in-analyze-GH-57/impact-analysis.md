# Impact Analysis: Sizing Decision in Analyze Verb

**Generated**: 2026-02-19
**Feature**: GH-57 -- Add sizing decision to the analyze verb -- skip architecture/design for trivial changes
**Based On**: Phase 01 Requirements (finalized, 10 FRs, 5 NFRs)
**Phase**: 02-impact-analysis
**Mode**: ANALYSIS MODE (no state.json writes, no branches)

---

## Scope Comparison

| Aspect | Original (Phase 00) | Clarified (Phase 01) |
|--------|---------------------|----------------------|
| Description | Add sizing decision to analyze verb | Sizing decision point after Phase 02 in analyze; light/standard menu; -light flag; meta.json storage; deriveAnalysisStatus/computeStartPhase sizing-awareness |
| Keywords | analyze, sizing, meta.json, light_skip_phases | analyze, sizing, meta.json, sizing_decision, -light flag, deriveAnalysisStatus, computeStartPhase, writeMetaJson, parseSizingFromImpactAnalysis |
| Estimated Files | ~13-18 (broad) | 7 primary + 1 test + 1 config verify = 9 |
| Scope Change | - | REFINED (narrowed scope, excluded agent doc updates, clarified constraints) |

---

## Executive Summary

This feature ports the sizing decision point from the build workflow (STEP 3e-sizing, lines 1461-1600 in isdlc.md) into the analyze workflow, enabling users to skip architecture and design phases for trivial changes. The blast radius is **medium** -- 3 core logic files require modification (isdlc.md, three-verb-utils.cjs, common.cjs), with cascading effects on the test suite and a config verification. The primary risk is the signature change to `deriveAnalysisStatus()`, which is called from both the analyze handler and the `writeMetaJson()` utility. The `computeStartPhase()` function in the build auto-detection path must also be updated, creating a cross-verb dependency. The sizing menu logic and metrics parsing functions already exist in common.cjs and can be reused (read-only) from the analyze context; the key constraint is that the analyze path must NOT call `applySizingDecision()` (which mutates state.json) and must instead write directly to meta.json.

**Blast Radius**: MEDIUM
**Risk Level**: MEDIUM
**Affected Files**: 9
**Affected Modules**: 4

---

## Impact Analysis (M1)

### Files Directly Affected

| # | File | Change Type | Lines Affected | Requirements Traced |
|---|------|-------------|----------------|---------------------|
| 1 | `src/claude/commands/isdlc.md` | MODIFY | ~563-600 (analyze handler) | FR-001, FR-002, FR-003, FR-004, FR-006, FR-010 |
| 2 | `src/claude/commands/isdlc.md` | MODIFY | ~232-246 (shared utilities docs) | FR-007 (doc update for new signature) |
| 3 | `src/claude/hooks/lib/three-verb-utils.cjs` | MODIFY | ~151-163 (deriveAnalysisStatus) | FR-007 |
| 4 | `src/claude/hooks/lib/three-verb-utils.cjs` | MODIFY | ~259-275 (writeMetaJson) | FR-008 |
| 5 | `src/claude/hooks/lib/three-verb-utils.cjs` | MODIFY | ~351-414 (computeStartPhase) | FR-009 |
| 6 | `src/claude/hooks/lib/common.cjs` | READ-ONLY | ~2713-2818 (parseSizingFromImpactAnalysis, computeSizingRecommendation) | FR-002 |
| 7 | `src/claude/hooks/lib/common.cjs` | READ-ONLY | ~2854-2919 (extractFallbackSizingMetrics) | FR-002 (fallback path) |
| 8 | `src/claude/hooks/tests/sizing-consent.test.cjs` | MODIFY | new test cases | FR-005, FR-007, FR-009 |
| 9 | `src/claude/hooks/tests/test-three-verb-utils.test.cjs` | MODIFY | new test cases | FR-007, FR-008, FR-009 |
| 10 | `src/isdlc/config/workflows.json` | VERIFY-ONLY | ~43-52 (sizing config) | FR-003 (light_skip_phases already present) |

### Dependency Analysis

#### Outward Dependencies (files that depend on modified code)

```
deriveAnalysisStatus()
  <- writeMetaJson()               [same file, three-verb-utils.cjs, line 270-272]
  <- isdlc.md analyze handler      [line 591, step 7d]
  <- test-three-verb-utils.test.cjs [14 direct call sites]

writeMetaJson()
  <- isdlc.md analyze handler      [line 593, step 7f]
  <- isdlc.md build handler        [lines 671, 695]
  <- test-three-verb-utils.test.cjs [18 direct call sites]

computeStartPhase()
  <- isdlc.md build handler        [line 627, Step 4a]
  <- test-three-verb-utils.test.cjs [25 direct call sites]
```

#### Inward Dependencies (code that modified files depend on)

```
isdlc.md analyze handler
  -> readMetaJson()                 [three-verb-utils.cjs]
  -> writeMetaJson()                [three-verb-utils.cjs]
  -> deriveAnalysisStatus()         [three-verb-utils.cjs]
  -> deriveBacklogMarker()          [three-verb-utils.cjs]
  -> updateBacklogMarker()          [three-verb-utils.cjs]
  -> ANALYSIS_PHASES constant       [three-verb-utils.cjs]
  -> NEW: parseSizingFromImpactAnalysis()  [common.cjs -- read-only call]
  -> NEW: computeSizingRecommendation()    [common.cjs -- read-only call]
  -> NEW: extractFallbackSizingMetrics()   [common.cjs -- read-only call]

three-verb-utils.cjs
  -> fs, path (Node.js stdlib)
  -> ANALYSIS_PHASES constant       [internal]
```

#### Change Propagation Paths

1. **deriveAnalysisStatus() signature change** (FR-007): Adding optional `sizingDecision` parameter.
   - Direct caller: `writeMetaJson()` at line 270 -- MUST be updated to pass `meta.sizing_decision` (FR-008).
   - Direct caller: `isdlc.md` analyze handler at line 591 -- calls `deriveAnalysisStatus(meta.phases_completed)`. Must update to `deriveAnalysisStatus(meta.phases_completed, meta.sizing_decision)`.
   - Backward compatibility: Existing callers that pass only 1 argument continue to work (parameter is optional, defaults to undefined).
   - Test propagation: 14 existing test call sites use 1-arg form. All must continue passing (backward compat). New tests needed for 2-arg form.

2. **writeMetaJson() status derivation** (FR-008): Must change from raw count-based logic to sizing-aware derivation.
   - The inline derivation at lines 266-272 currently duplicates the `deriveAnalysisStatus()` logic. It must delegate to the updated `deriveAnalysisStatus(phasesCompleted, meta.sizing_decision)` instead of inline count.
   - Side effect: Any caller of `writeMetaJson()` that passes a meta object with `sizing_decision` will automatically get correct status derivation.
   - Build handler calls at lines 671, 695 (re-analyze and full restart) clear `phases_completed` and do not set `sizing_decision`, so they are unaffected.

3. **computeStartPhase() sizing-awareness** (FR-009): Must read `meta.sizing_decision` to distinguish intentionally-skipped from incomplete phases.
   - Currently returns `status: 'analyzed'` only when `valid.length === ANALYSIS_PHASES.length` (line 378 -- checks for 5).
   - Must add a new branch: if `valid.length < 5` BUT `meta.sizing_decision.effective_intensity === 'light'` AND the missing phases are exactly the `light_skip_phases`, return `status: 'analyzed'`.
   - Build handler at line 627 passes meta directly, so the sizing_decision field is already available.
   - Test propagation: 25 existing test call sites use meta without `sizing_decision`. All must continue passing.

4. **analyze handler modification** (FR-001, FR-002, FR-003, FR-006): The largest change. Inserts a new sizing decision block between step 7 (after Phase 02 completes) and step 8 (after final phase).
   - The sizing block must: read impact-analysis.md, parse metrics, compute recommendation, present menu, record decision in meta.json.
   - It reuses 3 pure functions from common.cjs as read-only calls.
   - It must NOT call `applySizingDecision()` (which mutates state.json).
   - It must add `-light` flag parsing to the analyze command (currently no flag parsing exists for analyze).

### Files NOT Affected (Confirmed Exclusions)

| File | Reason |
|------|--------|
| `src/claude/agents/quick-scan/quick-scan-agent.md` | Documentation-only update deferred (out of scope per requirements) |
| `src/claude/agents/impact-analysis/impact-analyzer.md` | No logic change needed (orchestrator skips delegation) |
| `src/claude/agents/03-system-designer.md` | Not delegated to when light sizing selected (no change needed) |
| `src/claude/agents/impact-analysis/cross-validation-verifier.md` | Not affected by sizing logic |
| `src/claude/CLAUDE.md.template` | Documentation deferred |

---

## Entry Points (M2)

### Existing Entry Points Affected

| # | Entry Point | Location | Change Required |
|---|-------------|----------|-----------------|
| 1 | `/isdlc analyze "item"` | isdlc.md:563-600 | Insert sizing decision point after Phase 02 (between step 7 iterations) |
| 2 | `/isdlc build "item"` (auto-detection) | isdlc.md:622-732 (Step 4a) | `computeStartPhase()` must recognize light-sized meta.json |
| 3 | `writeMetaJson(slugDir, meta)` | three-verb-utils.cjs:259-275 | Status derivation must use sizing-aware logic |
| 4 | `deriveAnalysisStatus(phasesCompleted)` | three-verb-utils.cjs:151-163 | New optional `sizingDecision` parameter |
| 5 | `computeStartPhase(meta, workflowPhases)` | three-verb-utils.cjs:351-414 | Read `meta.sizing_decision` for light-sized detection |

### New Entry Points Required

| # | Entry Point | Location | Purpose |
|---|-------------|----------|---------|
| 1 | `/isdlc analyze -light "item"` | isdlc.md:563+ | New flag-based shortcut to auto-accept light sizing |
| 2 | Analyze flag parsing block | isdlc.md:~570 (new step 2.5) | Parse `-light` flag from analyze command arguments |
| 3 | Sizing decision block in analyze | isdlc.md:~596 (new step 7.5) | After Phase 02 completes, invoke sizing flow |

### Implementation Chain (Entry to Data)

```
User: /isdlc analyze -light "item"
  |
  v
[1] isdlc.md: Parse "-light" flag from args  (NEW -- FR-006, AC-006a, AC-006e)
  |
  v
[2] isdlc.md: resolveItem() -> readMetaJson()  (EXISTING -- no change)
  |
  v
[3] isdlc.md: Phase loop executes 00 -> 01 -> 02  (EXISTING -- no change)
  |
  v
[4] isdlc.md: Phase 02 completes -> sizing trigger check  (NEW -- FR-001)
  |  Check: phase_key === '02-impact-analysis' AND !meta.sizing_decision
  |
  v
[5a] IF -light flag: auto-accept light, display forced banner  (NEW -- FR-006)
[5b] ELSE: read impact-analysis.md  (NEW -- FR-002)
  |     -> parseSizingFromImpactAnalysis(content)  [common.cjs, READ-ONLY]
  |     -> IF null: extractFallbackSizingMetrics()  [common.cjs, READ-ONLY]
  |     -> computeSizingRecommendation(metrics, thresholds)  [common.cjs, READ-ONLY]
  |     -> Present sizing menu: [A] Accept / [O] Override / [S] Show analysis
  |
  v
[6] Build sizing_decision record  (NEW -- FR-005)
  |  Write to meta.json via writeMetaJson()  (NOT applySizingDecision)
  |
  v
[7a] IF light: skip phases 03, 04 -> "Analysis complete (light)"  (NEW -- FR-003)
[7b] IF standard: continue phases 03, 04 normally  (EXISTING -- FR-004)
  |
  v
[8] GitHub label sync fires at "Analysis complete" exit  (EXISTING -- FR-010, no change needed)
```

### Recommended Implementation Order

| Order | Component | Rationale |
|-------|-----------|-----------|
| 1 | `deriveAnalysisStatus()` signature update | Foundation -- all other changes depend on correct status derivation |
| 2 | `writeMetaJson()` sizing-aware derivation | Depends on updated `deriveAnalysisStatus()`; enables meta.json writes with correct status |
| 3 | `computeStartPhase()` light-sizing recognition | Depends on `sizing_decision` schema in meta.json; enables build-side recognition |
| 4 | Test coverage for steps 1-3 | Verify utility changes before handler integration |
| 5 | Analyze handler: flag parsing (`-light`) | Foundation for handler changes |
| 6 | Analyze handler: sizing decision block | Uses updated utilities + pure functions from common.cjs |
| 7 | Integration tests | End-to-end sizing flow validation |

---

## Risk Assessment (M3)

### Test Coverage Analysis

| File | Existing Tests | Coverage Assessment | Risk |
|------|---------------|---------------------|------|
| `three-verb-utils.cjs: deriveAnalysisStatus()` | 8 tests in test-three-verb-utils.test.cjs (lines 207-230) | HIGH coverage for 1-arg form. ZERO coverage for 2-arg form (new). | MEDIUM -- new parameter path untested |
| `three-verb-utils.cjs: writeMetaJson()` | 10 tests in test-three-verb-utils.test.cjs (lines 418-510) | HIGH coverage for current logic. ZERO coverage for sizing_decision preservation. | MEDIUM -- new derivation path untested |
| `three-verb-utils.cjs: computeStartPhase()` | 25 tests in test-three-verb-utils.test.cjs (lines 1751-2090) | HIGH coverage for 5-phase analyzed, partial, raw cases. ZERO coverage for light-sizing "analyzed with 3 phases" case. | MEDIUM -- new branch untested |
| `common.cjs: parseSizingFromImpactAnalysis()` | Tested indirectly via sizing-consent.test.cjs | MODERATE. Pure function, no new changes needed. | LOW -- read-only usage |
| `common.cjs: computeSizingRecommendation()` | Tested indirectly | MODERATE. Pure function, no new changes needed. | LOW -- read-only usage |
| `common.cjs: extractFallbackSizingMetrics()` | 11 tests in sizing-consent.test.cjs (TC-01 through TC-08d) | HIGH. All paths tested. | LOW -- read-only usage |
| `common.cjs: applySizingDecision()` | 6 tests in sizing-consent.test.cjs (TC-09 through TC-12c) | HIGH for build context. NOT APPLICABLE to analyze (must NOT be called). | LOW -- verify it is NOT called |
| `isdlc.md: analyze handler` | 0 unit tests (behavior encoded in markdown, not testable) | ZERO. Analyze handler logic is in agent instructions, not executable code. | LOW -- integration-tested via manual/workflow runs |
| `workflows.json: sizing config` | Referenced in existing tests | Config is verified to exist: `light_skip_phases: ["03-architecture", "04-design"]` at line 49. | LOW -- no change needed |

### Complexity Hotspots

| Rank | Location | Cyclomatic Complexity | Concern |
|------|----------|----------------------|---------|
| 1 | `computeStartPhase()` (three-verb-utils.cjs:351-414) | HIGH (5 branches: null/raw/analyzed/partial + warnings) | Adding a 6th branch for light-sizing increases complexity. Risk of regression in existing analyzed/partial paths. |
| 2 | `writeMetaJson()` (three-verb-utils.cjs:259-275) | LOW-MEDIUM (inline derivation) | Replacing inline derivation with function call reduces complexity but changes behavior. Must verify backward compat. |
| 3 | Analyze handler sizing block (isdlc.md:~596) | HIGH (new: metrics parsing, fallback chain, menu presentation, decision recording) | This is the largest new code section. Risk of divergence from build-side sizing logic. |
| 4 | `deriveAnalysisStatus()` (three-verb-utils.cjs:151-163) | LOW (3 branches) | Adding optional parameter is straightforward. Main risk is callers passing wrong types. |

### Technical Debt Markers

| Location | Debt Type | Impact on Feature |
|----------|-----------|-------------------|
| `writeMetaJson()` line 266-272 duplicates `deriveAnalysisStatus()` logic | Code duplication | Must be resolved as part of FR-008. Replace inline logic with function call. |
| `computeStartPhase()` hardcoded `ANALYSIS_PHASES.length` check at line 378 | Magic number | Must be made sizing-aware. Consider extracting "effective required phases" helper. |
| Analyze handler has no flag parsing step | Missing feature | FR-006 requires adding flag parsing. Consider extracting shared flag parser from feature handler (lines 265-270). |
| `applySizingDecision()` tightly coupled to state.json | Architectural constraint | Cannot be reused for analyze context. New meta.json write path needed (CON-002). |

### Risk Matrix

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Regression in `deriveAnalysisStatus()` breaks existing 5-phase "analyzed" detection | HIGH | LOW | Optional parameter with undefined default preserves all existing behavior. Add regression tests. |
| Regression in `computeStartPhase()` breaks build auto-detection for fully analyzed items | HIGH | LOW | New branch is additive (checked before existing branches). Existing 25 tests validate current paths. |
| `writeMetaJson()` derivation change causes incorrect status for non-sizing meta.json files | HIGH | LOW | When `sizing_decision` is undefined, `deriveAnalysisStatus(phases, undefined)` must return same result as `deriveAnalysisStatus(phases)`. |
| Analyze handler accidentally calls `applySizingDecision()` | MEDIUM | LOW | Code review checkpoint. Add comment/guard in analyze sizing block. NFR-001 constraint. |
| Sizing menu UX diverges from build-side menu | LOW | MEDIUM | Copy banner format and menu structure from STEP 3e-sizing (lines 1517-1565). |
| `-light` flag not parsed correctly in analyze | LOW | LOW | Extract flag parsing pattern from feature handler (line 266) into analyze handler. |
| meta.json `sizing_decision` field not preserved across readMetaJson/writeMetaJson round-trip | MEDIUM | LOW | `readMetaJson()` does not strip unknown fields. `writeMetaJson()` must not delete `sizing_decision`. Add round-trip test. |

### Recommended Test Additions (Before Implementation)

| Priority | Test | File | Covers |
|----------|------|------|--------|
| P0 | `deriveAnalysisStatus([00,01,02], { effective_intensity: 'light', light_skip_phases: [03,04] })` returns `'analyzed'` | test-three-verb-utils.test.cjs | FR-007 AC-007b |
| P0 | `deriveAnalysisStatus([00,01,02], null)` returns `'partial'` (backward compat) | test-three-verb-utils.test.cjs | FR-007 AC-007c |
| P0 | `deriveAnalysisStatus([00,01,02], undefined)` returns `'partial'` (backward compat) | test-three-verb-utils.test.cjs | FR-007 AC-007c |
| P0 | `writeMetaJson()` with `sizing_decision` field preserves it and derives correct status | test-three-verb-utils.test.cjs | FR-008 AC-008a, AC-008b |
| P0 | `writeMetaJson()` without `sizing_decision` field derives same status as before | test-three-verb-utils.test.cjs | NFR-002 AC-NFR-002b |
| P0 | `computeStartPhase()` with light-sized meta (3 phases + sizing_decision) returns `status: 'analyzed'` | test-three-verb-utils.test.cjs | FR-009 AC-009a, AC-009b |
| P0 | `computeStartPhase()` with light-sized meta returns `startPhase: '05-test-strategy'` | test-three-verb-utils.test.cjs | FR-009 AC-009b |
| P0 | `computeStartPhase()` with light-sized meta returns `remainingPhases` excluding 03, 04 | test-three-verb-utils.test.cjs | FR-009 AC-009d |
| P0 | `computeStartPhase()` without `sizing_decision` returns same results as before | test-three-verb-utils.test.cjs | NFR-002 AC-NFR-002d |
| P1 | meta.json round-trip: write `sizing_decision`, read back, verify preserved | test-three-verb-utils.test.cjs | FR-005 AC-005a |
| P1 | `sizing_decision.context === 'analyze'` in written record | sizing-consent.test.cjs | FR-005 AC-005b |

---

## Implementation Recommendations

Based on the impact analysis:

1. **Suggested Order**: Start with utility function changes (deriveAnalysisStatus -> writeMetaJson -> computeStartPhase), add tests, then modify the analyze handler. This bottom-up approach ensures each layer is validated before the integration layer depends on it.

2. **High-Risk Areas -- Add Tests First**:
   - `computeStartPhase()` light-sizing branch (highest regression risk, 25 existing tests to protect)
   - `deriveAnalysisStatus()` 2-arg form (signature change affects all callers)
   - `writeMetaJson()` sizing-aware derivation (behavior change in widely-used utility)

3. **Dependencies to Resolve**:
   - FR-007 (`deriveAnalysisStatus` signature) must complete before FR-008 (`writeMetaJson` derivation)
   - FR-008 must complete before FR-005 (meta.json sizing_decision write) -- status derivation must be correct
   - FR-009 (`computeStartPhase`) is independent of FR-001/FR-002 but depends on the `sizing_decision` schema
   - FR-001/FR-002 (analyze handler) depends on ALL utility changes being complete

4. **Key Design Constraint**: The analyze sizing path must write `sizing_decision` to meta.json via a direct `writeMetaJson()` call with the record pre-built. It must NOT call `applySizingDecision()` from common.cjs, which mutates `state.active_workflow`. This is constraint CON-002.

5. **Reuse Opportunity**: The sizing menu presentation logic (banner format, user menu, [A]/[O]/[S] options) should be described in the analyze handler using the same structure as build STEP 3e-sizing (lines 1501-1565 of isdlc.md). Whether to extract a shared helper or inline is a Phase 03 design decision.

---

## Impact Analysis Metadata

The following JSON block is required for automated sizing analysis (REQ-0011).
All fields are required. The `parseSizingFromImpactAnalysis()` function reads
the LAST JSON block in the file to extract sizing metrics.

```json
{
  "analysis_completed_at": "2026-02-19T23:00:00Z",
  "sub_agents": ["M1", "M2", "M3"],
  "requirements_document": "docs/requirements/sizing-in-analyze-GH-57/requirements-spec.md",
  "quick_scan_used": "docs/requirements/sizing-in-analyze-GH-57/quick-scan.md",
  "scope_change_from_original": "refined",
  "requirements_keywords": ["analyze", "sizing", "meta.json", "sizing_decision", "light_skip_phases", "deriveAnalysisStatus", "computeStartPhase", "writeMetaJson"],
  "files_directly_affected": 9,
  "modules_affected": 4,
  "risk_level": "medium",
  "blast_radius": "medium",
  "coverage_gaps": 0
}
```

**`coverage_gaps` derivation**: All 9 affected files have existing test coverage. The 3 core utility functions in three-verb-utils.cjs have 184 passing tests. The sizing functions in common.cjs have 17 passing tests. The analyze handler (isdlc.md) is not unit-testable (markdown instructions) but is integration-tested via workflow runs. No files have zero coverage; coverage_gaps = 0.
