# Requirements Specification: Performance Budget and Guardrail System

**ID**: REQ-0022
**Type**: Feature — Performance Observability & Governance
**Generated**: 2026-02-17
**Backlog Item**: 2.4

---

## 1. Overview

Add per-workflow timing instrumentation, intensity-tier performance budgets, graceful degradation enforcement, regression tracking across workflows, and a completion dashboard. The system prevents slow erosion of T1-T3 performance gains as debate loops, fan-out, and cross-validation features are added.

**Builds On**: T1-T3 dispatcher timing, REQ-0005 (workflow_history), REQ-0011 (adaptive sizing), REQ-0014-0017 (debates, fan-out).

---

## 2. Functional Requirements

### FR-001: Per-Phase Timing Instrumentation

The phase-loop controller SHALL record wall-clock start and end timestamps for every phase, computing duration in minutes and storing it in `state.json` alongside existing phase status fields.

**Acceptance Criteria:**

- AC-001a: Given the phase-loop controller enters STEP 3c-prime (pre-delegation state update), when it activates a phase, then it SHALL set `phases[phase_key].timing.started_at` to the current ISO-8601 timestamp.
- AC-001b: Given the phase-loop controller enters STEP 3e (post-phase state update), when a phase completes, then it SHALL set `phases[phase_key].timing.completed_at` to the current ISO-8601 timestamp and `phases[phase_key].timing.wall_clock_minutes` to `Math.round((completed_at - started_at) / 60000)`.
- AC-001c: Given a phase is retried (supervised redo or blast-radius re-implementation), when the phase re-enters STEP 3c-prime, then `timing.started_at` SHALL be preserved from the first run and `timing.retries` SHALL be incremented by 1.
- AC-001d: Given a workflow completes, when `collectPhaseSnapshots()` runs, then each snapshot SHALL include the `timing` object from `phases[phase_key].timing`.
- AC-001e: Given a phase has debate rounds, when the phase completes, then `phases[phase_key].timing.debate_rounds_used` SHALL contain the number of debate rounds executed (0 if no debates).
- AC-001f: Given a phase uses fan-out (Phase 16 or Phase 08), when the phase completes, then `phases[phase_key].timing.fan_out_chunks` SHALL contain the number of chunks spawned (0 if no fan-out).

### FR-002: Performance Budget Configuration

The framework SHALL define performance budgets per workflow intensity tier in `workflows.json`, specifying maximum total workflow duration and maximum per-phase duration.

**Acceptance Criteria:**

- AC-002a: Given `workflows.json`, when a `performance_budgets` section is present under a workflow definition, then it SHALL contain entries for `light`, `standard`, and `epic` intensity tiers.
- AC-002b: Given an intensity tier entry, when read by the phase-loop controller, then it SHALL contain at minimum: `max_total_minutes` (integer), `max_phase_minutes` (integer), `max_debate_rounds` (integer), and `max_fan_out_chunks` (integer).
- AC-002c: Given `performance_budgets` section is missing from `workflows.json`, when the phase-loop controller reads it, then it SHALL fall back to hardcoded defaults: light `{max_total_minutes: 30, max_phase_minutes: 10, max_debate_rounds: 0, max_fan_out_chunks: 1}`, standard `{max_total_minutes: 90, max_phase_minutes: 25, max_debate_rounds: 2, max_fan_out_chunks: 4}`, epic `{max_total_minutes: 180, max_phase_minutes: 40, max_debate_rounds: 3, max_fan_out_chunks: 8}`.
- AC-002d: Given `active_workflow.sizing.effective_intensity` is set in state.json, when the phase-loop controller reads the budget, then it SHALL use the effective intensity (not the recommended intensity) to look up the budget tier.
- AC-002e: Given a fix workflow (which has no sizing step), when the phase-loop controller reads the budget, then it SHALL default to the `standard` tier budget.

### FR-003: Budget Check at Phase Boundaries

The phase-loop controller SHALL check elapsed workflow time against the budget at every phase boundary (after STEP 3e, before STEP 3e-review) and emit a warning if the budget is exceeded.

**Acceptance Criteria:**

