# Impact Analysis: Build Auto-Detection and Seamless Phase 05+ Handoff

**Generated**: 2026-02-19T16:00:00Z
**Validated**: 2026-02-19T19:30:00Z (Phase 02 codebase validation)
**Feature**: Auto-detect analysis progress in backlog items when `/isdlc build` is invoked, skip completed analysis phases, and start the workflow from the appropriate phase
**Based On**: Phase 01 Requirements (finalized)
**Phase**: 02-impact-analysis

---

## Scope Comparison

| Aspect | Original (Phase 00) | Clarified (Phase 01) |
|--------|---------------------|----------------------|
| Description | Auto-detect analysis progress in backlog items and start build workflow from the appropriate phase | Auto-detect analysis status from meta.json, handle fully-analyzed (skip to Phase 05), partially-analyzed (3-option menu), and raw items; staleness detection via codebase hash; phase summary display; orchestrator START_PHASE parameter; artifact folder reuse; meta.json build tracking |
| Keywords | build, analyze, phase, auto-detect, skip, meta.json | build, analyze, phase, auto-detect, skip, meta.json, staleness, codebase_hash, START_PHASE, computeStartPhase, checkStaleness, validatePhasesCompleted, contiguity, artifact_folder |
| Estimated Files | ~12-15 | 7 files (3 MODIFY, 1 MODIFY+extend, 1 MODIFY+relax-rule, 1 MODIFY+extend-tests, 0 CREATE) |
| Scope Change | - | refined (scope is well-contained but deeper than initial estimate in terms of acceptance criteria: 8 FRs with 28 ACs, 6 NFRs) |

---

## Executive Summary

This feature modifies the `/isdlc build` verb to read `meta.json` before delegating to the orchestrator, determine the analysis completion level, and pass a `START_PHASE` parameter so the workflow begins at the correct point. The blast radius is **low-to-medium**: changes are concentrated in 3-4 core files (isdlc.md, three-verb-utils.cjs, 00-sdlc-orchestrator.md, and workflows.json) with a ripple into common.cjs (resetPhasesForWorkflow) and a new test file. No hook files, dispatcher files, or phase agent files are affected. The feature is well-isolated because it modifies only the **initialization path** of the build workflow -- once the workflow is running, the Phase-Loop Controller, hooks, and agents operate unchanged.

**Blast Radius**: low-medium (7 files, 3 modules)
**Risk Level**: medium
**Affected Files**: 7
**Affected Modules**: 3 (command layer, utility layer, orchestrator layer)

---

## Impact Analysis

### M1: File-Level Impact Assessment

#### Files Directly Affected

| # | File | Change Type | FR Traces | Change Description | Lines Est. |
|---|------|------------|-----------|-------------------|------------|
| 1 | `src/claude/commands/isdlc.md` | MODIFY | FR-001, FR-002, FR-003, FR-004, FR-005, FR-007, FR-008 | Build verb handler: insert detection logic between steps 4 and 7. Read meta.json, call computeStartPhase(), call checkStaleness(), display phase summary, present partial-analysis menu, pass START_PHASE + artifact_folder to orchestrator delegation. | ~80-120 lines added/modified |
| 2 | `src/claude/hooks/lib/three-verb-utils.cjs` | MODIFY | FR-001, FR-003, FR-004, FR-006, NFR-006 | Add 3 new exported functions: `computeStartPhase(meta, workflowPhases)`, `checkStaleness(meta, currentHash)`, `validatePhasesCompleted(phasesCompleted)`. Constants: `IMPLEMENTATION_PHASES`. | ~60-90 lines added |
| 3 | `src/claude/agents/00-sdlc-orchestrator.md` | MODIFY | FR-006, FR-007, FR-008 | Accept `START_PHASE` parameter in `init-and-phase-01` mode. Slice workflow phases array from START_PHASE onward. Accept `ARTIFACT_FOLDER` parameter to reuse existing slug directory. Update meta.json with `build_started_at`. | ~30-50 lines added/modified |
| 4 | `src/claude/hooks/lib/common.cjs` | MODIFY (minor) | FR-006 | `resetPhasesForWorkflow()` already accepts an arbitrary phase array -- no functional change needed, but may add a JSDoc note clarifying it supports partial arrays. The function's signature `resetPhasesForWorkflow(state, workflowPhases)` is already compatible. | ~2-5 lines (comment only) |
| 5 | `src/isdlc/config/workflows.json` | MODIFY | CON-003 | Add `_comment_build_autodetect_exception` annotation under `rules.no_halfway_entry` documenting the relaxation. No structural change -- the rule value stays `true` because the build verb modifies the phase array **before** workflow init, which is already permitted per `_comment_phase_skipping`. | ~3-5 lines added |
| 6 | `src/claude/hooks/tests/test-three-verb-utils.test.cjs` | MODIFY | NFR-006 | Add test sections for `computeStartPhase()`, `checkStaleness()`, and `validatePhasesCompleted()`. Minimum 3 test cases per function (happy path, edge cases, error conditions). | ~80-120 lines added |
| 7 | `docs/requirements/build-auto-detection-seamless-handoff/meta.json` | NO CHANGE (runtime) | FR-008 | Schema is sufficient. New additive field `build_started_at` will be written at runtime when build starts. No schema migration needed. | 0 lines |

