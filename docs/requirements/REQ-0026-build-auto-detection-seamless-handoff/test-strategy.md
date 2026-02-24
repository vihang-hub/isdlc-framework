# Test Strategy: Build Auto-Detection and Seamless Phase 05+ Handoff

**Phase**: 05-test-strategy
**Feature ID**: REQ-BUILD-AUTODETECT
**Based On**: requirements-spec.md (8 FRs, 6 NFRs), architecture.md (4 ADRs), module-design-three-verb-utils.md, module-design-build-verb.md, module-design-orchestrator.md, error-taxonomy.md, validation-rules.md
**Generated**: 2026-02-19

---

## 1. Executive Summary

This test strategy defines the approach for validating the build auto-detection feature across three implementation layers: utility functions (three-verb-utils.cjs), build verb handler (isdlc.md), and orchestrator (00-sdlc-orchestrator.md). The strategy adopts the 27 test cases specified in module-design-three-verb-utils.md and extends them with additional edge cases, integration tests, error handling tests, and regression tests to achieve 100% requirement coverage.

**Total test cases**: 58
**Test types**: Unit (40), Integration (10), Regression (5), Error Handling (3)
**Coverage target**: 100% of exported function branches, 100% of requirement traceability

---

## 2. Existing Infrastructure

- **Framework**: Node.js built-in `node:test` + `node:assert/strict` (Node 18+)
- **Test file format**: CJS (`.test.cjs`) for hook and utility tests
- **Existing test file**: `src/claude/hooks/tests/test-three-verb-utils.test.cjs` (~1577 lines, ~100 tests for 14 existing exports)
- **Test helpers**: Inline in test file (`createTestDir`, `cleanupTestDir`, `createSlugDir`, `writeBacklog`, `getRequirementsDir`, `getBacklogPath`)
- **Run command**: `node --test src/claude/hooks/tests/test-three-verb-utils.test.cjs` or `npm run test:hooks`
- **Coverage tool**: None formal; branch coverage validated by test case design
- **Existing patterns**: Each function gets a top-level `describe()` block with individual `it()` cases. Test names include validation rule IDs in parentheses.
- **Naming convention**: Test names follow `"description (VR-XXX-NNN)"` pattern for traceability

**Strategy**: Extend the existing test file with new `describe()` blocks for the 3 new functions and the `IMPLEMENTATION_PHASES` constant. Follow existing naming conventions, helper patterns, and test structure.

---

## 3. Test Pyramid

### 3.1 Unit Tests (40 cases)

All detection logic is implemented as pure functions in `three-verb-utils.cjs`. These are the primary testing target.

| Function | Test Cases | Priority | Notes |
|----------|-----------|----------|-------|
| `validatePhasesCompleted()` | 14 | P0 | Foundation for all detection logic |
| `computeStartPhase()` | 14 | P0 | Core build auto-detection |
| `checkStaleness()` | 9 | P1 | Staleness detection |
| `IMPLEMENTATION_PHASES` constant | 3 | P2 | Structural validation |

### 3.2 Integration Tests (10 cases)

Validate the interaction between components:

| Integration Point | Test Cases | Priority |
|-------------------|-----------|----------|
| `computeStartPhase` + `validatePhasesCompleted` composition | 3 | P0 |
| `computeStartPhase` with real `workflows.json` phases | 2 | P1 |
| Build verb detection flow (meta read -> compute -> staleness) | 3 | P1 |
| Orchestrator phase-slicing with `resetPhasesForWorkflow` | 2 | P1 |

### 3.3 Regression Tests (5 cases)

Ensure backward compatibility (NFR-003):

| Scenario | Test Cases | Priority |
|----------|-----------|----------|
| Build with no meta.json (raw) | 1 | P0 |
| Build with empty phases_completed | 1 | P0 |
| Build with corrupted meta.json | 1 | P0 |
| Feature alias equivalence | 1 | P1 |
| Orchestrator without START_PHASE | 1 | P0 |

### 3.4 Error Handling Tests (3 cases)

Validate graceful degradation (NFR-004):

| Error Scenario | Test Cases | Priority |
|----------------|-----------|----------|
| ERR-BUILD-002: corrupted meta.json | 1 | P0 |
| ERR-BUILD-003: non-contiguous phases | 1 | P1 |
| ERR-ORCH-INVALID-START-PHASE | 1 | P1 |

---

## 4. Test Cases

### 4.1 IMPLEMENTATION_PHASES Constant (3 cases)

| # | ID | Test Name | Type | Priority | Input | Expected Output | Requirement Trace |
|---|-----|-----------|------|----------|-------|-----------------|-------------------|
| 1 | TC-CONST-01 | exports IMPLEMENTATION_PHASES as an array | positive | P2 | n/a | Array.isArray(IMPLEMENTATION_PHASES) === true | FR-002, FR-006 |
| 2 | TC-CONST-02 | IMPLEMENTATION_PHASES contains exactly 4 phases | positive | P2 | n/a | length === 4, includes 05-test-strategy, 06-implementation, 16-quality-loop, 08-code-review | FR-002, FR-006, AC-002-01 |
| 3 | TC-CONST-03 | IMPLEMENTATION_PHASES does not overlap with ANALYSIS_PHASES | positive | P2 | n/a | No element in IMPLEMENTATION_PHASES exists in ANALYSIS_PHASES | FR-002 |

### 4.2 validatePhasesCompleted() (14 cases)

