# Test Strategy: Build Consumption -- Init Split & Smart Staleness (REQ-0031)

**Phase**: 05-test-strategy
**Version**: 1.0
**Created**: 2026-02-20
**Feature**: GH-60 (MODE: init-only + Phase-Loop handles all phases) + GH-61 (Blast-radius-aware smart staleness)
**Traces to**: FR-001 through FR-007, NFR-001 through NFR-005

---

## Existing Infrastructure (from project discovery)

- **Framework**: Node.js built-in `node:test` + `node:assert/strict` (Node 18+)
- **Coverage Tool**: c8 / Node.js built-in coverage
- **Current Baseline**: 555+ tests (per constitution Article II baseline)
- **Existing Patterns**: CJS hooks tested in `src/claude/hooks/tests/` with temp dir isolation, `beforeEach`/`afterEach` cleanup; test IDs follow `TC-{PREFIX}-NN` pattern
- **Existing Test for Related Area**: `test-three-verb-utils.test.cjs` -- 2992 lines, comprehensive tests for `checkStaleness()` (9 tests: TC-CS-01 through TC-CS-09), `computeStartPhase()`, `validatePhasesCompleted()`, tier routing functions
- **Existing Test for Related Area**: `test-three-verb-utils-steps.test.cjs` -- step tracking extension tests (meta.json fields)
- **Coverage Gap**: `extractFilesFromImpactAnalysis()` does not exist yet (new function). `checkBlastRadiusStaleness()` does not exist yet (new function). No tests for blast-radius-aware staleness or impact-analysis parsing.

## Strategy for This Requirement

- **Approach**: Extend existing CJS test suite in `src/claude/hooks/tests/test-three-verb-utils.test.cjs`. Add new `describe()` blocks following the existing numbered section pattern (next section numbers: 33, 34, 35).
- **New Test Types Needed**: Unit tests for 2 new utility functions (`extractFilesFromImpactAnalysis`, `checkBlastRadiusStaleness`), integration tests for the blast-radius staleness pipeline (extract + check), boundary/edge case tests for resilient parsing.
- **Coverage Target**: >=80% unit test coverage on all new functions (per Article II). 100% coverage on error/fallback paths (per NFR-003 graceful degradation). All 30 acceptance criteria covered.
- **Markdown agent files** (isdlc.md, orchestrator.md) are **not unit-testable** -- their behavior is verified through manual workflow execution and integration validation during Phase 16.

## Test Commands (use existing)

- Unit (CJS): `npm run test:hooks`
- All tests: `npm run test:all`
- Single file: `node --test src/claude/hooks/tests/test-three-verb-utils.test.cjs`

---

## Test Pyramid

### Level 1: Unit Tests (Primary -- 85% of test effort)

The two new utility functions in `three-verb-utils.cjs` are pure or near-pure functions with injectable dependencies, ideal for direct unit testing.

| Function | Test Count | Priority | Rationale |
|----------|-----------|----------|-----------|
| `extractFilesFromImpactAnalysis()` | 12 | P0 | Core parser for blast radius file list; feeds into staleness algorithm |
| `checkBlastRadiusStaleness()` | 15 | P0 | Core staleness algorithm; determines user experience (silent/info/warning) |
| **Total unit tests** | **27** | | |

### Level 2: Integration Tests (10% of test effort)

Cross-function flows that validate the extract-then-check pipeline.

| Flow | Test Count | Priority |
|------|-----------|----------|
| extractFiles + checkBlastRadius pipeline (real impact-analysis.md samples) | 3 | P0 |
| Backward compatibility: existing `checkStaleness()` unchanged | 2 | P1 |
| **Total integration tests** | **5** | |

### Level 3: Manual Validation Protocols (5% of test effort)

For markdown agent files (isdlc.md, orchestrator.md) that cannot be unit tested.

| Protocol | Validates | Priority |
|----------|----------|----------|
| MP-01: Full feature workflow with init-only | FR-001, FR-002, FR-007 | P0 |
| MP-02: Pre-analyzed build with START_PHASE | FR-001 AC-001-02, FR-002 AC-002-02 | P0 |
| MP-03: Staleness -- no overlap (silent) | FR-006 AC-006-01 | P1 |
| MP-04: Staleness -- 1-3 overlap (info) | FR-006 AC-006-02 | P1 |
| MP-05: Staleness -- 4+ overlap (warning) | FR-006 AC-006-03 | P1 |
| MP-06: Staleness -- fallback (no impact-analysis.md) | FR-006 AC-006-04 | P0 |
| MP-07: Backward compat -- init-and-phase-01 still works | FR-003 AC-003-01 | P0 |
| **Total manual protocols** | **7** | |

