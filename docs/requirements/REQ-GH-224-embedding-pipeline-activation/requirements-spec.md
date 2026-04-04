# Requirements Specification: Embedding Pipeline Activation

**Item**: REQ-GH-224 (bundles GH-224, GH-225, GH-226, GH-228)
**Status**: Accepted
**Confidence**: High (user-confirmed direction)

---

## 1. Business Context

The iSDLC framework has ~46 embedding modules built and tested (`lib/embedding/*`), but the pipeline is not activated. No agent can call `semantic_search`, no MCP server is running, no embeddings are generated. This item activates the full pipeline end-to-end so users can semantically search their codebases.

**Target users**: Developers working on codebases at 3 scales:
- Dogfooding project (this repo): ~100K LOC, single developer
- Vendor dev teams: 500K-2M LOC products (PoS, inventory, etc.), multiple concurrent sessions
- Customer/partner deployments: Load pre-built `.emb` packages shipped by vendors (IP-protected via tiering)

## 2. Stakeholders and Personas

- **Framework user** (primary): Developer running Claude Code / Codex / Antigravity with iSDLC installed. Wants semantic search over their codebase without per-session startup cost.
- **Vendor developer**: Builds packaged products, works with 500K-2M LOC, needs cross-module context, ships `.emb` files to customers.
- **Packaged product customer**: Extends vendor's product, loads vendor `.emb` files locally + generates own extensions.

## 3. User Journeys

**Journey 1: First-time setup**
1. User runs `/discover` on their project
2. Discover scans codebase, chunks, embeds (default CodeBERT), saves `.emb` to `docs/.embeddings/`
3. Framework auto-starts embedding server in background
4. User's Claude session can call `semantic_search` tool

**Journey 2: Concurrent sessions (single user)**
1. Monday morning: `isdlc embedding server start` — loads 1GB .emb into memory
2. 9am: user opens 4 terminals — Claude, Claude, Codex, Antigravity — all connect to `localhost:7777`
3. Each session checks server at startup, connects if running, prompts user if not
4. Each session ends with finalize → delta refresh pushed to server

**Journey 3: Vendor ships product to customer**
1. Vendor runs `isdlc embedding regenerate --tier=interface`
2. Vendor ships product source + `product-v2.emb` (interface-only, IP-safe)
3. Customer loads vendor's `.emb`, generates own extensions `.emb`, runs server
4. Customer's Claude searches vendor API + own extensions via single `semantic_search`

## 4. Technical Context

- All embedding modules built and tested (46 files in `lib/embedding/`)
- 3 embedding provider adapters: CodeBERT (local ONNX), Voyage (API), OpenAI (API)
- `StoreManager` supports loading `.emb` packages, in-memory cosine search
- Redaction pipeline supports 3 tiers (full/guided/interface) for IP protection
- Unified config (`.isdlc/config.json` from REQ-GH-231) extends with `embeddings` section
- Local deployment only (team/shared server is a separate project)

### Constraints

- **Article X (Fail-Safe Defaults)**: Server unreachable → warn, never block session
- **Article XIII (Module System Consistency)**: Server is ESM (`.js`), hooks are CJS (`.cjs`)
- **Article XIV (State Management Integrity)**: `.emb` packages are machine-generated, not user config
- **Provider neutrality**: Hooks + MCP tools work identically for Claude / Codex / Antigravity

## 5. Quality Attributes and Risks

| Attribute | Priority | Threshold |
|-----------|----------|-----------|
| Multi-session | Critical | 10+ concurrent client sessions |
| Memory efficiency | High | 1M LOC fits in ~1GB RAM |
| Startup time | High | 1GB packages load in <30s |
| Delta refresh | Medium | Single file <5s |
| Search latency | Medium | <500ms for 50K chunks |

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| OAuth-bound MCPs can't run in background | High | High | Option β: sessions push content (user already authenticated) |
| Port conflicts on user machine | Medium | Medium | Configurable port; clear error if 7777 taken |
| Stale lock file after crash | Medium | Low | PID check; auto-cleanup if process dead |
| Model version drift across framework upgrades | Medium | High | Version in .emb manifest; updater detects + prompts regenerate |

---

## 6. Functional Requirements

### FR-001: Persistent embedding server
**Confidence**: High
- **AC-001-01**: Server starts on configured port (default 7777)
- **AC-001-02**: Supports 10+ concurrent client sessions
- **AC-001-03**: Vectors load once on startup, shared across all sessions

