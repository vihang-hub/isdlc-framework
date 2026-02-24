# Module Design: isdlc.md Phase-Loop Controller Changes

**Version**: 1.0.0
**Phase**: 04-design
**Traces to**: FR-01 (AC-02), FR-03 (AC-08-AC-11), FR-04 (AC-12-AC-14), ADR-0001

---

## 1. Module Overview

**File**: `src/claude/commands/isdlc.md`
**Change Type**: MODIFY
**Estimated Lines Added**: ~120 (STEP 3e-sizing block + feature command flag parsing)

Two changes are made to isdlc.md:
1. Add `-light` flag documentation and parsing to the feature command section
2. Add STEP 3e-sizing as a new conditional step in the Phase-Loop Controller

---

## 2. Change 1: Feature Command Section -- `-light` Flag

### 2.1 Location

Insert into the "feature" command section, after the existing usage examples.

### 2.2 Specification

Add to the usage block:

```
/isdlc feature -light "Feature description"
/isdlc feature -light "Feature description" --project api-service
```

Add to the step 1 description (workflow initialization):

```
1. Validate constitution exists and is not a template
2. Check no active workflow (block if one exists, suggest `/isdlc cancel` first)
3. Parse flags from command arguments:
   - If args contain "-light": set flags.light = true, remove "-light" from description
4. Initialize `active_workflow` in state.json with type `"feature"`,
   phases `["00-quick-scan", "01-requirements", "02-impact-analysis", ...]`,
   and flags: `{ light: flags.light || false }`
```

### 2.3 Flag Parsing Pseudo-code

The Phase-Loop Controller (or the orchestrator init-and-phase-01 handler) must parse the `-light` flag from the feature command arguments:

```
Given: /isdlc feature -light "Add helper function"

1. Split command arguments after "feature"
2. If "-light" found among arguments:
   a. Set flags.light = true
   b. Remove "-light" from the arguments before passing to orchestrator
3. Pass flags object to orchestrator in init-and-phase-01 mode
4. Orchestrator stores flags in active_workflow.flags
```

### 2.4 Orchestrator Propagation

In STEP 1 (INIT), add to the Task tool prompt:

```
Use Task tool -> sdlc-orchestrator with:
  MODE: init-and-phase-01
  ACTION: feature
  DESCRIPTION: "{user description}"
  FLAGS: { light: true }   <-- NEW: include if -light flag parsed
```

The orchestrator stores `flags` in `active_workflow.flags` during initialization. The Phase-Loop Controller reads `active_workflow.flags.light` in STEP 3e-sizing.

---

## 3. Change 2: STEP 3e-sizing -- Sizing Decision Point

### 3.1 Location

Insert between existing STEP 3e (post-phase state update) and STEP 3e-refine (task refinement). The step numbering is `3e-sizing` to parallel the existing `3e-refine` pattern.

### 3.2 Full Markdown Specification

The following is the exact markdown block to be added to isdlc.md:

