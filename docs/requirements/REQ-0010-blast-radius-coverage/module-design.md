# Module Design: blast-radius-validator.cjs

**Version**: 1.0.0
**Date**: 2026-02-12
**Phase**: 04-design
**Traces to**: REQ-001, REQ-002, REQ-005, REQ-006, REQ-007, NFR-001, NFR-002, NFR-005, CON-001, CON-002
**Architecture**: ADR-0001 (standalone dispatcher hook), ADR-0002 (regex parser), ADR-0003 (execSync git diff)

---

## 1. Module Overview

**File**: `src/claude/hooks/blast-radius-validator.cjs`
**Type**: CommonJS (.cjs) hook module
**Size Estimate**: 200-300 lines
**Responsibility**: Validate that implementation branch covers all files identified in impact-analysis.md. Block GATE-06 advancement when unaddressed files exist. Fail-open on all internal errors.

**Pattern**: Follows `test-adequacy-blocker.cjs` structure -- a dispatcher-compatible hook with `check(ctx)` export, `shouldActivate` guard defined in the dispatcher, and standalone execution support via `require.main === module`.

---

## 2. Dependencies

All existing -- zero new dependencies (CON-002).

```javascript
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
    debugLog,
    getProjectRoot,
    getTimestamp,
    logHookEvent
} = require('./lib/common.cjs');
```

| Dependency | Source | Functions Used | Traces to |
|-----------|--------|---------------|-----------|
| `fs` | Node.js builtin | `readFileSync`, `existsSync` | REQ-001, REQ-006 |
| `path` | Node.js builtin | `join` | NFR-005, Article XII |
| `child_process` | Node.js builtin | `execSync` | REQ-001 AC-001-02 |
| `common.cjs` | Existing shared lib | `debugLog`, `getProjectRoot`, `getTimestamp`, `logHookEvent` | CON-002 |

---

## 3. Exported Functions

### 3.1 check(ctx)

**Signature**:
```javascript
/**
 * Dispatcher-compatible check function.
 * Validates blast radius coverage: affected files from impact-analysis.md
 * must be either modified (git diff) or deferred (blast-radius-coverage.md).
 *
 * @param {object} ctx - Dispatcher context
 * @param {object} ctx.input - Parsed stdin JSON (tool call)
 * @param {object} ctx.state - Parsed state.json
 * @param {object} [ctx.manifest] - Skills manifest (unused by this hook)
 * @param {object} [ctx.requirements] - Iteration requirements (unused by this hook)
 * @param {object} [ctx.workflows] - Workflow definitions (unused by this hook)
 * @returns {{ decision: 'allow'|'block', stopReason?: string, stderr?: string, stdout?: string, stateModified: boolean }}
 *
 * Traces to: REQ-001, REQ-002, REQ-005, REQ-007 AC-007-01
 */
function check(ctx) { ... }
```

**Return Contract** (matches all existing hooks):
```javascript
{
    decision: 'allow' | 'block',
    stopReason: string | undefined,  // Human-readable reason (only when block)
    stderr: string | undefined,      // Diagnostic output for dispatcher aggregation
    stdout: string | undefined,      // Reserved (unused by this hook)
    stateModified: false             // This hook never modifies state
}
```

**Implementation Flow** (pseudo-code):

