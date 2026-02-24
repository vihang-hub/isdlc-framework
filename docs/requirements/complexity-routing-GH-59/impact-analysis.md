# Impact Analysis: Complexity-Based Routing (GH-59)

**Generated**: 2026-02-19
**Feature**: Impact Analysis (Phase 02) produces metrics used to compute workflow tier (trivial/light/standard/epic); trivial tier provides a direct-edit path with audit trail but no workflow machinery.
**Based On**: Phase 01 Requirements Specification (finalized -- 9 FRs, 5 NFRs, 33 ACs)
**Phase**: 02-impact-analysis (ANALYSIS MODE -- no state.json writes, no branches)

---

## Scope Comparison

| Aspect | Original (Phase 00) | Clarified (Phase 01) |
|--------|---------------------|----------------------|
| Description | Impact Analysis metrics produce workflow tier recommendation including "trivial" direct-edit path | Tier scoring algorithm with risk adjustment, tier menu in build handler, trivial execution path with change-record.md audit trail, tier descriptions utility |
| Keywords | tier, trivial, complexity, routing, recommended, scope, impact-analysis, analyze, build, meta.json, parseSizingFromImpactAnalysis, light | computeRecommendedTier, getTierDescription, recommended_tier, tier_override, tier_used, last_trivial_change, change-record.md, tier_thresholds, workflows.json |
| Estimated Files | ~28-35 files | 6 core files + 3-5 test files + 2-3 indirect = 11-14 files (refined -- see rationale below) |
| Scope Change | - | REFINED: core implementation is narrower than estimated; CON-001 eliminates new agent, CON-003 defers epic, trivial path is inline in isdlc.md |

**Scope refinement rationale**: The Phase 00 estimate of 28-35 files included test files counted individually and speculative changes to dispatchers, gate-blocker, and state-write-validator. The finalized requirements (CON-001, CON-003, NFR-005) confirm: no new agents, no gate-blocker changes, no state.json pollution. The core implementation touches 6 files with 3-5 test files.

---

## Executive Summary

This feature adds a tier-computation step after Phase 02 (impact analysis) in the analyze handler, using actual blast radius metrics to recommend a workflow tier, plus a tier-selection menu in the build handler and a new trivial-tier execution path for 1-2 file changes. The blast radius is **MEDIUM**: 5 core files span 3 modules (command handler, utility libraries, config) plus test files. The critical coupling point is `three-verb-utils.cjs`, which gains 2 new exported functions (`computeRecommendedTier`, `getTierDescription`) consumed by the isdlc.md command handler. The highest risk area is the trivial execution path in `isdlc.md` (build handler step 4a), which must correctly bypass all workflow machinery while preserving audit trail -- and the build handler is already the most complex section of isdlc.md (~500 lines for steps 4a-4e alone). The `three-verb-utils.cjs` changes carry moderate risk due to the file's position as a shared utility consumed by multiple hooks and the command handler.

**Blast Radius**: MEDIUM (11-14 files, 4 modules)
**Risk Level**: MEDIUM
**Affected Files**: 11-14
**Affected Modules**: 4 (isdlc.md command handler, three-verb-utils, workflows.json config, test suite)

---

## Impact Analysis

### M1: Files Directly Affected by Each Acceptance Criterion

#### File 1: `src/claude/hooks/lib/three-verb-utils.cjs` (847 lines)
**Change Type**: MODIFY -- add 2 new exported functions + 1 constant
**Acceptance Criteria**: AC-002a, AC-002b, AC-002c, AC-002d, AC-009a, AC-009b
**Changes Required**:
- Add `TIER_THRESHOLDS` constant (default thresholds: trivial<=2, light<=8, standard<=20, epic>20)
- Add `computeRecommendedTier(estimatedFiles, riskLevel)` pure function (~40 lines)
  - Base thresholds from config with hardcoded defaults (CON-002)
  - Risk-based promotion: medium/high risk promotes tier by one level (AC-002b)
  - Defensive defaults: null/invalid estimatedFiles returns "standard" (AC-002c)
  - Unrecognized riskLevel treated as "low" (AC-002d)
- Add `getTierDescription(tier)` utility function (~25 lines)
  - Returns `{ label, description, fileRange }` for each tier (AC-009a)
  - Unknown tier returns default object (AC-009b)
- Update `module.exports` to include both new functions

