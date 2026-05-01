# Test Strategy: Populate skill_usage_log

**ID**: REQ-GH-278
**Phase**: 05-test-strategy
**Date**: 2026-04-29

---

## Existing Infrastructure

- **Test runner**: `node:test` (built-in)
- **Hook tests**: `src/claude/hooks/tests/` (CJS pattern, `.test.cjs`)
- **Hook test utils**: `src/claude/hooks/tests/hook-test-utils.cjs` (setupTestEnv, prepareHook, prepareDispatcher, runHook, runDispatcher, readState, writeState)
- **Dashboard tests**: `tests/core/dashboard/server.test.js` (ESM, 48 tests from GH-258)
- **Existing skill logging tests**: `src/claude/hooks/tests/test-log-skill-usage.test.cjs` (14 tests covering PostToolUse[Task] logging)
- **Existing dispatcher tests**: `src/claude/hooks/tests/test-pre-skill-dispatcher.test.cjs`, `test-post-task-dispatcher.test.cjs` (pattern for dispatcher integration tests)

**Approach**: Extend existing test suites. Follow established patterns exactly.

---

## Scope Analysis

### Testable via Automated Tests

| FR | What to Test | Test Type | Test File |
|----|-------------|-----------|-----------|
| FR-001 | PostToolUse[Skill] dispatcher extracts skill_name from tool_input.skill, appends to skill_usage_log with source:"tool_call" | Unit (hook process) | `tests/core/hooks/post-skill-dispatcher.test.cjs` |
| FR-006 | /api/state response includes skill_usage_log field | Integration (HTTP) | `tests/core/dashboard/server.test.js` |
| NFR-001 | Dispatcher fails open on missing state, bad JSON, empty stdin | Unit (hook process) | `tests/core/hooks/post-skill-dispatcher.test.cjs` |

### Not Testable via Automated Unit Tests (Specification Changes)

| FR | Reason | Verification Method |
|----|--------|-------------------|
| FR-002 | Agent instruction added to isdlc.md — text in a markdown file | Manual review / grep for instruction string |
| FR-003 | Inference logic lives in isdlc.md phase-loop prose — not executable code | Manual review; downstream effect observable via skill_usage_log entries with source:"inferred" |
| FR-004 | updateAnalysisIndex call added to add handler path in isdlc.md — the call site is in a markdown command spec | Manual review; integration observable via analysis-index.json updates |
| FR-005 | Heartbeat update at step 7b in isdlc.md — markdown instruction | Manual review; effect observable via last_activity_at in analysis-index.json |
| FR-006 (dashboard HTML) | CSS/visual treatments for three skill states — browser rendering | Manual visual inspection |
| FR-007 | Auto-launch logic in isdlc.md — markdown instruction, not testable code | Manual review; spawn/probe behavior observable in real workflow |

### Integration Test Candidates (FR-004 code path)

| FR | What to Test | Test Type | Test File |
|----|-------------|-----------|-----------|
| FR-004 | item-state.js already imports and calls updateAnalysisIndex — verify add handler path triggers it | Integration | Out of scope for this build (updateAnalysisIndex is already tested in GH-277; the isdlc.md call site is a spec change) |

---

## Test Plan

### 1. Post-Skill Dispatcher Tests

**File**: `tests/core/hooks/post-skill-dispatcher.test.cjs`
**Pattern**: CJS, uses `hook-test-utils.cjs` (prepareDispatcher, runDispatcher, readState, writeState)
**Run**: `node --test tests/core/hooks/post-skill-dispatcher.test.cjs`

The new `post-skill-dispatcher.cjs` handles PostToolUse[Skill] events. It must:
- Read tool_input.skill to extract the skill name
- Read agent context from state (current delegated agent or infer from active_workflow)
- Read current phase from active_workflow.current_phase (with fallback)
- Append a log entry with source:"tool_call" to skill_usage_log
- Fail open on any error

