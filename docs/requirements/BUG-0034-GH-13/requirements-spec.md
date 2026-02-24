# Requirements Specification: BUG-0034-GH-13

**Bug ID:** BUG-0034
**Title:** Jira updateStatus at Finalize Not Implemented -- Tickets Not Transitioned to Done
**External Link:** https://github.com/vihangshah/isdlc/issues/13
**External ID:** GH-13
**Severity:** Medium
**Phase:** 01-requirements
**Created:** 2026-02-23

---

## Context

The orchestrator's finalize step specifies Jira status sync (step 2.5 in `00-sdlc-orchestrator.md`, and STEP 4 Jira sync in `isdlc.md`): when a workflow completes, call `updateStatus(jira_ticket_id, "Done")` via Atlassian MCP to transition the Jira ticket, and record `jira_sync_status` in `workflow_history`. However, none of this is actually implemented in the finalize execution.

The specification uses a conceptual adapter method `updateStatus()` that was never translated to the concrete two-step MCP procedure: (1) `getTransitionsForJiraIssue` to discover available transitions, (2) `transitionJiraIssue` to execute the transition. After a workflow completes for a Jira-backed item, the ticket remains in its original status.

This is the write/finalize counterpart to BUG-0032 (which implemented the read/intake side of Jira integration). Together with BUG-0033 (BACKLOG.md sync), this completes the external status sync triad at finalize.

---

## Fix Requirements

### FR-001: Resolve Jira Transition ID at Finalize

**ID:** FR-001
**Description:** During finalize, when `active_workflow.jira_ticket_id` exists, the orchestrator must discover the available transitions for the Jira ticket and identify the transition that leads to a "Done" (or equivalent terminal) status.

**Acceptance Criteria:**

- **AC-001-01:**
  ```
  Given a workflow is completing via finalize mode
    And active_workflow.jira_ticket_id is "PROJ-123"
    And the Atlassian MCP is available
  When the orchestrator executes the Jira sync step
  Then it calls getTransitionsForJiraIssue with the resolved cloudId and issueIdOrKey "PROJ-123"
    And it receives a list of available transitions
  ```

- **AC-001-02:**
  ```
  Given getTransitionsForJiraIssue returns a list of transitions
    And one transition has a name matching "Done" (case-insensitive)
  When the orchestrator selects the target transition
  Then it uses that transition's ID for the subsequent transitionJiraIssue call
  ```

- **AC-001-03:**
  ```
  Given getTransitionsForJiraIssue returns a list of transitions
    And no transition name matches "Done" exactly (case-insensitive)
    And a transition exists with a status category of "done" or a name containing "complete", "resolved", or "closed" (case-insensitive)
  When the orchestrator selects the target transition
  Then it uses the best-match terminal transition's ID
    And it logs "Jira PROJ-123: using transition '{name}' (no exact 'Done' match)"
  ```

- **AC-001-04:**
  ```
  Given getTransitionsForJiraIssue returns a list of transitions
    And no transition maps to a terminal/done status
  When the orchestrator processes the result
  Then it logs "WARNING: No 'Done' transition available for Jira PROJ-123. Available: {transition names}"
    And jira_sync_status is set to "failed"
    And the workflow continues without blocking
  ```

### FR-002: Execute Jira Ticket Transition

**ID:** FR-002
**Description:** Once the target transition ID is identified, the orchestrator must execute the transition via the `transitionJiraIssue` MCP tool.

**Acceptance Criteria:**

- **AC-002-01:**
  ```
  Given the orchestrator has identified transition ID "31" for the "Done" transition
    And the Jira ticket is "PROJ-123"
  When the orchestrator executes the transition
  Then it calls transitionJiraIssue with cloudId, issueIdOrKey "PROJ-123", and transition { id: "31" }
    And the Jira ticket status changes to "Done"
  ```

- **AC-002-02:**
  ```
  Given transitionJiraIssue completes successfully for "PROJ-123"
  When the orchestrator records the result
  Then it logs "Jira PROJ-123 transitioned to Done"
    And jira_sync_status is set to "synced" in the workflow_history entry
  ```

- **AC-002-03:**
  ```
  Given transitionJiraIssue fails with an error (e.g., permission denied, network error, invalid transition)
  When the orchestrator handles the error
  Then it logs "WARNING: Could not transition Jira PROJ-123 to Done: {error message}"
    And jira_sync_status is set to "failed" in the workflow_history entry
    And the workflow continues without blocking (Article X: Fail-Safe Defaults)
  ```

### FR-003: CloudId Resolution for Finalize MCP Calls

