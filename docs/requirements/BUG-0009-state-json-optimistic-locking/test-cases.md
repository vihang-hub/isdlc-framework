# Test Cases: BUG-0009 State.json Optimistic Locking

**Phase**: 05 - Test Strategy & Design
**Created**: 2026-02-12
**Test Framework**: `node:test` + `node:assert/strict` (CJS)

---

## File 1: state-write-validator.test.cjs (T16-T31)

These tests extend the existing test file. They use the in-file helpers (`setupTestEnv`, `writeStateFile`, `runHook`, `makeWriteStdin`) and follow the existing spawnSync-based pattern.

For tests that call `check()` directly (dispatcher mode), they require the hook module and construct a context object.

---

### T16: Version match allows write

**Traces to**: FIX-002, AC-02d

```javascript
// T16: Version match allows write
it('allows write when state_version matches on-disk version', () => {
    // Setup: write state.json with state_version: 5 to disk
    const statePath = writeStateFile(tmpDir, {
        state_version: 5,
        phases: {}
    });

    // Act: simulate a Write tool call where the incoming content has state_version: 5
    // The hook reads disk (version 5) and compares with incoming (version 5) => match
    const result = runHook(tmpDir, {
        tool_name: 'Write',
        tool_input: {
            file_path: statePath,
            content: JSON.stringify({ state_version: 5, phases: {} }, null, 2)
        }
    });

    // Assert: write allowed, no stdout block response, no WARNING
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '', 'Should not produce stdout (no block)');
    assert.ok(!result.stderr.includes('[state-write-validator] WARNING'));
});
```

---

### T17: Version match allows write via Edit tool

**Traces to**: FIX-002, AC-02a, AC-02d

```javascript
// T17: Version match allows write via Edit tool
it('allows write via Edit tool when state_version matches', () => {
    // Setup: disk has state_version: 3
    const statePath = writeStateFile(tmpDir, {
        state_version: 3,
        phases: {}
    });

    // Act: Edit tool (file is already on disk with matching version)
    const result = runHook(tmpDir, {
        tool_name: 'Edit',
        tool_input: { file_path: statePath }
    });

    // Assert: allowed (Edit reads from disk which matches itself)
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '');
});
```

---

### T18: Stale version blocks write

**Traces to**: FIX-002, AC-02c, AC-05d

```javascript
// T18: Stale version blocks write
it('blocks write when incoming state_version is behind on-disk version', () => {
    // Setup: disk has state_version: 5
    const statePath = writeStateFile(tmpDir, {
        state_version: 5,
        phases: {},
        active_workflow: { type: 'fix', description: 'Current workflow' }
    });

    // Act: incoming write has state_version: 3 (stale)
    const result = runHook(tmpDir, {
        tool_name: 'Write',
        tool_input: {
            file_path: statePath,
            content: JSON.stringify({
                state_version: 3,
                phases: {},
                active_workflow: { type: 'feature', description: 'Old stale workflow' }
            }, null, 2)
        }
    });

    // Assert: write is blocked
    assert.equal(result.exitCode, 0);
    // The hook should output a block response on stdout
    assert.ok(result.stdout.includes('"continue":false') || result.stdout.includes('"continue": false'),
        'Should output block response on stdout');
    // stderr should contain warning details
    assert.ok(result.stderr.length > 0, 'Should log details to stderr');
});
```

---

### T19: Block message includes expected and actual version

**Traces to**: FIX-002, AC-02e

```javascript
// T19: Block message includes expected and actual version
it('block message contains expected and actual version numbers', () => {
    const statePath = writeStateFile(tmpDir, {
        state_version: 7,
        phases: {}
    });

    const result = runHook(tmpDir, {
        tool_name: 'Write',
        tool_input: {
            file_path: statePath,
            content: JSON.stringify({ state_version: 4, phases: {} }, null, 2)
        }
    });

    // Parse stdout for the block response
    const combinedOutput = result.stdout + result.stderr;
    assert.ok(combinedOutput.includes('7'), 'Should mention expected version (7)');
    assert.ok(combinedOutput.includes('4'), 'Should mention actual version (4)');
});
```

---

### T20: Block message includes re-read guidance

**Traces to**: FIX-002, AC-02e

```javascript
// T20: Block message includes re-read guidance
it('block message contains guidance to re-read state.json', () => {
    const statePath = writeStateFile(tmpDir, {
        state_version: 10,
        phases: {}
    });

    const result = runHook(tmpDir, {
        tool_name: 'Write',
        tool_input: {
            file_path: statePath,
            content: JSON.stringify({ state_version: 8, phases: {} }, null, 2)
        }
    });

    const combinedOutput = result.stdout + result.stderr;
    // Should contain guidance like "re-read" or "read state.json" or "stale"
    assert.ok(
        combinedOutput.toLowerCase().includes('re-read') ||
        combinedOutput.toLowerCase().includes('stale') ||
        combinedOutput.toLowerCase().includes('read state'),
        'Should include guidance to re-read state.json'
    );
});
```

