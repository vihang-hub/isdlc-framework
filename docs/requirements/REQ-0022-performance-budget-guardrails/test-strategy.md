# Test Strategy: Performance Budget and Guardrail System

**REQ ID**: REQ-0025
**Artifact Folder**: REQ-0022-performance-budget-guardrails
**Phase**: 05-test-strategy
**Generated**: 2026-02-19
**Traces To**: FR-001 through FR-008, NFR-001 through NFR-005

---

## 1. Existing Infrastructure

### 1.1 Test Framework

- **Framework**: Node.js built-in `node:test` + `node:assert/strict` (CJS pattern for hooks)
- **Coverage Tool**: None (no Istanbul/c8 currently configured)
- **Current Test Count**: 555+ total (302 ESM lib tests + 253 CJS hook tests)
- **CJS Test Location**: `src/claude/hooks/tests/*.test.cjs`
- **Test Runner**: `node --test src/claude/hooks/tests/*.test.cjs`

### 1.2 Existing Patterns

- **Hook tests**: Use `setupTestEnv()` / `cleanupTestEnv()` from `hook-test-utils.cjs` to create isolated temp directories
- **Dispatcher tests**: Use `prepareDispatcher()` / `runDispatcher()` to spawn dispatchers as child processes, capturing stdout/stderr
- **Lib module tests**: Use fresh `require()` with cache clearing (see `gate-requirements-injector.test.cjs` pattern)
- **Test IDs**: Prefixed with a short code (e.g., `C1:`, `TC-E09:`) for cross-reference
- **Naming convention**: `{module-name}.test.cjs` for new modules; `test-{dispatcher-name}.test.cjs` for dispatchers
- **State isolation**: Each test gets its own temp directory; `CLAUDE_PROJECT_DIR` env var points hooks at it

### 1.3 Existing Test Files to Extend

| File | Current Tests | New Tests | Purpose |
|------|--------------|-----------|---------|
| `common.test.cjs` | 61 | +2 | Extend `collectPhaseSnapshots()` with timing data tests |
| `workflow-completion-enforcer.test.cjs` | 22 | +3 | Add regression tracking tests |
| `test-pre-task-dispatcher.test.cjs` | 16 | +2 | DISPATCHER_TIMING stderr tests |
| `test-post-task-dispatcher.test.cjs` | 15 | +2 | DISPATCHER_TIMING stderr tests |
| `test-pre-skill-dispatcher.test.cjs` | 13 | +2 | DISPATCHER_TIMING stderr tests |
| `test-post-bash-dispatcher.test.cjs` | 15 | +2 | DISPATCHER_TIMING stderr tests |
| `test-post-write-edit-dispatcher.test.cjs` | 16 | +2 | DISPATCHER_TIMING stderr tests |

---

## 2. Test Strategy Overview

### 2.1 Approach

**Extend existing test suite** -- do NOT replace or restructure. All new tests follow established CJS patterns with `node:test` + `node:assert/strict`.

### 2.2 Test Types Required

| Type | Scope | Count | Framework |
|------|-------|-------|-----------|
| **Unit** | 7 exported functions in `performance-budget.cjs` | 37 | `node:test` + direct `require()` |
| **Integration** | `collectPhaseSnapshots()` extension, regression in enforcer | 5 | `node:test` + `setupTestEnv()` |
| **Integration (Dispatcher)** | 5 dispatcher DISPATCHER_TIMING tests | 10 | `node:test` + `prepareDispatcher()`/`runDispatcher()` |
| **Total** | | **52** | |

### 2.3 Test Pyramid

```
        /\
       /  \      0  E2E (N/A: isdlc.md is markdown, not executable)
      /    \
     /------\
    /  5+10  \   15 Integration (enforcer, common, 5 dispatchers)
   /----------\
  /     37     \  37 Unit (performance-budget.cjs pure functions)
 /--------------\
```

The feature is purely computational (pure functions) + advisory output (stderr). No user-facing UI, no database, no network calls. Therefore:
- **E2E tests**: Not applicable. The isdlc.md orchestrator is a markdown command interpreted by Claude Code, not an executable. The integration points in isdlc.md are tested through manual verification during the quality loop phase.
- **Security tests**: Not applicable. No credentials, no user input, no network calls. All functions accept in-memory objects and return computed results. Input validation is covered by unit tests (fail-open behavior).
- **Performance tests**: Not applicable for a separate test suite. The system itself IS the performance monitoring. Dispatcher timing instrumentation is verified through stderr capture in integration tests.