**ID:** FR-003
**Description:** Before calling any Jira MCP tools, the orchestrator must resolve the Atlassian `cloudId`. This follows the same pattern established by BUG-0032 for the read side.

**Acceptance Criteria:**

- **AC-003-01:**
  ```
  Given the Atlassian MCP is available
    And active_workflow.jira_ticket_id exists
  When the orchestrator needs the cloudId for Jira transition
  Then it calls getAccessibleAtlassianResources to resolve the cloudId
    And it uses the first accessible resource's cloudId
  ```

- **AC-003-02:**
  ```
  Given the Atlassian MCP is not available (not installed, not configured)
    And active_workflow.jira_ticket_id exists
  When the orchestrator attempts Jira sync
  Then it logs "WARNING: Atlassian MCP not available. Skipping Jira status sync for PROJ-123."
    And jira_sync_status is set to "failed" in the workflow_history entry
    And the workflow continues without blocking
  ```

### FR-004: Non-Blocking Execution Guarantee

**ID:** FR-004
**Description:** The Jira sync step must never block workflow completion. Any failure at any point (cloudId resolution, transition discovery, transition execution) must log a warning and allow the workflow to complete.

**Acceptance Criteria:**

- **AC-004-01:**
  ```
  Given the Jira sync step encounters any error (MCP unavailable, network timeout, permission denied, invalid ticket, no available transitions)
  When the error is caught
  Then a warning is logged with the specific error context
    And jira_sync_status is set to "failed"
    And workflow finalization continues to the next step (BACKLOG.md sync)
    And the workflow completes successfully
  ```

- **AC-004-02:**
  ```
  Given active_workflow.jira_ticket_id is absent or null
  When the orchestrator evaluates the Jira sync step
  Then the entire Jira sync step is skipped
    And no MCP calls are made
    And jira_sync_status is not set in workflow_history (absent, not "failed")
    And the workflow continues to the next step
  ```

### FR-005: Record jira_sync_status in workflow_history

**ID:** FR-005
**Description:** The Jira sync result must be recorded in the `workflow_history` entry for audit trail purposes.

**Acceptance Criteria:**

- **AC-005-01:**
  ```
  Given a Jira-backed workflow completes
    And the Jira transition succeeded
  When the workflow is moved to workflow_history
  Then the workflow_history entry contains jira_sync_status: "synced"
  ```

- **AC-005-02:**
  ```
  Given a Jira-backed workflow completes
    And the Jira transition was attempted but failed
  When the workflow is moved to workflow_history
  Then the workflow_history entry contains jira_sync_status: "failed"
  ```

- **AC-005-03:**
  ```
  Given a local-only workflow completes (no jira_ticket_id)
  When the workflow is moved to workflow_history
  Then the workflow_history entry does NOT contain a jira_sync_status field
  ```

### FR-006: Orchestrator Agent Procedural Instructions

**ID:** FR-006
**Description:** The orchestrator agent file (`00-sdlc-orchestrator.md`) must contain executable procedural instructions for Jira sync, not just a conceptual specification. The instructions must map `updateStatus()` to the concrete MCP tool calls.

**Acceptance Criteria:**

- **AC-006-01:**
  ```
  Given the fix is implemented
  When reviewing 00-sdlc-orchestrator.md finalize mode section
  Then step 2.5 (Jira Status Sync) contains a step-by-step procedure including:
    - CloudId resolution via getAccessibleAtlassianResources
    - Transition discovery via getTransitionsForJiraIssue
    - Transition name matching logic (Done > Complete > Resolved > Closed)
    - Transition execution via transitionJiraIssue
    - Error handling at each step (non-blocking)
    - jira_sync_status recording
  ```

- **AC-006-02:**
  ```
  Given the fix is implemented
  When reviewing isdlc.md STEP 4 finalize Jira sync section
  Then the section describes the concrete MCP tool calls
    And it references the same procedure as the orchestrator agent
    And it does not reference the conceptual updateStatus() method
  ```

### FR-007: Ensure jira_ticket_id Population During Init

**ID:** FR-007
**Description:** When a workflow is initialized from a Jira source (detected by `detectSource()` or `--link` with a Jira URL), the `jira_ticket_id` field must be set on `active_workflow` so that finalize can find it.

**Acceptance Criteria:**

- **AC-007-01:**
  ```
  Given a workflow is created via /isdlc build "PROJ-123"
    And detectSource() identifies the source as "jira"
  When the orchestrator initializes the workflow
  Then active_workflow.jira_ticket_id is set to "PROJ-123"
  ```