```markdown
**3e-sizing.** SIZING DECISION POINT (conditional) -- After the post-phase
state update, check if adaptive workflow sizing should run.

**Trigger check**:
1. Read the phase key that was just completed from the state update in 3e
2. If `phase_key === '02-impact-analysis'` AND `active_workflow.type === 'feature'`:
   a. Read `active_workflow.sizing` from state.json
   b. If `sizing` is already set (not undefined/null): skip to 3e-refine (prevent double-sizing)
   c. If `sizing` is not set: execute sizing flow (below)
3. Otherwise (not Phase 02, or not feature workflow): skip to 3e-refine

**Sizing flow**:

**S1.** Read configuration:
   - Read `active_workflow.flags.light` from state.json
   - Read `workflows.json` -> `workflows.feature.sizing`
   - If `sizing.enabled` is falsy or `sizing` block is missing: skip sizing entirely (default to standard, no UX prompt). Write sizing record: `{ intensity: 'standard', effective_intensity: 'standard', recommended_by: 'framework', overridden: false, decided_at: <now>, forced_by_flag: false, epic_deferred: false }`. Write state.json, then skip to 3e-refine.

**S2.** IF `-light` flag is set (`active_workflow.flags.light === true`):
   a. Call `applySizingDecision(state, 'light', { forced_by_flag: true, config: sizingConfig })`
      where `sizingConfig` = `{ light_skip_phases: workflows.feature.sizing.light_skip_phases }`
   b. Write state.json
   c. Display forced-light banner:
      ```
      +----------------------------------------------------------+
      |  WORKFLOW SIZING: Light (forced via -light flag)          |
      |                                                           |
      |  Skipping phases:                                         |
      |    - Phase 03: Architecture                               |
      |    - Phase 04: Design                                     |
      |                                                           |
      |  Workflow: 00 -> 01 -> 02 -> 05 -> 06 -> 16 -> 08       |
      +----------------------------------------------------------+
      ```
   d. Update task list: find tasks for skipped phases, mark as completed with subject `~~[N] {subject} (Skipped -- light workflow)~~`
   e. Skip to 3e-refine

**S3.** ELSE (standard sizing flow):
   a. Read impact-analysis.md:
      - Path: `docs/requirements/{artifact_folder}/impact-analysis.md`
      - If file not found: default to standard, log warning, write sizing record, skip to 3e-refine
   b. Call `parseSizingFromImpactAnalysis(content)`
      - If returns null: default to standard with rationale "Unable to parse impact analysis", write sizing record, skip to 3e-refine
   c. Read thresholds: `workflows.json` -> `workflows.feature.sizing.thresholds`
      - If missing: use defaults `{ light_max_files: 5, epic_min_files: 20 }`
   d. Call `computeSizingRecommendation(metrics, thresholds)`
   e. Display sizing recommendation banner (see UX Specification below)
   f. Present user menu using `AskUserQuestion`:
      - `[A] Accept recommendation`
      - `[O] Override (choose different intensity)`
      - `[S] Show full impact analysis`
   g. Handle user choice:
      - **[A] Accept**:
        - If intensity is 'epic': inform user that epic is deferred, proceeding with standard
        - Call `applySizingDecision(state, recommendation.intensity, { metrics, config: sizingConfig })`
      - **[O] Override**:
        - Present intensity picker: `[1] Light  [2] Standard  [3] Epic`
        - Call `applySizingDecision(state, chosen, { metrics, overridden: true, overridden_to: chosen, recommended_intensity: recommendation.intensity, config: sizingConfig })`
      - **[S] Show analysis**:
        - Display full impact-analysis.md content
        - Return to menu (repeat step f)
   h. Write state.json
   i. If effective_intensity is 'light': update task list (mark skipped phase tasks as completed)
   j. Display applied sizing confirmation banner
   k. Proceed to 3e-refine
```

### 3.3 Task List Synchronization

When phases are removed from the workflow (light intensity), the Phase-Loop Controller must update the TaskCreate task list to reflect the change:

```
For each phase in skip_phases:
  1. Call TaskList to find all tasks
  2. Find the task whose subject contains the phase display name
     (e.g., "[4] Design architecture (Phase 03)")
  3. Call TaskUpdate:
     - status: "completed"
     - subject: "~~[4] Design architecture (Phase 03) (Skipped -- light workflow)~~"
```

This ensures the user's terminal shows accurate task status.

---

## 4. UX Specification: Sizing Recommendation Banner

### 4.1 Light Recommendation Banner

```
+----------------------------------------------------------+
|  WORKFLOW SIZING RECOMMENDATION                           |
|                                                           |
|  Recommended: LIGHT                                       |
|  Rationale: Low scope (3 files, low risk).                |
|             Architecture and Design phases can be skipped. |
|                                                           |
|  Impact Analysis Summary:                                 |
|    Files affected:  3                                     |
|    Modules:         1                                     |
|    Risk level:      low                                   |
|    Coupling:        low                                   |
|    Coverage gaps:   0                                     |
|                                                           |
|  If accepted, workflow becomes:                           |
|    00 -> 01 -> 02 -> 05 -> 06 -> 16 -> 08               |
|    (skipping Phase 03: Architecture, Phase 04: Design)    |
+----------------------------------------------------------+
```

### 4.2 Standard Recommendation Banner

```
+----------------------------------------------------------+
|  WORKFLOW SIZING RECOMMENDATION                           |
|                                                           |
|  Recommended: STANDARD                                    |
|  Rationale: Medium scope (12 files, medium risk).         |
|             Full workflow recommended.                     |
|                                                           |
|  Impact Analysis Summary:                                 |
|    Files affected:  12                                    |
|    Modules:         4                                     |
|    Risk level:      medium                                |
|    Coupling:        medium                                |
|    Coverage gaps:   1                                     |
|                                                           |
|  Workflow unchanged:                                      |
|    00 -> 01 -> 02 -> 03 -> 04 -> 05 -> 06 -> 16 -> 08  |
+----------------------------------------------------------+
```

### 4.3 Epic Recommendation Banner