### 2.4 Coverage Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| New module (`performance-budget.cjs`) line coverage | >=90% | Pure functions with explicit edge cases; high testability |
| New module branch coverage | >=85% | All fail-open branches must be tested |
| Existing module regression | 0 failures | NFR-004: All existing 555+ tests pass without modification |
| New test count | 52 | 37 unit + 15 integration |
| Critical path coverage | 100% | `computeBudgetStatus` boundaries, `detectRegression` threshold |

---

## 3. Test Architecture

### 3.1 New Test File: `performance-budget.test.cjs`

**Location**: `src/claude/hooks/tests/performance-budget.test.cjs`
**Pattern**: Direct `require()` of `../lib/performance-budget.cjs` (same as `gate-requirements-injector.test.cjs`)

This file tests all 7 exported functions as pure unit tests. No child process spawning needed -- the functions are pure and have no side effects.

**Structure**:
```
describe('REQ-0022: performance-budget.cjs', () => {
    describe('getPerformanceBudget()', () => { ... 4 tests })
    describe('computeBudgetStatus()', () => { ... 6 tests })
    describe('buildBudgetWarning()', () => { ... 4 tests })
    describe('buildDegradationDirective()', () => { ... 7 tests })
    describe('computeRollingAverage()', () => { ... 6 tests })
    describe('detectRegression()', () => { ... 4 tests })
    describe('formatCompletionDashboard()', () => { ... 6 tests })
})
```

**Module loading**:
```javascript
function loadModule() {
    const modPath = path.resolve(__dirname, '..', 'lib', 'performance-budget.cjs');
    delete require.cache[modPath];
    return require(modPath);
}
```

### 3.2 Extended Test File: `common.test.cjs`

**Add 2 tests** to existing `collectPhaseSnapshots()` describe block (or create new describe block if needed):
- TC-PB-CS01: Timing data present in phase -- verify `timing` is included in snapshot
- TC-PB-CS02: Timing data absent (backward compat) -- verify no `timing` key in snapshot

### 3.3 Extended Test File: `workflow-completion-enforcer.test.cjs`

**Add 3 tests** using the file's existing `setupTestEnv()` / `runHook()` pattern:
- TC-PB-WCE01: Regression detected (40% over average)
- TC-PB-WCE02: No regression (10% over average)
- TC-PB-WCE03: Insufficient data (< 2 prior workflows)

**NOTE**: The enforcer test file copies `lib/` dependencies into temp dir. The test setup MUST also copy `performance-budget.cjs` alongside `common.cjs` into `lib/`.

### 3.4 Extended Dispatcher Test Files (5 files, 10 tests total)

**Add 2 tests** to each dispatcher test file:
- TC-PB-DT{N}a: DISPATCHER_TIMING appears on stderr
- TC-PB-DT{N}b: DISPATCHER_TIMING does NOT appear on stdout

These tests use the existing `prepareDispatcher()` / `runDispatcher()` pattern from `hook-test-utils.cjs`.

**NOTE**: `prepareDispatcher()` copies lib files (`common.cjs`, `provider-utils.cjs`, `three-verb-utils.cjs`). Once `performance-budget.cjs` exists, it must be added to the lib copy list in `hook-test-utils.cjs` OR the enforcer tests must copy it manually.

---

## 4. Test Case Specifications

### 4.1 getPerformanceBudget() -- 4 Tests

| ID | Name | Input | Expected | Traces |
|----|------|-------|----------|--------|
| TC-PB-01 | Valid tier lookup from config | `workflowConfig` with `performance_budgets.standard`, intensity `"standard"` | Returns config values for standard tier | AC-002a, AC-002b |
| TC-PB-02 | Missing config returns defaults | `workflowConfig = null`, intensity `"epic"` | Returns `DEFAULT_BUDGETS.epic` | AC-002c |
| TC-PB-03 | Unknown intensity falls back to standard | `workflowConfig = {}`, intensity `"turbo"` | Returns `DEFAULT_BUDGETS.standard` | AC-002e |
| TC-PB-04 | Null inputs return standard defaults | `workflowConfig = null`, intensity `null` | Returns `DEFAULT_BUDGETS.standard` | AC-002c, AC-002e |

