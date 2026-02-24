# Test Cases: Performance Budget and Guardrail System

**REQ ID**: REQ-0025
**Artifact Folder**: REQ-0022-performance-budget-guardrails
**Phase**: 05-test-strategy
**Generated**: 2026-02-19
**Total Test Cases**: 52 (37 unit + 15 integration)

---

## 1. Unit Tests: performance-budget.test.cjs (37 tests)

**File**: `src/claude/hooks/tests/performance-budget.test.cjs`
**Pattern**: Direct `require()` of lib module, `node:test` + `node:assert/strict`

### 1.1 getPerformanceBudget() -- 4 Tests

#### TC-PB-01: Valid tier lookup from config

**Traces**: AC-002a, AC-002b

```javascript
it('TC-PB-01: returns config values for valid tier lookup', () => {
    const mod = loadModule();
    const config = {
        performance_budgets: {
            standard: {
                max_total_minutes: 120,
                max_phase_minutes: 30,
                max_debate_rounds: 3,
                max_fan_out_chunks: 6
            }
        }
    };
    const result = mod.getPerformanceBudget(config, 'standard');
    assert.deepStrictEqual(result, {
        max_total_minutes: 120,
        max_phase_minutes: 30,
        max_debate_rounds: 3,
        max_fan_out_chunks: 6
    });
});
```

#### TC-PB-02: Missing config returns defaults

**Traces**: AC-002c

```javascript
it('TC-PB-02: returns DEFAULT_BUDGETS.epic when config is null', () => {
    const mod = loadModule();
    const result = mod.getPerformanceBudget(null, 'epic');
    assert.deepStrictEqual(result, mod._constants.DEFAULT_BUDGETS.epic);
});
```

#### TC-PB-03: Unknown intensity falls back to standard

**Traces**: AC-002e

```javascript
it('TC-PB-03: normalizes unknown intensity to standard', () => {
    const mod = loadModule();
    const result = mod.getPerformanceBudget({}, 'turbo');
    assert.deepStrictEqual(result, mod._constants.DEFAULT_BUDGETS.standard);
});
```

#### TC-PB-04: Null inputs return standard defaults

**Traces**: AC-002c, AC-002e

```javascript
it('TC-PB-04: returns standard defaults when both inputs are null', () => {
    const mod = loadModule();
    const result = mod.getPerformanceBudget(null, null);
    assert.deepStrictEqual(result, mod._constants.DEFAULT_BUDGETS.standard);
});
```

---

### 1.2 computeBudgetStatus() -- 6 Tests

#### TC-PB-05: On track (under 80%)

**Traces**: AC-003d

```javascript
it('TC-PB-05: returns on_track when ratio < 0.8', () => {
    const mod = loadModule();
    assert.equal(mod.computeBudgetStatus(70, 90), 'on_track');
});
```

#### TC-PB-06: Exactly 80% is on_track

**Traces**: AC-003d
**Boundary**: `72 / 90 = 0.800` -- exactly at threshold, uses `<= 0.8`

```javascript
it('TC-PB-06: returns on_track when ratio is exactly 0.8', () => {
    const mod = loadModule();
    assert.equal(mod.computeBudgetStatus(72, 90), 'on_track');
});
```

#### TC-PB-07: Approaching (just over 80%)

**Traces**: AC-003e
**Boundary**: `72.1 / 90 = 0.8011` -- just over threshold

```javascript
it('TC-PB-07: returns approaching when ratio just exceeds 0.8', () => {
    const mod = loadModule();
    assert.equal(mod.computeBudgetStatus(72.1, 90), 'approaching');
});
```

#### TC-PB-08: Exactly 100% is approaching

**Traces**: AC-003e
**Boundary**: `90 / 90 = 1.000` -- exactly at limit, uses `<= 1.0`

```javascript
it('TC-PB-08: returns approaching when ratio is exactly 1.0', () => {
    const mod = loadModule();
    assert.equal(mod.computeBudgetStatus(90, 90), 'approaching');
});
```

#### TC-PB-09: Exceeded (over 100%)

**Traces**: AC-003c

