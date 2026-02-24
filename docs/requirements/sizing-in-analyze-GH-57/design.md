# Design Specification: Sizing Decision in Analyze Verb

**Generated**: 2026-02-19
**Feature**: GH-57 -- Add sizing decision to the analyze verb
**Phase**: 04-design
**Mode**: ANALYSIS MODE (no state.json writes, no branches)
**Input**: requirements-spec.md (10 FRs, 5 NFRs), impact-analysis.md (9 files), architecture.md (5 ADRs)

---

## 1. Pseudocode for Each Modified Function

### 1.1 deriveAnalysisStatus(phasesCompleted, sizingDecision?)

**File**: `src/claude/hooks/lib/three-verb-utils.cjs`, lines 151-163
**ADR**: ADR-002 (optional parameter, pure function preserved)
**Traces**: FR-007 (AC-007a through AC-007d)

**Current signature**: `deriveAnalysisStatus(phasesCompleted)`
**New signature**: `deriveAnalysisStatus(phasesCompleted, sizingDecision)`

```
FUNCTION deriveAnalysisStatus(phasesCompleted, sizingDecision):

    // Guard: non-array input -> raw (unchanged)
    IF NOT Array.isArray(phasesCompleted):
        RETURN 'raw'

    // Count only recognized analysis phases
    completedCount = phasesCompleted.filter(p => ANALYSIS_PHASES.includes(p)).length

    // No phases completed -> raw (unchanged)
    IF completedCount === 0:
        RETURN 'raw'

    // --- NEW: Sizing-aware "analyzed" detection ---
    // When a light sizing decision exists, check if all REQUIRED phases
    // (those NOT in the skip list) are complete.
    IF sizingDecision IS truthy
       AND sizingDecision.effective_intensity === 'light'
       AND Array.isArray(sizingDecision.light_skip_phases):

        skipSet = new Set(sizingDecision.light_skip_phases)
        requiredPhases = ANALYSIS_PHASES.filter(p => NOT skipSet.has(p))
        allRequiredCompleted = requiredPhases.every(p => phasesCompleted.includes(p))

        IF allRequiredCompleted:
            RETURN 'analyzed'
    // --- END NEW ---

    // Standard path (unchanged): fewer than all 5 -> partial, all 5 -> analyzed
    IF completedCount < ANALYSIS_PHASES.length:
        RETURN 'partial'

    RETURN 'analyzed'
```

**JavaScript implementation** (drop-in replacement for lines 151-163):

```javascript
function deriveAnalysisStatus(phasesCompleted, sizingDecision) {
    if (!Array.isArray(phasesCompleted)) {
        return 'raw';
    }

    const completedCount = phasesCompleted.filter(
        p => ANALYSIS_PHASES.includes(p)
    ).length;

    if (completedCount === 0) return 'raw';

    // Sizing-aware: light intensity with skip list means fewer phases required
    if (sizingDecision
        && sizingDecision.effective_intensity === 'light'
        && Array.isArray(sizingDecision.light_skip_phases)) {
        const skipSet = new Set(sizingDecision.light_skip_phases);
        const required = ANALYSIS_PHASES.filter(p => !skipSet.has(p));
        if (required.every(p => phasesCompleted.includes(p))) {
            return 'analyzed';
        }
    }

    if (completedCount < ANALYSIS_PHASES.length) return 'partial';
    return 'analyzed';
}
```

**Key behavioral properties**:
- When `sizingDecision` is `undefined` (all 14 existing call sites): the new block is entirely skipped. Return values are identical to the current implementation.
- When `sizingDecision` is `null`: the truthy check fails, block skipped. Same as current.
- When `sizingDecision.effective_intensity` is `'standard'`: the equality check fails, block skipped. Falls through to existing logic.
- When `sizingDecision.effective_intensity` is `'light'` and `light_skip_phases` is not an array (malformed): `Array.isArray` check fails, block skipped. Fail-safe.
- The function remains pure: no I/O, no side effects, deterministic. (FR-007 AC-007d)

---

### 1.2 writeMetaJson(slugDir, meta) -- Updated Derivation

**File**: `src/claude/hooks/lib/three-verb-utils.cjs`, lines 259-275
**ADR**: ADR-004 (delegate to deriveAnalysisStatus, eliminate duplication)
**Traces**: FR-008 (AC-008a, AC-008b, AC-008c)

**Signature**: Unchanged -- `writeMetaJson(slugDir, meta)`

```
FUNCTION writeMetaJson(slugDir, meta):

    metaPath = path.join(slugDir, 'meta.json')

    // Remove legacy field (unchanged)
    DELETE meta.phase_a_completed

    // CHANGED: Replace 6 lines of inline derivation with function call.
    // Passes meta.sizing_decision (undefined for legacy meta -> backward compat).
    meta.analysis_status = deriveAnalysisStatus(
        meta.phases_completed,
        meta.sizing_decision       // undefined when absent -> no sizing effect
    )

    // Write (unchanged). JSON.stringify preserves all fields including sizing_decision.
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))
```

**JavaScript implementation** (drop-in replacement for lines 259-275):

```javascript
function writeMetaJson(slugDir, meta) {
    const metaPath = path.join(slugDir, 'meta.json');

    // Never write legacy field
    delete meta.phase_a_completed;

    // Derive analysis_status from phases_completed (sizing-aware)
    meta.analysis_status = deriveAnalysisStatus(
        meta.phases_completed,
        meta.sizing_decision
    );

    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
}
```

**Key behavioral properties**:
- Net reduction: 6 lines of inline logic replaced by 1 function call.
- When `meta.sizing_decision` is absent (legacy files): `deriveAnalysisStatus(phases, undefined)` produces identical results to the old inline logic. Verified by: 0 phases = 'raw', 1-4 = 'partial', 5 = 'analyzed'.
- `sizing_decision` is preserved in the written file because `JSON.stringify(meta, null, 2)` serializes all own properties. No explicit preservation needed (AC-008b).
- Backward compatibility: existing tests (6 test cases) pass without modification because they never set `sizing_decision` on the meta object, and `undefined` triggers the old code path.

---

### 1.3 computeStartPhase(meta, workflowPhases) -- New Light-Sizing Branch

**File**: `src/claude/hooks/lib/three-verb-utils.cjs`, lines 351-414
**ADR**: ADR-003 (reads meta.sizing_decision directly, no signature change)
**Traces**: FR-009 (AC-009a through AC-009e)

**Signature**: Unchanged -- `computeStartPhase(meta, workflowPhases)`

