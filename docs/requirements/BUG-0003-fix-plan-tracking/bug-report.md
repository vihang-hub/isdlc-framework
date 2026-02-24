# Bug Report: BUG-0003-fix-plan-tracking

**Bug ID:** BUG-0003-MAN
**External Link:** None (internal framework bug)
**External ID:** MAN
**Reported:** 2026-02-09
**Severity:** Medium
**Component:** Phase-Loop Controller (isdlc.md) + Orchestrator Task Management (00-sdlc-orchestrator.md)

---

## Summary

The plan tracking display has three distinct bugs that degrade workflow visibility for users: (1) task numbering is not sequential `[1]`, `[2]`, `[3]` format, (2) completed tasks are not visually scratched out with strikethrough as the workflow progresses, and (3) the task list is not cleaned up after workflow completion, giving a wrong/stale status.

---

## Expected Behavior

1. **Sequential numbering**: When the Phase-Loop Controller creates tasks in STEP 2, each task should have a sequential `[N]` prefix: `[1] Capture requirements (Phase 01)`, `[2] Design architecture (Phase 02)`, etc.

2. **Strikethrough on completion**: When a phase completes (STEP 3e), the task subject should be updated with markdown strikethrough: `~~[1] Capture requirements (Phase 01)~~` so the user can visually distinguish completed vs pending tasks.

3. **Clean task list on completion**: After the workflow completes (STEP 4 finalize), the task list should reflect final state accurately. Stale tasks from completed workflows should not persist and confuse users about current status.

---

## Actual Behavior

1. **Numbering inconsistent**: Tasks are created without proper `[N]` sequential numbering prefix, or the numbering does not follow a strict 1, 2, 3... sequence.

2. **No visible strikethrough**: When tasks complete, the subject is not updated with `~~strikethrough~~` formatting. Tasks that should appear crossed out look identical to pending tasks.

3. **Stale tasks remain**: After a workflow completes or is cancelled, the task list is not cleaned up, leaving completed/stale tasks that misrepresent current project status.

---

## Reproduction Steps

1. Run `/sdlc feature "any feature description"` to start a feature workflow
2. Observe the task list created in STEP 2 of the Phase-Loop Controller
3. Notice task numbering may not follow strict `[1]`, `[2]`, `[3]` format
4. Let Phase 01 complete and observe the task update in STEP 3e
5. Notice the completed task subject is NOT wrapped in `~~strikethrough~~`
6. Complete the entire workflow or cancel it
7. Notice stale tasks remain in the task list

---

## Root Cause Analysis (Preliminary)

### Bug 1: Numbering
The Phase-Loop Controller in `isdlc.md` STEP 2 specifies `[N]` prefix format but the instructions may not be clear enough for the executing agent to consistently apply sequential numbering starting from 1.

### Bug 2: Strikethrough
STEP 2 says to mark Phase 01's task as completed with strikethrough: "Update both `status` to `completed` AND `subject` to `~~[1] {base subject}~~`". STEP 3e says similar for subsequent phases. However, the TaskUpdate tool may not support markdown in the subject field, or the instructions are ambiguous about the exact format.

### Bug 3: Cleanup
STEP 4 (finalize) does not include explicit instructions to clean up/remove completed tasks or mark them in a way that prevents confusion. The TaskUpdate tool's `completed` status alone may not be sufficient for visual clarity.

---

## Affected Files

1. `src/claude/commands/isdlc.md` — Phase-Loop Controller STEP 2, STEP 3, STEP 4
2. `src/claude/agents/00-sdlc-orchestrator.md` — Task management sections (Progress Tracking)

---

## Environment

- iSDLC Framework v0.1.0-alpha
- Claude Code (Claude Opus 4.6)
- macOS Darwin 25.2.0
- Node.js 18+

---

## Fix Requirement

The fix must ensure:
1. Tasks are created with strict sequential `[N]` numbering starting from 1
2. Completed tasks have their subjects updated with `~~strikethrough~~` formatting
3. Workflow completion/cancellation results in a clean task state