```javascript
it('TC-PB-09: returns exceeded when ratio > 1.0', () => {
    const mod = loadModule();
    assert.equal(mod.computeBudgetStatus(91, 90), 'exceeded');
});
```

#### TC-PB-10: NaN input returns on_track (fail-open)

**Traces**: NFR-001

```javascript
it('TC-PB-10: returns on_track for NaN input (fail-open)', () => {
    const mod = loadModule();
    assert.equal(mod.computeBudgetStatus(NaN, 90), 'on_track');
    assert.equal(mod.computeBudgetStatus(50, NaN), 'on_track');
    assert.equal(mod.computeBudgetStatus(50, 0), 'on_track');
    assert.equal(mod.computeBudgetStatus(50, -10), 'on_track');
});
```

---

### 1.3 buildBudgetWarning() -- 4 Tests

#### TC-PB-11: Warning on exceeded

**Traces**: AC-003b

```javascript
it('TC-PB-11: returns BUDGET_WARNING string when exceeded', () => {
    const mod = loadModule();
    const result = mod.buildBudgetWarning(95, { max_total_minutes: 90 }, '06-implementation', 'standard', 22);
    assert.ok(result.startsWith('BUDGET_WARNING:'), 'Should start with BUDGET_WARNING:');
    assert.ok(result.includes('95m of 90m'), 'Should include elapsed and budget');
    assert.ok(result.includes('106%'), 'Should include percentage');
    assert.ok(result.includes('06-implementation'), 'Should include phase key');
    assert.ok(result.includes('22m'), 'Should include phase duration');
    assert.ok(result.includes('[standard tier]'), 'Should include intensity tier');
});
```

#### TC-PB-12: Warning on approaching

**Traces**: AC-003e

```javascript
it('TC-PB-12: returns BUDGET_APPROACHING string when approaching', () => {
    const mod = loadModule();
    const result = mod.buildBudgetWarning(75, { max_total_minutes: 90 }, '04-design', 'standard', 7);
    assert.ok(result.startsWith('BUDGET_APPROACHING:'), 'Should start with BUDGET_APPROACHING:');
    assert.ok(result.includes('83%'), 'Should include percentage');
    assert.ok(result.includes('15m remaining'), 'Should include remaining time');
    assert.ok(result.includes('[standard tier]'), 'Should include intensity tier');
});
```

#### TC-PB-13: Empty on on_track

**Traces**: AC-003d

```javascript
it('TC-PB-13: returns empty string when on_track', () => {
    const mod = loadModule();
    const result = mod.buildBudgetWarning(50, { max_total_minutes: 90 }, '03-architecture', 'standard', 12);
    assert.equal(result, '');
});
```

#### TC-PB-14: Null budget returns empty (fail-open)

**Traces**: NFR-001

```javascript
it('TC-PB-14: returns empty string when budget is null (fail-open)', () => {
    const mod = loadModule();
    assert.equal(mod.buildBudgetWarning(50, null, 'x', 'y', 5), '');
    assert.equal(mod.buildBudgetWarning(NaN, { max_total_minutes: 90 }, 'x', 'y', 5), '');
});
```

---

### 1.4 buildDegradationDirective() -- 7 Tests

#### TC-PB-15: Exceeded + debate phase

**Traces**: AC-004a

```javascript
it('TC-PB-15: exceeded status degrades debate rounds to 1 for debate phase', () => {
    const mod = loadModule();
    const budget = { max_debate_rounds: 2, max_fan_out_chunks: 4 };
    const result = mod.buildDegradationDirective('exceeded', budget, '01-requirements', {});
    assert.ok(result.directive.includes('max_debate_rounds: 1'), 'Should degrade to 1');
    assert.equal(result.degraded_debate_rounds, 1);
    assert.equal(result.degraded_fan_out_chunks, null);
});
```

#### TC-PB-16: Exceeded + fan-out phase

**Traces**: AC-005a

