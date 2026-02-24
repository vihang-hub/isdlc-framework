# Requirements Specification: Sizing Decision in Analyze Verb

**Source**: GitHub Issue #57
**Category**: Enhancement (Workflow Quality)
**Artifact Folder**: `sizing-in-analyze-GH-57`
**Generated**: 2026-02-19
**Phase**: 01-requirements (ANALYSIS MODE -- no state.json writes, no branches)
**Quick Scan Scope**: MEDIUM (~13 files, low-to-medium risk)

---

## 1. Scope Statement

### 1.1 Problem

The sizing decision (light/standard/epic) currently exists only in the **build** workflow (STEP 3e-sizing, after Phase 02 Impact Analysis). Users who run `/isdlc analyze` always execute all 5 analysis phases (00-04) including architecture and design -- even for trivial changes like fixing a typo or updating a config value.

This creates three problems:

1. Users who analyze first **never see the sizing menu** -- by the time they build, phases 03-04 are already complete
2. The `-light` flag only works on `build`, not `analyze`
3. There is no way to skip architecture/design during standalone analysis

### 1.2 Scope Classification

**MEDIUM** -- Core logic changes to 3 files (isdlc.md, three-verb-utils.cjs, common.cjs), with secondary updates to agent documentation and tests. The sizing menu presentation and decision logic already exist in the build workflow; this feature ports the decision point into the analyze workflow with meta.json-only storage.

### 1.3 What Is In Scope

- Sizing decision point in the analyze workflow (after Phase 02)
- meta.json schema extension for `sizing_decision`
- `-light` flag support on the analyze command
- Updates to `deriveAnalysisStatus()` and `writeMetaJson()` for sizing-aware status derivation
- Updates to `computeStartPhase()` for sizing-skipped phase recognition in build
- Test coverage for new code paths

### 1.4 What Is Out of Scope

- Changes to the build-side sizing flow (STEP 3e-sizing is unchanged)
- Epic intensity support in analyze (epic requires state.json for budget tracking)
- Automatic sizing without user confirmation (sizing always requires user prompt per GH-51)
- Changes to Phase 03/04 agent internals (they are simply not delegated to)

---

## 2. Functional Requirements

### FR-001: Sizing Decision Point After Phase 02 in Analyze

**Description**: After Phase 02 (Impact Analysis) completes within the analyze workflow, present a sizing decision menu to the user. This decision point determines whether phases 03-architecture and 04-design should be executed or skipped.

**Trigger**: Phase `02-impact-analysis` has just completed (appended to `meta.phases_completed`) AND no `sizing_decision` field exists in meta.json (prevents double-sizing on resume).

**Acceptance Criteria**:

- AC-001a: After Phase 02 completes in analyze, the sizing flow executes before the "Continue to Phase 03?" exit point.
- AC-001b: The sizing flow does NOT execute if `meta.sizing_decision` is already set (resume scenario).
- AC-001c: The sizing flow does NOT execute after any phase other than `02-impact-analysis`.
- AC-001d: If the analyze flow is resumed at Phase 03 or later (i.e., Phase 02 was completed in a previous session), the sizing flow does NOT re-execute.

### FR-002: Sizing Menu Presentation

**Description**: Present the same sizing recommendation banner and user menu that build uses in STEP 3e-sizing (S3), adapted for the analyze context.

**Acceptance Criteria**:

- AC-002a: The sizing flow reads `impact-analysis.md` from `docs/requirements/{slug}/impact-analysis.md` and calls `parseSizingFromImpactAnalysis(content)` to extract metrics.
- AC-002b: If metrics extraction succeeds, call `computeSizingRecommendation(metrics, thresholds)` using thresholds from `workflows.json` -> `workflows.feature.sizing.thresholds`.
- AC-002c: If metrics extraction fails, execute the fallback chain (`extractFallbackSizingMetrics`) identically to build's S3.b-fallback path.
- AC-002d: Display the sizing recommendation banner with the same format as build (intensity, rationale, impact summary or fallback warning).
- AC-002e: Present user menu with options: `[A] Accept recommendation`, `[O] Override (choose different intensity)`, `[S] Show impact analysis`.
- AC-002f: Epic intensity is excluded from the override picker in analyze. Present only `[1] Light  [2] Standard`. Display note: `(Epic requires build workflow for budget tracking)`.

### FR-003: Light Sizing -- Skip Phases 03-04 in Analyze

**Description**: When the user accepts or selects `light` intensity, skip phases `03-architecture` and `04-design` in the current analyze run.

**Acceptance Criteria**:

- AC-003a: When light is selected, do NOT delegate to Phase 03 or Phase 04 agents.
- AC-003b: Phases `03-architecture` and `04-design` are NOT appended to `meta.phases_completed` (they were not executed).
- AC-003c: The analyze loop proceeds directly from Phase 02 to the "Analysis complete" message.
- AC-003d: The exit message reads: `"Analysis complete (light). {slug} is ready to build. Phases 03-04 skipped by sizing decision."`.
- AC-003e: The list of phases to skip is read from `workflows.json` -> `workflows.feature.sizing.light_skip_phases` (default: `["03-architecture", "04-design"]`).

### FR-004: Standard Sizing -- Continue All Phases in Analyze

**Description**: When the user accepts or selects `standard` intensity, the analyze workflow continues normally through all remaining phases (03-architecture, 04-design).

**Acceptance Criteria**:

- AC-004a: When standard is selected, the analyze loop continues to Phase 03 and Phase 04 as usual.
- AC-004b: A sizing decision record is still written to meta.json with `intensity: "standard"`.

### FR-005: Record Sizing Decision in meta.json

**Description**: Store the sizing decision in meta.json (not state.json) so it survives to the build phase and can be read by `computeStartPhase()`.

**Schema**: Add a `sizing_decision` field to meta.json:

```json
{
  "sizing_decision": {
    "intensity": "light",
    "effective_intensity": "light",
    "recommended_intensity": "light",
    "decided_at": "2026-02-19T22:30:00Z",
    "reason": "user_accepted",
    "user_prompted": true,
    "forced_by_flag": false,
    "overridden": false,
    "overridden_to": null,
    "file_count": 3,
    "module_count": 1,
    "risk_score": "low",
    "fallback_source": null,
    "fallback_attempted": false,
    "light_skip_phases": ["03-architecture", "04-design"],
    "context": "analyze"
  }
}
```

**Acceptance Criteria**:

- AC-005a: After the user makes a sizing selection, write the `sizing_decision` object to meta.json via `writeMetaJson()`.
- AC-005b: The `sizing_decision.context` field is set to `"analyze"` (distinguishes from a potential future build-side meta write).
- AC-005c: The `sizing_decision.light_skip_phases` array records which phases were skipped (for build-side recognition).
- AC-005d: The sizing record includes metrics (file_count, module_count, risk_score) when available, or null values when metrics are unavailable.
- AC-005e: The sizing record includes audit fields (reason, user_prompted, forced_by_flag, fallback_source, fallback_attempted) matching the build-side `applySizingDecision()` schema.

### FR-006: Support -light Flag on Analyze Command

**Description**: The `-light` flag, currently supported only on `build`, should also work on `analyze`. When set, it auto-accepts the light sizing recommendation without presenting the menu.

**Acceptance Criteria**:

