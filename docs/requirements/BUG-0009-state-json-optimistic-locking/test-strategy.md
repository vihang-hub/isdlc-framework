# Test Strategy: BUG-0009 State.json Optimistic Locking

**Phase**: 05 - Test Strategy & Design
**Bug**: BUG-0009 (subagent state.json drift via stale writes)
**Created**: 2026-02-12
**Framework**: Node.js built-in `node:test` + `node:assert/strict` (CJS)

---

## Existing Infrastructure

- **Test Framework**: `node:test` (Node.js built-in) -- CJS hook tests use `.test.cjs` extension
- **Assertion Library**: `node:assert/strict`
- **Test Helpers**: `src/claude/hooks/tests/hook-test-utils.cjs` (setupTestEnv, cleanupTestEnv, prepareHook, runHook, writeState, readState)
- **Existing Test File**: `src/claude/hooks/tests/state-write-validator.test.cjs` (15 tests, T1-T15)
- **Existing Common Tests**: None (no `common.test.cjs` exists; common.cjs tests are spread across other test files)
- **Coverage Tool**: None configured (manual coverage tracking via test count baseline: 555)
- **Current Coverage**: state-write-validator has 15 tests covering V1/V2/V3 structural rules
- **Existing Patterns**: Tests use own `setupTestEnv()`/`writeStateFile()`/`runHook()` functions in-file (not the shared hook-test-utils.cjs). Tests spawn the hook as a child process via `spawnSync`.

---

## Strategy for This Requirement

### Approach

**Extend the existing test suite.** Add new test cases to `state-write-validator.test.cjs` for the V7 version check rule, and create a new `common.test.cjs` for `writeState()` version auto-increment tests. Follow the existing naming convention (T16+) and test patterns (spawnSync for hook tests, direct function calls for common.cjs unit tests).

### New Test Types Needed

1. **Unit Tests** (common.cjs): Test `writeState()` version auto-increment logic in isolation
2. **Unit Tests** (state-write-validator.cjs): Test V7 version mismatch detection via the `check()` function
3. **Integration Tests** (state-write-validator.cjs): Test the full hook via `spawnSync` (standalone mode)
4. **Concurrency Simulation Tests**: Simulate the stale-write scenario with interleaved reads/writes
5. **Backward Compatibility Tests**: Verify graceful handling of legacy state files (no `state_version`)
6. **Fail-Open Tests**: Verify corrupted/missing version fields do not block

### Coverage Target

- **All 5 functional requirements (FIX-001 through FIX-005)**: 100% coverage
- **All 22 acceptance criteria (AC-01a through AC-05d)**: At least 1 test per AC
- **New test count**: 22 new test cases (16 in state-write-validator, 6 in common)
- **Regression**: All 15 existing state-write-validator tests must continue passing

---

## Test Files

| File | Type | New Tests | Description |
|------|------|-----------|-------------|
| `src/claude/hooks/tests/state-write-validator.test.cjs` | Unit + Integration | 16 | V7 version check rule tests (T16-T31) |
| `src/claude/hooks/tests/common.test.cjs` | Unit | 6 | writeState() version auto-increment tests |

---

## Test Categories

### Category 1: Version Match -- Write Allowed (FIX-002)

Tests that verify writes are allowed when the incoming `state_version` matches the on-disk version.

| Test ID | Test Name | Requirement | AC | Description |
|---------|-----------|-------------|-----|-------------|
| T16 | Version match allows write | FIX-002 | AC-02d | Write state.json with `state_version: 5` when disk has `state_version: 5`. Verify `decision: 'allow'` and no stderr WARNING. |
| T17 | Version match allows write via Edit tool | FIX-002 | AC-02a,d | Same as T16 but using `tool_name: 'Edit'`. Verify Edit tool path also checks version. |

### Category 2: Version Mismatch -- Write Blocked (FIX-002)

Tests that verify writes are blocked when the incoming version is behind the on-disk version.