#### Test Cases

| ID | Test Case | FR | Type | Priority |
|----|-----------|-----|------|----------|
| PSD-01 | Logs Skill tool call with correct skill_name, agent, phase, timestamp, source:"tool_call" | FR-001 | Positive | P0 |
| PSD-02 | Extracts skill name from tool_input.skill field | FR-001 | Positive | P0 |
| PSD-03 | Does not log non-Skill tool calls (tool_name != "Skill") | FR-001 | Negative | P0 |
| PSD-04 | Fails open (exit 0, no stdout) when state.json is missing | NFR-001 | Negative | P0 |
| PSD-05 | Fails open on empty stdin | NFR-001 | Negative | P0 |
| PSD-06 | Fails open on malformed JSON stdin | NFR-001 | Negative | P1 |
| PSD-07 | Fails open when tool_input is missing | NFR-001 | Negative | P1 |
| PSD-08 | Fails open when tool_input.skill is missing | NFR-001 | Negative | P1 |
| PSD-09 | Accumulates multiple Skill call entries in skill_usage_log | FR-001 | Positive | P1 |
| PSD-10 | Uses active_workflow.current_phase over stale top-level current_phase | FR-001 | Positive | P1 |
| PSD-11 | Falls back to top-level current_phase when no active_workflow | FR-001 | Positive | P2 |
| PSD-12 | Records timestamp in ISO 8601 format | FR-001 | Positive | P2 |
| PSD-13 | Does not log when skill_enforcement.enabled is false | FR-001 | Negative | P1 |
| PSD-14 | Includes args field from tool_input if present | FR-001 | Positive | P2 |

#### Test Data

**Valid Skill tool input**:
```json
{
  "tool_name": "Skill",
  "tool_input": { "skill": "unit-testing", "args": "--verbose" },
  "tool_result": "Skill invoked successfully"
}
```

**State with active workflow**:
```json
{
  "active_workflow": {
    "type": "feature",
    "current_phase": "06-implementation",
    "phases": ["05-test-strategy", "06-implementation"],
    "sub_agent_log": [{ "agent": "software-developer", "phase": "06-implementation" }]
  },
  "skill_enforcement": { "enabled": true, "mode": "observe" },
  "skill_usage_log": []
}
```

**Boundary/Invalid inputs**:
- Empty string stdin
- `{}` (no tool_name)
- `{ "tool_name": "Skill" }` (no tool_input)
- `{ "tool_name": "Skill", "tool_input": {} }` (no skill field)
- `{ "tool_name": "Read", "tool_input": { "file_path": "/x" } }` (wrong tool)

### 2. Dashboard Server Tests (skill_usage_log in API)

**File**: `tests/core/dashboard/server.test.js` (extend existing)
**Pattern**: ESM, uses `startDashboardServer({ stateJsonPath, port: 0 })`, fetch-based assertions
**Run**: `node --test tests/core/dashboard/server.test.js`

New tests validate that /api/state includes skill_usage_log data.

#### Test Cases

| ID | Test Case | FR | Type | Priority |
|----|-----------|-----|------|----------|
| DS-SKL-01 | /api/state response includes skill_usage_log array | FR-006 | Positive | P0 |
| DS-SKL-02 | skill_usage_log entries have skill_name, source, agent, phase, timestamp fields | FR-006 | Positive | P0 |
| DS-SKL-03 | /api/state returns empty skill_usage_log when no skills have been invoked | FR-006 | Positive | P1 |
| DS-SKL-04 | skill_usage_log correctly returns entries with source:"tool_call" | FR-006 | Positive | P1 |
| DS-SKL-05 | skill_usage_log correctly returns entries with source:"inferred" | FR-006 | Positive | P1 |

#### Test Data

