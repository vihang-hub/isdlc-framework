# Architecture Overview: Roundtable Memory Layer

**Status**: Draft
**Confidence**: High
**Last Updated**: 2026-03-13
**Coverage**: Full

---

## 1. Architecture Decisions

### ADR-001: Dispatch Injection Pattern for Memory Delivery

**Context**: The roundtable agent needs access to memory at session start and during topic transitions.

**Options Considered**:

| Option | Summary | Pros | Cons | Verdict |
|---|---|---|---|---|
| A. Dispatch injection (`MEMORY_CONTEXT`) | Analyze handler reads memory files and inlines into prompt | Consistent with existing patterns (PERSONA/TOPIC/DISCOVERY_CONTEXT); agent stays stateless; no file I/O from agent | Increases prompt size; handler must do pre-read | **Selected** |
| B. Agent reads files directly | Roundtable agent reads memory files itself during opening turn | Agent has full control over read timing; no handler changes needed | Breaks existing pattern; agent becomes stateful; adds latency to opening turn | Eliminated |

**Decision**: Option A. The dispatch injection pattern is established for all optional context fields. Memory follows the same pattern for consistency. The roundtable agent remains stateless with respect to memory -- it consumes `MEMORY_CONTEXT` as input and produces a session record as output.

### ADR-002: User-Triggered Compaction Only

**Context**: Raw session logs accumulate over time. A compaction strategy is needed to keep reads fast.

**Options Considered**:

| Option | Summary | Pros | Cons | Verdict |
|---|---|---|---|---|
| A. Automatic compaction (every N sessions) | Compact automatically after a configurable number of sessions | Zero user effort; always optimized | Background processing adds complexity; user may not expect file changes; harder to debug | Eliminated |
| B. User-triggered (`isdlc memory compact`) | User runs compaction when they choose | Simple; predictable; user controls when files change; no background processing | May be forgotten; raw logs can grow | **Selected** |

**Decision**: Option B. Simplicity wins. The roundtable warns the user when reads slow down (FR-009), providing a natural trigger for the user to run compaction.

### ADR-003: Flat User Memory Structure (No User-ID)

**Context**: The draft proposed `~/.isdlc/user-memory/{user-id}/` but `~/.isdlc/` is inherently per-user.

**Options Considered**:

| Option | Summary | Pros | Cons | Verdict |
|---|---|---|---|---|
| A. User-ID segmented | Subdirectories per user identity | Supports shared machines | No real use case; adds complexity; no precedent in codebase | Eliminated |
| B. Flat structure | Single `~/.isdlc/user-memory/` directory | Simple; matches existing `~/.isdlc/profiles/` pattern; no identity resolution needed | Cannot support shared home directories | **Selected** |

**Decision**: Option B. No existing convention for user-id scoping. The home directory is already per-user.

### ADR-004: No Automatic Semantic Search at Startup

**Context**: The draft proposed using REQ-0045's semantic search to retrieve relevant past sessions at roundtable startup.

**Options Considered**:

| Option | Summary | Pros | Cons | Verdict |
|---|---|---|---|---|
| A. Automatic semantic search at startup | Embed past sessions, query by current draft content | Contextually relevant memories; could surface specific past analyses | Adds latency at startup; past analyses may be stale (codebase changed); performance risk | Eliminated |
| B. Compacted summary only | Read pre-aggregated preferences from profile.json and roundtable-memory.json | Subsecond reads; no staleness risk; simple | Loses specific session context | **Selected** |

**Decision**: Option B. The compacted summary covers the primary use case (depth preferences, topic patterns). Semantic search over past sessions is deferred as a future extension (`isdlc memory search`).

### ADR-005: Fail-Open on Missing/Corrupted Memory

**Context**: Memory files may not exist (first run), may be corrupted, or may use an older schema.

**Decision**: Fail-open. The dispatch layer wraps memory reads in try/catch. Any failure results in `MEMORY_CONTEXT` being omitted, and the roundtable behaves exactly as today. Lenient schema validation accepts partial data. No error messages or warnings shown to the user.

**Rationale**: Memory is an enhancement, not a dependency. The roundtable must always function without it.

## 2. Technology Decisions

- **No new dependencies**: All storage is plain JSON on the local filesystem. No databases, no embedding services, no new npm packages.
- **Existing infrastructure**: Leverages `os.homedir()` (already used by `profile-loader.cjs` and `updater.js`), `fs` module for reads/writes, existing CLI dispatch pattern in `bin/isdlc.js`.
- **JSON format**: Human-readable, manually editable, diffable in version control (for project memory).

