# Architecture: Build Auto-Detection and Seamless Phase 05+ Handoff

**Phase**: 03-architecture
**Feature ID**: REQ-BUILD-AUTODETECT
**Based On**: requirements-spec.md (8 FRs, 6 NFRs), impact-analysis.md (7 files, LOW-MEDIUM blast radius)
**Generated**: 2026-02-19

---

## 1. Executive Summary

This architecture defines how the `/isdlc build` verb detects prior analysis progress from `meta.json` and starts the workflow from the correct phase instead of always from Phase 00. The design follows the principle of **extending existing infrastructure with minimal new abstractions** -- all new logic is implemented as pure utility functions in `three-verb-utils.cjs`, the orchestrator receives a simple `START_PHASE` parameter, and the Phase-Loop Controller operates unchanged.

The architecture touches 3 layers (command, utility, orchestrator) across 7 files with a blast radius of low-to-medium. No hooks, dispatchers, or phase agents are modified.

---

## 2. Architectural Context

### 2.1 Current Flow (Before This Feature)

```
User: /isdlc build "payment-processing"
  |
  v
[isdlc.md: build handler]
  |-- resolveItem("payment-processing")
  |-- readMetaJson()  <-- read but NOT acted upon
  |-- delegate to orchestrator: MODE=init-and-phase-01, ACTION=feature
  v
[orchestrator: init-and-phase-01]
  |-- load workflows.json -> feature phases [00..08]
  |-- resetPhasesForWorkflow(state, ALL_PHASES)
  |-- create branch
  |-- run Phase 01
  |-- return { phases: [00..08], next_phase_index: 1 }
  v
[isdlc.md: Phase-Loop Controller]
  |-- iterate phases[1..end]
```

The build verb ignores `meta.json.phases_completed` and `analysis_status`. Even if the user ran `/isdlc analyze` through all 5 analysis phases, `/isdlc build` restarts from Phase 00.

### 2.2 Proposed Flow (After This Feature)

```
User: /isdlc build "payment-processing"
  |
  v
[isdlc.md: build handler]
  |-- resolveItem("payment-processing")
  |-- readMetaJson()
  |-- validatePhasesCompleted(meta.phases_completed)        [NEW]
  |-- computeStartPhase(meta, featurePhases)                [NEW]
  |-- checkStaleness(meta, currentGitHash)                  [NEW]
  |
  |-- IF fully analyzed + not stale:
  |     Display BUILD SUMMARY banner
  |     Confirm with user [Y/n]
  |     Delegate: START_PHASE="05-test-strategy", ARTIFACT_FOLDER="payment-processing"
  |
  |-- IF partially analyzed:
  |     Display partial analysis summary
  |     Present [R] Resume / [S] Skip / [F] Full restart menu
  |     Delegate with computed START_PHASE based on choice
  |
  |-- IF stale:
  |     Display staleness warning
  |     Present [P] Proceed / [Q] Re-run quick-scan / [A] Re-analyze
  |     Act on choice, then fall through to analysis-status handling
  |
  |-- IF raw or no meta.json:
  |     Delegate without START_PHASE (full workflow, backward compatible)
  |
  v
[orchestrator: init-and-phase-01]
  |-- IF START_PHASE present:
  |     Slice feature phases from START_PHASE onward
  |     Set ARTIFACT_FOLDER from parameter (skip REQ counter increment)
  |-- ELSE:
  |     Full workflow (unchanged behavior)
  |-- resetPhasesForWorkflow(state, slicedPhases)
  |-- create branch
  |-- run first phase in sliced array
  |-- return { phases: slicedPhases, ... }
  v
[isdlc.md: Phase-Loop Controller]
  |-- iterate remaining phases (unchanged logic, shorter array)
```

---

## 3. Component Design

### 3.1 Detection Layer (three-verb-utils.cjs)

Three new pure utility functions are added to `three-verb-utils.cjs`. They are pure in the sense that they depend only on their inputs (plus one git command for staleness). They have no side effects on state.json or the filesystem.

#### 3.1.1 `validatePhasesCompleted(phasesCompleted)`

**Purpose**: Validate and normalize the `phases_completed` array, handling non-contiguous entries.

**Signature**:
```javascript
/**
 * Validates and normalizes a phases_completed array.
 * Returns the contiguous prefix of recognized analysis phases.
 *
 * @param {string[]} phasesCompleted - Raw phases_completed from meta.json
 * @returns {{ valid: string[], warnings: string[] }}
 *
 * Traces: FR-003 (AC-003-06), NFR-004 (AC-NFR-004-03)
 */
function validatePhasesCompleted(phasesCompleted) { ... }
```

**Algorithm**:
1. If input is not an array, return `{ valid: [], warnings: ["phases_completed is not an array"] }`.
2. Filter input against `ANALYSIS_PHASES` (ignore unknown phase keys).
3. Walk `ANALYSIS_PHASES` in order; stop at the first phase not present in the filtered input.
4. The contiguous prefix is the valid set.
5. If filtered.length > valid.length, add a warning about non-contiguous phases.