- AC-003a: Given the phase-loop controller completes STEP 3e for any phase, when it calculates `elapsed_minutes = (now - active_workflow.started_at) / 60000`, then it SHALL compare against `performance_budgets[effective_intensity].max_total_minutes`.
- AC-003b: Given `elapsed_minutes > max_total_minutes`, when the budget check runs, then it SHALL emit a `BUDGET_WARNING` to stderr with format: `"BUDGET WARNING: Workflow has consumed {elapsed}m of {budget}m budget ({percent}%). Phase {phase_key} took {phase_duration}m."`.
- AC-003c: Given `elapsed_minutes > max_total_minutes`, when the budget check runs, then it SHALL write `active_workflow.budget_status = "exceeded"` and `active_workflow.budget_exceeded_at_phase = phase_key` to state.json.
- AC-003d: Given `elapsed_minutes <= max_total_minutes * 0.8`, when the budget check runs, then it SHALL write `active_workflow.budget_status = "on_track"` to state.json.
- AC-003e: Given `elapsed_minutes > max_total_minutes * 0.8` AND `elapsed_minutes <= max_total_minutes`, when the budget check runs, then it SHALL write `active_workflow.budget_status = "approaching"` to state.json and emit a milder `BUDGET_APPROACHING` warning to stderr.
- AC-003f: Given the budget check runs, when it determines budget status, then it SHALL NEVER block the workflow. Budget checks are advisory only — workflow execution always continues.

### FR-004: Graceful Degradation of Debate Rounds

When the workflow budget is exceeded or approaching, the phase-loop controller SHALL reduce the maximum debate rounds for subsequent debate-enabled phases.

**Acceptance Criteria:**

- AC-004a: Given `active_workflow.budget_status` is `"exceeded"`, when the phase-loop controller delegates to a debate-enabled phase (01, 03, 04, 05), then it SHALL include `BUDGET_DEGRADATION: max_debate_rounds=1` in the agent delegation prompt.
- AC-004b: Given `active_workflow.budget_status` is `"approaching"`, when the phase-loop controller delegates to a debate-enabled phase, then it SHALL include `BUDGET_DEGRADATION: max_debate_rounds={tier_max - 1}` in the delegation prompt (minimum 1).
- AC-004c: Given `active_workflow.budget_status` is `"on_track"`, when the phase-loop controller delegates to a debate-enabled phase, then it SHALL NOT include any `BUDGET_DEGRADATION` directive.
- AC-004d: Given a `BUDGET_DEGRADATION` directive is applied, when the phase completes, then `phases[phase_key].timing.debate_rounds_degraded_to` SHALL record the reduced round count.
- AC-004e: Given `--no-debate` flag is active, when the budget check considers debate degradation, then it SHALL skip degradation (debates already disabled).

### FR-005: Graceful Degradation of Fan-Out Parallelism

When the workflow budget is exceeded, the phase-loop controller SHALL reduce fan-out chunk count for subsequent fan-out phases.

**Acceptance Criteria:**

- AC-005a: Given `active_workflow.budget_status` is `"exceeded"`, when the phase-loop controller delegates to a fan-out phase (16-quality-loop, 08-code-review), then it SHALL include `BUDGET_DEGRADATION: max_fan_out_chunks=2` in the agent delegation prompt.
- AC-005b: Given `active_workflow.budget_status` is `"approaching"`, when the phase-loop controller delegates to a fan-out phase, then it SHALL include `BUDGET_DEGRADATION: max_fan_out_chunks={tier_max / 2}` (floor, minimum 2) in the delegation prompt.
- AC-005c: Given `--no-fan-out` flag is active, when the budget check considers fan-out degradation, then it SHALL skip degradation (fan-out already disabled).
- AC-005d: Given a `BUDGET_DEGRADATION` directive is applied to fan-out, when the phase completes, then `phases[phase_key].timing.fan_out_degraded_to` SHALL record the reduced chunk count.

### FR-006: Regression Tracking Across Workflows

At workflow completion, the framework SHALL compare the current workflow's timing against a rolling average of the last 5 completed workflows of the same intensity tier and flag regressions.

**Acceptance Criteria:**

- AC-006a: Given a workflow completes, when the finalize step runs, then it SHALL read `workflow_history[]` and filter for entries with matching `sizing.effective_intensity` (or `"standard"` for fix workflows).
- AC-006b: Given at least 2 prior workflows of the same intensity exist, when the comparison runs, then it SHALL compute the rolling average of `total_duration_minutes` from the last 5 (or fewer if < 5 exist).
- AC-006c: Given the current workflow's `total_duration_minutes` exceeds the rolling average by more than 20%, when the comparison runs, then it SHALL flag a `PERFORMANCE_REGRESSION` warning with: current duration, rolling average, percent over, and the slowest phase (by `wall_clock_minutes`).
- AC-006d: Given fewer than 2 prior workflows of the same intensity exist, when the comparison runs, then it SHALL skip regression detection silently (insufficient data).
- AC-006e: Given the regression check runs, when it produces results, then it SHALL write `workflow_history[current].regression_check = { baseline_avg_minutes, current_minutes, percent_over, regressed: boolean, slowest_phase }` to state.json.