```
FUNCTION computeStartPhase(meta, workflowPhases):

    // Step 1: Handle null/non-object meta (unchanged, line 353)
    IF meta is null/undefined/non-object/array:
        RETURN { status: 'raw', startPhase: null, completedPhases: [], remainingPhases: [...workflowPhases], warnings: [] }

    // Step 2: Validate phases_completed (unchanged, line 364)
    { valid, warnings } = validatePhasesCompleted(meta.phases_completed)

    // Step 3: No valid phases -> raw (unchanged, line 367)
    IF valid.length === 0:
        RETURN { status: 'raw', startPhase: null, completedPhases: [], remainingPhases: [...workflowPhases], warnings }

    // --- NEW STEP 3.5: Light-sized analysis detection ---
    IF meta.sizing_decision IS truthy
       AND meta.sizing_decision.effective_intensity === 'light'
       AND Array.isArray(meta.sizing_decision.light_skip_phases):

        skipPhases = meta.sizing_decision.light_skip_phases
        skipSet = new Set(skipPhases)

        // Check: are all required (non-skipped) analysis phases completed?
        requiredAnalysis = ANALYSIS_PHASES.filter(p => NOT skipSet.has(p))
        allRequiredPresent = requiredAnalysis.every(p => valid.includes(p))

        IF allRequiredPresent:
            // Build remaining phases: exclude both completed and skipped
            filteredWorkflow = workflowPhases.filter(p => NOT skipSet.has(p))
            firstImplPhase = filteredWorkflow.find(p => NOT ANALYSIS_PHASES.includes(p))

            IF firstImplPhase IS undefined:
                // Edge case: workflow has no implementation phases after filtering
                RETURN { status: 'analyzed', startPhase: null, completedPhases: valid, remainingPhases: [], warnings }

            idx = filteredWorkflow.indexOf(firstImplPhase)
            remaining = filteredWorkflow.slice(idx)

            RETURN {
                status: 'analyzed',
                startPhase: firstImplPhase,
                completedPhases: valid,           // Only actually-completed phases (00, 01, 02)
                remainingPhases: remaining,        // Excludes skipped phases (03, 04)
                warnings: warnings
            }
    // --- END NEW STEP 3.5 ---

    // Step 4: All analysis phases complete -> analyzed (unchanged, line 378)
    IF valid.length === ANALYSIS_PHASES.length:
        ...existing code...

    // Step 5: Partial analysis (unchanged, line 401)
    ...existing code...
```

**JavaScript implementation** (insert between line 375 and line 377):

```javascript
    // Step 3.5: Light-sized analysis detection (GH-57, FR-009)
    if (meta.sizing_decision
        && meta.sizing_decision.effective_intensity === 'light'
        && Array.isArray(meta.sizing_decision.light_skip_phases)) {
        const skipSet = new Set(meta.sizing_decision.light_skip_phases);
        const requiredAnalysis = ANALYSIS_PHASES.filter(p => !skipSet.has(p));
        const allRequiredPresent = requiredAnalysis.every(p => valid.includes(p));

        if (allRequiredPresent) {
            const filteredWorkflow = workflowPhases.filter(p => !skipSet.has(p));
            const firstImplPhase = filteredWorkflow.find(p => !ANALYSIS_PHASES.includes(p));
            if (firstImplPhase === undefined) {
                return {
                    status: 'analyzed',
                    startPhase: null,
                    completedPhases: valid,
                    remainingPhases: [],
                    warnings
                };
            }
            const idx = filteredWorkflow.indexOf(firstImplPhase);
            const remaining = filteredWorkflow.slice(idx);
            return {
                status: 'analyzed',
                startPhase: firstImplPhase,
                completedPhases: valid,
                remainingPhases: remaining,
                warnings
            };
        }
    }
```

**Key behavioral properties**:
- `completedPhases` contains ONLY the phases that were actually executed (e.g., `[00, 01, 02]`), NOT the skipped phases. (AC-009c)
- `remainingPhases` excludes both completed phases and skipped phases. For FEATURE_PHASES with light sizing: `['05-test-strategy', '06-implementation', '16-quality-loop', '08-code-review']`. (AC-009d)
- When `meta.sizing_decision` is absent (all 25 existing test cases): the new block is skipped entirely. All existing tests pass unchanged. (NFR-002 AC-NFR-002d)
- Placement between Step 3 and Step 4 ensures: 0 valid phases still returns 'raw' (Step 3), 5 valid phases still returns 'analyzed' via existing Step 4, and the new branch catches the specific case of `valid.length < 5` with a valid light sizing decision.
- Cyclomatic complexity increases from 5 to 6 branches (one new conditional).

---

### 1.4 Analyze Handler: -light Flag Parsing + Sizing Decision Block

**File**: `src/claude/commands/isdlc.md`, lines 563-600
**ADR**: ADR-001 (inline sizing logic), ADR-005 (no epic in analyze)
**Traces**: FR-001, FR-002, FR-003, FR-004, FR-006, FR-010

#### 1.4.1 New Step 2.5: Flag Parsing

Insert after step 2 ("Does NOT write to state.json") and before step 3 ("Resolve target item"):

```
2.5. Parse flags from command arguments:
     args = user input arguments (the text after "/isdlc analyze")
     lightFlag = false

     IF args contains "-light":
         lightFlag = true
         args = args with "-light" removed (preserve remaining text as item identifier)

     item_input = args.trim()
```

This mirrors the build handler flag parsing pattern (isdlc.md lines 265-270). The `-light` flag is consumed before `resolveItem()` sees the input.

#### 1.4.2 New Step 7.5: Sizing Decision Point

Insert inside step 7, after a phase completes and is recorded (after step 7c "Append phase key"), but BEFORE step 7d (deriveAnalysisStatus) and step 7h (exit point).

The sizing trigger fires when ALL of these conditions are true:
1. The just-completed phase key === '02-impact-analysis'
2. meta.sizing_decision is NOT already set (prevents double-sizing on resume)
3. This is a feature analysis (not a bug fix -- no bug-fix items reach Phase 02 via analyze)

