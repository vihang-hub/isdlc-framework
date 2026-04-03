# Requirements Specification: Task-Level Delegation in Phase-Loop Controller

**Slug**: REQ-GH-220-task-level-delegation-in-phase-loop-controller
**Source**: GitHub Issue #220
**Type**: Enhancement
**Version**: 1.0.0

---

## 1. Business Context

### Problem Statement

The Phase-Loop Controller delegates entire phases as a single monolithic agent call. For Phase 06 (implementation) with 10+ tasks, the delegated agent consistently returns early without completing — it runs out of context or hits token limits. This was observed in GH-218 (8 tasks, agent returned after 7 tool uses) and GH-215 (19 tasks, agent returned after touching 4 of ~20 files). The current workaround is the main session taking over and implementing manually, which defeats the purpose of automated phase delegation.

### Stakeholders

- **Framework users**: Get reliable phase completion without manual takeover
- **Phase agents (05, 06)**: Receive focused, completable task scope instead of entire phase workload
- **Phase-Loop Controller**: Externalizes the task iteration loop that currently lives inside agents

### Success Metrics

- Phase 06 agents complete their delegated work without returning early
- Each task gets a fresh context window (no context exhaustion)
- Parallel tasks within a tier execute concurrently
- Both Claude Code and Codex providers dispatch tasks via the same core algorithm

### Driving Factors

- GH-218: Phase 05 and 06 agents returned early, main session implemented directly
- GH-215: Phase 06 agent returned after minimal progress on 19-task implementation
- GH-212: Established task consumption model — this completes the loop by making consumption task-granular
- Phase 06 already has mechanical execution mode internally — but the agent returns before finishing the internal loop

---

## 2. Stakeholders and Personas

### Framework User
- **Role**: Developer using iSDLC to build features
- **Goals**: Reliable automated build phases that complete without manual intervention
- **Pain Points**: Agents return early on large implementations, requiring manual takeover

---

## 3. User Journeys

### Journey 1: Build With Task-Level Dispatch
- **Entry**: User runs `/isdlc build "REQ-GH-208"` after analysis with tasks.md
- **Flow**: Build-init copies tasks.md → Phase 05 dispatches per-task (test case per implementation task) → Phase 06 dispatches per-task (one file per agent call, parallel within tiers) → Phase 16 self-orchestrates → Phase 08 self-orchestrates
- **Exit**: All tasks marked `[X]`, no manual intervention needed

### Journey 2: Test Generate With Scaffolds
- **Entry**: User runs `/isdlc test generate` after discover produced `test.skip()` scaffolds
- **Flow**: Phase 05 reads scaffolds from `tests/characterization/`, generates tasks.md → Phase 06 dispatches per-task (implement each scaffold) → Phase 16/08 as normal
- **Exit**: All scaffolds implemented, tests passing

### Journey 3: Task Failure and Recovery
- **Entry**: A task agent fails during Phase 06
- **Flow**: Controller retries (up to 3 times) → if still failing, presents Retry/Skip/Cancel → user skips → dependent tasks auto-skipped → phase completes with gaps documented
- **Exit**: Phase completes partially, skipped tasks documented in tasks.md

---

## 4. Technical Context

### Existing Infrastructure
- **`src/core/tasks/task-reader.js`**: Parses tasks.md, `getTasksForPhase()`, `assignTiers()` for topological sort
- **`TASK_CONTEXT` injection**: Already filters and formats tasks per phase for prompt injection
- **Mechanical execution mode**: `05-software-developer.md` lines 753-799 — internal per-task loop (being externalized)
- **Phase-Loop Controller**: `isdlc.md` step 3d — currently single agent delegation per phase
- **Provider runtime**: Claude uses Task tool, Codex uses `codex exec` with projection bundles

### Constraints
- Must work for both Claude Code and Codex providers (Article XII)
- Provider-neutral logic in `src/core/`, provider-specific in `src/providers/` and `src/claude/`
- `task-reader.js` already in `src/core/` — `task-dispatcher.js` goes alongside it
- Phases 16 and 08 keep their existing self-orchestrating behavior (internal fan-out)

---

## 5. Quality Attributes and Risks

| Attribute | Priority | Threshold |
|-----------|----------|-----------|
| Reliability | High | No agent early-returns on tasks with ≤3 files |
| Parallelism | High | Tasks within a tier execute concurrently |
| Cross-platform | High | Same core algorithm for Claude and Codex |
| Fail-safe | High | Task failure doesn't kill the phase (Article X) |

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Per-task agents lack cross-task context | High | Medium | Include prior-completed-files list in each task prompt |
| Tier computation has cycles | Low | High | `task-reader.js` already validates — warns on self-references |
| Task-level dispatch adds overhead for small phases | Medium | Low | Fallback to single-call if phase has ≤2 tasks |

---

## 6. Functional Requirements

### FR-001: Task-level inner loop in Phase-Loop Controller

**Confidence**: High

For phases that have tasks in tasks.md, the Phase-Loop Controller iterates through tasks in dependency order instead of delegating the entire phase to one agent call.

