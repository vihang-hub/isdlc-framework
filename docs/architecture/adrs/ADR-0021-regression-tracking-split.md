# ADR-0021: Split Regression Tracking Between Orchestrator and Enforcer

## Status
Accepted

## Context
FR-006 requires comparing the current workflow's timing against a rolling average of prior same-intensity workflows and flagging regressions. Two locations can run this check:

| Location | Trigger | State Access | Timing |
|----------|---------|-------------|--------|
| `isdlc.md` pre-STEP-4 (dashboard) | Phase loop completes, before finalize | Has all timing in memory | Before workflow_history entry is created |
| `workflow-completion-enforcer.cjs` | PostToolUse[Write] fires when active_workflow is cleared | Reads fresh state from disk | After workflow_history entry exists |

## Decision
Split responsibility between both locations:

1. **Regression computation** (authoritative): `workflow-completion-enforcer.cjs` runs after finalize writes the `workflow_history` entry. It reads the entry, computes rolling average from prior entries, writes `regression_check` back to the entry.

2. **Regression display** (preliminary): `isdlc.md` pre-STEP-4 dashboard displays a preliminary regression estimate using in-memory timing data compared against previously persisted `workflow_history` entries.

## Rationale
- The workflow-completion-enforcer already fires on workflow finalize and already calls `collectPhaseSnapshots()`. Adding regression computation is a natural extension of its existing self-healing pattern.
- The enforcer has disk-level state access needed to scan `workflow_history[]`.
- The isdlc.md dashboard runs BEFORE the finalize step, so it cannot read the `workflow_history` entry that finalize will create. It can only compute a preliminary regression.
- The authoritative `regression_check` in `workflow_history` is the persistent source of truth.

## Consequences
**Positive:**
- Authoritative regression data lives in `workflow_history` (persistent, queryable)
- Dashboard provides immediate user feedback
- Natural extension of existing enforcer pattern (no new infrastructure)
- Enforcer's fail-open pattern wraps regression errors safely

**Negative:**
- Slight discrepancy possible between dashboard's preliminary regression and enforcer's authoritative regression
- Mitigation: Dashboard labels output as "preliminary" when prior data exists; `workflow_history` is source of truth

## Traces
- FR-006, AC-006a through AC-006e
- FR-007, AC-007c (dashboard regression display)
- Article V (Simplicity First): Reuses existing enforcer infrastructure
