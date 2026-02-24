# Test Data Plan: REQ-0013 Supervised Mode

**Phase**: 05-test-strategy
**Version**: 1.0.0
**Created**: 2026-02-14

---

## 1. Test Data Generation Approach

All test data is constructed **inline** using `setupTestEnv(stateOverrides)` from `hook-test-utils.cjs`. No external fixture files are needed. This follows the established pattern in all existing CJS hook tests.

For functions tested directly (not via subprocess), state objects are constructed as plain JavaScript objects.

---

## 2. State.json Fixture Categories

### 2.1 Supervised Mode Config Fixtures

```javascript
// Category 1: Fully enabled with default review_phases
const ENABLED_ALL = {
  supervised_mode: {
    enabled: true,
    review_phases: 'all',
    parallel_summary: true,
    auto_advance_timeout: null
  }
};

// Category 2: Enabled with selective review_phases
const ENABLED_SELECTIVE = {
  supervised_mode: {
    enabled: true,
    review_phases: ['03', '04', '06'],
    parallel_summary: true,
    auto_advance_timeout: null
  }
};

// Category 3: Explicitly disabled
const DISABLED = {
  supervised_mode: {
    enabled: false,
    review_phases: 'all',
    parallel_summary: true,
    auto_advance_timeout: null
  }
};

// Category 4: Missing block (no supervised_mode key at all)
const MISSING = {};  // No supervised_mode key

// Category 5: Corrupt configs (various)
const CORRUPT_STRING = { supervised_mode: 'true' };
const CORRUPT_ARRAY = { supervised_mode: [1, 2, 3] };
const CORRUPT_NULL = { supervised_mode: null };
const CORRUPT_ENABLED = { supervised_mode: { enabled: 'true' } };
const CORRUPT_ENABLED_NUMBER = { supervised_mode: { enabled: 1 } };
const CORRUPT_PHASES_NUMBER = { supervised_mode: { enabled: true, review_phases: 42 } };
const CORRUPT_PHASES_MIXED = { supervised_mode: { enabled: true, review_phases: ['03', 'invalid', null, 04] } };
const CORRUPT_PHASES_ALL_INVALID = { supervised_mode: { enabled: true, review_phases: ['abc', 'xyz'] } };
const CORRUPT_SUMMARY_STRING = { supervised_mode: { enabled: true, parallel_summary: 'false' } };
const CORRUPT_TIMEOUT_SET = { supervised_mode: { enabled: true, auto_advance_timeout: 300 } };
```

### 2.2 Phase State Fixtures

```javascript
// Standard completed phase with all fields
const PHASE_COMPLETE = {
  phases: {
    '03-architecture': {
      status: 'completed',
      started: '2026-02-14T10:00:00Z',
      completed: '2026-02-14T10:30:00Z',
      gate_passed: true,
      summary: '4 ADRs, interceptor pattern, state-driven config, redo via reentry, 5 decisions',
      artifacts: [
        'architecture-overview.md',
        'adrs/',
        'database-design.md',
        'security-architecture.md'
      ]
    }
  }
};

// Phase with no artifacts (documentation-only)
const PHASE_NO_ARTIFACTS = {
  phases: {
    '03-architecture': {
      status: 'completed',
      started: '2026-02-14T10:00:00Z',
      completed: '2026-02-14T10:30:00Z',
      artifacts: []
    }
  }
};

// Phase with missing timestamps
const PHASE_NO_TIMESTAMPS = {
  phases: {
    '03-architecture': {
      status: 'completed',
      artifacts: ['arch.md']
    }
  }
};

// Phase with invalid timestamps
const PHASE_INVALID_TIMESTAMPS = {
  phases: {
    '03-architecture': {
      status: 'completed',
      started: 'not-a-date',
      completed: 'also-not-a-date',
      artifacts: ['arch.md']
    }
  }
};

// Missing phase data entirely
const PHASE_MISSING = {
  phases: {}
};
```

### 2.3 Active Workflow Fixtures