**Edge Cases**:
- `[]` returns `{ valid: [], warnings: [] }` (raw item).
- `["00-quick-scan", "02-impact-analysis"]` (gap) returns `{ valid: ["00-quick-scan"], warnings: ["Non-contiguous phases detected..."] }`.
- `["00-quick-scan", "01-requirements", "unknown-phase"]` returns `{ valid: ["00-quick-scan", "01-requirements"], warnings: [] }` (unknown key silently filtered).

#### 3.1.2 `computeStartPhase(meta, workflowPhases)`

**Purpose**: Determine which phase the build workflow should start from, given analysis state.

**Signature**:
```javascript
/**
 * Computes the start phase for a build workflow based on analysis status.
 *
 * @param {object} meta - Parsed meta.json (from readMetaJson)
 * @param {string[]} workflowPhases - Feature workflow phases from workflows.json
 * @returns {{ status: 'analyzed'|'partial'|'raw', startPhase: string|null,
 *             completedPhases: string[], remainingPhases: string[] }}
 *
 * Traces: FR-001, FR-002, FR-003, NFR-006 (AC-NFR-006-01)
 */
function computeStartPhase(meta, workflowPhases) { ... }
```

**Algorithm**:
1. If `meta` is null, return `{ status: 'raw', startPhase: null, completedPhases: [], remainingPhases: workflowPhases }`.
2. Call `validatePhasesCompleted(meta.phases_completed)` to get the contiguous valid set.
3. If valid.length === 0, return status `'raw'`, startPhase `null`.
4. If valid.length === ANALYSIS_PHASES.length (all 5), return status `'analyzed'`, startPhase = first non-analysis phase in `workflowPhases` (i.e., `"05-test-strategy"`).
5. Otherwise, return status `'partial'`, startPhase = first phase in ANALYSIS_PHASES not in valid set (e.g., `"02-impact-analysis"` if only 00 and 01 are done).
6. `completedPhases` = valid set. `remainingPhases` = `workflowPhases` filtered to exclude completed phases.

**Design Decision**: The function returns a structured result object rather than just a phase string. This lets the build verb handler construct the summary banner and menu from a single call, avoiding redundant computation.

#### 3.1.3 `checkStaleness(meta, currentHash)`

**Purpose**: Compare the codebase hash in meta.json with the current git HEAD to detect staleness.

**Signature**:
```javascript
/**
 * Checks whether the codebase has changed since analysis was performed.
 *
 * @param {object} meta - Parsed meta.json (from readMetaJson)
 * @param {string} currentHash - Current git short hash (from git rev-parse --short HEAD)
 * @returns {{ stale: boolean, originalHash: string|null, currentHash: string,
 *             commitsBehind: number|null }}
 *
 * Traces: FR-004, NFR-002, NFR-004 (AC-NFR-004-02)
 */
function checkStaleness(meta, currentHash) { ... }
```

**Algorithm**:
1. If `meta` is null or `meta.codebase_hash` is absent/falsy, return `{ stale: false, originalHash: null, currentHash, commitsBehind: null }` (no hash to compare -- legacy item, AC-004-07).
2. If `meta.codebase_hash === currentHash`, return `{ stale: false, ... }`.
3. Otherwise return `{ stale: true, originalHash: meta.codebase_hash, currentHash, commitsBehind: null }`.

**Note**: The `commitsBehind` field is populated by the build verb handler, not this function. The function is a pure comparison; the git `rev-list --count` call happens in the build verb handler (because it requires a shell command, and keeping shell commands out of utility functions preserves testability). The function signature includes `commitsBehind` so the caller can populate it before passing the result to the UX display.

**Constants added**:
```javascript
/**
 * Implementation phases that follow analysis.
 * Used by computeStartPhase to identify the build-start boundary.
 */
const IMPLEMENTATION_PHASES = [
    '05-test-strategy',
    '06-implementation',
    '16-quality-loop',
    '08-code-review'
];
```

### 3.2 Build Verb Handler (isdlc.md)

The build verb handler in `isdlc.md` is modified between current steps 4 and 7. The new logic inserts between reading meta.json and delegating to the orchestrator.

#### 3.2.1 Modified Flow