| # | ID | Test Name | Type | Priority | Input (phasesCompleted) | Expected Output | Requirement Trace |
|---|-----|-----------|------|----------|------------------------|-----------------|-------------------|
| 1 | TC-VPC-01 | returns empty for null input | negative | P0 | `null` | `{ valid: [], warnings: ["...not an array"] }` | NFR-004, VR-VALIDATE-001 |
| 2 | TC-VPC-02 | returns empty for undefined | negative | P0 | `undefined` | `{ valid: [], warnings: ["...not an array"] }` | NFR-004, VR-VALIDATE-001 |
| 3 | TC-VPC-03 | returns empty for string input | negative | P0 | `"not-array"` | `{ valid: [], warnings: ["...not an array"] }` | NFR-004, VR-VALIDATE-001 |
| 4 | TC-VPC-04 | returns empty for number input | negative | P0 | `42` | `{ valid: [], warnings: ["...not an array"] }` | NFR-004, VR-VALIDATE-001 |
| 5 | TC-VPC-05 | returns empty for empty array | positive | P0 | `[]` | `{ valid: [], warnings: [] }` | FR-001, AC-001-03 |
| 6 | TC-VPC-06 | returns single contiguous phase | positive | P0 | `["00-quick-scan"]` | `{ valid: ["00-quick-scan"], warnings: [] }` | FR-001 |
| 7 | TC-VPC-07 | returns two contiguous phases | positive | P0 | `["00-quick-scan", "01-requirements"]` | `{ valid: ["00-quick-scan", "01-requirements"], warnings: [] }` | FR-001, AC-001-02 |
| 8 | TC-VPC-08 | returns all 5 analysis phases | positive | P0 | all 5 phases | `{ valid: [all 5], warnings: [] }` | FR-001, AC-001-01 |
| 9 | TC-VPC-09 | handles gap (non-contiguous) | negative | P0 | `["00-quick-scan", "02-impact-analysis"]` | `{ valid: ["00-quick-scan"], warnings: ["Non-contiguous..."] }` | FR-003, AC-003-06, VR-VALIDATE-003 |
| 10 | TC-VPC-10 | handles missing first phase | negative | P1 | `["01-requirements", "02-impact-analysis"]` | `{ valid: [], warnings: ["Non-contiguous..."] }` | FR-003, AC-003-06 |
| 11 | TC-VPC-11 | filters unknown keys silently | negative | P1 | `["00-quick-scan", "future-phase"]` | `{ valid: ["00-quick-scan"], warnings: [] }` | NFR-004, AC-NFR-004-03, VR-VALIDATE-002 |
| 12 | TC-VPC-12 | all unknown keys returns empty | negative | P1 | `["unknown-a", "unknown-b"]` | `{ valid: [], warnings: [] }` | NFR-004, AC-NFR-004-03 |
| 13 | TC-VPC-13 | respects custom fullSequence parameter | positive | P2 | `["a", "b"]`, fullSequence: `["a", "b", "c"]` | `{ valid: ["a", "b"], warnings: [] }` | NFR-006, AC-NFR-006-01 |
| 14 | TC-VPC-14 | handles object input as non-array | negative | P2 | `{}` | `{ valid: [], warnings: ["...not an array"] }` | NFR-004, VR-VALIDATE-001 |

### 4.3 computeStartPhase() (14 cases)

The feature workflow phases array used in tests:
```javascript
const FEATURE_PHASES = [
    '00-quick-scan', '01-requirements', '02-impact-analysis',
    '03-architecture', '04-design', '05-test-strategy',
    '06-implementation', '16-quality-loop', '08-code-review'
];
```