| Test ID | Test Name | Requirement | AC | Description |
|---------|-----------|-------------|-----|-------------|
| T18 | Stale version blocks write | FIX-002 | AC-02c | Write state.json with `state_version: 3` when disk has `state_version: 5`. Verify `decision: 'block'` and `stopReason` contains version mismatch guidance. |
| T19 | Block message includes expected and actual version | FIX-002 | AC-02e | Same scenario as T18. Verify `stopReason` contains "expected: 5" and "actual: 3" (or equivalent). |
| T20 | Block message includes re-read guidance | FIX-002 | AC-02e | Same scenario as T18. Verify `stopReason` contains guidance to re-read state.json. |
| T21 | Version behind by 1 blocks write | FIX-002 | AC-02c | Write `state_version: 4` when disk has `state_version: 5`. Verify block (even 1 behind is stale). |

### Category 3: Missing state_version in Incoming Write (FIX-004, FIX-005)

Tests for backward compatibility when the incoming content has no `state_version`.

| Test ID | Test Name | Requirement | AC | Description |
|---------|-----------|-------------|-----|-------------|
| T22 | Missing incoming state_version allows write (backward compat) | FIX-005 | AC-04a | Write state.json without `state_version` field when disk has `state_version: 5`. Verify `decision: 'allow'` (fail-open). |
| T23 | Null incoming state_version allows write | FIX-005 | AC-04a | Write state.json with `state_version: null`. Verify `decision: 'allow'`. |

### Category 4: Missing state_version on Disk (FIX-004)

Tests for backward compatibility when the existing file has no `state_version`.

| Test ID | Test Name | Requirement | AC | Description |
|---------|-----------|-------------|-----|-------------|
| T24 | Missing disk state_version allows write (migration case) | FIX-002 | AC-02f | Disk state.json has no `state_version`. Incoming write has `state_version: 1`. Verify `decision: 'allow'` (check skipped). |
| T25 | Both missing state_version allows write | FIX-005 | AC-04a,b | Neither disk nor incoming has `state_version`. Verify `decision: 'allow'`. |

### Category 5: Concurrent Write Simulation (FIX-002)

Tests that simulate the actual bug scenario: write, external increment, second stale write fails.

| Test ID | Test Name | Requirement | AC | Description |
|---------|-----------|-------------|-----|-------------|
| T26 | Concurrent write simulation -- second stale write blocked | FIX-002 | AC-02c | (1) Write state.json with `state_version: 1`, (2) externally overwrite file to `state_version: 2` (simulating parent orchestrator write), (3) attempt write with `state_version: 1` (stale). Verify the third write is blocked. |
| T27 | Sequential valid writes succeed | FIX-002 | AC-02d | (1) Write with `state_version: 1`, (2) write with `state_version: 2`, both allowed. Verify monotonic version acceptance. |

### Category 6: Fail-Open on Errors (FIX-005)

Tests that verify the hook fails-open when it encounters unexpected errors.

| Test ID | Test Name | Requirement | AC | Description |
|---------|-----------|-------------|-----|-------------|
| T28 | Corrupted state_version (non-integer) allows write | FIX-005 | AC-05c | Disk has `state_version: "banana"`. Incoming has `state_version: 1`. Verify `decision: 'allow'`. |
| T29 | Negative state_version allows write | FIX-005 | AC-05c | Disk has `state_version: -1`. Verify `decision: 'allow'` (fail-open on nonsensical values). |
| T30 | State.json unreadable on disk allows write | FIX-005 | AC-05a | State.json file does not exist on disk before the Write. Verify `decision: 'allow'`. |

### Category 7: Existing V1-V3 Rules Still Work Alongside V7 (FIX-004)

| Test ID | Test Name | Requirement | AC | Description |
|---------|-----------|-------------|-----|-------------|
| T31 | V1 structural warning still emitted when version matches | FIX-004 | AC-04d | Write with matching `state_version` but a V1-violating phase (constitutional_validation completed with 0 iterations). Verify both the version check passes AND the V1 warning is still emitted on stderr. |

### Category 8: writeState() Auto-Increment (FIX-001, FIX-003) -- common.test.cjs