#### Dependency Map

```
isdlc.md (build verb handler)
  |
  +-- calls --> three-verb-utils.cjs::resolveItem()          [existing]
  +-- calls --> three-verb-utils.cjs::readMetaJson()          [existing]
  +-- calls --> three-verb-utils.cjs::computeStartPhase()     [NEW]
  +-- calls --> three-verb-utils.cjs::checkStaleness()        [NEW]
  +-- calls --> three-verb-utils.cjs::validatePhasesCompleted() [NEW]
  |
  +-- delegates to --> 00-sdlc-orchestrator.md (init-and-phase-01)
  |     |
  |     +-- passes --> START_PHASE parameter                   [NEW]
  |     +-- passes --> ARTIFACT_FOLDER parameter               [NEW]
  |     |
  |     +-- calls --> common.cjs::resetPhasesForWorkflow()    [existing, compatible]
  |     +-- reads --> workflows.json (feature phases array)   [existing]
  |     +-- writes --> meta.json (build_started_at)           [NEW field]
  |
  +-- reads --> workflows.json (feature phases for display)   [existing]
```

#### Outward Dependencies (What depends on the changed files)

| Changed File | Depended On By | Impact |
|-------------|----------------|--------|
| `isdlc.md` | All `/isdlc` command invocations | **Low** -- changes are scoped to the `build` action handler only. Other actions (add, analyze, fix, feature-no-args, cancel, status) are untouched. |
| `three-verb-utils.cjs` | `isdlc.md` (add, analyze, build handlers) | **Low** -- only adding new exports. Existing exports are not modified. No breaking changes. |
| `00-sdlc-orchestrator.md` | Phase-Loop Controller in `isdlc.md` | **Low** -- START_PHASE is optional (AC-006-05: backward compatible when absent). Existing init-and-phase-01 behavior is preserved as the default path. |
| `common.cjs` | 21+ hook files, 5 dispatchers | **Negligible** -- only adding a JSDoc comment to `resetPhasesForWorkflow()`. No functional change. |
| `workflows.json` | Orchestrator, hooks, sizing logic | **Negligible** -- adding a comment field only. No structural change to any workflow definition. |

#### Inward Dependencies (What the changed files depend on)

| Changed File | Depends On | Impact |
|-------------|-----------|--------|
| `isdlc.md` build handler | `three-verb-utils.cjs` (resolveItem, readMetaJson, new functions), `workflows.json` (feature phases), orchestrator agent | All dependencies are stable and within scope |
| `three-verb-utils.cjs` new functions | `ANALYSIS_PHASES` constant (internal), `fs` module, `path` module | No new external dependencies |
| `00-sdlc-orchestrator.md` | `common.cjs::resetPhasesForWorkflow()`, `workflows.json`, `state.json` | All dependencies are stable |

### Change Propagation Analysis

The change propagation path is **short and well-bounded**:

1. **Entry point**: User invokes `/isdlc build "item-name"`
2. **Detection layer** (isdlc.md): Resolve item, read meta.json, compute start phase, check staleness, display summary
3. **Delegation**: Pass START_PHASE and ARTIFACT_FOLDER to orchestrator
4. **Orchestrator**: Slice phases array, call resetPhasesForWorkflow with subset, proceed as normal
5. **Phase-Loop Controller**: Operates on the sliced phases array -- no change needed, already works with any array length

No propagation beyond step 5. The Phase-Loop Controller, all phase agents, all hooks, and all dispatchers are unaffected.

