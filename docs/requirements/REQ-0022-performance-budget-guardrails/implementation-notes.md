# Implementation Notes: REQ-0022 Performance Budget and Guardrail System

**Phase**: 06-implementation
**Implemented**: 2026-02-19
**Traces To**: FR-001 through FR-008, NFR-001 through NFR-005, AC-001 through AC-008

---

## Summary

Implemented the performance budget and guardrail system as a new CJS module (`performance-budget.cjs`) with 7 exported utility functions, plus modifications to 9 existing files. The system provides budget tracking, degradation directives, regression detection, and a completion dashboard -- all operating in a fail-open, advisory capacity.

## Files Created

### 1. `src/claude/hooks/lib/performance-budget.cjs` (NEW - 582 lines)
Foundation module with 7 exported pure functions and 1 frozen constants object:
- `getPerformanceBudget()` - Budget tier lookup with hardcoded fallback defaults
- `computeBudgetStatus()` - Elapsed-vs-budget classification (on_track/approaching/exceeded)
- `buildBudgetWarning()` - Stderr warning string formatting
- `buildDegradationDirective()` - BUDGET_DEGRADATION text block generation
- `computeRollingAverage()` - Rolling average from workflow history
- `detectRegression()` - Regression detection with configurable threshold
- `formatCompletionDashboard()` - Human-readable timing summary table
- `_constants` - Frozen object with DEFAULT_BUDGETS, DEBATE_ENABLED_PHASES, etc.

### 2. `src/claude/hooks/tests/performance-budget.test.cjs` (NEW - 403 lines)
38 unit tests covering all 7 functions plus constants export validation.

## Files Modified

### 3. `src/isdlc/config/workflows.json`
Added `performance_budgets` section to both `feature` and `fix` workflows:
- Feature: 3 tiers (light/standard/epic) with max_total_minutes, max_phase_minutes, max_debate_rounds, max_fan_out_chunks
- Fix: 1 tier (standard only, per AC-002e)

### 4. `src/claude/hooks/lib/common.cjs`
Extended `collectPhaseSnapshots()` with 3 lines to conditionally include `timing` data in phase snapshots when present (REQ-0022, backward compatible).

### 5. `src/claude/commands/isdlc.md`
Added 4 integration points:
- **STEP 3c-prime-timing**: Per-phase timing start (initialize timing object, handle retries)
- **STEP 3d BUDGET_DEGRADATION**: Degradation directive injection into delegation prompts
- **STEP 3e-timing**: Per-phase timing end, PHASE_TIMING_REPORT extraction, budget check
- **STEP 3-dashboard**: Completion dashboard rendering before STEP 4

### 6. `src/claude/hooks/workflow-completion-enforcer.cjs`
Added regression tracking block (~35 lines) between snapshot patching and pruning. Computes rolling average from prior history, detects regression, writes `regression_check` to workflow_history entry.

### 7-11. Five Dispatcher Files
Added timing instrumentation to all 5 dispatchers:
- `pre-task-dispatcher.cjs` - `_now` helper, `_dispatcherStart`, `_hooksRan` counter, `DISPATCHER_TIMING` stderr output
- `post-task-dispatcher.cjs` - Same pattern
- `pre-skill-dispatcher.cjs` - Same pattern
- `post-bash-dispatcher.cjs` - Same pattern
- `post-write-edit-dispatcher.cjs` - Same pattern (adapted for non-loop hook structure)

## Key Design Decisions

1. **Fail-open pattern**: Every function wraps in try/catch returning safe defaults. Consistent with the project's gate-requirements-injector.cjs pattern and NFR-001.

2. **Pure functions**: No state.json writes, no process.exit calls, no side effects. All 7 functions are deterministic given same inputs.

3. **Boundary semantics**: Carefully implemented per AC-003d/AC-003e:
   - ratio <= 0.8 = on_track
   - 0.8 < ratio <= 1.0 = approaching
   - ratio > 1.0 = exceeded

4. **Regression threshold**: Uses strictly greater than (`>`) at the 20% boundary per design spec, meaning exactly at 20% is NOT a regression.

5. **Dispatcher timing**: Uses `performance.now()` with `Date.now()` fallback via `_now` helper (ADR-0004). Timing output is stderr-only per AC-008c.

## Test Results

- **38 new tests**: All passing (performance-budget.test.cjs)
- **2054/2055 existing tests**: All passing except 1 pre-existing failure in test-gate-blocker-extended.test.cjs (supervised_review test, unrelated to this feature)
- **Coverage**: All 7 functions tested with edge cases, boundary conditions, invalid inputs, and fail-open behavior

## Backward Compatibility

- All new state.json fields are additive (NFR-004)
- `collectPhaseSnapshots()` change is backward-compatible (timing field omitted when absent)
- Dispatcher timing output goes to stderr only (stdout unaffected)
- Workflows.json change adds new `performance_budgets` property alongside existing properties
- `getPerformanceBudget()` has hardcoded fallbacks if workflows.json config is missing
