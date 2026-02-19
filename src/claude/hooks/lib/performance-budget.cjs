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

// =========================================================================
// Constants (exported as _constants for testability)
// =========================================================================

/** Default budget tiers when workflows.json config is missing (AC-002c) */
const DEFAULT_BUDGETS = {
    light: {
        max_total_minutes: 30,
        max_phase_minutes: 10,
        max_debate_rounds: 0,
        max_fan_out_chunks: 1
    },
    standard: {
        max_total_minutes: 90,
        max_phase_minutes: 25,
        max_debate_rounds: 2,
        max_fan_out_chunks: 4
    },
    epic: {
        max_total_minutes: 180,
        max_phase_minutes: 40,
        max_debate_rounds: 3,
        max_fan_out_chunks: 8
    }
};

/** Phases where debate-round degradation applies (AC-004a) */
const DEBATE_ENABLED_PHASES = ['01-requirements', '03-architecture', '04-design', '05-test-strategy'];

/** Phases where fan-out degradation applies (AC-005a) */
const FAN_OUT_PHASES = ['16-quality-loop', '08-code-review'];

/** Regression detection threshold: 20% over rolling average (AC-006c) */
const DEFAULT_REGRESSION_THRESHOLD = 0.20;

/** Maximum number of prior workflows for rolling average (AC-006b) */
const DEFAULT_MAX_PRIOR = 5;

/** Budget approaching threshold: 80% of total budget (AC-003d, AC-003e) */
const BUDGET_APPROACHING_THRESHOLD = 0.80;

// =========================================================================
// Internal Helpers
// =========================================================================

/** Returns value if it is a positive integer, otherwise null */
function validPositiveInt(v) {
    return (typeof v === 'number' && Number.isInteger(v) && v > 0) ? v : null;
}

/** Returns value if it is a non-negative integer (0 allowed for debate rounds), otherwise null */
function validNonNegInt(v) {
    return (typeof v === 'number' && Number.isInteger(v) && v >= 0) ? v : null;
}

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

// =========================================================================
// Exported Functions
// =========================================================================

/**
 * Look up the budget tier for a given intensity from the workflow configuration,
 * with hardcoded fallback defaults.
 *
 * Traces: FR-002, AC-002a, AC-002b, AC-002c, AC-002d, AC-002e
 *
 * @param {object|null} workflowConfig - Parsed workflow object (e.g., workflows.feature).
 *        Expected shape: { performance_budgets: { light: {...}, standard: {...}, epic: {...} } }
 * @param {string} intensity - One of "light", "standard", "epic".
 * @returns {{ max_total_minutes: number, max_phase_minutes: number,
 *             max_debate_rounds: number, max_fan_out_chunks: number }}
 */
function getPerformanceBudget(workflowConfig, intensity) {
    try {
        // 1. Normalize intensity
        const normalizedIntensity = (typeof intensity === 'string' && ['light', 'standard', 'epic'].includes(intensity))
            ? intensity
            : 'standard';

        // 2. Get defaults for this tier
        const defaults = DEFAULT_BUDGETS[normalizedIntensity];

        // 3. Attempt config lookup
        if (workflowConfig
            && typeof workflowConfig === 'object'
            && workflowConfig.performance_budgets
            && typeof workflowConfig.performance_budgets === 'object') {

            const configBudget = workflowConfig.performance_budgets[normalizedIntensity];

            if (configBudget && typeof configBudget === 'object') {
                // 4. Merge: config values override defaults, but only if valid numbers
                return {
                    max_total_minutes:  validPositiveInt(configBudget.max_total_minutes)  ?? defaults.max_total_minutes,
                    max_phase_minutes:  validPositiveInt(configBudget.max_phase_minutes)  ?? defaults.max_phase_minutes,
                    max_debate_rounds:  validNonNegInt(configBudget.max_debate_rounds)    ?? defaults.max_debate_rounds,
                    max_fan_out_chunks: validPositiveInt(configBudget.max_fan_out_chunks) ?? defaults.max_fan_out_chunks
                };
            }
        }

        // 5. Config missing or tier not found -- return defaults
        return { ...defaults };

    } catch (_e) {
        return { ...DEFAULT_BUDGETS.standard };
    }
}

