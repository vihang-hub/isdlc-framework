# Requirements Specification: BUG-0032-GH-7

**Bug ID:** BUG-0032-GH-7
**External Link:** https://github.com/isdlc/isdlc/issues/7
**Phase:** 01-requirements
**Status:** Draft
**Created:** 2026-02-23

---

## Bug Context

Phase A (the add/analyze pipeline) cannot fetch Jira ticket content because the Atlassian MCP `getJiraIssue` tool is not wired into the command handlers. The `detectSource()` function already correctly identifies Jira references (`PROJECT-N` patterns), but no downstream code calls the MCP to retrieve the ticket's summary, description, type, or acceptance criteria. This forces users to manually copy-paste Jira ticket content, degrading the workflow experience for Jira-backed projects.

---

## Fix Requirement

Wire the Atlassian MCP `getJiraIssue` tool into the add and analyze command handlers in `isdlc.md` so that Jira ticket content is fetched automatically when a Jira source is detected, achieving parity with the existing GitHub issue fetch capability.

---

## Functional Requirements

### FR-001: Jira Ticket Fetch in Add Handler

**ID:** FR-001
**Description:** When the `add` handler detects a Jira source (`source === "jira"`), it must call the Atlassian MCP `getJiraIssue` tool to fetch the ticket's summary, description, issue type, and priority.

**Acceptance Criteria:**

- **AC-001-01:** Given a Jira ticket reference (e.g., `PROJ-123`) is provided to `/isdlc add`, when `detectSource()` returns `source: "jira"`, then the handler calls `getJiraIssue` with the resolved `cloudId` and `issueIdOrKey` to fetch the ticket content.
- **AC-001-02:** Given `getJiraIssue` returns successfully, when the issue type is `"Bug"`, then `item_type` is set to `"BUG"`.
- **AC-001-03:** Given `getJiraIssue` returns successfully, when the issue type is not `"Bug"` (e.g., `"Story"`, `"Task"`, `"Epic"`), then `item_type` is set to `"REQ"`.
- **AC-001-04:** Given `getJiraIssue` returns successfully, when generating the slug, then the fetched issue summary is used (not the raw `PROJECT-N` input).
- **AC-001-05:** Given `getJiraIssue` fails (network error, permission denied, ticket not found), when the handler processes the error, then it logs a warning ("Could not fetch Jira ticket PROJ-123: {error}") and falls back to manual entry behavior (prompts user for details).

### FR-002: Jira Ticket Fetch in Analyze Handler (Optimized Path)

**ID:** FR-002
**Description:** When the `analyze` handler's optimized path (step 3a) processes a Jira reference (`PROJECT-N`), it must include a `getJiraIssue` MCP call in Group 1 (parallel fetch operations), matching the existing `gh issue view` call for GitHub references.

**Acceptance Criteria:**

- **AC-002-01:** Given a Jira reference (`PROJECT-N`) is provided to `/isdlc analyze`, when the input is classified as an external ref, then Group 1 fires a `getJiraIssue` MCP call in parallel with the other Group 1 operations (grep for existing match, glob for folders, persona reads, topic glob).
- **AC-002-02:** Given the `getJiraIssue` call returns successfully, when Group 2 processes the results, then the fetched issue data (summary, description, type, priority) is passed to the `add` handler as pre-fetched data (matching the `issueData` pattern used for GitHub issues).
- **AC-002-03:** Given the `getJiraIssue` call fails in Group 1, when the handler processes the failure, then it fails fast with "Could not fetch Jira ticket PROJECT-N: {error}" and STOPS (matching the GitHub fail-fast behavior).
- **AC-002-04:** Given fetched Jira issue data is available, when it is incorporated into the `draft.md`, then the draft includes the Jira ticket's title as the heading, the description body as context, and acceptance criteria (if present in the Jira ticket fields).

### FR-003: CloudId Resolution for MCP Calls

**ID:** FR-003
**Description:** Before calling `getJiraIssue`, the handler must resolve the Atlassian `cloudId` required by the MCP tool, either from stored configuration or by calling `getAccessibleAtlassianResources`.

**Acceptance Criteria:**

- **AC-003-01:** Given the Atlassian MCP is available, when a Jira fetch is needed, then the handler resolves the `cloudId` by calling `getAccessibleAtlassianResources` (or reads it from a cached configuration if previously resolved).
- **AC-003-02:** Given `getAccessibleAtlassianResources` returns multiple cloud instances, when resolving, then the first accessible resource is used (or the user is prompted to select if ambiguous).
- **AC-003-03:** Given the Atlassian MCP is not available (not installed, not configured), when a Jira fetch is attempted, then the handler degrades gracefully: logs "Atlassian MCP not available. Provide Jira ticket details manually." and proceeds with manual entry.

### FR-004: Jira URL Parsing for --link Flag

**ID:** FR-004
**Description:** When a Jira URL is provided via the `--link` flag (e.g., `https://company.atlassian.net/browse/PROJ-123`), the handler must parse the ticket ID from the URL and use it for the `getJiraIssue` call.

**Acceptance Criteria:**

- **AC-004-01:** Given a `--link` URL matching the pattern `https://*.atlassian.net/browse/{PROJECT-N}`, when the handler processes the link, then it extracts the ticket ID (`PROJECT-N`) from the URL path.
- **AC-004-02:** Given the ticket ID is extracted from the URL, when the handler proceeds, then it calls `getJiraIssue` with the extracted ID and incorporates the fetched content into the workflow (same as FR-001/FR-002).
- **AC-004-03:** Given a `--link` URL that does not match the Atlassian URL pattern, when the handler processes it, then it does not attempt a Jira fetch (existing behavior for non-Jira URLs is preserved).

---

## Constraints

### CON-001: Atlassian MCP Availability

The fix must degrade gracefully when the Atlassian MCP is not installed or not configured. The framework must not crash or block workflows for users who do not have Atlassian integration. The fail-open principle (Constitution Article X) applies.

### CON-002: No New Dependencies in Hook Files

Per Constitution Article XIII (Module System Consistency), hook files use CommonJS. The MCP call is made by the agent at the command-handler level (in `isdlc.md`), not in hook utility code. No new npm dependencies are required -- the MCP tools are invoked as tool calls by the Claude agent.

### CON-003: Backward Compatibility

Existing GitHub issue fetch behavior must not be altered. The Jira fetch is additive -- it fills the gap for Jira sources without changing the GitHub path.

---

## Assumptions

- **ASM-001:** The Atlassian MCP `getJiraIssue` tool returns fields including `summary`, `description`, `issuetype.name`, and `priority.name` in its response.
- **ASM-002:** The `cloudId` can be resolved via `getAccessibleAtlassianResources` at runtime -- no pre-configuration beyond standard MCP setup is needed.
- **ASM-003:** The `detectSource()` function in `three-verb-utils.cjs` already correctly identifies Jira sources and does not need modification for this fix.

---

## Out of Scope

- **Jira write-back during analyze** (e.g., adding comments to Jira tickets during analysis) -- this is a separate feature
- **Jira search integration** (searching for tickets by keyword) -- out of scope for this fix
- **Confluence page fetch during analyze** -- separate capability, not part of this bug
- **Modifying `three-verb-utils.cjs`** -- the MCP calls are agent-level tool invocations specified in `isdlc.md`, not programmatic function calls in utility code
