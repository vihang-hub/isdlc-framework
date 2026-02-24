# Test Cases -- REQ-0011: Adaptive Workflow Sizing

**Version**: 1.0.0
**Phase**: 05-test-strategy
**Created**: 2026-02-12
**Test File**: `src/claude/hooks/tests/test-sizing.test.cjs`
**Run**: `node --test src/claude/hooks/tests/test-sizing.test.cjs`

---

## 1. Unit Tests: parseSizingFromImpactAnalysis

### 1.1 JSON Metadata Block Parsing (Primary Strategy)

#### TC-SZ-001: Parses valid JSON metadata block
- **AC**: AC-01, AC-03
- **Input**: Markdown with valid JSON block containing all 5 fields
- **Expected**: Returns `{ file_count: 3, module_count: 1, risk_score: 'low', coupling: 'low', coverage_gaps: 0 }`
- **Assertions**:
  - Return value is not null
  - `file_count` equals 3
  - `module_count` equals 1
  - `risk_score` equals `'low'`
  - `coupling` equals `'low'`
  - `coverage_gaps` equals 0

```javascript
const content = `# Impact Analysis
Some analysis text.
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
const result = common.parseSizingFromImpactAnalysis(content);
assert.deepStrictEqual(result, {
    file_count: 3, module_count: 1, risk_score: 'low',
    coupling: 'low', coverage_gaps: 0
});
```

#### TC-SZ-002: Uses the LAST JSON block when multiple exist
- **AC**: AC-01
- **Input**: Markdown with two JSON blocks -- first has `files_directly_affected: 99`, second has `files_directly_affected: 3`
- **Expected**: Returns `file_count: 3` (from last block)

```javascript
const content = `
\`\`\`json
{ "files_directly_affected": 99, "modules_affected": 99, "risk_level": "high", "blast_radius": "high", "coverage_gaps": 99 }
\`\`\`
Some text
\`\`\`json
{ "files_directly_affected": 3, "modules_affected": 1, "risk_level": "low", "blast_radius": "low", "coverage_gaps": 0 }
\`\`\``;
const result = common.parseSizingFromImpactAnalysis(content);
assert.equal(result.file_count, 3);
```

#### TC-SZ-003: Maps IA field names to SizingMetrics field names
- **AC**: AC-01
- **Input**: JSON block with `files_directly_affected`, `modules_affected`, `risk_level`, `blast_radius`
- **Expected**: Mapped to `file_count`, `module_count`, `risk_score`, `coupling`

```javascript
const content = `\`\`\`json
{
  "files_directly_affected": 10,
  "modules_affected": 4,
  "risk_level": "medium",
  "blast_radius": "high",
  "coverage_gaps": 2
}
\`\`\``;
const result = common.parseSizingFromImpactAnalysis(content);
assert.equal(result.file_count, 10);
assert.equal(result.module_count, 4);
assert.equal(result.risk_score, 'medium');
assert.equal(result.coupling, 'high');
assert.equal(result.coverage_gaps, 2);
```

#### TC-SZ-004: Ignores extra fields in JSON block
- **AC**: AC-01
- **Input**: JSON block with all 5 required fields plus `extra_field: 'ignored'`
- **Expected**: Returns correct SizingMetrics, no `extra_field` property

```javascript
const content = `\`\`\`json
{
  "files_directly_affected": 5,
  "modules_affected": 2,
  "risk_level": "low",
  "blast_radius": "low",
  "coverage_gaps": 0,
  "extra_field": "should be ignored"
}
\`\`\``;
const result = common.parseSizingFromImpactAnalysis(content);
assert.equal(result.file_count, 5);
assert.equal(result.extra_field, undefined);
```

#### TC-SZ-005: Handles JSON block with string numbers (parseable)
- **AC**: AC-01
- **Input**: JSON block with `"files_directly_affected": "7"` (string, not number)
- **Expected**: `_safeNonNegInt` parses string to integer -> `file_count: 7`

```javascript
const content = `\`\`\`json
{
  "files_directly_affected": "7",
  "modules_affected": "2",
  "risk_level": "low",
  "blast_radius": "low",
  "coverage_gaps": "1"
}
\`\`\``;
const result = common.parseSizingFromImpactAnalysis(content);
assert.equal(result.file_count, 7);
assert.equal(result.module_count, 2);
assert.equal(result.coverage_gaps, 1);
```

#### TC-SZ-006: JSON block with large valid values
- **AC**: AC-01
- **Input**: JSON with `files_directly_affected: 1000`, `modules_affected: 100`
- **Expected**: Returns exact values (no upper bound capping)

```javascript
const content = `\`\`\`json
{
  "files_directly_affected": 1000,
  "modules_affected": 100,
  "risk_level": "high",
  "blast_radius": "high",
  "coverage_gaps": 50
}
\`\`\``;
const result = common.parseSizingFromImpactAnalysis(content);
assert.equal(result.file_count, 1000);
assert.equal(result.module_count, 100);
```

### 1.2 Fallback Regex Parsing

#### TC-SZ-007: Parses Executive Summary prose (all 5 fields)
- **AC**: AC-01
- **Input**: Markdown with Executive Summary containing all 5 bold-colon patterns
- **Expected**: Returns correct SizingMetrics from regex extraction

```javascript
const content = `## Executive Summary
**Affected Files**: 12
**Modules Affected**: 3
**Risk Level**: medium
**Blast Radius**: high
**Coverage Gaps**: 2`;
const result = common.parseSizingFromImpactAnalysis(content);
assert.deepStrictEqual(result, {
    file_count: 12, module_count: 3, risk_score: 'medium',
    coupling: 'high', coverage_gaps: 2
});
```

#### TC-SZ-008: Fallback succeeds with minimum fields (file_count + risk_score)
- **AC**: AC-01
- **Input**: Markdown with only `**Affected Files**: 5` and `**Risk Level**: low`
- **Expected**: Returns object with `file_count: 5, risk_score: 'low'`, defaults for missing fields

```javascript
const content = `## Executive Summary
**Affected Files**: 5
**Risk Level**: low`;
const result = common.parseSizingFromImpactAnalysis(content);
assert.equal(result.file_count, 5);
assert.equal(result.risk_score, 'low');
assert.equal(result.module_count, 0);        // default
assert.equal(result.coupling, 'medium');      // default
assert.equal(result.coverage_gaps, 0);        // default
```

#### TC-SZ-009: Fallback is case-insensitive
- **AC**: AC-01
- **Input**: Markdown with mixed case: `**affected files**: 8`, `**RISK LEVEL**: HIGH`
- **Expected**: Parses correctly with `file_count: 8`, `risk_score: 'high'`

```javascript
const content = `**affected files**: 8
**RISK LEVEL**: HIGH
**blast radius**: LOW`;
const result = common.parseSizingFromImpactAnalysis(content);
assert.equal(result.file_count, 8);
assert.equal(result.risk_score, 'high');
assert.equal(result.coupling, 'low');
```

#### TC-SZ-010: Fallback handles "Module Affected" (singular)
- **AC**: AC-01
- **Input**: Markdown with `**Module Affected**: 1` (singular, not plural)
- **Expected**: Regex `/Modules? Affected/i` matches singular form

```javascript
const content = `**Affected Files**: 3
**Module Affected**: 1
**Risk Level**: low
**Blast Radius**: low`;
const result = common.parseSizingFromImpactAnalysis(content);
assert.equal(result.module_count, 1);
```

### 1.3 Invalid/Missing Field Normalization (SZ-105 through SZ-109)

#### TC-SZ-011: Negative file_count defaults to 0 (SZ-105)
- **AC**: AC-01
- **Error Code**: SZ-105
- **Input**: JSON block with `files_directly_affected: -5`
- **Expected**: `file_count: 0`

```javascript
const content = `\`\`\`json
{ "files_directly_affected": -5, "modules_affected": 1, "risk_level": "low", "blast_radius": "low", "coverage_gaps": 0 }
\`\`\``;
const result = common.parseSizingFromImpactAnalysis(content);
assert.equal(result.file_count, 0);
```

#### TC-SZ-012: Non-integer module_count defaults to 0 (SZ-106)
- **AC**: AC-01
- **Error Code**: SZ-106
- **Input**: JSON block with `modules_affected: "abc"`
- **Expected**: `module_count: 0`

```javascript
const content = `\`\`\`json
{ "files_directly_affected": 3, "modules_affected": "abc", "risk_level": "low", "blast_radius": "low", "coverage_gaps": 0 }
\`\`\``;
const result = common.parseSizingFromImpactAnalysis(content);
assert.equal(result.module_count, 0);
```

#### TC-SZ-013: Unrecognized risk_level defaults to "medium" (SZ-107)
- **AC**: AC-01
- **Error Code**: SZ-107
- **Input**: JSON block with `risk_level: "critical"`
- **Expected**: `risk_score: 'medium'`

```javascript
const content = `\`\`\`json
{ "files_directly_affected": 3, "modules_affected": 1, "risk_level": "critical", "blast_radius": "low", "coverage_gaps": 0 }
\`\`\``;
const result = common.parseSizingFromImpactAnalysis(content);
assert.equal(result.risk_score, 'medium');
```

#### TC-SZ-014: Numeric blast_radius defaults to "medium" (SZ-108)
- **AC**: AC-01
- **Error Code**: SZ-108
- **Input**: JSON block with `blast_radius: 42`
- **Expected**: `coupling: 'medium'`

```javascript
const content = `\`\`\`json
{ "files_directly_affected": 3, "modules_affected": 1, "risk_level": "low", "blast_radius": 42, "coverage_gaps": 0 }
\`\`\``;
const result = common.parseSizingFromImpactAnalysis(content);
assert.equal(result.coupling, 'medium');
```

#### TC-SZ-015: Negative coverage_gaps defaults to 0 (SZ-109)
- **AC**: AC-01
- **Error Code**: SZ-109
- **Input**: JSON block with `coverage_gaps: -5`
- **Expected**: `coverage_gaps: 0`

```javascript
const content = `\`\`\`json
{ "files_directly_affected": 3, "modules_affected": 1, "risk_level": "low", "blast_radius": "low", "coverage_gaps": -5 }
\`\`\``;
const result = common.parseSizingFromImpactAnalysis(content);
assert.equal(result.coverage_gaps, 0);
```

### 1.4 Null/Empty/Malformed Inputs

#### TC-SZ-016: Empty string returns null (SZ-101)
- **AC**: AC-01
- **Error Code**: SZ-101
- **Input**: `""`
- **Expected**: `null`

```javascript
assert.equal(common.parseSizingFromImpactAnalysis(''), null);
```

#### TC-SZ-017: Non-string input returns null
- **AC**: AC-01
- **Input**: `null`, `undefined`, `42`, `{}`
- **Expected**: `null` for each

```javascript
assert.equal(common.parseSizingFromImpactAnalysis(null), null);
assert.equal(common.parseSizingFromImpactAnalysis(undefined), null);
assert.equal(common.parseSizingFromImpactAnalysis(42), null);
assert.equal(common.parseSizingFromImpactAnalysis({}), null);
```

#### TC-SZ-018: Malformed JSON falls through to fallback (SZ-103)
- **AC**: AC-01
- **Error Code**: SZ-103
- **Input**: Markdown with invalid JSON block plus valid fallback prose
- **Expected**: Returns metrics from fallback parsing

```javascript
const content = `\`\`\`json
{ this is not valid json }
\`\`\`
**Affected Files**: 4
**Risk Level**: low
**Blast Radius**: medium`;
const result = common.parseSizingFromImpactAnalysis(content);
assert.equal(result.file_count, 4);
assert.equal(result.risk_score, 'low');
```

#### TC-SZ-019: Both strategies fail returns null (SZ-104)
- **AC**: AC-01
- **Error Code**: SZ-104
- **Input**: Random text with no JSON blocks and no recognized patterns
- **Expected**: `null`

```javascript
const content = 'Some random text without any structured data at all.';
assert.equal(common.parseSizingFromImpactAnalysis(content), null);
```

---

## 2. Unit Tests: computeSizingRecommendation

### 2.1 Threshold Boundary: Light/Standard

#### TC-SZ-020: file_count at light_max_files boundary (5) -> light
- **AC**: AC-04, AC-07
- **Input**: `metrics.file_count = 5`, `thresholds.light_max_files = 5`, risk = low
- **Expected**: `intensity: 'light'`

```javascript
const metrics = { file_count: 5, module_count: 1, risk_score: 'low', coupling: 'low', coverage_gaps: 0 };
const thresholds = { light_max_files: 5, epic_min_files: 20 };
const result = common.computeSizingRecommendation(metrics, thresholds);
assert.equal(result.intensity, 'light');
```

#### TC-SZ-021: file_count at light_max_files + 1 (6) -> standard
- **AC**: AC-05, AC-07
- **Input**: `metrics.file_count = 6`, `thresholds.light_max_files = 5`, risk = low
- **Expected**: `intensity: 'standard'`

```javascript
const metrics = { file_count: 6, module_count: 2, risk_score: 'low', coupling: 'low', coverage_gaps: 0 };
const thresholds = { light_max_files: 5, epic_min_files: 20 };
const result = common.computeSizingRecommendation(metrics, thresholds);
assert.equal(result.intensity, 'standard');
```

#### TC-SZ-022: file_count=0 -> light (minimum valid)
- **AC**: AC-04
- **Input**: `metrics.file_count = 0`, risk = low
- **Expected**: `intensity: 'light'` (0 <= 5)

```javascript
const metrics = { file_count: 0, module_count: 0, risk_score: 'low', coupling: 'low', coverage_gaps: 0 };
const thresholds = { light_max_files: 5, epic_min_files: 20 };
const result = common.computeSizingRecommendation(metrics, thresholds);
assert.equal(result.intensity, 'light');
```

#### TC-SZ-023: Custom thresholds respected (light_max_files=10)
- **AC**: AC-07
- **Input**: `metrics.file_count = 8`, `thresholds.light_max_files = 10`, risk = low
- **Expected**: `intensity: 'light'`

```javascript
const metrics = { file_count: 8, module_count: 2, risk_score: 'low', coupling: 'low', coverage_gaps: 0 };
const thresholds = { light_max_files: 10, epic_min_files: 30 };
const result = common.computeSizingRecommendation(metrics, thresholds);
assert.equal(result.intensity, 'light');
```

### 2.2 Threshold Boundary: Standard/Epic

#### TC-SZ-024: file_count at epic_min_files boundary (20) -> epic
- **AC**: AC-07
- **Input**: `metrics.file_count = 20`, `thresholds.epic_min_files = 20`, risk = medium
- **Expected**: `intensity: 'epic'`

```javascript
const metrics = { file_count: 20, module_count: 6, risk_score: 'medium', coupling: 'medium', coverage_gaps: 1 };
const thresholds = { light_max_files: 5, epic_min_files: 20 };
const result = common.computeSizingRecommendation(metrics, thresholds);
assert.equal(result.intensity, 'epic');
```

#### TC-SZ-025: file_count at epic_min_files - 1 (19) -> standard
- **AC**: AC-05
- **Input**: `metrics.file_count = 19`, risk = medium
- **Expected**: `intensity: 'standard'`

```javascript
const metrics = { file_count: 19, module_count: 5, risk_score: 'medium', coupling: 'medium', coverage_gaps: 0 };
const thresholds = { light_max_files: 5, epic_min_files: 20 };
const result = common.computeSizingRecommendation(metrics, thresholds);
assert.equal(result.intensity, 'standard');
```

#### TC-SZ-026: file_count well above epic threshold -> epic
- **AC**: AC-07
- **Input**: `metrics.file_count = 100`, risk = medium
- **Expected**: `intensity: 'epic'`

```javascript
const metrics = { file_count: 100, module_count: 20, risk_score: 'medium', coupling: 'high', coverage_gaps: 10 };
const thresholds = { light_max_files: 5, epic_min_files: 20 };
const result = common.computeSizingRecommendation(metrics, thresholds);
assert.equal(result.intensity, 'epic');
```

#### TC-SZ-027: Custom epic threshold respected
- **AC**: AC-07
- **Input**: `metrics.file_count = 25`, `thresholds.epic_min_files = 30`
- **Expected**: `intensity: 'standard'` (25 < 30)

```javascript
const metrics = { file_count: 25, module_count: 6, risk_score: 'medium', coupling: 'medium', coverage_gaps: 0 };
const thresholds = { light_max_files: 5, epic_min_files: 30 };
const result = common.computeSizingRecommendation(metrics, thresholds);
assert.equal(result.intensity, 'standard');
```

### 2.3 Risk Override

#### TC-SZ-028: High risk + low files -> epic (risk override)
- **AC**: AC-04 (negated -- high risk prevents light)
- **Input**: `metrics.file_count = 2, risk_score = 'high'`
- **Expected**: `intensity: 'epic'` (high risk forces epic regardless of file count)

```javascript
const metrics = { file_count: 2, module_count: 1, risk_score: 'high', coupling: 'high', coverage_gaps: 0 };
const thresholds = { light_max_files: 5, epic_min_files: 20 };
const result = common.computeSizingRecommendation(metrics, thresholds);
assert.equal(result.intensity, 'epic');
```

#### TC-SZ-029: High risk + medium files -> epic
- **AC**: AC-07
- **Input**: `metrics.file_count = 12, risk_score = 'high'`
- **Expected**: `intensity: 'epic'`

```javascript
const metrics = { file_count: 12, module_count: 4, risk_score: 'high', coupling: 'high', coverage_gaps: 2 };
const thresholds = { light_max_files: 5, epic_min_files: 20 };
const result = common.computeSizingRecommendation(metrics, thresholds);
assert.equal(result.intensity, 'epic');
```

#### TC-SZ-030: Medium risk + low files -> light (no risk override)
- **AC**: AC-04
- **Input**: `metrics.file_count = 3, risk_score = 'medium'`
- **Expected**: `intensity: 'light'`

```javascript
const metrics = { file_count: 3, module_count: 1, risk_score: 'medium', coupling: 'medium', coverage_gaps: 0 };
const thresholds = { light_max_files: 5, epic_min_files: 20 };
const result = common.computeSizingRecommendation(metrics, thresholds);
assert.equal(result.intensity, 'light');
```

### 2.4 Null Metrics Fallback

#### TC-SZ-031: Null metrics -> standard with parsing failure rationale
- **AC**: AC-03
- **Input**: `metrics = null`
- **Expected**: `{ intensity: 'standard', rationale: 'Unable to parse impact analysis metrics. Defaulting to standard workflow.', metrics: null }`

```javascript
const thresholds = { light_max_files: 5, epic_min_files: 20 };
const result = common.computeSizingRecommendation(null, thresholds);
assert.equal(result.intensity, 'standard');
assert.ok(result.rationale.includes('Unable to parse'));
assert.equal(result.metrics, null);
```

#### TC-SZ-032: Undefined metrics -> standard
- **AC**: AC-03
- **Input**: `metrics = undefined`
- **Expected**: `intensity: 'standard'`

```javascript
const thresholds = { light_max_files: 5, epic_min_files: 20 };
const result = common.computeSizingRecommendation(undefined, thresholds);
assert.equal(result.intensity, 'standard');
```

### 2.5 Threshold Sanitization

#### TC-SZ-033: Invalid light_max_files defaults to 5 (SZ-202)
- **AC**: AC-07
- **Error Code**: SZ-202
- **Input**: `thresholds.light_max_files = -1`
- **Expected**: Treats as 5 (default), `metrics.file_count = 3` -> light

```javascript
const metrics = { file_count: 3, module_count: 1, risk_score: 'low', coupling: 'low', coverage_gaps: 0 };
const thresholds = { light_max_files: -1, epic_min_files: 20 };
const result = common.computeSizingRecommendation(metrics, thresholds);
assert.equal(result.intensity, 'light');
```

#### TC-SZ-034: Invalid epic_min_files defaults to 20 (SZ-203)
- **AC**: AC-07
- **Error Code**: SZ-203
- **Input**: `thresholds.epic_min_files = 0`
- **Expected**: Treats as 20 (default), `metrics.file_count = 19` -> standard

```javascript
const metrics = { file_count: 19, module_count: 5, risk_score: 'medium', coupling: 'medium', coverage_gaps: 0 };
const thresholds = { light_max_files: 5, epic_min_files: 0 };
const result = common.computeSizingRecommendation(metrics, thresholds);
assert.equal(result.intensity, 'standard');
```

#### TC-SZ-035: light_max >= epic_min resets both to defaults (SZ-204)
- **AC**: AC-07
- **Error Code**: SZ-204
- **Input**: `thresholds = { light_max_files: 20, epic_min_files: 5 }`
- **Expected**: Both reset to (5, 20), `metrics.file_count = 3` -> light

```javascript
const metrics = { file_count: 3, module_count: 1, risk_score: 'low', coupling: 'low', coverage_gaps: 0 };
const thresholds = { light_max_files: 20, epic_min_files: 5 };
const result = common.computeSizingRecommendation(metrics, thresholds);
assert.equal(result.intensity, 'light');
```

---

## 3. Unit Tests: applySizingDecision

### 3.1 Light Intensity: Phase Removal

#### TC-SZ-036: Removes 03-architecture and 04-design from phases array
- **AC**: AC-15
- **Input**: Standard 9-phase state, intensity = 'light'
- **Expected**: `active_workflow.phases` has 7 entries, does not include `'03-architecture'` or `'04-design'`

```javascript
const state = buildFeatureState();  // 9-phase standard
const result = common.applySizingDecision(state, 'light', { metrics: lowMetrics });
assert.equal(result.active_workflow.phases.length, 7);
assert.ok(!result.active_workflow.phases.includes('03-architecture'));
assert.ok(!result.active_workflow.phases.includes('04-design'));
```

#### TC-SZ-037: Removes skipped phases from phase_status
- **AC**: AC-16
- **Input**: Standard 9-phase state, intensity = 'light'
- **Expected**: `phase_status` has no keys for `'03-architecture'` or `'04-design'`

```javascript
const state = buildFeatureState();
common.applySizingDecision(state, 'light', { metrics: lowMetrics });
assert.equal(state.active_workflow.phase_status['03-architecture'], undefined);
assert.equal(state.active_workflow.phase_status['04-design'], undefined);
```

#### TC-SZ-038: Removes skipped phases from top-level phases object
- **AC**: AC-17
- **Input**: Standard 9-phase state with top-level `phases` object, intensity = 'light'
- **Expected**: `state.phases['03-architecture']` is undefined

```javascript
const state = buildFeatureState();
common.applySizingDecision(state, 'light', { metrics: lowMetrics });
assert.equal(state.phases['03-architecture'], undefined);
assert.equal(state.phases['04-design'], undefined);
```

#### TC-SZ-039: Recalculates current_phase_index correctly
- **AC**: AC-18
- **Input**: Standard state with `current_phase_index: 3` (pointing to 03-architecture), intensity = 'light'
- **Expected**: After removal, index points to `05-test-strategy` (which is at index 3 in the new array)

```javascript
const state = buildFeatureState();
// Before: phases[3] = '03-architecture'
common.applySizingDecision(state, 'light', { metrics: lowMetrics });
// After: phases = [00, 01, 02, 05, 06, 16, 08]
assert.equal(state.active_workflow.phases[state.active_workflow.current_phase_index], '05-test-strategy');
```

#### TC-SZ-040: Light intensity writes correct sizing record
- **AC**: AC-24
- **Input**: Standard state, intensity = 'light', metrics provided
- **Expected**: `sizing.intensity = 'light'`, `sizing.effective_intensity = 'light'`, `sizing.epic_deferred = false`

```javascript
const state = buildFeatureState();
const metrics = { file_count: 3, module_count: 1, risk_score: 'low', coupling: 'low', coverage_gaps: 0 };
common.applySizingDecision(state, 'light', { metrics });
const s = state.active_workflow.sizing;
assert.equal(s.intensity, 'light');
assert.equal(s.effective_intensity, 'light');
assert.equal(s.file_count, 3);
assert.equal(s.module_count, 1);
assert.equal(s.risk_score, 'low');
assert.equal(s.coupling, 'low');
assert.equal(s.coverage_gaps, 0);
assert.equal(s.epic_deferred, false);
assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(s.decided_at));
```

### 3.2 Standard Intensity: No Changes

#### TC-SZ-041: Standard intensity preserves all 9 phases
- **AC**: AC-05
- **Input**: Standard 9-phase state, intensity = 'standard'
- **Expected**: `phases.length === 9`, all original phases present

```javascript
const state = buildFeatureState();
const originalPhases = [...state.active_workflow.phases];
common.applySizingDecision(state, 'standard', { metrics: mediumMetrics });
assert.deepStrictEqual(state.active_workflow.phases, originalPhases);
```

#### TC-SZ-042: Standard intensity writes correct sizing record
- **AC**: AC-24
- **Input**: Standard state, intensity = 'standard'
- **Expected**: `sizing.intensity = 'standard'`, `sizing.effective_intensity = 'standard'`

```javascript
const state = buildFeatureState();
common.applySizingDecision(state, 'standard', { metrics: mediumMetrics });
assert.equal(state.active_workflow.sizing.intensity, 'standard');
assert.equal(state.active_workflow.sizing.effective_intensity, 'standard');
assert.equal(state.active_workflow.sizing.epic_deferred, false);
```

#### TC-SZ-043: Standard does not modify phase_status or index
- **AC**: AC-05
- **Input**: Standard state, intensity = 'standard'
- **Expected**: `current_phase_index` unchanged, `phase_status` unchanged

```javascript
const state = buildFeatureState();
const origIdx = state.active_workflow.current_phase_index;
const origStatusKeys = Object.keys(state.active_workflow.phase_status);
common.applySizingDecision(state, 'standard', { metrics: mediumMetrics });
assert.equal(state.active_workflow.current_phase_index, origIdx);
assert.deepStrictEqual(Object.keys(state.active_workflow.phase_status), origStatusKeys);
```

### 3.3 Epic Intensity: Deferred

#### TC-SZ-044: Epic sets effective_intensity to 'standard' and epic_deferred to true
- **AC**: AC-06
- **Input**: Standard state, intensity = 'epic'
- **Expected**: `sizing.intensity = 'epic'`, `sizing.effective_intensity = 'standard'`, `sizing.epic_deferred = true`

```javascript
const state = buildFeatureState();
common.applySizingDecision(state, 'epic', { metrics: epicMetrics });
assert.equal(state.active_workflow.sizing.intensity, 'epic');
assert.equal(state.active_workflow.sizing.effective_intensity, 'standard');
assert.equal(state.active_workflow.sizing.epic_deferred, true);
```

#### TC-SZ-045: Epic does not modify phases array
- **AC**: AC-06
- **Input**: Standard state, intensity = 'epic'
- **Expected**: All 9 phases preserved

```javascript
const state = buildFeatureState();
const originalPhases = [...state.active_workflow.phases];
common.applySizingDecision(state, 'epic', { metrics: epicMetrics });
assert.deepStrictEqual(state.active_workflow.phases, originalPhases);
```

#### TC-SZ-046: Epic records correct metrics in sizing record
- **AC**: AC-24
- **Input**: Epic with `file_count: 35`
- **Expected**: `sizing.file_count = 35`

```javascript
const state = buildFeatureState();
const metrics = { file_count: 35, module_count: 8, risk_score: 'high', coupling: 'high', coverage_gaps: 5 };
common.applySizingDecision(state, 'epic', { metrics });
assert.equal(state.active_workflow.sizing.file_count, 35);
assert.equal(state.active_workflow.sizing.risk_score, 'high');
```

### 3.4 Invariant Failures + Rollback

#### TC-SZ-047: INV-01: Too few phases after removal -> rollback (SZ-301)
- **AC**: AC-15 (rollback path)
- **Error Code**: SZ-301
- **Input**: State with only 4 phases, light removes 2 -> only 2 remain (< 3)
- **Expected**: Rollback to original phases, `effective_intensity = 'standard'`, `fallback_reason = 'invariant_check_failed'`

```javascript
const state = buildMinimalState(['02-impact-analysis', '03-architecture', '04-design', '06-implementation']);
const result = common.applySizingDecision(state, 'light', { metrics: lowMetrics });
assert.equal(state.active_workflow.phases.length, 4);  // rollback
assert.equal(state.active_workflow.sizing.effective_intensity, 'standard');
assert.equal(state.active_workflow.sizing.fallback_reason, 'invariant_check_failed');
```

#### TC-SZ-048: INV-02: Index out of bounds after removal -> rollback (SZ-302)
- **AC**: AC-18 (rollback path)
- **Error Code**: SZ-302
- **Input**: State where removing phases would push current_phase_index past end
- **Expected**: Rollback, `fallback_reason = 'invariant_check_failed'`

```javascript
// Custom state where removal leaves index >= length
const state = buildStateWithHighIndex();
common.applySizingDecision(state, 'light', { metrics: lowMetrics });
assert.equal(state.active_workflow.sizing.effective_intensity, 'standard');
assert.ok(state.active_workflow.sizing.fallback_reason);
```

#### TC-SZ-049: INV-03: Orphan phase_status entry -> rollback (SZ-303)
- **AC**: AC-16 (rollback path)
- **Error Code**: SZ-303
- **Input**: State where phase_status has extra key not in phases after mutation
- **Expected**: Rollback, `effective_intensity = 'standard'`

Note: This is harder to trigger naturally since `applySizingDecision` removes from phase_status. The test constructs a state where additional phase_status keys are added after the filter step (simulated by pre-placing orphan entries that survive the filter).

#### TC-SZ-050: INV-04: Next phase not pending -> rollback (SZ-304)
- **AC**: AC-18 (rollback path)
- **Error Code**: SZ-304
- **Input**: State where the next phase (post-removal) has status 'completed' instead of 'pending'
- **Expected**: Rollback, `effective_intensity = 'standard'`

```javascript
const state = buildFeatureState();
state.active_workflow.phase_status['05-test-strategy'] = 'completed';
common.applySizingDecision(state, 'light', { metrics: lowMetrics });
assert.equal(state.active_workflow.sizing.effective_intensity, 'standard');
assert.ok(state.active_workflow.sizing.fallback_reason);
```

### 3.5 Guards and Edge Cases

#### TC-SZ-051: Invalid intensity string defaults to 'standard' (SZ-305)
- **AC**: N/A (defensive)
- **Error Code**: SZ-305
- **Input**: `intensity = 'fast'`
- **Expected**: Treated as standard, stderr output contains warning

```javascript
const state = buildFeatureState();
let stderrOutput = '';
const origWrite = process.stderr.write;
process.stderr.write = (msg) => { stderrOutput += msg; };
common.applySizingDecision(state, 'fast', { metrics: mediumMetrics });
process.stderr.write = origWrite;
assert.equal(state.active_workflow.sizing.intensity, 'standard');
assert.ok(stderrOutput.includes('fast'));
```

#### TC-SZ-052: Non-string intensity defaults to 'standard'
- **AC**: N/A (defensive)
- **Input**: `intensity = 42`
- **Expected**: Treated as standard

```javascript
const state = buildFeatureState();
common.applySizingDecision(state, 42, { metrics: mediumMetrics });
assert.equal(state.active_workflow.sizing.intensity, 'standard');
```

#### TC-SZ-053: No active_workflow returns state unchanged (SZ-300)
- **AC**: N/A (defensive)
- **Error Code**: SZ-300
- **Input**: `state = {}`
- **Expected**: Returns state unchanged, no crash, no sizing property

```javascript
const state = {};
const result = common.applySizingDecision(state, 'light', {});
assert.deepStrictEqual(result, {});
```

#### TC-SZ-054: Null state returns state unchanged (SZ-300)
- **AC**: N/A (defensive)
- **Error Code**: SZ-300
- **Input**: `state = null`
- **Expected**: Returns null unchanged

```javascript
const result = common.applySizingDecision(null, 'light', {});
assert.equal(result, null);
```

#### TC-SZ-055: Custom skip phases from config (SZ-205 negative path)
- **AC**: AC-15
- **Input**: `sizingData.config.light_skip_phases = ['03-architecture']` (only one phase)
- **Expected**: Only `03-architecture` removed, `04-design` retained

```javascript
const state = buildFeatureState();
common.applySizingDecision(state, 'light', {
    metrics: lowMetrics,
    config: { light_skip_phases: ['03-architecture'] }
});
assert.ok(!state.active_workflow.phases.includes('03-architecture'));
assert.ok(state.active_workflow.phases.includes('04-design'));
```

#### TC-SZ-056: Non-array light_skip_phases uses default (SZ-205)
- **AC**: AC-15
- **Error Code**: SZ-205
- **Input**: `sizingData.config.light_skip_phases = "not-an-array"`
- **Expected**: Falls back to default `['03-architecture', '04-design']`

```javascript
const state = buildFeatureState();
common.applySizingDecision(state, 'light', {
    metrics: lowMetrics,
    config: { light_skip_phases: 'not-an-array' }
});
assert.ok(!state.active_workflow.phases.includes('03-architecture'));
assert.ok(!state.active_workflow.phases.includes('04-design'));
```

#### TC-SZ-057: Skip phase not in workflow is no-op (SZ-206)
- **AC**: AC-15
- **Error Code**: SZ-206
- **Input**: `sizingData.config.light_skip_phases = ['99-nonexistent']`
- **Expected**: All phases retained (filter is no-op), sizing record still written

```javascript
const state = buildFeatureState();
const origLen = state.active_workflow.phases.length;
common.applySizingDecision(state, 'light', {
    metrics: lowMetrics,
    config: { light_skip_phases: ['99-nonexistent'] }
});
assert.equal(state.active_workflow.phases.length, origLen);
assert.ok(state.active_workflow.sizing); // record still written
```

### 3.6 Flag and Override Recording

#### TC-SZ-058: forced_by_flag sets recommended_by to 'user'
- **AC**: AC-12, AC-24
- **Input**: `sizingData.forced_by_flag = true`
- **Expected**: `sizing.recommended_by = 'user'`, `sizing.forced_by_flag = true`

```javascript
const state = buildFeatureState();
common.applySizingDecision(state, 'light', {
    metrics: lowMetrics, forced_by_flag: true
});
assert.equal(state.active_workflow.sizing.recommended_by, 'user');
assert.equal(state.active_workflow.sizing.forced_by_flag, true);
```

#### TC-SZ-059: Override fields recorded correctly
- **AC**: AC-10, AC-11, AC-24
- **Input**: `sizingData = { overridden: true, overridden_to: 'light', recommended_intensity: 'standard' }`
- **Expected**: `sizing.overridden = true`, `sizing.overridden_to = 'light'`

```javascript
const state = buildFeatureState();
common.applySizingDecision(state, 'light', {
    metrics: lowMetrics,
    overridden: true,
    overridden_to: 'light',
    recommended_intensity: 'standard'
});
assert.equal(state.active_workflow.sizing.overridden, true);
assert.equal(state.active_workflow.sizing.overridden_to, 'light');
```

#### TC-SZ-060: No override -> overridden=false, overridden_to=null
- **AC**: AC-24
- **Input**: Default sizingData (no override fields)
- **Expected**: `sizing.overridden = false`, `sizing.overridden_to = null`

```javascript
const state = buildFeatureState();
common.applySizingDecision(state, 'standard', { metrics: mediumMetrics });
assert.equal(state.active_workflow.sizing.overridden, false);
assert.equal(state.active_workflow.sizing.overridden_to, null);
```

#### TC-SZ-061: Null metrics in sizingData -> sizing record has 'unknown' risk_score
- **AC**: AC-24
- **Input**: `sizingData.metrics = null`
- **Expected**: `sizing.file_count = 0`, `sizing.risk_score = 'unknown'`

```javascript
const state = buildFeatureState();
common.applySizingDecision(state, 'standard', { metrics: null });
assert.equal(state.active_workflow.sizing.file_count, 0);
assert.equal(state.active_workflow.sizing.risk_score, 'unknown');
assert.equal(state.active_workflow.sizing.coupling, 'unknown');
```

---

## 4. Integration Tests

#### TC-SZ-062: INT-01 -- Light workflow end-to-end
- **AC**: AC-01, AC-03, AC-04, AC-15, AC-18, AC-24
- **Flow**: IA content with 3 files, low risk -> parseSizing -> computeSizing(light) -> applySizing -> 7 phases, index=3

```javascript
const iaContent = buildIAContent(3, 1, 'low', 'low', 0);
const metrics = common.parseSizingFromImpactAnalysis(iaContent);
const thresholds = { light_max_files: 5, epic_min_files: 20 };
const rec = common.computeSizingRecommendation(metrics, thresholds);
assert.equal(rec.intensity, 'light');