---

## Test Case Summary

**Total automated test cases**: 32 (27 unit + 5 integration)
**Total manual protocols**: 7
**Total coverage**: 32 automated + 7 manual = 39 test points

---

## Requirement-to-Test Mapping (Coverage Analysis)

### FR-001: MODE: init-only (6 ACs)

| AC | Test Coverage | Type |
|----|-------------|------|
| AC-001-01 | MP-01 (manual: verify state.json after init-only) | Manual |
| AC-001-02 | MP-02 (manual: verify START_PHASE slicing) | Manual |
| AC-001-03 | MP-01 (manual: verify branch creation) | Manual |
| AC-001-04 | MP-01 (manual: verify return JSON format) | Manual |
| AC-001-05 | MP-01 (manual: verify no phase delegation) | Manual |
| AC-001-06 | MP-01 (manual: verify supervised mode flag) | Manual |

**Note**: FR-001 ACs test orchestrator behavior (markdown agent). Not unit-testable. Validated via manual workflow execution.

### FR-002: Phase-Loop Controller Handles All Phases (5 ACs)

| AC | Test Coverage | Type |
|----|-------------|------|
| AC-002-01 | MP-01 (manual: Phase 01 delegated by Phase-Loop) | Manual |
| AC-002-02 | MP-02 (manual: START_PHASE skips phases 00-04) | Manual |
| AC-002-03 | MP-01 (manual: Phase 01 follows STEP 3 protocol) | Manual |
| AC-002-04 | MP-01 (manual: Phase 01 in task list, not pre-marked) | Manual |
| AC-002-05 | MP-01 (manual: STEP 1 uses init-only) | Manual |

### FR-003: Deprecate init-and-phase-01 (4 ACs)

| AC | Test Coverage | Type |
|----|-------------|------|
| AC-003-01 | MP-07 (manual: existing behavior preserved) | Manual |
| AC-003-02 | MP-07 (manual: deprecated label in docs) | Manual |
| AC-003-03 | MP-01 (manual: STEP 1 uses init-only) | Manual |
| AC-003-04 | MP-07 (manual: deprecation notice emitted) | Manual |

### FR-004: Blast-Radius-Aware Staleness Check (6 ACs)

| AC | Test Coverage | Type |
|----|-------------|------|
| AC-004-01 | TC-BR-01, TC-BR-02 | Unit |
| AC-004-02 | TC-BR-03, TC-BR-04 | Unit |
| AC-004-03 | TC-BR-05, TC-BR-06 | Unit |
| AC-004-04 | TC-BR-07, TC-BR-08 | Unit |
| AC-004-05 | TC-BR-09, TC-BR-10 | Unit |
| AC-004-06 | TC-BR-11, TC-BR-12 | Unit |

### FR-005: Extract Files from Impact Analysis (4 ACs)

| AC | Test Coverage | Type |
|----|-------------|------|
| AC-005-01 | TC-EF-01, TC-EF-02, TC-EF-03 | Unit |
| AC-005-02 | TC-EF-04, TC-EF-05 | Unit |
| AC-005-03 | TC-EF-06, TC-EF-07, TC-EF-08 | Unit |
| AC-005-04 | TC-EF-09, TC-EF-10, TC-EF-11 | Unit |

### FR-006: Tiered Staleness UX (4 ACs)

| AC | Test Coverage | Type |
|----|-------------|------|
| AC-006-01 | TC-BR-03 (severity: none) + MP-03 | Unit + Manual |
| AC-006-02 | TC-BR-05 (severity: info) + MP-04 | Unit + Manual |
| AC-006-03 | TC-BR-07 (severity: warning) + MP-05 | Unit + Manual |
| AC-006-04 | TC-BR-09 (severity: fallback) + MP-06 | Unit + Manual |

### FR-007: init-only Return Format (3 ACs)

| AC | Test Coverage | Type |
|----|-------------|------|
| AC-007-01 | MP-01 (manual: verify return format) | Manual |
| AC-007-02 | MP-01 (manual: Phase-Loop starts from index 0) | Manual |
| AC-007-03 | MP-02 (manual: sliced phases, index 0) | Manual |

### NFR-001: Backward Compatibility (3 ACs)

