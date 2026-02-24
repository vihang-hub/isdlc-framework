# Test Data Plan: T6 Hook I/O Optimization

**REQ-0020** | Phase 05 - Test Strategy | 2026-02-16

---

## 1. Overview

All test data is generated inline during test setup. No external data files or databases are needed. The test helpers (`setupTestEnv()`, `writeState()`, `writeConfig()`) create isolated temp directories with controlled filesystem state.

---

## 2. Config File Fixtures (FR-001)

### 2.1 Valid Manifest (skills-manifest.json)

Used by: TC-001a-01..04, TC-001b-01..02, TC-001c-01, TC-001e-01, TC-NFR001-01

**Source**: Copied from `src/claude/hooks/config/skills-manifest.json` by `setupTestEnv()`.

The test relies on the real config file structure (same as production). No synthetic manifest needed for basic cache tests.

### 2.2 Modified Manifest (mtime invalidation test)

Used by: TC-001b-01

```javascript
// After first load, modify the file to trigger cache invalidation
const modifiedManifest = {
  version: '99.0.0',      // Changed from real version
  skill_lookup: { 'test-skill': '04-test-strategy' },
  ownership: { 'test-agent': { phase: '04-test-strategy' } }
};
fs.writeFileSync(manifestPath, JSON.stringify(modifiedManifest, null, 2));
```

### 2.3 Missing Config (error handling test)

Used by: TC-001d-01, TC-001d-02

```javascript
// Delete the manifest file to test missing-file behavior
fs.unlinkSync(path.join(testDir, '.claude', 'hooks', 'config', 'skills-manifest.json'));
```

### 2.4 Corrupt Config (invalid JSON test)

Used by: TC-001d-03

```javascript
// Write invalid JSON to test parse-error handling
fs.writeFileSync(manifestPath, '{invalid json content not parseable}');
```

### 2.5 Monorepo Config (two project roots)

Used by: TC-001e-01

```javascript
// Create two separate temp dirs with different manifests
const projectA = fs.mkdtempSync(path.join(os.tmpdir(), 'project-a-'));
const projectB = fs.mkdtempSync(path.join(os.tmpdir(), 'project-b-'));

// ProjectA manifest
fs.mkdirSync(path.join(projectA, '.isdlc'), { recursive: true });
fs.mkdirSync(path.join(projectA, '.claude', 'hooks', 'config'), { recursive: true });
fs.writeFileSync(
  path.join(projectA, '.claude', 'hooks', 'config', 'skills-manifest.json'),
  JSON.stringify({ version: 'A', skill_lookup: { a: 'phase-a' } })
);

// ProjectB manifest (different content)
fs.mkdirSync(path.join(projectB, '.isdlc'), { recursive: true });
fs.mkdirSync(path.join(projectB, '.claude', 'hooks', 'config'), { recursive: true });
fs.writeFileSync(
  path.join(projectB, '.claude', 'hooks', 'config', 'skills-manifest.json'),
  JSON.stringify({ version: 'B', skill_lookup: { b: 'phase-b' } })
);
```

### 2.6 Iteration Requirements Config

Used by: TC-001a-03, TC-004d-01..02

```javascript
// Written by setupTestEnv() from real config, or custom:
const iterReq = {
  version: '2.0.0',
  phase_requirements: {
    '06-implementation': {
      test_iteration: { enabled: true, max_iterations: 10, circuit_breaker_threshold: 3 },
      constitutional_validation: { enabled: true, max_iterations: 5 },
      agent_delegation_validation: { enabled: true }
    }
  },
  gate_blocking_rules: {
    block_on_incomplete_test_iteration: true,
    block_on_incomplete_constitutional: true,
    block_on_missing_agent_delegation: true
  }
};
```

### 2.7 Workflows Config

Used by: TC-001a-04

```javascript
const workflows = {
  version: '1.0.0',
  workflows: {
    feature: {
      phases: ['01-requirements', '02-impact-analysis', '03-architecture']
    }
  }
};
fs.writeFileSync(workflowsPath, JSON.stringify(workflows, null, 2));
```

---

## 3. State File Fixtures (FR-003)

### 3.1 Minimal Valid State (V7/V8 pass)

Used by: TC-003a-01, TC-003b-01

```javascript
const validState = {
  state_version: 5,
  active_workflow: {
    current_phase: '06-implementation',
    current_phase_index: 3,
    phase_status: {
      '06-implementation': 'in_progress'
    }
  },
  phases: {
    '06-implementation': {
      constitutional_validation: { completed: true, iterations_used: 2 }
    }
  }
};
```

### 3.2 Version Mismatch State (V7 blocks)

Used by: TC-003a-02, TC-NFR003-01

```javascript
// Disk state
const diskState = { state_version: 10, phases: {} };

// Incoming write (version too old)
const incomingWrite = {
  tool_name: 'Write',
  tool_input: {
    file_path: statePath,
    content: JSON.stringify({ state_version: 5, phases: {} })
  }
};
```