**Test data**:
```javascript
const VALID_CONFIG = {
    performance_budgets: {
        light:    { max_total_minutes: 30, max_phase_minutes: 10, max_debate_rounds: 0, max_fan_out_chunks: 1 },
        standard: { max_total_minutes: 90, max_phase_minutes: 25, max_debate_rounds: 2, max_fan_out_chunks: 4 },
        epic:     { max_total_minutes: 180, max_phase_minutes: 40, max_debate_rounds: 3, max_fan_out_chunks: 8 }
    }
};
```

### 4.2 computeBudgetStatus() -- 6 Tests

| ID | Name | Input | Expected | Traces |
|----|------|-------|----------|--------|
| TC-PB-05 | On track (under 80%) | `elapsed=70, max=90` (ratio=0.778) | `"on_track"` | AC-003d |
| TC-PB-06 | Exactly 80% is on_track | `elapsed=72, max=90` (ratio=0.800) | `"on_track"` | AC-003d |
| TC-PB-07 | Approaching (81%) | `elapsed=72.1, max=90` (ratio=0.801) | `"approaching"` | AC-003e |
| TC-PB-08 | Exactly 100% is approaching | `elapsed=90, max=90` (ratio=1.000) | `"approaching"` | AC-003e |
| TC-PB-09 | Exceeded (101%) | `elapsed=91, max=90` (ratio=1.011) | `"exceeded"` | AC-003c |
| TC-PB-10 | NaN input returns on_track | `elapsed=NaN, max=90` | `"on_track"` | NFR-001 |

**Critical boundary tests**: TC-PB-06 and TC-PB-08 test the exact boundary conditions documented in the module design. The semantics are:
- `ratio <= 0.8` is on_track (uses `<=`)
- `0.8 < ratio <= 1.0` is approaching (uses `>` and `<=`)
- `ratio > 1.0` is exceeded (uses `>`)

### 4.3 buildBudgetWarning() -- 4 Tests

| ID | Name | Input | Expected | Traces |
|----|------|-------|----------|--------|
| TC-PB-11 | Warning on exceeded | `elapsed=95, budget={max_total_minutes:90}, phase='06-implementation', intensity='standard', phaseDuration=22` | String containing `"BUDGET_WARNING:"` with `"106%"` and `"95m of 90m"` | AC-003b |
| TC-PB-12 | Warning on approaching | `elapsed=75, budget={max_total_minutes:90}, phase='04-design', intensity='standard', phaseDuration=7` | String containing `"BUDGET_APPROACHING:"` with `"83%"` and `"15m remaining"` | AC-003e |
| TC-PB-13 | Empty on on_track | `elapsed=50, budget={max_total_minutes:90}, phase='03-arch', intensity='standard', phaseDuration=12` | `""` (empty string) | AC-003d |
| TC-PB-14 | Null budget returns empty | `elapsed=50, budget=null, phase='x', intensity='y', phaseDuration=5` | `""` (empty string) | NFR-001 |

### 4.4 buildDegradationDirective() -- 7 Tests

| ID | Name | Input | Expected | Traces |
|----|------|-------|----------|--------|
| TC-PB-15 | Exceeded + debate phase | `budgetStatus='exceeded', standardBudget, phase='01-requirements', flags={}` | Directive with `max_debate_rounds: 1` | AC-004a |
| TC-PB-16 | Exceeded + fan-out phase | `budgetStatus='exceeded', standardBudget, phase='16-quality-loop', flags={}` | Directive with `max_fan_out_chunks: 2` | AC-005a |
| TC-PB-17 | Approaching + debate phase (epic) | `budgetStatus='approaching', epicBudget, phase='03-architecture', flags={}` | Directive with `max_debate_rounds: 2` (max(1, 3-1)) | AC-004b |
| TC-PB-18 | Approaching + fan-out phase (epic) | `budgetStatus='approaching', epicBudget, phase='16-quality-loop', flags={}` | Directive with `max_fan_out_chunks: 4` (max(2, floor(8/2))) | AC-005b |
| TC-PB-19 | On_track returns empty | `budgetStatus='on_track', standardBudget, phase='01-requirements', flags={}` | Empty directive | AC-004c |
| TC-PB-20 | No-debate flag skips degradation | `budgetStatus='exceeded', standardBudget, phase='01-requirements', flags={no_debate:true}` | Empty directive | AC-004e |
| TC-PB-21 | Non-debate/fan-out phase returns empty | `budgetStatus='exceeded', standardBudget, phase='06-implementation', flags={}` | Empty directive | AC-004c |

