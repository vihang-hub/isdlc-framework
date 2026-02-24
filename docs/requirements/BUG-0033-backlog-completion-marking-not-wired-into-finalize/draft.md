# BUG-0033: BACKLOG.md Completion Marking Not Wired Into Standard Workflow Finalize

**Source**: GitHub Issue #11
**Severity**: Medium
**Component**: Orchestrator finalize / isdlc.md phase-loop controller

## Problem

The orchestrator's finalize step (Section 3a, step 2.5d) specifies that after a workflow completes:
1. Find the BACKLOG.md item by `jira_ticket_id` or external reference
2. Change `[ ]` to `[x]`
3. Add `**Completed:** {date}` sub-bullet
4. Move the entire item block to the `## Completed` section

None of this is implemented. After a workflow completes successfully and merges to main, BACKLOG.md remains unchanged. Developers must manually mark items as done.

## Expected Behavior

When a workflow finishes (finalize mode), the framework should:
- Locate the matching BACKLOG.md entry using the external ID (e.g., `#11`, `PROJ-1234`) or artifact folder reference
- Mark it `[x]`
- Add a completion date sub-bullet
- Move the item to the `## Completed` section

## Actual Behavior

BACKLOG.md is never modified during finalize. All completion marking is done manually.

## Reproduction

1. Start any fix or feature workflow for a BACKLOG.md item
2. Complete all phases successfully
3. Observe that finalize merges the branch but does not update BACKLOG.md

## Files Likely Affected

- `src/claude/commands/isdlc.md` — finalize step (STEP 4 or equivalent)
- `src/claude/agents/00-sdlc-orchestrator.md` — Section 3a step 2.5d (specification exists but not implemented)
- `src/claude/hooks/common.cjs` — may need BACKLOG.md parsing utility functions
- `lib/utils/fs-helpers.js` — possible utility location for BACKLOG.md manipulation

## Related Items

- #12: Auto-move completed BACKLOG.md headings when all items are done (extends this)
- #13: Jira updateStatus at finalize (parallel concern for Jira tickets)
- #58: GitHub issue label sync (already implemented for GitHub issue close)
