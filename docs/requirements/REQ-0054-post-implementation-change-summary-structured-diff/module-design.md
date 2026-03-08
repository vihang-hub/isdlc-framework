# Module Design: Post-Implementation Change Summary Generator

**Requirement ID:** REQ-0054
**Artifact Folder:** REQ-0054-post-implementation-change-summary-structured-diff
**Phase:** 04-design
**Created:** 2026-03-09
**Status:** Draft

---

## 1. Overview

This document specifies the module-level design for the post-implementation change summary generator. The feature consists of one new file (`change-summary-generator.cjs`) and one modified file (`isdlc.md`). The generator is a self-contained CJS script following the established antigravity finalize-script pattern (analyze-finalize.cjs, workflow-finalize.cjs). It reads from four data sources (git CLI, state.json, tasks.md, requirements-spec.md), assembles a unified summary data structure, and writes two output artifacts (change-summary.md and change-summary.json).

**Architecture References:**
- ADR-0001: Standalone CLI script pattern (same as analyze-finalize.cjs)
- ADR-0002: Zero new dependencies (Node.js built-ins + common.cjs only)
- ADR-0003: Section-independent degradation (each section degrades independently)
- ADR-0004: Read-only state.json access
- ADR-0005: Dual-format output (change-summary.md + change-summary.json)
- ADR-0006: Integration at step 3e-summary (conditional, non-blocking, after phase 06)

**Constraints:**
- CON-001: CommonJS (CJS) syntax only
- CON-002: Zero new npm dependencies
- CON-003: Read-only state.json access (no mutations)
- CON-004: Generate once after phase 06 only
- CON-005: No hook integration in v1

---

## 2. Module: change-summary-generator.cjs (NEW)

**File:** `src/antigravity/change-summary-generator.cjs`
**Size Estimate:** 280-350 lines
**Dependencies:** `fs`, `path`, `child_process` (Node.js built-ins); `getProjectRoot`, `readState` from `common.cjs`
**Traces to:** FR-001 through FR-008, NFR-001 through NFR-011

### 2.1 Imports

```javascript
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getProjectRoot, readState } = require('../claude/hooks/lib/common.cjs');
```

No other imports. The script uses only Node.js built-ins and two stable exports from common.cjs (v3.0.0, used by 26+ hooks).

### 2.2 Internal Constants

```javascript
/**
 * Timeout for individual git commands (ms).
 * Generous for large repos; typical execution < 200ms.
 * Traces to: NFR-001, Section 11.2 of architecture-overview.md
 */
const GIT_TIMEOUT_MS = 5000;

/**
 * Maximum file size (bytes) for code comment scanning.
 * Files larger than this are skipped to prevent memory exhaustion.
 * Traces to: Section 6.2 of architecture-overview.md
 */
const MAX_CODE_SCAN_SIZE = 102400; // 100 KB

/**
 * Regex for extracting FR-NNN and AC-NNN-NN identifiers.
 * Used across tracing functions.
 * Traces to: FR-003
 */
const REQ_PATTERN = /(?:FR-\d{3}|AC-\d{3}-\d{2})/g;

/**
 * JSON schema version for change-summary.json.
 * Traces to: NFR-005, NFR-006, Section 10 of architecture-overview.md
 */
const SCHEMA_VERSION = '1.0';
```

---

## 3. Data Structures

### 3.1 DiffResult

Returned by `collectGitDiff()`. Represents the raw git diff between the feature branch and its merge-base.

```javascript
/**
 * @typedef {Object} DiffResult
 * @property {string} mergeBase - SHA of the merge-base commit
 * @property {string} head - SHA of HEAD
 * @property {DiffEntry[]} entries - List of changed files
 *
 * Traces to: FR-001
 */

/**
 * @typedef {Object} DiffEntry
 * @property {string} path - Relative file path (forward slashes)
 * @property {string} status - Git status letter: 'M', 'A', 'D', or 'R'
 * @property {string|null} oldPath - Previous path (only for renames, status 'R')
 *
 * Traces to: FR-001
 */
```

**Example:**
```javascript
{
  mergeBase: 'abc1234',
  head: 'def5678',
  entries: [
    { path: 'src/antigravity/change-summary-generator.cjs', status: 'A', oldPath: null },
    { path: 'src/claude/commands/isdlc.md', status: 'M', oldPath: null },
    { path: 'src/old-name.cjs', status: 'R', oldPath: 'src/old-name.cjs' }
  ]
}
```

### 3.2 ClassifiedFile

Returned by `classifyFiles()`. Extends DiffEntry with a human-readable change type and rationale.

```javascript
/**
 * @typedef {Object} ClassifiedFile
 * @property {string} path - Relative file path (forward slashes)
 * @property {'modified'|'added'|'deleted'|'renamed'} changeType - Human-readable change type
 * @property {string|null} oldPath - Previous path (renames only)
 * @property {string} rationale - 1-2 line description of why this file changed
 *
 * Traces to: FR-002
 */
```

**Change type mapping from git status letters:**

| Git Status | changeType | Notes |
|-----------|------------|-------|
| `M` | `'modified'` | File content changed |
| `A` | `'added'` | New file |
| `D` | `'deleted'` | File removed |
| `R` (or `R###`) | `'renamed'` | File moved/renamed; `oldPath` populated |

### 3.3 TracedFile

Returned by `traceRequirements()`. Extends ClassifiedFile with requirement tracing data.

```javascript
/**
 * @typedef {Object} TracedFile
 * @property {string} path - Relative file path (forward slashes)
 * @property {'modified'|'added'|'deleted'|'renamed'} changeType
 * @property {string|null} oldPath - Previous path (renames only)
 * @property {string} rationale - 1-2 line description
 * @property {string[]} tracedRequirements - Array of matched FR-NNN / AC-NNN-NN IDs
 * @property {'tasks.md'|'commit'|'code-comment'|'untraced'} tracingSource - Which source matched
 *
 * Traces to: FR-003
 */
```

### 3.4 TestResults