### 4.5 computeRollingAverage() -- 6 Tests

| ID | Name | Input | Expected | Traces |
|----|------|-------|----------|--------|
| TC-PB-22 | Empty history returns null | `history=[], intensity='standard'` | `null` | AC-006d |
| TC-PB-23 | 1 prior returns null | `history=[entry1], intensity='standard'` | `null` (need >= 2) | AC-006d |
| TC-PB-24 | 2 prior computes average | `history=[{60m}, {80m}], intensity='standard'` | `{ avg_minutes: 70, count: 2 }` | AC-006b |
| TC-PB-25 | 7 matching uses last 5 | `history=[7 entries], intensity='standard', maxPrior=5` | Average of last 5 only | AC-006b |
| TC-PB-26 | Intensity filtering | `history=[3 standard, 2 epic], intensity='standard'` | Uses only 3 standard entries | AC-006a |
| TC-PB-27 | Entries without duration skipped | `history=[{null duration}, {60m}, {80m}], intensity='standard'` | `{ avg_minutes: 70, count: 2 }` (skips null) | NFR-001 |

### 4.6 detectRegression() -- 4 Tests

| ID | Name | Input | Expected | Traces |
|----|------|-------|----------|--------|
| TC-PB-28 | No regression (10% over) | `current=55, rollingAvg={avg_minutes:50, count:3}` | `{ regressed: false, percent_over: 10 }` | AC-006c |
| TC-PB-29 | Regression (>20% over) | `current=61, rollingAvg={avg_minutes:50, count:3}` | `{ regressed: true, percent_over: 22 }` | AC-006c |
| TC-PB-30 | Exactly at threshold (not regression) | `current=60, rollingAvg={avg_minutes:50, count:3}` | `{ regressed: false, percent_over: 20 }` | AC-006c |
| TC-PB-31 | Null rolling avg returns null | `current=60, rollingAvg=null` | `null` | AC-006d |

**Critical boundary test**: TC-PB-30 verifies that `current=60` with `avg=50` is NOT a regression because `60 > 50 * 1.2 = 60` is false (strictly greater than).

### 4.7 formatCompletionDashboard() -- 6 Tests

| ID | Name | Input | Expected | Traces |
|----|------|-------|----------|--------|
| TC-PB-32 | Full dashboard with all data | 3 phases with timing, budget, regression, degradation | Contains separator, header, phase rows, budget, regression, degradation lines | AC-007a-f |
| TC-PB-33 | No regression line when not regressed | Same but `regressionCheck=null` | No `REGRESSION:` line in output | AC-007c |
| TC-PB-34 | Degradation count displayed | Same but `degradationCount=2` | Contains `Degradation applied: 2 phase(s)` | AC-007d |
| TC-PB-35 | Budget exceeded format | Budget info with exceeded status | Contains `EXCEEDED` and phase name | AC-007f |
| TC-PB-36 | Budget on-track format | Budget info with on-track status | Contains `ON TRACK` | AC-007e |
| TC-PB-37 | Empty phases array | `phasesTimingArray=[]` | Contains header and total=0m, no crash | NFR-001 |

### 4.8 collectPhaseSnapshots() Extension -- 2 Tests

| ID | Name | Input | Expected | Traces |
|----|------|-------|----------|--------|
| TC-PB-CS01 | Timing data present | State with `phases['01-requirements'].timing = { started_at: '...', wall_clock_minutes: 8 }` | Snapshot includes `timing` object | AC-001d |
| TC-PB-CS02 | Timing data absent (backward compat) | State without any `timing` fields | Snapshot does NOT have `timing` key | NFR-004 |

