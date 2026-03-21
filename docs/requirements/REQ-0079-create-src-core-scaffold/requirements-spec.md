# Requirements Specification: Create src/core/ Scaffold

**Item**: REQ-0079 | **GitHub**: #143 | **Phase**: 2
**Status**: Analyzed

---

## 1. Business Context

Expand the `src/core/` scaffold (started by REQ-0076) to include all directories needed for Phase 2 core extraction. Structural only — no logic, just directory creation and package.json exports.

## 2. Functional Requirements

### FR-001: Expand Directory Structure
- **AC-001-01**: Given src/core/, then these subdirectories exist: validators/, workflow/, skills/, search/, memory/, providers/, content/ (in addition to existing state/, teams/, bridge/).
- **AC-001-02**: Given each new directory, then an index.js stub exists (empty ESM module with TODO comment).

### FR-002: Package.json Exports
- **AC-002-01**: Given package.json, then exports field includes paths for all core modules.

## 3. Out of Scope

Actual logic extraction — that's REQ-0080 through REQ-0086.

## 4. MoSCoW: All Must Have.
