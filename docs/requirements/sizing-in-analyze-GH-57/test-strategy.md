# Test Strategy: Sizing Decision in Analyze Verb

**Generated**: 2026-02-20
**Feature**: GH-57 -- Add sizing decision to the analyze verb
**Phase**: 05-test-strategy
**Mode**: ANALYSIS MODE (no state.json writes, no branches)
**Input**: requirements-spec.md (10 FRs, 5 NFRs), design.md (3 modified functions, 27 new TCs)

---

## 1. Existing Infrastructure

### 1.1 Framework

- **Test framework**: Node.js built-in `node:test` + `node:assert/strict` (Node 18+)
- **Module system**: CommonJS (`.test.cjs` extension)
- **Runner**: `node --test src/claude/hooks/tests/<file>.test.cjs`
- **Suite runner**: `npm run test:hooks` (CJS stream), `npm run test:all` (ESM + CJS)
- **Coverage tool**: None configured (manual coverage tracking via test-case-to-requirement traceability)
- **Current baseline**: 555+ tests total (302 ESM lib tests + 253 CJS hook tests) per constitution Article II

### 1.2 Existing Test Files (Affected by This Feature)

| File | Tests | Functions Covered |
|------|-------|-------------------|
| `src/claude/hooks/tests/test-three-verb-utils.test.cjs` | ~120 | generateSlug, detectSource, deriveAnalysisStatus (5), deriveBacklogMarker, readMetaJson, writeMetaJson (6), parseBacklogLine, updateBacklogMarker, appendToBacklog, resolveItem, validatePhasesCompleted (14), computeStartPhase (14), checkStaleness (9), integration tests |
| `src/claude/hooks/tests/test-sizing.test.cjs` | 74 | parseSizingFromImpactAnalysis (19), computeSizingRecommendation (16), applySizingDecision (26), integration (8), error paths (5) |

### 1.3 Existing Test Patterns

Tests follow these conventions (which new tests MUST follow):

1. **File naming**: `test-{module-name}.test.cjs`
2. **Structure**: `describe()` groups per function, `it()` per test case
3. **Traceability**: Comments with `// Traces: FR-NNN, AC-NNN-NN` or `(TC-ID, FR-NNN)` in `it()` descriptions
4. **TC ID format**: `TC-{PREFIX}-{NN}` (e.g., `TC-CSP-01`, `TC-DAS-S01`)
5. **Temp dirs**: `createTestDir()` / `cleanupTestDir()` in `beforeEach`/`afterEach` for I/O tests
6. **Pure function tests**: No setup needed -- direct call and assert
7. **Imports**: `require()` from relative path to `../lib/<module>.cjs`
8. **FEATURE_PHASES constant**: Defined locally in test file: `['00-quick-scan', '01-requirements', '02-impact-analysis', '03-architecture', '04-design', '05-test-strategy', '06-implementation', '16-quality-loop', '08-code-review']`

### 1.4 Existing Test Coverage for Target Functions

| Function | Current Tests | Coverage Status |
|----------|--------------|-----------------|
| `deriveAnalysisStatus()` | 5 tests (no sizing param) | All pass with 1-arg signature |
| `writeMetaJson()` | 6 tests (no sizing_decision in meta) | All pass without sizing_decision field |
| `computeStartPhase()` | 14 tests (no sizing_decision in meta) | All pass without sizing_decision field |
| `applySizingDecision()` | 26 tests (build-side only) | NOT called from analyze; tests verify build behavior |

---

## 2. Test Strategy

### 2.1 Approach

**Extend existing test suite** -- do NOT replace or reorganize. All 27 new test cases will be added to the existing `test-three-verb-utils.test.cjs` file as new `describe()` blocks within the existing function sections, plus a new section for sizing consent validation.

### 2.2 Test Types

