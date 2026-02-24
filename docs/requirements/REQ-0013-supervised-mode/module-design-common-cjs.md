# Module Design: common.cjs Supervised Mode Functions

**Version**: 1.0.0
**Phase**: 04-design
**Traces to**: FR-01 (AC-01a through AC-01h), FR-02 (AC-02a through AC-02e), FR-08 (AC-08a through AC-08c)
**ADRs**: ADR-0002, ADR-0003

---

## 1. Module Overview

**File**: `src/claude/hooks/lib/common.cjs`
**Change Type**: MODIFY (additive)
**Estimated Lines Added**: ~160 (4 functions + JSDoc + section header + private helpers)

Four utility functions are added to the existing common.cjs shared library under a new section header. The functions follow the established patterns:
- `readCodeReviewConfig()` pattern: read a config block from state.json, return normalized defaults on any error (fail-open)
- `collectPhaseSnapshots()` pattern: accept a state object, perform operations, return results
- `applySizingDecision()` pattern: mutate state object in place, write to stderr on errors

All functions are synchronous (CommonJS, Article XIII) and exported via `module.exports`.

---

## 2. Section Placement

The new section is inserted between the existing "Sizing Utilities (REQ-0011)" section and the `module.exports` block. The section header:

```javascript
// =========================================================================
// Supervised Mode Utilities (REQ-0013: Supervised Mode)
// =========================================================================
```

Four new entries are added to the `module.exports` object under a comment group:

```javascript
    // Supervised mode (REQ-0013)
    readSupervisedModeConfig,
    shouldReviewPhase,
    generatePhaseSummary,
    recordReviewAction
```

---

## 3. Function 1: readSupervisedModeConfig

### 3.1 Responsibility

Reads and normalizes the `supervised_mode` configuration block from state.json. Returns a validated config object with safe defaults for any missing or invalid fields. This is the single entry point for all supervised mode config access.

**Traces to**: FR-01 (AC-01a, AC-01b, AC-01c, AC-01f), NFR-013-02

### 3.2 JSDoc

```javascript
/**
 * Read and normalize supervised_mode configuration from state.json.
 *
 * Follows the readCodeReviewConfig() fail-open pattern:
 * - Missing supervised_mode block: returns { enabled: false }
 * - Invalid or corrupt block: returns { enabled: false }
 * - Invalid field values: replaced with safe defaults
 *
 * @param {object} state - Parsed state.json content (already loaded by caller)
 * @returns {{ enabled: boolean, review_phases: 'all'|string[], parallel_summary: boolean, auto_advance_timeout: number|null }}
 */
```

### 3.3 Pseudo-code

```javascript
function readSupervisedModeConfig(state) {
    // Guard: no state or no supervised_mode block
    if (!state || typeof state !== 'object') {
        return { enabled: false, review_phases: 'all', parallel_summary: true, auto_advance_timeout: null };
    }

    const sm = state.supervised_mode;

    // Guard: supervised_mode missing or not an object
    if (!sm || typeof sm !== 'object' || Array.isArray(sm)) {
        return { enabled: false, review_phases: 'all', parallel_summary: true, auto_advance_timeout: null };
    }

    // Normalize enabled (must be boolean true to enable)
    const enabled = sm.enabled === true;

    // Normalize review_phases
    let review_phases = 'all';
    if (sm.review_phases === 'all') {
        review_phases = 'all';
    } else if (Array.isArray(sm.review_phases)) {
        // Filter to valid phase number strings (2-digit prefixes like "01", "03", "06")
        review_phases = sm.review_phases.filter(
            p => typeof p === 'string' && /^\d{2}$/.test(p)
        );
        // If all entries were invalid, fall back to 'all'
        if (review_phases.length === 0) {
            review_phases = 'all';
        }
    }
    // Any other type: default to 'all'

    // Normalize parallel_summary (default true)
    const parallel_summary = typeof sm.parallel_summary === 'boolean'
        ? sm.parallel_summary
        : true;

    // auto_advance_timeout: reserved, not implemented (always null)
    const auto_advance_timeout = null;

    return { enabled, review_phases, parallel_summary, auto_advance_timeout };
}
```

