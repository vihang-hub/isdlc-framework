# Test Strategy: BUG-0010-GH-16

**Phase**: 05-test-strategy
**Bug**: Fix artifact-paths.json filename mismatches that block valid phase completions
**External**: [GitHub Issue #16](https://github.com/vihang-hub/isdlc-framework/issues/16)
**Created**: 2026-02-17

---

## Existing Infrastructure

- **Test Runner**: `node:test` (built-in Node.js test runner, Node >= 20)
- **Assertion Library**: `node:assert/strict`
- **Module System**: CJS for hooks tests (`*.test.cjs`), ESM for other tests (`*.test.js`)
- **Test Commands**:
  - Unit (hooks): `npm run test:hooks` (`node --test src/claude/hooks/tests/*.test.cjs`)
  - Unit (lib): `npm test` (`node --test lib/*.test.js lib/utils/*.test.js`)
  - Characterization: `npm run test:char` (`node --test tests/characterization/*.test.js`)
  - E2E: `npm run test:e2e` (`node --test tests/e2e/*.test.js`)
  - All: `npm run test:all`
- **Existing Patterns**: Hooks tests use `require('node:test')`, CJS format, `describe/it` style, helper functions for building ctx/state/requirements objects
- **Existing Gate-Blocker Tests**: `src/claude/hooks/tests/gate-blocker-phase-status-bypass.test.cjs`, `gate-blocker-inconsistent-behavior.test.cjs`
- **Test File Location**: `src/claude/hooks/tests/` for hook tests

## Strategy for This Requirement

- **Approach**: Extend existing hook test suite with a new CJS test file
- **Focus**: Config correctness validation + gate-blocker behavioral verification with corrected config
- **Coverage Target**: 100% of ACs (6/6), 100% of NFRs (3/3)
- **No new frameworks**: Use existing `node:test` + `node:assert/strict`
- **Follow existing patterns**: CJS format, `describe/it` style, helper functions matching `gate-blocker-phase-status-bypass.test.cjs` conventions

---

## Test Types

### 1. Unit Tests (Config Validation)

Verify that both JSON config files contain the correct values after the fix is applied. These tests read the actual config files and assert specific field values.

| Test ID | Description | AC |
|---------|-------------|-----|
| TC-01 | artifact-paths.json is valid JSON | NFR-3 |
| TC-02 | artifact-paths.json phase 08-code-review references `code-review-report.md` | AC-1 |
| TC-03 | iteration-requirements.json is valid JSON | NFR-3 |
| TC-04 | iteration-requirements.json phase 08-code-review artifact_validation paths references `code-review-report.md` | AC-2 |
| TC-05 | iteration-requirements.json `workflow_overrides.fix["01-requirements"]` includes `artifact_validation.enabled: false` | AC-4 |
| TC-06 | iteration-requirements.json base `phase_requirements["01-requirements"]` has `artifact_validation.enabled: true` | AC-5 |
| TC-07 | Feature workflow override does NOT disable Phase 01 artifact validation | AC-5, NFR-2 |

### 2. Integration Tests (Gate-Blocker Behavior)

Verify that `checkArtifactPresenceRequirement()` produces correct results with the corrected config values. These tests invoke the gate-blocker `check()` function with realistic state/requirements/input combinations and verify artifact check outcomes.

| Test ID | Description | AC |
|---------|-------------|-----|
| TC-08 | Gate-blocker does not produce false artifact_presence failure for Phase 08 when `code-review-report.md` exists | AC-3 |
| TC-09 | Gate-blocker still blocks Phase 08 when `code-review-report.md` does NOT exist | AC-3 (negative) |
| TC-10 | Gate-blocker does not produce false artifact_presence failure for Phase 01 in fix workflows (artifact validation disabled by override) | AC-6 |
| TC-11 | Gate-blocker still validates Phase 01 artifacts in feature workflows | AC-5, NFR-2 |
| TC-12 | Gate-blocker still validates Phase 01 artifacts in base config (no workflow override applied) | AC-5 |

### 3. NFR Verification Tests

| Test ID | Description | NFR |
|---------|-------------|-----|
| TC-13 | gate-blocker.cjs has zero changes (file hash unchanged) | NFR-1 |

---

## Test File

**Path**: `src/claude/hooks/tests/artifact-paths-config-fix.test.cjs`

**Rationale**: Follows existing convention of placing hook tests in `src/claude/hooks/tests/` with `.test.cjs` extension. File name reflects the bug being tested.

**Run command**: `npm run test:hooks` (picks up `*.test.cjs` via glob)

---

## Test Cases

### TC-01: artifact-paths.json is valid JSON

```
Given: The file src/claude/hooks/config/artifact-paths.json exists
When:  It is read and parsed with JSON.parse()
Then:  No error is thrown
And:   The parsed result is a non-null object
```

**Priority**: P0
**Traces to**: NFR-3

### TC-02: artifact-paths.json Phase 08 references code-review-report.md

```
Given: artifact-paths.json is loaded and parsed
When:  The paths for phase "08-code-review" are read
Then:  The paths array contains exactly one entry
And:   That entry is "docs/requirements/{artifact_folder}/code-review-report.md"
```

**Priority**: P0
**Traces to**: AC-1

### TC-03: iteration-requirements.json is valid JSON

```
Given: The file src/claude/hooks/config/iteration-requirements.json exists
When:  It is read and parsed with JSON.parse()
Then:  No error is thrown
And:   The parsed result is a non-null object
```

**Priority**: P0
**Traces to**: NFR-3

### TC-04: iteration-requirements.json Phase 08 artifact_validation references code-review-report.md

```
Given: iteration-requirements.json is loaded and parsed
When:  phase_requirements["08-code-review"].artifact_validation.paths is read
Then:  The paths array contains exactly one entry
And:   That entry is "docs/requirements/{artifact_folder}/code-review-report.md"
```

**Priority**: P0
**Traces to**: AC-2

### TC-05: Fix workflow override disables Phase 01 artifact validation

```
Given: iteration-requirements.json is loaded and parsed
When:  workflow_overrides.fix["01-requirements"].artifact_validation is read
Then:  The "enabled" property is false
```

**Priority**: P0
**Traces to**: AC-4

### TC-06: Base config Phase 01 artifact validation remains enabled

```
Given: iteration-requirements.json is loaded and parsed
When:  phase_requirements["01-requirements"].artifact_validation is read
Then:  The "enabled" property is true
And:   The "paths" array contains "docs/requirements/{artifact_folder}/requirements-spec.md"
```

**Priority**: P0
**Traces to**: AC-5

### TC-07: Feature workflow does NOT override Phase 01 artifact validation

```
Given: iteration-requirements.json is loaded and parsed
When:  workflow_overrides.feature is read
Then:  There is no "01-requirements" key in the feature override
Or:    If a "01-requirements" key exists, it does NOT contain artifact_validation.enabled: false
```

**Priority**: P1
**Traces to**: AC-5, NFR-2

### TC-08: Gate-blocker allows Phase 08 when code-review-report.md exists

```
Given: A temporary project directory with:
       - .isdlc/state.json with active_workflow.current_phase = "08-code-review"
       - docs/requirements/BUG-TEST/code-review-report.md exists on disk
       - iteration-requirements.json loaded with artifact_validation enabled for 08-code-review
       - artifact-paths.json references code-review-report.md
When:  check() is called with a gate advancement input
Then:  The artifact_presence check is satisfied (no block on artifact_presence)
```

**Priority**: P0
**Traces to**: AC-3

### TC-09: Gate-blocker blocks Phase 08 when code-review-report.md is missing

```
Given: A temporary project directory with:
       - .isdlc/state.json with active_workflow.current_phase = "08-code-review"
       - docs/requirements/BUG-TEST/code-review-report.md does NOT exist on disk
       - iteration-requirements.json loaded with artifact_validation enabled for 08-code-review
       - artifact-paths.json references code-review-report.md
When:  check() is called with a gate advancement input
Then:  The result includes an artifact_presence check with satisfied: false
And:   The missing_artifacts list mentions code-review-report.md
```

**Priority**: P1
**Traces to**: AC-3 (negative case)

### TC-10: Gate-blocker skips artifact check for Phase 01 in fix workflows

```
Given: iteration-requirements.json with workflow_overrides.fix["01-requirements"].artifact_validation.enabled = false
When:  The gate-blocker merges the fix workflow override onto base Phase 01 requirements
And:   checkArtifactPresenceRequirement() is called
Then:  The function returns { satisfied: true, reason: 'not_required' }
And:   No file existence check is performed
```

**Priority**: P0
**Traces to**: AC-6

### TC-11: Gate-blocker validates Phase 01 artifacts in feature workflows

```
Given: iteration-requirements.json with NO feature workflow override disabling Phase 01 artifact validation
When:  The gate-blocker merges the feature workflow override onto base Phase 01 requirements
And:   checkArtifactPresenceRequirement() is called
Then:  artifact_validation.enabled remains true
And:   File existence check is performed for requirements-spec.md
```

**Priority**: P1
**Traces to**: AC-5, NFR-2

### TC-12: Gate-blocker validates Phase 01 artifacts in base config (no workflow)

```
Given: iteration-requirements.json base phase_requirements["01-requirements"].artifact_validation.enabled = true
When:  checkArtifactPresenceRequirement() is called without any workflow override
Then:  artifact_validation.enabled is true
And:   File existence check is performed for requirements-spec.md
```

**Priority**: P1
**Traces to**: AC-5

### TC-13: gate-blocker.cjs is unchanged (NFR-1)

```
Given: The fix has been applied (config files only)
When:  gate-blocker.cjs is read
Then:  Its content matches the pre-fix content exactly (same git hash)
Note:  This test verifies NFR-1 by checking that the gate-blocker source code itself
       has no modifications. In practice, this can be verified by checking that
       gate-blocker.cjs has no unstaged/staged changes via git, or by comparing
       a known checksum. For the test suite, we verify the file exists and contains
       expected key functions without modification.
```

**Priority**: P1
**Traces to**: NFR-1

---

## Test Data Plan

### Static Test Data (Config Files)

The primary test data is the config files themselves. Tests read the actual production config files to verify correctness:

- `src/claude/hooks/config/artifact-paths.json` -- read and parsed in-process
- `src/claude/hooks/config/iteration-requirements.json` -- read and parsed in-process

### Dynamic Test Data (Integration Tests)

For gate-blocker integration tests (TC-08 through TC-12), temporary directories are created with:

- **state.json**: Minimal state with `active_workflow.current_phase`, `active_workflow.artifact_folder`, `active_workflow.type`, and `phases[phase]` state
- **Artifact files**: Temporary files created/omitted in `docs/requirements/{artifact_folder}/` to simulate present/missing artifacts
- **Requirements objects**: Built in-memory following the pattern from `gate-blocker-phase-status-bypass.test.cjs`

### Fixtures

```javascript
// State for Phase 08 test
const phase08State = {
  active_workflow: {
    type: 'fix',
    current_phase: '08-code-review',
    artifact_folder: 'BUG-TEST'
  },
  phases: { '08-code-review': {} },
  iteration_enforcement: { enabled: true }
};

// State for Phase 01 fix workflow test
const phase01FixState = {
  active_workflow: {
    type: 'fix',
    current_phase: '01-requirements',
    artifact_folder: 'BUG-TEST'
  },
  phases: { '01-requirements': {} },
  iteration_enforcement: { enabled: true }
};

// State for Phase 01 feature workflow test
const phase01FeatureState = {
  active_workflow: {
    type: 'feature',
    current_phase: '01-requirements',
    artifact_folder: 'REQ-TEST'
  },
  phases: { '01-requirements': {} },
  iteration_enforcement: { enabled: true }
};
```

---

## Critical Paths

### Critical Path 1: Phase 08 artifact filename resolution

```
artifact-paths.json -> getArtifactPathsForPhase("08-code-review") -> checkArtifactPresenceRequirement() -> fs.existsSync("code-review-report.md")
```

If the filename in artifact-paths.json is wrong, every Phase 08 completion is blocked. This is the primary fix for Bug 1.

### Critical Path 2: Fix workflow Phase 01 artifact validation bypass

```
iteration-requirements.json -> workflow_overrides.fix["01-requirements"] -> mergeRequirements() -> artifact_validation.enabled = false -> checkArtifactPresenceRequirement() returns { satisfied: true }
```

If the workflow override is missing or incorrect, every fix workflow Phase 01 completion is blocked. This is the primary fix for Bug 2.

### Critical Path 3: Feature workflow Phase 01 artifact validation preservation

```
iteration-requirements.json -> base phase_requirements["01-requirements"].artifact_validation.enabled = true -> NO override disabling it -> checkArtifactPresenceRequirement() checks file existence
```

If the fix accidentally disables artifact validation for feature workflows, a regression is introduced. This is the safety check for NFR-2.

---

## Coverage Targets

| Metric | Target |
|--------|--------|
| AC coverage | 6/6 (100%) |
| NFR coverage | 3/3 (100%) |
| Config correctness tests | 7 (TC-01 through TC-07) |
| Integration behavior tests | 5 (TC-08 through TC-12) |
| NFR verification tests | 1 (TC-13) |
| Total test cases | 13 |

---

## Traceability Summary

| Requirement | Test Cases | Priority |
|-------------|-----------|----------|
| AC-1 | TC-02 | P0 |
| AC-2 | TC-04 | P0 |
| AC-3 | TC-08, TC-09 | P0, P1 |
| AC-4 | TC-05 | P0 |
| AC-5 | TC-06, TC-07, TC-11, TC-12 | P0, P1 |
| AC-6 | TC-10 | P0 |
| NFR-1 | TC-13 | P1 |
| NFR-2 | TC-07, TC-11 | P1 |
| NFR-3 | TC-01, TC-03 | P0 |