```
Existing step 1:  Validate constitution
Existing step 2:  Check no active workflow
Existing step 3:  resolveItem(input)
Existing step 4:  readMetaJson()             <-- already exists, was "informational"

NEW step 4a:  validatePhasesCompleted() + computeStartPhase()
NEW step 4b:  IF status != 'raw':  checkStaleness() + git rev-list for commit count
NEW step 4c:  Staleness menu (if stale): [P] Proceed / [Q] Re-run quick-scan / [A] Re-analyze
NEW step 4d:  Analysis status menu (if partial): [R] Resume / [S] Skip / [F] Full restart
NEW step 4e:  BUILD SUMMARY banner (always shown for non-raw items)
NEW step 4f:  Confirm with user [Y/n]

Existing step 5:  Parse flags
Existing step 6:  Determine workflow type
Modified step 7:  Delegate to orchestrator WITH optional START_PHASE + ARTIFACT_FOLDER
Existing step 8:  Orchestrator initializes workflow
Existing step 9:  Phase-Loop Controller drives remaining phases
```

#### 3.2.2 Menu Logic Detail

The staleness check runs **before** the analysis-status menu. This is because staleness may change the user's choice (e.g., a stale fully-analyzed item might prompt re-analysis).

**Ordering**:
1. Compute start phase (determines analysis status).
2. If status is not `'raw'`, run staleness check.
3. If stale, present staleness menu first.
   - `[P] Proceed anyway` -- continue to analysis-status handling with existing artifacts.
   - `[Q] Re-run quick-scan` -- set startPhase to `"00-quick-scan"`, update codebase_hash, continue.
   - `[A] Re-analyze from scratch` -- clear phases_completed, set status to `'raw'`, continue to full workflow.
4. After staleness is resolved, handle analysis status:
   - `'analyzed'` -- display summary banner, confirm, delegate with START_PHASE.
   - `'partial'` -- display partial summary, present [R]/[S]/[F] menu.
   - `'raw'` -- delegate without START_PHASE (full workflow).

#### 3.2.3 UX Banner Format

```
BUILD SUMMARY: payment-processing

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

This format is presented using `AskUserQuestion` with Yes/No options for single-action cases, or a multi-option menu for partial/staleness cases.

### 3.3 Orchestrator (00-sdlc-orchestrator.md)

The orchestrator's `init-and-phase-01` mode is extended with two optional parameters.

#### 3.3.1 New Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `START_PHASE` | string | No | null | Phase key to start workflow from (e.g., `"05-test-strategy"`) |
| `ARTIFACT_FOLDER` | string | No | null | Existing artifact folder to reuse (e.g., `"build-auto-detection-seamless-handoff"`) |

#### 3.3.2 Modified Initialization Logic

When `START_PHASE` is present:

1. **Validate START_PHASE**: Check that the value is a valid phase key present in the workflow's phases array from `workflows.json`. If invalid, reject with `ERR-ORCH-INVALID-START-PHASE` and fall back to full workflow (AC-006-03).

2. **Slice phases array**: Find the index of START_PHASE in the full feature phases array. Take the slice from that index onward.
   ```
   fullPhases = ["00-quick-scan", "01-requirements", ..., "08-code-review"]
   startIndex = fullPhases.indexOf(START_PHASE)
   slicedPhases = fullPhases.slice(startIndex)
   // Result: ["05-test-strategy", "06-implementation", "16-quality-loop", "08-code-review"]
   ```

3. **Call resetPhasesForWorkflow with sliced array**: `resetPhasesForWorkflow(state, slicedPhases)` -- this already works correctly because `resetPhasesForWorkflow` creates fresh skeleton entries for whatever phases are passed.

4. **Set artifact_folder from parameter**: When `ARTIFACT_FOLDER` is provided, set `active_workflow.artifact_folder = ARTIFACT_FOLDER` instead of generating a new `REQ-NNNN-{slug}` folder. **Skip REQ counter increment** -- the folder already exists.

5. **Set current_phase to START_PHASE**: `active_workflow.current_phase = START_PHASE`, `current_phase_index = 0`.

6. **Handle branch naming**: The branch name uses the provided ARTIFACT_FOLDER (e.g., `feature/build-auto-detection-seamless-handoff`). If the folder has a REQ prefix (e.g., `REQ-0022-performance-budget-guardrails`), use it as-is.

7. **Update meta.json**: Write `build_started_at` and `workflow_type` to the item's meta.json (FR-008).

8. **Delegate to first phase**: If START_PHASE is `"05-test-strategy"`, delegate to test-design-engineer. If START_PHASE is an analysis phase (e.g., `"02-impact-analysis"` for resume), delegate to the appropriate analysis agent.

When `START_PHASE` is absent: behavior is identical to current implementation (AC-006-05).

#### 3.3.3 Mode Behavior Unchanged

The `init-and-phase-01` mode's scope boundary remains: it initializes + runs the first phase in the sliced array + validates the gate + generates the plan + returns. The Phase-Loop Controller takes over from there.

When START_PHASE is present and the first sliced phase is NOT `01-requirements` (e.g., it is `05-test-strategy`), the orchestrator still runs that single phase and returns. The mode name `init-and-phase-01` is a historical label; it means "initialize and run the first phase," not literally Phase 01.

### 3.4 workflows.json Annotation

A comment annotation is added under `rules.no_halfway_entry` to document the build auto-detect exception:

```json
{
  "rules": {
    "no_halfway_entry": true,
    "_comment_build_autodetect_exception": "The build verb may start a workflow at a phase other than the first when analysis phases have been pre-completed via /isdlc analyze. This is permitted because the build verb modifies the phase array BEFORE workflow init, which is the same pattern as framework-level sizing modifications (REQ-0011). See _comment_phase_skipping.",
    "no_agent_phase_skipping": true,
    ...
  }
}
```

No structural change -- the rule value stays `true`.

### 3.5 common.cjs (No Functional Change)

`resetPhasesForWorkflow(state, workflowPhases)` already accepts an arbitrary phase array and creates fresh skeleton entries. No code change is needed. A JSDoc note is added clarifying that partial arrays (subsets of a workflow's full phase list) are a supported use case:

```javascript
/**
 * Resets the phases object in state.json, replacing all phase entries with
 * fresh skeleton entries for the specified workflow phases.
 *
 * Supports partial phase arrays -- the build verb passes a subset of the
 * feature phases when analysis phases have been pre-completed (REQ-BUILD-AUTODETECT).
 *
 * @param {Object} state - The state object
 * @param {string[]} workflowPhases - Array of phase keys for the new workflow
 * @returns {Object} The mutated state object
 */