- AC-006a: `/isdlc analyze -light "item"` is a valid command that triggers the analyze workflow with the light flag.
- AC-006b: When `-light` is set and Phase 02 completes, the sizing decision is automatically set to `light` without presenting the user menu.
- AC-006c: A forced-light banner is displayed (same format as build's S2.c banner, adapted for analyze context):
  ```
  +----------------------------------------------------------+
  |  ANALYSIS SIZING: Light (forced via -light flag)          |
  |                                                           |
  |  Skipping phases:                                         |
  |    - Phase 03: Architecture                               |
  |    - Phase 04: Design                                     |
  |                                                           |
  |  Analysis: 00 -> 01 -> 02 -> done                        |
  +----------------------------------------------------------+
  ```
- AC-006d: The meta.json sizing_decision record includes `forced_by_flag: true` and `reason: "light_flag"`.
- AC-006e: The `-light` flag is parsed in the same location as other analyze flags (input parsing section of the analyze handler).

### FR-007: deriveAnalysisStatus() Recognizes Light-Skipped Phases

**Description**: `deriveAnalysisStatus()` currently returns `"analyzed"` only when all 5 analysis phases (00-04) are in `phases_completed`. With light sizing, phases 03 and 04 are intentionally skipped. The function must recognize this and still return `"analyzed"`.

**Acceptance Criteria**:

- AC-007a: `deriveAnalysisStatus(phasesCompleted, sizingDecision)` accepts an optional second parameter: the `sizing_decision` object from meta.json (or `null`/`undefined` if absent).
- AC-007b: When `sizing_decision` is present and `sizing_decision.effective_intensity === "light"`: return `"analyzed"` if all non-skipped analysis phases are completed. Specifically, if `phases_completed` contains `["00-quick-scan", "01-requirements", "02-impact-analysis"]` and `sizing_decision.light_skip_phases` includes `["03-architecture", "04-design"]`, return `"analyzed"`.
- AC-007c: When `sizing_decision` is `null`/`undefined` (no sizing decision, or legacy meta.json): behavior is unchanged -- requires all 5 phases for `"analyzed"`.
- AC-007d: The function remains a pure function (no I/O, no side effects).

### FR-008: writeMetaJson() Preserves and Derives Status with Sizing

**Description**: `writeMetaJson()` currently derives `analysis_status` from `phases_completed` count. It must account for the `sizing_decision` field when deriving status.

**Acceptance Criteria**:

- AC-008a: When writing meta.json, if `meta.sizing_decision` is present with `effective_intensity === "light"`, use the sizing-aware derivation logic (same as FR-007) instead of the raw count-based derivation.
- AC-008b: The `sizing_decision` field is preserved during writes (not stripped or overwritten).
- AC-008c: Existing meta.json files without a `sizing_decision` field continue to work identically (backward compatible).

### FR-009: computeStartPhase() Recognizes Sizing-Skipped Phases

**Description**: When `build` runs after a light-sized analyze, `computeStartPhase()` must recognize that phases 03-04 are intentionally skipped (not incomplete) and return the correct start phase for implementation.

**Acceptance Criteria**:

- AC-009a: `computeStartPhase(meta, workflowPhases)` reads `meta.sizing_decision` to determine if phases were intentionally skipped.
- AC-009b: When `meta.sizing_decision.effective_intensity === "light"` and `meta.phases_completed` contains `["00-quick-scan", "01-requirements", "02-impact-analysis"]`: return `status: "analyzed"` and `startPhase` pointing to the first implementation phase (e.g., `"05-test-strategy"`).
- AC-009c: The `completedPhases` array in the return value includes only the actually-completed phases (00, 01, 02), not the skipped phases.
- AC-009d: The `remainingPhases` array excludes the light-skipped phases (03, 04) and starts from the first implementation phase.
- AC-009e: When `meta.sizing_decision` is absent, behavior is unchanged (backward compatible).

### FR-010: GitHub Label Sync Respects Light Analysis

**Description**: The GitHub label sync at the end of analyze (step 9 in the current handler) must fire after light-sized analysis completes, not only after all 5 phases complete.

**Acceptance Criteria**:

- AC-010a: When light-sized analysis completes (phases 00-02 done, 03-04 skipped), the `ready-to-build` label is applied to the GitHub issue.
- AC-010b: No changes to the label sync logic itself -- it fires at the "Analysis complete" exit point, which now also covers the light exit path.

---

## 3. Non-Functional Requirements

### NFR-001: No state.json Writes (Stateless Analyze)

**Description**: The analyze workflow must NOT write to `.isdlc/state.json`. All sizing decision data is stored exclusively in `docs/requirements/{slug}/meta.json`.

**Acceptance Criteria**:

- AC-NFR-001a: No code path in the analyze sizing flow reads or writes `.isdlc/state.json`.
- AC-NFR-001b: The `applySizingDecision()` function from `common.cjs` is NOT called from the analyze context (it mutates state.json). A separate meta.json-only write path is used.
- AC-NFR-001c: The sizing_decision record in meta.json is self-contained -- it does not reference state.json fields.

### NFR-002: Backward Compatibility with Existing meta.json Files

**Description**: Existing meta.json files (created before this feature) that lack a `sizing_decision` field must continue to work identically in all utility functions.

**Acceptance Criteria**:

- AC-NFR-002a: `readMetaJson()` returns meta objects without `sizing_decision` unchanged (no defensive defaults added for this field).
- AC-NFR-002b: `writeMetaJson()` preserves existing behavior when `sizing_decision` is absent.
- AC-NFR-002c: `deriveAnalysisStatus()` returns the same results as before when called without a `sizing_decision` parameter or with `null`.
- AC-NFR-002d: `computeStartPhase()` returns the same results as before when `meta.sizing_decision` is absent.

### NFR-003: Sizing Menu UX Consistency

**Description**: The sizing menu in analyze must be visually and behaviorally identical to the build sizing menu, with only context-appropriate differences (analyze vs build, no epic option).

**Acceptance Criteria**:

- AC-NFR-003a: The recommendation banner format matches build's STEP 3e-sizing S3.e/S3.e-fallback banner format.
- AC-NFR-003b: The `[A] Accept / [O] Override / [S] Show analysis` menu structure is identical.
- AC-NFR-003c: The `[S] Show analysis` option displays the same impact-analysis.md content (or fallback diagnostic info).
- AC-NFR-003d: The forced-light banner (for `-light` flag) follows the same format conventions as build's S2.c banner.

### NFR-004: Resumability

**Description**: The analyze workflow must remain resumable at any phase boundary, including after a sizing decision has been recorded.

**Acceptance Criteria**:

- AC-NFR-004a: If analyze is interrupted after sizing is recorded but before the exit message, resuming analyze resumes from the correct point (does not re-present sizing menu, per FR-001 AC-001b).
- AC-NFR-004b: If analyze is interrupted before Phase 02 completes, resuming analyze completes Phase 02 and then presents the sizing menu normally.

### NFR-005: Phase Transition Overhead

**Description**: The sizing decision point must not add more than 500ms of overhead to the phase transition (excluding user interaction time).

**Acceptance Criteria**:

- AC-NFR-005a: Reading impact-analysis.md, computing recommendation, and writing meta.json complete within 500ms on a standard machine (excluding user menu wait time).

---

## 4. Constraints

### CON-001: Analysis Mode Only

This specification is produced in ANALYSIS MODE. No state.json writes, no branch creation, no code modifications.

### CON-002: No applySizingDecision() Reuse for Analyze

The existing `applySizingDecision()` in `common.cjs` mutates `state.active_workflow` (removing phases from arrays, adjusting `current_phase_index`). This function cannot be called from the analyze context because analyze has no state.json. A separate write path that builds a sizing_decision record and writes it to meta.json is required.

### CON-003: ANALYSIS_PHASES Constant

The `ANALYSIS_PHASES` constant in `three-verb-utils.cjs` lists all 5 phases: `['00-quick-scan', '01-requirements', '02-impact-analysis', '03-architecture', '04-design']`. The sizing feature must work with this constant unchanged -- the determination of "all required phases complete" becomes context-dependent (sizing-aware) rather than hardcoded to length 5.

### CON-004: No Epic in Analyze

Epic intensity is excluded from the analyze sizing menu. Epic workflows require state.json for budget tracking (STEP 3e-timing), which conflicts with analyze's stateless constraint (NFR-001). If epic is recommended by the algorithm, display the recommendation but restrict the user to accepting light or standard only.

---

## 5. Affected Files Summary

| File | Change Type | Requirements |
|------|-------------|-------------|
| `src/claude/commands/isdlc.md` (analyze handler) | Modify | FR-001, FR-002, FR-003, FR-004, FR-006, FR-010 |
| `src/claude/hooks/lib/three-verb-utils.cjs` (deriveAnalysisStatus) | Modify | FR-007 |
| `src/claude/hooks/lib/three-verb-utils.cjs` (writeMetaJson) | Modify | FR-008 |
| `src/claude/hooks/lib/three-verb-utils.cjs` (computeStartPhase) | Modify | FR-009 |
| `src/claude/hooks/lib/common.cjs` (sizing helpers) | Modify | FR-002 (metrics/recommendation reuse) |
| `src/claude/hooks/tests/sizing-consent.test.cjs` | Modify | FR-005, FR-007, FR-009 |
| `src/claude/hooks/config/workflows.json` | Verify | FR-003 (light_skip_phases config) |

---

## 6. Design Decisions Deferred to Phase 03

The following decisions are documented but deferred to the architecture/design phases:

1. **Shared vs duplicated sizing logic**: Whether to extract the sizing recommendation flow (metrics parsing, recommendation computation, banner rendering) into a shared helper callable from both build and analyze, or to inline a simplified version in the analyze handler.

2. **deriveAnalysisStatus signature change**: Whether to add the `sizingDecision` as a second parameter, or have callers pre-compute the effective phase count. Both approaches satisfy FR-007 but have different API ergonomics.

3. **computeStartPhase integration**: Whether `computeStartPhase()` should read `meta.sizing_decision` directly or receive it as a pre-processed flag. The former is simpler; the latter is more testable.

---

## 7. Phase Gate Validation (GATE-01 -- Feature Scope, Analysis Mode)

- [x] Functional requirements documented (FR-001 through FR-010)
- [x] Each FR has unique ID and acceptance criteria
- [x] Non-functional requirements documented (NFR-001 through NFR-005)
- [x] NFRs have measurable criteria
- [x] Constraints documented (CON-001 through CON-004)
- [x] Scope statement with SMALL/MEDIUM/LARGE classification
- [x] In-scope and out-of-scope items defined
- [x] Affected files identified with requirement tracing
- [x] Backward compatibility addressed (NFR-002)
- [x] Deferred design decisions documented

---

*Requirements specification completed in ANALYSIS MODE -- no state.json writes, no branches created.*
