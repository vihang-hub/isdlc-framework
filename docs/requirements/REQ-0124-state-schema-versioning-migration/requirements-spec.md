# Requirements Specification: State Schema Versioning and Migration

**Item**: REQ-0124 | **GitHub**: #188 | **Depends on**: REQ-0080 | **Phase**: 2
**Status**: Analyzed

---

## 1. Business Context

Add explicit schema versioning to state.json. Currently `state_version` is an incrementing write counter, not a schema version. Existing projects may be mid-workflow during migration — forward migration must handle in-flight state safely.

## 2. Functional Requirements

### FR-001: Schema Version Field
- **AC-001-01**: state.json gets a `schema_version` field (distinct from `state_version` counter).
- **AC-001-02**: New installations start at schema_version 1.
- **AC-001-03**: Existing state.json without schema_version is treated as version 0 (pre-versioning).

### FR-002: Forward Migration
- **AC-002-01**: migrateState(state) applies all migrations from state.schema_version to current.
- **AC-002-02**: Each migration is a pure function: (state) → state.
- **AC-002-03**: Migrations are applied on readState() automatically.

### FR-003: In-Flight Compatibility
- **AC-003-01**: Mid-workflow state (active_workflow set) survives migration without data loss.
- **AC-003-02**: Migration preserves: active_workflow, phases, workflow_history, skill_usage_log.

### FR-004: Doctor Repair
- **AC-004-01**: Doctor detects state.json with outdated schema_version.
- **AC-004-02**: Doctor can apply pending migrations.

## 3. MoSCoW: FR-001, FR-002 Must Have. FR-003 Must Have. FR-004 Should Have.
