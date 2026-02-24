# Test Strategy: BUG-0005 - Redundant State Tracking Fix

**Bug ID:** BUG-0005-state-tracking-stale
**Phase:** 05-test-strategy
**Created:** 2026-02-12
**Requirements:** 6 FRs, 18 ACs

---

## 1. Existing Infrastructure (from test evaluation)

- **Framework**: Node.js built-in `node:test` + `node:assert/strict` (Node 18+)
- **Hook Tests**: CJS format (`*.test.cjs`) in `src/claude/hooks/tests/`
- **Shared Utilities**: `src/claude/hooks/tests/hook-test-utils.cjs` providing `setupTestEnv`, `cleanupTestEnv`, `prepareHook`, `runHook`, `readState`, `writeState`, `getTestDir`
- **Test Execution**: `node --test src/claude/hooks/tests/<file>.test.cjs`
- **Current Baseline**: 555 tests (302 ESM lib + 253 CJS hook)
- **Regression Threshold**: Total test count MUST NOT decrease (Article II)

### Existing Test Files for Affected Hooks

| Hook | Existing Test File | Existing Test Count |
|------|--------------------|---------------------|
| constitution-validator | `test-constitution-validator.test.cjs` | ~19 tests |
| delegation-gate | `test-delegation-gate.test.cjs` | ~13 tests |
| log-skill-usage | `test-log-skill-usage.test.cjs` | ~13 tests |
| skill-validator | `test-skill-validator.test.cjs` | ~13 tests |
| gate-blocker | `test-gate-blocker-extended.test.cjs` | ~26 tests |
| provider-utils | `test-provider-utils.test.cjs` | ~63 tests |

### Conventions to Follow

- File naming: `test-<hook-name>.test.cjs` (match existing)
- Structure: `describe()` blocks with `beforeEach(setupTestEnv)` / `afterEach(cleanupTestEnv)`
- Hook prep: use `prepareHook(HOOK_SRC)` to copy hook + lib dependencies to temp dir
- State: use `writeState()` / `readState()` for state manipulation within tests
- Assertions: `assert.equal`, `assert.ok`, `assert.deepStrictEqual` from `node:assert/strict`
- Test isolation: each test gets a fresh temp directory via `setupTestEnv(stateOverrides)`
- `setupTestEnv()` returns `testDir` string directly (not `{ testDir }`)
- `runHook()` is async (returns Promise); `prepareHook()` needs full absolute path

---

## 2. Strategy for This Bug Fix

### Approach

**Extend existing test suites** for the 6 affected hooks. Do NOT create new standalone test files for hooks that already have tests. Add new `describe()` blocks within the existing test files to cover the read-priority fix.

Additionally, create one new integration test file (`test-state-sync-integration.test.cjs`) that validates cross-cutting concerns: state field consistency after simulated phase transitions, and tasks.md update logic.

### Test Types Required

| Test Type | Scope | Location |
|-----------|-------|----------|
| **Unit Tests** | Hook read-priority fix (6 hooks) | Extend existing `test-*.test.cjs` files |
| **Unit Tests** | Hook write-correctness (4 hooks) | Extend existing `test-*.test.cjs` files |
| **Integration Tests** | State sync on phase transition | New: `test-state-sync-integration.test.cjs` |
| **Integration Tests** | tasks.md update logic | New: `test-state-sync-integration.test.cjs` |
| **Regression Tests** | Backward compatibility (null active_workflow) | Extend existing `test-*.test.cjs` files |

### Coverage Targets

| Metric | Target |
|--------|--------|
| Requirement coverage | 100% (all 18 ACs traced to tests) |
| Branch coverage (affected lines) | 100% (both `active_workflow` present and absent paths) |
| Backward compat coverage | 100% (null/missing active_workflow for all 6 hooks) |
| New test count | >= 42 new test cases |
| Regression impact | 0 existing tests broken |

---

## 3. Test Plan by Requirement

### FR-01: STEP 3e must update `active_workflow.phase_status` (AC-01a, AC-01b, AC-01c)

**Type**: Integration test (simulated phase transition state validation)

These ACs validate that STEP 3e prompt changes correctly instruct the phase-loop controller to update `active_workflow.phase_status`. Since STEP 3e is prompt text in `isdlc.md` (not executable code), we test the expected state outcome:
- Write a state.json representing "before STEP 3e runs"
- Verify the expected post-transition state structure matches requirements
- Test with single-phase completion, multi-phase completion, and final-phase completion

