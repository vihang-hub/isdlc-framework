# Test Strategy: BUG-0031 -- gate-blocker blocks /isdlc analyze and /isdlc add

**Status**: Complete
**Phase**: 05-test-strategy
**Last Updated**: 2026-02-22
**Coverage**: Unit tests for gate-blocker and iteration-corridor exempt action logic
**Source Requirements**: FR-001, FR-002, FR-003, FR-004
**Debate Rounds**: 0
**Fan-Out Chunks**: 0

---

## Existing Infrastructure

This project has established test infrastructure that this strategy extends rather than replaces.

- **Framework**: Node.js built-in `node:test` + `node:assert/strict` (Node 18+)
- **Hook Test Stream**: CJS tests in `src/claude/hooks/tests/*.test.cjs`
- **Test Utilities**: `src/claude/hooks/tests/hook-test-utils.cjs` (setupTestEnv, cleanupTestEnv, writeState, readState, prepareHook, runHook)
- **Existing Gate-Blocker Tests**: `test-gate-blocker-extended.test.cjs` -- 26 tests covering gate advancement detection, setup command bypass, requirement checks, fail-open behavior
- **Existing Iteration-Corridor Tests**: `test-iteration-corridor.test.cjs` -- 24 tests covering corridor state detection, advance blocking, setup bypass, escalation, pending_escalations
- **Run Command (hooks)**: `node --test src/claude/hooks/tests/test-gate-blocker-extended.test.cjs`
- **Run Command (all CJS)**: `npm run test:hooks`
- **Coverage Tool**: None (Node.js built-in test runner; coverage verified by test count and requirement traceability)
- **Baseline Test Count**: 555 total (302 ESM + 253 CJS) per Article II of the constitution

## Strategy Summary

This is a targeted bug fix strategy. The fix adds `EXEMPT_ACTIONS` sets and action verb parsing to two hook functions. The test strategy focuses on:

1. **Verifying the fix**: `analyze` and `add` verbs pass through both hooks during active workflows
2. **Regression protection**: `advance`, `gate-check`, and `build` verbs continue to be handled correctly
3. **Edge case coverage**: Description text containing gate-related keywords does not cause false positives
4. **Action verb parsing**: The regex correctly extracts the verb from flag-prefixed and empty args

No new test framework, test runner, or test utilities are needed. All new tests follow the established patterns in the existing test files.

## Test Types

### Unit Tests (Primary Focus)

All tests for this fix are unit tests. Each test invokes a hook as a child process via `runHook()` with crafted stdin JSON and asserts on stdout (empty = allow, JSON with `continue: false` = block) and exit code.

| Category | File | New Tests | Description |
|----------|------|-----------|-------------|
| Gate-blocker exempt actions | `test-gate-blocker-extended.test.cjs` | 7 | Tests for EXEMPT_ACTIONS in `isGateAdvancementAttempt()` |
| Iteration-corridor exempt actions | `test-iteration-corridor.test.cjs` | 7 | Tests for EXEMPT_ACTIONS in `skillIsAdvanceAttempt()` |

**Total new tests: 14**

### Integration Tests

Not required for this fix. The pre-skill-dispatcher integration is already tested (dispatcher calls `check()` on each hook in sequence). The behavioral change (allowing `analyze`/`add` through) is fully verifiable at the unit level since the hooks are invoked as isolated child processes.

### E2E Tests

Not applicable. The end-to-end flow (`/isdlc analyze` during active workflow) is a framework-level user interaction that cannot be automated without a Claude Code session. The unit tests verify the hook-level behavior that produces the user-visible outcome.

### Security Tests

Not applicable. The fix adds early-return `false` paths (allow). No new attack surface is introduced. The `EXEMPT_ACTIONS` set is immutable and contains only two known-safe verbs.

### Performance Tests

Not applicable. The added code is a single Set lookup and one regex match -- negligible overhead.

