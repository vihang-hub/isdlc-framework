# Unit Test Cases: Roundtable Analysis Agent

**Feature ID**: REQ-ROUNDTABLE-ANALYST (GH-20)
**Phase**: 05-test-strategy
**Date**: 2026-02-19

---

## Suite A: three-verb-utils Steps Extension

**File**: `src/claude/hooks/tests/test-three-verb-utils-steps.test.cjs`
**Module Under Test**: `src/claude/hooks/lib/three-verb-utils.cjs` (readMetaJson, writeMetaJson)
**Test Framework**: Node.js node:test + node:assert/strict (CJS)

### TC-A01: readMetaJson defaults steps_completed to [] when field absent

- **Type**: positive
- **Requirement**: FR-005 AC-005-04, VR-META-005, VR-META-BC-001
- **Priority**: P0
- **Preconditions**: meta.json exists with `{description:"test", source:"manual", created_at:"2026-01-01", analysis_status:"raw", phases_completed:[]}` (no steps_completed field)
- **Steps**:
  1. Create temp directory with meta.json containing legacy fields only
  2. Call `readMetaJson(slugDir)`
  3. Assert `result.steps_completed` deep-equals `[]`
- **Expected Result**: `steps_completed` is an empty array
- **Cleanup**: Remove temp directory

### TC-A02: readMetaJson defaults depth_overrides to {} when field absent

- **Type**: positive
- **Requirement**: FR-006 AC-006-06, VR-META-007, VR-META-BC-001
- **Priority**: P0
- **Preconditions**: meta.json exists without depth_overrides field
- **Steps**:
  1. Create temp directory with meta.json containing legacy fields only
  2. Call `readMetaJson(slugDir)`
  3. Assert `result.depth_overrides` deep-equals `{}`
- **Expected Result**: `depth_overrides` is an empty object
- **Cleanup**: Remove temp directory

### TC-A03: readMetaJson preserves existing steps_completed array

- **Type**: positive
- **Requirement**: FR-005 AC-005-01
- **Priority**: P0
- **Preconditions**: meta.json has `steps_completed: ["00-01", "00-02", "01-01"]`
- **Steps**:
  1. Create meta.json with steps_completed containing three step IDs
  2. Call `readMetaJson(slugDir)`
  3. Assert `result.steps_completed` deep-equals `["00-01", "00-02", "01-01"]`
- **Expected Result**: Array preserved exactly as stored

### TC-A04: readMetaJson preserves existing depth_overrides object

- **Type**: positive
- **Requirement**: FR-006 AC-006-06
- **Priority**: P0
- **Preconditions**: meta.json has `depth_overrides: {"01-requirements": "brief", "03-architecture": "deep"}`
- **Steps**:
  1. Create meta.json with depth_overrides containing two entries
  2. Call `readMetaJson(slugDir)`
  3. Assert `result.depth_overrides` deep-equals `{"01-requirements":"brief","03-architecture":"deep"}`
- **Expected Result**: Object preserved exactly as stored

### TC-A05: readMetaJson corrects steps_completed when it is a string

- **Type**: negative
- **Requirement**: VR-META-005, ERR-META-004
- **Priority**: P1
- **Preconditions**: meta.json has `steps_completed: "00-01"`
- **Steps**:
  1. Create meta.json with `steps_completed` set to string `"00-01"`
  2. Call `readMetaJson(slugDir)`
  3. Assert `result.steps_completed` deep-equals `[]`
- **Expected Result**: Invalid type corrected to empty array

### TC-A06: readMetaJson corrects steps_completed when it is null

- **Type**: negative
- **Requirement**: VR-META-005, ERR-META-004
- **Priority**: P1
- **Preconditions**: meta.json has `steps_completed: null`
- **Steps**:
  1. Create meta.json with `steps_completed` set to `null`
  2. Call `readMetaJson(slugDir)`
  3. Assert `result.steps_completed` deep-equals `[]`
- **Expected Result**: Null corrected to empty array

