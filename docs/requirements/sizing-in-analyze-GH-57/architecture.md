# Architecture: Sizing Decision in Analyze Verb

**Generated**: 2026-02-19
**Feature**: GH-57 -- Add sizing decision to the analyze verb
**Phase**: 03-architecture
**Mode**: ANALYSIS MODE (no state.json writes, no branches)
**Input**: requirements-spec.md (10 FRs, 5 NFRs), impact-analysis.md (9 files, MEDIUM blast radius)

---

## 1. Architecture Overview

This feature extends the analyze workflow to include a sizing decision point after Phase 02 (Impact Analysis). The sizing decision determines whether phases 03-architecture and 04-design should execute or be skipped. The architecture must satisfy a hard constraint: the analyze workflow is stateless with respect to `.isdlc/state.json` -- all persistence is through `meta.json` in the slug directory.

### 1.1 Design Principles

1. **Stateless analyze invariant** (NFR-001): No code path in the analyze sizing flow reads or writes `.isdlc/state.json`. The `applySizingDecision()` function from `common.cjs` is off-limits.
2. **Read-only reuse** (CON-002): Pure functions from `common.cjs` (`parseSizingFromImpactAnalysis`, `computeSizingRecommendation`, `extractFallbackSizingMetrics`) are called read-only. No new wrapper functions are needed -- they are already pure.
3. **Additive changes only**: All function signature changes use optional parameters with backward-compatible defaults. No existing callers break.
4. **Single source of truth**: The `sizing_decision` record in `meta.json` is the canonical sizing state for analyze. Build reads it via `computeStartPhase()`.
5. **Simplicity first** (Article V): Inline the sizing logic in the analyze handler rather than extracting a shared helper. The build and analyze sizing contexts are sufficiently different (state.json vs meta.json, different available options, different banner text) that a shared abstraction would create more coupling than it eliminates.

### 1.2 What Changes vs What Does Not

| Component | Changes? | Rationale |
|-----------|----------|-----------|
| `isdlc.md` analyze handler (lines 563-600) | YES | Insert sizing decision point, -light flag parsing |
| `three-verb-utils.cjs: deriveAnalysisStatus()` | YES | New optional `sizingDecision` parameter |
| `three-verb-utils.cjs: writeMetaJson()` | YES | Delegate to `deriveAnalysisStatus()` instead of inline logic; pass `sizing_decision` |
| `three-verb-utils.cjs: computeStartPhase()` | YES | New branch for light-sized analysis (3 phases + sizing = analyzed) |
| `common.cjs: parseSizingFromImpactAnalysis()` | NO | Called read-only from analyze handler |
| `common.cjs: computeSizingRecommendation()` | NO | Called read-only from analyze handler |
| `common.cjs: extractFallbackSizingMetrics()` | NO | Called read-only from analyze handler |
| `common.cjs: applySizingDecision()` | NO | Must NOT be called from analyze. Mutates state.json. |
| `workflows.json` | NO | `light_skip_phases` already exists at line 49 |
| Phase 03/04 agents | NO | Simply not delegated to when light is selected |

---

## 2. Architecture Decisions

### ADR-001: Inline Sizing Logic in Analyze Handler (No Shared Helper)

**Context**: The build workflow's sizing flow (STEP 3e-sizing, lines 1461-1569 in isdlc.md) orchestrates metrics parsing, recommendation computation, banner display, user menu, and state mutation via `applySizingDecision()`. The analyze workflow needs similar orchestration but with different persistence (meta.json), different options (no epic), and different banner text ("ANALYSIS SIZING" vs "WORKFLOW SIZING").

**Decision**: Inline the analyze sizing logic directly in the analyze handler section of `isdlc.md`. Do NOT extract a shared helper function.

**Rationale**:
- The two contexts share 3 pure function calls but diverge on: persistence target (meta.json vs state.json), available intensities (light/standard vs light/standard/epic), banner wording, post-decision actions (skip remaining phases vs mutate phase arrays), and error recovery (no rollback needed in analyze).
- A shared helper would need conditional branches for every divergence point, creating a "Swiss army knife" function that is harder to understand than two clear, self-contained flows.
- The build handler is 108 lines of markdown instructions. The analyze handler will be approximately 60-70 lines. The duplication is limited to 3 function calls and banner format (which is intentionally similar per NFR-003 but not identical).
- Future changes to one flow (e.g., adding epic to analyze if budget tracking moves to meta.json) can be made without risking the other flow.

**Consequences**: Moderate duplication of banner format and menu structure between build and analyze handlers. Mitigated by NFR-003 requiring visual consistency -- changes to one banner format should be mirrored manually in the other.

**Traces**: FR-001, FR-002, NFR-003, CON-002, Article V (Simplicity First)

---

### ADR-002: Optional Parameter on deriveAnalysisStatus() (Not Internal Meta Read)