```
check(ctx):
  try:
    // Step 1: Validate context
    if (!ctx.input || !ctx.state) -> return ALLOW (no context)
    if (!ctx.state.active_workflow) -> return ALLOW (no workflow)

    // Step 2: Resolve artifact folder
    artifactFolder = ctx.state.active_workflow.artifact_folder
    if (!artifactFolder) -> return ALLOW (no artifact folder)
    projectRoot = getProjectRoot()

    // Step 3: Read impact-analysis.md
    impactPath = path.join(projectRoot, 'docs', 'requirements', artifactFolder, 'impact-analysis.md')
    if (!fs.existsSync(impactPath)):
        debugLog('blast-radius-validator: impact-analysis.md not found, skipping')
        return ALLOW

    content = fs.readFileSync(impactPath, 'utf8')

    // Step 4: Parse affected files
    affectedFiles = parseImpactAnalysis(content)
    if (affectedFiles === null):
        return ALLOW with stderr: 'blast-radius-validator: parse error in impact-analysis.md'
    if (affectedFiles.length === 0):
        return ALLOW (no affected files to validate)

    // Step 5: Get modified files from git
    modifiedFiles = getModifiedFiles(projectRoot)
    if (modifiedFiles === null):
        return ALLOW with stderr: 'blast-radius-validator: git diff failed, skipping'

    // Step 6: Read blast-radius-coverage.md for deferred files
    coveragePath = path.join(projectRoot, 'docs', 'requirements', artifactFolder, 'blast-radius-coverage.md')
    deferredFiles = new Map()
    if (fs.existsSync(coveragePath)):
        coverageContent = fs.readFileSync(coveragePath, 'utf8')
        deferredFiles = parseBlastRadiusCoverage(coverageContent)

    // Step 7: Build coverage report
    report = buildCoverageReport(affectedFiles, modifiedFiles, deferredFiles)

    // Step 8: Decision
    if (report.unaddressed.length === 0):
        logHookEvent('blast-radius-validator', 'allow', {
            total: report.total,
            covered: report.covered.length,
            deferred: report.deferred.length
        })
        return ALLOW
    else:
        stopReason = formatBlockMessage(report)
        logHookEvent('blast-radius-validator', 'block', {
            total: report.total,
            unaddressed: report.unaddressed.length,
            files: report.unaddressed.map(f => f.filePath)
        })
        return BLOCK with stopReason

  catch (error):
    // Top-level fail-open: any uncaught exception -> allow
    debugLog('blast-radius-validator: unexpected error:', error.message)
    return ALLOW
```

**Key Design Decisions**:
- `stateModified` is always `false` -- this hook is read-only (ADR-0004)
- The top-level try/catch ensures fail-open even for unanticipated errors (Article X)
- No gate advancement detection inside `check()` -- the `shouldActivate` guard in the dispatcher handles activation scope. This mirrors the pattern where `shouldActivate` controls WHEN, `check()` controls WHAT.

---

### 3.2 Module Exports

```javascript
module.exports = {
    check,
    // Exported for unit testing only:
    parseImpactAnalysis,
    parseBlastRadiusCoverage,
    getModifiedFiles,
    buildCoverageReport,
    formatBlockMessage
};
```

Exporting internal functions enables direct unit testing without mocking the entire hook flow. This pattern matches `test-adequacy-blocker.cjs` which exports `isUpgradeDelegation`, `isUpgradeFromPromptText`, `isUpgradePhaseActive`.

---

## 4. Internal Functions

### 4.1 parseImpactAnalysis(content)

**Signature**:
```javascript
/**
 * Parse impact-analysis.md to extract affected file paths and change types.
 * Uses regex-based line-by-line matching on markdown table rows.
 *
 * @param {string} content - Raw markdown content of impact-analysis.md
 * @returns {Array<{ filePath: string, changeType: string }>|null}
 *   Array of affected files (deduplicated, NO CHANGE excluded),
 *   or null on parse error.
 *
 * Traces to: REQ-006 (all ACs), ADR-0002
 */
function parseImpactAnalysis(content) { ... }
```

**Implementation**:

```javascript
// Regex: match markdown table rows with backtick-wrapped file paths
// Captures: group 1 = file path, group 2 = change type
const IMPACT_TABLE_ROW = /^\|\s*`([^`]+)`\s*\|\s*(CREATE|MODIFY|DELETE|NO CHANGE)\s*\|/;

function parseImpactAnalysis(content) {
    if (!content || typeof content !== 'string') return null;

    const seen = new Map();  // filePath -> changeType (dedup across sections)
    const lines = content.split('\n');

    for (const line of lines) {
        const match = line.match(IMPACT_TABLE_ROW);
        if (!match) continue;

        const filePath = match[1].trim();
        const changeType = match[2].trim();

        // AC-006-04: Exclude NO CHANGE entries
        if (changeType === 'NO CHANGE') continue;

        // AC-006-02: Deduplicate (first occurrence wins)
        if (!seen.has(filePath)) {
            seen.set(filePath, changeType);
        }
    }

    // Convert Map to array
    const result = [];
    for (const [filePath, changeType] of seen) {
        result.push({ filePath, changeType });
    }

    return result;
}
```

**Edge Cases** (AC coverage):

| Edge Case | Behavior | AC |
|-----------|----------|-----|
| Content is empty string | Returns `[]` (empty array, not null) | AC-002-02 |
| Content is null/undefined | Returns `null` (parse error) | AC-002-04 |
| No table rows match regex | Returns `[]` | AC-002-02 |
| Same file in multiple FR sections | First occurrence wins (dedup via Map) | AC-006-02 |
| `NO CHANGE` change type | Excluded from result | AC-006-04 |
| Missing backticks on path | Line does not match regex, skipped | AC-006-05 |
| Extra whitespace around delimiters | Handled by `\s*` in regex | AC-006-05 |
| Leading `\|` with no backticks | Does not match, skipped | AC-006-05 |
| Table separator row `\|---\|` | Does not match regex (no backtick), skipped | -- |
| Header row `\| File \| Change Type \|` | Does not match (no backtick path), skipped | -- |

---

### 4.2 parseBlastRadiusCoverage(content)

**Signature**:
```javascript
/**
 * Parse blast-radius-coverage.md to extract deferred files with rationale.
 * Only files with Coverage Status = 'deferred' are returned.
 *
 * @param {string} content - Raw markdown content of blast-radius-coverage.md
 * @returns {Map<string, { status: string, notes: string }>}
 *   Map of filePath -> { status, notes } for deferred files.
 *   Returns empty Map on parse error or missing content.
 *
 * Traces to: REQ-001 AC-001-03, REQ-003 AC-003-04
 */
function parseBlastRadiusCoverage(content) { ... }
```

**Implementation**:

```javascript
// Regex: match blast-radius-coverage.md table rows
// Format: | `path` | CHANGE_TYPE | STATUS | notes... |
// Captures: group 1 = file path, group 2 = coverage status, group 3 = notes
const COVERAGE_TABLE_ROW = /^\|\s*`([^`]+)`\s*\|\s*\w[\w\s]*\|\s*(covered|deferred|unaddressed)\s*\|\s*(.*?)\s*\|$/i;

function parseBlastRadiusCoverage(content) {
    const result = new Map();
    if (!content || typeof content !== 'string') return result;

    const lines = content.split('\n');

    for (const line of lines) {
        const match = line.match(COVERAGE_TABLE_ROW);
        if (!match) continue;

        const filePath = match[1].trim();
        const status = match[2].trim().toLowerCase();
        const notes = match[3].trim();

        if (status === 'deferred' && notes.length > 0) {
            result.set(filePath, { status, notes });
        }
    }

    return result;
}
```

**Design Note**: Only files with `status === 'deferred'` AND non-empty `notes` are considered valid deferrals. A deferred file without rationale is treated as unaddressed (per AC-003-04: mandatory rationale).

---

### 4.3 getModifiedFiles(projectRoot)

**Signature**:
```javascript
/**
 * Run git diff to get files modified on the current branch vs main.
 * Uses synchronous execution with timeout.
 *
 * @param {string} projectRoot - Absolute path to project root
 * @returns {Set<string>|null}
 *   Set of modified file paths (relative to repo root),
 *   or null on git command failure.
 *
 * Traces to: REQ-001 AC-001-02, ADR-0003, NFR-001, NFR-005
 */
function getModifiedFiles(projectRoot) { ... }
```

**Implementation**:

```javascript
function getModifiedFiles(projectRoot) {
    try {
        const result = execSync('git diff --name-only main...HEAD', {
            cwd: projectRoot,
            encoding: 'utf8',
            timeout: 5000,        // 5s timeout (generous, typical < 200ms)
            stdio: ['pipe', 'pipe', 'pipe']  // Suppress stderr from git
        });

        const files = new Set(
            result
                .trim()
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
        );

        return files;
    } catch (error) {
        // Fail-open: git errors should never block
        debugLog('blast-radius-validator: git diff failed:', error.message);
        return null;
    }
}
```

**Error Scenarios**:

| Scenario | Error Type | Return | Traces to |
|----------|-----------|--------|-----------|
| Not a git repo | execSync throws | `null` | NFR-002, Article X |
| No `main` branch | execSync throws | `null` | NFR-002, Article X |
| Detached HEAD | execSync throws | `null` | NFR-002, Article X |
| Timeout (> 5s) | execSync throws ETIMEDOUT | `null` | NFR-001 |
| Empty diff (no changes) | Success | `new Set()` (empty) | Valid state |
| Normal operation | Success | `Set` with file paths | REQ-001 AC-001-02 |