---

## Entry Points

### M2: Entry Point Analysis

#### Existing Entry Points Affected

| # | Entry Point | Type | Current Behavior | Changed Behavior | FR Traces |
|---|-------------|------|-----------------|-----------------|-----------|
| 1 | `/isdlc build "slug"` | CLI command | Resolves item, reads meta.json (informational), delegates to orchestrator with MODE: init-and-phase-01 for full workflow | Resolves item, reads meta.json, **computes analysis status**, **checks staleness**, **displays phase summary**, delegates with MODE: init-and-phase-01 + START_PHASE + ARTIFACT_FOLDER | FR-001 through FR-008 |
| 2 | `/isdlc feature "slug"` | CLI alias | Alias for build -- identical behavior | Inherits all build changes (alias is preserved as-is) | NFR-003 |
| 3 | Orchestrator `init-and-phase-01` mode | Internal delegation | Initializes full workflow from Phase 00 | Accepts optional START_PHASE: initializes workflow from specified phase. ARTIFACT_FOLDER: uses existing folder instead of creating new REQ-NNNN- folder | FR-006, FR-007 |

#### New Entry Points Required

None. All new logic is added to existing entry points. The 3 new utility functions (`computeStartPhase`, `checkStaleness`, `validatePhasesCompleted`) are not entry points -- they are internal helpers called by the build verb handler.

#### Implementation Chain (Entry to Data Layer)

```
USER INPUT: /isdlc build "payment-processing"
    |
    v
[isdlc.md: build handler]
    |
    +-- (1) resolveItem("payment-processing")    --> docs/requirements/payment-processing/
    +-- (2) readMetaJson(slugDir)                 --> meta.json { analysis_status, phases_completed, codebase_hash }
    +-- (3) validatePhasesCompleted(phases)        --> contiguous subset
    +-- (4) computeStartPhase(meta, featurePhases) --> "05-test-strategy" | "02-impact-analysis" | null
    +-- (5) checkStaleness(meta, currentGitHash)   --> { stale: bool, commits_behind: N }
    |
    +-- IF fully analyzed + not stale:
    |     Display BUILD SUMMARY banner (FR-005)
    |     Delegate: MODE: init-and-phase-01, START_PHASE: "05-test-strategy", ARTIFACT_FOLDER: "payment-processing"
    |
    +-- IF partially analyzed:
    |     Display partial analysis summary
    |     Present [R] Resume / [S] Skip / [F] Full restart menu (FR-003)
    |     Delegate with computed START_PHASE based on user choice
    |
    +-- IF stale (hash mismatch):
    |     Display staleness warning with commit count
    |     Present [P] Proceed / [Q] Re-run quick-scan / [A] Re-analyze menu (FR-004)
    |     Proceed based on user choice
    |
    +-- IF raw or no meta.json:
    |     Delegate without START_PHASE (full workflow, backward compatible)
    |
    v
[00-sdlc-orchestrator.md: init-and-phase-01]
    |
    +-- IF START_PHASE present:
    |     Slice feature phases from START_PHASE onward
    |     Set active_workflow.phases = sliced array
    |     Set active_workflow.artifact_folder = provided ARTIFACT_FOLDER
    |     Call resetPhasesForWorkflow(state, slicedPhases)
    |     Skip REQ counter increment (folder already exists)
    |     Write meta.json: build_started_at, workflow_type
    |
    +-- IF START_PHASE absent:
    |     Full workflow (existing behavior, unchanged)
    |
    v
[Phase-Loop Controller: STEP 2 onward]
    Operates on active_workflow.phases[] -- works with any array length
    No changes needed
```

#### Recommended Implementation Order

1. **three-verb-utils.cjs** -- Add the 3 new utility functions first (pure functions, easy to test in isolation)
   - `validatePhasesCompleted(phasesCompleted)` -- contiguity validation
   - `computeStartPhase(meta, workflowPhases)` -- phase-skip computation
   - `checkStaleness(meta, currentHash)` -- staleness detection
2. **test-three-verb-utils.test.cjs** -- Add tests for the 3 new functions (TDD: tests before integration)
3. **workflows.json** -- Add the `_comment_build_autodetect_exception` annotation
4. **00-sdlc-orchestrator.md** -- Add START_PHASE + ARTIFACT_FOLDER parameter handling in init-and-phase-01 mode
5. **isdlc.md** -- Modify build verb handler to wire everything together (depends on steps 1-4)
6. **common.cjs** -- Add JSDoc comment to resetPhasesForWorkflow (minor, can be done anytime)