**Outward Dependencies** (files that import from three-verb-utils.cjs):
- `src/claude/commands/isdlc.md` -- references utility functions inline (not require(), but agent reads file)
- `src/claude/hooks/tests/test-three-verb-utils.test.cjs` -- require() for testing
- *(quick-scan-agent.md is NOT an outward dependency -- tier is computed in the analyze handler, not the agent)*

**Inward Dependencies** (files three-verb-utils.cjs depends on):
- `fs`, `path` (Node built-ins)
- No dependency on `common.cjs` (the two utility files are independent)

**Estimated Lines Changed**: +80-100 lines (new functions + exports)

---

#### File 2: `src/claude/commands/isdlc.md` (~1700 lines)
**Change Type**: MODIFY -- 3 insertion points
**Acceptance Criteria**: AC-004a, AC-004b, AC-004c, AC-005a-e, AC-006a-e, AC-007a-d, AC-008a-c, AC-NFR-001a-c, AC-NFR-004a-c, AC-NFR-005a-c

**Insertion Point A: Analyze handler step 8** (line ~597)
- After "Analysis complete. {slug} is ready to build."
- Read `recommended_tier` from meta.json
- If present: append "Recommended tier: {tier} -- {description}" using `getTierDescription()` (AC-004a)
- If absent: omit tier line entirely (AC-004b)
- Estimated: +8-12 lines

**Insertion Point B: Build handler new step 4a-tier** (between current step 4 and step 4a)
- Read `recommended_tier` from meta.json (already loaded in step 4)
- Present tier selection menu with RECOMMENDED marker (AC-005a)
- Default to recommended tier on Enter (AC-005b)
- Default to "standard" if no recommendation in meta.json (AC-005c)
- Route trivial selection to trivial execution path (AC-005d)
- Record tier_override in meta.json if user overrides (AC-005e)
- Always present menu, never auto-execute (AC-NFR-001a)
- `--trivial` flag still requires confirmation (AC-NFR-001b)
- Estimated: +40-60 lines

**Insertion Point C: Trivial tier execution path** (new section after step 4a-tier)
- Skip workflow creation, branch, gates, state.json (AC-006a, AC-NFR-005a-c)
- Read requirements from slug folder (AC-006b)
- Make edit on current branch (AC-006b)
- Commit with slug in message (AC-006c)
- Write change-record.md (AC-006d, AC-007a-c)
- Update meta.json with tier_used, last_trivial_change (AC-007c)
- Update BACKLOG.md marker (AC-007d)
- Display completion summary (AC-006d)
- Handle errors without writing change record (AC-006e)
- Estimated: +80-120 lines

**Outward Dependencies** (what depends on isdlc.md):
- All users of `/isdlc` command -- this is the entry point for all workflows
- `src/claude/agents/00-sdlc-orchestrator.md` -- references isdlc.md for verb handling

**Inward Dependencies** (what isdlc.md depends on):
- `three-verb-utils.cjs` -- utility functions (readMetaJson, writeMetaJson, etc.)
- `common.cjs` -- readState, writeState (but NOT for trivial path per NFR-005)
- `workflows.json` -- phase definitions, sizing config, NEW: tier_thresholds

**Estimated Lines Changed**: +130-190 lines across 3 insertion points

---

#### File 3: `src/claude/agents/quick-scan/quick-scan-agent.md` (318 lines)
**Change Type**: NO CHANGE
**Rationale**: The tier is now computed from Phase 02 impact analysis metrics, not Phase 00 quick scan estimates. The quick scan agent continues to produce scope estimates as before -- no modifications needed. The analyze handler in isdlc.md computes the tier after Phase 02 completes using `parseSizingFromImpactAnalysis()` and `computeRecommendedTier()`.

---

#### File 4: `src/isdlc/config/workflows.json` (378 lines)
**Change Type**: MODIFY -- add tier_thresholds config block
**Acceptance Criteria**: CON-002 (tier thresholds are configuration, not code)

**Changes Required**:
- Add `tier_thresholds` block under `workflows.feature`:
  ```json
  "tier_thresholds": {
    "trivial_max_files": 2,
    "light_max_files": 8,
    "standard_max_files": 20
  }
  ```
- This is read by `computeRecommendedTier()` with hardcoded defaults as fallback (CON-002)

