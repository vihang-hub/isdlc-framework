# State Schema Design -- REQ-0011: Adaptive Workflow Sizing

**Version**: 1.0.0
**Created**: 2026-02-12
**Phase**: 03-architecture
**Traces to**: FR-05, FR-07, AC-15 through AC-18, AC-24, AC-25

---

## 1. Overview

The iSDLC framework uses JSON files on the filesystem as its data store (no database). The primary state file is `.isdlc/state.json`. This document defines the schema extensions required for adaptive workflow sizing.

---

## 2. State Schema Extension: `active_workflow.sizing`

### 2.1 New Field Location

```
.isdlc/state.json
  -> active_workflow
    -> sizing          [NEW -- added by applySizingDecision()]
```

### 2.2 Schema Definition

```json
{
  "active_workflow": {
    "sizing": {
      "intensity": "string (enum: light | standard | epic)",
      "effective_intensity": "string (enum: light | standard)",
      "file_count": "integer (>= 0)",
      "module_count": "integer (>= 0)",
      "risk_score": "string (enum: low | medium | high)",
      "coupling": "string (enum: low | medium | high)",
      "coverage_gaps": "integer (>= 0)",
      "recommended_by": "string (enum: framework | user)",
      "overridden": "boolean",
      "overridden_to": "string | null",
      "decided_at": "string (ISO-8601 timestamp)",
      "forced_by_flag": "boolean",
      "epic_deferred": "boolean"
    }
  }
}
```

### 2.3 Field Descriptions

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `intensity` | string | Yes | -- | The sizing intensity determined (light, standard, epic) |
| `effective_intensity` | string | Yes | -- | The actual intensity applied. Same as `intensity` for light/standard. For epic: "standard" (since epic execution is deferred) |
| `file_count` | integer | Yes | 0 | Number of directly affected files from IA |
| `module_count` | integer | Yes | 0 | Number of affected modules from IA |
| `risk_score` | string | Yes | "medium" | Risk level from IA (low, medium, high) |
| `coupling` | string | Yes | "low" | Coupling/blast radius level from IA |
| `coverage_gaps` | integer | Yes | 0 | Number of files without test coverage |
| `recommended_by` | string | Yes | "framework" | Who recommended: "framework" (algorithm) or "user" (-light flag) |
| `overridden` | boolean | Yes | false | Whether user overrode the framework recommendation |
| `overridden_to` | string | No | null | If overridden, what intensity the user chose |
| `decided_at` | string | Yes | -- | ISO-8601 timestamp of when sizing was decided |
| `forced_by_flag` | boolean | Yes | false | Whether -light flag was used to force intensity |
| `epic_deferred` | boolean | Yes | false | Whether epic was recommended but deferred to standard |

### 2.4 Example States

**Light intensity (framework recommended, user accepted)**:
```json
{
  "sizing": {
    "intensity": "light",
    "effective_intensity": "light",
    "file_count": 3,
    "module_count": 1,
    "risk_score": "low",
    "coupling": "low",
    "coverage_gaps": 0,
    "recommended_by": "framework",
    "overridden": false,
    "overridden_to": null,
    "decided_at": "2026-02-12T15:30:00Z",
    "forced_by_flag": false,
    "epic_deferred": false
  }
}
```

**Light intensity (forced via -light flag)**:
```json
{
  "sizing": {
    "intensity": "light",
    "effective_intensity": "light",
    "file_count": 0,
    "module_count": 0,
    "risk_score": "unknown",
    "coupling": "unknown",
    "coverage_gaps": 0,
    "recommended_by": "user",
    "overridden": false,
    "overridden_to": null,
    "decided_at": "2026-02-12T15:30:00Z",
    "forced_by_flag": true,
    "epic_deferred": false
  }
}
```

**Standard intensity (user overrode light recommendation)**:
```json
{
  "sizing": {
    "intensity": "light",
    "effective_intensity": "standard",
    "file_count": 4,
    "module_count": 2,
    "risk_score": "low",
    "coupling": "low",
    "coverage_gaps": 0,
    "recommended_by": "framework",
    "overridden": true,
    "overridden_to": "standard",
    "decided_at": "2026-02-12T15:30:00Z",
    "forced_by_flag": false,
    "epic_deferred": false
  }
}
```