### TC-A07: readMetaJson corrects steps_completed when it is a number

- **Type**: negative
- **Requirement**: VR-META-005, ERR-META-004
- **Priority**: P1
- **Preconditions**: meta.json has `steps_completed: 42`
- **Steps**:
  1. Create meta.json with `steps_completed` set to `42`
  2. Call `readMetaJson(slugDir)`
  3. Assert `result.steps_completed` deep-equals `[]`
- **Expected Result**: Number corrected to empty array

### TC-A08: readMetaJson corrects depth_overrides when it is null

- **Type**: negative
- **Requirement**: VR-META-007, ERR-META-005
- **Priority**: P1
- **Preconditions**: meta.json has `depth_overrides: null`
- **Steps**:
  1. Create meta.json with `depth_overrides` set to `null`
  2. Call `readMetaJson(slugDir)`
  3. Assert `result.depth_overrides` deep-equals `{}`
- **Expected Result**: Null corrected to empty object

### TC-A09: readMetaJson corrects depth_overrides when it is an array

- **Type**: negative
- **Requirement**: VR-META-007, ERR-META-005
- **Priority**: P1
- **Preconditions**: meta.json has `depth_overrides: ["brief"]`
- **Steps**:
  1. Create meta.json with `depth_overrides` set to `["brief"]`
  2. Call `readMetaJson(slugDir)`
  3. Assert `result.depth_overrides` deep-equals `{}`
- **Expected Result**: Array corrected to empty object

### TC-A10: readMetaJson corrects depth_overrides when it is a string

- **Type**: negative
- **Requirement**: VR-META-007, ERR-META-005
- **Priority**: P1
- **Preconditions**: meta.json has `depth_overrides: "brief"`
- **Steps**:
  1. Create meta.json with `depth_overrides` set to `"brief"`
  2. Call `readMetaJson(slugDir)`
  3. Assert `result.depth_overrides` deep-equals `{}`
- **Expected Result**: String corrected to empty object

### TC-A11: readMetaJson preserves all existing fields alongside new defaults

- **Type**: positive
- **Requirement**: NFR-005 AC-NFR-005-03
- **Priority**: P0
- **Preconditions**: meta.json with all legacy fields, no steps_completed/depth_overrides
- **Steps**:
  1. Create meta.json with `description`, `source`, `source_id`, `created_at`, `analysis_status`, `phases_completed`, `codebase_hash`
  2. Call `readMetaJson(slugDir)`
  3. Assert all original fields are present and unchanged
  4. Assert `steps_completed` is `[]` and `depth_overrides` is `{}`
- **Expected Result**: Original fields preserved, new defaults added

### TC-A12: readMetaJson returns null for missing meta.json (unchanged behavior)

- **Type**: positive
- **Requirement**: ERR-META-001
- **Priority**: P0
- **Preconditions**: slugDir exists but contains no meta.json
- **Steps**:
  1. Create empty slug directory
  2. Call `readMetaJson(slugDir)`
  3. Assert result is `null`
- **Expected Result**: Returns null (unchanged behavior)

### TC-A13: readMetaJson returns null for corrupt JSON (unchanged behavior)

- **Type**: negative
- **Requirement**: ERR-META-002
- **Priority**: P1
- **Preconditions**: meta.json contains invalid JSON
- **Steps**:
  1. Write `{not valid json` to meta.json
  2. Call `readMetaJson(slugDir)`
  3. Assert result is `null`
- **Expected Result**: Returns null (unchanged behavior)

### TC-A14: writeMetaJson preserves steps_completed through write cycle

- **Type**: positive
- **Requirement**: FR-005 AC-005-05, VR-META-BC-002
- **Priority**: P0
- **Preconditions**: Meta object with `steps_completed: ["00-01", "00-02"]`
- **Steps**:
  1. Create slug directory
  2. Call `writeMetaJson(slugDir, metaWithSteps)`
  3. Read meta.json from disk
  4. Assert `steps_completed` deep-equals `["00-01", "00-02"]`