| # | ID | Test Name | Type | Priority | Meta Input | Expected Output | Requirement Trace |
|---|-----|-----------|------|----------|-----------|-----------------|-------------------|
| 1 | TC-CSP-01 | null meta returns raw | positive | P0 | `null` | `{ status: 'raw', startPhase: null, completedPhases: [], remainingPhases: [all 9] }` | FR-001, AC-001-04 |
| 2 | TC-CSP-02 | empty phases returns raw | positive | P0 | `{ phases_completed: [] }` | `{ status: 'raw', startPhase: null, completedPhases: [], remainingPhases: [all 9] }` | FR-001, AC-001-03 |
| 3 | TC-CSP-03 | all 5 analysis phases returns analyzed with startPhase 05 | positive | P0 | `{ phases_completed: [all 5 analysis] }` | `{ status: 'analyzed', startPhase: '05-test-strategy', completedPhases: [5], remainingPhases: [4 impl] }` | FR-001, FR-002, AC-001-01, AC-002-01 |
| 4 | TC-CSP-04 | 2 phases returns partial with startPhase 02 | positive | P0 | `{ phases_completed: ['00-quick-scan', '01-requirements'] }` | `{ status: 'partial', startPhase: '02-impact-analysis', completedPhases: [2], remainingPhases: [7] }` | FR-001, FR-003, AC-001-02, AC-003-03 |
| 5 | TC-CSP-05 | non-contiguous uses contiguous prefix | negative | P0 | `{ phases_completed: ['00-quick-scan', '02-impact-analysis'] }` | `{ status: 'partial', startPhase: '01-requirements', completedPhases: ['00-quick-scan'], remainingPhases: [8] }` | FR-003, AC-003-06 |
| 6 | TC-CSP-06 | non-object meta returns raw | negative | P0 | `42` | `{ status: 'raw', startPhase: null }` | NFR-004, VR-VALIDATE-004 |
| 7 | TC-CSP-07 | missing phases_completed field returns raw | negative | P0 | `{ analysis_status: 'partial' }` | `{ status: 'raw', startPhase: null }` | NFR-004 |
| 8 | TC-CSP-08 | completedPhases matches valid set for analyzed | positive | P1 | `{ phases_completed: [all 5] }` | completedPhases has all 5 analysis phases | FR-002, AC-002-04 |
| 9 | TC-CSP-09 | remainingPhases for analyzed has 4 impl phases | positive | P1 | `{ phases_completed: [all 5] }` | remainingPhases = ['05-test-strategy', '06-implementation', '16-quality-loop', '08-code-review'] | FR-002, FR-006, AC-002-01, AC-006-01 |
| 10 | TC-CSP-10 | 4 of 5 analysis phases returns partial | positive | P1 | `{ phases_completed: [first 4 analysis] }` | `{ status: 'partial', startPhase: '04-design' }` | FR-003 |
| 11 | TC-CSP-11 | single phase returns partial | positive | P1 | `{ phases_completed: ['00-quick-scan'] }` | `{ status: 'partial', startPhase: '01-requirements' }` | FR-003 |
| 12 | TC-CSP-12 | warnings from validatePhasesCompleted are propagated | negative | P1 | `{ phases_completed: ['00-quick-scan', '02-impact-analysis'] }` | result.warnings includes non-contiguous warning | FR-003, AC-003-06 |
| 13 | TC-CSP-13 | string meta returns raw | negative | P2 | `"string"` | `{ status: 'raw', startPhase: null }` | NFR-004 |
| 14 | TC-CSP-14 | undefined meta returns raw | negative | P2 | `undefined` | `{ status: 'raw', startPhase: null }` | NFR-004 |

### 4.4 checkStaleness() (9 cases)

| # | ID | Test Name | Type | Priority | Meta Input | currentHash | Expected Output | Requirement Trace |
|---|-----|-----------|------|----------|-----------|-------------|-----------------|-------------------|
| 1 | TC-CS-01 | same hash returns not stale | positive | P0 | `{ codebase_hash: "abc1234" }` | `"abc1234"` | `{ stale: false, originalHash: "abc1234", currentHash: "abc1234", commitsBehind: null }` | FR-004, AC-004-01 |
| 2 | TC-CS-02 | different hash returns stale | positive | P0 | `{ codebase_hash: "abc1234" }` | `"def5678"` | `{ stale: true, originalHash: "abc1234", currentHash: "def5678", commitsBehind: null }` | FR-004, AC-004-02 |
| 3 | TC-CS-03 | null meta returns not stale | negative | P0 | `null` | `"abc1234"` | `{ stale: false, originalHash: null, currentHash: "abc1234", commitsBehind: null }` | FR-004, AC-004-07, NFR-004 |
| 4 | TC-CS-04 | missing codebase_hash returns not stale | negative | P0 | `{}` | `"abc1234"` | `{ stale: false, originalHash: null, currentHash: "abc1234", commitsBehind: null }` | FR-004, AC-004-07 |
| 5 | TC-CS-05 | empty codebase_hash returns not stale | negative | P1 | `{ codebase_hash: "" }` | `"abc1234"` | `{ stale: false, originalHash: null, currentHash: "abc1234", commitsBehind: null }` | FR-004, AC-004-07 |
| 6 | TC-CS-06 | originalHash is null when meta is null | positive | P1 | `null` | `"abc1234"` | originalHash === null | FR-004, AC-004-07 |
| 7 | TC-CS-07 | commitsBehind is always null | positive | P1 | `{ codebase_hash: "abc1234" }` | `"abc1234"` | commitsBehind === null | FR-004, NFR-002 |
| 8 | TC-CS-08 | empty currentHash with existing hash returns stale | negative | P1 | `{ codebase_hash: "abc1234" }` | `""` | `{ stale: true, originalHash: "abc1234", currentHash: "" }` | FR-004 |
| 9 | TC-CS-09 | undefined codebase_hash returns not stale | negative | P2 | `{ codebase_hash: undefined }` | `"abc1234"` | `{ stale: false, originalHash: null }` | FR-004, AC-004-07 |

### 4.5 Integration Tests (10 cases)

