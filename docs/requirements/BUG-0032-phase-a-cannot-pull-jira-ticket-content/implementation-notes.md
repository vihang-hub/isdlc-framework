# BUG-0032: Implementation Notes

## Summary

Wired the Atlassian MCP `getJiraIssue` tool into the add/analyze/fix command handlers in `src/claude/commands/isdlc.md` so that Jira ticket content is fetched automatically when a Jira source is detected.

## Changes Made

### File Modified: `src/claude/commands/isdlc.md`

**Change 1: Add handler step 3b (Jira ticket section)**
- Replaced the vague "Fetch the issue summary and type" prose with explicit MCP call instructions
- Added `getAccessibleAtlassianResources` call to resolve cloudId (uses first accessible resource when multiple instances exist)
- Added `getJiraIssue(cloudId, source_id)` call to fetch ticket details
- Specified extraction of: summary, description, issuetype.name, priority.name
- Added error fallback: "Could not fetch Jira ticket {source_id}: {error}" with manual entry fallback
- Added MCP unavailability handling: "Atlassian MCP not available. Provide Jira ticket details manually."
- Specified that fetched summary is used for `generateSlug()` instead of raw PROJECT-N input

**Change 2: Analyze handler optimized path (step 3a) Group 1**
- Added Jira fetch as a parallel operation in Group 1 alongside the existing GitHub fetch
- Conditional on source being "jira" with PROJECT-N pattern source_id
- Specified fail-fast behavior matching GitHub: "Could not fetch Jira ticket {source_id}: {error}" and STOP
- Specified that fetched Jira content goes into draft.md (summary as heading, description as context, acceptance criteria if present)
- Updated Group 2 to reference Jira issueData alongside GitHub issueData

**Change 3: Fix handler --link flag**
- Added Jira URL parsing for the `--link` flag
- Pattern match: `https://*.atlassian.net/browse/{PROJECT-N}` extracts ticket ID
- Calls `getAccessibleAtlassianResources` + `getJiraIssue` to fetch content
- Passes fetched content to Agent 01 as pre-fetched issue context
- Non-Jira URLs preserve existing behavior (passed directly as external bug URL)

## Test Results

- **26/26 tests passing** (16 existing + 10 previously failing)
- **0 regressions** in the BUG-0032 test suite
- Full hook test suite: 2448/2455 pass (7 pre-existing failures unrelated to this change)

## Traceability

| Requirement | Implementation |
|-------------|---------------|
| FR-001 (Jira fetch in Add handler) | Add handler step 3b Jira MCP calls |
| FR-002 (Jira fetch in Analyze handler) | Group 1 parallel Jira fetch |
| FR-003 (CloudId resolution) | getAccessibleAtlassianResources with first-resource selection |
| FR-004 (Jira URL parsing) | Fix handler --link Jira URL pattern matching |
| CON-003 (Backward compatibility) | All existing detectSource/generateSlug behavior preserved |