### 4.9 Workflow Completion Enforcer Regression -- 3 Tests

| ID | Name | Input | Expected | Traces |
|----|------|-------|----------|--------|
| TC-PB-WCE01 | Regression detected | `workflow_history` with 3 prior at avg 50m, current 70m (40% over) | `regression_check.regressed === true`, stderr contains `PERFORMANCE_REGRESSION:` | AC-006c, AC-006e |
| TC-PB-WCE02 | No regression | Prior avg 50m, current 55m (10% over) | `regression_check.regressed === false` | AC-006c, AC-006e |
| TC-PB-WCE03 | Insufficient data | Only 1 prior entry | No `regression_check` on history entry | AC-006d |

### 4.10 Dispatcher Timing Instrumentation -- 10 Tests (2 per dispatcher)

| ID | Dispatcher | Name | Expected | Traces |
|----|-----------|------|----------|--------|
| TC-PB-DT1a | pre-task | DISPATCHER_TIMING on stderr | stderr contains `DISPATCHER_TIMING: pre-task-dispatcher completed in` | AC-008b |
| TC-PB-DT1b | pre-task | stdout unaffected | stdout does not contain `DISPATCHER_TIMING` | AC-008c |
| TC-PB-DT2a | post-task | DISPATCHER_TIMING on stderr | stderr contains `DISPATCHER_TIMING: post-task-dispatcher completed in` | AC-008b |
| TC-PB-DT2b | post-task | stdout unaffected | stdout does not contain `DISPATCHER_TIMING` | AC-008c |
| TC-PB-DT3a | pre-skill | DISPATCHER_TIMING on stderr | stderr contains `DISPATCHER_TIMING: pre-skill-dispatcher completed in` | AC-008b |
| TC-PB-DT3b | pre-skill | stdout unaffected | stdout does not contain `DISPATCHER_TIMING` | AC-008c |
| TC-PB-DT4a | post-bash | DISPATCHER_TIMING on stderr | stderr contains `DISPATCHER_TIMING: post-bash-dispatcher completed in` | AC-008b |
| TC-PB-DT4b | post-bash | stdout unaffected | stdout does not contain `DISPATCHER_TIMING` | AC-008c |
| TC-PB-DT5a | post-write-edit | DISPATCHER_TIMING on stderr | stderr contains `DISPATCHER_TIMING: post-write-edit-dispatcher completed in` | AC-008b |
| TC-PB-DT5b | post-write-edit | stdout unaffected | stdout does not contain `DISPATCHER_TIMING` | AC-008c |

---

## 5. Test Data Strategy

### 5.1 Fixtures for performance-budget.test.cjs

All test data is defined as constants within the test file. No external fixture files needed (pure function tests).

**Budget configuration fixtures**:
```javascript
const VALID_CONFIG = {
    performance_budgets: {
        light:    { max_total_minutes: 30, max_phase_minutes: 10, max_debate_rounds: 0, max_fan_out_chunks: 1 },
        standard: { max_total_minutes: 90, max_phase_minutes: 25, max_debate_rounds: 2, max_fan_out_chunks: 4 },
        epic:     { max_total_minutes: 180, max_phase_minutes: 40, max_debate_rounds: 3, max_fan_out_chunks: 8 }
    }
};

const STANDARD_BUDGET = VALID_CONFIG.performance_budgets.standard;
const EPIC_BUDGET = VALID_CONFIG.performance_budgets.epic;
const LIGHT_BUDGET = VALID_CONFIG.performance_budgets.light;
```

**Workflow history fixtures** (for rolling average and regression tests):
```javascript
function makeHistoryEntry(durationMinutes, intensity = 'standard') {
    return {
        status: 'completed',
        sizing: { effective_intensity: intensity },
        metrics: { total_duration_minutes: durationMinutes }
    };
}
```

**Phase timing fixtures** (for dashboard tests):
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

### 5.2 Fixtures for Enforcer Extension Tests

The enforcer tests require a fully-formed `state.json` with:
- `active_workflow` with completed phases and timing data
- `workflow_history` with prior entries for regression comparison