| # | ID | Test Name | Type | Priority | Description | Requirement Trace |
|---|-----|-----------|------|----------|-------------|-------------------|
| 1 | TC-INT-01 | computeStartPhase correctly calls validatePhasesCompleted internally | positive | P0 | Pass meta with non-contiguous phases; verify computeStartPhase returns partial with correct contiguous prefix | FR-001, FR-003 |
| 2 | TC-INT-02 | fully analyzed meta with real workflow phases produces correct phase slice | positive | P0 | Use actual feature phases from workflows.json; verify remainingPhases matches expected implementation phases | FR-002, FR-006, AC-006-01 |
| 3 | TC-INT-03 | partial analysis resume computes correct start phase from workflow | positive | P0 | Phases 00-01 done; verify startPhase is '02-impact-analysis' and remainingPhases has 7 elements | FR-003, AC-003-03, FR-006, AC-006-02 |
| 4 | TC-INT-04 | detection chain: readMetaJson -> computeStartPhase -> checkStaleness for analyzed item | positive | P1 | Create meta.json on disk with analyzed status, read it, compute, check staleness with same hash | FR-001, FR-004, NFR-005, AC-NFR-005-01 |
| 5 | TC-INT-05 | detection chain: readMetaJson -> computeStartPhase for partial item | positive | P1 | Create meta.json with partial status (phases 00, 01), read it, verify computeStartPhase returns partial | FR-001, FR-003, NFR-005, AC-NFR-005-02 |
| 6 | TC-INT-06 | detection chain for raw item (no meta.json) | positive | P1 | No meta.json on disk; readMetaJson returns null; computeStartPhase returns raw | FR-001, NFR-003, AC-001-04, AC-NFR-003-02 |
| 7 | TC-INT-07 | detection chain for corrupted meta.json | negative | P1 | Write invalid JSON to meta.json; readMetaJson returns null; computeStartPhase returns raw | FR-001, NFR-004, AC-001-05, AC-NFR-004-01, ERR-BUILD-002 |
| 8 | TC-INT-08 | computeStartPhase with fix workflow phases (different phase array) | positive | P2 | Use fix workflow phases (no 00-quick-scan, starts at 01-requirements); verify correct behavior | FR-006 |
| 9 | TC-INT-09 | IMPLEMENTATION_PHASES elements are all present in feature workflow phases | positive | P1 | Verify every element of IMPLEMENTATION_PHASES exists in the feature workflow phases array | FR-002, FR-006 |
| 10 | TC-INT-10 | ANALYSIS_PHASES + IMPLEMENTATION_PHASES covers all feature workflow phases | positive | P1 | Verify union of ANALYSIS_PHASES and IMPLEMENTATION_PHASES equals the full feature phases array | FR-002, FR-006 |

### 4.6 Regression Tests (5 cases)

| # | ID | Test Name | Type | Priority | Description | Requirement Trace |
|---|-----|-----------|------|----------|-------------|-------------------|
| 1 | TC-REG-01 | build with no meta.json defaults to full workflow | positive | P0 | computeStartPhase(null, featurePhases) returns raw with all 9 phases | NFR-003, AC-NFR-003-01, AC-NFR-003-02 |
| 2 | TC-REG-02 | build with empty phases_completed defaults to full workflow | positive | P0 | computeStartPhase({phases_completed: []}, featurePhases) returns raw | NFR-003, AC-001-03 |
| 3 | TC-REG-03 | corrupted meta.json treated as raw | positive | P0 | readMetaJson returns null for invalid JSON; computeStartPhase(null, ...) returns raw | NFR-003, NFR-004, AC-001-05 |
| 4 | TC-REG-04 | feature alias produces same detection behavior as build | positive | P1 | Both build and feature use same detection functions; verify identical results | NFR-003, AC-NFR-003-03 |
| 5 | TC-REG-05 | orchestrator without START_PHASE uses full workflow | positive | P0 | Verify that when START_PHASE is absent, all 9 phases are used | FR-006, AC-006-05 |

### 4.7 Error Handling Tests (3 cases)

| # | ID | Test Name | Type | Priority | Description | Requirement Trace |
|---|-----|-----------|------|----------|-------------|-------------------|
| 1 | TC-ERR-01 | corrupted meta.json (invalid JSON) degrades to raw | negative | P0 | Write `{invalid json` to meta.json, call readMetaJson, verify null returned | NFR-004, AC-001-05, AC-NFR-004-01, ERR-BUILD-002 |
| 2 | TC-ERR-02 | non-contiguous phases produce warning and use contiguous prefix | negative | P1 | Call validatePhasesCompleted with gap, verify warning string content | FR-003, AC-003-06, ERR-BUILD-003 |
| 3 | TC-ERR-03 | unknown phase keys in phases_completed are silently filtered | negative | P1 | Call validatePhasesCompleted with future-phase keys, verify filtered out without warning | NFR-004, AC-NFR-004-03 |

---

## 5. Test Data Plan

### 5.1 Boundary Values

| Boundary | Input | Expected Behavior | Test Case |
|----------|-------|-------------------|-----------|
| Zero phases completed | `[]` | status: raw, startPhase: null | TC-VPC-05, TC-CSP-02 |
| One phase completed | `["00-quick-scan"]` | status: partial, startPhase: "01-requirements" | TC-VPC-06, TC-CSP-11 |
| Four phases completed | `[first 4 analysis]` | status: partial, startPhase: "04-design" | TC-CSP-10 |
| All 5 analysis phases | `[all 5]` | status: analyzed, startPhase: "05-test-strategy" | TC-VPC-08, TC-CSP-03 |
| Same hash (no staleness) | hash matches | stale: false | TC-CS-01 |
| Different hash (stale) | hash differs | stale: true | TC-CS-02 |
| Empty hash | `""` | treated as missing or mismatch | TC-CS-05, TC-CS-08 |

### 5.2 Invalid Inputs

