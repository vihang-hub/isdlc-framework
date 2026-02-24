# Interface Specification: REQ-0032 Issue Tracker Integration During Installation

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-02-22
**Coverage**: 100%

---

## 1. `detectGitHubRemote(projectRoot)` -- Internal to `lib/installer.js`

### Signature

```javascript
/**
 * @param {string} projectRoot - Absolute path to the project root
 * @returns {Promise<{hasGitHub: boolean, repo: string}>}
 */
async function detectGitHubRemote(projectRoot)
```

### Behavior

1. Run `git remote -v` in `projectRoot` directory
2. Parse output for `github.com` URLs
3. Extract `owner/repo` from the URL (handles both HTTPS and SSH formats)
4. Return `{ hasGitHub: true, repo: 'owner/repo' }` on match
5. Return `{ hasGitHub: false, repo: '' }` on no match or error

### Validation Rules

- `projectRoot` must be a non-empty string
- If `git` is not available, returns `{ hasGitHub: false, repo: '' }` (fail-open)

### Examples

| Input (git remote output) | Output |
|--------------------------|--------|
| `origin  git@github.com:user/proj.git (fetch)` | `{ hasGitHub: true, repo: 'user/proj' }` |
| `origin  https://github.com/user/proj.git (fetch)` | `{ hasGitHub: true, repo: 'user/proj' }` |
| `origin  https://gitlab.com/user/proj.git (fetch)` | `{ hasGitHub: false, repo: '' }` |
| (no remotes) | `{ hasGitHub: false, repo: '' }` |
| (git not available) | `{ hasGitHub: false, repo: '' }` |

### Error Types

- None thrown. All errors caught internally and return the no-match result.

---

## 2. `checkGhCli()` -- Internal to `lib/installer.js`

### Signature

```javascript
/**
 * @returns {{available: boolean, version: string}}
 */
function checkGhCli()
```

### Behavior

1. Run `gh --version` via `execSync` with 5-second timeout
2. Parse first line for version string
3. Return `{ available: true, version: '2.x.x' }` on success
4. Return `{ available: false, version: '' }` on error

### Validation Rules

- No input parameters
- Timeout: 5000ms (matches existing `claude --version` pattern)

### Examples

| Scenario | Output |
|----------|--------|
| `gh` installed, version 2.45.0 | `{ available: true, version: '2.45.0' }` |
| `gh` not found | `{ available: false, version: '' }` |
| `gh` times out | `{ available: false, version: '' }` |

### Error Types

- None thrown. All errors caught internally.

---

## 3. `checkAtlassianMcp()` -- Internal to `lib/installer.js`

### Signature

```javascript
/**
 * @returns {{available: boolean, raw: string}}
 */
function checkAtlassianMcp()
```

### Behavior

1. Run `claude mcp list` via `execSync` with 10-second timeout
2. Search output for "atlassian" (case-insensitive)
3. Return `{ available: true, raw: '<output>' }` if found
4. Return `{ available: false, raw: '<output>' }` if not found
5. Return `{ available: false, raw: '' }` on error (claude not available, etc.)

### Validation Rules

- No input parameters
- Requires `claude` CLI to be available (checked in installer Step 3)
- Timeout: 10000ms (MCP listing may take longer than version check)

### Examples

| Scenario | Output |
|----------|--------|
| Atlassian MCP configured | `{ available: true, raw: 'atlassian  https://...' }` |
| No Atlassian MCP | `{ available: false, raw: 'other-mcp  ...' }` |
| `claude` not available | `{ available: false, raw: '' }` |

### Error Types

- None thrown. All errors caught internally.

---

## 4. `detectSource(input, options?)` -- Enhanced in `three-verb-utils.cjs`

### Signature

```javascript
/**
 * Detects the source type from add verb input.
 *
 * @param {string} input - Raw user input
 * @param {object} [options] - Optional issue tracker preference
 * @param {string} [options.issueTracker] - 'github' | 'jira' | 'manual' | undefined
 * @param {string} [options.jiraProjectKey] - Default Jira project key (e.g., 'PROJ')
 * @returns {{ source: string, source_id: string|null, description: string }}
 */
function detectSource(input, options)
```

### Behavior (Extended)

Original behavior preserved for all existing patterns. New behavior for bare numbers:

1. If `input` matches `#N` -> `{ source: 'github', source_id: 'GH-N', description: '#N' }` (unchanged)
2. If `input` matches `PROJECT-N` -> `{ source: 'jira', source_id: 'PROJECT-N', description: 'PROJECT-N' }` (unchanged)
3. **NEW**: If `input` matches `^\d+$` (bare number) AND `options.issueTracker` is defined:
   - If `options.issueTracker === 'jira'` AND `options.jiraProjectKey`: `{ source: 'jira', source_id: '{jiraProjectKey}-{input}', description: '{jiraProjectKey}-{input}' }`
   - If `options.issueTracker === 'github'`: `{ source: 'github', source_id: 'GH-{input}', description: '#{input}' }`
   - If `options.issueTracker === 'manual'` or no match: fall through to step 4
