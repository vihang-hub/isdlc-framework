# Architecture Overview: REQ-0005 — Workflow Progress Snapshots

**Version**: 1.0.0
**Date**: 2026-02-09
**Architect**: Solution Architect (Agent 02)
**Phase**: 03-architecture

---

## 1. Executive Summary

This feature adds a single pure function `collectPhaseSnapshots(state)` to `common.cjs` that reads pre-prune state data and returns a compact `{ phase_snapshots, metrics }` object. The orchestrator inserts the return value into the `workflow_history` entry at workflow completion. No new files, no new dependencies, no hook changes.

### Architecture Decision: Pure Function, Not a Side-Effect Writer

The function is a **pure computation** — it reads `state.phases`, `state.active_workflow`, and `state.history`, then returns a data structure. It does NOT mutate `state` or write to disk. The orchestrator is responsible for inserting the returned data into the `workflow_history` entry before writing state.json.

**Rationale**: This matches the existing pattern in `common.cjs` where pruning functions (`pruneSkillUsageLog`, `pruneCompletedPhases`, etc.) take `state` and return the mutated state. However, `collectPhaseSnapshots` differs because its output goes into `workflow_history` (a different location), not back into the same object it reads. Making it a pure function with a return value avoids coupling the function to the workflow_history write logic.

---

## 2. Architecture Decisions

### ADR-001: Function Signature Returns Object, Does Not Mutate State

**Context**: The pruning functions in `common.cjs` mutate the state object in place and return it. Should `collectPhaseSnapshots` follow the same pattern?

**Decision**: `collectPhaseSnapshots(state)` returns `{ phase_snapshots: [...], metrics: {...} }` without mutating `state`.

**Rationale**:
- Pruning functions modify `state.phases`, `state.history`, etc. — the same objects they read. Mutation-in-place is natural.
- `collectPhaseSnapshots` reads `state.phases` but writes to `workflow_history[]` — a different location. Having it mutate `workflow_history` would mean it also needs to know which entry to update, coupling it to workflow management logic.
- A pure return value is easier to test (assert on output, no need to inspect side effects).
- The orchestrator already has the workflow_history entry in hand and can simply spread the returned object into it.

**Consequences**: The orchestrator must explicitly merge the returned `phase_snapshots` and `metrics` into the `workflow_history` entry. This is a 2-line operation in the orchestrator's completion sequence.

---

### ADR-002: Phase Order Derived from active_workflow.phases Array

**Context**: `state.phases` is an unordered object (keys are phase names). What determines the order of snapshots in `phase_snapshots[]`?

**Decision**: Use `state.active_workflow.phases` array as the ordering source. Iterate through this array and look up each phase key in `state.phases`.

