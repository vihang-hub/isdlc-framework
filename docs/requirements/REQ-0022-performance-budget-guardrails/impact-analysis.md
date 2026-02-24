# Impact Analysis: Performance Budget and Guardrail System

**Generated**: 2026-02-19 (validated)
**Feature**: REQ-0022 -- Per-workflow timing instrumentation, intensity-tier performance budgets, graceful degradation enforcement, regression tracking, and completion dashboard
**Based On**: Phase 01 Requirements (finalized)
**Phase**: 02-impact-analysis
**Backlog Item**: 2.4

---

## Scope Comparison

| Aspect | Original (Phase 00) | Clarified (Phase 01) |
|--------|---------------------|----------------------|
| Description | Enforce per-workflow timing limits and track regression | 8 FRs: per-phase timing, budget config, phase-boundary checks, debate degradation, fan-out degradation, regression tracking, completion dashboard, dispatcher timing |
| Keywords | timing, budget, regression, guardrail | timing, budget, regression, degradation, debate_rounds, fan_out_chunks, dashboard, dispatcher, intensity, rolling_average |
| Estimated Files | 7-9 modify, 1-2 create | 9 modify, 2 create |
| Scope Change | -- | EXPANDED (added degradation mechanisms, dashboard, dispatcher timing) |

---

## Executive Summary

This feature adds a comprehensive performance observability and governance layer to the iSDLC framework. The blast radius is **medium** -- 9 existing files will be modified and 2 new files created, touching the phase-loop controller (isdlc.md), all 5 hook dispatchers, the shared utility library (common.cjs), the workflow configuration (workflows.json), and the workflow-completion-enforcer. Critically, all changes are **additive** -- no existing behavior is modified. The risk is **low-to-medium** because the budget system is entirely advisory (NFR-001: never blocks), degradation is hint-based (agents receive reduced limits via prompt injection), and timing instrumentation uses standard Date.now() calls with fail-open error handling. The primary risk concentrates in the degradation injection logic in STEP 3d of isdlc.md, where incorrect budget status reads could propagate wrong limits to debate/fan-out phases.

**Blast Radius**: MEDIUM (9 files modified, 2 files created, 4 modules affected)
**Risk Level**: LOW-MEDIUM
**Affected Files**: 11 total (9 modify + 2 create)
**Affected Modules**: Phase-Loop Controller, Hook Dispatchers, Shared Utilities, Workflow Config

---

## Impact Analysis

### M1: File-by-File Impact Assessment

#### 1. `src/claude/commands/isdlc.md` (MODIFY -- HIGH IMPACT)

**Current size**: 1513 lines
**Acceptance criteria addressed**: AC-001a, AC-001b, AC-001c, AC-003a-f, AC-004a-e, AC-005a-d, AC-007a-f

This is the **primary integration point** for the feature. The phase-loop controller (STEP 3 series) runs all phases sequentially, and 4 sub-steps require modification:

| Location | Change | FR |
|----------|--------|----|
| STEP 3c-prime (lines ~1030-1041) | Add `phases[phase_key].timing.started_at = new Date().toISOString()`. Preserve existing start on retries (AC-001c). | FR-001 |
| STEP 3d (lines ~1043-1133) | After constructing delegation prompt, check `active_workflow.budget_status`. If "exceeded" or "approaching", inject `BUDGET_DEGRADATION` directive into the prompt for debate-enabled phases (01, 03, 04, 05) and fan-out phases (16, 08). | FR-004, FR-005 |
| STEP 3e (lines ~1135-1151) | Add `phases[phase_key].timing.completed_at`, compute `wall_clock_minutes`. Call budget check function: compare elapsed vs budget, set `budget_status`, emit warnings to stderr. Record debate_rounds_used, fan_out_chunks from agent result. | FR-001, FR-003 |
| Between STEP 3 loop exit and STEP 4 (line ~1465) | Render completion dashboard: read all phase timings, format table, display budget consumption, regression status, degradation count. | FR-007 |

**Outward dependencies** (files that depend on isdlc.md behavior):
- All phase agents receive delegation prompts -- they will now see `BUDGET_DEGRADATION` directives
- `state.json` schema extends with `timing` and `budget_status` fields