Returned by `extractTestResults()`. Summarizes phase 06 test execution data.

```javascript
/**
 * @typedef {Object} TestResults
 * @property {number} total - Total test count
 * @property {number} passing - Passing test count
 * @property {number} failing - Failing test count
 * @property {number|null} coveragePercent - Code coverage percentage, or null if unavailable
 *
 * Traces to: FR-004
 */
```

### 3.5 SummaryData

The central data structure assembled by `buildSummaryData()`. This is the single source of truth from which both output formats are rendered.

```javascript
/**
 * @typedef {Object} SummaryData
 * @property {string} schemaVersion - Always '1.0'
 * @property {string} generatedAt - ISO-8601 timestamp
 * @property {string} workflowSlug - From state.json active_workflow.slug
 * @property {string} baseBranch - Base branch name (default: 'main')
 * @property {string|null} baseCommit - Merge-base SHA, or null if git unavailable
 * @property {string|null} headCommit - HEAD SHA, or null if git unavailable
 * @property {SummaryMetrics} summary - Aggregate counts
 * @property {TracedFile[]} files - All changed files with tracing data
 * @property {TestResults|null} testResults - Test data, or null if unavailable
 * @property {string[]} warnings - Accumulated degradation warnings
 *
 * Traces to: FR-005, FR-006
 */

/**
 * @typedef {Object} SummaryMetrics
 * @property {number} filesModified
 * @property {number} filesAdded
 * @property {number} filesDeleted
 * @property {number} filesRenamed
 * @property {number} totalFilesChanged
 * @property {number} requirementsTraced - Count of files with at least one traced requirement
 * @property {number} requirementsUntraced - Count of files with tracingSource === 'untraced'
 * @property {boolean|null} testsPassing - true/false/null
 * @property {number|null} testCount
 * @property {number|null} coveragePercent
 *
 * Traces to: FR-005, FR-006
 */
```

### 3.6 StdoutResult

The JSON object written to stdout for the phase-loop controller to consume.

```javascript
/**
 * @typedef {Object} StdoutResult
 * @property {'OK'|'ERROR'} result - Overall status
 * @property {number} [filesChanged] - Total files changed (OK only)
 * @property {number} [filesTraced] - Files with traced requirements (OK only)
 * @property {number} [filesUntraced] - Files without traced requirements (OK only)
 * @property {string} [mdPath] - Path to change-summary.md (OK only)
 * @property {string} [jsonPath] - Path to change-summary.json (OK only)
 * @property {string[]} [warnings] - Degradation warnings (OK only)
 * @property {string} [message] - Error message (ERROR only)
 *
 * Traces to: FR-008, Section 4.2 of architecture-overview.md
 */
```

---

## 4. Function Specifications

### 4.1 parseArgs()

**Traces to:** FR-008
**Complexity:** LOW

```javascript
/**
 * Parse CLI arguments from process.argv.
 * Extracts the --folder argument value.
 *
 * @returns {{ folder: string|null }} Parsed arguments
 *
 * Pattern: Identical to analyze-finalize.cjs parseArgs()
 */
function parseArgs() { ... }
```

**Algorithm:**
1. Slice `process.argv` from index 2
2. Iterate looking for `'--folder'` followed by a value
3. Return `{ folder: value }` or `{ folder: null }`

**Error handling:** Returns `{ folder: null }`. The caller (main) checks for null and exits with code 2.

---

### 4.2 loadProjectContext()

**Traces to:** FR-001, FR-003, FR-004, FR-008
**Complexity:** LOW

```javascript
/**
 * Load project root, state.json, and resolve paths needed by
 * downstream pipeline functions.
 *
 * @param {string} folderArg - The --folder argument value (absolute or relative)
 * @returns {{
 *   projectRoot: string,
 *   state: Object|null,
 *   folderAbsolute: string,
 *   folderRelative: string,
 *   baseBranch: string,
 *   workflowSlug: string,
 *   artifactFolder: string,
 *   reqSpecPath: string,
 *   tasksPath: string
 * }}
 * @throws {Error} If folder does not exist on disk
 */
function loadProjectContext(folderArg) { ... }
```

**Algorithm:**
1. Call `getProjectRoot()` from common.cjs
2. Resolve `folderArg` to absolute path (if relative, join with projectRoot)
3. Validate folder exists (`fs.existsSync`); throw if not
4. Call `readState()` from common.cjs (returns object or null)
5. Extract from state:
   - `baseBranch` = `state?.active_workflow?.base_branch || 'main'`
   - `workflowSlug` = `state?.active_workflow?.slug || path.basename(folderAbsolute)`
   - `artifactFolder` = `state?.active_workflow?.artifact_folder || path.basename(folderAbsolute)`
6. Derive paths:
   - `reqSpecPath` = `path.join(folderAbsolute, 'requirements-spec.md')`
   - `tasksPath` = `path.join(projectRoot, 'docs', 'isdlc', 'tasks.md')`
7. Return all resolved values

**Error handling:** Throws on missing folder (hard error, caught by main). State being null is acceptable -- downstream functions handle null state.

---

### 4.3 collectGitDiff(projectRoot, baseBranch)

**Traces to:** FR-001
**Complexity:** LOW

```javascript
/**
 * Collect the list of changed files by diffing HEAD against the merge-base
 * with the specified base branch.
 *
 * @param {string} projectRoot - Absolute path to project root
 * @param {string} baseBranch - Base branch name (e.g., 'main')
 * @returns {DiffResult|null} Diff data, or null if git is unavailable
 *
 * Git commands used:
 *   git merge-base HEAD <baseBranch>
 *   git diff --name-status <mergeBase>..HEAD
 *   git rev-parse HEAD
 *
 * Pattern: Follows blast-radius-validator.cjs getModifiedFiles() --
 *   execSync with 5s timeout, stdio suppressed, null on failure.
 */
function collectGitDiff(projectRoot, baseBranch) { ... }
```

