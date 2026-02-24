# Test Data Plan -- REQ-0011: Adaptive Workflow Sizing

**Version**: 1.0.0
**Phase**: 05-test-strategy
**Created**: 2026-02-12
**Traces to**: FR-01 through FR-07

---

## 1. Overview

This document defines all test data needed for the sizing test suite. Data is organized by function and categorized as valid, boundary, and invalid. All test data is defined as JavaScript constants within the test file -- no external data files, no test databases, no fixtures directory needed.

---

## 2. Test Data: parseSizingFromImpactAnalysis

### 2.1 Valid Inputs

#### IA Content with JSON Metadata Block (Primary Parsing)

```javascript
const IA_JSON_MINIMAL = `# Impact Analysis
## Impact Analysis Metadata
\`\`\`json
{
  "files_directly_affected": 3,
  "modules_affected": 1,
  "risk_level": "low",
  "blast_radius": "low",
  "coverage_gaps": 0
}
\`\`\``;

const IA_JSON_MEDIUM = `# Impact Analysis
...lots of markdown content...
## Impact Analysis Metadata
\`\`\`json
{
  "files_directly_affected": 12,
  "modules_affected": 4,
  "risk_level": "medium",
  "blast_radius": "medium",
  "coverage_gaps": 1
}
\`\`\``;

const IA_JSON_HIGH = `# Impact Analysis
## Impact Analysis Metadata
\`\`\`json
{
  "files_directly_affected": 35,
  "modules_affected": 8,
  "risk_level": "high",
  "blast_radius": "high",
  "coverage_gaps": 5
}
\`\`\``;

const IA_JSON_EXTRA_FIELDS = `# Impact Analysis
\`\`\`json
{
  "files_directly_affected": 5,
  "modules_affected": 2,
  "risk_level": "low",
  "blast_radius": "low",
  "coverage_gaps": 0,
  "extra_field": "should be ignored",
  "another_extra": 42
}
\`\`\``;

const IA_JSON_MULTIPLE_BLOCKS = `# Impact Analysis
\`\`\`json
{
  "files_directly_affected": 99,
  "modules_affected": 99,
  "risk_level": "high",
  "blast_radius": "high",
  "coverage_gaps": 99
}
\`\`\`
Some text between blocks.
\`\`\`json
{
  "files_directly_affected": 3,
  "modules_affected": 1,
  "risk_level": "low",
  "blast_radius": "low",
  "coverage_gaps": 0
}
\`\`\``;
```

#### IA Content with Executive Summary Prose (Fallback Parsing)

```javascript
const IA_PROSE_ALL_FIELDS = `## Executive Summary
**Affected Files**: 12
**Modules Affected**: 3
**Risk Level**: medium
**Blast Radius**: high
**Coverage Gaps**: 2`;

const IA_PROSE_MINIMUM_FIELDS = `## Executive Summary
**Affected Files**: 5
**Risk Level**: low`;

const IA_PROSE_SINGULAR_MODULE = `## Summary
**Affected Files**: 3
**Module Affected**: 1
**Risk Level**: low
**Blast Radius**: low`;

const IA_PROSE_MIXED_CASE = `**affected files**: 8
**RISK LEVEL**: HIGH
**blast radius**: LOW`;
```

### 2.2 Boundary Inputs

```javascript
// Zero file count
const IA_JSON_ZERO_FILES = `\`\`\`json
{
  "files_directly_affected": 0,
  "modules_affected": 0,
  "risk_level": "low",
  "blast_radius": "low",
  "coverage_gaps": 0
}
\`\`\``;

// Very large values
const IA_JSON_LARGE_VALUES = `\`\`\`json
{
  "files_directly_affected": 1000,
  "modules_affected": 100,
  "risk_level": "high",
  "blast_radius": "high",
  "coverage_gaps": 50
}
\`\`\``;

// String numbers (parseable)
const IA_JSON_STRING_NUMBERS = `\`\`\`json
{
  "files_directly_affected": "7",
  "modules_affected": "2",
  "risk_level": "low",
  "blast_radius": "low",
  "coverage_gaps": "1"
}
\`\`\``;
```

### 2.3 Invalid Inputs

```javascript
// Empty / null / non-string
const INVALID_EMPTY = '';
const INVALID_NULL = null;
const INVALID_UNDEFINED = undefined;
const INVALID_NUMBER = 42;
const INVALID_OBJECT = {};

// Malformed JSON block
const IA_BAD_JSON = `\`\`\`json
{ this is not valid json }
\`\`\``;

// JSON block with all invalid field values
const IA_JSON_ALL_INVALID = `\`\`\`json
{
  "files_directly_affected": -5,
  "modules_affected": "abc",
  "risk_level": "critical",
  "blast_radius": 42,
  "coverage_gaps": -3
}
\`\`\``;