---

## Risk Assessment

### M3: Risk Analysis

#### Risk Matrix

| # | Risk | Severity | Likelihood | Impact Area | Mitigation | FR Traces |
|---|------|----------|-----------|-------------|------------|-----------|
| R1 | Backward compatibility regression: build verb breaks for items without meta.json | HIGH | LOW | All users | AC-001-04, AC-001-05: explicit fallback to "raw" when meta.json missing or corrupted. Existing test coverage in three-verb-utils.test.cjs already tests readMetaJson null return. | NFR-003 |
| R2 | Phase contiguity validation rejects valid partial analysis | MEDIUM | LOW | Users with partial analysis | AC-003-06: validatePhasesCompleted uses contiguous-prefix strategy. Edge case: manual meta.json editing could create non-contiguous arrays. Mitigation: log warning, use safe contiguous subset. | FR-003 |
| R3 | Staleness check fails when git is unavailable | LOW | LOW | CI/CD environments, non-git repos | AC-004-07, NFR-004: graceful degradation -- skip staleness check, log warning, proceed normally. | FR-004 |
| R4 | START_PHASE parameter with invalid phase key | MEDIUM | LOW | Developer error | AC-006-03: orchestrator rejects invalid phase with ERR-ORCH-INVALID-START-PHASE, falls back to full workflow. | FR-006 |
| R5 | Artifact folder naming collision when pre-analyzed folder gets REQ-NNNN prefix | MEDIUM | MEDIUM | Users who analyze then build | AC-007-01, AC-007-02: build verb passes existing folder name to orchestrator. Orchestrator skips REQ counter increment and folder creation when ARTIFACT_FOLDER is provided. Must handle both prefixed (REQ-0022-slug) and unprefixed (slug) cases. | FR-007 |
| R6 | Phase-Loop Controller STEP 2 task creation with non-standard phase array | LOW | LOW | Task display | Phase-Loop Controller already creates tasks from active_workflow.phases[] which can be any subset. No change needed -- tested by existing isdlc-step3-ordering.test.cjs. | FR-002 |
| R7 | Concurrent meta.json writes (analyze and build running simultaneously) | LOW | VERY LOW | Edge case | CON-004: single_active_workflow_per_project rule prevents this. Build checks for active workflow before proceeding. | CON-004 |
| R8 | `no_halfway_entry` rule enforcement by hooks | LOW | LOW | Hook enforcement | The build verb modifies the phase array before calling init-and-phase-01. Hooks that check `no_halfway_entry` must see this as legitimate. The `_comment_phase_skipping` annotation in workflows.json already covers this pattern (framework-level sizing modifications to the phase array are permitted). **Validated**: grep confirmed zero hooks reference `no_halfway_entry` at runtime -- the rule exists only in workflows.json as documentation. | CON-003 |

#### Test Coverage Analysis

| File | Existing Tests | Coverage Level | Gaps |
|------|---------------|----------------|------|
| `three-verb-utils.cjs` | `test-three-verb-utils.test.cjs` (1577 lines, ~100 test cases) | HIGH (all 14 exported functions tested) | **GAP**: No tests for the 3 new functions (computeStartPhase, checkStaleness, validatePhasesCompleted) -- they do not exist yet |
| `common.cjs` | `test-common.test.cjs` + `common.test.cjs` (combined ~120 test cases) | HIGH | No gap for resetPhasesForWorkflow -- existing tests cover arbitrary phase arrays. No gap expected from this feature. |
| `workflows.json` | `test-build-integrity.test.cjs`, `isdlc-step3-ordering.test.cjs` | MEDIUM | **GAP**: No test validates the `_comment_build_autodetect_exception` annotation or that the `no_halfway_entry` rule does not block phase-skip |
| `isdlc.md` | Not directly testable (markdown command spec) | N/A | Logic is tested through the utility functions and orchestrator. Integration testing would require end-to-end workflow execution. |
| `00-sdlc-orchestrator.md` | Not directly testable (agent spec) | N/A | START_PHASE parameter handling is tested indirectly through utility functions. |

#### Complexity Hotspots