### 3.4 Validation Rules

| Field | Type Check | Invalid Value Handling | Default |
|-------|-----------|----------------------|---------|
| `supervised_mode` | object (not array) | Return `{ enabled: false }` | N/A |
| `enabled` | boolean | Treat as `false` | `false` |
| `review_phases` | `"all"` or `string[]` | Treat as `"all"` | `"all"` |
| `review_phases[i]` | string matching `/^\d{2}$/` | Silently filter out | N/A |
| `parallel_summary` | boolean | Treat as `true` | `true` |
| `auto_advance_timeout` | ignored | Always `null` | `null` |

### 3.5 Error Handling

No exceptions thrown. All error paths return the safe default object `{ enabled: false, review_phases: 'all', parallel_summary: true, auto_advance_timeout: null }`. This ensures fail-open behavior per Article X and NFR-013-02.

---

## 4. Function 2: shouldReviewPhase

### 4.1 Responsibility

Determines whether a given phase should trigger a supervised review gate based on the normalized config. Pure function with no side effects.

**Traces to**: FR-01 (AC-01d, AC-01e, AC-01f), FR-03 (AC-03e, AC-03f)

### 4.2 JSDoc

```javascript
/**
 * Determine if a review gate should fire for the given phase.
 *
 * @param {{ enabled: boolean, review_phases: 'all'|string[] }} config - Normalized config from readSupervisedModeConfig()
 * @param {string} phaseKey - Phase key (e.g., '03-architecture', '04-design')
 * @returns {boolean} True if review gate should fire
 */
```

### 4.3 Pseudo-code

```javascript
function shouldReviewPhase(config, phaseKey) {
    // Guard: config not valid or not enabled
    if (!config || config.enabled !== true) {
        return false;
    }

    // Guard: invalid phase key
    if (!phaseKey || typeof phaseKey !== 'string') {
        return false;
    }

    // review_phases = 'all' means every phase triggers review
    if (config.review_phases === 'all') {
        return true;
    }

    // review_phases is an array of 2-digit phase prefixes
    if (Array.isArray(config.review_phases)) {
        // Extract the 2-digit prefix from phaseKey (e.g., '03' from '03-architecture')
        const phaseNumber = phaseKey.split('-')[0];
        return config.review_phases.includes(phaseNumber);
    }

    // Unexpected review_phases type: fail-open (no review)
    return false;
}
```

### 4.4 Examples

| config.review_phases | phaseKey | Result |
|---------------------|----------|--------|
| `"all"` | `"03-architecture"` | `true` |
| `"all"` | `"06-implementation"` | `true` |
| `["03", "04", "06"]` | `"03-architecture"` | `true` |
| `["03", "04", "06"]` | `"05-test-strategy"` | `false` |
| `["03", "04", "06"]` | `"06-implementation"` | `true` |
| `["03"]` | `"16-quality-loop"` | `false` |
| `[]` (empty after filter) | any | `false` (readSupervisedModeConfig normalizes to `"all"`) |

---

## 5. Function 3: generatePhaseSummary

### 5.1 Responsibility

Generates a structured markdown summary of a completed phase and writes it to `.isdlc/reviews/phase-{NN}-summary.md`. Returns the file path on success or `null` on failure. Fail-safe: never throws.

**Traces to**: FR-02 (AC-02a through AC-02e), NFR-013-03, NFR-013-06

### 5.2 JSDoc

```javascript
/**
 * Generate a phase summary markdown file after phase completion.
 *
 * Output: .isdlc/reviews/phase-{NN}-summary.md
 * Overwrites any existing summary for the same phase (redo support).
 *
 * @param {object} state - Parsed state.json content
 * @param {string} phaseKey - Phase key (e.g., '03-architecture')
 * @param {string} projectRoot - Absolute path to project root
 * @param {{ minimal?: boolean }} [options={}] - Options
 *   - minimal: If true, generate minimal summary (no diffs, no decisions)
 * @returns {string|null} Absolute path to generated summary file, or null on failure
 */
```

### 5.3 Pseudo-code

