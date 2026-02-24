# Quick Scan: REQ-0032 Issue Tracker Integration During Installation

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-02-22
**Coverage**: 100%

---

## 1. Scope

**Classification**: Medium (6-15 files)

This feature adds an issue tracker selection step to the `isdlc init` installer flow (Step 3.5, between Claude Code detection and installation confirmation). The user picks GitHub Issues, Jira, or Manual-only. The selection is persisted into the CLAUDE.md template so that the `add`/`analyze`/`build` command flows can read it to route issue fetching. If Jira is selected, the installer guides the user through Atlassian MCP server setup and validates the connection before proceeding.

**Change type**: Mixed (new code in the installer prompt + modifications to CLAUDE.md template, isdlc.md command routing, and three-verb-utils.cjs source detection)

**Subsystems affected**: 4 -- Installer, CLAUDE.md template, isdlc.md command definition, three-verb-utils (detectSource).

---

## 2. Keywords

| Keyword | Hits | Key Files |
|---------|------|-----------|
| `issue_tracker` / `issueTracker` | 1 | `src/claude/skills/tracing/similar-bug-search/SKILL.md` |
| `detectSource` | 6 | `src/claude/hooks/lib/three-verb-utils.cjs`, `src/claude/commands/isdlc.md` |
| `installer` / `install` | 15+ | `lib/installer.js`, `lib/installer.test.js`, `lib/cli.js`, `bin/isdlc.js` |
| `CLAUDE.md` (template) | 6 | `src/claude/CLAUDE.md.template`, `lib/installer.js`, `lib/updater.js` |
| `jira` / `atlassian` / `MCP` | 3 | `src/claude/commands/isdlc.md`, `src/claude/agents/00-sdlc-orchestrator.md`, `src/claude/agents/01-requirements-analyst.md` |
| `providerMode` / `provider select` | 10 | `lib/installer.js` |
| `MCP Prerequisite Check` | 1 | `src/claude/CLAUDE.md.template` (Backlog Management section) |

---

## 3. File Count

| Category | Count | Files |
|----------|-------|-------|
| **New** | 0 | (no new files -- all changes modify existing files) |
| **Modify** | 5 | `lib/installer.js`, `src/claude/CLAUDE.md.template`, `src/claude/commands/isdlc.md`, `src/claude/hooks/lib/three-verb-utils.cjs`, `lib/installer.test.js` |
| **Test** | 1 | `lib/installer.test.js` (new test cases for issue tracker prompt) |
| **Config** | 0 | -- |
| **Docs** | 1 | This requirements folder |
| **Total** | ~7 | |

**Confidence**: High -- the installer already has a nearly identical pattern (providerMode selection at Step 3.5) that can be replicated for issue tracker selection. The CLAUDE.md template already has a "Backlog Management" section with MCP Prerequisite Check instructions.

---

## 4. Final Scope

**Scope**: Medium

**Rationale**: The core implementation is a new `select()` prompt in `lib/installer.js` (mirroring the existing provider selection pattern), a new section in the CLAUDE.md template to persist the preference, and routing logic in `isdlc.md`/`three-verb-utils.cjs` to read and use that preference. Testing requires new test cases in `lib/installer.test.js`. No new dependencies. No new files. The Jira MCP validation sub-flow is the only area of moderate complexity.

**Risk level**: Low-Medium. The installer is well-tested with a clear pattern to follow. The CLAUDE.md template modification is additive. The `detectSource` enhancement is a narrowly scoped change to an existing function.
