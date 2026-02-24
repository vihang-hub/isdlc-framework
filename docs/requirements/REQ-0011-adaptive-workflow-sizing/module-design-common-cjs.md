# Module Design: common.cjs Sizing Functions

**Version**: 1.0.0
**Phase**: 04-design
**Traces to**: FR-01 (AC-01, AC-03), FR-02 (AC-04, AC-05, AC-07), FR-05 (AC-15-AC-18), FR-07 (AC-24)
**ADRs**: ADR-0002, ADR-0003

---

## 1. Module Overview

**File**: `src/claude/hooks/lib/common.cjs`
**Change Type**: MODIFY (additive)
**Estimated Lines Added**: ~150 (3 functions + JSDoc + section header)

Three pure utility functions are added to the existing common.cjs shared library under a new section header. The functions follow the established patterns of `collectPhaseSnapshots()`, `resetPhasesForWorkflow()`, and `pruneCompletedPhases()` -- they accept a state object, perform operations, and return the (mutated) state.

---

## 2. Section Placement

The new section is inserted between the existing "Dispatcher helpers (REQ-0010)" section and the `module.exports` block. The section header:

```javascript
// =========================================================================
// Sizing Utilities (REQ-0011: Adaptive Workflow Sizing)
// =========================================================================
```

---

## 3. Function 1: parseSizingFromImpactAnalysis

### 3.1 JSDoc

```javascript
/**
 * Parse sizing metrics from impact-analysis.md content.
 *
 * Strategy (ADR-0003):
 *   1. Primary: Parse last JSON metadata block (```json ... ```)
 *   2. Fallback: Regex on Executive Summary prose
 *   3. Default: Return null (caller defaults to standard)
 *
 * @param {string} content - Raw markdown content of impact-analysis.md
 * @returns {{ file_count: number, module_count: number, risk_score: string,
 *             coupling: string, coverage_gaps: number } | null}
 */
```

### 3.2 Pseudo-code

```javascript
function parseSizingFromImpactAnalysis(content) {
    // Guard: empty or non-string content
    if (!content || typeof content !== 'string') {
        return null;
    }

    // --- Primary: JSON metadata block ---
    const jsonBlockRegex = /```json\s*\n([\s\S]*?)\n```/g;
    let lastMatch = null;
    let match;
    while ((match = jsonBlockRegex.exec(content)) !== null) {
        lastMatch = match[1];
    }

    if (lastMatch) {
        try {
            const parsed = JSON.parse(lastMatch);
            return _validateAndNormalizeSizingMetrics(parsed);
        } catch (e) {
            // JSON parse failed -- fall through to fallback
        }
    }

    // --- Fallback: Executive Summary prose ---
    const fileMatch = content.match(/\*\*Affected Files\*\*:\s*(\d+)/i);
    const moduleMatch = content.match(/\*\*Modules? Affected\*\*:\s*(\d+)/i);
    const riskMatch = content.match(/\*\*Risk(?:\s*Level)?\*\*:\s*(low|medium|high)/i);
    const couplingMatch = content.match(/\*\*Blast\s*Radius\*\*:\s*(low|medium|high)/i);
    const coverageMatch = content.match(/\*\*Coverage\s*Gaps?\*\*:\s*(\d+)/i);

    // Require at least file_count and risk_score for fallback to succeed
    if (fileMatch && riskMatch) {
        return {
            file_count: parseInt(fileMatch[1], 10),
            module_count: moduleMatch ? parseInt(moduleMatch[1], 10) : 0,
            risk_score: riskMatch[1].toLowerCase(),
            coupling: couplingMatch ? couplingMatch[1].toLowerCase() : 'medium',
            coverage_gaps: coverageMatch ? parseInt(coverageMatch[1], 10) : 0
        };
    }

    // --- Default: parsing failed ---
    return null;
}
```

### 3.3 Internal Helper: _validateAndNormalizeSizingMetrics