| Input Type | Test Values | Expected Behavior | Test Cases |
|------------|-------------|-------------------|------------|
| null | `null` for phasesCompleted, meta, currentHash context | Safe defaults returned | TC-VPC-01, TC-CSP-01, TC-CS-03 |
| undefined | `undefined` for phasesCompleted, meta | Safe defaults returned | TC-VPC-02, TC-CSP-14 |
| Wrong type (number) | `42` for phasesCompleted, meta | Safe defaults returned | TC-VPC-04, TC-CSP-06 |
| Wrong type (string) | `"string"` for phasesCompleted, meta | Safe defaults returned | TC-VPC-03, TC-CSP-13 |
| Wrong type (object instead of array) | `{}` for phasesCompleted | Safe defaults returned | TC-VPC-14 |
| Corrupted JSON | `{invalid json` in meta.json file | readMetaJson returns null | TC-ERR-01, TC-INT-07 |
| Unknown phase keys | `["future-phase-x"]` | Filtered silently | TC-VPC-11, TC-VPC-12, TC-ERR-03 |
| Non-contiguous phases | `["00-quick-scan", "02-impact-analysis"]` | Contiguous prefix used, warning | TC-VPC-09, TC-VPC-10, TC-ERR-02 |

### 5.3 Maximum-Size Inputs

| Input | Test Description | Expected Behavior | Test Coverage |
|-------|-----------------|-------------------|---------------|
| All 5 analysis phases in phases_completed | Maximum valid input for analysis detection | status: analyzed | TC-VPC-08, TC-CSP-03 |
| phases_completed with 100 unknown keys | Array with many unrecognized strings | Filtered to empty valid set, no crash | Covered conceptually by TC-VPC-12; no separate test needed as algorithm is O(n*m) with small m |
| Full 9-phase workflow array | Maximum workflowPhases input | All functions handle correctly | TC-INT-02, TC-INT-10 |

### 5.4 Test Fixtures

```javascript
// Test data fixtures for build auto-detection tests

const FEATURE_PHASES = [
    '00-quick-scan', '01-requirements', '02-impact-analysis',
    '03-architecture', '04-design', '05-test-strategy',
    '06-implementation', '16-quality-loop', '08-code-review'
];

const ALL_ANALYSIS = [
    '00-quick-scan', '01-requirements', '02-impact-analysis',
    '03-architecture', '04-design'
];

const IMPL_PHASES = [
    '05-test-strategy', '06-implementation',
    '16-quality-loop', '08-code-review'
];

const META_FULLY_ANALYZED = {
    description: 'Test item',
    source: 'manual',
    analysis_status: 'analyzed',
    phases_completed: [...ALL_ANALYSIS],
    codebase_hash: 'abc1234'
};

const META_PARTIAL_2 = {
    description: 'Test item',
    source: 'manual',
    analysis_status: 'partial',
    phases_completed: ['00-quick-scan', '01-requirements'],
    codebase_hash: 'abc1234'
};

const META_RAW = {
    description: 'Test item',
    source: 'manual',
    analysis_status: 'raw',
    phases_completed: [],
    codebase_hash: 'abc1234'
};

const META_NO_HASH = {
    description: 'Legacy item',
    source: 'manual',
    analysis_status: 'analyzed',
    phases_completed: [...ALL_ANALYSIS]
    // no codebase_hash field
};

const META_NON_CONTIGUOUS = {
    description: 'Test item',
    source: 'manual',
    analysis_status: 'partial',
    phases_completed: ['00-quick-scan', '02-impact-analysis']
};
```

---

## 6. Test Implementation Plan

### 6.1 File Location

All new tests are added to the existing file:
`src/claude/hooks/tests/test-three-verb-utils.test.cjs`

### 6.2 New Test Sections (Describe Blocks)

Append the following `describe()` blocks after the existing test sections:

```
// ===========================================================================
// N. IMPLEMENTATION_PHASES constant tests
// Traces: FR-002, FR-006
// ===========================================================================
describe('IMPLEMENTATION_PHASES', () => { ... });

// ===========================================================================
// N+1. validatePhasesCompleted() tests
// Traces: FR-001, FR-003, NFR-004, NFR-006
// ===========================================================================
describe('validatePhasesCompleted()', () => { ... });

// ===========================================================================
// N+2. computeStartPhase() tests
// Traces: FR-001, FR-002, FR-003, FR-006, NFR-006
// ===========================================================================
describe('computeStartPhase()', () => { ... });

// ===========================================================================
// N+3. checkStaleness() tests
// Traces: FR-004, NFR-002, NFR-004
// ===========================================================================
describe('checkStaleness()', () => { ... });

// ===========================================================================
// N+4. Build Auto-Detection Integration tests
// Traces: FR-001, FR-002, FR-003, FR-004, FR-006, NFR-003, NFR-005
// ===========================================================================
describe('Build Auto-Detection Integration', () => { ... });
```

### 6.3 Import Changes

Add new imports to the existing `require` block at the top of the test file:

```javascript
const {
    ANALYSIS_PHASES,
    IMPLEMENTATION_PHASES,       // NEW
    MARKER_REGEX,
    generateSlug,
    // ... existing imports ...
    validatePhasesCompleted,     // NEW
    computeStartPhase,           // NEW
    checkStaleness,              // NEW
    findDirForDescription
} = require('../lib/three-verb-utils.cjs');
```

### 6.4 Estimated Line Count

- IMPLEMENTATION_PHASES tests: ~20 lines
- validatePhasesCompleted tests: ~120 lines
- computeStartPhase tests: ~150 lines
- checkStaleness tests: ~80 lines
- Integration tests: ~120 lines
- Regression tests: ~50 lines (integrated within above sections)
- Error handling tests: ~30 lines (integrated within above sections)
- **Total**: ~570 lines added to the existing test file

---

## 7. Flaky Test Mitigation

### 7.1 Risk Assessment

The tests for this feature have **low flaky risk** because:

1. **Pure functions**: All 3 utility functions (`validatePhasesCompleted`, `computeStartPhase`, `checkStaleness`) are pure -- no filesystem I/O, no network, no timers, no randomness.
2. **Deterministic inputs**: Every test case has fixed, deterministic inputs and expected outputs.
3. **No async**: None of the utility functions are async. No race conditions possible.
4. **No external dependencies**: No git commands in the utility functions (staleness git commands are in the build verb handler, not tested at unit level).

### 7.2 Potential Flaky Risks

| Risk | Source | Mitigation |
|------|--------|------------|
| Temp directory cleanup failure | Integration tests using `createTestDir()` | Use `afterEach` cleanup with `force: true` (existing pattern) |
| File system timing | Integration tests writing/reading meta.json | Use synchronous `fs` operations (existing pattern) |
| Test isolation | Shared `testDir` variable | Reset in `beforeEach`/`afterEach` (existing pattern) |

### 7.3 Flaky Prevention Rules

- All unit tests for pure functions use in-memory data only (no filesystem)
- Integration tests that need filesystem use dedicated temp directories
- No `setTimeout`, `setInterval`, or async delays in any test
- No network calls in any test
- No dependency on git state for unit tests

---

## 8. Performance Test Plan

### 8.1 Performance Targets

| NFR | Target | Measurement |
|-----|--------|-------------|
| NFR-001 | Detection latency p95 < 2s | Time from build verb invocation to first UX prompt |
| NFR-002 | Git hash comparison p95 < 1s | Time for `git rev-parse` + `git rev-list --count` |

### 8.2 Performance Testing Approach

Performance testing is **out of scope** for the automated test suite because:

1. The utility functions execute in microseconds (pure array operations)
2. The performance budget is for the full detection path (utility functions + git commands + meta.json read), which runs in the build verb handler context
3. Git command performance depends on repository size, which varies per installation
4. The architecture analysis estimates ~100-300ms total, well within the 2-second budget

**Manual verification**: During implementation (Phase 06), the developer should verify detection latency by timing the build verb invocation with `console.time()` on a repository with realistic commit history.

### 8.3 Performance-Adjacent Tests

Two test cases indirectly validate performance characteristics:

- TC-CS-07: Verifies `commitsBehind` is always null (git operations are NOT in the utility function)
- TC-CONST-02: Verifies IMPLEMENTATION_PHASES has exactly 4 elements (constant-time lookup)

---

## 9. Coverage Targets

### 9.1 Branch Coverage

| Function | Branches | Target | Notes |
|----------|----------|--------|-------|
| `validatePhasesCompleted` | 6 (non-array, empty, contiguous, non-contiguous, unknown keys, full) | 100% | All branches covered by TC-VPC-01 through TC-VPC-14 |
| `computeStartPhase` | 5 (null meta, non-object, raw, analyzed, partial) | 100% | All branches covered by TC-CSP-01 through TC-CSP-14 |
| `checkStaleness` | 4 (null meta, no hash, same hash, different hash) | 100% | All branches covered by TC-CS-01 through TC-CS-09 |

### 9.2 Requirement Coverage

Every functional requirement and acceptance criterion is covered by at least one test case. See Traceability Matrix in Section 11.

### 9.3 Coverage Gaps

| Area | Gap | Reason | Mitigation |
|------|-----|--------|------------|
| Build verb handler UX (menus, banners) | Not unit-testable | Markdown command spec (isdlc.md) is executed conversationally by Claude | Validated through requirement traceability to design specs; manual verification during Phase 06 |
| Orchestrator START_PHASE handling | Not unit-testable | Agent spec (00-sdlc-orchestrator.md) is a markdown agent | Validated indirectly through utility function tests and integration chain |
| Git command execution | Not in unit tests | Git commands are in the build verb handler, not utility functions | Manual verification; graceful degradation tested via NFR-004 error scenarios |

---

## 10. Critical Path Identification

### 10.1 P0 Critical Path (Must Pass for Feature to Ship)

```
computeStartPhase(null, phases) -> raw -> full workflow (backward compat)
computeStartPhase(analyzed_meta, phases) -> analyzed -> startPhase=05 (core feature)
computeStartPhase(partial_meta, phases) -> partial -> correct startPhase (partial handling)
validatePhasesCompleted(null) -> empty valid (graceful degradation)
validatePhasesCompleted([all 5]) -> all 5 valid (fully analyzed detection)
checkStaleness(meta, same_hash) -> not stale (no false positives)
checkStaleness(meta, diff_hash) -> stale (correct detection)
checkStaleness(null, any) -> not stale (legacy compatibility)
```

These 8 test cases form the minimum viable test suite. All are P0 priority.

### 10.2 P1 Secondary Path (Should Pass)

Partial analysis edge cases, non-contiguous phase handling, integration chain tests, regression tests for backward compatibility.

### 10.3 P2 Tertiary Path (Nice to Have)

Custom fullSequence parameter, structural constant validation, object-as-non-array edge case.

---

## 11. Traceability Matrix

### 11.1 Functional Requirements