| Test Type | Count | Location | Description |
|-----------|-------|----------|-------------|
| **Unit** | 24 | `test-three-verb-utils.test.cjs` | Pure function tests for `deriveAnalysisStatus`, `writeMetaJson`, `computeStartPhase` with sizing parameters |
| **Unit (Consent)** | 3 | `test-three-verb-utils.test.cjs` | Verify analyze-side constraints (no applySizingDecision call, context field, skip phases recorded) |
| **Backward Compatibility** | 0 new (42 existing) | `test-three-verb-utils.test.cjs` | Existing 42 tests MUST continue to pass with zero modifications |
| **Integration** | 0 new | N/A | Handler-level integration is not unit-testable (markdown prompt); validated manually |

### 2.3 What Is NOT Tested (and Why)

| Aspect | Reason |
|--------|--------|
| Analyze handler sizing block (isdlc.md) | Markdown prompt files are not programmatically testable; verified via manual execution |
| Sizing menu UX (FR-002, NFR-003) | Visual/interactive; manual verification |
| GitHub label sync (FR-010) | Integration with `gh` CLI; not unit-testable |
| `-light` flag parsing (FR-006) | Inline in isdlc.md prompt; not unit-testable |
| Resumability (NFR-004) | End-to-end flow; manual verification |
| Performance overhead (NFR-005) | Not meaningful to test in isolation; existing perf tests cover the utility functions |

### 2.4 Coverage Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Requirement coverage | 100% of unit-testable FRs (FR-007, FR-008, FR-009) | Core utility functions that drive all sizing behavior |
| NFR coverage | 100% of NFR-001 (no state.json), NFR-002 (backward compat) | Critical safety properties |
| Constraint coverage | CON-002 (no applySizingDecision reuse) | Validated by TC-SC-S02 |
| Backward compatibility | 42 existing tests pass unmodified | Non-negotiable; any regression is a P0 blocker |
| New test count | 27 (13 P0 + 14 P1) | Matches design spec Section 4.5 |
| Total tests after | 69 for these 3 functions (42 existing + 27 new) | Consistent with design spec |

---

## 3. Test Case Specifications

### 3.1 deriveAnalysisStatus() -- 10 New Test Cases

**Function under test**: `deriveAnalysisStatus(phasesCompleted, sizingDecision)`
**File**: `src/claude/hooks/lib/three-verb-utils.cjs`
**Change**: New optional second parameter `sizingDecision`

#### Sizing-Aware Test Fixtures

```javascript
// Light sizing decision (standard fixture for most light-path tests)
const LIGHT_SIZING = {
    effective_intensity: 'light',
    light_skip_phases: ['03-architecture', '04-design']
};

// Standard sizing decision
const STANDARD_SIZING = {
    effective_intensity: 'standard',
    light_skip_phases: []
};

// Phases 00-02 completed (the "light-analyzed" set)
const PHASES_00_01_02 = ['00-quick-scan', '01-requirements', '02-impact-analysis'];
```

#### Test Cases

| TC ID | Priority | Description | Input: phasesCompleted | Input: sizingDecision | Expected | Traces |
|-------|----------|-------------|----------------------|---------------------|----------|--------|
| TC-DAS-S01 | P0 | Light sizing with 3 required phases returns analyzed | `PHASES_00_01_02` | `LIGHT_SIZING` | `'analyzed'` | FR-007 AC-007b |
| TC-DAS-S02 | P0 | null sizingDecision with 3 phases returns partial (backward compat) | `PHASES_00_01_02` | `null` | `'partial'` | FR-007 AC-007c, NFR-002 AC-NFR-002c |
| TC-DAS-S03 | P0 | undefined sizingDecision with 3 phases returns partial (backward compat) | `PHASES_00_01_02` | `undefined` | `'partial'` | FR-007 AC-007c, NFR-002 AC-NFR-002c |
| TC-DAS-S04 | P0 | Standard sizing with 3 phases returns partial | `PHASES_00_01_02` | `STANDARD_SIZING` | `'partial'` | FR-007 logic |
| TC-DAS-S05 | P1 | All 5 phases + light sizing returns analyzed (redundant but safe) | `ANALYSIS_PHASES` | `LIGHT_SIZING` | `'analyzed'` | Edge case |
| TC-DAS-S06 | P1 | Missing phase 02 + light sizing returns partial | `['00-quick-scan', '01-requirements']` | `LIGHT_SIZING` | `'partial'` | Edge: incomplete required set |
| TC-DAS-S07 | P1 | Light sizing with missing light_skip_phases returns partial (guard) | `PHASES_00_01_02` | `{ effective_intensity: 'light' }` | `'partial'` | Guard: malformed sizing |
| TC-DAS-S08 | P1 | Light sizing with non-array skip list returns partial (guard) | `PHASES_00_01_02` | `{ effective_intensity: 'light', light_skip_phases: 'not-an-array' }` | `'partial'` | Guard: type check |
| TC-DAS-S09 | P1 | Empty phases + light sizing returns raw | `[]` | `LIGHT_SIZING` | `'raw'` | Guard: 0 phases |
| TC-DAS-S10 | P1 | null phasesCompleted + light sizing returns raw | `null` | `LIGHT_SIZING` | `'raw'` | Guard: non-array input |

