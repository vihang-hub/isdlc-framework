# Data Flow: REQ-0032 Issue Tracker Integration During Installation

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-02-22
**Coverage**: 100%

---

## 1. Installation Flow (Data Origin)

```
[User runs `isdlc init`]
    |
    v
[Step 3: Claude Code detection]
    |
    v
[Provider selection (existing)]
    |
    v
[NEW: Issue Tracker Selection]
    |
    +-- select('Select issue tracker:', [...])
    |       |
    |       v
    |   issueTrackerMode = 'github' | 'jira' | 'manual'
    |
    +-- [If github]:
    |       |
    |       +-- detectGitHubRemote(projectRoot)
    |       |       |
    |       |       v
    |       |   { hasGitHub, repo }  (e.g., 'owner/repo')
    |       |
    |       +-- checkGhCli()
    |               |
    |               v
    |           { available, version }
    |           (warn if not available; do not block)
    |
    +-- [If jira]:
    |       |
    |       +-- checkAtlassianMcp()
    |       |       |
    |       |       v
    |       |   { available, raw }
    |       |       |
    |       |       +-- [If available]: proceed
    |       |       |
    |       |       +-- [If not available]:
    |       |               |
    |       |               +-- Display setup instructions
    |       |               +-- confirm('Have you configured...?')
    |       |               +-- [If yes]: re-check -> proceed or warn
    |       |               +-- [If no]: offer fallback to manual
    |       |
    |       +-- text('Default Jira project key:')
    |               |
    |               v
    |           jiraProjectKey = 'PROJ'
    |
    +-- [If manual]: no additional prompts
    |
    v
[Assemble issueTrackerConfig]
    issueTrackerConfig = {
      mode,
      jiraProjectKey,
      githubRepo,
      ghCliAvailable,
      mcpAvailable
    }
    |
    v
[Step 4: Installation confirmation + file copy]
    |
    v
[CLAUDE.md template interpolation]
    Read src/claude/CLAUDE.md.template
    -> Replace {{ISSUE_TRACKER}} with issueTrackerConfig.mode
    -> Replace {{JIRA_PROJECT_KEY}} with issueTrackerConfig.jiraProjectKey
    -> Replace {{GITHUB_REPO}} with issueTrackerConfig.githubRepo
    -> writeFile(projectRoot/CLAUDE.md, interpolated)
```

---

## 2. Runtime Flow (Data Consumption)

```
[User starts Claude Code conversation]
    |
    v
[Claude Code loads CLAUDE.md into context]
    |
    v
[User runs `/isdlc add "1234"` or `/isdlc analyze "1234"`]
    |
    v
[isdlc.md command handler reads CLAUDE.md from context]
    |
    +-- Parse "## Issue Tracker Configuration" section:
    |       |
    |       v
    |   issueTracker = 'jira'
    |   jiraProjectKey = 'PROJ'
    |
    v
[Call detectSource("1234", { issueTracker: 'jira', jiraProjectKey: 'PROJ' })]
    |
    +-- Input "1234" matches bare number regex /^\d+$/
    +-- options.issueTracker === 'jira'
    +-- options.jiraProjectKey === 'PROJ'
    |
    v
[Return { source: 'jira', source_id: 'PROJ-1234', description: 'PROJ-1234' }]
    |
    v
[Normal add/analyze flow continues with resolved source]
    |
    +-- Fetch Jira ticket details via Atlassian MCP
    +-- Generate slug from ticket title
    +-- Create docs/requirements/{slug}/
```

---

## 3. Update Flow (Data Preservation)

```
[User runs `isdlc update`]
    |
    v
[lib/updater.js reads existing CLAUDE.md]
    |
    +-- Extract "## Issue Tracker Configuration" section content
    |       |
    |       v
    |   preservedSection = "## Issue Tracker Configuration\n- **Tracker**: jira\n..."
    |
    v
[updater writes new CLAUDE.md from updated template]
    |
    v
[Re-inject preservedSection into the new CLAUDE.md]
    |
    +-- Find template's "## Issue Tracker Configuration" section
    +-- Replace template defaults with preserved user values
    |
    v
[Write final CLAUDE.md]
```

---

## 4. State Mutation Points

| Point | Data Modified | Readers | Persistence |
|-------|--------------|---------|-------------|
| Installer writes CLAUDE.md | Issue tracker preference section | All agents via CLAUDE.md context | Persistent (file on disk) |
| Installer writes state.json | No issue tracker data in state.json | N/A | N/A |
| detectSource() call | None (pure function) | add/analyze command flow | Transient (return value only) |
| Updater preserves CLAUDE.md | Issue tracker section preserved across updates | All agents | Persistent |

---

## 5. Persistence Boundaries

| Data | Where Stored | Lifespan | Written By | Read By |
|------|-------------|----------|------------|---------|
| `issue_tracker` (github/jira/manual) | CLAUDE.md | Project lifetime | Installer (once) | All agents (every conversation) |
| `jira_project_key` | CLAUDE.md | Project lifetime | Installer (once) | add/analyze command |
| `github_repo` | CLAUDE.md | Project lifetime | Installer (once) | add command |
| `ghCliAvailable` | Not persisted | Install session only | Installer | Installer only |
| `mcpAvailable` | Not persisted | Install session only | Installer | Installer only |

---

## 6. Session Management

The issue tracker preference is not session-specific. It is set once during installation and persists across all Claude Code sessions. Claude Code reads CLAUDE.md at conversation start and provides it as context to all agents. No session token, no expiry, no refresh needed.

---

## 7. Concurrency Considerations

None. The data flow is strictly sequential:
1. Installation writes the preference once
2. Runtime reads the preference from CLAUDE.md context (read-only)
3. Updates preserve the preference atomically (read-modify-write on a single file)

There is no shared mutable state. The `detectSource()` function is pure (no side effects, no shared state). No race conditions are possible.
