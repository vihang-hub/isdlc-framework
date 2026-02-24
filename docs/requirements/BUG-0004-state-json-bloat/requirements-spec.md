# Requirements Specification: BUG-0004 — state.json Bloat and Stale Data

**Version**: 1.0.0
**Date**: 2026-02-09
**Workflow**: fix
**Artifact Folder**: BUG-0004-state-json-bloat

---

## Fix Requirements

### FIX-001: Prune skill_usage_log on Workflow Completion

**Description**: When a workflow completes (merge or cancellation), the orchestrator MUST clear the `skill_usage_log` array in state.json. Skill usage data from completed workflows has no runtime value.

**Acceptance Criteria**:
- AC-1: After workflow completion (merge to main), `skill_usage_log` is set to `[]`
- AC-2: After workflow cancellation, `skill_usage_log` is set to `[]`
- AC-3: During an active workflow, `skill_usage_log` continues to accumulate normally (no change to append behavior)

### FIX-002: Prune phases on Workflow Completion

**Description**: When a workflow completes, the orchestrator MUST clean the `phases` object. Detailed sub-objects (`iteration_requirements`, `constitutional_validation`, `testing_environment`, `verification_summary`, `iteration_tracking`) should be removed. Only a minimal summary per phase should remain (status, started, completed, gate_passed, artifacts array).

**Acceptance Criteria**:
- AC-4: After workflow completion, each phase entry retains ONLY: `status`, `started`, `completed`, `gate_passed`, `artifacts`
- AC-5: Sub-objects `iteration_requirements`, `constitutional_validation`, `testing_environment`, `verification_summary`, `iteration_tracking` are removed from all phase entries
- AC-6: During an active workflow, phase sub-objects accumulate normally (no change to write behavior)

### FIX-003: Compact history Entries

**Description**: The `history` array entries should be limited to a single-line action description (max 200 characters). Multi-paragraph descriptions waste space. Additionally, cap the array at 50 entries (FIFO -- oldest entries removed first).

**Acceptance Criteria**:
- AC-7: New history entries have `action` field capped at 200 characters (truncated with `...` suffix if longer)
- AC-8: The `history` array retains at most 50 entries; when adding entry 51, the oldest entry is removed
- AC-9: Existing overlong entries are trimmed during the next workflow completion cleanup

### FIX-004: Clean phases from Previous Workflows

**Description**: When a NEW workflow is initialized, the `phases` object should be reset to contain ONLY the phases for the new workflow. Stale phase entries from previous workflows must be removed.

**Acceptance Criteria**:
- AC-10: When initializing a new workflow, `phases` is rebuilt with only the phases from `active_workflow.phases`
- AC-11: Each new phase entry starts with `status: "pending"`, null timestamps, empty artifacts array
- AC-12: Phase entries from previous workflows are not present after initialization

---

## Constraints

1. **Backward compatibility**: Hooks that read state.json (`common.cjs`, `gate-blocker.cjs`, `log-skill-usage.cjs`) must continue to work. Missing fields should be treated as empty/default.
2. **No data loss during active workflow**: Pruning only happens at workflow boundaries (completion, cancellation, initialization). Never during active phase work.
3. **Existing tests must pass**: All 650+ existing tests must continue to pass after changes.
4. **Orchestrator-owned**: All cleanup logic belongs in the orchestrator (agent 00) and the Phase-Loop Controller (`sdlc.md`). Hooks only append; they do not prune.

---

## Scope

### In Scope
- Pruning `skill_usage_log` at workflow boundaries
- Pruning verbose phase sub-objects at workflow completion
- Capping and compacting `history` entries
- Resetting `phases` at workflow initialization
- Updating orchestrator instructions to perform cleanup

### Out of Scope
- Moving historical data to separate archive files (future enhancement)
- Changing the schema of `skill_usage_log` entries themselves
- Modifying hook append behavior
- Changing `workflow_history` structure (already compact enough)

---

## Traceability

| Requirement | Acceptance Criteria | Constitutional Article |
|-------------|--------------------|-----------------------|
| FIX-001 | AC-1, AC-2, AC-3 | VIII (Documentation Currency) |
| FIX-002 | AC-4, AC-5, AC-6 | V (Simplicity), VIII |
| FIX-003 | AC-7, AC-8, AC-9 | V (Simplicity), VIII |
| FIX-004 | AC-10, AC-11, AC-12 | V (Simplicity), IX (Gate Integrity) |
