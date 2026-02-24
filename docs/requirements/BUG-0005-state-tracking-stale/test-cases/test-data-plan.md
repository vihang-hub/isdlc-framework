# Test Data Plan: BUG-0005

**Bug ID:** BUG-0005-state-tracking-stale
**Created:** 2026-02-12

---

## 1. State.json Fixtures

All fixtures use the `setupTestEnv(stateOverrides)` function from `hook-test-utils.cjs`, which deep-merges overrides into the DEFAULT_STATE. Fixtures are defined inline in test files as JavaScript objects -- no separate fixture files needed for this scope.

### 1.1 Divergent State Fixture

Purpose: Detect when a hook reads from the wrong source by setting `active_workflow.current_phase` and top-level `current_phase` to different values.

```javascript
const DIVERGENT_STATE = {
  current_phase: '05-test-strategy',        // STALE top-level
  active_agent: 'test-design-engineer',      // STALE top-level
  active_workflow: {
    type: 'fix',
    current_phase: '06-implementation',      // CORRECT source
    current_phase_index: 3,
    phases: ['01-requirements', '02-tracing', '05-test-strategy', '06-implementation'],
    phase_status: {
      '01-requirements': 'completed',
      '02-tracing': 'completed',
      '05-test-strategy': 'completed',
      '06-implementation': 'in_progress'
    }
  },
  iteration_enforcement: { enabled: true },
  phases: {
    '05-test-strategy': { status: 'completed' },
    '06-implementation': {
      status: 'in_progress',
      constitutional_validation: { status: 'pending', iterations: 0 },
      iteration_requirements: {
        test_iteration: { status: 'pending', iterations: 0 },
        interactive_elicitation: { status: 'not_required' }
      }
    }
  }
};
```

### 1.2 No-Workflow Fixture

Purpose: Test backward compatibility when `active_workflow` is absent.

```javascript
const NO_WORKFLOW_STATE = {
  current_phase: '06-implementation',
  active_agent: 'software-developer',
  // active_workflow intentionally omitted
  iteration_enforcement: { enabled: true },
  phases: {
    '06-implementation': {
      status: 'in_progress',
      constitutional_validation: { status: 'pending', iterations: 0 }
    }
  }
};
```

### 1.3 Both-Missing Fixture

Purpose: Test fail-open behavior when no phase information is available.

```javascript
const BOTH_MISSING_STATE = {
  // current_phase intentionally omitted
  // active_workflow intentionally omitted
  iteration_enforcement: { enabled: true },
  phases: {}
};
```

### 1.4 Pre-Transition Fixture

Purpose: Simulate the state before STEP 3e runs a phase transition.

```javascript
const PRE_TRANSITION_STATE = {
  current_phase: '02-tracing',
  active_agent: 'trace-analyst',
  active_workflow: {
    type: 'fix',
    current_phase: '02-tracing',
    current_phase_index: 1,
    phases: [
      '01-requirements', '02-tracing', '05-test-strategy',
      '06-implementation', '16-quality-loop', '08-code-review'
    ],
    phase_status: {
      '01-requirements': 'completed',
      '02-tracing': 'in_progress',
      '05-test-strategy': 'pending',
      '06-implementation': 'pending',
      '16-quality-loop': 'pending',
      '08-code-review': 'pending'
    }
  },
  phases: {
    '01-requirements': { status: 'completed' },
    '02-tracing': { status: 'in_progress' }
  }
};
```

### 1.5 Final-Phase Fixture

Purpose: Test behavior when completing the last phase in a workflow.

```javascript
const FINAL_PHASE_STATE = {
  current_phase: '08-code-review',
  active_agent: 'code-reviewer',
  active_workflow: {
    type: 'fix',
    current_phase: '08-code-review',
    current_phase_index: 5,
    phases: [
      '01-requirements', '02-tracing', '05-test-strategy',
      '06-implementation', '16-quality-loop', '08-code-review'
    ],
    phase_status: {
      '01-requirements': 'completed',
      '02-tracing': 'completed',
      '05-test-strategy': 'completed',
      '06-implementation': 'completed',
      '16-quality-loop': 'completed',
      '08-code-review': 'in_progress'
    }
  },
  phases: {
    '08-code-review': { status: 'in_progress' }
  }
};
```

---

## 2. tasks.md Fixtures

### 2.1 Standard tasks.md

```javascript
const TASKS_MD_FIXTURE = `# Task Plan: fix BUG-0005-state-tracking-stale

**Workflow:** fix

---

## Progress Summary

| Phase | Status | Tasks |
|-------|--------|-------|
| Phase 01: Bug Report | COMPLETE | 4/4 |
| Phase 02: Tracing | PENDING | 0/3 |
| Phase 05: Test Strategy | PENDING | 0/3 |
| Phase 06: Implementation | PENDING | 0/8 |
| Phase 16: Quality Loop | PENDING | 0/3 |
| Phase 08: Code Review | PENDING | 0/3 |
| **Total** | **4/24 (17%)** | |

