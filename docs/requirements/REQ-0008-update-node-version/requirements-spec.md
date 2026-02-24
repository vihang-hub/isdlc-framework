# Requirements Specification: REQ-0008 — Update Node Version

**Workflow**: Feature
**Created**: 2026-02-10
**Status**: APPROVED

---

## 1. Problem Statement

The iSDLC framework currently targets Node.js >=18.0.0 as its minimum supported version. Node.js 18 reached end-of-life (EOL) on April 30, 2025, meaning it no longer receives security patches or bug fixes. The project's CI matrix tests against Node 18, 20, and 22, but Node 18 is unsupported and Node 20 reaches EOL on April 30, 2026. Meanwhile, the developer's local environment runs Node 24 (v24.10.0), and Node 24 is the current Active LTS.

The framework needs to drop EOL Node versions and update its minimum to a currently-supported LTS version.

## 2. Current State Analysis

### Node.js Version References in the Project

| Location | Current Value | Purpose |
|----------|--------------|---------|
| `package.json` `engines.node` | `>=18.0.0` | npm version gate |
| `.github/workflows/ci.yml` matrix | `[18, 20, 22]` | CI test matrix |
| `.github/workflows/publish.yml` matrix | `[18, 20, 22]` | Pre-publish test matrix |
| `docs/isdlc/constitution.md` Article XII | "Node 18, 20, 22" | Cross-platform requirement |
| `docs/isdlc/constitution.md` Article XIII | Mentions `"type": "commonjs"` and hook behavior | Module system rules |
| `README.md` | References Node 18+ | User-facing docs |
| `state.json` `project.tech_stack.runtime` | `"node-18+"` | Internal state |

### Node.js LTS Schedule (as of February 2026)

| Version | Status | EOL Date |
|---------|--------|----------|
| Node 18 | **EOL** (ended April 30, 2025) | Past |
| Node 20 | Maintenance LTS (EOL soon) | April 30, 2026 |
| Node 22 | Maintenance LTS | April 30, 2027 |
| Node 24 | **Active LTS** | ~April 2028 |

### Decision: New Minimum Version

**Target minimum: Node 20** (>=20.0.0)

Rationale:
- Node 18 is EOL -- must be dropped immediately
- Node 20 is still in Maintenance LTS (2.5 months remaining) and widely deployed
- Node 22 is the newest Maintenance LTS with support through April 2027
- Node 24 is Active LTS -- the recommended version for new deployments
- Setting minimum to 20 gives users time to upgrade while dropping the truly unsupported version
- CI matrix should test: 20, 22, 24 (three active/maintenance LTS versions)

## 3. Functional Requirements

### REQ-001: Update package.json engines field
**Priority**: P0 (Critical)
**Description**: Change `engines.node` from `>=18.0.0` to `>=20.0.0`.

**Acceptance Criteria**:
- AC-1: `package.json` `engines.node` field reads `">=20.0.0"`
- AC-2: Running `npm install` on Node 18 produces an engines warning
- AC-3: Running `npm install` on Node 20+ succeeds without engines warnings

### REQ-002: Update CI workflow matrix
**Priority**: P0 (Critical)
**Description**: Update `.github/workflows/ci.yml` to test against Node 20, 22, and 24 instead of 18, 20, and 22.

**Acceptance Criteria**:
- AC-4: CI matrix `node` array is `[20, 22, 24]` in the `test` job
- AC-5: CI lint job uses Node 22 (or 24) instead of Node 20
- AC-6: CI integration job uses Node 22 (or 24) instead of Node 20
- AC-7: CI matrix still covers 3 OS x 3 Node versions = 9 combinations
- AC-8: Bash installer job is unchanged (does not specify Node version)
- AC-9: PowerShell installer job is unchanged (does not specify Node version)

### REQ-003: Update publish workflow matrix
**Priority**: P0 (Critical)
**Description**: Update `.github/workflows/publish.yml` to test against Node 20, 22, and 24.