**Cross-Platform Note** (NFR-005): The `git diff --name-only` command outputs forward-slash paths even on Windows. No path normalization is needed for the comparison, since `impact-analysis.md` also uses forward-slash paths. However, if a future edge case arises, we can normalize both sides to forward slashes.

---

### 4.4 buildCoverageReport(affectedFiles, modifiedFiles, deferredFiles)

**Signature**:
```javascript
/**
 * Compare affected files against modified and deferred sets to classify each.
 *
 * @param {Array<{ filePath: string, changeType: string }>} affectedFiles - From parseImpactAnalysis
 * @param {Set<string>} modifiedFiles - From getModifiedFiles (git diff)
 * @param {Map<string, { status: string, notes: string }>} deferredFiles - From parseBlastRadiusCoverage
 * @returns {{ total: number, covered: Array<{filePath, changeType}>, deferred: Array<{filePath, changeType, notes}>, unaddressed: Array<{filePath, changeType}> }}
 *
 * Traces to: REQ-001 AC-001-03
 */
function buildCoverageReport(affectedFiles, modifiedFiles, deferredFiles) { ... }
```

**Implementation**:

```javascript
function buildCoverageReport(affectedFiles, modifiedFiles, deferredFiles) {
    const covered = [];
    const deferred = [];
    const unaddressed = [];

    for (const file of affectedFiles) {
        if (modifiedFiles.has(file.filePath)) {
            // AC-001-03: File appears in git diff -> covered
            covered.push(file);
        } else if (deferredFiles.has(file.filePath)) {
            // AC-001-03: File has deferral rationale -> deferred
            const deferral = deferredFiles.get(file.filePath);
            deferred.push({ ...file, notes: deferral.notes });
        } else {
            // AC-001-03: Neither -> unaddressed
            unaddressed.push(file);
        }
    }

    return {
        total: affectedFiles.length,
        covered,
        deferred,
        unaddressed
    };
}
```

**Classification Priority**: If a file appears in both git diff AND deferred list, it is classified as `covered` (git diff takes precedence). This is the correct behavior because the developer both modified the file and documented it.

---

### 4.5 formatBlockMessage(report)

**Signature**:
```javascript
/**
 * Format a human-readable block message listing unaddressed files.
 *
 * @param {{ total: number, covered: Array, deferred: Array, unaddressed: Array<{filePath, changeType}> }} report
 * @returns {string} Multi-line block message
 *
 * Traces to: REQ-005 AC-005-04
 */
function formatBlockMessage(report) { ... }
```

**Implementation**:

```javascript
function formatBlockMessage(report) {
    const header =
        `BLAST RADIUS COVERAGE INCOMPLETE: ${report.unaddressed.length} of ` +
        `${report.total} affected files are unaddressed.\n`;

    const fileList = report.unaddressed
        .map(f => `  - ${f.filePath} (expected: ${f.changeType})`)
        .join('\n');

    const summary =
        `\nCoverage: ${report.covered.length} covered, ` +
        `${report.deferred.length} deferred, ` +
        `${report.unaddressed.length} unaddressed\n`;

    const guidance =
        `\nTo resolve:\n` +
        `  1. Modify the unaddressed files as indicated by impact analysis, OR\n` +
        `  2. Add deferral rationale for each file in blast-radius-coverage.md:\n` +
        `     | \`file/path\` | CHANGE_TYPE | deferred | Rationale for deferral |\n` +
        `\nGenerate blast-radius-coverage.md with a complete checklist of all ` +
        `${report.total} affected files before advancing.`;

    return header + '\n' + fileList + summary + guidance;
}
```

---

## 5. Standalone Execution Support

Following the pattern from `test-adequacy-blocker.cjs`, the module includes standalone execution when run directly (not via dispatcher):

```javascript
// Standalone execution
if (require.main === module) {
    const {
        readStdin,
        readState,
        loadManifest,
        loadIterationRequirements,
        loadWorkflowDefinitions,
        outputBlockResponse
    } = require('./lib/common.cjs');

    (async () => {
        try {
            const inputStr = await readStdin();
            if (!inputStr || !inputStr.trim()) {
                process.exit(0);
            }
            let input;
            try { input = JSON.parse(inputStr); } catch (e) { process.exit(0); }

            const state = readState();
            const manifest = loadManifest();
            const requirements = loadIterationRequirements();
            const workflows = loadWorkflowDefinitions();
            const ctx = { input, state, manifest, requirements, workflows };

            const result = check(ctx);

            if (result.stderr) {
                console.error(result.stderr);
            }
            if (result.decision === 'block' && result.stopReason) {
                outputBlockResponse(result.stopReason);
            }
            process.exit(0);
        } catch (e) {
            process.exit(0);
        }
    })();
}
```

**Note**: This standalone mode is for debugging and direct testing only. In production, the hook runs via the `pre-task-dispatcher.cjs` dispatcher.

---

## 6. Complete File Structure

```
blast-radius-validator.cjs
  |
  +-- [line 1-10]    File header comment (version, description)
  +-- [line 12-20]   require() imports (fs, path, child_process, common.cjs)
  +-- [line 22-25]   Constants (IMPACT_TABLE_ROW regex, COVERAGE_TABLE_ROW regex)
  +-- [line 27-70]   parseImpactAnalysis(content) -- ~40 lines
  +-- [line 72-100]  parseBlastRadiusCoverage(content) -- ~30 lines
  +-- [line 102-130] getModifiedFiles(projectRoot) -- ~25 lines
  +-- [line 132-165] buildCoverageReport(affected, modified, deferred) -- ~30 lines
  +-- [line 167-195] formatBlockMessage(report) -- ~25 lines
  +-- [line 197-270] check(ctx) -- ~70 lines (main flow with fail-open)
  +-- [line 272-275] module.exports
  +-- [line 277-310] Standalone execution (require.main === module)