/**
 * Determine the budget status classification based on elapsed workflow time
 * versus the total budget.
 *
 * Boundary semantics (derived from AC-003d and AC-003e):
 * - ratio <= 0.8  => "on_track"
 * - 0.8 < ratio <= 1.0 => "approaching"
 * - ratio > 1.0 => "exceeded"
 *
 * Traces: FR-003, AC-003c, AC-003d, AC-003e
 *
 * @param {number} elapsedMinutes - Elapsed workflow time in minutes.
 * @param {number} maxTotalMinutes - Budget limit in minutes.
 * @returns {"on_track" | "approaching" | "exceeded"}
 */
function computeBudgetStatus(elapsedMinutes, maxTotalMinutes) {
    try {
        if (typeof elapsedMinutes !== 'number' || !isFinite(elapsedMinutes)) {
            return 'on_track';
        }
        if (typeof maxTotalMinutes !== 'number' || !isFinite(maxTotalMinutes) || maxTotalMinutes <= 0) {
            return 'on_track';
        }

        const ratio = elapsedMinutes / maxTotalMinutes;

        if (ratio > 1.0) {
            return 'exceeded';
        }
        if (ratio > BUDGET_APPROACHING_THRESHOLD) {
            return 'approaching';
        }
        return 'on_track';

    } catch (_e) {
        return 'on_track';
    }
}

/**
 * Format a budget warning string for stderr output.
 * Returns an empty string when no warning is needed.
 *
 * Traces: FR-003, AC-003b, AC-003e
 *
 * @param {number} elapsedMinutes - Total elapsed workflow time in minutes.
 * @param {{ max_total_minutes: number }} budget - The performance budget object.
 * @param {string} phaseKey - The phase that just completed (e.g., "04-design").
 * @param {string} intensity - The intensity tier (e.g., "standard").
 * @param {number} phaseDuration - Duration of the just-completed phase in minutes.
 * @returns {string} Warning string for stderr, or empty string if no warning.
 */
function buildBudgetWarning(elapsedMinutes, budget, phaseKey, intensity, phaseDuration) {
    try {
        if (!budget || typeof budget.max_total_minutes !== 'number' || budget.max_total_minutes <= 0) {
            return '';
        }
        if (typeof elapsedMinutes !== 'number' || !isFinite(elapsedMinutes)) {
            return '';
        }

        const maxTotal = budget.max_total_minutes;
        const percent = Math.round((elapsedMinutes / maxTotal) * 100);
        const status = computeBudgetStatus(elapsedMinutes, maxTotal);

        const safePhaseKey = (typeof phaseKey === 'string') ? phaseKey : 'unknown';
        const safeIntensity = (typeof intensity === 'string') ? intensity : 'unknown';
        const safePhaseDuration = (typeof phaseDuration === 'number' && isFinite(phaseDuration)) ? phaseDuration : 0;

        if (status === 'exceeded') {
            return `BUDGET_WARNING: Workflow has consumed ${elapsedMinutes}m of ${maxTotal}m budget (${percent}%). Phase ${safePhaseKey} took ${safePhaseDuration}m. [${safeIntensity} tier]`;
        }

        if (status === 'approaching') {
            const remaining = maxTotal - elapsedMinutes;
            return `BUDGET_APPROACHING: Workflow at ${percent}% of ${maxTotal}m budget. ${Math.round(remaining)}m remaining. [${safeIntensity} tier]`;
        }

        return '';

    } catch (_e) {
        return '';
    }
}

/**
 * Generate the BUDGET_DEGRADATION text block to inject into an agent delegation prompt.
 * Returns an empty result when no degradation is needed.
 *
 * Traces: FR-004, FR-005, AC-004a, AC-004b, AC-004c, AC-004d, AC-004e, AC-005a, AC-005b, AC-005c, AC-005d
 *
 * @param {string} budgetStatus - One of "on_track", "approaching", "exceeded".
 * @param {{ max_debate_rounds: number, max_fan_out_chunks: number }} budget - The budget tier.
 * @param {string} phaseKey - The target phase for delegation (e.g., "01-requirements").
 * @param {{ no_debate?: boolean, no_fan_out?: boolean }} workflowFlags - Active workflow flags.
 * @returns {{ directive: string, degraded_debate_rounds: number|null, degraded_fan_out_chunks: number|null }}
 */