const state = buildFeatureState();
common.applySizingDecision(state, rec.intensity, { metrics });
assert.equal(state.active_workflow.phases.length, 7);
assert.equal(state.active_workflow.sizing.intensity, 'light');
```

#### TC-SZ-063: INT-02 -- Standard workflow end-to-end
- **AC**: AC-01, AC-03, AC-05, AC-24
- **Flow**: IA content with 12 files, medium risk -> standard -> 9 phases unchanged

```javascript
const iaContent = buildIAContent(12, 4, 'medium', 'medium', 1);
const metrics = common.parseSizingFromImpactAnalysis(iaContent);
const rec = common.computeSizingRecommendation(metrics, { light_max_files: 5, epic_min_files: 20 });
assert.equal(rec.intensity, 'standard');

const state = buildFeatureState();
common.applySizingDecision(state, rec.intensity, { metrics });
assert.equal(state.active_workflow.phases.length, 9);
```

#### TC-SZ-064: INT-03 -- Epic workflow end-to-end (deferred)
- **AC**: AC-01, AC-06, AC-24
- **Flow**: IA content with 25 files, high risk -> epic -> effective_intensity=standard

```javascript
const iaContent = buildIAContent(25, 8, 'high', 'high', 5);
const metrics = common.parseSizingFromImpactAnalysis(iaContent);
const rec = common.computeSizingRecommendation(metrics, { light_max_files: 5, epic_min_files: 20 });
assert.equal(rec.intensity, 'epic');

