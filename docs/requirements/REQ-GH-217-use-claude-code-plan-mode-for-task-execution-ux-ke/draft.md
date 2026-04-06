# Use Claude Code Plan Mode for task execution UX -- keep tasks.md for traceability metadata

**Source**: GitHub Issue #217
**Type**: Feature / Enhancement

## Problem

The iSDLC tasks.md reimplements task list UX that Claude Code's native Plan Mode already provides (ordered steps, checkboxes, progress). This creates two parallel systems -- the user sees both the Claude Code task bar and any tasks.md references, which is confusing.

## Proposal

Use Claude Code's native Plan Mode (`EnterPlanMode`) as the execution mechanism for the user-visible task progress UX. Keep `tasks.md` on disk as the structured metadata layer for capabilities Plan Mode doesn't support:

### Use Plan Mode for:
- User-visible task checklist and progress
- Checkbox toggle as tasks complete
- Current step highlighting

### Keep tasks.md for:
- FR/AC traceability (`traces:` annotations)
- File-level blast radius (`files:` CREATE/MODIFY)
- Dependency graph (`blocked_by`/`blocks`, critical path)
- Phase-aware categories (setup, core, unit_tests, wiring_claude, wiring_codex, cleanup)
- Subagent injection (TASK_CONTEXT into delegation prompts)
- Cross-session persistence and resume

### Integration approach
- Phase-Loop Controller calls `EnterPlanMode` with tasks for the current phase (extracted from tasks.md)
- Claude Code manages the checkbox UX natively
- tasks.md remains the source of truth for traceability, dependencies, and blast radius
- On session resume, tasks.md is read to reconstruct Plan Mode state

## Complexity

Medium -- touches Phase-Loop Controller task creation (STEP 2), task update logic, and plan-surfacer hook interaction.