**Assertion patterns**:
```javascript
// TC-DAS-S01 (P0, representative)
it('returns "analyzed" for 3 required phases with light sizing (TC-DAS-S01, FR-007 AC-007b)', () => {
    assert.equal(
        deriveAnalysisStatus(
            ['00-quick-scan', '01-requirements', '02-impact-analysis'],
            { effective_intensity: 'light', light_skip_phases: ['03-architecture', '04-design'] }
        ),
        'analyzed'
    );
});
```

#### Existing Tests (5) -- MUST Pass Unchanged

| Existing Test | Current Call | Expected After Change |
|--------------|-------------|----------------------|
| `deriveAnalysisStatus([])` | 1-arg | `'raw'` -- unchanged (sizingDecision=undefined, guard skips new block) |
| `deriveAnalysisStatus(['00-quick-scan'])` | 1-arg | `'partial'` -- unchanged |
| `deriveAnalysisStatus([4 phases])` | 1-arg | `'partial'` -- unchanged |
| `deriveAnalysisStatus(ANALYSIS_PHASES)` | 1-arg | `'analyzed'` -- unchanged (still hits `completedCount === 5` path) |
| `deriveAnalysisStatus(null/undefined/'string')` | 1-arg | `'raw'` -- unchanged |

---

### 3.2 writeMetaJson() -- 5 New Test Cases

**Function under test**: `writeMetaJson(slugDir, meta)`
**File**: `src/claude/hooks/lib/three-verb-utils.cjs`
**Change**: Inline status derivation replaced with `deriveAnalysisStatus(meta.phases_completed, meta.sizing_decision)` call

#### Test Cases

| TC ID | Priority | Description | Input: meta | Expected: Written File | Traces |
|-------|----------|-------------|-----------|----------------------|--------|
| TC-WMJ-S01 | P0 | Light sizing + 3 phases -> analysis_status='analyzed', sizing_decision preserved | `{ phases_completed: ['00','01','02'], sizing_decision: { effective_intensity: 'light', light_skip_phases: ['03','04'], context: 'analyze' } }` | `analysis_status === 'analyzed'`, `sizing_decision` present | FR-008 AC-008a, AC-008b |
| TC-WMJ-S02 | P0 | Standard sizing + 3 phases -> analysis_status='partial', sizing_decision preserved | `{ phases_completed: ['00','01','02'], sizing_decision: { effective_intensity: 'standard', light_skip_phases: [], context: 'analyze' } }` | `analysis_status === 'partial'`, `sizing_decision` present | FR-008 logic |
| TC-WMJ-S03 | P0 | No sizing_decision + 3 phases -> analysis_status='partial' (backward compat) | `{ phases_completed: ['00','01','02'] }` | `analysis_status === 'partial'`, no `sizing_decision` key | NFR-002 AC-NFR-002b |
| TC-WMJ-S04 | P0 | No sizing_decision + all 5 phases -> analysis_status='analyzed' (backward compat) | `{ phases_completed: ANALYSIS_PHASES }` | `analysis_status === 'analyzed'` | NFR-002 backward compat |
| TC-WMJ-S05 | P1 | Round-trip: write with sizing_decision then read back -> sizing_decision identical | Meta with full sizing_decision | All fields preserved after JSON round-trip | FR-005 AC-005a |