```javascript
/**
 * Validate and normalize a parsed JSON object into SizingMetrics.
 * Invalid fields are replaced with safe defaults.
 *
 * @param {object} parsed - Raw parsed JSON from metadata block
 * @returns {{ file_count: number, module_count: number, risk_score: string,
 *             coupling: string, coverage_gaps: number }}
 * @private
 */
function _validateAndNormalizeSizingMetrics(parsed) {
    const VALID_LEVELS = ['low', 'medium', 'high'];

    const file_count = _safeNonNegInt(parsed.files_directly_affected, 0);
    const module_count = _safeNonNegInt(parsed.modules_affected, 0);
    const risk_score = VALID_LEVELS.includes(String(parsed.risk_level).toLowerCase())
        ? String(parsed.risk_level).toLowerCase()
        : 'medium';
    const coupling = VALID_LEVELS.includes(String(parsed.blast_radius).toLowerCase())
        ? String(parsed.blast_radius).toLowerCase()
        : 'medium';
    const coverage_gaps = _safeNonNegInt(parsed.coverage_gaps, 0);

    return { file_count, module_count, risk_score, coupling, coverage_gaps };
}

/**
 * Safely parse a non-negative integer. Returns defaultVal on failure.
 * @param {*} val - Value to parse
 * @param {number} defaultVal - Default value
 * @returns {number}
 * @private
 */
function _safeNonNegInt(val, defaultVal) {
    if (typeof val === 'number' && Number.isInteger(val) && val >= 0) return val;
    const parsed = parseInt(val, 10);
    return (!isNaN(parsed) && parsed >= 0) ? parsed : defaultVal;
}
```

### 3.4 Error Handling

| Scenario | Behavior |
|----------|----------|
| `content` is empty string | Return `null` |
| `content` is not a string | Return `null` |
| JSON.parse throws | Fall through to fallback regex |
| JSON block has wrong field names | `_validateAndNormalizeSizingMetrics` uses defaults |
| Fallback regex finds no matches | Return `null` |
| File count is negative in JSON | Defaults to 0 |
| Risk score is unrecognized string | Defaults to "medium" |

---

## 4. Function 2: computeSizingRecommendation

### 4.1 JSDoc

```javascript
/**
 * Compute a sizing recommendation from impact analysis metrics.
 *
 * Pure function: no I/O, no side effects. Deterministic given same inputs.
 *
 * Algorithm:
 *   1. If metrics is null -> standard (parsing failure)
 *   2. If file_count <= light_max_files AND risk != high -> light
 *   3. If file_count >= epic_min_files OR risk == high -> epic
 *   4. Otherwise -> standard
 *
 * @param {{ file_count: number, module_count: number, risk_score: string,
 *           coupling: string, coverage_gaps: number } | null} metrics
 * @param {{ light_max_files: number, epic_min_files: number }} thresholds
 * @returns {{ intensity: string, rationale: string, metrics: object | null }}
 */
```

### 4.2 Pseudo-code

```javascript
function computeSizingRecommendation(metrics, thresholds) {
    // Step 1: Validate and sanitize thresholds
    const t = { ...thresholds };
    if (typeof t.light_max_files !== 'number' || t.light_max_files < 1) {
        t.light_max_files = 5;
    }
    if (typeof t.epic_min_files !== 'number' || t.epic_min_files < 2) {
        t.epic_min_files = 20;
    }
    if (t.light_max_files >= t.epic_min_files) {
        t.light_max_files = 5;
        t.epic_min_files = 20;
    }

    // Step 2: Null metrics guard
    if (metrics === null || metrics === undefined) {
        return {
            intensity: 'standard',
            rationale: 'Unable to parse impact analysis metrics. Defaulting to standard workflow.',
            metrics: null
        };
    }

    // Step 3: Apply sizing algorithm
    const highRisk = metrics.risk_score === 'high';

    let intensity;
    let rationale;

    if (metrics.file_count <= t.light_max_files && !highRisk) {
        intensity = 'light';
        rationale = `Low scope (${metrics.file_count} files, ${metrics.risk_score} risk). ` +
                    `Architecture and Design phases can be skipped.`;
    } else if (metrics.file_count >= t.epic_min_files || highRisk) {
        intensity = 'epic';
        rationale = `Large scope (${metrics.file_count} files, ${metrics.risk_score} risk). ` +
                    `Epic decomposition recommended.`;
    } else {
        intensity = 'standard';
        rationale = `Medium scope (${metrics.file_count} files, ${metrics.risk_score} risk). ` +
                    `Full workflow recommended.`;
    }

    return { intensity, rationale, metrics };
}
```

### 4.3 Error Handling

| Scenario | Behavior |
|----------|----------|
| `metrics` is null | Return standard with "Unable to parse" rationale |
| `thresholds` has invalid types | Replace with hardcoded defaults (5, 20) |
| `thresholds.light_max_files >= thresholds.epic_min_files` | Reset both to defaults |
| `metrics.file_count` is exactly on boundary | `<= light_max_files` includes the boundary for light |

---

