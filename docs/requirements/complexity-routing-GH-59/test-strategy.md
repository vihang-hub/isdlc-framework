# Test Strategy: Complexity-Based Routing (GH-59)

**Phase**: 05-test-strategy
**Generated**: 2026-02-20
**Based On**: requirements-spec.md (9 FRs, 5 NFRs, 33 ACs), design.md (52 unit test cases), architecture.md (Section 16: Test Architecture)
**Traces**: FR-001..FR-009, NFR-001..NFR-005, CON-001..CON-005, AD-01..AD-07

---

## 1. Existing Infrastructure (from Discovery)

- **Framework**: Node.js built-in `node:test` + `node:assert/strict` (Node 18+)
- **Hook test pattern**: CJS files at `src/claude/hooks/tests/*.test.cjs`
- **Run command**: `node --test src/claude/hooks/tests/test-three-verb-utils.test.cjs`
- **Test baseline**: 555 tests (302 ESM lib + 253 CJS hooks) per Article II
- **Existing patterns**: `test-three-verb-utils.test.cjs` (2575 lines, ~120 test cases) -- all new tests extend this file
- **Coverage tool**: None formal (manual counts via `node --test`)
- **Existing helpers**: `createTestDir()`, `cleanupTestDir()`, `createSlugDir()`, `writeBacklog()` in the test file itself

## 2. Strategy Overview

### 2.1 Approach: Extend Existing Test Suite

This strategy extends the existing `test-three-verb-utils.test.cjs` file with new `describe()` blocks for the GH-59 functions. It does NOT create a new test file or introduce new test utilities.

**Rationale**: The new functions (`computeRecommendedTier`, `getTierDescription`, constants) are exported from `three-verb-utils.cjs` and logically belong with the existing tests for that module.

### 2.2 Test Types

| Type | Scope | Count | Automated? |
|------|-------|-------|------------|
| **Unit tests** | `computeRecommendedTier()`, `getTierDescription()`, constants | 65 | Yes |
| **Integration tests** | meta.json tier field persistence, backward compatibility | 10 | Yes |
| **Manual/behavioral tests** | isdlc.md handler flows (analyze step 8, build tier menu, trivial path, NFRs) | 20 | No (agent-in-the-loop) |
| **Total** | | **86** | 66 auto + 20 manual |

### 2.3 Coverage Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| AC coverage | 100% (33/33 ACs) | Article VII: every requirement must trace to a test |
| Unit test coverage | >=80% of new code | Article II threshold |
| `computeRecommendedTier()` branch coverage | 100% | Critical path: determines workflow routing |
| `getTierDescription()` branch coverage | 100% | All input categories exercised |
| Integration: meta.json round-trip | All 4 new fields tested | Data persistence correctness |
| Backward compatibility | Legacy meta.json reads without error | NFR-002 |
| Regression | Total test count must not decrease below 555 baseline | Article II |

## 3. Unit Test Strategy

### 3.1 computeRecommendedTier() -- 41 Test Cases

Validated from design.md Section 4.1 and extended with additional boundary cases.

**Test groups**:

| Group | AC Traced | Count | Focus |
|-------|-----------|-------|-------|
| Base thresholds | AC-002a | 11 | Boundary values at 0, 2/3, 8/9, 20/21, 100 |
| Risk-based promotion | AC-002b | 11 | Medium/high promotion, ceiling behavior, no-promotion for low/null/undefined |
| Invalid input handling | AC-002c | 7 | null, undefined, NaN, negative, string, Infinity |
| Unrecognized riskLevel | AC-002d | 4 | Unknown strings, case sensitivity, empty string |
| Custom thresholds | CON-002 | 8 | Custom values, partial objects, null/undefined fallback |

**Boundary analysis**:
- Trivial/light boundary: `estimatedFiles` = 2 (trivial), 3 (light) -- both tested
- Light/standard boundary: `estimatedFiles` = 8 (light), 9 (standard) -- both tested
- Standard/epic boundary: `estimatedFiles` = 20 (standard), 21 (epic) -- both tested
- Zero files: explicitly tested (maps to trivial)
- Risk promotion ceiling: epic + high -> epic (no overflow)

**Stderr validation**: Tests for AC-002c and AC-002d capture `process.stderr.write` output to verify warning messages are emitted. Pattern: intercept stderr in `beforeEach`, restore in `afterEach`.

### 3.2 getTierDescription() -- 12 Test Cases

Validated from design.md Section 4.2 and extended with additional type-safety tests.

| Group | AC Traced | Count | Focus |
|-------|-----------|-------|-------|
| Valid tiers | AC-009a | 4 | trivial, light, standard, epic return correct objects |
| Invalid tiers | AC-009b | 5 | Unknown string, null, undefined, empty string, number |
| Mutation safety | AD-01 | 1 | Returned objects are independent copies |
| Type guard | AC-009b | 2 | Boolean, array inputs return Unknown |