```
7.5  SIZING TRIGGER CHECK (after step 7c, before step 7d)
     IF phase_key === '02-impact-analysis' AND meta.sizing_decision IS NOT set:

         // --- PATH A: -light flag (forced) ---
         IF lightFlag === true:

             // Read skip phases from config
             light_skip_phases = workflows.json -> workflows.feature.sizing.light_skip_phases
                 fallback: ["03-architecture", "04-design"]

             // Build sizing_decision record
             sizing_decision = {
                 intensity: "light",
                 effective_intensity: "light",
                 recommended_intensity: null,        // No recommendation computed
                 decided_at: new Date().toISOString(),
                 reason: "light_flag",
                 user_prompted: false,
                 forced_by_flag: true,
                 overridden: false,
                 overridden_to: null,
                 file_count: 0,
                 module_count: 0,
                 risk_score: "unknown",
                 coupling: "unknown",
                 coverage_gaps: 0,
                 fallback_source: null,
                 fallback_attempted: false,
                 light_skip_phases: light_skip_phases,
                 epic_deferred: false,
                 context: "analyze"
             }

             // Write to meta
             meta.sizing_decision = sizing_decision
             writeMetaJson(slugDir, meta)

             // Display forced-light banner
             DISPLAY:
                 +----------------------------------------------------------+
                 |  ANALYSIS SIZING: Light (forced via -light flag)          |
                 |                                                           |
                 |  Skipping phases:                                         |
                 |    - Phase 03: Architecture                               |
                 |    - Phase 04: Design                                     |
                 |                                                           |
                 |  Analysis: 00 -> 01 -> 02 -> done                        |
                 +----------------------------------------------------------+

             // Update BACKLOG.md marker (analysis_status is now "analyzed")
             marker = deriveBacklogMarker(meta.analysis_status)
             updateBacklogMarker(backlogPath, slug, marker)

             // Display completion message
             DISPLAY: "Analysis complete (light). {slug} is ready to build.
                       Phases 03-04 skipped by sizing decision."

             // BREAK out of phase loop -> proceed to step 9 (GitHub label sync)
             GOTO step_9

         // --- PATH B: Interactive sizing flow ---
         ELSE:

             // B.1 Read impact-analysis.md
             iaPath = docs/requirements/{slug}/impact-analysis.md
             TRY:
                 iaContent = read file at iaPath
             CATCH:
                 iaContent = null

             // B.2 Parse metrics (primary path)
             metrics = null
             source = null
             ia_reason = null

             IF iaContent IS NOT null:
                 metrics = parseSizingFromImpactAnalysis(iaContent)
                 IF metrics IS null:
                     ia_reason = 'ia_parse_failed'

             ELSE:
                 ia_reason = 'ia_file_missing'

             // B.3 Fallback path (if primary parsing failed)
             IF metrics IS null:
                 { metrics: fallbackMetrics, source: fallbackSource } =
                     extractFallbackSizingMetrics(slug, projectRoot)
                 metrics = fallbackMetrics    // May still be null
                 source = fallbackSource

             // B.4 Read thresholds from config
             thresholds = workflows.json -> workflows.feature.sizing.thresholds
                 fallback: { light_max_files: 5, epic_min_files: 20 }

             // B.5 Compute recommendation
             recommendation = computeSizingRecommendation(metrics, thresholds)

             // B.6 Display sizing recommendation banner
             IF ia_reason IS NOT null (fallback path):
                 DISPLAY:
                     +----------------------------------------------------------+
                     |  WARNING: Impact analysis metrics unavailable             |
                     |                                                           |
                     |  Could not extract sizing metrics from impact-analysis.md |
                     |  {IF source: "Partial metrics from: {source}.md"}         |
                     |  {IF NOT source: "No metrics available"}                  |
                     |                                                           |
                     |  Recommended: {recommendation.intensity}                  |
                     |  Rationale: {recommendation.rationale}                    |
                     +----------------------------------------------------------+

             ELSE (happy path):
                 DISPLAY:
                     +----------------------------------------------------------+
                     |  ANALYSIS SIZING RECOMMENDATION                           |
                     |                                                           |
                     |  Recommended: {recommendation.intensity (UPPERCASE)}      |
                     |  Rationale: {recommendation.rationale}                    |
                     |                                                           |
                     |  Impact Analysis Summary:                                 |
                     |    Files affected:  {metrics.file_count}                  |
                     |    Modules:         {metrics.module_count}                |
                     |    Risk level:      {metrics.risk_score}                  |
                     |    Coupling:        {metrics.coupling}                    |
                     |    Coverage gaps:   {metrics.coverage_gaps}               |
                     +----------------------------------------------------------+

             // B.7 Present user menu
             MENU_LOOP:
                 Present: [A] Accept recommendation
                          [O] Override (choose different intensity)
                          [S] Show impact analysis

                 HANDLE choice:

                 [A] Accept:
                     chosen_intensity = recommendation.intensity
                     overridden = false
                     overridden_to = null
                     reason = ia_reason OR 'user_accepted'

                 [O] Override:
                     Present intensity picker:
                         [1] Light
                         [2] Standard
                         (Epic requires build workflow for budget tracking)
                     chosen_intensity = user's pick
                     overridden = true
                     overridden_to = chosen_intensity
                     reason = 'user_overridden'

                 [S] Show analysis:
                     IF ia_reason (fallback path):
                         Display fallback source file contents OR "No diagnostic info available"
                     ELSE:
                         Display full impact-analysis.md content
                     GOTO MENU_LOOP   // Return to menu

             // B.8 Handle epic deferral (CON-004, ADR-005)
             effective_intensity = chosen_intensity
             epic_deferred = false
             IF chosen_intensity === 'epic':
                 effective_intensity = 'standard'
                 epic_deferred = true
                 DISPLAY: "Epic intensity deferred to standard in analyze context.
                           Build can re-offer epic with budget tracking."

             // B.9 Read light_skip_phases from config
             light_skip_phases = []
             IF effective_intensity === 'light':
                 light_skip_phases = workflows.json -> workflows.feature.sizing.light_skip_phases
                     fallback: ["03-architecture", "04-design"]

             // B.10 Build sizing_decision record
             sizing_decision = {
                 intensity: chosen_intensity,
                 effective_intensity: effective_intensity,
                 recommended_intensity: recommendation.intensity,
                 decided_at: new Date().toISOString(),
                 reason: reason,
                 user_prompted: true,
                 forced_by_flag: false,
                 overridden: overridden,
                 overridden_to: overridden_to,
                 file_count: metrics ? metrics.file_count : 0,
                 module_count: metrics ? metrics.module_count : 0,
                 risk_score: metrics ? metrics.risk_score : "unknown",
                 coupling: metrics ? metrics.coupling : "unknown",
                 coverage_gaps: metrics ? metrics.coverage_gaps : 0,
                 fallback_source: source,
                 fallback_attempted: ia_reason !== null,
                 light_skip_phases: light_skip_phases,
                 epic_deferred: epic_deferred,
                 context: "analyze"
             }

             // B.11 Write to meta (NOT applySizingDecision -- CON-002, NFR-001)
             meta.sizing_decision = sizing_decision
             writeMetaJson(slugDir, meta)

             // B.12 Handle light exit
             IF effective_intensity === 'light':
                 // Update BACKLOG.md marker
                 marker = deriveBacklogMarker(meta.analysis_status)
                 updateBacklogMarker(backlogPath, slug, marker)

                 DISPLAY: "Analysis complete (light). {slug} is ready to build.
                           Phases 03-04 skipped by sizing decision."

                 GOTO step_9   // GitHub label sync

             // B.13 Handle standard/epic-deferred: continue loop
             ELSE:
                 // Continue the phase loop normally. Phases 03, 04 will execute.
                 // Step 7d (deriveAnalysisStatus) and 7f (writeMetaJson) will now
                 // see sizing_decision in meta but since effective_intensity is
                 // 'standard', it will not affect status until all 5 phases complete.
                 CONTINUE loop
```

**Critical constraints observed**:
- `applySizingDecision()` is NEVER called (CON-002, NFR-001). The sizing_decision record is built inline and written via `writeMetaJson()`.
- `state.json` is NEVER read or written (NFR-001).
- The 3 pure functions from `common.cjs` (`parseSizingFromImpactAnalysis`, `computeSizingRecommendation`, `extractFallbackSizingMetrics`) are called read-only.
- Epic is excluded from the override picker (CON-004, ADR-005). Only `[1] Light  [2] Standard` are presented.

---

## 2. Control Flow Diagrams

### 2.1 Analyze Flow with Sizing Decision Point

