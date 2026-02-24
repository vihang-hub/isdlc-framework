# Requirements Specification: REQ-0005 — Workflow Progress Snapshots

**Version**: 1.0.0
**Date**: 2026-02-09
**Workflow**: feature
**Artifact Folder**: REQ-0005-workflow-progress-snapshots
**Status**: Draft

---

## 1. Problem Statement

### Current State

When a workflow (feature or fix) completes, `state.json` captures only a high-level summary in `workflow_history`:

```json
{
  "type": "fix",
  "description": "state.json pruning to prevent unbounded growth",
  "started_at": "2026-02-09T10:15:00Z",
  "completed_at": "2026-02-09T10:53:55.246Z",
  "status": "completed",
  "artifact_prefix": "BUG",
  "artifact_folder": "BUG-0004-state-json-bloat",
  "git_branch": { "name": "bugfix/BUG-0004-state-json-bloat" }
}
```

The detailed phase-by-phase journey — which phases ran, what artifacts were produced, how many test iterations were needed, which gates passed on first try vs required iteration — is **lost**. Specifically:

1. **`phases{}` is shared, not per-workflow.** When BUG-0004 finishes and BUG-0005 starts, `resetPhasesForWorkflow()` wipes BUG-0004's phase data. There is no way to look back at what happened during BUG-0004's `06-implementation` phase.

2. **`history[]` is unstructured.** The action log contains free-text strings like `"GATE-01 PASSED: Bug report captured..."`. These are human-readable but not machine-queryable. You cannot programmatically extract "how many gates passed for BUG-0004?"

3. **Pruning erases detail.** `pruneCompletedPhases()` strips iteration data, gate results, and validation state from phases. After pruning, a phase is reduced to `{status, started, completed, gate_passed, artifacts}`. Test iteration counts, circuit breaker triggers, constitutional violation details — all gone.

4. **No per-workflow iteration counts.** How many test iterations did a bug fix need? That data lived in `phases["06-implementation"].iteration_requirements.test_iteration` but only while the workflow was active.

### Impact

- **No audit trail**: Cannot answer "what happened during feature REQ-0003?" from state.json alone
- **No workflow comparison**: Cannot compare duration/complexity across workflows
- **No progress tracking for active workflows**: A resumed session cannot reconstruct where a workflow left off without reading the full `phases{}` object and cross-referencing `history[]`
- **No metrics**: Cannot compute average phase duration, iteration frequency, or gate-pass rates

### Business Drivers

- **Project visibility**: Stakeholders should be able to see a structured progress report for any workflow
- **Continuous improvement**: Understanding which phases take longest or require the most iterations enables process optimization
- **Session resilience**: When Claude Code context compacts mid-workflow, the snapshot provides a compact, structured summary to resume from
- **Status reporting**: `/isdlc status` could show rich per-workflow breakdowns instead of just "completed" or "in progress"

---

## 2. Functional Requirements

### REQ-001: Phase Snapshot on Workflow Completion

When a workflow completes (merge or cancellation), the orchestrator MUST capture a `phase_snapshots` array inside the `workflow_history` entry. Each snapshot contains a compact summary of the phase's execution.

**Schema:**

