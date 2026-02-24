# Test Strategy: REQ-0005 — Workflow Progress Snapshots

**Version**: 1.0.0
**Date**: 2026-02-09
**Author**: Test Design Engineer (Agent 05)
**Phase**: 05-test-strategy

---

## 1. Test Scope

### 1.1 System Under Test (SUT)

The `collectPhaseSnapshots(state)` function to be added to `src/claude/hooks/lib/common.cjs`. This is a pure function that reads pre-prune state data and returns `{ phase_snapshots, metrics }`.

### 1.2 Test Boundaries

**In scope:**
- `collectPhaseSnapshots()` function — all inputs, outputs, edge cases
- Internal helper functions: `computeDuration()`, `extractSummary()`, `extractTestIterations()`, `computeMetrics()`
- Integration with existing pruning functions (ordering verification)
- Backward compatibility with entries that lack snapshots

**Out of scope:**
- Orchestrator agent (.md) changes (behavioral, not unit-testable)
- Git merge commit SHA extraction (orchestrator responsibility)
- Hook behavior changes (none expected per requirements)

### 1.3 Test Location

All tests appended to: `src/claude/hooks/tests/test-common.test.cjs`

Test framework: Node.js built-in `node:test` + `node:assert/strict` (CJS)

---

## 2. Test Architecture

### 2.1 Test Organization

```
describe('collectPhaseSnapshots()')
  describe('Guard clauses and empty inputs')     — AC-12
  describe('Phase snapshot structure')            — AC-1, AC-2
  describe('Phase ordering')                      — ADR-002
  describe('Duration computation')                — AC-13
  describe('Summary extraction')                  — AC-15, AC-21, AC-22, AC-23
  describe('Test iterations extraction')          — AC-3, AC-14, ADR-004
  describe('Artifacts handling')                  — ADR-007
  describe('Cancelled workflow snapshots')        — AC-4, AC-17
  describe('Workflow ID generation')              — AC-19, AC-20, ADR-006
  describe('Merged commit handling')              — AC-16, AC-17, AC-18
  describe('Metrics computation')                 — AC-5 through AC-10
  describe('Size budget validation')              — NFR-1
  describe('Backward compatibility')              — AC-24, AC-25, AC-26, NFR-4
```

### 2.2 Test Data Strategy

All tests use in-memory state objects — no filesystem reads. The `collectPhaseSnapshots()` function receives a `state` parameter directly. This enables:
- Fast test execution (no I/O)
- Deterministic results (no state file corruption)
- Easy construction of edge-case scenarios

### 2.3 Helper Functions

```javascript
// Factory: create a complete state with active workflow and phases
function makeWorkflowState(overrides)

// Factory: create a single phase entry with all fields
function makePhase(status, options)

// Factory: create a history entry with agent/timestamp
function makeHistoryEntry(agent, timestamp, action)
```

---

## 3. Acceptance Criteria Coverage Matrix

| AC | Requirement | Test Case(s) | Category |
|----|-------------|-------------|----------|
| AC-1 | Every workflow_history entry includes phase_snapshots array | T01, T02 | Structure |
| AC-2 | Each snapshot has: key, status, started, completed, gate_passed, duration_minutes, artifacts | T03, T04 | Structure |
| AC-3 | Test phases include test_iterations: { count, result, escalated } | T13, T14, T15 | Iterations |
| AC-4 | Cancelled workflows include snapshots for started phases | T19, T20 | Cancellation |
| AC-5 | metrics.total_phases equals workflow phase count | T24 | Metrics |
| AC-6 | metrics.phases_completed equals completed phase count | T25 | Metrics |
| AC-7 | metrics.total_duration_minutes from started_at to completed_at | T26, T27 | Metrics |
| AC-8 | metrics.test_iterations_total sums all iteration counts | T28 | Metrics |
| AC-9 | metrics.gates_passed_first_try counts no-iteration phases | T29 | Metrics |
| AC-10 | metrics.gates_required_iteration counts iterated phases | T30 | Metrics |
| AC-11 | Function exported from common.cjs | T01 | Export |
| AC-12 | Handles missing/null fields gracefully | T05, T06, T07, T08 | Guards |
| AC-13 | duration_minutes from timestamps, rounded to nearest int | T09, T10, T11, T12 | Duration |
| AC-14 | test_iterations from iteration_requirements.test_iteration | T13, T14 | Iterations |
| AC-15 | summary from history[] fallback, truncated to 150 chars | T17, T18 | Summary |
| AC-16 | merged_commit populated (orchestrator responsibility; tested via structure) | T21 | Merge |
| AC-17 | Cancelled workflows: merged_commit null | T22 | Merge |
| AC-18 | Branchless workflows: merged_commit null | T23 | Merge |
| AC-19 | id from artifact_prefix + zero-padded counter | T31, T32 | ID |
| AC-20 | id present in all workflow types | T33 | ID |
| AC-21 | Orchestrator writes summary to phases[key].summary | T16 | Summary |
| AC-22 | Summary <= 150 characters | T17 | Summary |
| AC-23 | Summary: primary from phases[key].summary, fallback from history[] | T16, T17, T18 | Summary |
| AC-24 | collectPhaseSnapshots called BEFORE pruning | T34 | Ordering |
| AC-25 | Pruned state does NOT need snapshot data | T35 | Ordering |
| AC-26 | Existing pruning behavior unchanged | T36 | Compat |