```javascript
it('TC-PB-16: exceeded status degrades fan-out to 2 for fan-out phase', () => {
    const mod = loadModule();
    const budget = { max_debate_rounds: 2, max_fan_out_chunks: 4 };
    const result = mod.buildDegradationDirective('exceeded', budget, '16-quality-loop', {});
    assert.ok(result.directive.includes('max_fan_out_chunks: 2'), 'Should degrade to 2');
    assert.equal(result.degraded_fan_out_chunks, 2);
    assert.equal(result.degraded_debate_rounds, null);
});
```

#### TC-PB-17: Approaching + debate phase (epic tier)

**Traces**: AC-004b

```javascript
it('TC-PB-17: approaching status reduces debate rounds by 1 from tier max', () => {
    const mod = loadModule();
    const epicBudget = { max_debate_rounds: 3, max_fan_out_chunks: 8 };
    const result = mod.buildDegradationDirective('approaching', epicBudget, '03-architecture', {});
    assert.ok(result.directive.includes('max_debate_rounds: 2'), 'Should be max(1, 3-1) = 2');
    assert.equal(result.degraded_debate_rounds, 2);
});
```

#### TC-PB-18: Approaching + fan-out phase (epic tier)

**Traces**: AC-005b

```javascript
it('TC-PB-18: approaching status halves fan-out for fan-out phase', () => {
    const mod = loadModule();
    const epicBudget = { max_debate_rounds: 3, max_fan_out_chunks: 8 };
    const result = mod.buildDegradationDirective('approaching', epicBudget, '16-quality-loop', {});
    assert.ok(result.directive.includes('max_fan_out_chunks: 4'), 'Should be max(2, floor(8/2)) = 4');
    assert.equal(result.degraded_fan_out_chunks, 4);
});
```

#### TC-PB-19: On_track returns empty

**Traces**: AC-004c

```javascript
it('TC-PB-19: on_track status returns empty directive', () => {
    const mod = loadModule();
    const budget = { max_debate_rounds: 2, max_fan_out_chunks: 4 };
    const result = mod.buildDegradationDirective('on_track', budget, '01-requirements', {});
    assert.equal(result.directive, '');
    assert.equal(result.degraded_debate_rounds, null);
    assert.equal(result.degraded_fan_out_chunks, null);
});
```

#### TC-PB-20: No-debate flag skips degradation

**Traces**: AC-004e

```javascript
it('TC-PB-20: no_debate flag prevents debate degradation', () => {
    const mod = loadModule();
    const budget = { max_debate_rounds: 2, max_fan_out_chunks: 4 };
    const result = mod.buildDegradationDirective('exceeded', budget, '01-requirements', { no_debate: true });
    assert.equal(result.directive, '');
    assert.equal(result.degraded_debate_rounds, null);
});
```

#### TC-PB-21: Non-debate/fan-out phase returns empty

**Traces**: AC-004c

```javascript
it('TC-PB-21: returns empty for phases not in debate or fan-out lists', () => {
    const mod = loadModule();
    const budget = { max_debate_rounds: 2, max_fan_out_chunks: 4 };
    const result = mod.buildDegradationDirective('exceeded', budget, '06-implementation', {});
    assert.equal(result.directive, '');
    assert.equal(result.degraded_debate_rounds, null);
    assert.equal(result.degraded_fan_out_chunks, null);
});
```

---

### 1.5 computeRollingAverage() -- 6 Tests

#### TC-PB-22: Empty history returns null

**Traces**: AC-006d

```javascript
it('TC-PB-22: returns null for empty history', () => {
    const mod = loadModule();
    assert.equal(mod.computeRollingAverage([], 'standard'), null);
});
```

#### TC-PB-23: 1 prior returns null

**Traces**: AC-006d

```javascript
it('TC-PB-23: returns null when only 1 prior workflow (need >= 2)', () => {
    const mod = loadModule();
    const history = [
        { status: 'completed', sizing: { effective_intensity: 'standard' }, metrics: { total_duration_minutes: 60 } }
    ];
    assert.equal(mod.computeRollingAverage(history, 'standard'), null);
});
```

#### TC-PB-24: 2 prior computes average

**Traces**: AC-006b