**Context**: `deriveAnalysisStatus()` currently counts phases in `phasesCompleted` and returns `'analyzed'` only when count equals 5 (all ANALYSIS_PHASES). With light sizing, only 3 phases are completed but the item should still be `'analyzed'`. Two approaches: (a) add an optional `sizingDecision` parameter, or (b) have the function internally read meta.json to check for sizing.

**Decision**: Add an optional second parameter: `deriveAnalysisStatus(phasesCompleted, sizingDecision)`.

**Rationale**:
- The function is currently a pure function (no I/O, no side effects). Making it read meta.json internally would break this property and make it impossible to test without filesystem fixtures.
- An optional parameter preserves backward compatibility: all 14 existing call sites that pass 1 argument continue to work because `sizingDecision` defaults to `undefined`, which triggers the original logic.
- The caller (`writeMetaJson`, `isdlc.md` analyze handler) already has the meta object in scope, so passing `meta.sizing_decision` is trivial.
- Pure functions are easier to test -- new test cases just pass different arguments.

**Consequences**: Two callers must be updated to pass the second argument: `writeMetaJson()` (internal, same file) and the analyze handler in `isdlc.md` (markdown instructions). All existing callers remain unchanged.

**Traces**: FR-007 (AC-007a, AC-007d), NFR-002 (AC-NFR-002c)

---

### ADR-003: computeStartPhase() Reads meta.sizing_decision Directly

**Context**: `computeStartPhase(meta, workflowPhases)` already receives the full `meta` object. When light sizing is recorded in `meta.sizing_decision`, the function needs to recognize that 3 completed phases + light sizing = fully analyzed.

**Decision**: `computeStartPhase()` reads `meta.sizing_decision` directly from the meta object it already receives. No signature change needed.

**Rationale**:
- The function already receives the full `meta` object (line 351: `function computeStartPhase(meta, workflowPhases)`). Adding another parameter would be redundant.
- The `sizing_decision` field is part of meta.json by design (FR-005). Reading it from the meta object is the natural access pattern.
- The new branch is inserted BETWEEN the "no valid phases" check (Step 3, line 367) and the "all analysis phases complete" check (Step 4, line 378). This placement means:
  - If there are 0 valid phases, we still return `'raw'` (existing behavior).
  - If there are exactly 5 valid phases, we still return `'analyzed'` via the existing path (existing behavior).
  - The new branch catches the case: `valid.length < 5 AND meta.sizing_decision.effective_intensity === 'light' AND missing phases are exactly the skip list`.

**Consequences**: The function gains one additional branch (from 5 to 6 branches, cyclomatic complexity increases by 1). The branch is guarded by a specific condition that cannot fire for legacy meta objects (they lack `sizing_decision`).

**Traces**: FR-009 (AC-009a through AC-009e), NFR-002 (AC-NFR-002d)

---

### ADR-004: writeMetaJson() Delegates to deriveAnalysisStatus() (Eliminate Duplication)

**Context**: `writeMetaJson()` currently contains inline status derivation logic (lines 266-272) that duplicates `deriveAnalysisStatus()`. The impact analysis identified this as technical debt. With the sizing feature, this duplication must be resolved because the inline logic does not know about sizing.

**Decision**: Replace the inline derivation in `writeMetaJson()` with a call to `deriveAnalysisStatus(meta.phases_completed, meta.sizing_decision)`.

**Rationale**:
- The inline logic (`completedCount === 0 -> raw, < 5 -> partial, else -> analyzed`) is a copy of `deriveAnalysisStatus()`. Having two copies of the same logic is a maintenance hazard, especially now that the logic is becoming sizing-aware.
- Delegating to the function ensures consistency: any future changes to status derivation logic only need to happen in one place.
- This is a net reduction in code (replace 6 lines of inline logic with 1 function call).

**Consequences**: `writeMetaJson()` now depends on `deriveAnalysisStatus()` being correct. This is already the case implicitly (they implement the same logic), so making it explicit reduces risk rather than increasing it.

**Traces**: FR-008 (AC-008a, AC-008c), Impact Analysis technical debt marker

---

### ADR-005: No Epic Intensity in Analyze (Constraint Enforcement)

**Context**: Epic intensity requires state.json for budget tracking (performance_budgets in workflows.json). The analyze workflow is stateless (NFR-001).

