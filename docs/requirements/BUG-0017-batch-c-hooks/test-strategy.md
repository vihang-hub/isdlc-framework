# Test Strategy: BUG-0017 Batch C Hook Bugs

**Phase**: 05-test-strategy
**Workflow**: fix
**Artifact Folder**: BUG-0017-batch-c-hooks
**Date**: 2026-02-15
**Bugs Covered**: Bug 0.9 (gate-blocker.cjs), Bug 0.10 (state-write-validator.cjs)

---

## Existing Infrastructure (from test evaluation)

- **Framework**: Node.js built-in `node:test` + `node:assert/strict` (CJS stream)
- **Coverage Tool**: c8 (Istanbul-based)
- **Current Baseline**: 555+ tests (302 ESM + 253 CJS)
- **Existing gate-blocker tests**: `src/claude/hooks/tests/test-gate-blocker-extended.test.cjs` (38 tests across 7 describe blocks)
- **Existing state-write-validator tests**: `src/claude/hooks/tests/state-write-validator.test.cjs` (67 tests: T1-T15 content validation, T16-T31 V7, T32-T67 V8)
- **Test Helpers**: `src/claude/hooks/tests/hook-test-utils.cjs` (shared CJS utilities for gate-blocker tests); state-write-validator uses its own `spawnSync`-based `setupTestEnv()`/`runHook()`
- **Naming Convention**: `test-*.test.cjs` or `*.test.cjs` in `src/claude/hooks/tests/`
- **Run Command**: `node --test src/claude/hooks/tests/<filename>.test.cjs`

## Strategy for This Requirement

- **Approach**: Extend existing test suites (NOT replace). Add new test cases to the two existing test files.
- **New Test Types Needed**: Unit tests for new fix behavior + regression tests for existing behavior preservation
- **Coverage Target**: 100% of the 13 acceptance criteria (AC-1.1 through AC-1.6, AC-2.1 through AC-2.7)
- **Existing Tests Impacted**: T19 and T20 in `state-write-validator.test.cjs` must be updated to expect BLOCK instead of ALLOW (these encode buggy behavior)

## Test Commands (use existing)

- Gate-blocker tests: `node --test src/claude/hooks/tests/test-gate-blocker-extended.test.cjs`
- State-write-validator tests: `node --test src/claude/hooks/tests/state-write-validator.test.cjs`
- All hook tests: `npm run test:hooks`
- All tests: `npm run test:all`

---

## 1. Test Scope

### Bug 0.9: Misleading Artifact Error Messages (gate-blocker.cjs)

**Function Under Test**: `checkArtifactPresenceRequirement()` (lines 466-511)

**What Changed**: Line 497 -- when no variant in a directory group satisfies the requirement, the missing artifacts list now includes a composite string showing all valid variants instead of just the first one.

**Test Approach**: Add a new describe block `'BUG-0017: Artifact variant reporting'` to `test-gate-blocker-extended.test.cjs` with tests that exercise the artifact presence check through the hook's `check()` entry point. Tests need to create iteration-requirements.json configs with multi-variant paths and then trigger gate advancement.

**Important Constraint**: The gate-blocker tests use `hook-test-utils.cjs` which runs the hook via `runHook()` (spawning a child process). The artifact check requires files to exist (or not exist) on disk, so we must use the test directory's filesystem to control which variant files are present.

### Bug 0.10: Version Lock Bypass (state-write-validator.cjs)

**Function Under Test**: `checkVersionLock()` (lines 107-174)

**What Changed**: Lines 131-133 -- the backward-compatibility guard for unversioned incoming state now reads the disk state before making the allow/block decision. If disk is versioned but incoming is not, the write is BLOCKED.

**Test Approach**: Add new tests and update existing tests (T19, T20) in the `'BUG-0009: Version Check (V7)'` describe block within `state-write-validator.test.cjs`. The state-write-validator tests use their own `spawnSync`-based test helpers that are self-contained within the file.