---

## 4. Test Case Specifications

### 4.1 Guard Clauses and Empty Inputs (AC-12)

**T05: Missing state.active_workflow**
- Input: `{ phases: { '01-requirements': {...} } }` (no active_workflow)
- Expected: `{ phase_snapshots: [], metrics: { total_phases: 0, phases_completed: 0, total_duration_minutes: null, test_iterations_total: 0, gates_passed_first_try: 0, gates_required_iteration: 0 } }`

**T06: Missing state.phases**
- Input: `{ active_workflow: { phases: ['01-requirements'], started_at: '...' } }` (no phases object)
- Expected: `{ phase_snapshots: [], metrics: defaultMetrics }`

**T07: Null state.active_workflow**
- Input: `{ active_workflow: null, phases: {} }`
- Expected: empty snapshots, default metrics

**T08: Empty active_workflow.phases array**
- Input: `{ active_workflow: { phases: [] }, phases: {} }`
- Expected: `phase_snapshots: []`, metrics with `total_phases: 0`

### 4.2 Phase Snapshot Structure (AC-1, AC-2)

**T01: Returns object with phase_snapshots array**
- Input: Complete state with 3-phase feature workflow
- Verify: result has `phase_snapshots` array, length matches workflow phases

**T02: Returns object with metrics object**
- Input: Complete state with 3-phase feature workflow
- Verify: result has `metrics` object with all 6 required fields

**T03: Each snapshot has all required fields**
- Input: State with single completed phase
- Verify: snapshot has `key`, `status`, `started`, `completed`, `gate_passed`, `duration_minutes`

**T04: Snapshot fields have correct types**
- Input: Complete phase with all data
- Verify: `key` is string, `status` is string, timestamps are string|null, `duration_minutes` is number|null

### 4.3 Phase Ordering (ADR-002)

**T09-ordering: Snapshots follow active_workflow.phases order**
- Input: State with phases in non-alphabetical order: `['05-implementation', '01-requirements', '06-testing']`
- state.phases contains entries for all three
- Verify: `phase_snapshots[0].key === '05-implementation'`, `[1].key === '01-requirements'`, `[2].key === '06-testing'`

**T10-ordering: Skips phases not in state.phases**
- Input: `active_workflow.phases = ['01-requirements', '05-implementation', '06-testing']`
- `state.phases` only has `01-requirements` and `06-testing`
- Verify: `phase_snapshots.length === 2` (skips `05-implementation`)

### 4.4 Duration Computation (AC-13)

**T09: Computes duration in minutes rounded to nearest integer**
- Input: Phase with `started: '2026-02-09T10:00:00Z'`, `completed: '2026-02-09T10:03:30Z'` (3.5 min)
- Expected: `duration_minutes: 4` (rounded up from 3.5)

**T10: Returns null when started is missing**
- Input: Phase with `started: null`, `completed: '2026-02-09T10:03:00Z'`
- Expected: `duration_minutes: null`