```javascript
it('TC-PB-24: computes average of 2 matching workflows', () => {
    const mod = loadModule();
    const history = [
        { sizing: { effective_intensity: 'standard' }, metrics: { total_duration_minutes: 60 } },
        { sizing: { effective_intensity: 'standard' }, metrics: { total_duration_minutes: 80 } }
    ];
    const result = mod.computeRollingAverage(history, 'standard');
    assert.deepStrictEqual(result, { avg_minutes: 70, count: 2 });
});
```

#### TC-PB-25: 7 matching uses last 5

**Traces**: AC-006b

```javascript
it('TC-PB-25: uses only last 5 when more than 5 match', () => {
    const mod = loadModule();
    const history = [
        { sizing: { effective_intensity: 'standard' }, metrics: { total_duration_minutes: 10 } },
        { sizing: { effective_intensity: 'standard' }, metrics: { total_duration_minutes: 20 } },
        { sizing: { effective_intensity: 'standard' }, metrics: { total_duration_minutes: 50 } },
        { sizing: { effective_intensity: 'standard' }, metrics: { total_duration_minutes: 60 } },
        { sizing: { effective_intensity: 'standard' }, metrics: { total_duration_minutes: 70 } },
        { sizing: { effective_intensity: 'standard' }, metrics: { total_duration_minutes: 80 } },
        { sizing: { effective_intensity: 'standard' }, metrics: { total_duration_minutes: 90 } }
    ];
    const result = mod.computeRollingAverage(history, 'standard', 5);
    // Should average the last 5 (in reverse order from end): 90, 80, 70, 60, 50 = avg 70
    assert.equal(result.count, 5);
    assert.equal(result.avg_minutes, 70);
});
```

#### TC-PB-26: Intensity filtering

**Traces**: AC-006a

```javascript
it('TC-PB-26: filters by intensity tier', () => {
    const mod = loadModule();
    const history = [
        { sizing: { effective_intensity: 'standard' }, metrics: { total_duration_minutes: 60 } },
        { sizing: { effective_intensity: 'epic' }, metrics: { total_duration_minutes: 150 } },
        { sizing: { effective_intensity: 'standard' }, metrics: { total_duration_minutes: 80 } },
        { sizing: { effective_intensity: 'epic' }, metrics: { total_duration_minutes: 170 } },
        { sizing: { effective_intensity: 'standard' }, metrics: { total_duration_minutes: 70 } }
    ];
    const result = mod.computeRollingAverage(history, 'standard');
    assert.equal(result.count, 3);
    assert.equal(result.avg_minutes, 70); // (60 + 80 + 70) / 3 = 70
});
```

#### TC-PB-27: Entries without duration skipped

**Traces**: NFR-001

```javascript
it('TC-PB-27: skips entries with null/missing duration', () => {
    const mod = loadModule();
    const history = [
        { sizing: { effective_intensity: 'standard' }, metrics: { total_duration_minutes: null } },
        { sizing: { effective_intensity: 'standard' }, metrics: { total_duration_minutes: 60 } },
        { sizing: { effective_intensity: 'standard' }, metrics: { total_duration_minutes: 80 } }
    ];
    const result = mod.computeRollingAverage(history, 'standard');
    assert.deepStrictEqual(result, { avg_minutes: 70, count: 2 });
});
```

---

### 1.6 detectRegression() -- 4 Tests

#### TC-PB-28: No regression (10% over)

**Traces**: AC-006c

```javascript
it('TC-PB-28: reports no regression when under threshold', () => {
    const mod = loadModule();
    const result = mod.detectRegression(55, { avg_minutes: 50, count: 3 });
    assert.equal(result.regressed, false);
    assert.equal(result.percent_over, 10);
    assert.equal(result.baseline_avg_minutes, 50);
    assert.equal(result.current_minutes, 55);
});
```

#### TC-PB-29: Regression (>20% over)

**Traces**: AC-006c

```javascript
it('TC-PB-29: reports regression when over threshold', () => {
    const mod = loadModule();
    const result = mod.detectRegression(61, { avg_minutes: 50, count: 3 });
    assert.equal(result.regressed, true);
    assert.equal(result.percent_over, 22);
});
```

#### TC-PB-30: Exactly at threshold (not regression)