- **Expected Result**: steps_completed preserved in written file

### TC-A15: writeMetaJson preserves depth_overrides through write cycle

- **Type**: positive
- **Requirement**: FR-006, VR-META-BC-002
- **Priority**: P0
- **Preconditions**: Meta object with `depth_overrides: {"01-requirements": "deep"}`
- **Steps**:
  1. Call `writeMetaJson(slugDir, metaWithDepth)`
  2. Read meta.json from disk
  3. Assert `depth_overrides` deep-equals `{"01-requirements": "deep"}`
- **Expected Result**: depth_overrides preserved in written file

### TC-A16: writeMetaJson succeeds when steps_completed is absent (old callers)

- **Type**: positive
- **Requirement**: NFR-005 AC-NFR-005-04, VR-META-BC-003
- **Priority**: P0
- **Preconditions**: Meta object without steps_completed or depth_overrides fields
- **Steps**:
  1. Create meta object with only legacy fields (no steps_completed, no depth_overrides)
  2. Call `writeMetaJson(slugDir, meta)` -- should not throw
  3. Read back meta.json
  4. Assert file is valid JSON
  5. Assert `steps_completed` key is absent (not written because it was undefined)
- **Expected Result**: Write succeeds; missing fields simply omitted from output

### TC-A17: writeMetaJson derives analysis_status from phases_completed only

- **Type**: positive
- **Requirement**: VR-META-BC-004, NFR-005 AC-NFR-005-02
- **Priority**: P0
- **Preconditions**: Meta with `phases_completed:["00-quick-scan"]`, `steps_completed:["00-01","00-02","00-03","01-01","01-02"]`
- **Steps**:
  1. Create meta with 1 phase completed but 5 steps completed
  2. Call `writeMetaJson(slugDir, meta)`
  3. Read meta.json from disk
  4. Assert `analysis_status` equals `"partial"` (based on 1/5 phases, NOT 5 steps)
- **Expected Result**: analysis_status derived from phases_completed only

### TC-A18: writeMetaJson deletes phase_a_completed but preserves steps_completed

- **Type**: positive
- **Requirement**: VR-META-BC-002
- **Priority**: P1
- **Preconditions**: Meta with `phase_a_completed: true`, `steps_completed: ["00-01"]`
- **Steps**:
  1. Create meta object with legacy `phase_a_completed` and new `steps_completed`
  2. Call `writeMetaJson(slugDir, meta)`
  3. Read meta.json from disk
  4. Assert `phase_a_completed` is NOT present
  5. Assert `steps_completed` IS present with value `["00-01"]`
- **Expected Result**: Legacy field removed, new field preserved

### TC-A19: readMetaJson -> writeMetaJson round-trip preserves steps + depth

- **Type**: positive
- **Requirement**: FR-005, FR-006, NFR-005
- **Priority**: P0
- **Preconditions**: meta.json on disk with steps_completed and depth_overrides
- **Steps**:
  1. Write meta.json with `steps_completed:["00-01","01-01"]`, `depth_overrides:{"01-requirements":"brief"}`
  2. Call `readMetaJson(slugDir)` to get meta object
  3. Push `"01-02"` to `meta.steps_completed`
  4. Call `writeMetaJson(slugDir, meta)`
  5. Call `readMetaJson(slugDir)` again
  6. Assert `steps_completed` equals `["00-01","01-01","01-02"]`
  7. Assert `depth_overrides` equals `{"01-requirements":"brief"}`
- **Expected Result**: Full round-trip preserves data with mutation

### TC-A20: readMetaJson handles meta.json with only legacy fields