**Outward Dependencies** (what reads workflows.json):
- `common.cjs` via `loadWorkflowDefinitions()` -- used by hooks
- `isdlc.md` -- reads phases, sizing config
- `three-verb-utils.cjs` -- will need to accept thresholds as parameter (pure function design)

**Inward Dependencies**: None (static config file)

**Estimated Lines Changed**: +6-8 lines

---

#### File 5: `src/claude/hooks/lib/common.cjs` (3568 lines)
**Change Type**: MINIMAL MODIFY -- meta.json field handling
**Acceptance Criteria**: AC-003a, AC-003b, AC-NFR-002a-c

**Changes Required**:
- `readMetaJson()` already handles missing fields gracefully (returns raw object) -- AC-003b is satisfied by existing behavior (missing `recommended_tier` returns undefined, not error)
- `writeMetaJson()` -- no changes needed; it writes whatever fields are in the meta object
- The key question: does `readMetaJson()` need explicit handling for `recommended_tier`? **No** -- the defensive defaults in lines 229-241 only apply to `analysis_status`, `phases_completed`, `source`, and `created_at`. New fields like `recommended_tier` are passed through as-is, and `null`/`undefined` is acceptable per AC-003b.
- `computeStartPhase()` -- no changes needed per AC-NFR-002c (tier fields are independent of start phase computation)

**Assessment**: common.cjs requires **zero code changes** for backward compatibility. The existing defensive defaults pattern naturally handles the absence of new meta.json fields. However, if the team wants explicit documentation of tier fields in the code, a comment block could be added near `readMetaJson()`.

**Estimated Lines Changed**: 0 (possibly +5 lines for documentation comments)

---

#### File 6: `src/claude/hooks/tests/test-three-verb-utils.test.cjs` (2223 lines)
**Change Type**: MODIFY -- add new test suites
**Acceptance Criteria**: AC-002a-d, AC-009a-b (FR-002, FR-009 tests)

**New Test Suites Required**:
1. `describe('computeRecommendedTier()')` -- 15-20 test cases:
   - Base thresholds: 1 file -> trivial, 2 -> trivial, 3 -> light, 8 -> light, 9 -> standard, 20 -> standard, 21 -> epic
   - Risk promotion: trivial + medium risk -> light, light + high risk -> standard, standard + high risk -> epic
   - Defensive: null estimatedFiles -> standard, NaN -> standard, negative -> standard, 0 -> trivial
   - Unknown riskLevel -> treated as low (no promotion)
   - Edge cases: exactly at thresholds (2, 8, 20)

2. `describe('getTierDescription()')` -- 6-8 test cases:
   - All four valid tiers return correct { label, description, fileRange }
   - Unknown tier returns default object
   - null/undefined tier returns default

**Estimated Lines Changed**: +150-200 lines

---

### Additional Files (Indirect/Minimal Impact)

#### File 7: `src/claude/hooks/gate-blocker.cjs`
**Change Type**: NO CHANGE
**Rationale**: Per NFR-005, the trivial tier never triggers gate validation. The gate-blocker only fires when `active_workflow` exists in state.json, and the trivial path never creates one (AC-006a). No tier-aware logic needed.

#### File 8: `src/claude/hooks/state-write-validator.cjs`
**Change Type**: NO CHANGE
**Rationale**: Per NFR-005, the trivial tier never writes to state.json. The state-write-validator fires on state.json write attempts, but the trivial path makes none.

#### File 9: `src/claude/hooks/phase-loop-controller.cjs`
**Change Type**: NO CHANGE
**Rationale**: The trivial tier bypasses the Phase-Loop Controller entirely (AC-006a). The controller is only invoked for non-trivial tiers, which route through the existing build flow unchanged.

#### File 10: `src/claude/agents/00-sdlc-orchestrator.md`
**Change Type**: NO CHANGE
**Rationale**: The orchestrator delegates to isdlc.md verb handlers. The tier menu and trivial path are handled in isdlc.md before the orchestrator is invoked. For non-trivial tiers, the existing delegation chain is unchanged.

#### File 11: `src/claude/hooks/tests/sizing-consent.test.cjs` (existing, 400+ lines)
**Change Type**: POSSIBLE EXTENSION
**Rationale**: The existing sizing tests verify `applySizingDecision()` and `extractFallbackSizingMetrics()`. Per CON-004, tier recommendation and sizing are complementary. If the user selects a non-trivial tier, the existing sizing flow still runs at 3e-sizing. No changes needed to existing tests, but new integration test cases may validate that tier selection feeds correctly into the sizing menu.
**Estimated**: 0-10 lines (optional integration assertion)

