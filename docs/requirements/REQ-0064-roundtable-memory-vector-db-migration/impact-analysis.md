# Impact Analysis: Roundtable Memory Vector DB Migration

**Status**: Revised (post-REQ-0065 re-analysis)
**Confidence**: High
**Last Updated**: 2026-03-15
**Coverage**: Full
**Codebase Hash**: 9d9636d (post-REQ-0065 merge)

---

## 1. Blast Radius

### Tier 1 — Direct Changes

| File | Change Type | Description | REQ-0065 Impact |
|---|---|---|---|
| `lib/memory.js` | Major modify | Extend `writeSessionRecord()` for `EnrichedSessionRecord` with playbook curator fields (`summary`, `context_notes: ContextNote[]`, `playbook_entry`, `importance`, `container`, `ttl`). Extend `compact()` for vector pruning + temporal decay. Preserve all 6 existing exports as fallback. | Unchanged — `memory.js` was not modified by REQ-0065 |
| `lib/memory-store-adapter.js` | **New** | Unified `MemoryStore` interface abstracting SQLite (user) and `.emb` (project). SQLite schema with self-ranking, curation, tiered dedup columns. `.emb` store with metadata sidecar for pin/archive/tag. | New module — no prior version |
| `lib/memory-embedder.js` | **New** | Async embedding orchestrator. Takes `EnrichedSessionRecord` + both stores via adapter. 4-tier dedup (Reject/Update/Extend/New) using `relationship_hint`. Auto-pruning at capacity limit. | New module — no prior version |
| `lib/memory-search.js` | **New** | Semantic search over dual stores. Self-ranking boost (`hit_rate * importance`). Container filtering. `incrementAccess()` for retrieved results. `formatSemanticMemoryContext()`. | New module — no prior version |
| `src/claude/commands/isdlc.md` | Modify | **Step 3a**: Replace `readUserProfile()`/`readProjectMemory()` with `searchMemory()` call. Results stored as in-memory conversation context (no dispatch prompt). **Step 7.5a**: Construct `EnrichedSessionRecord` from inline conversation state (playbook curator pass). Spawn `embedSession()` async. | **CHANGED by REQ-0065**: Steps 7a-7b rewritten to inline protocol execution. Step 7.5a already constructs record from in-memory state (no SESSION_RECORD parsing). REQ-0064 changes are additive to the REQ-0065 version. |
| `src/claude/agents/roundtable-analyst.md` | Minor modify | No dispatch prompt changes needed (REQ-0065 made it a protocol reference). Add guidance for recognizing conversational memory commands ("remember this", "forget that", "what do you remember?") in the conversation protocol sections. | **CHANGED by REQ-0065**: Now a protocol reference document (added header). REQ-0064 changes are minor additions to protocol guidance. |

### Tier 2 — Transitive Impact

| File | Impact | REQ-0065 Impact |
|---|---|---|
| `lib/cli.js` | Extend `memory` subcommand: `compact --vectors` for vector pruning, potential `status` subcommand | Unchanged by REQ-0065 |
| `lib/memory.test.js` | Major test rewrite: new test cases for enriched record format, extended compact | Unchanged by REQ-0065 |
| `lib/memory-store-adapter.test.js` | **New**: SQLite store tests (CRUD, self-ranking, tiered dedup, curation), `.emb` store tests | New — no prior version |
| `lib/memory-embedder.test.js` | **New**: Async embedding tests, 4-tier dedup, auto-pruning, error handling | New — no prior version |
| `lib/memory-search.test.js` | **New**: Dual-store search tests, model consistency, self-ranking, fallback | New — no prior version |
| `tests/inline-roundtable-execution.test.js` | May need memory-specific test cases for inline playbook curator and conversational memory commands | **NEW in REQ-0065**: 570 lines of inline execution tests. REQ-0064 may extend these. |
| `.gitignore` | Verify `docs/.embeddings/` is NOT in gitignore (must be tracked for team sharing) | Unchanged |
| `docs/.embeddings/` | **New directory**: project vector index location | New — no prior version |

### Tier 3 — Potential Side Effects

| Area | Risk | Mitigation | REQ-0065 Impact |
|---|---|---|---|
| Inline conversation context size | Semantic excerpts (up to 10) may increase the handler's context usage during inline roundtable | Configurable result limit (default: 10); excerpt truncation | **NEW concern**: With inline execution, memory context is in the same context window as the conversation (not isolated in a subagent). Monitor context usage. |
| Embedding backend dependency | New soft dependency on embedding engine at write time | Fail-open: raw text persists; lazy embed on read; flat JSON fallback | Unchanged |
| Git repo size | `.emb` binary files increase repo size | Memory indexes are small (KB, not MB); compaction prunes old vectors | Unchanged |
| Team model divergence | Different team members may use different embedding models | Model consistency check at search time; `rebuildIndex` resolution | Unchanged |
| SQLite in user home directory | New `~/.isdlc/user-memory/memory.db` file | Created lazily on first write; fail-open if creation fails | N/A — new concern specific to hybrid storage |
| Playbook curator latency | LLM synthesis pass at session end adds time before embedding starts | Runs inline using existing conversation context — not a separate LLM call. Estimated <5s for summary generation. | **NEW concern**: With inline execution, the curator pass extends the handler's session-end processing. Must not add perceptible delay. |

