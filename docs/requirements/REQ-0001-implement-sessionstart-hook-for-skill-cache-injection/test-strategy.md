# Test Strategy: Unified SessionStart Cache (REQ-0001)

**Phase**: 05-test-strategy
**Feature**: Unified SessionStart cache -- eliminate ~200+ static file reads per workflow (GH #91)
**Requirement ID**: REQ-0001
**Created**: 2026-02-23
**Absorbed Issues**: #86 (manifest cleanup), #89 (external manifest source field)

---

## 1. Existing Infrastructure

| Aspect | Current State |
|--------|---------------|
| **Framework** | Node.js built-in `node:test` + `node:assert/strict` (Node 18+) |
| **CJS test stream** | `src/claude/hooks/tests/*.test.cjs` -- run with `npm run test:hooks` |
| **ESM test stream** | `lib/*.test.js` -- run with `npm test` |
| **CJS test utils** | `src/claude/hooks/tests/hook-test-utils.cjs` (setupTestEnv, cleanupTestEnv, runHook, prepareHook, writeState, readState, writeConfig) |
| **ESM test utils** | `lib/utils/test-helpers.js` (createTempDir, captureConsole, createProjectDir) |
| **Existing test count** | 555 across ESM + CJS streams |
| **Coverage tool** | None configured (manual test counting) |
| **Naming convention** | CJS: `test-{module-name}.test.cjs` or `{feature-name}.test.cjs` |
| **setupTestEnv()** | Returns `testDir` string directly (NOT `{ testDir }`) |
| **runHook()** | Async (Promise-based); `prepareHook()` needs full absolute path |

**Strategy**: Extend existing test suites and patterns. Do NOT introduce new frameworks or replace existing infrastructure.

---

## 2. Test Pyramid

### 2.1 Unit Tests (Priority: Highest)

Target the core builder logic, skill path index, and mtime collection -- all pure-function-like modules that can be tested with filesystem fixtures.

| Component | Test File (CJS) | Estimated Tests |
|-----------|-----------------|-----------------|
| `rebuildSessionCache()` | `test-session-cache-builder.test.cjs` | 28 |
| `_buildSkillPathIndex()` | `test-session-cache-builder.test.cjs` | 12 |
| `_collectSourceMtimes()` | `test-session-cache-builder.test.cjs` | 8 |
| `getAgentSkillIndex()` refactor | `test-session-cache-builder.test.cjs` | 10 |
| `inject-session-cache.cjs` hook | `test-inject-session-cache.test.cjs` | 8 |
| `bin/rebuild-cache.js` CLI | `test-rebuild-cache-cli.test.cjs` | 7 |
| **Unit total** | | **73** |

### 2.2 Integration Tests (Priority: High)

Validate cross-component interactions: cache build -> hook read -> consumer extraction.

| Scenario | Test File | Estimated Tests |
|----------|-----------|-----------------|
| Cache build + hook read round-trip | `test-session-cache-integration.test.cjs` | 5 |
| Cache build + section extraction | `test-session-cache-integration.test.cjs` | 4 |
| installer.js trigger integration | `test-session-cache-integration.test.cjs` | 3 |
| Manifest cleanup (FR-008) consumers | `test-session-cache-integration.test.cjs` | 3 |
| External manifest source field (FR-009) | `test-session-cache-integration.test.cjs` | 3 |
| **Integration total** | | **18** |

### 2.3 E2E Tests (Priority: Medium)

End-to-end scenarios that exercise the full cache lifecycle.

| Scenario | Test File | Estimated Tests |
|----------|-----------|-----------------|
| Full cache lifecycle (build -> read -> consume -> rebuild) | `test-session-cache-e2e.test.cjs` | 3 |
| Fail-open: workflow without cache | `test-session-cache-e2e.test.cjs` | 2 |
| CLI rebuild round-trip | `test-session-cache-e2e.test.cjs` | 2 |
| **E2E total** | | **7** |

### 2.4 Security Tests (Priority: Medium)

| Scenario | Test Location | Estimated Tests |
|----------|--------------|-----------------|
| Path traversal in skill paths | `test-session-cache-builder.test.cjs` | 2 |
| Cache file permissions | `test-inject-session-cache.test.cjs` | 1 |
| No secrets in cache output | `test-session-cache-builder.test.cjs` | 1 |
| **Security total** | | **4** |

### 2.5 Performance Tests (Priority: Medium)

| Scenario | Test Location | Estimated Tests |
|----------|--------------|-----------------|
| Hook execution < 5000ms (NFR-003) | `test-inject-session-cache.test.cjs` | 1 |
| Cache build < 10s (NFR-004) | `test-session-cache-builder.test.cjs` | 1 |
| Cache size within 128K budget (NFR-009) | `test-session-cache-builder.test.cjs` | 1 |
| **Performance total** | | **3** |

### Total Test Count: 105

---

## 3. Test File Organization

All new test files follow the existing CJS convention and reside in the same test directory.

```
src/claude/hooks/tests/
  test-session-cache-builder.test.cjs     # Unit: rebuildSessionCache, _buildSkillPathIndex, _collectSourceMtimes, getAgentSkillIndex refactor
  test-inject-session-cache.test.cjs      # Unit: SessionStart hook behavior
  test-rebuild-cache-cli.test.cjs         # Unit: bin/rebuild-cache.js CLI
  test-session-cache-integration.test.cjs # Integration: cross-component round-trips
  test-session-cache-e2e.test.cjs         # E2E: full lifecycle scenarios
```

**Run commands** (extend existing):
- Unit + Integration: `npm run test:hooks` (existing glob picks up new `*.test.cjs` files)
- All: `npm run test:all`

---

## 4. Flaky Test Mitigation

| Risk | Mitigation |
|------|-----------|
| **Filesystem timing (mtime)** | Use `fs.utimesSync()` to set deterministic mtimes in test fixtures rather than relying on real timestamps. Wait 10ms between writes when mtime ordering matters. |
| **Module cache pollution** | Clear `require.cache` before each test suite (existing pattern in `requireCommon()`). Call `_resetCaches()` in `beforeEach`. |
| **Temp directory cleanup** | Use `after()` hooks to call `cleanupTestEnv()`. Use unique temp prefixes (`isdlc-cache-test-`). |
| **Process environment leaks** | Save and restore `process.env.CLAUDE_PROJECT_DIR` in `before`/`after` blocks. |
| **Child process hangs** | Use existing `HOOK_TIMEOUT_MS` (10s) from `hook-test-utils.cjs`. Add explicit `child.kill()` in timeout handler. |
| **Parallel test isolation** | Each test creates its own temp directory via `setupTestEnv()`. No shared mutable state between tests. |
| **File descriptor exhaustion** | Use synchronous I/O (`readFileSync`, `writeFileSync`) in tests to avoid unclosed fd accumulation. |

---

## 5. Coverage Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Requirement coverage | 100% of FR-001 through FR-009 acceptance criteria | Traceability matrix |
| Statement coverage (new code) | >= 90% for `rebuildSessionCache()` and helpers | Manual test case analysis |
| Branch coverage (new code) | >= 85% for all error paths | Explicit negative test cases |
| Error path coverage | 100% of error taxonomy codes CACHE-001 through INDEX-003 | Error taxonomy traceability |
| NFR coverage | 100% of testable NFRs (NFR-001 through NFR-010) | NFR test mapping |

---

## 6. Performance Test Plan

### 6.1 Hook Execution Time (NFR-003)

**Test**: Invoke `inject-session-cache.cjs` via `child_process.spawn`, measure wall-clock time from spawn to exit.

**Setup**: Create a cache file of ~128K characters in a temp directory. Run the hook 3 times. All runs must complete within 5000ms.

**Threshold**: `execution_time_ms < 5000` (hard fail). Expected: <200ms.

### 6.2 Cache Build Time (NFR-004)

**Test**: Call `rebuildSessionCache({ projectRoot: testDir })` with a realistic fixture set (constitution, workflows.json, skills-manifest.json, 10 mock SKILL.md files, 3 persona files, 6 topic files). Measure `Date.now()` before and after.

**Threshold**: `build_time_ms < 10000` (hard fail). Expected: <2000ms for fixture set.

### 6.3 Cache Size Budget (NFR-009)

**Test**: Build a cache with the full real project files (if available) or a realistic fixture set. Assert `result.size <= 128000`.

**Threshold**: `size_chars <= 128000` (warning on breach, per spec). Test asserts the builder emits a warning when exceeded.

---

## 7. Fail-Open Test Matrix

Fail-open behavior is the primary reliability requirement (NFR-005). Every fail-open path gets explicit negative test coverage.

| Failure Scenario | Expected Behavior | Test ID |
|-----------------|-------------------|---------|
| Cache file missing | Hook: no output, exit 0 | TC-HOOK-02 |
| Cache file unreadable (permissions) | Hook: no output, exit 0 | TC-HOOK-03 |
| Cache file empty | Hook: empty output, exit 0 | TC-HOOK-04 |
| `CLAUDE_PROJECT_DIR` not set | Hook: falls back to cwd, still exits 0 | TC-HOOK-05 |
| `.isdlc/` directory missing | `rebuildSessionCache()` throws | TC-BUILD-05 |
| Constitution file missing | Section skipped, cache still valid | TC-BUILD-06 |
| Workflows.json missing | Section skipped, cache still valid | TC-BUILD-07 |
| Skills manifest invalid JSON | SKILLS_MANIFEST + SKILL_INDEX skipped | TC-BUILD-08 |
| External manifest missing | EXTERNAL_SKILLS section skipped | TC-BUILD-09 |
| All source files missing | Cache produced with all sections skipped | TC-BUILD-10 |
| Persona files missing | ROUNDTABLE_CONTEXT produced without personas | TC-BUILD-11 |
| Topic files missing | ROUNDTABLE_CONTEXT produced without topics | TC-BUILD-12 |
| Skills directory missing | `_buildSkillPathIndex()` returns empty Map | TC-INDEX-03 |
| SKILL.md without skill_id | File skipped, other skills still indexed | TC-INDEX-04 |

---

## 8. Test Data Strategy Summary

See `test-data-plan.md` for full details. Key approach:

1. **Fixture-based**: Create minimal but realistic file structures in temp directories using `setupTestEnv()`.
2. **Boundary testing**: Test cache at 0 chars, 1 char, 127999 chars, 128000 chars, 128001 chars.
3. **Invalid inputs**: Corrupt JSON, binary content, permission-denied files, symlink loops.
4. **Maximum-size inputs**: 128K character cache files for hook read performance testing.

---

## 9. Test Execution Order

Tests are designed with no inter-test dependencies. Recommended execution order for CI:

1. **Unit tests** (fast, catch regressions early):
   - `test-session-cache-builder.test.cjs` -- core builder logic
   - `test-inject-session-cache.test.cjs` -- hook behavior
   - `test-rebuild-cache-cli.test.cjs` -- CLI behavior
2. **Integration tests** (medium, cross-component):
   - `test-session-cache-integration.test.cjs`
3. **E2E tests** (slowest, full lifecycle):
   - `test-session-cache-e2e.test.cjs`

---

## 10. Traceability Summary

| FR | Acceptance Criteria Count | Test Cases | Coverage |
|----|--------------------------|------------|----------|
| FR-001 | 5 (AC-001-01 to AC-001-05) | TC-BUILD-01 to TC-BUILD-15 | 100% |
| FR-002 | 5 (AC-002-01 to AC-002-05) | TC-HOOK-01 to TC-HOOK-08 | 100% |
| FR-003 | 3 (AC-003-01 to AC-003-03) | TC-REG-01 to TC-REG-03 | 100% |
| FR-004 | 3 (AC-004-01 to AC-004-03) | TC-CLI-01 to TC-CLI-07 | 100% |
| FR-005 | 6 (AC-005-01 to AC-005-06) | TC-CONS-01 to TC-CONS-07 | 100% |
| FR-006 | 4 (AC-006-01 to AC-006-04) | TC-RT-01 to TC-RT-04 | 100% |
| FR-007 | 6 (AC-007-01 to AC-007-06) | TC-TRIG-01 to TC-TRIG-06 | 100% |
| FR-008 | 3 (AC-008-01 to AC-008-03) | TC-MAN-01 to TC-MAN-03 | 100% |
| FR-009 | 4 (AC-009-01 to AC-009-04) | TC-SRC-01 to TC-SRC-04 | 100% |
| **Total** | **39** | **105** | **100%** |

---

## 11. Risk and Contingency

| Risk | Likelihood | Impact | Contingency |
|------|-----------|--------|-------------|
| Module cache not clearing properly | Medium | Tests pass individually but fail when run together | Use separate `describe()` blocks with dedicated `before`/`after` setup |
| Real project files too large for test fixtures | Low | Tests run too slowly | Use minimal synthetic fixtures that match schema shapes |
| Mtime resolution insufficient on some OS | Low | Hash comparison flaky | Use `Date.now()` offset of 100ms between file writes |
| `_buildSkillPathIndex()` directory scan slow on CI | Medium | Performance test fails | Set generous threshold (10s) and skip perf test on slow CI runners |
