# Test Cases: skill-delegation-enforcer.cjs -- BUG-0021 Exempt Actions

**Test File**: `src/claude/hooks/tests/test-skill-delegation-enforcer.test.cjs`
**Section**: New `describe('BUG-0021: Exempt action handling', ...)` block
**Phase**: 05-test-strategy
**Date**: 2026-02-17

---

## Test Cases

### TC-SDE-01: EXEMPT_ACTIONS constant contains analyze

**Requirement**: FR-01, AC-01
**Priority**: P0 (Critical)

**Given**: `skill-delegation-enforcer.cjs` is loaded
**When**: The hook processes a Skill tool call for `/isdlc` with args `'analyze "some feature"'`
**Then**: The hook exits with code 0 without writing `pending_delegation` to state.json and without emitting the mandatory delegation context message

**Test Implementation**:
```javascript
it('does not write pending_delegation for /isdlc analyze (AC-01, AC-03)', async () => {
    const result = await runHook(hookPath, {
        tool_name: 'Skill',
        tool_input: { skill: 'isdlc', args: 'analyze "some feature description"' }
    });

    assert.equal(result.code, 0);
    assert.equal(result.stdout, '', 'Should NOT emit mandatory delegation message');

    const state = readState();
    assert.equal(state.pending_delegation, undefined,
        'Should NOT write pending_delegation marker for exempt action');
});
```

**Expected RED result**: FAILS because current code does not check args -- will write marker and emit message.

---

### TC-SDE-02: Action parsing extracts first word from args

**Requirement**: FR-02, AC-02
**Priority**: P0 (Critical)

**Given**: The `/isdlc` Skill is invoked with args `'analyze "some description"'`
**When**: The hook parses the action
**Then**: It correctly identifies `'analyze'` as the action and treats it as exempt

**Test Implementation**:
```javascript
it('parses action as first word from args string (AC-02)', async () => {
    const result = await runHook(hookPath, {
        tool_name: 'Skill',
        tool_input: { skill: 'isdlc', args: 'analyze "build a login page"' }
    });

    assert.equal(result.code, 0);
    assert.equal(result.stdout, '', 'Should parse "analyze" as first word and skip enforcement');

    const state = readState();
    assert.equal(state.pending_delegation, undefined);
});
```

**Expected RED result**: FAILS because current code does not parse args.

---

### TC-SDE-03: No marker written AND no message for /isdlc analyze

**Requirement**: FR-01, FR-02, AC-03
**Priority**: P0 (Critical)

**Given**: The `/isdlc` Skill is invoked with args containing exempt action `analyze`
**When**: `skill-delegation-enforcer.cjs` processes the event
**Then**: It does NOT call `writePendingDelegation()` AND does NOT emit the mandatory delegation context message AND exits cleanly with code 0

**Test Implementation**:
```javascript
it('exits cleanly with no side effects for analyze (AC-03)', async () => {
    const result = await runHook(hookPath, {
        tool_name: 'Skill',
        tool_input: { skill: 'isdlc', args: 'analyze "test"' }
    });

    assert.equal(result.code, 0);
    assert.ok(!result.stdout.includes('MANDATORY'), 'No mandatory message');
    assert.ok(!result.stdout.includes('sdlc-orchestrator'), 'No orchestrator reference');
    assert.ok(!result.stdout.includes('Phase-Loop Controller'), 'No Phase-Loop reference');

    const state = readState();
    assert.ok(!state.pending_delegation, 'No pending_delegation marker');
});
```

**Expected RED result**: FAILS -- current code emits "MANDATORY" and writes marker.

---

### TC-SDE-04: Marker STILL written for /isdlc feature (backward compat)

**Requirement**: NFR-01, AC-04
**Priority**: P0 (Critical)

**Given**: The `/isdlc` Skill is invoked with args `'feature "add login"'`
**When**: `skill-delegation-enforcer.cjs` processes the event
**Then**: It DOES write `pending_delegation` marker AND DOES emit the mandatory delegation context message

**Test Implementation**:
```javascript
it('still writes pending_delegation for /isdlc feature (AC-04, NFR-01)', async () => {
    const result = await runHook(hookPath, {
        tool_name: 'Skill',
        tool_input: { skill: 'isdlc', args: 'feature "add login"' }
    });

    assert.equal(result.code, 0);
    assert.ok(result.stdout.includes('MANDATORY'), 'Should emit mandatory message for feature');
    assert.ok(result.stdout.includes('sdlc-orchestrator'));

    const state = readState();
    assert.ok(state.pending_delegation, 'Should write pending_delegation for non-exempt action');
    assert.equal(state.pending_delegation.skill, 'isdlc');
    assert.equal(state.pending_delegation.required_agent, 'sdlc-orchestrator');
});
```

**Expected RED result**: PASSES (existing behavior) -- this is a regression guard.

---

### TC-SDE-05: Marker STILL written for /isdlc fix (backward compat)

**Requirement**: NFR-01, AC-04
**Priority**: P1 (High)

**Given**: The `/isdlc` Skill is invoked with args `'fix "broken auth"'`
**When**: `skill-delegation-enforcer.cjs` processes the event
**Then**: It DOES write `pending_delegation` marker

**Test Implementation**:
```javascript
it('still writes pending_delegation for /isdlc fix (NFR-01)', async () => {
    const result = await runHook(hookPath, {
        tool_name: 'Skill',
        tool_input: { skill: 'isdlc', args: 'fix "broken auth"' }
    });

    assert.equal(result.code, 0);
    assert.ok(result.stdout.includes('MANDATORY'));

    const state = readState();
    assert.ok(state.pending_delegation);
    assert.equal(state.pending_delegation.args, 'fix "broken auth"');
});
```