**Rationale**:
- `active_workflow.phases` defines the canonical execution order for the workflow.
- `state.phases` may contain stale entries from previous workflows (e.g., `00-quick-scan` from REQ-0001 still exists in state.json alongside REQ-0005's phases).
- Iterating `active_workflow.phases` guarantees: (a) correct order, (b) only workflow-relevant phases, (c) no stale entries.

**Consequences**: If `active_workflow.phases` is missing or empty, `phase_snapshots` will be an empty array. This is the correct degradation behavior (no workflow = no snapshots).

---

### ADR-003: Summary Field — Primary from phases[key].summary, Fallback from history[]

**Context**: Where does the human-readable `summary` string for each phase snapshot come from?

**Decision**: Two-tier resolution:
1. **Primary**: `state.phases[key].summary` — written by the orchestrator at each gate pass (REQ-006).
2. **Fallback**: Scan `state.history[]` for the last entry whose `agent` matches the phase's known agent and whose `timestamp` falls within the phase's `started` to `completed` range. Extract the `action` string and truncate to 150 characters.

**Rationale**:
- `phases[key].summary` is the preferred source — it is a structured, intentional summary written at gate time.
- `history[]` is a fallback for phases that completed before this feature shipped (backward compat) or for edge cases where the summary was not written.
- Matching by agent + timestamp range is more reliable than matching by phase name in the action string, because history entries use free-form text.

**Consequences**:
- The orchestrator MUST write `phases[key].summary` at each gate pass. This is a new responsibility for the orchestrator (REQ-006).
- If both sources are absent, `summary` defaults to `null`. No crash, no synthetic text.

---

### ADR-004: test_iterations Field — Conditional Inclusion

**Context**: Not all phases have test iterations. Only phases with `iteration_requirements.test_iteration` in their phase data have this information.

**Decision**: Include `test_iterations` in the snapshot **only** when `state.phases[key].iteration_requirements.test_iteration` exists and has a truthy `current_iteration` or `current` field.

**Schema**:
```json
{
  "test_iterations": {
    "count": 2,
    "result": "passed",
    "escalated": false
  }
}
```

**Field mapping**:
| Snapshot field | Source field | Default |
|---|---|---|
| `count` | `test_iteration.current_iteration` OR `test_iteration.current` | `0` |
| `result` | `test_iteration.completed === true ? "passed" : "failed"` | `"unknown"` |
| `escalated` | `test_iteration.escalated === true` | `false` |

**Rationale**:
- The existing hooks use both `current_iteration` and `current` (test-watcher uses `current_iteration`, some test fixtures use `current`). Accept both for robustness.
- Omitting `test_iterations` entirely when no iteration data exists keeps snapshots compact and avoids misleading `count: 0` on non-test phases.

**Consequences**: Consumer code must check for `test_iterations` existence before accessing it. The `metrics.test_iterations_total` aggregation skips phases without `test_iterations`.

---

### ADR-005: Metrics Computation — Duration from Workflow Timestamps, Not Phase Sum

**Context**: `metrics.total_duration_minutes` could be computed two ways: (a) sum of all phase `duration_minutes`, or (b) `active_workflow.completed_at - active_workflow.started_at`.

**Decision**: Use workflow-level timestamps: `completed_at - started_at` (option b).

**Rationale**:
- Phase durations may have gaps (time between gate pass and next phase start where the orchestrator is running).
- The sum of phase durations would undercount total wall-clock time.
- Users care about "how long did this workflow take end-to-end," not "how long were agents actively working."
- For cancelled workflows, use `cancelled_at - started_at`.

**Consequences**: `metrics.total_duration_minutes` may be slightly larger than the sum of individual phase `duration_minutes`. This is correct and expected.

---

### ADR-006: Workflow ID Construction — artifact_prefix + Counter

**Context**: How is the `id` field constructed?

**Decision**: `id = artifact_prefix + "-" + zeroPad(counter_used, 4)`

**Examples**:
- Feature: `"REQ-0005"`
- Bug fix: `"BUG-0004"`
- Upgrade: `"UPG-0001"`
- Test-run: `null` (no artifact_prefix for test workflows)

**Rationale**:
- `artifact_prefix` and `counter_used` already exist in `active_workflow` for feature, fix, and upgrade workflows.
- Test-run and test-generate workflows do not have artifact prefixes. Setting `id` to `null` for these is acceptable.
- Zero-padding to 4 digits matches existing convention throughout the framework.

**Consequences**: The function must handle cases where `artifact_prefix` or `counter_used` is missing. Return `null` for `id` in those cases.

---

### ADR-007: Size Budget Compliance — Omit Empty Artifacts Arrays

**Context**: NFR-1 requires snapshot collection to add no more than ~2KB per workflow. The impact analysis estimated 8-phase workflows at ~1.6KB and 11-phase workflows at ~2.2KB.

**Decision**: To stay within budget:
1. Omit `artifacts` array from snapshot when it is empty (save ~15 bytes per entry).
2. Truncate `summary` to 150 characters.
3. Do NOT include any verbose fields (iteration_requirements, constitutional_validation, etc.) in snapshots — only the compact `test_iterations` extraction.

**Rationale**: Most phases in short workflows (fix, test-run) have few or no artifacts. Omitting empty arrays saves ~15 bytes x 6 phases = ~90 bytes, keeping 8-phase workflows well under 2KB.

**Consequences**: Consumer code must handle missing `artifacts` field (default to `[]`).

---

## 3. Function Design

### 3.1 Signature

```javascript
/**
 * Collect phase snapshots and workflow metrics from pre-prune state.
 * Pure function — does not mutate state.
 *
 * @param {Object} state - Full state.json object (pre-prune)
 * @returns {{ phase_snapshots: Array, metrics: Object }}
 */
function collectPhaseSnapshots(state)
```

### 3.2 Return Shape

```javascript
{
  phase_snapshots: [
    {
      key: "01-requirements",         // string — phase key
      status: "completed",            // string — "completed" | "in_progress" | "pending"
      started: "ISO-8601" | null,     // string | null
      completed: "ISO-8601" | null,   // string | null
      gate_passed: "ISO-8601" | null, // string | null
      duration_minutes: 3,            // integer | null — rounded to nearest int
      artifacts: ["file.md"],         // string[] — OMITTED if empty
      summary: "4 requirements...",   // string | null — max 150 chars
      test_iterations: {              // OMITTED if no iteration data
        count: 1,
        result: "passed",
        escalated: false
      }
    }
    // ... one per phase in active_workflow.phases
  ],
  metrics: {
    total_phases: 8,                  // integer — active_workflow.phases.length
    phases_completed: 8,              // integer — count of status === "completed"
    total_duration_minutes: 39,       // integer — workflow end - start
    test_iterations_total: 1,         // integer — sum of all test_iterations.count
    gates_passed_first_try: 7,        // integer — phases where gate_passed && no iteration
    gates_required_iteration: 1       // integer — phases where iteration occurred
  }
}
```

### 3.3 Internal Algorithm

```
function collectPhaseSnapshots(state):
  1. Guard: if !state.active_workflow or !state.phases → return { phase_snapshots: [], metrics: defaultMetrics() }

  2. workflowPhases = state.active_workflow.phases  (ordered array)
     allPhases = state.phases                       (keyed object)

  3. snapshots = []
     For each phaseKey in workflowPhases:
       phaseData = allPhases[phaseKey]
       if !phaseData → skip (phase not initialized)

       snapshot = {
         key: phaseKey,
         status: phaseData.status || "pending",
         started: phaseData.started || null,
         completed: phaseData.completed || null,
         gate_passed: phaseData.gate_passed || null,
         duration_minutes: computeDuration(phaseData.started, phaseData.completed),
         summary: extractSummary(phaseData, state.history, phaseKey)
       }

       // Conditional: artifacts
       if phaseData.artifacts && phaseData.artifacts.length > 0:
         snapshot.artifacts = phaseData.artifacts

       // Conditional: test_iterations
       testIter = extractTestIterations(phaseData)
       if testIter:
         snapshot.test_iterations = testIter

       snapshots.push(snapshot)

  4. metrics = computeMetrics(snapshots, state.active_workflow)

  5. return { phase_snapshots: snapshots, metrics }
```

### 3.4 Helper Functions (Internal, Not Exported)

#### computeDuration(started, completed)
```
if !started or !completed → return null
diff = Date.parse(completed) - Date.parse(started)
if isNaN(diff) or diff < 0 → return null
return Math.round(diff / 60000)   // milliseconds to minutes, rounded
```

#### extractSummary(phaseData, history, phaseKey)
```
// Primary: phases[key].summary
if phaseData.summary && typeof phaseData.summary === 'string':
  return phaseData.summary.substring(0, 150)

// Fallback: last history[] entry with matching agent + timestamp range
if !history or !Array.isArray(history):
  return null

agentMap = {
  '01-requirements': 'requirements-analyst',
  '02-impact-analysis': 'impact-analysis-orchestrator',
  '02-tracing': 'tracing-orchestrator',
  '03-architecture': 'solution-architect',
  '04-design': 'system-designer',
  '05-test-strategy': 'test-design-engineer',
  '06-implementation': 'software-developer',
  '07-testing': 'integration-tester',
  '08-code-review': 'qa-engineer',
  '09-validation': 'security-compliance-auditor',
  '10-cicd': 'cicd-engineer',
  '11-local-testing': 'environment-builder',
  '12-remote-build': 'environment-builder',
  '13-test-deploy': 'deployment-engineer-staging',
  '14-production': 'release-manager',
  '15-operations': 'site-reliability-engineer',
  '16-upgrade-plan': 'upgrade-engineer',
  '16-upgrade-execute': 'upgrade-engineer'
}

expectedAgent = agentMap[phaseKey]
if !expectedAgent → return null

phaseStart = Date.parse(phaseData.started)
phaseEnd = Date.parse(phaseData.completed || phaseData.gate_passed)

// Scan history in reverse for last matching entry
for i = history.length - 1 downto 0:
  entry = history[i]
  if entry.agent !== expectedAgent → continue
  entryTime = Date.parse(entry.timestamp)
  if !isNaN(phaseStart) && !isNaN(phaseEnd):
    if entryTime >= phaseStart && entryTime <= phaseEnd + 60000:  // 1 min buffer
      return (entry.action || '').substring(0, 150) || null
  else:
    // No timestamp range — accept last matching agent entry
    return (entry.action || '').substring(0, 150) || null

return null
```

#### extractTestIterations(phaseData)
```
testIter = phaseData?.iteration_requirements?.test_iteration
if !testIter → return null

count = testIter.current_iteration ?? testIter.current ?? 0
if count === 0 && !testIter.completed && !testIter.escalated:
  return null  // No iteration data — omit field

return {
  count: count,
  result: testIter.completed === true ? "passed" :
          testIter.escalated === true ? "escalated" : "unknown",
  escalated: testIter.escalated === true
}
```

#### computeMetrics(snapshots, activeWorkflow)
```
phasesCompleted = snapshots.filter(s => s.status === 'completed').length

// Duration from workflow timestamps
totalDuration = null
startedAt = activeWorkflow.started_at
completedAt = activeWorkflow.completed_at || activeWorkflow.cancelled_at
if startedAt && completedAt:
  diff = Date.parse(completedAt) - Date.parse(startedAt)
  if !isNaN(diff) && diff >= 0:
    totalDuration = Math.round(diff / 60000)

// Iteration counts
testIterTotal = 0
gatesFirstTry = 0
gatesIteration = 0
for snapshot in snapshots:
  if snapshot.test_iterations:
    testIterTotal += snapshot.test_iterations.count
  if snapshot.gate_passed:
    if snapshot.test_iterations && snapshot.test_iterations.count > 1:
      gatesIteration++
    else:
      gatesFirstTry++

return {
  total_phases: activeWorkflow.phases?.length || 0,
  phases_completed: phasesCompleted,
  total_duration_minutes: totalDuration,
  test_iterations_total: testIterTotal,
  gates_passed_first_try: gatesFirstTry,
  gates_required_iteration: gatesIteration
}
```

---

## 4. Orchestrator Integration Points

### 4.1 Completion Sequence (Updated)

**Location**: `00-sdlc-orchestrator.md`, Section 4 "Workflow Completion"

```
BEFORE (current):
  1. Human Review Checkpoint + Branch Merge
  2. Prune state.json
  3. Mark workflow completed
  4. Move to workflow_history
  5. Set active_workflow to null
  6. Display completion summary

AFTER (new):
  1. Human Review Checkpoint + Branch Merge
  2. ** collectPhaseSnapshots(state) → { phase_snapshots, metrics } **
  3. Prune state.json
  4. Mark workflow completed
  5. Move to workflow_history WITH phase_snapshots, metrics, id, merged_commit
  6. Set active_workflow to null
  7. Display completion summary
```

### 4.2 Gate-Pass Summary Write (New)

**Location**: `00-sdlc-orchestrator.md`, Section 4 "Array-Based Advancement"

After gate validation passes and before advancing to next phase:
```
phases[current_phase_key].summary = "<1-line summary, max 150 chars>"
```

The summary should describe the key output. Examples:
- `"7 requirements, 26 AC, 4 NFRs — pre-written spec validated"`
- `"Blast radius LOW, 3 files, no hook impact"`
- `"collectPhaseSnapshots() function + orchestrator update + 20 tests"`

### 4.3 Cancellation Sequence (Updated)

**Location**: `00-sdlc-orchestrator.md`, Section 3 "Cancellation Process"

Before moving to `workflow_history`:
```
  2a. Set active_workflow.cancelled_at = ISO-8601 timestamp
  2b. collectPhaseSnapshots(state) → { phase_snapshots, metrics }
```

Then include `phase_snapshots`, `metrics`, and `id` in the `workflow_history` entry. `merged_commit` is `null` for cancelled workflows.

### 4.4 workflow_history Entry Schema (Updated)

```json
{
  "type": "feature",
  "id": "REQ-0005",
  "description": "Workflow progress snapshots",
  "started_at": "ISO-8601",
  "completed_at": "ISO-8601",
  "status": "completed",
  "artifact_prefix": "REQ",
  "artifact_folder": "REQ-0005-workflow-progress-snapshots",
  "git_branch": { "name": "feature/REQ-0005-workflow-progress-snapshots" },
  "merged_commit": "abc1234",
  "phase_snapshots": [ ... ],
  "metrics": { ... }
}
```

New fields (all additive):
- `id`: string | null — `{artifact_prefix}-{zero_padded_counter}`
- `merged_commit`: string | null — 7-char short SHA from merge commit
- `phase_snapshots`: array — from `collectPhaseSnapshots()` return value
- `metrics`: object — from `collectPhaseSnapshots()` return value

---

## 5. Data Flow Diagram

```
                          WORKFLOW COMPLETES
                                |
                                v
                    state.json (pre-prune)
                    ┌───────────────────┐
                    │ phases{}           │
                    │ active_workflow{}  │
                    │ history[]          │
                    └─────────┬─────────┘
                              |
                              v
                  collectPhaseSnapshots(state)
                  ┌───────────────────────┐
                  │ 1. Iterate workflow   │
                  │    phases array       │
                  │ 2. Extract snapshot   │
                  │    per phase          │
                  │ 3. Compute metrics    │
                  └──────────┬────────────┘
                             |
                   { phase_snapshots, metrics }
                             |
                             v
         ┌───────────────────────────────────┐
         │  Orchestrator merges into         │
         │  workflow_history entry:           │
         │  + phase_snapshots                │
         │  + metrics                        │
         │  + id (from artifact_prefix)      │
         │  + merged_commit (from git)       │
         └────────────────┬──────────────────┘
                          |
                          v
                    Pruning functions run
                    (pruneSkillUsageLog,
                     pruneCompletedPhases,
                     pruneHistory,
                     pruneWorkflowHistory)
                          |
                          v
                    state.json (post-prune)
```

---

## 6. Error Handling Strategy

### 6.1 Defensive Coding Rules

| Scenario | Handling | Rationale |
|----------|----------|-----------|
| `state.phases` missing/null | Return `{ phase_snapshots: [], metrics: defaultMetrics() }` | AC-12 |
| `state.active_workflow` missing/null | Return `{ phase_snapshots: [], metrics: defaultMetrics() }` | AC-12 |
| Phase key from workflow not in `state.phases` | Skip that phase (no snapshot entry) | Phase was never initialized |
| `started` or `completed` timestamp invalid | `duration_minutes = null` | AC-13, graceful degradation |
| `iteration_requirements.test_iteration` missing | Omit `test_iterations` from snapshot | ADR-004 |
| `summary` missing from both sources | `summary = null` | AC-23 |
| `artifact_prefix` or `counter_used` missing | `id = null` | ADR-006 |
| `completed_at` and `cancelled_at` both missing | `total_duration_minutes = null` | ADR-005 |

### 6.2 No Try-Catch at Top Level

The function uses safe navigation (`?.` and `||` defaults) rather than try-catch wrapping. If an unexpected error occurs, it propagates to the orchestrator, which can catch it and proceed without snapshots. This follows Article X (fail-safe defaults) — a snapshot failure must never block workflow completion.

---

## 7. Size Budget Validation

| Scenario | Phases | Estimated Size | Within 2KB? |
|----------|--------|---------------|-------------|
| Fix workflow (minimal) | 8 | ~1,300 bytes | Yes |
| Feature workflow | 11 | ~1,800 bytes | Yes |
| Full lifecycle | 14 | ~2,200 bytes | Marginal |
| Fix (no artifacts, no test_iter) | 8 | ~900 bytes | Yes |

Full lifecycle exceeds the 2KB target slightly but is acceptable because:
- Full lifecycle workflows are rare (~5% of workflows)
- The 50-entry cap on `workflow_history` limits total growth
- 2.2KB * 50 = 110KB worst case — well within state.json norms

---

## 8. Constitutional Compliance

| Article | Requirement | How This Architecture Complies |
|---------|-------------|-------------------------------|
| III (Code Quality) | Well-tested, handle edge cases | Pure function, 20+ test cases planned, all null/missing fields handled defensively |
| V (Simplicity) | Simplest solution | Single function, ~60-80 lines, no new modules, no new dependencies |
| VII (Traceability) | Traces to requirements | ADR-001 through ADR-007 map to REQ-001 through REQ-007 |
| VIII (Documentation Currency) | Docs updated with code | Orchestrator .md updates specified in Section 4 |
| IX (Gate Integrity) | No gate behavior changes | No gate logic modified; snapshot is a post-gate operation |
| X (Fail-Safe Defaults) | Safe degradation | All missing data returns null/empty; snapshot failure does not block completion |
| XIV (State Management) | Reliable state management | Pure function does not mutate state; orchestrator controls all writes |

---

## 9. Files Modified Summary

| File | Change | Lines (est.) |
|------|--------|-------------|
| `src/claude/hooks/lib/common.cjs` | Add `collectPhaseSnapshots()` + 4 internal helpers + export | +70-90 |
| `src/claude/agents/00-sdlc-orchestrator.md` | Update completion, gate-pass, cancellation sequences | +30-40 |
| `src/claude/hooks/tests/test-common.test.cjs` | Add `describe('collectPhaseSnapshots()')` test block | +120-160 |

**Total**: ~220-290 lines across 3 files. No new files. No deleted files.

---

## 10. Rejected Alternatives

### Alternative A: Snapshot as a Separate File
Write snapshots to `docs/requirements/{artifact_folder}/workflow-snapshot.json` instead of embedding in state.json.

**Rejected because**: Creates coupling between state management and filesystem structure. The orchestrator would need to manage additional file writes. State.json is the single source of runtime state (Article XIV). A separate file would be a shadow state that could drift.

### Alternative B: Snapshot During Each Phase (Incremental)
Write snapshot data incrementally as each phase completes, rather than collecting all at once at workflow end.

**Rejected because**: Adds complexity to every gate-pass transition. The current approach (collect once at completion) is simpler and sufficient. Incremental snapshots would also mean partial data in `workflow_history` for cancelled workflows, requiring cleanup logic.

### Alternative C: Mutation-Based Function (Modify state Directly)
Have `collectPhaseSnapshots(state)` directly write `phase_snapshots` and `metrics` into the state object.

**Rejected because**: The function would need to know the target location in `workflow_history`, creating coupling to workflow management logic. A pure return value is cleaner and more testable.