---

## 2. Test Types

### 2.1 Unit Tests (Primary)

All tests are executed as hook-level unit tests via child process spawning. This matches the existing test pattern where each test:
1. Creates a temp directory with controlled state
2. Spawns the hook process with crafted stdin
3. Asserts on stdout (block/allow), stderr (warnings/logs), and exit code

### 2.2 Regression Tests

Both bugs require regression coverage to verify that existing behavior is preserved:
- Bug 0.9: Single-artifact-path gates still report correctly; gates with at least one variant present still pass
- Bug 0.10: All existing V7 version checks (T16-T18, T21-T31) still work; V8 phase protection unaffected

### 2.3 Integration Tests

Not needed for these localized fixes. The hook-level tests already integrate the full hook execution path (parsing stdin, reading config, checking artifacts/versions, producing stdout).

### 2.4 Security Tests

Bug 0.10 has a security dimension (data integrity bypass). The test for AC-2.1 specifically validates that the version lock cannot be bypassed by omitting `state_version`.

### 2.5 Performance Tests

Existing performance tests (T66, T67) cover the state-write-validator. No new performance tests needed since the fix adds at most one additional `fs.readFileSync` call in a code path that already performs disk I/O.

---

## 3. Test Cases

### 3.1 Bug 0.9: Gate-Blocker Variant Reporting (7 new tests)

These tests are added to `test-gate-blocker-extended.test.cjs` under a new describe block.

| TC ID | Test Name | AC | Input | Expected Output | Priority |
|-------|-----------|-----|-------|-----------------|----------|
| TC-GB-V01 | Multi-variant missing: error lists all variants | AC-1.1 | Gate requires `interface-spec.yaml` OR `interface-spec.md`; neither exists on disk | Block with stopReason containing both filenames; `missing_artifacts` contains composite string `"...interface-spec.yaml (or interface-spec.md)"` | P0 |
| TC-GB-V02 | Multi-variant satisfied by second variant | AC-1.2 | Gate requires `interface-spec.yaml` OR `interface-spec.md`; only `.md` exists | Gate passes (empty stdout, allow) | P0 |
| TC-GB-V03 | Single-path missing: error unchanged | AC-1.3 | Gate requires `requirements-spec.md` only (single path); file missing | Block with stopReason showing single path only (no "or" syntax) | P1 |
| TC-GB-V04 | Multi-variant: composite representation in missing_artifacts | AC-1.4 | Gate requires 2 variants; neither exists | Parse state after block to verify `missing_artifacts` array contains composite string | P1 |
| TC-GB-V05 | All variants exist: no error | AC-1.5 | Gate requires `interface-spec.yaml` OR `interface-spec.md`; both exist | Gate passes (allow) | P1 |
| TC-GB-V06 | Existing tests still pass (regression) | AC-1.6 | Run full existing test suite | All 38 existing gate-blocker tests pass | P0 |
| TC-GB-V07 | Three-variant group: all listed when missing | AC-1.1 | Gate requires 3 variants (`.yaml`, `.md`, `.json`) in same dir; none exist | Error shows all three variants | P2 |

### 3.2 Bug 0.10: Version Lock Bypass (8 new/updated tests)

These tests are in `state-write-validator.test.cjs` within the `'BUG-0009: Version Check (V7)'` describe block.