---

### T21: Version behind by 1 blocks write

**Traces to**: FIX-002, AC-02c

```javascript
// T21: Version behind by exactly 1 blocks write
it('blocks write when incoming version is exactly 1 behind', () => {
    const statePath = writeStateFile(tmpDir, {
        state_version: 5,
        phases: {}
    });

    const result = runHook(tmpDir, {
        tool_name: 'Write',
        tool_input: {
            file_path: statePath,
            content: JSON.stringify({ state_version: 4, phases: {} }, null, 2)
        }
    });

    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('"continue"'),
        'Should output block response');
});
```

---

### T22: Missing incoming state_version allows write (backward compat)

**Traces to**: FIX-005, AC-04a

```javascript
// T22: Missing incoming state_version allows write
it('allows write when incoming content has no state_version field', () => {
    // Disk has state_version: 5
    const statePath = writeStateFile(tmpDir, {
        state_version: 5,
        phases: {}
    });

    // Incoming has no state_version (legacy agent write)
    const result = runHook(tmpDir, {
        tool_name: 'Write',
        tool_input: {
            file_path: statePath,
            content: JSON.stringify({ phases: {} }, null, 2)
        }
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '', 'Should allow (backward compat)');
});
```

---

### T23: Null incoming state_version allows write

**Traces to**: FIX-005, AC-04a

```javascript
// T23: Null incoming state_version allows write
it('allows write when incoming state_version is null', () => {
    const statePath = writeStateFile(tmpDir, {
        state_version: 5,
        phases: {}
    });

    const result = runHook(tmpDir, {
        tool_name: 'Write',
        tool_input: {
            file_path: statePath,
            content: JSON.stringify({ state_version: null, phases: {} }, null, 2)
        }
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '', 'Should allow (null treated as missing)');
});
```

---

### T24: Missing disk state_version allows write (migration case)

**Traces to**: FIX-002, AC-02f

```javascript
// T24: Missing disk state_version allows write
it('allows write when disk state.json has no state_version (migration)', () => {
    // Disk has no state_version (legacy file)
    const statePath = writeStateFile(tmpDir, {
        phases: {},
        active_workflow: null
    });

    // Incoming has state_version: 1 (new format)
    const result = runHook(tmpDir, {
        tool_name: 'Write',
        tool_input: {
            file_path: statePath,
            content: JSON.stringify({ state_version: 1, phases: {} }, null, 2)
        }
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '', 'Should allow (migration case, check skipped)');
});
```

---

### T25: Both missing state_version allows write

**Traces to**: FIX-005, AC-04a; FIX-004, AC-04b

```javascript
// T25: Both missing state_version allows write
it('allows write when neither disk nor incoming has state_version', () => {
    const statePath = writeStateFile(tmpDir, { phases: {} });

    const result = runHook(tmpDir, {
        tool_name: 'Write',
        tool_input: {
            file_path: statePath,
            content: JSON.stringify({ phases: {} }, null, 2)
        }
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '', 'Should allow (fully legacy scenario)');
});
```

---

### T26: Concurrent write simulation -- second stale write blocked

**Traces to**: FIX-002, AC-02c

```javascript
// T26: Concurrent write simulation
it('blocks second write after external version increment', () => {
    // Step 1: Write initial state with version 1
    const statePath = writeStateFile(tmpDir, {
        state_version: 1,
        phases: {},
        active_workflow: { type: 'fix', description: 'BUG-0009' }
    });

    // Step 2: Simulate parent orchestrator incrementing version (external write)
    fs.writeFileSync(statePath, JSON.stringify({
        state_version: 2,
        phases: {},
        active_workflow: { type: 'fix', description: 'BUG-0010' }
    }, null, 2));

    // Step 3: Subagent attempts to write with stale version 1
    const result = runHook(tmpDir, {
        tool_name: 'Write',
        tool_input: {
            file_path: statePath,
            content: JSON.stringify({
                state_version: 1,
                phases: {},
                active_workflow: { type: 'feature', description: 'REQ-0010 (stale!)' }
            }, null, 2)
        }
    });

    // Assert: blocked because incoming version 1 < disk version 2
    assert.ok(result.stdout.includes('"continue"'),
        'Should block the stale write');
});
```

---

### T27: Sequential valid writes succeed

