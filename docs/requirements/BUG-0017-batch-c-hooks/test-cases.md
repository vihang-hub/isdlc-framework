# Test Cases: BUG-0017 Batch C Hook Bugs

**Phase**: 05-test-strategy
**Date**: 2026-02-15
**Total New/Updated Tests**: 15 (7 gate-blocker + 6 state-write-validator new + 2 state-write-validator updated)
**Target Files**:
- `src/claude/hooks/tests/test-gate-blocker-extended.test.cjs`
- `src/claude/hooks/tests/state-write-validator.test.cjs`

---

## Part A: Bug 0.9 -- Gate-Blocker Artifact Variant Reporting

### Test File: `test-gate-blocker-extended.test.cjs`
### New Describe Block: `'BUG-0017: Artifact variant reporting'`

All tests in this section require a custom `writeArtifactRequirements()` helper that configures `iteration-requirements.json` with artifact_validation paths. The function also disables all other gate requirements (test_iteration, constitutional_validation, agent_delegation_validation, interactive_elicitation) so that the artifact check is isolated.

Additionally, each test needs to set `current_phase` to a phase that has artifact_validation configured, and set `active_workflow.artifact_folder` so that `{artifact_folder}` template variables resolve correctly. The filesystem must be set up to control which variant files exist.

---

### TC-GB-V01: Multi-variant missing: error lists all variants

**Requirement**: AC-1.1, FR-1, FR-2, FR-3
**Priority**: P0

**Preconditions**:
- Temp test environment created via `setupTestEnv()`
- Hook prepared via `prepareHook(hookSrcPath)`

**Setup**:
```javascript
// Write iteration-requirements.json
writeIterationRequirements({
    version: '2.0.0',
    phase_requirements: {
        '04-design': {
            interactive_elicitation: { enabled: false },
            test_iteration: { enabled: false },
            constitutional_validation: { enabled: false },
            agent_delegation_validation: { enabled: false },
            artifact_validation: {
                enabled: true,
                paths: [
                    'docs/design/{artifact_folder}/interface-spec.yaml',
                    'docs/design/{artifact_folder}/interface-spec.md'
                ]
            }
        }
    },
    gate_blocking_rules: {
        block_on_missing_artifacts: true
    }
});

// Write state.json
writeState({
    current_phase: '04-design',
    active_workflow: {
        type: 'feature',
        artifact_folder: 'REQ-TEST',
        current_phase: '04-design'
    },
    iteration_enforcement: { enabled: true },
    skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
    skill_usage_log: [],
    phases: {
        '04-design': { status: 'in_progress' }
    }
});

// Do NOT create either variant file on disk
```

**Input**:
```javascript
{
    tool_name: 'Task',
    tool_input: {
        prompt: 'advance to next phase',
        subagent_type: 'sdlc-orchestrator'
    }
}
```

**Expected Results**:
```javascript
assert.equal(result.code, 0);
assert.ok(result.stdout, 'Should produce blocking output');
const output = JSON.parse(result.stdout);
assert.equal(output.continue, false);
assert.ok(output.stopReason.includes('interface-spec.yaml'),
    'Should mention first variant');
assert.ok(output.stopReason.includes('interface-spec.md'),
    'Should mention second variant');
assert.ok(output.stopReason.includes('(or'),
    'Should use "or" syntax for alternatives');
```

---

### TC-GB-V02: Multi-variant satisfied by second variant

**Requirement**: AC-1.2
**Priority**: P0

**Setup**: Same as TC-GB-V01, plus:
```javascript
// Create the second variant file on disk
const testDir = getTestDir();
const docsDir = path.join(testDir, 'docs', 'design', 'REQ-TEST');
fs.mkdirSync(docsDir, { recursive: true });
fs.writeFileSync(path.join(docsDir, 'interface-spec.md'), '# Interface Spec\n');
// Do NOT create interface-spec.yaml
```

**Expected Results**:
```javascript
assert.equal(result.code, 0);
// Gate should not block on artifacts (second variant satisfies)
// If result has stdout, it should NOT be about artifacts
if (result.stdout) {
    assert.ok(!result.stdout.includes('interface-spec'),
        'Should not block on artifact when second variant exists');
}
```

---

### TC-GB-V03: Single-path missing: error unchanged

**Requirement**: AC-1.3
**Priority**: P1

