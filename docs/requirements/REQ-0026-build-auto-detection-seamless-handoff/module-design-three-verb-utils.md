# Module Design: three-verb-utils.cjs Extensions

**Phase**: 04-design
**Feature ID**: REQ-BUILD-AUTODETECT
**Module**: `src/claude/hooks/lib/three-verb-utils.cjs`
**Change Type**: MODIFY (additive -- 3 new functions, 1 new constant)
**Based On**: architecture.md (ADR-001, ADR-002, ADR-004), requirements-spec.md (FR-001, FR-003, FR-004, FR-006, NFR-004, NFR-006)

---

## 1. Overview

This module design specifies three new utility functions and one new constant to be added to `three-verb-utils.cjs`. These functions implement the detection layer for the build auto-detection feature. All three are pure functions (no side effects, no filesystem writes, no shell commands) that operate solely on their input parameters.

The functions are designed to be called by the build verb handler in `isdlc.md` before delegating to the orchestrator. They do not interact with `state.json` (CON-001).

**Traces**: FR-001, FR-003, FR-004, FR-006, NFR-004, NFR-006

---

## 2. New Constant: IMPLEMENTATION_PHASES

### 2.1 Definition

```javascript
/**
 * Implementation phases that follow analysis in the feature workflow.
 * Used by computeStartPhase to identify the build-start boundary.
 *
 * Traces: FR-002, FR-006
 */
const IMPLEMENTATION_PHASES = [
    '05-test-strategy',
    '06-implementation',
    '16-quality-loop',
    '08-code-review'
];
```

### 2.2 Placement

Insert immediately after the existing `ANALYSIS_PHASES` constant (line 33) and before the `MARKER_REGEX` constant. This groups the two phase-sequence constants together.

### 2.3 Export

Add `IMPLEMENTATION_PHASES` to the `module.exports` block under the "Constants" section:

```javascript
module.exports = {
    // Constants
    ANALYSIS_PHASES,
    IMPLEMENTATION_PHASES,  // NEW
    MARKER_REGEX,
    // ... rest unchanged
};
```

---

## 3. Function: validatePhasesCompleted

### 3.1 Purpose

Validates and normalizes a `phases_completed` array from `meta.json`. Handles non-contiguous entries (gaps), unknown phase keys, and invalid input types. Returns the contiguous prefix of recognized analysis phases.

**Traces**: FR-003 (AC-003-06), NFR-004 (AC-NFR-004-03)

### 3.2 Signature

```javascript
/**
 * Validates and normalizes a phases_completed array.
 * Returns the contiguous prefix of recognized analysis phases.
 *
 * @param {string[]} phasesCompleted - Raw phases_completed from meta.json
 * @param {string[]} [fullSequence=ANALYSIS_PHASES] - The ordered phase sequence to validate against
 * @returns {{ valid: string[], warnings: string[] }}
 *
 * Traces: FR-003 (AC-003-06), NFR-004 (AC-NFR-004-03)
 */
function validatePhasesCompleted(phasesCompleted, fullSequence) { ... }
```

### 3.3 Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `phasesCompleted` | `string[]` | Yes | -- | Raw `phases_completed` array from `meta.json`. May be null, not an array, contain unknown keys, or have gaps. |
| `fullSequence` | `string[]` | No | `ANALYSIS_PHASES` | The ordered sequence of phases to validate against. Defaults to `ANALYSIS_PHASES`. Provided as a parameter for testability -- callers should not need to override this in production. |

### 3.4 Return Value

```typescript
{
    valid: string[],      // Contiguous prefix of recognized phases, in sequence order
    warnings: string[]    // Warning messages for non-fatal issues (logged by caller)
}
```

### 3.5 Algorithm