**T11: Returns null when completed is missing**
- Input: Phase with `started: '2026-02-09T10:00:00Z'`, `completed: null`
- Expected: `duration_minutes: null`

**T12: Returns null for invalid timestamps**
- Input: Phase with `started: 'not-a-date'`, `completed: '2026-02-09T10:03:00Z'`
- Expected: `duration_minutes: null`

**T12b: Returns 0 for same start and end**
- Input: Phase with `started: '2026-02-09T10:00:00Z'`, `completed: '2026-02-09T10:00:00Z'`
- Expected: `duration_minutes: 0`

**T12c: Returns null for negative duration (end before start)**
- Input: Phase with `started: '2026-02-09T10:05:00Z'`, `completed: '2026-02-09T10:00:00Z'`
- Expected: `duration_minutes: null`

### 4.5 Summary Extraction (AC-15, AC-21, AC-22, AC-23)

**T16: Uses phases[key].summary as primary source**
- Input: Phase with `summary: '4 fix requirements, 12 AC'`; history[] has a different summary
- Expected: `summary: '4 fix requirements, 12 AC'`

**T17: Truncates summary to 150 characters**
- Input: Phase with `summary` of 200 characters
- Expected: `summary.length === 150`

**T18: Falls back to history[] when phases[key].summary is absent**
- Input: Phase without `summary`; history[] contains matching agent entry with `action: 'Gate passed with 5 tests'`
- Expected: `summary: 'Gate passed with 5 tests'`

**T18b: Returns null when neither source has data**
- Input: Phase without `summary`; empty history[]
- Expected: `summary: null`

**T18c: History fallback matches by agent and timestamp range**
- Input: Phase `06-implementation` with agent `software-developer`, started at T1, completed at T2
- history[] has multiple entries: one for `software-developer` at T1.5 (in range), one for `requirements-analyst` at T1.5 (wrong agent)
- Expected: summary from the `software-developer` entry

**T18d: History fallback returns last matching entry (reverse scan)**
- Input: Two history entries for same agent in range
- Expected: summary from the later entry

### 4.6 Test Iterations Extraction (AC-3, AC-14, ADR-004)

**T13: Extracts test_iterations from iteration_requirements.test_iteration**
- Input: Phase with `iteration_requirements: { test_iteration: { current_iteration: 2, completed: true, escalated: false } }`
- Expected: `test_iterations: { count: 2, result: 'passed', escalated: false }`

**T14: Accepts `current` field as alternative to `current_iteration`**
- Input: Phase with `iteration_requirements: { test_iteration: { current: 3, completed: true } }`
- Expected: `test_iterations: { count: 3, result: 'passed', escalated: false }`

**T15: Omits test_iterations when no iteration data exists**
- Input: Phase without `iteration_requirements`
- Expected: snapshot does NOT have `test_iterations` key

**T15b: Reports escalated status**
- Input: Phase with `iteration_requirements: { test_iteration: { current_iteration: 5, completed: false, escalated: true } }`
- Expected: `test_iterations: { count: 5, result: 'escalated', escalated: true }`

**T15c: Reports unknown result when neither completed nor escalated**
- Input: Phase with `iteration_requirements: { test_iteration: { current_iteration: 1, completed: false, escalated: false } }`
- Expected: `test_iterations: { count: 1, result: 'unknown', escalated: false }`

**T15d: Omits test_iterations when count is 0 and no completion/escalation**
- Input: Phase with `iteration_requirements: { test_iteration: { current_iteration: 0 } }`
- Expected: snapshot does NOT have `test_iterations` key

### 4.7 Artifacts Handling (ADR-007)

**T37: Includes artifacts array when non-empty**
- Input: Phase with `artifacts: ['file1.md', 'file2.json']`
- Expected: `snapshot.artifacts === ['file1.md', 'file2.json']`

**T38: Omits artifacts when empty array**
- Input: Phase with `artifacts: []`
- Expected: `snapshot.artifacts === undefined` (key omitted)

**T39: Omits artifacts when missing**
- Input: Phase without `artifacts` field
- Expected: `snapshot.artifacts === undefined`

### 4.8 Cancelled Workflow Snapshots (AC-4, AC-17)

