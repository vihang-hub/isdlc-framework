# BUG-0032: Phase A cannot pull Jira ticket content -- jira_get_issue MCP not implemented

**Source**: GitHub Issue #7
**Type**: Bug
**Created**: 2026-02-23

## Description

Phase A cannot pull Jira ticket content because the `jira_get_issue` MCP tool is not implemented. When a user provides a Jira ticket URL during a fix or analyze workflow, Phase A (the analyze pipeline) should be able to fetch the ticket summary, description, acceptance criteria, and other metadata directly from Jira via the Atlassian MCP integration. Currently this capability is missing, requiring users to manually copy-paste ticket content.

## Expected Behavior

When a Jira ticket URL is provided (e.g., via `--link` or inline), Phase A should:
1. Parse the Jira ticket ID from the URL
2. Call the Atlassian MCP `getJiraIssue` tool to fetch ticket content
3. Extract summary, description, acceptance criteria, and metadata
4. Incorporate the fetched content into the requirements draft

## Actual Behavior

Phase A does not attempt to fetch Jira ticket content. The MCP integration for reading Jira issues is not wired into the analyze pipeline.

## Reproduction Steps

1. Run `/isdlc analyze "some feature"` or `/isdlc fix "some bug" --link https://mycompany.atlassian.net/browse/PROJ-123`
2. Observe that Phase A does not fetch ticket content from Jira
3. User must manually provide all ticket details