```
/isdlc analyze [-light] "item"
        |
        v
  [2.5] Parse flags ---------> lightFlag = true/false
        |
        v
  [3] resolveItem(input)
        |
        v
  [4] readMetaJson()
        |
        v
  [5] Determine nextPhase
        |
        v
  [6] All phases done? ---YES--> [staleness check / "already complete"]
        |
       NO
        |
        v
  [7] PHASE LOOP: for each remaining phase
        |
        +---> [7a] Display "Running Phase NN..."
        |
        +---> [7b] Delegate to phase agent (ANALYSIS MODE)
        |
        +---> [7c] Append phase_key to meta.phases_completed
        |
        +---> [7.5] SIZING TRIGGER CHECK
        |       |
        |       +-- phase_key !== '02-impact-analysis'? ---> SKIP (go to 7d)
        |       |
        |       +-- meta.sizing_decision already set? -----> SKIP (go to 7d)
        |       |
        |       +-- TRIGGER FIRES
        |            |
        |            +-- lightFlag? ---> PATH A (forced)
        |            |                      |
        |            |                      +-> Build sizing_decision (forced)
        |            |                      +-> writeMetaJson()
        |            |                      +-> Display forced banner
        |            |                      +-> Display "Analysis complete (light)"
        |            |                      +-> BREAK loop --> step 9
        |            |
        |            +-- ELSE -----------> PATH B (interactive)
        |                                   |
        |                                   +-> Parse metrics / fallback
        |                                   +-> Compute recommendation
        |                                   +-> Display banner
        |                                   +-> Present menu [A]/[O]/[S]
        |                                   +-> Build sizing_decision record
        |                                   +-> writeMetaJson()
        |                                   |
        |                                   +-- light? --> BREAK loop --> step 9
        |                                   |
        |                                   +-- standard? --> CONTINUE loop
        |
        +---> [7d] deriveAnalysisStatus(phases, sizing_decision)
        |
        +---> [7e] Update codebase_hash
        |
        +---> [7f] writeMetaJson(slugDir, meta)
        |
        +---> [7g] updateBacklogMarker()
        |
        +---> [7h] Exit point: "Continue to Phase NN+1? [Y/n]"
        |           |
        |           +-- No? --> STOP (resumable)
        |           |
        |           +-- Yes? --> next iteration
        |
        v
  [8] "Analysis complete. {slug} is ready to build."
        |
        v
  [9] GitHub label sync: gh issue edit N --add-label ready-to-build
```

### 2.2 deriveAnalysisStatus() Decision Tree

```
deriveAnalysisStatus(phasesCompleted, sizingDecision)
        |
        v
  Array.isArray(phasesCompleted)?
        |
       NO ----> RETURN 'raw'
        |
       YES
        |
        v
  completedCount = count of phasesCompleted in ANALYSIS_PHASES
        |
        v
  completedCount === 0?
        |
       YES ----> RETURN 'raw'
        |
       NO
        |
        v
  sizingDecision truthy?
        |
       NO ----+
        |      |
       YES     |
        |      |
        v      |
  effective_intensity === 'light'?
        |      |
       NO --+  |
        |   |  |
       YES  |  |
        |   |  |
        v   |  |
  Array.isArray(light_skip_phases)?
        |   |  |
       NO --+  |
        |   |  |
       YES  |  |
        |   |  |
        v   |  |
  required = ANALYSIS_PHASES - skip list
  all required in phasesCompleted?
        |   |  |
       NO --+  |
        |   |  |
       YES  |  |
        |   |  |
        v   |  |
  RETURN 'analyzed'
            |  |
            v  v
  completedCount < ANALYSIS_PHASES.length (5)?
        |
       YES ----> RETURN 'partial'
        |
       NO -----> RETURN 'analyzed'
```

### 2.3 computeStartPhase() with Sizing Awareness

```
computeStartPhase(meta, workflowPhases)
        |
        v
  meta is null/undefined/non-object/array?
        |
       YES ----> RETURN { status: 'raw', startPhase: null, ... }
        |
       NO
        |
        v
  { valid, warnings } = validatePhasesCompleted(meta.phases_completed)
        |
        v
  valid.length === 0?
        |
       YES ----> RETURN { status: 'raw', startPhase: null, ... }
        |
       NO
        |
        v
  [STEP 3.5] meta.sizing_decision truthy?
        |
       NO ----+
        |      |
       YES     |
        |      |
        v      |
  effective_intensity === 'light'?
        |      |
       NO --+  |
        |   |  |
       YES  |  |
        |   |  |
        v   |  |
  Array.isArray(light_skip_phases)?
        |   |  |
       NO --+  |
        |   |  |
       YES  |  |
        |   |  |
        v   |  |
  required = ANALYSIS_PHASES - skip list
  all required in valid?
        |   |  |
       NO --+  |
        |   |  |
       YES  |  |
        |   |  |
        v   |  |
  filteredWorkflow = workflowPhases without skipPhases
  firstImplPhase = first non-analysis phase in filteredWorkflow
  remaining = filteredWorkflow from firstImplPhase onward
        |   |  |
        v   |  |
  RETURN {                              |
    status: 'analyzed',                 |
    startPhase: firstImplPhase,         |
    completedPhases: valid,             |  (only 00, 01, 02)
    remainingPhases: remaining,         |  (05, 06, 16, 08)
    warnings                            |
  }     |  |
        |  |
        v  v
  [STEP 4] valid.length === ANALYSIS_PHASES.length (5)?
        |
       YES ----> RETURN { status: 'analyzed', startPhase: firstImplPhase, ... }
        |         (existing -- completedPhases = all 5, remainingPhases = [05,06,16,08])
       NO
        |
        v
  [STEP 5] nextAnalysisPhase = first missing from ANALYSIS_PHASES
        |
        v
  RETURN { status: 'partial', startPhase: nextAnalysisPhase, ... }
```

### 2.4 Sizing Decision Block -- Internal Flow (Step 7.5)

```
SIZING TRIGGER CHECK
        |
        v
  phase_key === '02-impact-analysis'?
        |
       NO -----> EXIT (no sizing)
        |
       YES
        |
        v
  meta.sizing_decision already set?
        |
       YES ----> EXIT (prevent double-sizing; resume scenario)
        |
       NO
        |
        v
  lightFlag === true?
        |
       YES ----> PATH A: FORCED LIGHT
        |              |
        |              +-> Build record (forced_by_flag: true, reason: 'light_flag')
        |              +-> light_skip_phases from workflows.json
        |              +-> meta.sizing_decision = record
        |              +-> writeMetaJson()
        |              +-> Display forced banner
        |              +-> BREAK loop
        |
       NO
        |
        v
  PATH B: INTERACTIVE SIZING
        |
        v
  [B.1] Read impact-analysis.md
        |
        v
  [B.2] parseSizingFromImpactAnalysis(content) -> metrics?
        |
       YES ---> metrics = result
        |
       NO ----> [B.3] extractFallbackSizingMetrics() -> { metrics, source }
        |
        v
  [B.4] Read thresholds from workflows.json
        |
        v
  [B.5] computeSizingRecommendation(metrics, thresholds)
        |
        v
  [B.6] Display recommendation banner (fallback or happy path)
        |
        v
  [B.7] Present menu
        |
        +---> [A] Accept recommendation
        |       |
        |       v
        |     chosen = recommendation.intensity
        |
        +---> [O] Override
        |       |
        |       v
        |     Present: [1] Light  [2] Standard
        |     (Epic requires build workflow for budget tracking)
        |     chosen = user pick
        |
        +---> [S] Show analysis
                |
                v
              Display IA content -> return to menu
        |
        v
  [B.8] Epic deferral: if chosen === 'epic', effective = 'standard'
        |
        v
  [B.9-B.10] Build sizing_decision record (context: "analyze")
        |
        v
  [B.11] meta.sizing_decision = record; writeMetaJson()
        |
        v
  effective_intensity?
        |
       'light' ----> Display "Analysis complete (light)" -> BREAK loop -> step 9
        |
       'standard' -> CONTINUE loop (phases 03, 04 execute normally)
```

---

## 3. meta.json sizing_decision Schema

### 3.1 Field Definitions

The `sizing_decision` field is a top-level optional object in `meta.json`. Its absence means no sizing decision has been made (legacy files, pre-Phase-02 analysis, or non-feature items).

