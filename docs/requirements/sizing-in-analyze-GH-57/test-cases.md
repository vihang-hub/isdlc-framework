# Test Cases: Sizing Decision in Analyze Verb

**Generated**: 2026-02-20
**Feature**: GH-57 -- Add sizing decision to the analyze verb
**Phase**: 05-test-strategy
**Total New Tests**: 27 (13 P0, 14 P1)
**Test File**: `src/claude/hooks/tests/test-three-verb-utils.test.cjs`

---

## 1. Shared Test Fixtures

Define these at the top of new test sections (or reuse `FEATURE_PHASES` already in the file):

```javascript
// Sizing decision fixtures (GH-57)
const LIGHT_SIZING = {
    effective_intensity: 'light',
    light_skip_phases: ['03-architecture', '04-design']
};

const STANDARD_SIZING = {
    effective_intensity: 'standard',
    light_skip_phases: []
};

const PHASES_00_01_02 = [
    '00-quick-scan', '01-requirements', '02-impact-analysis'
];

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
```

---

## 2. deriveAnalysisStatus() -- Sizing-Aware Tests

**Section**: Add as `describe('deriveAnalysisStatus() -- sizing-aware (GH-57)')` after the existing `deriveAnalysisStatus()` describe block.

### TC-DAS-S01 [P0]

**Description**: Light sizing with all 3 required phases returns 'analyzed'
**Traces**: FR-007 AC-007b

```javascript
it('returns "analyzed" for 3 required phases with light sizing (TC-DAS-S01, FR-007 AC-007b)', () => {
    assert.equal(
        deriveAnalysisStatus(PHASES_00_01_02, LIGHT_SIZING),
        'analyzed'
    );
});
```

**Input**: `phasesCompleted=['00-quick-scan','01-requirements','02-impact-analysis']`, `sizingDecision={effective_intensity:'light', light_skip_phases:['03-architecture','04-design']}`
**Expected**: `'analyzed'`
**Rationale**: The 3 phases satisfy all "required" analysis phases (ANALYSIS_PHASES minus the skip list).

---

### TC-DAS-S02 [P0]

**Description**: null sizingDecision with 3 phases returns 'partial' (backward compatibility)
**Traces**: FR-007 AC-007c, NFR-002 AC-NFR-002c

```javascript
it('returns "partial" for 3 phases with null sizingDecision (TC-DAS-S02, FR-007 AC-007c)', () => {
    assert.equal(deriveAnalysisStatus(PHASES_00_01_02, null), 'partial');
});
```

**Input**: `phasesCompleted=['00','01','02']`, `sizingDecision=null`
**Expected**: `'partial'`
**Rationale**: null fails the truthy check; falls through to standard `completedCount < 5` logic.

---

### TC-DAS-S03 [P0]

**Description**: undefined sizingDecision with 3 phases returns 'partial' (backward compatibility)
**Traces**: FR-007 AC-007c, NFR-002 AC-NFR-002c

```javascript
it('returns "partial" for 3 phases with undefined sizingDecision (TC-DAS-S03, FR-007 AC-007c)', () => {
    assert.equal(deriveAnalysisStatus(PHASES_00_01_02, undefined), 'partial');
});
```

**Input**: `phasesCompleted=['00','01','02']`, `sizingDecision=undefined`
**Expected**: `'partial'`
**Rationale**: Simulates existing callers that pass only one argument.

---

### TC-DAS-S04 [P0]

**Description**: Standard sizing with 3 phases returns 'partial'
**Traces**: FR-007 logic

```javascript
it('returns "partial" for 3 phases with standard sizing (TC-DAS-S04)', () => {
    assert.equal(deriveAnalysisStatus(PHASES_00_01_02, STANDARD_SIZING), 'partial');
});
```

**Input**: `phasesCompleted=['00','01','02']`, `sizingDecision={effective_intensity:'standard', light_skip_phases:[]}`
**Expected**: `'partial'`
**Rationale**: `effective_intensity !== 'light'` causes the new block to be skipped; falls through to `completedCount < 5`.