**Inward dependencies** (what isdlc.md depends on):
- `src/claude/hooks/lib/performance-budget.cjs` (NEW) -- budget computation, degradation logic, dashboard formatting
- `src/isdlc/config/workflows.json` -- reads `performance_budgets` section
- `.isdlc/state.json` -- reads/writes timing and budget fields

#### 2. `src/isdlc/config/workflows.json` (MODIFY -- LOW IMPACT)

**Current size**: 350 lines
**Acceptance criteria addressed**: AC-002a, AC-002b

Add a `performance_budgets` section under `feature` and `fix` workflow definitions. This is a pure additive change to a JSON configuration file.

```
workflows.feature.performance_budgets = {
  light:    { max_total_minutes: 30,  max_phase_minutes: 10, max_debate_rounds: 0, max_fan_out_chunks: 1 },
  standard: { max_total_minutes: 90,  max_phase_minutes: 25, max_debate_rounds: 2, max_fan_out_chunks: 4 },
  epic:     { max_total_minutes: 180, max_phase_minutes: 40, max_debate_rounds: 3, max_fan_out_chunks: 8 }
}
```

**Outward dependencies**: Phase-loop controller reads this config at STEP 3e.
**Inward dependencies**: None -- this is a leaf configuration file.
**Risk**: Minimal. If section is missing, AC-002c provides hardcoded fallback defaults.

#### 3. `src/claude/hooks/lib/common.cjs` (MODIFY -- MEDIUM IMPACT)

**Current size**: 3453 lines, 86 exported functions
**Acceptance criteria addressed**: AC-001d (extend collectPhaseSnapshots), AC-006a-e (regression utilities)

The requirements specify new utility functions in `performance-budget.cjs` (separate file), but `common.cjs` needs one modification: extending `collectPhaseSnapshots()` (line 2291) to include `timing` data in each snapshot.

Current snapshot fields: `key, status, started, completed, gate_passed, duration_minutes, summary, artifacts, test_iterations`
New field to add: `timing` (copied from `phases[phase_key].timing` if present)

Additionally, `_computeMetrics()` (line 2243) may need to include `total_timing_data` or a `regression_check` field, but this is better handled at the caller site (workflow-completion-enforcer) or in the new performance-budget.cjs module.

**Outward dependencies**: `collectPhaseSnapshots()` is called by:
- `workflow-completion-enforcer.cjs` (line ~36 import)
- `00-sdlc-orchestrator.md` (finalize step, via cancel handler)
- `isdlc.md` (cancel action)

**Risk**: Low. Adding a field to snapshots is backward-compatible. Existing consumers ignore unknown fields.

#### 4. `src/claude/hooks/lib/performance-budget.cjs` (CREATE -- MEDIUM IMPACT)

**Acceptance criteria addressed**: AC-002c-e, AC-003a-f, AC-004a-e, AC-005a-d, AC-006a-e, AC-007a-f

New CJS module containing:

| Function | Purpose | Called From |
|----------|---------|-------------|
| `getPerformanceBudget(workflows, intensity)` | Look up budget tier from workflows.json with fallback defaults | isdlc.md STEP 3e |
| `computeBudgetStatus(elapsed, budget)` | Returns "on_track", "approaching", or "exceeded" | isdlc.md STEP 3e |
| `buildBudgetWarning(elapsed, budget, phase, intensity)` | Format warning string for stderr | isdlc.md STEP 3e |
| `buildDegradationDirective(budgetStatus, tier, phaseKey, flags)` | Generate BUDGET_DEGRADATION prompt text | isdlc.md STEP 3d |
| `computeRollingAverage(history, intensity, maxPrior)` | Compute rolling avg of last N workflows | workflow-completion-enforcer or isdlc.md pre-STEP-4 |
| `detectRegression(currentMinutes, rollingAvg, threshold)` | Returns regression object | isdlc.md pre-STEP-4 |
| `formatCompletionDashboard(phases, budget, regression)` | Format the timing summary table | isdlc.md pre-STEP-4 |

**Inward dependencies**: Requires `fs` and `path` (Node built-ins only). May import `getProjectRoot()` and `readState()` from `common.cjs` if needed.
**Outward dependencies**: Called by isdlc.md and workflow-completion-enforcer.cjs.