```json
{
  "sizing_decision": {
    "intensity":              "string  (REQUIRED) -- 'light' | 'standard' | 'epic'",
    "effective_intensity":    "string  (REQUIRED) -- 'light' | 'standard' (epic defers to standard)",
    "recommended_intensity":  "string? (REQUIRED) -- algorithm recommendation, or null if -light forced",
    "decided_at":             "string  (REQUIRED) -- ISO 8601 timestamp",
    "reason":                 "string  (REQUIRED) -- 'user_accepted' | 'user_overridden' | 'light_flag'",
    "user_prompted":          "boolean (REQUIRED) -- true if menu displayed, false if -light flag",
    "forced_by_flag":         "boolean (REQUIRED) -- true if -light flag was used",
    "overridden":             "boolean (REQUIRED) -- true if user chose differently than recommended",
    "overridden_to":          "string? (REQUIRED) -- chosen intensity if overridden, else null",
    "file_count":             "number  (REQUIRED) -- from metrics, or 0 if unavailable",
    "module_count":           "number  (REQUIRED) -- from metrics, or 0 if unavailable",
    "risk_score":             "string  (REQUIRED) -- 'low' | 'medium' | 'high' | 'unknown'",
    "coupling":               "string  (REQUIRED) -- 'low' | 'medium' | 'high' | 'unknown'",
    "coverage_gaps":          "number  (REQUIRED) -- from metrics, or 0 if unavailable",
    "fallback_source":        "string? (REQUIRED) -- 'quick-scan' | 'requirements-spec' | null",
    "fallback_attempted":     "boolean (REQUIRED) -- true if primary parse failed",
    "light_skip_phases":      "array   (REQUIRED) -- phases skipped; empty array for standard",
    "epic_deferred":          "boolean (REQUIRED) -- true if epic selected but deferred to standard",
    "context":                "string  (REQUIRED) -- always 'analyze' when written by analyze handler"
  }
}
```

### 3.2 Type Constraints

| Field | Type | Allowed Values | Default When Unavailable |
|-------|------|---------------|--------------------------|
| `intensity` | string | `"light"`, `"standard"`, `"epic"` | -- (always set) |
| `effective_intensity` | string | `"light"`, `"standard"` | -- (always set) |
| `recommended_intensity` | string or null | `"light"`, `"standard"`, `"epic"`, `null` | `null` (when -light forced) |
| `decided_at` | string | ISO 8601 | -- (always set) |
| `reason` | string | `"user_accepted"`, `"user_overridden"`, `"light_flag"` | -- (always set) |
| `user_prompted` | boolean | `true`, `false` | -- (always set) |
| `forced_by_flag` | boolean | `true`, `false` | -- (always set) |
| `overridden` | boolean | `true`, `false` | -- (always set) |
| `overridden_to` | string or null | `"light"`, `"standard"`, `null` | `null` |
| `file_count` | number | >= 0 | `0` |
| `module_count` | number | >= 0 | `0` |
| `risk_score` | string | `"low"`, `"medium"`, `"high"`, `"unknown"` | `"unknown"` |
| `coupling` | string | `"low"`, `"medium"`, `"high"`, `"unknown"` | `"unknown"` |
| `coverage_gaps` | number | >= 0 | `0` |
| `fallback_source` | string or null | `"quick-scan"`, `"requirements-spec"`, `null` | `null` |
| `fallback_attempted` | boolean | `true`, `false` | -- (always set) |
| `light_skip_phases` | string[] | phase keys | `[]` (for standard) |
| `epic_deferred` | boolean | `true`, `false` | `false` |
| `context` | string | `"analyze"` | -- (always "analyze") |

### 3.3 Relationship to Build-Side Schema

The `sizing_decision` record in meta.json is a **superset** of the `active_workflow.sizing` record in state.json (written by `applySizingDecision()`). Shared fields use identical names and types.

Fields unique to meta.json `sizing_decision`:

| Field | Why Not in state.json | Purpose |
|-------|----------------------|---------|
| `recommended_intensity` | Build stores this in `sizingData` not in the sizing record | Gives build full context when consuming the decision |
| `light_skip_phases` | Build modifies the phase array directly (implicit) | Meta.json has no phase array; explicit skip list needed |
| `context` | Build's sizing is always in build context (implicit) | Distinguishes analyze-originated decisions |

### 3.4 Guard Pattern for Consumers

All functions that check `meta.sizing_decision` MUST use the following guard pattern:

```javascript
if (meta.sizing_decision
    && meta.sizing_decision.effective_intensity === 'light'
    && Array.isArray(meta.sizing_decision.light_skip_phases)) {
    // Light-sizing path
}
```

This three-part guard ensures:
1. Field exists (not undefined/null) -- handles legacy meta.json
2. Intensity is light (not standard/epic) -- only light needs special handling
3. Skip list is a valid array -- handles malformed data

If ANY check fails, the function falls through to existing logic (fail-safe per Article X).

---

## 4. Test Case Matrix

### 4.1 deriveAnalysisStatus() -- New Test Cases

| TC ID | Input: phasesCompleted | Input: sizingDecision | Expected Output | Traces | Priority |
|-------|----------------------|---------------------|-----------------|--------|----------|
| TC-DAS-S01 | `['00-quick-scan', '01-requirements', '02-impact-analysis']` | `{ effective_intensity: 'light', light_skip_phases: ['03-architecture', '04-design'] }` | `'analyzed'` | FR-007 AC-007b | P0 |
| TC-DAS-S02 | `['00-quick-scan', '01-requirements', '02-impact-analysis']` | `null` | `'partial'` | FR-007 AC-007c | P0 |
| TC-DAS-S03 | `['00-quick-scan', '01-requirements', '02-impact-analysis']` | `undefined` | `'partial'` | FR-007 AC-007c | P0 |
| TC-DAS-S04 | `['00-quick-scan', '01-requirements', '02-impact-analysis']` | `{ effective_intensity: 'standard', light_skip_phases: [] }` | `'partial'` | FR-007 logic | P0 |
| TC-DAS-S05 | `['00-quick-scan', '01-requirements', '02-impact-analysis', '03-architecture', '04-design']` | `{ effective_intensity: 'light', light_skip_phases: ['03-architecture', '04-design'] }` | `'analyzed'` | Edge: all 5 + light sizing | P1 |
| TC-DAS-S06 | `['00-quick-scan', '01-requirements']` | `{ effective_intensity: 'light', light_skip_phases: ['03-architecture', '04-design'] }` | `'partial'` | Edge: missing 02 | P1 |
| TC-DAS-S07 | `['00-quick-scan', '01-requirements', '02-impact-analysis']` | `{ effective_intensity: 'light' }` | `'partial'` | Guard: missing light_skip_phases | P1 |
| TC-DAS-S08 | `['00-quick-scan', '01-requirements', '02-impact-analysis']` | `{ effective_intensity: 'light', light_skip_phases: 'not-an-array' }` | `'partial'` | Guard: non-array skip list | P1 |
| TC-DAS-S09 | `[]` | `{ effective_intensity: 'light', light_skip_phases: ['03-architecture', '04-design'] }` | `'raw'` | Guard: 0 phases | P1 |
| TC-DAS-S10 | `null` | `{ effective_intensity: 'light', light_skip_phases: ['03-architecture', '04-design'] }` | `'raw'` | Guard: non-array input | P1 |

**Existing tests (backward compatibility -- MUST continue to pass)**:

| Existing TC | Input | Expected | Status |
|-------------|-------|----------|--------|
| deriveAnalysisStatus([]) | empty, no sizingDecision | `'raw'` | PASS (unchanged) |
| deriveAnalysisStatus(['00-quick-scan']) | 1 phase, no sizingDecision | `'partial'` | PASS (unchanged) |
| deriveAnalysisStatus([all 4]) | 4 phases, no sizingDecision | `'partial'` | PASS (unchanged) |
| deriveAnalysisStatus(ANALYSIS_PHASES) | all 5, no sizingDecision | `'analyzed'` | PASS (unchanged) |
| deriveAnalysisStatus(null) | null, no sizingDecision | `'raw'` | PASS (unchanged) |

---

### 4.2 writeMetaJson() -- New Test Cases

| TC ID | Input: meta | Expected: Written File | Traces | Priority |
|-------|-----------|----------------------|--------|----------|
| TC-WMJ-S01 | `{ phases_completed: ['00','01','02'], sizing_decision: { effective_intensity: 'light', light_skip_phases: ['03','04'], context: 'analyze' } }` | `analysis_status === 'analyzed'`, `sizing_decision` preserved | FR-008 AC-008a, AC-008b | P0 |
| TC-WMJ-S02 | `{ phases_completed: ['00','01','02'], sizing_decision: { effective_intensity: 'standard', light_skip_phases: [], context: 'analyze' } }` | `analysis_status === 'partial'`, `sizing_decision` preserved | FR-008 logic | P0 |
| TC-WMJ-S03 | `{ phases_completed: ['00','01','02'] }` (no sizing_decision) | `analysis_status === 'partial'` | NFR-002 AC-NFR-002b | P0 |
| TC-WMJ-S04 | `{ phases_completed: ANALYSIS_PHASES }` (no sizing_decision) | `analysis_status === 'analyzed'` | NFR-002 backward compat | P0 |
| TC-WMJ-S05 | Meta with sizing_decision, round-trip: write then read | `sizing_decision` identical after read | FR-005 AC-005a | P1 |

**Existing tests (backward compatibility -- MUST continue to pass)**:

| Existing TC | Description | Status |
|-------------|-------------|--------|
| "writes valid JSON to meta.json" | Basic write | PASS (unchanged) |
| "derives analysis_status from phases_completed" | 5 phases -> analyzed | PASS (unchanged) |
| "removes phase_a_completed legacy field" | Legacy cleanup | PASS (unchanged) |
| "derives 'raw' when phases_completed is empty" | 0 phases | PASS (unchanged) |
| "derives 'partial' when some phases completed" | 3 phases | PASS (unchanged) |
| "handles missing phases_completed gracefully" | No field | PASS (unchanged) |

---

### 4.3 computeStartPhase() -- New Test Cases

| TC ID | Input: meta | Input: workflowPhases | Expected Output | Traces | Priority |
|-------|-----------|---------------------|-----------------|--------|----------|
| TC-CSP-S01 | `{ phases_completed: ['00','01','02'], sizing_decision: { effective_intensity: 'light', light_skip_phases: ['03-architecture','04-design'] } }` | FEATURE_PHASES | `{ status: 'analyzed', startPhase: '05-test-strategy' }` | FR-009 AC-009a, AC-009b | P0 |
| TC-CSP-S02 | Same as TC-CSP-S01 | FEATURE_PHASES | `completedPhases === ['00-quick-scan','01-requirements','02-impact-analysis']` | FR-009 AC-009c | P0 |
| TC-CSP-S03 | Same as TC-CSP-S01 | FEATURE_PHASES | `remainingPhases === ['05-test-strategy','06-implementation','16-quality-loop','08-code-review']` | FR-009 AC-009d | P0 |
| TC-CSP-S04 | `{ phases_completed: ['00','01','02'] }` (no sizing_decision) | FEATURE_PHASES | `{ status: 'partial', startPhase: '03-architecture' }` | NFR-002 AC-NFR-002d | P0 |
| TC-CSP-S05 | `{ phases_completed: ['00','01','02'], sizing_decision: { effective_intensity: 'standard', light_skip_phases: [] } }` | FEATURE_PHASES | `{ status: 'partial', startPhase: '03-architecture' }` | Guard: standard != light | P0 |
| TC-CSP-S06 | `{ phases_completed: ['00','01'], sizing_decision: { effective_intensity: 'light', light_skip_phases: ['03-architecture','04-design'] } }` | FEATURE_PHASES | `{ status: 'partial', startPhase: '02-impact-analysis' }` | Edge: missing 02 | P1 |
| TC-CSP-S07 | `{ phases_completed: ['00','01','02'], sizing_decision: { effective_intensity: 'light' } }` | FEATURE_PHASES | `{ status: 'partial', startPhase: '03-architecture' }` | Guard: no skip array | P1 |
| TC-CSP-S08 | `{ phases_completed: ANALYSIS_PHASES, sizing_decision: { effective_intensity: 'light', light_skip_phases: ['03-architecture','04-design'] } }` | FEATURE_PHASES | `{ status: 'analyzed', startPhase: '05-test-strategy', completedPhases: ANALYSIS_PHASES }` | Edge: all 5 + light | P1 |
| TC-CSP-S09 | `null` | FEATURE_PHASES | `{ status: 'raw' }` | Existing behavior preserved | P1 |

**Existing tests (backward compatibility -- all 14 must pass)**:

All existing TC-CSP-01 through TC-CSP-14 must pass without modification. They test meta objects without `sizing_decision`, which triggers the existing code paths (Step 3.5 is skipped).

---

### 4.4 Sizing Consent Tests -- New Test Cases

| TC ID | Test | Expected | Traces | Priority |
|-------|------|----------|--------|----------|
| TC-SC-S01 | Verify `sizing_decision.context === 'analyze'` in a sizing_decision record built by the analyze handler pseudocode | `'analyze'` | FR-005 AC-005b | P1 |
| TC-SC-S02 | Verify `applySizingDecision` is NOT called from the analyze handler | Function not imported/invoked | NFR-001, CON-002 | P1 |
| TC-SC-S03 | Verify `sizing_decision.light_skip_phases` records which phases were skipped | `['03-architecture', '04-design']` for light | FR-005 AC-005c | P1 |

---

### 4.5 Test Summary

| Function | Existing Tests | New Tests (P0) | New Tests (P1) | Total After |
|----------|---------------|----------------|----------------|-------------|
| `deriveAnalysisStatus()` | 5 | 4 | 6 | 15 |
| `writeMetaJson()` | 6 | 4 | 1 | 11 |
| `computeStartPhase()` | 14 | 5 | 4 | 23 |
| Sizing consent | 17 | 0 | 3 | 20 |
| **Total** | **42** | **13** | **14** | **69** |

---

## 5. Before/After Examples

### 5.1 Light-Sized Analysis via Interactive Menu

**Scenario**: User runs `/isdlc analyze "sizing-in-analyze-GH-57"`. After Phase 02, the sizing algorithm recommends light (9 files, medium risk -- but metrics extraction uses the standard thresholds which yield light for <= 5 files, so in this specific case it would recommend standard; we show a hypothetical 3-file item for this example).

**BEFORE (meta.json after Phase 02, before sizing)**:

```json
{
  "source": "github",
  "source_id": "GH-57",
  "slug": "sizing-in-analyze-GH-57",
  "created_at": "2026-02-19T22:10:00Z",
  "analysis_status": "partial",
  "phases_completed": [
    "00-quick-scan",
    "01-requirements",
    "02-impact-analysis"
  ],
  "codebase_hash": "b31cd13"
}
```

