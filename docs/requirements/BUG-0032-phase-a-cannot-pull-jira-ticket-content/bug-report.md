# Bug Report: BUG-0032-GH-7

**Bug ID:** BUG-0032-GH-7
**External Link:** https://github.com/isdlc/isdlc/issues/7
**External ID:** GH-7
**Source:** GitHub Issue #7
**Severity:** Medium
**Created:** 2026-02-23

---

## Summary

Phase A (analyze pipeline) cannot fetch Jira ticket content because the Atlassian MCP `getJiraIssue` call is not wired into the add/analyze command handlers in `isdlc.md`. When a user provides a Jira ticket reference (`PROJECT-N` pattern or URL), the framework should automatically fetch the ticket's summary, description, acceptance criteria, issue type, and priority -- but currently does not. Users must manually copy-paste all ticket details.

---

## Expected Behavior

When a Jira ticket reference is provided (via `PROJECT-N` pattern, bare number with Jira preference, or `--link` URL), Phase A should:

1. Parse the Jira ticket ID from the input (already handled by `detectSource()` in `three-verb-utils.cjs`)
2. Call the Atlassian MCP `getJiraIssue` tool to fetch ticket content (summary, description, issue type, priority, acceptance criteria)
3. Use the fetched summary for slug generation (matching the GitHub path which uses `gh issue view`)
4. Determine `item_type` from the Jira issue type (`Bug` -> `BUG`, else -> `REQ`)
5. Incorporate the fetched description/body into `draft.md` content
6. Pass the fetched data downstream to the analyze roundtable for richer context

---

## Actual Behavior

Phase A does not attempt to fetch Jira ticket content. Specifically:

- **`add` handler (step 3b):** The spec says "Fetch the issue summary and type. If type is 'Bug', item_type = 'BUG', else item_type = 'REQ'" for Jira sources -- but does not specify the mechanism (no MCP call is documented). The GitHub path uses `gh issue view N --json title,labels,body`, but there is no Jira equivalent.
- **`analyze` handler (step 3a, Group 1):** The optimized dependency group path fires `gh issue view N --json title,labels,body` for GitHub issues. For Jira references (`PROJECT-N`), there is no equivalent fetch operation in Group 1. The Jira path falls through without fetching content.
- **`fix` handler with `--link`:** When a Jira URL is provided via `--link`, the URL is stored but its content is never fetched via the Atlassian MCP.

The Atlassian MCP tools (`getJiraIssue`, `searchJiraIssuesUsingJql`, etc.) ARE available in the environment (detected during installation via `checkAtlassianMcp()` in `lib/installer.js`) but are simply not invoked anywhere in the add/analyze/fix pipeline.

---

## Reproduction Steps

1. Ensure Atlassian MCP is installed and configured
2. Configure issue tracker as Jira in `CLAUDE.md`:
   ```
   ## Issue Tracker Configuration
   **Tracker**: jira
   **Jira Project Key**: PROJ
   ```
3. Run `/isdlc analyze "PROJ-123"` or `/isdlc fix "bug description" --link https://company.atlassian.net/browse/PROJ-123`
4. Observe that no Jira API call is made to fetch ticket content
5. The `draft.md` is generated without the Jira ticket's title or body
6. The slug is generated from the raw input (e.g., `proj-123`) rather than the ticket title
7. User must manually provide all details that should have been auto-fetched

---

## Root Cause Analysis

The implementation gap exists at two levels:

1. **Command specification gap:** `isdlc.md` describes the intent to fetch Jira content ("Fetch the issue summary and type") but does not specify the concrete mechanism. The GitHub path has explicit tool calls (`gh issue view`), while the Jira path has only a description of desired behavior.

2. **No MCP integration in pipeline:** The Atlassian MCP tools are available (installed, detected) but never called from within the add/analyze/fix command handlers. The MCP integration exists for other purposes (e.g., Jira sync at workflow finalization) but is absent from the content-fetching pipeline.

---

## Affected Files

| File | Role | Change Needed |
|------|------|---------------|
| `src/claude/commands/isdlc.md` | Command spec | Add Atlassian MCP `getJiraIssue` calls to add handler (step 3b) and analyze handler (step 3a, Group 1) |
| `src/claude/hooks/lib/three-verb-utils.cjs` | Utility functions | Potentially add a `fetchJiraIssue()` helper (or document that MCP calls are made inline by the agent) |

---

## Environment

- **Platform:** macOS (Darwin 25.2.0)
- **Node.js:** 20+
- **Framework:** iSDLC 0.1.0-alpha
- **Atlassian MCP:** Installed and available
