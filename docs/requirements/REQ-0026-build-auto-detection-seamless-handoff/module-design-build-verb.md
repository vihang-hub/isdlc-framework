# Module Design: Build Verb Handler (isdlc.md)

**Phase**: 04-design
**Feature ID**: REQ-BUILD-AUTODETECT
**Module**: `src/claude/commands/isdlc.md`
**Change Type**: MODIFY (insert detection logic between steps 4 and 7)
**Based On**: architecture.md (ADR-001, ADR-003, ADR-004), requirements-spec.md (FR-001 through FR-008)

---

## 1. Overview

This module design specifies the changes to the `build` verb handler in `isdlc.md`. The build verb handler is the entry point for `/isdlc build` and its alias `/isdlc feature`. The changes insert auto-detection logic between the existing meta.json read (step 4) and the orchestrator delegation (step 7), implementing the decision flow for fully-analyzed, partially-analyzed, stale, and raw items.

**Key principle**: The build verb handler is a thin orchestration layer. All computation is performed by utility functions in `three-verb-utils.cjs`. The handler's role is to call utility functions, execute git commands for staleness enrichment, present UX menus, and delegate to the orchestrator with the correct parameters.

**Traces**: FR-001 through FR-008, NFR-001, NFR-003, NFR-004

---

## 2. Current Step Sequence (Before)

```
Step 1: Validate constitution exists and is not a template
Step 2: Check no active workflow
Step 3: Resolve target item using resolveItem(input)
Step 4: Read meta.json using readMetaJson() -- informational for this release
Step 5: Parse flags (--supervised, --debate, etc.)
Step 6: Determine workflow type (feature vs fix)
Step 7: Delegate to orchestrator (MODE: init-and-phase-01)
Step 8: Orchestrator initializes workflow
Step 9: Phase-Loop Controller drives remaining phases
```

---

## 3. Modified Step Sequence (After)

```
Step 1:  Validate constitution (UNCHANGED)
Step 2:  Check no active workflow (UNCHANGED)
Step 3:  Resolve target item (UNCHANGED)
Step 4:  Read meta.json (UNCHANGED, but now actionable)

--- NEW STEPS (inserted between existing 4 and 5) ---

Step 4a: Compute analysis status
         Call computeStartPhase(meta, featurePhases)

Step 4b: Check staleness (if not raw)
         Call checkStaleness(meta, currentGitHash)
         Enrich with git rev-list --count if stale

Step 4c: Handle staleness (if stale)
         Present staleness menu: [P] Proceed / [Q] Re-run quick-scan / [A] Re-analyze
         Update state based on user choice

Step 4d: Handle partial analysis (if partial)
         Present partial-analysis menu: [R] Resume / [S] Skip / [F] Full restart
         Compute final START_PHASE based on user choice

Step 4e: Display BUILD SUMMARY banner (if not raw)
         Show completed/remaining phases
         Confirm with user [Y/n]

--- END NEW STEPS ---

Step 5:  Parse flags (UNCHANGED)
Step 6:  Determine workflow type (UNCHANGED)
Step 7:  Delegate to orchestrator WITH START_PHASE + ARTIFACT_FOLDER (MODIFIED)
Step 8:  Orchestrator initializes workflow (UNCHANGED)
Step 9:  Phase-Loop Controller (UNCHANGED)
```

---

## 4. Detailed Step Designs

### 4.1 Step 4a: Compute Analysis Status

**Purpose**: Determine the analysis completion level and the recommended start phase.

**Input**:
- `meta` -- result of `readMetaJson(slugDir)` from step 4 (may be null)
- `featurePhases` -- the full feature workflow phases array from `workflows.json`

**Implementation**:

```
LET featurePhases = Read workflows.json -> workflows.feature.phases
  // ["00-quick-scan", "01-requirements", "02-impact-analysis",
  //  "03-architecture", "04-design", "05-test-strategy",
  //  "06-implementation", "16-quality-loop", "08-code-review"]

LET result = computeStartPhase(meta, featurePhases)
  // Returns { status, startPhase, completedPhases, remainingPhases, warnings }

IF result.warnings AND result.warnings.length > 0:
  Log each warning to stderr (non-blocking diagnostic)

LET analysisStatus = result.status
LET startPhase = result.startPhase
LET completedPhases = result.completedPhases
LET remainingPhases = result.remainingPhases
```

**Output**: `analysisStatus`, `startPhase`, `completedPhases`, `remainingPhases`

**Error handling**: If `computeStartPhase` returns `status: 'raw'`, skip steps 4b through 4e and fall through to step 5 (full workflow).

**Traces**: FR-001

---

### 4.2 Step 4b: Check Staleness

**Guard**: Only execute if `analysisStatus !== 'raw'`. Raw items have no analysis to be stale.

**Purpose**: Determine if the codebase has changed since analysis was performed.

**Implementation**:

```
TRY:
  LET currentHash = Execute: git rev-parse --short HEAD
  // Trim whitespace from output
CATCH:
  // Git not available or not in a git repo
  Log warning: "Could not determine current codebase version. Skipping staleness check."
  LET stalenessResult = { stale: false, originalHash: null, currentHash: null, commitsBehind: null }
  SKIP to step 4c (staleness handling will be a no-op)

LET stalenessResult = checkStaleness(meta, currentHash)

IF stalenessResult.stale:
  TRY:
    LET commitCount = Execute: git rev-list --count {stalenessResult.originalHash}..HEAD
    stalenessResult.commitsBehind = parseInt(commitCount.trim(), 10)
  CATCH:
    // rev-list failed (original hash no longer reachable, force-push, etc.)
    stalenessResult.commitsBehind = null
    // Proceed with staleness warning without commit count
```

**Output**: `stalenessResult` with populated `commitsBehind`

**Performance**: Two git commands (`rev-parse` + `rev-list`) take ~100-300ms combined, well within NFR-001 (p95 < 2s) and NFR-002 (p95 < 1s).

**Traces**: FR-004 (AC-004-01, AC-004-02, AC-004-07), NFR-002, NFR-004 (AC-NFR-004-02)

---

### 4.3 Step 4c: Handle Staleness

**Guard**: Only execute if `stalenessResult.stale === true`.

**Purpose**: Present the user with options for handling stale analysis.

**UX Display**:

```
STALENESS WARNING: {item slug}

Analysis was performed at commit {originalHash}{commitsBehindStr}.
Current HEAD is {currentHash}.

{commitsBehindStr}: Formatted as " (N commits ago)" if commitsBehind is not null,
                    or "" if null.

Options:
  [P] Proceed anyway -- use existing analysis as-is
  [Q] Re-run quick-scan -- refresh scope check, keep remaining analysis
  [A] Re-analyze from scratch -- clear all analysis, start fresh
```

**Menu interaction**: Present using natural conversation (the build verb handler is in isdlc.md, a markdown command spec that operates through conversational interaction). Ask the user to choose P, Q, or A.

**Handling each choice**:

```
IF user selects [P] Proceed anyway:
  // No changes. Continue with current analysisStatus and startPhase.
  // meta.codebase_hash is NOT updated (AC-004-04: retains original for traceability)

IF user selects [Q] Re-run quick-scan:
  // Override startPhase to re-run Phase 00
  LET startPhase = "00-quick-scan"
  // remainingPhases becomes all phases from 00 onward
  LET remainingPhases = featurePhases
  // Note: meta.codebase_hash will be updated by Phase 00 agent when it writes quick-scan
  // The analysisStatus display will note that Phase 00 will be re-run
  // Completed phases from before are preserved (01-04 artifacts remain)
  // But the workflow starts from 00, so 01-04 will also re-run
  // CORRECTION: Per AC-004-05, only Phase 00 is re-executed, remaining analysis intact.
  // This means we need phases from 00 but skip the ones between 01 and the
  // already-completed analysis phases. Actually, re-reading the AC:
  //   "Phase 00 is re-executed (updating the quick-scan artifact),
  //    meta.json.codebase_hash is updated to the current HEAD,
  //    and the workflow continues from the appropriate point based on
  //    remaining analysis status."
  // So after re-running quick-scan, the analysis status is re-evaluated.
  // The simplest implementation: start from Phase 00, but after Phase 00
  // completes, the Phase-Loop Controller will advance to the next phase
  // in the array. If we set phases to start at 00, all phases run.
  // To preserve existing analysis: start at 00, but the phases array
  // should include only 00 + the remaining unfinished phases.
  //
  // Implementation decision: When [Q] is selected, set startPhase to
  // "00-quick-scan". The workflow will include Phase 00 and then continue
  // from where the analysis left off. This means:
  //   - If originally fully analyzed: phases = [00, 05, 06, 16, 08]
  //   - If originally partial (00,01 done): phases = [00, 02, 03, 04, 05, 06, 16, 08]
  //
  // The orchestrator handles this by receiving START_PHASE="00-quick-scan"
  // plus a QUICK_SCAN_ONLY flag that tells it to re-run just Phase 00
  // and then continue from the originally computed startPhase.
  //
  // SIMPLIFIED APPROACH: Set startPhase = "00-quick-scan" and let the
  // full phase array from that point run. This means phases 01-04 re-run
  // even if they were complete. While not strictly minimal, it is the
  // safest approach after a staleness detection -- the codebase changed,
  // so re-running analysis is appropriate.
  //
  // FINAL DECISION: For [Q], we re-run from Phase 00 with the full phases
  // array from that point onward. The startPhase is "00-quick-scan",
  // remainingPhases = featurePhases (all 9 phases).
  // This is equivalent to the [A] re-analyze choice but preserves
  // the meta.json phases_completed (they are not cleared).
  // Actually, the intent of [Q] is to ONLY re-run quick-scan and keep
  // the rest. This requires a more nuanced approach that the orchestrator
  // cannot easily support with a single START_PHASE.
  //
  // RESOLUTION: Given the complexity of "re-run only Phase 00 then skip
  // to where we were," the pragmatic approach is:
  //   [Q] Sets START_PHASE = "00-quick-scan" (full re-analysis from 00)
  //   The UX note explains: "Quick-scan will refresh. Subsequent phases
  //   will re-run to incorporate any scope changes."
  //
  // This aligns with the safety principle: if the codebase changed enough
  // to trigger staleness, re-running analysis is the safer path.

  LET startPhase = "00-quick-scan"
  LET remainingPhases = [...featurePhases]
  LET analysisStatus = 'raw'  // Reset to raw since we are starting from scratch effectively

IF user selects [A] Re-analyze from scratch:
  // Clear analysis in meta.json
  meta.phases_completed = []
  meta.analysis_status = "raw"
  meta.codebase_hash = currentHash
  // Write updated meta.json
  Call writeMetaJson(slugDir, meta)
  // Set to full workflow
  LET startPhase = null
  LET analysisStatus = 'raw'
  LET completedPhases = []
  LET remainingPhases = [...featurePhases]
```

**Traces**: FR-004 (AC-004-03 through AC-004-06)

---

### 4.4 Step 4d: Handle Partial Analysis

**Guard**: Only execute if `analysisStatus === 'partial'` (after staleness handling).

**Purpose**: Present the user with options for proceeding with partial analysis.

**UX Display**:

```
PARTIAL ANALYSIS: {item slug}

Completed phases:
  [done] Phase 00: Quick Scan
  [done] Phase 01: Requirements

Remaining analysis phases:
  Phase 02: Impact Analysis
  Phase 03: Architecture
  Phase 04: Design

Options:
  [R] Resume analysis -- continue from Phase 02
  [S] Skip to implementation -- start at Phase 05 (analysis gaps may reduce quality)
  [F] Full restart -- re-run all phases from Phase 00
```

**Menu interaction**: Ask the user to choose R, S, or F.