| File | Complexity | Concern |
|------|-----------|---------|
| `isdlc.md` build verb handler | **HIGH** | The build handler currently has 9 steps. This feature inserts significant conditional logic (detection, staleness, menu presentation) between steps 4 and 7. Risk of the handler becoming too long/complex. **Mitigation**: Keep all computation in three-verb-utils.cjs; the build handler should call utility functions and present UX only. |
| `00-sdlc-orchestrator.md` init-and-phase-01 | **MEDIUM** | The orchestrator already handles multiple initialization paths (feature, fix, upgrade). Adding START_PHASE branching adds one more conditional. **Mitigation**: START_PHASE is a simple parameter that slices the phase array -- the conditional is straightforward. |
| `three-verb-utils.cjs` | **LOW** | New functions are pure (no side effects beyond git command for staleness check). Easy to test and reason about. |

#### Technical Debt Markers

| File | Debt | Relevance |
|------|------|-----------|
| `isdlc.md` build step 4 | "Read meta.json using readMetaJson() -- informational for this release" | **DIRECTLY RELEVANT**: This comment indicates meta.json was read but not acted upon. This feature removes that debt by making the read actionable. |
| `workflows.json` rules.no_halfway_entry | `true` with no exception mechanism | **DIRECTLY RELEVANT**: This feature relaxes the rule. The `_comment_phase_skipping` annotation already provides the exception mechanism pattern. |
| `isdlc.md` build handler missing integration tests | Build flow is only tested through utility functions | **INDIRECTLY RELEVANT**: This feature adds more logic to the build handler without adding integration tests. Consider adding an integration test section to the test file. |

#### Risk Recommendations Per Acceptance Criterion

| AC Group | Risk Level | Recommendation |
|----------|-----------|----------------|
| AC-001-01 through AC-001-05 (detection) | LOW | Well-covered by existing readMetaJson tests. Add 5 unit tests for computeStartPhase covering all status types. |
| AC-002-01 through AC-002-04 (full skip) | MEDIUM | Test that orchestrator correctly slices phase array and preserves existing artifacts. Key risk: REQ counter increment must be skipped. |
| AC-003-01 through AC-003-06 (partial handling) | MEDIUM | Test contiguity validation edge cases. Key risk: non-contiguous phases_completed arrays from manual editing. |
| AC-004-01 through AC-004-07 (staleness) | LOW | Test checkStaleness with same hash, different hash, missing hash, git failure. Pure function -- easy to test. |
| AC-005-01 through AC-005-03 (summary display) | LOW | UX display only -- no logic risk. Verify format matches spec. |
| AC-006-01 through AC-006-05 (orchestrator param) | MEDIUM | Test orchestrator with valid START_PHASE, invalid START_PHASE, and no START_PHASE. Key risk: ensure backward compatibility when param is absent. |
| AC-007-01 through AC-007-03 (artifact folder) | MEDIUM | Test both prefixed and unprefixed folder names. Key risk: folder creation collision. |
| AC-008-01 through AC-008-02 (meta.json update) | LOW | Additive field only. Test that existing meta fields are preserved. |

---

## Cross-Validation

### File Coverage Cross-Check

All files identified in M1 (Impact) appear in M2 (Entry Points) dependency chain. No orphan files.

| M1 File | Appears in M2 Chain | Appears in M3 Risk Matrix |
|---------|--------------------|-----------------------------|
| isdlc.md | Yes (primary entry point) | Yes (R1, R5, R6, R8) |
| three-verb-utils.cjs | Yes (called by build handler) | Yes (R2, coverage analysis) |
| 00-sdlc-orchestrator.md | Yes (delegation target) | Yes (R4, R5) |
| common.cjs | Yes (called by orchestrator) | Yes (coverage analysis) |
| workflows.json | Yes (read by build handler and orchestrator) | Yes (R8) |
| test-three-verb-utils.test.cjs | N/A (test file) | Yes (coverage gap) |

### Consistency Check

- M1 blast radius (low-medium, 7 files, 3 modules) is consistent with M3 risk level (medium) -- the risk comes from the **criticality** of the build verb path, not the number of files.
- M2 recommended implementation order (utilities first, then orchestrator, then build handler) aligns with M3 risk mitigation (test new functions before integrating).
- No contradictions detected between sub-analyses.

### Post-Analysis Codebase Change Validation (Phase 02)

**Codebase staleness detected**: 2 commits between analysis hash (`9e304d4`) and current HEAD (`3707b11`).

