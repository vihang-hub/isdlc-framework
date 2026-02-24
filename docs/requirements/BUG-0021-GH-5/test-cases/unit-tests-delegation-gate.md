# Test Cases: delegation-gate.cjs -- BUG-0021 Defense-in-Depth

**Test File**: `src/claude/hooks/tests/test-delegation-gate.test.cjs`
**Section**: New `describe('BUG-0021: Defense-in-depth exempt action auto-clear', ...)` block
**Phase**: 05-test-strategy
**Date**: 2026-02-17

---

## Test Cases

### TC-DG-01: Auto-clears marker when pending.args starts with exempt action (analyze)

**Requirement**: FR-03, AC-05
**Priority**: P0 (Critical)

**Given**: A `pending_delegation` marker exists in state.json with `args: 'analyze "some feature"'`
**When**: `delegation-gate.cjs` fires on Stop
**Then**: It clears the marker without blocking AND exits cleanly with code 0

**Test Implementation**:
```javascript
it('auto-clears marker when pending.args starts with exempt action (AC-05)', async () => {
    const state = readState();
    state.pending_delegation = {
        skill: 'isdlc',
        required_agent: 'sdlc-orchestrator',
        invoked_at: '2026-02-17T00:15:00Z',
        args: 'analyze "some feature"'
    };
    state.skill_usage_log = [];
    writeState(state);

    const result = await runHook(hookPath, {
        hook_event_name: 'Stop',
        stop_reason: 'end_turn'
    });

    assert.equal(result.code, 0);
    assert.equal(result.stdout, '', 'Should NOT block for exempt action');

    const updatedState = readState();
    assert.equal(updatedState.pending_delegation, null,
        'Should auto-clear the marker for exempt action');
});
```

**Expected RED result**: FAILS -- current code does not inspect pending.args, so it falls through to blocking logic.

---

### TC-DG-02: Does NOT auto-clear for non-exempt args (feature)

**Requirement**: NFR-01, AC-04
**Priority**: P0 (Critical)

**Given**: A `pending_delegation` marker exists with `args: 'feature "add login"'` and no matching delegation in usage log
**When**: `delegation-gate.cjs` fires on Stop
**Then**: It BLOCKS the response (does NOT auto-clear)

**Test Implementation**:
```javascript
it('does NOT auto-clear for non-exempt args like feature (NFR-01)', async () => {
    const state = readState();
    state.pending_delegation = {
        skill: 'isdlc',
        required_agent: 'sdlc-orchestrator',
        invoked_at: '2026-02-17T00:15:00Z',
        args: 'feature "add login"'
    };
    state.skill_usage_log = [];
    writeState(state);

    const result = await runHook(hookPath, {
        hook_event_name: 'Stop',
        stop_reason: 'end_turn'
    });

    assert.equal(result.code, 0);
    const output = JSON.parse(result.stdout);
    assert.equal(output.decision, 'block',
        'Should still block for non-exempt action');
});
```

**Expected RED result**: PASSES (existing behavior) -- regression guard.

---

### TC-DG-03: Auto-clear works for stale marker with exempt args

**Requirement**: FR-03, AC-05
**Priority**: P0 (Critical)

**Given**: A stale `pending_delegation` marker exists (invoked hours ago) with `args: 'analyze "old request"'`
**When**: `delegation-gate.cjs` fires on Stop
**Then**: It auto-clears the stale marker without blocking

**Test Implementation**:
```javascript
it('auto-clears stale marker with exempt args (AC-05)', async () => {
    const state = readState();
    state.pending_delegation = {
        skill: 'isdlc',
        required_agent: 'sdlc-orchestrator',
        invoked_at: '2026-02-16T12:00:00Z',  // hours ago
        args: 'analyze "old request"'
    };
    state.skill_usage_log = [];
    writeState(state);

    const result = await runHook(hookPath, {
        hook_event_name: 'Stop',
        stop_reason: 'end_turn'
    });

    assert.equal(result.code, 0);
    assert.equal(result.stdout, '', 'Should NOT block for stale exempt marker');

    const updatedState = readState();
    assert.equal(updatedState.pending_delegation, null,
        'Should clear the stale exempt marker');
});
```

**Expected RED result**: FAILS -- current code blocks regardless of args content.

---

### TC-DG-04: Auto-clear resets error counter

**Requirement**: FR-03, AC-05
**Priority**: P1 (High)

**Given**: A `pending_delegation` marker exists with exempt args AND `_delegation_gate_error_count` is 3
**When**: `delegation-gate.cjs` fires on Stop and auto-clears
**Then**: The `_delegation_gate_error_count` is reset to 0

**Test Implementation**:
```javascript
it('auto-clear resets error counter (AC-05)', async () => {
    const state = readState();
    state.pending_delegation = {
        skill: 'isdlc',
        required_agent: 'sdlc-orchestrator',
        invoked_at: '2026-02-17T00:15:00Z',
        args: 'analyze "test"'
    };
    state._delegation_gate_error_count = 3;
    state.skill_usage_log = [];
    writeState(state);

    const result = await runHook(hookPath, {
        hook_event_name: 'Stop',
        stop_reason: 'end_turn'
    });

    assert.equal(result.code, 0);
    assert.equal(result.stdout, '');

    const updatedState = readState();
    assert.equal(updatedState.pending_delegation, null);
    assert.equal(updatedState._delegation_gate_error_count, 0,
        'Error count should be reset after auto-clear of exempt action');
});
```