## 5. Function 3: applySizingDecision

### 5.1 JSDoc

```javascript
/**
 * Apply a sizing decision to the in-memory state object.
 *
 * For 'light' intensity:
 *   - Removes phases listed in light_skip_phases from active_workflow.phases
 *   - Removes corresponding entries from phase_status and top-level phases
 *   - Recalculates current_phase_index
 *   - Writes sizing record to active_workflow.sizing
 *   - On invariant failure: rolls back all changes, falls back to standard
 *
 * For 'standard' and 'epic':
 *   - No phase modifications
 *   - Writes sizing record only
 *   - For epic: sets effective_intensity to 'standard', epic_deferred to true
 *
 * Follows the same mutation-in-place pattern as resetPhasesForWorkflow().
 *
 * @param {object} state - The state.json object (mutated in place)
 * @param {string} intensity - 'light' | 'standard' | 'epic'
 * @param {object} sizingData - { metrics, forced_by_flag, overridden,
 *                               overridden_to, recommended_intensity, config }
 * @returns {object} The mutated state object (same reference)
 */
```

### 5.2 Pseudo-code

```javascript
function applySizingDecision(state, intensity, sizingData = {}) {
    // Step 0: Validate intensity
    const VALID_INTENSITIES = ['light', 'standard', 'epic'];
    if (!VALID_INTENSITIES.includes(intensity)) {
        process.stderr.write(`[sizing] Invalid intensity "${intensity}", defaulting to standard\n`);
        intensity = 'standard';
    }

    // Step 1: Guard - require active_workflow
    if (!state || !state.active_workflow) {
        process.stderr.write('[sizing] No active_workflow in state, skipping sizing\n');
        return state;
    }

    const aw = state.active_workflow;
    const metrics = sizingData.metrics || null;
    const now = new Date().toISOString();

    // Step 2: Compute effective intensity
    let effective_intensity = intensity;
    let epic_deferred = false;
    if (intensity === 'epic') {
        effective_intensity = 'standard';
        epic_deferred = true;
    }

    // Step 3: Build sizing record
    const sizingRecord = {
        intensity,
        effective_intensity,
        file_count: metrics ? (metrics.file_count || 0) : 0,
        module_count: metrics ? (metrics.module_count || 0) : 0,
        risk_score: metrics ? (metrics.risk_score || 'unknown') : 'unknown',
        coupling: metrics ? (metrics.coupling || 'unknown') : 'unknown',
        coverage_gaps: metrics ? (metrics.coverage_gaps || 0) : 0,
        recommended_by: sizingData.forced_by_flag ? 'user' : 'framework',
        overridden: !!sizingData.overridden,
        overridden_to: sizingData.overridden_to || null,
        decided_at: now,
        forced_by_flag: !!sizingData.forced_by_flag,
        epic_deferred
    };

    // Step 4: For standard/epic, just write record and return
    if (effective_intensity !== 'light') {
        aw.sizing = sizingRecord;
        return state;
    }

    // Step 5: Light intensity -- modify phase arrays
    // 5a. Determine which phases to skip
    const config = sizingData.config || {};
    const skipPhases = Array.isArray(config.light_skip_phases)
        ? config.light_skip_phases
        : ['03-architecture', '04-design'];

    // 5b. Snapshot for rollback
    const snapshot = {
        phases: [...aw.phases],
        phase_status: { ...aw.phase_status },
        current_phase_index: aw.current_phase_index,
        top_phases: state.phases ? { ...state.phases } : {}
    };

    // 5c. Filter phases array
    aw.phases = aw.phases.filter(p => !skipPhases.includes(p));

    // 5d. Remove from phase_status
    for (const p of skipPhases) {
        delete aw.phase_status[p];
    }

    // 5e. Remove from top-level phases
    if (state.phases) {
        for (const p of skipPhases) {
            delete state.phases[p];
        }
    }

    // 5f. Recalculate current_phase_index
    // Find the last completed phase (02-impact-analysis) and set index to next
    const lastCompleted = '02-impact-analysis';
    const lastCompletedIdx = aw.phases.indexOf(lastCompleted);
    if (lastCompletedIdx >= 0) {
        aw.current_phase_index = lastCompletedIdx + 1;
    }
    // If 02-impact-analysis not found, try to find the highest-indexed completed phase
    else {
        let highestCompleted = -1;
        for (let i = 0; i < aw.phases.length; i++) {
            if (aw.phase_status[aw.phases[i]] === 'completed') {
                highestCompleted = i;
            }
        }
        aw.current_phase_index = highestCompleted + 1;
    }

    // Step 6: Invariant checks
    const invariantsFailed = _checkSizingInvariants(state);

    if (invariantsFailed) {
        // Rollback
        process.stderr.write(`[sizing] Invariant check failed: ${invariantsFailed}. Rolling back to standard.\n`);
        aw.phases = snapshot.phases;
        aw.phase_status = snapshot.phase_status;
        aw.current_phase_index = snapshot.current_phase_index;
        state.phases = snapshot.top_phases;

        sizingRecord.intensity = intensity; // preserve original for audit
        sizingRecord.effective_intensity = 'standard';
        sizingRecord.fallback_reason = 'invariant_check_failed';
    }

    // Step 7: Write sizing record
    aw.sizing = sizingRecord;

    return state;
}
```

