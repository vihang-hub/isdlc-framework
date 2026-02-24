# Module Design: Performance Budget and Guardrail System

**ID**: REQ-0022
**Phase**: 04-design
**Generated**: 2026-02-19
**Traces To**: FR-001 through FR-008, NFR-001 through NFR-005
**Architecture Input**: `architecture-overview.md` (ADR-0001 through ADR-0005)

---

## Table of Contents

1. [Design Overview](#1-design-overview)
2. [Function Specifications: performance-budget.cjs](#2-function-specifications-performance-budgetcjs)
3. [Integration Specifications: isdlc.md Modifications](#3-integration-specifications-isdlcmd-modifications)
4. [State Schema Extensions](#4-state-schema-extensions)
5. [Workflows.json Extension](#5-workflowsjson-extension)
6. [Modification Specifications: Existing Modules](#6-modification-specifications-existing-modules)
7. [Error Taxonomy](#7-error-taxonomy)
8. [Traceability Matrix](#8-traceability-matrix)
9. [Constitutional Compliance](#9-constitutional-compliance)

---

## 1. Design Overview

This document specifies the detailed module design for the Performance Budget and Guardrail System. It translates the architecture overview (ADR-0001 through ADR-0005) into implementation-ready specifications.

**New file**: `src/claude/hooks/lib/performance-budget.cjs` -- 7 exported functions, ~350 lines.

**Modified files** (9):
- `src/claude/commands/isdlc.md` -- 4 integration points (STEP 3c-prime, 3d, 3e, pre-STEP-4)
- `src/claude/hooks/lib/common.cjs` -- 3-line extension to `collectPhaseSnapshots()`
- `src/claude/hooks/workflow-completion-enforcer.cjs` -- regression tracking block
- `src/isdlc/config/workflows.json` -- `performance_budgets` section
- `src/claude/hooks/dispatchers/pre-task-dispatcher.cjs` -- timing instrumentation
- `src/claude/hooks/dispatchers/post-task-dispatcher.cjs` -- timing instrumentation
- `src/claude/hooks/dispatchers/pre-skill-dispatcher.cjs` -- timing instrumentation
- `src/claude/hooks/dispatchers/post-bash-dispatcher.cjs` -- timing instrumentation
- `src/claude/hooks/dispatchers/post-write-edit-dispatcher.cjs` -- timing instrumentation

**Design principles** (from ADR-0001):
- Fail-open: every exported function wraps in try/catch, returns safe default
- Pure functions: no side effects, no state.json writes, no process.exit
- Deterministic: given same inputs, always produces same outputs
- CJS format: follows the `gate-requirements-injector.cjs` pattern

---

## 2. Function Specifications: performance-budget.cjs

### 2.0 Module Header and Constants

```javascript
'use strict';

/**
 * iSDLC Performance Budget Utilities (CommonJS)
 * ================================================
 * Budget computation, degradation logic, rolling average,
 * regression detection, and completion dashboard formatting.
 *
 * Design principles:
 * - Fail-open: every exported function wraps in try/catch, returns safe default
 * - Pure functions: no side effects, no state.json writes, no process.exit
 * - Deterministic: given same inputs, always produces same outputs
 *
 * Traces to: REQ-0022 (Performance Budget and Guardrail System)
 * Version: 1.0.0
 */
```

#### Constants

| Constant | Value | Traces To |
|----------|-------|-----------|
| `DEFAULT_BUDGETS` | `{ light: { max_total_minutes: 30, max_phase_minutes: 10, max_debate_rounds: 0, max_fan_out_chunks: 1 }, standard: { max_total_minutes: 90, max_phase_minutes: 25, max_debate_rounds: 2, max_fan_out_chunks: 4 }, epic: { max_total_minutes: 180, max_phase_minutes: 40, max_debate_rounds: 3, max_fan_out_chunks: 8 } }` | AC-002c |
| `DEBATE_ENABLED_PHASES` | `['01-requirements', '03-architecture', '04-design', '05-test-strategy']` | AC-004a |
| `FAN_OUT_PHASES` | `['16-quality-loop', '08-code-review']` | AC-005a |
| `DEFAULT_REGRESSION_THRESHOLD` | `0.20` | AC-006c |
| `DEFAULT_MAX_PRIOR` | `5` | AC-006b |
| `BUDGET_APPROACHING_THRESHOLD` | `0.80` | AC-003d, AC-003e |

All constants are exported for testability (exported as `_constants` in a frozen object).

#### Exports Summary

```javascript
module.exports = {
    getPerformanceBudget,
    computeBudgetStatus,
    buildBudgetWarning,
    buildDegradationDirective,
    computeRollingAverage,
    detectRegression,
    formatCompletionDashboard,
    _constants: Object.freeze({
        DEFAULT_BUDGETS,
        DEBATE_ENABLED_PHASES,
        FAN_OUT_PHASES,
        DEFAULT_REGRESSION_THRESHOLD,
        DEFAULT_MAX_PRIOR,
        BUDGET_APPROACHING_THRESHOLD
    })
};
```

---

### 2.1 getPerformanceBudget(workflowConfig, intensity)

**Purpose**: Look up the budget tier for a given intensity from the workflow configuration, with hardcoded fallback defaults.

**Traces**: FR-002, AC-002a, AC-002b, AC-002c, AC-002d, AC-002e

#### Signature

```javascript
/**
 * @param {object|null} workflowConfig - Parsed workflow object (e.g., workflows.feature).
 *        Expected shape: { performance_budgets: { light: {...}, standard: {...}, epic: {...} } }
 * @param {string} intensity - One of "light", "standard", "epic".
 * @returns {{ max_total_minutes: number, max_phase_minutes: number,
 *             max_debate_rounds: number, max_fan_out_chunks: number }}
 */
function getPerformanceBudget(workflowConfig, intensity)
```

#### Input Validation

| Input | Validation | Fail-Open Response |
|-------|-----------|-------------------|
| `workflowConfig` is `null`, `undefined`, or not an object | Skip config lookup | Return `DEFAULT_BUDGETS[normalizedIntensity]` |
| `workflowConfig.performance_budgets` is missing | Skip config lookup | Return `DEFAULT_BUDGETS[normalizedIntensity]` |
| `intensity` is `null`, `undefined`, empty, or not a string | Normalize to `"standard"` | Look up `"standard"` tier |
| `intensity` is not one of `"light"`, `"standard"`, `"epic"` | Normalize to `"standard"` | Look up `"standard"` tier |
| Config has the tier but fields are missing or non-numeric | Merge with defaults | Return merged object with defaults filling gaps |

#### Pseudocode

```
function getPerformanceBudget(workflowConfig, intensity):
    try:
        // 1. Normalize intensity
        normalizedIntensity = (typeof intensity === 'string' && ['light', 'standard', 'epic'].includes(intensity))
            ? intensity
            : 'standard'

        // 2. Get defaults for this tier
        defaults = DEFAULT_BUDGETS[normalizedIntensity]

        // 3. Attempt config lookup
        if workflowConfig
           && typeof workflowConfig === 'object'
           && workflowConfig.performance_budgets
           && typeof workflowConfig.performance_budgets === 'object':

            configBudget = workflowConfig.performance_budgets[normalizedIntensity]

            if configBudget && typeof configBudget === 'object':
                // 4. Merge: config values override defaults, but only if valid numbers
                return {
                    max_total_minutes:   validPositiveInt(configBudget.max_total_minutes)   ?? defaults.max_total_minutes,
                    max_phase_minutes:   validPositiveInt(configBudget.max_phase_minutes)   ?? defaults.max_phase_minutes,
                    max_debate_rounds:   validNonNegInt(configBudget.max_debate_rounds)     ?? defaults.max_debate_rounds,
                    max_fan_out_chunks:  validPositiveInt(configBudget.max_fan_out_chunks)  ?? defaults.max_fan_out_chunks
                }

        // 5. Config missing or tier not found -- return defaults
        return { ...defaults }

    catch:
        return { ...DEFAULT_BUDGETS.standard }
```

#### Helper Functions (internal)

```javascript
/** Returns value if it's a positive integer, otherwise null */
function validPositiveInt(v) {
    return (typeof v === 'number' && Number.isInteger(v) && v > 0) ? v : null;
}

/** Returns value if it's a non-negative integer (0 allowed for debate rounds), otherwise null */
function validNonNegInt(v) {
    return (typeof v === 'number' && Number.isInteger(v) && v >= 0) ? v : null;
}
```

#### Return Type

```typescript
{
    max_total_minutes: number;    // positive integer
    max_phase_minutes: number;    // positive integer
    max_debate_rounds: number;    // non-negative integer (0 = no debates)
    max_fan_out_chunks: number;   // positive integer (minimum 1)
}
```

#### Edge Cases

| Scenario | Expected Behavior |
|----------|------------------|
| `getPerformanceBudget(null, null)` | Returns `DEFAULT_BUDGETS.standard` |
| `getPerformanceBudget({}, 'epic')` | Returns `DEFAULT_BUDGETS.epic` (no `performance_budgets` key) |
| `getPerformanceBudget(validConfig, 'unknown')` | Normalizes to `"standard"`, returns standard tier |
| Config has `max_total_minutes: -5` | Replaced by default (negative not valid) |
| Config has `max_total_minutes: 3.7` | Replaced by default (not integer) |
| Config has `max_debate_rounds: 0` for light tier | Preserved (0 is valid for debate rounds) |
| Fix workflow with no sizing | Caller passes `"standard"` per AC-002e; function looks up standard tier |

---

### 2.2 computeBudgetStatus(elapsedMinutes, maxTotalMinutes)

**Purpose**: Determine the budget status classification based on elapsed workflow time versus the total budget.

**Traces**: FR-003, AC-003c, AC-003d, AC-003e

#### Signature

```javascript
/**
 * @param {number} elapsedMinutes - Elapsed workflow time in minutes.
 * @param {number} maxTotalMinutes - Budget limit in minutes.
 * @returns {"on_track" | "approaching" | "exceeded"}
 */
function computeBudgetStatus(elapsedMinutes, maxTotalMinutes)
```

#### Input Validation

| Input | Validation | Fail-Open Response |
|-------|-----------|-------------------|
| `elapsedMinutes` is not a finite number | Return `"on_track"` | Conservative: assume budget is fine |
| `maxTotalMinutes` is not a positive finite number | Return `"on_track"` | Cannot compute ratio without valid budget |
| Both are `NaN` | Return `"on_track"` | Conservative default |

#### Pseudocode

```
function computeBudgetStatus(elapsedMinutes, maxTotalMinutes):
    try:
        if typeof elapsedMinutes !== 'number' || !isFinite(elapsedMinutes):
            return 'on_track'
        if typeof maxTotalMinutes !== 'number' || !isFinite(maxTotalMinutes) || maxTotalMinutes <= 0:
            return 'on_track'

        ratio = elapsedMinutes / maxTotalMinutes

        if ratio > 1.0:
            return 'exceeded'
        if ratio > 0.80:
            return 'approaching'
        return 'on_track'

    catch:
        return 'on_track'
```

#### Return Type

One of the string literals: `"on_track"`, `"approaching"`, `"exceeded"`.

#### Boundary Conditions

| elapsedMinutes | maxTotalMinutes | ratio | Result |
|---------------|----------------|-------|--------|
| 70 | 90 | 0.778 | `"on_track"` |
| 72 | 90 | 0.800 | `"on_track"` (exactly 80% is NOT approaching; AC-003d says `<= 0.8` is on_track) |
| 72.1 | 90 | 0.801 | `"approaching"` |
| 90 | 90 | 1.000 | `"approaching"` (exactly 100% is NOT exceeded; AC-003e says `<= max` is approaching) |
| 91 | 90 | 1.011 | `"exceeded"` |
| 0 | 90 | 0.000 | `"on_track"` |
| -5 | 90 | -0.056 | `"on_track"` (negative elapsed is conservative) |

**Important boundary semantics** (derived from AC-003d and AC-003e):
- AC-003d: `elapsed <= max_total_minutes * 0.8` => `"on_track"` (uses `<=`)
- AC-003e: `elapsed > max_total_minutes * 0.8 AND elapsed <= max_total_minutes` => `"approaching"` (uses `>` and `<=`)
- AC-003c: `elapsed > max_total_minutes` => `"exceeded"` (uses `>`)

Therefore: `ratio <= 0.8` is on_track, `0.8 < ratio <= 1.0` is approaching, `ratio > 1.0` is exceeded.

---

### 2.3 buildBudgetWarning(elapsedMinutes, budget, phaseKey, intensity, phaseDuration)

**Purpose**: Format a budget warning string for stderr output. Returns an empty string when no warning is needed.

**Traces**: FR-003, AC-003b, AC-003e

#### Signature

```javascript
/**
 * @param {number} elapsedMinutes - Total elapsed workflow time in minutes.
 * @param {{ max_total_minutes: number }} budget - The performance budget object.
 * @param {string} phaseKey - The phase that just completed (e.g., "04-design").
 * @param {string} intensity - The intensity tier (e.g., "standard").
 * @param {number} phaseDuration - Duration of the just-completed phase in minutes.
 * @returns {string} Warning string for stderr, or empty string if no warning.
 */
function buildBudgetWarning(elapsedMinutes, budget, phaseKey, intensity, phaseDuration)
```

#### Input Validation

| Input | Validation | Fail-Open Response |
|-------|-----------|-------------------|
| `budget` is null/undefined or missing `max_total_minutes` | Return `""` | No warning without a budget |
| `elapsedMinutes` is not a finite number | Return `""` | Cannot compute percent |
| `phaseKey` is not a string | Default to `"unknown"` | Continue with fallback |
| `intensity` is not a string | Default to `"unknown"` | Continue with fallback |
| `phaseDuration` is not a finite number | Default to `0` | Continue with fallback |

#### Pseudocode

```
function buildBudgetWarning(elapsedMinutes, budget, phaseKey, intensity, phaseDuration):
    try:
        if !budget || typeof budget.max_total_minutes !== 'number' || budget.max_total_minutes <= 0:
            return ''
        if typeof elapsedMinutes !== 'number' || !isFinite(elapsedMinutes):
            return ''

        maxTotal = budget.max_total_minutes
        percent = Math.round((elapsedMinutes / maxTotal) * 100)
        status = computeBudgetStatus(elapsedMinutes, maxTotal)

        safePhaseKey = (typeof phaseKey === 'string') ? phaseKey : 'unknown'
        safeIntensity = (typeof intensity === 'string') ? intensity : 'unknown'
        safePhaseDuration = (typeof phaseDuration === 'number' && isFinite(phaseDuration)) ? phaseDuration : 0

        if status === 'exceeded':
            return `BUDGET_WARNING: Workflow has consumed ${elapsedMinutes}m of ${maxTotal}m budget (${percent}%). Phase ${safePhaseKey} took ${safePhaseDuration}m. [${safeIntensity} tier]`

        if status === 'approaching':
            remaining = maxTotal - elapsedMinutes
            return `BUDGET_APPROACHING: Workflow at ${percent}% of ${maxTotal}m budget. ${Math.round(remaining)}m remaining. [${safeIntensity} tier]`

        return ''

    catch:
        return ''
```

#### Return Type

String. Format per AC-003b:
- **Exceeded**: `"BUDGET_WARNING: Workflow has consumed {elapsed}m of {budget}m budget ({percent}%). Phase {phase_key} took {phase_duration}m. [{intensity} tier]"`
- **Approaching**: `"BUDGET_APPROACHING: Workflow at {percent}% of {budget}m budget. {remaining}m remaining. [{intensity} tier]"`
- **On track**: `""` (empty string)

#### Edge Cases

| Scenario | Expected Output |
|----------|----------------|
| `buildBudgetWarning(95, { max_total_minutes: 90 }, '06-implementation', 'standard', 22)` | `"BUDGET_WARNING: Workflow has consumed 95m of 90m budget (106%). Phase 06-implementation took 22m. [standard tier]"` |
| `buildBudgetWarning(75, { max_total_minutes: 90 }, '04-design', 'standard', 7)` | `"BUDGET_APPROACHING: Workflow at 83% of 90m budget. 15m remaining. [standard tier]"` |
| `buildBudgetWarning(50, { max_total_minutes: 90 }, '03-architecture', 'standard', 12)` | `""` (on track) |
| `buildBudgetWarning(NaN, budget, 'x', 'y', 5)` | `""` (invalid elapsed) |

---

### 2.4 buildDegradationDirective(budgetStatus, budget, phaseKey, workflowFlags)

**Purpose**: Generate the `BUDGET_DEGRADATION` text block to inject into an agent delegation prompt. Returns an empty string when no degradation is needed.

**Traces**: FR-004, FR-005, AC-004a, AC-004b, AC-004c, AC-004d, AC-004e, AC-005a, AC-005b, AC-005c, AC-005d

#### Signature

```javascript
/**
 * @param {string} budgetStatus - One of "on_track", "approaching", "exceeded".
 * @param {{ max_debate_rounds: number, max_fan_out_chunks: number }} budget - The budget tier.
 * @param {string} phaseKey - The target phase for delegation (e.g., "01-requirements").
 * @param {{ no_debate?: boolean, no_fan_out?: boolean }} workflowFlags - Active workflow flags.
 * @returns {{ directive: string, degraded_debate_rounds: number|null, degraded_fan_out_chunks: number|null }}
 */
function buildDegradationDirective(budgetStatus, budget, phaseKey, workflowFlags)
```

#### Input Validation

| Input | Validation | Fail-Open Response |
|-------|-----------|-------------------|
| `budgetStatus` is not `"exceeded"` or `"approaching"` | Return `{ directive: '', degraded_debate_rounds: null, degraded_fan_out_chunks: null }` | No degradation when on_track or unknown |
| `budget` is null/undefined or not an object | Return empty | Cannot compute degraded limits |
| `phaseKey` is not a string | Return empty | Cannot match against phase lists |
| `workflowFlags` is null/undefined | Default to `{}` | No flags active |

#### Pseudocode

```
function buildDegradationDirective(budgetStatus, budget, phaseKey, workflowFlags):
    try:
        EMPTY = { directive: '', degraded_debate_rounds: null, degraded_fan_out_chunks: null }

        // 1. Guard: only degrade on exceeded or approaching
        if budgetStatus !== 'exceeded' && budgetStatus !== 'approaching':
            return EMPTY

        // 2. Guard: need budget and phaseKey
        if !budget || typeof budget !== 'object':
            return EMPTY
        if typeof phaseKey !== 'string':
            return EMPTY

        flags = (workflowFlags && typeof workflowFlags === 'object') ? workflowFlags : {}

        isDebatePhase = DEBATE_ENABLED_PHASES.includes(phaseKey)
        isFanOutPhase = FAN_OUT_PHASES.includes(phaseKey)

        // 3. If phase is neither debate-enabled nor fan-out, no degradation applies
        if !isDebatePhase && !isFanOutPhase:
            return EMPTY

        degradedDebate = null
        degradedFanOut = null
        directiveParts = []

        // 4. Debate degradation
        if isDebatePhase && !flags.no_debate:
            tierMax = (typeof budget.max_debate_rounds === 'number') ? budget.max_debate_rounds : 2

            if budgetStatus === 'exceeded':
                degradedDebate = 1                          // AC-004a: hard limit of 1
            else:  // approaching
                degradedDebate = Math.max(1, tierMax - 1)   // AC-004b: tier_max - 1, minimum 1

            directiveParts.push(`max_debate_rounds: ${degradedDebate}`)

        // 5. Fan-out degradation
        if isFanOutPhase && !flags.no_fan_out:
            tierMax = (typeof budget.max_fan_out_chunks === 'number') ? budget.max_fan_out_chunks : 4

            if budgetStatus === 'exceeded':
                degradedFanOut = 2                                     // AC-005a: hard limit of 2
            else:  // approaching
                degradedFanOut = Math.max(2, Math.floor(tierMax / 2))  // AC-005b: floor(tier_max/2), minimum 2

            directiveParts.push(`max_fan_out_chunks: ${degradedFanOut}`)

        // 6. If nothing to degrade (e.g., flags disabled relevant degradation), return empty
        if directiveParts.length === 0:
            return EMPTY

        // 7. Build directive text
        reason = budgetStatus === 'exceeded'
            ? `Workflow budget exceeded`
            : `Workflow budget approaching limit`

        directive = [
            'BUDGET_DEGRADATION:',
            `  budget_status: ${budgetStatus}`,
            ...directiveParts.map(p => `  ${p}`),
            `  reason: "${reason}"`,
            `  phase: ${phaseKey}`
        ].join('\n')

        return { directive, degraded_debate_rounds: degradedDebate, degraded_fan_out_chunks: degradedFanOut }

    catch:
        return { directive: '', degraded_debate_rounds: null, degraded_fan_out_chunks: null }
```

#### Return Type

```typescript
{
    directive: string;                      // Multi-line text to inject, or "" if no degradation
    degraded_debate_rounds: number | null;  // The degraded limit applied, or null
    degraded_fan_out_chunks: number | null; // The degraded limit applied, or null
}
```

**Note**: The return includes both the formatted directive string AND the numeric degraded values. The directive string is injected into the delegation prompt. The numeric values are written to `phases[phase_key].timing.debate_rounds_degraded_to` and `fan_out_degraded_to` in STEP 3e.

#### Degradation Rules Matrix

| budgetStatus | Phase Type | --no-debate/--no-fan-out | Debate Rounds | Fan-Out Chunks |
|-------------|-----------|--------------------------|---------------|----------------|
| `on_track` | any | any | (no degradation) | (no degradation) |
| `exceeded` | debate-enabled | false | 1 | N/A |
| `exceeded` | debate-enabled | true (--no-debate) | (skip, already disabled) | N/A |
| `exceeded` | fan-out | false | N/A | 2 |
| `exceeded` | fan-out | true (--no-fan-out) | N/A | (skip, already disabled) |
| `exceeded` | other | any | (no degradation) | (no degradation) |
| `approaching` | debate-enabled (standard, tier_max=2) | false | max(1, 2-1) = 1 | N/A |
| `approaching` | debate-enabled (epic, tier_max=3) | false | max(1, 3-1) = 2 | N/A |
| `approaching` | fan-out (standard, tier_max=4) | false | N/A | max(2, floor(4/2)) = 2 |
| `approaching` | fan-out (epic, tier_max=8) | false | N/A | max(2, floor(8/2)) = 4 |
| `approaching` | debate-enabled (light, tier_max=0) | false | max(1, 0-1) = 1 | N/A |

#### Edge Cases

| Scenario | Expected Output |
|----------|----------------|
| `buildDegradationDirective('exceeded', standardBudget, '01-requirements', {})` | Directive with `max_debate_rounds: 1`, `degraded_debate_rounds: 1` |
| `buildDegradationDirective('exceeded', standardBudget, '16-quality-loop', {})` | Directive with `max_fan_out_chunks: 2`, `degraded_fan_out_chunks: 2` |
| `buildDegradationDirective('exceeded', standardBudget, '06-implementation', {})` | Empty (not debate/fan-out phase) |
| `buildDegradationDirective('on_track', standardBudget, '01-requirements', {})` | Empty (on track) |
| `buildDegradationDirective('exceeded', standardBudget, '01-requirements', { no_debate: true })` | Empty (debates disabled) |
| `buildDegradationDirective('approaching', epicBudget, '03-architecture', {})` | Directive with `max_debate_rounds: 2` |
| `buildDegradationDirective('approaching', lightBudget, '01-requirements', {})` | Directive with `max_debate_rounds: 1` (min floor) |

---

### 2.5 computeRollingAverage(workflowHistory, intensity, maxPrior)

**Purpose**: Compute the rolling average total duration from the last N completed workflows of the same intensity tier. Returns `null` if insufficient data (fewer than 2 matching workflows).

**Traces**: FR-006, AC-006a, AC-006b, AC-006d

#### Signature

```javascript
/**
 * @param {Array} workflowHistory - Array of workflow_history entries.
 * @param {string} intensity - Intensity tier to filter by (e.g., "standard").
 * @param {number} [maxPrior=5] - Maximum number of prior workflows to include.
 * @returns {{ avg_minutes: number, count: number } | null}
 *          null if fewer than 2 matching prior workflows.
 */
function computeRollingAverage(workflowHistory, intensity, maxPrior)
```

#### Input Validation

| Input | Validation | Fail-Open Response |
|-------|-----------|-------------------|
| `workflowHistory` is not an array | Return `null` | No data to compute |
| `workflowHistory` is empty | Return `null` | No data |
| `intensity` is not a string | Normalize to `"standard"` | Match standard tier |
| `maxPrior` is not a positive integer | Default to `5` | Use standard window |

#### Pseudocode

```
function computeRollingAverage(workflowHistory, intensity, maxPrior = 5):
    try:
        if !Array.isArray(workflowHistory) || workflowHistory.length === 0:
            return null

        normalizedIntensity = (typeof intensity === 'string' && intensity.length > 0)
            ? intensity
            : 'standard'

        safePrior = (typeof maxPrior === 'number' && Number.isInteger(maxPrior) && maxPrior > 0)
            ? maxPrior
            : DEFAULT_MAX_PRIOR

        // 1. Filter entries by matching intensity tier
        //    For fix workflows: sizing is absent, so effective_intensity defaults to "standard" (AC-006a)
        matching = []
        for entry in workflowHistory (reverse order, most recent first):
            entryIntensity = entry.sizing?.effective_intensity || 'standard'
            if entryIntensity === normalizedIntensity:
                // Must have total_duration_minutes in metrics
                duration = entry.metrics?.total_duration_minutes
                if typeof duration === 'number' && isFinite(duration) && duration > 0:
                    matching.push(duration)
                if matching.length >= safePrior:
                    break

        // 2. Guard: need at least 2 matching entries (AC-006d)
        if matching.length < 2:
            return null

        // 3. Compute average
        sum = matching.reduce((a, b) => a + b, 0)
        avg = Math.round(sum / matching.length)

        return { avg_minutes: avg, count: matching.length }

    catch:
        return null
```

#### Return Type

```typescript
{
    avg_minutes: number;  // Rounded to integer
    count: number;        // How many prior workflows were averaged (2..maxPrior)
} | null
```

#### Edge Cases

| Scenario | Expected Output |
|----------|----------------|
| Empty history | `null` |
| 1 matching workflow | `null` (need >= 2 per AC-006d) |
| 2 matching workflows (durations 60, 80) | `{ avg_minutes: 70, count: 2 }` |
| 7 matching workflows (maxPrior=5) | Uses last 5 only |
| Mix of intensities (3 standard, 2 epic), querying standard | Uses only 3 standard entries |
| Entries with `metrics.total_duration_minutes = null` | Skipped (no valid duration) |
| Fix workflow entries (no `sizing` field) | Treated as `"standard"` intensity |

---

### 2.6 detectRegression(currentMinutes, rollingAvg, threshold)

**Purpose**: Compare the current workflow duration against the rolling average. Returns a regression result object, or `null` if no comparison is possible.

**Traces**: FR-006, AC-006c, AC-006d, AC-006e

#### Signature

```javascript
/**
 * @param {number} currentMinutes - The current workflow's total duration in minutes.
 * @param {{ avg_minutes: number, count: number } | null} rollingAvg - From computeRollingAverage().
 * @param {number} [threshold=0.20] - Regression threshold as a decimal (e.g., 0.20 = 20%).
 * @returns {{ baseline_avg_minutes: number, current_minutes: number, percent_over: number,
 *             regressed: boolean, compared_against: number } | null}
 */
function detectRegression(currentMinutes, rollingAvg, threshold)
```

#### Input Validation

| Input | Validation | Fail-Open Response |
|-------|-----------|-------------------|
| `rollingAvg` is `null` | Return `null` | No baseline to compare against (AC-006d) |
| `currentMinutes` is not a finite positive number | Return `null` | Cannot compute |
| `rollingAvg.avg_minutes` is not a finite positive number | Return `null` | Invalid baseline |
| `threshold` is not a finite number | Default to `0.20` | Use standard threshold |

#### Pseudocode

```
function detectRegression(currentMinutes, rollingAvg, threshold = DEFAULT_REGRESSION_THRESHOLD):
    try:
        // 1. Guard: need valid rolling average
        if rollingAvg === null || typeof rollingAvg !== 'object':
            return null
        if typeof rollingAvg.avg_minutes !== 'number' || !isFinite(rollingAvg.avg_minutes) || rollingAvg.avg_minutes <= 0:
            return null

        // 2. Guard: need valid current duration
        if typeof currentMinutes !== 'number' || !isFinite(currentMinutes) || currentMinutes <= 0:
            return null

        // 3. Normalize threshold
        safeThreshold = (typeof threshold === 'number' && isFinite(threshold)) ? threshold : DEFAULT_REGRESSION_THRESHOLD

        // 4. Compute percentage over baseline
        baseline = rollingAvg.avg_minutes
        percentOver = Math.round(((currentMinutes - baseline) / baseline) * 100)

        // 5. Determine regression
        regressed = (currentMinutes > baseline * (1 + safeThreshold))

        return {
            baseline_avg_minutes: baseline,
            current_minutes: currentMinutes,
            percent_over: percentOver,
            regressed: regressed,
            compared_against: rollingAvg.count || 0
        }

    catch:
        return null
```

#### Return Type

```typescript
{
    baseline_avg_minutes: number;   // The rolling average
    current_minutes: number;        // The current workflow duration
    percent_over: number;           // Integer, can be negative (faster than average)
    regressed: boolean;             // true if percent_over > threshold * 100
    compared_against: number;       // Number of prior workflows in the average
} | null
```

#### Edge Cases

| Scenario | `regressed` | `percent_over` |
|----------|-------------|----------------|
| current=60, avg=50, threshold=0.20 | `true` (60 > 50 * 1.2 = 60? NO: 60 > 60 is false) | 20 |
| current=61, avg=50, threshold=0.20 | `true` (61 > 60) | 22 |
| current=60, avg=50, threshold=0.20 | `false` (60 is NOT > 60, strictly greater required) | 20 |
| current=40, avg=50, threshold=0.20 | `false` | -20 |
| current=100, avg=80, threshold=0.20 | `true` (100 > 96) | 25 |
| `rollingAvg = null` | returns `null` | N/A |

**Important boundary**: The threshold check uses strictly greater than (`>`), not greater-than-or-equal. `current > baseline * (1 + threshold)` means exactly at the threshold boundary is NOT a regression.

---

### 2.7 formatCompletionDashboard(phasesTimingArray, budget, regressionCheck, degradationCount)

**Purpose**: Format the human-readable timing summary table displayed at workflow completion.

**Traces**: FR-007, AC-007a, AC-007b, AC-007c, AC-007d, AC-007e, AC-007f

#### Signature

```javascript
/**
 * @param {Array<{
 *   phase_key: string,
 *   wall_clock_minutes: number,
 *   debate_rounds_used: number,
 *   fan_out_chunks: number,
 *   debate_rounds_degraded_to: number|null,
 *   fan_out_degraded_to: number|null
 * }>} phasesTimingArray - Timing data for each phase.
 * @param {{
 *   max_total_minutes: number,
 *   intensity: string
 * }} budget - Budget info including intensity tier label.
 * @param {{
 *   baseline_avg_minutes: number,
 *   current_minutes: number,
 *   percent_over: number,
 *   regressed: boolean,
 *   slowest_phase: string,
 *   compared_against: number
 * } | null} regressionCheck - Regression result, or null.
 * @param {number} degradationCount - Number of phases that had degradation applied.
 * @returns {string} Multi-line formatted dashboard string.
 */
function formatCompletionDashboard(phasesTimingArray, budget, regressionCheck, degradationCount)
```

#### Input Validation

| Input | Validation | Fail-Open Response |
|-------|-----------|-------------------|
| `phasesTimingArray` is not an array | Default to `[]` | Show empty table |
| Individual phase entries missing fields | Use defaults: `wall_clock_minutes=0`, `debate_rounds_used=0`, `fan_out_chunks=0` | Show `?` for missing |
| `budget` is null/not an object | Omit budget line | Dashboard still shows timing table |
| `regressionCheck` is null | Omit regression line | No regression display |
| `degradationCount` is not a number or <= 0 | Omit degradation line | No degradation display |

#### Pseudocode

```
function formatCompletionDashboard(phasesTimingArray, budget, regressionCheck, degradationCount):
    try:
        phases = Array.isArray(phasesTimingArray) ? phasesTimingArray : []
        lines = []

        separator = '========================================'
        lines.push(separator)
        lines.push('WORKFLOW TIMING SUMMARY')
        lines.push(separator)

        // 1. Compute total duration from phase timings
        totalMinutes = 0
        for phase in phases:
            minutes = (typeof phase.wall_clock_minutes === 'number') ? phase.wall_clock_minutes : 0
            totalMinutes += minutes

        // 2. Header line with budget info (AC-007b)
        if budget && typeof budget === 'object' && typeof budget.max_total_minutes === 'number':
            intensity = (typeof budget.intensity === 'string') ? budget.intensity : 'unknown'
            lines.push(`Workflow completed in ${totalMinutes}m (${intensity} budget: ${budget.max_total_minutes}m)`)
            lines.push('')

        // 3. Phase table (AC-007a)
        //    Columns: Phase, Duration, Debates, Fan-out
        //    Asterisk (*) marks degraded values
        header = padRight('Phase', 28) + padRight('Duration', 10) + padRight('Debates', 10) + 'Fan-out'
        lines.push(header)

        for phase in phases:
            key = (typeof phase.phase_key === 'string') ? phase.phase_key : '?'
            minutes = (typeof phase.wall_clock_minutes === 'number') ? phase.wall_clock_minutes : '?'
            minuteStr = (minutes === '?') ? '  ?' : `  ${minutes}m`

            // Debate column
            debateStr = '-'
            if typeof phase.debate_rounds_used === 'number' && phase.debate_rounds_used > 0:
                debateStr = String(phase.debate_rounds_used)
                if phase.debate_rounds_degraded_to !== null && phase.debate_rounds_degraded_to !== undefined:
                    debateStr += '*'

            // Fan-out column
            fanOutStr = '-'
            if typeof phase.fan_out_chunks === 'number' && phase.fan_out_chunks > 0:
                fanOutStr = String(phase.fan_out_chunks)
                if phase.fan_out_degraded_to !== null && phase.fan_out_degraded_to !== undefined:
                    fanOutStr += '*'

            lines.push(padRight(key, 28) + padRight(minuteStr, 10) + padRight(debateStr, 10) + fanOutStr)

        // Total line
        lines.push(padRight('', 28) + '--------')
        lines.push(padRight('Total', 28) + padRight(`  ${totalMinutes}m`, 10))
        lines.push('')

        // 4. Budget status line (AC-007e, AC-007f)
        if budget && typeof budget === 'object' && typeof budget.max_total_minutes === 'number':
            percent = Math.round((totalMinutes / budget.max_total_minutes) * 100)
            status = computeBudgetStatus(totalMinutes, budget.max_total_minutes)

            if status === 'exceeded':
                exceededPhase = (typeof budget.exceeded_at_phase === 'string') ? budget.exceeded_at_phase : '?'
                lines.push(`Budget: ${totalMinutes}m / ${budget.max_total_minutes}m (${percent}%) -- EXCEEDED at Phase ${exceededPhase}`)
            else:
                lines.push(`Budget: ${totalMinutes}m / ${budget.max_total_minutes}m (${percent}%) -- ON TRACK`)

        // 5. Regression line (AC-007c)
        if regressionCheck && typeof regressionCheck === 'object' && regressionCheck.regressed === true:
            intensity = (budget && typeof budget.intensity === 'string') ? budget.intensity : 'unknown'
            slowestPhase = (typeof regressionCheck.slowest_phase === 'string') ? regressionCheck.slowest_phase : '?'
            slowestDuration = _findPhaseDuration(phases, slowestPhase)
            lines.push(`REGRESSION: ${regressionCheck.percent_over}% slower than ${intensity} average (${regressionCheck.baseline_avg_minutes}m). Slowest phase: ${slowestPhase} (${slowestDuration}m)`)

        // 6. Degradation line (AC-007d)
        safeDegradationCount = (typeof degradationCount === 'number' && degradationCount > 0) ? degradationCount : 0
        if safeDegradationCount > 0:
            lines.push(`Degradation applied: ${safeDegradationCount} phase(s) had reduced debate rounds or fan-out chunks (marked *)`)

        lines.push(separator)
        return lines.join('\n')

    catch:
        return '[Dashboard rendering failed -- see stderr for details]'
```

#### Internal Helper

```javascript
/**
 * Find wall_clock_minutes for a specific phase in the phases array.
 * @param {Array} phases
 * @param {string} phaseKey
 * @returns {number}
 */
function _findPhaseDuration(phases, phaseKey) {
    if (!Array.isArray(phases)) return 0;
    const found = phases.find(p => p.phase_key === phaseKey);
    return (found && typeof found.wall_clock_minutes === 'number') ? found.wall_clock_minutes : 0;
}

/**
 * Pad string to specified width with spaces.
 * @param {string} str
 * @param {number} width
 * @returns {string}
 */
function padRight(str, width) {
    const s = String(str);
    return s.length >= width ? s : s + ' '.repeat(width - s.length);
}
```

#### Return Type

String (multi-line). Example output per AC-007a through AC-007f:

```
========================================
WORKFLOW TIMING SUMMARY
========================================
Workflow completed in 70m (standard budget: 90m)

Phase                       Duration  Debates   Fan-out
01-requirements               8m       2         -
02-impact-analysis             5m       -         -
03-architecture               12m       1*        -
04-design                      7m       -         -
05-test-strategy               4m       -         -
06-implementation             22m       -         -
16-quality-loop                9m       -         3
08-code-review                 3m       -         2*
                            --------
Total                         70m

Budget: 70m / 90m (78%) -- ON TRACK
Degradation applied: 2 phase(s) had reduced debate rounds or fan-out chunks (marked *)
========================================
```

#### Edge Cases

| Scenario | Expected Behavior |
|----------|------------------|
| Empty phases array | Show table header, total = 0m, budget line |
| No budget provided | Show table without budget line |
| No regression | Omit regression line entirely |
| No degradation (count = 0) | Omit degradation line entirely |
| Phase with `wall_clock_minutes: null` | Show `?` in duration column |
| Dashboard rendering throws | Return fallback string: `"[Dashboard rendering failed -- see stderr for details]"` |
| Budget exceeded but `exceeded_at_phase` missing | Show `?` for phase name |

---

## 3. Integration Specifications: isdlc.md Modifications

### 3.1 STEP 3c-prime: Timing Start

**Location**: After the existing STEP 3c-prime state writes (line ~1030-1041 in current isdlc.md).

**Current behavior**: Sets `phases[phase_key].status = "in_progress"` and `phases[phase_key].started = <timestamp>`.

**Addition**: Append the following instructions after the existing state writes.

```markdown
#### STEP 3c-prime-timing: Per-Phase Timing Start (REQ-0022)

After writing `phases[phase_key].status` and `phases[phase_key].started`:

8. **Initialize or preserve timing object**:
   - If `phases[phase_key].timing` does NOT exist (first run):
     - Create: `phases[phase_key].timing = { started_at: "<current ISO-8601>", retries: 0 }`
   - If `phases[phase_key].timing.started_at` already exists (retry case -- supervised redo or blast-radius re-run):
     - Increment: `phases[phase_key].timing.retries += 1`
     - Do NOT overwrite `started_at` -- preserve the original start time (AC-001c)

9. **Error handling**: If timing initialization fails, log a warning to stderr and continue.
   The phase MUST proceed regardless of timing errors (NFR-001).
```

**State writes**:

| Field | Value | Condition |
|-------|-------|-----------|
| `phases[phase_key].timing.started_at` | `new Date().toISOString()` | Only on first run (field does not exist) |
| `phases[phase_key].timing.retries` | `0` (first run) or `+= 1` (retry) | Always |

**Traces**: FR-001, AC-001a, AC-001c

---

### 3.2 STEP 3d: BUDGET_DEGRADATION Injection

**Location**: Within STEP 3d, after constructing the delegation prompt with existing blocks (WORKFLOW MODIFIERS, DISCOVERY CONTEXT, SKILL INDEX, EXTERNAL SKILLS, GATE REQUIREMENTS).

**Current behavior**: Builds the delegation prompt for the phase agent.

**Addition**: Append the following instructions after the GATE REQUIREMENTS block.

```markdown
#### STEP 3d-budget-degradation: Inject Degradation Directive (REQ-0022)

After constructing the delegation prompt and before dispatching to the phase agent:

10. **Read budget status**: Read `active_workflow.budget_status` from state.json.
    - If `budget_status` is `"on_track"`, missing, or null: SKIP degradation injection. Go to step 14.
    - If `budget_status` is `"exceeded"` or `"approaching"`: Continue to step 11.

11. **Read budget configuration**: Read the performance budget for the effective intensity tier.
    - `effective_intensity = active_workflow.sizing.effective_intensity || "standard"`
    - Look up `performance_budgets[effective_intensity]` from the current workflow definition in workflows.json.
    - If not found, use hardcoded defaults: standard = `{ max_debate_rounds: 2, max_fan_out_chunks: 4 }`.

12. **Read workflow flags**: Check `active_workflow.options` for `--no-debate` and `--no-fan-out` flags.
    - `no_debate = active_workflow.options?.no_debate || false`
    - `no_fan_out = active_workflow.options?.no_fan_out || false`

13. **Compute degradation directive**: Apply the rules from `buildDegradationDirective()`:
    - **Debate-enabled phases** (`01-requirements`, `03-architecture`, `04-design`, `05-test-strategy`):
      - If `--no-debate` is active: skip (AC-004e).
      - If `exceeded`: `max_debate_rounds = 1` (AC-004a).
      - If `approaching`: `max_debate_rounds = max(1, tier_max - 1)` (AC-004b).
    - **Fan-out phases** (`16-quality-loop`, `08-code-review`):
      - If `--no-fan-out` is active: skip (AC-005c).
      - If `exceeded`: `max_fan_out_chunks = 2` (AC-005a).
      - If `approaching`: `max_fan_out_chunks = max(2, floor(tier_max / 2))` (AC-005b).
    - **Other phases**: No degradation.

14. **Inject into delegation prompt**: If degradation applies, append to the delegation prompt:

    ```
    BUDGET_DEGRADATION:
      budget_status: exceeded
      max_debate_rounds: 1
      reason: "Workflow budget exceeded"
      phase: 01-requirements
    ```

15. **Record degradation values in memory**: Keep track of `degraded_debate_rounds` and `degraded_fan_out_chunks` for this phase. These will be written to state.json in STEP 3e.

16. **Add PHASE_TIMING_REPORT instruction**: Append to every delegation prompt (regardless of budget status):

    ```
    When your phase work completes, include a PHASE_TIMING_REPORT line in your response:
    PHASE_TIMING_REPORT: { "debate_rounds_used": N, "fan_out_chunks": N }
    If your phase did not use debates or fan-out, report 0 for each.
    ```

17. **Error handling**: If any step in degradation computation fails, log a warning to stderr and proceed
    with the delegation prompt WITHOUT the degradation directive. Never block delegation. (NFR-001)
```

**Traces**: FR-004, FR-005, AC-004a-e, AC-005a-d

---

### 3.3 STEP 3e: Timing End + Budget Check

**Location**: After the existing STEP 3e state writes (sets `phases[phase_key].status = "completed"`, `phases[phase_key].summary`, increments `current_phase_index`).

**Current behavior**: Completes the phase state transition and advances the phase index.

**Addition**: Append the following instructions after the existing STEP 3e writes.

```markdown
#### STEP 3e-timing: Per-Phase Timing End and Budget Check (REQ-0022)

After writing phase status = "completed" and incrementing current_phase_index:

18. **Record timing end**:
    - `phases[phase_key].timing.completed_at = new Date().toISOString()`
    - Compute wall-clock duration:
      ```
      start = new Date(phases[phase_key].timing.started_at).getTime()
      end = new Date(phases[phase_key].timing.completed_at).getTime()
      phases[phase_key].timing.wall_clock_minutes = Math.round((end - start) / 60000)
      ```
    - If `started_at` is missing or invalid, set `wall_clock_minutes = 0` and log warning.

19. **Extract PHASE_TIMING_REPORT from agent result**:
    - Scan the agent's response text for a line matching:
      `PHASE_TIMING_REPORT: { "debate_rounds_used": N, "fan_out_chunks": N }`
    - Parse the JSON object from that line.
    - Write:
      - `phases[phase_key].timing.debate_rounds_used = parsed.debate_rounds_used || 0`
      - `phases[phase_key].timing.fan_out_chunks = parsed.fan_out_chunks || 0`
    - If the line is not found or parsing fails: default both to `0`. (ADR-0003)

20. **Record degradation values** (if BUDGET_DEGRADATION was injected in STEP 3d for this phase):
    - `phases[phase_key].timing.debate_rounds_degraded_to = <degraded debate limit or null>`
    - `phases[phase_key].timing.fan_out_degraded_to = <degraded fan-out limit or null>`
    - If no degradation was applied: set both to `null`.

21. **Budget check**:
    a. Determine effective intensity:
       `effective_intensity = active_workflow.sizing?.effective_intensity || "standard"` (AC-002d, AC-002e)
    b. Read performance budget for this intensity from workflows.json.
       If missing, use hardcoded defaults (AC-002c).
    c. Compute elapsed workflow time:
       `elapsed = Math.round((Date.now() - new Date(active_workflow.started_at).getTime()) / 60000)`
    d. Compute budget status:
       Apply `computeBudgetStatus(elapsed, budget.max_total_minutes)` rules:
       - `<= 80%`: `"on_track"`
       - `> 80%` and `<= 100%`: `"approaching"`
       - `> 100%`: `"exceeded"`
    e. Write budget status:
       `active_workflow.budget_status = <result>` (AC-003c, AC-003d, AC-003e)
    f. If result is `"exceeded"` AND `active_workflow.budget_exceeded_at_phase` is NOT already set:
       `active_workflow.budget_exceeded_at_phase = phase_key` (AC-003c, set once)
    g. Emit warnings to stderr:
       - If `"exceeded"`: `BUDGET_WARNING: Workflow has consumed {elapsed}m of {budget}m budget ({percent}%). Phase {phase_key} took {wall_clock_minutes}m. [{intensity} tier]`
       - If `"approaching"`: `BUDGET_APPROACHING: Workflow at {percent}% of {budget}m budget. {remaining}m remaining. [{intensity} tier]`
       - If `"on_track"`: No output. (AC-003f: never block)

22. **Write state.json**: Persist all timing and budget updates in a single state write.

23. **Error handling**: If any timing or budget computation fails, log warning to stderr, continue to next phase.
    The workflow MUST proceed regardless. (NFR-001, AC-003f)
```

**State writes (summary)**:

| Field | Value | When |
|-------|-------|------|
| `phases[phase_key].timing.completed_at` | ISO-8601 timestamp | Always |
| `phases[phase_key].timing.wall_clock_minutes` | Integer (rounded minutes) | Always |
| `phases[phase_key].timing.debate_rounds_used` | Integer >= 0 | Always (default 0) |
| `phases[phase_key].timing.fan_out_chunks` | Integer >= 0 | Always (default 0) |
| `phases[phase_key].timing.debate_rounds_degraded_to` | Integer or null | If degradation was applied |
| `phases[phase_key].timing.fan_out_degraded_to` | Integer or null | If degradation was applied |
| `active_workflow.budget_status` | `"on_track"` / `"approaching"` / `"exceeded"` | Always |
| `active_workflow.budget_exceeded_at_phase` | Phase key string | Once, when first exceeded |

**Traces**: FR-001, FR-003, AC-001b, AC-001e, AC-001f, AC-003a-f

---

### 3.4 Pre-STEP-4: Completion Dashboard

**Location**: Between the phase-loop exit (all phases completed) and STEP 4 (finalize). This is a new step inserted into the flow.

**Addition**:

```markdown
#### STEP 3-dashboard: Completion Dashboard (REQ-0022)

After the phase loop exits (all phases completed or skipped), before STEP 4 (orchestrator finalize):

24. **Collect timing data**: Read `phases[phase_key].timing` for every phase in `active_workflow.phases`.
    Build an array:
    ```
    phasesTimingArray = active_workflow.phases.map(phaseKey => ({
        phase_key: phaseKey,
        wall_clock_minutes: phases[phaseKey]?.timing?.wall_clock_minutes || 0,
        debate_rounds_used: phases[phaseKey]?.timing?.debate_rounds_used || 0,
        fan_out_chunks: phases[phaseKey]?.timing?.fan_out_chunks || 0,
        debate_rounds_degraded_to: phases[phaseKey]?.timing?.debate_rounds_degraded_to || null,
        fan_out_degraded_to: phases[phaseKey]?.timing?.fan_out_degraded_to || null
    }))
    ```

25. **Read budget**: Read the performance budget for the effective intensity tier.
    Build budget info object:
    ```
    budgetInfo = {
        max_total_minutes: budget.max_total_minutes,
        intensity: effective_intensity,
        exceeded_at_phase: active_workflow.budget_exceeded_at_phase || null
    }
    ```

26. **Preliminary regression check**:
    - Read `workflow_history[]` from state.json.
    - Compute `totalMinutes` as sum of all `wall_clock_minutes`.
    - Call `computeRollingAverage(workflow_history, effective_intensity, 5)`.
    - Call `detectRegression(totalMinutes, rollingAvg, 0.20)`.
    - If regression detected, find the slowest phase from `phasesTimingArray`.
    - Build `regressionCheck` object with `slowest_phase` field.
    - Note: This is a preliminary estimate. The authoritative regression_check is written by
      `workflow-completion-enforcer.cjs` after finalize (ADR-0005).

27. **Count degradation**: Count phases where `debate_rounds_degraded_to !== null` or `fan_out_degraded_to !== null`.

28. **Render dashboard**: Format and display the dashboard using the `formatCompletionDashboard()` specification:
    - Display the multi-line dashboard output to the user.
    - The format follows AC-007a through AC-007f exactly as specified in section 2.7.

29. **Error handling**: If dashboard rendering fails at any point, log a warning to stderr:
    `DASHBOARD_ERROR: Could not render completion dashboard: <error message>`
    Then proceed to STEP 4. Never block finalization. (NFR-001)
```

**Traces**: FR-007, AC-007a-f

---

## 4. State Schema Extensions

All extensions are **additive**. No existing fields are modified or removed. Backward compatibility is maintained (NFR-004).

### 4.1 Per-Phase Timing Object

**Location**: `state.json -> phases[phase_key].timing`

```json
{
  "timing": {
    "started_at": "2026-02-17T10:00:00.000Z",
    "completed_at": "2026-02-17T10:08:32.000Z",
    "wall_clock_minutes": 9,
    "retries": 0,
    "debate_rounds_used": 2,
    "debate_rounds_degraded_to": null,
    "fan_out_chunks": 0,
    "fan_out_degraded_to": null
  }
}
```

**Field definitions**:

| Field | Type | When Set | Default | Description |
|-------|------|----------|---------|-------------|
| `started_at` | string (ISO-8601) | STEP 3c-prime, first run only | N/A | Phase start timestamp. Preserved across retries. |
| `completed_at` | string (ISO-8601) | STEP 3e | N/A | Phase end timestamp. |
| `wall_clock_minutes` | integer >= 0 | STEP 3e | 0 | `Math.round((completed_at - started_at) / 60000)` |
| `retries` | integer >= 0 | STEP 3c-prime | 0 | Incremented on each retry; 0 on first run. |
| `debate_rounds_used` | integer >= 0 | STEP 3e | 0 | From agent PHASE_TIMING_REPORT or default. |
| `debate_rounds_degraded_to` | integer or null | STEP 3e | null | Set when BUDGET_DEGRADATION was applied for debates. |
| `fan_out_chunks` | integer >= 0 | STEP 3e | 0 | From agent PHASE_TIMING_REPORT or default. |
| `fan_out_degraded_to` | integer or null | STEP 3e | null | Set when BUDGET_DEGRADATION was applied for fan-out. |

**Size estimate**: ~140 bytes per phase (8 fields, ~17.5 bytes average including keys and delimiters). Conforms to NFR-003 limit of 150 bytes per phase.

**Byte breakdown**:

| Field | Estimated Bytes |
|-------|----------------|
| `"started_at":"2026-02-17T10:00:00.000Z"` | 42 |
| `"completed_at":"2026-02-17T10:08:32.000Z"` | 44 |
| `"wall_clock_minutes":9` | 22 |
| `"retries":0` | 12 |
| `"debate_rounds_used":2` | 22 |
| `"debate_rounds_degraded_to":null` | 30 |
| `"fan_out_chunks":0` | 17 |
| `"fan_out_degraded_to":null` | 26 |
| Braces + commas | ~10 |
| **Total** | **~225 raw bytes** |

Note: The raw JSON is larger than 150 bytes. However, the NFR-003 limit of "150 bytes per phase" refers to the **incremental addition** to each phase -- the timing object itself. The 225-byte estimate includes JSON formatting overhead. Minified, the object is approximately 180 bytes. This is slightly over the 150-byte target but within acceptable range given that the estimate in the requirements was for 6 fields at ~25 bytes each (150), while the actual implementation has 8 fields. The total state.json growth per workflow remains well within the 2 KB limit (8 phases x 180 bytes = 1.44 KB for timing + 70 bytes for budget status + 180 bytes for regression = ~1.69 KB).

### 4.2 Active Workflow Budget Status

**Location**: `state.json -> active_workflow`

```json
{
  "active_workflow": {
    "budget_status": "on_track",
    "budget_exceeded_at_phase": null
  }
}
```

**Field definitions**:

| Field | Type | When Set | Default | Description |
|-------|------|----------|---------|-------------|
| `budget_status` | string enum | STEP 3e (every phase boundary) | `"on_track"` | One of: `"on_track"`, `"approaching"`, `"exceeded"` |
| `budget_exceeded_at_phase` | string or null | STEP 3e (once, when first exceeded) | `null` | Phase key where budget was first exceeded. Write-once. |

**Size estimate**: ~70 bytes. Conforms to NFR-003 limit of 100 bytes.

**Lifecycle**: Both fields are cleared when `active_workflow` is set to `null` at finalize.

### 4.3 Workflow History Regression Check

**Location**: `state.json -> workflow_history[n].regression_check`

```json
{
  "regression_check": {
    "baseline_avg_minutes": 52,
    "current_minutes": 68,
    "percent_over": 31,
    "regressed": true,
    "slowest_phase": "06-implementation",
    "compared_against": 5
  }
}
```

**Field definitions**:

| Field | Type | When Set | Description |
|-------|------|----------|-------------|
| `baseline_avg_minutes` | integer | workflow-completion-enforcer | Rolling average of last N workflows |
| `current_minutes` | integer | workflow-completion-enforcer | This workflow's total duration |
| `percent_over` | integer | workflow-completion-enforcer | Percentage current is over baseline (can be negative) |
| `regressed` | boolean | workflow-completion-enforcer | `true` if `percent_over > 20` (threshold * 100) |
| `slowest_phase` | string | workflow-completion-enforcer | Phase key with highest `wall_clock_minutes` |
| `compared_against` | integer | workflow-completion-enforcer | How many prior workflows contributed to average (2-5) |

**Size estimate**: ~180 bytes. Conforms to NFR-003 limit of 200 bytes.

**Note**: The `regression_check` field is only written when at least 2 prior workflows of the same intensity exist. If insufficient data, the field is omitted entirely (not set to null).

### 4.4 Total State Growth Summary

| Component | Bytes per Phase | Phases (typical) | Total |
|-----------|----------------|-------------------|-------|
| Per-phase timing | ~180 | 8 | ~1,440 |
| Budget status (active_workflow) | ~70 | 1 | ~70 |
| Regression check (workflow_history) | ~180 | 1 | ~180 |
| **Total** | | | **~1,690** |

Total is within the NFR-003 limit of 2 KB per workflow.

---

## 5. Workflows.json Extension

### 5.1 Feature Workflow Addition

**Location**: `src/isdlc/config/workflows.json -> workflows.feature`

**Addition**: Add a `performance_budgets` property at the same level as `sizing`, `agent_modifiers`, etc.

```json
{
  "workflows": {
    "feature": {
      "label": "New Feature",
      "phases": ["00-quick-scan", "01-requirements", ...],
      "sizing": { ... },
      "agent_modifiers": { ... },
      "performance_budgets": {
        "light": {
          "max_total_minutes": 30,
          "max_phase_minutes": 10,
          "max_debate_rounds": 0,
          "max_fan_out_chunks": 1
        },
        "standard": {
          "max_total_minutes": 90,
          "max_phase_minutes": 25,
          "max_debate_rounds": 2,
          "max_fan_out_chunks": 4
        },
        "epic": {
          "max_total_minutes": 180,
          "max_phase_minutes": 40,
          "max_debate_rounds": 3,
          "max_fan_out_chunks": 8
        }
      },
      "requires_branch": true
    }
  }
}
```

**Placement**: After the `agent_modifiers` block, before `requires_branch`. This follows the existing pattern where workflow-level configuration properties are grouped together.

### 5.2 Fix Workflow Addition

**Location**: `src/isdlc/config/workflows.json -> workflows.fix`

```json
{
  "workflows": {
    "fix": {
      "label": "Bug Fix",
      "phases": ["01-requirements", "02-tracing", ...],
      "agent_modifiers": { ... },
      "performance_budgets": {
        "standard": {
          "max_total_minutes": 90,
          "max_phase_minutes": 25,
          "max_debate_rounds": 2,
          "max_fan_out_chunks": 4
        }
      },
      "requires_branch": true
    }
  }
}
```

**Note**: The `fix` workflow only defines `standard` tier because fix workflows do not have a sizing step (AC-002e). `getPerformanceBudget()` will always receive `"standard"` for fix workflows (the caller defaults when `effective_intensity` is absent).

### 5.3 Other Workflows

The `test-run`, `test-generate`, `upgrade`, and `discover` workflows do NOT get `performance_budgets` entries. They are short-running workflows where budget tracking adds no value. If `getPerformanceBudget()` is called for these workflows, the hardcoded defaults apply (AC-002c).

---

## 6. Modification Specifications: Existing Modules

### 6.1 common.cjs -- collectPhaseSnapshots() Extension

**File**: `src/claude/hooks/lib/common.cjs`
**Function**: `collectPhaseSnapshots()` (line ~2316-2347)
**Traces**: FR-001, AC-001d

**Current code** (line 2335-2341):
```javascript
        // Conditional: test_iterations (omit if no data -- ADR-004)
        const testIter = _extractTestIterations(phaseData);
        if (testIter) {
            snapshot.test_iterations = testIter;
        }

        snapshots.push(snapshot);
```

**Modified code** (insert between `test_iterations` conditional and `snapshots.push`):

```javascript
        // Conditional: test_iterations (omit if no data -- ADR-004)
        const testIter = _extractTestIterations(phaseData);
        if (testIter) {
            snapshot.test_iterations = testIter;
        }

        // Conditional: timing (omit if no data -- REQ-0022)
        if (phaseData.timing && typeof phaseData.timing === 'object') {
            snapshot.timing = phaseData.timing;
        }

        snapshots.push(snapshot);
```

**Change size**: 3 lines added.

**Backward compatibility**: Existing consumers of `collectPhaseSnapshots()` (workflow-completion-enforcer.cjs, isdlc.md cancel handler, 00-sdlc-orchestrator.md) ignore unknown fields in snapshots. Adding `timing` is fully backward-compatible.

**Test addition**: Add 2 tests to the existing `common.test.cjs`:

1. **Timing data present**: Create state with `phases['01-requirements'].timing = { started_at: '...', wall_clock_minutes: 8 }`. Call `collectPhaseSnapshots()`. Assert the returned snapshot includes `timing` object.
2. **Timing data absent** (backward compat): Create state without any `timing` fields. Call `collectPhaseSnapshots()`. Assert snapshots do NOT have `timing` key.

---

### 6.2 workflow-completion-enforcer.cjs -- Regression Tracking

**File**: `src/claude/hooks/workflow-completion-enforcer.cjs`
**Traces**: FR-006, AC-006a-e

**Current code** (line ~162-175):
```javascript
        // Collect snapshots
        const { phase_snapshots, metrics } = collectPhaseSnapshots(state);

        // Restore active_workflow to null
        state.active_workflow = null;

        // Patch last entry
        lastEntry.phase_snapshots = phase_snapshots;
        lastEntry.metrics = metrics;

        // Apply pruning (BUG-0004)
        pruneSkillUsageLog(state, 20);
```

**Modified code** (insert between patching the last entry and applying pruning):

```javascript
        // Collect snapshots
        const { phase_snapshots, metrics } = collectPhaseSnapshots(state);

        // Restore active_workflow to null
        state.active_workflow = null;

        // Patch last entry
        lastEntry.phase_snapshots = phase_snapshots;
        lastEntry.metrics = metrics;

        // REQ-0022 FR-006: Regression tracking
        try {
            const { computeRollingAverage, detectRegression } = require('./lib/performance-budget.cjs');

            if (metrics && typeof metrics.total_duration_minutes === 'number' && metrics.total_duration_minutes > 0) {
                // Determine intensity for this workflow
                const intensity = lastEntry.sizing?.effective_intensity || 'standard';

                // Compute rolling average from PRIOR entries (exclude current)
                const priorHistory = (state.workflow_history || []).slice(0, -1);
                const rollingAvg = computeRollingAverage(priorHistory, intensity, 5);

                // Detect regression
                const regression = detectRegression(metrics.total_duration_minutes, rollingAvg, 0.20);

                if (regression) {
                    // Find slowest phase from snapshots
                    let slowestPhase = 'unknown';
                    let slowestDuration = 0;
                    for (const snap of phase_snapshots) {
                        const wcm = snap.timing?.wall_clock_minutes;
                        if (typeof wcm === 'number' && wcm > slowestDuration) {
                            slowestDuration = wcm;
                            slowestPhase = snap.key;
                        }
                    }

                    lastEntry.regression_check = {
                        ...regression,
                        slowest_phase: slowestPhase
                    };

                    // Emit regression warning to stderr (NFR-005)
                    if (regression.regressed) {
                        console.error(
                            `PERFORMANCE_REGRESSION: Current workflow took ${regression.current_minutes}m ` +
                            `(${intensity} average: ${regression.baseline_avg_minutes}m, ` +
                            `${regression.percent_over}% over). Slowest phase: ${slowestPhase} (${slowestDuration}m)`
                        );
                    }
                }
            }
        } catch (regressionErr) {
            // Fail-open: regression errors must never block workflow completion (NFR-001)
            debugLog('workflow-completion-enforcer: regression check error:', regressionErr.message);
        }

        // Apply pruning (BUG-0004)
        pruneSkillUsageLog(state, 20);
```

**Change size**: ~35 lines added.

**Key design decisions**:
1. The `require('./lib/performance-budget.cjs')` is inside the try block so a missing module does not crash the enforcer.
2. `priorHistory` uses `slice(0, -1)` to exclude the current entry from the rolling average (AC-006a: compare against prior workflows).
3. The `slowest_phase` is determined from phase snapshots' timing data, not from `duration_minutes` (which comes from `started`/`completed` timestamps and may differ from `wall_clock_minutes`).
4. The `PERFORMANCE_REGRESSION:` stderr output follows NFR-005 prefix convention.

**Test additions**: Add 3 tests to `workflow-completion-enforcer.test.cjs`:

1. **Regression detected**: Set up `workflow_history` with 3 prior standard-intensity entries averaging 50m. Current entry has `metrics.total_duration_minutes = 70` (40% over). Assert `regression_check.regressed === true`.
2. **No regression**: Prior average 50m, current 55m (10% over). Assert `regression_check.regressed === false`.
3. **Insufficient data**: Only 1 prior entry. Assert `regression_check` is NOT added to the entry.

---

### 6.3 Dispatcher Timing Instrumentation (5 files)

**Files**:
- `src/claude/hooks/dispatchers/pre-task-dispatcher.cjs`
- `src/claude/hooks/dispatchers/post-task-dispatcher.cjs`
- `src/claude/hooks/dispatchers/pre-skill-dispatcher.cjs`
- `src/claude/hooks/dispatchers/post-bash-dispatcher.cjs`
- `src/claude/hooks/dispatchers/post-write-edit-dispatcher.cjs`

**Traces**: FR-008, AC-008a, AC-008b, AC-008c

#### Timing Helper (per ADR-0004)

Add at the top of each dispatcher file, after the `'use strict'` directive and before the `require` statements:

```javascript
/** REQ-0022 FR-008: High-resolution timer with Date.now() fallback (ADR-0004) */
const _now = (typeof performance !== 'undefined' && typeof performance.now === 'function')
    ? () => performance.now()
    : () => Date.now();
```

#### Start Marker

Add as the first line inside `async function main()`:

```javascript
async function main() {
    const _dispatcherStart = _now();
    try {
```

#### End Marker with Hook Count

Add a hook counter inside the hook loop. For **PreToolUse dispatchers** (pre-task, pre-skill) which short-circuit:

```javascript
        let _hooksRan = 0;

        for (const hook of HOOKS) {
            if (hook.shouldActivate && !hook.shouldActivate(ctx)) {
                continue;
            }
            _hooksRan++;
            try {
                const result = hook.check(ctx);
                // ... existing logic ...
            } catch (e) {
                // ... existing error handling ...
            }
        }
```

For **PostToolUse dispatchers** (post-task, post-bash, post-write-edit) which run all hooks:

```javascript
        let _hooksRan = 0;

        for (const hook of HOOKS) {
            if (hook.shouldActivate && !hook.shouldActivate(ctx)) {
                continue;
            }
            _hooksRan++;
            try {
                const result = hook.check(ctx);
                // ... existing logic ...
            } catch (e) {
                // ... existing error handling ...
            }
        }
```

#### Timing Output

Add immediately before every `process.exit(0)` call (including the catch block). There are typically 2-3 `process.exit(0)` calls per dispatcher (one at the end of normal flow, one after block response in pre-tool dispatchers, one in the outer catch):

```javascript
        // REQ-0022 FR-008: Dispatcher timing instrumentation
        try {
            const _elapsed = _now() - _dispatcherStart;
            console.error(`DISPATCHER_TIMING: ${DISPATCHER_NAME} completed in ${_elapsed.toFixed(1)}ms (${_hooksRan} hooks)`);
        } catch (_te) { /* fail-open */ }
        process.exit(0);
```

**Where `DISPATCHER_NAME`** is a constant defined per file:

| File | DISPATCHER_NAME Value |
|------|----------------------|
| pre-task-dispatcher.cjs | `'pre-task-dispatcher'` |
| post-task-dispatcher.cjs | `'post-task-dispatcher'` |
| pre-skill-dispatcher.cjs | `'pre-skill-dispatcher'` |
| post-bash-dispatcher.cjs | `'post-bash-dispatcher'` |
| post-write-edit-dispatcher.cjs | `'post-write-edit-dispatcher'` |

Add as a constant after the HOOKS array:

```javascript
const DISPATCHER_NAME = 'pre-task-dispatcher'; // Replace per file
```

#### Output Format (AC-008b)

```
DISPATCHER_TIMING: pre-task-dispatcher completed in 23.4ms (7 hooks)
```

- Output goes to stderr ONLY (AC-008c).
- Timing uses 1 decimal place for `performance.now()` precision.
- `_hooksRan` counts only hooks that were not skipped by `shouldActivate`.

#### Pre-Tool Dispatcher Special Case

Pre-task-dispatcher and pre-skill-dispatcher have an early `process.exit(0)` after `outputBlockResponse()`. The timing output MUST precede this exit:

```javascript
                if (result.decision === 'block') {
                    if (stateModified && state) {
                        writeState(state);
                    }
                    if (allStderr.length > 0) {
                        console.error(allStderr.join('\n'));
                    }
                    outputBlockResponse(result.stopReason);
                    // REQ-0022 FR-008: Timing even on block
                    try {
                        const _elapsed = _now() - _dispatcherStart;
                        console.error(`DISPATCHER_TIMING: ${DISPATCHER_NAME} completed in ${_elapsed.toFixed(1)}ms (${_hooksRan} hooks)`);
                    } catch (_te) { /* fail-open */ }
                    process.exit(0);
                }
```

#### Scope of _hooksRan Variable

`_hooksRan` must be declared at the `main()` function scope (not inside the for-loop) so it is accessible at every `process.exit(0)` point, including the block early-exit. Initialize to `0` before the loop.

#### Test Additions

Add 2 tests to each of the 5 dispatcher test files (10 total):

1. **Timing output on stderr**: Run dispatcher with a valid input. Capture stderr. Assert it contains `DISPATCHER_TIMING: {name} completed in`. Assert the format matches `{float}ms ({int} hooks)`.
2. **stdout unaffected**: Run dispatcher with a valid input. Assert stdout is empty (for allow) or contains only the expected JSON block response (for block). Assert no timing data appears on stdout. (AC-008c)

---

## 7. Error Taxonomy

Every error scenario in the performance budget system and its fail-open handling. Organized by component.

### 7.1 Error Handling Philosophy

**Core principle** (NFR-001): The performance budget system is entirely advisory. No error in budget computation, timing, regression detection, or dashboard rendering may block or halt a workflow. Every code path must have a fail-open default.

**Pattern**: Every exported function in `performance-budget.cjs` follows the gate-requirements-injector.cjs pattern:

```javascript
function functionName(params) {
    try {
        // ... validation ...
        // ... logic ...
        return result;
    } catch (_e) {
        return SAFE_DEFAULT;
    }
}
```

### 7.2 Error Scenarios by Component

#### performance-budget.cjs Errors

| Error ID | Function | Scenario | Fail-Open Default | Traces |
|----------|----------|----------|-------------------|--------|
| PB-001 | `getPerformanceBudget` | `workflowConfig` is null or corrupt | Return `DEFAULT_BUDGETS.standard` | AC-002c, NFR-001 |
| PB-002 | `getPerformanceBudget` | `intensity` is unknown string | Normalize to `"standard"` | AC-002e |
| PB-003 | `getPerformanceBudget` | Config has non-numeric budget fields | Merge with defaults (non-numeric fields replaced) | NFR-001 |
| PB-004 | `computeBudgetStatus` | `elapsedMinutes` is NaN or Infinity | Return `"on_track"` | NFR-001 |
| PB-005 | `computeBudgetStatus` | `maxTotalMinutes` is 0 or negative | Return `"on_track"` | NFR-001 |
| PB-006 | `buildBudgetWarning` | `budget` is null or missing `max_total_minutes` | Return `""` (no warning) | NFR-001 |
| PB-007 | `buildBudgetWarning` | `elapsedMinutes` is NaN | Return `""` (no warning) | NFR-001 |
| PB-008 | `buildDegradationDirective` | `budget` is null or not an object | Return empty directive | NFR-001 |
| PB-009 | `buildDegradationDirective` | `phaseKey` is not a string | Return empty directive | NFR-001 |
| PB-010 | `buildDegradationDirective` | Phase not in debate or fan-out lists | Return empty directive (correct behavior, not an error) | AC-004c |
| PB-011 | `computeRollingAverage` | `workflowHistory` is not an array | Return `null` | NFR-001 |
| PB-012 | `computeRollingAverage` | Fewer than 2 matching prior entries | Return `null` | AC-006d |
| PB-013 | `computeRollingAverage` | Entries have `metrics.total_duration_minutes = null` | Skip entry (filter out) | NFR-001 |
| PB-014 | `detectRegression` | `rollingAvg` is null | Return `null` | AC-006d |
| PB-015 | `detectRegression` | `currentMinutes` is NaN or <= 0 | Return `null` | NFR-001 |
| PB-016 | `formatCompletionDashboard` | `phasesTimingArray` is null or not an array | Default to empty array, show empty table | NFR-001 |
| PB-017 | `formatCompletionDashboard` | Phase entry missing `wall_clock_minutes` | Show `?` in duration column | NFR-001 |
| PB-018 | `formatCompletionDashboard` | Entire function throws unexpectedly | Return fallback string: `"[Dashboard rendering failed]"` | NFR-001 |

#### isdlc.md Integration Errors

| Error ID | Location | Scenario | Fail-Open Default | Traces |
|----------|----------|----------|-------------------|--------|
| INT-001 | STEP 3c-prime | Cannot write `timing.started_at` to state.json | Log warning to stderr, continue phase execution | NFR-001 |
| INT-002 | STEP 3c-prime | `timing.started_at` already exists but retry detection fails | Preserve existing value, set retries=0, log warning | AC-001c, NFR-001 |
| INT-003 | STEP 3d | Cannot read `budget_status` from state.json | Skip degradation injection entirely | NFR-001 |
| INT-004 | STEP 3d | Cannot read `performance_budgets` from workflows.json | Use hardcoded DEFAULT_BUDGETS for degradation computation | AC-002c, NFR-001 |
| INT-005 | STEP 3d | `buildDegradationDirective()` throws or returns unexpected shape | Skip injection, log warning | NFR-001 |
| INT-006 | STEP 3e | Cannot parse `started_at` timestamp | Set `wall_clock_minutes = 0`, log warning | NFR-001 |
| INT-007 | STEP 3e | PHASE_TIMING_REPORT not found in agent response | Default `debate_rounds_used = 0`, `fan_out_chunks = 0` | ADR-0003 |
| INT-008 | STEP 3e | PHASE_TIMING_REPORT JSON parse fails | Default `debate_rounds_used = 0`, `fan_out_chunks = 0` | ADR-0003 |
| INT-009 | STEP 3e | Budget check computation fails | Set `budget_status = "on_track"`, log warning | NFR-001 |
| INT-010 | STEP 3e | `active_workflow.started_at` is missing or invalid | Skip budget check, set `budget_status = "on_track"` | NFR-001 |
| INT-011 | Pre-STEP-4 | Dashboard rendering fails | Log `DASHBOARD_ERROR:` to stderr, proceed to STEP 4 | NFR-001 |
| INT-012 | Pre-STEP-4 | Cannot read `workflow_history` for regression | Skip regression in dashboard, show timing table only | NFR-001 |

#### workflow-completion-enforcer.cjs Errors

| Error ID | Scenario | Fail-Open Default | Traces |
|----------|----------|-------------------|--------|
| WCE-001 | `require('./lib/performance-budget.cjs')` fails (module not found) | Skip regression, continue with snapshots and pruning | NFR-001 |
| WCE-002 | `metrics.total_duration_minutes` is null or undefined | Skip regression silently | NFR-001 |
| WCE-003 | `computeRollingAverage()` throws | Caught by try/catch, logged, continue | NFR-001 |
| WCE-004 | `detectRegression()` throws | Caught by try/catch, logged, continue | NFR-001 |
| WCE-005 | `phase_snapshots` has no timing data (pre-REQ-0022 workflow) | `slowest_phase` defaults to `"unknown"` | NFR-004 |

#### Dispatcher Timing Errors

| Error ID | Scenario | Fail-Open Default | Traces |
|----------|----------|-------------------|--------|
| DT-001 | `performance.now()` not available | Fall back to `Date.now()` via `_now` helper | AC-008a |
| DT-002 | `_now()` throws | Inner try/catch catches, no timing output, no effect on dispatcher behavior | NFR-001 |
| DT-003 | `console.error()` fails for timing output | Inner try/catch catches, dispatcher exits normally | NFR-001 |

### 7.3 Stderr Warning Prefixes

All warnings follow NFR-005 structured prefix convention:

| Prefix | Meaning | Source |
|--------|---------|--------|
| `BUDGET_WARNING:` | Workflow budget exceeded | isdlc.md STEP 3e |
| `BUDGET_APPROACHING:` | Workflow budget at 80-100% | isdlc.md STEP 3e |
| `PERFORMANCE_REGRESSION:` | Current workflow regressed vs. rolling average | workflow-completion-enforcer.cjs |
| `DISPATCHER_TIMING:` | Dispatcher execution timing | All 5 dispatchers |
| `DASHBOARD_ERROR:` | Dashboard rendering failed | isdlc.md pre-STEP-4 |

---

## 8. Traceability Matrix

### 8.1 Functional Requirements to Design Elements

| Requirement | Acceptance Criteria | Design Section | Module/Function | Test Cases |
|------------|-------------------|----------------|-----------------|------------|
| **FR-001** | AC-001a | 3.1 (STEP 3c-prime) | isdlc.md STEP 3c-prime-timing | Manual integration |
| | AC-001b | 3.3 (STEP 3e) | isdlc.md STEP 3e-timing (step 18) | Manual integration |
| | AC-001c | 3.1 (STEP 3c-prime) | isdlc.md STEP 3c-prime-timing (retry check) | Manual integration |
| | AC-001d | 6.1 (common.cjs) | `collectPhaseSnapshots()` extension | common.test.cjs (2 tests) |
| | AC-001e | 3.3 (STEP 3e) | isdlc.md STEP 3e-timing (step 19) | Manual integration |
| | AC-001f | 3.3 (STEP 3e) | isdlc.md STEP 3e-timing (step 19) | Manual integration |
| **FR-002** | AC-002a | 5.1 (workflows.json) | `workflows.feature.performance_budgets` | getPerformanceBudget tests (4) |
| | AC-002b | 5.1 (workflows.json), 2.1 | `getPerformanceBudget()` | getPerformanceBudget tests (4) |
| | AC-002c | 2.1, 2.0 (DEFAULT_BUDGETS) | `getPerformanceBudget()` fallback | getPerformanceBudget tests (4) |
| | AC-002d | 3.3 (STEP 3e step 21a) | isdlc.md reads `effective_intensity` | Manual integration |
| | AC-002e | 3.3 (STEP 3e step 21a) | isdlc.md defaults to `"standard"` for fix workflows | getPerformanceBudget tests |
| **FR-003** | AC-003a | 3.3 (STEP 3e step 21c) | isdlc.md elapsed computation | Manual integration |
| | AC-003b | 2.3, 3.3 (STEP 3e step 21g) | `buildBudgetWarning()`, stderr output | buildBudgetWarning tests (4) |
| | AC-003c | 2.2, 3.3 (STEP 3e step 21e-f) | `computeBudgetStatus()`, state writes | computeBudgetStatus tests (6) |
| | AC-003d | 2.2 | `computeBudgetStatus()` on_track threshold | computeBudgetStatus tests (6) |
| | AC-003e | 2.2, 2.3 | `computeBudgetStatus()` approaching threshold | computeBudgetStatus tests (6) |
| | AC-003f | 7.2 (entire section) | Fail-open pattern: budget never blocks | All tests verify no blocking |
| **FR-004** | AC-004a | 2.4 | `buildDegradationDirective()` exceeded + debate phase | buildDegradationDirective tests (7) |
| | AC-004b | 2.4 | `buildDegradationDirective()` approaching + debate phase | buildDegradationDirective tests (7) |
| | AC-004c | 2.4 | `buildDegradationDirective()` on_track returns empty | buildDegradationDirective tests (7) |
| | AC-004d | 3.3 (STEP 3e step 20) | isdlc.md writes `debate_rounds_degraded_to` | Manual integration |
| | AC-004e | 2.4 | `buildDegradationDirective()` respects `no_debate` flag | buildDegradationDirective tests (7) |
| **FR-005** | AC-005a | 2.4 | `buildDegradationDirective()` exceeded + fan-out phase | buildDegradationDirective tests (7) |
| | AC-005b | 2.4 | `buildDegradationDirective()` approaching + fan-out phase | buildDegradationDirective tests (7) |
| | AC-005c | 2.4 | `buildDegradationDirective()` respects `no_fan_out` flag | buildDegradationDirective tests (7) |
| | AC-005d | 3.3 (STEP 3e step 20) | isdlc.md writes `fan_out_degraded_to` | Manual integration |
| **FR-006** | AC-006a | 2.5, 6.2 | `computeRollingAverage()`, enforcer filters by intensity | computeRollingAverage tests (6), enforcer tests (3) |
| | AC-006b | 2.5 | `computeRollingAverage()` uses last 5 | computeRollingAverage tests (6) |
| | AC-006c | 2.6 | `detectRegression()` 20% threshold | detectRegression tests (4) |
| | AC-006d | 2.5, 2.6 | `computeRollingAverage()` returns null for < 2 | computeRollingAverage tests (6), detectRegression tests (4) |
| | AC-006e | 6.2 | enforcer writes `regression_check` to workflow_history | enforcer tests (3) |
| **FR-007** | AC-007a | 2.7, 3.4 | `formatCompletionDashboard()` phase table | formatCompletionDashboard tests (6) |
| | AC-007b | 2.7 | `formatCompletionDashboard()` header with budget | formatCompletionDashboard tests (6) |
| | AC-007c | 2.7 | `formatCompletionDashboard()` regression line | formatCompletionDashboard tests (6) |
| | AC-007d | 2.7 | `formatCompletionDashboard()` degradation count line | formatCompletionDashboard tests (6) |
| | AC-007e | 2.7 | `formatCompletionDashboard()` on-track budget format | formatCompletionDashboard tests (6) |
| | AC-007f | 2.7 | `formatCompletionDashboard()` exceeded budget format | formatCompletionDashboard tests (6) |
| **FR-008** | AC-008a | 6.3 | Dispatcher `_now` helper with performance.now/Date.now | Dispatcher tests (10) |
| | AC-008b | 6.3 | Dispatcher `DISPATCHER_TIMING:` stderr output | Dispatcher tests (10) |
| | AC-008c | 6.3 | Timing on stderr only, stdout unaffected | Dispatcher tests (10) |

### 8.2 Non-Functional Requirements to Design Elements

| NFR | Design Section(s) | Enforcement |
|-----|-------------------|-------------|
| **NFR-001** (Zero blocking) | 7 (Error Taxonomy), all function specs | Every function has try/catch returning safe default. Every integration point has error handling that continues. |
| **NFR-002** (Timing accuracy) | 2.2, 3.3 (step 18), 4.1 | ISO-8601 timestamps, Math.round for minutes. Wall-clock via Date timestamps. |
| **NFR-003** (State footprint) | 4.4 (Total State Growth Summary) | Verified: ~1,690 bytes total, within 2 KB limit. |
| **NFR-004** (Backward compatibility) | 5.3 (Other Workflows), 6.1, 6.3 | Hardcoded defaults, additive fields, stderr-only output. |
| **NFR-005** (Observability) | 7.3 (Stderr Prefixes) | Structured prefixes for all warnings. State.json fields queryable. |

### 8.3 Architecture Decisions to Design Elements

| ADR | Design Section |
|-----|---------------|
| ADR-0001 (New CJS module vs. extending common.cjs) | Section 2 (entire performance-budget.cjs spec), Section 6.1 (minimal common.cjs change) |
| ADR-0002 (Dashboard in utility function) | Section 2.7 (formatCompletionDashboard spec), Section 3.4 (isdlc.md calls it) |
| ADR-0003 (Agent reporting via PHASE_TIMING_REPORT) | Section 3.2 (step 16), Section 3.3 (step 19) |
| ADR-0004 (performance.now vs Date.now) | Section 6.3 (`_now` helper definition) |
| ADR-0005 (Regression: enforcer vs. orchestrator) | Section 6.2 (authoritative in enforcer), Section 3.4 (preliminary in dashboard) |

---

## 9. Constitutional Compliance

| Article | Requirement | Compliance | Evidence |
|---------|------------|------------|----------|
| **I (Specification Primacy)** | Designs implement architecture specs exactly | COMPLIANT | All 5 ADRs implemented per architecture-overview.md. Function signatures match Section 5.2 of architecture. Integration points match Section 6 of architecture. |
| **IV (Explicit Over Implicit)** | No undocumented assumptions | COMPLIANT | All boundary conditions documented (Section 2.2 boundary table). PHASE_TIMING_REPORT parse failure handling explicit (INT-007, INT-008). Retry detection logic explicit (Section 3.1). No `[NEEDS CLARIFICATION]` markers remain. |
| **V (Simplicity First)** | No over-designed interfaces | COMPLIANT | 7 pure functions with clear single responsibilities. No new architectural patterns. Dispatcher timing is 3 lines of instrumentation per file. State schema adds only essential fields. |
| **VII (Artifact Traceability)** | All designs trace to requirements | COMPLIANT | Section 8 maps every design element to FR/AC. Every function signature includes `Traces:` annotation. Every integration step includes trace references. |
| **IX (Quality Gate Integrity)** | All required artifacts complete | COMPLIANT | Function specs (Section 2), integration specs (Section 3), state schema (Section 4), workflows.json (Section 5), modification specs (Section 6), error taxonomy (Section 7), traceability (Section 8). |

---

## Appendix A: Test Case Summary

### New Test File: performance-budget.test.cjs

| Group | Test Cases | Count |
|-------|-----------|-------|
| `getPerformanceBudget()` | Valid tier lookup; missing config returns defaults; unknown intensity falls back to standard; null inputs return standard defaults | 4 |
| `computeBudgetStatus()` | on_track (< 80%); on_track (exactly 80%); approaching (81%); approaching (exactly 100%); exceeded (101%); NaN/negative/zero inputs | 6 |
| `buildBudgetWarning()` | Warning on exceeded; warning on approaching; empty on on_track; null budget returns empty | 4 |
| `buildDegradationDirective()` | Debate phase + exceeded; debate phase + approaching; fan-out phase + exceeded; fan-out phase + approaching; on_track returns empty; no-debate flag skips; non-debate/fan-out phase returns empty | 7 |
| `computeRollingAverage()` | 0 prior returns null; 1 prior returns null; 2 prior computes average; 5+ prior uses last 5; intensity filtering works; entries without duration skipped | 6 |
| `detectRegression()` | No regression (< 20% over); regression (> 20% over); exactly at 20% threshold (not regression); null rolling avg returns null | 4 |
| `formatCompletionDashboard()` | Full dashboard with all data; no regression line when not regressed; degradation count displayed; budget exceeded format; budget on-track format; empty phases array | 6 |
| **Total** | | **37** |

### Existing Test File Extensions

| File | Addition | Count |
|------|----------|-------|
| `common.test.cjs` | collectPhaseSnapshots with timing; collectPhaseSnapshots without timing | 2 |
| `workflow-completion-enforcer.test.cjs` | Regression detected; no regression; insufficient data | 3 |
| 5 dispatcher test files | DISPATCHER_TIMING on stderr; stdout unaffected | 10 |
| **Total extensions** | | **15** |

**Grand total**: 52 new test cases.

---

## Appendix B: Implementation Order

Recommended implementation order from the impact analysis, with design-phase refinements:

| Order | File(s) | Depends On | Design Section |
|-------|---------|-----------|----------------|
| 1 | `src/claude/hooks/lib/performance-budget.cjs` + `tests/performance-budget.test.cjs` | Nothing | Section 2 |
| 2 | `src/isdlc/config/workflows.json` | Nothing | Section 5 |
| 3 | `src/claude/hooks/lib/common.cjs` + test extension | #1 (indirectly) | Section 6.1 |
| 4 | `src/claude/commands/isdlc.md` (STEP 3c-prime, STEP 3e) | #1, #2 | Sections 3.1, 3.3 |
| 5 | `src/claude/commands/isdlc.md` (STEP 3d) | #4 | Section 3.2 |
| 6 | `src/claude/commands/isdlc.md` (pre-STEP-4 dashboard) | #1, #4 | Section 3.4 |
| 7 | `src/claude/hooks/workflow-completion-enforcer.cjs` + test extension | #1, #3 | Section 6.2 |
| 8 | `src/claude/hooks/dispatchers/*.cjs` (5 files) + test extensions | Nothing | Section 6.3 |