## Coverage Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Requirement coverage | 100% (all 4 FRs, all 16 ACs) | Article VII -- every AC must trace to at least one test |
| Branch coverage (new code) | 100% | Both the exempt path (return false) and the fall-through path must be tested |
| Regression coverage | 100% of existing gate advancement tests | Existing tests 1-6b in gate-blocker and tests 5,7,10,15 in iteration-corridor must continue passing |
| Total test count | >= 555 + 14 = 569 | Article II -- test count must not decrease; net addition of 14 |

## Test Case Specifications

### A. Gate-Blocker Exempt Action Tests (test-gate-blocker-extended.test.cjs)

These tests go inside the existing `'Gate advancement detection'` describe block, after test 6b (line 241).

---

#### TC-GB-01: analyze verb is exempt from gate-blocker

**Requirement**: FR-001 / AC-001-01, AC-001-03
**Priority**: P0 (core fix)

**Setup**: Write test requirements with test_iteration enabled. Active workflow in phase 06-implementation.

**Input**:
```javascript
{
  tool_name: 'Skill',
  tool_input: {
    skill: 'isdlc',
    args: 'analyze "gate-blocker blocks analyze"'
  }
}
```

**Expected**: stdout is empty (allow), exit code 0.

**Rationale**: The description text contains "gate" and "blocker" -- the old code would match `args.includes('gate')` and block. With EXEMPT_ACTIONS, the `analyze` verb is detected first and the function returns false.

---

#### TC-GB-02: add verb is exempt from gate-blocker

**Requirement**: FR-001 / AC-001-02
**Priority**: P0 (core fix)

**Setup**: Same as TC-GB-01.

**Input**:
```javascript
{
  tool_name: 'Skill',
  tool_input: {
    skill: 'isdlc',
    args: 'add "fix gate issue"'
  }
}
```

**Expected**: stdout is empty (allow), exit code 0.

**Rationale**: Description contains "gate" but `add` verb is exempt.

---

#### TC-GB-03: analyze with flags is exempt from gate-blocker

**Requirement**: FR-003 / AC-003-02
**Priority**: P1 (parsing correctness)

**Setup**: Same as TC-GB-01.

**Input**:
```javascript
{
  tool_name: 'Skill',
  tool_input: {
    skill: 'isdlc',
    args: '--verbose analyze "#64 gate issue"'
  }
}
```

**Expected**: stdout is empty (allow), exit code 0.

**Rationale**: The regex `/^(?:--?\w+\s+)*(\w+)/` must skip the `--verbose` flag and extract `analyze` as the action verb.

---

#### TC-GB-04: advance verb is NOT exempt (regression)

**Requirement**: FR-001 / AC-001-04
**Priority**: P0 (regression protection)

**Setup**: Same as TC-GB-01.

**Input**:
```javascript
{
  tool_name: 'Skill',
  tool_input: {
    skill: 'isdlc',
    args: 'advance to next phase'
  }
}
```

**Expected**: stdout contains JSON with `continue: false` and stopReason containing "GATE BLOCKED". Exit code 0.

**Rationale**: `advance` is NOT in EXEMPT_ACTIONS. It must continue to be blocked when gate requirements are unsatisfied. This test mirrors existing test 5 but is explicitly included in the new test group for traceability to AC-001-04.

---

#### TC-GB-05: build verb is NOT exempt

**Requirement**: FR-004 / AC-004-04
**Priority**: P0 (critical invariant -- build must never bypass gate)

**Setup**: Same as TC-GB-01.

**Input**:
```javascript
{
  tool_name: 'Skill',
  tool_input: {
    skill: 'isdlc',
    args: 'build "something with gate"'
  }
}
```

**Expected**: stdout contains JSON with `continue: false` (because `args` contains "gate" and `build` is not exempt). Exit code 0.

**Rationale**: Only `analyze` and `add` are exempt. The `build` verb must fall through to the standard `args.includes('gate')` check and be blocked. This test protects against accidental over-exemption.

---

#### TC-GB-06: empty args is NOT exempt