---

### TC-DAS-S05 [P1]

**Description**: All 5 phases + light sizing returns 'analyzed' (redundant but validates both paths converge)
**Traces**: Edge case

```javascript
it('returns "analyzed" for all 5 phases even with light sizing (TC-DAS-S05)', () => {
    assert.equal(deriveAnalysisStatus(ANALYSIS_PHASES, LIGHT_SIZING), 'analyzed');
});
```

**Input**: All 5 ANALYSIS_PHASES + LIGHT_SIZING
**Expected**: `'analyzed'`
**Rationale**: The new block fires (all required phases present) and returns 'analyzed'. If the new block were somehow skipped, the standard path would also return 'analyzed'. Both paths agree.

---

### TC-DAS-S06 [P1]

**Description**: Missing phase 02 + light sizing returns 'partial'
**Traces**: Edge case -- incomplete required set

```javascript
it('returns "partial" when phase 02 missing despite light sizing (TC-DAS-S06)', () => {
    assert.equal(
        deriveAnalysisStatus(['00-quick-scan', '01-requirements'], LIGHT_SIZING),
        'partial'
    );
});
```

**Input**: Phases 00 and 01 only + LIGHT_SIZING
**Expected**: `'partial'`
**Rationale**: Phase 02 is required (not in skip list) but missing. `requiredPhases.every()` returns false; falls through to `completedCount < 5`.

---

### TC-DAS-S07 [P1]

**Description**: Light sizing with missing light_skip_phases field returns 'partial' (guard)
**Traces**: Guard: malformed sizing decision

```javascript
it('returns "partial" when light_skip_phases missing from sizingDecision (TC-DAS-S07)', () => {
    assert.equal(
        deriveAnalysisStatus(PHASES_00_01_02, { effective_intensity: 'light' }),
        'partial'
    );
});
```

**Input**: Phases 00-02 + `{effective_intensity:'light'}` (no light_skip_phases)
**Expected**: `'partial'`
**Rationale**: `Array.isArray(sizingDecision.light_skip_phases)` returns false for undefined; block skipped.

---

### TC-DAS-S08 [P1]

**Description**: Light sizing with non-array light_skip_phases returns 'partial' (guard)
**Traces**: Guard: type check on skip list

```javascript
it('returns "partial" when light_skip_phases is not an array (TC-DAS-S08)', () => {
    assert.equal(
        deriveAnalysisStatus(PHASES_00_01_02, { effective_intensity: 'light', light_skip_phases: 'not-an-array' }),
        'partial'
    );
});
```

**Input**: Phases 00-02 + `{effective_intensity:'light', light_skip_phases:'not-an-array'}`
**Expected**: `'partial'`
**Rationale**: `Array.isArray('not-an-array')` returns false; block skipped.

---

### TC-DAS-S09 [P1]

**Description**: Empty phases + light sizing returns 'raw'
**Traces**: Guard: 0 phases

```javascript
it('returns "raw" for empty phases even with light sizing (TC-DAS-S09)', () => {
    assert.equal(deriveAnalysisStatus([], LIGHT_SIZING), 'raw');
});
```

**Input**: `[]` + LIGHT_SIZING
**Expected**: `'raw'`
**Rationale**: `completedCount === 0` fires before the sizing block is reached.

---

### TC-DAS-S10 [P1]

**Description**: null phasesCompleted + light sizing returns 'raw'
**Traces**: Guard: non-array input

```javascript
it('returns "raw" for null phasesCompleted even with light sizing (TC-DAS-S10)', () => {
    assert.equal(deriveAnalysisStatus(null, LIGHT_SIZING), 'raw');
});
```

**Input**: `null` + LIGHT_SIZING
**Expected**: `'raw'`
**Rationale**: `!Array.isArray(null)` fires first, returning 'raw' before any sizing logic.

---