The intervening commits implement REQ-0022 (Performance Budget Guardrails), which modified 3 files in the impact scope:

| File | REQ-0022 Change | Impact on REQ-0026 |
|------|----------------|-------------------|
| `src/claude/commands/isdlc.md` | Added STEP 3c-prime-timing, STEP 3e-timing, BUDGET_DEGRADATION injection in STEP 3d, STEP 3-dashboard | **None** -- all changes are in the Phase-Loop Controller section (STEPs 3c-3e). The build verb handler (steps 1-9) is unchanged. REQ-0026 modifies only the build handler. |
| `src/claude/hooks/lib/common.cjs` | Added `timing` field to `collectPhaseSnapshots()` | **None** -- REQ-0026 modifies only `resetPhasesForWorkflow()` (JSDoc comment). `collectPhaseSnapshots` is not in scope. |
| `src/isdlc/config/workflows.json` | Added `performance_budgets` blocks to feature and fix workflows | **None** -- REQ-0026 modifies only the `rules` section (annotation). The `performance_budgets` blocks are additive and separate. |

Additionally, all 5 dispatchers received timing instrumentation (`DISPATCHER_TIMING` logging). These are outside REQ-0026 scope and do not affect the impact analysis.

**Validation result**: All impact analysis claims remain accurate. No updates required to M1, M2, or M3 findings. R8 risk downgraded from MEDIUM to LOW based on confirmed absence of `no_halfway_entry` enforcement in hooks.

---

## Implementation Recommendations

Based on the impact analysis:

1. **Suggested Order**: Implement in dependency order -- utilities first (three-verb-utils.cjs), then orchestrator (START_PHASE param), then build handler (isdlc.md). Write tests alongside the utility functions.

2. **High-Risk Areas -- Add Tests First**:
   - `computeStartPhase()`: Test with fully-analyzed meta (expect Phase 05), partially-analyzed (expect next incomplete phase), raw (expect null), corrupted (expect null).
   - `validatePhasesCompleted()`: Test with contiguous array, non-contiguous array (gap), empty array, unknown phase keys.
   - `checkStaleness()`: Test with matching hash, different hash, missing hash field, null meta.

3. **Dependencies to Resolve**:
   - Confirm `resetPhasesForWorkflow()` in common.cjs works correctly with partial phase arrays (expected: yes, based on code review -- it creates fresh skeleton entries for whatever phases are passed).
   - Confirm no hook enforces `no_halfway_entry` at runtime (expected: no hook does -- the rule is documented in workflows.json but enforced by the orchestrator at init time only).

4. **Key Design Decisions**:
   - Keep all detection logic in three-verb-utils.cjs (NFR-006: testability).
   - The build handler in isdlc.md should be a thin orchestration layer: call utility functions, present UX, delegate.
   - START_PHASE is an optional parameter with full backward compatibility when absent (AC-006-05).

---

## Impact Analysis Metadata

The following JSON block is required for automated sizing analysis (REQ-0011).
All fields are required. The `parseSizingFromImpactAnalysis()` function reads
the LAST JSON block in the file to extract sizing metrics.

```json
{
  "analysis_completed_at": "2026-02-19T16:00:00Z",
  "validated_at": "2026-02-19T19:30:00Z",
  "sub_agents": ["M1", "M2", "M3", "M4"],
  "verification_status": "PASS",
  "requirements_document": "docs/requirements/REQ-0026-build-auto-detection-seamless-handoff/requirements-spec.md",
  "quick_scan_used": "docs/requirements/REQ-0026-build-auto-detection-seamless-handoff/quick-scan.md",
  "scope_change_from_original": "refined",
  "requirements_keywords": ["build", "analyze", "phase", "auto-detect", "skip", "meta.json", "staleness", "codebase_hash", "START_PHASE", "contiguity", "artifact_folder"],
  "files_directly_affected": 7,
  "modules_affected": 3,
  "risk_level": "medium",
  "blast_radius": "low-medium",
  "coverage_gaps": 1
}
```

**`coverage_gaps` derivation**: Of the 7 files in M1's affected list, `test-three-verb-utils.test.cjs` has a coverage gap for the 3 new functions that do not yet exist. The other test-covered files (common.cjs, workflows.json) have no gaps relevant to this feature. The .md files (isdlc.md, orchestrator) are not directly testable. Count: 1 file with a coverage gap (three-verb-utils.cjs for the new functions).
