# Error Taxonomy: REQ-0032 Issue Tracker Integration During Installation

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-02-22
**Coverage**: 100%

---

## 1. Error Code Table

| Code | Description | Trigger Condition | Severity | Recovery Action |
|------|-------------|-------------------|----------|----------------|
| IT-001 | GitHub CLI not found | `gh --version` throws or times out after user selects GitHub Issues | Warning | Log warning with install link. Continue installation with `issueTrackerMode = 'github'`. Pattern detection still works without `gh`. |
| IT-002 | Atlassian MCP not configured | `claude mcp list` output does not contain "atlassian" (case-insensitive) | Warning | Display setup instructions. Prompt user to configure and retry. Offer fallback to manual mode. |
| IT-003 | Claude CLI not available for MCP check | `claude mcp list` throws because `claude` is not on PATH | Warning | Skip MCP check entirely. Warn user that Jira integration cannot be validated. Offer fallback to manual mode. |
| IT-004 | MCP check timeout | `claude mcp list` exceeds 10-second timeout | Warning | Treat as MCP not available. Follow IT-002 recovery. |
| IT-005 | Git remote detection failure | `git remote -v` throws (not a git repo, git not installed) | Info | Default to `hasGitHub: false`. Pre-select "Manual" in the tracker prompt. |
| IT-006 | CLAUDE.md template not found | Template file missing from framework installation | Error | Log error. Skip issue tracker section interpolation. Installation continues but preference is not stored. |
| IT-007 | CLAUDE.md already exists | Target project already has a CLAUDE.md file | Info | Do not overwrite. Log instructions for manually adding the Issue Tracker Configuration section. |
| IT-008 | Invalid Jira project key | User enters an empty or non-uppercase string for Jira project key | Warning | Accept the input but warn: "Project key is typically uppercase letters (e.g., PROJ)." Store as-is. |
| IT-009 | CLAUDE.md section parse failure | Runtime: `## Issue Tracker Configuration` section missing or malformed in CLAUDE.md | Info | Fall back to pattern-based detection (existing behavior). No user-visible error. |
| IT-010 | Updater section preservation failure | Updater cannot extract the Issue Tracker Configuration section from existing CLAUDE.md | Warning | Write new template defaults. Warn user to re-configure their tracker preference. |

---

## 2. Error Propagation Strategy

### Installation Errors (IT-001 through IT-008)

**Strategy**: Log-and-continue.

All installation errors are non-fatal. The installer logs a warning and continues to the next step. No exception is thrown to the caller. This follows Article X: Fail-Safe Defaults -- the installer must complete even when optional validations fail.

### Runtime Errors (IT-009)

**Strategy**: Silent fallback.

The command layer reads CLAUDE.md context and attempts to parse the Issue Tracker Configuration section. If parsing fails (section missing, malformed, unexpected values), the system falls through to the existing pattern-based detection in `detectSource()`. No error is reported to the user because the system still functions correctly.

### Update Errors (IT-010)

**Strategy**: Log-and-warn.

The updater logs a warning when it cannot preserve the section and uses template defaults. The user is informed and can re-configure manually.

---

## 3. Graceful Degradation Levels

| Level | Condition | What Still Works | What Does Not Work |
|-------|-----------|-----------------|-------------------|
| **Full** | MCP configured, `gh` available, preference stored | All features: bare number routing, Jira/GitHub fetching | -- |
| **Partial (GitHub)** | `gh` not available, preference = github | Pattern detection (`#N`), bare number routing (`42` -> `#42`) | Actual issue fetching (gh CLI needed at runtime by agent) |
| **Partial (Jira)** | MCP not configured, preference = jira | Bare number routing (`1234` -> `PROJ-1234`), pattern detection (`PROJ-123`) | Actual ticket fetching (MCP needed at runtime) |
| **Minimal** | No preference stored (legacy installation) | Pattern detection (`#N`, `PROJECT-N`), manual descriptions | Bare number routing, pre-configured defaults |
| **Baseline** | CLAUDE.md missing entirely | Manual input only | All external tracker features |

---

## 4. Validation Rules Summary

| Input | Validation | On Invalid |
|-------|-----------|------------|
| `select()` prompt response | Must be one of `'github'`, `'jira'`, `'manual'` | Prompt library enforces valid selection |
| `text()` prompt for Jira project key | Trimmed, non-empty preferred | Accept empty (warn, store as-is) |
| `detectSource()` `input` | Non-empty string | Return `{ source: 'manual', source_id: null, description: '' }` |
| `detectSource()` `options.issueTracker` | One of `'github'`, `'jira'`, `'manual'` | Ignore options; use pattern-only detection |
| `detectSource()` `options.jiraProjectKey` | Non-empty string | Bare numbers fall through to manual |
| CLAUDE.md section `Tracker` value | One of `github`, `jira`, `manual` | Treat as absent; use pattern-only detection |
| CLAUDE.md section `Jira Project Key` | Uppercase letters matching `[A-Z]+` | Accept as-is; may fail at Jira API level |

---

## 5. User-Facing Error Messages

All messages are factual, not in-persona, and include an actionable next step.

| Code | User Message |
|------|-------------|
| IT-001 | "GitHub CLI (gh) not found. Issue fetching requires it. Install: https://cli.github.com/" |
| IT-002 | "Atlassian MCP server not configured. To enable Jira integration:\n  claude mcp add --transport sse atlassian https://mcp.atlassian.com/v1/sse" |
| IT-003 | "Cannot verify Atlassian MCP (Claude Code CLI not available). Configure MCP manually after installing Claude Code." |
| IT-004 | "MCP server check timed out. You can configure it later. Falling back to manual mode." |
| IT-005 | (No user message -- silent, sets default) |
| IT-006 | "CLAUDE.md template not found. Issue tracker preference will not be stored." |
| IT-007 | "CLAUDE.md already exists. To add issue tracker configuration, add this section manually:\n  ## Issue Tracker Configuration\n  ..." |
| IT-008 | "Note: Jira project key is typically uppercase letters (e.g., PROJ)." |
| IT-009 | (No user message -- silent fallback) |
| IT-010 | "Warning: Could not preserve issue tracker configuration. You may need to reconfigure after update." |
