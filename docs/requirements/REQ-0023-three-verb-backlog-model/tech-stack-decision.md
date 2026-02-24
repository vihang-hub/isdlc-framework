# Technology Stack Decision: REQ-0023 Three-Verb Backlog Model

**Phase**: 03-architecture
**Created**: 2026-02-18
**Author**: Solution Architect (Agent 03)
**Traces**: FR-001 through FR-009, NFR-005

---

## 1. Context

This feature is a command surface redesign within the existing iSDLC framework. The technology stack is fully constrained by the existing project. No new technologies, dependencies, or frameworks are introduced.

**Discovery Context**: Project discovery confirms:
- Language: JavaScript (Node.js 20+ LTS)
- Module system: ESM for CLI/lib, CommonJS for hooks
- Database: None (JSON files on filesystem)
- Runtime: Claude Code extension (markdown agents + Node.js hooks)

---

## 2. Technology Decisions

### 2.1 Command Definitions (Markdown Agent Prompts)

**Choice**: Markdown files in `src/claude/commands/` and `src/claude/agents/`
**Rationale**: This is the existing pattern. Commands are defined as markdown files that Claude Code loads as prompts. The add/analyze/build handlers will be defined as new sections within `isdlc.md`.
**Alternatives Considered**: None -- this is the only format Claude Code supports for command definitions.

### 2.2 Hook Runtime (CommonJS)

**Choice**: Node.js CommonJS (`.cjs` files)
**Rationale**: Hooks are spawned as standalone Node processes by Claude Code outside the package scope. CommonJS is required per Article XIII.
**Changes**: Two existing `.cjs` files updated (EXEMPT_ACTIONS constant). No new hook files created.
**Alternatives Considered**: None -- Article XIII mandates CommonJS for hooks.

### 2.3 State Persistence (JSON Files)

**Choice**: JSON files on the local filesystem
**Rationale**: The existing state management pattern. `meta.json` per backlog item, `state.json` for workflow state, `BACKLOG.md` for human-readable tracking.
**Changes**: `meta.json` schema v2 (new fields `analysis_status`, `phases_completed`). No schema changes to `state.json`.
**Alternatives Considered**: SQLite for structured queries -- rejected. Over-engineering for a file that contains 7 fields (Article V).

### 2.4 BACKLOG.md Format (Markdown with Structured Markers)

**Choice**: Markdown with line-level regex parsing
**Rationale**: BACKLOG.md is a human-readable, human-editable file. Regex parsing preserves this property while enabling programmatic marker updates.
**Marker Regex**: `/^(\s*-\s+)(\d+\.\d+\s+)\[([ ~Ax])\](\s+.+)$/`
**Alternatives Considered**:
- YAML-based backlog: Would break human readability and existing workflow
- JSON backlog: Would lose human editability
- Separate tracking file: Would create dual-state inconsistency

### 2.5 Intent Detection (CLAUDE.md Configuration)

**Choice**: Static table in CLAUDE.md, parsed by Claude Code at conversation start
**Rationale**: This is the existing pattern. Intent detection is performed by the LLM reading the CLAUDE.md table, not by code.
**Changes**: New rows for Add, Analyze, Build intents. Existing Fix, Upgrade, Test intents unchanged.
**Alternatives Considered**: None -- intent detection is an LLM-native capability configured via prompt.

### 2.6 Phase Agent Delegation (Task Tool)

**Choice**: Claude Code Task tool for delegating to phase agents
**Rationale**: Existing pattern for both workflow phases and inline analysis. The `analyze` verb delegates to the same agents (00-04) using the same Task tool.
**Key Distinction**: `analyze` delegates to agents directly (inline, no orchestrator). `build` delegates to the orchestrator, which then manages the Phase-Loop Controller.
**Alternatives Considered**: None -- Task tool is the only agent delegation mechanism in Claude Code.

---

## 3. Evaluation Matrix

| Criterion | Score | Notes |
|-----------|-------|-------|
| Team familiarity | 10/10 | All technologies are existing in-project |
| Maturity | 10/10 | Node.js 20 LTS, well-established patterns |
| Performance | 10/10 | File system operations only; no network calls |
| Security track record | 10/10 | No new attack surface; input validation via hooks |
| Total cost of ownership | 10/10 | Zero new dependencies; zero licensing changes |
| Integration ecosystem | 10/10 | Full integration with existing hook/agent system |
| Community support | N/A | Internal framework; no external community needed |

**Overall**: Perfect fit. This feature requires zero technology changes -- it is purely a logical restructuring of existing command routing, state schema, and prompt configuration.

---

## 4. Dependencies

### 4.1 No New Dependencies

No new npm packages, no new external services, no new file formats.

### 4.2 Existing Dependencies (Unchanged)

| Dependency | Version | Used By | Change |
|------------|---------|---------|--------|
| Node.js | 20+ LTS | Hook runtime | None |
| `node:fs` | Built-in | meta.json, BACKLOG.md operations | None |
| `node:path` | Built-in | Cross-platform path operations | None |
| Claude Code Task tool | Runtime | Agent delegation | None |
| Git CLI | System | Branch creation (build only) | None |

---

## 5. Compatibility Notes

### 5.1 Cross-Platform (NFR-005)

- All file operations in hooks use `path.join()` / `path.resolve()` (Article XII)
- BACKLOG.md parsing regex handles LF and CRLF via standard `String.split('\n')` after `content.replace(/\r\n/g, '\n')`
- No shell-specific commands in the three-verb handlers (all markdown-defined logic)

### 5.2 Monorepo (NFR-006)

- In monorepo mode, `docs/requirements/{slug}/` resolves to `docs/{project-id}/requirements/{slug}/`
- BACKLOG.md path resolves per monorepo path routing table
- state.json resolves to `.isdlc/projects/{project-id}/state.json`
- No monorepo-specific code changes needed -- existing path resolution handles it

### 5.3 Backward Compatibility (NFR-001)

- `/isdlc feature` kept as hidden alias for `build`
- Legacy `meta.json` with `phase_a_completed` handled via read-time migration
- Existing `[ ]` and `[x]` BACKLOG markers parse unchanged
- All existing tests pass without assertion modifications
