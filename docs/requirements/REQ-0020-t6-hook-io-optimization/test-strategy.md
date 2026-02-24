# Test Strategy: T6 Hook I/O Optimization

**REQ-0020** | Phase 05 - Test Strategy | 2026-02-16

---

## 1. Existing Infrastructure

This strategy extends the existing test infrastructure. No new frameworks or tools are introduced.

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in, Node 18+) |
| **Assertions** | `node:assert/strict` |
| **Module system** | CommonJS (`.cjs` extension) |
| **Test directory** | `src/claude/hooks/tests/` |
| **Shared utilities** | `src/claude/hooks/tests/hook-test-utils.cjs` |
| **Run command** | `npm run test:hooks` |
| **Current test count** | 1300+ CJS hook tests |
| **Coverage tool** | Manual assertion (no Istanbul/c8 configured for CJS hooks) |

### Existing Test Conventions

- File naming: `test-{module}.test.cjs` or `{module}.test.cjs`
- `setupTestEnv(stateOverrides)` returns `testDir` string (not `{ testDir }`)
- `runHook()` is async (Promise-based, child_process spawn)
- `prepareHook(absolutePath)` copies hook + lib/ to temp dir
- `prepareDispatcher(filename)` copies dispatcher + all hooks + config
- `state-write-validator.test.cjs` uses its own `spawnSync`-based helpers (not shared hook-test-utils)
- `require.cache` clearing for fresh module loads: `delete require.cache[require.resolve(path)]`
- Environment isolation via `process.env.CLAUDE_PROJECT_DIR`
- No mocking frameworks -- manual stubs and test helpers only

### Existing Tests for Target Modules

| Module | Existing Test File | Test Count | What is Covered |
|--------|-------------------|------------|-----------------|
| `common.cjs` | `test-common.test.cjs`, `common.test.cjs` | ~61+ | getProjectRoot, loadManifest, getAgentPhase, getSkillOwner, readState, writeState, phase detection |
| `state-write-validator.cjs` | `state-write-validator.test.cjs` | ~20+ | V1-V3 content validation, V7 version lock, V8 phase protection, fail-open |
| `gate-blocker.cjs` | `test-gate-blocker-extended.test.cjs` | ~26+ | Gate advancement, delegation check, constitutional check, test iteration check |
| All 5 dispatchers | `test-pre-task-dispatcher.test.cjs` etc. | ~75+ | Hook orchestration, stateModified handling, batch writes |

---

## 2. Strategy for This Requirement

### Approach

**Extend existing test suites** -- do NOT replace or reorganize. New tests follow existing patterns and are added either to existing test files (when extending existing functions) or to a new test file (for newly introduced behaviors like config caching).

### New Test Types Needed

| Test Type | Purpose | AC Coverage |
|-----------|---------|-------------|
| **Unit tests** | Verify caching logic, parameter passing, single-read consolidation | All 19 ACs |
| **Integration tests** | Verify end-to-end dispatcher invocations with cached configs | AC-001a, AC-002a, AC-004a, AC-005a |
| **Regression tests** | Verify existing behavior preserved (backward compat) | NFR-002 |
| **Performance verification** | Verify I/O reduction measurable via fs.readFileSync call counting | NFR-001 |
| **Error/edge case tests** | Verify fail-open on missing files, cache miss on mtime change | AC-001d, AC-001e, AC-003d |

### Coverage Targets

Per constitution Article II:
- **Unit test coverage**: >=80% of modified lines
- **Critical path coverage**: 100% (caching correctness, fail-open behavior, backward compat)
- **Regression threshold**: Total test count must NOT decrease (baseline: 1300+)
- **Target new tests**: 46 new test cases across all 20 ACs + 4 NFRs

### Test Commands (existing)

```bash
# Run all CJS hook tests
npm run test:hooks

# Run specific test file
node --test src/claude/hooks/tests/test-common.test.cjs

# Run all tests (ESM + CJS)
npm run test:all
```