| Test ID | Test Name | Requirement | AC | Description |
|---------|-----------|-------------|-----|-------------|
| C1 | writeState increments version from existing file | FIX-003 | AC-03a,b | Create state.json with `state_version: 3`. Call `writeState({...})`. Read back. Verify `state_version` is 4. |
| C2 | writeState initializes version to 1 on first write | FIX-003 | AC-03c | No state.json on disk. Call `writeState({...})`. Read back. Verify `state_version` is 1. |
| C3 | writeState initializes version to 1 for legacy file (no state_version) | FIX-001 | AC-01d | Create state.json without `state_version`. Call `writeState({...})`. Read back. Verify `state_version` is 1. |
| C4 | writeState does not mutate caller's in-memory object | FIX-003 | AC-03d | Create state object `{ foo: 'bar' }`. Call `writeState(state)`. Verify `state.state_version` is still undefined on the caller's object. |
| C5 | writeState increments by exactly 1 each call | FIX-001 | AC-01b | Call `writeState()` 3 times. Read after each. Verify versions are 1, 2, 3 (monotonically increasing by exactly 1). |
| C6 | writeState preserves state_version across read/write cycle | FIX-001 | AC-01c | Write state with version 5. Read it back via `readState()`. Verify `state_version` is present in the returned object. Write it again. Verify version increments to 6. |

---

## Test Data Fixtures

### State.json Variants

```javascript
// Fixture 1: Versioned state (current schema)
const VERSIONED_STATE = {
    state_version: 5,
    framework_version: '0.1.0-alpha',
    project: { name: 'test' },
    phases: {},
    active_workflow: null,
    skill_usage_log: [],
    history: []
};

// Fixture 2: Legacy state (no state_version -- migration scenario)
const LEGACY_STATE = {
    framework_version: '0.1.0-alpha',
    project: { name: 'test' },
    phases: {},
    active_workflow: null,
    skill_usage_log: [],
    history: []
};

// Fixture 3: Stale snapshot (version behind)
const STALE_STATE = {
    state_version: 3,
    framework_version: '0.1.0-alpha',
    project: { name: 'test' },
    phases: {},
    active_workflow: { type: 'feature', description: 'Old workflow' },
    skill_usage_log: [],
    history: []
};

// Fixture 4: Corrupted version
const CORRUPTED_VERSION_STATE = {
    state_version: 'banana',
    framework_version: '0.1.0-alpha',
    project: { name: 'test' },
    phases: {}
};

// Fixture 5: Negative version
const NEGATIVE_VERSION_STATE = {
    state_version: -1,
    framework_version: '0.1.0-alpha',
    project: { name: 'test' },
    phases: {}
};

// Fixture 6: Version match with V1 violation (combined scenario)
const V1_VIOLATION_WITH_VERSION = {
    state_version: 5,
    phases: {
        '01-requirements': {
            constitutional_validation: { completed: true, iterations_used: 0 }
        }
    }
};
```

### Hook Input Variants

```javascript
// Write tool input for state.json
function makeWriteInput(filePath, content) {
    return {
        tool_name: 'Write',
        tool_input: {
            file_path: filePath,
            content: JSON.stringify(content, null, 2)
        }
    };
}

// Edit tool input for state.json
function makeEditInput(filePath) {
    return {
        tool_name: 'Edit',
        tool_input: { file_path: filePath }
    };
}
```

---

## Test Execution

### Commands

```bash
# Run state-write-validator tests only
node --test src/claude/hooks/tests/state-write-validator.test.cjs

# Run common.cjs tests only
node --test src/claude/hooks/tests/common.test.cjs

# Run all CJS hook tests
npm run test:hooks
```

### Test Isolation

Each test uses an isolated temporary directory created by `setupTestEnv()` (for common tests) or `fs.mkdtempSync()` (for state-write-validator tests, following existing in-file pattern). Cleanup via `afterEach` with `fs.rmSync(tmpDir, { recursive: true, force: true })`.

### Performance Budget

All version check logic must complete within the existing 100ms budget for the state-write-validator hook. Tests should verify this implicitly (the `spawnSync` timeout is already 5000ms, and any test taking >1s indicates a problem).

---

## Traceability Matrix

