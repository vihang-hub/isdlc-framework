# GH-220: Task-level delegation in Phase-Loop Controller

**Source**: github
**Source ID**: GH-220
**URL**: https://github.com/vihang-hub/isdlc-framework/issues/220

## Problem

The Phase-Loop Controller delegates entire phases as a single monolithic agent call. For Phase 06 (implementation) with 10+ tasks, the delegated agent consistently returns early without completing — it runs out of context or hits token limits. This was observed in GH-218 (8 tasks, agent returned after 7 tool uses) and GH-215 (19 tasks, agent returned after touching 4 of ~20 files).

The current workaround is the main session taking over and implementing manually, sometimes entering plan mode to organize the work. This defeats the purpose of automated phase delegation.

## Proposed Change

Add a task-level loop inside the phase-level loop (step 3d of the Phase-Loop Controller). Instead of delegating "execute all Phase 06 tasks" to one agent, iterate through tasks.md in dependency order and delegate one task (or one parallel batch of unblocked tasks) at a time.

### Flow

1. Read tasks.md via `task-reader.js`, filter tasks for the current phase
2. Topological sort by `blocked_by` dependencies
3. For each batch of unblocked tasks:
   - Delegate each task to a focused agent (1-2 files, specific spec)
   - On return: mark task `[X]` in tasks.md, unblock dependents
   - Next batch
4. After all tasks complete: proceed to post-phase state update (step 3e)

### Infrastructure Already Available

- `src/core/tasks/task-reader.js` — parses tasks.md, understands blocked_by/blocks
- `TASK_CONTEXT` injection — already filters tasks per phase
- Dependency graph in tasks.md — already identifies parallel opportunities
- `TaskUpdate` — already marks individual tasks as completed

### What's Missing

- Task-level loop in the Phase-Loop Controller (step 3d)
- Per-task delegation prompt template (focused: "implement T0004, create this file, here's the spec")
- Batch detection: identify unblocked tasks that can run in parallel
- Per-task completion tracking in tasks.md (mark [X] after each task, not after entire phase)

## Context

- GH-218 build: Phase 05 and 06 agents both returned early, main session implemented directly
- GH-215 build: Phase 06 agent returned after minimal progress on 19-task implementation
- Existing `3e-refine` step already produces file-level task granularity with dependency ordering
- GH-212 established the task consumption model — this completes the loop by making consumption task-granular