---

## 3. Test Architecture

### 3.1 New Test File

**File**: `src/claude/hooks/tests/test-io-optimization.test.cjs`

This is the primary new test file. It contains all tests for the new caching behavior (FR-001, FR-002) and cache-related validation rules. It follows the same pattern as `test-common.test.cjs`:

1. Uses `hook-test-utils.cjs` for env setup
2. Copies `common.cjs` to temp dir and requires it fresh
3. Clears `require.cache` between describe blocks to reset module state
4. Tests cache internals via `_resetCaches()` / `_getCacheStats()` (test-only exports, enabled by `NODE_ENV=test`)

### 3.2 Extended Test Files

| File | New Tests For |
|------|--------------|
| `state-write-validator.test.cjs` | FR-003: diskState parameter, single-read consolidation, V7/V8 sharing |
| `test-gate-blocker-extended.test.cjs` | FR-004: manifest passthrough to checkAgentDelegationRequirement |
| `test-pre-task-dispatcher.test.cjs` | FR-005: batch write verification (assert writeState called <= 1 time) |

### 3.3 Test Isolation Strategy

Each test block:
1. Calls `setupTestEnv()` or creates its own temp dir (state-write-validator pattern)
2. Sets `CLAUDE_PROJECT_DIR` to temp dir
3. For common.cjs cache tests: sets `NODE_ENV=test` to enable `_resetCaches()`
4. Calls `_resetCaches()` in `beforeEach` to ensure no cross-test cache leakage
5. Cleans up via `cleanupTestEnv()` or `fs.rmSync()` in `afterEach`

---

## 4. Test Types

### 4.1 Unit Tests

Test individual functions in isolation with controlled inputs.

| Target Function | Test Count | ACs |
|-----------------|-----------|-----|
| `_loadConfigWithCache()` | 11 | AC-001a, AC-001b, AC-001c, AC-001d, AC-001e |
| `getProjectRoot()` (cached) | 6 | AC-002a, AC-002b, AC-002c |
| `loadManifest()` (cached) | 3 | AC-001a (via loadManifest) |
| `loadIterationRequirements()` (cached) | 3 | AC-001a (via loadIterationRequirements) |
| `loadWorkflowDefinitions()` (cached) | 3 | AC-001a (via loadWorkflowDefinitions) |
| `checkVersionLock()` (diskState param) | 6 | AC-003a, AC-003b, AC-003d |
| `checkPhaseFieldProtection()` (diskState param) | 4 | AC-003b, AC-003d |
| `check()` (single disk read) | 5 | AC-003a, AC-003c |
| `checkAgentDelegationRequirement()` (manifest param) | 4 | AC-004a, AC-004b, AC-004c |

### 4.2 Integration Tests

Test full hook invocations via child process spawning.

| Test Scenario | Test Count | ACs |
|---------------|-----------|-----|
| Dispatcher loads configs once (cache hit on subsequent loadManifest calls) | 2 | AC-001a, AC-002a |
| State-write-validator full flow (Write event, single disk read for V7+V8) | 3 | AC-003a, AC-003b |
| Gate-blocker inside dispatcher uses ctx.manifest | 2 | AC-004a, AC-004c |
| Dispatcher writes state at most once | 3 | AC-005a, AC-005d |

### 4.3 Regression Tests

Verify existing behavior is preserved after optimization.

| Test Scenario | Test Count | NFR |
|---------------|-----------|-----|
| loadManifest() returns same data as before caching | 1 | NFR-002 |
| getProjectRoot() returns same path as before caching | 1 | NFR-002 |
| state-write-validator V7 blocks on version mismatch (same as before) | 1 | NFR-003 |
| state-write-validator V8 blocks on phase regression (same as before) | 1 | NFR-003 |
| checkAgentDelegationRequirement without manifest param (standalone mode) | 1 | NFR-002 |
| Existing test suites pass without modification | 0 (covered by running `npm run test:hooks`) | NFR-002 |