State fixture extending `makeStateWithWorkflow()`:
```json
{
  "skill_usage_log": [
    { "skill_name": "unit-testing", "agent": "software-developer", "phase": "06-implementation", "timestamp": "2026-04-29T10:00:00Z", "source": "tool_call" },
    { "skill_name": "error-handling", "agent": "software-developer", "phase": "06-implementation", "timestamp": "2026-04-29T10:01:00Z", "source": "inferred" }
  ]
}
```

---

## Test Execution

### Commands

```bash
# Post-skill dispatcher tests (CJS)
node --test tests/core/hooks/post-skill-dispatcher.test.cjs

# Dashboard server tests (ESM)
node --test tests/core/dashboard/server.test.js

# All hook tests
node --test src/claude/hooks/tests/*.test.cjs

# Full test suite
node --test --test-reporter=spec tests/
```

### Expected Test Count

| Suite | New Tests | Existing Tests | Total |
|-------|-----------|----------------|-------|
| post-skill-dispatcher.test.cjs | 14 | 0 (new file) | 14 |
| server.test.js | 5 | 48 | 53 |
| **Total** | **19** | **48** | **67** |

---

## Coverage Targets

- **Post-skill dispatcher**: All code paths (happy path, missing fields, fail-open) covered by PSD-01 through PSD-14
- **Dashboard API**: skill_usage_log field presence and shape validated by DS-SKL-01 through DS-SKL-05
- **Fail-open guarantee**: Every error path (missing state, bad JSON, empty stdin, missing fields) must exit 0 with no stdout

---

## NFR Validation

| NFR | Validation Approach |
|-----|-------------------|
| NFR-001 (<50ms, fail-open) | PSD-04 through PSD-08 verify fail-open. Timing is validated by DISPATCHER_TIMING stderr output (already instrumented in dispatcher pattern). |
| NFR-002 (heartbeat latency) | Not testable — isdlc.md instruction. Validated by manual observation during roundtable. |
| NFR-003 (auto-launch non-blocking) | Not testable — isdlc.md instruction. Validated by manual observation during workflow start. |

---

## Task-to-Test Traceability

| Task | File Under Test | Test File | Traces | Scenarios |
|------|----------------|-----------|--------|-----------|
| T002 | src/claude/hooks/dispatchers/post-skill-dispatcher.cjs | tests/core/hooks/post-skill-dispatcher.test.cjs | FR-001, NFR-001 | PSD-01 through PSD-14 |
| T008 | src/dashboard/server.js | tests/core/dashboard/server.test.js | FR-006 | DS-SKL-01 through DS-SKL-05 |
| T003 | .claude/settings.json | (manual verification) | FR-001 | Verify PostToolUse[Skill] matcher wired |
| T004 | src/claude/commands/isdlc.md | (manual verification) | FR-002 | Grep for instruction text |
| T005 | src/claude/commands/isdlc.md | (manual verification) | FR-003 | Grep for inference logic |
| T006 | src/claude/commands/isdlc.md, src/core/backlog/item-state.js | (manual verification) | FR-004 | Verify updateAnalysisIndex call |
| T007 | src/claude/commands/isdlc.md | (manual verification) | FR-005 | Grep for heartbeat instruction |
| T009 | src/dashboard/dashboard.html | (manual verification) | FR-006 | Visual inspection of three states |
| T010 | src/claude/commands/isdlc.md | (manual verification) | FR-007 | Grep for auto-launch probe |

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Dispatcher requires hook lib dependencies not available in test env | Medium | High | Use prepareDispatcher() from hook-test-utils.cjs which copies all hooks + lib/ |
| Post-skill-dispatcher does not exist yet (CREATE) | Certain | Low | Tests written to specification; will pass once implementation matches |
| Dashboard test port conflicts | Low | Medium | Always use `port: 0` for OS-assigned ports |
| Skill tool input shape differs from Task tool input shape | Medium | Medium | Tests validate the exact Skill tool input shape: `{ tool_name: "Skill", tool_input: { skill: "name" } }` |