**Expected RED result**: PASSES (existing behavior) -- regression guard.

---

### TC-SDE-06: Empty args falls through to normal enforcement

**Requirement**: FR-02, AC-06
**Priority**: P1 (High)

**Given**: The `/isdlc` Skill is invoked with empty args `''`
**When**: `skill-delegation-enforcer.cjs` parses the action
**Then**: It does NOT crash AND falls through to normal delegation enforcement (writes marker)

**Test Implementation**:
```javascript
it('falls through to normal enforcement when args is empty (AC-06)', async () => {
    const result = await runHook(hookPath, {
        tool_name: 'Skill',
        tool_input: { skill: 'isdlc', args: '' }
    });

    assert.equal(result.code, 0);
    assert.ok(result.stdout.includes('MANDATORY'),
        'Empty args should NOT match any exempt action, so normal enforcement applies');

    const state = readState();
    assert.ok(state.pending_delegation, 'Should write marker when no exempt action detected');
});
```

**Expected RED result**: PASSES (existing behavior) -- regression guard.

---

### TC-SDE-07: Args with missing args key defaults gracefully

**Requirement**: FR-02, AC-06
**Priority**: P1 (High)

**Given**: The `/isdlc` Skill is invoked with no `args` key in tool_input
**When**: `skill-delegation-enforcer.cjs` parses the action
**Then**: It does NOT crash AND falls through to normal enforcement

**Test Implementation**:
```javascript
it('handles missing args key gracefully (AC-06)', async () => {
    const result = await runHook(hookPath, {
        tool_name: 'Skill',
        tool_input: { skill: 'isdlc' }
    });

    assert.equal(result.code, 0);
    assert.ok(result.stdout.includes('MANDATORY'),
        'Missing args should fall through to normal enforcement');

    const state = readState();
    assert.ok(state.pending_delegation);
});
```

**Expected RED result**: PASSES (existing behavior) -- regression guard.

---

### TC-SDE-08: Other exempt actions: status

**Requirement**: FR-01, AC-01
**Priority**: P1 (High)

**Given**: The `/isdlc` Skill is invoked with args `'status'`
**When**: `skill-delegation-enforcer.cjs` processes the event
**Then**: It does NOT write pending_delegation (status is exempt)

**Test Implementation**:
```javascript
it('does not write pending_delegation for /isdlc status (exempt)', async () => {
    const result = await runHook(hookPath, {
        tool_name: 'Skill',
        tool_input: { skill: 'isdlc', args: 'status' }
    });

    assert.equal(result.code, 0);
    assert.equal(result.stdout, '');

    const state = readState();
    assert.ok(!state.pending_delegation);
});
```

**Expected RED result**: FAILS -- current code writes marker for all /isdlc invocations.

---

### TC-SDE-09: Other exempt actions: cancel

**Requirement**: FR-01, AC-01
**Priority**: P1 (High)

**Given**: The `/isdlc` Skill is invoked with args `'cancel'`
**When**: `skill-delegation-enforcer.cjs` processes the event
**Then**: It does NOT write pending_delegation (cancel is exempt)

**Test Implementation**:
```javascript
it('does not write pending_delegation for /isdlc cancel (exempt)', async () => {
    const result = await runHook(hookPath, {
        tool_name: 'Skill',
        tool_input: { skill: 'isdlc', args: 'cancel' }
    });

    assert.equal(result.code, 0);
    assert.equal(result.stdout, '');

    const state = readState();
    assert.ok(!state.pending_delegation);
});
```

**Expected RED result**: FAILS -- current code writes marker.

---

### TC-SDE-10: Action parsing is case-insensitive

**Requirement**: FR-02, NFR-03
**Priority**: P2 (Medium)

**Given**: The `/isdlc` Skill is invoked with args `'ANALYZE "test"'`
**When**: `skill-delegation-enforcer.cjs` parses the action
**Then**: It correctly identifies `'ANALYZE'` as exempt (case-insensitive match)

**Test Implementation**:
```javascript
it('action parsing is case-insensitive (ANALYZE -> exempt)', async () => {
    const result = await runHook(hookPath, {
        tool_name: 'Skill',
        tool_input: { skill: 'isdlc', args: 'ANALYZE "test"' }
    });

    assert.equal(result.code, 0);
    assert.equal(result.stdout, '');

    const state = readState();
    assert.ok(!state.pending_delegation);
});
```

**Expected RED result**: FAILS -- current code does not parse args at all.

---

## Summary

| TC ID | Requirement | Priority | Expected RED Result |
|-------|------------|----------|-------------------|
| TC-SDE-01 | FR-01, AC-01, AC-03 | P0 | FAIL (bug) |
| TC-SDE-02 | FR-02, AC-02 | P0 | FAIL (bug) |
| TC-SDE-03 | FR-01, FR-02, AC-03 | P0 | FAIL (bug) |
| TC-SDE-04 | NFR-01, AC-04 | P0 | PASS (regression guard) |
| TC-SDE-05 | NFR-01, AC-04 | P1 | PASS (regression guard) |
| TC-SDE-06 | FR-02, AC-06 | P1 | PASS (regression guard) |
| TC-SDE-07 | FR-02, AC-06 | P1 | PASS (regression guard) |
| TC-SDE-08 | FR-01, AC-01 | P1 | FAIL (bug) |
| TC-SDE-09 | FR-01, AC-01 | P1 | FAIL (bug) |
| TC-SDE-10 | FR-02, NFR-03 | P2 | FAIL (bug) |

**Total new tests**: 10
**Expected to FAIL in RED phase**: 6 (proving the bug exists)
**Expected to PASS in RED phase**: 4 (regression guards)
