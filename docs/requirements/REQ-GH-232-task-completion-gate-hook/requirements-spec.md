# Requirements Specification: task-completion-gate hook

**Source**: GitHub #232
**Slug**: REQ-GH-232-task-completion-gate-hook
**Created**: 2026-04-05
**Status**: Accepted

## 1. Business Context

### Problem Statement
During REQ-GH-224 build, the Phase-Loop Controller marked Phase 06 (implementation) `completed` in `.isdlc/state.json` while 3 Must-Have tasks (T017, T019, T020) remained `[ ]` in `docs/isdlc/tasks.md`. No runtime check caught the violation. Article I.5 of the project constitution ("User-confirmed task plans are binding specifications. Phase agents MAY refine tasks into sub-tasks but MUST NOT alter, remove, or expand the scope of parent tasks without user approval.") is currently enforced only by convention.

### Success Metric
Zero build workflows can advance past a `task_dispatch` phase (05-test-strategy, 06-implementation) with top-level `[ ]` tasks remaining in the matching `tasks.md` section, unless the user explicitly opts to Skip with an audit record written to `active_workflow.skipped_tasks[]`.

### Driving Factors
- **Constitutional**: Article I.5 requires runtime enforcement
- **Trust**: Users must be able to rely on tasks.md as a binding contract
- **Regression prevention**: The REQ-GH-224 incident demonstrated the gap

## 2. Stakeholders and Personas

### Framework Developer (dogfooding)
- **Role**: Develops the iSDLC framework itself using the framework
- **Goals**: Catch protocol violations before they ship; dogfood Article I.5 enforcement
- **Pain Point**: REQ-GH-224 silently skipped 3 Must-Have tasks; nothing caught it

### End-User Developer
- **Role**: Runs `/isdlc build` on their own project
- **Goals**: Trust that a build workflow completes the tasks.md plan it was given
- **Pain Point**: Phase agents might silently drop tasks; user has no runtime guarantee

## 3. User Journeys

### Happy path: All tasks completed
Entry: Phase 06 implementation begins with 5 tasks in tasks.md.
Flow: Agent completes all 5, marks each `[X]` via markTaskComplete(). Phase-Loop Controller attempts to write `phases["06-implementation"].status = "completed"`. Hook reads tasks.md, counts 0 unfinished tasks, exits 0. State.json edit succeeds. Phase advances.
Exit: Phase 16 begins.

### Block path: Task left unfinished
Entry: Phase 06 agent signals completion but T019 is still `[ ]`.
Flow: Phase-Loop Controller writes state.json with status=completed. Hook intercepts, reads tasks.md, counts 1 unfinished task, blocks with "TASKS INCOMPLETE" message listing T019. Phase-Loop Controller receives block, increments `hook_block_retries["task-completion-gate:06-implementation"]`, re-delegates to software-developer with explicit instruction to complete T019.
Exit: Agent completes T019, marks `[X]`, retry succeeds.

### Escalation path: Retries exhausted
Entry: After 3 retries, T019 still `[ ]`.
Flow: Phase-Loop Controller displays escalation menu to user. User picks [S] Skip. Controller appends `{ phase: "06-implementation", tasks: ["T019"], skipped_at: "<ISO>", reason: "user_skip_after_retries" }` to `active_workflow.skipped_tasks[]`, clears retry counter, allows phase to advance.
Exit: Phase 16 begins with audit trail of skipped tasks.

## 4. Technical Context

### Constraints
- **Dual-module architecture**: Hook MUST be CommonJS (`.cjs` extension) per Article XIII
- **Task parsing reuse**: Hook uses `readTaskPlan()` from `src/core/tasks/task-reader.js` via a bridge (`src/core/bridge/*.cjs`)
- **Fail-open on all errors**: Per Article X, hook MUST never block user workflow on internal errors

### Existing Conventions
- Hook registered in `src/claude/settings.json` under `hooks.PreToolUse` matcher
- Block messages follow format convention used by `blast-radius-validator.cjs`, `gate-blocker.cjs`
- Retry counter stored in `active_workflow.hook_block_retries["{hook-type}:{phase_key}"]`

### Integration Points
- **Phase-Loop Controller** (`src/claude/commands/isdlc.md`, STEP 3f): requires a new `3f-task-completion` dispatch handler for `TASKS INCOMPLETE` block messages
- **state.json schema**: adds optional `active_workflow.skipped_tasks[]` field
- **tasks.md parser**: reuses `readTaskPlan()` with no schema changes