**Traces**: AC-006c
**Boundary**: `60 > 50 * 1.2 = 60` is false (strictly greater than)

```javascript
it('TC-PB-30: exactly at 20% threshold is NOT a regression (strict >)', () => {
    const mod = loadModule();
    const result = mod.detectRegression(60, { avg_minutes: 50, count: 3 });
    assert.equal(result.regressed, false);
    assert.equal(result.percent_over, 20);
});
```

#### TC-PB-31: Null rolling avg returns null

**Traces**: AC-006d

```javascript
it('TC-PB-31: returns null when rolling average is null', () => {
    const mod = loadModule();
    assert.equal(mod.detectRegression(60, null), null);
});
```

---

### 1.7 formatCompletionDashboard() -- 6 Tests

#### TC-PB-32: Full dashboard with all data

**Traces**: AC-007a, AC-007b, AC-007c, AC-007d, AC-007e, AC-007f

```javascript
it('TC-PB-32: renders full dashboard with all sections', () => {
    const mod = loadModule();
    const phases = [
        { phase_key: '01-requirements', wall_clock_minutes: 8, debate_rounds_used: 2, fan_out_chunks: 0, debate_rounds_degraded_to: null, fan_out_degraded_to: null },
        { phase_key: '06-implementation', wall_clock_minutes: 22, debate_rounds_used: 0, fan_out_chunks: 0, debate_rounds_degraded_to: null, fan_out_degraded_to: null },
        { phase_key: '16-quality-loop', wall_clock_minutes: 9, debate_rounds_used: 0, fan_out_chunks: 3, debate_rounds_degraded_to: null, fan_out_degraded_to: 2 }
    ];
    const budget = { max_total_minutes: 90, intensity: 'standard' };
    const regression = { baseline_avg_minutes: 30, current_minutes: 39, percent_over: 30, regressed: true, slowest_phase: '06-implementation', compared_against: 3 };
    const result = mod.formatCompletionDashboard(phases, budget, regression, 1);

    assert.ok(result.includes('WORKFLOW TIMING SUMMARY'), 'Should include header');
    assert.ok(result.includes('01-requirements'), 'Should include phase names (AC-007a)');
    assert.ok(result.includes('06-implementation'), 'Should include phase names');
    assert.ok(result.includes('standard budget: 90m'), 'Should include budget header (AC-007b)');
    assert.ok(result.includes('REGRESSION'), 'Should include regression line (AC-007c)');
    assert.ok(result.includes('Degradation applied'), 'Should include degradation line (AC-007d)');
});
```

#### TC-PB-33: No regression line when not regressed

**Traces**: AC-007c

```javascript
it('TC-PB-33: omits regression line when regressionCheck is null', () => {
    const mod = loadModule();
    const phases = [
        { phase_key: '01-requirements', wall_clock_minutes: 8, debate_rounds_used: 0, fan_out_chunks: 0, debate_rounds_degraded_to: null, fan_out_degraded_to: null }
    ];
    const budget = { max_total_minutes: 90, intensity: 'standard' };
    const result = mod.formatCompletionDashboard(phases, budget, null, 0);

    assert.ok(!result.includes('REGRESSION'), 'Should NOT include regression line');
});
```

#### TC-PB-34: Degradation count displayed

**Traces**: AC-007d

```javascript
it('TC-PB-34: displays degradation count when > 0', () => {
    const mod = loadModule();
    const phases = [
        { phase_key: '01-requirements', wall_clock_minutes: 8, debate_rounds_used: 1, fan_out_chunks: 0, debate_rounds_degraded_to: 1, fan_out_degraded_to: null }
    ];
    const budget = { max_total_minutes: 90, intensity: 'standard' };
    const result = mod.formatCompletionDashboard(phases, budget, null, 2);

    assert.ok(result.includes('Degradation applied: 2 phase(s)'), 'Should show degradation count');
});
```

#### TC-PB-35: Budget exceeded format

**Traces**: AC-007f