**Traces to**: FIX-002, AC-02d

```javascript
// T27: Sequential valid writes succeed
it('allows sequential writes with incrementing versions', () => {
    const statePath = writeStateFile(tmpDir, {
        state_version: 1,
        phases: {}
    });

    // First write: version 1 -> allowed (matches disk)
    const result1 = runHook(tmpDir, {
        tool_name: 'Write',
        tool_input: {
            file_path: statePath,
            content: JSON.stringify({ state_version: 1, phases: {} }, null, 2)
        }
    });
    assert.equal(result1.stdout, '', 'First write should be allowed');

    // Update disk to version 2
    writeStateFile(tmpDir, { state_version: 2, phases: {} });

    // Second write: version 2 -> allowed (matches disk)
    const result2 = runHook(tmpDir, {
        tool_name: 'Write',
        tool_input: {
            file_path: statePath,
            content: JSON.stringify({ state_version: 2, phases: {} }, null, 2)
        }
    });
    assert.equal(result2.stdout, '', 'Second write should be allowed');
});
```

---

### T28: Corrupted state_version (non-integer) allows write

**Traces to**: FIX-005, AC-05c

```javascript
// T28: Corrupted state_version on disk allows write (fail-open)
it('allows write when disk state_version is non-integer (corrupted)', () => {
    const statePath = writeStateFile(tmpDir, {
        state_version: 'banana',
        phases: {}
    });

    const result = runHook(tmpDir, {
        tool_name: 'Write',
        tool_input: {
            file_path: statePath,
            content: JSON.stringify({ state_version: 1, phases: {} }, null, 2)
        }
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '', 'Should fail-open on corrupted version');
});
```

---

### T29: Negative state_version allows write

**Traces to**: FIX-005, AC-05c

```javascript
// T29: Negative state_version on disk allows write (fail-open)
it('allows write when disk state_version is negative', () => {
    const statePath = writeStateFile(tmpDir, {
        state_version: -1,
        phases: {}
    });

    const result = runHook(tmpDir, {
        tool_name: 'Write',
        tool_input: {
            file_path: statePath,
            content: JSON.stringify({ state_version: 1, phases: {} }, null, 2)
        }
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '', 'Should fail-open on negative version');
});
```

---

### T30: State.json unreadable on disk allows write

**Traces to**: FIX-005, AC-05a

```javascript
// T30: State.json unreadable from disk before hook reads it
it('allows write when state.json cannot be read from disk', () => {
    // Point to a state.json path that does not exist
    const fakePath = path.join(tmpDir, '.isdlc', 'nonexistent-state.json');

    const result = runHook(tmpDir, {
        tool_name: 'Write',
        tool_input: {
            file_path: fakePath,
            content: JSON.stringify({ state_version: 1, phases: {} }, null, 2)
        }
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '', 'Should fail-open when file unreadable');
});
```

---

### T31: V1 structural warning still emitted when version matches

**Traces to**: FIX-004, AC-04c, AC-04d

```javascript
// T31: V1 warning coexists with version check
it('emits V1 structural warning even when version matches (rules coexist)', () => {
    // Disk and incoming both have state_version: 5
    // But the phase data violates V1 (completed with 0 iterations)
    const stateData = {
        state_version: 5,
        phases: {
            '01-requirements': {
                constitutional_validation: { completed: true, iterations_used: 0 }
            }
        }
    };
    const statePath = writeStateFile(tmpDir, stateData);

    const result = runHook(tmpDir, {
        tool_name: 'Write',
        tool_input: {
            file_path: statePath,
            content: JSON.stringify(stateData, null, 2)
        }
    });

    // Version matches (5 == 5) so no block
    // But V1 rule should still emit a warning
    assert.equal(result.stdout, '', 'Should not block (version matches)');
    assert.ok(result.stderr.includes('[state-write-validator] WARNING'),
        'V1 structural warning should still be emitted');
    assert.ok(result.stderr.includes('constitutional_validation'),
        'Warning should mention constitutional_validation');
});
```

---

## File 2: common.test.cjs (C1-C6)

This is a new test file. It tests the `writeState()` function's version auto-increment logic.

### Approach

The tests require `common.cjs` from the actual source (or from the prepared hook path) and call `writeState()` / `readState()` directly. The `setupTestEnv()` from `hook-test-utils.cjs` sets `CLAUDE_PROJECT_DIR` which `common.cjs` uses to resolve `.isdlc/state.json`.

---

### C1: writeState increments version from existing file

**Traces to**: FIX-003, AC-03a, AC-03b

