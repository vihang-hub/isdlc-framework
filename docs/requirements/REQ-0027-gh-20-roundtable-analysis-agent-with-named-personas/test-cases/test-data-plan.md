# Test Data Plan: Roundtable Analysis Agent

**Feature ID**: REQ-ROUNDTABLE-ANALYST (GH-20)
**Phase**: 05-test-strategy
**Date**: 2026-02-19
**Traces**: FR-005, FR-006, FR-012, NFR-005, VR-META-005..BC-004, VR-STEP-001..015

---

## 1. Overview

This document defines the test data requirements and generation strategy for the Roundtable Analysis Agent feature. Test data falls into three categories:

1. **meta.json fixtures** -- synthetic meta.json content for testing readMetaJson/writeMetaJson extensions
2. **Step file fixtures** -- synthetic step file content for testing YAML frontmatter validation
3. **E2E test data** -- backlog items for manual E2E scenarios

All test data is generated programmatically within test files using helper functions. No external data files or databases are required.

---

## 2. Boundary Values

### 2.1 meta.json Boundary Values

| Field | Minimum Valid | Maximum Valid | Just Below Min | Just Above Max | Empty/Null |
|-------|--------------|---------------|----------------|----------------|------------|
| steps_completed | `[]` | Array with 24 entries (all steps) | N/A (empty is valid) | N/A (no upper limit enforced) | `null` -> defaults to `[]` |
| steps_completed element | `"00-01"` (shortest valid step_id) | `"99-99"` | `""` (empty string) | N/A | N/A |
| depth_overrides | `{}` | Object with 5 entries (all phases) | N/A (empty is valid) | N/A (no upper limit enforced) | `null` -> defaults to `{}` |
| depth_overrides key | `"00-quick-scan"` | `"04-design"` | `""` (ignored at runtime) | `"99-unknown"` (ignored) | N/A |
| depth_overrides value | `"brief"` | `"deep"` | `""` (invalid, ignored) | `"thorough"` (invalid, ignored) | `null` (invalid, ignored) |

### 2.2 Step File Frontmatter Boundary Values

| Field | Minimum Valid | Maximum Valid | Just Below Min | Just Above Max |
|-------|--------------|---------------|----------------|----------------|
| step_id | `"00-01"` (5 chars) | `"99-99"` (5 chars) | `"0-01"` (4 chars, invalid format) | `"000-001"` (7 chars, invalid format) |
| title | 1 char (`"A"`) | 60 chars | `""` (empty, invalid) | 61 chars (invalid) |
| persona | `"business-analyst"` | `"system-designer"` | `""` (empty, invalid) | `"product-manager"` (unknown, invalid) |
| depth | `"brief"` | `"deep"` | `""` (empty, invalid) | `"thorough"` (unknown, invalid) |
| outputs | `["a.md"]` (1 element) | No upper limit | `[]` (empty, invalid) | N/A |
| depends_on | `[]` (empty) | Multiple step_ids | `"string"` (wrong type) | N/A |
| skip_if | `""` (empty) | Long expression string | `42` (wrong type) | N/A |

---

## 3. Invalid Inputs

### 3.1 meta.json Invalid Input Matrix

| Field | Invalid Value | Expected Behavior | Test Case |
|-------|--------------|-------------------|-----------|
| steps_completed | `"00-01"` (string) | Default to `[]` | TC-A05 |
| steps_completed | `null` | Default to `[]` | TC-A06 |
| steps_completed | `42` (number) | Default to `[]` | TC-A07 |
| steps_completed | `{a:1}` (object) | Default to `[]` | implicit (not an array) |
| steps_completed | `true` (boolean) | Default to `[]` | implicit (not an array) |
| depth_overrides | `null` | Default to `{}` | TC-A08 |
| depth_overrides | `["brief"]` (array) | Default to `{}` | TC-A09 |
| depth_overrides | `"brief"` (string) | Default to `{}` | TC-A10 |
| depth_overrides | `42` (number) | Default to `{}` | implicit (not an object) |
| depth_overrides | `true` (boolean) | Default to `{}` | implicit (not an object) |
| entire file | `{not valid json` | readMetaJson returns `null` | TC-A13 |
| entire file | missing (no file) | readMetaJson returns `null` | TC-A12 |