These are constructed using the existing enforcer test's `writeStateFile()` helper.

### 5.3 Fixtures for Dispatcher Tests

Dispatcher tests use the existing `taskInput()` / `activeWorkflowState()` helpers already defined in each dispatcher test file. The new tests only add assertions on stderr content.

### 5.4 Boundary Value Data

| Category | Values | Purpose |
|----------|--------|---------|
| Budget ratio boundaries | 0.800 (exactly 80%), 0.801, 1.000 (exactly 100%), 1.001 | Verify on_track/approaching/exceeded transitions |
| Regression threshold | 20% exactly (not regression), 20.01% (regression) | Verify strictly-greater-than semantics |
| Rolling average count | 0, 1, 2, 5, 7 entries | Verify minimum-2 guard and max-5 window |
| Invalid inputs | `null`, `undefined`, `NaN`, `Infinity`, `-5`, `""`, `3.7`, `{}` | Verify fail-open defaults |
| Empty collections | `[]`, `{}`, `null` | Verify graceful degradation |

---

## 6. Test Execution

### 6.1 Commands

**Run all new performance budget tests**:
```bash
node --test src/claude/hooks/tests/performance-budget.test.cjs
```

**Run all CJS hook tests (including extensions)**:
```bash
npm run test:hooks
```

**Run all tests (ESM + CJS)**:
```bash
npm run test:all
```

### 6.2 Regression Verification

Before declaring Phase 05 (test strategy) complete, the implementation phase (Phase 06) must verify:

1. All 52 new tests pass
2. All existing 555+ tests pass (no regressions from NFR-004)
3. Total test count increases by at least 52

### 6.3 Test Isolation

- Each test creates its own temp directory via `setupTestEnv()` or `fs.mkdtempSync()`
- `CLAUDE_PROJECT_DIR` is set per-test to isolate state.json access
- Module cache is cleared between tests using `delete require.cache[modPath]` for lib modules
- Temp directories are cleaned up in `afterEach()` blocks

---

## 7. Risk Assessment

### 7.1 High-Risk Areas (100% coverage required)

| Area | Risk | Tests |
|------|------|-------|
| `computeBudgetStatus()` boundaries | Wrong classification leads to incorrect warnings/degradation | TC-PB-05 through TC-PB-10 |
| `detectRegression()` threshold | False positives/negatives in regression detection | TC-PB-28 through TC-PB-31 |
| `buildDegradationDirective()` phase matching | Wrong phases get degradation applied | TC-PB-15 through TC-PB-21 |
| Fail-open behavior | Any function throwing would block workflow | All null/NaN/undefined input tests |

### 7.2 Medium-Risk Areas

| Area | Risk | Tests |
|------|------|-------|
| Dashboard formatting | Incorrect display at workflow completion | TC-PB-32 through TC-PB-37 |
| Rolling average computation | Incorrect baseline for regression detection | TC-PB-22 through TC-PB-27 |
| Dispatcher timing output format | Incorrect stderr format could confuse log parsers | TC-PB-DT1a through TC-PB-DT5b |

### 7.3 Low-Risk Areas

| Area | Risk | Tests |
|------|------|-------|
| Budget warning string formatting | Cosmetic output only | TC-PB-11 through TC-PB-14 |
| `getPerformanceBudget()` config lookup | Hardcoded defaults always work | TC-PB-01 through TC-PB-04 |

---

## 8. NFR Verification

| NFR | How Tested | Specific Tests |
|-----|-----------|---------------|
| **NFR-001** (Zero blocking) | Every function tested with null/invalid inputs to verify safe defaults returned. No test asserts a throw. | TC-PB-04, TC-PB-10, TC-PB-14, TC-PB-19, TC-PB-22, TC-PB-31, TC-PB-37 |
| **NFR-002** (Timing accuracy) | Boundary values for budget status use exact ratios. Wall-clock computation tested through enforcer. | TC-PB-05 through TC-PB-09 |
| **NFR-003** (State footprint) | Verified by design (module design Section 4.4 confirms ~1,690 bytes < 2 KB limit). Not runtime-tested. | N/A (design verification) |
| **NFR-004** (Backward compatibility) | TC-PB-CS02 verifies snapshots without timing still work. Existing test suite runs without modification. | TC-PB-CS02 + full regression run |
| **NFR-005** (Observability) | Dispatcher tests verify `DISPATCHER_TIMING:` on stderr. Enforcer tests verify `PERFORMANCE_REGRESSION:` on stderr. Warning tests verify `BUDGET_WARNING:` / `BUDGET_APPROACHING:` prefixes. | TC-PB-DT*, TC-PB-WCE01, TC-PB-11, TC-PB-12 |