**Requirement**: FR-003 / AC-003-03
**Priority**: P1 (edge case)

**Setup**: Same as TC-GB-01.

**Input**:
```javascript
{
  tool_name: 'Skill',
  tool_input: {
    skill: 'isdlc',
    args: ''
  }
}
```

**Expected**: stdout is empty (allow), exit code 0.

**Rationale**: Empty args yields action = `''` which is not in EXEMPT_ACTIONS. But since empty args also does not match `args.includes('advance')` or `args.includes('gate')`, the function returns false (not a gate advancement attempt). The test verifies the empty-args path does not crash or produce unexpected behavior.

---

#### TC-GB-07: gate-check verb is NOT exempt (regression)

**Requirement**: FR-001 / AC-001-05
**Priority**: P0 (regression)

**Setup**: Same as TC-GB-01.

**Input**:
```javascript
{
  tool_name: 'Skill',
  tool_input: {
    skill: 'isdlc',
    args: 'gate-check'
  }
}
```

**Expected**: stdout contains JSON with `continue: false` and stopReason containing "GATE BLOCKED". Exit code 0.

**Rationale**: `gate-check` is not in EXEMPT_ACTIONS. The regex extracts `gate` as the action verb (the hyphen terminates the `\w+` match). Since `gate` is not in EXEMPT_ACTIONS, it falls through. Then `args.includes('gate')` matches and triggers the block. This verifies AC-001-05.

---

### B. Iteration-Corridor Exempt Action Tests (test-iteration-corridor.test.cjs)

These tests go after the existing test 24 (around line 597). They follow the same `cleanupTestEnv()/setupTestEnv()/installHook()` pattern used in existing tests.

---

#### TC-IC-01: analyze verb is exempt from iteration-corridor in TEST_CORRIDOR

**Requirement**: FR-002 / AC-002-01
**Priority**: P0 (core fix)

**Setup**: `testCorridorState()` -- tests failing, corridor active.

**Input**:
```javascript
skillInput('isdlc', 'analyze "gate-blocker blocks analyze"')
```

**Expected**: stdout is empty (allow), exit code 0.

**Rationale**: Even in TEST_CORRIDOR with failing tests, `analyze` is a workflow-independent verb. It must not be blocked.

---

#### TC-IC-02: add verb is exempt from iteration-corridor in CONST_CORRIDOR

**Requirement**: FR-002 / AC-002-02
**Priority**: P0 (core fix)

**Setup**: `constCorridorState()` -- constitutional validation in progress.

**Input**:
```javascript
skillInput('isdlc', 'add "fix gate issue"')
```

**Expected**: stdout is empty (allow), exit code 0.

**Rationale**: Even in CONST_CORRIDOR, `add` is a workflow-independent verb.

---

#### TC-IC-03: analyze with flags is exempt from iteration-corridor

**Requirement**: FR-003 / AC-003-02
**Priority**: P1 (parsing correctness)

**Setup**: `testCorridorState()`.

**Input**:
```javascript
skillInput('isdlc', '--verbose analyze "issue desc"')
```

**Expected**: stdout is empty (allow), exit code 0.

**Rationale**: Same regex parsing test as TC-GB-03 but in the iteration-corridor context.

---

#### TC-IC-04: advance verb is NOT exempt from iteration-corridor (regression)

**Requirement**: FR-002 / AC-002-03
**Priority**: P0 (regression)

**Setup**: `testCorridorState()`.

**Input**:
```javascript
skillInput('isdlc', 'advance')
```

**Expected**: stdout contains JSON with `continue: false` and stopReason mentioning "gate advancement not allowed during test iteration". Exit code 0.

**Rationale**: This mirrors existing test 7 but is explicitly included for traceability to AC-002-03. The `advance` verb must remain blocked in corridor state.

---

#### TC-IC-05: build verb is NOT exempt from iteration-corridor

**Requirement**: FR-004 / AC-004-04 (cross-hook verification)
**Priority**: P0 (critical invariant)