### Test Coverage Target
- Unit tests in `src/claude/hooks/tests/test-task-completion-gate.test.cjs` following existing hook test patterns (per Article II, >= 80% coverage)
- Integration test in `src/claude/hooks/tests/` verifying Phase-Loop Controller 3f handler routes correctly

## 5. Quality Attributes and Risks

| Attribute | Priority | Threshold |
|-----------|----------|-----------|
| Reliability | Critical | Fail-open on all internal errors (Article X) |
| Performance | High | Hook runtime < 100ms end-to-end |
| Security | High | No user-controlled inputs; filesystem reads only (Article III) |
| Maintainability | High | Hook code < 200 LOC; reuses task-reader bridge |

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| False positive on tasks.md with non-standard section header format | Low | Medium | Fail-open when section not found; use same parser as task-reader |
| Phase-Loop Controller 3f handler not wired → block ignored | Low | High | Add `3f-task-completion` section to isdlc.md in same commit; integration test verifies routing |
| Schema creep: future hooks later write to `skipped_tasks[]` with different semantics | Low | Low | Document schema in requirements; single source of truth for field semantics |
| Hook blocks legitimate idempotent status writes | Low | Medium | Detect transition (old != "completed" AND new == "completed"), not arbitrary status write |

## 6. Functional Requirements

### FR-001: Pre-completion task check
**Title**: Intercept phase-completion state writes and verify task completeness
**Description**: During a build workflow, when an Edit/Write targets `.isdlc/state.json` and the proposed edit transitions `phases[phase_key].status` from non-`"completed"` to `"completed"`, the hook MUST read `docs/isdlc/tasks.md`, locate the `## Phase NN:` section matching `phase_key`, count top-level `[ ]` tasks, and block (exit 2) if count > 0.
**Confidence**: High

- **AC-001-01**: Given `active_workflow.type === "build"` AND a PreToolUse Edit/Write targets `.isdlc/state.json` AND the new state has `phases[phase_key].status = "completed"` AND the current on-disk value for that key is NOT `"completed"` AND `docs/isdlc/tasks.md` has a `## Phase NN:` section matching `phase_key`, When the hook runs, Then it counts top-level `[ ]` tasks in that section and exits 2 (block) if count > 0
- **AC-001-02**: Given a block fires, When the hook writes to stderr, Then the message format is:
  ```
  TASKS INCOMPLETE: Phase {phase_key} has {N} unfinished top-level tasks.

  Unfinished tasks (docs/isdlc/tasks.md):
    - [ ] T{id}: {description}
    ...

  Article I.5: User-confirmed task plans are binding specifications.
  Complete remaining tasks, then retry phase completion.
  ```
- **AC-001-03**: Given the hook exits 2 with "TASKS INCOMPLETE" message, When the Phase-Loop Controller receives `blocked_by_hook` status, Then it routes through STEP 3f dispatch to a new `3f-task-completion` handler and re-delegates to the phase agent with unfinished task IDs named explicitly

### FR-002: Fail-open conditions
**Title**: Never block workflows in unintended contexts
**Description**: The hook MUST exit 0 silently (fail-open per Article X) when any precondition for enforcement is not met or when any internal error occurs.
**Confidence**: High

- **AC-002-01**: Given no active workflow in state.json OR `active_workflow.type !== "build"`, When hook fires, Then exits 0 with no output
- **AC-002-02**: Given `docs/isdlc/tasks.md` missing OR `readTaskPlan()` returns null OR throws, When hook fires, Then logs warning to stderr and exits 0
- **AC-002-03**: Given tasks.md has no `## Phase NN:` section matching the transitioning `phase_key`, When hook fires, Then exits 0 silently
- **AC-002-04**: Given `tool_input.new_string` (Edit) or `tool_input.content` (Write) cannot be parsed as JSON, When hook fires, Then exits 0 with no output
- **AC-002-05**: Given no `phases[phase_key].status` transition to "completed" is detected in the diff, When hook fires, Then exits 0 immediately (short-circuit, no tasks.md read)
- **AC-002-06**: Given any internal exception anywhere in the hook, When thrown, Then caught at top level; hook exits 0