**Handling each choice**:

```
IF user selects [R] Resume analysis:
  // startPhase is already set to the next incomplete analysis phase
  // (e.g., "02-impact-analysis"). No changes needed.
  // remainingPhases already includes analysis + implementation phases.

IF user selects [S] Skip to implementation:
  LET startPhase = "05-test-strategy"
  LET remainingPhases = featurePhases.filter(p => IMPLEMENTATION_PHASES.includes(p))
  // Display warning:
  "Note: Skipping remaining analysis phases. Output quality may be affected
   by missing impact analysis, architecture, or design specifications."

IF user selects [F] Full restart:
  // Clear analysis in meta.json
  meta.phases_completed = []
  meta.analysis_status = "raw"
  Call writeMetaJson(slugDir, meta)
  // Set to full workflow
  LET startPhase = null
  LET analysisStatus = 'raw'
  LET completedPhases = []
  LET remainingPhases = [...featurePhases]
```

**Traces**: FR-003 (AC-003-01 through AC-003-06)

---

### 4.5 Step 4e: Display BUILD SUMMARY Banner

**Guard**: Only execute if `analysisStatus !== 'raw'` (after staleness and partial handling). For raw items, no banner is shown -- the workflow proceeds normally.

**Purpose**: Show a summary of what the build will do and confirm with the user.

**UX Display for fully-analyzed items** (AC-005-01):

```
BUILD SUMMARY: {item slug}

Analysis Status: Fully analyzed
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

Proceed? [Y/n]
```

**UX Display for partial-analysis resume** (AC-005-03):

```
BUILD SUMMARY: {item slug}

Analysis Status: Partial (2 of 5 phases complete)
Completed phases:
  [done] Phase 00: Quick Scan
  [done] Phase 01: Requirements

Build will execute:
  Phase 02: Impact Analysis
  Phase 03: Architecture
  Phase 04: Design
  Phase 05: Test Strategy
  Phase 06: Implementation
  Phase 16: Quality Loop
  Phase 08: Code Review

Proceed? [Y/n]
```

**Phase Display Name Map** (for formatting):

| Phase Key | Display Name |
|-----------|-------------|
| `00-quick-scan` | Phase 00: Quick Scan |
| `01-requirements` | Phase 01: Requirements |
| `02-impact-analysis` | Phase 02: Impact Analysis |
| `03-architecture` | Phase 03: Architecture |
| `04-design` | Phase 04: Design |
| `05-test-strategy` | Phase 05: Test Strategy |
| `06-implementation` | Phase 06: Implementation |
| `16-quality-loop` | Phase 16: Quality Loop |
| `08-code-review` | Phase 08: Code Review |

**Confirmation**: If user declines (n), abort the build. If user confirms (Y or Enter), proceed to step 5.

**Traces**: FR-005 (AC-005-01 through AC-005-03)

---

### 4.6 Modified Step 7: Orchestrator Delegation

**Purpose**: Delegate to the orchestrator with optional `START_PHASE` and `ARTIFACT_FOLDER` parameters.

**Current delegation** (before this feature):

```
Use Task tool -> sdlc-orchestrator with:
  MODE: init-and-phase-01
  ACTION: feature
  DESCRIPTION: "{item description}"
  FLAGS: {parsed flags}
```

**Modified delegation** (after this feature):

```
Use Task tool -> sdlc-orchestrator with:
  MODE: init-and-phase-01
  ACTION: feature (or fix, based on step 6)
  DESCRIPTION: "{item description}"
  FLAGS: {parsed flags}

  // NEW parameters (only included when applicable):
  IF startPhase is not null:
    START_PHASE: "{startPhase}"
  IF item was resolved from an existing directory:
    ARTIFACT_FOLDER: "{item.slug}"
  IF item has an existing REQ-prefixed folder:
    ARTIFACT_FOLDER: "{existing folder name}"
```

**ARTIFACT_FOLDER logic**:

```
IF analysisStatus === 'analyzed' OR analysisStatus === 'partial':
  // Item was resolved from an existing directory
  ARTIFACT_FOLDER = item.slug
  // item.slug comes from resolveItem() in step 3
  // Examples: "build-auto-detection-seamless-handoff"
  //           "REQ-0022-performance-budget-guardrails"
ELSE IF analysisStatus === 'raw' AND item was resolved (not newly created):
  ARTIFACT_FOLDER = item.slug
  // Even raw items with existing directories should reuse the folder
ELSE:
  // Newly created item (add handler ran in step 3)
  // Do NOT pass ARTIFACT_FOLDER -- let orchestrator create new REQ-NNNN-slug
```

**Traces**: FR-006 (AC-006-01, AC-006-05), FR-007 (AC-007-01 through AC-007-03)

---

## 5. Decision Flow Diagram

```
                    /isdlc build "item"
                          |
                    [Step 1-3: validate, check workflow, resolve item]
                          |
                    [Step 4: readMetaJson]
                          |
                    [Step 4a: computeStartPhase]
                          |
                    +-----+-----+
                    |     |     |
                  raw  partial  analyzed
                    |     |     |
                    |     |     +--[Step 4b: checkStaleness]
                    |     |     |
                    |     +-----+--[Step 4b: checkStaleness]
                    |     |        |
                    |     |     stale?
                    |     |    /     \
                    |     |  yes      no
                    |     |   |        |
                    |     | [4c: staleness menu]
                    |     |   |
                    |     | P/Q/A?
                    |     |  |  \   \
                    |     |  P   Q   A--> clear meta, set raw
                    |     |  |   |
                    |     |  |   set startPhase=00
                    |     |  |
                    |   partial?
                    |   /      \
                    |  yes      no (analyzed, after staleness)
                    |   |        |
                    | [4d: partial menu]
                    |   |        |
                    | R/S/F?     |
                    |  |  \ \    |
                    |  R   S  F  |
                    |  |   |  |  |
                    |  |   |  clear meta, set raw
                    |  |   |     |
                    |  |   set startPhase=05
                    |  |         |
                    |  |    [4e: BUILD SUMMARY banner]
                    |  |         |
                    |  |    [confirm Y/n?]
                    |  |         |
                    +--+---------+
                          |
                    [Step 5-6: parse flags, determine workflow type]
                          |
                    [Step 7: delegate to orchestrator]
                          |
                    startPhase != null?
                    /                 \
                  yes                  no
                    |                   |
            Pass START_PHASE     Standard delegation
            + ARTIFACT_FOLDER    (full workflow)
```

---

## 6. Menu Ordering Rules

The staleness check runs BEFORE the analysis-status menu. This ordering is intentional (per architecture.md section 3.2.2):

1. Staleness may invalidate the analysis status entirely (user selects [A] re-analyze -> status becomes 'raw').
2. Staleness may change the start phase (user selects [Q] re-run quick-scan -> start from Phase 00).
3. Only after staleness is resolved does the analysis-status menu apply.

**No menu for raw items**: If `analysisStatus === 'raw'` after step 4a (or after staleness/partial handling resets it to raw), no menus are shown. The build proceeds with the full workflow.

**No staleness check for raw items**: Staleness only applies to items that have analysis artifacts. Raw items have no artifacts to be stale.

---

## 7. Feature Alias Handling

The `feature` action is an alias for `build`. The modified build handler applies equally to both:

```
IF action === 'build' OR action === 'feature':
  Execute build handler (steps 1-9 with new steps 4a-4e)
```

This satisfies NFR-003 (AC-NFR-003-03): aliases remain equivalent.

---

## 8. Backward Compatibility Analysis