**Expected RED result**: FAILS -- auto-clear path does not exist yet.

---

### TC-DG-05: Empty args in pending marker does NOT trigger auto-clear

**Requirement**: FR-02, AC-06
**Priority**: P1 (High)

**Given**: A `pending_delegation` marker exists with empty `args: ''`
**When**: `delegation-gate.cjs` fires on Stop
**Then**: It does NOT auto-clear (no exempt action matched), proceeds with normal blocking logic

**Test Implementation**:
```javascript
it('does not auto-clear when pending.args is empty', async () => {
    const state = readState();
    state.pending_delegation = {
        skill: 'isdlc',
        required_agent: 'sdlc-orchestrator',
        invoked_at: '2026-02-17T00:15:00Z',
        args: ''
    };
    state.skill_usage_log = [];
    writeState(state);

    const result = await runHook(hookPath, {
        hook_event_name: 'Stop',
        stop_reason: 'end_turn'
    });

    assert.equal(result.code, 0);
    const output = JSON.parse(result.stdout);
    assert.equal(output.decision, 'block',
        'Should block when args is empty (no exempt action)');
});
```

**Expected RED result**: PASSES (existing behavior) -- regression guard.

---

### TC-DG-06: Auto-clears marker for exempt action: status

**Requirement**: FR-03, AC-05
**Priority**: P1 (High)

**Given**: A `pending_delegation` marker exists with `args: 'status'`
**When**: `delegation-gate.cjs` fires on Stop
**Then**: It auto-clears the marker without blocking

**Test Implementation**:
```javascript
it('auto-clears marker for status (exempt action)', async () => {
    const state = readState();
    state.pending_delegation = {
        skill: 'isdlc',
        required_agent: 'sdlc-orchestrator',
        invoked_at: '2026-02-17T00:15:00Z',
        args: 'status'
    };
    state.skill_usage_log = [];
    writeState(state);

    const result = await runHook(hookPath, {
        hook_event_name: 'Stop',
        stop_reason: 'end_turn'
    });

    assert.equal(result.code, 0);
    assert.equal(result.stdout, '', 'Should NOT block for exempt action status');

    const updatedState = readState();
    assert.equal(updatedState.pending_delegation, null);
});
```

**Expected RED result**: FAILS -- current code does not inspect args.

---

### TC-DG-07: Auto-clears marker for exempt action: cancel

**Requirement**: FR-03, AC-05
**Priority**: P2 (Medium)

**Given**: A `pending_delegation` marker exists with `args: 'cancel'`
**When**: `delegation-gate.cjs` fires on Stop
**Then**: It auto-clears the marker without blocking

**Test Implementation**:
```javascript
it('auto-clears marker for cancel (exempt action)', async () => {
    const state = readState();
    state.pending_delegation = {
        skill: 'isdlc',
        required_agent: 'sdlc-orchestrator',
        invoked_at: '2026-02-17T00:15:00Z',
        args: 'cancel'
    };
    state.skill_usage_log = [];
    writeState(state);

    const result = await runHook(hookPath, {
        hook_event_name: 'Stop',
        stop_reason: 'end_turn'
    });

    assert.equal(result.code, 0);
    assert.equal(result.stdout, '');

    const updatedState = readState();
    assert.equal(updatedState.pending_delegation, null);
});
```

**Expected RED result**: FAILS -- current code does not inspect args.

---

### TC-DG-08: Case-insensitive exempt check in pending args

**Requirement**: FR-02, FR-03
**Priority**: P2 (Medium)

**Given**: A `pending_delegation` marker exists with `args: 'ANALYZE "test"'`
**When**: `delegation-gate.cjs` fires on Stop
**Then**: It auto-clears the marker (case-insensitive match)

**Test Implementation**:
```javascript
it('auto-clears with case-insensitive exempt match (ANALYZE)', async () => {
    const state = readState();
    state.pending_delegation = {
        skill: 'isdlc',
        required_agent: 'sdlc-orchestrator',
        invoked_at: '2026-02-17T00:15:00Z',
        args: 'ANALYZE "test"'
    };
    state.skill_usage_log = [];
    writeState(state);

    const result = await runHook(hookPath, {
        hook_event_name: 'Stop',
        stop_reason: 'end_turn'
    });

    assert.equal(result.code, 0);
    assert.equal(result.stdout, '');

    const updatedState = readState();
    assert.equal(updatedState.pending_delegation, null);
});
```

**Expected RED result**: FAILS -- auto-clear path does not exist.

---

## Summary

| TC ID | Requirement | Priority | Expected RED Result |
|-------|------------|----------|-------------------|
| TC-DG-01 | FR-03, AC-05 | P0 | FAIL (bug) |
| TC-DG-02 | NFR-01, AC-04 | P0 | PASS (regression guard) |
| TC-DG-03 | FR-03, AC-05 | P0 | FAIL (bug) |
| TC-DG-04 | FR-03, AC-05 | P1 | FAIL (bug) |
| TC-DG-05 | FR-02, AC-06 | P1 | PASS (regression guard) |
| TC-DG-06 | FR-03, AC-05 | P1 | FAIL (bug) |
| TC-DG-07 | FR-03, AC-05 | P2 | FAIL (bug) |
| TC-DG-08 | FR-02, FR-03 | P2 | FAIL (bug) |

**Total new tests**: 8
**Expected to FAIL in RED phase**: 6 (proving the bug / missing defense-in-depth)
**Expected to PASS in RED phase**: 2 (regression guards)
