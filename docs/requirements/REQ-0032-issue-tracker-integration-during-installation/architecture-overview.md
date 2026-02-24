# Architecture Overview: REQ-0032 Issue Tracker Integration During Installation

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-02-22
**Coverage**: 100%

---

## 1. Architecture Options

### Decision 1: Where to Store the Issue Tracker Preference

| Option | Summary | Pros | Cons | Pattern Alignment | Verdict |
|--------|---------|------|------|-------------------|---------|
| **A: CLAUDE.md section** | Add a structured section to CLAUDE.md with key-value pairs | All agents read CLAUDE.md automatically; no code needed for access; human-readable; editable by user | Parsing requires regex; can be accidentally corrupted by user edits | Follows existing CLAUDE.md convention (LLM Provider, Backlog Management sections) | **Selected** |
| **B: state.json field** | Add `issue_tracker` field to state.json root | Structured JSON; easy to parse programmatically | Requires hook-based access; agents do not read state.json directly; violates "no state.json writes during add/analyze" constraint | Breaks existing convention (state.json is workflow state, not project config) | Eliminated |
| **C: Separate config file** | Create `.isdlc/issue-tracker.json` | Clean separation; easy to parse | New file to maintain; agents do not read it automatically; requires explicit file read in every consumer | No existing precedent; adds complexity | Eliminated |

### Decision 2: How to Detect Atlassian MCP Server Availability

| Option | Summary | Pros | Cons | Pattern Alignment | Verdict |
|--------|---------|------|------|-------------------|---------|
| **A: `claude mcp list` CLI** | Shell out to `claude mcp list` and parse output | Direct, authoritative check; uses the official CLI | Depends on Claude Code being installed; output format may change | Follows existing pattern (installer runs `claude --version`) | **Selected** |
| **B: Check MCP config file** | Read `~/.claude/mcp.json` or equivalent config file | No dependency on `claude` CLI at runtime | Config file path varies by OS and Claude Code version; fragile | No existing precedent in iSDLC | Eliminated |
| **C: Attempt MCP tool call** | Try calling an Atlassian MCP tool and catch the error | Most reliable test of actual connectivity | Requires Claude Code session (not available during `isdlc init` CLI); MCP calls only work inside Claude Code conversations | Not applicable -- installer runs outside Claude Code | Eliminated |

### Decision 3: How to Enhance `detectSource()` for Preference-Aware Routing

| Option | Summary | Pros | Cons | Pattern Alignment | Verdict |
|--------|---------|------|------|-------------------|---------|
| **A: Optional `options` parameter** | `detectSource(input, options?)` where options carries the preference | Backward compatible; testable; no global state | Callers must pass the options | Clean function signature; follows JS convention | **Selected** |
| **B: Read CLAUDE.md inside detectSource** | `detectSource` reads the project's CLAUDE.md itself | No caller changes needed | File I/O inside a utility function; hard to test; violates single responsibility | Breaks the pure-function pattern of three-verb-utils.cjs | Eliminated |
| **C: Global config singleton** | Store preference in a module-level variable set during init | Fast lookup; no parameter passing | Shared mutable state; hard to test; initialization order dependency | Antipattern in this codebase | Eliminated |

---

## 2. Selected Architecture

### ADR-001: Store Issue Tracker Preference in CLAUDE.md

- **Status**: Accepted
- **Context**: The issue tracker preference must be accessible to all agents and the command layer without requiring code changes to each consumer. CLAUDE.md is already the universal context document read by Claude Code at conversation start.
- **Decision**: Add a `## Issue Tracker Configuration` section to `src/claude/CLAUDE.md.template` with structured key-value pairs. The installer interpolates user-selected values before writing.
- **Rationale**: CLAUDE.md is automatically loaded into every Claude Code conversation. Agents and commands already read it for other project configuration (provider, backlog management). No additional file I/O or hook infrastructure needed.
- **Consequences**: (1) Preference is human-readable and user-editable. (2) Parsing requires regex on markdown content; use a clearly delimited format. (3) Updater must preserve the section on CLAUDE.md refresh.

### ADR-002: Use `claude mcp list` for MCP Detection

- **Status**: Accepted
- **Context**: When the user selects Jira during installation, we need to verify the Atlassian MCP server is configured. The installer runs as a CLI tool (outside Claude Code), so MCP tool calls are not available.
- **Decision**: Use `execSync('claude mcp list')` and search the output for "atlassian" (case-insensitive). Wrap in try/catch for fail-open behavior.
- **Rationale**: This follows the existing pattern of `execSync('claude --version')` for Claude Code detection. It is the most direct check available outside a Claude Code session.
- **Consequences**: (1) Depends on `claude` CLI being installed (already checked in Step 3). (2) If `claude mcp list` output format changes, the check may give false negatives; fail-open ensures no blocking. (3) This check is informational only -- it does not guarantee MCP works at runtime.

### ADR-003: Optional Parameter for `detectSource()`