```javascript
// Standard active workflow with review capabilities
const ACTIVE_WORKFLOW_STANDARD = {
  active_workflow: {
    type: 'feature',
    description: 'Test feature',
    started_at: '2026-02-14T09:00:00Z',
    phases: ['01-requirements', '02-impact-analysis', '03-architecture', '04-design', '05-test-strategy'],
    current_phase: '03-architecture',
    current_phase_index: 2,
    phase_status: {
      '01-requirements': 'completed',
      '02-impact-analysis': 'completed',
      '03-architecture': 'completed',
      '04-design': 'pending'
    }
  }
};

// Active workflow with supervised_review in progress
const ACTIVE_WORKFLOW_REVIEWING = {
  active_workflow: {
    type: 'feature',
    current_phase: '03-architecture',
    supervised_review: {
      phase: '03-architecture',
      status: 'reviewing',
      paused_at: '2026-02-14T10:30:00Z',
      resumed_at: null,
      redo_count: 0,
      redo_guidance_history: []
    }
  }
};

// Active workflow with review_history
const ACTIVE_WORKFLOW_WITH_HISTORY = {
  active_workflow: {
    type: 'feature',
    review_history: [
      { phase: '01-requirements', action: 'continue', timestamp: '2026-02-14T09:30:00Z' },
      { phase: '02-impact-analysis', action: 'review', paused_at: '2026-02-14T10:00:00Z', resumed_at: '2026-02-14T10:15:00Z', timestamp: '2026-02-14T10:15:00Z' }
    ]
  }
};

// Active workflow at redo circuit breaker limit
const ACTIVE_WORKFLOW_MAX_REDO = {
  active_workflow: {
    type: 'feature',
    current_phase: '03-architecture',
    supervised_review: {
      phase: '03-architecture',
      status: 'gate_presented',
      paused_at: null,
      resumed_at: null,
      redo_count: 3,
      redo_guidance_history: ['first try', 'second try', 'third try']
    }
  }
};
```

---

## 3. Gate-Blocker Test Data

Gate-blocker tests use `setupTestEnv()` for full environment setup plus `prepareHook()` + `runHook()` for subprocess testing.

```javascript
// State for gate-blocker: all requirements satisfied + supervised mode enabled
const GATE_STATE_PASS_SUPERVISED = {
  current_phase: '06-implementation',
  active_workflow: {
    type: 'feature',
    current_phase: '06-implementation',
    phases: ['06-implementation'],
    phase_status: { '06-implementation': 'completed' }
  },
  supervised_mode: {
    enabled: true,
    review_phases: 'all',
    parallel_summary: true,
    auto_advance_timeout: null
  },
  phases: {
    '06-implementation': {
      status: 'completed',
      iteration_requirements: {
        test_iteration: { completed: true, iteration_count: 1 },
        constitutional_validation: { status: 'compliant', completed: true, iterations_used: 1 }
      }
    }
  }
};

// Gate advancement input (Task to orchestrator with keyword)
const GATE_ADVANCE_INPUT = {
  tool_name: 'Task',
  tool_input: {
    prompt: 'Continue to next phase. Gate 06 passed.'
  }
};
```

---

## 4. Boundary Values

| Boundary | Values to Test | Expected Behavior |
|----------|---------------|-------------------|
| `review_phases` empty array | `[]` | Normalized to `"all"` by readSupervisedModeConfig |
| `review_phases` single entry | `["03"]` | Matches only phase 03 |
| `redo_count = 0` | Counter at start | Redo allowed |
| `redo_count = 2` | One below limit | Redo still allowed |
| `redo_count = 3` | At limit | Redo removed from menu |
| `redo_count = 4` | Above limit (corrupt) | Treated as >= 3, redo removed |
| `redo_count = -1` | Negative (corrupt) | Treated as >= 3, redo removed |
| `redo_count = NaN` | Not a number (corrupt) | Treated as >= 3, redo removed |
| `artifacts` empty | `[]` | "No file changes" in summary |
| `artifacts` large | 50 entries | Performance test, < 10s |
| Duration = 0 | `started === completed` | Shows "0m" |
| Duration = null | Missing timestamps | Shows "N/A" |
| Guidance text empty | `""` | Accepted as valid redo guidance |
| Guidance text long | 1000+ chars | Accepted without truncation |
| Phase key unknown | `"99-custom"` | Fallback display name |
| Phase key with numbers | `"16-quality-loop"` | Prefix `"16"` extracted correctly |

---

## 5. Negative Test Data

These data sets are specifically designed to trigger error paths:

| Category | Data | Expected Path |
|----------|------|---------------|
| Null state | `null` passed to any function | Returns defaults/false/null |
| Non-object state | `"string"` or `42` passed as state | Returns defaults |
| Missing active_workflow | `{ supervised_mode: {...} }` | recordReviewAction returns false |
| Circular reference | Object with circular ref | generatePhaseSummary catch-all |
| Read-only filesystem | Write to `/dev/null/reviews/` | generatePhaseSummary returns null |
| Non-git directory | Temp dir without `.git` | Git diff returns null gracefully |

---

## 6. Test Data Lifecycle

1. **Setup**: `setupTestEnv(overrides)` creates temp dir with state.json
2. **Arrange**: Additional state modifications via `writeState()`
3. **Act**: Call function under test
4. **Assert**: Verify return values and state mutations via `readState()`
5. **Cleanup**: `cleanupTestEnv()` removes temp dir

No persistent test data is needed. All fixtures are ephemeral and created/destroyed per test.
