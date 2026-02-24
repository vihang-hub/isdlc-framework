# Module Design: REQ-0032 Issue Tracker Integration During Installation

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-02-22
**Coverage**: 100%

---

## Module 1: Installer Issue Tracker Prompt (`lib/installer.js`)

### Responsibility

Add an issue tracker selection step to the `install()` function, positioned after the provider selection prompt and before the installation confirmation (Step 4). Validates the selected tracker's prerequisites and stores the preference for template interpolation.

### Public Interface

No new exported functions. The logic is internal to the existing `install(projectRoot, options)` function.

### Internal Functions

```javascript
/**
 * Detect if the project has a GitHub remote.
 * @param {string} projectRoot - Project directory
 * @returns {Promise<{hasGitHub: boolean, repo: string}>}
 */
async function detectGitHubRemote(projectRoot)

/**
 * Check if the GitHub CLI (gh) is available.
 * @returns {{available: boolean, version: string}}
 */
function checkGhCli()

/**
 * Check if the Atlassian MCP server is configured in Claude Code.
 * @returns {{available: boolean, raw: string}}
 */
function checkAtlassianMcp()
```

### Data Structures

```javascript
// Issue tracker selection result (internal to installer)
const issueTrackerConfig = {
  mode: 'github' | 'jira' | 'manual',  // Selected tracker type
  jiraProjectKey: '',                     // e.g., 'PROJ' (only when mode === 'jira')
  githubRepo: '',                         // e.g., 'owner/repo' (auto-detected)
  ghCliAvailable: false,                  // Whether gh CLI was found
  mcpAvailable: false,                    // Whether Atlassian MCP was found
};
```

### Dependencies

- `lib/utils/prompts.js` (select, confirm, text)
- `child_process.execSync` (Node.js built-in)
- `lib/utils/fs-helpers.js` (writeFile -- existing)

### Estimated Size

- ~80-100 lines of new code within `install()`
- 3 new helper functions (~30 lines each)

---

## Module 2: CLAUDE.md Template Section (`src/claude/CLAUDE.md.template`)

### Responsibility

Define the `## Issue Tracker Configuration` section structure with interpolation placeholders. This section serves as the persistent storage for the tracker preference.

### Data Structure (Markdown Section)

```markdown
## Issue Tracker Configuration

- **Tracker**: {{ISSUE_TRACKER}}
- **Jira Project Key**: {{JIRA_PROJECT_KEY}}
- **GitHub Repository**: {{GITHUB_REPO}}

### Adapter Interface

| Method | Purpose | Implementation |
|--------|---------|---------------|
| `getTicket(id)` | Retrieve ticket data | {{ADAPTER_IMPL}} |
| `updateStatus(id, status)` | Transition status | {{ADAPTER_IMPL}} |
| `getLinkedDocument(url)` | Pull linked document | {{ADAPTER_IMPL}} |
```

### Dependencies

None (static template file).

### Estimated Size

~20-30 lines added to the template.

---

## Module 3: Source Detection Enhancement (`src/claude/hooks/lib/three-verb-utils.cjs`)

### Responsibility

Extend `detectSource()` with an optional `options` parameter to support preference-based routing for bare number inputs.

### Public Interface

```javascript
/**
 * Detects the source type from add verb input.
 * Enhanced with optional issue tracker preference.
 *
 * @param {string} input - Raw user input
 * @param {object} [options] - Optional issue tracker preference
 * @param {string} [options.issueTracker] - 'github' | 'jira' | 'manual'
 * @param {string} [options.jiraProjectKey] - Default Jira project key
 * @returns {{ source: string, source_id: string|null, description: string }}
 */
function detectSource(input, options)
```

### Behavior Change

The function currently handles three patterns:
1. `#N` -> GitHub
2. `PROJECT-N` -> Jira
3. Everything else -> Manual

With `options`, a fourth pattern is added:
4. Bare number (e.g., `"1234"`) + `options.issueTracker` -> route to configured tracker

### Dependencies

None (pure function).

### Estimated Size

~15-20 lines added to the existing function.

---

## Module 4: Command Layer Routing (`src/claude/commands/isdlc.md`)

### Responsibility

Update the `add` and `analyze` command definitions to describe how the agent reads the issue tracker preference from CLAUDE.md and passes it to `detectSource()`.

### Data Flow

```
CLAUDE.md context -> parse "## Issue Tracker Configuration" section
  -> extract issue_tracker, jira_project_key
  -> pass to detectSource(input, { issueTracker, jiraProjectKey })
```

### Dependencies

- `detectSource()` from `three-verb-utils.cjs` (via agent execution)
- CLAUDE.md context (read by Claude Code automatically)

### Estimated Size

~10-15 lines of additions to the `add` and `analyze` sections in isdlc.md.

---

## Module 5: Updater Section Preservation (`lib/updater.js`)

### Responsibility

Ensure the `## Issue Tracker Configuration` section in CLAUDE.md is preserved when the updater refreshes CLAUDE.md from the template.

### Approach

The updater already has a pattern for preserving user artifacts. The Issue Tracker Configuration section is user-configured data that must not be overwritten. The implementation should:

1. Before overwriting CLAUDE.md, extract the existing `## Issue Tracker Configuration` section content
2. After writing the new template, re-inject the preserved section
3. If the section does not exist in the old file, use the template defaults

### Dependencies

- `lib/utils/fs-helpers.js` (readFile, writeFile)

### Estimated Size

~15-20 lines added to the updater.

---

## Dependency Diagram

```
lib/installer.js
  ├── lib/utils/prompts.js (select, confirm, text)
  ├── child_process (execSync)
  ├── src/claude/CLAUDE.md.template (reads template, writes interpolated)
  └── lib/utils/fs-helpers.js (writeFile)

src/claude/hooks/lib/three-verb-utils.cjs
  └── (no new dependencies -- pure function enhancement)

src/claude/commands/isdlc.md
  └── (references detectSource and CLAUDE.md -- no code dependency)

lib/updater.js
  └── lib/utils/fs-helpers.js (readFile, writeFile -- existing)
```

No circular dependencies. All data flows from installer -> template -> runtime.