**Acceptance Criteria**:
- AC-10: Publish workflow test matrix `node-version` array is `[20, 22, 24]`
- AC-11: Publish job `setup-node` uses Node 22 (or 24) for publishing
- AC-12: GitHub Packages publish job `setup-node` uses Node 22 (or 24)

### REQ-004: Update constitution Article XII
**Priority**: P1 (High)
**Description**: Update the cross-platform compatibility article to reference Node 20, 22, 24 instead of 18, 20, 22.

**Acceptance Criteria**:
- AC-13: Article XII requirement 4 references "Node 20, 22, 24" (not "Node 18, 20, 22")
- AC-14: Constitution version is bumped (e.g., 1.2.0) with amendment log entry
- AC-15: No other articles are modified

### REQ-005: Update README and user-facing documentation
**Priority**: P1 (High)
**Description**: Update any references to Node 18+ in README.md and other user-facing docs to reflect the new minimum.

**Acceptance Criteria**:
- AC-16: README.md references Node 20+ as minimum (not Node 18+)
- AC-17: Any installation instructions reference Node >=20.0.0

### REQ-006: Update internal state
**Priority**: P2 (Medium)
**Description**: Update `state.json` `project.tech_stack.runtime` from `"node-18+"` to `"node-20+"`.

**Acceptance Criteria**:
- AC-18: `state.json` `project.tech_stack.runtime` reads `"node-20+"`

### REQ-007: Validate no Node 18-specific API dependencies
**Priority**: P1 (High)
**Description**: Verify that the codebase does not use any APIs that were removed or changed between Node 18 and Node 20/22/24. Also verify that the codebase can take advantage of any Node 20+ features if beneficial.

**Acceptance Criteria**:
- AC-19: No code uses APIs deprecated or removed in Node 20+
- AC-20: `node:test` usage is compatible with Node 20+ (the framework uses Node built-in test runner)
- AC-21: All existing tests pass on Node 20, 22, and 24

## 4. Non-Functional Requirements

### NFR-001: Backward Compatibility
Users currently on Node 20 or 22 MUST NOT be affected by this change. Only Node 18 users will need to upgrade.

### NFR-002: CI Execution Time
The CI matrix change (swapping 18 for 24) MUST NOT increase total CI execution time by more than 10%.

### NFR-003: Zero Test Regression
All existing tests MUST pass on all three target Node versions (20, 22, 24) with zero failures.

### NFR-004: Documentation Consistency
All references to Node version requirements MUST be consistent across package.json, CI workflows, constitution, README, and state.json.

## 5. Constraints

1. **No new dependencies**: This is a configuration-only change -- no new npm packages
2. **No API changes**: No runtime behavior changes to the framework
3. **Atomic update**: All Node version references MUST be updated in a single workflow pass
4. **Constitution governance**: Article XII amendment MUST follow constitutional amendment process (version bump + amendment log)

## 6. Out of Scope

- Adopting Node 24-only features (e.g., `require(esm)` stabilization) -- that would be a separate feature
- Changing the ESM/CJS dual-module architecture
- Updating any npm dependencies to their latest versions
- Performance benchmarking across Node versions

## 7. Traceability Matrix

| Requirement | Files Affected | Test Coverage |
|-------------|---------------|---------------|
| REQ-001 | `package.json` | AC-1, AC-2, AC-3 |
| REQ-002 | `.github/workflows/ci.yml` | AC-4 through AC-9 |
| REQ-003 | `.github/workflows/publish.yml` | AC-10 through AC-12 |
| REQ-004 | `docs/isdlc/constitution.md` | AC-13 through AC-15 |
| REQ-005 | `README.md` | AC-16, AC-17 |
| REQ-006 | `.isdlc/state.json` | AC-18 |
| REQ-007 | (validation only) | AC-19 through AC-21 |
