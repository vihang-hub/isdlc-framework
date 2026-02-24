# Requirements Specification: REQ-0032 Issue Tracker Integration During Installation

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-02-22
**Coverage**: 100%

---

## 1. Business Context

### Problem Statement

Users who want to use Jira or GitHub Issues as their issue tracker with iSDLC must manually discover, install, and configure the appropriate MCP server (Atlassian MCP for Jira). There is no guided setup during installation, and the `add`/`analyze` commands rely solely on input pattern matching (`#N` for GitHub, `PROJECT-N` for Jira) with no stored preference. This creates friction for new users and leads to failed issue fetches when the MCP server is not configured.

### Stakeholders

| Stakeholder | Role | Interest |
|-------------|------|----------|
| iSDLC end-user (developer) | Primary user | Seamless setup of issue tracker during installation; no manual MCP configuration |
| Project lead | Secondary user | Ensure team members use a consistent issue tracker across the project |
| iSDLC framework maintainer | Developer | Clean extension point for future tracker integrations (Linear, Azure DevOps) |

### Success Metrics

- 100% of users who select Jira during installation have a working Atlassian MCP connection before completing init
- Zero failed Jira fetches in `add`/`analyze` due to missing MCP configuration when Jira was selected during install
- Installation time increase < 30 seconds for the new prompt step (excluding MCP setup time)

### Driving Factors

- User friction: multiple reports of failed Jira imports due to missing MCP server
- Existing pattern: the installer already has a provider selection prompt that can be replicated
- Existing documentation: CLAUDE.md.template already has an "MCP Prerequisite Check" section that can be enhanced

---

## 2. Stakeholders and Personas

### 2.1 Developer (Primary)

- **Role**: Solo developer or team member using iSDLC for their project
- **Goals**: Set up iSDLC with minimal manual steps; have issue tracker working from day one
- **Pain points**: Must discover MCP setup on their own; `add "#42"` fails silently if GitHub CLI is not available; `add "PROJ-123"` fails if Atlassian MCP is not configured
- **Proficiency**: Varies from beginner (following README) to expert (customizing framework)
- **Key tasks**: Running `isdlc init`, importing issues from their tracker, running analyze workflows

### 2.2 Team Lead (Secondary)

- **Role**: Person responsible for configuring iSDLC for the team
- **Goals**: Ensure consistent tracker configuration across team members
- **Pain points**: No way to pre-configure tracker preference; each team member must set up independently
- **Proficiency**: High -- understands both the project tooling and the external tracker

---

## 3. User Journeys

### 3.1 Happy Path: GitHub Issues (Default)

1. **Entry**: User runs `isdlc init` in a GitHub-hosted repository
2. **Flow**: Installer detects GitHub remote. Presents issue tracker selection with "GitHub Issues" pre-selected. User confirms. Installer validates `gh` CLI is available. Stores `issue_tracker: github` in CLAUDE.md.
3. **Exit**: Installation completes. User can immediately run `/isdlc add "#42"` and it works.

### 3.2 Happy Path: Jira

1. **Entry**: User runs `isdlc init` in any project
2. **Flow**: Installer presents issue tracker selection. User selects "Jira". Installer checks if Atlassian MCP server is configured. If not, provides setup command (`claude mcp add --transport sse atlassian https://mcp.atlassian.com/v1/sse`). User runs the command. Installer re-checks and validates connection. Asks for default Jira project key. Stores `issue_tracker: jira` and `jira_project_key: PROJ` in CLAUDE.md.
3. **Exit**: Installation completes. User can immediately run `/isdlc add "PROJ-123"` and it works.

### 3.3 Happy Path: Manual Only

1. **Entry**: User runs `isdlc init` and does not use an external tracker
2. **Flow**: User selects "None / Manual only". Installer stores `issue_tracker: manual` in CLAUDE.md.
3. **Exit**: Installation completes. Pattern-based detection still works for ad-hoc GitHub/Jira references.

### 3.4 Error Path: Jira MCP Not Available

1. **Entry**: User selects Jira but does not install the MCP server
2. **Flow**: Installer shows setup instructions. User declines or fails to install. Installer warns that Jira integration will not work until MCP is configured. Offers to fall back to "Manual only" or retry.
3. **Exit**: Installation completes with `issue_tracker: manual` (degraded). CLAUDE.md includes instructions for later Jira setup.

### 3.5 Error Path: GitHub CLI Not Available

1. **Entry**: User selects GitHub Issues but `gh` CLI is not installed
2. **Flow**: Installer checks for `gh` CLI. If not found, warns that GitHub issue fetching requires the CLI. Offers to continue (pattern matching still works for add) or switch to Manual.
3. **Exit**: Installation completes with warning. User can install `gh` CLI later.

---

## 4. Technical Context

### Existing Patterns

The installer (`lib/installer.js`) already follows a step-based flow with prompts:
- Step 1: Project detection
- Step 2: Monorepo detection
- Step 3: Claude Code detection
- Provider selection (uses `select()` from `lib/utils/prompts.js`)
- Step 4: Installation confirmation + file copy
- Steps 5-7: Setup and state generation