### 3.3 Phase Index Regression State (V8 blocks)

Used by: TC-003b-02, TC-NFR003-02

```javascript
// Disk state
const diskState = {
  state_version: 5,
  active_workflow: {
    current_phase_index: 5,
    phase_status: { '06-implementation': 'in_progress' }
  },
  phases: {}
};

// Incoming write (phase index regresses)
const incomingWrite = {
  tool_name: 'Write',
  tool_input: {
    file_path: statePath,
    content: JSON.stringify({
      state_version: 5,
      active_workflow: {
        current_phase_index: 2,    // Regression from 5 to 2
        phase_status: { '06-implementation': 'in_progress' }
      },
      phases: {}
    })
  }
};
```

### 3.4 No State File on Disk (fail-open)

Used by: TC-003d-01

```javascript
// Do NOT create state.json in the temp dir
// The state file path will point to a non-existent file
const statePath = path.join(tmpDir, '.isdlc', 'state.json');
// fs.existsSync(statePath) === false
```

### 3.5 Corrupt State File on Disk

Used by: TC-003d-02

```javascript
const statePath = path.join(tmpDir, '.isdlc', 'state.json');
fs.writeFileSync(statePath, 'not valid json {{{');
```

### 3.6 Valid Incoming Content with Phase Warnings

Used by: TC-003c-02

```javascript
const incomingWrite = {
  tool_name: 'Write',
  tool_input: {
    file_path: statePath,
    content: JSON.stringify({
      state_version: 5,
      phases: {
        '06-implementation': {
          // constitutional_validation present but not completed
          constitutional_validation: { completed: false, iterations_used: 0 }
        }
      }
    })
  }
};
```

---

## 4. Gate-Blocker Fixtures (FR-004)

### 4.1 Gate Advancement Input

Used by: TC-004c-01..02

```javascript
const gateAdvanceInput = {
  tool_name: 'Task',
  tool_input: {
    description: 'Continue to Phase 08 - Code Review',
    command: 'continue'
  }
};
```

### 4.2 State with Delegation Data

Used by: TC-004a-02

```javascript
const stateWithDelegation = {
  state_version: 1,
  active_workflow: {
    current_phase: '06-implementation',
    current_phase_index: 3,
    phases: ['06-implementation'],
    phase_status: { '06-implementation': 'in_progress' }
  },
  phases: {
    '06-implementation': {
      agent_delegations: ['06-software-developer'],
      test_iteration: { current: 5, circuit_breaker: 0 },
      constitutional_validation: { completed: true, iterations_used: 2 }
    }
  },
  skill_usage_log: []
};
```

### 4.3 Manifest with Ownership Data

Used by: TC-004a-01..02

```javascript
const testManifest = {
  version: '5.0.0',
  ownership: {
    '06-software-developer': { phase: '06-implementation' },
    '04-test-design-engineer': { phase: '05-test-strategy' }
  },
  skill_lookup: {
    'implementation': '06-software-developer'
  }
};
```

---

## 5. Dispatcher Fixtures (FR-005)

### 5.1 Pre-Task Dispatcher Input (state-modifying hooks)

Used by: TC-005a-01, TC-005b-01

```javascript
const preTaskInput = {
  tool_name: 'Task',
  tool_input: {
    description: 'Implement feature X',
    command: 'create'
  }
};
```

### 5.2 State for Batch Write Verification

Used by: TC-005a-01..03, TC-005d-01

```javascript
const stateForBatchWrite = {
  state_version: 1,
  current_phase: '06-implementation',
  active_workflow: {
    current_phase: '06-implementation',
    current_phase_index: 3,
    phases: ['06-implementation'],
    phase_status: { '06-implementation': 'in_progress' }
  },
  phases: {
    '06-implementation': {
      test_iteration: { current: 0, circuit_breaker: 0 },
      constitutional_validation: { completed: false }
    }
  },
  skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow' },
  iteration_enforcement: { enabled: true },
  skill_usage_log: []
};
```

---

## 6. Environment Variables

| Variable | Purpose | Used In |
|----------|---------|---------|
| `CLAUDE_PROJECT_DIR` | Points hooks at temp dir | All tests |
| `NODE_ENV=test` | Enables test-only exports (`_resetCaches`, `_getCacheStats`) | FR-001, FR-002 tests |
| `ISDLC_TEST_MODE=1` | Alternative test mode flag | FR-001, FR-002 tests |
| `SKILL_VALIDATOR_DEBUG=true` | Enables debug logging to stderr | TC-NFR004-01 |

---

## 7. Data Generation Strategy

All test data is:
1. **Inline**: Created in `before()` / `beforeEach()` hooks using helper functions
2. **Isolated**: Each test block gets its own temp directory
3. **Deterministic**: No random data, no timestamps that could cause flakes
4. **Minimal**: Only the fields needed for the specific test case are populated
5. **Disposable**: Temp directories cleaned up in `after()` / `afterEach()`

No shared fixtures across test files. Each test file is self-contained.
