# Test Strategy: BUG-0011 -- V8 Phase Field Protection

**Bug**: BUG-0011 -- Subagent Phase State Overwrite
**Phase**: 05-test-strategy
**Created**: 2026-02-13
**Author**: Test Design Engineer (Phase 05)

---

## Existing Infrastructure (from test evaluation)

- **Framework**: Node.js built-in `node:test` + `node:assert/strict`
- **Module System**: CommonJS (`.cjs` extension, `spawnSync`-based hook process testing)
- **Test File**: `src/claude/hooks/tests/state-write-validator.test.cjs` (31 existing tests: T1-T15 for V1-V3, T16-T31 for V7)
- **Test Utilities**: Custom per-file (`setupTestEnv`, `writeStateFile`, `runHook`, `makeWriteStdin`, `makeEditStdin`, `makeWriteStdinWithContent`)
- **Coverage Tool**: None (no Istanbul/c8 configured for CJS hooks)
- **Current Test Count**: 31 tests in state-write-validator.test.cjs; 555+ total project tests
- **CI**: `npm run test:hooks` runs all CJS tests; `npm run test:all` runs both ESM and CJS

---

## Strategy for This Requirement

- **Approach**: Extend existing test suite -- add V8 tests to `state-write-validator.test.cjs`
- **Pattern**: Follow the exact `describe`/`it` pattern from the BUG-0009 (V7) test block
- **Helper Reuse**: Reuse `makeWriteStdinWithContent()` helper (already used for V7 tests)
- **Coverage Target**: 100% AC coverage (all 20 ACs), plus regression and performance tests
- **New Test Count**: 36 new tests (T32-T67), bringing the file total from 31 to 67 tests

---

## Test Types

### 1. Unit Tests (Primary)

All V8 tests are unit tests exercising `checkPhaseFieldProtection()` through the hook's standalone process interface (same pattern as V7 tests).

**Method**: `spawnSync('node', [HOOK_PATH], { input: stdinJson, cwd: tmpDir })`

Each test:
1. Creates a temp directory with `.isdlc/state.json` (disk state)
2. Constructs a `Write` stdin payload with `tool_input.content` (incoming state)
3. Runs the hook as a child process
4. Asserts stdout for block/allow and stderr for logging

### 2. Regression Tests

Existing T1-T31 tests (V1-V3 and V7) MUST continue passing without modification. The V8 addition must not affect:
- V1-V3 content validation warnings (observational)
- V7 version lock blocking
- Fail-open behavior for malformed input
- Non-state.json file handling

### 3. Integration Tests

One integration test verifying V8 runs in correct order within `check()`:
- V7 blocks first (if applicable) -- V8 does not run
- V8 blocks second (if applicable) -- V1-V3 do not run
- Both V7 and V8 pass -- V1-V3 content validation runs

### 4. Performance Tests

One performance test verifying V8 overhead:
- Run the hook 10 times, measure average execution time
- Assert average < 100ms (total hook budget, not just V8)
- V8 alone should add < 10ms (two JSON parses + field comparison)

---

## Test Commands (use existing)

```bash
# Unit tests (V8 tests added to existing file)
npm run test:hooks

# Single file (development)
node --test src/claude/hooks/tests/state-write-validator.test.cjs

# Full suite (regression)
npm run test:all
```

---

## Test Organization

All V8 tests are added to the existing file `src/claude/hooks/tests/state-write-validator.test.cjs` as a new `describe` block:

```
describe('BUG-0011: Phase Field Protection (V8)')
  describe('FR-01: Block phase index regression')
    T32-T37 (AC-01a through AC-01f)
  describe('FR-02: Block phase_status regression')
    T38-T44 (AC-02a through AC-02g)
  describe('FR-03: Fail-open on errors')
    T45-T49 (AC-03a through AC-03e)
  describe('FR-04: Write events only')
    T50-T51 (AC-04a, AC-04b)
  describe('FR-05: Execution order')
    T52-T54 (AC-05a through AC-05c)
  describe('Boundary and edge cases')
    T58-T63 (boundary conditions, edge cases, monorepo)
  describe('Regression: V1-V7 unaffected')
    T64-T65 (existing V7 + V1-V3 combo tests)
  describe('Performance')
    T66-T67 (latency and overhead)
```

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| V8 interferes with V7 blocking | T52 verifies V7 short-circuits before V8 |
| V8 blocks legitimate Phase-Loop Controller writes | AC-01b, AC-02d, AC-02e, AC-02f test allow cases |
| V8 fails on missing fields | AC-03a-e test all fail-open paths |
| Performance regression | T64-T65 assert <100ms budget |
| Edit events incorrectly processed | AC-04a verifies Edit events skip V8 |

---

## Success Criteria

1. All 36 new tests pass
2. All 31 existing tests continue passing (zero regressions)
3. 100% AC coverage verified by traceability matrix (23/23 ACs mapped)
4. Performance within budget (<100ms total hook, <10ms V8 overhead)
5. GATE-04 passes all checklist items