| TC ID | Test Name | AC | Input | Expected Output | Priority |
|-------|-----------|-----|-------|-----------------|----------|
| TC-SWV-01 | Unversioned incoming BLOCKED when disk is versioned | AC-2.1 | Disk: `state_version: 5`; Incoming: no `state_version` field | Block with stopReason mentioning missing version and disk version 5 | P0 |
| TC-SWV-02 | Unversioned incoming ALLOWED when disk is unversioned | AC-2.2 | Disk: no `state_version`; Incoming: no `state_version` | Allow (empty stdout) | P0 |
| TC-SWV-03 | Unversioned incoming ALLOWED when no disk file | AC-2.3 | No disk file exists; Incoming: no `state_version` | Allow (empty stdout) | P0 |
| TC-SWV-04 | Versioned incoming >= disk ALLOWED (existing behavior) | AC-2.4 | Disk: `state_version: 5`; Incoming: `state_version: 5` | Allow (empty stdout) -- covered by existing T17 | P1 |
| TC-SWV-05 | Versioned incoming < disk BLOCKED (existing behavior) | AC-2.5 | Disk: `state_version: 5`; Incoming: `state_version: 3` | Block -- covered by existing T16 | P1 |
| TC-SWV-06 | Block message for unversioned incoming is actionable | AC-2.6 | Disk: `state_version: 10`; Incoming: no `state_version` | Block message contains disk version number and clear instructions to include `state_version` | P1 |
| TC-SWV-07 | Null incoming state_version BLOCKED when disk is versioned | AC-2.1 | Disk: `state_version: 5`; Incoming: `state_version: null` | Block (updated T20 expectation) | P0 |
| TC-SWV-08 | Fail-open on disk read error during unversioned check | NFR-1 | Disk file has permission error (simulate via corrupt path); Incoming: no `state_version` | Allow (fail-open) | P2 |

### 3.3 Updated Existing Tests (T19, T20)

| TC ID | Current Behavior | New Expected Behavior | AC |
|-------|------------------|-----------------------|-----|
| T19 | `assert.equal(result.stdout, '')` (ALLOW) | `assert.ok(result.stdout.includes('"continue":false'))` (BLOCK) | AC-2.1 |
| T20 | `assert.equal(result.stdout, '')` (ALLOW) | `assert.ok(result.stdout.includes('"continue":false'))` (BLOCK) | AC-2.1 |

Note: T28 (`allows when both disk and incoming lack state_version`) remains unchanged -- it covers the legitimate legacy case and should continue to pass.

---

## 4. Detailed Test Specifications

### 4.1 TC-GB-V01: Multi-variant missing lists all variants

```
Setup:
  - Write iteration-requirements.json with artifact_validation for phase '04-design':
    paths: ["docs/design/{artifact_folder}/interface-spec.yaml",
            "docs/design/{artifact_folder}/interface-spec.md"]
  - Write state.json with:
    current_phase: '04-design'
    active_workflow.artifact_folder: 'REQ-TEST'
    phases.'04-design'.status: 'in_progress'
    (All other gate requirements disabled or satisfied)
  - Do NOT create interface-spec.yaml or interface-spec.md on disk

Input:
  tool_name: 'Task'
  tool_input:
    prompt: 'advance to next phase'
    subagent_type: 'sdlc-orchestrator'

Expected:
  - exit code: 0
  - stdout: JSON with { "continue": false, "stopReason": "..." }
  - stopReason contains BOTH "interface-spec.yaml" AND "interface-spec.md"
  - stopReason contains "(or" to indicate alternatives
```

### 4.2 TC-GB-V02: Multi-variant satisfied by second variant

```
Setup:
  - Same iteration-requirements.json as TC-GB-V01
  - Same state.json as TC-GB-V01
  - Create docs/design/REQ-TEST/interface-spec.md on disk (second variant)
  - Do NOT create interface-spec.yaml

Input:
  Same as TC-GB-V01

Expected:
  - Artifact check passes (no artifact-related block)
  - If other requirements are disabled, gate opens (empty stdout)
```

### 4.3 TC-GB-V03: Single-path missing is unchanged

```
Setup:
  - iteration-requirements.json with artifact_validation for phase '01-requirements':
    paths: ["docs/requirements/{artifact_folder}/requirements-spec.md"]
  - state.json with current_phase: '01-requirements'
  - Do NOT create requirements-spec.md on disk

Input:
  Same pattern as TC-GB-V01 but for phase '01-requirements'

Expected:
  - Block with stopReason containing "requirements-spec.md"
  - stopReason does NOT contain "(or" (single path, no alternatives)
```

