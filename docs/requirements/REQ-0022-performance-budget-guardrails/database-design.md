# Database Design: Performance Budget and Guardrail System

**REQ ID**: REQ-0025
**Artifact Folder**: REQ-0022-performance-budget-guardrails
**Phase**: 03-architecture
**Generated**: 2026-02-19

---

## 1. Overview

This project uses no traditional database. All persistent state is stored in `.isdlc/state.json` (a single JSON file) and `.isdlc/config/workflows.json` (a configuration file). This document defines the schema extensions to both files.

All extensions are **additive**. No existing fields are modified, renamed, or removed.

---

## 2. Entity-Relationship Diagram

```mermaid
erDiagram
    STATE_JSON ||--|| ACTIVE_WORKFLOW : contains
    STATE_JSON ||--o{ PHASES : contains
    STATE_JSON ||--o{ WORKFLOW_HISTORY : contains
    ACTIVE_WORKFLOW ||--|| BUDGET_STATUS : has
    PHASES ||--o| TIMING : has
    WORKFLOW_HISTORY ||--o| REGRESSION_CHECK : has
    WORKFLOWS_JSON ||--o{ PERFORMANCE_BUDGETS : defines

    ACTIVE_WORKFLOW {
        string budget_status "on_track | approaching | exceeded"
        string budget_exceeded_at_phase "phase key where first exceeded"
    }

    PHASES {
        string status "existing field"
        string started "existing field"
        string completed "existing field"
    }

    TIMING {
        string started_at "ISO-8601 timestamp"
        string completed_at "ISO-8601 timestamp"
        int wall_clock_minutes "rounded to nearest minute"
        int retries "retry count, default 0"
        int debate_rounds_used "from agent report, default 0"
        int debate_rounds_degraded_to "null if no degradation"
        int fan_out_chunks "from agent report, default 0"
        int fan_out_degraded_to "null if no degradation"
    }

    REGRESSION_CHECK {
        int baseline_avg_minutes "rolling average of prior workflows"
        int current_minutes "this workflow total"
        int percent_over "percentage above baseline"
        boolean regressed "true if over threshold"
        string slowest_phase "phase key of longest phase"
        int compared_against "number of prior workflows used"
    }

    PERFORMANCE_BUDGETS {
        int max_total_minutes "total workflow budget"
        int max_phase_minutes "per-phase budget"
        int max_debate_rounds "max debate rounds per phase"
        int max_fan_out_chunks "max fan-out chunks per phase"
    }
}
```

---

## 3. Schema Extensions

### 3.1 Per-Phase Timing (`state.json` -> `phases[phase_key].timing`)

**Location**: `state.json` -> `phases` -> `{phase_key}` -> `timing`

```json
{
  "timing": {
    "started_at": "2026-02-17T10:00:00.000Z",
    "completed_at": "2026-02-17T10:08:32.000Z",
    "wall_clock_minutes": 9,
    "retries": 0,
    "debate_rounds_used": 2,
    "debate_rounds_degraded_to": null,
    "fan_out_chunks": 0,
    "fan_out_degraded_to": null
  }
}
```

**Field Definitions**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `started_at` | string (ISO-8601) | Yes | - | Set at STEP 3c-prime. Preserved across retries (AC-001c). |
| `completed_at` | string (ISO-8601) | Yes | - | Set at STEP 3e. |
| `wall_clock_minutes` | integer | Yes | - | `Math.round((completed_at - started_at) / 60000)` |
| `retries` | integer | Yes | 0 | Incremented each time phase re-enters 3c-prime after initial run. |
| `debate_rounds_used` | integer | Yes | 0 | From agent PHASE_TIMING_REPORT. |
| `debate_rounds_degraded_to` | integer or null | No | null | Set if BUDGET_DEGRADATION was applied. |
| `fan_out_chunks` | integer | Yes | 0 | From agent PHASE_TIMING_REPORT. |
| `fan_out_degraded_to` | integer or null | No | null | Set if BUDGET_DEGRADATION was applied. |

**Size**: ~140 bytes per phase (within NFR-003 limit of 150 bytes).

**Backward compatibility**: The `timing` field is additive. Existing phase data without `timing` continues to function. All consumers check for `timing` presence before access.

### 3.2 Budget Status (`state.json` -> `active_workflow`)

**Location**: `state.json` -> `active_workflow`

```json
{
  "budget_status": "on_track",
  "budget_exceeded_at_phase": null
}
```

**Field Definitions**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `budget_status` | enum string | No | `null` | `"on_track"`, `"approaching"`, or `"exceeded"`. Updated at every STEP 3e. |
| `budget_exceeded_at_phase` | string or null | No | `null` | Phase key where budget was first exceeded. Set once, never overwritten. |

**Size**: ~70 bytes (within NFR-003 limit of 100 bytes).

**Backward compatibility**: Both fields are new additions to `active_workflow`. Existing code ignores unknown fields.

### 3.3 Regression Check (`state.json` -> `workflow_history[n]`)

**Location**: `state.json` -> `workflow_history` -> `[n]` -> `regression_check`