// No structured data
const IA_NO_STRUCTURE = 'Some random text without any structured data at all.';

// Malformed JSON + invalid fallback prose (both fail)
const IA_BOTH_FAIL = `\`\`\`json
{ broken json }
\`\`\`
No structured prose here either.`;

// JSON with wrong field names
const IA_JSON_WRONG_NAMES = `\`\`\`json
{
  "file_count": 3,
  "module_count": 1,
  "risk": "low",
  "coupling": "low",
  "gaps": 0
}
\`\`\``;

// Malformed JSON with valid fallback
const IA_BAD_JSON_GOOD_PROSE = `\`\`\`json
{ broken json }
\`\`\`
**Affected Files**: 4
**Risk Level**: low
**Blast Radius**: medium`;

// Float file count
const IA_JSON_FLOAT_FILES = `\`\`\`json
{
  "files_directly_affected": 3.7,
  "modules_affected": 1,
  "risk_level": "low",
  "blast_radius": "low",
  "coverage_gaps": 0
}
\`\`\``;
```

---

## 3. Test Data: computeSizingRecommendation

### 3.1 Metrics Objects (Valid)

```javascript
const METRICS_LIGHT = {
    file_count: 3, module_count: 1,
    risk_score: 'low', coupling: 'low', coverage_gaps: 0
};

const METRICS_STANDARD = {
    file_count: 12, module_count: 4,
    risk_score: 'medium', coupling: 'medium', coverage_gaps: 1
};

const METRICS_EPIC = {
    file_count: 35, module_count: 8,
    risk_score: 'high', coupling: 'high', coverage_gaps: 5
};

const METRICS_ZERO_FILES = {
    file_count: 0, module_count: 0,
    risk_score: 'low', coupling: 'low', coverage_gaps: 0
};

const METRICS_HIGH_RISK_LOW_FILES = {
    file_count: 2, module_count: 1,
    risk_score: 'high', coupling: 'high', coverage_gaps: 0
};

const METRICS_MEDIUM_RISK_LOW_FILES = {
    file_count: 3, module_count: 1,
    risk_score: 'medium', coupling: 'medium', coverage_gaps: 0
};
```

### 3.2 Metrics Objects (Boundary)

```javascript
// At light/standard boundary (default thresholds)
const METRICS_AT_LIGHT_BOUNDARY = {
    file_count: 5, module_count: 2,
    risk_score: 'low', coupling: 'low', coverage_gaps: 0
};

const METRICS_JUST_ABOVE_LIGHT = {
    file_count: 6, module_count: 2,
    risk_score: 'low', coupling: 'low', coverage_gaps: 0
};

// At standard/epic boundary (default thresholds)
const METRICS_JUST_BELOW_EPIC = {
    file_count: 19, module_count: 5,
    risk_score: 'medium', coupling: 'medium', coverage_gaps: 0
};

const METRICS_AT_EPIC_BOUNDARY = {
    file_count: 20, module_count: 6,
    risk_score: 'medium', coupling: 'medium', coverage_gaps: 1
};

// At custom boundaries
const METRICS_CUSTOM_LIGHT = {
    file_count: 8, module_count: 2,
    risk_score: 'low', coupling: 'low', coverage_gaps: 0
};

const METRICS_CUSTOM_STANDARD = {
    file_count: 25, module_count: 6,
    risk_score: 'medium', coupling: 'medium', coverage_gaps: 0
};
```

### 3.3 Metrics Objects (Invalid / Null)

```javascript
const METRICS_NULL = null;
const METRICS_UNDEFINED = undefined;
```

### 3.4 Threshold Objects

```javascript
// Default thresholds
const THRESHOLDS_DEFAULT = {
    light_max_files: 5,
    epic_min_files: 20
};

// Custom thresholds (wider light range)
const THRESHOLDS_WIDE_LIGHT = {
    light_max_files: 10,
    epic_min_files: 30
};

// Custom thresholds (narrow standard range)
const THRESHOLDS_NARROW = {
    light_max_files: 3,
    epic_min_files: 10
};

// Invalid thresholds
const THRESHOLDS_INVALID_LIGHT = {
    light_max_files: -1,
    epic_min_files: 20
};

const THRESHOLDS_INVALID_EPIC = {
    light_max_files: 5,
    epic_min_files: 0
};

const THRESHOLDS_WRONG_ORDER = {
    light_max_files: 20,
    epic_min_files: 5
};

const THRESHOLDS_EQUAL = {
    light_max_files: 10,
    epic_min_files: 10
};