---

### Dependency Coupling Map

```
                    +------------------+
                    | workflows.json   |
                    | (tier_thresholds)|
                    +--------+---------+
                             |
                    reads thresholds
                             |
                             v
                          +------------------------+     +---------------------+
                          | three-verb-utils.cjs   |     | isdlc.md            |
                          | computeRecommendedTier |     | (analyze handler:   |
                          | getTierDescription     |<----+  after Phase 02,    |
                          |                        |     |  compute tier from  |
                          +--------+---------------+     |  IA metrics via     |
                                   |                     |  parseSizingFrom    |
                          existing |                     |  ImpactAnalysis()   |
                          functions|                     |                     |
                                   |                     | build handler:      |
                                   v                     |  step 4a-tier +     |
                          +--------+---------+           |  trivial path)      |
                          | test-three-verb- |           +----------+----------+
                          | utils.test.cjs   |                      |
                          | (new test suites)|            writes meta.json
                          +------------------+            writes change-record.md
                                                                    |
                                                                    v
                                                          +-------------------+
                                                          | docs/requirements/|
                                                          | {slug}/           |
                                                          | meta.json         |
                                                          | change-record.md  |
                                                          +-------------------+
```

### Change Propagation Paths

**Path 1: Tier Recommendation (Phase 02 -> IA metrics -> meta.json -> analyze display)**
```
Phase 02 agent produces impact-analysis.md
  -> isdlc.md analyze handler calls parseSizingFromImpactAnalysis() to extract metrics
  -> calls computeRecommendedTier(metrics.file_count, metrics.risk_score, thresholds)
  -> writes recommended_tier to meta.json (via writeMetaJson)
  -> isdlc.md analyze handler step 8 reads and displays tier
```

**Path 2: Tier Selection (meta.json -> build menu -> execution)**
```
isdlc.md build handler step 4 (readMetaJson)
  -> NEW step 4a-tier: read recommended_tier, present menu
  -> IF trivial selected: trivial execution path (inline in isdlc.md)
    -> write change-record.md, update meta.json, update BACKLOG.md
  -> ELSE: fall through to existing step 4a (computeStartPhase) unchanged
```

**Path 3: Tier Scoring (workflows.json -> three-verb-utils -> isdlc.md)**
```
workflows.json (tier_thresholds config)
  -> computeRecommendedTier(files, risk) reads thresholds
  -> returns tier string
  -> consumed by isdlc.md analyze handler (after Phase 02)
```

---

## Entry Points

### Existing Entry Points Affected

#### Entry Point 1: `/isdlc analyze {item}` -- Analyze Handler Step 8
**File**: `src/claude/commands/isdlc.md`, line ~597
**Current Behavior**: Displays "Analysis complete. {slug} is ready to build."
**New Behavior**: Appends tier recommendation line if `recommended_tier` exists in meta.json
**ACs**: AC-004a, AC-004b, AC-004c
**Risk**: LOW -- additive change, existing message preserved, graceful degradation for missing tier

#### Entry Point 2: `/isdlc build {item}` -- Build Handler Step 4
**File**: `src/claude/commands/isdlc.md`, line ~620
**Current Behavior**: Step 4 reads meta.json, step 4a computes start phase
**New Behavior**: NEW step 4a-tier inserted between step 4 (meta read) and step 4a (computeStartPhase)
**ACs**: AC-005a-e, AC-006a-e, AC-008a-c
**Risk**: HIGH -- this is the most complex insertion point; must correctly interleave with existing 4a-4e flow

#### Entry Point 3: Analyze Handler After Phase 02 (Tier Computation)
**File**: `src/claude/commands/isdlc.md`, analyze handler phase loop
**Current Behavior**: After Phase 02 completes, updates meta.json with phases_completed
**New Behavior**: Additionally reads impact-analysis.md via `parseSizingFromImpactAnalysis()`, computes `recommended_tier` using `computeRecommendedTier()`, and persists to meta.json
**ACs**: AC-001a, AC-001b, AC-001c
**Risk**: LOW -- additive step in existing phase loop, uses existing parsing infrastructure