**Algorithm:**
1. Run `git merge-base HEAD <baseBranch>` with `execSync`:
   - Options: `{ cwd: projectRoot, encoding: 'utf8', timeout: GIT_TIMEOUT_MS, stdio: ['pipe', 'pipe', 'pipe'] }`
   - Trim result to get mergeBase SHA
2. Run `git rev-parse HEAD` with same options to get head SHA
3. Run `git diff --name-status <mergeBase>..HEAD` with same options
4. Parse each output line into a DiffEntry:

**Parsing `git diff --name-status` output:**

Each line has the format: `<status>\t<path>` or `<status>\t<old_path>\t<new_path>` (for renames).

```
M       src/file.js           -> { status: 'M', path: 'src/file.js', oldPath: null }
A       src/new.js            -> { status: 'A', path: 'src/new.js', oldPath: null }
D       src/removed.js        -> { status: 'D', path: 'src/removed.js', oldPath: null }
R100    src/old.js  src/new.js -> { status: 'R', path: 'src/new.js', oldPath: 'src/old.js' }
```

```javascript
// Parsing logic for each line:
function parseDiffLine(line) {
    const parts = line.split('\t');
    if (parts.length < 2) return null;
    const statusCode = parts[0].trim();
    if (statusCode.startsWith('R')) {
        // Rename: R### old_path new_path
        return { status: 'R', oldPath: parts[1], path: parts[2] || parts[1] };
    }
    return { status: statusCode.charAt(0), path: parts[1], oldPath: null };
}
```

5. Filter out null entries (unparseable lines)
6. Return `{ mergeBase, head, entries }`

**Error handling:** If any `execSync` call throws (git unavailable, not a git repo, no common ancestor), return `null`. The caller records a warning.

---

### 4.4 classifyFiles(entries, projectRoot)

**Traces to:** FR-002
**Complexity:** MEDIUM

```javascript
/**
 * Classify each changed file with a human-readable change type and
 * a 1-2 line rationale extracted from commit messages.
 *
 * @param {DiffEntry[]} entries - Raw diff entries from collectGitDiff()
 * @param {string} projectRoot - Absolute path to project root
 * @returns {ClassifiedFile[]} Classified files with rationale
 */
function classifyFiles(entries, projectRoot) { ... }
```

**Algorithm:**

For each entry:
1. Map `status` letter to `changeType` string using the mapping in Section 3.2
2. Extract rationale from git commit messages:
   ```
   git log --format="%s" --diff-filter=<status> -- <path>
   ```
   - Options: `{ cwd: projectRoot, encoding: 'utf8', timeout: GIT_TIMEOUT_MS, stdio: ['pipe', 'pipe', 'pipe'] }`
   - Take the first non-empty commit subject line
   - Truncate to 120 characters if longer
   - If git log fails or returns empty, use a default rationale based on change type:
     - `'added'`: `"New file"`
     - `'modified'`: `"Modified"`
     - `'deleted'`: `"Removed"`
     - `'renamed'`: `"Renamed from <oldPath>"`
3. Return array of ClassifiedFile objects

**Error handling:** If `git log` fails for a specific file, use the default rationale. The function never throws -- individual file failures do not affect other files.

**Performance note:** This runs `git log` once per changed file, making it O(n). For 50 files at ~100ms each, total is ~5s. Each command has a 5s timeout (GIT_TIMEOUT_MS), so worst case for a single stuck command is 5s, not unbounded.

---

### 4.5 extractValidRequirements(reqSpecPath)

**Traces to:** FR-003
**Complexity:** LOW

```javascript
/**
 * Parse requirements-spec.md to extract the set of valid FR-NNN and
 * AC-NNN-NN identifiers. Used to validate traced requirements.
 *
 * @param {string} reqSpecPath - Absolute path to requirements-spec.md
 * @returns {Set<string>} Set of valid requirement IDs (e.g., 'FR-001', 'AC-001-01')
 *
 * If the file is missing or unparseable, returns an empty Set.
 * When the set is empty, all extracted identifiers are accepted as-is
 * (no filtering). This is the graceful degradation behavior.
 */
function extractValidRequirements(reqSpecPath) { ... }
```

**Algorithm:**
1. Check `fs.existsSync(reqSpecPath)` -- return empty Set if missing
2. Read file content with `fs.readFileSync(reqSpecPath, 'utf8')`
3. Apply `REQ_PATTERN` regex globally to extract all FR-NNN and AC-NNN-NN matches
4. Deduplicate into a Set
5. Return the Set

**Error handling:** Return empty Set on any error (file read failure, encoding issues). An empty set means "accept all extracted identifiers" -- the validation step in `traceRequirements` skips filtering when the valid set is empty.

---

### 4.6 traceRequirements(classifiedFiles, tasksPath, reqSpecPath, projectRoot)

**Traces to:** FR-003
**Complexity:** HIGH (4-level fallback chain with early exit per file)

```javascript
/**
 * Map each changed file to FR-NNN and AC-NNN-NN identifiers using a
 * prioritized source chain with early exit per file.
 *
 * Priority order:
 *   1. tasks.md trace annotations (primary)
 *   2. Commit messages (fallback)
 *   3. Code comments (last resort)
 *   4. Mark as untraced
 *
 * @param {ClassifiedFile[]} classifiedFiles - Files with change types and rationale
 * @param {string} tasksPath - Absolute path to docs/isdlc/tasks.md
 * @param {string} reqSpecPath - Absolute path to requirements-spec.md
 * @param {string} projectRoot - Absolute path to project root
 * @returns {TracedFile[]} Files with tracing data attached
 */
function traceRequirements(classifiedFiles, tasksPath, reqSpecPath, projectRoot) { ... }
```

**Algorithm:**