#### 5-9. `src/claude/hooks/dispatchers/*.cjs` (MODIFY -- 5 files, LOW IMPACT each)

**Files**: pre-task-dispatcher.cjs (195 lines), post-task-dispatcher.cjs (129 lines), pre-skill-dispatcher.cjs (123 lines), post-bash-dispatcher.cjs (118 lines), post-write-edit-dispatcher.cjs (122 lines)
**Acceptance criteria addressed**: AC-008a, AC-008b, AC-008c

Each dispatcher needs 3 lines of timing instrumentation:

```javascript
// At top of main():
const dispatcherStart = Date.now();

// After hook loop, before process.exit(0):
const elapsed = Date.now() - dispatcherStart;
console.error(`DISPATCHER_TIMING: {name} completed in ${elapsed}ms (${hookCount} hooks)`);
```

**Pattern**: Identical change across all 5 dispatchers. The timing output goes to stderr only, preserving the stdout JSON protocol (AC-008c).

**Outward dependencies**: None -- stderr timing is observational, consumed by external monitoring only.
**Inward dependencies**: None beyond existing `Date.now()` (no new imports required).
**Risk**: Very low. Timing output is append-only to stderr. Existing tests verify stdout JSON output; stderr additions do not interfere.

#### 10. `src/claude/hooks/workflow-completion-enforcer.cjs` (MODIFY -- MEDIUM IMPACT)

**Current size**: 223 lines
**Acceptance criteria addressed**: AC-006a-e (regression tracking at workflow completion)

This hook fires when `active_workflow` is cleared from state.json. It currently reconstructs snapshots and applies pruning. The modification adds:

1. After `collectPhaseSnapshots()`: extract `total_duration_minutes` from metrics
2. Read `workflow_history[]` to find prior workflows of same intensity tier
3. Call `computeRollingAverage()` and `detectRegression()` from performance-budget.cjs
4. Write `regression_check` object to the current `workflow_history` entry

**Risk**: Medium. This hook manages its own `readState()/writeState()` independently of the dispatcher. The regression computation must not throw -- any error must be caught fail-open (consistent with existing hook philosophy).

#### 11. `src/claude/hooks/tests/performance-budget.test.cjs` (CREATE)

New test file for `performance-budget.cjs`. Expected test cases:

- `getPerformanceBudget()`: valid tier lookup, fallback defaults, missing config
- `computeBudgetStatus()`: on_track, approaching, exceeded boundaries
- `buildDegradationDirective()`: debate phases, fan-out phases, no-debate flag, no-fan-out flag
- `computeRollingAverage()`: 0 prior, 1 prior, 2-5 prior, intensity filtering
- `detectRegression()`: no regression, >20% regression, insufficient data
- `formatCompletionDashboard()`: full dashboard, no regression, degradation applied

### Dependency Graph

```
workflows.json ──────────────────┐
                                  v
performance-budget.cjs (NEW) ◄── isdlc.md STEP 3c'/3d/3e/dashboard
    │                             │
    │                             ├── state.json (timing, budget_status)
    │                             │
    └────────────────────────────► workflow-completion-enforcer.cjs
                                      │
                                      └── state.json (workflow_history.regression_check)

common.cjs ── collectPhaseSnapshots() ── includes timing fields

dispatchers (5x) ── standalone timing instrumentation (no cross-dependency)
```

### Change Propagation Summary

| Starting Point | Propagates To | Depth |
|---------------|---------------|-------|
| workflows.json (config) | isdlc.md -> state.json -> workflow_history | 3 hops |
| isdlc.md STEP 3e (budget check) | state.json budget_status -> STEP 3d degradation | 1 hop |
| isdlc.md STEP 3d (degradation) | Agent delegation prompts (all debate/fan-out agents) | 1 hop |
| common.cjs (snapshot extension) | workflow-completion-enforcer -> workflow_history | 2 hops |
| dispatchers (timing) | stderr only (no propagation) | 0 hops |

---

## Entry Points

### M2: Entry Point Analysis

#### Existing Entry Points Affected