**T19: Cancelled workflow includes snapshots for started phases**
- Input: 6-phase workflow, 3 completed, 1 in_progress, 2 pending
- Expected: 4 snapshots (3 completed + 1 in_progress), 2 pending phases have entries with status "pending"

**T20: In-progress phase has null completed timestamp**
- Input: Phase with status 'in_progress', started but not completed
- Expected: `snapshot.completed: null`, `snapshot.gate_passed: null`

### 4.9 Workflow ID Generation (AC-19, AC-20, ADR-006)

**T31: Generates ID from artifact_prefix and counter_used**
- Input: `active_workflow.artifact_prefix: 'REQ'`, `counter_used: 5`
- Expected: ID computation yields `'REQ-0005'`
- Note: collectPhaseSnapshots does not generate the `id` field itself -- that is the orchestrator's job (it reads artifact_prefix + counter_used). Test validates the function handles states that have these fields present.

**T32: Returns null ID when artifact_prefix is missing**
- Input: active_workflow without `artifact_prefix`
- Expected: ID is null (handled by caller)

**T33: Returns null ID for test-run workflows (no prefix)**
- Input: active_workflow with `type: 'test-run'`, no `artifact_prefix`
- Expected: ID is null

### 4.10 Merged Commit Handling (AC-16, AC-17, AC-18)

Note: `merged_commit` is added by the orchestrator, NOT by `collectPhaseSnapshots()`. These tests validate that the function's output is compatible with being merged alongside a `merged_commit` field.

**T21: Output can be merged with merged_commit field**
- Input: Complete workflow state
- Expected: result has no `merged_commit` field (orchestrator adds it)

**T22: Output for cancelled workflows (no merge)**
- Input: Cancelled workflow state
- Expected: result contains snapshots; no merged_commit

**T23: Output for branchless workflows**
- Input: test-run workflow (no git_branch)
- Expected: result contains snapshots; no merged_commit

### 4.11 Metrics Computation (AC-5 through AC-10)

**T24: total_phases equals active_workflow.phases.length (AC-5)**
- Input: 8-phase workflow
- Expected: `metrics.total_phases === 8`

**T25: phases_completed counts completed phases (AC-6)**
- Input: 8 phases, 5 completed, 2 in_progress, 1 pending
- Expected: `metrics.phases_completed === 5`

**T26: total_duration_minutes from workflow timestamps (AC-7)**
- Input: `started_at: '2026-02-09T10:00:00Z'`, `completed_at: '2026-02-09T10:39:00Z'`
- Expected: `metrics.total_duration_minutes === 39`

**T27: total_duration_minutes uses cancelled_at for cancelled workflows**
- Input: `started_at: '2026-02-09T10:00:00Z'`, `cancelled_at: '2026-02-09T10:20:00Z'` (no completed_at)
- Expected: `metrics.total_duration_minutes === 20`

**T27b: total_duration_minutes null when no end timestamp**
- Input: `started_at: '2026-02-09T10:00:00Z'`, no completed_at or cancelled_at
- Expected: `metrics.total_duration_minutes === null`

**T28: test_iterations_total sums all iteration counts (AC-8)**
- Input: 3 phases with test_iterations.count = 2, 1, 3
- Expected: `metrics.test_iterations_total === 6`

**T29: gates_passed_first_try counts no-iteration phases (AC-9)**
- Input: 5 phases with gates, 3 without test_iterations (or count <= 1), 2 with count > 1
- Expected: `metrics.gates_passed_first_try === 3`

**T30: gates_required_iteration counts iterated phases (AC-10)**
- Input: Same as T29
- Expected: `metrics.gates_required_iteration === 2`

### 4.12 Size Budget Validation (NFR-1)

**T40: 8-phase fix workflow snapshot fits within 2KB**
- Input: Realistic 8-phase fix workflow with artifacts and summaries
- Expected: `JSON.stringify({ phase_snapshots, metrics }).length < 2048`

**T41: Minimal workflow with no artifacts or iterations is compact**
- Input: 4-phase workflow, all phases completed, no artifacts, no iterations
- Expected: Size is under 1KB

### 4.13 Backward Compatibility (AC-24, AC-25, AC-26, NFR-4)