function buildDegradationDirective(budgetStatus, budget, phaseKey, workflowFlags) {
    try {
        const EMPTY = { directive: '', degraded_debate_rounds: null, degraded_fan_out_chunks: null };

        // 1. Guard: only degrade on exceeded or approaching
        if (budgetStatus !== 'exceeded' && budgetStatus !== 'approaching') {
            return EMPTY;
        }

        // 2. Guard: need budget and phaseKey
        if (!budget || typeof budget !== 'object') {
            return EMPTY;
        }
        if (typeof phaseKey !== 'string') {
            return EMPTY;
        }

        const flags = (workflowFlags && typeof workflowFlags === 'object') ? workflowFlags : {};

        const isDebatePhase = DEBATE_ENABLED_PHASES.includes(phaseKey);
        const isFanOutPhase = FAN_OUT_PHASES.includes(phaseKey);

        // 3. If phase is neither debate-enabled nor fan-out, no degradation applies
        if (!isDebatePhase && !isFanOutPhase) {
            return EMPTY;
        }

        let degradedDebate = null;
        let degradedFanOut = null;
        const directiveParts = [];

        // 4. Debate degradation
        if (isDebatePhase && !flags.no_debate) {
            const tierMax = (typeof budget.max_debate_rounds === 'number') ? budget.max_debate_rounds : 2;

            if (budgetStatus === 'exceeded') {
                degradedDebate = 1;                          // AC-004a: hard limit of 1
            } else {  // approaching
                degradedDebate = Math.max(1, tierMax - 1);   // AC-004b: tier_max - 1, minimum 1
            }

            directiveParts.push(`max_debate_rounds: ${degradedDebate}`);
        }

        // 5. Fan-out degradation
        if (isFanOutPhase && !flags.no_fan_out) {
            const tierMax = (typeof budget.max_fan_out_chunks === 'number') ? budget.max_fan_out_chunks : 4;

            if (budgetStatus === 'exceeded') {
                degradedFanOut = 2;                                     // AC-005a: hard limit of 2
            } else {  // approaching
                degradedFanOut = Math.max(2, Math.floor(tierMax / 2));  // AC-005b: floor(tier_max/2), minimum 2
            }

            directiveParts.push(`max_fan_out_chunks: ${degradedFanOut}`);
        }

        // 6. If nothing to degrade (e.g., flags disabled relevant degradation), return empty
        if (directiveParts.length === 0) {
            return EMPTY;
        }

        // 7. Build directive text
        const reason = budgetStatus === 'exceeded'
            ? 'Workflow budget exceeded'
            : 'Workflow budget approaching limit';

        const directive = [
            'BUDGET_DEGRADATION:',
            `  budget_status: ${budgetStatus}`,
            ...directiveParts.map(p => `  ${p}`),
            `  reason: "${reason}"`,
            `  phase: ${phaseKey}`
        ].join('\n');

        return { directive, degraded_debate_rounds: degradedDebate, degraded_fan_out_chunks: degradedFanOut };

    } catch (_e) {
        return { directive: '', degraded_debate_rounds: null, degraded_fan_out_chunks: null };
    }
}

/**
 * Compute the rolling average total duration from the last N completed workflows
 * of the same intensity tier. Returns null if insufficient data (fewer than 2 matching workflows).
 *
 * Traces: FR-006, AC-006a, AC-006b, AC-006d
 *
 * @param {Array} workflowHistory - Array of workflow_history entries.
 * @param {string} intensity - Intensity tier to filter by (e.g., "standard").
 * @param {number} [maxPrior=5] - Maximum number of prior workflows to include.
 * @returns {{ avg_minutes: number, count: number } | null}
 *          null if fewer than 2 matching prior workflows.
 */
