# Requirements Specification: REQ-GH-217

## 1. Business Context

The iSDLC Phase-Loop Controller currently shows task progress by editing `tasks.md` on disk (`[ ] → [X]`), which surfaces as raw file diffs to the user. Meanwhile, phase-level progress uses Claude Code's native TaskCreate/TaskUpdate and renders as a clean visual checklist. The task-level progress should use the same mechanism for a consistent, readable experience.

**Success metric**: During build execution, individual task progress is visible as TaskCreate entries (not file diffs), and a stable-order summary prints at each phase boundary.

**Stakeholders**: iSDLC framework users (developers running build workflows).

## 2. Stakeholders and Personas

**Primary user**: Developer running `/isdlc build` — sees the task bar during execution, wants clear progress visibility without raw diff noise.

## 3. User Journeys

**Entry**: User starts a build workflow. Phase-Loop Controller enters Phase 06 with task-level dispatch.
**Flow**: Each main task appears in the task bar as a pending item. As tasks complete, they get checked off (strikethrough). When the phase finishes, a formatted summary table prints showing all tasks in stable order with completion status.
**Exit**: Phase summary printed, task entries cleaned up, next phase begins with fresh task bar.

## 4. Technical Context

- Claude Code's TaskCreate/TaskUpdate sorts by status (completed float to top) — no `position` parameter available
- Sub-Task Creation Protocol (GH-223) already has `show_subtasks_in_ui` config
- STEP 3d-tasks.f currently deletes per-task TaskCreate entries after each tier — this must change
- tasks.md continues as the traceability source of truth on disk

## 5. Quality Attributes and Risks

| Attribute | Priority | Threshold |
|-----------|----------|-----------|
| Usability | High | Task progress visible without reading file diffs |
| Consistency | High | Same TaskCreate UX as phase-level items |
| Maintainability | Medium | Formatter is a pure function with no side effects |

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Task bar gets noisy with 15+ items | Medium | Low | Only show main tasks (not sub-tasks); sub-task detail in phase summary |
| Reordering confuses users | Medium | Low | Numbering preserves logical order; phase summary provides stable view |

## 6. Functional Requirements

### FR-001: Show main tasks as TaskCreate entries during phase execution
**Confidence**: High

- **AC-001-01**: Given a phase with task-level dispatch, when tasks are dispatched, then a TaskCreate entry is created for each top-level task (not sub-tasks)
- **AC-001-02**: Given a task completes, when TaskUpdate is called, then the entry is marked completed with strikethrough

### FR-002: Persist task entries through the phase
**Confidence**: High

- **AC-002-01**: Given a tier completes, when the next tier starts, then previous tier's TaskCreate entries remain visible (no deletion)
- **AC-002-02**: Given a phase completes, when the phase summary prints, then all TaskCreate entries for that phase are deleted

### FR-003: Print phase summary at phase boundary
**Confidence**: High

- **AC-003-01**: Given a phase completes, when STEP 3f runs, then a formatted summary table is printed showing all tasks in stable order with status, grouped by category, with progress counts

### FR-004: File upstream feature request
**Confidence**: High

- **AC-004-01**: Given the implementation is complete, then a GitHub issue is filed on anthropics/claude-code requesting stable task ordering / position parameter

## 7. Out of Scope

| Item | Reason |
|------|--------|
| Changing Claude Code's task bar rendering | Upstream platform concern |
| Plan Mode / EnterPlanMode integration | Evaluated and rejected — Plan Mode is for planning, not execution tracking |
| Sub-task visibility in the task bar | Sub-tasks only shown in phase summary |
| Cross-phase task persistence | User confirmed cleanup at phase boundary |

## 8. MoSCoW Prioritization

| FR | Title | Priority | Rationale |
|----|-------|----------|-----------|
| FR-001 | Show main tasks as TaskCreate entries | Must Have | Core of the feature |
| FR-002 | Persist task entries through the phase | Must Have | Required for FR-001 to be useful |
| FR-003 | Print phase summary at phase boundary | Must Have | Stable-order summary user explicitly asked for |
| FR-004 | File upstream feature request | Should Have | Upstream request, not blocking |