```

---

## 4. Data Flow

### 4.1 Fully Analyzed Item (Happy Path)

```
meta.json: { analysis_status: "analyzed", phases_completed: [00..04], codebase_hash: "abc1234" }
git HEAD:  "abc1234" (same)

1. computeStartPhase(meta, featurePhases) -->
   { status: 'analyzed', startPhase: '05-test-strategy',
     completedPhases: [00..04], remainingPhases: [05,06,16,08] }

2. checkStaleness(meta, "abc1234") -->
   { stale: false }

3. Build verb displays summary banner, user confirms.

4. Delegates: MODE=init-and-phase-01, START_PHASE="05-test-strategy",
   ARTIFACT_FOLDER="payment-processing"

5. Orchestrator slices: ["05-test-strategy", "06-implementation", "16-quality-loop", "08-code-review"]
   resetPhasesForWorkflow(state, slicedPhases)
   Branch: feature/payment-processing

6. Phase-Loop Controller iterates 4 phases instead of 9.
```

### 4.2 Partially Analyzed Item (Resume Path)

```
meta.json: { analysis_status: "partial", phases_completed: ["00-quick-scan", "01-requirements"] }

1. computeStartPhase --> { status: 'partial', startPhase: '02-impact-analysis' }
2. User selects [R] Resume analysis
3. Delegates: START_PHASE="02-impact-analysis"
4. Orchestrator slices: ["02-impact-analysis", "03-architecture", "04-design",
   "05-test-strategy", "06-implementation", "16-quality-loop", "08-code-review"]
5. Phase-Loop Controller iterates 7 phases.
```

### 4.3 Raw Item (Backward Compatible Path)

```
meta.json: null (missing) OR { analysis_status: "raw", phases_completed: [] }

1. computeStartPhase --> { status: 'raw', startPhase: null }
2. Delegates WITHOUT START_PHASE.
3. Orchestrator initializes full workflow (all 9 phases).
4. Behavior identical to current build verb.
```

### 4.4 Stale Item

```
meta.json: { analysis_status: "analyzed", phases_completed: [00..04], codebase_hash: "abc1234" }
git HEAD:  "def5678" (different)

1. computeStartPhase --> { status: 'analyzed', startPhase: '05-test-strategy' }
2. checkStaleness --> { stale: true, originalHash: "abc1234", currentHash: "def5678" }
3. Build verb runs: git rev-list --count abc1234..HEAD --> 15 commits

4. Staleness warning:
   "Analysis was performed at commit abc1234 (15 commits ago).
    Current HEAD is def5678."
   [P] Proceed anyway  [Q] Re-run quick-scan  [A] Re-analyze

