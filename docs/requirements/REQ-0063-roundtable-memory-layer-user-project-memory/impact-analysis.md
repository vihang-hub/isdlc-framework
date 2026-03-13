# Impact Analysis: Roundtable Memory Layer

**Status**: Draft
**Confidence**: High
**Last Updated**: 2026-03-13
**Coverage**: Full

---

## 1. Blast Radius

### Tier 1 — Direct Changes (files we modify or create)

| File | Type | Description |
|---|---|---|
| `lib/memory.js` | New | Core memory module: read, write, compact, validate functions |
| `src/claude/commands/isdlc.md` | Modify | Analyze handler: inject MEMORY_CONTEXT pre-roundtable; write session record post-roundtable |
| `src/claude/agents/roundtable-analyst.md` | Modify | Add MEMORY_CONTEXT parsing (Section 2.1); add acknowledgment pattern (Section 3.5); add session record output format |
| `bin/isdlc.js` | Modify | Register `memory` subcommand with `compact` action |
| `lib/memory.test.js` | New | Unit tests for memory read/write/compact |

### Tier 2 — Transitive Impact (files that depend on changed files)

| File | Impact |
|---|---|
| `.isdlc/roundtable-memory.json` | New file created on first session write-back |
| `~/.isdlc/user-memory/profile.json` | New file created on first compaction |
| `~/.isdlc/user-memory/sessions/*.json` | New files created after each roundtable session |
| `src/claude/skills/analysis-topics/*.md` | May add optional `memory_key` to frontmatter for topic-to-memory matching |

### Tier 3 — Potential Side Effects

| Area | Risk | Mitigation |
|---|---|---|
| Roundtable prompt size | MEMORY_CONTEXT adds tokens to dispatch prompt | Compacted summaries are small (~50 lines); monitor token count |
| Existing roundtable behavior | Any bug in memory injection could alter conversation flow | Fail-open: absent MEMORY_CONTEXT = current behavior; comprehensive tests |
| Analyze handler timing | Pre-read adds latency before roundtable starts | Local file reads only; <10ms expected |
| `.isdlc/` directory | New file in version-controlled directory | Consider .gitignore for sessions data; summary is safe to commit |

## 2. File Count Breakdown

| Category | Count | Files |
|---|---|---|
| New source | 1 | `lib/memory.js` |
| New test | 1 | `lib/memory.test.js` |
| Modify source | 2 | `bin/isdlc.js`, `src/claude/commands/isdlc.md` |
| Modify agent | 1 | `src/claude/agents/roundtable-analyst.md` |
| New config/data | 2 | `.isdlc/roundtable-memory.json`, `~/.isdlc/user-memory/` |
| **Total** | **7** | |

## 3. Entry Points

| Entry Point | Rationale |
|---|---|
| `lib/memory.js` | Start here: core functions with no dependencies on other changes. Test in isolation. |
| Analyze handler in `isdlc.md` | Second: wire up read/inject and write-back using memory.js functions |
| `roundtable-analyst.md` | Third: add MEMORY_CONTEXT handling to the agent prompt |
| `bin/isdlc.js` | Last: register CLI subcommand |

## 4. Risk Zones

| Risk ID | Description | Area | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| RISK-001 | Memory injection alters roundtable behavior unexpectedly | roundtable-analyst.md | Low | High | Fail-open; absent memory = identical behavior; integration tests |
| RISK-002 | Session write-back fails and blocks ROUNDTABLE_COMPLETE | isdlc.md analyze handler | Low | High | try/catch; write failure logged but non-blocking |
| RISK-003 | Compaction produces incorrect aggregates | lib/memory.js | Medium | Medium | Unit tests for compaction with edge cases (empty, single, many sessions) |
| RISK-004 | Project memory file conflicts in version control | .isdlc/roundtable-memory.json | Medium | Low | Deterministic JSON output; document merge strategy |
| RISK-005 | Raw session logs grow unbounded | ~/.isdlc/user-memory/sessions/ | Medium | Low | Performance warning (FR-009); user-triggered compaction |

## Pending Sections

(none -- all sections complete)