```javascript
it('TC-PB-35: shows EXCEEDED in budget line when over budget', () => {
    const mod = loadModule();
    const phases = [
        { phase_key: '01-requirements', wall_clock_minutes: 100, debate_rounds_used: 0, fan_out_chunks: 0, debate_rounds_degraded_to: null, fan_out_degraded_to: null }
    ];
    const budget = { max_total_minutes: 90, intensity: 'standard', exceeded_at_phase: '06-implementation' };
    const result = mod.formatCompletionDashboard(phases, budget, null, 0);

    assert.ok(result.includes('EXCEEDED'), 'Should include EXCEEDED');
});
```

#### TC-PB-36: Budget on-track format

**Traces**: AC-007e

```javascript
it('TC-PB-36: shows ON TRACK in budget line when under budget', () => {
    const mod = loadModule();
    const phases = [
        { phase_key: '01-requirements', wall_clock_minutes: 50, debate_rounds_used: 0, fan_out_chunks: 0, debate_rounds_degraded_to: null, fan_out_degraded_to: null }
    ];
    const budget = { max_total_minutes: 90, intensity: 'standard' };
    const result = mod.formatCompletionDashboard(phases, budget, null, 0);

    assert.ok(result.includes('ON TRACK'), 'Should include ON TRACK');
});
```

#### TC-PB-37: Empty phases array

**Traces**: NFR-001

```javascript
it('TC-PB-37: handles empty phases array without crash', () => {
    const mod = loadModule();
    const budget = { max_total_minutes: 90, intensity: 'standard' };
    const result = mod.formatCompletionDashboard([], budget, null, 0);

    assert.ok(typeof result === 'string', 'Should return a string');
    assert.ok(result.includes('WORKFLOW TIMING SUMMARY'), 'Should include header');
    assert.ok(result.includes('Total'), 'Should include total line');
});
```

---

## 2. Integration Tests: common.test.cjs Extension (2 tests)

**File**: `src/claude/hooks/tests/common.test.cjs` (append to existing file)

#### TC-PB-CS01: Timing data present in snapshot

**Traces**: AC-001d

```javascript
it('TC-PB-CS01: collectPhaseSnapshots includes timing when present', () => {
    const common = getCommon();
    const statePath = path.join(testDir, '.isdlc', 'state.json');
    const state = {
        active_workflow: {
            type: 'feature',
            phases: ['01-requirements'],
            current_phase_index: 1,
            phase_status: { '01-requirements': 'completed' }
        },
        phases: {
            '01-requirements': {
                status: 'completed',
                started: '2026-02-19T10:00:00Z',
                completed: '2026-02-19T10:08:00Z',
                timing: {
                    started_at: '2026-02-19T10:00:00Z',
                    completed_at: '2026-02-19T10:08:00Z',
                    wall_clock_minutes: 8,
                    retries: 0,
                    debate_rounds_used: 2,
                    debate_rounds_degraded_to: null,
                    fan_out_chunks: 0,
                    fan_out_degraded_to: null
                }
            }
        }
    };
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

    const { phase_snapshots } = common.collectPhaseSnapshots(state);
    const snap = phase_snapshots.find(s => s.key === '01-requirements');
    assert.ok(snap, 'Should find 01-requirements snapshot');
    assert.ok(snap.timing, 'Snapshot should include timing object');
    assert.equal(snap.timing.wall_clock_minutes, 8);
});
```

#### TC-PB-CS02: Timing data absent (backward compatibility)

**Traces**: NFR-004

```javascript
it('TC-PB-CS02: collectPhaseSnapshots omits timing when absent', () => {
    const common = getCommon();
    const statePath = path.join(testDir, '.isdlc', 'state.json');
    const state = {
        active_workflow: {
            type: 'feature',
            phases: ['01-requirements'],
            current_phase_index: 1,
            phase_status: { '01-requirements': 'completed' }
        },
        phases: {
            '01-requirements': {
                status: 'completed',
                started: '2026-02-19T10:00:00Z',
                completed: '2026-02-19T10:08:00Z'
                // NO timing field
            }
        }
    };
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

    const { phase_snapshots } = common.collectPhaseSnapshots(state);
    const snap = phase_snapshots.find(s => s.key === '01-requirements');
    assert.ok(snap, 'Should find 01-requirements snapshot');
    assert.equal(snap.timing, undefined, 'Snapshot should NOT include timing when absent');
});
```

