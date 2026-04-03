# Requirements Specification: Post-finalize validation hook

**Slug**: REQ-GH-219-post-finalize-validation-hook
**Source**: GitHub Issue #219
**Type**: Feature (REQ)
**Created**: 2026-04-03

---

## 1. Business Context

When the orchestrator agent returns early during STEP 4 (FINALIZE) of the Phase-Loop Controller, finalization steps are silently skipped -- state.json not cleaned up, caches not rebuilt, contracts not regenerated, indexes not refreshed. There is no validation or retry mechanism. The workflow is considered done even if half the cleanup was missed.

Discovered during GH-218 build when the orchestrator returned early during finalization. Visible steps (git merge, GitHub close, BACKLOG.md) were handled manually but internal bookkeeping (state.json cleanup, index refresh) was missed.

**Success metric**: Zero silent finalization failures -- every step is tracked, retried on failure, and reported.

## 2. Stakeholders and Personas

- **Primary**: iSDLC framework developers (dogfooding) -- need reliable workflow completion
- **Secondary**: End users of iSDLC -- need hackable finalization config for their projects

## 3. User Journeys

**Happy path**: User completes a build workflow. Phase-Loop Controller runs the finalize checklist. Each step executes, passes, and is marked complete. User sees per-step progress. Workflow ends cleanly.

**Failure path**: A finalize step fails (e.g., cache rebuild). The runner retries once. If still failing and the step is non-critical (fail_open: true), it warns and continues. If critical (fail_open: false), it halts and escalates to the user.

**Customization path**: User edits `.isdlc/config/finalize-steps.md` to add a project-specific step (e.g., deploy docs, notify Slack). On next workflow completion, the runner picks up the new step.

## 4. Technical Context

- Phase-Loop Controller currently delegates finalization to the sdlc-orchestrator agent, which can return early
- `workflow-finalize.cjs` in antigravity already has merge + state cleanup logic but is provider-specific
- #220 (task-level delegation) established the pattern: break work into discrete tasks, dispatch individually, track and retry per-task
- `task-reader.js` parses tasks.md format; `task-dispatcher.js` implements the retry loop
- `.isdlc/config/` is the home for user-configurable project files (alongside `workflows.json`)

## 5. Quality Attributes and Risks

| Attribute | Priority | Threshold |
|-----------|----------|-----------|
| Reliability | Critical | Every finalize step tracked and retried |
| Performance | High | Full finalization within 60 seconds |
| Hackability | High | Users can add/remove/reorder steps via markdown |
| Portability | High | Core runner has no provider-specific dependencies |

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| task-reader.js extension breaks existing parsing | Low | High | Additive metadata parsing; existing tests catch regressions |
| Antigravity refactor breaks Codex provider | Medium | Medium | Extract functions first, keep workflow-finalize.cjs as thin wrapper |
| Provider-specific steps not portable | Low | Low | `type: provider` annotation; runner skips non-matching steps |

## 6. Functional Requirements

### FR-001: Finalize step checklist config file
**Confidence**: High

The framework ships a default `finalize-steps.default.md` at `src/core/finalize/`. User-editable copy lives at `.isdlc/config/finalize-steps.md`. Uses the same task list format as `docs/isdlc/tasks.md` (parsed by `task-reader.js`).

- **AC-001-01**: Default template contains all current finalization steps (merge, external sync, state cleanup, task cleanup, index refresh, cache rebuild, contract regen, memory embeddings, code embeddings)
- **AC-001-02**: Each step has `critical` / `fail_open` / `max_retries` / `type` metadata encoded via pipe annotations (e.g., `| critical: true, fail_open: true`)
- **AC-001-03**: User can add, remove, or reorder steps by editing the file

### FR-002: Finalize checklist runner (core module)
**Confidence**: High

A provider-neutral runner in `src/core/finalize/` that reads the checklist, executes steps sequentially, tracks pass/fail, retries failures. Reuses the #220 task dispatch/retry pattern.

- **AC-002-01**: Runner reads `.isdlc/config/finalize-steps.md`, falls back to default if missing
- **AC-002-02**: Each step is executed individually -- no bundling
- **AC-002-03**: Failed steps are retried up to `max_retries` (default 1)
- **AC-002-04**: Critical steps (`fail_open: false`) halt finalization and escalate to user on failure
- **AC-002-05**: Non-critical steps (`fail_open: true`) warn and continue on failure
- **AC-002-06**: Runner returns a structured result with per-step status (pass/fail/skipped/retried)

### FR-003: Phase-Loop Controller STEP 4 rewrite
**Confidence**: High

Replace orchestrator delegation with direct calls to the finalize checklist runner.

- **AC-003-01**: The Phase-Loop Controller calls the core runner instead of delegating to sdlc-orchestrator for finalize
- **AC-003-02**: Per-step progress is visible to the user (step name + pass/fail)
- **AC-003-03**: Completion dashboard (STEP 3-dashboard) still renders before finalization begins

### FR-004: Installer and updater support
**Confidence**: High

- **AC-004-01**: `init-project.sh` copies default `finalize-steps.md` to `.isdlc/config/` during setup
- **AC-004-02**: The updater preserves user-modified `finalize-steps.md` during framework upgrades
- **AC-004-03**: If the file is missing at runtime, the runner copies the default and continues

### FR-005: Migrate common finalize logic to src/core/
**Confidence**: High

- **AC-005-01**: Branch merge, state cleanup (move `active_workflow` to `workflow_history`, clear transients), and external sync logic are extracted from `workflow-finalize.cjs` into reusable functions in `src/core/finalize/`
- **AC-005-02**: `workflow-finalize.cjs` (antigravity) is refactored to call the core functions
- **AC-005-03**: Provider adapters call the same core functions

### FR-006: User-facing documentation
**Confidence**: High

- **AC-006-01**: README updated with a Configuration section listing all `.isdlc/config/` files including `finalize-steps.md`
- **AC-006-02**: Each config file entry has a one-line description of what it controls
- **AC-006-03**: `finalize-steps.md` default template includes inline comments explaining how to customize

## 7. Out of Scope

| Item | Reason |
|------|--------|
| Parallel execution of finalize steps | Sequential is sufficient; complexity not justified |
| UI for editing finalize steps | Users edit the markdown directly |
| Finalize step hooks (pre-step / post-step callbacks) | Over-engineering for current needs |

## 8. MoSCoW Prioritization

| FR | Title | Priority | Rationale |
|----|-------|----------|-----------|
| FR-001 | Config file | Must Have | Foundation for the feature |
| FR-002 | Checklist runner | Must Have | Core execution engine |
| FR-003 | Phase-Loop Controller rewrite | Must Have | Wires the runner into the workflow |
| FR-004 | Installer/updater support | Must Have | Ensures config file exists for users |
| FR-005 | Migrate logic to core | Should Have | Architectural improvement, not blocking |
| FR-006 | User-facing documentation | Should Have | Discoverability for end users |

## Non-Functional Requirements

- **NFR-001**: Finalization must complete within 60 seconds for the default step list
- **NFR-002**: Step execution is fail-open per Article X -- a runner crash must not block the user's terminal
- **NFR-003**: Provider-neutral -- core runner has no Claude Code or Codex dependencies
- **NFR-004**: Reuse the task list format (tasks.md syntax parsed by `src/core/tasks/task-reader.js`) and the retry loop mechanism (per-task dispatch, retry counter, max retries, escalation) as implemented in #220. No new parsing or retry infrastructure -- extend existing modules if needed.