**Setup**:
```javascript
writeIterationRequirements({
    version: '2.0.0',
    phase_requirements: {
        '01-requirements': {
            interactive_elicitation: { enabled: false },
            test_iteration: { enabled: false },
            constitutional_validation: { enabled: false },
            agent_delegation_validation: { enabled: false },
            artifact_validation: {
                enabled: true,
                paths: [
                    'docs/requirements/{artifact_folder}/requirements-spec.md'
                ]
            }
        }
    },
    gate_blocking_rules: {
        block_on_missing_artifacts: true
    }
});

writeState({
    current_phase: '01-requirements',
    active_workflow: {
        type: 'feature',
        artifact_folder: 'REQ-TEST',
        current_phase: '01-requirements'
    },
    iteration_enforcement: { enabled: true },
    skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
    skill_usage_log: [],
    phases: {
        '01-requirements': { status: 'in_progress' }
    }
});
// Do NOT create requirements-spec.md
```

**Expected Results**:
```javascript
assert.equal(result.code, 0);
const output = JSON.parse(result.stdout);
assert.equal(output.continue, false);
assert.ok(output.stopReason.includes('requirements-spec.md'),
    'Should mention the single missing artifact');
assert.ok(!output.stopReason.includes('(or'),
    'Should NOT use "or" syntax for single-path requirement');
```

---

### TC-GB-V04: Composite representation in missing_artifacts state

**Requirement**: AC-1.4, FR-2
**Priority**: P1

**Setup**: Same as TC-GB-V01 (multi-variant, neither exists)

**Verification**:
```javascript
const result = await runHook(hookPath, gateAdvanceInput('advance'));
assert.equal(result.code, 0);
const output = JSON.parse(result.stdout);
assert.equal(output.continue, false);

// Read state to check gate_validation
const state = readState();
const gateVal = state.phases?.['04-design']?.gate_validation;
assert.ok(gateVal, 'Should have gate_validation');
assert.equal(gateVal.status, 'blocked');
// The blocking_requirements or stopReason should reference variant composite
assert.ok(output.stopReason.includes('(or'),
    'Missing artifacts should show composite variant representation');
```

---

### TC-GB-V05: All variants exist: no error

**Requirement**: AC-1.5
**Priority**: P1

**Setup**: Same as TC-GB-V01, plus:
```javascript
const testDir = getTestDir();
const docsDir = path.join(testDir, 'docs', 'design', 'REQ-TEST');
fs.mkdirSync(docsDir, { recursive: true });
fs.writeFileSync(path.join(docsDir, 'interface-spec.yaml'), 'openapi: 3.0.0\n');
fs.writeFileSync(path.join(docsDir, 'interface-spec.md'), '# Interface Spec\n');
```

**Expected Results**:
```javascript
assert.equal(result.code, 0);
// No artifact-related block
if (result.stdout) {
    assert.ok(!result.stdout.includes('interface-spec'),
        'Should not block when all variants exist');
}
```

---

### TC-GB-V06: Existing tests regression (implicit)

**Requirement**: AC-1.6
**Priority**: P0

**Implementation Note**: This is verified by running the full existing test suite. Not a separate test case -- it is validated by ensuring all 38 existing tests in `test-gate-blocker-extended.test.cjs` pass after the fix. The quality loop (Phase 16) runs the full suite.

---

### TC-GB-V07: Three-variant group: all listed when missing

**Requirement**: AC-1.1 (edge case)
**Priority**: P2

**Setup**:
```javascript
writeIterationRequirements({
    version: '2.0.0',
    phase_requirements: {
        '04-design': {
            interactive_elicitation: { enabled: false },
            test_iteration: { enabled: false },
            constitutional_validation: { enabled: false },
            agent_delegation_validation: { enabled: false },
            artifact_validation: {
                enabled: true,
                paths: [
                    'docs/design/{artifact_folder}/spec.yaml',
                    'docs/design/{artifact_folder}/spec.md',
                    'docs/design/{artifact_folder}/spec.json'
                ]
            }
        }
    },
    gate_blocking_rules: {
        block_on_missing_artifacts: true
    }
});
// Same state as TC-GB-V01 but with '04-design' phase
// Do NOT create any variant file
```

**Expected Results**:
```javascript
const output = JSON.parse(result.stdout);
assert.equal(output.continue, false);
assert.ok(output.stopReason.includes('spec.yaml'), 'Should mention first variant');
assert.ok(output.stopReason.includes('spec.md'), 'Should mention second variant');
assert.ok(output.stopReason.includes('spec.json'), 'Should mention third variant');
```