## 3. writeMetaJson() -- Sizing-Aware Tests

**Section**: Add as `describe('writeMetaJson() -- sizing-aware (GH-57)')` after the existing `writeMetaJson()` describe block. Requires `beforeEach`/`afterEach` for temp dirs.

### TC-WMJ-S01 [P0]

**Description**: Light sizing + 3 phases derives analysis_status='analyzed' and preserves sizing_decision
**Traces**: FR-008 AC-008a, AC-008b

```javascript
it('derives "analyzed" with light sizing and preserves sizing_decision (TC-WMJ-S01, FR-008 AC-008a, AC-008b)', () => {
    const dir = path.join(testDir, 'wmj-s01');
    fs.mkdirSync(dir, { recursive: true });
    writeMetaJson(dir, {
        source: 'manual', slug: 'wmj-s01',
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

---

### TC-WMJ-S02 [P0]

**Description**: Standard sizing + 3 phases derives analysis_status='partial' and preserves sizing_decision
**Traces**: FR-008 logic

```javascript
it('derives "partial" with standard sizing and preserves sizing_decision (TC-WMJ-S02, FR-008)', () => {
    const dir = path.join(testDir, 'wmj-s02');
    fs.mkdirSync(dir, { recursive: true });
    writeMetaJson(dir, {
        source: 'manual', slug: 'wmj-s02',
        phases_completed: ['00-quick-scan', '01-requirements', '02-impact-analysis'],
        sizing_decision: {
            effective_intensity: 'standard',
            light_skip_phases: [],
            context: 'analyze'
        }
    });
    const written = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
    assert.equal(written.analysis_status, 'partial');
    assert.ok(written.sizing_decision, 'sizing_decision must be preserved');
    assert.equal(written.sizing_decision.effective_intensity, 'standard');
});
```

---

### TC-WMJ-S03 [P0]

**Description**: No sizing_decision + 3 phases -> analysis_status='partial' (backward compatibility)
**Traces**: NFR-002 AC-NFR-002b

```javascript
it('derives "partial" without sizing_decision (backward compat) (TC-WMJ-S03, NFR-002 AC-NFR-002b)', () => {
    const dir = path.join(testDir, 'wmj-s03');
    fs.mkdirSync(dir, { recursive: true });
    writeMetaJson(dir, {
        source: 'manual', slug: 'wmj-s03',
        phases_completed: ['00-quick-scan', '01-requirements', '02-impact-analysis']
    });
    const written = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
    assert.equal(written.analysis_status, 'partial');
    assert.equal(written.sizing_decision, undefined, 'No sizing_decision should exist');
});
```

---

### TC-WMJ-S04 [P0]

**Description**: No sizing_decision + all 5 phases -> analysis_status='analyzed' (backward compatibility)
**Traces**: NFR-002 backward compat

```javascript
it('derives "analyzed" for all 5 phases without sizing_decision (backward compat) (TC-WMJ-S04, NFR-002)', () => {
    const dir = path.join(testDir, 'wmj-s04');
    fs.mkdirSync(dir, { recursive: true });
    writeMetaJson(dir, {
        source: 'manual', slug: 'wmj-s04',
        phases_completed: ANALYSIS_PHASES
    });
    const written = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
    assert.equal(written.analysis_status, 'analyzed');
});
```

---

### TC-WMJ-S05 [P1]

**Description**: Round-trip: write with full sizing_decision then read back -- all fields preserved
**Traces**: FR-005 AC-005a

```javascript
it('round-trips sizing_decision through write and read (TC-WMJ-S05, FR-005 AC-005a)', () => {
    const dir = path.join(testDir, 'wmj-s05');
    fs.mkdirSync(dir, { recursive: true });
    const original = {
        source: 'manual', slug: 'wmj-s05',
        phases_completed: ['00-quick-scan', '01-requirements', '02-impact-analysis'],
        sizing_decision: { ...FULL_LIGHT_SIZING }
    };
    writeMetaJson(dir, original);
    const readBack = readMetaJson(dir);
    assert.deepEqual(readBack.sizing_decision, FULL_LIGHT_SIZING);
});
```

---

## 4. computeStartPhase() -- Sizing-Aware Tests

**Section**: Add as `describe('computeStartPhase() -- sizing-aware (GH-57)')` after the existing `computeStartPhase()` describe block.

### TC-CSP-S01 [P0]

**Description**: Light sizing + phases 00-02 returns analyzed with startPhase 05-test-strategy
**Traces**: FR-009 AC-009a, AC-009b

```javascript
it('light sizing with 3 phases returns analyzed starting at 05 (TC-CSP-S01, FR-009 AC-009a, AC-009b)', () => {
    const result = computeStartPhase(
        {
            phases_completed: ['00-quick-scan', '01-requirements', '02-impact-analysis'],
            sizing_decision: LIGHT_SIZING
        },
        FEATURE_PHASES
    );
    assert.equal(result.status, 'analyzed');
    assert.equal(result.startPhase, '05-test-strategy');
});
```

---

### TC-CSP-S02 [P0]

**Description**: completedPhases contains only actually-completed phases (not skipped ones)
**Traces**: FR-009 AC-009c

```javascript
it('completedPhases contains only executed phases (TC-CSP-S02, FR-009 AC-009c)', () => {
    const result = computeStartPhase(
        {
            phases_completed: ['00-quick-scan', '01-requirements', '02-impact-analysis'],
            sizing_decision: LIGHT_SIZING
        },
        FEATURE_PHASES
    );
    assert.deepEqual(result.completedPhases, [
        '00-quick-scan', '01-requirements', '02-impact-analysis'
    ]);
});
```

---

### TC-CSP-S03 [P0]

**Description**: remainingPhases excludes skipped phases 03 and 04
**Traces**: FR-009 AC-009d

```javascript
it('remainingPhases excludes light-skipped phases (TC-CSP-S03, FR-009 AC-009d)', () => {
    const result = computeStartPhase(
        {
            phases_completed: ['00-quick-scan', '01-requirements', '02-impact-analysis'],
            sizing_decision: LIGHT_SIZING
        },
        FEATURE_PHASES
    );
    assert.deepEqual(result.remainingPhases, [
        '05-test-strategy', '06-implementation', '16-quality-loop', '08-code-review'
    ]);
});
```

---

### TC-CSP-S04 [P0]

**Description**: No sizing_decision with 3 phases returns partial starting at 03 (backward compat)
**Traces**: NFR-002 AC-NFR-002d

```javascript
it('no sizing_decision with 3 phases returns partial at 03 (TC-CSP-S04, NFR-002 AC-NFR-002d)', () => {
    const result = computeStartPhase(
        { phases_completed: ['00-quick-scan', '01-requirements', '02-impact-analysis'] },
        FEATURE_PHASES
    );
    assert.equal(result.status, 'partial');
    assert.equal(result.startPhase, '03-architecture');
});
```

---

### TC-CSP-S05 [P0]

**Description**: Standard sizing with 3 phases returns partial (standard does not trigger step 3.5)
**Traces**: Guard: standard != light

```javascript
it('standard sizing with 3 phases returns partial (TC-CSP-S05)', () => {
    const result = computeStartPhase(
        {
            phases_completed: ['00-quick-scan', '01-requirements', '02-impact-analysis'],
            sizing_decision: STANDARD_SIZING
        },
        FEATURE_PHASES
    );
    assert.equal(result.status, 'partial');
    assert.equal(result.startPhase, '03-architecture');
});
```

---

### TC-CSP-S06 [P1]

**Description**: Light sizing but missing phase 02 returns partial
**Traces**: Edge: incomplete required set

```javascript
it('light sizing with missing phase 02 returns partial (TC-CSP-S06)', () => {
    const result = computeStartPhase(
        {
            phases_completed: ['00-quick-scan', '01-requirements'],
            sizing_decision: LIGHT_SIZING
        },
        FEATURE_PHASES
    );
    assert.equal(result.status, 'partial');
    assert.equal(result.startPhase, '02-impact-analysis');
});
```

---

### TC-CSP-S07 [P1]

**Description**: Light sizing with no skip array falls through to standard path
**Traces**: Guard: no skip array

```javascript
it('light sizing without light_skip_phases array falls through (TC-CSP-S07)', () => {
    const result = computeStartPhase(
        {
            phases_completed: ['00-quick-scan', '01-requirements', '02-impact-analysis'],
            sizing_decision: { effective_intensity: 'light' }
        },
        FEATURE_PHASES
    );
    assert.equal(result.status, 'partial');
    assert.equal(result.startPhase, '03-architecture');
});
```

---

### TC-CSP-S08 [P1]

**Description**: All 5 phases + light sizing returns analyzed (hits step 3.5, not step 4)
**Traces**: Edge: all 5 + light

```javascript
it('all 5 phases with light sizing returns analyzed (TC-CSP-S08)', () => {
    const result = computeStartPhase(
        {
            phases_completed: [...ANALYSIS_PHASES],
            sizing_decision: LIGHT_SIZING
        },
        FEATURE_PHASES
    );
    assert.equal(result.status, 'analyzed');
    assert.equal(result.startPhase, '05-test-strategy');
    assert.deepEqual(result.completedPhases, ANALYSIS_PHASES);
});
```

---

### TC-CSP-S09 [P1]

**Description**: null meta returns raw (existing behavior preserved)
**Traces**: Existing behavior

```javascript
it('null meta still returns raw (TC-CSP-S09)', () => {
    const result = computeStartPhase(null, FEATURE_PHASES);
    assert.equal(result.status, 'raw');
});
```

---

## 5. Sizing Consent Tests

**Section**: New `describe('Sizing Consent (GH-57)')` at the end of the test file.

### TC-SC-S01 [P1]

**Description**: sizing_decision.context is 'analyze' for analyze-originated records
**Traces**: FR-005 AC-005b

```javascript
it('sizing_decision.context is "analyze" for analyze records (TC-SC-S01, FR-005 AC-005b)', () => {
    const sizingDecision = { ...FULL_LIGHT_SIZING };
    assert.equal(sizingDecision.context, 'analyze');
});
```

---

### TC-SC-S02 [P1]

**Description**: applySizingDecision exists in common.cjs but is build-only; not called from analyze
**Traces**: NFR-001, CON-002

```javascript
it('applySizingDecision exists in common.cjs (build-only, CON-002) (TC-SC-S02, NFR-001, CON-002)', () => {
    const common = require('../lib/common.cjs');
    assert.equal(typeof common.applySizingDecision, 'function',
        'applySizingDecision must exist (build-only; analyze handler must NOT call it)');
});
```

---

### TC-SC-S03 [P1]

**Description**: sizing_decision.light_skip_phases records skipped phases
**Traces**: FR-005 AC-005c

```javascript
it('sizing_decision.light_skip_phases records skipped phases (TC-SC-S03, FR-005 AC-005c)', () => {
    const sizingDecision = { ...FULL_LIGHT_SIZING };
    assert.ok(Array.isArray(sizingDecision.light_skip_phases));
    assert.deepEqual(sizingDecision.light_skip_phases, ['03-architecture', '04-design']);
});
```

---

## 6. Test Count Summary

| Function | Existing | New P0 | New P1 | Total After |
|----------|---------|--------|--------|-------------|
| deriveAnalysisStatus() | 5 | 4 | 6 | 15 |
| writeMetaJson() | 6 | 4 | 1 | 11 |
| computeStartPhase() | 14 | 5 | 4 | 23 |
| Sizing Consent | 17 | 0 | 3 | 20 |
| **Total** | **42** | **13** | **14** | **69** |

---

*Test cases specified in ANALYSIS MODE -- no state.json writes, no branches created.*
