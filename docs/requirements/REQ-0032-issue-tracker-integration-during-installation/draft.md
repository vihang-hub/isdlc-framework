# REQ-0032: Issue Tracker Integration During Installation

**Source**: Manual
**Type**: Feature / Requirement

## Description

During installation (`isdlc init`), prompt users to connect either GitHub Issues or Jira for issue management. If the user selects Jira, guide them to install the Atlassian MCP server. Store the chosen preference in CLAUDE.md so that the analyze flow intake is routed accordingly.

## Key Requirements

1. **Installation Prompt**: During `isdlc init`, ask user to select their issue tracker:
   - GitHub Issues (default for GitHub-hosted repos)
   - Jira (requires Atlassian MCP server)
   - None / Manual only

2. **Jira Setup Guidance**: If user selects Jira:
   - Check if Atlassian MCP server is already installed
   - If not installed, provide instructions to install and configure it
   - Validate the connection works before proceeding

3. **Preference Storage**: Store the issue tracker preference in CLAUDE.md:
   - Issue tracker type (github / jira / manual)
   - Connection details (e.g., Jira project key, GitHub repo)

4. **Analyze Flow Routing**: The `/isdlc analyze` intake should read the stored preference to:
   - Auto-detect source from issue references (#N for GitHub, PROJECT-N for Jira)
   - Default to the configured tracker when source is ambiguous
   - Fetch issue details from the configured tracker

## Context

Currently, the `add` and `analyze` commands detect source type from input patterns (#N for GitHub, PROJECT-N for Jira), but there's no installation-time setup for the issue tracker connection. Users must manually ensure the right MCP servers are installed and configured.