const THRESHOLDS_NON_NUMBER = {
    light_max_files: 'five',
    epic_min_files: 'twenty'
};
```

### 3.5 Decision Table (Expected Outcomes)

| Metrics | Thresholds | Expected Intensity | Test Case |
|---------|-----------|-------------------|-----------|
| file_count=3, risk=low | default (5, 20) | light | TC-SZ-020 |
| file_count=5, risk=low | default (5, 20) | light | TC-SZ-020 |
| file_count=6, risk=low | default (5, 20) | standard | TC-SZ-021 |
| file_count=0, risk=low | default (5, 20) | light | TC-SZ-022 |
| file_count=8, risk=low | custom (10, 30) | light | TC-SZ-023 |
| file_count=20, risk=medium | default (5, 20) | epic | TC-SZ-024 |
| file_count=19, risk=medium | default (5, 20) | standard | TC-SZ-025 |
| file_count=100, risk=medium | default (5, 20) | epic | TC-SZ-026 |
| file_count=25, risk=medium | custom (5, 30) | standard | TC-SZ-027 |
| file_count=2, risk=high | default (5, 20) | epic | TC-SZ-028 |
| file_count=12, risk=high | default (5, 20) | epic | TC-SZ-029 |
| file_count=3, risk=medium | default (5, 20) | light | TC-SZ-030 |
| null | default (5, 20) | standard | TC-SZ-031 |
| undefined | default (5, 20) | standard | TC-SZ-032 |
| file_count=3, risk=low | invalid (-1, 20) | light (defaults applied) | TC-SZ-033 |
| file_count=19, risk=medium | invalid (5, 0) | standard (defaults applied) | TC-SZ-034 |
| file_count=3, risk=low | wrong order (20, 5) | light (defaults applied) | TC-SZ-035 |

---

## 4. Test Data: applySizingDecision

### 4.1 State Objects

#### buildFeatureState() -- Standard 9-Phase Feature State

```javascript
function buildFeatureState() {
    return {
        active_workflow: {
            type: 'feature',
            phases: [
                '00-quick-scan', '01-requirements', '02-impact-analysis',
                '03-architecture', '04-design', '05-test-strategy',
                '06-implementation', '16-quality-loop', '08-code-review'
            ],
            current_phase_index: 3,
            phase_status: {
                '00-quick-scan': 'completed',
                '01-requirements': 'completed',
                '02-impact-analysis': 'completed',
                '03-architecture': 'pending',
                '04-design': 'pending',
                '05-test-strategy': 'pending',
                '06-implementation': 'pending',
                '16-quality-loop': 'pending',
                '08-code-review': 'pending'
            },
            flags: {}
        },
        phases: {
            '00-quick-scan': { status: 'completed' },
            '01-requirements': { status: 'completed' },
            '02-impact-analysis': { status: 'completed' },
            '03-architecture': { status: 'pending' },
            '04-design': { status: 'pending' },
            '05-test-strategy': { status: 'pending' },
            '06-implementation': { status: 'pending' },
            '16-quality-loop': { status: 'pending' },
            '08-code-review': { status: 'pending' }
        }
    };
}
```

#### buildMinimalState(phasesArray) -- For Invariant Failure Tests

```javascript
function buildMinimalState(phasesArray) {
    const phase_status = {};
    const phases = {};
    const halfwayIdx = Math.floor(phasesArray.length / 2);
    phasesArray.forEach((p, i) => {
        const status = i < halfwayIdx ? 'completed' : 'pending';
        phase_status[p] = status;
        phases[p] = { status };
    });
    return {
        active_workflow: {
            type: 'feature',
            phases: [...phasesArray],
            current_phase_index: halfwayIdx,
            phase_status,
            flags: {}
        },
        phases
    };
}
```

#### buildStateWithHighIndex() -- INV-02 Trigger

```javascript
function buildStateWithHighIndex() {
    // After removing 03 and 04, only 7 phases remain.
    // But current_phase_index is set to 8 (would be out of bounds at 7).
    const state = buildFeatureState();
    state.active_workflow.current_phase_index = 8;
    // Make the phase at index 8 have 'completed' status so it's not the issue
    state.active_workflow.phase_status['08-code-review'] = 'completed';
    return state;
}
```

### 4.2 SizingData Objects

```javascript
// Standard sizingData for light
const SIZING_DATA_LIGHT = {
    metrics: METRICS_LIGHT,
    forced_by_flag: false,
    overridden: false
};

// Flag-forced light
const SIZING_DATA_LIGHT_FORCED = {
    metrics: METRICS_LIGHT,
    forced_by_flag: true,
    overridden: false
};

// User override to light
const SIZING_DATA_OVERRIDE_LIGHT = {
    metrics: METRICS_STANDARD,
    forced_by_flag: false,
    overridden: true,
    overridden_to: 'light',
    recommended_intensity: 'standard'
};

