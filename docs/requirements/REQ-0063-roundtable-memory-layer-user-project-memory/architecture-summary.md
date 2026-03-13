# Architecture Summary: Roundtable Memory Layer

**Accepted**: 2026-03-13

## Architecture Decisions

| ADR | Decision | Rationale |
|---|---|---|
| ADR-001 | Dispatch injection (`MEMORY_CONTEXT`) | Consistent with existing PERSONA/TOPIC/DISCOVERY_CONTEXT pattern; agent stays stateless |
| ADR-002 | User-triggered compaction only | Simplicity; user controls when files change; performance warning provides natural trigger |
| ADR-003 | Flat user memory structure (no user-id) | `~/.isdlc/` is inherently per-user; matches existing `~/.isdlc/profiles/` convention |
| ADR-004 | No automatic semantic search at startup | Compacted summary provides subsecond reads; avoids staleness and performance risk |
| ADR-005 | Fail-open on missing/corrupted memory | Memory is an enhancement, not a dependency |

## Technology

- Zero new dependencies
- Plain JSON on local filesystem
- Leverages existing `os.homedir()`, `fs` module, CLI dispatch patterns

## Blast Radius

- 4 Tier 1 files (direct changes): `lib/memory.js` (new), `isdlc.md`, `roundtable-analyst.md`, `bin/isdlc.js`
- 2 Tier 2 files (transitive): `.isdlc/roundtable-memory.json`, analysis topic files
- Low-medium overall risk due to fail-open design

## Implementation Order

1. `lib/memory.js` (isolated, testable)
2. Analyze handler wiring (read/inject + write-back)
3. Roundtable agent prompt changes
4. CLI subcommand (`isdlc memory compact`)
5. Integration testing

## Assumptions and Inferences

- **Prompt size**: Assumed compacted memory adds ~50 lines to prompt; no measurement
- **Session record handoff**: Assumed structured JSON block output from roundtable; exact mechanism not discussed