```
1. IF phasesCompleted is not an array:
     RETURN { valid: [], warnings: ["phases_completed is not an array"] }

2. LET recognized = phasesCompleted.filter(p => fullSequence.includes(p))
   // Filter out unknown phase keys silently

3. LET valid = []
4. FOR EACH phase IN fullSequence (in order):
     IF recognized.includes(phase):
       valid.push(phase)
     ELSE:
       BREAK   // Stop at first missing phase (contiguous prefix)

5. LET warnings = []
6. IF recognized.length > valid.length:
     warnings.push(
       "Non-contiguous phases detected: found [" + recognized.join(", ") +
       "] but only [" + valid.join(", ") + "] form a contiguous prefix"
     )

7. IF phasesCompleted.length > recognized.length:
     LET unknown = phasesCompleted.filter(p => !fullSequence.includes(p))
     // No warning for unknown keys -- silently filtered per NFR-004 (AC-NFR-004-03)

8. RETURN { valid, warnings }
```

### 3.6 Edge Cases

| Input | Expected Output | Rationale |
|-------|-----------------|-----------|
| `null` | `{ valid: [], warnings: ["phases_completed is not an array"] }` | Defensive -- meta.json might be malformed |
| `undefined` | `{ valid: [], warnings: ["phases_completed is not an array"] }` | Same as null |
| `"string"` | `{ valid: [], warnings: ["phases_completed is not an array"] }` | Wrong type |
| `42` | `{ valid: [], warnings: ["phases_completed is not an array"] }` | Wrong type |
| `[]` | `{ valid: [], warnings: [] }` | Raw item, no phases completed |
| `["00-quick-scan"]` | `{ valid: ["00-quick-scan"], warnings: [] }` | Single phase, contiguous |
| `["00-quick-scan", "01-requirements"]` | `{ valid: ["00-quick-scan", "01-requirements"], warnings: [] }` | Two contiguous phases |
| All 5 phases | `{ valid: [all 5], warnings: [] }` | Fully analyzed |
| `["00-quick-scan", "02-impact-analysis"]` | `{ valid: ["00-quick-scan"], warnings: ["Non-contiguous..."] }` | Gap at 01 -- use contiguous prefix only |
| `["01-requirements", "02-impact-analysis"]` | `{ valid: [], warnings: ["Non-contiguous..."] }` | Missing 00 at start -- no valid contiguous prefix |
| `["00-quick-scan", "unknown-phase"]` | `{ valid: ["00-quick-scan"], warnings: [] }` | Unknown key filtered silently |
| `["future-phase-x", "future-phase-y"]` | `{ valid: [], warnings: [] }` | All unknown -- no recognized phases, no contiguous prefix, no warning |

### 3.7 Error Handling

This function never throws. All invalid inputs produce a safe `{ valid: [], warnings: [...] }` result. The caller (build verb handler) logs warnings if present and uses `valid` to determine analysis status.

---

## 4. Function: computeStartPhase

### 4.1 Purpose

Determines which phase the build workflow should start from, given the analysis state recorded in `meta.json`. Returns a structured result with the analysis status classification, the computed start phase, and the lists of completed and remaining phases.

**Traces**: FR-001, FR-002, FR-003, NFR-006 (AC-NFR-006-01)

### 4.2 Signature

```javascript
/**
 * Computes the start phase for a build workflow based on analysis status.
 *
 * @param {object|null} meta - Parsed meta.json (from readMetaJson), or null if missing/corrupt
 * @param {string[]} workflowPhases - Full feature workflow phases from workflows.json
 *                                     (e.g., ["00-quick-scan", ..., "08-code-review"])
 * @returns {{
 *   status: 'analyzed'|'partial'|'raw',
 *   startPhase: string|null,
 *   completedPhases: string[],
 *   remainingPhases: string[]
 * }}
 *
 * Traces: FR-001, FR-002, FR-003, NFR-006 (AC-NFR-006-01)
 */
function computeStartPhase(meta, workflowPhases) { ... }
```

### 4.3 Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `meta` | `object\|null` | Yes | -- | Parsed meta.json object from `readMetaJson()`. May be null (missing or corrupt meta.json). Expected fields: `phases_completed` (string[]), `analysis_status` (string). |
| `workflowPhases` | `string[]` | Yes | -- | The full feature workflow phases array from `workflows.json`. Must contain both analysis and implementation phases in order. |