**Setup**: `testCorridorState()`.

**Input**:
```javascript
skillInput('isdlc', 'build "fix gate-blocker"')
```

**Expected**: stdout contains JSON with `continue: false` (because `args` contains "gate" and `build` is not exempt). Exit code 0.

**Rationale**: `build` is intentionally excluded from EXEMPT_ACTIONS. This test in the iteration-corridor context ensures the exemption is not accidentally broader than intended.

---

#### TC-IC-06: empty args is handled safely in iteration-corridor

**Requirement**: FR-003 / AC-003-03
**Priority**: P1 (edge case)

**Setup**: `testCorridorState()`.

**Input**:
```javascript
skillInput('isdlc', '')
```

**Expected**: stdout is empty (allow), exit code 0.

**Rationale**: Empty args yields `action = ''`. Not in EXEMPT_ACTIONS, but also not matching `args.includes('advance')` or `args.includes('gate')`. Function returns false, corridor check continues to the Task/Skill advance detection logic which finds nothing actionable.

---

#### TC-IC-07: add verb is exempt from iteration-corridor in TEST_CORRIDOR

**Requirement**: FR-002 / AC-002-01 (additional coverage for add in TEST_CORRIDOR)
**Priority**: P0 (core fix)

**Setup**: `testCorridorState()`.

**Input**:
```javascript
skillInput('isdlc', 'add "track this gate bug"')
```

**Expected**: stdout is empty (allow), exit code 0.

**Rationale**: Ensures `add` is exempt in TEST_CORRIDOR (TC-IC-02 tests CONST_CORRIDOR). Description contains "gate" to confirm no false positive.

---

## Traceability Matrix

| Requirement | AC | Test Case(s) | Priority | Hook |
|-------------|-----|-------------|----------|------|
| FR-001 | AC-001-01 | TC-GB-01 | P0 | gate-blocker |
| FR-001 | AC-001-02 | TC-GB-02 | P0 | gate-blocker |
| FR-001 | AC-001-03 | TC-GB-01 | P0 | gate-blocker |
| FR-001 | AC-001-04 | TC-GB-04 | P0 | gate-blocker |
| FR-001 | AC-001-05 | TC-GB-07 | P0 | gate-blocker |
| FR-002 | AC-002-01 | TC-IC-01, TC-IC-07 | P0 | iteration-corridor |
| FR-002 | AC-002-02 | TC-IC-02 | P0 | iteration-corridor |
| FR-002 | AC-002-03 | TC-IC-04 | P0 | iteration-corridor |
| FR-003 | AC-003-01 | TC-GB-01, TC-IC-01 | P0 | both |
| FR-003 | AC-003-02 | TC-GB-03, TC-IC-03 | P1 | both |
| FR-003 | AC-003-03 | TC-GB-06, TC-IC-06 | P1 | both |
| FR-003 | AC-003-04 | TC-GB-04, TC-IC-04 | P0 | both |
| FR-004 | AC-004-01 | TC-GB-01 | P0 | gate-blocker |
| FR-004 | AC-004-02 | TC-GB-02 | P0 | gate-blocker |
| FR-004 | AC-004-03 | TC-GB-04 | P0 | gate-blocker |
| FR-004 | AC-004-04 | TC-GB-05, TC-IC-05 | P0 | both |

**Coverage**: 16/16 acceptance criteria have at least one test case. 100% AC coverage achieved.

## Test Data Plan

Test data is minimal for this fix -- no external data sources, no databases, no fixtures files needed. All test data is inline in the test cases.

### Input Patterns