```javascript
function generatePhaseSummary(state, phaseKey, projectRoot, options = {}) {
    try {
        // --- Extract phase metadata from state ---
        const phaseData = state?.phases?.[phaseKey] || {};
        const phaseNumber = phaseKey.split('-')[0];               // '03'
        const phaseName = _resolvePhaseDisplayName(phaseKey);     // 'Architecture'

        // Duration calculation
        const started = phaseData.started || null;
        const completed = phaseData.completed || null;
        let durationStr = 'N/A';
        if (started && completed) {
            const ms = new Date(completed) - new Date(started);
            const minutes = Math.round(ms / 60000);
            durationStr = `${minutes}m`;
        }

        // Artifact list from phase state
        const artifacts = Array.isArray(phaseData.artifacts)
            ? phaseData.artifacts
            : [];

        // Summary text from phase state
        const summaryText = phaseData.summary || 'No summary available';

        // --- Build markdown ---
        let md = '';
        md += `# Phase ${phaseNumber} Summary: ${phaseName}\n\n`;
        md += `**Status**: Completed\n`;
        md += `**Duration**: ${durationStr}`;
        if (started && completed) {
            md += ` (${started} to ${completed})`;
        }
        md += `\n`;
        md += `**Artifacts**: ${artifacts.length} files\n\n`;

        // Key decisions (full summary only)
        if (!options.minimal) {
            md += `## Key Decisions\n`;
            const decisions = _extractDecisions(summaryText);
            if (decisions.length === 0) {
                md += `- ${summaryText}\n`;
            } else {
                for (const d of decisions) {
                    md += `- ${d}\n`;
                }
            }
            md += `\n`;
        }

        // Artifacts table
        md += `## Artifacts Created/Modified\n`;
        if (artifacts.length === 0) {
            md += `No file changes recorded in phase state.\n`;
        } else {
            md += `| File | Status |\n`;
            md += `|------|--------|\n`;
            for (const a of artifacts) {
                md += `| ${a} | Created/Modified |\n`;
            }
        }
        md += `\n`;

        // Git diff section (full summary only)
        if (!options.minimal) {
            md += `## File Changes (git diff)\n`;
            const diffOutput = _getGitDiffNameStatus(projectRoot);
            if (diffOutput !== null) {
                if (diffOutput.trim() === '') {
                    md += `No uncommitted file changes detected.\n`;
                } else {
                    md += '```\n' + diffOutput + '\n```\n';
                }
            } else {
                md += `Git diff unavailable.\n`;
            }
            md += `\n`;
        }

        // Links section
        if (artifacts.length > 0) {
            md += `## Links\n`;
            for (const a of artifacts) {
                md += `- [${a}](${a})\n`;
            }
            md += `\n`;
        }

        // --- Write to file ---
        const reviewsDir = path.join(projectRoot, '.isdlc', 'reviews');
        fs.mkdirSync(reviewsDir, { recursive: true });     // AC-02c

        const summaryPath = path.join(reviewsDir, `phase-${phaseNumber}-summary.md`);
        fs.writeFileSync(summaryPath, md, 'utf8');          // AC-02d: overwrites

        return summaryPath;

    } catch (e) {
        // Fail-safe: never throw, log to stderr and return null
        try {
            process.stderr.write(`[supervised-mode] Summary generation failed: ${e.message}\n`);
        } catch (_) { /* swallow */ }
        return null;
    }
}
```

### 5.4 Private Helpers

#### 5.4.1 _resolvePhaseDisplayName

```javascript
/**
 * Map a phase key to a human-readable display name.
 * @param {string} phaseKey - e.g., '03-architecture'
 * @returns {string} Display name, e.g., 'Architecture'
 * @private
 */