### New Entry Points Required

#### Entry Point 4: Trivial Tier Execution Path
**File**: `src/claude/commands/isdlc.md` (new section within build handler)
**Triggered By**: User selects `[1] Trivial` in tier menu
**Behavior**: Direct edit, commit, write change-record.md, update meta.json + BACKLOG.md
**ACs**: AC-006a-e, AC-007a-d, AC-NFR-003a-c, AC-NFR-004a-c, AC-NFR-005a-c
**Risk**: HIGH -- entirely new execution path that must correctly avoid all workflow machinery

#### Entry Point 5: `computeRecommendedTier(estimatedFiles, riskLevel)` -- New Utility
**File**: `src/claude/hooks/lib/three-verb-utils.cjs`
**Called By**: isdlc.md analyze handler (after Phase 02 completes)
**Behavior**: Pure function returning tier string
**ACs**: AC-002a-d
**Risk**: LOW -- pure function, well-tested, no side effects

#### Entry Point 6: `getTierDescription(tier)` -- New Utility
**File**: `src/claude/hooks/lib/three-verb-utils.cjs`
**Called By**: isdlc.md analyze handler step 8, build handler step 4a-tier
**Behavior**: Pure function returning `{ label, description, fileRange }`
**ACs**: AC-009a-b
**Risk**: LOW -- pure function, single source of truth for tier display strings

### Implementation Chain

```
Data layer:     workflows.json (config)
                    |
Utility layer:  three-verb-utils.cjs (computeRecommendedTier, getTierDescription)
                    |
Handler layer:  isdlc.md analyze handler (after Phase 02 -- compute tier from IA metrics)
                isdlc.md analyze handler (Step 8 -- display)
                isdlc.md build handler (Step 4a-tier -- menu + routing)
                isdlc.md build handler (Trivial path -- execute + record)
                    |
Persistence:    meta.json (recommended_tier, tier_used, tier_override, last_trivial_change)
                change-record.md (trivial audit trail)
                BACKLOG.md (marker update)
```

### Recommended Implementation Order

1. **`workflows.json`** -- Add `tier_thresholds` config block (trivial, no dependencies)
2. **`three-verb-utils.cjs`** -- Add `computeRecommendedTier()` + `getTierDescription()` (pure functions, testable immediately)
3. **`test-three-verb-utils.test.cjs`** -- Add test suites for both new functions (TDD: write tests first or alongside)
4. **`isdlc.md` analyze handler** -- After Phase 02: compute tier from IA metrics, persist to meta.json; Step 8: tier display
5. **`isdlc.md` build handler** -- Step 4a-tier menu + trivial execution path (most complex, depends on all above)

Rationale: Bottom-up. Pure functions first (testable), handlers last (consume data). The trivial execution path in the build handler is the riskiest piece and should be implemented last so that all supporting infrastructure is proven.

---

## Risk Assessment

### Risk Matrix: Per-File Risk Assessment

| File | Risk | Probability | Impact | Rationale |
|------|------|-------------|--------|-----------|
| `isdlc.md` (build handler) | **HIGH** | HIGH | HIGH | Most complex file in the project. Build handler steps 4a-4e are already ~500 lines. Inserting tier menu + trivial path adds 130-190 lines of branching logic. Incorrect insertion disrupts existing computeStartPhase, staleness check, and sizing flows. |
| `isdlc.md` (analyze handler) | **LOW** | LOW | LOW | 2-line addition after existing output. Graceful null handling. No flow disruption. |
| `three-verb-utils.cjs` | **MEDIUM** | MEDIUM | MEDIUM | Shared utility file. New functions are pure and isolated, but incorrect exports or naming could break existing consumers. File is 847 lines with 26 existing tests suites -- well-tested baseline. |
| *(quick-scan-agent.md)* | **NONE** | - | - | No changes required. Tier is computed from Phase 02 IA metrics in the analyze handler, not the quick scan agent. |
| `workflows.json` | **LOW** | LOW | MEDIUM | Static config addition. Risk: if schema is wrong, `computeRecommendedTier()` falls back to hardcoded defaults (CON-002). Impact: config misread could cause wrong tier recommendations. |
| `common.cjs` | **NONE** | - | - | Zero changes required. Existing defensive defaults handle new meta.json fields. |
| `test-three-verb-utils.test.cjs` | **LOW** | LOW | LOW | New test suites. Risk of incorrect test expectations, but framework testing is TDD so tests validate against ACs. |