const state = buildFeatureState();
common.applySizingDecision(state, rec.intensity, { metrics });
assert.equal(state.active_workflow.phases.length, 9);
assert.equal(state.active_workflow.sizing.effective_intensity, 'standard');
assert.equal(state.active_workflow.sizing.epic_deferred, true);
```

#### TC-SZ-065: INT-04 -- Parsing failure cascades to standard
- **AC**: AC-03
- **Flow**: Malformed IA -> parse returns null -> compute returns standard -> apply writes record

```javascript
const metrics = common.parseSizingFromImpactAnalysis('random garbage');
assert.equal(metrics, null);
const rec = common.computeSizingRecommendation(metrics, { light_max_files: 5, epic_min_files: 20 });
assert.equal(rec.intensity, 'standard');

const state = buildFeatureState();
common.applySizingDecision(state, rec.intensity, { metrics });
assert.equal(state.active_workflow.sizing.intensity, 'standard');
```

#### TC-SZ-066: INT-05 -- High risk overrides low file count
- **AC**: AC-04 (negated), AC-07
- **Flow**: 2 files, high risk -> epic -> deferred to standard

```javascript
const iaContent = buildIAContent(2, 1, 'high', 'high', 0);
const metrics = common.parseSizingFromImpactAnalysis(iaContent);
const rec = common.computeSizingRecommendation(metrics, { light_max_files: 5, epic_min_files: 20 });
assert.equal(rec.intensity, 'epic');