### 3.2 Step File Invalid Input Matrix

| Field | Invalid Value | Expected Behavior | Test Case |
|-------|--------------|-------------------|-----------|
| step_id | `""` (empty) | Skip step | TC-B04 |
| step_id | missing field | Skip step | TC-B05 |
| step_id | `"abc"` (no match) | Skip step | TC-B03 |
| step_id | `"0-01"` (3 chars) | Skip step | TC-B03 |
| step_id | `"00_01"` (underscore) | Skip step | TC-B03 |
| title | `""` (empty) | Skip step | TC-B07 |
| title | 61 chars | Skip step | TC-B06 |
| persona | `""` (empty) | Skip step | TC-B11 |
| persona | `"product-manager"` | Skip step | TC-B11 |
| persona | `"BA"` (abbreviation) | Skip step | TC-B11 |
| depth | `""` (empty) | Skip step | TC-B15 |
| depth | `"thorough"` | Skip step | TC-B15 |
| depth | `"shallow"` | Skip step | TC-B15 |
| outputs | `[]` (empty) | Skip step | TC-B17 |
| outputs | `"file.md"` (string) | Skip step | TC-B18 |
| outputs | `42` (number) | Skip step | TC-B18 |
| outputs | `null` | Skip step | TC-B18 |
| YAML | unclosed quote | Parse error | TC-B25 |
| YAML | no delimiters | Parse error | TC-B26 |

---

## 4. Maximum-Size Inputs

### 4.1 meta.json Maximum-Size Scenarios

| Scenario | Data | Purpose | Test Case |
|----------|------|---------|-----------|
| All 24 steps completed | `steps_completed: ["00-01","00-02","00-03","01-01",...,"04-05"]` | Verify no truncation or overflow at maximum step count | TC-D04 |
| All 5 phases with depth overrides | `depth_overrides: {"00-quick-scan":"brief","01-requirements":"deep","02-impact-analysis":"standard","03-architecture":"deep","04-design":"brief"}` | Verify all phase overrides preserved | TC-A15 |
| Legacy + new fields combined | meta.json with all legacy fields + all new fields + extra custom fields | Verify unknown fields pass through | TC-A11 |
| Maximum realistic meta.json | ~2KB file with all fields populated | Verify no performance degradation on read | TC-PERF-01 |

### 4.2 Step File Maximum-Size Scenarios

| Scenario | Data | Purpose |
|----------|------|---------|
| Title at 60-char limit | `title: "A".repeat(60)` | Boundary value for VR-STEP-002 |
| outputs with 10 elements | `outputs: ["a.md","b.md",...,"j.md"]` | Verify no limit on output count |
| depends_on with 5 elements | `depends_on: ["00-01","00-02","00-03","01-01","01-02"]` | Verify multi-dependency handling |
| Large step body | Step file with ~5KB body content across all 5 sections | Verify parsing handles large content |

---

## 5. Test Data Generation Strategy

### 5.1 In-Test Fixture Factory (meta.json)

All meta.json test data is generated inline within test files using a factory function:

```javascript
function createMeta(overrides = {}) {
    return {
        description: 'Test item',
        source: 'manual',
        source_id: '',
        created_at: '2026-01-01T00:00:00.000Z',
        analysis_status: 'raw',
        phases_completed: [],
        ...overrides
    };
}
```

Usage examples:
- `createMeta()` -- legacy-only meta (no steps fields)
- `createMeta({ steps_completed: ['00-01'] })` -- with step tracking
- `createMeta({ steps_completed: null })` -- invalid type test
- `createMeta({ depth_overrides: { '01-requirements': 'brief' } })` -- with depth override

### 5.2 In-Test Fixture Factory (Step Files)

Step file content is generated inline for validation tests:

```javascript
function createStepFile(frontmatter, body = '') {
    const yaml = Object.entries(frontmatter)
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join('\n');
    return `---\n${yaml}\n---\n${body}`;
}
```

