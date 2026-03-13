# Roundtable memory layer — user + project memory backed by semantic search

**Source**: GitHub Issue #113
**Labels**: enhancement, hackability
**Depends on**: #100 (Roundtable depth control — shipped 2026-03-07)
**Leverages**: REQ-0045 semantic search backend (all 6 groups shipped)

## Context

Follow-on to #100 (Roundtable depth control). During analysis of #100, we identified that dynamic depth sensing works within a single session but needs persistent memory to be consistent across sessions and learn user preferences.

## Problem

Without memory, the roundtable re-asks questions the user has already answered in prior sessions. It can't learn that a developer consistently skips deep probing on security, prefers brief architecture discussions, or always provides detailed requirements. Each session starts from zero.

## Design

Three memory layers:

### 1. User Memory (`~/.isdlc/user-memory/{user-id}/`)
- **profile.json**: Compacted preferences and patterns (topic depth preferences, domain expertise signals, engagement patterns)
- **sessions/**: Raw session logs (append-only, compacted periodically)
- Cross-project: follows the developer, not the codebase
- Private: local filesystem only

### 2. Project Memory (`.isdlc/roundtable-memory.json`)
- Per-topic records: depth-used, assumptions-count, assumptions-amended
- How topics were handled in this specific codebase
- Shared across team members working on the same project

### 3. Session Memory (existing — current conversation context)
- Real-time conversational cues within the active session
- Already handled by #100's dynamic depth sensing

## Memory Retrieval — Semantic Search

Instead of loading full history, use the shipped semantic search backend (REQ-0045) to embed past roundtable interactions and retrieve the most relevant memories via semantic similarity at session start.

Example: User says "add a config flag for retry behavior" → system retrieves past sessions where similar config-wiring work was analyzed, including depth levels used and which assumptions were accepted.

**Performance constraint**: Subsecond reads at roundtable startup, even after months of usage (~260 sessions/year, ~1,560 topic records).

## Compaction Strategy

- After each roundtable session: append raw records
- Periodically compact into summaries: "user consistently skips deep probing on security, prefers brief on architecture, engages deeply on requirements"
- Roundtable reads compacted summary + top-K semantic matches, not full raw log

## Acceptance Criteria

- [ ] User-level memory persists across projects in `~/.isdlc/`
- [ ] Project-level memory persists in `.isdlc/roundtable-memory.json`
- [ ] Roundtable reads memory at session start in < 1 second
- [ ] Previously answered questions are not re-asked (memory supplies the answer)
- [ ] Memory compaction keeps profile.json under a configurable size threshold
- [ ] Semantic search retrieves relevant past sessions based on current draft content
- [ ] Memory degrades gracefully if files are missing or corrupted (fail-open per Article X)

## Effort

Medium-Large — new storage layer, semantic search integration, compaction logic, roundtable prompt changes to consume memory.