### 4.4 Return Value

```typescript
{
    status: 'analyzed' | 'partial' | 'raw',
    startPhase: string | null,      // Phase key to start from, or null for full workflow
    completedPhases: string[],       // Phases that were completed during analysis
    remainingPhases: string[]        // Phases that will execute in the build workflow
}
```

The `startPhase` value is one of:
- A phase key from `workflowPhases` (e.g., `"05-test-strategy"` or `"02-impact-analysis"`)
- `null` when status is `'raw'` (meaning: use full workflow, no START_PHASE parameter)

### 4.5 Algorithm

```
1. IF meta is null OR meta is not an object:
     RETURN {
       status: 'raw',
       startPhase: null,
       completedPhases: [],
       remainingPhases: [...workflowPhases]
     }

2. LET { valid, warnings } = validatePhasesCompleted(meta.phases_completed)
   // warnings are included in the result for the caller to log

3. IF valid.length === 0:
     RETURN {
       status: 'raw',
       startPhase: null,
       completedPhases: [],
       remainingPhases: [...workflowPhases],
       warnings
     }

4. IF valid.length === ANALYSIS_PHASES.length:    // All 5 analysis phases complete
     LET firstImplPhase = workflowPhases.find(p => !ANALYSIS_PHASES.includes(p))
     // Expected: "05-test-strategy"
     IF firstImplPhase is undefined:
       // Defensive: workflow has no implementation phases (should not happen)
       RETURN { status: 'analyzed', startPhase: null, completedPhases: valid,
                remainingPhases: [], warnings }
     LET remaining = workflowPhases.slice(workflowPhases.indexOf(firstImplPhase))
     RETURN {
       status: 'analyzed',
       startPhase: firstImplPhase,
       completedPhases: valid,
       remainingPhases: remaining,
       warnings
     }

5. // Partial analysis: find the next incomplete analysis phase
   LET nextAnalysisPhase = ANALYSIS_PHASES.find(p => !valid.includes(p))
   // This is the first phase NOT in the valid contiguous set
   LET remaining = workflowPhases.slice(workflowPhases.indexOf(nextAnalysisPhase))
   RETURN {
     status: 'partial',
     startPhase: nextAnalysisPhase,
     completedPhases: valid,
     remainingPhases: remaining,
     warnings
   }
```

### 4.6 Edge Cases

| Input (meta) | Input (workflowPhases) | Expected Output | Rationale |
|-------------|----------------------|-----------------|-----------|
| `null` | feature phases | `{ status: 'raw', startPhase: null, completedPhases: [], remainingPhases: [all 9] }` | No meta.json (AC-001-04) |
| `{ phases_completed: [] }` | feature phases | `{ status: 'raw', startPhase: null, ... }` | Raw item (AC-001-03) |
| `{ phases_completed: [all 5 analysis] }` | feature phases | `{ status: 'analyzed', startPhase: '05-test-strategy', completedPhases: [5], remainingPhases: [4] }` | Fully analyzed (AC-001-01) |
| `{ phases_completed: ['00-quick-scan', '01-requirements'] }` | feature phases | `{ status: 'partial', startPhase: '02-impact-analysis', completedPhases: [2], remainingPhases: [7] }` | Partial (AC-001-02) |
| `{ phases_completed: ['00-quick-scan', '02-impact-analysis'] }` | feature phases | `{ status: 'partial', startPhase: '01-requirements', completedPhases: ['00-quick-scan'], remainingPhases: [8] }` | Non-contiguous treated as partial with contiguous prefix only (AC-003-06) |
| `{ phases_completed: undefined }` | feature phases | `{ status: 'raw', ... }` | Missing field, validatePhasesCompleted handles it |

### 4.7 Design Decisions

1. **Returns structured object, not just a phase string** (per ADR-001): The build verb handler needs `completedPhases` and `remainingPhases` to construct the summary banner and the partial-analysis menu. Returning a single string would force redundant computation.

