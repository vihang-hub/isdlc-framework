# Test Strategy: REQ-0013 Supervised Mode

**Phase**: 05-test-strategy
**Version**: 1.0.0
**Created**: 2026-02-14
**Feature**: Supervised mode -- configurable per-phase review gates with parallel change summaries
**Requirements Coverage**: 8 FRs, 6 NFRs, 35 ACs

---

## 1. Existing Infrastructure (Extend, Do Not Replace)

### 1.1 Test Framework

| Component | Value |
|-----------|-------|
| **Framework** | Node.js built-in `node:test` + `node:assert/strict` (Node 20+) |
| **Module System** | CJS stream for hooks (`*.test.cjs`), ESM stream for lib (`*.test.js`) |
| **Test Helpers** | `src/claude/hooks/tests/hook-test-utils.cjs` |
| **Coverage Tool** | c8 / istanbul |
| **Current Test Count** | ~1700+ (CJS + ESM combined) |

### 1.2 Test Conventions (from existing test suite)

- CJS test files: `src/claude/hooks/tests/test-{module-name}.test.cjs`
- ESM test files: `lib/{module-name}.test.js`
- Use `'use strict';` at top of CJS files
- Import pattern: `const { describe, it, beforeEach, afterEach } = require('node:test');`
- Assert pattern: `const assert = require('node:assert/strict');`
- Test isolation: `setupTestEnv()` returns `testDir` string directly (not `{ testDir }`)
- Cleanup: `cleanupTestEnv()` in `afterEach` blocks
- Hook testing: `prepareHook(absolutePath)` + `runHook(hookPath, inputObject)` (async Promise)
- State manipulation: `writeState(obj)` / `readState()` in test env

### 1.3 Test Commands (use existing)

| Stream | Command |
|--------|---------|
| CJS hooks | `node --test src/claude/hooks/tests/test-supervised-mode.test.cjs` |
| All CJS | `npm run test:hooks` |
| All ESM | `npm test` |
| Full suite | `npm run test:all` |

### 1.4 Files Under Test

| File | Type | Test Stream | Test Type |
|------|------|-------------|-----------|
| `src/claude/hooks/lib/common.cjs` (4 new functions) | CJS | CJS | Unit |
| `src/claude/hooks/gate-blocker.cjs` (supervised awareness) | CJS | CJS | Integration |
| `src/claude/commands/isdlc.md` (STEP 3e-review) | Markdown | Manual | Integration/Manual |
| `.isdlc/config/workflows.json` (supervised option) | JSON | CJS | Schema validation |
| `src/claude/agents/00-sdlc-orchestrator.md` | Markdown | Manual | Manual |

---

## 2. Test Strategy Overview

### 2.1 Approach

This feature adds 4 new functions to `common.cjs` and minor integration changes to `gate-blocker.cjs`. The bulk of the testable logic is in the common.cjs functions. The phase-loop controller changes (isdlc.md) are markdown-based agent instructions and are verified via manual/integration testing during Phase 16.

**Strategy**: Focus automated unit tests on the 4 common.cjs functions (where all deterministic logic lives). Extend the existing gate-blocker test file for supervised mode awareness. Verify isdlc.md behavior through the quality loop's full workflow test.

### 2.2 Test Types

| Test Type | Scope | Count | Automation |
|-----------|-------|-------|------------|
| **Unit** | 4 common.cjs functions | 68 | Fully automated (CJS) |
| **Integration** | Gate-blocker supervised awareness | 8 | Fully automated (CJS) |
| **Schema Validation** | workflows.json, state.json schemas | 6 | Fully automated (CJS) |
| **Manual/Integration** | STEP 3e-review flow, orchestrator | 8 | Manual verification |
| **Regression** | Backward compatibility | 5 | Automated (existing suite) |
| **Total** | | **95** | **82 automated, 13 manual** |

### 2.3 Coverage Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Unit test coverage (new functions) | >= 95% | Line + branch coverage via c8 |
| AC coverage | 100% (35/35) | Traceability matrix |
| NFR coverage | 100% (6/6) | Traceability matrix |
| Error code coverage | 100% (24/24) | At least 1 test per ERR-SM code |
| Regression | 0 failures in existing suite | `npm run test:all` |

---

## 3. Test Architecture

### 3.1 New Test File

**File**: `src/claude/hooks/tests/test-supervised-mode.test.cjs`

This single test file covers all 4 common.cjs functions and schema validation. It follows the established pattern from `test-gate-blocker-extended.test.cjs`.