```
1. validReqs = extractValidRequirements(reqSpecPath)
2. tracedMap = new Map()   // path -> { tracedRequirements, tracingSource }

3. // Level 1: tasks.md trace annotations
   untracedFiles = [...classifiedFiles]
   IF fs.existsSync(tasksPath):
     taskLines = readFileSync(tasksPath, 'utf8').split('\n')
     FOR EACH line matching /\| traces:\s*(.+)/:
       Extract comma-separated FR-NNN / AC-NNN-NN identifiers
       Extract context from line (task subject, file references)
       FOR EACH file in untracedFiles:
         IF file.path appears in or is contextually related to the task line:
           tracedMap.set(file.path, {
             tracedRequirements: filterByValidSet(extractedIds, validReqs),
             tracingSource: 'tasks.md'
           })
     Remove traced files from untracedFiles

4. // Level 2: commit messages
   FOR EACH file in untracedFiles:
     TRY:
       log = execSync('git log --format="%s" -- <file.path>', opts)
       matches = log.match(REQ_PATTERN)
       IF matches && matches.length > 0:
         tracedMap.set(file.path, {
           tracedRequirements: filterByValidSet(unique(matches), validReqs),
           tracingSource: 'commit'
         })
     CATCH: continue (file stays untraced)
   Remove newly traced files from untracedFiles

5. // Level 3: code comments
   FOR EACH file in untracedFiles:
     IF file.changeType === 'deleted': continue (can't read deleted files)
     filePath = path.join(projectRoot, file.path)
     IF NOT fs.existsSync(filePath): continue
     stat = fs.statSync(filePath)
     IF stat.size > MAX_CODE_SCAN_SIZE: continue
     TRY:
       content = fs.readFileSync(filePath, 'utf8')
       IF containsNullBytes(content.slice(0, 8192)): continue  // binary
       matches = content.match(REQ_PATTERN)
       IF matches && matches.length > 0:
         tracedMap.set(file.path, {
           tracedRequirements: filterByValidSet(unique(matches), validReqs),
           tracingSource: 'code-comment'
         })
     CATCH: continue

6. // Level 4: mark remaining as untraced
   FOR EACH file in untracedFiles:
     IF NOT tracedMap.has(file.path):
       tracedMap.set(file.path, {
         tracedRequirements: [],
         tracingSource: 'untraced'
       })

7. // Merge tracing data into classified files
   RETURN classifiedFiles.map(f => ({
     ...f,
     tracedRequirements: tracedMap.get(f.path)?.tracedRequirements || [],
     tracingSource: tracedMap.get(f.path)?.tracingSource || 'untraced'
   }))
```

**Helper: filterByValidSet(ids, validReqs)**

```javascript
/**
 * Filter requirement IDs against the valid set.
 * If validReqs is empty (requirements-spec.md missing), accept all IDs.
 *
 * @param {string[]} ids - Extracted requirement IDs
 * @param {Set<string>} validReqs - Valid requirement IDs from requirements-spec.md
 * @returns {string[]} Filtered and deduplicated IDs
 */
function filterByValidSet(ids, validReqs) {
    if (validReqs.size === 0) return [...new Set(ids)];
    return [...new Set(ids)].filter(id => validReqs.has(id));
}
```

**Helper: containsNullBytes(buffer)**

```javascript
/**
 * Check if a string slice contains null bytes (binary file indicator).
 *
 * @param {string} slice - First 8KB of file content
 * @returns {boolean} True if null bytes found
 */
function containsNullBytes(slice) {
    return slice.includes('\0');
}
```

**tasks.md matching heuristic (Level 1):**

The tasks.md trace annotation format is: `- [X] T0005 Create module design (...) | traces: FR-001, FR-002`

For matching files to task lines, use this heuristic:
1. Check if the task line contains a `files:` sub-line referencing the file path
2. Check if the file path appears literally in the task subject or description
3. If neither matches, the file is not traced from this task line

This is intentionally conservative. Files that cannot be matched to a specific task line fall through to Level 2 (commit messages), which provides broader coverage at lower precision.

**Error handling:** The entire function is wrapped in try/catch in main(). Additionally, each level handles its own errors internally (individual file failures do not affect other files). If the entire function throws, main() marks all files as untraced with a warning.

---

### 4.7 extractTestResults(state)

**Traces to:** FR-004
**Complexity:** LOW

```javascript
/**
 * Extract test pass/fail counts and coverage from state.json phase 06 data.
 *
 * @param {Object|null} state - Parsed state.json object (from readState())
 * @returns {TestResults|null} Test data, or null if unavailable
 *
 * State.json path:
 *   state.phases["06-implementation"].iteration_requirements.test_iteration
 *   Fields read: tests_passing (boolean), coverage_percent (number)
 *
 * Also checks the phase summary string for explicit pass/fail counts if
 * the structured fields are not available.
 */
function extractTestResults(state) { ... }
```

**Algorithm:**
1. If `state` is null, return null
2. Navigate to `state.phases?.['06-implementation']`
3. If phase data is missing, return null
4. Try to read `phase.iteration_requirements?.test_iteration`:
   - Extract `tests_passing` (boolean)
   - Extract `coverage_percent` (number)
5. Try to read pass/fail counts from phase summary or test iteration data
6. Construct TestResults object:
   ```javascript
   {
     total: passing + failing,  // derived
     passing: parsedPassing || 0,
     failing: parsedFailing || 0,
     coveragePercent: coverage || null
   }
   ```
7. If no usable data found at any path, return null

**Error handling:** Return null on any error. The caller records a "test results unavailable" warning.

---

### 4.8 buildSummaryData(diffResult, tracedFiles, testResults, context, warnings)

**Traces to:** FR-005, FR-006
**Complexity:** LOW

```javascript
/**
 * Assemble all collected data into the unified SummaryData structure.
 * This is the single source of truth for both output renderers.
 *
 * @param {DiffResult|null} diffResult - Git diff data
 * @param {TracedFile[]} tracedFiles - Files with tracing data
 * @param {TestResults|null} testResults - Test execution data
 * @param {{
 *   workflowSlug: string,
 *   baseBranch: string,
 *   artifactFolder: string
 * }} context - Workflow context from loadProjectContext()
 * @param {string[]} warnings - Accumulated warnings from previous steps
 * @returns {SummaryData} Unified summary data
 */
function buildSummaryData(diffResult, tracedFiles, testResults, context, warnings) { ... }
```