## 2. Entry Points

| Entry Point | Description | REQ-0065 Status |
|---|---|---|
| `src/claude/commands/isdlc.md` (analyze handler, step 3a) | Primary read: searches memory at roundtable start | Step 3a unchanged by REQ-0065 — memory read still runs in Group 1 parallel ops |
| `src/claude/commands/isdlc.md` (analyze handler, step 7.5a) | Primary write: constructs enriched record + spawns async embedding | **CHANGED**: Now constructs record from inline conversation state (no output parsing) |
| `lib/cli.js` (memory subcommand) | Secondary: user-triggered compaction and index management | Unchanged |
| `src/claude/agents/roundtable-analyst.md` | Protocol reference: conversation protocol for memory commands | **CHANGED**: Now a protocol reference, not a spawned agent |

## 3. Implementation Order

1. `lib/memory-store-adapter.js` — MemoryStore interface, SQLite user store, `.emb` project store (FR-003)
2. `lib/memory.js` — enriched session record format with playbook curator fields (FR-001, FR-014)
3. `lib/memory-embedder.js` — async embedding with 4-tier dedup + auto-pruning (FR-002, FR-013, FR-016)
4. `lib/memory-search.js` — semantic search with self-ranking + importance boost (FR-004, FR-007, FR-012)
5. `src/claude/commands/isdlc.md` — inline memory search at startup (step 3a) + enriched record construction at session end (step 7.5a) (FR-004, FR-001, FR-005)
6. `src/claude/agents/roundtable-analyst.md` — protocol guidance for conversational memory commands (FR-005, FR-006)
7. Backward compatibility + fail-open testing (FR-010, FR-011)
8. Lazy embed fallback (FR-008)
9. Memory curation: pin, archive, tag (FR-015)
10. Container tags (FR-017)
11. Vector compaction + temporal decay (FR-009, FR-016)
12. CLI extensions: `isdlc memory compact --vectors` (FR-009)

## 4. Risk Zones

| Zone | Risk Level | Description | REQ-0065 Change |
|---|---|---|---|
| `lib/memory.js` rewrite | Medium | Major changes to existing working code. Must preserve all REQ-0063 behavior as fallback. | Unchanged — memory.js not touched by REQ-0065 |
| `isdlc.md` step 3a (memory search) | Low | Replacing `readUserProfile()`/`readProjectMemory()` with `searchMemory()`. Well-isolated change in Group 1 parallel ops. | Step 3a structure unchanged by REQ-0065 |
| `isdlc.md` step 7.5a (record construction) | **Medium → Low** | Previously: parse SESSION_RECORD from agent output (fragile). Now: construct from inline conversation state (direct access). REQ-0065 eliminated the parsing risk. | **Risk reduced** — inline execution means direct access to conversation state |
| `memory-store-adapter.js` dual-backend | Medium | Two storage implementations behind one interface. SQLite is well-understood; `.emb` metadata sidecar for curation is new territory. | N/A — new module |
| 4-tier dedup in `memory-embedder.js` | Medium | Contradiction vs enrichment detection relies on curator's `relationship_hint`. If hint is wrong or missing, defaults to Extend (safe — additive, not destructive). | N/A — new module |
| Async embedding reliability | Low | Background job may fail silently. Lazy embed fallback covers this. | Unchanged |

## 5. File Count Summary

| Category | Count | Change from Pre-REQ-0065 |
|---|---|---|
| New files | 5 (memory-store-adapter.js, memory-embedder.js, memory-search.js, + store-adapter test, embedder test) | +1 (store adapter added for hybrid storage) |
| Modified files | 4 (memory.js, isdlc.md, roundtable-analyst.md, cli.js) | Unchanged count, but isdlc.md and roundtable-analyst.md now at REQ-0065 baseline |
| Test files | 4 (memory.test.js rewrite, 3 new test files) | +1 (store adapter tests) |
| Config/other | 2 (.gitignore check, docs/.embeddings/ directory) | Unchanged |
| **Total** | **~15 files** | **+2 from original ~13 estimate** |

## 6. REQ-0065 Delta Summary

| Aspect | Before REQ-0065 | After REQ-0065 | Impact on REQ-0064 |
|---|---|---|---|
| Memory read delivery | Serialized into `MEMORY_CONTEXT` field in dispatch prompt | Used as in-memory conversation priming context | Simpler — no prompt serialization needed |
| Session record generation | Parse `SESSION_RECORD` JSON from roundtable agent output | Construct from inline conversation state | Simpler + more reliable — direct access, no parsing |
| Roundtable agent role | Spawned subagent consuming MEMORY_CONTEXT, producing SESSION_RECORD | Protocol reference document | roundtable-analyst.md changes are minor (protocol guidance only, not prompt format) |
| Conversational memory commands | Would need agent prompt + relay-and-resume | Handler has direct access to memory functions | Simpler — FR-005/FR-006 easier to implement |
| Overall blast radius | 13 files | 15 files | +2 (store adapter module + tests for hybrid storage, unrelated to REQ-0065) |
| Overall risk | Medium | **Medium → Low** | Record construction risk reduced; prompt serialization eliminated |

## Pending Sections

(none -- all sections complete)