Usage examples:
- `createStepFile({ step_id: '01-03', title: 'UX Journey', persona: 'business-analyst', depth: 'standard', outputs: ['requirements-spec.md'] }, '## Standard Mode\nQuestions...')` -- valid step
- `createStepFile({ step_id: 'abc', title: '', persona: 'unknown', depth: '', outputs: [] })` -- fully invalid step

### 5.3 File System Setup

Each test suite creates an isolated temp directory:

```javascript
let testDir;

beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'isdlc-steps-test-'));
});

afterEach(() => {
    if (testDir && fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
    }
    testDir = null;
});
```

Slug directories are created within the temp directory:

```javascript
function createSlugDir(slug, metaContent) {
    const dir = path.join(testDir, 'docs', 'requirements', slug);
    fs.mkdirSync(dir, { recursive: true });
    if (metaContent) {
        fs.writeFileSync(
            path.join(dir, 'meta.json'),
            typeof metaContent === 'string' ? metaContent : JSON.stringify(metaContent, null, 2)
        );
    }
    return dir;
}
```

### 5.4 E2E Test Data

For manual E2E scenarios, use the `/isdlc add` command to create backlog items with varying scopes:

| E2E Scenario | Backlog Item Description | Expected Scope |
|-------------|-------------------------|----------------|
| TC-E01 (full flow) | "Add user authentication to login page" | medium |
| TC-E02 (session resume) | "Refactor payment module for PCI compliance" | large |
| TC-E03 (fallback) | "Fix typo in README" | small |
| TC-F01 (brief depth) | "Update config value in settings.json" | small |
| TC-F02 (deep depth) | "Redesign database schema for multi-tenancy" | large |

---

## 6. Data Isolation and Cleanup

### 6.1 Isolation Rules

1. Each `describe()` block gets its own temp directory (created in `beforeEach`)
2. No test reads from or writes to the actual project directory
3. Step file inventory tests (Suite C) are read-only against the source tree
4. Each test creates its own meta.json using the factory function
5. No shared mutable state between tests

### 6.2 Cleanup Protocol

1. `afterEach` removes the temp directory with `fs.rmSync(dir, { recursive: true, force: true })`
2. If a test fails, the temp directory is still cleaned up (afterEach runs on failure)
3. The test runner logs the temp directory path for debugging (if needed, set `ISDLC_TEST_KEEP_TEMPS=1` to skip cleanup)

---

## 7. Test Data Traceability

| Test Data Fixture | Used By Test Cases | Validates Rules |
|-------------------|-------------------|-----------------|
| meta-legacy-only | TC-A01, TC-A02, TC-A11, TC-A20 | VR-META-005, VR-META-007, VR-META-BC-001 |
| meta-with-steps | TC-A03, TC-A04, TC-A14, TC-A15, TC-A19 | VR-META-005, VR-META-007 |
| meta-steps-string | TC-A05 | VR-META-005, ERR-META-004 |
| meta-steps-null | TC-A06 | VR-META-005, ERR-META-004 |
| meta-steps-number | TC-A07 | VR-META-005, ERR-META-004 |
| meta-depth-null | TC-A08 | VR-META-007, ERR-META-005 |
| meta-depth-array | TC-A09 | VR-META-007, ERR-META-005 |
| meta-depth-string | TC-A10 | VR-META-007, ERR-META-005 |
| meta-corrupt | TC-A13 | ERR-META-002 |
| meta-full-legacy | TC-A18, TC-A20 | VR-META-BC-001..003 |
| valid-step | TC-B01, TC-B02 | VR-STEP-001..005, VR-STEP-010 |
| invalid-step-id | TC-B03, TC-B04, TC-B05 | VR-STEP-001, ERR-STEP-005 |
| invalid-persona | TC-B11 | VR-STEP-003, ERR-STEP-006 |
| invalid-depth | TC-B15 | VR-STEP-004, ERR-STEP-006 |
| empty-outputs | TC-B17, TC-B18 | VR-STEP-005, ERR-STEP-005 |
| malformed-yaml | TC-B25, TC-B26 | ERR-STEP-004 |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-19 | Test Strategy Designer (Phase 05) | Initial test data plan |