- **Type**: positive
- **Requirement**: NFR-005 AC-NFR-005-03
- **Priority**: P0
- **Preconditions**: meta.json with `{phase_a_completed: true, description: "old item"}`
- **Steps**:
  1. Write meta.json with only legacy `phase_a_completed` and `description`
  2. Call `readMetaJson(slugDir)`
  3. Assert `analysis_status` equals `"analyzed"` (from legacy migration)
  4. Assert `phases_completed` has all 5 analysis phases
  5. Assert `steps_completed` defaults to `[]`
  6. Assert `depth_overrides` defaults to `{}`
- **Expected Result**: Legacy migration works, new defaults applied

---

## Suite B: Step File Validation

**File**: `src/claude/hooks/tests/test-step-file-validator.test.cjs`
**Module Under Test**: Step file parsing/validation helper (to be implemented in test file)
**Test Framework**: Node.js node:test + node:assert/strict (CJS)

### TC-B01: Valid step file parses successfully with all required fields

- **Type**: positive
- **Requirement**: FR-012 AC-012-01, VR-STEP-001..005
- **Priority**: P0
- **Input**:
```yaml
---
step_id: "01-03"
title: "User Experience & Journeys"
persona: "business-analyst"
depth: "standard"
outputs: ["requirements-spec.md"]
---
## Brief Mode
Draft summary...
## Standard Mode
Questions...
## Deep Mode
Extended questions...
## Validation
Criteria...
## Artifacts
Instructions...
```
- **Steps**:
  1. Parse the step file content
  2. Validate all frontmatter fields
- **Expected Result**: Parse succeeds, all fields extracted correctly

### TC-B02: step_id matching PP-NN format is accepted

- **Type**: positive
- **Requirement**: VR-STEP-001
- **Priority**: P0
- **Test Data**: `"00-01"`, `"01-08"`, `"04-05"`, `"99-99"`
- **Expected Result**: All pass validation

### TC-B03: step_id with invalid format is rejected

- **Type**: negative
- **Requirement**: VR-STEP-001
- **Priority**: P1
- **Test Data**: `"abc"`, `"0-01"`, `"001-01"`, `"00_01"`, `"00-1"`, `"00-001"`
- **Expected Result**: All fail validation with ERR-STEP-005

### TC-B04: Empty step_id is rejected

- **Type**: negative
- **Requirement**: VR-STEP-001
- **Priority**: P1
- **Test Data**: `step_id: ""`
- **Expected Result**: Validation fails

### TC-B05: Missing step_id field is rejected

- **Type**: negative
- **Requirement**: VR-STEP-001, ERR-STEP-005
- **Priority**: P1
- **Test Data**: Frontmatter without step_id key
- **Expected Result**: Validation fails with missing required field

### TC-B06: title exceeding 60 characters is rejected

- **Type**: negative
- **Requirement**: VR-STEP-002
- **Priority**: P2
- **Test Data**: `title: "A".repeat(61)`
- **Expected Result**: Validation fails
- **Boundary**: Title with exactly 60 characters should pass

### TC-B07: Empty title is rejected

- **Type**: negative
- **Requirement**: VR-STEP-002, ERR-STEP-005
- **Priority**: P1
- **Test Data**: `title: ""`
- **Expected Result**: Validation fails

### TC-B08: persona "business-analyst" is accepted

- **Type**: positive
- **Requirement**: VR-STEP-003
- **Priority**: P0
- **Expected Result**: Validation passes

### TC-B09: persona "solutions-architect" is accepted

- **Type**: positive
- **Requirement**: VR-STEP-003
- **Priority**: P0
- **Expected Result**: Validation passes

### TC-B10: persona "system-designer" is accepted

- **Type**: positive
- **Requirement**: VR-STEP-003
- **Priority**: P0
- **Expected Result**: Validation passes

### TC-B11: persona with invalid value is rejected

- **Type**: negative
- **Requirement**: VR-STEP-003, ERR-STEP-006
- **Priority**: P1
- **Test Data**: `persona: "product-manager"`, `persona: "BA"`, `persona: ""`
- **Expected Result**: All fail validation

### TC-B12: depth "brief" is accepted

- **Type**: positive
- **Requirement**: VR-STEP-004
- **Priority**: P0
- **Expected Result**: Validation passes

