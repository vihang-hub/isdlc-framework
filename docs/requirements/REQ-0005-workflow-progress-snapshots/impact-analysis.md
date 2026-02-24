# Impact Analysis: REQ-0005 — Workflow Progress Snapshots

**Version**: 1.0.0
**Date**: 2026-02-09
**Analyst**: Impact Analysis Orchestrator (Phase 02)
**Blast Radius**: LOW
**Risk Level**: LOW

---

## 1. Executive Summary

This feature adds structured workflow progress snapshots to `workflow_history` entries in state.json. The change is **additive only** — no existing data structures are modified, no existing function signatures change, and no hooks are affected. The blast radius is LOW: 2 files modified (1 code, 1 agent instructions), 1 test file extended.

### Key Finding

The feature sits on a clean insertion seam. The orchestrator's completion sequence (Section 4, "Workflow Completion") already has a well-defined step ordering: merge -> prune -> move to history -> clear workflow. Snapshot collection inserts as a new step between merge and prune, which is the exact right place — data is still intact before pruning erases it.

---

## 2. Affected Files

### 2.1 Files to MODIFY

| # | File | Type | Change Description | Lines Affected (est.) |
|---|------|------|-------------------|----------------------|
| 1 | `src/claude/hooks/lib/common.cjs` | CJS module | Add `collectPhaseSnapshots(state)` function + export | +60-80 lines |
| 2 | `src/claude/agents/00-sdlc-orchestrator.md` | Agent instructions | Update completion sequence, gate-pass summary, cancellation, workflow_history schema | +30-40 lines |
| 3 | `src/claude/hooks/tests/test-common.test.cjs` | CJS test file | Add test describe block for `collectPhaseSnapshots()` | +100-150 lines |

### 2.2 Files NOT Modified (Confirmed Safe)

| File | Reason Not Affected |
|------|-------------------|
| All 10 hook `.cjs` files | No hook reads `workflow_history` entries or `phase_snapshots`. Hooks read `active_workflow`, `phases[]`, and `skill_usage_log` during execution — not historical data. |
| `src/claude/commands/isdlc.md` | Reads `workflow_history` only for the backlog picker (cancelled workflows list). The picker reads `description`, `type`, `status`, `cancelled_at_phase` — none of which change. New fields (`phase_snapshots`, `metrics`, `id`, `merged_commit`) are additive and ignored by the picker. |
| `.isdlc/config/workflows.json` | Workflow definitions unchanged. Phase sequences, gate modes, and agent modifiers remain identical. |
| `.isdlc/config/iteration-requirements.json` | No new iteration requirements added. |
| `src/claude/hooks/config/skills-manifest.json` | No new skills needed. |
| All other agent `.md` files (01-14, discover, tracing, etc.) | Phase agents produce artifacts and pass gates. They do not interact with `workflow_history` or snapshot logic. |
| `lib/` (CLI module) | CLI does not read or write `workflow_history`. |

---

## 3. Entry Points

### 3.1 Primary Entry Point: Orchestrator Completion Sequence

**Location**: `00-sdlc-orchestrator.md`, Section 4 "Workflow Completion", step 2-4

**Current flow**:
```
1. Human Review Checkpoint + Branch Merge (if branch exists)
2. Prune state.json (pruneSkillUsageLog, pruneCompletedPhases, pruneHistory, pruneWorkflowHistory)
3. Mark workflow completed
4. Move to workflow_history with status "completed"
5. Set active_workflow to null
6. Display completion summary
```

**New flow (with snapshots)**:
```
1. Human Review Checkpoint + Branch Merge (if branch exists)
2. ** NEW: Collect snapshots — call collectPhaseSnapshots(state) **
3. Prune state.json (pruneSkillUsageLog, pruneCompletedPhases, pruneHistory, pruneWorkflowHistory)
4. Mark workflow completed
5. Move to workflow_history with status "completed" + phase_snapshots + metrics + id + merged_commit
6. Set active_workflow to null
7. Display completion summary
```

The insertion point (between merge and prune) is critical because:
- `phases{}` still contains full iteration data (iteration_requirements, constitutional_validation, etc.)
- `history[]` still contains full action strings (not truncated)
- After pruning, this data is gone

### 3.2 Secondary Entry Point: Gate-Pass Summary Write

**Location**: `00-sdlc-orchestrator.md`, Section 4 "Array-Based Advancement", step 2

**Current flow** (when gate passes):
```
1. Validate gate passes
2. Mark current phase as "completed" in phase_status
3. Increment current_phase_index
4. ...
```

**New behavior**: After step 1, the orchestrator writes a brief `phases[key].summary` string. This is REQ-006 (AC-21, AC-22). The summary survives until snapshot collection reads it. If pruning has not run, the summary is preserved in the phase data.

### 3.3 Tertiary Entry Point: Cancellation Sequence

**Location**: `00-sdlc-orchestrator.md`, Section 3 "Cancellation Process"

**Current cancellation** moves to workflow_history without snapshots. Updated cancellation should also collect snapshots (AC-4: cancelled workflows include snapshots for started phases).

---

## 4. Blast Radius Assessment