5a. If [P]: continue with status 'analyzed', START_PHASE="05-test-strategy"
5b. If [Q]: set START_PHASE="00-quick-scan", update meta.codebase_hash
5c. If [A]: clear phases_completed, delegate without START_PHASE (full workflow)
```

---

## 5. Error Handling and Graceful Degradation

All detection failures degrade to the full workflow (raw item behavior). This satisfies NFR-004 and the constitutional principle of fail-safe defaults (Article X).

| Failure Mode | Detection Point | Graceful Degradation |
|---|---|---|
| meta.json missing | `readMetaJson()` returns null | Treat as raw, full workflow (AC-001-04) |
| meta.json corrupted | `readMetaJson()` returns null | Treat as raw, log warning (AC-001-05) |
| phases_completed not an array | `validatePhasesCompleted()` | Return empty valid set, treat as raw (AC-NFR-004-03) |
| Non-contiguous phases | `validatePhasesCompleted()` | Use contiguous prefix, log warning (AC-003-06) |
| Unknown phase keys | `validatePhasesCompleted()` | Filter out unknown keys silently |
| git not available | Build handler catches error | Skip staleness check, proceed (AC-004-07) |
| git rev-parse fails | Build handler catches error | Skip staleness check, log warning (AC-NFR-004-02) |
| git rev-list --count fails | Build handler catches error | Show staleness warning without commit count |
| Invalid START_PHASE | Orchestrator validation | Reject, fall back to full workflow (AC-006-03) |
| ARTIFACT_FOLDER not found | Orchestrator validation | Create folder normally (standard behavior) |

---

## 6. Performance

### 6.1 Detection Latency (NFR-001: p95 < 2 seconds)

The detection path consists of:
1. `readMetaJson()` -- single file read (~1ms)
2. `validatePhasesCompleted()` -- array iteration (~0.1ms)
3. `computeStartPhase()` -- array operations (~0.1ms)
4. `checkStaleness()` -- pure comparison (~0.01ms)
5. `git rev-parse --short HEAD` -- shell command (~50-100ms)
6. `git rev-list --count` -- shell command (~50-200ms, depends on repo size)

**Total estimated latency: ~100-300ms**, well within the 2-second p95 budget.

### 6.2 Git Hash Performance (NFR-002: p95 < 1 second)

`git rev-parse --short HEAD` and `git rev-list --count` are O(1) and O(n) respectively, where n is the number of commits between hashes. For repositories up to 10,000 commits, both complete in under 200ms combined.

### 6.3 No Hot-Path Impact

The detection logic runs once per build invocation, before the workflow starts. It does not affect phase execution performance, hook performance, or Phase-Loop Controller performance.

---

## 7. Backward Compatibility (NFR-003)

| Scenario | Current Behavior | New Behavior | Compatible? |
|---|---|---|---|
| Build with no meta.json | Full workflow | Full workflow (meta=null -> raw) | Yes |
| Build with raw meta.json | Full workflow | Full workflow (status=raw -> no START_PHASE) | Yes |
| Build with analyzed meta.json | Full workflow (ignoring meta) | Phase-skip to 05 (with user confirmation) | **Changed** (intentional improvement) |
| `/isdlc feature` alias | Same as build | Same as build (inherits detection) | Yes |
| Orchestrator without START_PHASE | Full workflow | Full workflow (param absent -> existing path) | Yes |
| Phase-Loop Controller | Iterates phases[] | Iterates phases[] (shorter array) | Yes |
| Hooks during workflow | Normal operation | Normal operation (see sliced array) | Yes |

The only behavioral change is for items that have analysis artifacts in meta.json. This is the intended feature. All other paths are identical.

---

## 8. Testability (NFR-006)

All detection logic lives in three exported functions in `three-verb-utils.cjs`, each testable in isolation:

### 8.1 Test Plan

| Function | Test Cases | Coverage Targets |
|---|---|---|
| `validatePhasesCompleted` | Empty array; full 5-phase array; non-contiguous (gap at 01); unknown keys mixed in; not an array (null, string, number); single phase; all unknown keys | 8+ cases |
| `computeStartPhase` | null meta (raw); raw meta (empty phases); partial meta (2 phases); full meta (all 5); non-contiguous meta (uses contiguous prefix); workflowPhases from workflows.json; partial with fix workflow phases (should not match analysis phases) | 7+ cases |
| `checkStaleness` | Same hash; different hash; meta=null; meta.codebase_hash missing; empty string hash; both null | 6+ cases |

### 8.2 Integration Test Points

| Integration Point | Test Approach |
|---|---|
| Build verb + computeStartPhase | End-to-end: create meta.json with analyzed status, invoke build, verify orchestrator receives START_PHASE |
| Orchestrator + sliced phases | Verify resetPhasesForWorkflow receives correct subset |
| Phase-Loop Controller + short array | Verify controller iterates only the provided phases |

---

## 9. Architecture Decision Records

### ADR-001: Detection Logic Location

**Status**: Accepted

**Context**: The auto-detection logic (reading meta.json, computing analysis status, checking staleness) needs to live somewhere. Three options were considered:
- **Option A**: In `isdlc.md` build verb handler (before orchestrator delegation)
- **Option B**: In the orchestrator itself (after delegation)
- **Option C**: Split -- detection in build verb, phase-skip in orchestrator

**Decision**: Option C -- Split responsibility.

Detection and UX (reading meta.json, computing status, presenting menus, getting user confirmation) happens in the build verb handler (`isdlc.md`). Phase-array slicing happens in the orchestrator when it receives `START_PHASE`.

**Rationale**:
1. **Separation of concerns**: The build verb owns user interaction (menus, confirmations). The orchestrator owns workflow initialization. Detection is a user-facing concern that determines what the user sees.
2. **Testability (NFR-006)**: The detection logic is in `three-verb-utils.cjs` (pure functions, trivially testable). The UX logic is in `isdlc.md` (markdown command spec). The phase-slicing is in the orchestrator (receives a simple parameter).
3. **Backward compatibility (NFR-003)**: If detection fails, the build verb simply does not pass START_PHASE, and the orchestrator falls back to full workflow. The failure path is invisible to the orchestrator.
4. **No state.json writes during detection (CON-001)**: Detection happens before orchestrator delegation, before any state.json writes. The build verb handler only reads meta.json and git state.

**Alternatives Rejected**:
- **Option A** (all in build verb): Would require the build verb to construct the phases array itself and pass it to the orchestrator, duplicating workflow-definition logic. The build verb should not know how to slice workflow phases.
- **Option B** (all in orchestrator): Would require the orchestrator to present interactive menus to the user (staleness menu, partial analysis menu). The orchestrator is a background agent delegated via Task tool -- it cannot reliably conduct multi-step interactive UX with the user.

**Consequences**:
- Positive: Clean separation. Each component has a single reason to change. Utility functions are pure and testable.
- Negative: The build verb handler grows ~80-120 lines of conditional logic (menus, banners). This is acceptable because the logic is straightforward (if/else on status) and delegates computation to utility functions.

---

### ADR-002: Phase-Skip Mechanism

**Status**: Accepted

**Context**: When analysis phases are pre-completed, the build workflow should start from a later phase. Three mechanisms were considered:
- **Option A**: Filter the phases array before passing to orchestrator (orchestrator never sees skipped phases)
- **Option B**: Pass `START_PHASE` parameter; orchestrator filters internally
- **Option C**: Pass `SKIP_PHASES` array; orchestrator filters

**Decision**: Option B -- Pass `START_PHASE` parameter.

The build verb passes a single `START_PHASE` string (e.g., `"05-test-strategy"`) to the orchestrator. The orchestrator looks up the phase in the workflow's full phases array, slices from that index onward, and calls `resetPhasesForWorkflow(state, slicedPhases)`.

**Rationale**:
1. **Simplicity (Article V)**: A single string parameter is simpler than constructing a filtered array or a skip-list. The orchestrator already owns the workflow definition (from `workflows.json`) and knows how to slice it.
2. **Validation**: The orchestrator can validate that START_PHASE is a real phase key in the workflow. With Option A (pre-filtered array), validation would need to happen in the build verb, which does not own workflow definitions.
3. **Single source of truth**: The phases array is always derived from `workflows.json` by the orchestrator. The build verb never constructs phase arrays -- it only tells the orchestrator where to start.
4. **Backward compatibility**: When START_PHASE is absent, the orchestrator uses the full phases array (AC-006-05). The parameter is optional with a clean fallback.

**Alternatives Rejected**:
- **Option A** (pre-filtered array): The build verb would need to read `workflows.json`, construct the filtered array, and pass it. This duplicates workflow-definition logic that belongs in the orchestrator.
- **Option C** (SKIP_PHASES array): More complex than START_PHASE for the common case (skipping a contiguous prefix of phases). Also ambiguous when phases are non-contiguous. START_PHASE is deterministic: everything before it is skipped, everything from it onward is included.

**Consequences**:
- Positive: Minimal parameter surface (one string). Orchestrator owns all phase-array logic. Easy to validate.
- Negative: Cannot express arbitrary phase subsets (e.g., "skip Phase 03 but run Phase 02"). This is acceptable because the feature only supports skipping a contiguous prefix of analysis phases, which START_PHASE handles perfectly.

**Compatibility with `resetPhasesForWorkflow`**: The existing `resetPhasesForWorkflow(state, workflowPhases)` function in `common.cjs` already accepts any array of phase keys and creates fresh skeleton entries. No modification is needed. The orchestrator simply passes the sliced array instead of the full array.

---

### ADR-003: Partial Analysis Menu Design

**Status**: Accepted

**Context**: When a backlog item has partial analysis (1-4 of 5 phases complete), the build verb must present the user with options. The requirements specify a 3-option menu: [R] Resume analysis, [S] Skip to implementation, [F] Full restart.

**Decision**: Implement the 3-option menu as specified, with Resume as the default/first option.

**Rationale**:
1. **Explicit over implicit (Article IV)**: Auto-resuming could surprise users who intentionally stopped analysis. The menu gives explicit control. This was already decided in DEC-001 of the requirements spec.
2. **Safety of [S] Skip**: Skipping remaining analysis phases is a valid power-user action but carries risk (lower-quality output). The menu warns about this explicitly (AC-003-04).
3. **[F] Full restart**: Necessary for cases where analysis is outdated or the user wants a fresh start. This resets meta.json (clears phases_completed, sets analysis_status to "raw", updates codebase_hash) before delegating.

**Menu interaction**: Uses `AskUserQuestion` with three labeled options. The response determines the START_PHASE passed to the orchestrator:
- `[R] Resume` -> START_PHASE = next incomplete analysis phase (from `computeStartPhase().startPhase`)
- `[S] Skip` -> START_PHASE = `"05-test-strategy"`
- `[F] Full restart` -> START_PHASE = null (full workflow, updates meta.json first)

**Consequences**:
- Positive: User always has explicit control. No surprises. Common case (Resume) is first option.
- Negative: Extra prompt for partial-analysis cases. Acceptable because partial analysis is the minority case, and the prompt provides valuable information about what was completed.

---

### ADR-004: Staleness Detection Approach

**Status**: Accepted

**Context**: When the codebase has changed since analysis was performed (meta.json `codebase_hash` differs from current `git rev-parse --short HEAD`), the build verb should warn the user. DEC-002 in the requirements spec decided to use short hash comparison.

**Decision**: Implement staleness detection as a pure comparison function (`checkStaleness`) with git commit counting done inline in the build verb handler.

**Rationale**:
1. **Pure function testability**: `checkStaleness(meta, currentHash)` is a pure comparison with no side effects. It can be tested without git. The git commands (`rev-parse`, `rev-list --count`) are executed in the build verb handler and passed as arguments.
2. **Short hash comparison**: The meta.json already stores 7-character short hashes (e.g., `"9e304d4"`). Full hashes would require a schema migration (CON-002 prohibits breaking schema changes). Short hash collisions are negligible for repositories under 1M commits (DEC-002).
3. **Commit count enrichment**: `git rev-list --count {old}..HEAD` provides useful context ("15 commits since analysis") without significant performance cost (NFR-002).
4. **Graceful degradation**: If git is unavailable or commands fail, staleness detection is skipped entirely (AC-004-07, AC-NFR-004-02). The build proceeds with existing analysis.

**Staleness is independent of analysis status**: Both fully-analyzed and partially-analyzed items can be stale. The staleness menu is presented before the analysis-status menu when both conditions apply. This ordering ensures the user resolves staleness first (which may change their analysis-status choice).

**Consequences**:
- Positive: Clean separation of pure logic and shell commands. Testable. Graceful degradation.
- Negative: Short hash has a theoretical collision risk (1 in ~268 million for 7-char hex). Acceptable per DEC-002.

---

## 10. Constraints Compliance

| Constraint | How Satisfied |
|---|---|
| CON-001: No state.json writes during detection | Detection functions (`computeStartPhase`, `checkStaleness`, `validatePhasesCompleted`) are pure. The build verb handler reads meta.json and git state but does not write to state.json. State writes only occur when the orchestrator initializes the workflow. |
| CON-002: No breaking changes to meta.json schema | No existing fields are modified or removed. `build_started_at` and `workflow_type` are additive fields (FR-008). |
| CON-003: Workflow rules remain enforced | `no_halfway_entry` is relaxed at the framework level (build verb modifies phase array before init), consistent with the existing `_comment_phase_skipping` exception for sizing (REQ-0011). `no_agent_phase_skipping` remains in full effect -- agents cannot skip phases within a running workflow. |
| CON-004: Single active workflow | The build verb checks for an active workflow at step 2 (existing behavior), before any detection logic runs. |

---

## 11. Implementation Order

Based on the dependency analysis from the impact analysis:

| Order | File | What | Why First |
|---|---|---|---|
| 1 | `src/claude/hooks/lib/three-verb-utils.cjs` | Add 3 new functions + `IMPLEMENTATION_PHASES` constant | Pure functions, no dependencies, testable in isolation |
| 2 | `src/claude/hooks/tests/test-three-verb-utils.test.cjs` | Add tests for 3 new functions | TDD: tests alongside utility functions |
| 3 | `src/isdlc/config/workflows.json` | Add `_comment_build_autodetect_exception` annotation | Documentation, no functional change |
| 4 | `src/claude/agents/00-sdlc-orchestrator.md` | Add START_PHASE + ARTIFACT_FOLDER handling | Depends on none of the above (reads workflows.json at runtime) |
| 5 | `src/claude/commands/isdlc.md` | Wire detection into build verb handler | Depends on steps 1 and 4 (calls utility functions, delegates to orchestrator) |
| 6 | `src/claude/hooks/lib/common.cjs` | Add JSDoc comment to resetPhasesForWorkflow | Minor, no functional change |

---

## 12. Dependency Map

```
three-verb-utils.cjs                    [MODIFY: +3 functions, +1 constant]
  |
  +-- ANALYSIS_PHASES                   [existing constant, reused]
  +-- IMPLEMENTATION_PHASES             [NEW constant]
  +-- validatePhasesCompleted()         [NEW pure function]
  +-- computeStartPhase()              [NEW pure function, calls validatePhasesCompleted]
  +-- checkStaleness()                 [NEW pure function]
  |
  +-- readMetaJson()                   [existing, unchanged]
  +-- deriveAnalysisStatus()           [existing, unchanged, used for cross-reference]

