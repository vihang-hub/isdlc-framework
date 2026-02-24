# Implementation Notes: BUG-0034-GH-13

**Bug:** Jira updateStatus at Finalize Not Implemented -- Tickets Not Transitioned to Done
**Phase:** 06-implementation
**Date:** 2026-02-23

---

## Summary

Replaced the conceptual `updateStatus()` method with concrete Atlassian MCP tool calls in both specification files. Fixed the field name mismatch (`jira_ticket_id` -> `external_id` + source check). Updated the finalize mode summary to include Jira sync in the execution sequence.

## Changes Made

### 1. `src/claude/agents/00-sdlc-orchestrator.md` -- Step 2.5 Replacement

**Before:** Conceptual `updateStatus(jira_ticket_id, "Done")` with no executable MCP procedure.

**After:** Six-step concrete MCP procedure:
- (a) Read `external_id` and `source` from `active_workflow`
- (b) Skip if source is not "jira" or external_id absent
- (c-i) Call `getAccessibleAtlassianResources` for cloudId resolution
- (c-ii) Call `getTransitionsForJiraIssue(cloudId, external_id)` for transition discovery
- (c-iii) Match transition name: "Done" > "Complete" > "Resolved" > "Closed" > status category "done"
- (c-iv) Handle no terminal transition found (warning + failed)
- (c-v) Call `transitionJiraIssue(cloudId, external_id, { id: targetTransitionId })` for execution
- (c-vi) Record success as `jira_sync_status = "synced"`
- (d) Record `jira_sync_status` in `workflow_history` entry

Every sub-step has error handling that sets `jira_sync_status = "failed"` and continues to step 3 (non-blocking per Article X).

### 2. `src/claude/agents/00-sdlc-orchestrator.md` -- Finalize Mode Summary

**Before:** `merge branch -> BACKLOG.md completion -> collectPhaseSnapshots...`

**After:** `merge branch -> Jira status sync (non-blocking, via getAccessibleAtlassianResources + getTransitionsForJiraIssue + transitionJiraIssue) -> GitHub sync -> BACKLOG.md completion -> collectPhaseSnapshots...`

Also added `jira_sync_status if Jira-backed` to the workflow_history fields list.

### 3. `src/claude/commands/isdlc.md` -- STEP 4 Jira Sync Section

**Before:**
```
**Jira sync** (if active_workflow.jira_ticket_id exists):
- Calls updateStatus(jira_ticket_id, "Done") via Atlassian MCP
```

**After:**
```
**Jira sync** (if active_workflow.source === "jira" and active_workflow.external_id exists):
- Call getAccessibleAtlassianResources to resolve cloudId
- Call getTransitionsForJiraIssue(cloudId, external_id)
- Match transition name: "Done" > "Complete" > "Resolved" > "Closed" > category "done"
- Call transitionJiraIssue(cloudId, external_id, transition: { id: targetTransitionId })
- On success: jira_sync_status = "synced"
```

### 4. `src/claude/hooks/tests/test-bug-0033-backlog-finalize-spec.test.cjs` -- Regression Test Update

Updated RT-02 regex to match the corrected field name (`external_id` + source check instead of `jira_ticket_id`). The test's semantic intent (verify non-Jira workflows skip Jira sync) is preserved.

## Root Causes Addressed

| Root Cause | Fix |
|-----------|-----|
| PRIMARY: Conceptual `updateStatus()` never translated to MCP calls | Replaced with concrete 3-tool MCP procedure |
| SECONDARY: Field name mismatch (`jira_ticket_id` vs `external_id`) | Changed all finalize references to use `external_id` + source check |
| CONTRIBUTING: Finalize mode summary omits Jira sync | Added Jira sync to finalize mode summary |

## Test Results

- **27 BUG-0034 tests**: All passing (14 SV + 5 SS + 7 RT + 1 setup)
- **27 BUG-0033 tests**: All passing (including updated RT-02)
- **26 BUG-0032 tests**: All passing (no changes needed)
- **Total**: 80 tests, 0 failures, 0 regressions

## Design Decisions

1. **Option A chosen for field name alignment**: Changed finalize-side references from `jira_ticket_id` to `external_id` + `source === "jira"` check (as recommended in trace analysis). This avoids schema changes and uses existing fields.

2. **Status category "done" fallback**: Added as the last-resort matching mechanism for non-standard Jira workflows (per ASM-002).

3. **Consistent error handling**: Every sub-step follows the same pattern: try -> on failure: log WARNING, set jira_sync_status = "failed", continue to step 3. This ensures Article X compliance.

## Traceability

| Requirement | ACs Covered | Implementation |
|-------------|------------|----------------|
| FR-001 | AC-001-01 through AC-001-04 | Step 2.5 c-i through c-iv |
| FR-002 | AC-002-01 through AC-002-03 | Step 2.5 c-v, c-vi, d |
| FR-003 | AC-003-01, AC-003-02 | Step 2.5 c-i |
| FR-004 | AC-004-01, AC-004-02 | Step 2.5 a-b, each sub-step error handling |
| FR-005 | AC-005-01 through AC-005-03 | Step 2.5 d |
| FR-006 | AC-006-01, AC-006-02 | Both spec files updated |
| FR-007 | AC-007-01 through AC-007-03 | Field alignment to external_id + source check |