| Requirement | Acceptance Criteria | Test IDs | Test File |
|-------------|-------------------|----------|-----------|
| FIX-001 (State Version Counter) | AC-01a | C1, C2 | common.test.cjs |
| FIX-001 | AC-01b | C5 | common.test.cjs |
| FIX-001 | AC-01c | C6 | common.test.cjs |
| FIX-001 | AC-01d | C3 | common.test.cjs |
| FIX-002 (Optimistic Lock Validation) | AC-02a | T17, T18 | state-write-validator.test.cjs |
| FIX-002 | AC-02b | T18, T19 | state-write-validator.test.cjs |
| FIX-002 | AC-02c | T18, T21, T26 | state-write-validator.test.cjs |
| FIX-002 | AC-02d | T16, T17, T27 | state-write-validator.test.cjs |
| FIX-002 | AC-02e | T19, T20 | state-write-validator.test.cjs |
| FIX-002 | AC-02f | T24, T25 | state-write-validator.test.cjs |
| FIX-003 (Auto-Increment) | AC-03a | C1 | common.test.cjs |
| FIX-003 | AC-03b | C1, C5 | common.test.cjs |
| FIX-003 | AC-03c | C2, C3 | common.test.cjs |
| FIX-003 | AC-03d | C4 | common.test.cjs |
| FIX-004 (Backward Compat) | AC-04a | T22, T23, T25 | state-write-validator.test.cjs |
| FIX-004 | AC-04b | C3 | common.test.cjs |
| FIX-004 | AC-04c | T31 (+ existing T1-T15) | state-write-validator.test.cjs |
| FIX-004 | AC-04d | T31 | state-write-validator.test.cjs |
| FIX-005 (Fail-Open) | AC-05a | T30 | state-write-validator.test.cjs |
| FIX-005 | AC-05b | (existing T12) | state-write-validator.test.cjs |
| FIX-005 | AC-05c | T28, T29 | state-write-validator.test.cjs |
| FIX-005 | AC-05d | T18 (stderr check) | state-write-validator.test.cjs |

### Coverage Validation

- **FIX-001**: 4 ACs, 4 test IDs -- 100% covered
- **FIX-002**: 6 ACs, 10 test IDs -- 100% covered
- **FIX-003**: 4 ACs, 5 test IDs -- 100% covered
- **FIX-004**: 4 ACs, 5 test IDs -- 100% covered
- **FIX-005**: 4 ACs, 4 test IDs -- 100% covered
- **Total**: 22 ACs, 22 unique test IDs -- **100% requirement coverage**

---

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Existing T1-T15 tests break due to new V7 rule | Medium | High | T31 explicitly tests coexistence. V7 only fires when `state_version` is present; existing tests don't use it. |
| Hook transitions from PostToolUse to PreToolUse | Medium | Medium | Tests use the `check()` function directly (dispatcher mode) and standalone spawn. Both entry points covered. |
| `writeState()` signature change breaks callers | Low | High | AC-03d test verifies no in-memory mutation. No signature change -- version increment is internal. |
| Race condition in actual concurrent writes | Low | Low | T26 simulates the race. Real atomicity is limited by `fs.writeFileSync` (single-threaded Node.js). |

---

## Implementation Notes for Phase 06

### state-write-validator.test.cjs

The new tests (T16-T31) will be appended after the existing T15 test. They follow the existing pattern:
- Use the in-file `setupTestEnv()`, `writeStateFile()`, `runHook()`, `makeWriteStdin()` helpers
- For `check()` function tests (dispatcher mode), require the hook directly and call `check(ctx)` with a constructed context
- For version comparison tests, the Write tool_input must include `content` with the stringified state (this is how the PreToolUse hook will receive the incoming content)

### common.test.cjs

This is a new file. It will follow the hook-test-utils.cjs pattern:
- Use `setupTestEnv()` from hook-test-utils.cjs for environment setup
- Require `writeState` and `readState` from the prepared hook's `lib/common.cjs`
- Test `writeState()` as a pure function call (no subprocess spawning needed)
- Cleanup via `cleanupTestEnv()` in `afterEach`

### Key Design Decision: PreToolUse vs PostToolUse

The trace analysis notes that `state-write-validator` is currently PostToolUse (fires after the write). For the version check to BLOCK stale writes, it should be moved to PreToolUse. The test design accounts for both:
- `check()` function tests work regardless of hook timing (they test the decision logic)
- Standalone spawn tests test the actual hook execution (will need updated stdin format if moved to PreToolUse)

The tests are designed to validate the VERSION CHECK LOGIC independent of whether the hook runs pre or post write. The `check(ctx)` function receives `tool_input.content` (the content about to be written) which is available in both PreToolUse and PostToolUse contexts.