function _resolvePhaseDisplayName(phaseKey) {
    const PHASE_NAMES = {
        '00-quick-scan': 'Quick Scan',
        '01-requirements': 'Requirements',
        '02-impact-analysis': 'Impact Analysis',
        '02-tracing': 'Root Cause Tracing',
        '03-architecture': 'Architecture',
        '04-design': 'Design & Specifications',
        '05-test-strategy': 'Test Strategy',
        '06-implementation': 'Implementation',
        '07-testing': 'Testing',
        '08-code-review': 'Code Review & QA',
        '09-validation': 'Security & Compliance',
        '10-cicd': 'CI/CD Pipeline',
        '11-local-testing': 'Local Testing',
        '12-test-deploy': 'Staging Deployment',
        '13-production': 'Production Deployment',
        '14-operations': 'Operations & Monitoring',
        '15-upgrade-plan': 'Upgrade Planning',
        '15-upgrade-execute': 'Upgrade Execution',
        '16-quality-loop': 'Quality Loop'
    };

    if (PHASE_NAMES[phaseKey]) {
        return PHASE_NAMES[phaseKey];
    }

    // Fallback: derive from phase key (remove number prefix, title case)
    const parts = phaseKey.split('-').slice(1);
    return parts.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || phaseKey;
}
```

#### 5.4.2 _extractDecisions

```javascript
/**
 * Extract key decision bullet points from a phase summary string.
 * Splits on commas and semicolons. Returns up to 5 entries.
 * @param {string} summaryText - Phase summary text
 * @returns {string[]} Array of decision strings (max 5)
 * @private
 */
function _extractDecisions(summaryText) {
    if (!summaryText || typeof summaryText !== 'string') {
        return [];
    }

    // Split on comma or semicolon boundaries
    const parts = summaryText.split(/[,;]/).map(s => s.trim()).filter(s => s.length > 0);
    return parts.slice(0, 5);
}
```

#### 5.4.3 _getGitDiffNameStatus

```javascript
/**
 * Get git diff --name-status output for the current working tree.
 * Returns null if git is unavailable or fails (ASM-013-03).
 * @param {string} projectRoot - Absolute path to project root
 * @returns {string|null} Diff output or null
 * @private
 */
function _getGitDiffNameStatus(projectRoot) {
    try {
        const { execSync } = require('child_process');
        const output = execSync('git diff --name-status HEAD', {
            cwd: projectRoot,
            encoding: 'utf8',
            timeout: 5000,      // 5s timeout for safety
            stdio: ['pipe', 'pipe', 'pipe']
        });
        return output;
    } catch (e) {
        // Git unavailable or command failed -- degrade gracefully
        return null;
    }
}
```

### 5.5 Performance Analysis

| Operation | Expected Time | Notes |
|-----------|--------------|-------|
| State field reads | <1ms | In-memory object access |
| `_extractDecisions()` | <1ms | String splitting |
| `_getGitDiffNameStatus()` | <500ms typical, 5s max | Git CLI call with timeout |
| `fs.mkdirSync()` | <10ms | Directory creation (idempotent) |
| `fs.writeFileSync()` | <10ms | Write ~1-5KB markdown file |
| **Total** | **<1s typical** | Well within 10s target (NFR-013-03) |

### 5.6 Output Template

**Full summary** (`options.minimal === false`, default):

```markdown
# Phase 03 Summary: Architecture

**Status**: Completed
**Duration**: 30m (2026-02-14T10:30:00Z to 2026-02-14T11:00:00Z)
**Artifacts**: 5 files

## Key Decisions
- Interceptor pattern at phase boundary (STEP 3e-review)
- 4 common.cjs helpers
- State-driven config
- Redo via reentry
- 5 ADRs

## Artifacts Created/Modified
| File | Status |
|------|--------|
| architecture-overview.md | Created/Modified |
| ... | ... |

## File Changes (git diff)
```
M  src/claude/hooks/lib/common.cjs
A  docs/requirements/REQ-0013-supervised-mode/architecture-overview.md
```

## Links
- [architecture-overview.md](architecture-overview.md)
```

**Minimal summary** (`options.minimal === true`):

```markdown
# Phase 03 Summary: Architecture

**Status**: Completed
**Duration**: 30m (2026-02-14T10:30:00Z to 2026-02-14T11:00:00Z)
**Artifacts**: 5 files