| Pattern | Args String | Purpose |
|---------|-------------|---------|
| Standard analyze | `'analyze "gate-blocker blocks analyze"'` | Core exempt verb with gate keyword in description |
| Standard add | `'add "fix gate issue"'` | Core exempt verb with gate keyword in description |
| Flagged analyze | `'--verbose analyze "#64 gate issue"'` | Verb extraction with leading flags |
| Short-flagged analyze | `'-v analyze "desc"'` | Short flag before verb |
| Standard advance | `'advance to next phase'` | Non-exempt verb (regression) |
| Standard gate-check | `'gate-check'` | Non-exempt verb (regression) |
| Build with gate | `'build "something with gate"'` | Non-exempt verb with gate keyword |
| Empty args | `''` | Edge case: no args at all |

### State Patterns

| Pattern | Helper | Corridor Active? | Description |
|---------|--------|-------------------|-------------|
| Gate-blocker active workflow | `writeTestRequirements()` + default beforeEach | N/A (gate-blocker checks requirements) | Standard gate-blocker test state |
| TEST_CORRIDOR | `testCorridorState()` | Yes -- tests failing | Iteration corridor with failed tests |
| CONST_CORRIDOR | `constCorridorState()` | Yes -- constitutional validation pending | Iteration corridor with pending constitution |

## Implementation Notes

### Where to Add Tests

1. **Gate-blocker tests** (TC-GB-01 through TC-GB-07): Add inside the `'Gate advancement detection'` describe block in `src/claude/hooks/tests/test-gate-blocker-extended.test.cjs`, after test 6b (around line 241, before the closing `});` of the describe block).

2. **Iteration-corridor tests** (TC-IC-01 through TC-IC-07): Add at the end of the main describe block in `src/claude/hooks/tests/test-iteration-corridor.test.cjs`, after test 24 (around line 597, before the final closing `});`).

### Test Naming Convention

Follow the existing pattern:
- Gate-blocker: Comments with numbered test labels (e.g., `// 7. analyze verb exemption`)
- Iteration-corridor: Comments with numbered test labels (e.g., `// 25. analyze verb exemption`)
- Test descriptions: Descriptive strings matching the existing style (e.g., `'allows analyze verb via Skill (exempt action, BUG-0031)'`)

### Test Execution Order

Tests have no ordering dependencies. Each test calls `setupTestEnv()` with its own state overrides and `cleanupTestEnv()` in afterEach, providing full isolation.

### Run Commands

```
node --test src/claude/hooks/tests/test-gate-blocker-extended.test.cjs
node --test src/claude/hooks/tests/test-iteration-corridor.test.cjs
npm run test:hooks
```

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| False positive in existing tests after fix | Low | Medium | TC-GB-04, TC-GB-07, TC-IC-04 explicitly verify non-exempt verbs still blocked |
| Regex action parsing fails on unexpected input | Low | Medium | TC-GB-03, TC-GB-06, TC-IC-03, TC-IC-06 test flags and empty input |
| Build verb accidentally exempted | Very Low | High | TC-GB-05 and TC-IC-05 explicitly verify build is NOT exempt |
| Test environment isolation failure | Very Low | Low | Each test uses setupTestEnv/cleanupTestEnv pattern (proven in 50+ existing tests) |

## Gate-05 Validation Checklist

- [x] Test strategy covers unit tests for all modified code
- [x] Test cases exist for all 4 functional requirements (FR-001 through FR-004)
- [x] Test cases exist for all 16 acceptance criteria (AC-001-01 through AC-004-04)
- [x] Traceability matrix complete: 16/16 ACs mapped to test cases (100% coverage)
- [x] Coverage targets defined (100% branch coverage of new code, >= 569 total tests)
- [x] Test data strategy documented (inline data, no external dependencies)
- [x] Critical paths identified (exempt action detection, non-exempt regression)
- [x] Integration tests: Not required (unit tests cover hook behavior in isolation)
- [x] E2E tests: Not applicable (framework-level user interaction)
- [x] Security tests: Not applicable (no new attack surface)
- [x] Performance tests: Not applicable (negligible overhead)
- [x] Existing test patterns followed (CJS, node:test, hook-test-utils.cjs helpers)
- [x] Existing test naming conventions followed
- [x] No replacement of existing test infrastructure