```
test-supervised-mode.test.cjs
  describe('readSupervisedModeConfig')        -- 20 tests
  describe('shouldReviewPhase')               -- 16 tests
  describe('generatePhaseSummary')            -- 22 tests
  describe('recordReviewAction')              -- 16 tests
```

### 3.2 Gate-Blocker Extension

**File**: `src/claude/hooks/tests/test-gate-blocker-extended.test.cjs` (EXTEND existing)

Add a new `describe('Gate-Blocker: Supervised Mode Awareness')` block with 8 tests.

### 3.3 Test Isolation

Each test uses `setupTestEnv()` / `cleanupTestEnv()` from `hook-test-utils.cjs` to create an isolated temporary directory with state.json. The common.cjs functions are imported directly (they are synchronous pure/quasi-pure functions). The `generatePhaseSummary` function requires filesystem access and is tested with the temp directory.

### 3.4 Direct Function Testing

Since the 4 new functions are exported from `common.cjs`, they can be tested directly without subprocess spawning:

```javascript
const common = require('../lib/common.cjs');
const result = common.readSupervisedModeConfig(state);
assert.equal(result.enabled, false);
```

This is faster and more precise than running hooks as child processes. The gate-blocker integration tests still use `prepareHook()` + `runHook()` for subprocess testing.

---

## 4. Test Categories by Function

### 4.1 readSupervisedModeConfig (20 tests)

Tests the config reader's fail-open behavior across all input variants.

| Category | Count | Description |
|----------|-------|-------------|
| Valid configs | 4 | Fully valid enabled/disabled configs |
| Missing/null state | 3 | null, undefined, non-object state |
| Missing block | 2 | No supervised_mode key, empty object |
| Invalid enabled | 3 | String, number, null enabled values |
| Invalid review_phases | 4 | Wrong type, mixed valid/invalid entries, all invalid |
| Invalid parallel_summary | 2 | String, number values |
| auto_advance_timeout | 2 | Non-null values, verify always null |

### 4.2 shouldReviewPhase (16 tests)

Tests the phase-review decision logic as a pure function.

| Category | Count | Description |
|----------|-------|-------------|
| Disabled config | 3 | enabled=false, null config, missing config |
| review_phases="all" | 3 | Various phase keys with "all" |
| review_phases=array | 5 | Matching phases, non-matching phases, edge cases |
| Invalid inputs | 3 | Invalid phaseKey, empty string, non-string |
| Boundary cases | 2 | Two-digit prefix extraction, 16-quality-loop key |

### 4.3 generatePhaseSummary (22 tests)

Tests summary markdown generation and file writing.

| Category | Count | Description |
|----------|-------|-------------|
| Full summary | 4 | Standard output with all sections |
| Minimal summary | 3 | Minimal mode (no diffs, no decisions) |
| Edge cases | 5 | Empty artifacts, no phase data, missing timestamps |
| Directory creation | 2 | Auto-create reviews dir, nested path |
| Overwrite behavior | 2 | Overwrite existing summary on redo |
| Git diff handling | 3 | Diff available, unavailable, empty diff |
| Error handling | 3 | Write failure, catch-all, null return |

### 4.4 recordReviewAction (16 tests)

Tests review history recording and state mutation.

| Category | Count | Description |
|----------|-------|-------------|
| Continue action | 3 | Basic entry, timestamp handling, field shape |
| Review action | 3 | Paused/resumed fields, entry shape |
| Redo action | 3 | Redo count, guidance, entry shape |
| Array initialization | 2 | Missing review_history, non-array review_history |
| Guard clauses | 3 | Null state, missing active_workflow, return value |
| Append behavior | 2 | Multiple entries, order preservation |

---

## 5. Error Taxonomy Test Coverage

Every error code from the error taxonomy must be exercised by at least one test case.