The issue tracker selection should be inserted between the current provider selection and Step 4 (installation confirmation), following the same `select()` prompt pattern.

### Constraints

- **Module system**: `lib/installer.js` is ESM. No CommonJS.
- **Cross-platform**: Must work on macOS, Linux, Windows. No shell-specific commands for MCP detection.
- **No new dependencies**: Use existing `lib/utils/prompts.js` for prompts.
- **Fail-open**: If MCP detection fails, installation must not be blocked (Article X).
- **CLAUDE.md is the preference store**: No new config files. The preference is stored in CLAUDE.md so that all agents and commands can read it via their existing CLAUDE.md context.
- **Backward compatibility**: Existing installations without the preference should continue to work (fallback to pattern-based detection).

### Integration Points

| Source | Target | Interface | Data Format |
|--------|--------|-----------|-------------|
| Installer | `lib/utils/prompts.js` | `select()`, `confirm()`, `text()` | Function calls |
| Installer | CLAUDE.md file | `writeFile()` / template interpolation | Markdown text |
| Installer | `gh` CLI | `execSync('gh --version')` | Shell command |
| Installer | Claude MCP | `execSync('claude mcp list')` or similar | Shell command |
| `isdlc.md` (add/analyze) | CLAUDE.md | Read from conversation context | Markdown section |
| `detectSource()` | CLAUDE.md preference | Read from context (passed as parameter) | String enum |

### Existing Test Coverage

- `lib/installer.test.js`: 30 test cases covering the full installer flow
- `src/claude/hooks/lib/three-verb-utils.cjs` tests: `detectSource` has dedicated test cases
- Both test suites use mocked prompts and file systems

---

## 5. Quality Attributes and Risks

### Quality Attributes

| Attribute | Priority | Threshold |
|-----------|----------|-----------|
| Usability | Critical | User completes tracker setup in < 3 prompts |
| Reliability | High | MCP detection never crashes the installer |
| Maintainability | High | New tracker types can be added by editing one enum + one CLAUDE.md section |
| Performance | Medium | Issue tracker prompt adds < 2 seconds to install time |
| Security | Medium | No credentials stored in CLAUDE.md; MCP handles auth separately |

### Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|-----------|--------|------------|
| R-001 | MCP detection command varies across Claude Code versions | Medium | Medium | Use try/catch around `claude mcp list`; fail-open to manual |
| R-002 | CLAUDE.md format changes break preference parsing | Low | High | Use a structured, clearly delimited section with documented format |
| R-003 | `gh` CLI detection fails on non-standard installations | Low | Low | Warn but do not block; GitHub pattern detection still works without `gh` |
| R-004 | User selects Jira but never completes MCP setup | Medium | Medium | Fall back to manual with clear warning; provide re-setup instructions |
| R-005 | Existing installations missing the preference section | High (by design) | Low | `detectSource()` falls back to pattern-based detection when preference is absent |

---

## 6. Functional Requirements

### FR-001: Issue Tracker Selection Prompt

**Description**: During `isdlc init`, after provider selection and before installation confirmation, present a prompt allowing the user to select their issue tracker.

**Confidence**: High

**Acceptance Criteria**:

- **AC-001-01**: The installer presents a `select()` prompt with three options: "GitHub Issues", "Jira", and "None / Manual only".
- **AC-001-02**: If the project has a GitHub remote (detected via `git remote -v`), "GitHub Issues" is pre-selected as the default.
- **AC-001-03**: If the project has no GitHub remote, "None / Manual only" is pre-selected as the default.
- **AC-001-04**: The selection is stored in a variable `issueTrackerMode` with values `"github"`, `"jira"`, or `"manual"`.
- **AC-001-05**: When `--force` flag is used, the prompt is skipped and defaults to `"manual"`.

### FR-002: GitHub Issues Validation

**Description**: When the user selects GitHub Issues, validate that the `gh` CLI is available.

**Confidence**: High

**Acceptance Criteria**:

- **AC-002-01**: The installer runs `gh --version` (with try/catch) to detect the GitHub CLI.
- **AC-002-02**: If `gh` is available, log success: "GitHub CLI detected: {version}".
- **AC-002-03**: If `gh` is not available, warn: "GitHub CLI (gh) not found. Issue fetching will require it. Install: https://cli.github.com/". Do NOT block installation.
- **AC-002-04**: Regardless of `gh` availability, the `issueTrackerMode` remains `"github"` (pattern detection still works).

### FR-003: Jira MCP Server Validation

**Description**: When the user selects Jira, check if the Atlassian MCP server is configured and guide setup if needed.

**Confidence**: High

**Acceptance Criteria**:

- **AC-003-01**: The installer checks for the Atlassian MCP server by running `claude mcp list` and searching for "atlassian" in the output (case-insensitive).
- **AC-003-02**: If the Atlassian MCP server is found, log success: "Atlassian MCP server detected."
- **AC-003-03**: If not found, display setup instructions: `claude mcp add --transport sse atlassian https://mcp.atlassian.com/v1/sse`
- **AC-003-04**: After displaying instructions, prompt: "Have you configured the Atlassian MCP server? [Y/n]". If yes, re-check. If no, warn and offer fallback to manual.
- **AC-003-05**: On successful MCP detection, prompt for default Jira project key using `text()`: "Default Jira project key (e.g., PROJ):". Store as `jiraProjectKey`.
- **AC-003-06**: If MCP detection command fails (e.g., `claude` not available), fall back gracefully: warn and offer manual mode. Never crash the installer.

### FR-004: Preference Storage in CLAUDE.md

**Description**: Store the issue tracker preference in the CLAUDE.md template so it is available to all agents and commands at runtime.

**Confidence**: High

**Acceptance Criteria**:

- **AC-004-01**: The CLAUDE.md template (`src/claude/CLAUDE.md.template`) includes a new section `## Issue Tracker Configuration` under the existing `## Backlog Management` section.
- **AC-004-02**: The section contains three fields: `issue_tracker` (github/jira/manual), `jira_project_key` (string or empty), and `github_repo` (auto-detected or empty).
- **AC-004-03**: The installer interpolates the selected values into the CLAUDE.md template before writing it to the project root.
- **AC-004-04**: For existing installations (CLAUDE.md already exists), the installer does NOT overwrite CLAUDE.md. Instead, it logs: "Add the Issue Tracker Configuration section to your CLAUDE.md manually." and provides the section content.
- **AC-004-05**: The section format is machine-readable using a simple key-value pattern that can be parsed with regex from CLAUDE.md content.

### FR-005: Analyze Flow Routing Enhancement

**Description**: The `detectSource()` function and the `add`/`analyze` commands read the stored issue tracker preference to enhance source detection.

**Confidence**: Medium

**Acceptance Criteria**:

- **AC-005-01**: When the user provides ambiguous input (not matching `#N` or `PROJECT-N` patterns), the system reads `issue_tracker` from CLAUDE.md context to determine the default tracker.
- **AC-005-02**: When `issue_tracker` is `"jira"` and input is a bare number (e.g., `"1234"`), the system prepends the configured `jira_project_key` to form `"PROJ-1234"` and routes to Jira.
- **AC-005-03**: When `issue_tracker` is `"github"` and input is a bare number (e.g., `"42"`), the system prepends `#` to form `"#42"` and routes to GitHub.
- **AC-005-04**: When `issue_tracker` is `"manual"` or absent, the existing behavior is preserved: bare numbers are treated as manual input.
- **AC-005-05**: The `detectSource()` function signature is extended with an optional `options` parameter: `detectSource(input, options?)` where `options.issueTracker` and `options.jiraProjectKey` provide the stored preference.
- **AC-005-06**: Existing callers that do not pass `options` continue to work identically (backward compatible).

### FR-006: Updater Preservation

**Description**: The `isdlc update` flow must preserve user-configured issue tracker preferences in CLAUDE.md.

**Confidence**: High

**Acceptance Criteria**:

- **AC-006-01**: The updater (`lib/updater.js`) does NOT overwrite the `## Issue Tracker Configuration` section when updating CLAUDE.md.
- **AC-006-02**: If the section is missing after an update (e.g., template changed), the updater warns the user.

### FR-007: Dry Run Support

**Description**: The issue tracker prompt respects the `--dry-run` flag.

**Confidence**: High

**Acceptance Criteria**:

- **AC-007-01**: When `--dry-run` is active, the prompt is shown but no files are written.
- **AC-007-02**: The dry run summary includes the selected issue tracker mode.

---

## 7. Out of Scope

| Item | Reason | Dependency |
|------|--------|------------|
| Linear integration | Future tracker; no MCP server available yet | Adapter interface in CLAUDE.md supports future additions |
| Azure DevOps integration | Future tracker | Same adapter pattern |
| Bidirectional Jira sync (status push) | Already implemented in orchestrator merge flow | Existing `updateStatus()` in orchestrator |
| MCP server auto-installation | MCP installation requires user authentication; cannot be automated | User must run `claude mcp add` manually |
| CLAUDE.md migration tool for existing installations | Low priority; users can add the section manually | FR-004 AC-004-04 provides fallback |

---

## 8. MoSCoW Prioritization

| FR | Title | Priority | Rationale |
|----|-------|----------|-----------|
| FR-001 | Issue Tracker Selection Prompt | Must Have | Core feature: the installation prompt |
| FR-002 | GitHub Issues Validation | Should Have | Useful but not blocking (pattern detection works without `gh`) |
| FR-003 | Jira MCP Server Validation | Must Have | Key differentiator: guided Jira setup is the primary value |
| FR-004 | Preference Storage in CLAUDE.md | Must Have | Required for all downstream routing |
| FR-005 | Analyze Flow Routing Enhancement | Should Have | Improves UX for bare number inputs; not strictly required |
| FR-006 | Updater Preservation | Must Have | Prevents user config loss on updates |
| FR-007 | Dry Run Support | Should Have | Consistency with existing dry-run behavior |

---

## Pending Sections

None -- all sections complete.