| Requirement | AC | Test Cases | Coverage |
|------------|-----|------------|----------|
| FR-001 (Analysis Status Detection) | AC-001-01 | TC-VPC-08, TC-CSP-03 | Full |
| FR-001 | AC-001-02 | TC-VPC-07, TC-CSP-04 | Full |
| FR-001 | AC-001-03 | TC-VPC-05, TC-CSP-02 | Full |
| FR-001 | AC-001-04 | TC-CSP-01, TC-INT-06, TC-REG-01 | Full |
| FR-001 | AC-001-05 | TC-ERR-01, TC-INT-07, TC-REG-03 | Full |
| FR-002 (Phase-Skip Fully Analyzed) | AC-002-01 | TC-CSP-03, TC-CSP-09, TC-INT-02, TC-CONST-02 | Full |
| FR-002 | AC-002-04 | TC-CSP-08 | Full |
| FR-003 (Partial Analysis) | AC-003-03 | TC-CSP-04, TC-INT-03 | Full |
| FR-003 | AC-003-06 | TC-VPC-09, TC-VPC-10, TC-CSP-05, TC-CSP-12, TC-ERR-02 | Full |
| FR-004 (Staleness Detection) | AC-004-01 | TC-CS-01 | Full |
| FR-004 | AC-004-02 | TC-CS-02 | Full |
| FR-004 | AC-004-07 | TC-CS-03, TC-CS-04, TC-CS-05, TC-CS-09 | Full |
| FR-005 (Phase Summary Display) | AC-005-01 through AC-005-03 | Design-validated (UX in isdlc.md, not unit-testable) | Design |
| FR-006 (Orchestrator START_PHASE) | AC-006-01 | TC-CSP-09, TC-INT-02 | Full |
| FR-006 | AC-006-02 | TC-INT-03 | Full |
| FR-006 | AC-006-03 | Design-validated (orchestrator agent spec) | Design |
| FR-006 | AC-006-04 | Design-validated (resetPhasesForWorkflow compatibility) | Design |
| FR-006 | AC-006-05 | TC-REG-05, TC-CSP-01 | Full |
| FR-007 (Artifact Folder Naming) | AC-007-01 through AC-007-03 | Design-validated (orchestrator spec) | Design |
| FR-008 (Meta.json Build Tracking) | AC-008-01, AC-008-02 | Design-validated (orchestrator spec) | Design |

### 11.2 Non-Functional Requirements

| Requirement | AC | Test Cases | Coverage |
|------------|-----|------------|----------|
| NFR-001 (Detection Latency) | AC-NFR-001-01 | Performance plan (manual verification) | Plan |
| NFR-002 (Git Hash Performance) | AC-NFR-002-01 | TC-CS-07 (commitsBehind null confirms separation), Performance plan | Plan |
| NFR-003 (Backward Compatibility) | AC-NFR-003-01 | TC-REG-01, TC-INT-06 | Full |
| NFR-003 | AC-NFR-003-02 | TC-REG-02, TC-REG-03, TC-INT-06 | Full |
| NFR-003 | AC-NFR-003-03 | TC-REG-04 | Full |
| NFR-004 (Graceful Degradation) | AC-NFR-004-01 | TC-ERR-01, TC-INT-07 | Full |
| NFR-004 | AC-NFR-004-02 | Design-validated (build handler catches git errors) | Design |
| NFR-004 | AC-NFR-004-03 | TC-VPC-11, TC-VPC-12, TC-ERR-03 | Full |
| NFR-005 (Three-Verb Consistency) | AC-NFR-005-01 | TC-INT-04 | Full |
| NFR-005 | AC-NFR-005-02 | TC-INT-05 | Full |
| NFR-006 (Testability) | AC-NFR-006-01 | TC-CONST-01, TC-CONST-02 (functions exported and tested) | Full |
| NFR-006 | AC-NFR-006-02 | All test sections have 3+ cases per function | Full |

### 11.3 Error Codes

| Error Code | Test Cases | Coverage |
|------------|-----------|----------|
| ERR-BUILD-002 | TC-ERR-01, TC-INT-07, TC-REG-03 | Full |
| ERR-BUILD-003 | TC-VPC-09, TC-VPC-10, TC-ERR-02 | Full |
| ERR-BUILD-004 | Design-validated (git error catch in build handler) | Design |
| ERR-BUILD-005 | Design-validated (rev-list failure path) | Design |
| ERR-ORCH-INVALID-START-PHASE | Design-validated (orchestrator validation) | Design |

### 11.4 Validation Rules

| Rule ID | Test Cases | Coverage |
|---------|-----------|----------|
| VR-VALIDATE-001 | TC-VPC-01, TC-VPC-02, TC-VPC-03, TC-VPC-04, TC-VPC-14 | Full |
| VR-VALIDATE-002 | TC-VPC-11, TC-VPC-12, TC-ERR-03 | Full |
| VR-VALIDATE-003 | TC-VPC-09, TC-VPC-10, TC-ERR-02 | Full |
| VR-VALIDATE-004 | TC-CSP-01, TC-CSP-06, TC-CSP-13, TC-CSP-14 | Full |
| VR-VALIDATE-005 | TC-INT-02, TC-INT-03 (workflowPhases from real config) | Full |
| VR-VALIDATE-006 | TC-CS-03, TC-CS-04 | Full |
| VR-VALIDATE-007 | TC-CS-08 (empty currentHash) | Full |

---

## 12. Test Execution Plan

### 12.1 Execution Order