```

Estimated total: ~260 lines (within 200-300 estimate from architecture).

---

## 7. Data Structures

### AffectedFile
```javascript
{
    filePath: string,     // e.g., "src/claude/hooks/blast-radius-validator.cjs"
    changeType: string    // "CREATE" | "MODIFY" | "DELETE"
}
```

### DeferralEntry
```javascript
{
    status: "deferred",
    notes: string         // e.g., "Deferred to REQ-0011: not required for MVP"
}
```

### CoverageReport
```javascript
{
    total: number,                                   // Total affected files
    covered: Array<AffectedFile>,                    // In git diff
    deferred: Array<AffectedFile & { notes: string }>, // In coverage.md with rationale
    unaddressed: Array<AffectedFile>                 // Neither
}
```

### HookResult (return value from check)
```javascript
{
    decision: 'allow' | 'block',
    stopReason: string | undefined,
    stderr: string | undefined,
    stdout: string | undefined,
    stateModified: false
}
```

---

## 8. Traceability Matrix

| Function | Requirements | ACs |
|----------|-------------|-----|
| `check(ctx)` | REQ-001, REQ-002, REQ-005, REQ-007 | AC-001-01 through AC-001-06, AC-002-01 through AC-002-04, AC-005-01, AC-005-02, AC-005-03, AC-007-01, AC-007-04 |
| `parseImpactAnalysis(content)` | REQ-006 | AC-006-01 through AC-006-05 |
| `parseBlastRadiusCoverage(content)` | REQ-001, REQ-003 | AC-001-03, AC-003-04 |
| `getModifiedFiles(projectRoot)` | REQ-001 | AC-001-02 |
| `buildCoverageReport(...)` | REQ-001 | AC-001-03, AC-001-04, AC-001-05 |
| `formatBlockMessage(report)` | REQ-005 | AC-005-04 |
| `module.exports` | REQ-007 | AC-007-01 |

---

## 9. Performance Budget (NFR-001)

| Operation | Budget | Expected |
|-----------|--------|----------|
| `fs.existsSync` (2 calls) | < 5ms | < 2ms |
| `fs.readFileSync` (impact-analysis.md) | < 10ms | < 5ms |
| `parseImpactAnalysis` | < 10ms | < 3ms |
| `execSync` (git diff) | < 2000ms | < 200ms |
| `fs.readFileSync` (blast-radius-coverage.md) | < 10ms | < 5ms |
| `parseBlastRadiusCoverage` | < 5ms | < 2ms |
| `buildCoverageReport` | < 5ms | < 1ms |
| `formatBlockMessage` | < 1ms | < 1ms |
| **Total** | **< 2000ms** | **< 220ms** |

The git diff command dominates execution time. The 5-second timeout on execSync provides a safety net well within the 2-second NFR budget under normal conditions.
