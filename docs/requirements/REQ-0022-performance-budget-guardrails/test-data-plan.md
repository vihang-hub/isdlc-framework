# Test Data Plan: Performance Budget and Guardrail System

**REQ ID**: REQ-0025
**Artifact Folder**: REQ-0022-performance-budget-guardrails
**Phase**: 05-test-strategy
**Generated**: 2026-02-19

---

## 1. Overview

All test data for the performance budget feature is generated inline within test files as JavaScript constants and factory functions. No external fixture files, databases, or API calls are required. This aligns with the project's existing test data pattern (see `gate-requirements-injector.test.cjs` and `common.test.cjs`).

---

## 2. Test Data Categories

### 2.1 Budget Configuration Data

**Used by**: `getPerformanceBudget()` tests (TC-PB-01 through TC-PB-04)

```javascript
// Valid workflow config with all three tiers
const VALID_CONFIG = {
    performance_budgets: {
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
    }
};

// Shorthand references
const STANDARD_BUDGET = VALID_CONFIG.performance_budgets.standard;
const EPIC_BUDGET = VALID_CONFIG.performance_budgets.epic;
const LIGHT_BUDGET = VALID_CONFIG.performance_budgets.light;

// Invalid config variants
const EMPTY_CONFIG = {};
const NULL_CONFIG = null;
const CONFIG_WITH_INVALID_FIELDS = {
    performance_budgets: {
        standard: {
            max_total_minutes: -5,     // negative
            max_phase_minutes: 3.7,    // non-integer
            max_debate_rounds: 'two',  // non-number
            max_fan_out_chunks: null   // null
        }
    }
};
```

### 2.2 Budget Status Boundary Data

**Used by**: `computeBudgetStatus()` tests (TC-PB-05 through TC-PB-10)

| elapsed | maxTotal | Ratio | Expected Status | Boundary Note |
|---------|----------|-------|----------------|---------------|
| 70 | 90 | 0.778 | on_track | Well below 80% |
| 72 | 90 | 0.800 | on_track | Exactly 80% (inclusive) |
| 72.1 | 90 | 0.801 | approaching | Just over 80% |
| 85 | 90 | 0.944 | approaching | Well within approaching range |
| 90 | 90 | 1.000 | approaching | Exactly 100% (inclusive) |
| 91 | 90 | 1.011 | exceeded | Just over 100% |
| 180 | 90 | 2.000 | exceeded | Well over budget |
| NaN | 90 | N/A | on_track | Invalid input (fail-open) |
| 50 | NaN | N/A | on_track | Invalid budget (fail-open) |
| 50 | 0 | Infinity | on_track | Zero budget (fail-open) |
| 50 | -10 | Negative | on_track | Negative budget (fail-open) |

### 2.3 Workflow History Data (Rolling Average / Regression)

**Used by**: `computeRollingAverage()` tests (TC-PB-22 through TC-PB-27) and `detectRegression()` tests (TC-PB-28 through TC-PB-31)

**Factory function**:
```javascript
function makeHistoryEntry(durationMinutes, intensity = 'standard') {
    return {
        status: 'completed',
        sizing: { effective_intensity: intensity },
        metrics: { total_duration_minutes: durationMinutes }
    };
}
```

**Test datasets**:

| Dataset Name | Entries | Intensities | Durations | Purpose |
|-------------|---------|-------------|-----------|---------|
| EMPTY_HISTORY | 0 | -- | -- | Null guard test |
| SINGLE_ENTRY | 1 | standard | [60] | Minimum guard test |
| TWO_ENTRIES | 2 | standard | [60, 80] | Minimum valid test |
| FIVE_ENTRIES | 5 | standard | [50, 60, 70, 80, 90] | Standard window |
| SEVEN_ENTRIES | 7 | standard | [10, 20, 50, 60, 70, 80, 90] | Exceeds window (last 5 used) |
| MIXED_INTENSITY | 5 | 3 std + 2 epic | std:[60,80,70] epic:[150,170] | Intensity filtering |
| NULL_DURATIONS | 3 | standard | [null, 60, 80] | Null duration skip |
| FIX_WORKFLOWS | 3 | (no sizing) | [40, 50, 60] | Fix workflow defaults to standard |

### 2.4 Phase Timing Data (Dashboard)

**Used by**: `formatCompletionDashboard()` tests (TC-PB-32 through TC-PB-37)

**Factory function**:
```javascript
function makePhaseTimingEntry(phaseKey, wallClockMinutes, opts = {}) {
    return {
        phase_key: phaseKey,
        wall_clock_minutes: wallClockMinutes,
        debate_rounds_used: opts.debateRounds || 0,
        fan_out_chunks: opts.fanOutChunks || 0,
        debate_rounds_degraded_to: opts.degradedDebate || null,
        fan_out_degraded_to: opts.degradedFanOut || null
    };
}
```

**Datasets**:

| Dataset | Phases | Total Minutes | Budget | Regression | Degradation |
|---------|--------|---------------|--------|------------|-------------|
| FULL_DASHBOARD | 3 phases (req:8, impl:22, ql:9) | 39 | 90m standard | regressed (30% over 30m avg) | 1 phase |
| ON_TRACK_DASHBOARD | 2 phases (req:5, impl:15) | 20 | 90m standard | none | 0 |
| EXCEEDED_DASHBOARD | 1 phase (impl:100) | 100 | 90m standard | none | 0 |
| EMPTY_DASHBOARD | 0 phases | 0 | 90m standard | none | 0 |
| NO_BUDGET_DASHBOARD | 2 phases | 30 | null | none | 0 |

### 2.5 Degradation Directive Data

**Used by**: `buildDegradationDirective()` tests (TC-PB-15 through TC-PB-21)

**Phase categories**:

| Category | Phase Keys | Degradation Type |
|----------|-----------|-----------------|
| Debate-enabled | `01-requirements`, `03-architecture`, `04-design`, `05-test-strategy` | Debate rounds |
| Fan-out | `16-quality-loop`, `08-code-review` | Fan-out chunks |
| Neither | `06-implementation`, `02-impact-analysis` | No degradation |

**Flag combinations**:

| Flags | Effect |
|-------|--------|
| `{}` | Normal degradation |
| `{ no_debate: true }` | Skip debate degradation |
| `{ no_fan_out: true }` | Skip fan-out degradation |
| `{ no_debate: true, no_fan_out: true }` | Skip all degradation |

### 2.6 State.json Fixtures (Integration Tests)

**Used by**: `common.test.cjs` extension (TC-PB-CS01, TC-PB-CS02) and `workflow-completion-enforcer.test.cjs` extension (TC-PB-WCE01 through TC-PB-WCE03)

**State with timing** (TC-PB-CS01, TC-PB-WCE01, TC-PB-WCE02):
```javascript
{
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
            completed: '2026-02-19T10:08:00Z',
            timing: {
                started_at: '2026-02-19T10:00:00Z',
                completed_at: '2026-02-19T10:08:00Z',
                wall_clock_minutes: 8,
                retries: 0,
                debate_rounds_used: 0,
                debate_rounds_degraded_to: null,
                fan_out_chunks: 0,
                fan_out_degraded_to: null
            }
        }
    },
    workflow_history: [/* varies per test */],
    skill_usage_log: []
}
```

**State without timing** (TC-PB-CS02, TC-PB-WCE03):
```javascript
{
    active_workflow: { /* same structure */ },
    phases: {
        '01-requirements': {
            status: 'completed',
            started: '2026-02-19T10:00:00Z',
            completed: '2026-02-19T10:08:00Z'
            // NO timing field
        }
    }
}
```

### 2.7 Dispatcher Test Input Data

**Used by**: All 10 dispatcher timing tests (TC-PB-DT*)

The dispatcher tests reuse existing input helpers already defined in each dispatcher test file:
- `taskInput()` for pre-task and post-task dispatchers
- Skill tool input for pre-skill dispatcher
- Bash tool input for post-bash dispatcher
- Write/Edit tool input for post-write-edit dispatcher

No new input fixtures needed -- the DISPATCHER_TIMING output is unconditional.

---

## 3. Data Generation Strategy

### 3.1 Approach

All data is **statically defined** as constants and factory functions within test files. No dynamic generation, no randomization, no external data sources.

**Rationale**: The performance budget functions are pure and deterministic. Boundary-value analysis with known inputs and expected outputs provides better coverage than randomized testing for this type of computation.

### 3.2 Factory Functions

Two factory functions are provided for test convenience:

1. `makeHistoryEntry(duration, intensity)` -- creates a workflow history entry
2. `makePhaseTimingEntry(phaseKey, minutes, opts)` -- creates a phase timing array entry

These produce valid objects with sensible defaults, allowing tests to focus on the specific fields being tested.

### 3.3 Boundary Values

All boundary values are derived from the module design specification (Section 2 of module-design.md):

| Boundary | Values Tested | Source |
|----------|--------------|--------|
| Budget ratio 80% | 0.800 (on_track), 0.801 (approaching) | AC-003d, AC-003e |
| Budget ratio 100% | 1.000 (approaching), 1.011 (exceeded) | AC-003e, AC-003c |
| Regression threshold 20% | exactly 20% (false), 22% (true) | AC-006c |
| Rolling average minimum | 0 entries (null), 1 entry (null), 2 entries (valid) | AC-006d |
| Rolling average window | 5 entries (all used), 7 entries (last 5 used) | AC-006b |
| Debate round floor | max(1, 0-1) = 1 for light tier | AC-004b |
| Fan-out floor | max(2, floor(1/2)) = 2 for light tier | AC-005b |

---

## 4. Test Data Lifecycle

1. **Created**: Inline at test file `describe()` scope or inside individual `it()` blocks
2. **Used**: Within test assertions (single use)
3. **Cleaned up**: Automatically garbage-collected after test block exits; temp directories cleaned in `afterEach()`
4. **No persistence**: No test data written to disk except state.json in temp directories (which are deleted)