// Standard sizingData
const SIZING_DATA_STANDARD = {
    metrics: METRICS_STANDARD,
    forced_by_flag: false,
    overridden: false
};

// Epic sizingData
const SIZING_DATA_EPIC = {
    metrics: METRICS_EPIC,
    forced_by_flag: false,
    overridden: false
};

// Null metrics (parsing failure)
const SIZING_DATA_NULL_METRICS = {
    metrics: null,
    forced_by_flag: false,
    overridden: false
};

// Custom config with single skip phase
const SIZING_DATA_CUSTOM_SKIP = {
    metrics: METRICS_LIGHT,
    config: { light_skip_phases: ['03-architecture'] }
};

// Custom config with non-array skip phases (SZ-205)
const SIZING_DATA_BAD_SKIP = {
    metrics: METRICS_LIGHT,
    config: { light_skip_phases: 'not-an-array' }
};

// Custom config with nonexistent phase (SZ-206)
const SIZING_DATA_NONEXISTENT_SKIP = {
    metrics: METRICS_LIGHT,
    config: { light_skip_phases: ['99-nonexistent'] }
};
```

### 4.3 Intensity Values (Invalid)

```javascript
const INVALID_INTENSITIES = [
    'fast',         // wrong string
    'LIGHT',        // wrong case
    '',             // empty string
    42,             // number
    null,           // null
    undefined,      // undefined
    true,           // boolean
    ['light'],      // array
    { intensity: 'light' }  // object
];
```

### 4.4 Edge Case States

```javascript
// Empty state
const STATE_EMPTY = {};

// State with null active_workflow
const STATE_NULL_WORKFLOW = { active_workflow: null };

// State without phases property (top-level)
const STATE_NO_TOP_PHASES = {
    active_workflow: {
        type: 'feature',
        phases: ['00-quick-scan', '01-requirements', '02-impact-analysis',
                 '03-architecture', '04-design', '05-test-strategy',
                 '06-implementation', '16-quality-loop', '08-code-review'],
        current_phase_index: 3,
        phase_status: { /* ... */ },
        flags: {}
    }
    // Note: no state.phases -- top-level phases object is missing
};

// State with next phase already completed (INV-04 trigger)
function buildStateNextNotPending() {
    const state = buildFeatureState();
    state.active_workflow.phase_status['05-test-strategy'] = 'completed';
    return state;
}
```

---

## 5. Test Data Generation Helper

The test file includes a builder function for IA content:

```javascript
/**
 * Build an impact-analysis.md markdown string with a JSON metadata block.
 * @param {number} files - files_directly_affected
 * @param {number} modules - modules_affected
 * @param {string} risk - risk_level
 * @param {string} blast - blast_radius
 * @param {number} gaps - coverage_gaps
 * @returns {string} Full markdown with JSON block
 */
function buildIAContent(files, modules, risk, blast, gaps) {
    return `# Impact Analysis

## Executive Summary

Analysis of the proposed changes.

## Impact Analysis Metadata

\`\`\`json
{
  "files_directly_affected": ${files},
  "modules_affected": ${modules},
  "risk_level": "${risk}",
  "blast_radius": "${blast}",
  "coverage_gaps": ${gaps}
}
\`\`\``;
}
```

---

## 6. Data Traceability

| Data Category | Test Cases Used By | Requirements |
|--------------|-------------------|-------------|
| IA JSON content (valid) | TC-SZ-001 through TC-SZ-006 | FR-01 (AC-01) |
| IA prose content (fallback) | TC-SZ-007 through TC-SZ-010 | FR-01 (AC-01) |
| IA invalid content | TC-SZ-011 through TC-SZ-019 | SZ-101 through SZ-109 |
| Metrics at boundaries | TC-SZ-020 through TC-SZ-027 | FR-02 (AC-04, AC-05, AC-07) |
| Metrics with risk override | TC-SZ-028 through TC-SZ-030 | FR-02 (AC-07), ADR-0002 |
| Null metrics | TC-SZ-031, TC-SZ-032 | FR-01 (AC-03) |
| Invalid thresholds | TC-SZ-033 through TC-SZ-035 | SZ-202 through SZ-204 |
| Standard feature state | TC-SZ-036 through TC-SZ-046 | FR-05 (AC-15 through AC-18) |
| Invariant failure states | TC-SZ-047 through TC-SZ-050 | SZ-301 through SZ-304 |
| Invalid intensity values | TC-SZ-051, TC-SZ-052 | SZ-305 |
| Empty/null state | TC-SZ-053, TC-SZ-054 | SZ-300 |
| SizingData flag/override | TC-SZ-058 through TC-SZ-061 | FR-04 (AC-12), FR-07 (AC-24) |
| Integration content | TC-SZ-062 through TC-SZ-069 | End-to-end validation |
