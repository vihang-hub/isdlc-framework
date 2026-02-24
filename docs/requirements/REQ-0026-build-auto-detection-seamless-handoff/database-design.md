# Database Design: Build Auto-Detection and Seamless Phase 05+ Handoff

**Phase**: 03-architecture
**Feature ID**: REQ-BUILD-AUTODETECT
**Traces**: FR-001, FR-002, FR-006, FR-007, FR-008, CON-002

---

## 1. Overview

This feature does not introduce a traditional database. The iSDLC framework uses two JSON files as its data stores:

- **`meta.json`** (per-item): Tracks analysis state for each backlog item in `docs/requirements/{slug}/meta.json`
- **`state.json`** (global): Tracks the active workflow in `.isdlc/state.json`

Both files are read and written by framework utilities (three-verb-utils.cjs, common.cjs) and are gitignored (state.json) or committed (meta.json).

---

## 2. Schema: meta.json (Additive Changes Only)

### 2.1 Current Schema (Unchanged Fields)

```json
{
  "source": "github|jira|manual",
  "source_id": "GH-23|PROJECT-123|null",
  "slug": "build-auto-detection-seamless-handoff",
  "created_at": "2026-02-19T12:00:00Z",
  "analysis_status": "raw|partial|analyzed",
  "phases_completed": ["00-quick-scan", "01-requirements", ...],
  "codebase_hash": "abc1234"
}
```

All existing fields retain their current semantics. No breaking changes (CON-002).

### 2.2 New Additive Fields

| Field | Type | Required | Default | Description | Trace |
|-------|------|----------|---------|-------------|-------|
| `req_id` | string | No | null | REQ-NNNN identifier assigned when build workflow starts | FR-007 |
| `artifact_folder` | string | No | null | Full folder name (e.g., `REQ-0026-build-auto-detection-seamless-handoff`) | FR-007 |
| `build_started_at` | string (ISO-8601) | No | null | Timestamp when build workflow was initialized | FR-008 (AC-008-01) |
| `build_completed_at` | string (ISO-8601) | No | null | Timestamp when build workflow finalized | FR-008 (AC-008-02) |
| `workflow_type` | string | No | null | `"feature"` or `"fix"` -- type of build workflow | FR-008 (AC-008-01) |

### 2.3 Complete Schema (After Feature)

```json
{
  "source": "github",
  "source_id": "GH-23",
  "slug": "build-auto-detection-seamless-handoff",
  "created_at": "2026-02-19T12:00:00Z",
  "analysis_status": "analyzed",
  "phases_completed": ["00-quick-scan", "01-requirements", "02-impact-analysis", "03-architecture", "04-design"],
  "codebase_hash": "9e304d4",
  "req_id": "REQ-0026",
  "artifact_folder": "REQ-0026-build-auto-detection-seamless-handoff",
  "build_started_at": "2026-02-19T19:00:00Z",
  "workflow_type": "feature",
  "build_completed_at": null
}
```

---

## 3. Schema: state.json (No Schema Changes)

### 3.1 active_workflow Changes

The `active_workflow.phases` array will contain a **subset** of the full feature workflow phases when `START_PHASE` is used. This is already supported by `resetPhasesForWorkflow()` which accepts any array.

Example with full workflow:
```json
{
  "active_workflow": {
    "phases": ["00-quick-scan", "01-requirements", "02-impact-analysis", "03-architecture", "04-design", "05-test-strategy", "06-implementation", "16-quality-loop", "08-code-review"]
  }
}
```

Example with phase-skip (fully analyzed item):
```json
{
  "active_workflow": {
    "phases": ["05-test-strategy", "06-implementation", "16-quality-loop", "08-code-review"],
    "pre_analyzed": true,
    "analysis_phases_completed": ["00-quick-scan", "01-requirements", "02-impact-analysis", "03-architecture", "04-design"]
  }
}
```

### 3.2 New Additive Fields in active_workflow

| Field | Type | Description | Trace |
|-------|------|-------------|-------|
| `pre_analyzed` | boolean | Whether the item was pre-analyzed before build started | FR-001, FR-002 |
| `analysis_phases_completed` | string[] | Analysis phases that were completed before build | FR-002 (AC-002-04) |

---

## 4. Data Access Patterns

### 4.1 Read Patterns (Detection Phase)

| Operation | File | Function | Trace |
|-----------|------|----------|-------|
| Read meta.json | `docs/requirements/{slug}/meta.json` | `readMetaJson(slugDir)` | FR-001 |
| Read analysis_status | meta.json | `computeStartPhase(meta, ...)` | FR-001 |
| Read phases_completed | meta.json | `validatePhasesCompleted(...)` | FR-003 |
| Read codebase_hash | meta.json | `checkStaleness(meta, ...)` | FR-004 |

### 4.2 Write Patterns (Workflow Initialization)

| Operation | File | Function | Trace |
|-----------|------|----------|-------|
| Write active_workflow.phases (subset) | state.json | `resetPhasesForWorkflow(state, slicedPhases)` | FR-006 |
| Write build_started_at | meta.json | Orchestrator (init-and-phase-01) | FR-008 |
| Write build_completed_at | meta.json | Orchestrator (finalize) | FR-008 |
| Clear phases_completed (full restart) | meta.json | Build verb handler | FR-003 (AC-003-05) |

### 4.3 Data Integrity

- **CON-001 compliance**: No state.json writes during the detection phase. State writes occur only after the orchestrator receives the delegation.
- **CON-002 compliance**: No breaking schema changes. All new fields are additive and optional.
- **Concurrent access**: Protected by CON-004 (single active workflow per project). No concurrent writes possible.

---

## 5. Migration Strategy

No migration needed. New fields are additive:

- Existing meta.json files without `build_started_at`, `build_completed_at`, `workflow_type`, `req_id`, or `artifact_folder` are valid -- these fields default to null when absent.
- Existing meta.json files without `codebase_hash` trigger the legacy path (AC-004-07): staleness detection is skipped, and the hash is populated with the current HEAD for future use.
- No data migration script required.

---

## 6. Backup and Recovery

- **meta.json**: Committed to git. Recovery via `git checkout` or `git restore`.
- **state.json**: Gitignored. Recovery via framework re-initialization (`/isdlc cancel` + restart). Loss of state.json during a build is recoverable because the build verb can re-detect analysis status from meta.json.
