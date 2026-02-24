# Requirements Specification: Performance Budget and Guardrail System

**REQ ID**: REQ-0025
**Artifact Folder**: REQ-0022-performance-budget-guardrails
**Type**: Feature
**Status**: Validated (from pre-analyzed requirements.md)
**Phase 01 Validated**: 2026-02-19
**Original Analysis Date**: 2026-02-17

---

## 1. Overview

Add per-workflow timing instrumentation, intensity-tier performance budgets, graceful degradation enforcement, regression tracking across workflows, and a completion dashboard. The system prevents slow erosion of T1-T3 performance gains as debate loops, fan-out, and cross-validation features are added.

**Builds On**: T1-T3 dispatcher timing, REQ-0005 (workflow_history), REQ-0011 (adaptive sizing), REQ-0014-0017 (debates, fan-out).

---

## 2. Functional Requirements

### FR-001: Per-Phase Timing Instrumentation

The phase-loop controller SHALL record wall-clock start and end timestamps for every phase, computing duration in minutes and storing it in `state.json` alongside existing phase status fields.

**Acceptance Criteria:**
- AC-001a: Phase activation sets `phases[phase_key].timing.started_at` to ISO-8601 timestamp
- AC-001b: Phase completion sets `timing.completed_at` and `timing.wall_clock_minutes = Math.round((completed_at - started_at) / 60000)`
- AC-001c: Phase retry preserves original `started_at`, increments `timing.retries`
- AC-001d: `collectPhaseSnapshots()` includes `timing` object in each snapshot
- AC-001e: Debate-enabled phases record `timing.debate_rounds_used`
- AC-001f: Fan-out phases record `timing.fan_out_chunks`

### FR-002: Performance Budget Configuration

The framework SHALL define performance budgets per workflow intensity tier in `workflows.json`, specifying maximum total workflow duration and maximum per-phase duration.

**Acceptance Criteria:**
- AC-002a: `performance_budgets` section in workflow definition contains entries for `light`, `standard`, and `epic` tiers
- AC-002b: Each tier contains: `max_total_minutes`, `max_phase_minutes`, `max_debate_rounds`, `max_fan_out_chunks`
- AC-002c: Missing `performance_budgets` falls back to hardcoded defaults (light: 30/10/0/1, standard: 90/25/2/4, epic: 180/40/3/8)
- AC-002d: Budget lookup uses `active_workflow.sizing.effective_intensity`
- AC-002e: Fix workflows default to `standard` tier

### FR-003: Budget Check at Phase Boundaries

The phase-loop controller SHALL check elapsed workflow time against the budget at every phase boundary and emit warnings if exceeded.

**Acceptance Criteria:**
- AC-003a: After STEP 3e, calculates `elapsed_minutes = (now - started_at) / 60000`, compares against budget
- AC-003b: Exceeded budget emits `BUDGET_WARNING` to stderr with elapsed/budget/percent/phase info
- AC-003c: Exceeded sets `budget_status = "exceeded"` and `budget_exceeded_at_phase` in state.json
- AC-003d: Under 80% sets `budget_status = "on_track"`
- AC-003e: 80-100% sets `budget_status = "approaching"` with milder warning
- AC-003f: Budget checks NEVER block the workflow (advisory only)

### FR-004: Graceful Degradation of Debate Rounds

When budget is exceeded or approaching, the phase-loop controller SHALL reduce maximum debate rounds for subsequent phases.

**Acceptance Criteria:**
- AC-004a: Exceeded status includes `BUDGET_DEGRADATION: max_debate_rounds=1` in delegation prompt
- AC-004b: Approaching status includes `BUDGET_DEGRADATION: max_debate_rounds={tier_max - 1}` (min 1)
- AC-004c: On-track status includes no degradation directive
- AC-004d: Records `timing.debate_rounds_degraded_to` when degradation applied
- AC-004e: `--no-debate` flag skips degradation (already disabled)