## Artifacts Created/Modified
| File | Status |
|------|--------|
| architecture-overview.md | Created/Modified |
```

---

## 6. Function 4: recordReviewAction

### 6.1 Responsibility

Appends a review action entry to `active_workflow.review_history` in the provided state object. Initializes the array if missing. Does NOT write state to disk -- the caller is responsible for calling `writeState()`.

**Traces to**: FR-08 (AC-08a, AC-08b)

### 6.2 JSDoc

```javascript
/**
 * Record a review gate action in the workflow's review history.
 *
 * Appends to active_workflow.review_history[] (initializes if missing).
 * Does NOT write state to disk -- caller must call writeState() after.
 *
 * @param {object} state - Parsed state.json content (mutated in place)
 * @param {string} phaseKey - Phase key (e.g., '03-architecture')
 * @param {'continue'|'review'|'redo'} action - The user's choice
 * @param {object} [details={}] - Additional fields to include in the entry
 *   - For 'continue': { timestamp }
 *   - For 'review': { paused_at, resumed_at }
 *   - For 'redo': { redo_count, guidance, timestamp }
 * @returns {boolean} True if recorded successfully, false if state is invalid
 */
```

### 6.3 Pseudo-code

```javascript
function recordReviewAction(state, phaseKey, action, details = {}) {
    // Guard: state and active_workflow must exist
    if (!state || !state.active_workflow) {
        return false;
    }

    const aw = state.active_workflow;

    // Initialize review_history if missing
    if (!Array.isArray(aw.review_history)) {
        aw.review_history = [];
    }

    // Build entry
    const entry = {
        phase: phaseKey,
        action: action,
        timestamp: details.timestamp || getTimestamp(),
        ...details
    };

    // Ensure timestamp is present (not duplicated if already in details)
    if (!entry.timestamp) {
        entry.timestamp = getTimestamp();
    }

    aw.review_history.push(entry);

    return true;
}
```

### 6.4 Entry Shapes

**Continue action**:
```json
{
    "phase": "03-architecture",
    "action": "continue",
    "timestamp": "2026-02-14T10:30:00Z"
}
```

**Review action**:
```json
{
    "phase": "04-design",
    "action": "review",
    "paused_at": "2026-02-14T10:45:00Z",
    "resumed_at": "2026-02-14T11:00:00Z",
    "timestamp": "2026-02-14T11:00:00Z"
}
```

**Redo action**:
```json
{
    "phase": "06-implementation",
    "action": "redo",
    "redo_count": 1,
    "guidance": "Focus on error handling in the hook integration",
    "timestamp": "2026-02-14T11:30:00Z"
}
```

---

## 7. Traceability Matrix

| Function | Requirements | ACs Covered |
|----------|-------------|-------------|
| `readSupervisedModeConfig()` | FR-01, NFR-02 | AC-01a, AC-01b, AC-01c, AC-01f, AC-01g, AC-01h |
| `shouldReviewPhase()` | FR-01, FR-03 | AC-01d, AC-01e, AC-01f, AC-03e, AC-03f |
| `generatePhaseSummary()` | FR-02, NFR-03 | AC-02a, AC-02b, AC-02c, AC-02d, AC-02e |
| `recordReviewAction()` | FR-08 | AC-08a, AC-08b |

---

## 8. Dependencies

| Dependency | Type | Usage |
|-----------|------|-------|
| `fs` (Node.js stdlib) | Existing import | `mkdirSync`, `writeFileSync` |
| `path` (Node.js stdlib) | Existing import | `path.join` |
| `child_process` (Node.js stdlib) | New require (lazy) | `execSync` for git diff (in `_getGitDiffNameStatus` only) |
| `getTimestamp()` | Internal (common.cjs) | ISO-8601 timestamps in `recordReviewAction` |

**New npm dependencies**: None (NFR-013-06)

---

## 9. Testing Strategy Notes

The following test cases should be created during Phase 05 (test strategy):

1. **readSupervisedModeConfig**: Test missing block, null state, invalid enabled type, invalid review_phases type, array with invalid entries, array with all invalid entries
2. **shouldReviewPhase**: Test all combinations from Section 4.4 examples table
3. **generatePhaseSummary**: Test full vs minimal output, empty artifacts, no git, directory creation, overwrite behavior
4. **recordReviewAction**: Test all three action types, missing active_workflow, missing review_history array initialization
