# Module Design: Task-Level Delegation in Phase-Loop Controller

**Slug**: REQ-GH-220-task-level-delegation-in-phase-loop-controller
**Version**: 1.0.0

---

## 1. Module Overview

| Module | File | Operation | Responsibility |
|--------|------|-----------|----------------|
| Task Dispatcher Core | `src/core/tasks/task-dispatcher.js` | CREATE | Provider-neutral: compute dispatch plan, track completions, handle failures |
| Phase-Loop Controller | `src/claude/commands/isdlc.md` step 3d | MODIFY | Claude adapter: conditional task-dispatch, per-task prompt builder, tier-parallel Task tool dispatch |
| Codex Task Dispatch | `src/providers/codex/task-dispatch.js` | CREATE | Codex adapter: per-task `codex exec` dispatch |
| Workflows Config | `src/isdlc/config/workflows.json` | MODIFY | Add `task_dispatch` config block |
| Software Developer | `src/claude/agents/05-software-developer.md` | MODIFY | Mechanical mode fallback note |
| Test-Generate Handler | `src/claude/commands/isdlc.md` test-generate | MODIFY | Scaffold-to-tasks derivation |
| CLAUDE.md | `CLAUDE.md` | MODIFY | Reference task-level dispatch in TASK_CONTEXT section |
| Workflows Config Copy | `.isdlc/config/workflows.json` | COPY | Dogfooding dual-file |

---

## 2. Module Design

### 2.1 Task Dispatcher Core (`src/core/tasks/task-dispatcher.js`)

**Responsibility**: Provider-neutral algorithm for task-level dispatch. Exports pure functions — no runtime loop, no I/O beyond reading tasks.md.

**Exports**:

```javascript
/**
 * Compute a dispatch plan for a phase: tasks grouped into parallel tiers.
 * @param {string} tasksPath - path to tasks.md
 * @param {string} phaseKey - e.g. "06-implementation"
 * @returns {{ tiers: Task[][], totalTasks: number, pendingTasks: number } | null}
 */
export function computeDispatchPlan(tasksPath, phaseKey)

/**
 * Get the next batch of unblocked tasks (tier N where all prior tiers are complete).
 * @param {string} tasksPath - path to tasks.md (re-read for current state)
 * @param {string} phaseKey
 * @returns {{ tier: number, tasks: Task[], isLastTier: boolean } | null}
 */
export function getNextBatch(tasksPath, phaseKey)

/**
 * Mark a task as complete in tasks.md and recalculate progress summary.
 * @param {string} tasksPath
 * @param {string} taskId - e.g. "T0004"
 * @param {{ retries?: number, summary?: string }} metadata
 */
export function markTaskComplete(tasksPath, taskId, metadata)

/**
 * Handle a task failure: increment retry counter, determine action.
 * @param {string} tasksPath
 * @param {string} taskId
 * @param {string} error - error message from agent
 * @param {number} maxRetries - default 3
 * @returns {{ action: 'retry' | 'escalate', retryCount: number }}
 */
export function handleTaskFailure(tasksPath, taskId, error, maxRetries)

/**
 * Mark a task and all its transitive dependents as skipped.
 * @param {string} tasksPath
 * @param {string} taskId
 * @param {string} reason
 */
export function skipTaskWithDependents(tasksPath, taskId, reason)

/**
 * Check if a phase should use task-level dispatch.
 * @param {Object} workflowConfig - parsed workflows.json
 * @param {string} phaseKey
 * @param {string} tasksPath
 * @returns {boolean}
 */
export function shouldUseTaskDispatch(workflowConfig, phaseKey, tasksPath)
```

**Dependencies**: Imports from `task-reader.js` (`readTaskPlan`, `getTasksForPhase`, `assignTiers` — note: `assignTiers` is currently not exported, will need to be exported).

**Internal state**: None. All state is in tasks.md on disk. Functions re-read tasks.md on each call to get current state.

### 2.2 Phase-Loop Controller Step 3d Modification (`isdlc.md`)

**Current step 3d**: Single agent delegation for all phases.

**Modified step 3d**: Conditional dispatch:

```
3d. PHASE DELEGATION:

  Read task_dispatch config from workflows.json.
  Call shouldUseTaskDispatch(workflowConfig, phase_key, tasksPath).

  IF true → Execute STEP 3d-tasks (Task-Level Dispatch Protocol)
  ELSE → Execute existing single-call delegation (unchanged)
```

**New step 3d-tasks: Task-Level Dispatch Protocol**:

1. Call `computeDispatchPlan(tasksPath, phase_key)` to get tiers
2. If null or totalTasks === 0: fall back to single-call delegation
3. If pendingTasks <= 2: fall back to single-call delegation (overhead not justified)
4. For each tier (starting at 0):
   a. Call `getNextBatch(tasksPath, phase_key)` to get current unblocked tasks
   b. For each task in the batch, build per-task prompt:
      ```
      Execute task {task.id}: {task.description}
      Phase: {phase_key}
      Artifact folder: {artifact_folder}

      FILES:
      {for each file: "- {path} ({operation})"}

      TRACES:
      {task.traces}

      PRIOR COMPLETED FILES (this phase):
      {accumulated list from earlier tiers}

      CONTEXT:
      {scoped excerpt from requirements-spec.md for traced FRs}

      CONSTRAINTS:
      - Do NOT run git commit
      - Do NOT write to .isdlc/state.json
      - Implement ONLY the files listed above
      - Run tests for your changes before returning
      ```
   c. Dispatch all tasks in the tier in parallel (multiple Task tool calls in one response)
   d. For each returned result:
      - Success: call `markTaskComplete(tasksPath, taskId, metadata)`, update TaskCreate entry, add files to prior-completed accumulator
      - Failure: call `handleTaskFailure(tasksPath, taskId, error, 3)`
        - If action === 'retry': re-dispatch with error context appended
        - If action === 'escalate': present user menu (Retry / Skip / Cancel)
        - If Skip: call `skipTaskWithDependents(tasksPath, taskId, reason)`
   e. After all tasks in tier handled: proceed to next tier
5. After all tiers complete: proceed to step 3e (post-phase state update)

### 2.3 Codex Task Dispatch Adapter (`src/providers/codex/task-dispatch.js`)

**Responsibility**: Thin wrapper that calls `task-dispatcher.js` core functions and dispatches via `codex exec`.

```javascript
import { computeDispatchPlan, getNextBatch, markTaskComplete, handleTaskFailure, skipTaskWithDependents } from '../../core/tasks/task-dispatcher.js';

/**
 * Execute task-level dispatch for a phase using Codex runtime.
 * @param {string} tasksPath
 * @param {string} phaseKey
 * @param {string} artifactFolder
 * @param {Object} options - { agentType, maxRetries }
 */
export async function dispatchPhaseTasks(tasksPath, phaseKey, artifactFolder, options)
```

Internally: same tier-by-tier loop as the Claude adapter, but uses `codex exec` with per-task projection bundles instead of Task tool calls.

### 2.4 Workflows Config (`src/isdlc/config/workflows.json`)

Add top-level `task_dispatch` block:

```json
{
  "task_dispatch": {
    "enabled": true,
    "phases": ["05-test-strategy", "06-implementation"],
    "max_retries_per_task": 3,
    "parallel_within_tier": true,
    "min_tasks_for_dispatch": 3
  }
}
```

- `enabled`: Global kill switch
- `phases`: Which phases use task-level dispatch
- `max_retries_per_task`: Retry limit before escalation
- `parallel_within_tier`: Whether to dispatch tier tasks in parallel
- `min_tasks_for_dispatch`: Fallback to single-call if fewer tasks than this

### 2.5 Test-Generate Scaffold-to-Tasks Derivation (`isdlc.md`)

In the test-generate handler, after Phase 05 completes:

1. Check `tests/characterization/` for `test.skip()` scaffold files
2. If found: generate a tasks.md where each scaffold file is a Phase 06 task
3. Write to `docs/isdlc/tasks.md`
4. Phase 06 task-level dispatch picks up the generated tasks

### 2.6 Software Developer Fallback Note (`05-software-developer.md`)

Add note in the MECHANICAL EXECUTION MODE section:

> **Note**: When the Phase-Loop Controller's task-level dispatch is active (GH-220), each task is delegated individually — you receive a single task, not the full phase. Mechanical mode is only used when task-level dispatch is disabled or tasks.md is absent.

---

## 3. Changes to Existing Modules

| File | Section | Change | Rationale |
|------|---------|--------|-----------|
| `src/core/tasks/task-reader.js` | `assignTiers()` | Export the function (currently internal) | task-dispatcher.js needs it |
| `src/claude/commands/isdlc.md` | Step 3d | Add conditional: task-dispatch vs single-call | Core loop change |
| `src/claude/commands/isdlc.md` | Test-generate handler | Add scaffold-to-tasks derivation | FR-006 |
| `src/isdlc/config/workflows.json` | Top-level | Add `task_dispatch` config block | Phase mode config |
| `src/claude/agents/05-software-developer.md` | Mechanical mode section | Add fallback note | Clarity |
| `CLAUDE.md` | TASK_CONTEXT section | Reference task-level dispatch | Documentation |

---

## 4. Wiring Summary

| File | Operation |
|------|-----------|
| `src/core/tasks/task-dispatcher.js` | CREATE — provider-neutral dispatch algorithm |
| `src/providers/codex/task-dispatch.js` | CREATE — Codex adapter |
| `src/core/tasks/task-reader.js` | MODIFY — export `assignTiers()` |
| `src/claude/commands/isdlc.md` | MODIFY — step 3d conditional + step 3d-tasks + test-generate derivation |
| `src/isdlc/config/workflows.json` | MODIFY — add `task_dispatch` config |
| `src/claude/agents/05-software-developer.md` | MODIFY — mechanical mode fallback note |
| `CLAUDE.md` | MODIFY — reference task-level dispatch |
| `.isdlc/config/workflows.json` | COPY — sync from src |