| Error Code | Test ID | Test Description |
|------------|---------|------------------|
| ERR-SM-100 | T01 | Missing supervised_mode block returns defaults |
| ERR-SM-101 | T03 | supervised_mode is array/string/null returns defaults |
| ERR-SM-102 | T09 | enabled is string/number treated as false |
| ERR-SM-103 | T12 | review_phases is number/object treated as "all" |
| ERR-SM-104 | T14 | review_phases array with invalid entries filtered |
| ERR-SM-105 | T17 | parallel_summary non-boolean treated as true |
| ERR-SM-106 | T19 | auto_advance_timeout always null |
| ERR-SM-200 | T41 | Missing phase data generates N/A placeholders |
| ERR-SM-201 | T49 | Git diff failure produces "unavailable" text |
| ERR-SM-202 | T51 | Reviews dir creation failure returns null |
| ERR-SM-203 | T52 | Summary write failure returns null |
| ERR-SM-204 | T53 | Unexpected exception caught, returns null |
| ERR-SM-205 | T43 | Invalid timestamps produce "N/A" duration |
| ERR-SM-300 | T-manual-01 | Null summary path skips review gate |
| ERR-SM-301 | T-manual-02 | Summary file deleted shows fallback message |
| ERR-SM-302 | T-manual-03 | State write failure during gate continues |
| ERR-SM-303 | T-manual-04 | Invalid menu selection re-prompts |
| ERR-SM-304 | T-manual-05 | Stale supervised_review overwritten |
| ERR-SM-400 | T-manual-06 | Redo count >= 3 removes [D] option |
| ERR-SM-401 | T-manual-07 | Corrupt redo count treated as >= 3 |
| ERR-SM-402 | T-manual-08 | Re-delegation failure re-presents menu |
| ERR-SM-403 | T-manual-09 | Empty guidance accepted |
| ERR-SM-404 | T-manual-10 | Non-array redo_guidance_history re-initialized |
| ERR-SM-500 | T-manual-11 | Invalid phase in supervised_review cleared |
| ERR-SM-501 | T-manual-12 | Unexpected status value cleared |
| ERR-SM-502 | T-manual-13 | Missing summary on recovery shows fallback |
| ERR-SM-600 | T83 | Gate-blocker reads corrupt config, unaffected |
| ERR-SM-601 | T84 | Gate-blocker info log during active review |
| ERR-SM-700 | T67 | Non-array review_history re-initialized |
| ERR-SM-701 | T70 | recordReviewAction without active_workflow returns false |
| ERR-SM-702 | T-manual-14 | review_history preserved during finalize |

---

## 6. Non-Functional Requirement Testing

### 6.1 NFR-013-01: Backward Compatibility

- Run full test suite (`npm run test:all`) with NO `supervised_mode` config
- Verify 0 regressions
- Verify existing gate-blocker tests pass unchanged

### 6.2 NFR-013-02: Fail-Open on Configuration Errors

- 7 unit tests for `readSupervisedModeConfig` covering all invalid input variants
- Verify every error path returns `{ enabled: false }` or safe defaults
- No exceptions thrown from any function

### 6.3 NFR-013-03: Summary Generation Performance

- Timing measurement in `generatePhaseSummary` tests
- Verify completion under 10s for up to 50 file changes
- Git diff timeout at 5s

### 6.4 NFR-013-04: State Integrity During Review Pause

- Verify `supervised_review` is written correctly to state.json
- Test recovery: corrupt/stale `supervised_review` is handled gracefully
- Manual test: kill session during review, verify state on restart

### 6.5 NFR-013-05: Redo Circuit Breaker

- Unit test: redo_count increments correctly
- Unit test: redo_count >= 3 detected by shouldReviewPhase caller
- Manual test: menu presents only [C] and [R] after 3 redos
- Corrupt redo_count (NaN, negative, > 3) treated as >= 3

### 6.6 NFR-013-06: No New Dependencies

- Verify `package.json` unchanged
- Verify no new files in `agents/` or `skills/` directories
- Verified during Phase 16 (quality loop)

---

## 7. Integration Testing Plan

### 7.1 Gate-Blocker + Supervised Mode (8 automated tests)

These tests extend `test-gate-blocker-extended.test.cjs` and verify the gate-blocker remains unaffected by supervised mode configuration.

| Test | Description | AC |
|------|-------------|-----|
| T76 | Gate allows advancement when supervised_mode.enabled=true and requirements met | AC-06a |
| T77 | Gate blocks when requirements fail regardless of supervised_mode | AC-06b |
| T78 | Gate allows with corrupt supervised_mode config (fail-open) | AC-06c |
| T79 | Gate allows with supervised_mode missing entirely | AC-06b |
| T80 | Info log appears when supervised_review.status="reviewing" | AC-06a |
| T81 | Gate functions normally with supervised_review present | AC-06a |
| T82 | Gate functions normally with review_history populated | AC-06b |
| T83 | Gate functions normally with corrupt supervised_mode (array) | AC-06c |

### 7.2 STEP 3e-review Flow (Manual Integration)

These are verified during a supervised workflow run in Phase 16.