---

## 9. Implementation Notes for Phase 06

### 9.1 Test File Creation Order

1. Create `performance-budget.test.cjs` (37 unit tests) first -- validates the core module
2. Extend `common.test.cjs` (2 tests) -- validates snapshot extension
3. Extend `workflow-completion-enforcer.test.cjs` (3 tests) -- validates regression flow
4. Extend 5 dispatcher test files (10 tests total) -- validates timing instrumentation

### 9.2 Test Utility Updates

The `hook-test-utils.cjs` file's `prepareHook()` function copies `['common.cjs', 'provider-utils.cjs', 'three-verb-utils.cjs']` to the lib directory. After `performance-budget.cjs` is created, it must be added to this list so that:
- `prepareHook()` copies it for hooks that `require('./lib/performance-budget.cjs')`
- `prepareDispatcher()` copies it for dispatchers whose hooks require it

### 9.3 Test-First Workflow (Article II)

Per constitutional Article II, the implementation in Phase 06 must follow:
1. Write test (RED) -- test fails because module does not yet exist
2. Implement function (GREEN) -- test passes
3. Refactor if needed

The test specifications in this document define exactly what the tests must assert. The developer writes the test code first, runs it (expecting failure), then implements the production code.

---

## 10. Traceability Summary

| Metric | Count |
|--------|-------|
| Functional Requirements | 8 (FR-001 through FR-008) |
| Non-Functional Requirements | 5 (NFR-001 through NFR-005) |
| Acceptance Criteria | 35 |
| Test Cases | 52 |
| ACs with direct test coverage | 30 |
| ACs with integration/manual coverage | 5 (AC-001a, AC-001b, AC-001c, AC-001e, AC-001f -- isdlc.md integration) |
| Untested ACs | 0 |
| Requirement coverage | 100% |

The 5 ACs covered by integration/manual testing (AC-001a, AC-001b, AC-001c, AC-001e, AC-001f) involve state writes performed by the isdlc.md markdown command during workflow execution. These cannot be unit-tested because isdlc.md is not executable code -- it is a Claude Code command definition. They are verified during the quality loop phase through end-to-end workflow execution.

---

## Appendix A: GATE-04 Validation Checklist

- [x] Test strategy covers unit, integration, E2E (N/A justified), security (N/A justified), performance (N/A justified)
- [x] Test cases exist for all 8 functional requirements
- [x] Test cases exist for all 5 non-functional requirements
- [x] Traceability matrix complete (100% requirement coverage -- 35/35 ACs mapped)
- [x] Coverage targets defined (90% line coverage for new module, 0 regressions)
- [x] Test data strategy documented (Section 5)
- [x] Critical paths identified (Section 7.1)
- [x] Existing test infrastructure leveraged (Section 1)
- [x] Test naming conventions follow project patterns
- [x] Test file locations follow project structure

---

## Appendix B: Constitutional Compliance

| Article | Requirement | Status | Evidence |
|---------|------------|--------|----------|
| **II (Test-First)** | Tests designed before implementation | COMPLIANT | 52 test cases fully specified with inputs, expected outputs, and traceability before any code is written |
| **VII (Traceability)** | Test cases trace to requirements | COMPLIANT | Every test case has AC traceability. Traceability matrix has 100% AC coverage. No orphan tests. |
| **IX (Quality Gate)** | All required artifacts complete | COMPLIANT | test-strategy.md (this doc), test-cases.md (Section 4 of this doc), traceability-matrix.csv (separate artifact) |
| **XI (Integration Testing)** | Integration tests validate component interactions | COMPLIANT | 15 integration tests validate enforcer-regression flow, common.cjs snapshot extension, and all 5 dispatcher timing outputs |
