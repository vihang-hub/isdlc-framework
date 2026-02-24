# Test Data Plan: BUG-0021-GH-5

**Phase**: 05-test-strategy
**Date**: 2026-02-17

---

## Test Data Generation Strategy

All test data is generated inline within each test using the existing `hook-test-utils.cjs` helpers (`setupTestEnv`, `writeState`, `readState`). No external fixtures files or databases are needed -- this follows the established pattern in all existing hook tests.

---

## Hook Input Data (stdin JSON)

### Skill Invocation Events (for skill-delegation-enforcer tests)

| Fixture ID | tool_name | skill | args | Purpose |
|-----------|-----------|-------|------|---------|
| `exemptAnalyze` | `Skill` | `isdlc` | `'analyze "some feature description"'` | Primary bug reproduction |
| `exemptStatus` | `Skill` | `isdlc` | `'status'` | Exempt action: status |
| `exemptCancel` | `Skill` | `isdlc` | `'cancel'` | Exempt action: cancel |
| `exemptGateCheck` | `Skill` | `isdlc` | `'gate-check'` | Exempt action: gate-check |
| `exemptEscalate` | `Skill` | `isdlc` | `'escalate'` | Exempt action: escalate |
| `exemptConfigureCloud` | `Skill` | `isdlc` | `'configure-cloud aws'` | Exempt action: configure-cloud |
| `nonExemptFeature` | `Skill` | `isdlc` | `'feature "add login"'` | Non-exempt: must enforce |
| `nonExemptFix` | `Skill` | `isdlc` | `'fix "broken auth"'` | Non-exempt: must enforce |
| `nonExemptUpgrade` | `Skill` | `isdlc` | `'upgrade node'` | Non-exempt: must enforce |
| `nonExemptTest` | `Skill` | `isdlc` | `'test run'` | Non-exempt: must enforce |
| `emptyArgs` | `Skill` | `isdlc` | `''` | Edge case: empty args |
| `missingArgs` | `Skill` | `isdlc` | (no args key) | Edge case: missing key |
| `uppercaseAnalyze` | `Skill` | `isdlc` | `'ANALYZE "test"'` | Case variation |

### Stop Events (for delegation-gate tests)

| Fixture ID | hook_event_name | stop_reason | Purpose |
|-----------|----------------|-------------|---------|
| `stopEndTurn` | `Stop` | `end_turn` | Standard Stop event |

---

## State Fixtures (state.json overrides)

### For skill-delegation-enforcer tests

The enforcer tests use the default state from `setupTestEnv()` (which includes `skill_enforcement`, `current_phase`, empty `skill_usage_log`, and `phases`). No special state overrides are needed -- the enforcer reads state to check if it exists, then writes to it.

### For delegation-gate tests

| Fixture ID | pending_delegation | skill_usage_log | active_workflow | Purpose |
|-----------|-------------------|-----------------|----------------|---------|
| `exemptMarkerAnalyze` | `{ skill: 'isdlc', required_agent: 'sdlc-orchestrator', invoked_at: '2026-02-17T00:15:00Z', args: 'analyze "some feature"' }` | `[]` | none | Bug reproduction: exempt marker present |
| `exemptMarkerStatus` | `{ skill: 'isdlc', required_agent: 'sdlc-orchestrator', invoked_at: '2026-02-17T00:15:00Z', args: 'status' }` | `[]` | none | Exempt action: status |
| `exemptMarkerCancel` | `{ skill: 'isdlc', required_agent: 'sdlc-orchestrator', invoked_at: '2026-02-17T00:15:00Z', args: 'cancel' }` | `[]` | none | Exempt action: cancel |
| `staleExemptMarker` | `{ ..., invoked_at: '2026-02-16T12:00:00Z', args: 'analyze "old request"' }` | `[]` | none | Stale marker from prior session |
| `nonExemptMarker` | `{ skill: 'isdlc', required_agent: 'sdlc-orchestrator', invoked_at: '2026-02-17T00:15:00Z', args: 'feature "add login"' }` | `[]` | none | Backward compat: non-exempt |
| `emptyArgsMarker` | `{ ..., args: '' }` | `[]` | none | Edge case: empty args |
| `errorCountExemptMarker` | `{ ..., args: 'analyze "test"' }` + `_delegation_gate_error_count: 3` | `[]` | none | Error counter reset |
| `uppercaseExemptMarker` | `{ ..., args: 'ANALYZE "test"' }` | `[]` | none | Case variation |

---

## Boundary and Edge Cases

| Category | Input | Expected Behavior | Test ID |
|----------|-------|-------------------|---------|
| **Empty args** | `args: ''` | No exempt match -> normal enforcement | TC-SDE-06, TC-DG-05 |
| **Missing args key** | No `args` in `tool_input` | Defaults to `''` -> normal enforcement | TC-SDE-07 |
| **Uppercase action** | `args: 'ANALYZE "test"'` | Case-insensitive -> exempt | TC-SDE-10, TC-DG-08 |
| **Stale marker** | `invoked_at` hours ago | Auto-clear works regardless of staleness | TC-DG-03 |
| **Error count present** | `_delegation_gate_error_count: 3` | Reset to 0 on auto-clear | TC-DG-04 |

---

## Data Flow Summary

```
Test Input (stdin JSON)
    |
    v
Hook Process (spawned via runHook)
    |
    +-> Reads state.json from test temp dir
    +-> Writes to state.json (or skips for exempt)
    +-> Writes to stdout (message or block JSON)
    |
    v
Test Assertions
    +-> Check stdout content
    +-> Check state.json via readState()
    +-> Check exit code
```

All test data is ephemeral -- created in `beforeEach` via `setupTestEnv()` and destroyed in `afterEach` via `cleanupTestEnv()`. No persistent test data is needed.
