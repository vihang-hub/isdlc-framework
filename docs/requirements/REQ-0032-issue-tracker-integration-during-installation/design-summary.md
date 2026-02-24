# Design Summary: REQ-0032 Issue Tracker Integration During Installation

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-02-22
**Coverage**: 100%

---

## 1. Executive Summary

REQ-0032 adds issue tracker integration to the iSDLC installation flow. The design introduces five narrowly scoped changes:

1. **Installer prompt** (`lib/installer.js`): A new `select()` prompt for tracker type (github/jira/manual), plus validation sub-flows for GitHub CLI and Atlassian MCP server availability. Follows the existing provider selection pattern exactly.

2. **CLAUDE.md template** (`src/claude/CLAUDE.md.template`): A new `## Issue Tracker Configuration` section with three key-value fields and placeholder tokens for installer interpolation.

3. **Source detection** (`three-verb-utils.cjs`): `detectSource(input, options?)` gains an optional second parameter for preference-based bare number routing. Fully backward compatible.

4. **Command routing** (`isdlc.md`): The `add` and `analyze` sections describe how the agent extracts the preference from CLAUDE.md context and passes it to `detectSource()`.

5. **Updater preservation** (`lib/updater.js`): Section-aware preservation of the Issue Tracker Configuration section during CLAUDE.md updates.

No new files. No new dependencies. No new architectural patterns. All error paths fail-open (Article X).

---

## 2. Cross-Check Results

### Requirements vs. Impact

| FR | Impact Analysis Coverage | Status |
|----|------------------------|--------|
| FR-001 (Installer prompt) | Tier 1: `lib/installer.js` | Covered |
| FR-002 (GitHub validation) | Tier 1: `lib/installer.js` | Covered |
| FR-003 (Jira MCP validation) | Tier 1: `lib/installer.js` | Covered |
| FR-004 (Preference storage) | Tier 1: `CLAUDE.md.template` + `lib/installer.js` | Covered |
| FR-005 (Analyze routing) | Tier 1: `three-verb-utils.cjs` + `isdlc.md` | Covered |
| FR-006 (Updater preservation) | Tier 2: `lib/updater.js` | Covered |
| FR-007 (Dry run) | Tier 1: `lib/installer.js` | Covered |

### Architecture vs. Design

| ADR | Module Design Alignment | Status |
|-----|------------------------|--------|
| ADR-001 (CLAUDE.md storage) | Module 2 (CLAUDE.md template) + Module 4 (command routing) | Consistent |
| ADR-002 (`claude mcp list`) | Module 1 (installer) `checkAtlassianMcp()` | Consistent |
| ADR-003 (Optional parameter) | Module 3 (`detectSource` enhancement) | Consistent |

### Interface Consistency

| Interface | Architecture Reference | Design Specification | Status |
|-----------|----------------------|---------------------|--------|
| `detectSource(input, options?)` | INT-007 in architecture | Section 4 in interface-spec | Consistent |
| CLAUDE.md section format | INT-006 in architecture | Section 5 in interface-spec | Consistent |
| Installer prompts | INT-001, INT-004 in architecture | Section 6 in interface-spec | Consistent |

### Confidence Consistency

All artifacts use High confidence. The lower-confidence items are limited to FR-005 (Medium) for the analyze routing enhancement, which is a "Should Have" optimization. This is consistent across requirements, impact analysis, and design.

---

## 3. Open Questions

| # | Question | Blocking? | Proposed Resolution |
|---|----------|-----------|-------------------|
| 1 | What is the exact output format of `claude mcp list`? | No | Test empirically during implementation. Use case-insensitive substring match with fail-open. |
| 2 | Should monorepo installations support per-project tracker preferences? | No | Out of scope for v1. Document as future enhancement. Global preference applies to all projects. |
| 3 | Should the Jira project key prompt validate against the actual Jira instance? | No | Not during installation (no MCP tool calls available). Validate at first use in `add`/`analyze`. |
| 4 | Should `detectSource()` options be sourced from CLAUDE.md parsing or from a dedicated extraction function? | No | The command layer (isdlc.md) describes the extraction. The agent reads CLAUDE.md content from conversation context and extracts values using the documented regex patterns. No separate extraction function needed. |

---

## 4. Implementation Readiness Assessment

| Criterion | Status | Notes |
|-----------|--------|-------|
| All FRs have testable ACs | Pass | 7 FRs with 30 total ACs |
| All modules have defined boundaries | Pass | 5 modules with no circular dependencies |
| All interfaces have concrete types | Pass | 4 interfaces fully specified |
| All error paths have recovery strategies | Pass | 10 error codes with recovery actions |
| All data flows are documented | Pass | 3 flows (install, runtime, update) |
| Architecture decisions are accepted | Pass | 3 ADRs, all Accepted |
| No unresolved blocking questions | Pass | 4 open questions, none blocking |
| Backward compatibility confirmed | Pass | Optional parameter, section fallback, missing CLAUDE.md handling |

**Verdict**: Ready for implementation. A developer can build this feature from these specifications without further clarification.

---

## 5. Test Strategy Outline

### Unit Tests (lib/installer.test.js)

- `detectGitHubRemote()`: GitHub SSH remote, HTTPS remote, non-GitHub remote, no remote, git error
- `checkGhCli()`: available, not available, timeout
- `checkAtlassianMcp()`: available, not available, claude not available, timeout
- Issue tracker prompt: each selection (github, jira, manual), --force default, --dry-run
- Template interpolation: all three tracker types, existing CLAUDE.md skip behavior
- Full installer flow with issue tracker: end-to-end with mocked prompts

### Unit Tests (three-verb-utils.cjs)

- `detectSource("1234", { issueTracker: 'jira', jiraProjectKey: 'PROJ' })` -> jira
- `detectSource("42", { issueTracker: 'github' })` -> github
- `detectSource("42", { issueTracker: 'manual' })` -> manual
- `detectSource("#42", { issueTracker: 'jira' })` -> github (explicit pattern wins)
- `detectSource("PROJ-123", { issueTracker: 'github' })` -> jira (explicit pattern wins)
- `detectSource("1234")` -> manual (no options, backward compatible)
- `detectSource("1234", {})` -> manual (empty options)
- `detectSource("1234", { issueTracker: 'jira' })` -> manual (missing jiraProjectKey)

### Unit Tests (lib/updater.test.js)

- Section preserved during update
- Missing section handled (template defaults used)
- Malformed section handled gracefully

### Estimated Test Count

~18-22 new test cases across the three test files.