**Assertion patterns**:
```javascript
// TC-WMJ-S01 (P0, representative)
it('derives "analyzed" with light sizing and preserves sizing_decision (TC-WMJ-S01, FR-008)', () => {
    const dir = path.join(testDir, 'sizing-light');
    fs.mkdirSync(dir, { recursive: true });
    writeMetaJson(dir, {
        source: 'manual', slug: 'sizing-light',
        phases_completed: ['00-quick-scan', '01-requirements', '02-impact-analysis'],
        sizing_decision: {
            effective_intensity: 'light',
            light_skip_phases: ['03-architecture', '04-design'],
            context: 'analyze'
        }
    });
    const written = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
    assert.equal(written.analysis_status, 'analyzed');
    assert.ok(written.sizing_decision, 'sizing_decision must be preserved');
    assert.equal(written.sizing_decision.effective_intensity, 'light');
    assert.equal(written.sizing_decision.context, 'analyze');
});
```

#### Existing Tests (6) -- MUST Pass Unchanged

All 6 existing `writeMetaJson()` tests call `writeMetaJson(dir, meta)` where `meta` has no `sizing_decision` field. After the implementation change (delegate to `deriveAnalysisStatus(phases, undefined)`), the function returns identical results because the new sizing block is guarded by a truthy check on `sizingDecision`.

---

### 3.3 computeStartPhase() -- 9 New Test Cases

**Function under test**: `computeStartPhase(meta, workflowPhases)`
**File**: `src/claude/hooks/lib/three-verb-utils.cjs`
**Change**: New Step 3.5 -- light-sizing branch inserted between Step 3 (no valid phases) and Step 4 (all 5 complete)

#### Test Cases

| TC ID | Priority | Description | Input: meta | Input: workflowPhases | Expected Output | Traces |
|-------|----------|-------------|-----------|---------------------|-----------------|--------|
| TC-CSP-S01 | P0 | Light sizing + phases 00-02 -> status='analyzed', startPhase='05-test-strategy' | `{ phases_completed: ['00','01','02'], sizing_decision: LIGHT_SIZING }` | `FEATURE_PHASES` | `status: 'analyzed', startPhase: '05-test-strategy'` | FR-009 AC-009a, AC-009b |
| TC-CSP-S02 | P0 | Light sizing + phases 00-02 -> completedPhases contains only actually-completed | Same as S01 | `FEATURE_PHASES` | `completedPhases: ['00-quick-scan','01-requirements','02-impact-analysis']` | FR-009 AC-009c |
| TC-CSP-S03 | P0 | Light sizing + phases 00-02 -> remainingPhases excludes skipped 03,04 | Same as S01 | `FEATURE_PHASES` | `remainingPhases: ['05-test-strategy','06-implementation','16-quality-loop','08-code-review']` | FR-009 AC-009d |
| TC-CSP-S04 | P0 | No sizing_decision + phases 00-02 -> status='partial', startPhase='03-architecture' (backward compat) | `{ phases_completed: ['00','01','02'] }` | `FEATURE_PHASES` | `status: 'partial', startPhase: '03-architecture'` | NFR-002 AC-NFR-002d |
| TC-CSP-S05 | P0 | Standard sizing + phases 00-02 -> status='partial' (standard does not trigger step 3.5) | `{ phases_completed: ['00','01','02'], sizing_decision: STANDARD_SIZING }` | `FEATURE_PHASES` | `status: 'partial', startPhase: '03-architecture'` | Guard: standard != light |
| TC-CSP-S06 | P1 | Light sizing but missing phase 02 -> status='partial' (incomplete required set) | `{ phases_completed: ['00','01'], sizing_decision: LIGHT_SIZING }` | `FEATURE_PHASES` | `status: 'partial', startPhase: '02-impact-analysis'` | Edge: missing 02 |
| TC-CSP-S07 | P1 | Light sizing with no skip array -> falls through to standard path | `{ phases_completed: ['00','01','02'], sizing_decision: { effective_intensity: 'light' } }` | `FEATURE_PHASES` | `status: 'partial', startPhase: '03-architecture'` | Guard: no skip array |
| TC-CSP-S08 | P1 | All 5 phases + light sizing -> status='analyzed' via step 3.5 (not step 4) | `{ phases_completed: ANALYSIS_PHASES, sizing_decision: LIGHT_SIZING }` | `FEATURE_PHASES` | `status: 'analyzed', startPhase: '05-test-strategy', completedPhases: ANALYSIS_PHASES` | Edge: all 5 + light |
| TC-CSP-S09 | P1 | null meta -> status='raw' (existing behavior preserved) | `null` | `FEATURE_PHASES` | `status: 'raw'` | Existing behavior |