### Test Coverage Gaps in Affected Areas

| Affected File | Current Test Coverage | Gap | Recommendation |
|---------------|----------------------|-----|----------------|
| `three-verb-utils.cjs` | **HIGH** (26 describe blocks, 2223 lines of tests) | None for new functions (they don't exist yet) | Add `computeRecommendedTier()` and `getTierDescription()` test suites -- 20-28 new test cases |
| `isdlc.md` (command handler) | **NONE** (agent prompts are not unit-testable) | Tier menu rendering, trivial path execution, meta.json persistence | Manual testing required. Integration tests via `sizing-consent.test.cjs` pattern recommended for meta.json field persistence |
| `workflows.json` | **INDIRECT** via `loadWorkflowDefinitions()` tests | No tests for `tier_thresholds` config block | Add test case in three-verb-utils tests: `computeRecommendedTier` with config-sourced thresholds |
| `common.cjs` | **HIGH** (multiple test files) | None -- no changes needed | No action |

### Complexity Hotspots

1. **`isdlc.md` build handler steps 4-4e** -- Already the most complex procedural section in the codebase. The existing flow is:
   ```
   Step 4: readMetaJson()
   Step 4a: computeStartPhase()
   Step 4b: checkStaleness()
   Step 4c: Handle staleness (menu)
   Step 4d: Handle partial analysis (menu)
   Step 4e: Display BUILD SUMMARY
   Step 5: Parse flags
   ...
   3e-sizing: Sizing decision point
   ```
   The new tier menu (step 4a-tier) must be inserted BEFORE step 4a, because trivial tier short-circuits the entire flow. But it must run AFTER step 4 (readMetaJson). The critical question: **where exactly does the tier menu go relative to staleness checks?**

   **Recommended insertion**: Between step 4 (readMetaJson) and step 4a (computeStartPhase). If trivial is selected, the entire 4a-4e flow is skipped along with steps 5-9. If non-trivial, fall through to the existing flow unchanged.

2. **Trivial execution path state isolation** -- NFR-005 requires the trivial path to never touch state.json. The isdlc.md build handler normally creates `active_workflow` in state.json (step 8 via orchestrator). The trivial path must ensure the orchestrator is never invoked. This is architecturally clean (trivial path short-circuits before orchestrator delegation) but any regression that leaks into the orchestrator path would violate NFR-005.

3. **Tier recommendation vs. sizing decision interaction** -- Per CON-004, these are complementary. The tier (Phase 02, `recommended_tier` in meta.json) determines WHETHER to run a workflow. The sizing (Phase 02, `applySizingDecision()`) determines INTENSITY within the workflow. If the user selects non-trivial tier but the sizing later recommends light, that is correct behavior (tier = "should we have a workflow?" vs sizing = "how heavy?"). However, the overlapping terminology (light tier vs light sizing) could confuse users and developers.

### Technical Debt Markers

1. **isdlc.md is a monolithic file** -- The build handler alone exceeds 400 lines of procedural steps. Adding 130-190 more lines deepens this debt. Future refactoring to separate build handler into a discrete module would reduce risk of regression.

2. **Agent prompt testing gap** -- `isdlc.md` has no automated tests for its procedural behavior. Changes are verified manually or via integration. This is acceptable for prompt-based agents but increases the cost of verifying tier-related changes in the analyze and build handlers.

3. **Sizing terminology overlap** -- The existing `sizing.thresholds.light_max_files` (5 files) differs from the new `tier_thresholds.light_max_files` (8 files). Both use "light" but at different decision points. Documentation should clearly distinguish these.

### Risk Recommendations Per Acceptance Criterion Category

**FR-001 (Impact Analysis Tier Computation)**: LOW RISK -- Additive computation step after Phase 02. Recommend: verify `parseSizingFromImpactAnalysis()` extracts correct metrics for tier scoring.

**FR-002 (Tier Scoring Algorithm)**: LOW RISK -- Pure function with clear thresholds. Recommend: TDD with comprehensive edge cases (boundary values, null inputs).

**FR-003 (Meta.json Persistence)**: LOW RISK -- Uses existing `writeMetaJson()`. Recommend: verify no regression in `readMetaJson()` defensive defaults.

**FR-004 (Analyze Display)**: LOW RISK -- 2-line addition. Recommend: test with and without `recommended_tier` in meta.json.

**FR-005 (Build Tier Menu)**: MEDIUM RISK -- New interactive menu in build handler. Recommend: thorough manual testing of all 4 menu selections + default behavior.

**FR-006 (Trivial Execution)**: HIGH RISK -- New execution path bypassing all workflow machinery. Recommend: add integration test for NFR-005 (state.json untouched), test error handling (AC-006e), test on-current-branch commit behavior.

**FR-007 (Audit Trail)**: MEDIUM RISK -- New file creation (change-record.md). Recommend: test append behavior for multiple trivial edits to same slug (AC-007b), verify ISO-8601 timestamps.

**FR-008 (Override)**: LOW RISK -- Menu selection is inherently user-driven. Recommend: verify `tier_override` in meta.json is correctly structured (AC-005e).

**FR-009 (Tier Descriptions)**: LOW RISK -- Pure lookup function. Recommend: unit tests for all tiers + unknown input.

**NFR-001 (User Agency)**: MEDIUM RISK -- Must never auto-execute. Recommend: explicit assertion that no code path calls trivial execution without user input.

**NFR-002 (Backward Compatibility)**: LOW RISK -- Existing defensive defaults handle missing fields. Recommend: test with pre-existing meta.json that lacks tier fields.

**NFR-005 (No State.json Pollution)**: HIGH RISK -- Critical architectural constraint. Recommend: integration test that captures state.json before and after trivial execution, asserts byte-identical.

---

## Implementation Recommendations

Based on the impact analysis:

1. **Suggested Order**: workflows.json -> three-verb-utils.cjs (functions + tests) -> isdlc.md (analyze handler: tier computation after Phase 02 + step 8 display) -> isdlc.md (build step 4a-tier + trivial path)

2. **High-Risk Areas -- Add Tests First**:
   - Write `computeRecommendedTier()` tests BEFORE implementing the function (TDD)
   - Write meta.json field persistence tests (recommended_tier, tier_override, tier_used) before modifying isdlc.md
   - Write state.json isolation test (NFR-005) before implementing trivial path

3. **Dependencies to Resolve**:
   - Clarify where `computeRecommendedTier()` reads thresholds from: the function should accept thresholds as a parameter (pure function), and the CALLER (isdlc.md analyze handler) reads from `workflows.json`. This maintains testability.
   - Confirm the trivial path commit strategy: commit to current branch (ASM-002). If the current branch is protected, the commit will fail -- error handling in AC-006e covers this.

4. **Architectural Note**: The trivial execution path should be implemented as a clearly delimited section in isdlc.md (e.g., a labeled block "--- TRIVIAL TIER EXECUTION ---") to make future extraction into a separate module feasible. CON-001 says no new agent, but a helper function or labeled block aids readability.

---

## Impact Analysis Metadata

The following JSON block is required for automated sizing analysis (REQ-0011).
All fields are required. The `parseSizingFromImpactAnalysis()` function reads
the LAST JSON block in the file to extract sizing metrics.

```json
{
  "analysis_completed_at": "2026-02-19",
  "sub_agents": ["M1", "M2", "M3"],
  "requirements_document": "docs/requirements/complexity-routing-GH-59/requirements-spec.md",
  "quick_scan_used": "docs/requirements/complexity-routing-GH-59/quick-scan.md",
  "scope_change_from_original": "refined",
  "requirements_keywords": ["computeRecommendedTier", "getTierDescription", "recommended_tier", "tier_override", "tier_used", "trivial", "light", "standard", "epic", "change-record.md", "tier_thresholds", "meta.json"],
  "files_directly_affected": 5,
  "modules_affected": 4,
  "risk_level": "medium",
  "blast_radius": "medium",
  "coverage_gaps": 1
}
```

**`coverage_gaps` derivation**: Of the 5 directly affected files, 1 has no automated test coverage: `isdlc.md` (command handler/agent prompt -- not unit-testable). The remaining 4 files (`three-verb-utils.cjs`, `workflows.json`, `common.cjs`, `test-three-verb-utils.test.cjs`) have existing or planned test coverage. Note: `quick-scan-agent.md` is no longer directly affected (tier is computed from Phase 02 IA metrics in the analyze handler).
