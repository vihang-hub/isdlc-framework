# Requirements Specification: BUG-0003-fix-plan-tracking

**Bug ID:** BUG-0003
**Artifact Folder:** BUG-0003-fix-plan-tracking
**Created:** 2026-02-09
**Workflow Type:** fix
**Status:** Draft

---

## Bug Summary

Three display bugs in the plan tracking system degrade user experience during SDLC workflows:

1. Task numbering not sequential `[1]`, `[2]`, `[3]` format
2. Completed tasks not scratched out with strikethrough
3. Task list not cleaned up after workflow completion

---

## Fix Requirements

### FIX-001: Sequential Task Numbering

**Description:** The Phase-Loop Controller STEP 2 must create tasks with strictly sequential `[N]` prefixes starting from 1.

**Current behavior:** Tasks may be created without `[N]` prefix or with non-sequential numbering.

**Required behavior:** Each task subject MUST follow format `[N] {base subject}` where N starts at 1 and increments by 1 for each phase in the workflow.

**Files affected:**
- `src/claude/commands/isdlc.md` — STEP 2 (FOREGROUND TASKS)

### FIX-002: Strikethrough on Completion

**Description:** When a phase task completes, its subject must be updated with markdown strikethrough formatting.

**Current behavior:** Completed tasks look identical to pending tasks (no visual differentiation).

**Required behavior:** When a task is marked `completed`, the subject MUST be updated to `~~[N] {base subject}~~` (markdown strikethrough wrapping the entire original subject including the `[N]` prefix).

**Files affected:**
- `src/claude/commands/isdlc.md` — STEP 2 (Phase 01 completion), STEP 3e (subsequent phase completion)

### FIX-003: Task List Cleanup on Workflow Completion

**Description:** After a workflow completes or is cancelled, the task list should reflect final state accurately.

**Current behavior:** Stale tasks from completed workflows persist and confuse users.

**Required behavior:** All remaining tasks should be marked completed with strikethrough at workflow completion. At cancellation, remaining pending tasks should reflect the cancelled state.

**Files affected:**
- `src/claude/commands/isdlc.md` — STEP 4 (FINALIZE)

---

## Acceptance Criteria

### AC-1: Sequential Numbering
- **Given** a fix workflow with 8 phases is initialized
- **When** the Phase-Loop Controller creates tasks in STEP 2
- **Then** tasks are numbered `[1]` through `[8]` sequentially, with no gaps or duplicates

### AC-2: Phase 01 Strikethrough
- **Given** Phase 01 has already completed during init-and-phase-01
- **When** the Phase-Loop Controller creates the task list in STEP 2
- **Then** Phase 01's task subject is `~~[1] Capture bug report (Phase 01)~~` with strikethrough

### AC-3: Subsequent Phase Strikethrough
- **Given** a phase completes and its gate passes during STEP 3
- **When** the Phase-Loop Controller updates the task in STEP 3e
- **Then** the task subject is updated to `~~[N] {base subject}~~` with strikethrough

### AC-4: Workflow Completion Cleanup
- **Given** all phases have completed and finalize runs in STEP 4
- **When** the orchestrator returns from finalize
- **Then** all tasks in the list show completed status with strikethrough subjects

### AC-5: Cancellation State
- **Given** a workflow is cancelled mid-progress
- **When** the cancellation is processed
- **Then** completed phases show strikethrough, remaining phases show their pending state accurately

---

## Constraints

- CON-001: Only markdown files are modified (no hooks, no lib code, no CLI changes)
- CON-002: The TaskCreate/TaskUpdate API behavior cannot be changed (these are Claude Code platform tools)
- CON-003: The fix must work with the existing TaskCreate/TaskUpdate tool interface
- CON-004: Instructions must be unambiguous enough for an LLM agent to follow consistently

---

## Out of Scope

- Changing the TaskCreate/TaskUpdate tool API itself
- Adding new hooks for task tracking
- Modifying state.json schema for task tracking
- UI changes beyond markdown formatting in task subjects

---

## Traceability

| Fix ID | Acceptance Criteria | Files |
|--------|-------------------|-------|
| FIX-001 | AC-1 | isdlc.md STEP 2 |
| FIX-002 | AC-2, AC-3 | isdlc.md STEP 2, STEP 3e |
| FIX-003 | AC-4, AC-5 | isdlc.md STEP 4 |