**Algorithm:**
1. Count files by changeType:
   ```javascript
   const filesModified = tracedFiles.filter(f => f.changeType === 'modified').length;
   const filesAdded = tracedFiles.filter(f => f.changeType === 'added').length;
   const filesDeleted = tracedFiles.filter(f => f.changeType === 'deleted').length;
   const filesRenamed = tracedFiles.filter(f => f.changeType === 'renamed').length;
   ```
2. Count tracing:
   ```javascript
   const traced = tracedFiles.filter(f => f.tracingSource !== 'untraced').length;
   const untraced = tracedFiles.filter(f => f.tracingSource === 'untraced').length;
   ```
3. Assemble SummaryData object with all computed values
4. Return the object

**Error handling:** This function operates on already-validated data. No external I/O. No failure modes beyond programming errors (caught by top-level try/catch).

---

### 4.9 renderMarkdown(summaryData, outputPath)

**Traces to:** FR-005
**Complexity:** MEDIUM

```javascript
/**
 * Render the SummaryData as a human-readable markdown file.
 *
 * @param {SummaryData} summaryData - Assembled summary data
 * @param {string} outputPath - Absolute path to write change-summary.md
 * @returns {string|null} Path written, or null on write failure
 */
function renderMarkdown(summaryData, outputPath) { ... }
```

**Markdown template:**

```markdown
# Change Summary

**Generated:** {generatedAt}
**Workflow:** {workflowSlug}
**Branch:** {baseBranch} <- HEAD
**Base commit:** {baseCommit}
**Head commit:** {headCommit}

---

## Metrics

| Metric | Count |
|--------|-------|
| Files modified | {filesModified} |
| Files added | {filesAdded} |
| Files deleted | {filesDeleted} |
| Files renamed | {filesRenamed} |
| **Total changed** | **{totalFilesChanged}** |
| Requirements traced | {requirementsTraced} |
| Requirements untraced | {requirementsUntraced} |

---

## Changed Files

| File | Type | Rationale | Traced Requirements | Source |
|------|------|-----------|-------------------|--------|
| `{path}` | {changeType} | {rationale} | {tracedRequirements.join(', ') || 'N/A'} | {tracingSource} |
| ... | ... | ... | ... | ... |

---

## Test Results

| Metric | Value |
|--------|-------|
| Total tests | {total} |
| Passing | {passing} |
| Failing | {failing} |
| Coverage | {coveragePercent}% |

_(Section omitted if test results unavailable)_

---

## Warnings

- {warning1}
- {warning2}

_(Section omitted if no warnings)_
```

**Algorithm:**
1. Build the metrics header section
2. Build the changed files table by iterating `summaryData.files`
3. Conditionally build the test results section (only if `summaryData.testResults !== null`)
4. Conditionally build the warnings section (only if `summaryData.warnings.length > 0`)
5. Join all sections with `\n---\n\n`
6. Write to `outputPath` using `fs.writeFileSync(outputPath, content, 'utf8')`
7. Return `outputPath` on success

**Error handling:** If `fs.writeFileSync` throws (disk full, permissions), return null. The caller records a warning.

---

### 4.10 renderJson(summaryData, outputPath)

**Traces to:** FR-006
**Complexity:** LOW

```javascript
/**
 * Render the SummaryData as a machine-readable JSON file (schema v1.0).
 *
 * @param {SummaryData} summaryData - Assembled summary data
 * @param {string} outputPath - Absolute path to write change-summary.json
 * @returns {string|null} Path written, or null on write failure
 *
 * Output conforms to the schema specified in Section 10 of
 * architecture-overview.md. schema_version is always '1.0'.
 */
function renderJson(summaryData, outputPath) { ... }
```

**Algorithm:**
1. Transform SummaryData into the JSON schema shape:
   ```javascript
   const jsonData = {
       schema_version: SCHEMA_VERSION,
       generated_at: summaryData.generatedAt,
       workflow_slug: summaryData.workflowSlug,
       base_branch: summaryData.baseBranch,
       base_commit: summaryData.baseCommit,
       head_commit: summaryData.headCommit,
       summary: {
           files_modified: summaryData.summary.filesModified,
           files_added: summaryData.summary.filesAdded,
           files_deleted: summaryData.summary.filesDeleted,
           files_renamed: summaryData.summary.filesRenamed,
           total_files_changed: summaryData.summary.totalFilesChanged,
           requirements_traced: summaryData.summary.requirementsTraced,
           requirements_untraced: summaryData.summary.requirementsUntraced,
           tests_passing: summaryData.testResults?.passing === summaryData.testResults?.total || null,
           test_count: summaryData.testResults?.total || null,
           coverage_percent: summaryData.testResults?.coveragePercent || null
       },
       files: summaryData.files.map(f => ({
           path: f.path,
           change_type: f.changeType,
           old_path: f.oldPath || null,
           rationale: f.rationale,
           traced_requirements: f.tracedRequirements,
           tracing_source: f.tracingSource
       })),
       test_results: summaryData.testResults ? {
           total: summaryData.testResults.total,
           passing: summaryData.testResults.passing,
           failing: summaryData.testResults.failing,
           coverage_percent: summaryData.testResults.coveragePercent
       } : null,
       warnings: summaryData.warnings
   };
   ```
2. Serialize with `JSON.stringify(jsonData, null, 2)`
3. Write to `outputPath` using `fs.writeFileSync(outputPath, serialized, 'utf8')`
4. Return `outputPath` on success

**JSON field naming convention:** The JSON output uses `snake_case` to match the established state.json and change-summary.json schema convention (Section 10 of architecture-overview.md). The internal SummaryData uses `camelCase` (JavaScript convention). The mapping is explicit in step 1.

**Error handling:** If write fails, return null. The caller records a warning.

---

### 4.11 writeOutputs(summaryData, folderAbsolute, projectRoot)

**Traces to:** FR-005, FR-006
**Complexity:** LOW

