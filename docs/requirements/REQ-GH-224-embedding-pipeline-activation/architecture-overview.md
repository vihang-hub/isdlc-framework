# Architecture Overview: Embedding Pipeline Activation

**Item**: REQ-GH-224
**Status**: Accepted

---

## 1. Architecture Options

| Option | Summary | Pros | Cons | Verdict |
|--------|---------|------|------|---------|
| A. Node.js daemon with HTTP | Single Node process, HTTP endpoints, ESM | Matches existing code, no new runtime, cross-platform | Manual PID/lock management | **Selected** |
| B. Docker container | Server runs in Docker, clean isolation | Reproducible, easy distribution | Requires Docker; heavyweight for local dev | Eliminated |
| C. systemd/launchd service | OS-managed lifecycle | Auto-restart, OS integration | Platform-specific; requires admin | Eliminated (can add later) |

## 2. Selected Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  isdlc-embedding-server (Node.js ESM daemon)                 │
│  ───────────────────────────────────────────                 │
│  HTTP server on configured port (default 7777)               │
│  Runtime files in .isdlc/logs/:                              │
│    - embedding-server.pid                                    │
│    - embedding-server.lock (startup only)                    │
│    - embedding-server.log                                    │
│                                                              │
│  HTTP Endpoints:                                             │
│    GET  /health         → status + loaded packages           │
│    POST /search         → semantic_search                    │
│    GET  /modules        → list_modules                       │
│    GET  /modules/:id    → module_info                        │
│    POST /refresh        → re-embed changed files (delta)     │
│    POST /add-content    → push external content chunks       │
│    POST /reload         → reload .emb packages from disk     │
│                                                              │
│  Wraps existing (already built):                             │
│    StoreManager, Orchestrator, Chunker, Embedding adapters   │
└──────────────────────────────────────────────────────────────┘
              ▲                                    ▲
              │                                    │
    ┌─────────┴──────────┐              ┌──────────┴──────────┐
    │ Session clients    │              │ CLI                 │
    │ (Claude/Codex/AG)  │              │ isdlc embedding     │
    │ SessionStart hook  │              │   server {start/    │
    │ Finalize refresh   │              │    stop/status/...} │
    └────────────────────┘              └─────────────────────┘
```

## 3. ADRs

### ADR-001: HTTP transport (not stdio)
- **Status**: Accepted
- **Context**: MCP servers typically use stdio (per-session process)
- **Decision**: Long-running HTTP server for persistent multi-session architecture
- **Rationale**: 1M+ LOC requires load-once + session sharing; stdio's per-session cost is prohibitive (30s+ per session launch); matches designed-in SSE config
- **Consequences**: Must manage daemon lifecycle, port config, health checks, multi-session coordination

### ADR-002: In-memory vector store (bundled, Option A)
- **Status**: Accepted
- **Context**: Need to serve `semantic_search` queries with low latency
- **Decision**: StoreManager loads `.emb` packages into memory, brute-force cosine search
- **Rationale**: Simplest shipping story (one binary + .emb files); works up to ~2M LOC; matches existing built code
- **Consequences**: ~500MB RAM per 1M LOC; HNSW deferred to Group B (#227); suitable for 80% of vendor product sizes

### ADR-003: Session-push for external content (Option β)
- **Status**: Accepted
- **Context**: External sources (Confluence, Notion, etc.) require OAuth auth tied to user browser
- **Decision**: User's LLM sessions push chunks via `POST /add-content` using their configured MCPs
- **Rationale**: Server is headless, can't do OAuth flows; users already have authenticated MCPs in their sessions; no adapter maintenance
- **Consequences**: External refresh is session-triggered, not server-startup; framework doesn't build/maintain source adapters

### ADR-004: Config-driven port + provider
- **Status**: Accepted
- **Context**: Need single source of truth for server configuration
- **Decision**: Port/host/provider/model in `.isdlc/config.json → embeddings` (unified config from REQ-GH-231)
- **Rationale**: Consistent with unified config; no separate port file; user edits + restart
- **Consequences**: Config change requires server restart (acceptable per UX decision)

### ADR-005: Lock file for multi-session coordination
- **Status**: Accepted
- **Context**: Multiple sessions starting concurrently might race to start server
- **Decision**: `.isdlc/logs/embedding-server.lock` acquired during startup, released on ready/fail
- **Rationale**: Simple, cross-platform, no external coordination service
- **Consequences**: Second session briefly waits (10s timeout); stale locks auto-cleaned via PID check

### ADR-006: Daemon lifecycle via Node child_process
- **Status**: Accepted
- **Context**: Need background process, cross-platform
- **Decision**: `child_process.spawn` with `detached: true`, write PID file, SIGTERM for stop
- **Rationale**: Pure Node.js, works on macOS/Linux/Windows, no OS-specific code
- **Consequences**: User manages lifecycle (not OS auto-restart); fine for dev workflow

## 4. Technology Decisions

| Technology | Version | Rationale | Alternatives |
|-----------|---------|-----------|--------------|
| Node.js HTTP module | built-in | Zero new deps | Express, Fastify (rejected: unnecessary dep) |
| child_process.spawn detached | built-in | Cross-platform daemon | pm2 (extra dep), systemd (Linux-only) |
| Port 7777 default | — | Uncommon, memorable | Any available port |

## 5. Integration Architecture

### Integration Points

| ID | Source | Target | Interface | Data |
|----|--------|--------|-----------|------|
| INT-001 | SessionStart hook (all providers) | `/health` | HTTP GET | Connection check |
| INT-002 | Workflow finalize (all providers) | `/refresh` | HTTP POST | `{files: [{path, operation}]}` |
| INT-003 | Agent `semantic_search` MCP call | `/search` | HTTP POST | `{query, modules?, maxResults}` |
| INT-004 | User's LLM session (via MCP tool) | `/add-content` | HTTP POST | `{chunks, source, tier}` |
| INT-005 | `isdlc embedding server *` CLI | Server process | child_process | start/stop/status |
| INT-006 | `/discover` orchestrator | `generateDiscoverEmbeddings()` | function call | Scan + chunk + embed |

### Data Flow

```
Code → chunker → embedding engine → chunks+vectors → .emb package
    → server startup → StoreManager.loadPackage → in-memory

Client query → HTTP → /search → Orchestrator → StoreManager.findNearest
    → ranked hits tagged by source

Session end → finalize → /refresh (delta files)
    → server re-chunks + re-embeds → updates in-memory + persists to .emb

User session (Claude with Atlassian MCP) → fetches Confluence → calls
    isdlc_embedding_add_content MCP tool → HTTP POST /add-content
    → server adds to in-memory store
```

## 6. Summary

| Metric | Value |
|--------|-------|
| New files | ~13 (server, hooks, finalize, CLI commands, config) |
| Modified files | ~8 (common.cjs, installer, updater, settings, discover agents) |
| New CLI commands | 7 (server start/stop/status/restart/reload + regenerate + configure) |
| New MCP tools | 1 (isdlc_embedding_add_content) |
| New HTTP endpoints | 7 (/health, /search, /modules, /modules/:id, /refresh, /add-content, /reload) |
| New config section | `embeddings` in .isdlc/config.json |
| Provider integrations | 3 (Claude, Codex, Antigravity — identical hook + MCP tool) |