- **AC-001-01**: Given a phase has tasks in tasks.md, when the phase is reached in the loop, then tasks are read via `task-reader.js` and filtered for the current phase
- **AC-001-02**: Given filtered tasks exist, when execution begins, then tasks are topologically sorted by `blocked_by` dependencies
- **AC-001-03**: Given sorted tasks exist, when a task has no unresolved `blocked_by`, then it is delegated to a fresh agent with a per-task prompt
- **AC-001-04**: Given a task agent returns successfully, when the task is complete, then the task is marked `[X]` in tasks.md and dependent tasks are unblocked

### FR-002: Per-task delegation prompt

**Confidence**: High

Each task gets a focused delegation prompt containing only the information needed for that specific task.

- **AC-002-01**: The prompt includes the task description, `traces:` (FR/AC references), and `files:` (target file paths with CREATE/MODIFY)
- **AC-002-02**: The prompt includes relevant context from requirements-spec.md and design artifacts scoped to the traced FRs/ACs
- **AC-002-03**: The prompt includes the phase agent type (same agent type for all tasks in a phase)
- **AC-002-04**: The prompt does NOT include other tasks' details — each agent sees only its own task

### FR-003: Parallel batch detection

**Confidence**: High

Tasks with no mutual dependencies within the same phase can be dispatched in parallel.

- **AC-003-01**: Given multiple tasks have all `blocked_by` resolved, when a batch is formed, then tasks with no file overlap are dispatched in parallel
- **AC-003-02**: Given parallel tasks are dispatched, when all return, then all are marked `[X]` before the next batch begins
- **AC-003-03**: If a parallel task fails, the other tasks in the batch are not affected — failed task is retried independently

### FR-004: Phase mode flag

**Confidence**: High

Phases are categorized as task-dispatched or self-orchestrating.

- **AC-004-01**: Phases 05 and 06 are task-dispatched — the controller iterates tasks
- **AC-004-02**: Phases 16 and 08 are self-orchestrating — the controller delegates all tasks in one call
- **AC-004-03**: The phase mode is determined by checking tasks.md for the phase AND a config flag in workflows.json
- **AC-004-04**: If a task-dispatched phase has no tasks in tasks.md, it falls back to self-orchestrating

### FR-005: Per-task quality sub-loops

**Confidence**: High

For Phase 06, each task's agent call includes the writer/reviewer/updater sub-loop.

- **AC-005-01**: Given a Phase 06 task is delegated, when the implementation-reviewer finds issues, then the implementation-updater fixes them within the same task agent call
- **AC-005-02**: The debate team (Phase 05: critic/refiner) runs within each task's agent call for Phase 05
- **AC-005-03**: Sub-loops are internal to the task agent — the controller only sees task success/failure

### FR-006: Test-generate workflow support

**Confidence**: High

The task-level loop works for `test generate` by deriving tasks from discover's `test.skip()` scaffolds.

- **AC-006-01**: Given `tests/characterization/` contains `test.skip()` scaffolds, when Phase 05 runs, then each scaffold file becomes a task in the generated task list
- **AC-006-02**: Given a test task list is generated, when Phase 06 runs, then each task implements one `test.skip()` scaffold
- **AC-006-03**: If no scaffolds exist, Phase 05 falls back to self-decomposition

### FR-007: Task failure handling

**Confidence**: High

Individual task failures don't kill the entire phase.

- **AC-007-01**: Given a task agent returns with an error, when retry count is below max (3), then the task is retried with a fresh agent
- **AC-007-02**: Given a task fails 3 times, when escalation triggers, then the user is presented with Retry / Skip / Cancel
- **AC-007-03**: Given a task is skipped, when dependent tasks exist, then those dependents are also marked skipped with reason
- **AC-007-04**: Given a task succeeds after retry, when execution continues, then the retry count is recorded in tasks.md

### FR-008: Progress visibility

**Confidence**: High

Users see task-level progress during phase execution.

- **AC-008-01**: Each task creates a visible TaskCreate entry when it starts and marks completed when it finishes
- **AC-008-02**: The tasks.md file is updated after each task completion
- **AC-008-03**: The Progress Summary table in tasks.md is recalculated after each task completion

---

## 7. Out of Scope

| Item | Reason | Future Reference |
|------|--------|-----------------|
| Upgrade workflow | Different execution model, tracked separately | #221, #222 |
| Roundtable/analysis flow | No tasks.md during analysis | N/A |
| New agent types per task | Same agent type for all tasks in a phase | N/A |
| Changes to tracing sub-agents | Not applicable | N/A |

---

## 8. MoSCoW Prioritization

| FR | Title | Priority | Rationale |
|----|-------|----------|-----------|
| FR-001 | Task-level inner loop | Must Have | Core capability — solves the agent early-return problem |
| FR-002 | Per-task delegation prompt | Must Have | Focused scope is what makes per-task dispatch work |
| FR-003 | Parallel batch detection | Must Have | Without parallelism, dispatch is serial and slow |
| FR-004 | Phase mode flag | Must Have | Prevents double-dispatch for self-orchestrating phases |
| FR-005 | Per-task quality sub-loops | Must Have | Quality loops must run per-task, not per-phase |
| FR-006 | Test-generate support | Must Have | Completes the discover → test-generate pipeline |
| FR-007 | Task failure handling | Must Have | Resilience — partial completion better than total failure |
| FR-008 | Progress visibility | Must Have | Users need to see task-level progress |