```javascript
/**
 * Write both output artifacts (change-summary.md and change-summary.json).
 * Each write is independent -- if one fails, the other still proceeds.
 *
 * @param {SummaryData} summaryData - Assembled summary data
 * @param {string} folderAbsolute - Absolute path to requirement artifact folder
 * @param {string} projectRoot - Absolute path to project root
 * @returns {{ mdPath: string|null, jsonPath: string|null }}
 */
function writeOutputs(summaryData, folderAbsolute, projectRoot) { ... }
```

**Algorithm:**
1. Compute output paths:
   - `mdPath = path.join(folderAbsolute, 'change-summary.md')`
   - `jsonPath = path.join(projectRoot, '.isdlc', 'change-summary.json')`
2. Call `renderMarkdown(summaryData, mdPath)` wrapped in try/catch
3. Call `renderJson(summaryData, jsonPath)` wrapped in try/catch
4. Return `{ mdPath, jsonPath }` (either may be null on failure)

**Error handling:** Each render call is independent. If markdown write fails, JSON write still proceeds and vice versa. This implements section-independent degradation (ADR-0003).

---

### 4.12 displayInlineBrief(summaryData)

**Traces to:** FR-005, FR-008
**Complexity:** LOW

```javascript
/**
 * Print a brief summary table to stdout for the phase-loop controller
 * to display inline after phase 06 completes.
 *
 * This is NOT part of the StdoutResult JSON. It is printed before the
 * JSON result line. The phase-loop controller captures the last line
 * of stdout as the JSON result.
 *
 * NOTE: This function does NOT print to stdout. It returns a string
 * that main() includes in the StdoutResult for the phase-loop to
 * display. The phase-loop controller handles the actual display.
 *
 * @param {SummaryData} summaryData - Assembled summary data
 * @returns {void}
 */
function displayInlineBrief(summaryData) { ... }
```

**Decision:** On reflection, inline display is the phase-loop controller's responsibility, not the generator's. The generator's stdout contract is JSON only (Section 4.2 of architecture-overview.md). The phase-loop reads `change-summary.md` after receiving the JSON result and displays the metrics header. Therefore, `displayInlineBrief` is a no-op in the generator. It exists as a named pipeline stage for documentation completeness but does not produce output.

---

### 4.13 main()

**Traces to:** All FRs
**Complexity:** MEDIUM (orchestration, but each step is simple)

```javascript
/**
 * Entry point. Orchestrates the 12-step pipeline with section-independent
 * graceful degradation (ADR-0003).
 *
 * Exit codes:
 *   0 - Success (full or degraded)
 *   2 - Hard error (missing --folder argument)
 *
 * Stdout: JSON StdoutResult (always valid JSON, even on error)
 */
function main() { ... }
```

**Algorithm (with degradation wrappers):**

```javascript
function main() {
    try {
        // Step 1: Parse args
        const args = parseArgs();
        if (!args.folder) {
            console.log(JSON.stringify({ result: 'ERROR', message: 'Missing --folder argument' }));
            process.exit(2);
        }

        const warnings = [];

        // Step 2: Load project context
        const context = loadProjectContext(args.folder);

        // Step 3: Collect git diff
        let diffResult = null;
        try {
            diffResult = collectGitDiff(context.projectRoot, context.baseBranch);
            if (!diffResult) {
                warnings.push('git diff unavailable -- no file data collected');
            }
        } catch (e) {
            diffResult = null;
            warnings.push(`git diff failed: ${e.message}`);
        }

        // Step 4: Classify files
        let classifiedFiles = [];
        try {
            if (diffResult && diffResult.entries.length > 0) {
                classifiedFiles = classifyFiles(diffResult.entries, context.projectRoot);
            }
        } catch (e) {
            classifiedFiles = [];
            warnings.push(`file classification failed: ${e.message}`);
        }

        // Step 5: Generate rationale (handled within classifyFiles)
        // Rationale extraction is part of classifyFiles, not a separate step.
        // The 12-function pipeline in the requirements names it separately for
        // conceptual clarity, but the implementation merges it into classifyFiles.

        // Step 6: Trace requirements
        let tracedFiles = classifiedFiles.map(f => ({
            ...f,
            tracedRequirements: [],
            tracingSource: 'untraced'
        }));
        try {
            if (classifiedFiles.length > 0) {
                tracedFiles = traceRequirements(
                    classifiedFiles,
                    context.tasksPath,
                    context.reqSpecPath,
                    context.projectRoot
                );
            }
        } catch (e) {
            warnings.push(`requirement tracing failed: ${e.message}`);
        }

        // Step 7: Extract test results
        let testResults = null;
        try {
            testResults = extractTestResults(context.state);
            if (!testResults) {
                warnings.push('test results unavailable from state.json');
            }
        } catch (e) {
            testResults = null;
            warnings.push(`test results extraction failed: ${e.message}`);
        }

        // Step 8: Build summary data
        const summaryData = buildSummaryData(
            diffResult, tracedFiles, testResults, context, warnings
        );

        // Steps 9-11: Write outputs
        const outputs = writeOutputs(
            summaryData, context.folderAbsolute, context.projectRoot
        );
        if (!outputs.mdPath) {
            warnings.push('change-summary.md write failed');
        }
        if (!outputs.jsonPath) {
            warnings.push('change-summary.json write failed');
        }

        // Step 12: Display inline brief (no-op; phase-loop handles display)
        displayInlineBrief(summaryData);

        // Stdout result
        const result = {
            result: 'OK',
            files_changed: summaryData.summary.totalFilesChanged,
            files_traced: summaryData.summary.requirementsTraced,
            files_untraced: summaryData.summary.requirementsUntraced,
            md_path: outputs.mdPath
                ? path.relative(context.projectRoot, outputs.mdPath)
                : null,
            json_path: outputs.jsonPath
                ? path.relative(context.projectRoot, outputs.jsonPath)
                : null,
            warnings: summaryData.warnings
        };

        console.log(JSON.stringify(result, null, 2));
        process.exit(0);

    } catch (error) {
        // Top-level catch: handles loadProjectContext() throws and
        // any unexpected errors. Always emits valid JSON.
        console.log(JSON.stringify({
            result: 'ERROR',
            message: error.message
        }, null, 2));
        process.exit(2);
    }
}

main();
```