```javascript
// C1: writeState increments version from existing file
it('increments state_version from existing on-disk value', () => {
    const td = setupTestEnv({ state_version: 3 });

    // Import writeState/readState from common.cjs
    const { writeState, readState } = require(path.join(td, 'lib', 'common.cjs'));

    // Write new state (version should auto-increment)
    writeState({ foo: 'bar', phases: {} });

    // Read back and verify
    const state = readState();
    assert.equal(state.state_version, 4, 'Version should be 3 + 1 = 4');
    assert.equal(state.foo, 'bar', 'State data should be preserved');
});
```

---

### C2: writeState initializes version to 1 on first write

**Traces to**: FIX-003, AC-03c

```javascript
// C2: writeState sets version to 1 when no file exists
it('initializes state_version to 1 when no state file exists', () => {
    const td = setupTestEnv();

    // Remove the state file that setupTestEnv creates
    const statePath = path.join(td, '.isdlc', 'state.json');
    fs.unlinkSync(statePath);

    const { writeState, readState } = require(path.join(td, 'lib', 'common.cjs'));

    writeState({ project: { name: 'new' }, phases: {} });

    const state = readState();
    assert.equal(state.state_version, 1, 'First write should set version to 1');
});
```

---

### C3: writeState initializes version to 1 for legacy file

**Traces to**: FIX-001, AC-01d; FIX-004, AC-04b

```javascript
// C3: writeState sets version to 1 when legacy file has no state_version
it('initializes state_version to 1 when existing file lacks state_version', () => {
    const td = setupTestEnv();

    // Write a legacy state.json (no state_version field)
    const statePath = path.join(td, '.isdlc', 'state.json');
    fs.writeFileSync(statePath, JSON.stringify({
        project: { name: 'legacy' },
        phases: {}
    }, null, 2));

    const { writeState, readState } = require(path.join(td, 'lib', 'common.cjs'));

    writeState({ project: { name: 'legacy' }, phases: {} });

    const state = readState();
    assert.equal(state.state_version, 1, 'Legacy file migration should produce version 1');
});
```

---

### C4: writeState does not mutate caller's in-memory object

**Traces to**: FIX-003, AC-03d

```javascript
// C4: writeState does not mutate the caller's state object
it('does not mutate the caller in-memory state object', () => {
    const td = setupTestEnv();

    const { writeState } = require(path.join(td, 'lib', 'common.cjs'));

    const callerState = { project: { name: 'test' }, phases: {} };
    writeState(callerState);

    // The caller's object should NOT have state_version added
    assert.equal(callerState.state_version, undefined,
        'Caller state object must not be mutated');
});
```

---

### C5: writeState increments by exactly 1 each call

**Traces to**: FIX-001, AC-01b

```javascript
// C5: writeState increments by exactly 1 on each write
it('increments state_version by exactly 1 on each successive write', () => {
    const td = setupTestEnv();

    // Remove existing state so first write starts at 1
    const statePath = path.join(td, '.isdlc', 'state.json');
    fs.unlinkSync(statePath);

    const { writeState, readState } = require(path.join(td, 'lib', 'common.cjs'));

    // Write 1: version should be 1
    writeState({ step: 1, phases: {} });
    assert.equal(readState().state_version, 1);

    // Write 2: version should be 2
    writeState({ step: 2, phases: {} });
    assert.equal(readState().state_version, 2);

    // Write 3: version should be 3
    writeState({ step: 3, phases: {} });
    assert.equal(readState().state_version, 3);
});
```

---

### C6: writeState preserves state_version across read/write cycle

**Traces to**: FIX-001, AC-01c

```javascript
// C6: state_version survives read/write roundtrip
it('preserves state_version across a read then write cycle', () => {
    const td = setupTestEnv({ state_version: 5 });

    const { writeState, readState } = require(path.join(td, 'lib', 'common.cjs'));

    // Read state -- should contain state_version: 5
    const state = readState();
    assert.equal(state.state_version, 5, 'Read should return state_version');

    // Write it back -- version should increment to 6
    writeState(state);

    const updated = readState();
    assert.equal(updated.state_version, 6,
        'Write should increment version from 5 to 6');
});
```

---

## Test Execution Order

The tests should be run in this order for optimal clarity:

1. **common.test.cjs** (C1-C6) -- validates writeState() logic first
2. **state-write-validator.test.cjs** (T1-T31) -- validates hook detection logic

Both can run in parallel since they use isolated temporary directories.

## Regression Guarantee

All 15 existing tests (T1-T15) in `state-write-validator.test.cjs` must continue passing without modification. The V7 version check rule is additive and only activates when `state_version` is present in both the incoming content and the on-disk file. Existing tests do not use `state_version` in their test data, so they are unaffected.