- **Status**: Accepted
- **Context**: The `detectSource()` function in `three-verb-utils.cjs` must be enhanced to support preference-based routing for ambiguous inputs (bare numbers) while maintaining backward compatibility.
- **Decision**: Extend the function signature to `detectSource(input, options?)` where `options = { issueTracker: string, jiraProjectKey: string }`. When `options` is provided and input is a bare number, use the preference to disambiguate.
- **Rationale**: This preserves the pure-function nature of `detectSource()`. No global state, no file I/O. Existing callers that pass no `options` get identical behavior. New callers (the command layer) can pass the preference read from CLAUDE.md context.
- **Consequences**: (1) All existing tests pass without modification. (2) New tests needed for the `options` path. (3) The command layer (`isdlc.md`) must describe how to extract the preference from CLAUDE.md and pass it to `detectSource()`.

---

## 3. Technology Decisions

| Technology | Version | Rationale | Alternatives Considered |
|------------|---------|-----------|------------------------|
| `lib/utils/prompts.js` (`select`, `confirm`, `text`) | Existing | Already used for provider selection in installer; no new dependency | None needed |
| `child_process.execSync` | Node.js built-in | Already used for `claude --version` and `git` commands | `child_process.exec` (async) -- unnecessary complexity for a quick check |
| Regex parsing for CLAUDE.md | Native JS | Simple key-value extraction from markdown | YAML block in markdown (overkill), JSON block in markdown (breaks readability) |

**New dependencies**: Zero.

---

## 4. Integration Architecture

### Integration Points

| ID | Source | Target | Interface Type | Data Format | Error Handling |
|----|--------|--------|---------------|-------------|----------------|
| INT-001 | `lib/installer.js` | `lib/utils/prompts.js` | Function call | `select()` returns string value | None (prompt library handles errors) |
| INT-002 | `lib/installer.js` | `gh` CLI | `execSync('gh --version')` | stdout string | try/catch, fail-open with warning |
| INT-003 | `lib/installer.js` | `claude` CLI | `execSync('claude mcp list')` | stdout string, search for "atlassian" | try/catch, fail-open with warning |
| INT-004 | `lib/installer.js` | `lib/utils/prompts.js` | Function call | `text()` returns string (project key) | Empty input handled with default |
| INT-005 | `lib/installer.js` | CLAUDE.md file | `writeFile()` with interpolated template | UTF-8 text | Standard write error handling |
| INT-006 | `isdlc.md` (add/analyze) | CLAUDE.md context | Read from conversation context | Markdown text parsed by agent | Missing section = fallback to pattern detection |
| INT-007 | `isdlc.md` (add/analyze) | `detectSource()` | Function call with options | `{ issueTracker, jiraProjectKey }` | Missing options = existing behavior |
| INT-008 | `lib/updater.js` | CLAUDE.md file | Read-modify-write | Section-aware preservation | Missing section = warn user |

### Data Flow

```
Installation Flow:
  User -> select() prompt -> issueTrackerMode (github|jira|manual)
  [If github] -> execSync('gh --version') -> ghAvailable (bool)
  [If jira]   -> execSync('claude mcp list') -> mcpAvailable (bool)
  [If jira && mcpAvailable] -> text() prompt -> jiraProjectKey (string)
  [If jira && !mcpAvailable] -> show instructions -> confirm retry or fallback
  issueTrackerMode + jiraProjectKey + githubRepo -> interpolate into CLAUDE.md template -> writeFile

Runtime Flow:
  User input (e.g., "1234") -> isdlc.md reads CLAUDE.md context
  -> extracts issue_tracker and jira_project_key
  -> passes as options to detectSource(input, options)
  -> detectSource resolves: "1234" + jira + "PROJ" -> { source: "jira", source_id: "PROJ-1234" }
  -> normal add/analyze flow continues
```

### Synchronization Model

No concurrency concerns. The installer runs sequentially. The runtime flow reads CLAUDE.md once at conversation start (handled by Claude Code itself) and passes values through function parameters.

---

## 5. Summary

### Key Decisions

| Decision | Choice | Risk Level |
|----------|--------|------------|
| Preference storage location | CLAUDE.md section | Low |
| MCP detection method | `claude mcp list` CLI | Medium (output format) |
| detectSource enhancement | Optional parameter | Low |
| New dependencies | None | None |

### Trade-offs

- **CLAUDE.md as config store**: Gains universal agent access at the cost of regex-based parsing. Acceptable because the format is simple and clearly delimited.
- **MCP detection via CLI**: Best available method outside Claude Code, but output format is not guaranteed stable. Mitigated by fail-open design.
- **Optional parameter vs. global state**: Slightly more verbose callers, but fully testable and backward compatible.

### Architecture Summary

The feature extends the existing installer flow with one new `select()` prompt step, adds a structured section to CLAUDE.md, and enhances `detectSource()` with an optional options parameter. No new files, no new dependencies, no new architectural patterns. The design follows the existing provider selection pattern in the installer and the existing adapter interface pattern in CLAUDE.md's Backlog Management section.
