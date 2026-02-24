# Design Specification: Complexity-Based Routing (GH-59)

**Phase**: 04-design (ANALYSIS MODE -- no state.json, no branches)
**Generated**: 2026-02-19
**Based On**: architecture.md (7 ADRs), requirements-spec.md (9 FRs, 5 NFRs, 33 ACs), impact-analysis.md (5 core files)
**Traces**: FR-001..FR-009, NFR-001..NFR-005, CON-001..CON-005, AD-01..AD-07

---

## Table of Contents

1. [Pseudocode: All Components](#1-pseudocode-all-components)
2. [Control Flow Diagrams](#2-control-flow-diagrams)
3. [Data Schemas](#3-data-schemas)
4. [Test Case Matrix](#4-test-case-matrix)
5. [Before/After UX Examples](#5-beforeafter-ux-examples)
6. [Implementation Checklist](#6-implementation-checklist)

---

## 1. Pseudocode: All Components

### 1.1 computeRecommendedTier(estimatedFiles, riskLevel, thresholds)

**File**: `src/claude/hooks/lib/three-verb-utils.cjs`
**Traces**: FR-002 (AC-002a..AC-002d), CON-002, AD-01

This function is inserted after the `checkStaleness` function (line ~465) and before `parseBacklogLine` (line ~479), maintaining the existing section-comment style.

```javascript
// ---------------------------------------------------------------------------
// TIER_ORDER constant
// GH-59: Complexity-Based Routing
// ---------------------------------------------------------------------------

/**
 * Ordered tier sequence for promotion logic.
 * Traces: FR-002 (AC-002b), AD-01
 */
const TIER_ORDER = ['trivial', 'light', 'standard', 'epic'];

// ---------------------------------------------------------------------------
// DEFAULT_TIER_THRESHOLDS constant
// GH-59: Complexity-Based Routing
// ---------------------------------------------------------------------------

/**
 * Default file-count thresholds for tier scoring.
 * Used when workflows.json tier_thresholds is unavailable.
 * Traces: CON-002
 */
const DEFAULT_TIER_THRESHOLDS = {
    trivial_max_files: 2,
    light_max_files: 8,
    standard_max_files: 20
};

// ---------------------------------------------------------------------------
// computeRecommendedTier(estimatedFiles, riskLevel, thresholds)
// GH-59: Complexity-Based Routing
// ---------------------------------------------------------------------------

/**
 * Computes a recommended workflow tier based on file count and risk level
 * from impact analysis metrics. Pure function -- no I/O, no side effects.
 *
 * GH-59: Complexity-Based Routing
 * Traces: FR-002 (AC-002a, AC-002b, AC-002c, AC-002d), CON-002
 *
 * @param {number|null|undefined} fileCount - Actual file count from impact analysis (or estimate)
 * @param {string|null|undefined} riskLevel - Risk score from impact analysis
 * @param {{ trivial_max_files: number, light_max_files: number, standard_max_files: number }} [thresholds]
 * @returns {string} One of "trivial", "light", "standard", "epic"
 */
function computeRecommendedTier(estimatedFiles, riskLevel, thresholds) {
    // Step 1: Apply default thresholds if not provided (CON-002)
    const t = thresholds && typeof thresholds === 'object'
        ? {
            trivial_max_files:  thresholds.trivial_max_files  ?? DEFAULT_TIER_THRESHOLDS.trivial_max_files,
            light_max_files:    thresholds.light_max_files    ?? DEFAULT_TIER_THRESHOLDS.light_max_files,
            standard_max_files: thresholds.standard_max_files ?? DEFAULT_TIER_THRESHOLDS.standard_max_files
        }
        : { ...DEFAULT_TIER_THRESHOLDS };

    // Step 2: Validate estimatedFiles (AC-002c)
    if (estimatedFiles === null || estimatedFiles === undefined ||
        typeof estimatedFiles !== 'number' || !Number.isFinite(estimatedFiles) ||
        estimatedFiles < 0) {
        process.stderr.write(
            `[tier] computeRecommendedTier: invalid estimatedFiles (${estimatedFiles}), defaulting to standard\n`
        );
        return 'standard';
    }

    // Step 3: Compute base tier from file count (AC-002a)
    let baseTier;
    if (estimatedFiles <= t.trivial_max_files) {
        baseTier = 'trivial';
    } else if (estimatedFiles <= t.light_max_files) {
        baseTier = 'light';
    } else if (estimatedFiles <= t.standard_max_files) {
        baseTier = 'standard';
    } else {
        baseTier = 'epic';
    }

    // Step 4: Validate riskLevel (AC-002d)
    const VALID_RISK_LEVELS = ['low', 'medium', 'high'];
    let effectiveRisk = riskLevel;

    if (riskLevel !== null && riskLevel !== undefined) {
        if (typeof riskLevel !== 'string' || !VALID_RISK_LEVELS.includes(riskLevel)) {
            process.stderr.write(
                `[tier] computeRecommendedTier: unrecognized riskLevel (${riskLevel}), treating as low\n`
            );
            effectiveRisk = 'low';
        }
    }

    // Step 5: Apply risk-based promotion (AC-002b)
    // "medium" or "high" promotes tier by exactly one level, capped at "epic"
    if (effectiveRisk === 'medium' || effectiveRisk === 'high') {
        const currentIndex = TIER_ORDER.indexOf(baseTier);
        if (currentIndex < TIER_ORDER.length - 1) {
            baseTier = TIER_ORDER[currentIndex + 1];
        }
        // else: already at "epic", ceiling reached -- no change
    }

    return baseTier;
}
```

**Key design decisions in pseudocode**:

- `DEFAULT_TIER_THRESHOLDS` is a module-level constant, not inline in the function. This makes it available for export and testing.
- Nullish coalescing (`??`) is used per-field inside the thresholds parameter, so partial threshold objects are handled gracefully (e.g., if `thresholds.trivial_max_files` is provided but `light_max_files` is not, the default fills in).
- `process.stderr.write()` is used for warnings (matching existing pattern in hooks; see `common.cjs` line 3090+ for precedent).
- `0` files maps to `trivial` because `0 <= 2`. This is correct per architecture boundary table (Section 10, row 1: "0 files -> trivial").
- Risk promotion uses `TIER_ORDER.indexOf()` for a single array-based lookup rather than a switch/case, making the promotion generic and not tied to specific tier names.

---

### 1.2 getTierDescription(tier)

**File**: `src/claude/hooks/lib/three-verb-utils.cjs`
**Traces**: FR-009 (AC-009a, AC-009b), AD-01

```javascript
// ---------------------------------------------------------------------------
// TIER_DESCRIPTIONS constant
// GH-59: Complexity-Based Routing
// ---------------------------------------------------------------------------

/**
 * Lookup table for tier display information.
 * Traces: FR-009 (AC-009a)
 */
const TIER_DESCRIPTIONS = {
    trivial:  { label: 'Trivial',  description: 'direct edit, no workflow',            fileRange: '1-2 files'  },
    light:    { label: 'Light',    description: 'skip architecture and design',        fileRange: '3-8 files'  },
    standard: { label: 'Standard', description: 'full workflow',                       fileRange: '9-20 files' },
    epic:     { label: 'Epic',     description: 'full workflow with decomposition',    fileRange: '20+ files'  }
};

const UNKNOWN_TIER_DESCRIPTION = {
    label: 'Unknown', description: 'unrecognized tier', fileRange: 'unknown'
};

// ---------------------------------------------------------------------------
// getTierDescription(tier)
// GH-59: Complexity-Based Routing
// ---------------------------------------------------------------------------

/**
 * Returns a human-readable description object for a workflow tier.
 * Pure function -- lookup only.
 *
 * GH-59: Complexity-Based Routing
 * Traces: FR-009 (AC-009a, AC-009b)
 *
 * @param {string} tier
 * @returns {{ label: string, description: string, fileRange: string }}
 */
function getTierDescription(tier) {
    if (typeof tier === 'string' && tier in TIER_DESCRIPTIONS) {
        // Return a copy to prevent mutation of the lookup table
        return { ...TIER_DESCRIPTIONS[tier] };
    }
    return { ...UNKNOWN_TIER_DESCRIPTION };
}
```

**Key design decisions**:

- Spread operator (`{ ... }`) returns a shallow copy. Callers cannot mutate the lookup table.
- `TIER_DESCRIPTIONS` and `UNKNOWN_TIER_DESCRIPTION` are module-level constants, exported for testing.
- The `typeof tier === 'string'` guard handles `null`, `undefined`, and non-string inputs.

---

### 1.3 Tier Computation After Phase 02 in Analyze Handler

**File**: `src/claude/commands/isdlc.md` (analyze handler, after Phase 02 completion)
**Traces**: FR-001 (AC-001a, AC-001b, AC-001c), AD-02

After Phase 02 (impact analysis) completes in the analyze handler, the handler computes the recommended tier from the impact analysis metrics and persists it to meta.json.

**Insertion point**: In the analyze handler's phase loop, after Phase 02 completes (step 7e/7f — after writing meta.json with Phase 02 in phases_completed), before offering the exit point.

```
PROCEDURE computeTierAfterPhase02(meta, artifactFolder, projectRoot):
    // Only runs once, after Phase 02 completes
    // AD-02: Tier computed from actual IA metrics, not Phase 00 estimates

    // Step 1: Read impact analysis metrics
    iaPath = path.join(projectRoot, 'docs', 'requirements', artifactFolder, 'impact-analysis.md')
    iaContent = readFile(iaPath)
    IF iaContent is null:
        STDERR "[tier] impact-analysis.md not found, skipping tier computation"
        RETURN  // No tier — downstream handles null gracefully (AC-004b)

    metrics = parseSizingFromImpactAnalysis(iaContent)
    IF metrics is null:
        STDERR "[tier] Could not parse metrics from impact-analysis.md, skipping tier computation"
        RETURN

    // Step 2: Read thresholds from workflows.json
    workflows = loadWorkflowDefinitions(projectRoot)
    thresholds = workflows?.feature?.tier_thresholds || DEFAULT_TIER_THRESHOLDS

    // Step 3: Compute tier (pure function)
    tier = computeRecommendedTier(metrics.file_count, metrics.risk_score, thresholds)

    // Step 4: Persist to meta.json (AC-001c)
    meta.recommended_tier = tier
    writeMetaJson(slugDir, meta)

    // Step 5: Display inline notification
    desc = getTierDescription(tier)
    OUTPUT "  Recommended tier: {tier} -- {desc.description} ({metrics.file_count} files, {metrics.risk_score} risk)"
```

**No changes to quick-scan-agent.md** — the quick scan agent continues to produce scope estimates as before. The tier is computed later from Phase 02's more accurate data.

---

### 1.4 Analyze Handler Step 8: Tier Display

**File**: `src/claude/commands/isdlc.md` (analyze handler, after line ~597)
**Traces**: FR-004 (AC-004a, AC-004b, AC-004c), AD-02

**Current code** (line 597):
```
8. After final phase: "Analysis complete. {slug} is ready to build."
```

**New code** (replaces the above):
```
8. After final phase:
   a. Display: "Analysis complete. {slug} is ready to build."
   b. Read recommended_tier from meta.json:
      - LET tier = meta.recommended_tier || null
      - IF tier is not null:
          LET desc = getTierDescription(tier)  // from three-verb-utils.cjs
          Display: "Recommended tier: {tier} -- {desc.description}"
      - ELSE:
          (omit tier line entirely -- no error, no placeholder)
```

**Pseudocode**:

```
PROCEDURE analyzeStep8(slug, meta):
    OUTPUT "Analysis complete. {slug} is ready to build."

    // AC-004a: display tier if present
    // AC-004b: omit if absent
    // AC-004c: tier from Phase 02 is preserved through subsequent phases
    tier = meta.recommended_tier OR null

    IF tier IS NOT null:
        desc = getTierDescription(tier)
        OUTPUT "Recommended tier: {tier} -- {desc.description}"
    END IF
```

---

### 1.5 Build Handler Step 4a-tier: Tier Menu

**File**: `src/claude/commands/isdlc.md` (build handler, between step 4 and step 4a)
**Traces**: FR-005 (AC-005a..AC-005e), FR-008, NFR-001, AD-07

**Insertion point**: After line 620 ("Read meta.json using readMetaJson()"), before line 622 ("--- REQ-0026: Build Auto-Detection Steps 4a-4e ---").

```
--- GH-59: Tier Selection (Step 4a-tier) ---

Step 4a-tier: Tier Selection

1. Read recommended tier from meta (already loaded in step 4):
   LET recommended = meta.recommended_tier OR null

2. Determine default selection:
   IF recommended IS null:
       LET default = "standard"
       Display warning: "No tier recommendation available. Defaulting to standard."
   ELSE:
       LET default = recommended

3. Check for --trivial flag:
   IF --trivial flag is set:
       Display: "Trivial tier selected via flag. Proceed with direct edit? [Y/n]"
       IF user confirms (Y or Enter):
           GOTO step T1 (TRIVIAL TIER EXECUTION)
       ELSE:
           (fall through to tier menu below)

4. Present tier menu:
   LET descriptions = {
       trivial:  getTierDescription("trivial"),
       light:    getTierDescription("light"),
       standard: getTierDescription("standard"),
       epic:     getTierDescription("epic")
   }

   Display:
   ```
   Recommended workflow tier: {default} ({descriptions[default].fileRange}, {descriptions[default].description})

   [1] Trivial -- {descriptions.trivial.description} ({descriptions.trivial.fileRange})
   [2] Light -- {descriptions.light.description} ({descriptions.light.fileRange})
   [3] Standard -- {descriptions.standard.description} ({descriptions.standard.fileRange})
   [4] Epic -- {descriptions.epic.description} ({descriptions.epic.fileRange})
   ```

   Append " <-- RECOMMENDED" to the menu line matching default.
   Display: "Select tier [{defaultNumber}]:"

5. Handle user input:
   LET TIER_MAP = { "1": "trivial", "2": "light", "3": "standard", "4": "epic" }
   LET input = user selection (or empty for default)

   IF input is empty or Enter:
       LET selected = default
   ELSE IF input in TIER_MAP:
       LET selected = TIER_MAP[input]
   ELSE:
       Display: "Invalid selection. Using default: {default}"
       LET selected = default

6. Record tier override if applicable (AC-005e):
   IF selected != recommended AND recommended IS NOT null:
       meta.tier_override = {
           recommended: recommended,
           selected: selected,
           overridden_at: new Date().toISOString()
       }
       writeMetaJson(slugDir, meta)

7. Route based on selection:
   IF selected === "trivial":
       GOTO --> TRIVIAL TIER EXECUTION (step T1)
   ELSE IF selected === "epic":
       Display: "Epic decomposition is not yet available. Running standard workflow."
       // CON-003: epic placeholder routes to standard
       // Fall through to step 4a (computeStartPhase) unchanged
   ELSE:
       // light or standard: fall through to step 4a unchanged
       // existing sizing at 3e-sizing handles light/standard intensity

--- End GH-59: Tier Selection ---
```

**Validation against AC-005a**: Menu format matches the acceptance criteria exactly, with `<-- RECOMMENDED` marker on the default line.

**Validation against AC-NFR-001a**: The menu is ALWAYS presented. There is no auto-execute code path.

**Validation against AC-NFR-001b**: The `--trivial` flag shows a confirmation prompt, not silent execution.

---

### 1.6 Trivial Tier Execution Path

**File**: `src/claude/commands/isdlc.md` (new labeled section in build handler)
**Traces**: FR-006 (AC-006a..AC-006e), FR-007 (AC-007a..AC-007d), NFR-003, NFR-004, NFR-005, AD-03, AD-04, AD-06

This section is placed AFTER the existing build handler steps (after step 9). It is reached via GOTO from step 4a-tier when the user selects trivial.

```
--- TRIVIAL TIER EXECUTION ---

IMPORTANT: This section runs INSTEAD OF steps 4a through 9.
No workflow is created. No branch is created. No state.json is touched.
No hooks fire. No gates are checked. (NFR-005, AC-006a)

T1. Read requirements context:
    LET slugDir = docs/requirements/{slug}/
    LET context = null

    // Priority order per architecture Section 14
    FOR source IN ["requirements-spec.md", "impact-analysis.md", "quick-scan.md", "draft.md"]:
        LET filePath = path.join(slugDir, source)
        IF file exists at filePath:
            context = Read(filePath)
            LET contextSource = source
            BREAK

    IF context IS null:
        Display ERROR: "No requirements context found in {slugDir}."
        Display: "Cannot proceed with trivial tier without context."
        Display: "Add context first: /isdlc add or /isdlc analyze"
        EXIT build handler

T2. Display change context:
    Display:
    ```
    TRIVIAL CHANGE: {slug}

    Based on: {contextSource}
    Source: {meta.source} {meta.source_id || ""}
    ```
    Display relevant excerpts from context (problem statement, what to change)

T3. Assist with edit:
    // Framework uses standard Claude Code editing (Read/Edit tools)
    // to make the change on the current branch.
    // Read the context, identify target files, make edits.
    //
    // CONSTRAINTS:
    // - No branch creation (ASM-002: commit to current branch)
    // - No state.json writes (NFR-005)
    // - No workflow initialization
    // - No orchestrator delegation
    // - No hook invocation

    (Framework makes the edit interactively)

T4. User confirms:
    Display: "Changes made. Review and confirm? [Y/n/retry]"

    IF user selects "n" (abort):
        Display: "Trivial change aborted. No changes committed."
        EXIT build handler (no change record written)

    IF user selects "retry":
        GOTO T3

    // user selects "Y" or Enter: proceed to commit

T5. Commit to current branch:
    LET modifiedFiles = (list of files modified in T3)

    TRY:
        git add {modifiedFiles}
        git commit -m "{commitType}: {commitDescription} ({slug})"
        // commitType derived from context: "fix", "feat", "refactor", etc.
        // commitDescription: brief summary of the change
    CATCH error:
        Display ERROR: "Commit failed: {error.message}"
        Display:
        ```
        Options:
          [R] Retry the edit
          [E] Escalate to light tier (creates workflow)
          [A] Abort (no changes committed)
        ```
        IF [R]: GOTO T3
        IF [E]: Return to step 4a-tier with "light" pre-selected
        IF [A]: EXIT build handler
        // AC-006e: no change record on commit failure

    LET commitSHA = git rev-parse HEAD

T6. Write change-record.md (AC-007a, AC-007b):
    LET recordPath = path.join(slugDir, "change-record.md")
    LET timestamp = new Date().toISOString()
    LET diffOutput = {}

    // Gather diffs (first 20 lines per file, AC-007a)
    FOR EACH file IN modifiedFiles:
        LET diff = git diff HEAD~1 -- {file}
        LET diffLines = diff.split("\n")
        IF diffLines.length > 20:
            diffOutput[file] = diffLines.slice(0, 20).join("\n")
            diffOutput[file] += "\n... (diff truncated, " + (diffLines.length - 20) + " more lines)"
        ELSE:
            diffOutput[file] = diff

    // Build entry content
    LET entry = """
    ## Entry: {timestamp}

    **Tier**: trivial
    **Summary**: {what changed and why -- from context + edit description}
    **Files Modified**:
    {for each file: "- {relativePath}"}

    **Commit**: {commitSHA}

    ### Diff Summary

    {for each file:
    #### {fileName}
    ```diff
    {diffOutput[file]}
    ```
    }
    """

    // Append or create
    IF file exists at recordPath:
        LET existing = Read(recordPath)
        Write(recordPath, existing + "\n---\n\n" + entry)
    ELSE:
        LET header = """
        # Change Record: {slug}

        Audit trail for trivial-tier changes. Each entry below represents
        a direct edit made without a full workflow.

        ---

        """
        Write(recordPath, header + entry)

T7. Update meta.json (AC-007c):
    meta.tier_used = "trivial"
    meta.last_trivial_change = {
        completed_at: timestamp,
        commit_sha: commitSHA,
        files_modified: modifiedFiles  // relative paths
    }
    // Preserve analysis_status (AC-007c: "or preserved if already set")
    writeMetaJson(slugDir, meta)

T8. Update BACKLOG.md marker (AC-007d):
    LET backlogPath = path.join(projectRoot, "BACKLOG.md")
    updateBacklogMarker(backlogPath, slug, "x")
    // "x" = completed marker per existing convention

T9. Display completion summary (AC-006d):
    Display:
    ```
    Trivial change completed:
      Files modified: {modifiedFiles, comma-separated}
      Commit: {commitSHA.substring(0, 7)}
      Change record: docs/requirements/{slug}/change-record.md
    ```

EXIT build handler

--- END TRIVIAL TIER EXECUTION ---
```

**Error handling summary** (AC-006e):

| Step | Error | Recovery | Change Record Written? |
|------|-------|----------|----------------------|
| T1 | No context files found | Display error, exit | No |
| T3 | Edit introduces errors | User can retry (T4) | No |
| T5 | Commit fails | Retry / Escalate / Abort menu | No |
| T6 | change-record.md write fails | Warn, continue (commit stands) | No (but commit made) |
| T7 | meta.json write fails | Warn, continue (commit + record stand) | Yes |
| T8 | BACKLOG.md update fails | Silent (existing behavior) | Yes |

---

### 1.7 Analyze Handler Step 7c: Tier Persistence

**File**: `src/claude/commands/isdlc.md` (analyze handler, step 7c/7f)
**Traces**: FR-003 (AC-003a, AC-003c), AD-02

After Phase 02 (impact analysis) completes and meta.json is updated with `phases_completed`, the analyze handler computes the recommended tier from impact analysis metrics (see Section 1.3 for full pseudocode).

```
PROCEDURE computeAndPersistTier(slugDir, meta, artifactFolder, projectRoot):
    // Only runs when Phase 02 (impact-analysis) just completed
    // AD-02: Uses actual IA metrics, not Phase 00 estimates

    iaPath = join(projectRoot, 'docs', 'requirements', artifactFolder, 'impact-analysis.md')

    IF NOT file exists at iaPath:
        RETURN  // no impact analysis output — tier stays null

    LET content = Read(iaPath)
    LET metrics = parseSizingFromImpactAnalysis(content)  // existing function

    IF metrics is null:
        RETURN  // parse failed — tier stays null (AC-004b, AC-005c handle gracefully)

    // Read tier thresholds from workflows.json (CON-002)
    LET workflows = loadWorkflowDefinitions(projectRoot)
    LET thresholds = workflows?.feature?.tier_thresholds || DEFAULT_TIER_THRESHOLDS

    // Compute tier from actual blast radius data
    LET tier = computeRecommendedTier(metrics.file_count, metrics.risk_score, thresholds)

    // AC-003a: write at top level of meta.json
    // AC-003c: overwrite if already present (re-analysis)
    meta.recommended_tier = tier

    writeMetaJson(slugDir, meta)
```

---

### 1.8 Exports Addition

**File**: `src/claude/hooks/lib/three-verb-utils.cjs` (module.exports block, line ~818)
**Traces**: AD-01

```javascript
module.exports = {
    // Constants
    ANALYSIS_PHASES,
    IMPLEMENTATION_PHASES,
    MARKER_REGEX,
    TIER_ORDER,                          // GH-59: Complexity-Based Routing
    DEFAULT_TIER_THRESHOLDS,             // GH-59: Complexity-Based Routing
    TIER_DESCRIPTIONS,                   // GH-59: Complexity-Based Routing (for testing)

    // Core utilities
    generateSlug,
    detectSource,
    deriveAnalysisStatus,
    deriveBacklogMarker,
    readMetaJson,
    writeMetaJson,
    parseBacklogLine,
    updateBacklogMarker,
    appendToBacklog,
    resolveItem,

    // Build auto-detection utilities (REQ-0026)
    validatePhasesCompleted,
    computeStartPhase,
    checkStaleness,

    // Tier recommendation utilities (GH-59)
    computeRecommendedTier,
    getTierDescription,

    // Internal helpers (exported for testing)
    findBacklogItemByNumber,
    findByExternalRef,
    searchBacklogTitles,
    findDirForDescription
};
```

---

## 2. Control Flow Diagrams

### 2.1 Build Handler with Tier Decision Point

```
/isdlc build "{item}"
    |
    v
[Step 1] Validate constitution
    |
    v
[Step 2] Check no active workflow
    |
    v
[Step 3] resolveItem(input) --> { slug, dir, meta }
    |
    v
[Step 4] readMetaJson(slugDir) --> meta
    |
    |
    |   +--------------------------------------------------+
    |   |  GH-59: STEP 4a-tier (Tier Selection)            |
    |   +--------------------------------------------------+
    |   |                                                    |
    |   |  recommended = meta.recommended_tier || null       |
    |   |  default = recommended || "standard"               |
    |   |                                                    |
    |   |  --trivial flag set? ----YES--> Confirm? --YES--+  |
    |   |       |                           |              |  |
    |   |       NO                          NO             |  |
    |   |       |                           |              |  |
    |   |       v                           v              |  |
    |   |  Display tier menu:               |              |  |
    |   |  [1] Trivial                      |              |  |
    |   |  [2] Light                        |              |  |
    |   |  [3] Standard                     |              |  |
    |   |  [4] Epic                         |              |  |
    |   |       |                           |              |  |
    |   |       v                           |              |  |
    |   |  User selects                     |              |  |
    |   |       |                           |              |  |
    |   |       +------ "trivial" ----------|----------->--+  |
    |   |       |                           |              |  |
    |   |       +------ "epic" --> "Epic not available,    |  |
    |   |       |                  running standard"       |  |
    |   |       |                     |                    |  |
    |   |       +------ "light"  -----+                    |  |
    |   |       |                     |                    |  |
    |   |       +------ "standard" ---+                    |  |
    |   |                             |                    |  |
    |   |              FALL THROUGH   |     TRIVIAL PATH   |  |
    |   +--------------|--------------|---------|----------+  |
    |                  |              |         |             |
    |                  v              |         v             |
    |           [Step 4a]             |   TRIVIAL TIER       |
    |           computeStartPhase     |   EXECUTION          |
    |                  |              |   (T1..T9)           |
    |                  v              |         |             |
    |           [Step 4b-4e]          |         v             |
    |           staleness, partial,   |   change-record.md   |
    |           BUILD SUMMARY         |   meta.json update   |
    |                  |              |   BACKLOG.md update   |
    |                  v              |         |             |
    |           [Steps 5-9]           |         v             |
    |           flags, workflow type,  |   EXIT (done)        |
    |           orchestrator,          |                      |
    |           phase-loop-controller  |                      |
    |                  |              |                       |
    |                  v              |                       |
    |           (full workflow)        |                       |
    |                                                         |
    +--[existing unchanged flow]------+
```

### 2.2 Trivial Tier Execution Sequence

```
ENTER: User selected "trivial" in step 4a-tier
    |
    v
[T1] Read requirements context
    |
    |-- requirements-spec.md? --YES--> context = read
    |-- impact-analysis.md?   --YES--> context = read
    |-- quick-scan.md?        --YES--> context = read
    |-- draft.md?             --YES--> context = read
    |-- none found?           --YES--> ERROR, EXIT
    |
    v
[T2] Display change context
    |  "TRIVIAL CHANGE: {slug}"
    |  "Based on: {source}"
    v
[T3] Assist with edit
    |  (Claude Code Read/Edit tools)
    |  (current branch, no new branch)
    v
[T4] User confirms? --------"n"-------> ABORT, EXIT (no record)
    |           |
    |       "retry"
    |           |
    |           +----------> GOTO T3
    |
    "Y"
    |
    v
[T5] git add + git commit
    |
    |-- FAIL? --> [R] Retry / [E] Escalate / [A] Abort
    |               |           |               |
    |           GOTO T3    Return to tier    EXIT (no record)
    |                      menu with "light"
    |
    SUCCESS
    |
    v
[T6] Write change-record.md
    |  (append if exists, create if new)
    |
    v
[T7] Update meta.json
    |  tier_used = "trivial"
    |  last_trivial_change = { ... }
    |
    v
[T8] Update BACKLOG.md marker ("x")
    |
    v
[T9] Display completion summary
    |
    v
EXIT build handler
```

### 2.3 Tier vs Sizing Interaction Model

```
+================================================================+
|                    DECISION TIMELINE                            |
+================================================================+
|                                                                 |
|  Phase 02          Build Start        Phase 02        3e-sizing |
|  (impact analysis) (user action)      (impact)        (auto)   |
|      |                 |                  |               |     |
|      v                 v                  v               v     |
|  +---------+    +-----------+      +-----------+   +----------+|
|  | Compute |    | Tier Menu |      | (phases   |   | Sizing   ||
|  | recomm. |    | Selection |      |  run as   |   | Decision ||
|  | tier    |    |           |      |  normal)  |   | Point    ||
|  +---------+    +-----------+      +-----------+   +----------+|
|      |                |                                  |     |
|      |                |                                  |     |
|  "trivial"     User picks one:                     Recommends: |
|  "light"       -----------------                   "light"     |
|  "standard"    |       |       |                   "standard"  |
|  "epic"        |       |       |                   "epic"      |
|            trivial  light/std  epic                             |
|               |     /epic       |                              |
|               v       |         v                              |
|          TRIVIAL      v      (routes to                        |
|          PATH     WORKFLOW    standard                         |
|          (exit)   CREATED    per CON-003)                      |
|               |       |                                        |
|               |       |                                        |
|               |       +----> phases 00..02 run                 |
|               |       |                                        |
|               |       +----> 3e-sizing fires after Phase 02    |
|               |       |      (independent of tier selection)   |
|               |       |                                        |
|               |       +----> sizing adjusts workflow intensity  |
|               |              (may differ from tier)            |
|               |                                                |
|          NO WORKFLOW                                           |
|          NO SIZING                                             |
|          NO PHASES                                             |
|                                                                |
+================================================================+

KEY DISTINCTIONS:
  Tier  = "Should we run a workflow at all?" (Phase 02, pre-build)
  Sizing = "How heavy should the workflow be?" (Phase 02, mid-build)

  They use overlapping names (light/standard/epic) but are
  independent decisions at different lifecycle points.
  Tier "light" != Sizing "light".

EXAMPLES:
  1. Tier=light, Sizing=standard
     User picked light tier at build time (low initial estimate).
     Impact analysis revealed more complexity. Sizing recommends standard.
     Result: standard intensity workflow.

  2. Tier=standard, Sizing=light
     User picked standard tier (analysis showed 12 files).
     Impact analysis found only 4 files actually affected. Sizing recommends light.
     Result: light intensity workflow (arch/design phases skipped).

  3. Tier=trivial
     Direct edit path. Sizing never runs. No workflow created.
```

---

## 3. Data Schemas

### 3.1 meta.json Tier Fields

All new fields are optional. Existing meta.json files without these fields continue to work unchanged (NFR-002).

```json
{
  "_comment": "Existing fields (unchanged)",
  "source": "github",
  "source_id": "GH-59",
  "slug": "complexity-routing-GH-59",
  "created_at": "2026-02-19T22:10:00Z",
  "analysis_status": "partial",
  "phases_completed": ["00-quick-scan", "01-requirements"],
  "codebase_hash": "abc1234",

  "_comment_tier": "NEW: Tier fields (GH-59)",

  "recommended_tier": "light",

  "tier_used": "trivial",

  "tier_override": {
    "recommended": "light",
    "selected": "standard",
    "overridden_at": "2026-02-20T10:15:00Z"
  },

  "last_trivial_change": {
    "completed_at": "2026-02-20T10:20:00Z",
    "commit_sha": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    "files_modified": [
      "src/utils/helper.js",
      "src/config/defaults.json"
    ]
  },

  "quick_scan": {
    "completed_at": "2026-02-19T22:34:00Z",
    "estimated_scope": "SMALL",
    "estimated_affected_files": 3,
    "confidence": "high"
  }
}
```

**Field specification table**:

| Field | Type | Required | Set By | When | Traces |
|-------|------|----------|--------|------|--------|
| `recommended_tier` | `string` enum: `trivial`, `light`, `standard`, `epic` | No | Analyze handler, after Phase 02 | After impact analysis completes | AC-003a |
| `tier_used` | `string` enum: `trivial`, `light`, `standard`, `epic` | No | Build handler (4a-tier) or trivial path (T7) | After tier selection/execution | AC-007c |
| `tier_override` | `object` or `null` | No | Build handler (4a-tier) | When user selects tier != recommended | AC-005e |
| `tier_override.recommended` | `string` | Yes (if parent set) | Build handler | On override | AC-005e |
| `tier_override.selected` | `string` | Yes (if parent set) | Build handler | On override | AC-005e |
| `tier_override.overridden_at` | `string` ISO-8601 | Yes (if parent set) | Build handler | On override | AC-005e |
| `last_trivial_change` | `object` or `null` | No | Trivial path (T7) | After trivial completes | AC-007c |
| `last_trivial_change.completed_at` | `string` ISO-8601 | Yes (if parent set) | Trivial path | On completion | AC-007c |
| `last_trivial_change.commit_sha` | `string` 40-char hex | Yes (if parent set) | Trivial path | On completion | AC-007c |
| `last_trivial_change.files_modified` | `string[]` | Yes (if parent set) | Trivial path | On completion | AC-007c |

**Placement rule**: `recommended_tier` is at the TOP LEVEL of meta.json, NOT nested inside `quick_scan`. This is a deliberate design decision per AC-003a and architecture Section 12. The tier is computed from Phase 02 impact analysis metrics, not from Phase 00 quick scan estimates. If a `quick_scan.recommended_tier` exists in legacy meta.json, it is informational context, not the authoritative tier value. The implementation reads the top-level field.

**Backward compatibility** (NFR-002):
- `readMetaJson()` returns the raw object. Missing tier fields are `undefined`.
- `writeMetaJson()` writes whatever fields are present. No changes needed.
- Consumers check: `meta.recommended_tier || null` (undefined -> null).
- `computeStartPhase()` does not reference tier fields. No interaction.

---

### 3.2 change-record.md Entry Format

**File**: `docs/requirements/{slug}/change-record.md`
**Traces**: FR-007 (AC-007a, AC-007b), NFR-003, AD-04

**First entry (file creation)**:

```markdown
# Change Record: {slug}

Audit trail for trivial-tier changes. Each entry below represents
a direct edit made without a full workflow.

---

## Entry: 2026-02-20T10:20:00.000Z

**Tier**: trivial
**Summary**: Fixed typo in error message for invalid configuration path.
The error incorrectly referenced "config.yaml" instead of "config.json".
**Files Modified**:
- src/utils/config-loader.js
- src/utils/error-messages.js

**Commit**: a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2

### Diff Summary

#### src/utils/config-loader.js
```diff
-    throw new Error(`Config not found: ${configPath}.yaml`);
+    throw new Error(`Config not found: ${configPath}.json`);
```

#### src/utils/error-messages.js
```diff
-  CONFIG_NOT_FOUND: 'Expected config.yaml at {path}',
+  CONFIG_NOT_FOUND: 'Expected config.json at {path}',
```
```

**Subsequent entry (append)**:

The separator `---` is added before each new entry. The file header is NOT repeated.

```markdown
[... previous entries ...]

---

## Entry: 2026-02-21T14:05:00.000Z

**Tier**: trivial
**Summary**: Updated default timeout from 30s to 60s per user feedback.
**Files Modified**:
- src/config/defaults.json

**Commit**: b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3

### Diff Summary

#### src/config/defaults.json
```diff
-  "timeout": 30,
+  "timeout": 60,
```
```

**Structural rules**:

| Rule | Specification |
|------|--------------|
| File header | Written only on first creation. Contains `# Change Record: {slug}` and intro text. |
| Entry separator | `---` horizontal rule between entries. Written before each new entry when appending. |
| Entry heading | `## Entry: {ISO-8601}` with full timestamp. |
| Tier field | Always `"trivial"` for this schema version. Future-proofed for other tiers. |
| Summary | 1-3 sentences answering "what" and "why". |
| Files Modified | Bulleted list, paths relative to project root. |
| Commit SHA | Full 40-character hash. |
| Diff Summary | Per-file section. First 20 lines of `git diff HEAD~1 -- {file}`. Truncated with `"... (diff truncated, N more lines)"` if longer. |

---

### 3.3 workflows.json tier_thresholds Config

**File**: `src/isdlc/config/workflows.json`
**Traces**: CON-002, AD-01

New `tier_thresholds` block added under `workflows.feature`, as a sibling to `sizing`:

```json
{
  "workflows": {
    "feature": {
      "phases": ["00-quick-scan", "01-requirements", ...],
      "gate_mode": "strict",
      "options": { ... },
      "sizing": {
        "enabled": true,
        "thresholds": {
          "light_max_files": 5,
          "epic_min_files": 20
        },
        "light_skip_phases": ["03-architecture", "04-design"],
        "risk_override": {
          "high_risk_forces_standard_minimum": true
        }
      },
      "tier_thresholds": {
        "trivial_max_files": 2,
        "light_max_files": 8,
        "standard_max_files": 20
      },
      "performance_budgets": { ... },
      ...
    }
  }
}
```

**Schema**:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `tier_thresholds` | `object` | `null` (function uses hardcoded defaults) | Threshold configuration for tier scoring |
| `tier_thresholds.trivial_max_files` | `number` | `2` | Maximum file count for trivial tier |
| `tier_thresholds.light_max_files` | `number` | `8` | Maximum file count for light tier |
| `tier_thresholds.standard_max_files` | `number` | `20` | Maximum file count for standard tier (above = epic) |

**Placement rationale**: The `tier_thresholds` block sits immediately after `sizing` within `workflows.feature`. Both blocks relate to workflow scaling, and the placement groups them logically. The naming convention (`_max_files`) matches `sizing.thresholds.light_max_files`.

**Distinction from sizing thresholds**: Note that `sizing.thresholds.light_max_files` is `5` while `tier_thresholds.light_max_files` is `8`. These are different thresholds for different decisions at different lifecycle points (tier = pre-workflow, sizing = mid-workflow).

---

## 4. Test Case Matrix

### 4.1 computeRecommendedTier() Test Cases

All tests use the node:test runner and assert/strict pattern consistent with `test-three-verb-utils.test.cjs`.

#### 4.1.1 Base Thresholds (AC-002a)

| # | estimatedFiles | riskLevel | thresholds | Expected | Boundary |
|---|---------------|-----------|------------|----------|----------|
| 1 | 0 | null | default | `"trivial"` | Below lower bound |
| 2 | 1 | "low" | default | `"trivial"` | Within trivial range |
| 3 | 2 | "low" | default | `"trivial"` | At trivial upper boundary (inclusive) |
| 4 | 3 | "low" | default | `"light"` | Just above trivial boundary |
| 5 | 5 | "low" | default | `"light"` | Mid light range |
| 6 | 8 | "low" | default | `"light"` | At light upper boundary (inclusive) |
| 7 | 9 | "low" | default | `"standard"` | Just above light boundary |
| 8 | 15 | "low" | default | `"standard"` | Mid standard range |
| 9 | 20 | "low" | default | `"standard"` | At standard upper boundary (inclusive) |
| 10 | 21 | "low" | default | `"epic"` | Just above standard boundary |
| 11 | 100 | "low" | default | `"epic"` | Far above standard boundary |

#### 4.1.2 Risk-Based Promotion (AC-002b)

| # | estimatedFiles | riskLevel | Expected | Explanation |
|---|---------------|-----------|----------|-------------|
| 12 | 2 | "medium" | `"light"` | trivial + medium risk -> light |
| 13 | 2 | "high" | `"light"` | trivial + high risk -> light |
| 14 | 5 | "medium" | `"standard"` | light + medium risk -> standard |
| 15 | 8 | "high" | `"standard"` | light (boundary) + high risk -> standard |
| 16 | 15 | "medium" | `"epic"` | standard + medium risk -> epic |
| 17 | 20 | "high" | `"epic"` | standard (boundary) + high risk -> epic |
| 18 | 21 | "high" | `"epic"` | epic + high risk -> epic (ceiling) |
| 19 | 100 | "medium" | `"epic"` | epic + medium risk -> epic (ceiling) |
| 20 | 2 | "low" | `"trivial"` | trivial + low risk -> no promotion |
| 21 | 5 | null | `"light"` | light + null risk -> no promotion |
| 22 | 5 | undefined | `"light"` | light + undefined risk -> no promotion |

#### 4.1.3 Invalid Input Handling (AC-002c)

| # | estimatedFiles | riskLevel | Expected | Warning |
|---|---------------|-----------|----------|---------|
| 23 | null | "low" | `"standard"` | "invalid estimatedFiles (null)" |
| 24 | undefined | "low" | `"standard"` | "invalid estimatedFiles (undefined)" |
| 25 | NaN | "low" | `"standard"` | "invalid estimatedFiles (NaN)" |
| 26 | -1 | "low" | `"standard"` | "invalid estimatedFiles (-1)" |
| 27 | -5 | "low" | `"standard"` | "invalid estimatedFiles (-5)" |
| 28 | "three" | "low" | `"standard"` | "invalid estimatedFiles (three)" |
| 29 | Infinity | "low" | `"standard"` | "invalid estimatedFiles (Infinity)" |

#### 4.1.4 Unrecognized riskLevel (AC-002d)

| # | estimatedFiles | riskLevel | Expected | Warning |
|---|---------------|-----------|----------|---------|
| 30 | 2 | "critical" | `"trivial"` | "unrecognized riskLevel (critical)" -- treated as low, no promotion |
| 31 | 5 | "MEDIUM" | `"light"` | "unrecognized riskLevel (MEDIUM)" -- case-sensitive, treated as low |
| 32 | 5 | "" | `"light"` | "unrecognized riskLevel ()" -- empty string treated as low |
| 33 | 5 | "extreme" | `"light"` | "unrecognized riskLevel (extreme)" -- unknown treated as low |

#### 4.1.5 Custom Thresholds (CON-002)

| # | estimatedFiles | riskLevel | thresholds | Expected | Explanation |
|---|---------------|-----------|------------|----------|-------------|
| 34 | 5 | "low" | `{3, 10, 25}` | `"light"` | Custom: trivial<=3, light<=10 |
| 35 | 3 | "low" | `{3, 10, 25}` | `"trivial"` | Custom: at trivial boundary |
| 36 | 4 | "low" | `{3, 10, 25}` | `"light"` | Custom: just above trivial |
| 37 | 22 | "low" | `{3, 10, 25}` | `"standard"` | Custom: within standard |
| 38 | 26 | "low" | `{3, 10, 25}` | `"epic"` | Custom: above standard |
| 39 | 5 | "low" | null | `"light"` | Null thresholds -> use defaults |
| 40 | 5 | "low" | undefined | `"light"` | Undefined thresholds -> use defaults |
| 41 | 5 | "low" | `{trivial_max_files: 1}` | `"light"` | Partial: missing fields use defaults |

### 4.2 getTierDescription() Test Cases

| # | tier | Expected | Traces |
|---|------|----------|--------|
| 1 | `"trivial"` | `{ label: "Trivial", description: "direct edit, no workflow", fileRange: "1-2 files" }` | AC-009a |
| 2 | `"light"` | `{ label: "Light", description: "skip architecture and design", fileRange: "3-8 files" }` | AC-009a |
| 3 | `"standard"` | `{ label: "Standard", description: "full workflow", fileRange: "9-20 files" }` | AC-009a |
| 4 | `"epic"` | `{ label: "Epic", description: "full workflow with decomposition", fileRange: "20+ files" }` | AC-009a |
| 5 | `"unknown-tier"` | `{ label: "Unknown", description: "unrecognized tier", fileRange: "unknown" }` | AC-009b |
| 6 | `null` | `{ label: "Unknown", description: "unrecognized tier", fileRange: "unknown" }` | AC-009b |
| 7 | `undefined` | `{ label: "Unknown", description: "unrecognized tier", fileRange: "unknown" }` | AC-009b |
| 8 | `""` | `{ label: "Unknown", description: "unrecognized tier", fileRange: "unknown" }` | AC-009b |
| 9 | `42` (number) | `{ label: "Unknown", description: "unrecognized tier", fileRange: "unknown" }` | AC-009b |

### 4.3 Immutability Tests

| # | Test | Expected |
|---|------|----------|
| 10 | Call `getTierDescription("trivial")`, mutate the returned object, call again | Second call returns original values (lookup table not mutated) |
| 11 | `TIER_ORDER` has exactly 4 elements in order | `['trivial', 'light', 'standard', 'epic']` |
| 12 | `TIER_DESCRIPTIONS` has keys matching `TIER_ORDER` | All 4 tiers present |

### 4.4 Test Code Skeleton

```javascript
describe('computeRecommendedTier()', () => {
    describe('base thresholds (AC-002a)', () => {
        it('returns trivial for 0 files', () => {
            assert.equal(computeRecommendedTier(0, null), 'trivial');
        });
        it('returns trivial for 1 file with low risk', () => {
            assert.equal(computeRecommendedTier(1, 'low'), 'trivial');
        });
        it('returns trivial for 2 files (boundary)', () => {
            assert.equal(computeRecommendedTier(2, 'low'), 'trivial');
        });
        it('returns light for 3 files (just above trivial)', () => {
            assert.equal(computeRecommendedTier(3, 'low'), 'light');
        });
        it('returns light for 8 files (boundary)', () => {
            assert.equal(computeRecommendedTier(8, 'low'), 'light');
        });
        it('returns standard for 9 files (just above light)', () => {
            assert.equal(computeRecommendedTier(9, 'low'), 'standard');
        });
        it('returns standard for 20 files (boundary)', () => {
            assert.equal(computeRecommendedTier(20, 'low'), 'standard');
        });
        it('returns epic for 21 files (just above standard)', () => {
            assert.equal(computeRecommendedTier(21, 'low'), 'epic');
        });
        it('returns epic for 100 files', () => {
            assert.equal(computeRecommendedTier(100, 'low'), 'epic');
        });
    });

    describe('risk-based promotion (AC-002b)', () => {
        it('promotes trivial to light for medium risk', () => {
            assert.equal(computeRecommendedTier(2, 'medium'), 'light');
        });
        it('promotes trivial to light for high risk', () => {
            assert.equal(computeRecommendedTier(2, 'high'), 'light');
        });
        it('promotes light to standard for medium risk', () => {
            assert.equal(computeRecommendedTier(5, 'medium'), 'standard');
        });
        it('promotes light to standard for high risk at boundary', () => {
            assert.equal(computeRecommendedTier(8, 'high'), 'standard');
        });
        it('promotes standard to epic for medium risk', () => {
            assert.equal(computeRecommendedTier(15, 'medium'), 'epic');
        });
        it('promotes standard to epic for high risk at boundary', () => {
            assert.equal(computeRecommendedTier(20, 'high'), 'epic');
        });
        it('does not promote epic (ceiling) for high risk', () => {
            assert.equal(computeRecommendedTier(21, 'high'), 'epic');
        });
        it('does not promote for low risk', () => {
            assert.equal(computeRecommendedTier(2, 'low'), 'trivial');
        });
        it('does not promote for null risk', () => {
            assert.equal(computeRecommendedTier(5, null), 'light');
        });
        it('does not promote for undefined risk', () => {
            assert.equal(computeRecommendedTier(5, undefined), 'light');
        });
    });

    describe('invalid estimatedFiles (AC-002c)', () => {
        it('returns standard for null', () => {
            assert.equal(computeRecommendedTier(null, 'low'), 'standard');
        });
        it('returns standard for undefined', () => {
            assert.equal(computeRecommendedTier(undefined, 'low'), 'standard');
        });
        it('returns standard for NaN', () => {
            assert.equal(computeRecommendedTier(NaN, 'low'), 'standard');
        });
        it('returns standard for negative number', () => {
            assert.equal(computeRecommendedTier(-1, 'low'), 'standard');
        });
        it('returns standard for string input', () => {
            assert.equal(computeRecommendedTier('three', 'low'), 'standard');
        });
        it('returns standard for Infinity', () => {
            assert.equal(computeRecommendedTier(Infinity, 'low'), 'standard');
        });
    });

    describe('unrecognized riskLevel (AC-002d)', () => {
        it('treats "critical" as low', () => {
            assert.equal(computeRecommendedTier(2, 'critical'), 'trivial');
        });
        it('treats "MEDIUM" (wrong case) as low', () => {
            assert.equal(computeRecommendedTier(5, 'MEDIUM'), 'light');
        });
        it('treats empty string as low', () => {
            assert.equal(computeRecommendedTier(5, ''), 'light');
        });
    });

    describe('custom thresholds (CON-002)', () => {
        it('uses custom thresholds when provided', () => {
            const custom = { trivial_max_files: 3, light_max_files: 10, standard_max_files: 25 };
            assert.equal(computeRecommendedTier(5, 'low', custom), 'light');
        });
        it('returns trivial at custom boundary', () => {
            const custom = { trivial_max_files: 3, light_max_files: 10, standard_max_files: 25 };
            assert.equal(computeRecommendedTier(3, 'low', custom), 'trivial');
        });
        it('uses defaults for null thresholds', () => {
            assert.equal(computeRecommendedTier(5, 'low', null), 'light');
        });
        it('uses defaults for undefined thresholds', () => {
            assert.equal(computeRecommendedTier(5, 'low', undefined), 'light');
        });
        it('fills missing fields with defaults for partial thresholds', () => {
            assert.equal(computeRecommendedTier(5, 'low', { trivial_max_files: 1 }), 'light');
            // trivial_max_files=1, light_max_files=8 (default), 5 <= 8 -> light
        });
    });
});

describe('getTierDescription()', () => {
    it('returns correct object for trivial (AC-009a)', () => {
        assert.deepEqual(getTierDescription('trivial'), {
            label: 'Trivial', description: 'direct edit, no workflow', fileRange: '1-2 files'
        });
    });
    it('returns correct object for light (AC-009a)', () => {
        assert.deepEqual(getTierDescription('light'), {
            label: 'Light', description: 'skip architecture and design', fileRange: '3-8 files'
        });
    });
    it('returns correct object for standard (AC-009a)', () => {
        assert.deepEqual(getTierDescription('standard'), {
            label: 'Standard', description: 'full workflow', fileRange: '9-20 files'
        });
    });
    it('returns correct object for epic (AC-009a)', () => {
        assert.deepEqual(getTierDescription('epic'), {
            label: 'Epic', description: 'full workflow with decomposition', fileRange: '20+ files'
        });
    });
    it('returns Unknown for unrecognized tier (AC-009b)', () => {
        assert.deepEqual(getTierDescription('unknown-tier'), {
            label: 'Unknown', description: 'unrecognized tier', fileRange: 'unknown'
        });
    });
    it('returns Unknown for null', () => {
        assert.deepEqual(getTierDescription(null), {
            label: 'Unknown', description: 'unrecognized tier', fileRange: 'unknown'
        });
    });
    it('returns Unknown for undefined', () => {
        assert.deepEqual(getTierDescription(undefined), {
            label: 'Unknown', description: 'unrecognized tier', fileRange: 'unknown'
        });
    });
    it('returns Unknown for empty string', () => {
        assert.deepEqual(getTierDescription(''), {
            label: 'Unknown', description: 'unrecognized tier', fileRange: 'unknown'
        });
    });
    it('returns Unknown for non-string input', () => {
        assert.deepEqual(getTierDescription(42), {
            label: 'Unknown', description: 'unrecognized tier', fileRange: 'unknown'
        });
    });
    it('returned objects are independent (mutation safety)', () => {
        const first = getTierDescription('trivial');
        first.label = 'MUTATED';
        const second = getTierDescription('trivial');
        assert.equal(second.label, 'Trivial');
    });
});

describe('TIER_ORDER', () => {
    it('contains exactly 4 tiers in order', () => {
        assert.deepEqual(TIER_ORDER, ['trivial', 'light', 'standard', 'epic']);
    });
});
```

**Total**: 41 test cases for `computeRecommendedTier()` + 10 for `getTierDescription()` + 1 for `TIER_ORDER` = **52 test cases**.

---

## 5. Before/After UX Examples

### 5.1 Example A: Trivial Change (2 files, low risk)

**BEFORE (current framework -- no trivial path)**:

```
$ /isdlc build "fix-typo-config-GH-99"

BUILD SUMMARY: fix-typo-config-GH-99

Analysis Status: Fully analyzed (5 of 5 phases complete)
Completed phases:
  [done] Phase 00: Quick Scan
  [done] Phase 01: Requirements
  [done] Phase 02: Impact Analysis
  [done] Phase 03: Architecture
  [done] Phase 04: Design

Build will execute:
  Phase 05: Test Strategy
  Phase 06: Implementation
  Phase 16: Quality Loop
  Phase 08: Code Review

Proceed? [Y/n] Y

  [branches created, state.json written, hooks fire,
   constitutional validation runs, 4 phases execute
   with full gate checks... ~15 minutes for a 2-file typo fix]
```

**AFTER (with complexity routing)**:

```
$ /isdlc analyze "fix-typo-config-GH-99"
  ...phases run...
Analysis complete. fix-typo-config-GH-99 is ready to build.
Recommended tier: trivial -- direct edit, no workflow

$ /isdlc build "fix-typo-config-GH-99"

Recommended workflow tier: trivial (1-2 files, direct edit, no workflow)

[1] Trivial -- direct edit, no workflow (1-2 files)  <-- RECOMMENDED
[2] Light -- skip architecture and design (3-8 files)
[3] Standard -- full workflow (9-20 files)
[4] Epic -- full workflow with decomposition (20+ files)

Select tier [1]: 1

TRIVIAL CHANGE: fix-typo-config-GH-99

Based on: requirements-spec.md
Source: github GH-99

  [framework reads requirements, makes the edit directly]

Changes made. Review and confirm? [Y/n/retry] Y

  [git add + git commit on current branch]

Trivial change completed:
  Files modified: src/config/defaults.json, src/utils/error-messages.js
  Commit: a1b2c3d
  Change record: docs/requirements/fix-typo-config-GH-99/change-record.md
```

**Time comparison**:
- Before: ~15 minutes (full workflow overhead)
- After: ~30 seconds of framework overhead + edit time

---

### 5.2 Example B: Standard Change (12 files, medium risk)

**BEFORE (current framework)**:

```
$ /isdlc build "auth-refactor-GH-42"

BUILD SUMMARY: auth-refactor-GH-42
  ...
Build will execute:
  Phase 05: Test Strategy
  Phase 06: Implementation
  ...
Proceed? [Y/n] Y

  [full workflow executes -- same as today]
```

**AFTER (with complexity routing)**:

```
$ /isdlc analyze "auth-refactor-GH-42"
  ...phases run...
Analysis complete. auth-refactor-GH-42 is ready to build.
Recommended tier: standard -- full workflow

$ /isdlc build "auth-refactor-GH-42"

Recommended workflow tier: standard (9-20 files, full workflow)

[1] Trivial -- direct edit, no workflow (1-2 files)
[2] Light -- skip architecture and design (3-8 files)
[3] Standard -- full workflow (9-20 files)  <-- RECOMMENDED
[4] Epic -- full workflow with decomposition (20+ files)

Select tier [3]:

  [user presses Enter, accepting default]

BUILD SUMMARY: auth-refactor-GH-42
  ...
  [identical to current flow from here -- steps 4a-9 unchanged]
```

**Difference**: One additional menu prompt (tier selection) before the existing flow. For standard/light/epic, the rest of the build is unchanged.

---

### 5.3 Example C: User Overrides Recommendation

```
$ /isdlc build "small-config-change-GH-77"

Recommended workflow tier: light (3-8 files, skip architecture and design)

[1] Trivial -- direct edit, no workflow (1-2 files)
[2] Light -- skip architecture and design (3-8 files)  <-- RECOMMENDED
[3] Standard -- full workflow (9-20 files)
[4] Epic -- full workflow with decomposition (20+ files)

Select tier [2]: 1

TRIVIAL CHANGE: small-config-change-GH-77

Based on: quick-scan.md
Source: github GH-77

  [framework makes the edit on current branch]

Changes made. Review and confirm? [Y/n/retry] Y

Trivial change completed:
  Files modified: src/config/feature-flags.json
  Commit: f3e4d5c
  Change record: docs/requirements/small-config-change-GH-77/change-record.md
```

In this case, `meta.json` records the override:
```json
{
  "tier_override": {
    "recommended": "light",
    "selected": "trivial",
    "overridden_at": "2026-02-20T10:15:00Z"
  }
}
```

---

### 5.4 Example D: Legacy meta.json (no tier recommendation)

```
$ /isdlc build "old-feature-from-last-month"

No tier recommendation available. Defaulting to standard.

[1] Trivial -- direct edit, no workflow (1-2 files)
[2] Light -- skip architecture and design (3-8 files)
[3] Standard -- full workflow (9-20 files)
[4] Epic -- full workflow with decomposition (20+ files)

Select tier [3]: 3

BUILD SUMMARY: old-feature-from-last-month
  ...
  [standard workflow proceeds normally]
```

---

### 5.5 Example E: Error During Trivial Edit

```
$ /isdlc build "fix-import-GH-88" --trivial

Trivial tier selected via flag. Proceed with direct edit? [Y/n] Y

TRIVIAL CHANGE: fix-import-GH-88

Based on: draft.md
Source: github GH-88

  [framework attempts edit, but target file doesn't exist]

Error: File not found: src/legacy/old-module.js
The file referenced in the requirements may have been moved or renamed.

Options:
  [R] Retry the edit
  [E] Escalate to light tier (creates workflow)
  [A] Abort (no changes committed)

Selection: E

  [returns to tier menu with "light" pre-selected]

Recommended workflow tier: light (3-8 files, skip architecture and design)

[1] Trivial -- direct edit, no workflow (1-2 files)
[2] Light -- skip architecture and design (3-8 files)  <-- PRE-SELECTED
[3] Standard -- full workflow (9-20 files)
[4] Epic -- full workflow with decomposition (20+ files)

Select tier [2]:
  [user accepts light, full workflow begins]
```

---

### 5.6 Example F: Epic Placeholder (CON-003)

```
$ /isdlc build "massive-refactor-GH-101"

Recommended workflow tier: epic (20+ files, full workflow with decomposition)

[1] Trivial -- direct edit, no workflow (1-2 files)
[2] Light -- skip architecture and design (3-8 files)
[3] Standard -- full workflow (9-20 files)
[4] Epic -- full workflow with decomposition (20+ files)  <-- RECOMMENDED

Select tier [4]: 4

Epic decomposition is not yet available. Running standard workflow.

BUILD SUMMARY: massive-refactor-GH-101
  ...
  [standard workflow proceeds]
```

---

## 6. Implementation Checklist

Recommended implementation order (bottom-up, per architecture and impact analysis):

| # | File | What | Est. Lines | Depends On |
|---|------|------|-----------|------------|
| 1 | `src/isdlc/config/workflows.json` | Add `tier_thresholds` block under `workflows.feature` | +6 | Nothing |
| 2 | `src/claude/hooks/lib/three-verb-utils.cjs` | Add constants (`TIER_ORDER`, `DEFAULT_TIER_THRESHOLDS`, `TIER_DESCRIPTIONS`), `computeRecommendedTier()`, `getTierDescription()`, update exports | +95 | #1 (for config awareness) |
| 3 | `src/claude/hooks/tests/test-three-verb-utils.test.cjs` | Add 52 test cases for new functions | +210 | #2 |
| 4 | `src/claude/commands/isdlc.md` (analyze handler) | After Phase 02: compute tier from IA metrics, persist to meta.json; Step 8: tier display | +25 | #2 (uses computeRecommendedTier, getTierDescription) |
| 5 | `src/claude/commands/isdlc.md` (build handler) | Step 4a-tier menu + trivial execution path (T1-T9) | +160 | #2, #4 |

**Total estimated change**: ~495 new lines across 5 files (quick-scan-agent.md no longer modified).

---

## Phase Gate Validation (GATE-04 -- Design, Analysis Mode)

- [x] Pseudocode provided for all new/modified components (6 components)
- [x] Control flow diagrams for build handler tier decision, trivial execution sequence, and tier vs sizing interaction
- [x] Data schemas defined: meta.json tier fields, change-record.md format, workflows.json tier_thresholds
- [x] Test case matrix complete: 52 boundary cases for computeRecommendedTier + getTierDescription
- [x] Before/after UX examples for 6 scenarios (trivial, standard, override, legacy, error, epic)
- [x] All designs trace to requirements (FR/NFR/CON) and architecture decisions (AD-01..AD-07)
- [x] Backward compatibility preserved (NFR-002): no changes to readMetaJson/writeMetaJson/computeStartPhase
- [x] State isolation verified (NFR-005): trivial path never touches state.json, never invokes hooks
- [x] Error handling specified for all trivial path failure modes (AC-006e)
- [x] Implementation order specified (bottom-up: config -> utility -> tests -> handlers)

---

*Design specification completed in ANALYSIS MODE -- no state.json writes, no branches created.*