### 4.1 Code Changes

| Dimension | Assessment | Rationale |
|-----------|-----------|-----------|
| **Files touched** | 3 | 1 code + 1 agent instructions + 1 test |
| **Functions added** | 1 | `collectPhaseSnapshots(state)` |
| **Functions modified** | 0 | No existing function signatures change |
| **Exports added** | 1 | `collectPhaseSnapshots` added to module.exports |
| **Exports changed** | 0 | All existing exports remain identical |
| **Hook behavior** | Unchanged | No hook reads snapshot data |
| **Schema additions** | Additive only | `phase_snapshots[]`, `metrics{}`, `id`, `merged_commit` — all new fields |
| **Schema removals** | 0 | Nothing removed from existing structures |
| **Breaking changes** | 0 | All consumers handle entries with/without new fields |

### 4.2 Blast Radius: LOW

- **Scope**: 2 production files + 1 test file
- **Risk**: New code is isolated — a pure function that reads `state.phases` and returns a data structure
- **Rollback**: If `collectPhaseSnapshots` fails, the orchestrator can catch the error and proceed with the old behavior (no snapshots in workflow_history)
- **Consumer impact**: The only consumer of `workflow_history` entries is the backlog picker in `isdlc.md`, which reads `description`, `type`, `status`, and `cancelled_at_phase` — none of which are changed

---

## 5. Risk Assessment

### 5.1 Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| R1: `collectPhaseSnapshots` crashes on malformed phase data | LOW | LOW | Defensive coding: null checks on every field. AC-12 requires graceful handling of missing/null fields. |
| R2: Snapshot data exceeds 2KB size budget (NFR-1) | LOW | LOW | Each snapshot is ~200 bytes. 11-phase workflow = ~2.2KB. Mitigation: truncate summary to 150 chars (AC-22), omit empty arrays. |
| R3: Pruning runs before snapshot collection | LOW | HIGH | Mitigation: orchestrator instructions explicitly order snapshot BEFORE prune. This is an instruction sequencing change, not a code dependency. |
| R4: `test_iteration` data absent for phases that should have it | MEDIUM | LOW | `collectPhaseSnapshots` checks `iteration_requirements.test_iteration` existence. If missing, `test_iterations` field is omitted from that snapshot. Graceful degradation. |
| R5: Summary field missing at snapshot time | MEDIUM | LOW | `collectPhaseSnapshots` falls back to history[] scan if `phases[key].summary` is absent (AC-23). |

### 5.2 Overall Risk: LOW

No existing behavior changes. All new code is additive. Failure mode is graceful (missing snapshots, not crashes). The only sequencing dependency (snapshot before prune) is enforced by orchestrator instructions, which is the same pattern used for all existing completion steps.

---

## 6. Data Flow Analysis

### 6.1 Snapshot Collection Data Flow

```
                    state.json (pre-prune)
                           |
                    +------+------+
                    |             |
              state.phases    state.history
                    |             |
                    v             v
         collectPhaseSnapshots(state)
                    |
          +---------+---------+
          |                   |
    phase_snapshots[]     metrics{}
          |                   |
          +--------+----------+
                   |
          workflow_history entry
                   |
                   v
            state.json (post-prune)
```

### 6.2 Where Data Comes From

| Snapshot Field | Source | Available Pre-Prune? |
|---------------|--------|---------------------|
| `key` | Phase key from `state.phases` | Yes |
| `status` | `state.phases[key].status` | Yes |
| `started` | `state.phases[key].started` | Yes |
| `completed` | `state.phases[key].completed` | Yes |
| `gate_passed` | `state.phases[key].gate_passed` | Yes |
| `duration_minutes` | Computed: `completed - started` | Yes |
| `artifacts` | `state.phases[key].artifacts` | Yes |
| `test_iterations.count` | `state.phases[key].iteration_requirements.test_iteration.current_iteration` | Yes (pruneCompletedPhases strips this) |
| `test_iterations.result` | `state.phases[key].iteration_requirements.test_iteration.completed` | Yes (pruneCompletedPhases strips this) |
| `test_iterations.escalated` | `state.phases[key].iteration_requirements.test_iteration.escalated` | Yes (pruneCompletedPhases strips this) |
| `summary` | `state.phases[key].summary` (primary) or last matching `state.history[]` entry (fallback) | Yes |
| `metrics.total_phases` | `active_workflow.phases.length` | Yes |
| `metrics.phases_completed` | Count of phases with `status: "completed"` | Yes |
| `metrics.total_duration_minutes` | `active_workflow.completed_at - active_workflow.started_at` | Yes |
| `metrics.test_iterations_total` | Sum of all `test_iterations.count` | Yes |
| `metrics.gates_passed_first_try` | Phases where no iteration occurred | Yes |
| `metrics.gates_required_iteration` | Phases where iteration occurred | Yes |

### 6.3 Pruning Impact Confirmation

`pruneCompletedPhases()` strips these fields from completed phases:
- `iteration_requirements` -- contains `test_iteration` data needed for snapshots
- `constitutional_validation` -- not needed for snapshots
- `gate_validation` -- not needed for snapshots
- `testing_environment` -- not needed for snapshots
- `verification_summary` -- not needed for snapshots
- `atdd_validation` -- not needed for snapshots