| Scenario | Before | After | Change? |
|----------|--------|-------|---------|
| Build with no meta.json | Full workflow | `computeStartPhase(null, ...)` returns raw -> full workflow | No change |
| Build with raw meta.json | Full workflow | Status 'raw' -> skip 4b-4e -> full workflow | No change |
| Build with analyzed meta.json | Full workflow (ignoring meta) | Phase-skip to 05 (with confirmation) | Intentional improvement |
| Build with partial meta.json | Full workflow (ignoring meta) | Partial menu shown | Intentional improvement |
| Build with stale + analyzed | Full workflow | Staleness warning + phase-skip | Intentional improvement |
| `/isdlc feature` alias | Full workflow | Same as build (inherits all changes) | Same as build |
| Build with non-item description | Add to backlog, full workflow | Same -- step 3 handles this before step 4a | No change |

**Traces**: NFR-003 (AC-NFR-003-01 through AC-NFR-003-03)

---

## 9. Error Handling in the Build Verb Handler

The build verb handler wraps detection steps in error-safe patterns:

| Step | Possible Failure | Handling |
|------|-----------------|----------|
| 4a: computeStartPhase | Never throws (returns raw) | N/A |
| 4b: git rev-parse | Git not available | Catch, log warning, set `stalenessResult.stale = false` |
| 4b: checkStaleness | Never throws (returns not stale) | N/A |
| 4b: git rev-list --count | Hash unreachable | Catch, set `commitsBehind = null`, show warning without count |
| 4c: Staleness menu | User interaction error | Treat as [P] Proceed (fail-safe default) |
| 4d: Partial menu | User interaction error | Treat as [R] Resume (fail-safe default) |
| 4e: Banner confirmation | User declines | Abort build gracefully |
| 4: writeMetaJson (on [F] or [A]) | Write failure | Log warning, proceed with in-memory values |

All failures degrade to the full workflow (NFR-004). The detection layer never blocks the build from proceeding.

**Traces**: NFR-004 (AC-NFR-004-01 through AC-NFR-004-03)

---

## 10. Implementation Notes

### 10.1 No workflows.json Parsing in the Handler

The build verb handler needs the feature phases array to call `computeStartPhase`. This array should be read from `workflows.json` at the start of step 4a. The handler does NOT hardcode the phases array -- it reads from the authoritative source.

```
LET workflowConfig = Read and parse: .isdlc/config/workflows.json
  // OR: src/isdlc/config/workflows.json (depending on resolution)
LET featurePhases = workflowConfig.workflows.feature.phases
```

### 10.2 Meta.json Writes Are Limited

The build verb handler only writes to meta.json in two scenarios:
1. **[F] Full restart** (step 4d) or **[A] Re-analyze from scratch** (step 4c): Clear `phases_completed`, reset `analysis_status`, update `codebase_hash`.
2. No other meta.json writes. The `build_started_at` and `workflow_type` fields (FR-008) are written by the orchestrator, not the build verb handler.

### 10.3 Estimated Line Impact

- Steps 4a-4e add approximately 80-120 lines to the build verb handler section
- Step 7 modification adds approximately 5-10 lines
- Total: ~90-130 lines added to `isdlc.md`

---

## 11. Traceability Matrix

| Design Section | FR Traces | NFR Traces | AC Coverage |
|---------------|-----------|------------|-------------|
| Step 4a: Compute analysis status | FR-001 | NFR-006 | AC-001-01 through AC-001-05 |
| Step 4b: Check staleness | FR-004 | NFR-002, NFR-004 | AC-004-01, AC-004-02, AC-004-07, AC-NFR-004-02 |
| Step 4c: Handle staleness | FR-004 | -- | AC-004-03 through AC-004-06 |
| Step 4d: Handle partial analysis | FR-003 | -- | AC-003-01 through AC-003-06 |
| Step 4e: BUILD SUMMARY banner | FR-005 | -- | AC-005-01 through AC-005-03 |
| Modified step 7: Delegation | FR-006, FR-007 | NFR-003 | AC-006-01, AC-006-05, AC-007-01 through AC-007-03 |
| Backward compatibility | -- | NFR-003 | AC-NFR-003-01 through AC-NFR-003-03 |
| Error handling | -- | NFR-004 | AC-NFR-004-01 through AC-NFR-004-03 |