```
+----------------------------------------------------------+
|  WORKFLOW SIZING RECOMMENDATION                           |
|                                                           |
|  Recommended: EPIC                                        |
|  Rationale: Large scope (35 files, high risk).            |
|             Epic decomposition recommended.                |
|                                                           |
|  Impact Analysis Summary:                                 |
|    Files affected:  35                                    |
|    Modules:         8                                     |
|    Risk level:      high                                  |
|    Coupling:        high                                  |
|    Coverage gaps:   5                                     |
|                                                           |
|  NOTE: Epic execution is not yet implemented.             |
|  If accepted, workflow proceeds with STANDARD intensity.  |
|  The epic recommendation is recorded for future use.      |
+----------------------------------------------------------+
```

### 4.4 User Menu (AskUserQuestion)

```
Select an option:

[A] Accept recommendation (LIGHT)
[O] Override -- choose a different intensity
[S] Show full impact analysis

Enter selection:
```

### 4.5 Override Sub-menu

```
Choose workflow intensity:

[1] Light    -- Skip Architecture and Design (for small changes)
[2] Standard -- Full 9-phase workflow (default)
[3] Epic     -- Large scope (proceeds as Standard -- epic not yet implemented)

Enter selection (1-3):
```

### 4.6 Applied Confirmation Banner

After sizing is applied:

```
+----------------------------------------------------------+
|  SIZING APPLIED: LIGHT                                    |
|                                                           |
|  Phases 03 (Architecture) and 04 (Design) removed.       |
|  Next phase: 05 - Test Strategy                           |
|  Remaining phases: 5                                      |
+----------------------------------------------------------+
```

Or for standard/epic:

```
+----------------------------------------------------------+
|  SIZING APPLIED: STANDARD                                 |
|                                                           |
|  Full workflow retained.                                   |
|  Next phase: 03 - Architecture                            |
|  Remaining phases: 6                                      |
+----------------------------------------------------------+
```

---

## 5. Interaction Flow Diagram

```
Phase 02 (IA) completes -> GATE-02 passes
    |
    v
STEP 3e: Post-phase state update
    |
    v
STEP 3e-sizing: Trigger check
    |
    +--> Not Phase 02 or not feature? ---> Skip to 3e-refine
    |
    +--> sizing already set? ---> Skip to 3e-refine
    |
    +--> sizing.enabled === false? ---> Write default record, skip to 3e-refine
    |
    +--> flags.light === true?
    |       |
    |       +--> Apply light, display banner, update tasks
    |       +--> Skip to 3e-refine
    |
    +--> Standard flow:
            |
            +--> Read impact-analysis.md
            +--> Parse metrics (parseSizingFromImpactAnalysis)
            +--> Compute recommendation (computeSizingRecommendation)
            +--> Display recommendation banner
            +--> Present menu [A] [O] [S]
            |       |
            |       +--> [A] Accept -> Apply decision
            |       +--> [O] Override -> Sub-menu -> Apply decision
            |       +--> [S] Show analysis -> Display -> Return to menu
            |
            +--> Write state.json
            +--> Update tasks if light
            +--> Display confirmation
            +--> Proceed to 3e-refine
```

---

## 6. Edge Cases

| Edge Case | Handling | Traces |
|-----------|---------|--------|
| STEP 3e-sizing runs but Phase 02 was not IA (e.g., fix workflow has 02-tracing) | Trigger check fails: `phase_key === '02-impact-analysis'` is false. Skip. | NFR-02 |
| Feature workflow with no impact-analysis.md file | Default to standard, log warning, write sizing record. | AC-02, Article X |
| User presses Ctrl+C during menu | Treat as "Accept" if possible, or default to standard. | Article X |
| Re-entry after crash (sizing already in state) | Double-sizing guard: `if (aw.sizing) skip`. | Security 3.3 |
| `-light` flag on `/isdlc fix` | The trigger check requires `active_workflow.type === 'feature'`. Fix workflows never hit sizing. The flag is ignored at the command parsing level since fix does not define a `light` option. | NFR-02, AC-14 |
| Sizing recommends epic, user accepts | Record `intensity: 'epic'`, `effective_intensity: 'standard'`, `epic_deferred: true`. Proceed with standard phases. | AC-06, Section 8 of arch |

---

## 7. Traceability

| Component | Requirement | AC |
|-----------|-------------|-----|
| `-light` flag parsing | FR-04 | AC-12, AC-13, AC-14 |
| Trigger check (after Phase 02, feature only) | FR-01 | AC-02 |
| Read IA metrics | FR-01 | AC-01 |
| Recommendation display | FR-03 | AC-08 |
| User menu [A]/[O]/[S] | FR-03 | AC-09, AC-10 |
| Override recording | FR-03, FR-07 | AC-10, AC-11 |
| Phase array modification | FR-05 | AC-15, AC-16, AC-17, AC-18 |
| Task list synchronization | FR-05 (derived) | UX consistency |