### 4.4 Performance Verification Tests

Verify the optimization achieves measurable improvement.

| Test Scenario | Test Count | NFR |
|---------------|-----------|-----|
| Config cache: second call to loadManifest returns without disk read (cache stats verify) | 1 | NFR-001 |
| getProjectRoot: second call returns without fs.existsSync (cache stats verify) | 1 | NFR-001 |
| state-write-validator: Write event reads disk at most once (count via debug output) | 1 | NFR-001 |

### 4.5 Security Tests

| Test Scenario | Test Count | Article |
|---------------|-----------|---------|
| Cache does not leak data across different CLAUDE_PROJECT_DIR values (monorepo) | 1 | Article III |
| diskState null handling does not expose file contents in error messages | 1 | Article III |

---

## 5. Critical Paths (100% Coverage Required)

Per constitution Article II, critical paths require 100% coverage:

1. **Config cache mtime invalidation** -- If broken, stale configs served (AC-001b)
2. **Config cache miss on first load** -- If broken, null returned for valid configs (AC-001a)
3. **Config cache error handling** -- If broken, crash on missing file instead of fail-open (AC-001d)
4. **Monorepo cache isolation** -- If broken, project A gets project B's config (AC-001e)
5. **getProjectRoot cache consistency** -- If broken, different roots returned in same process (AC-002c)
6. **diskState null fail-open** -- If broken, V7/V8 crash on missing state file (AC-003d)
7. **diskState sharing between V7 and V8** -- If broken, correctness regression (AC-003b)
8. **Manifest passthrough fallback** -- If broken, standalone mode crashes (AC-004b)
9. **Batch write no-op** -- If broken, writeState called when no state changed (AC-005d)

---

## 6. Test Data Strategy

See `test-data-plan.md` for detailed fixtures.

### Summary

| Data Category | Examples |
|---------------|---------|
| Config files | `skills-manifest.json`, `iteration-requirements.json`, `workflows.json` (real copies + modified variants) |
| State files | Minimal state.json with `state_version`, `active_workflow`, `phases` |
| Error scenarios | Missing files, corrupt JSON, empty files, permission errors (where applicable) |
| Boundary values | `state_version: 0`, `state_version: 999999`, empty `phases: {}` |
| Monorepo scenarios | Two temp dirs with different configs, same process |

---

## 7. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Cache cross-test leakage | Medium | High | `_resetCaches()` in beforeEach; fresh require() per describe block |
| `require.cache` not cleared properly | Medium | Medium | Explicit `delete require.cache[...]` before each fresh require |
| Module-level variable persists across tests | Medium | High | Tests reset `_cachedProjectRoot` and `_configCache` via test-only exports |
| state-write-validator uses spawnSync (separate process) | Low | Low | Cache is per-process, so spawnSync tests naturally get fresh state |
| Dispatcher tests are slow (child process per test) | Low | Medium | Keep dispatcher integration tests minimal; bulk of tests are unit-level |

---

## 8. Test Execution Plan

### Phase 06 (Implementation) Test Order

Following the implementation order from module-design.md (FR-002 -> FR-001 -> FR-003 -> FR-004 -> FR-005):

1. **FR-002 first**: Write getProjectRoot() cache tests, implement, go green
2. **FR-001 next**: Write config cache tests, implement, go green
3. **FR-003 next**: Write state-write-validator consolidation tests, implement, go green
4. **FR-004 next**: Write gate-blocker passthrough tests, implement, go green
5. **FR-005 last**: Write batch write verification tests, verify existing behavior, go green
6. **Regression suite**: Run `npm run test:hooks` to verify all 1300+ existing tests pass

### GATE-05 Exit Criteria

- All new test cases pass
- All 1300+ existing CJS tests pass (`npm run test:hooks`)
- All ESM tests pass (`npm test`)
- Zero regressions
- Coverage of all 19 ACs verified via traceability matrix
