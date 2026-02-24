# Test Strategy: REQ-0037 Project Skills Distillation

**Status**: Approved
**Last Updated**: 2026-02-24
**Requirement**: REQ-0037 (GitHub #88)
**Testable Scope**: FR-007 only (Section 9 removal from `rebuildSessionCache()`)
**Non-Testable Scope**: FR-001 through FR-006, FR-008 (LLM orchestrator markdown -- not programmatically testable)

---

## Existing Infrastructure

- **Framework**: Node.js built-in `node:test` + `node:assert/strict`
- **CJS Test Stream**: `src/claude/hooks/tests/*.test.cjs`
- **Run Command**: `npm run test:hooks` or `node --test src/claude/hooks/tests/test-session-cache-builder.test.cjs`
- **Existing Test File**: `src/claude/hooks/tests/test-session-cache-builder.test.cjs` (44 tests)
- **Coverage Tool**: None configured (Node.js built-in coverage via `--experimental-coverage` not used)
- **Current Baseline**: 555+ total tests across ESM and CJS streams

## Testable Scope Analysis

### FR-007: Remove Section 9 from rebuildSessionCache() -- TESTABLE

This is the only programmatically testable requirement. The change removes ~18 lines from `rebuildSessionCache()` in `common.cjs` that injected raw discovery reports (Section 9: DISCOVERY_CONTEXT) into the session cache.

**What to test:**
1. DISCOVERY_CONTEXT section delimiter is absent from cache output
2. Raw discovery report content is not injected into the cache
3. All other sections (1-8) continue to function unchanged
4. Section 7 (EXTERNAL_SKILLS) remains the sole delivery mechanism for discovery knowledge
5. Existing 44 tests continue to pass without modification

### FR-001 through FR-006, FR-008 -- NOT TESTABLE

These requirements modify `discover-orchestrator.md` (LLM instruction markdown). They describe:
- Distillation step logic (FR-001)
- Skill file output format (FR-002)
- Idempotent-by-source behavior (FR-003)
- Manifest registration (FR-004)
- Cache rebuild trigger (FR-005)
- Fail-open semantics (FR-006)
- LLM summarization instructions (FR-008)

These are declarative LLM instructions executed by Claude at runtime, not programmatic code. They cannot be unit tested. Verification occurs through:
- Manual inspection of orchestrator markdown during code review (Phase 08)
- Integration-level validation during actual `/discover` runs
- Constitution compliance checks (Article I)

---

## Test Pyramid

### Unit Tests (Primary Focus)

| Category | Count | Target |
|----------|-------|--------|
| Section 9 removal verification | 4 | New tests in existing file |
| Regression (existing tests) | 44 | Must all continue to pass |
| **Total** | **48** | |

All 4 new tests are added to the existing `test-session-cache-builder.test.cjs` file, following established naming conventions (TC-BUILD-NN prefix) and test patterns.

### Integration Tests

No new integration tests required. The integration between project skills and the session cache is already covered by the EXTERNAL_SKILLS section tests (TC-SRC-01, TC-SRC-03, TC-BUILD-15).

### E2E Tests

Not applicable. Full end-to-end validation of the distillation workflow requires running `/discover` with actual source artifacts -- this is a manual acceptance test during Phase 08 code review.

### Security Tests

No new security tests required. The existing TC-SEC-02 test already verifies the cache does not contain sensitive data. Removing Section 9 reduces the surface area (fewer files read into cache).

### Performance Tests

Not applicable for this change. Removing Section 9 reduces cache build time (fewer file reads) and reduces cache size (~22,700 characters eliminated). No performance regression is possible.

---

## Flaky Test Mitigation

All tests in `test-session-cache-builder.test.cjs` use isolated temporary directories (`os.tmpdir()`) with deterministic setup and cleanup. The test pattern:

1. `createTestProject()` or `createFullTestProject()` creates a fresh temp directory
2. Each test writes its own files to the temp directory
3. `cleanup(dir)` removes the temp directory in a `finally` block

This pattern eliminates filesystem state leakage between tests. The new tests follow the same pattern. No flaky test concerns are identified.

---

## Performance Test Plan

No performance benchmarks are needed for this change. The removal of Section 9 strictly improves performance:
- Eliminates 3 `fs.readFileSync()` calls for discovery report files
- Reduces cache file size by ~22,700 characters
- Reduces `buildSection()` calls by 1

---

## Test Strategy: What Changes and What Does Not

### Tests That Need Updating: NONE

Review of all 44 existing tests confirms that no test directly asserts the presence of DISCOVERY_CONTEXT. The section delimiters tested in TC-BUILD-02 are: CONSTITUTION, WORKFLOW_CONFIG, ITERATION_REQUIREMENTS, ARTIFACT_PATHS, SKILLS_MANIFEST, SKILL_INDEX, ROUNDTABLE_CONTEXT. Section 9 (DISCOVERY_CONTEXT) is not in this list.

The `createFullTestProject()` helper does not create discovery report files (`project-discovery-report.md`, `test-evaluation-report.md`, `reverse-engineer-report.md`), so Section 9 was always producing empty/skipped content in tests anyway.

### New Tests Required: 4

Four new test cases are added to explicitly verify that Section 9 is removed and that the removal does not affect the surrounding cache functionality.

---

## Coverage Targets

| Metric | Target | Notes |
|--------|--------|-------|
| AC coverage | 100% of FR-007 ACs | AC-007-01 through AC-007-04 |
| Test pass rate | 100% | All 48 tests (44 existing + 4 new) |
| Regression | 0 failures | Existing 44 tests unchanged |
| Total test baseline | >= 555 | Must not decrease (Constitution Article II) |

---

## Test Commands

```bash
# Run session cache builder tests only
node --test src/claude/hooks/tests/test-session-cache-builder.test.cjs

# Run all hook tests
npm run test:hooks

# Run full test suite (both ESM and CJS streams)
npm run test:all
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Existing test breakage from Section 9 removal | Very Low | Medium | No test references DISCOVERY_CONTEXT; createFullTestProject() never created discovery files |
| Missing coverage for non-testable requirements | N/A | Low | Documented as manual review items for Phase 08 |
| New tests fail due to environment differences | Very Low | Low | Tests use isolated temp dirs; no external dependencies |