### TC-B13: depth "standard" is accepted

- **Type**: positive
- **Requirement**: VR-STEP-004
- **Priority**: P0
- **Expected Result**: Validation passes

### TC-B14: depth "deep" is accepted

- **Type**: positive
- **Requirement**: VR-STEP-004
- **Priority**: P0
- **Expected Result**: Validation passes

### TC-B15: depth with invalid value is rejected

- **Type**: negative
- **Requirement**: VR-STEP-004, ERR-STEP-006
- **Priority**: P1
- **Test Data**: `depth: "thorough"`, `depth: "shallow"`, `depth: ""`
- **Expected Result**: All fail validation

### TC-B16: outputs with non-empty array is accepted

- **Type**: positive
- **Requirement**: VR-STEP-005
- **Priority**: P0
- **Test Data**: `outputs: ["requirements-spec.md"]`, `outputs: ["a.md", "b.md"]`
- **Expected Result**: Validation passes

### TC-B17: outputs with empty array is rejected

- **Type**: negative
- **Requirement**: VR-STEP-005, ERR-STEP-005
- **Priority**: P1
- **Test Data**: `outputs: []`
- **Expected Result**: Validation fails

### TC-B18: outputs that is not an array is rejected

- **Type**: negative
- **Requirement**: VR-STEP-005, ERR-STEP-005
- **Priority**: P1
- **Test Data**: `outputs: "requirements-spec.md"`, `outputs: 42`, `outputs: null`
- **Expected Result**: All fail validation

### TC-B19: depends_on as valid array is preserved

- **Type**: positive
- **Requirement**: VR-STEP-006, FR-012 AC-012-02
- **Priority**: P2
- **Test Data**: `depends_on: ["01-01", "01-02"]`
- **Expected Result**: Array preserved in parsed output

### TC-B20: depends_on with invalid type defaults to []

- **Type**: negative
- **Requirement**: VR-STEP-006
- **Priority**: P2
- **Test Data**: `depends_on: "01-01"`, `depends_on: 42`
- **Expected Result**: Defaults to `[]`, no skip

### TC-B21: skip_if as string is preserved

- **Type**: positive
- **Requirement**: VR-STEP-007, FR-012 AC-012-02
- **Priority**: P2
- **Test Data**: `skip_if: "scope === 'small'"`
- **Expected Result**: String preserved in parsed output

### TC-B22: skip_if with non-string type defaults to ""

- **Type**: negative
- **Requirement**: VR-STEP-007
- **Priority**: P2
- **Test Data**: `skip_if: 42`, `skip_if: ["a"]`
- **Expected Result**: Defaults to `""`

### TC-B23: Step body contains ## Standard Mode section

- **Type**: positive
- **Requirement**: VR-STEP-010
- **Priority**: P1
- **Input**: Step file with `## Standard Mode` heading in body
- **Expected Result**: Standard mode content extracted

### TC-B24: Step body missing ## Standard Mode falls back to raw body

- **Type**: negative
- **Requirement**: VR-STEP-010, ERR-STEP-007
- **Priority**: P1
- **Input**: Step file with valid frontmatter but no `## Standard Mode` heading
- **Expected Result**: Warning logged; raw body used as fallback

### TC-B25: Malformed YAML frontmatter returns parse error

- **Type**: negative
- **Requirement**: ERR-STEP-004
- **Priority**: P1
- **Input**: `---\nstep_id: "unclosed string\n---`
- **Expected Result**: Parse returns error/null

### TC-B26: Missing YAML delimiters returns parse error

- **Type**: negative
- **Requirement**: ERR-STEP-004
- **Priority**: P1
- **Input**: Markdown content without `---` delimiters
- **Expected Result**: Parse returns error/null (no frontmatter detected)

### TC-B27: step_id matches parent directory phase number (VR-STEP-008)