**AFTER (meta.json after light sizing accepted)**:

```json
{
  "source": "github",
  "source_id": "GH-57",
  "slug": "sizing-in-analyze-GH-57",
  "created_at": "2026-02-19T22:10:00Z",
  "analysis_status": "analyzed",
  "phases_completed": [
    "00-quick-scan",
    "01-requirements",
    "02-impact-analysis"
  ],
  "codebase_hash": "b31cd13",
  "sizing_decision": {
    "intensity": "light",
    "effective_intensity": "light",
    "recommended_intensity": "light",
    "decided_at": "2026-02-19T22:35:00Z",
    "reason": "user_accepted",
    "user_prompted": true,
    "forced_by_flag": false,
    "overridden": false,
    "overridden_to": null,
    "file_count": 3,
    "module_count": 1,
    "risk_score": "low",
    "coupling": "low",
    "coverage_gaps": 0,
    "fallback_source": null,
    "fallback_attempted": false,
    "light_skip_phases": ["03-architecture", "04-design"],
    "epic_deferred": false,
    "context": "analyze"
  }
}
```

Key observations:
- `analysis_status` changed from `"partial"` to `"analyzed"` because `deriveAnalysisStatus(['00','01','02'], { effective_intensity: 'light', light_skip_phases: ['03','04'] })` returns `'analyzed'`.
- `phases_completed` still has only 3 entries -- phases 03 and 04 were NOT executed and NOT added.
- `sizing_decision.light_skip_phases` explicitly records which phases were skipped.

---

### 5.2 Light-Sized Analysis via -light Flag

**Scenario**: User runs `/isdlc analyze -light "config-update-GH-99"`. The -light flag auto-accepts light without presenting the menu.

**BEFORE (meta.json after Phase 02, before forced sizing)**:

```json
{
  "source": "github",
  "source_id": "GH-99",
  "slug": "config-update-GH-99",
  "created_at": "2026-02-19T23:00:00Z",
  "analysis_status": "partial",
  "phases_completed": [
    "00-quick-scan",
    "01-requirements",
    "02-impact-analysis"
  ],
  "codebase_hash": "abc1234"
}
```

**AFTER (meta.json after -light flag auto-accepts)**:

```json
{
  "source": "github",
  "source_id": "GH-99",
  "slug": "config-update-GH-99",
  "created_at": "2026-02-19T23:00:00Z",
  "analysis_status": "analyzed",
  "phases_completed": [
    "00-quick-scan",
    "01-requirements",
    "02-impact-analysis"
  ],
  "codebase_hash": "abc1234",
  "sizing_decision": {
    "intensity": "light",
    "effective_intensity": "light",
    "recommended_intensity": null,
    "decided_at": "2026-02-19T23:05:00Z",
    "reason": "light_flag",
    "user_prompted": false,
    "forced_by_flag": true,
    "overridden": false,
    "overridden_to": null,
    "file_count": 0,
    "module_count": 0,
    "risk_score": "unknown",
    "coupling": "unknown",
    "coverage_gaps": 0,
    "fallback_source": null,
    "fallback_attempted": false,
    "light_skip_phases": ["03-architecture", "04-design"],
    "epic_deferred": false,
    "context": "analyze"
  }
}
```

Key observations:
- `recommended_intensity` is `null` because the recommendation algorithm was never run (flag bypasses it).
- `user_prompted` is `false` and `forced_by_flag` is `true`.
- `file_count`, `module_count`, `risk_score`, `coupling` are all defaults (0/unknown) because metrics were not parsed.
- `reason` is `"light_flag"` instead of `"user_accepted"`.

---

### 5.3 Standard-Sized Analysis (Full Phases)

**Scenario**: User runs `/isdlc analyze "payment-processing"`. Sizing recommends standard (10 files, medium risk). User accepts.

**AFTER Phase 02 + standard sizing accepted** (meta.json is intermediate):

```json
{
  "source": "manual",
  "slug": "payment-processing",
  "created_at": "2026-02-19T20:00:00Z",
  "analysis_status": "partial",
  "phases_completed": [
    "00-quick-scan",
    "01-requirements",
    "02-impact-analysis"
  ],
  "codebase_hash": "def5678",
  "sizing_decision": {
    "intensity": "standard",
    "effective_intensity": "standard",
    "recommended_intensity": "standard",
    "decided_at": "2026-02-19T20:30:00Z",
    "reason": "user_accepted",
    "user_prompted": true,
    "forced_by_flag": false,
    "overridden": false,
    "overridden_to": null,
    "file_count": 10,
    "module_count": 3,
    "risk_score": "medium",
    "coupling": "medium",
    "coverage_gaps": 0,
    "fallback_source": null,
    "fallback_attempted": false,
    "light_skip_phases": [],
    "epic_deferred": false,
    "context": "analyze"
  }
}
```

**AFTER all 5 phases complete** (meta.json final):

```json
{
  "source": "manual",
  "slug": "payment-processing",
  "created_at": "2026-02-19T20:00:00Z",
  "analysis_status": "analyzed",
  "phases_completed": [
    "00-quick-scan",
    "01-requirements",
    "02-impact-analysis",
    "03-architecture",
    "04-design"
  ],
  "codebase_hash": "def5678",
  "sizing_decision": {
    "intensity": "standard",
    "effective_intensity": "standard",
    "recommended_intensity": "standard",
    "decided_at": "2026-02-19T20:30:00Z",
    "reason": "user_accepted",
    "user_prompted": true,
    "forced_by_flag": false,
    "overridden": false,
    "overridden_to": null,
    "file_count": 10,
    "module_count": 3,
    "risk_score": "medium",
    "coupling": "medium",
    "coverage_gaps": 0,
    "fallback_source": null,
    "fallback_attempted": false,
    "light_skip_phases": [],
    "epic_deferred": false,
    "context": "analyze"
  }
}
```

Key observations:
- `analysis_status` is `"analyzed"` via the standard path (all 5 phases in `phases_completed`).
- `sizing_decision.light_skip_phases` is an empty array (no phases skipped).
- `sizing_decision` was written after Phase 02 and preserved through Phases 03 and 04 writes.
- When `computeStartPhase()` reads this meta during build, it hits Step 4 (all 5 complete) not Step 3.5, because `effective_intensity` is `'standard'`.

---

### 5.4 Epic Deferred to Standard in Analyze

**Scenario**: User runs `/isdlc analyze "massive-refactor"`. Sizing recommends epic (25 files, high risk). User accepts. Epic is deferred to standard per CON-004.

**AFTER Phase 02 + epic deferred**:

```json
{
  "source": "manual",
  "slug": "massive-refactor",
  "created_at": "2026-02-19T21:00:00Z",
  "analysis_status": "partial",
  "phases_completed": [
    "00-quick-scan",
    "01-requirements",
    "02-impact-analysis"
  ],
  "codebase_hash": "xyz7890",
  "sizing_decision": {
    "intensity": "epic",
    "effective_intensity": "standard",
    "recommended_intensity": "epic",
    "decided_at": "2026-02-19T21:25:00Z",
    "reason": "user_accepted",
    "user_prompted": true,
    "forced_by_flag": false,
    "overridden": false,
    "overridden_to": null,
    "file_count": 25,
    "module_count": 7,
    "risk_score": "high",
    "coupling": "high",
    "coverage_gaps": 2,
    "fallback_source": null,
    "fallback_attempted": false,
    "light_skip_phases": [],
    "epic_deferred": true,
    "context": "analyze"
  }
}
```