---

## Part B: Bug 0.10 -- State-Write-Validator Version Lock Bypass

### Test File: `state-write-validator.test.cjs`
### Within Describe Block: `'BUG-0009: Version Check (V7)'`

All tests use the file's own `setupTestEnv()`, `writeStateFile()`, `runHook()`, and `makeWriteStdinWithContent()` helpers.

---

### TC-SWV-01 (New): Unversioned incoming BLOCKED when disk is versioned

**Requirement**: AC-2.1, FR-4
**Priority**: P0
**Replaces**: T19 (which currently expects ALLOW -- buggy behavior)

**Setup**:
```javascript
const statePath = writeStateFile(tmpDir, {
    state_version: 5,
    phases: {}
});
const incomingState = {
    phases: {}
    // No state_version field
};
```

**Input**:
```javascript
makeWriteStdinWithContent(statePath, incomingState)
```

**Expected Results**:
```javascript
assert.equal(result.exitCode, 0);
assert.ok(
    result.stdout.includes('"continue":false') || result.stdout.includes('"continue": false'),
    'Should block unversioned write against versioned disk'
);
assert.ok(
    result.stdout.includes('state_version') || result.stdout.includes('version'),
    'Block message should mention version requirement'
);
```

---

### TC-SWV-02 (New): Unversioned incoming ALLOWED when disk is unversioned

**Requirement**: AC-2.2, FR-5
**Priority**: P0

**Setup**:
```javascript
const statePath = writeStateFile(tmpDir, {
    phases: { '01-requirements': { status: 'pending' } }
    // No state_version field on disk
});
const incomingState = {
    phases: { '01-requirements': { status: 'in_progress' } }
    // No state_version field
};
```

**Expected Results**:
```javascript
assert.equal(result.exitCode, 0);
assert.equal(result.stdout, '', 'Should allow when both lack version (legacy)');
```

**Note**: This is equivalent to existing T28. Both T28 and this new test should pass.

---

### TC-SWV-03 (New): Unversioned incoming ALLOWED when no disk file

**Requirement**: AC-2.3, FR-5
**Priority**: P0

**Setup**:
```javascript
const statePath = path.join(tmpDir, '.isdlc', 'state.json');
// Remove disk file
if (fs.existsSync(statePath)) {
    fs.unlinkSync(statePath);
}
const incomingState = {
    phases: {}
    // No state_version field
};
```

**Expected Results**:
```javascript
assert.equal(result.exitCode, 0);
assert.equal(result.stdout, '', 'Should allow when no disk file exists (first write)');
```

---

### TC-SWV-06 (New): Block message is actionable

**Requirement**: AC-2.6, NFR-2
**Priority**: P1

**Setup**:
```javascript
const statePath = writeStateFile(tmpDir, {
    state_version: 10,
    phases: {}
});
const incomingState = {
    phases: {}
    // No state_version field
};
```

**Expected Results**:
```javascript
assert.equal(result.exitCode, 0);
assert.ok(
    result.stdout.includes('"continue":false') || result.stdout.includes('"continue": false'),
    'Should block'
);
// Message should be actionable -- includes disk version and instructions
assert.ok(result.stdout.includes('10'),
    'Block message should include disk version number');
assert.ok(
    result.stdout.includes('state_version') && result.stdout.includes('Include'),
    'Block message should instruct to include state_version'
);
```

---

### TC-SWV-07 (New): Null incoming state_version BLOCKED when disk versioned

**Requirement**: AC-2.1
**Priority**: P0
**Replaces**: T20 (which currently expects ALLOW -- buggy behavior)

**Setup**:
```javascript
const statePath = writeStateFile(tmpDir, {
    state_version: 5,
    phases: {}
});
const incomingState = {
    state_version: null,
    phases: {}
};
```

**Expected Results**:
```javascript
assert.equal(result.exitCode, 0);
assert.ok(
    result.stdout.includes('"continue":false') || result.stdout.includes('"continue": false'),
    'Should block null incoming version against versioned disk'
);
```

---

### TC-SWV-08 (New): Fail-open on disk read error during unversioned check

**Requirement**: NFR-1
**Priority**: P2

**Setup**:
```javascript
// Write corrupt JSON to state.json
const statePath = path.join(tmpDir, '.isdlc', 'state.json');
fs.writeFileSync(statePath, 'THIS IS NOT JSON {{{', 'utf8');
const incomingState = {
    phases: {}
    // No state_version
};
```