## 3. Integration Points

| Source | Target | Interface | Data Format | Error Handling |
|---|---|---|---|---|
| Analyze handler | `~/.isdlc/user-memory/profile.json` | File read | JSON | Fail-open: omit MEMORY_CONTEXT |
| Analyze handler | `.isdlc/roundtable-memory.json` | File read | JSON | Fail-open: omit MEMORY_CONTEXT |
| Analyze handler | Roundtable agent prompt | Prompt injection | `MEMORY_CONTEXT` inline block | Omit block if empty |
| Roundtable agent | Analyze handler | Session record output | JSON in final output | Handler parses; write failure non-blocking |
| Analyze handler | `~/.isdlc/user-memory/sessions/` | File write (append) | JSON | Log failure; don't block ROUNDTABLE_COMPLETE |
| Analyze handler | `.isdlc/roundtable-memory.json` | File write (update) | JSON | Log failure; don't block ROUNDTABLE_COMPLETE |
| `isdlc memory compact` | `~/.isdlc/user-memory/` | Read sessions, write profile.json | JSON | Report errors to CLI user |
| `isdlc memory compact` | `.isdlc/roundtable-memory.json` | Read sessions, write summary | JSON | Report errors to CLI user |

## 4. Data Flow

```
[Session Start]
  Analyze Handler
    ├── Read ~/.isdlc/user-memory/profile.json (try/catch → skip on fail)
    ├── Read .isdlc/roundtable-memory.json (try/catch → skip on fail)
    ├── Merge into MEMORY_CONTEXT block
    └── Inject into roundtable dispatch prompt

[During Conversation]
  Roundtable Agent
    ├── Parse MEMORY_CONTEXT (if present)
    ├── At topic transitions: check memory for topic preference
    ├── If preference exists: acknowledge and ask user to confirm/override
    ├── If conflict (user vs project): surface both, let user choose
    └── Record topic outcomes in internal session log

[Session End]
  Analyze Handler (post-ROUNDTABLE_COMPLETE)
    ├── Parse session record from roundtable output
    ├── Write ~/.isdlc/user-memory/sessions/{timestamp}.json (try/catch → log on fail)
    └── Append to .isdlc/roundtable-memory.json sessions array (try/catch → log on fail)

[User-Triggered]
  isdlc memory compact
    ├── Read all session files from ~/.isdlc/user-memory/sessions/
    ├── Aggregate per-topic: weighted average depth, override counts, confidence
    ├── Write ~/.isdlc/user-memory/profile.json (replace)
    ├── Read .isdlc/roundtable-memory.json sessions array
    ├── Aggregate per-topic for project
    └── Write .isdlc/roundtable-memory.json summary section (replace)
```

## 5. Blast Radius

### Tier 1 — Direct Changes

| File | Change Type | Description |
|---|---|---|
| `src/claude/commands/isdlc.md` | Modify | Add memory read/inject in analyze handler; add session write-back post-roundtable |
| `src/claude/agents/roundtable-analyst.md` | Modify | Add MEMORY_CONTEXT parsing; add acknowledgment pattern at topic transitions; add session record output |
| `bin/isdlc.js` | Modify | Register `memory` subcommand |
| `lib/memory.js` (new) | New | Memory read, write, compact logic |

### Tier 2 — Transitive Impact

| File | Impact |
|---|---|
| `src/claude/skills/analysis-topics/*.md` | May add `memory_key` field to topic frontmatter for memory matching |
| `.isdlc/roundtable-memory.json` (new) | New project-level file; needs `.gitignore` consideration |

### Tier 3 — Potential Side Effects

| Area | Risk |
|---|---|
| Roundtable prompt size | `MEMORY_CONTEXT` increases prompt token count; minimal for compacted summaries |
| Existing roundtable behavior | Must remain identical when memory is absent |

## 6. Implementation Order

1. `lib/memory.js` — core read/write/compact functions
2. Analyze handler changes — pre-read injection and post-write
3. Roundtable agent prompt changes — MEMORY_CONTEXT parsing and acknowledgment
4. `isdlc memory compact` CLI subcommand
5. Integration testing — fail-open, conflict resolution, write-back

## Pending Sections

(none -- all sections complete)