**Conclusion**: Snapshot MUST run before `pruneCompletedPhases()`. The `iteration_requirements.test_iteration` data is the key field that would be lost.

---

## 7. Dependency Analysis

### 7.1 Upstream Dependencies (what this feature reads)

| Dependency | Type | Risk |
|-----------|------|------|
| `state.phases{}` | Data | LOW — well-established structure, used by all hooks |
| `state.history[]` | Data | LOW — fallback source for summary, may be empty |
| `state.active_workflow` | Data | LOW — read for workflow metadata (type, phases array) |
| `pruneCompletedPhases()` | Function ordering | MEDIUM — must run AFTER snapshot collection |

### 7.2 Downstream Dependencies (what reads this feature's output)

| Consumer | What It Reads | Impact |
|----------|--------------|--------|
| Backlog picker (`isdlc.md`) | `workflow_history[].description`, `type`, `status`, `cancelled_at_phase` | NONE — does not read new fields |
| `pruneWorkflowHistory()` | `workflow_history[]` entries | LOW — prunes descriptions/git_branch, does not touch phase_snapshots or metrics |
| Future `/isdlc status` enhancement | `workflow_history[].phase_snapshots`, `metrics` | POSITIVE — this feature enables richer status reporting (out of scope for now) |

---

## 8. Constitutional Compliance

| Article | Relevance | Status |
|---------|----------|--------|
| III (Code Quality) | `collectPhaseSnapshots()` must be well-tested, handle edge cases | REQUIRES: defensive coding, comprehensive tests |
| V (Simplicity) | Function should be straightforward — read phases, compute metrics | OK: pure function, no side effects |
| VII (Traceability) | New function must be traceable to requirements | OK: REQ-003 maps directly |
| VIII (Documentation Currency) | Orchestrator instructions must be updated to reflect new completion sequence | REQUIRES: orchestrator .md update |
| IX (Gate Integrity) | Gate behavior unchanged | OK: no gate changes |

---

## 9. Implementation Recommendations

### 9.1 Function Design

```javascript
function collectPhaseSnapshots(state) {
  // Input: full state object (pre-prune)
  // Output: { phase_snapshots: [...], metrics: {...} }
  // Pure computation — does not mutate state
}
```

- Make it a pure function (no writes to state)
- Return value is inserted into the workflow_history entry by the orchestrator
- Handle all null/missing fields with defaults (empty arrays, 0 counts, null timestamps)

### 9.2 Orchestrator Update Checklist

1. Update "Workflow Completion" (Section 4) — insert snapshot step before prune
2. Update "Array-Based Advancement" (Section 4) — add `phases[key].summary` write after gate pass
3. Update "Cancellation Process" (Section 3) — add snapshot collection for started phases
4. Update workflow_history schema examples throughout the document

### 9.3 Test Strategy Preview

- Test `collectPhaseSnapshots()` with: full workflow state, empty phases, partial phases, missing timestamps, missing iteration data, cancelled workflow
- Verify metrics computation: duration, iteration counts, gate-pass rates
- Verify backward compatibility: `pruneWorkflowHistory()` handles entries with `phase_snapshots`
- Verify size constraint: 11-phase snapshot + metrics stays under 2KB

---

## 10. Size Budget Estimation

| Component | Estimated Size |
|-----------|---------------|
| Single phase snapshot (minimal) | ~120 bytes |
| Single phase snapshot (with test_iterations + summary) | ~220 bytes |
| 8-phase feature workflow (all snapshots) | ~1,600 bytes |
| 11-phase full-lifecycle workflow (all snapshots) | ~2,200 bytes |
| Metrics object | ~200 bytes |
| `id` + `merged_commit` fields | ~30 bytes |
| **Total per workflow_history entry** | **~1,800 - 2,400 bytes** |

NFR-1 allows 2KB increase per workflow. An 8-phase feature workflow is within budget. An 11-phase full-lifecycle workflow is slightly over but acceptable given the 50-entry cap on workflow_history (2.4KB * 50 = 120KB worst case, well within state.json norms).

**Recommendation**: Omit `artifacts` array from snapshots when empty (save ~15 bytes per entry) and truncate summaries aggressively to stay within budget for larger workflows.

---

## 11. Summary

| Dimension | Value |
|-----------|-------|
| **Blast Radius** | LOW (3 files: 1 code, 1 agent, 1 test) |
| **Risk Level** | LOW (additive only, no breaking changes) |
| **Sequencing Dependency** | snapshot BEFORE prune (orchestrator instruction order) |
| **Hook Impact** | NONE (no hook reads workflow_history or phase_snapshots) |
| **New Dependencies** | NONE (NFR-2 compliant) |
| **Backward Compatibility** | FULL (new fields additive, old entries unchanged) |
| **Test Impact** | +100-150 lines in test-common.test.cjs |
| **Estimated Implementation Size** | ~200 lines total (60-80 function + 30-40 orchestrator + 100-150 tests) |