- **Type**: positive
- **Requirement**: VR-STEP-008, CON-005
- **Priority**: P2
- **Input**: File in `01-requirements/` directory, step_id `"01-03"`
- **Expected Result**: Cross-validation passes (phase prefix "01" matches directory)

### TC-B28: Duplicate step_id across files is detected

- **Type**: negative
- **Requirement**: VR-STEP-009
- **Priority**: P2
- **Input**: Two step files both with step_id `"01-01"`
- **Expected Result**: Second occurrence flagged as duplicate

---

## Suite C: Step File Inventory Validation

**File**: `src/claude/hooks/tests/test-step-file-validator.test.cjs` (same file as Suite B)

### TC-C01: All 3 Phase 00 step files exist

- **Type**: positive
- **Requirement**: FR-004 AC-004-01
- **Priority**: P0
- **Files**: `01-scope-estimation.md`, `02-keyword-search.md`, `03-file-count.md`
- **Path**: `src/claude/skills/analysis-steps/00-quick-scan/`
- **Expected Result**: All 3 files exist and are readable

### TC-C02: All 8 Phase 01 step files exist

- **Type**: positive
- **Requirement**: FR-004 AC-004-01
- **Priority**: P0
- **Files**: `01-business-context.md` through `08-prioritization.md`
- **Path**: `src/claude/skills/analysis-steps/01-requirements/`
- **Expected Result**: All 8 files exist and are readable

### TC-C03: All 4 Phase 02 step files exist

- **Type**: positive
- **Requirement**: FR-004 AC-004-01
- **Priority**: P0
- **Files**: `01-blast-radius.md` through `04-impact-summary.md`
- **Path**: `src/claude/skills/analysis-steps/02-impact-analysis/`
- **Expected Result**: All 4 files exist and are readable

### TC-C04: All 4 Phase 03 step files exist

- **Type**: positive
- **Requirement**: FR-004 AC-004-01
- **Priority**: P0
- **Files**: `01-architecture-options.md` through `04-architecture-review.md`
- **Path**: `src/claude/skills/analysis-steps/03-architecture/`
- **Expected Result**: All 4 files exist and are readable

### TC-C05: All 5 Phase 04 step files exist

- **Type**: positive
- **Requirement**: FR-004 AC-004-01
- **Priority**: P0
- **Files**: `01-module-design.md` through `05-design-review.md`
- **Path**: `src/claude/skills/analysis-steps/04-design/`
- **Expected Result**: All 5 files exist and are readable

### TC-C06: Every step file has valid YAML frontmatter

- **Type**: positive
- **Requirement**: FR-012 AC-012-01
- **Priority**: P0
- **Steps**:
  1. Iterate all 24 step files
  2. Parse YAML frontmatter from each
  3. Validate all required fields pass VR-STEP-001..005
- **Expected Result**: All 24 files pass validation

### TC-C07: All step_ids match their file location (VR-STEP-008)

- **Type**: positive
- **Requirement**: VR-STEP-008, CON-005
- **Priority**: P1
- **Steps**:
  1. For each step file, extract step_id from frontmatter
  2. Extract phase number from parent directory name
  3. Extract step number from filename prefix
  4. Assert step_id equals `"{phase}-{step}"`
- **Expected Result**: All 24 step_ids match their file location

### TC-C08: No duplicate step_ids across all 24 files

- **Type**: positive
- **Requirement**: VR-STEP-009
- **Priority**: P1
- **Steps**:
  1. Collect all step_ids from all 24 files
  2. Assert Set.size equals Array.length (no duplicates)
- **Expected Result**: 24 unique step_ids

### TC-C09: All step files follow NN-name.md naming convention

- **Type**: positive
- **Requirement**: CON-005
- **Priority**: P1
- **Steps**:
  1. List all files in each phase directory
  2. Assert each filename matches `/^\d{2}-[\w-]+\.md$/`
- **Expected Result**: All filenames match convention

### TC-C10: Every step file body contains ## Standard Mode section