---

## 3. Integration Tests: workflow-completion-enforcer.test.cjs Extension (3 tests)

**File**: `src/claude/hooks/tests/workflow-completion-enforcer.test.cjs` (append to existing file)

**IMPORTANT**: The test setup must copy `performance-budget.cjs` to `lib/` in the temp directory.

#### TC-PB-WCE01: Regression detected

**Traces**: AC-006c, AC-006e, NFR-005

```javascript
it('TC-PB-WCE01: writes regression_check when regression detected', () => {
    const tmpDir = setupTestEnv();

    // Copy performance-budget.cjs to lib/
    const libSrcDir = path.join(__dirname, '..', 'lib');
    const libDestDir = path.join(tmpDir, 'lib');
    fs.copyFileSync(
        path.join(libSrcDir, 'performance-budget.cjs'),
        path.join(libDestDir, 'performance-budget.cjs')
    );

    // Build state with 3 prior standard workflows averaging 50m
    const state = {
        active_workflow: {
            type: 'feature',
            started_at: '2026-02-19T10:00:00Z',
            phases: ['01-requirements'],
            current_phase: '01-requirements',
            current_phase_index: 0,
            phase_status: { '01-requirements': 'completed' },
            sizing: { effective_intensity: 'standard' }
        },
        phases: {
            '01-requirements': {
                status: 'completed',
                started: '2026-02-19T10:00:00Z',
                completed: '2026-02-19T11:10:00Z',
                timing: { started_at: '2026-02-19T10:00:00Z', completed_at: '2026-02-19T11:10:00Z', wall_clock_minutes: 70 }
            }
        },
        workflow_history: [
            { status: 'completed', sizing: { effective_intensity: 'standard' }, metrics: { total_duration_minutes: 45 } },
            { status: 'completed', sizing: { effective_intensity: 'standard' }, metrics: { total_duration_minutes: 50 } },
            { status: 'completed', sizing: { effective_intensity: 'standard' }, metrics: { total_duration_minutes: 55 } },
            // The 4th entry is the "current" one being completed:
            {
                type: 'feature',
                status: 'active',
                started_at: '2026-02-19T10:00:00Z',
                sizing: { effective_intensity: 'standard' }
            }
        ],
        skill_usage_log: []
    };
    writeStateFile(tmpDir, state);

    const result = runHook(tmpDir, { tool_name: 'Task', tool_input: { prompt: 'finalize' } });

    const finalState = readStateFile(tmpDir);
    const lastEntry = finalState.workflow_history[finalState.workflow_history.length - 1];

    // Current=70m, avg=(45+50+55)/3=50m -> 40% over -> regressed=true
    assert.ok(lastEntry.regression_check, 'Should have regression_check');
    assert.equal(lastEntry.regression_check.regressed, true);
    assert.ok(result.stderr.includes('PERFORMANCE_REGRESSION:'), 'Should emit regression warning to stderr');
});
```

#### TC-PB-WCE02: No regression

**Traces**: AC-006c, AC-006e

```javascript
it('TC-PB-WCE02: writes regression_check with regressed=false when under threshold', () => {
    // Similar to WCE01 but current=55m (10% over 50m avg) -> not regressed
    // ... setup similar to WCE01 but with metrics.total_duration_minutes = 55 ...

    const lastEntry = finalState.workflow_history[finalState.workflow_history.length - 1];
    assert.ok(lastEntry.regression_check, 'Should have regression_check');
    assert.equal(lastEntry.regression_check.regressed, false);
});
```

#### TC-PB-WCE03: Insufficient data

**Traces**: AC-006d

```javascript
it('TC-PB-WCE03: does not write regression_check with < 2 prior workflows', () => {
    // Only 1 prior entry + current entry in workflow_history
    // ... setup with only 1 prior standard entry ...

    const lastEntry = finalState.workflow_history[finalState.workflow_history.length - 1];
    assert.equal(lastEntry.regression_check, undefined, 'Should NOT have regression_check with insufficient data');
});
```