### 3.3 Constants -- 3 Test Cases

| Test | Expected | Traces |
|------|----------|--------|
| TIER_ORDER has exactly 4 elements in order | `['trivial', 'light', 'standard', 'epic']` | FR-002, AD-01 |
| DEFAULT_TIER_THRESHOLDS has correct values | `{trivial_max_files: 2, light_max_files: 8, standard_max_files: 20}` | CON-002 |
| TIER_DESCRIPTIONS keys match TIER_ORDER | All 4 tiers present | FR-009, AD-01 |

### 3.4 Stderr Capture Pattern

Tests that verify warning output (AC-002c, AC-002d) use this pattern:

```javascript
let stderrOutput = '';
const originalWrite = process.stderr.write;

beforeEach(() => {
    stderrOutput = '';
    process.stderr.write = (msg) => { stderrOutput += msg; };
});

afterEach(() => {
    process.stderr.write = originalWrite;
});
```

This follows the existing pattern in the hook test infrastructure and avoids external dependencies.

## 4. Integration Test Strategy

### 4.1 meta.json Tier Field Persistence -- 7 Test Cases

These tests use `createSlugDir()` + `readMetaJson()` + `writeMetaJson()` to verify round-trip persistence of tier fields.

| Test | Fields Tested | Traces |
|------|--------------|--------|
| Write and read `recommended_tier` | `recommended_tier: "light"` | AC-003a |
| Write and read `tier_used` | `tier_used: "trivial"` | AC-007c |
| Write and read `tier_override` object | `tier_override: { recommended, selected, overridden_at }` | AC-005e |
| Write and read `last_trivial_change` object | `last_trivial_change: { completed_at, commit_sha, files_modified }` | AC-007c |
| Overwrite `recommended_tier` on re-analysis | Write "light", then write "standard", verify "standard" | AC-003c |
| Read legacy meta.json without tier fields | No `recommended_tier`, no error | AC-003b, AC-NFR-002a |
| Read legacy meta.json without `tier_override` or `tier_used` | Missing fields are `undefined` | AC-NFR-002b |

### 4.2 Backward Compatibility -- 3 Test Cases

| Test | Scenario | Traces |
|------|----------|--------|
| `computeStartPhase()` unchanged with no tier fields | Legacy meta.json -> same result as before | AC-NFR-002c |
| `computeStartPhase()` unchanged with tier fields present | meta.json with `recommended_tier` -> no interference | AC-NFR-002c |
| No new required fields in meta.json | `writeMetaJson()` with empty meta -> no tier fields injected | NFR-002 |

## 5. Manual/Behavioral Test Strategy

### 5.1 Analyze Handler Tests

These require running the actual isdlc analyze flow and inspecting output.

| ID | Scenario | Steps | Expected | Traces |
|----|----------|-------|----------|--------|
| MT-01 | Tier displayed after analysis | Run analyze through all phases | "Recommended tier: {tier} -- {desc}" on step 8 | AC-004a |
| MT-02 | Tier omitted for legacy meta | Create legacy meta.json, run step 8 | No tier line, no error | AC-004b |
| MT-03 | Tier preserved through phases | Start at Phase 02, stop, resume through Phase 04, check step 8 | Tier from Phase 02 displayed | AC-004c |

### 5.2 Build Handler Tests

| ID | Scenario | Steps | Expected | Traces |
|----|----------|-------|----------|--------|
| MT-04 | Tier menu display | Build with recommended_tier in meta.json | Menu with RECOMMENDED marker | AC-005a |
| MT-05 | Default selection (Enter) | Press Enter at menu | Recommended tier used | AC-005b |
| MT-06 | No recommendation warning | Build without recommended_tier | "No tier recommendation" warning, default to standard | AC-005c |
| MT-07 | Trivial selection routes to trivial path | Select [1] Trivial | Trivial execution runs | AC-005d |
| MT-08 | Override recording | Select different tier than recommended | meta.json has tier_override | AC-005e, AC-008a-c |
| MT-09 | Trivial happy path | Select trivial, edit, confirm | Commit, change-record.md, meta.json updated | AC-006a-d, AC-007a,c |
| MT-10 | Trivial state isolation | Capture state.json before/after | Byte-identical | AC-NFR-005a-c |
| MT-11 | --trivial flag | Use --trivial flag | Confirmation prompt shown | AC-NFR-001b |
| MT-12 | Epic placeholder | Select [4] Epic | "Epic decomposition not available" message, standard workflow | CON-003 |

### 5.3 User Agency Tests

| ID | Scenario | Traces |
|----|----------|--------|
| MT-04 | Menu always shown (no auto-execute) | AC-NFR-001a |
| MT-11 | --trivial flag shows confirmation | AC-NFR-001b |
| MT-08 | Override audit trail recorded | AC-NFR-001c |

