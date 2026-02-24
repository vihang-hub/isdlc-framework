# Bug Report: BUG-0033-GH-11

**Bug ID:** BUG-0033
**External Link:** https://github.com/vihang-hub/isdlc-framework/issues/11
**External ID:** GH-11
**Reported:** 2026-02-23
**Severity:** Medium
**Component:** Orchestrator finalize / isdlc.md phase-loop controller

---

## Summary

BACKLOG.md completion marking is specified in the orchestrator finalize step (Section 3a, step 2.5d of `00-sdlc-orchestrator.md`) but not implemented. After a workflow completes and merges to main, BACKLOG.md items remain unchecked in the `## Open` section. Developers must manually mark items as done.

---

## Expected Behavior

When a workflow finishes (finalize mode), the framework should:

1. Locate the matching BACKLOG.md entry using the external ID (e.g., `#11`, `PROJ-1234`), artifact folder slug (e.g., `REQ-0021-...`), or item number
2. Change `[ ]` to `[x]`
3. Add a `**Completed:** {date}` sub-bullet (ISO date, e.g., `2026-02-23`)
4. Move the entire item block (including all sub-bullets) from `## Open` to `## Completed` section

**Example (before, in `## Open`):**
```markdown
- 2.3 [ ] T7: Agent prompt boilerplate extraction -> [requirements](docs/requirements/REQ-0021-...)
  - Move remaining shared sections to CLAUDE.md
  - **Impact**: 2-3% speedup
```

**Example (after, moved to `## Completed`):**
```markdown
- 2.3 [x] T7: Agent prompt boilerplate extraction -> [requirements](docs/requirements/REQ-0021-...)
  - **Completed:** 2026-02-17
```

---

## Actual Behavior

BACKLOG.md is never modified during finalize. After a workflow completes successfully and merges to main, items remain unchecked (`[ ]`) in the `## Open` section indefinitely. All completion marking is performed manually.

---

## Reproduction Steps

1. Start any fix or feature workflow for a BACKLOG.md item (e.g., `/isdlc fix "some bug"`)
2. Complete all phases successfully (01 through 08)
3. The finalize step merges the branch to main
4. Open BACKLOG.md -- the item remains `[ ]` in `## Open`

---

## Root Cause Analysis

The orchestrator specification (`00-sdlc-orchestrator.md`, Section 3a, step 2.5d) defines the BACKLOG.md update behavior, but:

1. **Finalize mode implementation gap**: The finalize mode behavior (line 655 of the orchestrator) only performs: merge branch, `collectPhaseSnapshots()`, state pruning, `workflow_history` population, and `active_workflow` clearing. The BACKLOG.md update step is not included in this sequence.

2. **Misplaced specification**: Step 2.5d is nested under the Jira sync block (step 2.5c) but has no conditional dependency on Jira. It should execute for ALL workflows regardless of Jira availability.

3. **Existing utility not called**: The `updateBacklogMarker()` utility exists in `isdlc.md` (line 243) and is called during the build finalize step (T8, line 1223 in `isdlc.md`), but the orchestrator finalize mode does not invoke it.

4. **Delegation gap**: `isdlc.md` STEP 4 (line 2231) delegates finalize to the orchestrator, and the orchestrator's finalize mode does not include the BACKLOG.md update in its execution sequence.

---

## Files Affected

| File | Role | Details |
|------|------|---------|
| `src/claude/agents/00-sdlc-orchestrator.md` | Specification | Section 3a step 2.5d specifies behavior but finalize mode (line 655) does not implement it |
| `src/claude/commands/isdlc.md` | Phase-loop controller | STEP 4 finalize delegates to orchestrator; BACKLOG.md update falls through the gap |

---

## Related Items

- GitHub Issue #12: Auto-move completed BACKLOG.md headings when all items are done (extends this fix)
- GitHub Issue #13: Jira updateStatus at finalize (parallel concern for Jira tickets)
- GitHub Issue #58: GitHub issue label sync (already implemented for GitHub issue close)

---

## Environment

- iSDLC Framework: 0.1.0-alpha
- Runtime: Node.js 20+
- Platform: macOS / Linux (darwin)
