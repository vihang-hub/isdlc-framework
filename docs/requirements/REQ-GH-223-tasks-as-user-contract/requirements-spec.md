# Requirements Specification: Tasks as User Contract

**Item**: REQ-GH-223
**Source**: GitHub #223
**Status**: Analyzed
**Confidence**: High (user-confirmed in roundtable)

---

## 1. Business Context

Tasks are a contract with the user. After the user confirms requirements, architecture, design, and task list during analysis, the task list becomes their mental model of what will be implemented. The framework must honour this contract by showing progress on confirmed tasks, ensuring every analysis artifact maps to at least one task, and generating tasks once — not twice.

**Stakeholders**: Framework end users (developers using iSDLC to manage projects)
**Success Metric**: Every FR, AC, and blast radius file has a covering task before the user sees the task list; no redundant task generation at build start.

## 2. User Journeys

**Primary User**: Developer using iSDLC analyze → build workflow

1. User runs `/analyze` on a backlog item
2. Roundtable produces requirements, architecture, design
3. Framework generates task list with quality gate validation
4. User sees validated task list with human-readable traceability — accepts or amends
5. User runs `/build` — framework copies tasks.md, hydrates Claude Task tool
6. Phase agents refine parent tasks into sub-tasks visible in tasks.md and optionally in Claude Task tool
7. User tracks progress via both tasks.md and Claude Task tool entries

## 3. Functional Requirements

### FR-001: Task Quality Gate
**Confidence**: High
**Priority**: Must Have

Before presenting the task list to the user (PRESENTING_TASKS confirmation state), the framework validates task coverage against all FRs, ACs, and blast radius files. If gaps are found, the framework re-runs task generation with the specific gaps identified.

- **AC-001-01**: Given a generated task plan, when `validateTaskCoverage()` is called with the plan, requirements-spec, and impact-analysis, then it returns a structured result with covered items, uncovered items, and orphan tasks.
- **AC-001-02**: Given uncovered FRs or ACs in the validation result, when the roundtable enters PRESENTING_TASKS, then it re-runs task generation with the gap list before presenting to the user.

### FR-002: Single-Generation Model
**Confidence**: High
**Priority**: Must Have

Analysis produces the authoritative tasks.md. Build copies it to `docs/isdlc/tasks.md` without regeneration. The `3e-plan` step in the Phase-Loop Controller is removed.

- **AC-002-01**: Given a completed analysis with tasks.md in the artifact folder, when build starts, then BUILD-INIT COPY copies it to `docs/isdlc/tasks.md` without invoking ORCH-012.
- **AC-002-02**: Given no tasks.md exists in the artifact folder at build start, then the build fails with an error indicating analysis must produce tasks.

### FR-003: Sub-Task Model
**Confidence**: High
**Priority**: Must Have

tasks.md supports parent tasks (TNNN) and child sub-tasks (TNNNABC). Phase agents create child tasks linked to parents via `addSubTask()`. task-reader parses both ID formats and derives parentId. Parent tasks auto-complete when all children are marked done.

- **AC-003-01**: Given a parent task T005, when a phase agent calls `addSubTask(tasksPath, 'T005', description, metadata)`, then a new entry T005A is written to tasks.md in the parent's phase section.
- **AC-003-02**: Given sub-tasks T005A, T005B, T005C all marked `[X]`, when `markTaskComplete()` processes the last sub-task, then parent T005 is auto-marked `[X]`.
- **AC-003-03**: Given tasks.md with TNNN and TNNNABC entries, when `readTaskPlan()` parses the file, then each task has `parentId` (null for parents, parent ID for children) and `children[]` (list of child IDs for parents).

### FR-004: Claude Task Tool Bridge
**Confidence**: High
**Priority**: Must Have

Build start hydrates Claude Task tool from tasks.md parent tasks. Sub-task TaskCreate entries are created conditionally based on configuration. Completions sync back to tasks.md.