### FR-005: Graceful Degradation of Fan-Out Parallelism

When budget is exceeded, the phase-loop controller SHALL reduce fan-out chunk count for subsequent phases.

**Acceptance Criteria:**
- AC-005a: Exceeded status includes `BUDGET_DEGRADATION: max_fan_out_chunks=2` in delegation prompt
- AC-005b: Approaching status includes `BUDGET_DEGRADATION: max_fan_out_chunks={tier_max / 2}` (floor, min 2)
- AC-005c: `--no-fan-out` flag skips degradation
- AC-005d: Records `timing.fan_out_degraded_to` when degradation applied

### FR-006: Regression Tracking Across Workflows

At workflow completion, compare timing against rolling average of last 5 same-intensity workflows and flag regressions.

**Acceptance Criteria:**
- AC-006a: Reads `workflow_history[]` and filters for matching `sizing.effective_intensity`
- AC-006b: With 2+ prior workflows, computes rolling average of `total_duration_minutes` from last 5
- AC-006c: Current > rolling avg by >20% flags `PERFORMANCE_REGRESSION` warning
- AC-006d: Fewer than 2 prior workflows skips regression detection silently
- AC-006e: Writes `regression_check` to workflow_history entry with baseline, current, percent_over, regressed, slowest_phase

### FR-007: Completion Dashboard

At workflow completion, display human-readable timing summary with per-phase durations, budget consumption, debate/fan-out usage, and regression status.

**Acceptance Criteria:**
- AC-007a: Table with one row per phase showing name, wall_clock_minutes, debate_rounds_used, fan_out_chunks
- AC-007b: Header line with total time and budget
- AC-007c: Regression display when detected
- AC-007d: Degradation count display when applied
- AC-007e: Under-budget display
- AC-007f: Over-budget display with exceeding phase

### FR-008: Hook Dispatcher Timing Instrumentation

Each hook dispatcher SHALL measure its own execution time and report to stderr.

**Acceptance Criteria:**
- AC-008a: Record `dispatcher_start = Date.now()` at hook loop start
- AC-008b: Emit `DISPATCHER_TIMING: {name} completed in {ms}ms ({count} hooks)` to stderr
- AC-008c: No effect on existing tests (stderr only, no JSON protocol impact)

---

## 3. Non-Functional Requirements

### NFR-001: Zero Workflow Blocking
Budget checks, degradation, regression warnings, and dashboard SHALL NEVER block a workflow. All enforcement is advisory. Failures are handled fail-open.

### NFR-002: Timing Accuracy
Phase timing accurate to within 1 minute for phases > 5 minutes. ISO-8601 timestamps. Wall-clock time (not CPU time).

### NFR-003: State.json Footprint
Per-phase timing: max 150 bytes. Budget status: max 100 bytes. Regression check: max 200 bytes. Total per workflow: max 2 KB.

### NFR-004: Backward Compatibility
Existing workflows without `performance_budgets` continue to function (hardcoded defaults). Existing `phase_snapshots` structure remains compatible. All existing tests (1300+) pass without modification.

### NFR-005: Observability
Dispatcher timing to stderr. Budget warnings to stderr with `BUDGET_WARNING:` or `BUDGET_APPROACHING:` prefix. Regression warnings to stderr with `PERFORMANCE_REGRESSION:` prefix. All timing data queryable from state.json.

---

## 4. Summary

| Metric | Count |
|--------|-------|
| Functional Requirements | 8 |
| Non-Functional Requirements | 5 |
| Acceptance Criteria | 35 |
| User Stories | 5 |
| Files to Modify | 9 |
| Files to Create | 2 |
| Estimated Blast Radius | Medium (11 files total) |
| Risk Level | Low (advisory-only, additive changes) |

---

## 5. Traceability

All acceptance criteria trace back to the original analysis at `docs/requirements/REQ-0022-performance-budget-guardrails/requirements.md`. The detailed data model, user stories, and file-level scope are defined in that document and referenced here by ID.