### 4.4 TC-GB-V04: Composite representation in missing_artifacts

```
Setup:
  Same as TC-GB-V01

Verification:
  After hook blocks, read state.json and inspect:
  - phases.'04-design'.gate_validation.blocking_requirements should reference artifact check
  - The block stopReason should contain composite path "...interface-spec.yaml (or interface-spec.md)"
```

### 4.5 TC-GB-V05: All variants exist

```
Setup:
  Same as TC-GB-V01 but create BOTH files:
  - docs/design/REQ-TEST/interface-spec.yaml
  - docs/design/REQ-TEST/interface-spec.md

Expected:
  - Artifact check passes
```

### 4.6 TC-GB-V07: Three variants all missing

```
Setup:
  - artifact_validation paths with 3 variants in same directory:
    ["docs/design/{artifact_folder}/spec.yaml",
     "docs/design/{artifact_folder}/spec.md",
     "docs/design/{artifact_folder}/spec.json"]
  - None exist on disk

Expected:
  - Block stopReason contains all three: "spec.yaml (or spec.md, spec.json)"
```

### 4.7 TC-SWV-01: Unversioned incoming blocked when disk versioned

```
Setup:
  - Write disk state.json with: { state_version: 5, phases: {} }

Input:
  tool_name: 'Write'
  tool_input:
    file_path: <path to state.json>
    content: '{ "phases": {} }'  (no state_version)

Expected:
  - exit code: 0
  - stdout: JSON with { "continue": false }
  - stdout contains "state_version" and "5"
  - stderr contains "[state-write-validator]"
```

### 4.8 TC-SWV-02: Unversioned incoming allowed when disk unversioned

```
Setup:
  - Write disk state.json with: { phases: {} }  (no state_version)

Input:
  tool_name: 'Write'
  tool_input:
    file_path: <path to state.json>
    content: '{ "phases": {} }'  (no state_version)

Expected:
  - exit code: 0
  - stdout: '' (empty -- allow)
```

### 4.9 TC-SWV-03: Unversioned incoming allowed when no disk file

```
Setup:
  - Remove disk state.json (or use path where file does not exist)

Input:
  tool_name: 'Write'
  tool_input:
    file_path: <path to non-existent state.json>
    content: '{ "phases": {} }'  (no state_version)

Expected:
  - exit code: 0
  - stdout: '' (empty -- allow)
```

### 4.10 TC-SWV-06: Block message is actionable

```
Setup:
  - Write disk state.json with: { state_version: 10, phases: {} }

Input:
  tool_name: 'Write'
  tool_input:
    file_path: <path to state.json>
    content: '{ "phases": {} }'  (no state_version)

Expected:
  - stdout contains "state_version"
  - stdout contains "10" (disk version)
  - stdout contains guidance to include state_version (e.g., "Include state_version >= 10")
```

### 4.11 TC-SWV-07: Null incoming blocked when disk versioned

```
Setup:
  - Write disk state.json with: { state_version: 5, phases: {} }

Input:
  tool_name: 'Write'
  tool_input:
    file_path: <path to state.json>
    content: '{ "state_version": null, "phases": {} }'

Expected:
  - stdout: JSON with { "continue": false }
  - Same behavior as TC-SWV-01
```

### 4.12 TC-SWV-08: Fail-open on disk read error

```
Setup:
  - Write state.json to disk then make the .isdlc directory inaccessible
    (or use a path pattern matching STATE_JSON_PATTERN but pointing to a corrupt file)

Input:
  tool_name: 'Write'
  tool_input:
    file_path: <path to state.json with read error>
    content: '{ "phases": {} }'

Expected:
  - exit code: 0
  - stdout: '' (fail-open -- allow)
```

---

## 5. Test Data Plan