### FR-007: Completion Dashboard

At workflow completion, the phase-loop controller SHALL display a human-readable timing summary showing per-phase durations, budget consumption, debate/fan-out usage, and regression status.

**Acceptance Criteria:**

- AC-007a: Given a workflow completes (all phases done, before STEP 4 finalize), when the phase-loop controller renders the dashboard, then it SHALL display a table with one row per phase showing: phase name, wall_clock_minutes, debate_rounds_used (if applicable), fan_out_chunks (if applicable).
- AC-007b: Given the dashboard renders, when the workflow has a budget, then it SHALL display: `"Workflow completed in {total}m ({intensity} budget: {budget}m)"` as the header line.
- AC-007c: Given the dashboard renders, when a regression was detected (FR-006), then it SHALL display: `"REGRESSION: {percent}% slower than {intensity} average ({avg}m). Slowest phase: {phase} ({duration}m)"`.
- AC-007d: Given the dashboard renders, when any phase had degradation applied, then it SHALL display: `"Degradation applied: {count} phases had reduced debate rounds or fan-out chunks"`.
- AC-007e: Given the dashboard renders, when the workflow completed under budget, then it SHALL display: `"Budget: {consumed}m / {budget}m ({percent}%) — ON TRACK"`.
- AC-007f: Given the dashboard renders, when the workflow exceeded the budget, then it SHALL display: `"Budget: {consumed}m / {budget}m ({percent}%) — EXCEEDED at Phase {phase}"`.

### FR-008: Hook Dispatcher Timing Instrumentation

Each hook dispatcher SHALL measure its own total execution time and report it to stderr for observability.

**Acceptance Criteria:**

- AC-008a: Given any hook dispatcher (pre-task, post-task, pre-skill, post-bash, post-write-edit) begins execution, when it starts the hook loop, then it SHALL record `dispatcher_start = performance.now()` (or `Date.now()` if `performance` unavailable).
- AC-008b: Given any hook dispatcher completes its hook loop, when it outputs results, then it SHALL emit `DISPATCHER_TIMING: {dispatcher_name} completed in {elapsed_ms}ms ({hook_count} hooks)` to stderr.
- AC-008c: Given timing instrumentation is added to dispatchers, when any existing test runs, then it SHALL pass without modification (timing output goes to stderr only, does not affect JSON protocol on stdout).

---

## 3. Non-Functional Requirements

### NFR-001: Zero Workflow Blocking

- Budget checks, degradation hints, regression warnings, and dashboard rendering SHALL NEVER block or halt a workflow.
- All performance budget enforcement SHALL be advisory — the workflow always proceeds.
- Failure to compute budget, timing, or regression SHALL be handled fail-open (log warning, continue).

### NFR-002: Timing Accuracy

- Phase timing SHALL be accurate to within 1 minute for phases lasting > 5 minutes.
- Phase timing SHALL use ISO-8601 timestamps (same format as existing `started` / `completed` fields in phase_snapshots).
- Timing SHALL measure wall-clock time (not CPU time) — this accounts for LLM API latency, which is the dominant cost.

### NFR-003: State.json Footprint

- Per-phase timing data SHALL add at most 150 bytes per phase to state.json (6 fields x ~25 bytes each).
- Budget status field SHALL add at most 100 bytes to `active_workflow`.
- Regression check SHALL add at most 200 bytes to `workflow_history[current]`.
- Total state.json growth per workflow SHALL not exceed 2 KB.

### NFR-004: Backward Compatibility

- Existing workflows without `performance_budgets` in workflows.json SHALL continue to function (hardcoded defaults apply per AC-002c).
- Existing `phase_snapshots` structure in workflow_history SHALL remain compatible — timing fields are additive.
- All existing tests (1300+) SHALL pass without modification.

### NFR-005: Observability

- Dispatcher timing output SHALL go to stderr (not stdout — stdout is reserved for JSON protocol).
- Budget warnings SHALL go to stderr with `BUDGET_WARNING:` or `BUDGET_APPROACHING:` prefix.
- Regression warnings SHALL go to stderr with `PERFORMANCE_REGRESSION:` prefix.
- All timing data SHALL be queryable from `state.json` and `workflow_history` for external tooling.