```json
{
  "regression_check": {
    "baseline_avg_minutes": 52,
    "current_minutes": 68,
    "percent_over": 31,
    "regressed": true,
    "slowest_phase": "06-implementation",
    "compared_against": 5
  }
}
```

**Field Definitions**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `baseline_avg_minutes` | integer | Yes | - | Rolling average of last N same-intensity workflows. |
| `current_minutes` | integer | Yes | - | Total duration of this workflow. |
| `percent_over` | integer | Yes | - | `Math.round(((current - baseline) / baseline) * 100)` |
| `regressed` | boolean | Yes | - | `true` if `percent_over > 20`. |
| `slowest_phase` | string | Yes | - | Phase key with highest `wall_clock_minutes`. |
| `compared_against` | integer | Yes | - | Number of prior workflows used for average (max 5). |

**Size**: ~180 bytes (within NFR-003 limit of 200 bytes).

**Backward compatibility**: `regression_check` is added to `workflow_history` entries only when sufficient prior data exists (2+ same-intensity workflows). Existing entries without it are unaffected.

---

## 4. Configuration Schema Extension

### 4.1 Performance Budgets (`workflows.json`)

**Location**: `workflows.json` -> `workflows` -> `{workflow_type}` -> `performance_budgets`

```json
{
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
```

**Field Definitions**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `max_total_minutes` | integer | Yes | Maximum total workflow duration in minutes. |
| `max_phase_minutes` | integer | Yes | Maximum single-phase duration in minutes. |
| `max_debate_rounds` | integer | Yes | Maximum debate rounds per debate-enabled phase. |
| `max_fan_out_chunks` | integer | Yes | Maximum fan-out chunks per fan-out phase. |

**Tier semantics**:
- `light`: Lightweight features (few files, simple changes)
- `standard`: Normal features and all fix workflows
- `epic`: Large features (20+ files, multiple modules)

**Fallback**: If `performance_budgets` is missing from `workflows.json`, `getPerformanceBudget()` returns hardcoded defaults (AC-002c).

**Fix workflows**: Define only the `standard` tier because fix workflows do not have a sizing step (AC-002e).

---

## 5. Data Flow

```
Phase Start (STEP 3c-prime)
  |
  +-> state.json: phases[key].timing.started_at = ISO-8601
  |
Phase Execution (STEP 3d delegation)
  |
  +-> Read state.json: active_workflow.budget_status
  +-> If exceeded/approaching: inject BUDGET_DEGRADATION into prompt
  |
  +-> Agent executes phase
  +-> Agent returns PHASE_TIMING_REPORT: { debate_rounds_used, fan_out_chunks }
  |
Phase End (STEP 3e)
  |
  +-> state.json: phases[key].timing.completed_at, wall_clock_minutes
  +-> state.json: phases[key].timing.debate_rounds_used, fan_out_chunks
  +-> state.json: active_workflow.budget_status (computed)
  +-> stderr: BUDGET_WARNING or BUDGET_APPROACHING (if applicable)
  |
All Phases Complete (pre-STEP-4)
  |
  +-> Read all phases[].timing
  +-> Read workflow_history[] for prior same-intensity workflows
  +-> Compute rolling average and regression detection
  +-> Display completion dashboard
  |
Finalize (workflow-completion-enforcer fires)
  |
  +-> collectPhaseSnapshots() includes timing objects
  +-> Compute authoritative regression_check
  +-> Write regression_check to workflow_history entry
```

---

## 6. Migration Strategy

No migration is required. All schema changes are additive:

- **Existing state.json files**: Continue to function. Missing `timing`, `budget_status`, and `regression_check` fields are handled by null-checks and defaults in all consumers.
- **Existing workflows.json**: Continues to function. Missing `performance_budgets` falls back to hardcoded defaults (AC-002c).
- **Existing workflow_history entries**: Not modified. `regression_check` is only added to new entries created after the feature ships.

---

## 7. Footprint Budget

| Data Category | Per-Item Size | Items per Workflow | Total |
|--------------|--------------|-------------------|-------|
| Per-phase timing | ~140 bytes | 7-9 phases | ~1,120 bytes |
| Budget status | ~70 bytes | 1 | 70 bytes |
| Regression check | ~180 bytes | 1 | 180 bytes |
| **Total per workflow** | | | **~1,370 bytes** |

This is within the NFR-003 limit of 2 KB per workflow.

---

## 8. Backup and Recovery

State.json is already covered by the framework's existing backup strategy:
- Git-ignored (local-only, regenerated on framework init)
- `workflow_history` entries are the persistent record; active workflow state is transient
- `workflows.json` is version-controlled configuration

No additional backup or recovery mechanisms are needed for this feature.

---

## Traceability

| Schema Element | Traces To |
|---------------|-----------|
| `phases[].timing` | FR-001 (AC-001a through AC-001f) |
| `budget_status` | FR-003 (AC-003c through AC-003e) |
| `budget_exceeded_at_phase` | FR-003 (AC-003c) |
| `regression_check` | FR-006 (AC-006a through AC-006e) |
| `performance_budgets` | FR-002 (AC-002a through AC-002e) |
| Footprint limits | NFR-003 |
| Additive changes | NFR-004 |