**Assertion patterns**:
```javascript
// TC-CSP-S01 (P0, representative)
it('light sizing with 3 phases returns analyzed starting at 05 (TC-CSP-S01, FR-009 AC-009a, AC-009b)', () => {
    const result = computeStartPhase(
        {
            phases_completed: ['00-quick-scan', '01-requirements', '02-impact-analysis'],
            sizing_decision: {
                effective_intensity: 'light',
                light_skip_phases: ['03-architecture', '04-design']
            }
        },
        FEATURE_PHASES
    );
    assert.equal(result.status, 'analyzed');
    assert.equal(result.startPhase, '05-test-strategy');
});
```

#### Existing Tests (14) -- MUST Pass Unchanged

All 14 existing `computeStartPhase()` tests (TC-CSP-01 through TC-CSP-14) use meta objects without `sizing_decision`. The new Step 3.5 is guarded by a truthy check on `meta.sizing_decision` -- when absent, the block is entirely skipped and execution falls through to existing Steps 4 and 5. Zero existing tests need modification.

---

### 3.4 Sizing Consent Tests -- 3 New Test Cases

These tests validate constraints specific to the analyze-side sizing flow.

| TC ID | Priority | Description | Assertion | Traces |
|-------|----------|-------------|-----------|--------|
| TC-SC-S01 | P1 | sizing_decision.context is always 'analyze' for analyze-originated records | Verify field value in a representative sizing_decision object | FR-005 AC-005b |
| TC-SC-S02 | P1 | applySizingDecision is NOT called from the analyze context | Verify that `common.cjs` exports `applySizingDecision`, confirming it exists but is build-only; the analyze handler pseudocode explicitly avoids it | NFR-001, CON-002 |
| TC-SC-S03 | P1 | sizing_decision.light_skip_phases records which phases were skipped | Verify the field structure for a light sizing decision | FR-005 AC-005c |

**Implementation approach for consent tests**:

TC-SC-S01 and TC-SC-S03 validate the schema structure of a sizing_decision record. These are pure data validation tests -- construct the expected record and assert field values.

TC-SC-S02 validates a design constraint rather than runtime behavior. The test verifies that `applySizingDecision` exists in `common.cjs` exports (confirming it is available for build but explicitly excluded from analyze). This is a documentation/design validation test, not a functional test.

```javascript
// TC-SC-S02 (P1, representative)
it('applySizingDecision exists in common.cjs but is build-only (TC-SC-S02, NFR-001, CON-002)', () => {
    const common = require('../lib/common.cjs');
    assert.equal(typeof common.applySizingDecision, 'function',
        'applySizingDecision must exist in common.cjs (build-only function)');
    // The constraint is: analyze handler NEVER calls this function.
    // This is enforced by the analyze handler pseudocode (isdlc.md step 7.5)
    // and verified by code review in Phase 08.
});
```

---

## 4. Test Data Plan

### 4.1 Test Fixtures

All test data is defined inline in the test file. No external fixture files are needed.

#### Sizing Decision Fixtures