function computeRollingAverage(workflowHistory, intensity, maxPrior) {
    try {
        if (!Array.isArray(workflowHistory) || workflowHistory.length === 0) {
            return null;
        }

        const normalizedIntensity = (typeof intensity === 'string' && intensity.length > 0)
            ? intensity
            : 'standard';

        const safePrior = (typeof maxPrior === 'number' && Number.isInteger(maxPrior) && maxPrior > 0)
            ? maxPrior
            : DEFAULT_MAX_PRIOR;

        // 1. Filter entries by matching intensity tier (reverse order, most recent first)
        const matching = [];
        for (let i = workflowHistory.length - 1; i >= 0; i--) {
            const entry = workflowHistory[i];
            if (!entry || typeof entry !== 'object') continue;

            const entryIntensity = entry.sizing?.effective_intensity || 'standard';
            if (entryIntensity === normalizedIntensity) {
                const duration = entry.metrics?.total_duration_minutes;
                if (typeof duration === 'number' && isFinite(duration) && duration > 0) {
                    matching.push(duration);
                }
                if (matching.length >= safePrior) {
                    break;
                }
            }
        }

        // 2. Guard: need at least 2 matching entries (AC-006d)
        if (matching.length < 2) {
            return null;
        }

        // 3. Compute average
        const sum = matching.reduce((a, b) => a + b, 0);
        const avg = Math.round(sum / matching.length);

        return { avg_minutes: avg, count: matching.length };

    } catch (_e) {
        return null;
    }
}

/**
 * Compare the current workflow duration against the rolling average.
 * Returns a regression result object, or null if no comparison is possible.
 *
 * Traces: FR-006, AC-006c, AC-006d, AC-006e
 *
 * @param {number} currentMinutes - The current workflow's total duration in minutes.
 * @param {{ avg_minutes: number, count: number } | null} rollingAvg - From computeRollingAverage().
 * @param {number} [threshold=0.20] - Regression threshold as a decimal (e.g., 0.20 = 20%).
 * @returns {{ baseline_avg_minutes: number, current_minutes: number, percent_over: number,
 *             regressed: boolean, compared_against: number } | null}
 */
function detectRegression(currentMinutes, rollingAvg, threshold) {
    try {
        // 1. Guard: need valid rolling average
        if (rollingAvg === null || typeof rollingAvg !== 'object') {
            return null;
        }
        if (typeof rollingAvg.avg_minutes !== 'number' || !isFinite(rollingAvg.avg_minutes) || rollingAvg.avg_minutes <= 0) {
            return null;
        }

        // 2. Guard: need valid current duration
        if (typeof currentMinutes !== 'number' || !isFinite(currentMinutes) || currentMinutes <= 0) {
            return null;
        }

        // 3. Normalize threshold
        const safeThreshold = (typeof threshold === 'number' && isFinite(threshold)) ? threshold : DEFAULT_REGRESSION_THRESHOLD;

        // 4. Compute percentage over baseline
        const baseline = rollingAvg.avg_minutes;
        const percentOver = Math.round(((currentMinutes - baseline) / baseline) * 100);

        // 5. Determine regression (strictly greater than)
        const regressed = (currentMinutes > baseline * (1 + safeThreshold));

        return {
            baseline_avg_minutes: baseline,
            current_minutes: currentMinutes,
            percent_over: percentOver,
            regressed: regressed,
            compared_against: rollingAvg.count || 0
        };

    } catch (_e) {
        return null;
    }
}