### FR-003: Retry and escalation
**Title**: Provide retry/escalation path with audit trail
**Description**: When the hook blocks, the Phase-Loop Controller MUST retry up to 3 times. After retry exhaustion, it MUST present a user escalation menu with options to manually prompt the orchestrator, skip (with audit), or cancel.
**Confidence**: High

- **AC-003-01**: Given `active_workflow.hook_block_retries["task-completion-gate:{phase_key}"] < 3`, When the block fires, Then the Phase-Loop Controller increments the counter and re-delegates to the phase agent (matches 3f-retry-protocol max=3)
- **AC-003-02**: Given the counter >= 3, When the block fires again, Then the Phase-Loop Controller displays an escalation menu:
  ```
  I have asked the orchestrator to implement these tasks T{id1}, T{id2}, T{id3} but does not look like I am able to make progress.
  Options:
  [M] Manually prompt the orchestrator
  [S] Skip for now
  [C] Cancel workflow
  ```
- **AC-003-03**: Given the user selects `[M]`, When the user's manual guidance is captured, Then the Phase-Loop Controller re-delegates the phase agent with the guidance appended to its prompt and resets `hook_block_retries["task-completion-gate:{phase_key}"]` to 0
- **AC-003-04**: Given the user selects `[S]` and confirms, When the skip is processed, Then the unfinished task IDs are appended to `active_workflow.skipped_tasks[]` with schema `{ phase: "{phase_key}", tasks: ["T017", "T019"], skipped_at: "<ISO-8601>", reason: "user_skip_after_retries" }`, the retry counter is cleared, and the phase is allowed to advance
- **AC-003-05**: Given the user selects `[C]` and confirms, When the cancel is processed, Then the workflow is cancelled per the existing 3f cancellation handler (calls orchestrator cancel action)

### FR-004: Phase-Loop Controller integration
**Title**: Wire the 3f dispatch handler for TASKS INCOMPLETE blocks
**Description**: The `src/claude/commands/isdlc.md` STEP 3f dispatch table MUST recognize "TASKS INCOMPLETE" block messages and route them to a new `3f-task-completion` handler section.
**Confidence**: High

- **AC-004-01**: Given a block message contains `"TASKS INCOMPLETE"`, When the Phase-Loop Controller processes a `blocked_by_hook` status in STEP 3f, Then it matches the TASKS INCOMPLETE dispatch rule and routes to `3f-task-completion`
- **AC-004-02**: Given the `3f-task-completion` handler fires, When building the re-delegation prompt, Then it includes: (a) the current retry count, (b) the full block message body, (c) an explicit imperative naming each unfinished task by ID and description, (d) a reminder that phase_status cannot be set to "completed" until those tasks are `[X]` in tasks.md

## 7. Out of Scope

| Item | Reason | Dependency |
|------|--------|------------|
| New `[SKIP]` marker in tasks.md | Would let phase agents self-skip tasks, violating Article I.5 (user approval required) | — |
| Enforcement for workflow types other than `build` | test-run/test-generate/upgrade use different work models | — |
| Enforcement on phases without task sections (16-quality-loop, 08-code-review, 00-04, upgrade phases) | Phases 16/08 use gate-result enforcement via existing gate-blocker/constitution-validator chain | Separate investigation if gaps suspected |
| Sub-task drill-down | Parent tasks auto-complete via markTaskComplete() per REQ-GH-223; top-level check is sufficient | REQ-GH-223 |
| Article XI enforcement strengthening in Phases 16/08 | Different enforcement unit (gate results, not task plans); requires separate hook design | Separate backlog item if needed |
| Modifying the `[ ]` / `[X]` marker format | Would break existing tasks.md parser and all generators | — |
| Skipped tasks reporting UI / dashboard | Audit data recorded in state.json is sufficient for MVP | Future enhancement |

## 8. MoSCoW Prioritization

| FR | Title | Priority | Rationale |
|----|-------|----------|-----------|
| FR-001 | Pre-completion task check | Must Have | Core hook behavior — without this, no enforcement |
| FR-002 | Fail-open conditions | Must Have | Article X requires fail-open; without this, hook is a liability |
| FR-003 | Retry and escalation | Must Have | Without escalation, user has no override path; workflow deadlocks |
| FR-004 | Phase-Loop Controller integration | Must Have | Without 3f handler, block messages are ignored by controller |

All FRs are Must Have. Shipping without any one of them produces a non-functional feature.