2. **Includes `warnings` in result**: The caller decides how to handle warnings (log to stderr, display to user, etc.). The utility function does not log directly.

3. **Does not validate `workflowPhases`**: The workflow phases come from `workflows.json` which is a framework-controlled file. Input validation focuses on the user-influenced data (`meta.json`), not framework-controlled data.

### 4.8 Error Handling

This function never throws. All invalid `meta` inputs produce a `'raw'` status with `startPhase: null`. The caller falls through to full-workflow behavior.

---

## 5. Function: checkStaleness

### 5.1 Purpose

Compares the codebase hash stored in `meta.json` with the current git HEAD hash to determine whether the codebase has changed since analysis was performed. This is a pure comparison function -- it does not execute git commands.

**Traces**: FR-004, NFR-002, NFR-004 (AC-NFR-004-02)

### 5.2 Signature

```javascript
/**
 * Checks whether the codebase has changed since analysis was performed.
 * Pure comparison function -- does not execute git commands.
 *
 * @param {object|null} meta - Parsed meta.json (from readMetaJson)
 * @param {string} currentHash - Current git short hash (from `git rev-parse --short HEAD`)
 * @returns {{
 *   stale: boolean,
 *   originalHash: string|null,
 *   currentHash: string,
 *   commitsBehind: number|null
 * }}
 *
 * Traces: FR-004, NFR-002, NFR-004 (AC-NFR-004-02)
 */
function checkStaleness(meta, currentHash) { ... }
```

### 5.3 Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `meta` | `object\|null` | Yes | -- | Parsed meta.json from `readMetaJson()`. The relevant field is `codebase_hash` (string, 7-char short hash). |
| `currentHash` | `string` | Yes | -- | Current git short hash, obtained by the caller via `git rev-parse --short HEAD`. |

### 5.4 Return Value

```typescript
{
    stale: boolean,                  // true if hashes differ
    originalHash: string | null,     // meta.codebase_hash (null if no hash in meta)
    currentHash: string,             // The currentHash parameter (echoed back)
    commitsBehind: number | null     // Always null from this function; caller populates via git rev-list
}
```

### 5.5 Algorithm

```
1. IF meta is null OR meta.codebase_hash is falsy (undefined, null, empty string):
     RETURN {
       stale: false,
       originalHash: null,
       currentHash: currentHash,
       commitsBehind: null
     }
     // No hash to compare -- legacy item per AC-004-07
     // Caller should populate codebase_hash with currentHash for future use

2. IF meta.codebase_hash === currentHash:
     RETURN {
       stale: false,
       originalHash: meta.codebase_hash,
       currentHash: currentHash,
       commitsBehind: null
     }

3. // Hashes differ -- stale
   RETURN {
     stale: true,
     originalHash: meta.codebase_hash,
     currentHash: currentHash,
     commitsBehind: null
   }
```

### 5.6 Edge Cases

| Input (meta) | Input (currentHash) | Expected Output | Rationale |
|-------------|-------------------|-----------------|-----------|
| `null` | `"abc1234"` | `{ stale: false, originalHash: null, currentHash: "abc1234", commitsBehind: null }` | No meta -- skip staleness (AC-004-07) |
| `{ codebase_hash: "abc1234" }` | `"abc1234"` | `{ stale: false, originalHash: "abc1234", ... }` | Same hash (AC-004-01) |
| `{ codebase_hash: "abc1234" }` | `"def5678"` | `{ stale: true, originalHash: "abc1234", currentHash: "def5678", commitsBehind: null }` | Different hash (AC-004-02) |
| `{ codebase_hash: "" }` | `"abc1234"` | `{ stale: false, originalHash: null, ... }` | Empty hash treated as missing |
| `{ codebase_hash: undefined }` | `"abc1234"` | `{ stale: false, originalHash: null, ... }` | Undefined hash treated as missing |
| `{}` | `"abc1234"` | `{ stale: false, originalHash: null, ... }` | No codebase_hash field |
| `{ codebase_hash: "abc1234" }` | `""` | `{ stale: true, originalHash: "abc1234", currentHash: "", ... }` | Empty currentHash is a mismatch |