isdlc.md (build verb handler)           [MODIFY: +80-120 lines]
  |
  +-- calls: resolveItem()             [existing]
  +-- calls: readMetaJson()            [existing]
  +-- calls: computeStartPhase()       [NEW]
  +-- calls: checkStaleness()          [NEW]
  +-- calls: AskUserQuestion           [existing Claude tool]
  +-- runs:  git rev-parse --short HEAD  [shell, new usage]
  +-- runs:  git rev-list --count        [shell, new usage]
  |
  +-- delegates to: orchestrator       [existing, with new params]
       |
       +-- reads: workflows.json       [existing]
       +-- calls: resetPhasesForWorkflow(state, slicedPhases)  [existing, unchanged]
       +-- writes: state.json          [existing]
       +-- writes: meta.json           [NEW: build_started_at]
```

---

## 13. Risk Mitigation

| Risk | Severity | Mitigation |
|---|---|---|
| R1: Backward compat regression for items without meta.json | HIGH | Explicit null check in computeStartPhase (meta=null -> raw). Existing readMetaJson already returns null for missing files. |
| R5: Artifact folder naming collision (pre-analyzed folder gets REQ prefix) | MEDIUM | ARTIFACT_FOLDER parameter tells orchestrator to use existing folder. Orchestrator skips REQ counter increment when ARTIFACT_FOLDER is provided. |
| R8: no_halfway_entry rule enforcement by hooks | MEDIUM | No hook enforces no_halfway_entry at runtime (confirmed by code review). The rule is documented in workflows.json and enforced by the orchestrator at init time. The orchestrator's own init logic is being modified to support START_PHASE, so no conflict. |

---

## 14. Traceability

| Requirement | Architecture Component | ADR |
|---|---|---|
| FR-001 (Analysis Status Detection) | `computeStartPhase()`, `validatePhasesCompleted()` | ADR-001 |
| FR-002 (Phase-Skip for Fully Analyzed) | Orchestrator START_PHASE handling, `resetPhasesForWorkflow` | ADR-002 |
| FR-003 (Partial Analysis Handling) | Build verb [R]/[S]/[F] menu, `computeStartPhase()` | ADR-003 |
| FR-004 (Staleness Detection) | `checkStaleness()`, build verb git commands | ADR-004 |
| FR-005 (Phase Summary Display) | Build verb BUILD SUMMARY banner | ADR-001 (UX in build verb) |
| FR-006 (Orchestrator START_PHASE) | Orchestrator init-and-phase-01 mode extension | ADR-002 |
| FR-007 (Artifact Folder Naming) | Orchestrator ARTIFACT_FOLDER parameter | ADR-002 |
| FR-008 (Meta.json Update After Build) | Orchestrator writes build_started_at | ADR-001 |
| NFR-001 (Detection Latency) | Pure functions + 2 git commands (~100-300ms) | Section 6 |
| NFR-002 (Git Hash Performance) | git rev-parse + rev-list (<200ms combined) | Section 6 |
| NFR-003 (Backward Compatibility) | null meta -> raw -> no START_PHASE -> full workflow | Section 7 |
| NFR-004 (Graceful Degradation) | All failures degrade to full workflow | Section 5 |
| NFR-005 (Three-Verb Consistency) | analyze writes meta.json; build reads it | ADR-001 |
| NFR-006 (Testability) | 3 exported pure functions in three-verb-utils.cjs | Section 8 |

---

## 15. Self-Assessment

### Known Trade-offs
- **Build verb handler complexity**: The build handler grows by ~80-120 lines of conditional logic (menus, banners, git commands). This is the cost of keeping detection UX in the command layer rather than in the orchestrator. The alternative (orchestrator-based UX) was rejected because the orchestrator runs as a background Task agent and cannot reliably conduct multi-step interactive menus.
- **Short hash staleness**: Using 7-character short hashes for staleness comparison has a theoretical collision risk. The alternative (full 40-character hashes) would require a breaking schema change to meta.json, which is prohibited by CON-002.

### Areas of Uncertainty
- **Staleness + partial analysis interaction**: When an item is both stale AND partially analyzed, the user sees two sequential menus (staleness first, then partial analysis). This may feel like too many prompts. An alternative would be to combine them into a single menu, but this increases complexity. The sequential approach was chosen for simplicity (Article V).
- **`init-and-phase-01` mode name**: The mode name suggests it always runs Phase 01, but with START_PHASE it might run Phase 05. The mode name is a historical label ("initialize and run the first phase"), not a literal description. This could cause confusion for future maintainers. Renaming the mode is out of scope (would break backward compatibility).

### Open Questions
- None. All four decision points from the task prompt have been resolved with ADRs. Requirements are comprehensive and constraints are clear.