### 5.3 Internal Helper: _checkSizingInvariants

```javascript
/**
 * Validate post-mutation state invariants for sizing.
 *
 * @param {object} state - The state object after mutation
 * @returns {string|null} Error description if invariant failed, null if all pass
 * @private
 */
function _checkSizingInvariants(state) {
    const aw = state.active_workflow;

    // INV-01: Minimum 3 phases
    if (!Array.isArray(aw.phases) || aw.phases.length < 3) {
        return `INV-01: phases.length=${aw.phases?.length || 0} < 3`;
    }

    // INV-02: Index within bounds
    if (aw.current_phase_index >= aw.phases.length) {
        return `INV-02: current_phase_index=${aw.current_phase_index} >= phases.length=${aw.phases.length}`;
    }

    // INV-03: Every phase_status key exists in phases array
    const phasesSet = new Set(aw.phases);
    for (const key of Object.keys(aw.phase_status)) {
        if (!phasesSet.has(key)) {
            return `INV-03: phase_status key "${key}" not in phases array`;
        }
    }

    // INV-04: Next phase is pending
    const nextPhase = aw.phases[aw.current_phase_index];
    if (aw.phase_status[nextPhase] !== 'pending') {
        return `INV-04: next phase "${nextPhase}" has status "${aw.phase_status[nextPhase]}", expected "pending"`;
    }

    return null; // All invariants pass
}
```

### 5.4 Error Handling

| Scenario | Behavior |
|----------|----------|
| Invalid intensity string | Log to stderr, default to 'standard' |
| No `state.active_workflow` | Log to stderr, return state unchanged |
| `skipPhases` array empty | No phases removed, sizing record still written |
| Invariant check fails | Full rollback, effective_intensity set to 'standard', `fallback_reason` recorded |
| `sizingData.config` missing | Use hardcoded defaults `["03-architecture", "04-design"]` |
| `02-impact-analysis` not in phases array | Fall back to highest completed phase index |

---

## 6. Module.exports Changes

Add to the `module.exports` block:

```javascript
module.exports = {
    // ... existing exports ...
    // Sizing utilities (REQ-0011)
    parseSizingFromImpactAnalysis,
    computeSizingRecommendation,
    applySizingDecision
};
```

The internal helpers (`_validateAndNormalizeSizingMetrics`, `_safeNonNegInt`, `_checkSizingInvariants`) are NOT exported -- they are implementation details with leading underscore convention matching existing patterns (`_computeDuration`, `_extractSummary`, `_computeMetrics`).

---

## 7. Dependencies

| Dependency | Type | Notes |
|-----------|------|-------|
| `fs` | Node.js built-in | Already imported in common.cjs (not used by sizing functions) |
| `path` | Node.js built-in | Already imported in common.cjs (not used by sizing functions) |
| `process.stderr` | Node.js global | For diagnostic output (existing pattern in common.cjs) |

No new imports required. The three sizing functions use only JavaScript built-ins (String, Array, RegExp, JSON, parseInt, Number, Date).

---

## 8. Traceability

| Function | Requirement | Acceptance Criteria |
|----------|-------------|-------------------|
| `parseSizingFromImpactAnalysis` | FR-01 | AC-01, AC-03 |
| `computeSizingRecommendation` | FR-01, FR-02 | AC-03, AC-04, AC-05, AC-07 |
| `applySizingDecision` | FR-05, FR-07 | AC-15, AC-16, AC-17, AC-18, AC-24 |
| `_checkSizingInvariants` | NFR-04, Article IX | Quality gate integrity |
| `_validateAndNormalizeSizingMetrics` | NFR-04, Article III | Input validation |