Key observations:
- `intensity` is `"epic"` (what the user accepted).
- `effective_intensity` is `"standard"` (what is actually applied).
- `epic_deferred` is `true` -- build can detect this and re-offer epic with budget tracking.
- `light_skip_phases` is empty (standard does not skip phases).
- The analyze loop continues to phases 03 and 04 normally.

---

### 5.5 Build Consuming Light-Sized Analysis

**Scenario**: User ran `/isdlc analyze -light "config-update-GH-99"` (example 5.2 above), then runs `/isdlc build "config-update-GH-99"`.

**Input to computeStartPhase()**:

```javascript
meta = {
    source: 'github',
    source_id: 'GH-99',
    slug: 'config-update-GH-99',
    analysis_status: 'analyzed',
    phases_completed: ['00-quick-scan', '01-requirements', '02-impact-analysis'],
    codebase_hash: 'abc1234',
    sizing_decision: {
        intensity: 'light',
        effective_intensity: 'light',
        light_skip_phases: ['03-architecture', '04-design'],
        context: 'analyze',
        // ... other fields ...
    }
}

workflowPhases = [
    '00-quick-scan', '01-requirements', '02-impact-analysis',
    '03-architecture', '04-design', '05-test-strategy',
    '06-implementation', '16-quality-loop', '08-code-review'
]
```

**Output from computeStartPhase()**:

```javascript
{
    status: 'analyzed',
    startPhase: '05-test-strategy',
    completedPhases: ['00-quick-scan', '01-requirements', '02-impact-analysis'],
    remainingPhases: ['05-test-strategy', '06-implementation', '16-quality-loop', '08-code-review'],
    warnings: []
}
```

**Build proceeds from Phase 05** (test strategy). Phases 03 and 04 are not in `remainingPhases` and are never executed. The build-side sizing trigger (STEP 3e-sizing) never fires because `phase_key` is never `'02-impact-analysis'` (build starts at 05).

---

### 5.6 Legacy meta.json (No Sizing Decision) -- Backward Compatibility

**Scenario**: A meta.json created before this feature, with 3 phases complete. No `sizing_decision` field.

```json
{
  "source": "manual",
  "slug": "old-item",
  "created_at": "2026-01-15T10:00:00Z",
  "analysis_status": "partial",
  "phases_completed": [
    "00-quick-scan",
    "01-requirements",
    "02-impact-analysis"
  ],
  "codebase_hash": "old1234"
}
```

**deriveAnalysisStatus(['00','01','02'], undefined)** returns `'partial'`. Unchanged behavior.

**computeStartPhase(meta, FEATURE_PHASES)** returns:
```javascript
{
    status: 'partial',
    startPhase: '03-architecture',
    completedPhases: ['00-quick-scan', '01-requirements', '02-impact-analysis'],
    remainingPhases: ['03-architecture', '04-design', '05-test-strategy', '06-implementation', '16-quality-loop', '08-code-review'],
    warnings: []
}
```

Build resumes from Phase 03 (architecture). This is identical to pre-feature behavior.

---

## 6. Implementation Order

Based on the architecture's dependency analysis and design detail:

```
[1] deriveAnalysisStatus()         ~15 lines changed
     |                              Foundation for all status derivation
     v
[2] writeMetaJson()                ~6 lines changed (net reduction)
     |                              Depends on [1]; eliminates inline duplication
     v
[3] computeStartPhase()            ~20 lines inserted
     |                              Independent of [2] but shares sizing schema
     v
[4] Tests for [1], [2], [3]        ~13 P0 tests + ~14 P1 tests
     |                              Verify utility changes before handler integration
     v
[5] isdlc.md: flag parsing         ~5 lines (new step 2.5)
     |                              Foundation for handler changes
     v
[6] isdlc.md: sizing block         ~65 lines (new step 7.5)
     |                              Depends on all utility changes being correct
     v
[7] Integration validation         Manual end-to-end verification
```

Steps [1] and [3] can be parallelized (no dependency). Step [2] depends on [1]. Steps [5] and [6] depend on [1]-[3] being complete and tested.

---

## 7. Traceability Matrix

| Requirement | Design Section | Test Cases |
|-------------|---------------|------------|
| FR-001 (Sizing decision point after Phase 02) | 1.4.2 Step 7.5 trigger check | -- (handler logic, not unit-testable) |
| FR-002 (Sizing menu presentation) | 1.4.2 Steps B.1-B.7 | -- (UX, manual verification) |
| FR-003 (Light sizing skips 03-04) | 1.4.2 Steps B.12, PATH A | TC-CSP-S01, TC-CSP-S03 |
| FR-004 (Standard sizing continues) | 1.4.2 Step B.13 | TC-CSP-S05 |
| FR-005 (Record sizing in meta.json) | 3.1 Schema, 1.4.2 Steps B.10-B.11 | TC-WMJ-S01, TC-WMJ-S05, TC-SC-S01, TC-SC-S03 |
| FR-006 (-light flag on analyze) | 1.4.1 Step 2.5, 1.4.2 PATH A | -- (handler logic) |
| FR-007 (deriveAnalysisStatus sizing-aware) | 1.1 Pseudocode | TC-DAS-S01 through TC-DAS-S10 |
| FR-008 (writeMetaJson sizing-aware) | 1.2 Pseudocode | TC-WMJ-S01 through TC-WMJ-S05 |
| FR-009 (computeStartPhase sizing-aware) | 1.3 Pseudocode | TC-CSP-S01 through TC-CSP-S09 |
| FR-010 (GitHub label sync respects light) | 1.4.2 BREAK -> step 9 | -- (integration, step 9 is unchanged) |
| NFR-001 (No state.json writes) | 1.4.2 CON-002 constraint | TC-SC-S02 |
| NFR-002 (Backward compatibility) | All functions: guard pattern | TC-DAS-S02, TC-DAS-S03, TC-WMJ-S03, TC-WMJ-S04, TC-CSP-S04 |
| NFR-003 (Sizing menu UX consistency) | 1.4.2 Banner formats | -- (visual, manual) |
| NFR-004 (Resumability) | 1.4.2 Trigger: meta.sizing_decision NOT set | -- (integration) |
| CON-002 (No applySizingDecision reuse) | 1.4.2 "NOT applySizingDecision" constraint | TC-SC-S02 |
| CON-004 (No epic in analyze) | 1.4.2 Step B.7 Override picker, B.8 deferral | 5.4 Example |
| ADR-001 (Inline sizing logic) | 1.4 (entire handler section) | -- |
| ADR-002 (Optional parameter) | 1.1 deriveAnalysisStatus | TC-DAS-S01 through TC-DAS-S10 |
| ADR-003 (Read meta.sizing_decision directly) | 1.3 computeStartPhase | TC-CSP-S01 through TC-CSP-S09 |
| ADR-004 (writeMetaJson delegates) | 1.2 writeMetaJson | TC-WMJ-S01 through TC-WMJ-S05 |
| ADR-005 (No epic in analyze) | 1.4.2 Step B.7, B.8 | 5.4 Example |

---

*Design specification completed in ANALYSIS MODE -- no state.json writes, no branches created.*