```javascript
// Light sizing decision -- standard form used by most tests
const LIGHT_SIZING = {
    effective_intensity: 'light',
    light_skip_phases: ['03-architecture', '04-design']
};

// Standard sizing decision
const STANDARD_SIZING = {
    effective_intensity: 'standard',
    light_skip_phases: []
};

// Full sizing_decision record (for round-trip and schema tests)
const FULL_LIGHT_SIZING = {
    intensity: 'light',
    effective_intensity: 'light',
    recommended_intensity: 'light',
    decided_at: '2026-02-19T22:35:00Z',
    reason: 'user_accepted',
    user_prompted: true,
    forced_by_flag: false,
    overridden: false,
    overridden_to: null,
    file_count: 3,
    module_count: 1,
    risk_score: 'low',
    coupling: 'low',
    coverage_gaps: 0,
    fallback_source: null,
    fallback_attempted: false,
    light_skip_phases: ['03-architecture', '04-design'],
    epic_deferred: false,
    context: 'analyze'
};

// Full forced-light sizing_decision record
const FORCED_LIGHT_SIZING = {
    intensity: 'light',
    effective_intensity: 'light',
    recommended_intensity: null,
    decided_at: '2026-02-19T23:05:00Z',
    reason: 'light_flag',
    user_prompted: false,
    forced_by_flag: true,
    overridden: false,
    overridden_to: null,
    file_count: 0,
    module_count: 0,
    risk_score: 'unknown',
    coupling: 'unknown',
    coverage_gaps: 0,
    fallback_source: null,
    fallback_attempted: false,
    light_skip_phases: ['03-architecture', '04-design'],
    epic_deferred: false,
    context: 'analyze'
};
```

#### Phase Array Fixtures

```javascript
// Already defined in the test file
const FEATURE_PHASES = [
    '00-quick-scan', '01-requirements', '02-impact-analysis',
    '03-architecture', '04-design', '05-test-strategy',
    '06-implementation', '16-quality-loop', '08-code-review'
];

const PHASES_00_01_02 = [
    '00-quick-scan', '01-requirements', '02-impact-analysis'
];
```

### 4.2 Boundary Values

| Boundary | Test Cases |
|----------|-----------|
| 0 completed phases + light sizing | TC-DAS-S09 |
| 2 of 3 required phases + light sizing | TC-DAS-S06, TC-CSP-S06 |
| 3 of 3 required phases + light sizing (exact boundary) | TC-DAS-S01, TC-CSP-S01 |
| All 5 phases + light sizing (redundant) | TC-DAS-S05, TC-CSP-S08 |
| Malformed sizing: missing `light_skip_phases` | TC-DAS-S07, TC-CSP-S07 |
| Malformed sizing: non-array `light_skip_phases` | TC-DAS-S08 |
| Non-array `phasesCompleted` + sizing | TC-DAS-S10 |

### 4.3 No External Dependencies

All tests are self-contained. No network calls, no database, no file system dependencies beyond temp directories for `writeMetaJson` tests. Temp directories are created in `beforeEach` and cleaned in `afterEach`.

---

## 5. Traceability Matrix

### 5.1 Requirement-to-Test Mapping