- **AC-007-02:**
  ```
  Given a workflow is created via /isdlc fix --link "https://company.atlassian.net/browse/PROJ-456"
    And the URL is parsed to extract "PROJ-456"
  When the orchestrator initializes the workflow
  Then active_workflow.jira_ticket_id is set to "PROJ-456"
  ```

- **AC-007-03:**
  ```
  Given a workflow is created from a non-Jira source (GitHub issue, manual entry)
  When the orchestrator initializes the workflow
  Then active_workflow.jira_ticket_id is not set (absent or null)
  ```

---

## Constraints

### CON-001: Non-Blocking Execution (Article X)

The Jira sync step must never block workflow completion. Per Constitution Article X (Fail-Safe Defaults), any external integration failure must degrade gracefully. This applies to every sub-step: cloudId resolution, transition discovery, and transition execution.

### CON-002: Agent File Changes Only

This is a specification/agent bug. The fix modifies markdown agent files (`00-sdlc-orchestrator.md`, `isdlc.md`) to provide executable procedural instructions. The MCP calls are tool invocations performed by the Claude agent at runtime -- no JavaScript code changes are expected unless `jira_ticket_id` population in the init flow requires changes to `three-verb-utils.cjs`.

### CON-003: Backward Compatibility

- Workflows without `jira_ticket_id` must complete without any change in behavior
- The BACKLOG.md sync (BUG-0033) and GitHub issue close behaviors must remain unchanged
- The finalize step ordering must be preserved: merge -> Jira sync -> GitHub sync -> BACKLOG.md sync -> collect snapshots -> prune -> archive

### CON-004: MCP Tool Compatibility

The fix must use the actual Atlassian MCP tool names available in the Claude Code environment:
- `getAccessibleAtlassianResources` (for cloudId resolution)
- `getTransitionsForJiraIssue` (for transition discovery)
- `transitionJiraIssue` (for transition execution)

The conceptual `updateStatus()` adapter method must not appear in executable instructions.

---

## Assumptions

- **ASM-001:** The Atlassian MCP `getTransitionsForJiraIssue` returns transitions with `id`, `name`, and optionally `to.statusCategory.key` fields that can be used to identify the "Done" transition.
- **ASM-002:** Most Jira projects have a transition named "Done" or a status category of "done". The fallback matching (complete/resolved/closed) handles non-standard workflows.
- **ASM-003:** The `cloudId` can be resolved at runtime via `getAccessibleAtlassianResources` -- the same mechanism used by BUG-0032 for the read side.
- **ASM-004:** The `jira_ticket_id` field follows the `PROJECT-NNN` format (e.g., `PROJ-123`) and can be passed directly as `issueIdOrKey` to MCP tools.
- **ASM-005:** BUG-0032 (Jira read during add/analyze) has already established the pattern for Jira MCP calls; this fix follows the same pattern for the write side.

---

## Out of Scope

- **Jira comment sync** (adding a comment to the Jira ticket with workflow results) -- separate enhancement
- **Bidirectional status sync** (monitoring Jira for status changes back to iSDLC) -- separate feature
- **Custom Jira field updates** (updating story points, sprint, labels, etc.) -- separate feature
- **Multi-ticket transitions** (workflows that span multiple Jira tickets) -- not supported by current architecture
- **Jira webhook integration** (receiving events from Jira) -- out of scope for CLI-based framework
- **Linear/Asana/other tracker transitions** -- future integration, same adapter pattern

---

## Files Likely Affected

| File | Change Type | Description |
|------|-------------|-------------|
| `src/claude/agents/00-sdlc-orchestrator.md` | Modify | Add executable procedural instructions to step 2.5 (Jira Status Sync) with concrete MCP tool calls |
| `src/claude/commands/isdlc.md` | Modify | Update STEP 4 finalize Jira sync section with concrete MCP tool names and procedure |
| `src/claude/commands/isdlc.md` | Verify | Confirm jira_ticket_id is populated during workflow init for Jira sources |
| `src/claude/CLAUDE.md.template` | Verify | Confirm adapter interface documentation is consistent with implementation |

---

## Traceability

| Requirement | Acceptance Criteria | Priority |
|-------------|-------------------|----------|
| FR-001 | AC-001-01, AC-001-02, AC-001-03, AC-001-04 | Must Have |
| FR-002 | AC-002-01, AC-002-02, AC-002-03 | Must Have |
| FR-003 | AC-003-01, AC-003-02 | Must Have |
| FR-004 | AC-004-01, AC-004-02 | Must Have |
| FR-005 | AC-005-01, AC-005-02, AC-005-03 | Must Have |
| FR-006 | AC-006-01, AC-006-02 | Must Have |
| FR-007 | AC-007-01, AC-007-02, AC-007-03 | Should Have |
