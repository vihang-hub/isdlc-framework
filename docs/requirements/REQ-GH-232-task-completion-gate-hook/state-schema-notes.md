# State Schema Addition: active_workflow.skipped_tasks[]

**Source**: REQ-GH-232, AC-003-04
**Trace**: ADR-003

## Field

`active_workflow.skipped_tasks[]` — Optional array. Absent when no tasks have been skipped.

## Entry Schema

```json
{
  "phase": "06-implementation",
  "tasks": ["T017", "T019", "T020"],
  "skipped_at": "2026-04-05T14:23:11.000Z",
  "reason": "user_skip_after_retries"
}
```

## Field Constraints

| Field | Type | Constraint |
|-------|------|------------|
| `phase` | string | Valid phase key from `active_workflow.phases` |
| `tasks` | string[] | Non-empty array of task IDs (TNNN format) |
| `skipped_at` | string | ISO-8601 timestamp |
| `reason` | string | Enum: `"user_skip_after_retries"` (extensible) |

## Writers

Only the Phase-Loop Controller's `3f-task-completion` handler `[S]` branch writes to this field.

## Readers

- `/isdlc status` — displays skipped tasks in workflow summary
- Audit logs — preserved in `workflow_history` for post-mortem analysis

## Lifecycle

- Created on first `[S] Skip` action during a build workflow
- Accumulates entries (one per skip event per phase)
- Preserved when `moveWorkflowToHistory()` runs during finalize
- Available in `workflow_history[N].skipped_tasks[]` after workflow completion