**Epic recommendation (deferred, proceeds as standard)**:
```json
{
  "sizing": {
    "intensity": "epic",
    "effective_intensity": "standard",
    "file_count": 35,
    "module_count": 8,
    "risk_score": "high",
    "coupling": "high",
    "coverage_gaps": 5,
    "recommended_by": "framework",
    "overridden": false,
    "overridden_to": null,
    "decided_at": "2026-02-12T15:30:00Z",
    "forced_by_flag": false,
    "epic_deferred": true
  }
}
```

---

## 3. Phase Array Mutation Schema

### 3.1 Before Sizing (Standard Feature Workflow)

```json
{
  "active_workflow": {
    "phases": [
      "00-quick-scan",
      "01-requirements",
      "02-impact-analysis",
      "03-architecture",
      "04-design",
      "05-test-strategy",
      "06-implementation",
      "16-quality-loop",
      "08-code-review"
    ],
    "current_phase_index": 3,
    "phase_status": {
      "00-quick-scan": "completed",
      "01-requirements": "completed",
      "02-impact-analysis": "completed",
      "03-architecture": "pending",
      "04-design": "pending",
      "05-test-strategy": "pending",
      "06-implementation": "pending",
      "16-quality-loop": "pending",
      "08-code-review": "pending"
    }
  },
  "phases": {
    "00-quick-scan": { "status": "completed", "started": "...", "completed": "...", "gate_passed": true },
    "01-requirements": { "status": "completed", "started": "...", "completed": "...", "gate_passed": true },
    "02-impact-analysis": { "status": "completed", "started": "...", "completed": "...", "gate_passed": true },
    "03-architecture": { "status": "pending", "started": null, "completed": null, "gate_passed": null },
    "04-design": { "status": "pending", "started": null, "completed": null, "gate_passed": null },
    "05-test-strategy": { "status": "pending", "started": null, "completed": null, "gate_passed": null },
    "06-implementation": { "status": "pending", "started": null, "completed": null, "gate_passed": null },
    "16-quality-loop": { "status": "pending", "started": null, "completed": null, "gate_passed": null },
    "08-code-review": { "status": "pending", "started": null, "completed": null, "gate_passed": null }
  }
}
```

### 3.2 After Light Sizing Applied

```json
{
  "active_workflow": {
    "phases": [
      "00-quick-scan",
      "01-requirements",
      "02-impact-analysis",
      "05-test-strategy",
      "06-implementation",
      "16-quality-loop",
      "08-code-review"
    ],
    "current_phase_index": 3,
    "phase_status": {
      "00-quick-scan": "completed",
      "01-requirements": "completed",
      "02-impact-analysis": "completed",
      "05-test-strategy": "pending",
      "06-implementation": "pending",
      "16-quality-loop": "pending",
      "08-code-review": "pending"
    },
    "sizing": { "...see section 2..." }
  },
  "phases": {
    "00-quick-scan": { "status": "completed", "..." : "..." },
    "01-requirements": { "status": "completed", "..." : "..." },
    "02-impact-analysis": { "status": "completed", "..." : "..." },
    "05-test-strategy": { "status": "pending", "started": null, "completed": null, "gate_passed": null },
    "06-implementation": { "status": "pending", "started": null, "completed": null, "gate_passed": null },
    "16-quality-loop": { "status": "pending", "started": null, "completed": null, "gate_passed": null },
    "08-code-review": { "status": "pending", "started": null, "completed": null, "gate_passed": null }
  }
}
```

Note: `03-architecture` and `04-design` entries are completely removed from both `active_workflow.phases`, `active_workflow.phase_status`, and `phases`.

### 3.3 current_phase_index Recalculation

The `current_phase_index` points to the NEXT phase to execute. After sizing:

- Before: index 3 pointed to `03-architecture` (now removed)
- After: index 3 points to `05-test-strategy` (the next phase in the modified array)

The recalculation algorithm:
```
1. Find the index of the just-completed phase ("02-impact-analysis") in the NEW phases array
2. Set current_phase_index = that_index + 1
3. Verify: phases[current_phase_index] exists and has status "pending"
```

---

## 4. Configuration Schema: workflows.json Extension

### 4.1 New `sizing` Block in Feature Workflow

```json
{
  "feature": {
    "sizing": {
      "enabled": true,
      "thresholds": {
        "light_max_files": 5,
        "epic_min_files": 20
      },
      "light_skip_phases": ["03-architecture", "04-design"],
      "risk_override": {
        "high_risk_forces_standard_minimum": true
      }
    },
    "options": {
      "light": {
        "description": "Force lightweight workflow (skip architecture and design phases)",
        "default": false,
        "flag": "-light"
      }
    }
  }
}
```

### 4.2 Schema Constraints

- `thresholds.light_max_files` must be < `thresholds.epic_min_files`
- `light_skip_phases` entries must all exist in `feature.phases`
- `risk_override.high_risk_forces_standard_minimum`: when true, high-risk features cannot be light (even if file count is low)

---

## 5. Workflow History Preservation (AC-25)

When a workflow completes (STEP 4 finalize), the orchestrator moves `active_workflow` to `workflow_history[]`. The `sizing` object must be preserved:

```json
{
  "workflow_history": [
    {
      "type": "feature",
      "description": "Adaptive workflow sizing",
      "status": "completed",
      "phases": ["00-quick-scan", "01-requirements", "02-impact-analysis", "05-test-strategy", "06-implementation", "16-quality-loop", "08-code-review"],
      "sizing": {
        "intensity": "light",
        "effective_intensity": "light",
        "file_count": 3,
        "decided_at": "2026-02-12T15:30:00Z"
      },
      "phase_snapshots": ["..."],
      "metrics": { "total_phases": 7, "phases_completed": 7 }
    }
  ]
}
```

The `sizing` object is copied verbatim from `active_workflow.sizing` to the `workflow_history` entry. The `collectPhaseSnapshots()` function already iterates `active_workflow.phases` (the modified array), so it will correctly capture only the phases that were actually executed.

---

## 6. State Write Validator Impact

The `state-write-validator.cjs` hook validates state.json writes for structural integrity. It is observational-only (never blocks). It needs to be aware that:

1. `active_workflow.sizing` is a legitimate new field (not suspicious)
2. `active_workflow.phases` may have fewer entries than the workflow definition in workflows.json (after light sizing)
3. `phases` object may have fewer entries than expected (after light sizing)

The validator currently validates individual phase entries (checking for suspicious patterns like `constitutional_validation.completed === true` with `iterations_used < 1`). Since removed phases are completely deleted (not set to a suspicious state), the validator should work correctly without changes to its core validation logic. The only change needed is ensuring the validator does not flag the absence of expected phases as suspicious.

---

## 7. Migration Strategy

No migration is needed. The schema changes are additive:
- `active_workflow.sizing` is a new optional field. Workflows that do not trigger sizing simply do not have this field.
- `workflows.json` gains a new `sizing` block. Hooks that read `workflows.json` use property access that returns `undefined` for missing keys.
- State.json has no formal schema version. The `state-write-validator` handles unknown fields gracefully.

### Backward Compatibility

| Scenario | Behavior |
|----------|----------|
| Old state.json (no `sizing` field) | Works. STEP 3e-sizing checks `active_workflow.sizing` is not set -- if missing, sizing runs normally. |
| Old workflows.json (no `sizing` block) | Works. STEP 3e-sizing reads `feature.sizing` -- if undefined, defaults to standard (no sizing prompt). |
| New state.json read by old hooks | Works. Old hooks never access `active_workflow.sizing`. Unknown fields are ignored. |
| Modified `phases` array read by existing hooks | Works. All hooks iterate `active_workflow.phases` as-is. Fewer phases means fewer iterations, not errors. |