---

## 5. Data Flow Specification

### 5.1 End-to-End Pipeline

```
process.argv
    |
    v
parseArgs() -----> { folder } or EXIT 2
    |
    v
loadProjectContext(folder) -----> context { projectRoot, state, baseBranch, ... }
    |                                        or THROW (missing folder)
    v
collectGitDiff(projectRoot, baseBranch) -----> DiffResult | null
    |                                          + warning if null
    v
classifyFiles(entries, projectRoot) -----> ClassifiedFile[]
    |                                      (includes rationale from git log)
    v
traceRequirements(classifiedFiles, tasksPath, reqSpecPath, projectRoot)
    |   |-- Level 1: tasks.md trace annotations (early exit per file)
    |   |-- Level 2: commit messages (untraced files only)
    |   |-- Level 3: code comments (still-untraced files only)
    |   |-- Level 4: mark remaining as 'untraced'
    |   v
    +-----> TracedFile[]
    |
    v
extractTestResults(state) -----> TestResults | null
    |                             + warning if null
    v
buildSummaryData(diffResult, tracedFiles, testResults, context, warnings)
    |
    +-----> SummaryData (single source of truth)
    |
    +---> renderMarkdown(summaryData, mdPath) -----> change-summary.md
    |                                                 | null + warning
    +---> renderJson(summaryData, jsonPath) ---------> change-summary.json
    |                                                 | null + warning
    +---> displayInlineBrief(summaryData) -----------> (no-op)
    |
    v
console.log(JSON.stringify(StdoutResult))
process.exit(0)
```

### 5.2 Data Provenance Map

Each field in the output artifacts traces back to a specific data source:

| Output Field | Source | Function |
|-------------|--------|----------|
| `schema_version` | Constant `SCHEMA_VERSION` | renderJson |
| `generated_at` | `new Date().toISOString()` | buildSummaryData |
| `workflow_slug` | `state.active_workflow.slug` | loadProjectContext |
| `base_branch` | `state.active_workflow.base_branch` | loadProjectContext |
| `base_commit` | `git merge-base HEAD <base>` | collectGitDiff |
| `head_commit` | `git rev-parse HEAD` | collectGitDiff |
| `summary.*` | Computed from `tracedFiles` array | buildSummaryData |
| `files[].path` | `git diff --name-status` output | collectGitDiff |
| `files[].change_type` | Status letter mapping | classifyFiles |
| `files[].old_path` | `git diff --name-status` rename line | collectGitDiff |
| `files[].rationale` | `git log --format="%s"` per file | classifyFiles |
| `files[].traced_requirements` | tasks.md / commits / code / untraced | traceRequirements |
| `files[].tracing_source` | Which tracing level matched | traceRequirements |
| `test_results.*` | `state.phases["06-implementation"]` | extractTestResults |
| `warnings` | Accumulated from all try/catch blocks | main |

---

## 6. Error Handling Design

### 6.1 Error Categories

| Category | Handling | Exit Code | Example |
|----------|----------|-----------|---------|
| **Hard error** | Emit ERROR JSON, exit immediately | 2 | Missing `--folder` argument; folder does not exist |
| **Degraded operation** | Record warning, continue pipeline | 0 | Git unavailable; tasks.md missing; state.json corrupt |
| **Per-file failure** | Skip file, continue with others | 0 | git log timeout for one file; unreadable file content |
| **Output write failure** | Record warning, other output may succeed | 0 | Disk full; permission denied on one output path |
| **Unexpected error** | Top-level catch, emit ERROR JSON | 2 | Programming error (should not happen in production) |

### 6.2 Degradation Behavior Matrix

| Scenario | Git Data | File List | Tracing | Tests | MD Output | JSON Output |
|----------|----------|-----------|---------|-------|-----------|-------------|
| All systems operational | Full | Full | Full | Full | Full | Full |
| Git unavailable | EMPTY | EMPTY | N/A | Full | Minimal | Minimal |
| Not on feature branch (no merge-base) | EMPTY | EMPTY | N/A | Full | Minimal | Minimal |
| tasks.md missing | Full | Full | Fallback to commits | Full | Full | Full |
| tasks.md + no FR refs in commits | Full | Full | Fallback to code | Full | Full | Full |
| requirements-spec.md missing | Full | Full | Unfiltered IDs | Full | Full | Full |
| state.json missing/corrupt | Full | Full | Full | OMITTED | Partial | Partial |
| Phase 06 data missing in state | Full | Full | Full | OMITTED | Partial | Partial |
| Single file read error | Full | Full | Partial | Full | Full | Full |
| MD write failure | Full | Full | Full | Full | FAILED | Full |
| JSON write failure | Full | Full | Full | Full | Full | FAILED |

### 6.3 Warning Message Catalog

Each degradation scenario produces a specific, actionable warning message:

| Warning | Trigger | Guidance |
|---------|---------|----------|
| `"git diff unavailable -- no file data collected"` | collectGitDiff returns null | Verify this is a git repository with a valid base branch |
| `"git diff failed: {message}"` | collectGitDiff throws | Check git CLI availability and repo state |
| `"file classification failed: {message}"` | classifyFiles throws | Unexpected; file an issue |
| `"requirement tracing failed: {message}"` | traceRequirements throws | Check tasks.md and requirements-spec.md format |
| `"test results unavailable from state.json"` | extractTestResults returns null | Phase 06 may not have recorded test data |
| `"test results extraction failed: {message}"` | extractTestResults throws | state.json may have unexpected schema |
| `"change-summary.md write failed"` | renderMarkdown returns null | Check filesystem permissions |
| `"change-summary.json write failed"` | renderJson returns null | Check .isdlc/ directory permissions |

---

