# Architecture Overview: Task-Level Delegation in Phase-Loop Controller

**Slug**: REQ-GH-220-task-level-delegation-in-phase-loop-controller
**Version**: 1.0.0

---

## 1. Architecture Options

### Decision 1: Where the task loop lives

| Option | Summary | Pros | Cons | Pattern Alignment | Verdict |
|--------|---------|------|------|-------------------|---------|
| A: Three-layer split (core + adapters) | Provider-neutral core module + Claude/Codex adapters | Same algorithm tested once; both providers supported; follows existing task-reader.js pattern | More files than prompt-only approach | Matches `src/core/tasks/task-reader.js` pattern exactly | **Selected** |
| B: Prompt-only in isdlc.md | All logic in Claude's command spec | Simpler for Claude | Codex gets nothing; violates Article XII (cross-platform) | Claude-only; breaks dual-provider convention | Eliminated |

### Decision 2: Task dispatch granularity

| Option | Summary | Pros | Cons | Pattern Alignment | Verdict |
|--------|---------|------|------|-------------------|---------|
| A: One task per agent, parallel within tiers | Fresh context per task + concurrent tier execution | Maximum isolation; reliable completion; parallelism | More agent calls than monolithic | Externalizes mechanical mode's existing per-task pattern | **Selected** |
| B: One tier per agent call | Fewer agent calls | Less isolation; larger context per call; same early-return risk for large tiers | N/A | Eliminated |

---

## 2. Selected Architecture

### ADR-001: Three-Layer Task Dispatch Architecture

- **Status**: Accepted
- **Context**: Task-level dispatch must work for both Claude Code (Task tool) and Codex (`codex exec`). A pure prompt-level approach in isdlc.md only serves Claude.
- **Decision**: Split into provider-neutral core + provider adapters:
  - `src/core/tasks/task-dispatcher.js` — the algorithm: read plan, filter phase, compute tiers, track completions, handle retries/skips. Exports functions, not a runtime loop.
  - Claude adapter: `isdlc.md` step 3d-tasks calls core functions, dispatches via Task tool
  - Codex adapter: `src/providers/codex/task-dispatch.js` calls same core functions, dispatches via `codex exec`
- **Rationale**: `task-reader.js` already lives in `src/core/` and both providers share it. `task-dispatcher.js` is the natural companion — same layer, same pattern. Provider adapters are thin wrappers.
- **Consequences**: Algorithm tested once in core. Provider adapters handle only dispatch mechanism.

### ADR-002: Phase Mode Configuration

- **Status**: Accepted
- **Context**: Phases 16 and 08 have their own internal fan-out (quality-loop QL-012, code-review fan-out). Task-level dispatch from the controller would double-dispatch.
- **Decision**: Add `task_dispatch.phases` config in workflows.json. Only listed phases use task-level dispatch. Others keep single-call delegation.
- **Rationale**: Config-driven, not hardcoded. Users can add/remove phases from task dispatch without code changes.
- **Consequences**: Default phases: `["05-test-strategy", "06-implementation"]`. Phases 16 and 08 excluded.

### ADR-003: Mechanical Mode Becomes Fallback

- **Status**: Accepted
- **Context**: `05-software-developer.md` has mechanical execution mode (lines 753-799) that does per-task iteration internally. This is the same loop being externalized.
- **Decision**: Mechanical mode becomes the fallback when task-level dispatch is disabled or tasks.md is absent. When the controller dispatches per-task, the agent receives a single task and doesn't need internal looping.
- **Rationale**: No breaking change — mechanical mode still works for direct agent delegation (e.g., `/isdlc delegate`).
- **Consequences**: Mechanical mode is redundant when task dispatch is active, but preserved for backward compatibility.

---

## 3. Technology Decisions

| Technology | Version | Rationale | Alternatives Considered |
|------------|---------|-----------|------------------------|
| `task-reader.js` functions | As-is | Reuse `getTasksForPhase()`, `assignTiers()` | Custom parser (rejected — duplicates existing) |
| `task-dispatcher.js` (new) | ESM | Companion to task-reader.js in same directory | Inline in isdlc.md (rejected — Codex excluded) |
| workflows.json `task_dispatch` block | Config-driven | User-configurable phase list | Hardcoded phase list (rejected — not extensible) |

---

## 4. Integration Architecture

### Integration Points

| ID | Source | Target | Interface | Data Format | Error Handling |
|----|--------|--------|-----------|-------------|----------------|
| INT-001 | `task-dispatcher.js` | `task-reader.js` | `getTasksForPhase()`, `assignTiers()` | Task objects with id, files, traces, blockedBy | Returns empty array if no tasks |
| INT-002 | Claude adapter (isdlc.md) | `task-dispatcher.js` | `getNextBatch()`, `markTaskComplete()`, `handleTaskFailure()` | Tier batches, completion records | Retry up to 3, then escalate |
| INT-003 | Codex adapter | `task-dispatcher.js` | Same functions as INT-002 | Same format | Same error handling |
| INT-004 | Claude adapter | Task tool | Per-task agent delegation | Focused prompt with task desc, files, traces | Agent failure → retry |
| INT-005 | Codex adapter | `codex exec` | Per-task projection bundle | Task-scoped projection | Exec failure → retry |
| INT-006 | Per-task agent (Phase 06) | implementation-reviewer/updater | Internal quality sub-loop | File review findings | Internal to agent call |
| INT-007 | Per-task agent (Phase 05) | test-strategy-critic/refiner | Internal debate sub-loop | Test case review | Internal to agent call |

### Data Flow

```
Phase reached in Phase-Loop Controller
  → Check: phase in task_dispatch.phases? (from workflows.json)
  → No: existing single-call delegation (step 3d unchanged)
  → Yes: task-level dispatch (step 3d-tasks):
      → readTaskPlan() → getTasksForPhase() → filter pending tasks
      → assignTiers() → group into parallel batches
      → For each tier (0, 1, 2, ...):
          → getNextBatch() → list of unblocked tasks
          → For each task (parallel within tier):
              → Build per-task prompt (task desc, files, traces, prior files)
              → Claude: Task tool dispatch | Codex: codex exec dispatch
              → On success: markTaskComplete() → update tasks.md [X]
              → On failure: handleTaskFailure() → retry or escalate
          → All tier tasks done → next tier
      → All tiers done → step 3e (post-phase state update)
```

---

## 5. Summary

| Metric | Value |
|--------|-------|
| New files | 2 (`task-dispatcher.js`, `codex/task-dispatch.js`) |
| Modified files | 4 (`isdlc.md`, `workflows.json`, `software-developer.md`, `CLAUDE.md`) |
| Reused components | `task-reader.js` (getTasksForPhase, assignTiers), implementation-reviewer/updater, test-strategy-critic/refiner |
| ADRs | 3 (three-layer split, phase mode config, mechanical mode fallback) |
| Key risk | Cross-task context — mitigated with prior-completed-files list in per-task prompt |
