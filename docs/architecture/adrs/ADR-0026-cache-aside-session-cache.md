# ADR-0026: Cache-Aside Pattern for SessionStart Cache

## Status

Accepted

## Context

A 9-phase feature workflow triggers 200-340 reads of static files (constitution, workflow config, iteration requirements, skills manifest, SKILL.md files, persona files, topic files) that never change during execution. Each phase delegation re-reads these files from disk, adding cumulative latency. The roundtable analysis cold-start takes approximately 5 minutes because it pre-reads all persona and topic files from disk.

We need a caching strategy that:
- Eliminates redundant disk reads during workflows
- Stays within the ~128K character context window budget
- Fails open to disk reads when the cache is unavailable
- Is simple to implement and maintain (Article V -- Simplicity First)

## Decision

Use a **cache-aside pattern with explicit invalidation** at known mutation points.

- **Build**: `rebuildSessionCache()` in common.cjs assembles all static content into a single `.isdlc/session-cache.md` file with section delimiters
- **Read**: A self-contained `inject-session-cache.cjs` SessionStart hook reads the cache file and outputs it to stdout, where Claude Code injects it into the LLM context window
- **Consume**: Phase-loop controller and roundtable dispatch check session context first, then fall back to disk reads
- **Invalidate**: Cache is explicitly rebuilt at finite mutation points (init, update, discover, skill add/remove/wire)

No TTL. No file watcher. No background refresh.

## Consequences

**Positive:**
- Reduces static file reads from 200-340 to 1 per session (plus <10 fallback reads)
- Single-file design means a single `readFileSync` at session start -- fast and simple
- Fail-open design means zero risk of breaking existing workflows
- Mutation points are finite and enumerable -- no implicit invalidation logic needed
- No background processes, no daemons, no distributed state

**Negative:**
- Cache can become stale if a mutation path misses the rebuild call (mitigated by fail-open and source hash detection)
- Cache file (~128K) consumes context window budget at session start (always loaded, even if not all sections are needed)
- Manual rebuild (`bin/rebuild-cache.js`) needed if source files are edited outside mutation points (rare in practice)

## Alternatives Considered

- **Write-through cache**: Cache rebuilt on every read if stale. Rejected because it adds latency to every phase delegation instead of concentrating it at mutation points.
- **File watcher (inotify/fsevents)**: Daemon watches source files and rebuilds on change. Rejected as over-engineering (Article V) -- the mutation points are known and finite.
- **In-memory LRU cache in common.cjs**: Already exists (`_configCache`) but only helps within a single process. Hook processes are short-lived -- each phase delegation is a new process. Does not help across process boundaries.
- **Selective per-section loading**: Load only the sections needed for the current phase. Rejected because the SessionStart hook runs once and has no knowledge of which phase will execute. Full-file loading is simpler and the budget allows it.

## Traces

- **Requirements**: FR-001, FR-002, NFR-001, NFR-005, NFR-009
- **Constitutional Articles**: Article V (Simplicity First), Article X (Fail-Safe Defaults)