### FR-02: STEP 3e must update top-level `active_agent` (AC-02a, AC-02b)

**Type**: Integration test (state field validation)

Verify that after a phase transition, the top-level `active_agent` field matches the agent for the new phase. Test the phase-to-agent mapping lookup.

### FR-03: Hooks must prefer `active_workflow.current_phase` (AC-03a through AC-03f)

**Type**: Unit tests per hook (6 hooks x 3-5 scenarios each)

For each of the 6 hooks:
1. **Primary path**: `active_workflow.current_phase` set, top-level `current_phase` set to a DIFFERENT value. Verify hook uses `active_workflow.current_phase`.
2. **Fallback path**: `active_workflow` missing/null. Verify hook falls back to top-level `current_phase`.
3. **Both missing**: Neither `active_workflow.current_phase` nor `current_phase` set. Verify fail-open behavior (allow or use default).
4. **Stale divergence**: `active_workflow.current_phase` = `"06-implementation"`, `current_phase` = `"05-test-strategy"` (stale). Verify hook resolves to `"06-implementation"`.

### FR-04: STEP 3e must mark completed tasks in tasks.md (AC-04a through AC-04d)

**Type**: Integration test (file I/O validation)

Write a sample `tasks.md` to the test directory, simulate a phase completion, then read back and verify:
- Tasks in the completed phase section changed from `[ ]` to `[X]`
- Progress Summary table updated with new counts/percentages
- Non-completed phase tasks remain `[ ]`
- If tasks.md does not exist, the logic does not error

### FR-05: Top-level fields remain for backward compatibility (AC-05a through AC-05d)

**Type**: Regression tests (embedded in hook tests)

Verify that:
- Hooks still work when `active_workflow` is null (standalone execution)
- Top-level `current_phase`, `phases{}`, and `active_agent` continue to be readable
- No hooks break from the read-priority change

### FR-06: Hooks that write to `state.phases` must continue working (AC-06a through AC-06d)

**Type**: Unit tests (extend existing tests for writing hooks)

For constitution-validator, test-watcher, menu-tracker, and gate-blocker:
- Set up state with `active_workflow.current_phase` pointing to a specific phase
- Trigger the hook's write path
- Verify it writes to `state.phases[correctPhase]` (using the active_workflow-resolved phase)

---

## 4. Critical Paths

1. **Hook read-priority inversion**: If any of the 6 hooks still reads top-level `current_phase` first after the fix, it will see stale data during active workflows. This is the primary bug being fixed.

2. **Backward compatibility**: If the fallback to top-level `current_phase` is broken, hooks will fail when invoked outside a workflow (standalone hook testing, direct CLI use). All hooks must fail-open per Article X.

3. **State consistency**: If STEP 3e does not update all 3 tracking locations, the redundancy bug persists. The integration test must validate that all fields are in sync after a transition.

4. **tasks.md resilience**: The tasks.md update logic must handle missing file, malformed content, and concurrent modifications gracefully.

---

## 5. Test Commands

All tests use the existing framework:

```bash
# Run all hook tests (includes the new/extended tests)
npm run test:hooks

# Run a specific test file
node --test src/claude/hooks/tests/test-constitution-validator.test.cjs
node --test src/claude/hooks/tests/test-delegation-gate.test.cjs
node --test src/claude/hooks/tests/test-log-skill-usage.test.cjs
node --test src/claude/hooks/tests/test-skill-validator.test.cjs
node --test src/claude/hooks/tests/test-gate-blocker-extended.test.cjs
node --test src/claude/hooks/tests/test-provider-utils.test.cjs
node --test src/claude/hooks/tests/test-state-sync-integration.test.cjs

# Run all tests (ESM + CJS)
npm run test:all
```

---

## 6. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Existing tests break from hook changes | Low | High | Run full suite before and after changes |
| False positive: test passes but hook still reads stale | Medium | High | Use divergent state (different values in active_workflow vs top-level) to detect wrong source |
| tasks.md test fragile to format changes | Medium | Low | Use regex patterns, not exact string matching |
| State fixture drift from real state.json schema | Low | Medium | Base fixtures on actual state.json structure from production |