**T34: Function reads pre-prune state correctly**
- Input: State with full verbose phase data (iteration_requirements, constitutional_validation, etc.)
- Expected: snapshots are collected from full data; test_iterations extracted from iteration_requirements

**T35: Function output does not depend on post-prune fields**
- Input: State that has been pruned (phases stripped to minimal fields)
- Expected: snapshots still collected (summary may be null, test_iterations may be omitted)

**T36: Existing pruning functions still work after collectPhaseSnapshots call**
- Input: Full state; call collectPhaseSnapshots, then call pruneCompletedPhases
- Expected: pruneCompletedPhases strips verbose fields as before; collectPhaseSnapshots output is unaffected

---

## 5. Test Data Fixtures

### 5.1 Complete Feature Workflow State

```javascript
{
  active_workflow: {
    type: 'feature',
    phases: ['01-requirements', '02-impact-analysis', '03-architecture', '05-test-strategy', '06-implementation', '11-local-testing', '07-testing', '10-cicd', '08-code-review'],
    started_at: '2026-02-09T10:00:00Z',
    completed_at: '2026-02-09T10:39:00Z',
    artifact_prefix: 'REQ',
    counter_used: 5
  },
  phases: { /* per-phase data */ },
  history: [ /* history entries */ ]
}
```

### 5.2 Cancelled Fix Workflow State

```javascript
{
  active_workflow: {
    type: 'fix',
    phases: ['01-requirements', '05-implementation', '11-local-testing', '06-testing', '10-cicd', '07-code-review'],
    started_at: '2026-02-09T10:00:00Z',
    cancelled_at: '2026-02-09T10:20:00Z',
    artifact_prefix: 'BUG',
    counter_used: 6
  },
  phases: {
    '01-requirements': { status: 'completed', ... },
    '05-implementation': { status: 'in_progress', ... },
    '11-local-testing': { status: 'pending', ... },
    ...
  }
}
```

### 5.3 Test-Run Workflow State (Branchless)

```javascript
{
  active_workflow: {
    type: 'test-run',
    phases: ['11-local-testing', '06-testing'],
    started_at: '2026-02-09T10:00:00Z',
    completed_at: '2026-02-09T10:05:00Z'
    // No artifact_prefix, no counter_used, no git_branch
  },
  phases: { ... }
}
```

---

## 6. Constitutional Compliance

| Article | How Tests Comply |
|---------|------------------|
| II (Test-First) | All test cases designed before implementation |
| III (Code Quality) | Tests cover all edge cases, null handling, type validation |
| V (Simplicity) | Tests are straightforward — one assertion per concern |
| VII (Traceability) | Every AC mapped to specific test case(s) in coverage matrix |
| IX (Gate Integrity) | Tests validate function does not affect gate behavior |
| XI (Integration Testing) | Backward compat tests verify interaction with existing pruning |

---

## 7. Test Execution

```bash
# Run all common.cjs tests (includes new collectPhaseSnapshots tests)
node --test src/claude/hooks/tests/test-common.test.cjs

# Run full hook test suite
npm run test:hooks

# Run all tests (ESM + CJS)
npm run test:all
```

---

## 8. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Function receives corrupted state | Medium | Low | Guard clause tests (T05-T08) verify graceful handling |
| Timestamp parsing differences across Node versions | Low | Medium | Tests use ISO-8601 strings only |
| Size budget exceeded for large workflows | Low | Low | Size validation test (T40) with realistic data |
| Test iterations field name inconsistency | Medium | Medium | Tests for both `current_iteration` and `current` (T13, T14) |

---

## 9. Estimated Test Count

| Category | Count |
|----------|-------|
| Guard clauses | 4 |
| Structure | 4 |
| Ordering | 2 |
| Duration | 6 |
| Summary | 6 |
| Test iterations | 6 |
| Artifacts | 3 |
| Cancellation | 2 |
| ID generation | 3 |
| Merged commit | 3 |
| Metrics | 8 |
| Size budget | 2 |
| Backward compat | 3 |
| **Total** | **52** |

Estimated addition to test baseline: 650 + 52 = 702 total tests (exceeds 555 baseline per Article II).
