# BUG-0033: Implementation Notes

## Summary

Fixed BACKLOG.md completion marking by un-nesting it from Jira sync and wiring it as an independent, unconditional finalize step in both the orchestrator spec and the isdlc.md command spec.

## Root Cause (4 issues fixed)

1. **Step 2.5d nested under Jira sync** -- BACKLOG.md update was sub-step `d)` inside step 2.5 (JIRA STATUS SYNC), causing it to be skipped for non-Jira workflows.
2. **Finalize mode summary omitted BACKLOG.md** -- The finalize pipeline description on line 655 did not mention BACKLOG.md at all.
3. **isdlc.md lacked BACKLOG.md sync section** -- STEP 4 only had Jira sync and GitHub sync sections.
4. **isdlc.md BACKLOG.md mention nested under Jira sync** -- The only BACKLOG.md reference was a sub-bullet under `**Jira sync**`.

## Files Modified

### 1. `src/claude/agents/00-sdlc-orchestrator.md`

**Changes:**
- Removed sub-step `2.5d` (BACKLOG.md update) from under step 2.5 (JIRA STATUS SYNC)
- Added new top-level step `3. **BACKLOG.md COMPLETION (non-blocking):**` with full specification:
  - Runs unconditionally (not dependent on `jira_ticket_id`)
  - Matching strategies: `artifact_folder` slug (primary), `external_id`/`source_id` (fallback), item number prefix
  - Actions: checkbox `[x]`, `**Completed:** {date}` sub-bullet, move to `## Completed` section
  - Auto-creates `## Completed` if missing
  - Silent skip if BACKLOG.md does not exist
  - Non-blocking with Article X reference
- Renumbered subsequent steps: old 3->4 (merge conflict), old 4->5 (post-merge), old 5->6 (announce)
- Updated finalize mode summary to include `BACKLOG.md completion` in the pipeline sequence
- Updated Jira sync CRITICAL cross-reference from "step 2.6" to "step 3"

### 2. `src/claude/commands/isdlc.md`

**Changes:**
- Removed BACKLOG.md sub-bullet from under `**Jira sync**` section
- Added new `**BACKLOG.md sync**` section as a peer to `**Jira sync**` and `**GitHub sync**` in STEP 4
- The new section specifies: matching strategy, checkbox marking, date sub-bullet, block move, auto-create, non-blocking
- Updated prose from "After Jira sync" to "After sync steps"

### 3. `src/claude/hooks/lib/three-verb-utils.cjs`

**No changes required.** The existing `updateBacklogMarker()` function handles the marker swap. The full BACKLOG.md completion logic (date sub-bullet, section move, auto-create) is spec-level instruction for agents to interpret and execute during finalize. The trivial tier T8 step continues to use `updateBacklogMarker("x")` as before.

## Test Results

- **27/27 tests passing** (0 failures)
- 10 previously-failing SV/SS tests now pass
- 8 regression tests (RT) remain green
- 9 other tests continue passing
- Full hooks suite: 2475/2482 passing (7 pre-existing failures unrelated to this change)

## TDD Iterations

| Iteration | Action | Result |
|-----------|--------|--------|
| 1 | Added step 2.6, updated mode summary, added isdlc.md section | 26/27 pass (SV-01 fails: regex boundary issue) |
| 2 | Renumbered 2.6 to 3, bumped subsequent steps | 27/27 pass |

## Traceability

- FR-001: Matching strategy (artifact_folder, external_id/source_id, item number)
- FR-002: Checkbox `[x]` marking
- FR-003: `**Completed:** {date}` sub-bullet
- FR-004: Move to `## Completed` section, auto-create if missing
- FR-005: Non-blocking execution (warning on failure)
- FR-006: Top-level finalize step in orchestrator + parallel sync section in isdlc.md