| Entry Point | Type | FRs Affected | Change |
|-------------|------|-------------|--------|
| `/isdlc feature "..."` | CLI command | FR-001 through FR-007 | Feature workflows gain timing, budgets, degradation, dashboard |
| `/isdlc fix "..."` | CLI command | FR-001, FR-002, FR-003, FR-007 | Fix workflows gain timing and budgets (no debates, so FR-004 N/A) |
| `/isdlc build "..."` | CLI alias | Same as feature | Alias for feature |
| `/isdlc cancel` | CLI command | FR-001d | Cancel handler already calls `collectPhaseSnapshots()` -- timing data included automatically |
| `/isdlc status` | CLI command | (indirect) | Could display budget_status from state.json (not required by FR, but natural extension) |

#### New Entry Points Required

None. All functionality integrates into existing entry points (phase-loop controller in isdlc.md).

#### Implementation Chain (Entry to Data Layer)

```
User invokes: /isdlc feature "..."
  -> isdlc.md Phase-Loop Controller
    -> STEP 3c-prime: write timing.started_at to state.json
    -> STEP 3d: read budget_status, inject BUDGET_DEGRADATION into delegation prompt
    -> STEP 3e: write timing.completed_at, compute wall_clock_minutes
    -> STEP 3e: call computeBudgetStatus(), write budget_status to state.json
    -> STEP 3e: emit BUDGET_WARNING/BUDGET_APPROACHING to stderr
  (loop completes)
    -> Pre-STEP-4: call formatCompletionDashboard(), display to user
    -> STEP 4: orchestrator finalize
      -> workflow-completion-enforcer fires
        -> collectPhaseSnapshots() includes timing data
        -> computeRollingAverage() + detectRegression()
        -> write regression_check to workflow_history
```

#### Recommended Implementation Order

The implementation should proceed in this order, with each step building on the previous:

| Order | File(s) | Rationale |
|-------|---------|-----------|
| 1 | `src/claude/hooks/lib/performance-budget.cjs` + tests | Foundation: all utility functions with unit tests. No external dependencies. |
| 2 | `src/isdlc/config/workflows.json` | Configuration: add performance_budgets section. Pure data, no logic. |
| 3 | `src/claude/hooks/lib/common.cjs` | Extension: add timing field to collectPhaseSnapshots(). Backward-compatible. |
| 4 | `src/claude/commands/isdlc.md` (STEP 3c-prime, 3e) | Core: timing instrumentation at phase boundaries. Depends on #1 and #2. |
| 5 | `src/claude/commands/isdlc.md` (STEP 3d) | Degradation: inject BUDGET_DEGRADATION into delegation prompts. Depends on #4 (budget_status must be computed). |
| 6 | `src/claude/commands/isdlc.md` (pre-STEP-4 dashboard) | Display: render completion dashboard. Depends on #1 (formatCompletionDashboard) and #4 (timing data). |
| 7 | `src/claude/hooks/workflow-completion-enforcer.cjs` | Regression: compare against rolling average. Depends on #1 and #3. |
| 8 | `src/claude/hooks/dispatchers/*.cjs` (5 files) | Independent: dispatcher timing can be added at any point. No dependencies on other changes. |

---

## Risk Assessment

### M3: Risk Analysis

#### Test Coverage Assessment

| File | Existing Test File | Lines | Coverage Assessment |
|------|-------------------|-------|---------------------|
| `pre-task-dispatcher.cjs` | `test-pre-task-dispatcher.test.cjs` | 497 | Good (16 test cases) |
| `post-task-dispatcher.cjs` | `test-post-task-dispatcher.test.cjs` | 365 | Good (15 test cases) |
| `pre-skill-dispatcher.cjs` | `test-pre-skill-dispatcher.test.cjs` | 368 | Good (14 test cases) |
| `post-bash-dispatcher.cjs` | `test-post-bash-dispatcher.test.cjs` | 384 | Good (15 test cases) |
| `post-write-edit-dispatcher.cjs` | `test-post-write-edit-dispatcher.test.cjs` | 408 | Good (16 test cases) |
| `common.cjs` | `common.test.cjs` (142 lines) + `test-common.test.cjs` (3013 lines, 195 tests) | 3155 | Medium-Good -- 195 test cases covering 86 exports |
| `workflow-completion-enforcer.cjs` | `workflow-completion-enforcer.test.cjs` | 444 | Good (22 test cases) |
| `isdlc.md` | N/A (markdown command) | N/A | Not unit-testable (integration test only) |
| `workflows.json` | N/A (config) | N/A | Validated by schema at load time |
| `performance-budget.cjs` (NEW) | `performance-budget.test.cjs` (NEW) | 0 | Must create from scratch |