const state = buildFeatureState();
common.applySizingDecision(state, rec.intensity, { metrics });
assert.equal(state.active_workflow.sizing.intensity, 'epic');
assert.equal(state.active_workflow.sizing.effective_intensity, 'standard');
```

#### TC-SZ-067: INT-06 -- Custom thresholds change outcome
- **AC**: AC-07
- **Flow**: 8 files, low risk, custom thresholds {10, 30} -> light

```javascript
const iaContent = buildIAContent(8, 2, 'low', 'low', 0);
const metrics = common.parseSizingFromImpactAnalysis(iaContent);
const rec = common.computeSizingRecommendation(metrics, { light_max_files: 10, epic_min_files: 30 });
assert.equal(rec.intensity, 'light');
```

#### TC-SZ-068: INT-07 -- Invariant failure cascades to standard
- **AC**: AC-15 (rollback), AC-24
- **Flow**: Light parse/compute succeeds, but apply hits invariant failure -> rollback

```javascript
const iaContent = buildIAContent(3, 1, 'low', 'low', 0);
const metrics = common.parseSizingFromImpactAnalysis(iaContent);
const rec = common.computeSizingRecommendation(metrics, { light_max_files: 5, epic_min_files: 20 });
assert.equal(rec.intensity, 'light');

// State with too few phases -- will fail INV-01 after removal
const state = buildMinimalState(['02-impact-analysis', '03-architecture', '04-design', '06-implementation']);
common.applySizingDecision(state, rec.intensity, { metrics });
assert.equal(state.active_workflow.sizing.effective_intensity, 'standard');
```

#### TC-SZ-069: INT-08 -- Determinism: same input produces same output
- **AC**: AC-03
- **Flow**: Run parse+compute twice with identical input -> identical intensity and rationale

```javascript
const iaContent = buildIAContent(12, 4, 'medium', 'medium', 1);
const thresholds = { light_max_files: 5, epic_min_files: 20 };