4. Everything else -> `{ source: 'manual', source_id: null, description: input }` (unchanged)

### Validation Rules

- `input`: must be a non-empty string (existing validation: returns manual for null/undefined/empty)
- `options`: optional. If not provided, all existing behavior is preserved exactly.
- `options.issueTracker`: must be one of `'github'`, `'jira'`, `'manual'`. Any other value treated as if absent.
- `options.jiraProjectKey`: must be a non-empty string when `issueTracker === 'jira'`. If empty/missing, bare number falls through to manual.

### Examples

| Input | Options | Output |
|-------|---------|--------|
| `"#42"` | (none) | `{ source: 'github', source_id: 'GH-42', description: '#42' }` |
| `"#42"` | `{ issueTracker: 'jira' }` | `{ source: 'github', source_id: 'GH-42', description: '#42' }` (explicit pattern wins) |
| `"PROJ-123"` | (none) | `{ source: 'jira', source_id: 'PROJ-123', description: 'PROJ-123' }` |
| `"PROJ-123"` | `{ issueTracker: 'github' }` | `{ source: 'jira', source_id: 'PROJ-123', description: 'PROJ-123' }` (explicit pattern wins) |
| `"1234"` | (none) | `{ source: 'manual', source_id: null, description: '1234' }` |
| `"1234"` | `{ issueTracker: 'jira', jiraProjectKey: 'PROJ' }` | `{ source: 'jira', source_id: 'PROJ-1234', description: 'PROJ-1234' }` |
| `"42"` | `{ issueTracker: 'github' }` | `{ source: 'github', source_id: 'GH-42', description: '#42' }` |
| `"42"` | `{ issueTracker: 'manual' }` | `{ source: 'manual', source_id: null, description: '42' }` |
| `"fix login bug"` | `{ issueTracker: 'jira', jiraProjectKey: 'PROJ' }` | `{ source: 'manual', source_id: null, description: 'fix login bug' }` (not a bare number) |

### Error Types

- None thrown. Invalid options are silently ignored (fail-open).

---

## 5. CLAUDE.md Section Format (Machine-Readable)

### Format

```markdown
## Issue Tracker Configuration

- **Tracker**: github
- **Jira Project Key**:
- **GitHub Repository**: owner/repo
```

### Parsing Pattern (Regex)

```javascript
// Extract tracker type
const trackerMatch = content.match(/\*\*Tracker\*\*:\s*(\w+)/);
const issueTracker = trackerMatch ? trackerMatch[1] : null;

// Extract Jira project key
const jiraMatch = content.match(/\*\*Jira Project Key\*\*:\s*(\S+)/);
const jiraProjectKey = jiraMatch ? jiraMatch[1] : '';

// Extract GitHub repo
const ghMatch = content.match(/\*\*GitHub Repository\*\*:\s*(\S+)/);
const githubRepo = ghMatch ? ghMatch[1] : '';
```

### Validation Rules

- `Tracker` must be one of: `github`, `jira`, `manual`
- `Jira Project Key` must match `[A-Z]+` if non-empty
- `GitHub Repository` must match `[\w.-]+/[\w.-]+` if non-empty
- Missing section: all values default to null/empty (fallback to pattern detection)

### Template Placeholders

In `CLAUDE.md.template`:
```markdown
- **Tracker**: {{ISSUE_TRACKER}}
- **Jira Project Key**: {{JIRA_PROJECT_KEY}}
- **GitHub Repository**: {{GITHUB_REPO}}
```

Interpolation by installer:
```javascript
content = content.replace('{{ISSUE_TRACKER}}', issueTrackerConfig.mode);
content = content.replace('{{JIRA_PROJECT_KEY}}', issueTrackerConfig.jiraProjectKey || '');
content = content.replace('{{GITHUB_REPO}}', issueTrackerConfig.githubRepo || '');
```

---

## 6. Installer Prompt Interface

### Issue Tracker Selection

```javascript
const issueTrackerMode = await select('Select issue tracker:', [
  {
    title: 'GitHub Issues',
    value: 'github',
    description: 'Use GitHub Issues for tracking (requires gh CLI)'
  },
  {
    title: 'Jira',
    value: 'jira',
    description: 'Use Jira for tracking (requires Atlassian MCP server)'
  },
  {
    title: 'None / Manual only',
    value: 'manual',
    description: 'No external tracker. Manual descriptions only.'
  },
], defaultIndex);
```

### Jira Project Key Input

```javascript
const jiraProjectKey = await text(
  'Default Jira project key (e.g., PROJ):',
  ''
);
```

### MCP Setup Confirmation

```javascript
const mcpConfigured = await confirm(
  'Have you configured the Atlassian MCP server?',
  false
);
```