### FR-002: Server lifecycle CLI
**Confidence**: High
- **AC-002-01**: `isdlc embedding server start` returns after server ready
- **AC-002-02**: `isdlc embedding server stop` cleanly terminates process
- **AC-002-03**: `isdlc embedding server status` reports running/pid/port/packages

### FR-003: Server configuration in .isdlc/config.json
**Confidence**: High
- **AC-003-01**: Defaults to port 7777 if not configured
- **AC-003-02**: User edit + restart takes effect
- **AC-003-03**: Old config fields (search-config.json provider/model) migrate on upgrade

### FR-004: Session-start connection check
**Confidence**: High
- **AC-004-01**: Hook pings server at session start
- **AC-004-02**: Prompts user to start server if unreachable
- **AC-004-03**: Never blocks session (fail-open)

### FR-005: Session-end delta refresh
**Confidence**: High
- **AC-005-01**: Finalize step pushes changed files
- **AC-005-02**: Server re-embeds and updates in-memory store
- **AC-005-03**: Persists to .emb after update

### FR-006: /discover integration with incremental mode
**Confidence**: High
- **AC-006-01**: First /discover creates .emb files
- **AC-006-02**: Auto-starts server on generation success
- **AC-006-03**: Re-run only re-embeds changed files (VCS diff)

### FR-007: Code + docs embeddings at server start
**Confidence**: High
- **AC-007-01**: Loads all .emb packages in docs/.embeddings/
- **AC-007-02**: Startup succeeds without network

### FR-008: External content ingestion API
**Confidence**: High
- **AC-008-01**: /add-content accepts chunks with source + tier
- **AC-008-02**: Chunks searchable immediately after add
- **AC-008-03**: Idempotent on duplicate content

### FR-009: External content via user's MCPs (Option β)
**Confidence**: High
- **AC-009-01**: MCP tool `isdlc_embedding_add_content` registered in all 3 providers
- **AC-009-02**: Users push from their Claude/Codex/Antigravity session
- **AC-009-03**: MCP fetch failures surface in user session (not server)

### FR-010: Source tagging in search results
**Confidence**: High
- **AC-010-01**: Code hits tagged with `code:<path>`
- **AC-010-02**: Docs hits tagged with `docs:<path>`
- **AC-010-03**: External hits tagged with `external:<name>`

### FR-011: Provider selection
**Confidence**: High
- **AC-011-01**: Defaults to codebert
- **AC-011-02**: Startup prints config path + restart hint
- **AC-011-03**: Supports codebert/voyage/openai

### FR-012: 3-tier redaction for shipping
**Confidence**: High
- **AC-012-01**: `--tier=full` keeps full source
- **AC-012-02**: `--tier=guided` adds AI behavioral summaries
- **AC-012-03**: `--tier=interface` keeps signatures only

### FR-013: Manual regenerate command
**Confidence**: High
- **AC-013-01**: Full rebuild from configured sources
- **AC-013-02**: Server reloads after regeneration

### FR-014: Framework-managed version migration
**Confidence**: High
- **AC-014-01**: Detects model version mismatch at startup
- **AC-014-02**: Prompts user to regenerate
- **AC-014-03**: Stores model version in .emb manifest

### FR-015: Fail-open on server unreachable
**Confidence**: High
- **AC-015-01**: Session continues if server down
- **AC-015-02**: Warning includes start command
- **AC-015-03**: semantic_search returns empty on failure

### FR-016: Multi-session coordination
**Confidence**: High
- **AC-016-01**: Only one startup attempt at a time (lock file)
- **AC-016-02**: Concurrent sessions connect to same server
- **AC-016-03**: Stale locks cleaned (PID not alive)

---

## 7. Out of Scope

| Item | Reason |
|------|--------|
| Team/shared server (network-hosted) | Separate project per user's direction |
| HNSW/ANN search optimization | Group B (#227), not needed for MVP |
| Incremental chunking | Group B (#230), brute-force acceptable for MVP |
| Full incremental indexing | Basic VCS-diff sufficient for MVP (#229 defers richer strategies) |
| Bundled adapters for Confluence/Notion/etc. | Option β: users leverage their own MCPs |
| OAuth flows in server | Server is headless; external content via session push |

## 8. MoSCoW Prioritization

All 16 FRs are **Must Have** per user direction.