### 5.1 Gate-Blocker Test Data

**State configurations:**
- Phase `04-design` with all non-artifact requirements disabled (isolate artifact check)
- `active_workflow.artifact_folder` set to `REQ-TEST`

**Iteration requirements configurations:**
- Multi-variant: 2 paths in same directory (`interface-spec.yaml`, `interface-spec.md`)
- Multi-variant: 3 paths in same directory (`spec.yaml`, `spec.md`, `spec.json`)
- Single-path: 1 path only (`requirements-spec.md`)
- Cross-directory: paths in different directories (should remain independently checked)

**Filesystem fixtures:**
- Empty directory (no variants exist)
- First variant only exists
- Second variant only exists
- All variants exist
- Both variants exist

### 5.2 State-Write-Validator Test Data

**Disk states:**
- `{ state_version: 5, phases: {} }` -- versioned disk
- `{ state_version: 10, phases: {} }` -- versioned disk (higher version)
- `{ phases: {} }` -- unversioned disk
- No file on disk -- first write scenario
- Corrupt JSON on disk -- fail-open scenario

**Incoming states:**
- `{ phases: {} }` -- unversioned incoming (undefined state_version)
- `{ state_version: null, phases: {} }` -- null incoming
- `{ state_version: 5, phases: {} }` -- matching version
- `{ state_version: 3, phases: {} }` -- stale version
- `{ state_version: 6, phases: {} }` -- newer version

---

## 6. Risk Assessment

### High Risk
- **T19/T20 updates**: These tests changing from ALLOW to BLOCK is a semantic change. Must verify the test update matches the code fix precisely.
- **AC-2.1 bypass path**: The version lock bypass is a data integrity issue. TC-SWV-01 and TC-SWV-07 are P0 critical.

### Medium Risk
- **Gate-blocker artifact path resolution**: Tests depend on `resolveArtifactPaths()` correctly replacing `{artifact_folder}`. If the template resolution changes, tests may need updating.
- **Multi-variant edge cases**: Three or more variants in the same directory are unusual but should be supported.

### Low Risk
- **Existing test regression**: Both test files have comprehensive existing coverage. The fixes are localized (single-point changes) and unlikely to affect unrelated test paths.

---

## 7. Critical Paths

1. **Version lock enforcement path**: `check()` -> `checkVersionLock()` -> disk read -> version comparison -> block/allow
2. **Artifact presence check path**: `check()` -> `checkArtifactPresenceRequirement()` -> path grouping -> existence check -> error reporting
3. **Fail-open path**: Any error during disk I/O should result in ALLOW (not crash)

---

## 8. Coverage Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| AC coverage | 13/13 (100%) | Every acceptance criterion has at least one test case |
| FR coverage | 6/6 (100%) | Every functional requirement is tested |
| NFR coverage | 4/4 (100%) | Fail-open, actionable messages, backward compat, no new deps |
| Regression | 0 failures | All existing 38 gate-blocker + 67 state-write-validator tests pass |
| Branch coverage (fix lines) | 100% | Both true and false branches of fix conditionals covered |

---

## 9. Test Execution Order

1. Run existing test suites FIRST to establish green baseline
2. Update T19 and T20 (they will fail against current code -- RED)
3. Add new Bug 0.10 tests (they will fail against current code -- RED)
4. Add new Bug 0.9 tests (they will fail against current code -- RED)
5. Implementation phase applies fixes
6. All tests should go GREEN after fixes applied
7. Quality loop runs full suite to verify no regressions

---

## 10. Dependencies

- Both test files are self-contained CJS modules with no external dependencies beyond Node.js built-ins
- Gate-blocker tests depend on `hook-test-utils.cjs` for `setupTestEnv()`, `prepareHook()`, `runHook()`
- State-write-validator tests use their own `spawnSync`-based helpers (no shared dependency)
- No new npm packages required (NFR-4 satisfied)