### 5.7 Design Decisions

1. **commitsBehind is always null**: The function is pure -- it does not execute `git rev-list --count`. The build verb handler populates this field after calling `checkStaleness()` by running the git command. This separation keeps the function testable without git (ADR-004).

2. **stale: false when no originalHash**: When meta.json has no `codebase_hash`, there is nothing to compare against. Treating this as "not stale" (rather than "stale") avoids false positives for legacy items (AC-004-07).

3. **String comparison, not number comparison**: Both hashes are 7-character hex strings. Direct `===` comparison is correct and sufficient.

### 5.8 Error Handling

This function never throws. All invalid inputs produce `{ stale: false }` with appropriate null values.

---

## 6. Updated Exports

The complete `module.exports` block after adding the new functions:

```javascript
module.exports = {
    // Constants
    ANALYSIS_PHASES,
    IMPLEMENTATION_PHASES,      // NEW
    MARKER_REGEX,

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

    // Build auto-detection utilities (NEW)
    validatePhasesCompleted,     // NEW
    computeStartPhase,          // NEW
    checkStaleness,             // NEW

    // Internal helpers (exported for testing)
    findBacklogItemByNumber,
    findByExternalRef,
    searchBacklogTitles,
    findDirForDescription
};
```

---

## 7. Implementation Notes

### 7.1 Insertion Point

The three new functions and the constant should be inserted between the existing `writeMetaJson` function (line 261) and the `parseBacklogLine` function (line 266). This places the build-detection utilities after the meta.json read/write functions (which they depend on conceptually) and before the backlog manipulation functions (which are unrelated).

Suggested file structure after modification:

```
Constants:
  ANALYSIS_PHASES          (existing, line 27)
  IMPLEMENTATION_PHASES    (NEW)
  MARKER_REGEX             (existing, line 44)

Functions:
  generateSlug             (existing)
  detectSource             (existing)
  deriveAnalysisStatus     (existing)
  deriveBacklogMarker      (existing)
  readMetaJson             (existing)
  writeMetaJson            (existing)
  validatePhasesCompleted  (NEW)
  computeStartPhase        (NEW)
  checkStaleness           (NEW)
  parseBacklogLine         (existing)
  updateBacklogMarker      (existing)
  appendToBacklog          (existing)
  resolveItem              (existing)
  ... internal helpers     (existing)
```

### 7.2 No New Dependencies

The three functions use only:
- `ANALYSIS_PHASES` constant (internal to the module)
- Array methods (`filter`, `includes`, `find`, `slice`, `indexOf`, `push`, `join`)
- No `fs`, `path`, `child_process`, or any external modules

### 7.3 Relationship to Existing deriveAnalysisStatus

The existing `deriveAnalysisStatus(phasesCompleted)` function performs a simpler version of status detection (counts recognized phases, returns `'raw'`/`'partial'`/`'analyzed'`). The new `computeStartPhase` uses `validatePhasesCompleted` which provides richer validation (contiguity, warnings). The two approaches are compatible:
- `deriveAnalysisStatus` is used by `writeMetaJson` to keep meta.json consistent.
- `computeStartPhase` is used by the build verb handler for phase-skip decisions.

Neither function is changed. The new functions complement the existing ones.

---

## 8. Test Specification

Minimum test cases for each function, to be added to `test-three-verb-utils.test.cjs`:

### 8.1 validatePhasesCompleted Tests

