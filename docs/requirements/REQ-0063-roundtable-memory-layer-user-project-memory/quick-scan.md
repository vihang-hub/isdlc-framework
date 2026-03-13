# Quick Scan: Roundtable Memory Layer

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-03-13
**Coverage**: Full

---

## 1. Codebase Scan Summary

### Keywords Searched
roundtable, memory, depth sensing, user preference, session, profile, semantic search, compact, homedir, ~/.isdlc, roundtable-memory, MEMORY_CONTEXT

### Key Findings

| Area | Files Found | Relevance |
|---|---|---|
| Roundtable analyst agent | 1 (`src/claude/agents/roundtable-analyst.md`) | Direct — memory integration point |
| Analyze handler | 1 (`src/claude/commands/isdlc.md`) | Direct — dispatch injection and write-back |
| CLI entry point | 1 (`bin/isdlc.js`) | Direct — new subcommand registration |
| Profile loader | 1 (`src/claude/hooks/lib/profile-loader.cjs`) | Pattern reference — `~/.isdlc/` directory usage |
| Updater | 1 (`lib/updater.js`) | Pattern reference — `~/.isdlc-update-check.json` |
| Analysis topics | 6 (`src/claude/skills/analysis-topics/**/*.md`) | Reference — topic_ids for memory matching |
| Depth control tests | 1 (`tests/prompt-verification/depth-control.test.js`) | Reference — existing depth sensing tests |

### Existing Patterns Identified

- **`~/.isdlc/` directory**: Already used for gate profiles and update checks. User memory fits naturally here.
- **Dispatch prompt injection**: `PERSONA_CONTEXT`, `TOPIC_CONTEXT`, `DISCOVERY_CONTEXT` already inlined into roundtable dispatch. `MEMORY_CONTEXT` follows the same pattern.
- **Dynamic depth sensing**: Section 3.5 of `roundtable-analyst.md` already reads per-topic signals. Memory becomes an additional input.
- **Fail-open pattern**: The roundtable already handles absent optional context fields with "if present" checks.

## 2. Module Distribution

| Module | Impact Level |
|---|---|
| `lib/` | New module (`memory.js`) + test |
| `src/claude/commands/` | Modify analyze handler |
| `src/claude/agents/` | Modify roundtable analyst prompt |
| `bin/` | Modify CLI entry point |
| `.isdlc/` | New project-level file |
| `~/.isdlc/` | New user-level directory |

## 3. Scope Assessment

- **Change type**: Additive (new storage layer) + Modifying (integrate into existing roundtable flow)
- **Estimated file count**: 7 files (1 new source, 1 new test, 3 modify, 2 new data/config)
- **Risk level**: Low-Medium — fail-open design limits blast radius
- **Complexity**: Medium — new storage + prompt changes + CLI command + compaction logic