| Test | Description | AC |
|------|-------------|-----|
| T-manual-01 | Review gate fires after enabled phase | AC-03a, AC-07a |
| T-manual-02 | [C] Continue advances to next phase | AC-03b |
| T-manual-03 | [R] Review pauses and shows instructions | AC-03c, AC-04a |
| T-manual-04 | Resume after review advances correctly | AC-04c |
| T-manual-05 | [D] Redo prompts for guidance | AC-03d, AC-05a |
| T-manual-06 | Redo re-runs phase with guidance | AC-05b, AC-05c |
| T-manual-07 | Circuit breaker removes [D] after 3 redos | AC-05d |
| T-manual-08 | Non-reviewed phase auto-advances | AC-03e, AC-07c |

---

## 8. Test Data Strategy

### 8.1 State.json Fixtures

All test fixtures are constructed inline using `setupTestEnv({ ... })` overrides. Key fixture categories:

1. **Enabled full config**: `{ supervised_mode: { enabled: true, review_phases: "all", parallel_summary: true } }`
2. **Enabled selective**: `{ supervised_mode: { enabled: true, review_phases: ["03", "04", "06"] } }`
3. **Disabled config**: `{ supervised_mode: { enabled: false } }`
4. **Missing config**: `{}` (no supervised_mode block)
5. **Corrupt configs**: Various malformed values for fuzz testing
6. **With active workflow**: Include `active_workflow` with phase data for summary/review tests

### 8.2 Phase State Fixtures

For `generatePhaseSummary` tests, phase state objects are constructed:

```javascript
const phaseState = {
  '03-architecture': {
    status: 'completed',
    started: '2026-02-14T10:00:00Z',
    completed: '2026-02-14T10:30:00Z',
    artifacts: ['architecture-overview.md', 'adrs/'],
    summary: '4 ADRs, interceptor pattern, state-driven config'
  }
};
```

### 8.3 Boundary Values

- Empty arrays: `review_phases: []`
- Single-entry arrays: `review_phases: ["03"]`
- Max boundary: `redo_count: 3` (circuit breaker threshold)
- Invalid timestamps: `started: "not-a-date"`
- Long strings: guidance text > 1000 chars
- Unicode: phase names with special characters

---

## 9. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `generatePhaseSummary` relies on `git diff` which may not be available | Low | Low | Graceful degradation tested (ERR-SM-201) |
| File system operations may fail during summary write | Low | Medium | Fail-safe try/catch returns null, tested |
| State.json corruption during review pause | Low | Medium | Session recovery path tested (ERR-SM-5xx) |
| Redo circuit breaker bypassed by state manipulation | Low | Low | Counter validation tested, NaN/negative handled |
| Backward compatibility regression | Medium | High | Full existing suite run, 0 tolerance for regressions |

---

## 10. Test Execution Plan

### Phase 06 (Implementation)

1. Write all 74 unit tests in `test-supervised-mode.test.cjs` (TDD red baseline)
2. Implement 4 common.cjs functions
3. Run: `node --test src/claude/hooks/tests/test-supervised-mode.test.cjs`
4. Achieve 95%+ function coverage

### Phase 16 (Quality Loop)

1. Run `npm run test:all` -- verify 0 regressions
2. Extend gate-blocker tests (8 new tests)
3. Manual integration test of STEP 3e-review flow
4. Coverage analysis: all 35 ACs covered
5. Verify no new npm dependencies

---

## 11. Traceability Summary

| Requirement | Test Count | Coverage |
|-------------|-----------|----------|
| FR-01 (Config) | 20 | 8/8 ACs |
| FR-02 (Summary) | 22 | 5/5 ACs |
| FR-03 (Menu) | 7 (3 auto + 4 manual) | 7/7 ACs |
| FR-04 (Pause/Resume) | 5 (manual) | 5/5 ACs |
| FR-05 (Redo) | 6 (manual) | 6/6 ACs |
| FR-06 (Gate-Blocker) | 8 | 3/3 ACs |
| FR-07 (Phase-Loop) | 4 (manual) | 4/4 ACs |
| FR-08 (History) | 16 | 3/3 ACs |
| NFR-013-01 | 5 | Regression suite |
| NFR-013-02 | 7 | Fail-open validation |
| NFR-013-03 | 2 | Performance timing |
| NFR-013-04 | 3 (1 auto + 2 manual) | State integrity |
| NFR-013-05 | 4 (2 auto + 2 manual) | Circuit breaker |
| NFR-013-06 | 1 (manual) | No new deps |
| **Total** | **95** | **35/35 ACs + 6/6 NFRs** |