## 6. Test Data Requirements

### 6.1 Unit Test Data

All unit test data is inline in the test cases (no external fixtures needed). The functions are pure -- they take primitive arguments and return primitive results.

**Key data values**:
- File counts: 0, 1, 2, 3, 5, 8, 9, 15, 20, 21, 100
- Risk levels: null, undefined, "low", "medium", "high", "critical", "MEDIUM", "", "extreme"
- Thresholds: default, custom `{3, 10, 25}`, null, undefined, partial `{trivial_max_files: 1}`

### 6.2 Integration Test Data

**meta.json templates**:

```javascript
// Legacy meta.json (no tier fields)
const legacyMeta = {
    source: 'manual',
    slug: 'test-item',
    created_at: '2026-01-01T00:00:00Z',
    analysis_status: 'partial',
    phases_completed: ['00-quick-scan']
};

// Meta with all tier fields
const fullTierMeta = {
    ...legacyMeta,
    recommended_tier: 'light',
    tier_used: 'trivial',
    tier_override: {
        recommended: 'light',
        selected: 'trivial',
        overridden_at: '2026-02-20T10:00:00Z'
    },
    last_trivial_change: {
        completed_at: '2026-02-20T10:20:00Z',
        commit_sha: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        files_modified: ['src/foo.js']
    }
};
```

### 6.3 Custom Threshold Data

```javascript
const CUSTOM_THRESHOLDS = { trivial_max_files: 3, light_max_files: 10, standard_max_files: 25 };
const PARTIAL_THRESHOLDS = { trivial_max_files: 1 }; // missing fields use defaults
```

## 7. Risk Assessment and Critical Paths

### 7.1 Critical Paths (100% coverage required)

| Path | Why Critical | Test Coverage |
|------|-------------|---------------|
| `computeRecommendedTier()` all branches | Determines entire workflow routing | 41 unit tests cover all branches |
| Invalid input -> safe default | Bad data must not crash or produce wrong tier | 7 tests for AC-002c |
| Risk promotion logic | Wrong promotion could route small changes to heavy workflows | 11 tests for AC-002b |
| Backward compatibility | Must not break existing workflows | 3 integration tests for NFR-002 |

### 7.2 Moderate Risk Paths

| Path | Risk | Mitigation |
|------|------|------------|
| Custom threshold partial objects | Nullish coalescing may surprise with `0` | Test with 0-value thresholds (edge case added) |
| Tier description mutation | Caller mutating returned object corrupts lookup | Mutation safety test |
| meta.json re-analysis overwrite | Old tier lingering after re-analysis | Overwrite test (AC-003c) |

## 8. Test Commands

All tests run via:

```bash
node --test src/claude/hooks/tests/test-three-verb-utils.test.cjs
```

Or as part of the full hook test suite:

```bash
npm run test:hooks
```

## 9. Test File Changes

| File | Change | New Lines |
|------|--------|-----------|
| `src/claude/hooks/tests/test-three-verb-utils.test.cjs` | Add 6 new `describe()` blocks at end of file | ~350 |

New `describe()` blocks to add:
1. `computeRecommendedTier() -- base thresholds (AC-002a)` -- 11 tests
2. `computeRecommendedTier() -- risk-based promotion (AC-002b)` -- 11 tests
3. `computeRecommendedTier() -- invalid input handling (AC-002c)` -- 7 tests
4. `computeRecommendedTier() -- unrecognized riskLevel (AC-002d)` -- 4 tests
5. `computeRecommendedTier() -- custom thresholds (CON-002)` -- 8 tests
6. `getTierDescription()` -- 12 tests
7. `TIER_ORDER and TIER_DESCRIPTIONS constants` -- 3 tests
8. `meta.json tier field persistence (GH-59)` -- 7 tests
9. `Backward compatibility with tier fields (GH-59)` -- 3 tests

**Import additions** (top of test file):

```javascript
const {
    // existing imports...
    TIER_ORDER,
    DEFAULT_TIER_THRESHOLDS,
    TIER_DESCRIPTIONS,
    computeRecommendedTier,
    getTierDescription
} = require('../lib/three-verb-utils.cjs');
```

## 10. Phase Gate Alignment

| GATE-04 Criterion | Status | Evidence |
|-------------------|--------|----------|
| Test strategy covers unit, integration, E2E, security, performance | PASS | Unit (65), Integration (10), Manual/E2E (12); no security/performance needed for pure functions |
| Test cases exist for all requirements | PASS | 87 test cases covering all 33 ACs |
| Traceability matrix complete (100% coverage) | PASS | See traceability-matrix.csv |
| Coverage targets defined | PASS | >=80% unit, 100% critical paths |
| Test data strategy documented | PASS | Section 6 |
| Critical paths identified | PASS | Section 7 |

---

*Test strategy completed for Phase 05 -- test-strategy.*
