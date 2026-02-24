# Bug Report: BUG-0034-GH-13

**Bug ID:** BUG-0034-GH-13
**External Link:** https://github.com/vihangshah/isdlc/issues/13
**External ID:** GH-13
**Severity:** Medium
**Created:** 2026-02-23

---

## Summary

Jira ticket status transition at workflow finalize is specified but not implemented. When a workflow completes for a Jira-backed item, the ticket remains in its original status instead of being transitioned to "Done".

---

## Expected Behavior

When a workflow completes for a Jira-backed item (one where `active_workflow.jira_ticket_id` exists), the orchestrator's finalize step should:

1. Read `active_workflow.jira_ticket_id` from state.json
2. Resolve the Jira ticket's available transitions via the Atlassian MCP `getTransitionsForJiraIssue` tool
3. Find the transition that maps to a "Done" status (or equivalent terminal status)
4. Execute the transition via `transitionJiraIssue` MCP tool
5. Record `jira_sync_status` in the `workflow_history` entry (`"synced"`, `"failed"`, or absent for local-only)
6. If any step fails, log a warning and continue -- never block workflow completion (Article X: Fail-Safe Defaults)

---

## Actual Behavior

After a workflow completes for a Jira-backed item:

- The Jira ticket remains in its original status (e.g., "To Do", "In Progress")
- No MCP call is made to transition the ticket
- No `jira_sync_status` field is recorded in `workflow_history`
- The specification text exists in both `00-sdlc-orchestrator.md` (step 2.5) and `isdlc.md` (STEP 4 Jira sync), but the orchestrator agent does not have executable procedural instructions for performing the Jira transition
- The specification references `updateStatus(jira_ticket_id, "Done")` as a conceptual adapter method, but this has never been mapped to concrete MCP tool calls (`getTransitionsForJiraIssue` + `transitionJiraIssue`)

---

## Reproduction Steps

1. Configure the iSDLC framework with Atlassian MCP integration (Jira project connected)
2. Create a workflow from a Jira ticket (e.g., `/isdlc fix "PROJ-123"` or via `/isdlc add` with a Jira link)
3. Complete all workflow phases through to finalize
4. Observe that the orchestrator's finalize step merges the branch and updates BACKLOG.md (if BUG-0033 fix is present), but does NOT transition the Jira ticket
5. Check the Jira board: the ticket remains in its original status column
6. Check `workflow_history` in state.json: no `jira_sync_status` field exists in the completed workflow entry

---

## Root Cause Analysis (Preliminary)

The bug has two aspects:

### 1. Missing Procedural Instructions in Orchestrator Agent

The orchestrator agent file (`00-sdlc-orchestrator.md`) specifies the Jira sync as step 2.5 in the Branch Merge section (lines 588-601), and the finalize mode summary (line 668) mentions it in the sequence. However, the finalize mode execution logic does not contain detailed procedural instructions that the agent can follow. Compare this to the BACKLOG.md sync (step 3, lines 602-615 in the same file) which has a fully specified procedure.

### 2. Conceptual vs Concrete MCP Tool Mapping

The specification uses `updateStatus(jira_ticket_id, "Done")` -- a conceptual adapter method from the CLAUDE.md.template adapter interface. This was never translated to the concrete two-step MCP procedure:
- Step A: `getTransitionsForJiraIssue(cloudId, issueIdOrKey)` -- discover available transitions and find the one leading to "Done"
- Step B: `transitionJiraIssue(cloudId, issueIdOrKey, transition: { id: transitionId })` -- execute the transition

### 3. Missing `jira_ticket_id` Population During Init

The `jira_ticket_id` field on `active_workflow` may not be consistently populated during workflow initialization. BUG-0032 (Jira read during add/analyze) was the first step in wiring Jira data into the pipeline; this field's population needs to be verified as a prerequisite.

---

## Environment

- **Framework:** iSDLC 0.1.0-alpha
- **Runtime:** Node.js 20+
- **MCP:** Atlassian MCP (Claude Code integration)
- **Platform:** macOS / Linux / Windows (cross-platform)

---

## Related Issues

- **BUG-0032 (GH-7):** Jira ticket fetch during add/analyze -- COMPLETED (read/intake side)
- **BUG-0033 (GH-11):** BACKLOG.md completion marking during finalize -- COMPLETED (local sync)
- **This bug (GH-13):** Jira status transition during finalize -- completes the Jira lifecycle: intake (read) -> finalize (write/transition)

---

## Fix Requirement

Implement the Jira status transition in the orchestrator's finalize step by:

1. Adding executable procedural instructions to `00-sdlc-orchestrator.md` that map `updateStatus()` to the concrete MCP tool calls (`getTransitionsForJiraIssue` + `transitionJiraIssue`)
2. Adding corresponding procedural detail to `isdlc.md` STEP 4 finalize so the phase-loop controller can verify the orchestrator performs this step
3. Ensuring `jira_ticket_id` is populated on `active_workflow` during workflow init when the source is Jira
4. Recording `jira_sync_status` in `workflow_history` entries for audit trail