---

## 4. Integration Tests: Dispatcher DISPATCHER_TIMING Tests (10 tests)

### 4.1 pre-task-dispatcher (2 tests)

**File**: `src/claude/hooks/tests/test-pre-task-dispatcher.test.cjs` (append)

#### TC-PB-DT1a: DISPATCHER_TIMING on stderr

**Traces**: AC-008b

```javascript
it('TC-PB-DT1a: emits DISPATCHER_TIMING to stderr', async () => {
    const result = await runDispatcher(dispatcherPath, taskInput());
    assert.ok(
        result.stderr.includes('DISPATCHER_TIMING: pre-task-dispatcher completed in'),
        'stderr should contain DISPATCHER_TIMING line'
    );
    // Verify format: {float}ms ({int} hooks)
    assert.match(
        result.stderr,
        /DISPATCHER_TIMING: pre-task-dispatcher completed in [\d.]+ms \(\d+ hooks\)/,
        'Should match expected format'
    );
});
```

#### TC-PB-DT1b: stdout unaffected

**Traces**: AC-008c

```javascript
it('TC-PB-DT1b: DISPATCHER_TIMING does not appear on stdout', async () => {
    const result = await runDispatcher(dispatcherPath, taskInput());
    assert.ok(
        !result.stdout.includes('DISPATCHER_TIMING'),
        'stdout must not contain DISPATCHER_TIMING'
    );
});
```

### 4.2 post-task-dispatcher (2 tests)

**File**: `src/claude/hooks/tests/test-post-task-dispatcher.test.cjs` (append)

#### TC-PB-DT2a: DISPATCHER_TIMING on stderr

**Traces**: AC-008b

Pattern identical to DT1a but verifying `post-task-dispatcher` name.

#### TC-PB-DT2b: stdout unaffected

**Traces**: AC-008c

Pattern identical to DT1b.

### 4.3 pre-skill-dispatcher (2 tests)

**File**: `src/claude/hooks/tests/test-pre-skill-dispatcher.test.cjs` (append)

#### TC-PB-DT3a: DISPATCHER_TIMING on stderr

**Traces**: AC-008b

Pattern identical but verifying `pre-skill-dispatcher` name.

#### TC-PB-DT3b: stdout unaffected

**Traces**: AC-008c

### 4.4 post-bash-dispatcher (2 tests)

**File**: `src/claude/hooks/tests/test-post-bash-dispatcher.test.cjs` (append)

#### TC-PB-DT4a: DISPATCHER_TIMING on stderr

**Traces**: AC-008b

Pattern identical but verifying `post-bash-dispatcher` name.

#### TC-PB-DT4b: stdout unaffected

**Traces**: AC-008c

### 4.5 post-write-edit-dispatcher (2 tests)

**File**: `src/claude/hooks/tests/test-post-write-edit-dispatcher.test.cjs` (append)

#### TC-PB-DT5a: DISPATCHER_TIMING on stderr

**Traces**: AC-008b

Pattern identical but verifying `post-write-edit-dispatcher` name.

#### TC-PB-DT5b: stdout unaffected

**Traces**: AC-008c

---

## 5. Test Case Summary

| Group | File | Count | Type |
|-------|------|-------|------|
| getPerformanceBudget | performance-budget.test.cjs | 4 | Unit |
| computeBudgetStatus | performance-budget.test.cjs | 6 | Unit |
| buildBudgetWarning | performance-budget.test.cjs | 4 | Unit |
| buildDegradationDirective | performance-budget.test.cjs | 7 | Unit |
| computeRollingAverage | performance-budget.test.cjs | 6 | Unit |
| detectRegression | performance-budget.test.cjs | 4 | Unit |
| formatCompletionDashboard | performance-budget.test.cjs | 6 | Unit |
| collectPhaseSnapshots extension | common.test.cjs | 2 | Integration |
| Regression tracking | workflow-completion-enforcer.test.cjs | 3 | Integration |
| Dispatcher timing (5 dispatchers) | test-*-dispatcher.test.cjs | 10 | Integration |
| **Total** | | **52** | |