- **Type**: positive
- **Requirement**: VR-STEP-010
- **Priority**: P1
- **Steps**:
  1. Read body of each step file (after frontmatter)
  2. Assert `## Standard Mode` heading exists
- **Expected Result**: All 24 files contain Standard Mode section

---

## Suite D: Integration Tests (meta.json step tracking)

**File**: `src/claude/hooks/tests/test-three-verb-utils-steps.test.cjs` (same file as Suite A)

### TC-D01: Simulate step-by-step progression

- **Type**: positive
- **Requirement**: FR-005 AC-005-01, AC-005-02
- **Priority**: P0
- **Steps**:
  1. Create meta.json with `steps_completed: [], phases_completed: []`
  2. Read meta with `readMetaJson()`
  3. Push `"00-01"` to steps_completed
  4. Write with `writeMetaJson()`
  5. Read again
  6. Assert steps_completed is `["00-01"]`
  7. Push `"00-02"` to steps_completed
  8. Write again
  9. Read again
  10. Assert steps_completed is `["00-01", "00-02"]`
- **Expected Result**: Progressive step tracking works through multiple write cycles

### TC-D02: Simulate resume with partial steps

- **Type**: positive
- **Requirement**: FR-005 AC-005-02, NFR-003 AC-NFR-003-01
- **Priority**: P0
- **Steps**:
  1. Create meta.json with `steps_completed: ["00-01","00-02","00-03","01-01","01-02"]` and `phases_completed: ["00-quick-scan"]`
  2. Read with `readMetaJson()`
  3. Filter steps for phase 01 prefix: `meta.steps_completed.filter(s => s.startsWith("01-"))`
  4. Assert Phase 01 completed steps are `["01-01", "01-02"]`
  5. Determine next step: `"01-03"` (first not in completed)
- **Expected Result**: Resumption correctly identifies completed and next steps

### TC-D03: Simulate depth override persistence

- **Type**: positive
- **Requirement**: FR-006 AC-006-06
- **Priority**: P1
- **Steps**:
  1. Create meta.json with `depth_overrides: {}`
  2. Read meta, set `meta.depth_overrides["01-requirements"] = "deep"`
  3. Write meta
  4. Read meta again
  5. Assert `depth_overrides["01-requirements"]` equals `"deep"`
- **Expected Result**: User depth override persisted across sessions

### TC-D04: Simulate phase completion with steps

- **Type**: positive
- **Requirement**: FR-005, FR-009 AC-009-03
- **Priority**: P0
- **Steps**:
  1. Create meta.json with `steps_completed: ["00-01","00-02","00-03"]` and `phases_completed: []`
  2. Read meta
  3. Push `"00-quick-scan"` to `phases_completed`
  4. Write meta
  5. Read meta again
  6. Assert `phases_completed` is `["00-quick-scan"]`
  7. Assert `steps_completed` still `["00-01","00-02","00-03"]`
  8. Assert `analysis_status` is `"partial"` (1/5 phases)
- **Expected Result**: Phase completion coexists with step tracking

### TC-D05: Old meta.json upgraded on read and preserved on write

- **Type**: positive
- **Requirement**: NFR-005 AC-NFR-005-02, AC-NFR-005-03
- **Priority**: P0
- **Steps**:
  1. Create meta.json with only legacy fields: `{description:"old", source:"manual", created_at:"2026-01-01", analysis_status:"raw", phases_completed:["00-quick-scan"]}`
  2. Read with `readMetaJson()` -- assert `steps_completed` defaults to `[]`, `depth_overrides` defaults to `{}`
  3. Push `"01-01"` to `steps_completed`
  4. Write with `writeMetaJson()`
  5. Read again
  6. Assert all original fields preserved
  7. Assert `steps_completed` is `["01-01"]`
  8. Assert `depth_overrides` is `{}`
- **Expected Result**: Old format upgraded seamlessly, new data preserved

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-19 | Test Strategy Designer (Phase 05) | Initial unit test case specifications |
