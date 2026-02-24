# Interface Specification: Build Consumption -- Init Split & Smart Staleness

**Feature**: GH-60 + GH-61 (Feature B: Build Consumption)
**Artifact Folder**: gh-60-61-build-consumption-init-split-smart-staleness
**Phase**: 04-design
**Status**: Draft
**Created**: 2026-02-20

**Traces**: FR-001 through FR-007, NFR-001 through NFR-005

---

## 1. Overview

This document specifies the exact function signatures, return types, and error
handling for all new and modified interfaces in GH-60 and GH-61. It serves as
the implementation contract for the software developer (Phase 06).

---

## 2. New Functions (three-verb-utils.cjs)

### 2.1 extractFilesFromImpactAnalysis(mdContent)

```javascript
/**
 * Parses the "Directly Affected Files" table from impact-analysis.md
 * and returns a normalized, deduplicated array of file paths.
 *
 * Pure function: string in, string[] out. No I/O, no side effects.
 *
 * GH-61: Blast-radius-aware staleness
 * Traces: FR-005 (AC-005-01 through AC-005-04)
 *
 * @param {string|null|undefined} mdContent - Raw markdown content of impact-analysis.md.
 *   Accepts null/undefined/empty/non-string gracefully (returns []).
 *
 * @returns {string[]} Array of relative file paths extracted from the
 *   "Directly Affected Files" table. Paths are normalized (no leading ./ or /).
 *   Deduplicated. Empty array on any error or missing/unparseable table.
 *
 * @example
 * const files = extractFilesFromImpactAnalysis(mdContent);
 * // => ['src/claude/commands/isdlc.md', 'src/claude/agents/00-sdlc-orchestrator.md', ...]
 *
 * @example
 * const files = extractFilesFromImpactAnalysis(null);
 * // => []
 *
 * @example
 * const files = extractFilesFromImpactAnalysis('# No table here');
 * // => []
 */
function extractFilesFromImpactAnalysis(mdContent) { ... }
```

**Internal constants used**:

```javascript
/**
 * Regex to detect the "Directly Affected Files" section heading.
 * Matches ## or ### level headings containing "Directly Affected Files".
 * Case-insensitive. Allows optional numbering prefix (e.g., "3.1").
 *
 * Traces: CON-005 (semi-stable format resilience)
 */
const DIRECTLY_AFFECTED_HEADING = /^#{2,3}\s+.*Directly Affected Files/i;

/**
 * Regex to extract a backtick-wrapped file path from a markdown table row.
 * Matches: | `path/to/file` | ... |
 * Captures group 1: the file path inside backticks.
 *
 * Intentionally simpler than blast-radius-validator's IMPACT_TABLE_ROW which
 * also requires a change type column. This pattern only needs the file path.
 *
 * Traces: FR-005 (AC-005-01)
 */
const TABLE_FILE_PATH = /^\|\s*`([^`]+)`\s*\|/;

/**
 * Regex to detect the next markdown section heading (## or ###).
 * Used as section boundary detector.
 */
const NEXT_SECTION_HEADING = /^#{2,3}\s/;
```

**Path normalization function** (internal, not exported):

```javascript
/**
 * Normalizes a file path by stripping leading ./ or / prefix.
 *
 * @param {string} rawPath - Raw file path from markdown table
 * @returns {string} Normalized relative path
 *
 * @example normalizePath('./src/foo.js') => 'src/foo.js'
 * @example normalizePath('/src/foo.js')  => 'src/foo.js'
 * @example normalizePath('src/foo.js')   => 'src/foo.js'
 */
function normalizePath(rawPath) {
    let p = rawPath.trim();
    if (p.startsWith('./')) p = p.slice(2);
    if (p.startsWith('/')) p = p.slice(1);
    return p;
}
```

---

### 2.2 checkBlastRadiusStaleness(meta, currentHash, impactAnalysisContent, changedFiles)

```javascript
/**
 * Blast-radius-aware staleness check. Intersects git-changed files with the
 * blast radius from impact-analysis.md to produce a tiered severity response.
 *
 * When changedFiles is null, the function executes `git diff --name-only`
 * internally. When provided, it uses the injected list (testability path).
 *
 * GH-61: Blast-radius-aware staleness
 * Traces: FR-004 (AC-004-01 through AC-004-06), NFR-002, NFR-003, NFR-004
 *
 * @param {object|null} meta - Parsed meta.json object. Expected to have
 *   `codebase_hash` property (string). Null/undefined/non-object treated as
 *   "no hash to compare" (returns stale: false).
 *
 * @param {string} currentHash - Current git HEAD short hash, from
 *   `git rev-parse --short HEAD`. Expected to be a non-empty string.
 *
 * @param {string|null} impactAnalysisContent - Raw markdown content of
 *   impact-analysis.md. Null/undefined/empty triggers fallback to naive check.
 *
 * @param {string[]|null} changedFiles - Pre-computed list of changed file paths
 *   (root-relative, no prefix). When null, the function computes this list
 *   internally via `git diff --name-only {originalHash}..HEAD`.
 *   Provide a non-null array for unit testing (NFR-004).
 *
 * @returns {StalenessResult} Tiered staleness result object.
 *
 * @example
 * // Production usage (changedFiles = null, git runs internally):
 * const result = checkBlastRadiusStaleness(meta, 'abc1234', mdContent, null);
 *
 * @example
 * // Test usage (changedFiles injected, no git call):
 * const result = checkBlastRadiusStaleness(
 *   { codebase_hash: 'abc1234' }, 'def5678', mdContent,
 *   ['src/file1.js', 'src/file2.js']
 * );
 */
function checkBlastRadiusStaleness(meta, currentHash, impactAnalysisContent, changedFiles) { ... }
```

---

## 3. Return Types

### 3.1 StalenessResult (from checkBlastRadiusStaleness)

```typescript
/**
 * Return type of checkBlastRadiusStaleness().
 * All fields are always present (no optional fields).
 */
interface StalenessResult {
    /** Whether the codebase is stale relative to the analysis. */
    stale: boolean;

    /**
     * Severity tier:
     * - 'none':     0 overlapping files. Silent proceed.
     * - 'info':     1-3 overlapping files. Informational note, no menu.
     * - 'warning':  4+ overlapping files. Full warning menu.
     * - 'fallback': Blast-radius check unavailable. Naive hash-based menu.
     */
    severity: 'none' | 'info' | 'warning' | 'fallback';

    /** File paths that appear in both the changed set and blast radius. */
    overlappingFiles: string[];

    /** Total number of files changed between originalHash and currentHash. */
    changedFileCount: number;

    /** Total number of files in the blast radius from impact-analysis.md. */
    blastRadiusFileCount: number;

    /** The git hash at analysis time (from meta.codebase_hash). Null if no meta. */
    originalHash: string | null;

    /** Current git HEAD short hash. */
    currentHash: string;

    /**
     * Reason for fallback mode. Non-null only when severity === 'fallback'.
     * Possible values:
     * - 'no-impact-analysis': impactAnalysisContent was null/undefined/empty
     * - 'no-parseable-table': impact-analysis.md exists but has no parseable table
     * - 'git-diff-failed':    git diff --name-only returned non-zero or timed out
     */
    fallbackReason: string | null;

    /**
     * Number of commits between originalHash and HEAD.
     * Not populated by checkBlastRadiusStaleness() itself -- the caller
     * (isdlc.md Step 4b) enriches this field for warning/fallback tiers.
     * Defaults to null.
     */
    commitsBehind?: number | null;
}
```

### 3.2 InitOnlyResult (from orchestrator MODE: init-only)

```typescript
/**
 * Return type of orchestrator MODE: init-only.
 * Returned as JSON in the orchestrator's Task result.
 */
interface InitOnlyResult {
    /** Always "init_complete" for init-only mode. */
    status: 'init_complete';

    /**
     * Ordered array of phase keys to execute.
     * Full workflow: ["01-requirements", "02-impact-analysis", ...]
     * With START_PHASE: sliced from START_PHASE onward.
     */
    phases: string[];

    /**
     * The artifact folder name.
     * Auto-generated: "REQ-NNNN-{slug}" or "BUG-NNNN-{slug}"
     * Or provided: from ARTIFACT_FOLDER parameter.
     */
    artifact_folder: string;

    /**
     * Workflow type.
     * One of: "feature", "fix", "test-run", "test-generate", "upgrade"
     */
    workflow_type: string;

    /**
     * Always 0 for init-only (no phases executed).
     * The Phase-Loop Controller starts from this index.
     */
    next_phase_index: 0;
}
```

### 3.3 Existing checkStaleness Return (Preserved, No Changes)

```typescript
/**
 * Return type of checkStaleness() (PRESERVED, NOT MODIFIED).
 * Documented here for reference only.
 */
interface LegacyStalenessResult {
    stale: boolean;
    originalHash: string | null;
    currentHash: string;
    commitsBehind: number | null;
}
```

---

## 4. Modified Interfaces

### 4.1 Orchestrator MODE Parameter (00-sdlc-orchestrator.md)

**Current MODE values**:
```
MODE: init-and-phase-01
MODE: single-phase PHASE: {phase-key}
MODE: finalize
```

**After**:
```
MODE: init-only
MODE: init-and-phase-01          (deprecated)
MODE: single-phase PHASE: {phase-key}
MODE: finalize
```

**init-only parameters** (same as init-and-phase-01):

| Parameter | Required | Type | Description |
|-----------|----------|------|-------------|
| ACTION | Yes | string | `feature`, `fix`, `test-run`, `test-generate`, `upgrade` |
| DESCRIPTION | Yes | string | User-provided description |
| START_PHASE | No | string | Phase key to start from (slices phases array) |
| ARTIFACT_FOLDER | No | string | Existing folder name (skips counter increment) |
| FLAGS | No | string | `--supervised`, `--debate`, etc. |
| MONOREPO CONTEXT | No | block | Monorepo project context if applicable |

**init-only return format**:
```json
{
  "status": "init_complete",
  "phases": ["01-requirements", "02-impact-analysis", "03-architecture", ...],
  "artifact_folder": "REQ-0001-feature-name",
  "workflow_type": "feature",
  "next_phase_index": 0
}
```

**Contrast with init-and-phase-01 return** (unchanged):
```json
{
  "status": "phase_complete",
  "phases": ["01-requirements", "02-impact-analysis", ...],
  "artifact_folder": "REQ-0001-feature-name",
  "workflow_type": "feature",
  "next_phase_index": 1
}
```

**Key differences**:
- `status`: `"init_complete"` vs `"phase_complete"`
- `next_phase_index`: `0` vs `1`
- init-only does NOT execute any phase, gate, or plan

### 4.2 isdlc.md Step 4b Call Site (Staleness Check)

**Current call**:
```javascript
stalenessResult = checkStaleness(meta, currentHash)
```

**After**:
```javascript
impactAnalysisContent = readFile(path.join(slugDir, 'impact-analysis.md')) // or null
stalenessResult = checkBlastRadiusStaleness(meta, currentHash, impactAnalysisContent, null)
```

The return type changes from `LegacyStalenessResult` to `StalenessResult`.
Step 4c must handle the new `severity` field instead of the boolean `stale` field.

### 4.3 isdlc.md STEP 1 Orchestrator Call

**Current**:
```
MODE: init-and-phase-01
```

**After**:
```
MODE: init-only
```

Return type changes from `{ status: "phase_complete", next_phase_index: 1 }` to
`{ status: "init_complete", next_phase_index: 0 }`.

STEP 2 and STEP 3 consume `next_phase_index` from the return, so they naturally
adapt to the new value (0 instead of 1).

---

## 5. Export Additions (three-verb-utils.cjs)

### 5.1 New Exports

```javascript
module.exports = {
    // ... all existing exports preserved ...

    // Blast-radius staleness utilities (GH-61)
    extractFilesFromImpactAnalysis,    // FR-005
    checkBlastRadiusStaleness,         // FR-004
};
```

### 5.2 New Import

```javascript
const { execSync } = require('child_process');  // For git diff in checkBlastRadiusStaleness
```

### 5.3 Constants (Internal, Not Exported)

The regex constants (`DIRECTLY_AFFECTED_HEADING`, `TABLE_FILE_PATH`, `NEXT_SECTION_HEADING`)
and the `normalizePath` helper are internal to the module and NOT exported. They are
implementation details of `extractFilesFromImpactAnalysis`.

If testing requires access to these constants, they can be exported under a `_internal`
namespace:

```javascript
module.exports = {
    // ... public exports ...

    // Internal helpers (exported for testing only)
    _internal: {
        DIRECTLY_AFFECTED_HEADING,
        TABLE_FILE_PATH,
        normalizePath
    }
};
```

This follows the existing pattern where `findBacklogItemByNumber`, `findByExternalRef`,
etc. are exported for testing.

---

## 6. Error Handling Contracts

### 6.1 extractFilesFromImpactAnalysis -- Never Throws

This function MUST NOT throw. All error conditions return `[]`:
- null/undefined/non-string input: return `[]`
- No section heading found: return `[]`
- No table rows matched: return `[]`
- Regex execution error (should not happen with valid regex): catch and return `[]`

### 6.2 checkBlastRadiusStaleness -- Never Throws

This function MUST NOT throw. All error conditions produce a valid `StalenessResult`:
- null/undefined meta: return `{ stale: false, severity: 'none', ... }`
- null/empty impactAnalysisContent: return `{ severity: 'fallback', ... }`
- Empty blast radius: return `{ severity: 'fallback', ... }`
- git diff failure: return `{ severity: 'fallback', fallbackReason: 'git-diff-failed', ... }`
- Any unexpected error: wrap in try/catch, return `{ severity: 'fallback', ... }`

The outermost body of `checkBlastRadiusStaleness` should be wrapped in a try/catch
that returns a fallback result on any unhandled exception:

```javascript
function checkBlastRadiusStaleness(meta, currentHash, impactAnalysisContent, changedFiles) {
    try {
        // ... main logic ...
    } catch (err) {
        // Defensive: never throw from staleness check
        return {
            stale: true,
            severity: 'fallback',
            overlappingFiles: [],
            changedFileCount: 0,
            blastRadiusFileCount: 0,
            originalHash: meta?.codebase_hash ?? null,
            currentHash: currentHash || '',
            fallbackReason: 'unexpected-error'
        };
    }
}
```

### 6.3 Orchestrator init-only -- Standard Error Handling

The init-only mode uses the same error handling as init-and-phase-01:
- Constitution missing: stop with error message
- Active workflow exists: stop with "workflow already active" message
- Branch creation fails: stop with git error
- state.json write fails: stop with filesystem error

These are infrastructure errors that block initialization. There is no graceful
degradation for initialization failures -- the workflow cannot proceed.

---

## 7. Deprecation Contract

### 7.1 init-and-phase-01 Deprecation Notice

**When**: Every invocation of `MODE: init-and-phase-01`
**Where**: stderr (not stdout, not blocking)
**Format**: `"DEPRECATED: MODE init-and-phase-01 will be removed in v0.3.0. Use MODE init-only with Phase-Loop Controller."`
**Behavior impact**: None. Full existing behavior preserved.
**Removal timeline**: v0.3.0 (2 release cycles from current 0.1.0-alpha)

### 7.2 checkStaleness Preservation

`checkStaleness()` is NOT deprecated. It remains a public export for:
1. Backward compatibility with any external callers
2. Use as the conceptual "naive fallback" behavior reference
3. Existing tests continue to pass unchanged

---

## 8. Traceability Matrix

| Interface | FR Trace | NFR Trace | CON Trace |
|-----------|----------|-----------|-----------|
| extractFilesFromImpactAnalysis() | FR-005 | NFR-004 | CON-005 |
| checkBlastRadiusStaleness() | FR-004 | NFR-002, NFR-003, NFR-004 | CON-004 |
| StalenessResult type | FR-004, FR-006 | -- | -- |
| InitOnlyResult type | FR-001, FR-007 | NFR-005 | -- |
| MODE: init-only | FR-001, FR-007 | NFR-005 | -- |
| MODE: init-and-phase-01 (deprecated) | FR-003 | NFR-001 | CON-001 |
| isdlc.md STEP 1 change | FR-002, FR-003 | -- | -- |
| isdlc.md Steps 4b-4c change | FR-004, FR-006 | NFR-003 | -- |
| three-verb-utils.cjs exports | FR-004, FR-005 | NFR-004 | -- |
