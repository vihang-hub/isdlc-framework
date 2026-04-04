# Activate Embedding Pipeline (Group A)

**Primary issue**: GH-224
**Bundles**: GH-224, GH-225, GH-226, GH-228

## Summary

Connect the embedding pipeline end-to-end so embeddings are generated during `/discover`, stored as `.emb` packages, served via an MCP server, and queryable by agents through `semantic_search`.

All the components are already built and tested — this is pure wiring.

## Scope (4 issues combined)

**#224 — MCP server runner + settings registration**
- Create stdio runner script for `lib/embedding/mcp-server/server.js`
- Register in `src/claude/settings.json` under `mcpServers`
- Without this, no agent can call `semantic_search`

**#225 — CLI .emb package generation**
- `bin/isdlc-embedding.js` currently generates vectors but doesn't persist them
- Wire in `lib/embedding/package/builder.js` to produce `.emb` files
- CLI should respect user-selected provider (not hardcode CodeBERT)
- `status` command needs implementation

**#226 — Wire discover integration**
- `lib/embedding/discover-integration.js` exports `generateDiscoverEmbeddings()` with before/during/after modes
- Discover orchestrator agent has zero references to it
- Hook it into the `/discover` flow

**#228 — Provider selection + API keys**
- Users should choose CodeBERT (local, free), Voyage (API, quality), or OpenAI (API, common)
- Currently CLI hardcodes CodeBERT, setup wizard doesn't ask
- Capture API keys for cloud providers (never in code — env var or settings.local.json)
- Persist config in `.isdlc/config.json` under the new `search` or new `embeddings` section

## Success Criteria

After completion:
1. User runs `/discover` on a project
2. Discover asks: "Which embedding provider? (CodeBERT local / Voyage API / OpenAI API / Skip)"
3. If API provider selected, prompts for API key
4. Embeddings are generated during discover and saved as `.emb` packages in `docs/.embeddings/`
5. MCP embedding server auto-starts and loads the packages
6. From that session forward, agents can call `mcp__isdlc-embedding__semantic_search` to query the codebase
7. `isdlc embedding generate` and `isdlc embedding status` CLI commands work

## Why This Bundle

None of these 4 can ship alone and deliver value:
- MCP server with no packages to load = useless
- CLI that generates but doesn't persist = useless
- Discover integration with no generation mechanism = useless
- Provider selection with no pipeline to configure = useless

This is one coherent unit.

## Out of Scope (Group B — deferred)

- **#229 Incremental indexing** — full re-embed on every `/discover` is acceptable for MVP
- **#227 HNSW/ANN search** — brute-force cosine works up to ~20K chunks
- **#230 Chunking parallelization** — sequential chunking is acceptable for repos up to ~10K files

## Context

All 46 embedding modules are built and tested. The gap is activation wiring, not engineering. This is why bundling is safe — we're not designing new systems, we're connecting existing ones.