| # | Test Name | Input | Expected Output |
|---|-----------|-------|-----------------|
| 1 | returns empty for null input | `null` | `{ valid: [], warnings: ["...not an array"] }` |
| 2 | returns empty for undefined | `undefined` | `{ valid: [], warnings: ["...not an array"] }` |
| 3 | returns empty for string input | `"not-array"` | `{ valid: [], warnings: ["...not an array"] }` |
| 4 | returns empty for empty array | `[]` | `{ valid: [], warnings: [] }` |
| 5 | returns single contiguous phase | `["00-quick-scan"]` | `{ valid: ["00-quick-scan"], warnings: [] }` |
| 6 | returns two contiguous phases | `["00-quick-scan", "01-requirements"]` | `{ valid: [...], warnings: [] }` |
| 7 | returns all 5 analysis phases | all 5 | `{ valid: [all 5], warnings: [] }` |
| 8 | handles gap (non-contiguous) | `["00-quick-scan", "02-impact-analysis"]` | `{ valid: ["00-quick-scan"], warnings: ["Non-contiguous..."] }` |
| 9 | handles missing first phase | `["01-requirements", "02-impact-analysis"]` | `{ valid: [], warnings: ["Non-contiguous..."] }` |
| 10 | filters unknown keys silently | `["00-quick-scan", "future-phase"]` | `{ valid: ["00-quick-scan"], warnings: [] }` |
| 11 | all unknown keys returns empty | `["unknown-a", "unknown-b"]` | `{ valid: [], warnings: [] }` |

### 8.2 computeStartPhase Tests

| # | Test Name | Meta Input | Expected Status | Expected startPhase |
|---|-----------|------------|-----------------|---------------------|
| 1 | null meta returns raw | `null` | `'raw'` | `null` |
| 2 | empty phases returns raw | `{ phases_completed: [] }` | `'raw'` | `null` |
| 3 | all 5 analysis phases returns analyzed | `{ phases_completed: [all 5] }` | `'analyzed'` | `'05-test-strategy'` |
| 4 | 2 phases returns partial | `{ phases_completed: ['00-quick-scan', '01-requirements'] }` | `'partial'` | `'02-impact-analysis'` |
| 5 | non-contiguous uses prefix | `{ phases_completed: ['00-quick-scan', '02-impact-analysis'] }` | `'partial'` | `'01-requirements'` |
| 6 | non-object meta returns raw | `42` | `'raw'` | `null` |
| 7 | missing phases_completed | `{ analysis_status: 'partial' }` | `'raw'` | `null` |
| 8 | completedPhases matches valid set | `{ phases_completed: [all 5] }` | -- | completedPhases has all 5 |
| 9 | remainingPhases excludes completed | `{ phases_completed: [all 5] }` | -- | remainingPhases has 4 impl phases |

### 8.3 checkStaleness Tests

| # | Test Name | Meta Input | currentHash | Expected stale |
|---|-----------|------------|-------------|----------------|
| 1 | same hash not stale | `{ codebase_hash: "abc1234" }` | `"abc1234"` | `false` |
| 2 | different hash is stale | `{ codebase_hash: "abc1234" }` | `"def5678"` | `true` |
| 3 | null meta not stale | `null` | `"abc1234"` | `false` |
| 4 | missing codebase_hash not stale | `{}` | `"abc1234"` | `false` |
| 5 | empty codebase_hash not stale | `{ codebase_hash: "" }` | `"abc1234"` | `false` |
| 6 | originalHash is null when missing | `null` | `"abc1234"` | originalHash === null |
| 7 | commitsBehind is always null | any | any | commitsBehind === null |

---

## 9. Traceability Matrix

| Function | FR Traces | NFR Traces | ADR Traces | AC Coverage |
|----------|-----------|------------|------------|-------------|
| `IMPLEMENTATION_PHASES` | FR-002, FR-006 | -- | ADR-002 | AC-002-01, AC-006-01 |
| `validatePhasesCompleted` | FR-003 | NFR-004, NFR-006 | ADR-001 | AC-003-06, AC-NFR-004-03, AC-NFR-006-01 |
| `computeStartPhase` | FR-001, FR-002, FR-003 | NFR-006 | ADR-001, ADR-002 | AC-001-01 through AC-001-05, AC-002-01, AC-003-03, AC-NFR-006-01 |
| `checkStaleness` | FR-004 | NFR-002, NFR-004 | ADR-004 | AC-004-01, AC-004-02, AC-004-07, AC-NFR-004-02 |
