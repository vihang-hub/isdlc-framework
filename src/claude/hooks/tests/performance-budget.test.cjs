'use strict';

/**
 * Tests for performance-budget.cjs
 * Traces to: REQ-0022 (Performance Budget and Guardrail System)
 *
 * Uses node:test + node:assert/strict (project CJS test pattern).
 * 37 unit tests covering all 7 exported functions.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

// ---------------------------------------------------------------------------
// Load the module under test
// ---------------------------------------------------------------------------

function loadModule() {
    const modPath = path.resolve(__dirname, '..', 'lib', 'performance-budget.cjs');
    delete require.cache[modPath];
    return require(modPath);
}

// ---------------------------------------------------------------------------
// Test: getPerformanceBudget (4 tests) -- FR-002, AC-002a-e
// ---------------------------------------------------------------------------

describe('getPerformanceBudget', () => {
    it('should return config budget for valid tier lookup', () => {
        const mod = loadModule();
        const config = {
            performance_budgets: {
                standard: {
                    max_total_minutes: 100,
                    max_phase_minutes: 30,
                    max_debate_rounds: 3,
                    max_fan_out_chunks: 5
                }
            }
        };
        const result = mod.getPerformanceBudget(config, 'standard');
        assert.deepStrictEqual(result, {
            max_total_minutes: 100,
            max_phase_minutes: 30,
            max_debate_rounds: 3,
            max_fan_out_chunks: 5
        });
    });

    it('should return hardcoded defaults when config is missing', () => {
        const mod = loadModule();
        const result = mod.getPerformanceBudget({}, 'epic');
        assert.deepStrictEqual(result, mod._constants.DEFAULT_BUDGETS.epic);
    });

    it('should normalize unknown intensity to standard', () => {
        const mod = loadModule();
        const config = {
            performance_budgets: {
                standard: {
                    max_total_minutes: 100,
                    max_phase_minutes: 30,
                    max_debate_rounds: 3,
                    max_fan_out_chunks: 5
                }
            }
        };
        const result = mod.getPerformanceBudget(config, 'unknown');
        assert.strictEqual(result.max_total_minutes, 100);
    });

    it('should return standard defaults for null inputs', () => {
        const mod = loadModule();
        const result = mod.getPerformanceBudget(null, null);
        assert.deepStrictEqual(result, mod._constants.DEFAULT_BUDGETS.standard);
    });
});

// ---------------------------------------------------------------------------
// Test: computeBudgetStatus (6 tests) -- FR-003, AC-003c-e
// ---------------------------------------------------------------------------

describe('computeBudgetStatus', () => {
    it('should return on_track when below 80%', () => {
        const mod = loadModule();
        assert.strictEqual(mod.computeBudgetStatus(70, 90), 'on_track');
    });

    it('should return on_track when exactly at 80% (ratio <= 0.8)', () => {
        const mod = loadModule();
        // 72 / 90 = 0.8 exactly
        assert.strictEqual(mod.computeBudgetStatus(72, 90), 'on_track');
    });

    it('should return approaching when above 80% but at or below 100%', () => {
        const mod = loadModule();
        // 72.1 / 90 = 0.8011... (just above 0.8)
        assert.strictEqual(mod.computeBudgetStatus(72.1, 90), 'approaching');
    });

    it('should return approaching when exactly at 100% (ratio <= 1.0)', () => {
        const mod = loadModule();
        assert.strictEqual(mod.computeBudgetStatus(90, 90), 'approaching');
    });

    it('should return exceeded when above 100%', () => {
        const mod = loadModule();
        assert.strictEqual(mod.computeBudgetStatus(91, 90), 'exceeded');
    });

    it('should return on_track for NaN, negative, and zero inputs', () => {
        const mod = loadModule();
        assert.strictEqual(mod.computeBudgetStatus(NaN, 90), 'on_track');
        assert.strictEqual(mod.computeBudgetStatus(50, 0), 'on_track');
        assert.strictEqual(mod.computeBudgetStatus(50, -10), 'on_track');
        assert.strictEqual(mod.computeBudgetStatus(Infinity, 90), 'on_track');
        assert.strictEqual(mod.computeBudgetStatus(50, NaN), 'on_track');
    });
});

// ---------------------------------------------------------------------------
// Test: buildBudgetWarning (4 tests) -- FR-003, AC-003b, AC-003e
// ---------------------------------------------------------------------------

describe('buildBudgetWarning', () => {
    it('should return warning string when budget exceeded', () => {
        const mod = loadModule();
        const result = mod.buildBudgetWarning(95, { max_total_minutes: 90 }, '06-implementation', 'standard', 22);
        assert.strictEqual(result, 'BUDGET_WARNING: Workflow has consumed 95m of 90m budget (106%). Phase 06-implementation took 22m. [standard tier]');
    });

    it('should return approaching string when budget approaching', () => {
        const mod = loadModule();
        const result = mod.buildBudgetWarning(75, { max_total_minutes: 90 }, '04-design', 'standard', 7);
        assert.strictEqual(result, 'BUDGET_APPROACHING: Workflow at 83% of 90m budget. 15m remaining. [standard tier]');
    });

    it('should return empty string when on track', () => {
        const mod = loadModule();
        const result = mod.buildBudgetWarning(50, { max_total_minutes: 90 }, '03-architecture', 'standard', 12);
        assert.strictEqual(result, '');
    });

    it('should return empty string for null budget or NaN elapsed', () => {
        const mod = loadModule();
        assert.strictEqual(mod.buildBudgetWarning(50, null, 'x', 'y', 5), '');
        assert.strictEqual(mod.buildBudgetWarning(NaN, { max_total_minutes: 90 }, 'x', 'y', 5), '');
    });
});

// ---------------------------------------------------------------------------
// Test: buildDegradationDirective (7 tests) -- FR-004, FR-005, AC-004a-e, AC-005a-d
// ---------------------------------------------------------------------------

describe('buildDegradationDirective', () => {
    const standardBudget = { max_debate_rounds: 2, max_fan_out_chunks: 4 };
    const epicBudget = { max_debate_rounds: 3, max_fan_out_chunks: 8 };
    const lightBudget = { max_debate_rounds: 0, max_fan_out_chunks: 1 };

    it('should return debate degradation for exceeded + debate phase', () => {
        const mod = loadModule();
        const result = mod.buildDegradationDirective('exceeded', standardBudget, '01-requirements', {});
        assert.strictEqual(result.degraded_debate_rounds, 1);
        assert.strictEqual(result.degraded_fan_out_chunks, null);
        assert.ok(result.directive.includes('BUDGET_DEGRADATION:'));
        assert.ok(result.directive.includes('max_debate_rounds: 1'));
    });

    it('should return debate degradation for approaching + debate phase', () => {
        const mod = loadModule();
        const result = mod.buildDegradationDirective('approaching', epicBudget, '03-architecture', {});
        assert.strictEqual(result.degraded_debate_rounds, 2); // max(1, 3-1) = 2
        assert.ok(result.directive.includes('max_debate_rounds: 2'));
    });

    it('should return fan-out degradation for exceeded + fan-out phase', () => {
        const mod = loadModule();
        const result = mod.buildDegradationDirective('exceeded', standardBudget, '16-quality-loop', {});
        assert.strictEqual(result.degraded_fan_out_chunks, 2);
        assert.strictEqual(result.degraded_debate_rounds, null);
        assert.ok(result.directive.includes('max_fan_out_chunks: 2'));
    });

    it('should return fan-out degradation for approaching + fan-out phase', () => {
        const mod = loadModule();
        const result = mod.buildDegradationDirective('approaching', epicBudget, '08-code-review', {});
        assert.strictEqual(result.degraded_fan_out_chunks, 4); // max(2, floor(8/2)) = 4
        assert.ok(result.directive.includes('max_fan_out_chunks: 4'));
    });

    it('should return empty for on_track status', () => {
        const mod = loadModule();
        const result = mod.buildDegradationDirective('on_track', standardBudget, '01-requirements', {});
        assert.strictEqual(result.directive, '');
        assert.strictEqual(result.degraded_debate_rounds, null);
        assert.strictEqual(result.degraded_fan_out_chunks, null);
    });

    it('should skip debate degradation when no_debate flag is set', () => {
        const mod = loadModule();
        const result = mod.buildDegradationDirective('exceeded', standardBudget, '01-requirements', { no_debate: true });
        assert.strictEqual(result.directive, '');
        assert.strictEqual(result.degraded_debate_rounds, null);
    });

    it('should return empty for non-debate/non-fan-out phase', () => {
        const mod = loadModule();
        const result = mod.buildDegradationDirective('exceeded', standardBudget, '06-implementation', {});
        assert.strictEqual(result.directive, '');
        assert.strictEqual(result.degraded_debate_rounds, null);
        assert.strictEqual(result.degraded_fan_out_chunks, null);
    });
});

// ---------------------------------------------------------------------------
// Test: computeRollingAverage (6 tests) -- FR-006, AC-006a-b, AC-006d
// ---------------------------------------------------------------------------

describe('computeRollingAverage', () => {
    it('should return null for empty history', () => {
        const mod = loadModule();
        assert.strictEqual(mod.computeRollingAverage([], 'standard'), null);
    });

    it('should return null for only 1 matching workflow', () => {
        const mod = loadModule();
        const history = [
            { sizing: { effective_intensity: 'standard' }, metrics: { total_duration_minutes: 60 } }
        ];
        assert.strictEqual(mod.computeRollingAverage(history, 'standard'), null);
    });

    it('should compute average for 2 matching workflows', () => {
        const mod = loadModule();
        const history = [
            { sizing: { effective_intensity: 'standard' }, metrics: { total_duration_minutes: 60 } },
            { sizing: { effective_intensity: 'standard' }, metrics: { total_duration_minutes: 80 } }
        ];
        const result = mod.computeRollingAverage(history, 'standard');
        assert.deepStrictEqual(result, { avg_minutes: 70, count: 2 });
    });

    it('should use only last 5 when more than 5 matching workflows exist', () => {
        const mod = loadModule();
        const history = [];
        for (let i = 0; i < 7; i++) {
            history.push({ sizing: { effective_intensity: 'standard' }, metrics: { total_duration_minutes: 50 + i * 10 } });
        }
        // entries: 50, 60, 70, 80, 90, 100, 110
        // last 5 (reverse order): 110, 100, 90, 80, 70 => avg = (110+100+90+80+70)/5 = 90
        const result = mod.computeRollingAverage(history, 'standard', 5);
        assert.strictEqual(result.count, 5);
        assert.strictEqual(result.avg_minutes, 90);
    });

    it('should filter by intensity (only standard, not epic)', () => {
        const mod = loadModule();
        const history = [
            { sizing: { effective_intensity: 'standard' }, metrics: { total_duration_minutes: 60 } },
            { sizing: { effective_intensity: 'epic' }, metrics: { total_duration_minutes: 200 } },
            { sizing: { effective_intensity: 'standard' }, metrics: { total_duration_minutes: 80 } },
            { sizing: { effective_intensity: 'epic' }, metrics: { total_duration_minutes: 300 } }
        ];
        const result = mod.computeRollingAverage(history, 'standard');
        assert.deepStrictEqual(result, { avg_minutes: 70, count: 2 });
    });

    it('should skip entries without valid duration', () => {
        const mod = loadModule();
        const history = [
            { sizing: { effective_intensity: 'standard' }, metrics: { total_duration_minutes: 60 } },
            { sizing: { effective_intensity: 'standard' }, metrics: { total_duration_minutes: null } },
            { sizing: { effective_intensity: 'standard' }, metrics: { total_duration_minutes: 80 } }
        ];
        const result = mod.computeRollingAverage(history, 'standard');
        assert.deepStrictEqual(result, { avg_minutes: 70, count: 2 });
    });
});

// ---------------------------------------------------------------------------
// Test: detectRegression (4 tests) -- FR-006, AC-006c-e
// ---------------------------------------------------------------------------

describe('detectRegression', () => {
    it('should detect no regression when below threshold', () => {
        const mod = loadModule();
        const result = mod.detectRegression(55, { avg_minutes: 50, count: 3 }, 0.20);
        assert.strictEqual(result.regressed, false);
        assert.strictEqual(result.percent_over, 10);
    });

    it('should detect regression when above threshold', () => {
        const mod = loadModule();
        // 61 > 50 * 1.2 = 60: strictly greater, so regressed
        const result = mod.detectRegression(61, { avg_minutes: 50, count: 3 }, 0.20);
        assert.strictEqual(result.regressed, true);
        assert.strictEqual(result.percent_over, 22);
    });

    it('should NOT detect regression when exactly at threshold boundary', () => {
        const mod = loadModule();
        // 60 > 50 * 1.2 = 60? NO: 60 > 60 is false (strict greater)
        const result = mod.detectRegression(60, { avg_minutes: 50, count: 3 }, 0.20);
        assert.strictEqual(result.regressed, false);
        assert.strictEqual(result.percent_over, 20);
    });

    it('should return null when rollingAvg is null', () => {
        const mod = loadModule();
        assert.strictEqual(mod.detectRegression(60, null, 0.20), null);
    });
});

// ---------------------------------------------------------------------------
// Test: formatCompletionDashboard (6 tests) -- FR-007, AC-007a-f
// ---------------------------------------------------------------------------

describe('formatCompletionDashboard', () => {
    const samplePhases = [
        { phase_key: '01-requirements', wall_clock_minutes: 8, debate_rounds_used: 2, fan_out_chunks: 0, debate_rounds_degraded_to: null, fan_out_degraded_to: null },
        { phase_key: '06-implementation', wall_clock_minutes: 22, debate_rounds_used: 0, fan_out_chunks: 0, debate_rounds_degraded_to: null, fan_out_degraded_to: null },
        { phase_key: '16-quality-loop', wall_clock_minutes: 9, debate_rounds_used: 0, fan_out_chunks: 3, debate_rounds_degraded_to: null, fan_out_degraded_to: null }
    ];

    const sampleBudget = { max_total_minutes: 90, intensity: 'standard' };

    it('should render full dashboard with all data', () => {
        const mod = loadModule();
        const result = mod.formatCompletionDashboard(samplePhases, sampleBudget, null, 0);
        assert.ok(result.includes('WORKFLOW TIMING SUMMARY'));
        assert.ok(result.includes('Workflow completed in 39m (standard budget: 90m)'));
        assert.ok(result.includes('01-requirements'));
        assert.ok(result.includes('06-implementation'));
        assert.ok(result.includes('Budget: 39m / 90m'));
        assert.ok(result.includes('ON TRACK'));
    });

    it('should not show regression line when not regressed', () => {
        const mod = loadModule();
        const result = mod.formatCompletionDashboard(samplePhases, sampleBudget, null, 0);
        assert.ok(!result.includes('REGRESSION:'));
    });

    it('should show regression line when regressed', () => {
        const mod = loadModule();
        const regression = {
            baseline_avg_minutes: 50,
            current_minutes: 70,
            percent_over: 40,
            regressed: true,
            slowest_phase: '06-implementation',
            compared_against: 3
        };
        const result = mod.formatCompletionDashboard(samplePhases, sampleBudget, regression, 0);
        assert.ok(result.includes('REGRESSION: 40% slower than standard average (50m)'));
        assert.ok(result.includes('Slowest phase: 06-implementation'));
    });

    it('should show degradation count line', () => {
        const mod = loadModule();
        const result = mod.formatCompletionDashboard(samplePhases, sampleBudget, null, 2);
        assert.ok(result.includes('Degradation applied: 2 phase(s)'));
    });

    it('should show EXCEEDED format when budget exceeded', () => {
        const mod = loadModule();
        const exceededPhases = [
            { phase_key: '01-requirements', wall_clock_minutes: 50, debate_rounds_used: 0, fan_out_chunks: 0, debate_rounds_degraded_to: null, fan_out_degraded_to: null },
            { phase_key: '06-implementation', wall_clock_minutes: 60, debate_rounds_used: 0, fan_out_chunks: 0, debate_rounds_degraded_to: null, fan_out_degraded_to: null }
        ];
        const exceededBudget = { max_total_minutes: 90, intensity: 'standard', exceeded_at_phase: '06-implementation' };
        const result = mod.formatCompletionDashboard(exceededPhases, exceededBudget, null, 0);
        assert.ok(result.includes('EXCEEDED at Phase 06-implementation'));
    });

    it('should handle empty phases array gracefully', () => {
        const mod = loadModule();
        const result = mod.formatCompletionDashboard([], sampleBudget, null, 0);
        assert.ok(result.includes('WORKFLOW TIMING SUMMARY'));
        assert.ok(result.includes('Total'));
        assert.ok(result.includes('0m'));
    });
});

// ---------------------------------------------------------------------------
// Test: _constants export (1 bonus test for completeness)
// ---------------------------------------------------------------------------

describe('_constants', () => {
    it('should export frozen constants object with expected keys', () => {
        const mod = loadModule();
        assert.ok(mod._constants);
        assert.ok(Object.isFrozen(mod._constants));
        assert.ok(mod._constants.DEFAULT_BUDGETS);
        assert.ok(mod._constants.DEBATE_ENABLED_PHASES);
        assert.ok(mod._constants.FAN_OUT_PHASES);
        assert.strictEqual(mod._constants.DEFAULT_REGRESSION_THRESHOLD, 0.20);
        assert.strictEqual(mod._constants.DEFAULT_MAX_PRIOR, 5);
        assert.strictEqual(mod._constants.BUDGET_APPROACHING_THRESHOLD, 0.80);
    });
});