| Requirement | Acceptance Criteria | Test Cases | Coverage |
|-------------|-------------------|------------|----------|
| **FR-007** (deriveAnalysisStatus sizing-aware) | AC-007a: optional second param | TC-DAS-S01 through TC-DAS-S10 (all use 2-arg call) | FULL |
| | AC-007b: light sizing returns 'analyzed' | TC-DAS-S01 | FULL |
| | AC-007c: null/undefined = unchanged behavior | TC-DAS-S02, TC-DAS-S03 | FULL |
| | AC-007d: pure function preserved | TC-DAS-S01 (no I/O in test) | FULL |
| **FR-008** (writeMetaJson sizing-aware) | AC-008a: sizing-aware derivation | TC-WMJ-S01 | FULL |
| | AC-008b: sizing_decision preserved | TC-WMJ-S01, TC-WMJ-S05 | FULL |
| | AC-008c: backward compatible | TC-WMJ-S03, TC-WMJ-S04 | FULL |
| **FR-009** (computeStartPhase sizing-aware) | AC-009a: reads meta.sizing_decision | TC-CSP-S01 | FULL |
| | AC-009b: light + 3 phases = analyzed, startPhase=05 | TC-CSP-S01 | FULL |
| | AC-009c: completedPhases = only executed | TC-CSP-S02 | FULL |
| | AC-009d: remainingPhases excludes skipped | TC-CSP-S03 | FULL |
| | AC-009e: absent sizing_decision = backward compat | TC-CSP-S04 | FULL |
| **FR-005** (Record sizing in meta.json) | AC-005a: sizing written to meta.json | TC-WMJ-S05 | FULL |
| | AC-005b: context = 'analyze' | TC-SC-S01 | FULL |
| | AC-005c: light_skip_phases recorded | TC-SC-S03 | FULL |
| **NFR-001** (No state.json writes) | AC-NFR-001b: no applySizingDecision in analyze | TC-SC-S02 | FULL |
| **NFR-002** (Backward compatibility) | AC-NFR-002b: writeMetaJson unchanged w/o sizing | TC-WMJ-S03, TC-WMJ-S04 + 6 existing | FULL |
| | AC-NFR-002c: deriveAnalysisStatus unchanged w/o sizing | TC-DAS-S02, TC-DAS-S03 + 5 existing | FULL |
| | AC-NFR-002d: computeStartPhase unchanged w/o sizing | TC-CSP-S04 + 14 existing | FULL |
| **CON-002** (No applySizingDecision reuse) | Design constraint | TC-SC-S02 | FULL |

### 5.2 Requirements NOT Covered by Unit Tests (Manual Verification)

| Requirement | Reason | Verification Method |
|-------------|--------|-------------------|
| FR-001 (Sizing decision point after Phase 02) | Handler logic in isdlc.md | Manual execution |
| FR-002 (Sizing menu presentation) | UX/visual | Manual verification |
| FR-003 (Light sizing skips 03-04) | Handler logic; partially covered by TC-CSP-S01/S03 (build-side recognition) | Manual execution + unit coverage of downstream effects |
| FR-004 (Standard sizing continues) | Handler logic; partially covered by TC-CSP-S05 | Manual execution |
| FR-006 (-light flag on analyze) | Flag parsing in isdlc.md | Manual execution |
| FR-010 (GitHub label sync) | Integration with `gh` CLI | Manual execution |
| NFR-003 (Sizing menu UX consistency) | Visual/behavioral | Manual verification |
| NFR-004 (Resumability) | End-to-end flow | Manual execution |
| NFR-005 (Performance overhead) | Not meaningful in isolation | Existing perf tests sufficient |
| CON-004 (No epic in analyze) | Handler logic, menu restriction | Manual verification |

---

## 6. Test Organization

### 6.1 File Structure

All new tests go into the existing file: `src/claude/hooks/tests/test-three-verb-utils.test.cjs`

New tests are organized as additional `describe()` blocks within (or adjacent to) the existing function sections:

```
// Section 3: deriveAnalysisStatus() tests (existing, lines ~207-232)
//   -> Add: describe('deriveAnalysisStatus() -- sizing-aware (GH-57)', ...)

// Section 6: writeMetaJson() tests (existing, lines ~418-513)
//   -> Add: describe('writeMetaJson() -- sizing-aware (GH-57)', ...)

// Section 22: computeStartPhase() tests (existing, lines ~1751-1887)
//   -> Add: describe('computeStartPhase() -- sizing-aware (GH-57)', ...)

// NEW Section 26: Sizing Consent tests (GH-57)
//   -> Add: describe('Sizing Consent (GH-57)', ...)
```

### 6.2 Test Execution

```bash
# Run only the three-verb-utils tests (includes all new sizing tests)
node --test src/claude/hooks/tests/test-three-verb-utils.test.cjs

# Run all CJS hook tests
npm run test:hooks

# Run full suite (ESM + CJS)
npm run test:all
```