**Decision**: When the sizing algorithm recommends `'epic'`, the analyze handler displays the recommendation but restricts the user menu to `[1] Light  [2] Standard`. The override picker also excludes epic. If the user accepts an epic recommendation, the effective intensity is `'standard'` (same behavior as build's epic deferral).

**Rationale**:
- Epic budget tracking writes to `state.active_workflow.performance_budget` -- a state.json field that does not exist in analyze context.
- Adding budget tracking to meta.json would be premature. No user has requested epic analysis, and the meta.json schema should not carry build-time concerns.
- The user sees the full recommendation (including "epic recommended") but can only choose light or standard. This is transparent and non-deceptive.

**Consequences**: If epic is recommended and the user accepts, `sizing_decision.intensity` is `'epic'`, `sizing_decision.effective_intensity` is `'standard'`, and `sizing_decision.epic_deferred` is `true`. Build will see this and can re-offer epic if needed.

**Traces**: FR-002 (AC-002f), CON-004

---

## 3. meta.json Schema Extension

### 3.1 New Field: `sizing_decision`

Added as a top-level field in meta.json. The field is optional -- absence means no sizing decision has been made (legacy or pre-sizing meta.json files).

```json
{
  "source": "github",
  "source_id": "GH-57",
  "slug": "sizing-in-analyze-GH-57",
  "created_at": "2026-02-19T22:10:00Z",
  "analysis_status": "analyzed",
  "phases_completed": ["00-quick-scan", "01-requirements", "02-impact-analysis"],
  "codebase_hash": "abc1234",
  "sizing_decision": {
    "intensity": "light",
    "effective_intensity": "light",
    "recommended_intensity": "light",
    "decided_at": "2026-02-19T23:30:00Z",
    "reason": "user_accepted",
    "user_prompted": true,
    "forced_by_flag": false,
    "overridden": false,
    "overridden_to": null,
    "file_count": 9,
    "module_count": 4,
    "risk_score": "medium",
    "coupling": "medium",
    "coverage_gaps": 0,
    "fallback_source": null,
    "fallback_attempted": false,
    "light_skip_phases": ["03-architecture", "04-design"],
    "epic_deferred": false,
    "context": "analyze"
  }
}
```

### 3.2 Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `intensity` | string | yes | The raw intensity choice: `"light"`, `"standard"`, or `"epic"` |
| `effective_intensity` | string | yes | The applied intensity after deferral: `"light"` or `"standard"` (epic defers to standard) |
| `recommended_intensity` | string | yes | What the algorithm recommended (may differ from `intensity` if user overrode) |
| `decided_at` | ISO 8601 string | yes | Timestamp when the decision was recorded |
| `reason` | string | yes | One of: `"user_accepted"`, `"user_overridden"`, `"light_flag"`, `"sizing_disabled"` |
| `user_prompted` | boolean | yes | `true` if the user saw the menu; `false` if forced by flag or config |
| `forced_by_flag` | boolean | yes | `true` if `-light` flag was used |
| `overridden` | boolean | yes | `true` if the user chose a different intensity than recommended |
| `overridden_to` | string or null | yes | The intensity the user chose if they overrode, else `null` |
| `file_count` | number | yes | From impact analysis metrics (0 if unavailable) |
| `module_count` | number | yes | From impact analysis metrics (0 if unavailable) |
| `risk_score` | string | yes | `"low"`, `"medium"`, or `"high"` (or `"unknown"` if unavailable) |
| `coupling` | string | yes | `"low"`, `"medium"`, `"high"`, or `"unknown"` |
| `coverage_gaps` | number | yes | From impact analysis metrics (0 if unavailable) |
| `fallback_source` | string or null | yes | `"quick-scan"`, `"requirements-spec"`, or `null` if primary parsing succeeded |
| `fallback_attempted` | boolean | yes | `true` if the primary parse failed and fallback was tried |
| `light_skip_phases` | string[] | yes | Phases skipped (from `workflows.json`). Empty array for standard/epic. |
| `epic_deferred` | boolean | yes | `true` if epic was selected but deferred to standard |
| `context` | string | yes | Always `"analyze"` when written by the analyze handler |

### 3.3 Schema Compatibility with Build

The `sizing_decision` schema in meta.json is intentionally a superset of the `active_workflow.sizing` schema in state.json. Shared fields use identical names and types. Fields unique to meta.json:

- `light_skip_phases`: Needed because meta.json does not have a phase array to inspect. Build's `applySizingDecision()` modifies the phase array directly and does not need to record which phases were skipped (it is implicit in the array).
- `context`: Distinguishes analyze-originated decisions from any future build-side meta.json writes.
- `recommended_intensity`: Build stores this in `sizingData.recommended_intensity` but not in the sizing record itself. Including it in meta.json gives build full context when consuming the decision.

### 3.4 Backward Compatibility

- `readMetaJson()` returns whatever is in the file. If `sizing_decision` is absent, it is simply not present in the returned object. No defensive defaults are added for this field (NFR-002, AC-NFR-002a).
- `writeMetaJson()` preserves all fields on the meta object, including `sizing_decision` if present. It does not strip unknown fields (AC-008b).
- Functions that check `meta.sizing_decision` must guard with `if (meta.sizing_decision && ...)` to handle legacy files.

---

## 4. Function Contracts

### 4.1 deriveAnalysisStatus(phasesCompleted, sizingDecision?) -- MODIFIED

**File**: `src/claude/hooks/lib/three-verb-utils.cjs`, lines 151-163

**Current signature**: `deriveAnalysisStatus(phasesCompleted)`
**New signature**: `deriveAnalysisStatus(phasesCompleted, sizingDecision)`

```
FUNCTION deriveAnalysisStatus(phasesCompleted: string[], sizingDecision?: object | null | undefined): 'raw' | 'partial' | 'analyzed'

  IF phasesCompleted is not an array:
    RETURN 'raw'

  completedCount = count of items in phasesCompleted that are in ANALYSIS_PHASES

  IF completedCount === 0:
    RETURN 'raw'

  // --- NEW BLOCK (sizing-aware) ---
  IF sizingDecision is truthy
     AND sizingDecision.effective_intensity === 'light'
     AND Array.isArray(sizingDecision.light_skip_phases):

    requiredPhases = ANALYSIS_PHASES filtered to exclude sizingDecision.light_skip_phases
    allRequiredCompleted = every item in requiredPhases is present in phasesCompleted

    IF allRequiredCompleted:
      RETURN 'analyzed'
  // --- END NEW BLOCK ---

  IF completedCount < ANALYSIS_PHASES.length:
    RETURN 'partial'

  RETURN 'analyzed'
```

**Key properties**:
- When `sizingDecision` is `undefined`, `null`, or falsy: the new block is skipped entirely. Behavior is identical to the current implementation.
- When `sizingDecision` is present with `effective_intensity === 'light'`: the function checks if all non-skipped phases are completed. If yes, returns `'analyzed'`.
- The function remains pure (no I/O, no side effects). FR-007 AC-007d satisfied.

**Traces**: FR-007 (AC-007a, AC-007b, AC-007c, AC-007d)

---

### 4.2 writeMetaJson(slugDir, meta) -- MODIFIED

**File**: `src/claude/hooks/lib/three-verb-utils.cjs`, lines 259-275

**Signature**: Unchanged -- `writeMetaJson(slugDir, meta)`

**Current behavior** (lines 266-272):
```javascript
const completedCount = (meta.phases_completed || []).filter(
    p => ANALYSIS_PHASES.includes(p)
).length;
if (completedCount === 0) meta.analysis_status = 'raw';
else if (completedCount < 5) meta.analysis_status = 'partial';
else meta.analysis_status = 'analyzed';
```

**New behavior**:
```
FUNCTION writeMetaJson(slugDir: string, meta: object): void

  delete meta.phase_a_completed   // Legacy cleanup (existing)

  // Replace inline derivation with function call
  meta.analysis_status = deriveAnalysisStatus(
    meta.phases_completed,
    meta.sizing_decision          // undefined for legacy meta -> backward compat
  )

  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))
```

**Key properties**:
- Sizing decision is preserved because `JSON.stringify(meta, null, 2)` serializes all fields on the meta object. No explicit preservation logic needed.
- When `meta.sizing_decision` is absent (legacy files), `deriveAnalysisStatus(phases, undefined)` behaves identically to the old inline logic.
- Net change: 6 lines of inline logic replaced by 1 function call.

**Traces**: FR-008 (AC-008a, AC-008b, AC-008c)

---

### 4.3 computeStartPhase(meta, workflowPhases) -- MODIFIED

**File**: `src/claude/hooks/lib/three-verb-utils.cjs`, lines 351-414

**Signature**: Unchanged -- `computeStartPhase(meta, workflowPhases)`

**New behavior** -- insert between Step 3 (line 375) and Step 4 (line 378):

```
  // Step 3: No valid phases -> raw
  IF valid.length === 0:
    RETURN { status: 'raw', ... }

  // --- NEW STEP 3.5: Light-sized analysis detection ---
  IF meta.sizing_decision
     AND meta.sizing_decision.effective_intensity === 'light'
     AND Array.isArray(meta.sizing_decision.light_skip_phases):

    skipPhases = meta.sizing_decision.light_skip_phases
    requiredPhases = ANALYSIS_PHASES filtered to exclude skipPhases
    allRequiredPresent = every item in requiredPhases is present in valid

    IF allRequiredPresent:
      // Treat as fully analyzed -- skip to first implementation phase
      firstImplPhase = first phase in workflowPhases not in ANALYSIS_PHASES
      remaining = workflowPhases from firstImplPhase onward,
                  ALSO excluding skipPhases

      RETURN {
        status: 'analyzed',
        startPhase: firstImplPhase,
        completedPhases: valid,          // Only actually-completed phases (00, 01, 02)
        remainingPhases: remaining,       // Excludes 03, 04
        warnings: warnings
      }
  // --- END NEW STEP ---

  // Step 4: All analysis phases complete -> analyzed
  IF valid.length === ANALYSIS_PHASES.length:
    ...existing logic...
```

**Key properties**:
- `completedPhases` contains only the phases that were actually executed (00, 01, 02). NOT the skipped phases. This satisfies FR-009 AC-009c.
- `remainingPhases` excludes both completed phases AND skipped phases. For the standard feature workflow `[00, 01, 02, 03, 04, 05, 06, 16, 08]`, with light sizing skipping 03 and 04, `remainingPhases` is `[05, 06, 16, 08]`. This satisfies FR-009 AC-009d.
- When `meta.sizing_decision` is absent, the new block is skipped. All 25 existing tests pass unchanged. This satisfies NFR-002 AC-NFR-002d.
- The `remaining` computation must also exclude the skip phases from `workflowPhases` to prevent build from trying to execute them. The filter is: `workflowPhases.filter(p => !ANALYSIS_PHASES.includes(p) || valid.includes(p))` -- but since we know valid does not include the skip phases, a simpler filter is: `workflowPhases.filter(p => !skipPhases.includes(p)).slice(from firstImplPhase index)`.

**Implementation note**: The `remainingPhases` filter needs care. The cleanest approach:

```javascript
const skipSet = new Set(skipPhases);
const filteredWorkflow = workflowPhases.filter(p => !skipSet.has(p));
const firstImplPhase = filteredWorkflow.find(p => !ANALYSIS_PHASES.includes(p));
const idx = filteredWorkflow.indexOf(firstImplPhase);
const remaining = idx >= 0 ? filteredWorkflow.slice(idx) : [];
```

**Traces**: FR-009 (AC-009a, AC-009b, AC-009c, AC-009d, AC-009e)

---

## 5. Analyze Handler Modification

### 5.1 Flag Parsing (New Step 2.5)

**Location**: `isdlc.md`, after line 569 (current step 2, before step 3)

The analyze handler currently has no flag parsing. Add a step to parse the `-light` flag:

```
2.5. Parse flags from command arguments:
     - If arguments contain "-light": set lightFlag = true, remove from args
     - Remaining args are the item identifier
```

This mirrors the build handler's flag parsing (lines 265-270 of the feature handler). The implementation is in markdown instructions, not executable code.

**Traces**: FR-006 (AC-006a, AC-006e)

---

### 5.2 Sizing Decision Point (New Step 7.5)

**Location**: `isdlc.md`, inside the phase loop (step 7), after a phase completes and is recorded.

The sizing decision executes as a conditional block within the phase loop, triggered when the just-completed phase is `02-impact-analysis`.

```
DATA FLOW (step 7, after phase completion):

  [Phase completes]
       |
       v
  [7c] Append phase to meta.phases_completed
       |
       v
  [7.5] SIZING TRIGGER CHECK:
       |  phase_key === '02-impact-analysis'
       |  AND meta.sizing_decision is not set
       |  AND this is a feature analysis (not bug fix)
       |
       +-- NO --> [7d] deriveAnalysisStatus(), continue loop
       |
       +-- YES
            |
            v
       [7.5a] IF lightFlag:
            |     Build sizing_decision with forced_by_flag: true
            |     Display forced-light banner
            |     Write meta.json
            |     BREAK loop (skip remaining phases)
            |
            v
       [7.5b] ELSE: Interactive sizing flow
            |
            v
       [7.5b.1] Read impact-analysis.md
            |     parseSizingFromImpactAnalysis(content) -> metrics_or_null
            |
            v
       [7.5b.2] IF metrics_or_null is null:
            |     extractFallbackSizingMetrics(slug, projectRoot) -> { metrics, source }
            |
            v
       [7.5b.3] Read thresholds from workflows.json
            |     computeSizingRecommendation(metrics, thresholds) -> recommendation
            |
            v
       [7.5b.4] Display sizing recommendation banner
            |     (happy path or fallback path, per build format)
            |
            v
       [7.5b.5] Present menu: [A] Accept / [O] Override / [S] Show analysis
            |
            v
       [7.5b.6] Handle choice:
            |     [A] Accept: chosen = recommendation.intensity
            |     [O] Override: present [1] Light [2] Standard (no epic per CON-004)
            |     [S] Show: display impact-analysis.md, return to menu
            |
            v
       [7.5b.7] Build sizing_decision record (see Section 3.1)
            |     Set context: "analyze"
            |     Set light_skip_phases from workflows.json if light
            |     Set epic_deferred if epic recommended and accepted
            |
            v
       [7.5b.8] meta.sizing_decision = sizing_decision
            |     writeMetaJson(slugDir, meta)
            |
            v
       [7.5b.9] IF effective_intensity === 'light':
            |     Display: "Analysis complete (light). {slug} is ready to build.
            |               Phases 03-04 skipped by sizing decision."
            |     BREAK loop (skip remaining phases)
            |     GOTO step 9 (GitHub label sync)
            |
            v
       [7.5b.10] ELSE (standard):
                  Continue loop normally (phases 03, 04 will execute)
```

### 5.3 Modified Exit Path (Step 8)

The current step 8 fires only after the final phase (04-design) completes. With light sizing, the loop may break early after Phase 02. The "Analysis complete" message and GitHub label sync (step 9) must fire on BOTH exit paths:

- **Normal exit** (all phases done): "Analysis complete. {slug} is ready to build." (existing)
- **Light exit** (loop broken after sizing): "Analysis complete (light). {slug} is ready to build. Phases 03-04 skipped by sizing decision." (new, FR-003 AC-003d)

Both paths converge at step 9 (GitHub label sync).

**Traces**: FR-003 (AC-003a, AC-003c, AC-003d), FR-010 (AC-010a, AC-010b)

---

## 6. Data Flow Diagrams

### 6.1 Analyze Sizing -- Full Flow

```
User: /isdlc analyze "sizing-in-analyze-GH-57"
  |
  v
[Parse flags]  -light? ---> lightFlag = true
  |
  v
[resolveItem] --> meta.json
  |
  v
[Determine next phase] --> nextPhase = "00-quick-scan" (or resume point)
  |
  v
[Phase loop]
  |
  +-- Phase 00: Quick Scan agent --> meta.phases_completed += "00-quick-scan"
  |
  +-- Phase 01: Requirements agent --> meta.phases_completed += "01-requirements"
  |
  +-- Phase 02: Impact Analysis agent --> meta.phases_completed += "02-impact-analysis"
  |
  +-- [SIZING TRIGGER]
  |     |
  |     +-- lightFlag? --> auto-accept light --> write meta.json --> EXIT (light)
  |     |
  |     +-- [Read impact-analysis.md]
  |     |     |
  |     |     +-- parseSizingFromImpactAnalysis()  [common.cjs, read-only]
  |     |     |     |
  |     |     |     +-- metrics? --> computeSizingRecommendation()  [common.cjs, read-only]
  |     |     |     |
  |     |     |     +-- null? --> extractFallbackSizingMetrics()  [common.cjs, read-only]
  |     |     |                   |
  |     |     |                   +-- computeSizingRecommendation()
  |     |     |
  |     |     v
  |     +-- [Display banner + menu]
  |     |     |
  |     |     +-- [A] Accept / [O] Override --> chosen intensity
  |     |     |
  |     |     +-- [S] Show analysis --> display, return to menu
  |     |
  |     +-- [Build sizing_decision record]
  |     |     |
  |     |     +-- meta.sizing_decision = record
  |     |     +-- writeMetaJson(slugDir, meta)
  |     |           |
  |     |           +-- deriveAnalysisStatus(phases, sizing_decision)
  |     |                 |
  |     |                 +-- light + 3 phases --> "analyzed"
  |     |                 +-- standard + 3 phases --> "partial"
  |     |
  |     +-- light? --> EXIT (light) --> step 9 (GitHub label sync)
  |     +-- standard? --> continue loop
  |
  +-- Phase 03: Architecture agent --> meta.phases_completed += "03-architecture"
  |     (only if standard)
  |
  +-- Phase 04: Design agent --> meta.phases_completed += "04-design"
  |     (only if standard)
  |
  v
[EXIT (normal)] --> step 9 (GitHub label sync)
```

### 6.2 Build Consuming Light-Sized Analysis

```
User: /isdlc build "sizing-in-analyze-GH-57"
  |
  v
[resolveItem] --> meta.json (with sizing_decision)
  |
  v
[Step 4a: computeStartPhase(meta, featurePhases)]
  |
  +-- meta.phases_completed = ["00-quick-scan", "01-requirements", "02-impact-analysis"]
  +-- meta.sizing_decision.effective_intensity = "light"
  +-- meta.sizing_decision.light_skip_phases = ["03-architecture", "04-design"]
  |
  v
[Step 3.5: Light-sizing detection]
  |
  +-- requiredPhases = ["00-quick-scan", "01-requirements", "02-impact-analysis"]
  +-- allRequiredPresent = true
  |
  v
RETURN {
  status: "analyzed",
  startPhase: "05-test-strategy",
  completedPhases: ["00-quick-scan", "01-requirements", "02-impact-analysis"],
  remainingPhases: ["05-test-strategy", "06-implementation", "16-quality-loop", "08-code-review"],
  warnings: []
}
  |
  v
[Build proceeds from Phase 05]
  |
  +-- STEP 3e-sizing trigger check:
  |     phase_key !== '02-impact-analysis' (build starts at 05)
  |     --> sizing block skipped (correct -- sizing already recorded in meta.json)
  |
  v
[Normal build flow: 05 -> 06 -> 16 -> 08]
```

### 6.3 Function Call Graph (Modified Functions Only)

```
isdlc.md analyze handler
  |
  +-- readMetaJson(slugDir)                              [existing, no change]
  |
  +-- parseSizingFromImpactAnalysis(content)              [common.cjs, read-only]
  +-- extractFallbackSizingMetrics(slug, projectRoot)     [common.cjs, read-only]
  +-- computeSizingRecommendation(metrics, thresholds)    [common.cjs, read-only]
  |
  +-- writeMetaJson(slugDir, meta)                        [MODIFIED]
  |     |
  |     +-- deriveAnalysisStatus(phases, sizing_decision)  [MODIFIED]
  |
  +-- updateBacklogMarker(backlogPath, slug, marker)      [existing, no change]
       |
       +-- deriveBacklogMarker(analysisStatus)            [existing, no change]

isdlc.md build handler
  |
  +-- computeStartPhase(meta, featurePhases)              [MODIFIED]
       |
       +-- validatePhasesCompleted(meta.phases_completed)  [existing, no change]
```

---

## 7. Integration Points

### 7.1 Analyze Handler <-> common.cjs (Read-Only)

The analyze handler calls three pure functions from `common.cjs`:

| Function | Input | Output | Side Effects |
|----------|-------|--------|--------------|
| `parseSizingFromImpactAnalysis(content)` | String (impact-analysis.md content) | `{ file_count, module_count, risk_score, coupling, coverage_gaps }` or `null` | None |
| `computeSizingRecommendation(metrics, thresholds)` | Metrics object + thresholds object | `{ intensity, rationale, metrics }` | None |
| `extractFallbackSizingMetrics(artifactFolder, projectRoot)` | String + String | `{ metrics, source }` | Reads files (read-only I/O) |

These functions are already exported from `common.cjs` and tested. No modifications needed.

### 7.2 Analyze Handler <-> three-verb-utils.cjs

| Function | Caller Action | Change Required |
|----------|---------------|-----------------|
| `readMetaJson(slugDir)` | Read meta at start of analyze | None -- already returns full meta object |
| `writeMetaJson(slugDir, meta)` | Write meta after sizing decision | Yes -- internal derivation change (ADR-004) |
| `deriveAnalysisStatus(phases, sizing)` | Called by writeMetaJson internally; also called directly in step 7d | Yes -- new optional parameter (ADR-002) |

### 7.3 Build Handler <-> three-verb-utils.cjs

| Function | Caller Action | Change Required |
|----------|---------------|-----------------|
| `computeStartPhase(meta, featurePhases)` | Auto-detect start phase for build | Yes -- new light-sizing branch (ADR-003) |

### 7.4 Cross-Verb Data Flow (Analyze -> Build)

The analyze verb writes `sizing_decision` to `meta.json`. The build verb reads it via `computeStartPhase(meta, workflowPhases)`, which receives the full meta object from `readMetaJson()`. The data flows through existing file I/O -- no new IPC or shared memory mechanism is needed.

```
ANALYZE                              BUILD
  |                                    |
  +-- writeMetaJson() -->  meta.json  --> readMetaJson() --> computeStartPhase()
        |                                                       |
        +-- sizing_decision                                     +-- reads meta.sizing_decision
```

---

## 8. Error Handling

### 8.1 Impact Analysis File Missing

If `impact-analysis.md` does not exist when the sizing trigger fires (e.g., Phase 02 agent failed to write it), the handler follows the same fallback chain as build:

1. `parseSizingFromImpactAnalysis()` called with null content -> returns null
2. `extractFallbackSizingMetrics(slug, projectRoot)` called -> attempts quick-scan.md, then requirements-spec.md
3. If all fallbacks fail, `computeSizingRecommendation(null, thresholds)` returns `{ intensity: 'standard', rationale: 'Unable to parse...' }`

The user sees the fallback warning banner and can still make a manual choice. No error is thrown.

### 8.2 writeMetaJson Failure

If `writeMetaJson()` throws (e.g., permissions error), the sizing decision is lost but the analyze handler can catch and report the error. The analyze loop should NOT continue past the sizing point if the write fails -- the user should be informed.

### 8.3 Malformed sizing_decision in meta.json

If a `sizing_decision` field exists but is malformed (e.g., `sizing_decision: "light"` instead of an object), all guard conditions (`meta.sizing_decision && meta.sizing_decision.effective_intensity === 'light'`) will fail, and the function falls through to the existing logic. This is safe by default (Article X: Fail-Safe Defaults).

### 8.4 Concurrent Access

meta.json is a simple file. If two analyze sessions write to the same slug concurrently, the last writer wins. This is acceptable because:
- Analyze is an interactive, single-user operation
- The same item should not be analyzed concurrently
- No locking mechanism exists or is needed

---

## 9. Implementation Order

Based on dependency analysis from the impact analysis, the recommended implementation order is:

```
[1] deriveAnalysisStatus()        -- Foundation for all status derivation
     |
     v
[2] writeMetaJson()               -- Depends on [1]; eliminates inline duplication
     |
     v
[3] computeStartPhase()           -- Independent of [1]/[2] but shares sizing_decision schema
     |
     v
[4] Tests for [1], [2], [3]       -- Verify utility changes before handler integration
     |
     v
[5] isdlc.md: flag parsing        -- Foundation for handler changes
     |
     v
[6] isdlc.md: sizing decision     -- Depends on all utility changes being correct
     |
     v
[7] Integration tests             -- End-to-end validation
```

Steps [1] and [3] can be parallelized (no dependency between them). Step [2] depends on [1]. Steps [5] and [6] depend on all utility changes.

---

## 10. Test Strategy Overview

### 10.1 Unit Tests (P0)

All in `test-three-verb-utils.test.cjs`:

| Test | Input | Expected Output | Traces |
|------|-------|-----------------|--------|
| `deriveAnalysisStatus([00,01,02], { effective_intensity: 'light', light_skip_phases: [03,04] })` | 3 phases + light sizing | `'analyzed'` | FR-007 AC-007b |
| `deriveAnalysisStatus([00,01,02], null)` | 3 phases + no sizing | `'partial'` | FR-007 AC-007c |
| `deriveAnalysisStatus([00,01,02], undefined)` | 3 phases + undefined | `'partial'` | FR-007 AC-007c |
| `deriveAnalysisStatus([00,01,02], { effective_intensity: 'standard' })` | 3 phases + standard sizing | `'partial'` | FR-007 logic |
| `deriveAnalysisStatus([00,01,02,03,04], { effective_intensity: 'light', light_skip_phases: [03,04] })` | 5 phases + light sizing (unusual) | `'analyzed'` | Edge case |
| `writeMetaJson()` with sizing_decision | Meta with sizing_decision | sizing_decision preserved in file; status = 'analyzed' | FR-008 AC-008a, AC-008b |
| `writeMetaJson()` without sizing_decision | Legacy meta | Same behavior as before | NFR-002 AC-NFR-002b |
| `computeStartPhase()` with light-sized meta (3 phases) | Meta with sizing_decision.effective_intensity='light' | `{ status: 'analyzed', startPhase: '05-test-strategy' }` | FR-009 AC-009b |
| `computeStartPhase()` with light-sized meta returns correct remainingPhases | Same | `['05-test-strategy', '06-implementation', '16-quality-loop', '08-code-review']` | FR-009 AC-009d |
| `computeStartPhase()` without sizing_decision | Legacy meta with 3 phases | `{ status: 'partial' }` | NFR-002 AC-NFR-002d |
| meta.json round-trip: write sizing_decision, read back | Meta with sizing_decision | sizing_decision identical after round-trip | FR-005 AC-005a |

### 10.2 Negative Tests (P1)

| Test | Input | Expected Output | Traces |
|------|-------|-----------------|--------|
| `deriveAnalysisStatus([00,01], { effective_intensity: 'light', light_skip_phases: [03,04] })` | Only 2 phases but light sizing | `'partial'` (missing 02) | Edge case |
| `computeStartPhase()` with sizing_decision but wrong effective_intensity | `{ effective_intensity: 'standard', ... }` | Falls through to existing partial logic | Guard |
| `computeStartPhase()` with sizing_decision but missing light_skip_phases | `{ effective_intensity: 'light' }` (no array) | Falls through to existing partial logic | Guard |

### 10.3 Sizing Consent Tests (sizing-consent.test.cjs)

| Test | Purpose | Traces |
|------|---------|--------|
| Verify `applySizingDecision()` is NOT imported/called by analyze paths | Constraint enforcement | NFR-001, CON-002 |
| Verify `sizing_decision.context === 'analyze'` in written record | Context field correctness | FR-005 AC-005b |

---

## 11. Security Considerations

### 11.1 No New Attack Surface

The sizing decision is a user-facing menu choice stored in a local file (meta.json). It does not:
- Accept external input beyond the user's menu selection
- Communicate over the network
- Execute arbitrary code
- Modify authentication or authorization state

### 11.2 Fail-Safe Defaults (Article X)

- If sizing_decision is absent, all functions behave as before (deny sizing benefits by default)
- If sizing_decision is malformed, guard conditions fail and functions fall through to existing logic
- If metrics parsing fails, the sizing recommendation defaults to standard (the most conservative option)
- Epic intensity is denied in analyze context (cannot bypass the stateless constraint)

---

## 12. Affected Files Summary

| # | File | Change Type | Lines Changed (est.) | Requirements |
|---|------|-------------|---------------------|--------------|
| 1 | `src/claude/hooks/lib/three-verb-utils.cjs` | MODIFY | ~30 lines (across 3 functions) | FR-007, FR-008, FR-009, NFR-002 |
| 2 | `src/claude/commands/isdlc.md` | MODIFY | ~70 lines (new step 2.5 + step 7.5) | FR-001, FR-002, FR-003, FR-004, FR-006, FR-010 |
| 3 | `src/claude/hooks/tests/test-three-verb-utils.test.cjs` | MODIFY | ~80 lines (new test cases) | FR-005, FR-007, FR-008, FR-009, NFR-002 |
| 4 | `src/claude/hooks/tests/sizing-consent.test.cjs` | MODIFY | ~15 lines (context field test) | FR-005 |
| 5 | `src/isdlc/config/workflows.json` | VERIFY-ONLY | 0 | FR-003 |
| 6 | `src/claude/hooks/lib/common.cjs` | NO CHANGE | 0 | -- |

**Total estimated lines changed**: ~195

---

## 13. Decisions Deferred to Phase 04 (Design)

1. **Exact markdown wording** for the sizing banners and menu prompts in the analyze handler. Architecture defines the structure; design specifies the exact text.
2. **Exit point handling** for step 7h: whether the "Continue to Phase 03?" exit point should appear BEFORE or AFTER the sizing menu. Architecture says sizing fires first (step 7.5 before 7h), but the exact UX sequencing is a design concern.
3. **Test file organization**: Whether new tests for the 2-arg `deriveAnalysisStatus()` go in an existing describe block or a new one.

---

*Architecture completed in ANALYSIS MODE -- no state.json writes, no branches created.*
