# Test Strategy: BUG-0008 -- Hook Delegation Guard

**Version**: 1.0.0
**Created**: 2026-02-12
**Workflow**: Fix (BUG-0008-constitution-validator-false-positive)
**Phase**: 05-test-strategy

---

## Existing Infrastructure

- **Framework**: Node.js built-in `node:test` + `node:assert/strict`
- **Test Runner**: `node --test src/claude/hooks/tests/*.test.cjs`
- **Coverage Tool**: None (CJS hook tests rely on structural assertion, not code coverage instrumentation)
- **Current Test Counts**: 555 total (302 ESM + 253 CJS)
- **Existing Patterns**: Each hook test file uses `hook-test-utils.cjs` (`setupTestEnv`, `cleanupTestEnv`, `prepareHook`/`installHook`, `runHook`, `writeState`, `readState`)
- **Module System**: CommonJS (`.cjs` extension, hooks run as child processes via `runHook()`)
- **Naming Convention**: `test-{hook-name}.test.cjs` (e.g., `test-constitution-validator.test.cjs`)

### Existing Test Files for Affected Hooks

| Hook | Test File | Existing Test Count |
|------|-----------|-------------------|
| constitution-validator | `src/claude/hooks/tests/test-constitution-validator.test.cjs` | 19 tests |
| iteration-corridor | `src/claude/hooks/tests/test-iteration-corridor.test.cjs` | 24 tests |
| gate-blocker | `src/claude/hooks/tests/test-gate-blocker-extended.test.cjs` | 26 tests |

### Test Utilities

- **`hook-test-utils.cjs`**: Provides `setupTestEnv()` (returns `testDir` string), `cleanupTestEnv()`, `getTestDir()`, `writeState()`, `readState()`, `writeConfig()`, `writeIterationRequirements()`, `prepareHook()`, `runHook()`
- **Pattern**: Each test sets up an isolated temp directory with `.isdlc/state.json`, copies the hook + `lib/common.cjs`, then runs the hook as a child process with JSON input piped to stdin
- **Output Protocol**: Empty stdout = allow; JSON `{ continue: false, stopReason: ... }` = block

---

## Strategy Overview

### Approach: Extend Existing Test Suites (NOT Replace)

This is a **TDD bug fix**. The test strategy focuses on:

1. **Write failing tests first** (RED) -- tests that demonstrate the false positive behavior with delegation prompts
2. **Add new test sections** to each of the 3 existing test files
3. **Preserve all existing tests** as regression guards (AC-12, AC-13, AC-14)
4. **Follow established patterns** (naming, helpers, file organization)

### Why NOT New Test Files

The existing test files already have the setup infrastructure (hook copying, state management, helper functions). Adding a new `describe()` block to each file is cleaner and more maintainable than creating separate files.

---

## Test Types Required

### 1. Unit Tests (Primary -- 17 new tests)

New tests added to the three existing hook test files.

**constitution-validator.cjs** (5 new tests):
- Delegation detection bypass for known phase agent subagent_type (AC-01)
- Delegation detection bypass for agent name in prompt (AC-02)
- Delegation detection bypass for phase pattern in prompt (AC-03)
- Genuine completion still detected correctly after guard (AC-04)
- Setup command bypass still works after guard (AC-05)

**iteration-corridor.cjs** (6 new tests):
- Delegation detection bypass in TEST_CORRIDOR (AC-06, primary)
- Delegation detection bypass in CONST_CORRIDOR (AC-06, secondary)
- `/gate/i` no longer matches delegation prompt containing "GATE-NN" (AC-06, specific)
- Genuine advance keywords still blocked in TEST_CORRIDOR (AC-07)
- Genuine advance keywords still blocked in CONST_CORRIDOR (AC-08)
- Delegation with description field also bypasses (AC-06, edge case)

**gate-blocker.cjs** (6 new tests):
- Delegation detection bypass for orchestrator call with "gate" keyword (AC-09, primary)
- Delegation detection bypass for non-orchestrator subagent_type (AC-09, secondary)
- Genuine gate advancement by orchestrator still detected (AC-10)
- Orchestrator subagent_type check still works (AC-11)
- Delegation with phase pattern in prompt bypasses (AC-09, edge case)
- Delegation with agent name in prompt bypasses (AC-09, edge case)

### 2. Regression Tests (Critical -- existing 69 tests)

All existing tests in the three test files MUST continue to pass. These are NOT new tests -- they are the existing 19 + 24 + 26 = 69 tests.

AC-12: All 19 existing constitution-validator tests pass
AC-13: All 24 existing iteration-corridor tests pass
AC-14: All 26 existing gate-blocker tests pass

### 3. Integration Tests (2 new tests)

Validate the fix at the dispatcher level to ensure delegation prompts flow through all hooks without being blocked.

**pre-task-dispatcher integration** (added to `test-pre-task-dispatcher.test.cjs` if exists, or deferred to Phase 16):
- Delegation prompt with "GATE" keyword passes through entire dispatcher pipeline
- Delegation prompt with phase agent subagent_type passes through entire dispatcher pipeline

### 4. Constraint Validation (Not Test Code)

These are verified by code inspection during Phase 08 (code review), not by test code:
- AC-15: `detectPhaseDelegation()` in common.cjs is NOT modified
- AC-16: pre-task-dispatcher execution order is NOT modified
- AC-17: phase-loop-controller and phase-sequence-guard are NOT modified

---

## Test Data Strategy

### Delegation Prompt Fixtures

Derived from the actual delegation prompt template in isdlc.md STEP 3d:

```
"Execute Phase {NN} - {Phase Name} for {workflow_type} workflow.
 Artifact folder: {artifact_folder}
 Phase key: {phase_key}
 Validate GATE-{NN} on completion."
```

**Concrete delegation prompts to use as test input:**

| ID | Prompt | Subagent Type | Why It Triggers False Positive |
|----|--------|---------------|-------------------------------|
| D1 | `"Execute Phase 02 - Tracing for fix workflow. Artifact folder: BUG-0008. Phase key: 02-tracing. Validate GATE-02 on completion."` | `trace-analyst` | Contains "GATE" (matches `/gate/i`), "02-tracing" (phase pattern) |
| D2 | `"Execute Phase 06 - Implementation for feature workflow. Validate GATE-06 on completion."` | `software-developer` | Contains "GATE", "implementation" |
| D3 | `"Execute Phase 05 - Test Strategy for fix workflow. Phase key: 05-test-strategy. Validate GATE-05 on completion."` | `test-design-engineer` | Contains "GATE", "05-test-strategy" |
| D4 | `"Execute Phase 01 - Requirements for feature workflow. Phase key: 01-requirements."` | `requirements-analyst` | Contains "01-requirements" (phase pattern) |
| D5 | `"Execute Phase 08 - Code Review. Validate GATE-08 on completion."` | `code-reviewer` | Contains "GATE" |

### Genuine Completion/Advance Prompt Fixtures

These prompts should still be blocked. They are NOT delegations.

| ID | Prompt | Subagent Type | Why It Should Block |
|----|--------|---------------|-------------------|
| C1 | `"The phase complete. Ready to move on."` | (none) | Genuine completion declaration |
| C2 | `"advance to next phase"` | (none) | Genuine advance attempt |
| C3 | `"run gate check for phase 06"` | `sdlc-orchestrator` | Genuine orchestrator gate request |
| C4 | `"proceed to the testing phase"` | `sdlc-orchestrator` | Genuine orchestrator advance |
| C5 | `"gate validation passed, submit for review"` | (none) | Genuine completion keywords |

### Edge Case Fixtures

| ID | Prompt | Subagent Type | Expected Behavior |
|----|--------|---------------|-------------------|
| E1 | `"Execute Phase 06 - Implementation. Validate GATE-06."` | (empty/missing) | Delegation detected via phase pattern -- allow |
| E2 | `"fix the failing test in auth module"` | (none) | No delegation, no completion -- allow (passthrough) |
| E3 | `"discover and advance the project setup"` | (none) | Setup keyword "discover" -- allow (bypass) |

---

## TDD Execution Plan

### Phase 1: Write Failing Tests (RED)

Add new `describe('BUG-0008: Delegation guard')` blocks to each test file with tests that assert delegation prompts are ALLOWED (empty stdout). Before the fix, these tests will FAIL because the hooks will block the delegation prompts.

**Test execution command:**
```bash
# Run individual hook tests
node --test src/claude/hooks/tests/test-constitution-validator.test.cjs
node --test src/claude/hooks/tests/test-iteration-corridor.test.cjs
node --test src/claude/hooks/tests/test-gate-blocker-extended.test.cjs

# Run all CJS hook tests
npm run test:hooks
```

### Phase 2: Implement Fix (GREEN)

Add `detectPhaseDelegation()` guard to each detection function. The new tests should pass. All existing tests must also pass.

### Phase 3: Verify No Regression

```bash
# Full test suite
npm run test:all
```

All 69 existing hook tests + 17 new tests = 86 tests should pass.

---

## Coverage Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Requirement coverage | 100% | Every AC (AC-01 through AC-17) mapped to at least one test |
| New test count | 17 minimum | 5 + 6 + 6 new unit tests across 3 files |
| Regression test pass rate | 100% | All 69 existing tests must still pass |
| Critical path coverage | 100% | All 3 detection functions exercised with delegation + non-delegation inputs |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `detectPhaseDelegation()` returns unexpected result | Low | Medium | Tests use real delegation prompt templates; fail-open behavior ensures no new blocks |
| Test data does not match real delegation prompts | Low | High | Test fixtures use the exact prompt template from isdlc.md STEP 3d |
| Changes to common.cjs break the guard | None (CON-001) | N/A | Constraint: common.cjs is NOT modified |
| New tests interfere with existing test setup | Low | Low | Each test does full `cleanupTestEnv()` + `setupTestEnv()` in beforeEach |

---

## Test Commands (Existing Infrastructure)

| Test Type | Command |
|-----------|---------|
| Unit (CJS hooks) | `npm run test:hooks` |
| Unit (ESM lib) | `npm test` |
| All tests | `npm run test:all` |
| Single hook test | `node --test src/claude/hooks/tests/test-{hook}.test.cjs` |

---

## Files to Modify (Test Code Only)

| File | Change | New Tests |
|------|--------|-----------|
| `src/claude/hooks/tests/test-constitution-validator.test.cjs` | Add `describe('BUG-0008: Delegation guard')` block | 5 |
| `src/claude/hooks/tests/test-iteration-corridor.test.cjs` | Add `describe('BUG-0008: Delegation guard')` block | 6 |
| `src/claude/hooks/tests/test-gate-blocker-extended.test.cjs` | Add `describe('BUG-0008: Delegation guard')` block | 6 |

## Files NOT to Modify

| File | Reason |
|------|--------|
| `src/claude/hooks/tests/hook-test-utils.cjs` | No changes needed; existing utilities sufficient |
| `src/claude/hooks/lib/common.cjs` | CON-001: detectPhaseDelegation() works correctly |
| `src/claude/hooks/dispatchers/pre-task-dispatcher.cjs` | CON-002: Dispatcher order is correct |