#### Complexity Hotspots

| File | Complexity | Risk Factor |
|------|-----------|-------------|
| `isdlc.md` STEP 3d (degradation injection) | HIGH | Budget status must be read correctly from state.json. Debate-enabled phases (01, 03, 04, 05) and fan-out phases (16, 08) have different degradation rules. Flag precedence (--no-debate, --no-fan-out) must be respected. |
| `isdlc.md` STEP 3e (budget check + timing) | MEDIUM | Multiple writes to state.json in sequence (timing + budget_status). Must handle retry case (preserve started_at). Elapsed time calculation from active_workflow.started_at. |
| `workflow-completion-enforcer.cjs` (regression) | MEDIUM | Reads fresh state from disk. Must filter workflow_history by intensity tier. Rolling average with < 2 entries must skip silently. |
| `performance-budget.cjs` (all functions) | LOW | Pure utility functions with well-defined inputs/outputs. Easy to unit test. |
| `dispatchers/*.cjs` (timing) | VERY LOW | 3-line change per file. No logic complexity. |

#### Technical Debt Markers

| Location | Debt Item | Impact on This Feature |
|----------|-----------|----------------------|
| `common.cjs` (3453 lines) | File is already large (86 exports). Requirements spec correctly places new logic in separate `performance-budget.cjs`. | Low impact -- we avoid growing common.cjs further. But the `collectPhaseSnapshots()` extension still touches common.cjs. |
| `pre-task-dispatcher.cjs` (DEGRADATION_HINT) | Lines 122-138 already emit a `DEGRADATION_HINT` for phase timeouts. This overlaps with the new `BUDGET_DEGRADATION` directive from isdlc.md STEP 3d. | Potential confusion: two degradation mechanisms. The existing DEGRADATION_HINT is hook-level (per-tool-call); the new BUDGET_DEGRADATION is phase-level (per-delegation). They serve different purposes but the naming overlap could confuse agents. Recommendation: document the distinction clearly. |
| `isdlc.md` (1513 lines) | The phase-loop controller is already complex with STEP 3a through 3f-blast-radius, plus 3e-review, 3e-sizing, 3e-refine. Adding timing + budget + degradation + dashboard increases this further. | Risk of isdlc.md becoming unwieldy. Mitigation: keep most logic in performance-budget.cjs; isdlc.md just calls utility functions and inserts results. |
| `workflow-completion-enforcer.cjs` (special I/O) | This hook reads fresh state from disk and writes back independently of the dispatcher. Adding regression logic increases the amount of work done in this special-case hook. | Medium concern. Ensure regression computation is wrapped in try/catch fail-open. |

#### Risk Recommendations per Acceptance Criterion

| AC | Risk | Recommendation |
|----|------|----------------|
| AC-001a,b (timing start/end) | Low | Simple timestamp writes. Ensure ISO-8601 format matches existing `started`/`completed` fields. |
| AC-001c (retry preservation) | Medium | Must detect retry case. Check if `timing.started_at` already exists before overwriting. Test with manual redo scenario. |
| AC-001e,f (debate/fan-out counts) | Medium | Agent result must include these counts. Need contract: agents populate timing fields or caller extracts from result. |
| AC-002a-e (budget config) | Low | Pure config. Hardcoded fallbacks ensure backward compatibility. |
| AC-003a-f (budget check) | Low | Advisory only. All warnings go to stderr. Never blocks. |
| AC-004a-e (debate degradation) | HIGH | Must correctly identify debate-enabled phases. Must respect --no-debate flag. Must inject into delegation prompt without breaking existing prompt structure. |
| AC-005a-d (fan-out degradation) | HIGH | Same concerns as debate degradation but for fan-out phases. Must not conflict with --no-fan-out flag. |
| AC-006a-e (regression tracking) | Medium | Rolling average with insufficient data must skip silently. Intensity tier filtering for fix workflows (default "standard"). |
| AC-007a-f (dashboard) | Low | Display-only. Formatting errors should be caught fail-open. |
| AC-008a-c (dispatcher timing) | Very Low | Trivial instrumentation. Existing tests unaffected (stderr only). |

