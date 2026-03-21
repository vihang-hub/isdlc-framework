# Requirements Specification: Extract StateStore Service

**Item**: REQ-0080 | **GitHub**: #144 | **Depends on**: REQ-0079 | **Phase**: 2
**Status**: Analyzed

---

## 1. Business Context

Expand the minimal StateStore from REQ-0076 into the full state management service. Extract ~25 state-related functions from `common.cjs` and ~8 validation functions from `state-logic.cjs` into `src/core/state/`. The existing `common.cjs` functions become thin wrappers that delegate to core — zero caller breakage.

## 2. Functional Requirements

### FR-001: State Read/Write with Monorepo Support
- **AC-001-01**: readState(projectId) resolves state path via monorepo config when present.
- **AC-001-02**: writeState(state, projectId) performs atomic write (temp + rename) and increments state_version.
- **AC-001-03**: getProjectRoot() walks up directories to find .isdlc/.

### FR-002: Project Resolution
- **AC-002-01**: resolveStatePath(projectId) handles monorepo project isolation.
- **AC-002-02**: resolveProjectFromCwd() matches CWD against registered project paths.
- **AC-002-03**: getActiveProject() returns current project context.

### FR-003: State Validation
- **AC-003-01**: validatePhase() from state-logic.cjs validates phase data for suspicious patterns.
- **AC-003-02**: validateStateWrite() runs all validation rules before persisting.
- **AC-003-03**: Validation failures log warnings but don't block writes (fail-open, Article X).

### FR-004: Path Resolution Functions
- **AC-004-01**: resolveConstitutionPath, resolveDocsPath, resolveExternalSkillsPath, resolveExternalManifestPath, resolveSkillReportPath, resolveTasksPath, resolveTestEvaluationPath, resolveAtddChecklistPath, resolveIsdlcDocsPath all extracted to core.

### FR-005: Wrapper Preservation
- **AC-005-01**: Every extracted common.cjs function still exists as a thin wrapper delegating to core.
- **AC-005-02**: All 6000+ existing tests pass after extraction with 0 new failures.

## 3. Testing Strategy

Per accepted approach:
1. Write core module tests (RED)
2. Copy logic to src/core/state/ (GREEN)
3. Run core tests
4. Replace common.cjs bodies with wrapper delegates
5. Run FULL test suite — 0 regressions

## 4. MoSCoW: FR-001, FR-005 Must Have. FR-002, FR-003, FR-004 Must Have.