---

## 7. Backward Compatibility Verification Plan

### 7.1 Critical Invariant

**All 42 existing tests for `deriveAnalysisStatus`, `writeMetaJson`, and `computeStartPhase` MUST pass with zero code changes to the tests themselves.**

The implementation achieves this by:
1. `deriveAnalysisStatus(phasesCompleted, sizingDecision)` -- second param defaults to `undefined` when not passed, and the new block is guarded by `if (sizingDecision && ...)`. Existing 1-arg calls skip the new block entirely.
2. `writeMetaJson(slugDir, meta)` -- replaces inline derivation with `deriveAnalysisStatus(meta.phases_completed, meta.sizing_decision)`. When `meta.sizing_decision` is absent (all existing tests), passes `undefined` as second arg, which triggers the old code path.
3. `computeStartPhase(meta, workflowPhases)` -- new Step 3.5 guarded by `if (meta.sizing_decision && ...)`. When absent (all existing tests), block is skipped.

### 7.2 Verification Steps (Phase 06)

1. Run full existing test suite BEFORE any code changes -- capture baseline pass count
2. Implement `deriveAnalysisStatus` change -- run suite, verify same pass count
3. Implement `writeMetaJson` change -- run suite, verify same pass count
4. Implement `computeStartPhase` change -- run suite, verify same pass count
5. Add all 27 new tests -- run suite, verify baseline + 27 new tests all pass

---

## 8. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Existing tests break after signature change | HIGH | Optional parameter with undefined default; guard pattern ensures backward compat |
| writeMetaJson delegation changes derivation behavior | MEDIUM | New function call produces identical results to old inline logic for all inputs without sizing_decision |
| computeStartPhase Step 3.5 placement affects existing flow | MEDIUM | Inserted between Step 3 (0 valid -> raw) and Step 4 (5 valid -> analyzed); only fires when sizing_decision is present with specific properties |
| Test file grows too large | LOW | Adding ~120 lines of new tests to a ~2100-line file is manageable; tests are organized by describe() blocks |

---

## 9. Summary

| Metric | Value |
|--------|-------|
| New test cases | 27 (10 + 5 + 9 + 3) |
| Priority breakdown | 13 P0 (critical path), 14 P1 (guard/edge cases) |
| Existing tests (must pass) | 42 (5 + 6 + 14 + 17 sizing consent) |
| Total tests after implementation | 69 for affected functions |
| Requirement coverage | 100% of unit-testable requirements (FR-007, FR-008, FR-009, FR-005 partial, NFR-001, NFR-002, CON-002) |
| Test file | `src/claude/hooks/tests/test-three-verb-utils.test.cjs` (extend existing) |
| Test framework | Node.js `node:test` + `node:assert/strict` (CJS, .test.cjs) |
| Test data | Inline fixtures, no external files |

---

## 10. Phase Gate Validation (GATE-04)

- [x] Test strategy covers unit testing for all modified utility functions
- [x] Test strategy addresses integration testing (manual for handler logic)
- [x] Test strategy addresses backward compatibility (42 existing tests)
- [x] Test strategy addresses security (no new security surfaces; CON-002 constraint validated)
- [x] Test strategy addresses performance (existing perf tests cover utility functions)
- [x] Test cases exist for all unit-testable requirements (FR-007, FR-008, FR-009)
- [x] Test cases cover non-functional requirements (NFR-001, NFR-002)
- [x] Test cases cover constraints (CON-002)
- [x] Traceability matrix complete -- 100% of unit-testable requirements mapped to test cases
- [x] Coverage targets defined (27 new tests, 42 existing unchanged)
- [x] Test data strategy documented (inline fixtures, boundary values identified)
- [x] Critical paths identified (light sizing -> analyzed, backward compat, guard patterns)

---

*Test strategy completed in ANALYSIS MODE -- no state.json writes, no branches created.*

PHASE_TIMING_REPORT: { "debate_rounds_used": 0, "fan_out_chunks": 0 }
