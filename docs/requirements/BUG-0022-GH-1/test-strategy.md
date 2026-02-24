# Test Strategy: BUG-0022-GH-1

**Bug ID:** BUG-0022-GH-1
**Title:** Build Integrity Check Missing from test-generate Workflow
**Phase:** 05-test-strategy
**Date:** 2026-02-17
**Status:** Approved

---

## 1. Existing Infrastructure

- **Framework:** Node.js built-in `node:test` + `node:assert/strict` (Node 18+)
- **Coverage Tool:** None (no istanbul/c8 configured)
- **Current Coverage:** ~555 tests (302 ESM lib tests + 253 CJS hook tests)
- **Test Streams:**
  - ESM: `lib/*.test.js` -- run via `npm test`
  - CJS: `src/claude/hooks/tests/*.test.cjs` -- run via `npm run test:hooks`
  - All: `npm run test:all`
- **Test Conventions:**
  - CJS hook tests use `setupTestEnv()`, `cleanupTestEnv()`, `runHook()`, `prepareHook()` from `hook-test-utils.cjs`
  - Tests read config files (workflows.json, skills-manifest.json, iteration-requirements.json) directly via `fs.readFileSync`
  - Tests use `describe`/`it` blocks with descriptive names
  - Existing quality-loop tests at `src/claude/hooks/tests/test-quality-loop.test.cjs` serve as the reference pattern

---

## 2. Strategy for This Fix

### Approach

**Extend existing test suite** -- do not replace or restructure. This fix modifies 5 files (2 config files, 3 agent/skill markdown files). The testing approach focuses on:

1. **Configuration integrity tests** (CJS) -- Verify workflows.json and isdlc.md reflect the updated phase sequence
2. **Agent behavioral contract tests** (CJS) -- Verify the quality-loop-engineer agent includes build integrity checks, auto-fix loop, and honest failure reporting
3. **Gate enforcement tests** (CJS) -- Verify GATE-08 in qa-engineer includes build integrity as a safety net
4. **Skill definition tests** (CJS) -- Verify SKILL.md for QL-007 includes language-aware detection and auto-fix

### New Test Types Needed

All tests for this fix are **structural verification tests** -- they validate that the markdown and JSON configuration files contain the required content. This is the appropriate test type for agent/skill/config changes in the iSDLC framework.

### Coverage Target

- 100% requirement coverage (all 4 FRs, all 7 ACs mapped to tests)
- Total test count must not decrease below 555 baseline (Article II)
- New tests add 39 test cases

---

## 3. Test Pyramid

### Unit Tests (Structural Verification)

The primary test layer. Each test reads a source file and asserts that required content is present. This matches the existing pattern in `test-quality-loop.test.cjs` (sections 4-6).

| Target File | Test Count | What Is Verified |
|-------------|-----------|------------------|
| `workflows.json` | 8 | test-generate phases updated, no legacy phases, 16-quality-loop present |
| `isdlc.md` | 5 | Phase list updated, documentation matches workflows.json |
| `16-quality-loop-engineer.md` | 15 | Build integrity check, language-aware detection table, auto-fix loop (max 3), error classification, honest failure reporting, graceful degradation |
| `SKILL.md` (QL-007) | 4 | Language-aware build detection, mechanical vs logical classification, auto-fix description |
| `07-qa-engineer.md` | 4 | GATE-08 build integrity prerequisite, safety net behavior |
| Cross-file consistency | 3 | Regression checks for feature/fix workflows, no false negatives |

**Total unit tests: 39** (including 3 regression/cross-file consistency checks)

### Integration Tests

Not applicable for this fix. The files being modified are agent prompts and configuration -- they do not execute as code. Integration testing occurs at Phase 16 (quality-loop) runtime when agents actually process these instructions.

### E2E Tests

Not applicable for this fix. End-to-end validation would require running a full `/isdlc test generate` workflow against a sample project, which is outside the scope of the unit test framework.

### Security Tests

Not applicable. This fix does not introduce new data handling, authentication, or authorization logic.

### Performance Tests

Not applicable. This fix does not introduce performance-sensitive code paths. NFR-01 (build check performance) is validated by the build command itself, not by framework tests.

---

## 4. Test Pyramid Rationale

The test pyramid for this fix is intentionally bottom-heavy (all structural unit tests). This is because:

1. **The changed files are configuration and agent prompts** -- they are consumed by the AI agent at runtime, not executed as code
2. **Structural verification is the correct test type** -- asserting that required content (phase lists, build commands table, auto-fix loop spec) is present in the files
3. **The existing pattern** (`test-quality-loop.test.cjs`) demonstrates this approach for similar agent/config changes
4. **Integration and E2E tests would require full agent execution** -- which is tested during Phase 16 of the active workflow, not in the unit test suite

---

## 5. Flaky Test Mitigation

### Risk Assessment

**Low flakiness risk.** All tests in this strategy are deterministic file reads and string/structure assertions. No network calls, no timing dependencies, no external service dependencies.

### Mitigation Measures

1. **Read files synchronously** -- Use `fs.readFileSync` (not async) to avoid race conditions
2. **Use `before()` for file loading** -- Load file content once per `describe` block, not per test
3. **Assert specific strings, not regex** -- Reduces false positives from pattern matching ambiguity
4. **No temp directories needed** -- Tests read source files in-place (matching existing test-quality-loop.test.cjs pattern for sections 4-6)

---

## 6. Performance Test Plan

No performance tests are required for this fix. The changes are to configuration files and agent behavioral contracts. Performance characteristics of the build check itself (NFR-01) are inherent to the build tool (mvn, npm, cargo, etc.) and cannot be meaningfully unit-tested.

**NFR-01 validation approach:** During Phase 16 execution, the quality-loop-engineer agent runs the build command. Build command detection (scanning for pom.xml, package.json, etc.) is a filesystem check that completes in milliseconds. The build command execution time depends on the target project, not on the framework.

---

## 7. Test File Location

Following existing conventions:

```
src/claude/hooks/tests/
  test-build-integrity.test.cjs    <-- NEW: All tests for BUG-0022-GH-1
```

Single test file because all tests are structurally similar (read file, assert content) and relate to the same bug fix. This matches the pattern of `test-quality-loop.test.cjs` which groups related workflow tests in one file.

---

## 8. Test Commands (existing infrastructure)

| Stream | Command | Includes New Tests? |
|--------|---------|-------------------|
| CJS hooks | `npm run test:hooks` | Yes |
| ESM lib | `npm test` | No |
| All | `npm run test:all` | Yes |

---

## 9. Critical Paths

The following test scenarios are critical and must all pass for the fix to be considered valid:

1. **test-generate workflow no longer contains legacy phases** (11-local-testing, 07-testing)
2. **test-generate workflow includes 16-quality-loop** (bringing in build verification QL-007)
3. **Quality-loop-engineer agent has build integrity check with language-aware detection**
4. **Quality-loop-engineer agent has auto-fix loop bounded at 3 iterations**
5. **Quality-loop-engineer agent has honest failure reporting (no QA APPROVED on broken build)**
6. **QA-engineer agent has build integrity as GATE-08 safety net**
7. **QL-007 skill definition includes language-aware build detection and auto-fix**

---

## 10. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Tests pass but agent ignores instructions at runtime | Medium | High | Addressed by gate enforcement (FR-04) and hook-level validation in GATE-16 |
| Build command detection misses a language | Low | Medium | Lookup table design (NFR-02) allows easy extension; tests verify table presence |
| Auto-fix loop runs indefinitely | Low | High | Tests verify max 3 iterations is documented; runtime enforcement by agent |
| workflows.json and isdlc.md drift out of sync | Medium | Medium | Tests verify both files contain consistent phase lists |

---

## 11. Traceability Summary

| Requirement | Acceptance Criteria | Test Section |
|-------------|-------------------|--------------|
| FR-01 | AC-01, AC-02, AC-06 | Sections 1 (workflows.json), 2 (isdlc.md), 3 (quality-loop-engineer build check), 4 (SKILL.md) |
| FR-02 | AC-03, AC-07 | Sections 3 (auto-fix loop), 4 (SKILL.md auto-fix) |
| FR-03 | AC-04 | Section 3 (honest failure reporting) |
| FR-04 | AC-05 | Sections 3 (GATE-16 build prerequisite), 5 (GATE-08 safety net) |
| NFR-01 | (runtime) | Not unit-testable; validated during Phase 16 execution |
| NFR-02 | (design) | Section 3 (lookup table verification), 4 (SKILL.md extensible design) |
| NFR-03 | AC-06 | Section 3 (graceful degradation), 4 (SKILL.md skip with warning) |