/**
 * Format the human-readable timing summary table displayed at workflow completion.
 *
 * Traces: FR-007, AC-007a, AC-007b, AC-007c, AC-007d, AC-007e, AC-007f
 *
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
 *   intensity: string,
 *   exceeded_at_phase?: string
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
function formatCompletionDashboard(phasesTimingArray, budget, regressionCheck, degradationCount) {
    try {
        const phases = Array.isArray(phasesTimingArray) ? phasesTimingArray : [];
        const lines = [];

        const separator = '========================================';
        lines.push(separator);
        lines.push('WORKFLOW TIMING SUMMARY');
        lines.push(separator);

        // 1. Compute total duration from phase timings
        let totalMinutes = 0;
        for (const phase of phases) {
            const minutes = (typeof phase.wall_clock_minutes === 'number') ? phase.wall_clock_minutes : 0;
            totalMinutes += minutes;
        }

        // 2. Header line with budget info (AC-007b)
        if (budget && typeof budget === 'object' && typeof budget.max_total_minutes === 'number') {
            const intensityLabel = (typeof budget.intensity === 'string') ? budget.intensity : 'unknown';
            lines.push(`Workflow completed in ${totalMinutes}m (${intensityLabel} budget: ${budget.max_total_minutes}m)`);
            lines.push('');
        }

        // 3. Phase table (AC-007a)
        const header = padRight('Phase', 28) + padRight('Duration', 10) + padRight('Debates', 10) + 'Fan-out';
        lines.push(header);

        for (const phase of phases) {
            const key = (typeof phase.phase_key === 'string') ? phase.phase_key : '?';
            const minutes = (typeof phase.wall_clock_minutes === 'number') ? phase.wall_clock_minutes : '?';
            const minuteStr = (minutes === '?') ? '  ?' : `  ${minutes}m`;

            // Debate column
            let debateStr = '-';
            if (typeof phase.debate_rounds_used === 'number' && phase.debate_rounds_used > 0) {
                debateStr = String(phase.debate_rounds_used);
                if (phase.debate_rounds_degraded_to !== null && phase.debate_rounds_degraded_to !== undefined) {
                    debateStr += '*';
                }
            }

            // Fan-out column
            let fanOutStr = '-';
            if (typeof phase.fan_out_chunks === 'number' && phase.fan_out_chunks > 0) {
                fanOutStr = String(phase.fan_out_chunks);
                if (phase.fan_out_degraded_to !== null && phase.fan_out_degraded_to !== undefined) {
                    fanOutStr += '*';
                }
            }

            lines.push(padRight(key, 28) + padRight(minuteStr, 10) + padRight(debateStr, 10) + fanOutStr);
        }

        // Total line
        lines.push(padRight('', 28) + '--------');
        lines.push(padRight('Total', 28) + padRight(`  ${totalMinutes}m`, 10));
        lines.push('');

        // 4. Budget status line (AC-007e, AC-007f)
        if (budget && typeof budget === 'object' && typeof budget.max_total_minutes === 'number') {
            const percent = Math.round((totalMinutes / budget.max_total_minutes) * 100);
            const status = computeBudgetStatus(totalMinutes, budget.max_total_minutes);

            if (status === 'exceeded') {
                const exceededPhase = (typeof budget.exceeded_at_phase === 'string') ? budget.exceeded_at_phase : '?';
                lines.push(`Budget: ${totalMinutes}m / ${budget.max_total_minutes}m (${percent}%) -- EXCEEDED at Phase ${exceededPhase}`);
            } else {
                lines.push(`Budget: ${totalMinutes}m / ${budget.max_total_minutes}m (${percent}%) -- ON TRACK`);
            }
        }

        // 5. Regression line (AC-007c)
        if (regressionCheck && typeof regressionCheck === 'object' && regressionCheck.regressed === true) {
            const intensityLabel = (budget && typeof budget.intensity === 'string') ? budget.intensity : 'unknown';
            const slowestPhase = (typeof regressionCheck.slowest_phase === 'string') ? regressionCheck.slowest_phase : '?';
            const slowestDuration = _findPhaseDuration(phases, slowestPhase);
            lines.push(`REGRESSION: ${regressionCheck.percent_over}% slower than ${intensityLabel} average (${regressionCheck.baseline_avg_minutes}m). Slowest phase: ${slowestPhase} (${slowestDuration}m)`);
        }

        // 6. Degradation line (AC-007d)
        const safeDegradationCount = (typeof degradationCount === 'number' && degradationCount > 0) ? degradationCount : 0;
        if (safeDegradationCount > 0) {
            lines.push(`Degradation applied: ${safeDegradationCount} phase(s) had reduced debate rounds or fan-out chunks (marked *)`);
        }

        lines.push(separator);
        return lines.join('\n');

    } catch (_e) {
        return '[Dashboard rendering failed -- see stderr for details]';
    }
}

// =========================================================================
// Module Exports
// =========================================================================

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