```json
{
  "type": "fix",
  "id": "BUG-0004",
  "description": "state.json pruning to prevent unbounded growth",
  "started_at": "2026-02-09T10:15:00Z",
  "completed_at": "2026-02-09T10:53:55.246Z",
  "status": "completed",
  "artifact_prefix": "BUG",
  "artifact_folder": "BUG-0004-state-json-bloat",
  "git_branch": { "name": "bugfix/BUG-0004-state-json-bloat" },
  "merged_commit": "882f9d6",
  "phase_snapshots": [
    {
      "key": "01-requirements",
      "status": "completed",
      "started": "2026-02-09T10:15:00Z",
      "completed": "2026-02-09T10:18:00Z",
      "gate_passed": "2026-02-09T10:18:00Z",
      "duration_minutes": 3,
      "artifacts": ["docs/requirements/BUG-0004-state-json-bloat/bug-report.md"],
      "summary": "4 fix requirements, 12 AC"
    },
    {
      "key": "06-implementation",
      "status": "completed",
      "started": "2026-02-09T10:35:00Z",
      "completed": "2026-02-09T10:48:00Z",
      "gate_passed": "2026-02-09T10:48:00Z",
      "duration_minutes": 13,
      "test_iterations": { "count": 1, "result": "passed", "escalated": false },
      "artifacts": ["src/claude/hooks/lib/common.cjs"],
      "summary": "5 pruning functions added, 108 tests passing"
    }
  ],
  "metrics": {
    "total_phases": 8,
    "phases_completed": 8,
    "total_duration_minutes": 39,
    "test_iterations_total": 1,
    "gates_passed_first_try": 8,
    "gates_required_iteration": 0,
    "files_changed": 2,
    "tests_added": 47
  }
}
```

**Acceptance Criteria:**
- AC-1: Every `workflow_history` entry created after this feature ships includes a `phase_snapshots` array
- AC-2: Each snapshot contains at minimum: `key`, `status`, `started`, `completed`, `gate_passed`, `duration_minutes`, `artifacts`
- AC-3: Snapshots for phases that ran tests include `test_iterations: { count, result, escalated }`
- AC-4: Cancelled workflows include snapshots for all phases that were started (even if incomplete)

### REQ-002: Workflow Metrics Summary

Each `workflow_history` entry MUST include a `metrics` object summarizing the workflow's execution.

**Acceptance Criteria:**
- AC-5: `metrics.total_phases` equals the number of phases in the workflow definition
- AC-6: `metrics.phases_completed` equals phases with `status: "completed"`
- AC-7: `metrics.total_duration_minutes` is computed from `started_at` to `completed_at`
- AC-8: `metrics.test_iterations_total` sums all test iteration counts across phases
- AC-9: `metrics.gates_passed_first_try` counts phases where no iteration was needed
- AC-10: `metrics.gates_required_iteration` counts phases where test or constitutional iteration occurred

### REQ-003: Snapshot Collection Function in common.cjs

A new function `collectPhaseSnapshots(state)` MUST be added to `common.cjs` that reads the current `phases{}` object and produces the `phase_snapshots` array and `metrics` summary.