## 7. Module: isdlc.md Integration (MODIFY)

**File:** `src/claude/commands/isdlc.md`
**Change Type:** Additive (~15-20 lines)
**Traces to:** FR-008, ADR-0006

### 7.1 Integration Point

Add a new step `3e-summary` after `3e-refine` and before `3f` in the phase-loop controller. This follows the established pattern of conditional post-phase steps (3e-sizing fires after phase 02, 3e-refine fires after phase 04).

### 7.2 Step Specification

```markdown
**3e-summary.** CHANGE SUMMARY GENERATION (conditional) -- After the post-phase
state update, generate a structured change summary if phase 06 just completed.

**Trigger check**:
1. Read the phase key that was just completed from the state update in 3e
2. If `phase_key === '06-implementation'`:
   a. Read `active_workflow.artifact_folder` from state.json
   b. Execute:
      node src/antigravity/change-summary-generator.cjs \
        --folder "docs/requirements/{artifact_folder}"
   c. Parse JSON output from stdout
   d. If result === "OK":
      - Read the first 20 lines of change-summary.md from the artifact folder
      - Display the metrics table inline as a brief summary
   e. If result === "ERROR" or execution fails:
      - Display warning: "Change summary generation failed: {message}"
      - Continue to 3f (non-blocking per FR-007)
3. Otherwise (not phase 06): skip to 3f
```

### 7.3 Non-Blocking Guarantee

The phase-loop MUST wrap the `3e-summary` execution in a try/catch equivalent. If the generator script fails, throws, or times out (30s), the phase-loop continues to step 3f. The change summary is observability, not a gate. This aligns with:
- Article X (fail-safe defaults)
- FR-007 (graceful degradation)
- NFR-003 (generator never blocks workflow)

---

## 8. Cross-Platform Considerations

### 8.1 Path Normalization

| Context | Convention | Implementation |
|---------|-----------|----------------|
| Internal data structures | Forward slashes | Git always outputs `/`; store as-is |
| Filesystem operations | OS-native | Use `path.join()` for all reads/writes |
| Output artifacts (MD, JSON) | Forward slashes | Use `f.path` from git output (already `/`) |
| `--folder` CLI argument | Either | `path.resolve()` normalizes input |

### 8.2 Binary File Detection

Binary files are detected by checking for null bytes (`\0`) in the first 8KB of file content. This is the same heuristic used by git itself. Binary files are skipped during Level 3 code comment scanning only -- they still appear in the file list with their git-derived change type and rationale.

---

## 9. Traceability Matrix

| Function | FR | AC | NFR | CON | ADR |
|----------|-----|-----|------|------|------|
| parseArgs | FR-008 | | | CON-001 | ADR-0001 |
| loadProjectContext | FR-001, FR-003, FR-004, FR-008 | | NFR-009 | CON-001, CON-003 | ADR-0001, ADR-0004 |
| collectGitDiff | FR-001 | | NFR-001, NFR-007 | | ADR-0001 |
| classifyFiles | FR-002 | | NFR-001 | | |
| extractValidRequirements | FR-003 | | | | |
| traceRequirements | FR-003 | | | | |
| extractTestResults | FR-004 | | NFR-010 | CON-003 | ADR-0004 |
| buildSummaryData | FR-005, FR-006 | | | | ADR-0005 |
| renderMarkdown | FR-005 | | NFR-011 | | ADR-0005 |
| renderJson | FR-006 | | NFR-005, NFR-006, NFR-011 | | ADR-0005 |
| writeOutputs | FR-005, FR-006 | | NFR-007 | | ADR-0003, ADR-0005 |
| displayInlineBrief | FR-005, FR-008 | | | | ADR-0006 |
| main | All | All | NFR-002, NFR-003, NFR-004 | CON-004 | ADR-0003, ADR-0006 |
| Degradation wrappers | FR-007 | | NFR-002, NFR-003, NFR-004 | | ADR-0003 |

---

## 10. GATE-04 Validation

### Design Documentation
- [x] Module boundaries defined -- Sections 2-4 (generator), Section 7 (isdlc.md integration)
- [x] All function signatures specified with types -- Section 4 (13 functions)
- [x] Data structures documented with TypeDefs -- Section 3 (6 structures)
- [x] Error handling design complete -- Section 6 (5 categories, 8 scenarios)
- [x] Data flow specification documented -- Section 5 (pipeline + provenance map)

### Interface Specifications
- [x] CLI interface contract (--folder argument, stdout JSON, exit codes) -- Section 4.2 of architecture-overview.md, Section 4.13
- [x] JSON schema v1.0 fully specified -- Section 3.5 (SummaryData), Section 4.10 (renderJson)
- [x] Markdown output template specified -- Section 4.9 (renderMarkdown)

### Traceability
- [x] Every function traces to at least one FR -- Section 9 (traceability matrix)
- [x] All 8 FRs covered by at least one function -- Verified in Section 9
- [x] All 11 NFRs addressed in design -- Performance (4.4), reliability (6.1), schema (4.10), cross-platform (8.1)
- [x] All 5 constraints verified -- CJS (imports), zero deps (imports), read-only state (4.7), single gen (4.13), no hooks (scope)
- [x] All 6 ADRs reflected in design decisions -- Referenced throughout Sections 2-7

### Graceful Degradation
- [x] Section-independent degradation implemented (ADR-0003) -- Section 4.13 (main), Section 6.2
- [x] Warning catalog defined -- Section 6.3
- [x] All degradation scenarios from FR-007 covered -- Section 6.2 matrix (11 scenarios)
- [x] Non-blocking phase-loop integration guaranteed -- Section 7.3

### Design Completeness
- [x] All required design artifacts exist -- module-design.md (this file)
- [x] Module designs have clear responsibilities -- Each function has single FR ownership
- [x] Integration point specified -- Section 7 (isdlc.md step 3e-summary)
- [x] Cross-platform considerations documented -- Section 8

**GATE-04 Result: PASS** -- All required design artifacts exist and are validated.
