# Test Cases: Integration -- BUG-0021 End-to-End Exempt Action Flow

**Test File**: `src/claude/hooks/tests/test-delegation-gate.test.cjs`
**Section**: Within the `describe('BUG-0021: Defense-in-depth exempt action auto-clear', ...)` block
**Phase**: 05-test-strategy
**Date**: 2026-02-17

---

## Integration Test Cases

These tests verify the end-to-end flow across both hooks, simulating the real scenario where `skill-delegation-enforcer.cjs` runs first (PostToolUse) and `delegation-gate.cjs` runs second (Stop).

### TC-INT-01: Full flow -- enforcer skip prevents gate block for /isdlc analyze

**Requirement**: FR-01, FR-02, FR-03, AC-01 through AC-05
**Priority**: P0 (Critical)

**Given**: Clean state.json with no `pending_delegation`
**When**: `skill-delegation-enforcer.cjs` processes a Skill call for `/isdlc analyze "test"` AND THEN `delegation-gate.cjs` fires on Stop
**Then**:
  - After the enforcer: no `pending_delegation` exists in state.json
  - After the gate: no block occurs, response is allowed

**Test Implementation**:
```javascript
it('full flow: enforcer skips marker for analyze, gate allows response (AC-01..AC-05)', async () => {
    // Step 1: Run the enforcer with an analyze invocation
    const enforcerSrc = path.resolve(__dirname, '..', 'skill-delegation-enforcer.cjs');
    const enforcerPath = prepareHook(enforcerSrc);

    const enforcerResult = await runHook(enforcerPath, {
        tool_name: 'Skill',
        tool_input: { skill: 'isdlc', args: 'analyze "build a search feature"' }
    });

    assert.equal(enforcerResult.code, 0);
    assert.equal(enforcerResult.stdout, '', 'Enforcer should not emit message for analyze');

    // Verify no marker was written
    const stateAfterEnforcer = readState();
    assert.ok(!stateAfterEnforcer.pending_delegation,
        'No pending_delegation after enforcer processes analyze');

    // Step 2: Run the gate (Stop hook)
    const gateResult = await runHook(hookPath, {
        hook_event_name: 'Stop',
        stop_reason: 'end_turn'
    });

    assert.equal(gateResult.code, 0);
    assert.equal(gateResult.stdout, '', 'Gate should allow response (no pending marker)');
});
```

**Expected RED result**: FAILS at Step 1 because enforcer writes the marker, causing Step 2 to block.

---

### TC-INT-02: Full flow -- non-exempt action still blocked

**Requirement**: NFR-01, AC-04
**Priority**: P0 (Critical)

**Given**: Clean state.json with no `pending_delegation`
**When**: `skill-delegation-enforcer.cjs` processes a Skill call for `/isdlc feature "test"` AND THEN `delegation-gate.cjs` fires on Stop (without any delegation in usage log)
**Then**:
  - After the enforcer: `pending_delegation` exists in state.json
  - After the gate: response is BLOCKED

**Test Implementation**:
```javascript
it('full flow: enforcer writes marker for feature, gate blocks (NFR-01)', async () => {
    // Step 1: Run the enforcer with a feature invocation
    const enforcerSrc = path.resolve(__dirname, '..', 'skill-delegation-enforcer.cjs');
    const enforcerPath = prepareHook(enforcerSrc);

    const enforcerResult = await runHook(enforcerPath, {
        tool_name: 'Skill',
        tool_input: { skill: 'isdlc', args: 'feature "add search"' }
    });

    assert.equal(enforcerResult.code, 0);
    assert.ok(enforcerResult.stdout.includes('MANDATORY'));

    // Verify marker was written
    const stateAfterEnforcer = readState();
    assert.ok(stateAfterEnforcer.pending_delegation);

    // Step 2: Run the gate (Stop hook) -- should block
    const gateResult = await runHook(hookPath, {
        hook_event_name: 'Stop',
        stop_reason: 'end_turn'
    });

    assert.equal(gateResult.code, 0);
    const output = JSON.parse(gateResult.stdout);
    assert.equal(output.decision, 'block');
});
```

**Expected RED result**: PASSES (existing behavior) -- regression guard.

---

## Summary

| TC ID | Requirement | Priority | Expected RED Result |
|-------|------------|----------|-------------------|
| TC-INT-01 | FR-01, FR-02, FR-03, AC-01..AC-05 | P0 | FAIL (reproduces the bug end-to-end) |
| TC-INT-02 | NFR-01, AC-04 | P0 | PASS (regression guard) |

**Total new integration tests**: 2
**Expected to FAIL in RED phase**: 1 (reproducing the bug)
**Expected to PASS in RED phase**: 1 (regression guard)