**Acceptance Criteria:**
- AC-11: Function is exported from `common.cjs` alongside existing pruning functions
- AC-12: Function handles missing/null fields gracefully (no crashes on partial phase data)
- AC-13: Function computes `duration_minutes` from `started` and `completed` timestamps (rounded to nearest integer)
- AC-14: Function extracts `test_iterations` from `phases[key].iteration_requirements.test_iteration` when present
- AC-15: Function extracts `summary` from the corresponding `history[]` entry (last entry matching the phase's agent and timestamp range), truncated to 150 chars

### REQ-004: Merged Commit Tracking

The `workflow_history` entry MUST include the `merged_commit` SHA when the workflow is merged.

**Acceptance Criteria:**
- AC-16: `merged_commit` is populated with the short SHA (7 chars) of the merge commit
- AC-17: For cancelled workflows, `merged_commit` is `null`
- AC-18: For workflows that did not require a branch (e.g., `test-run`), `merged_commit` is `null`

### REQ-005: Workflow ID Tracking

Each `workflow_history` entry MUST include an `id` field containing the artifact identifier (e.g., `"REQ-0003"`, `"BUG-0004"`).

**Acceptance Criteria:**
- AC-19: `id` is derived from `artifact_prefix` + `-` + zero-padded counter (e.g., `"BUG-0004"`)
- AC-20: `id` is present in all new `workflow_history` entries (feature, fix, test-run, upgrade, etc.)

### REQ-006: Phase Summary Capture During Gate Pass

To ensure `summary` data is available at workflow completion, the orchestrator MUST write a brief summary string to `phases[key].summary` when each gate passes. This happens during the phase, before pruning erases it.

**Acceptance Criteria:**
- AC-21: After each gate pass, the orchestrator writes a 1-line summary to `phases[key].summary`
- AC-22: Summary is ≤150 characters and describes the key output of the phase (e.g., `"4 fix requirements, 12 AC"`)
- AC-23: `collectPhaseSnapshots()` reads `phases[key].summary` as its primary source for the `summary` field, falling back to `history[]` if absent

### REQ-007: Backward Compatibility with Existing Pruning

The snapshot collection MUST happen BEFORE the existing pruning functions run. The orchestrator already calls `pruneCompletedPhases()`, `pruneSkillUsageLog()`, etc. at workflow completion. Snapshot collection must precede these calls.

**Acceptance Criteria:**
- AC-24: `collectPhaseSnapshots(state)` is called BEFORE `pruneCompletedPhases(state)` in the orchestrator's completion sequence
- AC-25: The pruned state.json does NOT need to retain snapshot data — it lives only in `workflow_history`
- AC-26: Existing pruning behavior is unchanged

---

## 3. Non-Functional Requirements

| NFR | Requirement | Metric |
|-----|-------------|--------|
| NFR-1 | Snapshot collection must not increase state.json size by more than 2KB per workflow | Measured by comparing `workflow_history` entry size before/after |
| NFR-2 | No new dependencies | Zero new npm packages |
| NFR-3 | No breaking changes to existing hooks | All 610+ existing tests pass |
| NFR-4 | Backward compatible | Hooks that read `workflow_history` must handle entries with and without `phase_snapshots` |

---

## 4. Constraints

1. **Orchestrator-owned**: Snapshot collection is orchestrator logic (agent 00 instructions + `common.cjs` function). Hooks do not participate.
2. **Size budget**: `phase_snapshots` + `metrics` must stay compact. No embedding of full iteration histories, artifact contents, or verbose validation objects.
3. **No schema migration**: Existing `workflow_history` entries are not retroactively updated. Only new entries get snapshots.
4. **No new files**: `collectPhaseSnapshots()` lives in `common.cjs` alongside existing pruning functions. No new modules.

---

## 5. Scope

### In Scope
- New `collectPhaseSnapshots(state)` function in `common.cjs`
- Updated orchestrator completion sequence (snapshot → prune → move to history)
- Updated orchestrator gate-pass handling (write `phases[key].summary`)
- `id` and `merged_commit` fields in `workflow_history` entries
- `phase_snapshots` and `metrics` objects in `workflow_history` entries
- Tests for `collectPhaseSnapshots()` in `test-common.test.cjs`

### Out of Scope
- Retroactive population of existing `workflow_history` entries
- Separate archive/report files for workflow history
- Dashboard UI or `/isdlc status` enhancements (future feature, can consume this data)
- Changes to `active_workflow` structure during execution
- Changes to hook behavior

---

## 6. Traceability

| Requirement | Acceptance Criteria | Constitutional Article |
|-------------|--------------------|-----------------------|
| REQ-001 | AC-1, AC-2, AC-3, AC-4 | VIII (Documentation Currency) |
| REQ-002 | AC-5, AC-6, AC-7, AC-8, AC-9, AC-10 | VIII (Documentation Currency) |
| REQ-003 | AC-11, AC-12, AC-13, AC-14, AC-15 | III (Code Quality) |
| REQ-004 | AC-16, AC-17, AC-18 | VIII (Documentation Currency) |
| REQ-005 | AC-19, AC-20 | VIII (Documentation Currency) |
| REQ-006 | AC-21, AC-22, AC-23 | VIII (Documentation Currency) |
| REQ-007 | AC-24, AC-25, AC-26 | III (Code Quality) |

---

## 7. Example: Before and After

### Before (current state — BUG-0004 in workflow_history)

```json
{
  "type": "fix",
  "description": "state.json pruning to prevent unbounded growth",
  "started_at": "2026-02-09T10:15:00Z",
  "completed_at": "2026-02-09T10:53:55.246Z",
  "status": "completed",
  "artifact_prefix": "BUG",
  "artifact_folder": "BUG-0004-state-json-bloat",
  "git_branch": { "name": "bugfix/BUG-0004-state-json-bloat" }
}
```

**What can you answer?** When it started, when it finished, what branch it was on.
**What can't you answer?** Which phases ran, how long each took, what artifacts were produced, how many test iterations, which gates required iteration.

### After (with this feature)

```json
{
  "type": "fix",
  "id": "BUG-0004",
  "description": "state.json pruning to prevent unbounded growth",
  "started_at": "2026-02-09T10:15:00Z",
  "completed_at": "2026-02-09T10:53:55.246Z",
  "status": "completed",
  "artifact_prefix": "BUG",
  "artifact_folder": "BUG-0004-state-json-bloat",
  "git_branch": { "name": "bugfix/BUG-0004-state-json-bloat" },
  "merged_commit": "882f9d6",
  "phase_snapshots": [
    { "key": "01-requirements", "status": "completed", "started": "...", "completed": "...", "gate_passed": "...", "duration_minutes": 3, "artifacts": ["docs/requirements/BUG-0004-state-json-bloat/bug-report.md", "docs/requirements/BUG-0004-state-json-bloat/requirements-spec.md"], "summary": "4 fix requirements, 12 AC" },
    { "key": "02-tracing", "status": "completed", "started": "...", "completed": "...", "gate_passed": "...", "duration_minutes": 5, "artifacts": ["docs/requirements/BUG-0004-state-json-bloat/trace-analysis.md"], "summary": "86% bloat from 3 fields: skill_usage_log, history, phases" },
    { "key": "05-test-strategy", "status": "completed", "started": "...", "completed": "...", "gate_passed": "...", "duration_minutes": 5, "artifacts": ["docs/requirements/BUG-0004-state-json-bloat/test-strategy.md"], "summary": "47 test cases across 5 pruning functions" },
    { "key": "06-implementation", "status": "completed", "started": "...", "completed": "...", "gate_passed": "...", "duration_minutes": 13, "test_iterations": { "count": 1, "result": "passed", "escalated": false }, "artifacts": ["src/claude/hooks/lib/common.cjs"], "summary": "5 pruning functions added, 108 tests passing" },
    { "key": "11-local-testing", "status": "completed", "started": "...", "completed": "...", "gate_passed": "...", "duration_minutes": 3, "artifacts": [], "summary": "All 108 common tests pass" },
    { "key": "07-testing", "status": "completed", "started": "...", "completed": "...", "gate_passed": "...", "duration_minutes": 2, "artifacts": [], "summary": "Integration verified, no regressions" },
    { "key": "10-cicd", "status": "completed", "started": "...", "completed": "...", "gate_passed": "...", "duration_minutes": 2, "artifacts": [], "summary": "No CI changes needed" },
    { "key": "08-code-review", "status": "completed", "started": "...", "completed": "...", "gate_passed": "...", "duration_minutes": 3, "artifacts": [], "summary": "Code review passed, merged to main" }
  ],
  "metrics": {
    "total_phases": 8,
    "phases_completed": 8,
    "total_duration_minutes": 39,
    "test_iterations_total": 1,
    "gates_passed_first_try": 8,
    "gates_required_iteration": 0,
    "files_changed": 2,
    "tests_added": 47
  }
}
```

**What can you now answer?**
- Which phases ran and in what order
- How long each phase took
- What artifacts each phase produced
- How many test iterations were needed (and whether escalation occurred)
- Aggregate workflow metrics (duration, iteration count, gate-pass rate)
- The merge commit SHA
- The workflow ID for cross-referencing with docs/requirements/