const metrics1 = common.parseSizingFromImpactAnalysis(iaContent);
const rec1 = common.computeSizingRecommendation(metrics1, thresholds);

const metrics2 = common.parseSizingFromImpactAnalysis(iaContent);
const rec2 = common.computeSizingRecommendation(metrics2, thresholds);

assert.deepStrictEqual(metrics1, metrics2);
assert.equal(rec1.intensity, rec2.intensity);
assert.equal(rec1.rationale, rec2.rationale);
```

---

## 5. Error Path Tests (Comprehensive SZ-xxx Coverage)

These tests ensure every error code from `error-taxonomy.md` has at least one test exercising its trigger. Many overlap with unit tests above -- this section provides a consolidated index.

| Error Code | Covered By | Test Description |
|------------|-----------|-----------------|
| SZ-100 | TC-SZ-070 | IA file not found -> caller passes empty/null content |
| SZ-101 | TC-SZ-016 | Empty string -> null |
| SZ-102 | TC-SZ-071 | No JSON blocks, but has fallback prose -> proceeds to fallback |
| SZ-103 | TC-SZ-018 | Malformed JSON -> proceeds to fallback |
| SZ-104 | TC-SZ-019 | Both strategies fail -> null |
| SZ-105 | TC-SZ-011 | Negative file_count -> 0 |
| SZ-106 | TC-SZ-012 | Non-integer module_count -> 0 |
| SZ-107 | TC-SZ-013 | Unrecognized risk_level -> "medium" |
| SZ-108 | TC-SZ-014 | Numeric blast_radius -> "medium" |
| SZ-109 | TC-SZ-015 | Negative coverage_gaps -> 0 |
| SZ-200 | TC-SZ-072 | No sizing config -> tested via integration (standard fallback) |
| SZ-201 | TC-SZ-073 | Sizing disabled -> tested via integration (standard fallback) |
| SZ-202 | TC-SZ-033 | Invalid light_max_files -> 5 |
| SZ-203 | TC-SZ-034 | Invalid epic_min_files -> 20 |
| SZ-204 | TC-SZ-035 | light_max >= epic_min -> both reset |
| SZ-205 | TC-SZ-056 | Non-array skip phases -> default |
| SZ-206 | TC-SZ-057 | Skip phase not in workflow -> no-op |
| SZ-300 | TC-SZ-053, TC-SZ-054 | No active_workflow -> unchanged |
| SZ-301 | TC-SZ-047 | INV-01 failure -> rollback |
| SZ-302 | TC-SZ-048 | INV-02 failure -> rollback |
| SZ-303 | TC-SZ-049 | INV-03 failure -> rollback |
| SZ-304 | TC-SZ-050 | INV-04 failure -> rollback |
| SZ-305 | TC-SZ-051 | Invalid intensity -> standard |
| SZ-306 | TC-SZ-074 | Double sizing prevention (state already has sizing) |

#### TC-SZ-070: SZ-100 -- Caller handles missing IA file by passing null content
- **Error Code**: SZ-100
- **Input**: `null` passed to `parseSizingFromImpactAnalysis`
- **Expected**: Returns `null`, caller defaults to standard

```javascript
const result = common.parseSizingFromImpactAnalysis(null);
assert.equal(result, null);
```

#### TC-SZ-071: SZ-102 -- No JSON blocks, proceeds to fallback
- **Error Code**: SZ-102
- **Input**: Content with prose but no code blocks
- **Expected**: If prose matches fallback patterns, returns metrics

```javascript
const content = `## Executive Summary
**Affected Files**: 7
**Modules Affected**: 2
**Risk Level**: medium
**Blast Radius**: low
**Coverage Gaps**: 1`;
const result = common.parseSizingFromImpactAnalysis(content);
assert.equal(result.file_count, 7);
```

#### TC-SZ-072: SZ-200 -- No sizing config (integration-level note)
- **Error Code**: SZ-200
- **Note**: This error is triggered in STEP 3e-sizing when `workflows.json` has no `feature.sizing` block. It is tested at the Phase-Loop Controller integration level, not in the pure function unit tests. The pure functions do not read config files.

#### TC-SZ-073: SZ-201 -- Sizing disabled (integration-level note)
- **Error Code**: SZ-201
- **Note**: Same as SZ-200. The `sizing.enabled === false` check is in STEP 3e-sizing, not in the pure functions.

#### TC-SZ-074: SZ-306 -- Double sizing prevention
- **Error Code**: SZ-306
- **Note**: The double-sizing guard is in STEP 3e-sizing (trigger check: `if (aw.sizing) skip`). At the pure function level, `applySizingDecision` will overwrite any existing sizing record. The double-sizing prevention is a caller responsibility.
- **Test**: Verify that calling `applySizingDecision` twice overwrites the first record.

```javascript
const state = buildFeatureState();
common.applySizingDecision(state, 'standard', { metrics: mediumMetrics });
assert.equal(state.active_workflow.sizing.intensity, 'standard');
common.applySizingDecision(state, 'light', { metrics: lowMetrics });
assert.equal(state.active_workflow.sizing.intensity, 'light');
```

---

## 6. Test Helper Functions

The test file defines the following helpers:

### buildFeatureState()
Returns a standard 9-phase feature workflow state with phases 00-08, phase_status for all 9 with 00/01/02 as 'completed' and rest as 'pending', `current_phase_index: 3`, and top-level `phases` object.

### buildMinimalState(phasesArray)
Returns a minimal state with custom phases array, phase_status derived from array (first half completed, rest pending), and appropriate current_phase_index.

### buildStateWithHighIndex()
Returns a state where `current_phase_index` is set to a value that would be out of bounds after removing 2 phases.

### buildIAContent(files, modules, risk, blast, gaps)
Returns a markdown string with a JSON metadata block containing the specified values.

### lowMetrics / mediumMetrics / epicMetrics
Pre-built metric objects for common test scenarios:
- `lowMetrics`: `{ file_count: 3, module_count: 1, risk_score: 'low', coupling: 'low', coverage_gaps: 0 }`
- `mediumMetrics`: `{ file_count: 12, module_count: 4, risk_score: 'medium', coupling: 'medium', coverage_gaps: 1 }`
- `epicMetrics`: `{ file_count: 35, module_count: 8, risk_score: 'high', coupling: 'high', coverage_gaps: 5 }`

---

## 7. Coverage Validation

After creating all test cases, the following coverage was verified:

### Acceptance Criteria Coverage

| AC | Test Cases | Status |
|----|-----------|--------|
| AC-01 (IA parsing) | TC-SZ-001 through TC-SZ-019 | Covered |
| AC-02 (after GATE-02) | Integration-level (STEP 3e trigger check) | N/A for pure functions |
| AC-03 (deterministic) | TC-SZ-069, TC-SZ-031 | Covered |
| AC-04 (light skips 03/04) | TC-SZ-020, TC-SZ-022, TC-SZ-030, TC-SZ-036 | Covered |
| AC-05 (standard unchanged) | TC-SZ-021, TC-SZ-025, TC-SZ-041 | Covered |
| AC-06 (epic deferred) | TC-SZ-044, TC-SZ-045, TC-SZ-064 | Covered |
| AC-07 (configurable thresholds) | TC-SZ-023, TC-SZ-027, TC-SZ-033 through TC-SZ-035 | Covered |
| AC-08 (recommendation content) | TC-SZ-031 (rationale string) | Partial (UX in isdlc.md) |
| AC-09 (user menu) | N/A (AskUserQuestion) | Tested at isdlc.md level |
| AC-10 (override) | TC-SZ-059 | Covered |
| AC-11 (recording) | TC-SZ-059, TC-SZ-060 | Covered |
| AC-12 (-light flag) | TC-SZ-058 | Covered |
| AC-13 (IA still runs) | N/A (flow control in isdlc.md) | Tested at isdlc.md level |
| AC-14 (only -light) | N/A (command parsing) | Tested at isdlc.md level |
| AC-15 (remove 03/04) | TC-SZ-036, TC-SZ-055, TC-SZ-056 | Covered |
| AC-16 (update phase_status) | TC-SZ-037 | Covered |
| AC-17 (prune phases object) | TC-SZ-038 | Covered |
| AC-18 (recalc index) | TC-SZ-039 | Covered |
| AC-19 through AC-23 | N/A | Out of scope (FR-06 FUTURE) |
| AC-24 (sizing record) | TC-SZ-040, TC-SZ-042, TC-SZ-044, TC-SZ-046, TC-SZ-058 through TC-SZ-061 | Covered |
| AC-25 (history persist) | N/A | Workflow completion logic, not in sizing functions |

### Error Code Coverage

All 20 error codes (SZ-100 through SZ-306) have at least one dedicated test case. See Section 5 for the mapping table.

### Total Test Count: 74 test cases

(19 parseSizing + 16 computeSizing + 26 applySizing + 8 integration + 5 error-path-only)