#### Risk Zones (Intersections of Breaking Changes + Low Coverage)

1. **isdlc.md + no unit tests**: The phase-loop controller cannot be unit tested (it is a markdown command file). All STEP 3c-prime/3d/3e changes must be validated through integration testing (run a workflow end-to-end). This is the highest risk area.

2. **common.cjs + low test coverage**: `collectPhaseSnapshots()` has basic test coverage via `workflow-completion-enforcer.test.cjs` but no direct unit tests for the function itself. The timing field extension should be tested directly.

3. **Degradation prompt injection**: No existing test infrastructure validates the content of delegation prompts. The BUDGET_DEGRADATION directive is injected as text -- there is no schema validation that agents parse it correctly.

#### Recommended Test Additions BEFORE Implementation

| Priority | Test | Rationale |
|----------|------|-----------|
| P0 | `performance-budget.test.cjs` -- all functions | Foundation must be tested first |
| P1 | Add test to `common.test.cjs` for `collectPhaseSnapshots()` with timing data | Verify backward-compatible snapshot extension |
| P1 | Add test to `workflow-completion-enforcer.test.cjs` for regression check flow | Verify regression detection path |
| P2 | Add stderr-capture tests to each dispatcher test file verifying `DISPATCHER_TIMING` output | Verify timing instrumentation does not break JSON protocol |
| P3 | Manual integration test: run feature workflow, verify dashboard output | End-to-end validation |

---

## Implementation Recommendations

Based on the impact analysis:

1. **Suggested Order**: Foundation first (performance-budget.cjs + tests), then config (workflows.json), then core (isdlc.md timing/budget), then degradation (isdlc.md STEP 3d), then display (dashboard), then regression (workflow-completion-enforcer), then instrumentation (dispatchers). See detailed order in Entry Points section.

2. **High-Risk Areas -- Add Tests First**:
   - Write `performance-budget.test.cjs` before implementing any logic
   - Add `collectPhaseSnapshots()` timing test to `common.test.cjs` before modifying the function
   - Add regression check test to `workflow-completion-enforcer.test.cjs` before modifying the hook

3. **Dependencies to Resolve**:
   - Define the agent-to-caller contract for `debate_rounds_used` and `fan_out_chunks` -- how do agents report these values back? Currently these counts are not in the agent return schema.
   - Clarify whether `BUDGET_DEGRADATION` is a new standard prompt section (like `WORKFLOW MODIFIERS`) or ad-hoc text injection. Recommend creating a standard format.
   - Decide whether the existing `DEGRADATION_HINT` in pre-task-dispatcher.cjs should be deprecated, merged with, or left independent of the new `BUDGET_DEGRADATION` system.

4. **NFR Compliance Checkpoints**:
   - NFR-001 (Zero Blocking): Verify every new code path has try/catch fail-open
   - NFR-003 (State Footprint): Verify timing adds < 150 bytes per phase (~6 fields x 25 bytes)
   - NFR-004 (Backward Compatibility): Run full test suite after each file modification
   - NFR-005 (Observability): Verify all warnings use correct stderr prefixes

---

## Impact Analysis Metadata

```json
{
  "analysis_completed_at": "2026-02-19T06:00:00Z",
  "analysis_validated_at": "2026-02-19T06:00:00Z",
  "sub_agents": ["M1-impact-analyzer", "M2-entry-point-finder", "M3-risk-assessor"],
  "requirements_document": "docs/requirements/REQ-0022-performance-budget-guardrails/requirements.md",
  "quick_scan_used": "docs/requirements/REQ-0022-performance-budget-guardrails/quick-scan.md",
  "scope_change_from_original": "expanded",
  "requirements_keywords": ["timing", "budget", "regression", "degradation", "debate_rounds", "fan_out_chunks", "dashboard", "dispatcher", "intensity", "rolling_average"],
  "files_to_modify": 9,
  "files_to_create": 2,
  "total_affected_files": 11,
  "blast_radius": "medium",
  "risk_level": "low-medium",
  "acceptance_criteria_count": 35,
  "functional_requirements_count": 8,
  "non_functional_requirements_count": 5
}
```
