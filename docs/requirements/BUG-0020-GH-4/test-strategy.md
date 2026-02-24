# Test Strategy: BUG-0020-GH-4

**Title**: Artifact path mismatch between agents and gate-blocker
**Bug ID**: BUG-0020
**External**: [GitHub #4](https://github.com/vihangshah/isdlc/issues/4)
**Phase**: 05-test-strategy
**Generated**: 2026-02-16

---

## Existing Infrastructure (from test evaluation)

- **Framework**: Node.js built-in `node:test` + `node:assert/strict` (Node 18+)
- **Module System**: CJS (`.cjs` extension for hooks)
- **Existing Test File**: `src/claude/hooks/tests/test-gate-blocker-extended.test.cjs` (36+ test cases)
- **Shared Utilities**: `src/claude/hooks/tests/hook-test-utils.cjs` (setupTestEnv, cleanupTestEnv, writeState, readState, writeConfig, writeIterationRequirements, prepareHook, runHook, getTestDir)
- **Test Runner**: `node --test src/claude/hooks/tests/*.test.cjs`
- **Coverage Tool**: None (Node.js built-in test runner; coverage assessed by test count and requirement mapping)
- **Current Test Count Baseline**: 555+ (from constitution Article II)
- **Existing Patterns**: Each test uses `describe`/`it` blocks; `beforeEach` calls `setupTestEnv()` + `prepareHook()`; `afterEach` calls `cleanupTestEnv()`; gate-blocker tests use a `gateAdvanceInput()` helper and `writeTestRequirements()` factory pattern.

---

## Strategy for This Requirement

- **Approach**: Extend existing gate-blocker test suite AND create a new dedicated consistency test file
- **TDD Workflow**: Failing test MUST be written BEFORE implementation (per fix workflow and Article II)
- **Test Types Needed**:
  1. **Unit tests** -- Gate-blocker behavior with corrected artifact paths
  2. **Configuration consistency tests** -- Cross-file validation between artifact-paths.json and iteration-requirements.json
  3. **Integration tests** -- Gate-blocker end-to-end with artifact-paths.json as source of truth
  4. **Regression tests** -- All existing gate-blocker tests must continue to pass

---

## Test Types and Coverage Targets

### 1. Unit Tests (gate-blocker artifact validation)

**Scope**: Test `checkArtifactPresenceRequirement()` behavior when artifact-paths.json provides the path source of truth.

**Coverage target**: 100% of artifact validation paths for phases 01, 03, 04, 05, 08.

**Location**: New tests added to `src/claude/hooks/tests/test-gate-blocker-extended.test.cjs` under a new `describe('BUG-0020: Artifact path alignment')` section.

### 2. Configuration Consistency Tests (drift detection)

**Scope**: Static validation that artifact-paths.json and iteration-requirements.json agree on all paths. Also validates artifact-paths.json schema.

**Coverage target**: 100% of phases with artifact_validation in iteration-requirements.json.

**Location**: New file `src/claude/hooks/tests/artifact-path-consistency.test.cjs`.

### 3. Integration Tests (gate-blocker + artifact-paths.json)

**Scope**: End-to-end tests that run gate-blocker as a child process with artifact-paths.json present and verify the hook reads paths from the shared config file.

**Coverage target**: All 5 FR test scenarios.

**Location**: Added to `src/claude/hooks/tests/test-gate-blocker-extended.test.cjs` under `describe('BUG-0020: artifact-paths.json integration')`.

### 4. Regression Tests

**Scope**: All existing 36+ tests in `test-gate-blocker-extended.test.cjs` must pass without modification.

**Coverage target**: Zero test failures, zero test count decrease.

**Validation**: Run `node --test src/claude/hooks/tests/test-gate-blocker-extended.test.cjs` before and after fix.

---

## Security Testing

- **Not applicable** for this bug fix. No user input paths, no authentication, no network calls. The fix modifies config file paths and hook file-reading logic.

---

## Performance Testing

- **NFR-03 validation**: artifact-paths.json load time must be <5ms. This will be validated informally during test execution -- Node.js `require()` of a small JSON file is sub-millisecond. No formal performance test needed.

---

## Test Data Strategy

### Test Fixtures

All test data is constructed inline within test files using the existing helper pattern (`writeIterationRequirements()`, `writeState()`, `writeConfig()`). No external fixture files needed.

### Key Test Data Objects

1. **Valid artifact-paths.json** -- Contains correct paths for phases 01, 03, 04, 05, 08
2. **Mismatched artifact-paths.json** -- Has paths that differ from iteration-requirements.json (for failing test)
3. **Missing artifact-paths.json** -- File does not exist (fallback test)
4. **Malformed artifact-paths.json** -- Invalid JSON or missing required fields (robustness test)
5. **Phase state with artifacts on disk** -- Files created at correct paths in temp directory
6. **Phase state with artifacts at OLD paths** -- Files at the pre-fix paths (regression/mismatch detection)

### Template Variable Data

- `artifact_folder` values: `REQ-TEST`, `BUG-0020-GH-4`, `REQ-0020-t6-hook-io-optimization`
- Phase keys: `01-requirements`, `03-architecture`, `04-design`, `05-test-strategy`, `08-code-review`

---

## Critical Paths

1. **TDD Red Path**: A test that reproduces the exact bug -- agent writes to `docs/requirements/{af}/`, gate-blocker checks `docs/architecture/{af}/` -- and FAILS. This test must fail before the fix and pass after.

2. **Source-of-Truth Path**: artifact-paths.json is loaded by gate-blocker, and paths from artifact-paths.json override iteration-requirements.json inline paths.

3. **Fallback Path**: When artifact-paths.json is missing, gate-blocker falls back to iteration-requirements.json paths without crashing.

4. **Consistency Path**: artifact-path-consistency.test.cjs validates that the two config files agree, preventing future drift.

---

## Test Commands (use existing)

```bash
# Run gate-blocker tests
node --test src/claude/hooks/tests/test-gate-blocker-extended.test.cjs

# Run artifact-path-consistency tests
node --test src/claude/hooks/tests/artifact-path-consistency.test.cjs

# Run all CJS hook tests
npm run test:hooks

# Run all tests (ESM + CJS)
npm run test:all
```

---

## Test Execution Order

1. **Phase 05 (this phase)**: Design test cases (this document + test-cases/)
2. **Phase 06 (implementation)**:
   - Step 1: Write `artifact-path-consistency.test.cjs` -- MUST FAIL (no artifact-paths.json exists yet)
   - Step 2: Add mismatch-reproduction tests to `test-gate-blocker-extended.test.cjs` -- MUST FAIL
   - Step 3: Create `artifact-paths.json` with correct paths
   - Step 4: Update `iteration-requirements.json` paths to match
   - Step 5: Update `gate-blocker.cjs` to read from `artifact-paths.json`
   - Step 6: All new tests pass (RED -> GREEN)
   - Step 7: Run full test suite -- zero regressions
   - Step 8: Update agent OUTPUT STRUCTURE docs
   - Step 9: Run consistency test -- GREEN

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Existing tests break due to path changes | Do NOT change test-expected paths in existing tests; only add new tests. The fix changes config, not test assertions. |
| artifact-paths.json schema changes over time | Consistency test catches schema drift automatically. |
| Gate-blocker performance regression from extra file read | Node.js require() caching ensures negligible overhead. |
| Agent OUTPUT STRUCTURE docs diverge again | Consistency test and artifact-paths.json reference in agent docs prevent drift. |

---

## Traceability Summary

| Requirement | Test Category | Test Count |
|-------------|--------------|------------|
| FR-01 (artifact-paths.json) | Consistency + Unit | 5 |
| FR-02 (iteration-requirements.json alignment) | Consistency | 3 |
| FR-03 (gate-blocker reads artifact-paths.json) | Integration | 4 |
| FR-04 (agent docs reference) | Manual inspection | 1 |
| FR-05 (validation test) | Consistency | 4 |
| NFR-01 (backward compat) | Integration | 2 |
| NFR-02 (zero regression) | Regression | 1 |
| **Total** | | **20** |

See `test-cases/` for detailed Given/When/Then specifications.
See `traceability-matrix.csv` for complete requirement-to-test mapping.