| AC | Test Coverage | Type |
|----|-------------|------|
| AC-NFR-001-01 | MP-01 (manual: feature workflow) | Manual |
| AC-NFR-001-02 | MP-07 (manual: fix workflow) | Manual |
| AC-NFR-001-03 | MP-07 (manual: init-and-phase-01 unchanged) | Manual |

### NFR-002: Performance (2 ACs)

| AC | Test Coverage | Type |
|----|-------------|------|
| AC-NFR-002-01 | TC-BR-15 (large diff performance) | Unit |
| AC-NFR-002-02 | TC-EF-12 (large table performance) | Unit |

### NFR-003: Resilience (3 ACs)

| AC | Test Coverage | Type |
|----|-------------|------|
| AC-NFR-003-01 | TC-BR-09 (fallback: no impact-analysis) | Unit |
| AC-NFR-003-02 | TC-BR-11 (fallback: git diff failed) | Unit |
| AC-NFR-003-03 | TC-EF-06 (empty array on unparseable) | Unit |

### NFR-004: Testability (2 ACs)

| AC | Test Coverage | Type |
|----|-------------|------|
| AC-NFR-004-01 | All TC-EF tests (pure function, no I/O) | Unit |
| AC-NFR-004-02 | All TC-BR tests (injectable changedFiles) | Unit |

### NFR-005: Maintainability (2 ACs)

| AC | Test Coverage | Type |
|----|-------------|------|
| AC-NFR-005-01 | MP-01 (manual: all phases via Phase-Loop) | Manual |
| AC-NFR-005-02 | MP-01 (manual: init-only does only init) | Manual |

---

## Coverage Verification

**Total ACs across all FRs and NFRs**: 44
**ACs with automated test coverage**: 20 (FR-004: 6, FR-005: 4, FR-006: 4, NFR-002: 2, NFR-003: 3, NFR-004: 1 -- NFR-004 is structural)
**ACs with manual protocol coverage**: 24 (FR-001: 6, FR-002: 5, FR-003: 4, FR-007: 3, NFR-001: 3, NFR-005: 2, plus FR-006 overlap)
**ACs with zero coverage**: 0
**Coverage**: 100%

---

## Critical Paths (100% coverage required per Article II)

1. **Blast-radius intersection logic**: 0 overlap -> none, 1-3 -> info, 4+ -> warning (TC-BR-03 through TC-BR-08)
2. **Fallback to naive staleness**: Missing impact-analysis.md, git diff failure, unparseable table (TC-BR-09 through TC-BR-12)
3. **extractFilesFromImpactAnalysis null safety**: null/undefined/empty input returns [] (TC-EF-06 through TC-EF-08)
4. **checkBlastRadiusStaleness never throws**: try/catch wrapping returns fallback result (TC-BR-13, TC-BR-14)

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| isdlc.md is not unit-testable | 7 manual validation protocols cover all orchestration ACs |
| Impact-analysis.md format may vary | Resilient parser with multiple format tests (TC-EF-01 through TC-EF-05) |
| Git diff may fail in edge cases | Fallback path tested (TC-BR-11, TC-BR-12) |
| Regression in existing checkStaleness() | Existing 9 tests (TC-CS-01 through TC-CS-09) must remain passing |

---

## Test Data Strategy

Test data is generated inline within test cases using string literals for markdown content. No external fixture files needed.

**Key test data patterns**:
1. **Valid impact-analysis.md** with "Directly Affected Files" table (5 files)
2. **Impact-analysis.md with multiple tables** (Directly Affected + Indirect Dependencies)
3. **Empty/null/undefined content** for graceful degradation
4. **Various path formats**: relative (`src/foo.js`), with `./` prefix, with `/` prefix
5. **Large table** (50+ files) for performance testing
6. **Changed file lists**: 0 overlap, 1-3 overlap, 4+ overlap, exact match

---

## Constitutional Compliance

| Article | Compliance | Evidence |
|---------|-----------|----------|
| Article II (Test-First) | PASS | Tests designed before implementation; 32 automated + 7 manual covering all ACs |
| Article VII (Traceability) | PASS | Traceability matrix maps every AC to test cases; 0 orphan requirements |
| Article IX (Quality Gates) | PASS | All GATE-04 artifacts complete; 100% coverage verified |
| Article XI (Integration Testing) | PASS | 5 integration tests validate cross-function pipeline; injectable dependencies for testability; boundary/edge case tests included |