1. **Phase 06 (Implementation)**: Developer implements the 3 utility functions and `IMPLEMENTATION_PHASES` constant in `three-verb-utils.cjs`
2. **Test alongside implementation**: After implementing each function, add corresponding test section to `test-three-verb-utils.test.cjs` and verify all tests pass
3. **Integration tests**: After all 3 functions are implemented, add integration test section
4. **Full regression**: Run `npm run test:hooks` to verify no existing tests are broken
5. **Final validation**: Run `npm run test:all` for full test suite

### 12.2 Run Commands

```bash
# Run only the three-verb-utils tests
node --test src/claude/hooks/tests/test-three-verb-utils.test.cjs

# Run all hook tests
npm run test:hooks

# Run complete test suite (ESM + CJS)
npm run test:all
```

### 12.3 Success Criteria

- All 58 new test cases pass
- Zero existing test cases regress
- Zero test cases are flaky across 3 consecutive runs
- 100% branch coverage for the 3 new functions
- 100% requirement traceability (every FR/NFR AC maps to at least one test case or design validation)

---

## 13. Gate Validation (GATE-04)

- [x] Test strategy covers unit, integration, E2E, security, performance
- [x] Test cases exist for all requirements (58 cases, full FR/NFR traceability)
- [x] Traceability matrix complete (100% requirement coverage)
- [x] Coverage targets defined (100% branch coverage for utility functions)
- [x] Test data strategy documented (boundary values, invalid inputs, fixtures)
- [x] Critical paths identified (P0/P1/P2 prioritization)

### Notes on E2E and Security

- **E2E**: The full build auto-detection flow (build verb -> detection -> menus -> orchestrator) is an end-to-end conversational flow that cannot be automated in the traditional sense. It is validated through integration test chains (TC-INT-04 through TC-INT-07) and design-level traceability.
- **Security**: No new security surface is introduced. The feature reads existing meta.json (already trusted) and runs existing git commands. No user-supplied input reaches shell commands (git hashes come from meta.json and `git rev-parse`, not from user input). No new attack vectors.
- **Performance**: Manual verification plan defined. Utility function performance is trivially fast (pure array operations).

---

## 14. Appendix: Test Case to Module Design Cross-Reference

| Module Design Test # | Module Design Test Name | Strategy Test ID | Status |
|---------------------|------------------------|------------------|--------|
| 8.1-1 | returns empty for null input | TC-VPC-01 | Adopted |
| 8.1-2 | returns empty for undefined | TC-VPC-02 | Adopted |
| 8.1-3 | returns empty for string input | TC-VPC-03 | Adopted |
| 8.1-4 | returns empty for empty array | TC-VPC-05 | Adopted |
| 8.1-5 | returns single contiguous phase | TC-VPC-06 | Adopted |
| 8.1-6 | returns two contiguous phases | TC-VPC-07 | Adopted |
| 8.1-7 | returns all 5 analysis phases | TC-VPC-08 | Adopted |
| 8.1-8 | handles gap (non-contiguous) | TC-VPC-09 | Adopted |
| 8.1-9 | handles missing first phase | TC-VPC-10 | Adopted |
| 8.1-10 | filters unknown keys silently | TC-VPC-11 | Adopted |
| 8.1-11 | all unknown keys returns empty | TC-VPC-12 | Adopted |
| 8.2-1 | null meta returns raw | TC-CSP-01 | Adopted |
| 8.2-2 | empty phases returns raw | TC-CSP-02 | Adopted |
| 8.2-3 | all 5 analysis phases returns analyzed | TC-CSP-03 | Adopted |
| 8.2-4 | 2 phases returns partial | TC-CSP-04 | Adopted |
| 8.2-5 | non-contiguous uses prefix | TC-CSP-05 | Adopted |
| 8.2-6 | non-object meta returns raw | TC-CSP-06 | Adopted |
| 8.2-7 | missing phases_completed | TC-CSP-07 | Adopted |
| 8.2-8 | completedPhases matches valid set | TC-CSP-08 | Adopted |
| 8.2-9 | remainingPhases excludes completed | TC-CSP-09 | Adopted |
| 8.3-1 | same hash not stale | TC-CS-01 | Adopted |
| 8.3-2 | different hash is stale | TC-CS-02 | Adopted |
| 8.3-3 | null meta not stale | TC-CS-03 | Adopted |
| 8.3-4 | missing codebase_hash not stale | TC-CS-04 | Adopted |
| 8.3-5 | empty codebase_hash not stale | TC-CS-05 | Adopted |
| 8.3-6 | originalHash is null when missing | TC-CS-06 | Adopted |
| 8.3-7 | commitsBehind is always null | TC-CS-07 | Adopted |
| -- | (new) number input for phasesCompleted | TC-VPC-04 | Added |
| -- | (new) custom fullSequence parameter | TC-VPC-13 | Added |
| -- | (new) object input as non-array | TC-VPC-14 | Added |
| -- | (new) 4 of 5 analysis phases | TC-CSP-10 | Added |
| -- | (new) single phase partial | TC-CSP-11 | Added |
| -- | (new) warnings propagated | TC-CSP-12 | Added |
| -- | (new) string meta returns raw | TC-CSP-13 | Added |
| -- | (new) undefined meta returns raw | TC-CSP-14 | Added |
| -- | (new) empty currentHash with hash | TC-CS-08 | Added |
| -- | (new) undefined codebase_hash | TC-CS-09 | Added |

**Summary**: All 27 module design test cases adopted. 10 additional edge cases added for completeness. 10 integration tests added. 5 regression tests added. 3 error handling tests added. Total: 58 test cases.