- **AC-004-01**: Given tasks.md with parent tasks, when the Phase-Loop Controller runs STEP 2, then it creates one TaskCreate entry per parent task from `readTaskPlan()` instead of from a hardcoded phase table.
- **AC-004-02**: Given a sub-task marked complete by a phase agent, when the completion is processed, then the corresponding TaskCreate entry is updated and the tasks.md checkbox is toggled.

### FR-005: Sub-Task Display Configuration
**Confidence**: High
**Priority**: Should Have

A `show_subtasks_in_ui` setting in `.isdlc/config/config.json` controls whether sub-tasks appear as Claude Task tool entries. Default is true. On first sub-task creation, a one-time hint message tells the user where to configure this.

- **AC-005-01**: Given `show_subtasks_in_ui: true` in config.json, when a phase agent creates a sub-task, then a Claude TaskCreate entry is created for it.
- **AC-005-02**: Given `show_subtasks_in_ui: false` in config.json, when a phase agent creates a sub-task, then no Claude TaskCreate entry is created (tasks.md entry is still written).
- **AC-005-03**: Given `subtask_hint_shown: false` in state.json, when the first sub-task TaskCreate entry is created, then a message is displayed: "Sub-tasks are shown by default. To configure, edit `.isdlc/config/config.json`" and `subtask_hint_shown` is set to true.

### FR-006: Traceability Enforcement Hook
**Confidence**: High
**Priority**: Must Have

A build-phase hook blocks phase completion if any FR, AC, or blast radius file lacks a covering task.

- **AC-006-01**: Given a task plan where FR-003 has no covering task, when the traceability enforcement hook runs at phase gate, then it blocks with a message listing the uncovered items.

### FR-007: Constitution Article I.5 Compliance
**Confidence**: High
**Priority**: Must Have

Task plans are binding specifications per Article I requirement 5. Phase agents may refine into sub-tasks but must not alter parent task scope.

- **AC-007-01**: Given a parent task T005 with description "Design test strategy for FR-001", when a phase agent processes it, then the parent description and scope remain unchanged — only sub-tasks are added.

### FR-008: Human-Readable Traceability Presentation
**Confidence**: High
**Priority**: Must Have

Traceability matrix includes both IDs and descriptions. Driven by `traceability.template.json`. Each confirmation domain renders the same structure scoped to its domain.

- **AC-008-01**: Given the traceability template, when the requirements confirmation renders the matrix, then each row shows FR ID, FR description, AC IDs with descriptions, task IDs with descriptions, and coverage percentage.
- **AC-008-02**: Given the traceability template, when any confirmation domain renders the matrix, then the column structure matches `traceability.template.json` — consistent across all domains.

## 4. Non-Functional Requirements

| NFR | Description | Threshold |
|-----|-------------|-----------|
| NFR-001 | Task validation must not add >2s to the confirmation flow | <2s for validateTaskCoverage() |
| NFR-002 | Sub-task creation must not block phase agent execution | addSubTask() <500ms |
| NFR-003 | Backward compatibility with existing tasks.md v2.0 format | task-reader falls back gracefully on v2.0 files |

## 5. Out of Scope

| Item | Reason |
|------|--------|
| Codex TaskCreate equivalent | Codex provider uses projection bundles, not Claude Task tool — separate ticket |
| Epic tier task decomposition | Epic tier is deferred (CON-003) |
| Nested sub-tasks (sub-sub-tasks) | TNNNABC is one level deep; deeper nesting not needed |
| More than 26 sub-tasks per parent | Edge case — extend to TNNNAA if ever needed |

## 6. MoSCoW Prioritization

| FR | Title | Priority |
|----|-------|----------|
| FR-001 | Task Quality Gate | Must Have |
| FR-002 | Single-Generation Model | Must Have |
| FR-003 | Sub-Task Model | Must Have |
| FR-004 | Claude Task Tool Bridge | Must Have |
| FR-005 | Sub-Task Display Configuration | Should Have |
| FR-006 | Traceability Enforcement Hook | Must Have |
| FR-007 | Constitution Article I.5 Compliance | Must Have |
| FR-008 | Human-Readable Traceability | Must Have |