---

## Phase 01: Bug Report -- COMPLETE

- [X] T0001 Identify bug and gather reproduction details
- [X] T0002 Analyze root cause
- [X] T0003 Draft bug report
- [X] T0004 Save bug report artifacts

## Phase 02: Tracing -- PENDING

- [ ] T0005 Trace hook reads
- [ ] T0006 Trace STEP 3e updates
- [ ] T0007 Trace tasks.md lifecycle

## Phase 05: Test Strategy -- PENDING

- [ ] T0008 Design test cases for hooks
- [ ] T0009 Design test cases for state sync
- [ ] T0010 Design test cases for tasks.md

## Phase 06: Implementation -- PENDING

- [ ] T0011 Fix constitution-validator.cjs | traces: AC-03a
- [ ] T0012 Fix delegation-gate.cjs | traces: AC-03b
- [ ] T0013 Fix log-skill-usage.cjs | traces: AC-03c
- [ ] T0014 Fix skill-validator.cjs | traces: AC-03d
- [ ] T0015 Fix gate-blocker.cjs | traces: AC-03e
- [ ] T0016 Fix provider-utils.cjs | traces: AC-03f
- [ ] T0017 Update isdlc.md STEP 3e state sync | traces: AC-01a, AC-01b, AC-02a
- [ ] T0018 Update isdlc.md STEP 3e tasks.md update | traces: AC-04a, AC-04b, AC-04c

## Phase 16: Quality Loop -- PENDING

- [ ] T0019 Run full test suite
- [ ] T0020 Verify hook fixes
- [ ] T0021 Verify STEP 3e changes

## Phase 08: Code Review -- PENDING

- [ ] T0022 Review hook changes
- [ ] T0023 Review STEP 3e changes
- [ ] T0024 Final QA sign-off
`;
```

### 2.2 Expected tasks.md after Phase 02 completion

```javascript
const TASKS_MD_AFTER_PHASE02 = `...
## Phase 02: Tracing -- COMPLETE

- [X] T0005 Trace hook reads
- [X] T0006 Trace STEP 3e updates
- [X] T0007 Trace tasks.md lifecycle
...
| Phase 02: Tracing | COMPLETE | 3/3 |
...
| **Total** | **7/24 (29%)** | |
`;
```

---

## 3. Hook Input Fixtures

### 3.1 Task tool input (for PreToolUse hooks)

```javascript
const TASK_INPUT = {
  tool_name: 'Task',
  tool_input: {
    prompt: 'Continue to the next phase',
    subagent_type: 'software-developer'
  }
};
```

### 3.2 Phase completion Task input (triggers constitution-validator)

```javascript
const COMPLETION_INPUT = {
  tool_name: 'Task',
  tool_input: {
    prompt: 'Phase complete. All artifacts saved. Ready to advance to next phase.',
    subagent_type: 'sdlc-orchestrator'
  }
};
```

### 3.3 Stop hook input (for delegation-gate)

```javascript
const STOP_INPUT = {
  hook_event_name: 'Stop',
  stop_reason: 'end_turn'
};
```

### 3.4 Bash tool input (for test-watcher)

```javascript
const BASH_TEST_INPUT = {
  tool_name: 'Bash',
  tool_input: {
    command: 'npm test'
  },
  tool_result: {
    stdout: 'Tests: 10 passed, 0 failed\nDuration: 2.5s'
  }
};
```

---

## 4. Phase-to-Agent Mapping Data

```javascript
const PHASE_AGENT_MAP = {
  '01-requirements': 'requirements-analyst',
  '02-tracing': 'trace-analyst',
  '03-architecture': 'solution-architect',
  '04-design': 'software-designer',
  '05-test-strategy': 'test-design-engineer',
  '06-implementation': 'software-developer',
  '07-testing': 'quality-assurance-engineer',
  '08-code-review': 'code-reviewer',
  '09-security': 'security-engineer',
  '10-local-testing': 'quality-assurance-engineer',
  '16-quality-loop': 'quality-assurance-engineer',
  '11-deployment': 'release-engineer'
};
```

---

## 5. Data Generation Strategy

All test data is generated **inline** within test files using JavaScript object literals. This follows the existing convention in the hook test suite where fixtures are defined per-test or per-describe block using `setupTestEnv(stateOverrides)` and `writeState()`.

No external fixture files or data generation scripts are needed. The `deepMerge()` utility in `hook-test-utils.cjs` allows building complex state objects from simple overlays.

For tasks.md content, JavaScript template literals are used with the exact markdown format expected by the update logic. The test writes the fixture to the test directory's `docs/isdlc/tasks.md` path using `fs.writeFileSync()`.
