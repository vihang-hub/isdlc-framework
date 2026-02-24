# Test Strategy: BUG-0021-GH-5

**Title**: delegation-gate infinite loop on /isdlc analyze -- missing carve-out for Phase A
**Phase**: 05-test-strategy
**Date**: 2026-02-17
**Bug ID**: BUG-0021
**External**: [GitHub #5](https://github.com/vihangshah/isdlc/issues/5)

---

## Existing Infrastructure (from test evaluation)

- **Framework**: Node.js built-in `node:test` + `node:assert/strict` (Node 18+)
- **Coverage Tool**: None (manual test counting, no Istanbul/c8)
- **Test Streams**: ESM (`lib/*.test.js`) and CJS (`src/claude/hooks/tests/*.test.cjs`)
- **Current Test Count**: 555 baseline (302 ESM + 253 CJS)
- **Existing Patterns**: Hooks use CJS tests in `src/claude/hooks/tests/test-{hookname}.test.cjs`
- **Test Utilities**: `src/claude/hooks/tests/hook-test-utils.cjs` (setupTestEnv, cleanupTestEnv, prepareHook, runHook, readState, writeState)
- **Naming Convention**: `test-{hookname}.test.cjs` for hook test files
- **Existing Test Files for Affected Hooks**:
  - `src/claude/hooks/tests/test-skill-delegation-enforcer.test.cjs` (11 tests)
  - `src/claude/hooks/tests/test-delegation-gate.test.cjs` (20 tests, including BUG-0005 regression suite)

---

## Strategy for This Bug Fix

### Approach

**Extend existing test suites** -- do NOT replace or restructure. New test cases will be added as new `describe` blocks within the existing test files, following established patterns.

### Test Types Needed

| Test Type | Scope | Files |
|-----------|-------|-------|
| **Unit (Primary)** | EXEMPT_ACTIONS constant, action parsing, skip logic in enforcer | `test-skill-delegation-enforcer.test.cjs` |
| **Unit (Primary)** | Defense-in-depth carve-out in delegation-gate | `test-delegation-gate.test.cjs` |
| **Integration** | End-to-end flow: invoke /isdlc with analyze args -> verify no marker written AND no block on Stop | `test-delegation-gate.test.cjs` (cross-hook section) |
| **Regression** | All 11 existing enforcer tests + all 20 existing gate tests must continue passing | Existing test files (no changes to existing tests) |

### Coverage Target

- **New tests**: 100% coverage of FR-01 through FR-03 acceptance criteria (AC-01 through AC-06)
- **Regression**: Zero test count decrease below 555 baseline
- **Critical paths**: 100% coverage of the exempt action code path in both hooks

### Test Commands (existing)

- CJS hook tests: `node --test src/claude/hooks/tests/test-skill-delegation-enforcer.test.cjs`
- CJS hook tests: `node --test src/claude/hooks/tests/test-delegation-gate.test.cjs`
- Full CJS suite: `npm run test:hooks`
- Full suite: `npm run test:all`

---

## Test Design Principles

### TDD Approach (Red-Green-Refactor)

Per Article II (Test-First Development), all test cases are designed BEFORE implementation. The implementation phase (06) will:

1. **RED**: Run the new tests against unmodified source -- they MUST fail (proving the bug exists)
2. **GREEN**: Apply the fix -- all new tests pass
3. **REFACTOR**: Clean up if needed -- all tests still pass

### Backward Compatibility Guard

Every new test that verifies exempt action behavior has a corresponding "negative" test that verifies non-exempt actions (`feature`, `fix`, `upgrade`, etc.) continue to behave as before. This directly addresses NFR-01 (Backward compatibility).

### Defense-in-Depth Testing

Both the enforcer (primary fix) and the gate (secondary fix) are tested independently. An integration test verifies the end-to-end flow where the enforcer correctly skips AND the gate correctly auto-clears, ensuring both layers work together.

---

## Test Organization

### New Test Sections (added to existing files)

#### In `test-skill-delegation-enforcer.test.cjs`:

```
describe('BUG-0021: Exempt action handling', () => {
    // TC-SDE-01: EXEMPT_ACTIONS constant exists
    // TC-SDE-02: Action parsing extracts first word from args
    // TC-SDE-03: No marker written for /isdlc analyze
    // TC-SDE-04: No mandatory context message for /isdlc analyze
    // TC-SDE-05: Marker STILL written for /isdlc feature (non-exempt)
    // TC-SDE-06: Marker STILL written for /isdlc fix (non-exempt)
    // TC-SDE-07: Empty args falls through to normal enforcement
    // TC-SDE-08: Args with leading flags parsed correctly
    // TC-SDE-09: Other exempt actions (status, cancel, gate-check, etc.)
    // TC-SDE-10: Action parsing is case-insensitive
});
```

#### In `test-delegation-gate.test.cjs`:

```
describe('BUG-0021: Defense-in-depth exempt action auto-clear', () => {
    // TC-DG-01: Auto-clears marker when pending.args starts with exempt action
    // TC-DG-02: Does NOT auto-clear for non-exempt args (feature, fix)
    // TC-DG-03: Auto-clear works for stale marker from prior session
    // TC-DG-04: Auto-clear resets error counter
    // TC-DG-05: Empty args in pending marker does not trigger auto-clear
    // TC-DG-06: Integration: enforcer skip + gate auto-clear for analyze
});
```

---

## Test Data Strategy

### Input Variations

| Category | Example Args | Expected Behavior |
|----------|-------------|-------------------|
| **Exempt: analyze** | `'analyze "feature description"'` | No marker, no message |
| **Exempt: status** | `'status'` | No marker, no message |
| **Exempt: cancel** | `'cancel'` | No marker, no message |
| **Exempt: gate-check** | `'gate-check'` | No marker, no message |
| **Exempt: escalate** | `'escalate'` | No marker, no message |
| **Exempt: configure-cloud** | `'configure-cloud aws'` | No marker, no message |
| **Non-exempt: feature** | `'feature "add login"'` | Marker written, message emitted |
| **Non-exempt: fix** | `'fix "broken auth"'` | Marker written, message emitted |
| **Non-exempt: upgrade** | `'upgrade node'` | Marker written, message emitted |
| **Non-exempt: test** | `'test run'` | Marker written, message emitted |
| **Edge: empty** | `''` | Falls through to normal enforcement |
| **Edge: flags first** | `'--verbose analyze "desc"'` | Depends on parsing strategy |
| **Edge: case variation** | `'ANALYZE "desc"'` | Case-insensitive match -> exempt |

### State Fixtures

| Fixture Name | Description |
|-------------|-------------|
| `staleExemptMarker` | `pending_delegation` with `args: 'analyze "desc"'` from hours ago |
| `staleNonExemptMarker` | `pending_delegation` with `args: 'feature "test"'` from hours ago |
| `cleanState` | Default state with no `pending_delegation` |
| `errorCountState` | State with `_delegation_gate_error_count: 3` and exempt marker |

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Regex parsing breaks on unusual args format | Comprehensive edge case tests (flags, quotes, empty, unicode) |
| EXEMPT_ACTIONS list is incomplete | Extensibility test verifies Set is easy to modify; requirements list all known exempt actions |
| Defense-in-depth auto-clear masks real issues | Only triggers for exempt actions; non-exempt args still block normally |
| New tests accidentally modify existing test behavior | New tests in separate `describe` blocks; existing tests untouched |

---

## Gate-04 Checklist

- [x] Test strategy covers unit, integration, regression, and edge case testing
- [x] Test cases exist for all requirements (FR-01 through FR-04, AC-01 through AC-08)
- [x] Traceability matrix complete (100% requirement coverage)
- [x] Coverage targets defined (100% for new code paths, 555 baseline preserved)
- [x] Test data strategy documented (input variations, state fixtures)
- [x] Critical paths identified (exempt action skip, defense-in-depth auto-clear)
- [x] TDD approach specified (Red-Green-Refactor per Article II)
- [x] Existing test infrastructure reused (no framework changes)