**Expected Results**:
```javascript
assert.equal(result.exitCode, 0);
// Should fail-open when disk cannot be parsed
assert.ok(
    !result.stdout.includes('"continue":false') && !result.stdout.includes('"continue": false'),
    'Should fail-open on corrupt disk file'
);
```

---

### T19 Update: Unversioned incoming BLOCKED (was: ALLOWED)

**Requirement**: AC-2.1 (corrects buggy test expectation)
**Priority**: P0

**Current Test** (line 344-355):
```javascript
it('T19: allows write when incoming state_version is missing', () => {
    // Disk: state_version: 5
    // Incoming: no state_version
    assert.equal(result.stdout, '', 'Should allow when incoming version missing');
});
```

**Updated Test**:
```javascript
it('T19: blocks write when incoming state_version is missing but disk is versioned', () => {
    // Disk: state_version: 5
    // Incoming: no state_version
    assert.ok(
        result.stdout.includes('"continue":false') || result.stdout.includes('"continue": false'),
        'Should BLOCK when incoming version missing but disk is versioned'
    );
});
```

---

### T20 Update: Null incoming BLOCKED (was: ALLOWED)

**Requirement**: AC-2.1 (corrects buggy test expectation)
**Priority**: P0

**Current Test** (line 358-370):
```javascript
it('T20: allows write when incoming state_version is null', () => {
    // Disk: state_version: 5
    // Incoming: state_version: null
    assert.equal(result.stdout, '', 'Should allow when incoming version is null');
});
```

**Updated Test**:
```javascript
it('T20: blocks write when incoming state_version is null but disk is versioned', () => {
    // Disk: state_version: 5
    // Incoming: state_version: null
    assert.ok(
        result.stdout.includes('"continue":false') || result.stdout.includes('"continue": false'),
        'Should BLOCK when incoming version null but disk is versioned'
    );
});
```

---

## Part C: Existing Test Regression Validation

The following existing tests MUST continue to pass unchanged:

### Gate-Blocker (38 existing tests -- all pass)
- Tests 1-6: Gate advancement detection
- Tests 7-13: Requirement checks
- Tests 14-18: Fail-open and edge cases
- Tests 19-25: Edge cases, escalations, keywords
- TC-GB-D01 through TC-GB-D06: Delegation guard
- Phase key normalization (2 tests)
- Cross-reference delegation (2 tests)
- Self-healing notification (1 test)
- BUG-0005 fallback branch (3 tests)
- REQ-0013 supervised mode (8 tests)

### State-Write-Validator (67 existing tests minus T19/T20 updates = 65 unchanged)
- T1-T15: Content validation (V1-V3)
- T16-T18: V7 stale version blocking
- T21-T31: V7 migration, fail-open, boundary cases
- T32-T67: V8 phase field protection

---

## Summary Matrix

| Test ID | Bug | AC | Priority | Status |
|---------|-----|-----|----------|--------|
| TC-GB-V01 | 0.9 | AC-1.1, FR-1, FR-2, FR-3 | P0 | New |
| TC-GB-V02 | 0.9 | AC-1.2 | P0 | New |
| TC-GB-V03 | 0.9 | AC-1.3 | P1 | New |
| TC-GB-V04 | 0.9 | AC-1.4, FR-2 | P1 | New |
| TC-GB-V05 | 0.9 | AC-1.5 | P1 | New |
| TC-GB-V06 | 0.9 | AC-1.6 | P0 | Implicit (regression run) |
| TC-GB-V07 | 0.9 | AC-1.1 | P2 | New |
| TC-SWV-01 | 0.10 | AC-2.1, FR-4 | P0 | New (replaces T19 intent) |
| TC-SWV-02 | 0.10 | AC-2.2, FR-5 | P0 | New |
| TC-SWV-03 | 0.10 | AC-2.3, FR-5 | P0 | New |
| TC-SWV-06 | 0.10 | AC-2.6, NFR-2 | P1 | New |
| TC-SWV-07 | 0.10 | AC-2.1 | P0 | New (replaces T20 intent) |
| TC-SWV-08 | 0.10 | NFR-1 | P2 | New |
| T19 | 0.10 | AC-2.1 | P0 | Updated (ALLOW -> BLOCK) |
| T20 | 0.10 | AC-2.1 | P0 | Updated (ALLOW -> BLOCK) |