---

## 4. User Stories

### US-001: Developer sees workflow timing at completion

**As a** developer using the iSDLC framework,
**I want** to see a timing breakdown when my workflow completes,
**So that** I know which phases took the longest and whether the workflow stayed within budget.

### US-002: Developer is warned when budget is exceeded

**As a** developer running a feature workflow,
**I want** to see a warning when the workflow exceeds its time budget,
**So that** I'm aware the workflow is slower than expected and can investigate.

### US-003: Framework automatically reduces overhead when over budget

**As a** developer whose workflow is running over budget,
**I want** the framework to automatically reduce debate rounds and fan-out parallelism,
**So that** subsequent phases complete faster without manual intervention.

### US-004: Framework maintainer detects performance regressions

**As a** framework maintainer,
**I want** each completed workflow to be compared against recent workflows of the same intensity,
**So that** I can detect when a code change has caused a performance regression.

### US-005: Framework maintainer monitors hook dispatcher overhead

**As a** framework maintainer,
**I want** each hook dispatcher to report its execution time,
**So that** I can identify which dispatchers are slowest and optimize them.

---

## 5. Data Model

### 5.1 State.json — Active Workflow Extensions

```json
{
  "active_workflow": {
    "budget_status": "on_track | approaching | exceeded",
    "budget_exceeded_at_phase": "04-design",
    "phases": {
      "01-requirements": {
        "timing": {
          "started_at": "2026-02-17T10:00:00Z",
          "completed_at": "2026-02-17T10:08:32Z",
          "wall_clock_minutes": 9,
          "retries": 0,
          "debate_rounds_used": 2,
          "debate_rounds_degraded_to": null,
          "fan_out_chunks": 0,
          "fan_out_degraded_to": null
        }
      }
    }
  }
}
```

### 5.2 Workflows.json — Performance Budgets

```json
{
  "workflows": {
    "feature": {
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
      }
    }
  }
}
```

### 5.3 Workflow History — Regression Check

```json
{
  "workflow_history": [{
    "regression_check": {
      "baseline_avg_minutes": 52,
      "current_minutes": 68,
      "percent_over": 31,
      "regressed": true,
      "slowest_phase": "06-implementation",
      "compared_against": 5
    }
  }]
}
```

---

## 6. Scope & Files

### Files to Modify

| File | Change |
|------|--------|
| `src/claude/commands/isdlc.md` | STEP 3c-prime: add `timing.started_at`. STEP 3e: add `timing.completed_at`, `wall_clock_minutes`, budget check. STEP 3d: add `BUDGET_DEGRADATION` to delegation prompt. Pre-STEP-4: render dashboard. |
| `src/claude/hooks/lib/common.cjs` | Add `computeBudgetStatus()`, `getPerformanceBudget()`, `computeRollingAverage()`, `detectRegression()`, `formatCompletionDashboard()` utility functions. Extend `collectPhaseSnapshots()` to include timing data. |
| `src/isdlc/config/workflows.json` | Add `performance_budgets` section to `feature` and `fix` workflow definitions. |
| `src/claude/hooks/dispatchers/pre-task-dispatcher.cjs` | Add dispatcher-level `Date.now()` timing, emit `DISPATCHER_TIMING` to stderr. |
| `src/claude/hooks/dispatchers/post-task-dispatcher.cjs` | Add dispatcher-level timing. |
| `src/claude/hooks/dispatchers/pre-skill-dispatcher.cjs` | Add dispatcher-level timing. |
| `src/claude/hooks/dispatchers/post-bash-dispatcher.cjs` | Add dispatcher-level timing. |
| `src/claude/hooks/dispatchers/post-write-edit-dispatcher.cjs` | Add dispatcher-level timing. |
| `src/claude/hooks/workflow-completion-enforcer.cjs` | Store timing data in workflow_history, trigger regression check. |

### Files to Create

| File | Purpose |
|------|---------|
| `src/claude/hooks/lib/performance-budget.cjs` | Budget computation, degradation logic, rolling average, regression detection, dashboard formatting. Keeps common.cjs from growing further. |
| `src/claude/hooks/tests/performance-budget.test.cjs` | Unit tests for all performance-budget.cjs functions. |

### Estimated Blast Radius

- 9 files modified, 2 files created
- All changes are additive (new fields, new functions, new stderr output)
- No existing behavior changes — only new behavior added
- Risk: Low (timing instrumentation is observability, budget enforcement is advisory)
