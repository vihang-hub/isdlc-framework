# Requirements Specification: REQ-GH-244

## 1. Business Context

### Problem Statement
The embedding server runs in the background with no constant visibility. Users discover its state only by running curl commands or reading log files. Teams working on the same codebase have no awareness of embedding staleness — local changes and remote commits drift silently.

### Stakeholders
- **Primary**: iSDLC framework users who use the embedding pipeline for semantic search
- **Secondary**: Teams sharing codebases via Git or SVN where embedding freshness matters

### Success Metrics
- Users see embedding status at a glance without running manual commands
- Staleness is detected against both remote (team commits) and local (uncommitted files)
- Status line refreshes without noticeable overhead

### Driving Factors
- No visibility into embedding server state mid-session
- SVN workflows have infrequent commits but high local file churn — commits-only staleness misses local drift
- #252 tool-router needs health data for semantic routing decisions

## 2. Stakeholders and Personas

### Framework User (Individual)
- **Role**: Solo developer using iSDLC
- **Goals**: Know at a glance if semantic search is active and embeddings are fresh
- **Pain Points**: Has to manually check server status; doesn't know embeddings are stale until search quality degrades

### Framework User (Team)
- **Role**: Developer in a team sharing a codebase via Git or SVN
- **Goals**: Know when teammates' commits have made embeddings stale
- **Pain Points**: SVN commits are batched — staleness check must also count local file changes

## 3. User Journeys

### Happy Path
1. User starts Claude Code session on a project with embeddings configured
2. Status line shows `emb: 19811 chunks ✓` — everything working
3. Teammate pushes 5 commits; next health check detects remote drift
4. Status line updates to `emb: stale (5 commits behind)` — user knows to refresh
5. User modifies 3 files locally; status updates to `emb: stale (5 commits behind, 3 files modified)`

### Server Offline Path
1. User starts session, embedding server is not running
2. Status line shows `emb: offline`
3. User starts server manually
4. Next health check detects server; status updates to `emb: 19811 chunks ✓`

### No Embeddings Path
1. User starts session on project without embeddings configured
2. Status line shows `emb: not configured`

## 4. Technical Context

### Existing Infrastructure
- Embedding server: `lib/embedding/server/lifecycle.js` (start, stop, status), `port-discovery.js` (config, health check)
- `.emb` package: `lib/embedding/package/manifest.js` (manifest schema), `builder.js` (package creation)
- Tool-router (#252): reads `.isdlc/embedding-health.json` for semantic routing decisions
- Health probe (#252): `lib/embedding/server/health-probe.cjs` (PID-based, for tool-router)
- Claude Code status line: configurable via `settings.json`, periodic script execution

### Constraints
- Status line script must be CJS (Claude Code hook/script convention)
- Must exit 0 in all cases — never crash Claude Code's status line
- Must support both Git and SVN for staleness detection
- Must work for both Claude Code and Codex providers
- Health file is a shared contract — tool-router (#252) and Codex projection also read it

## 5. Quality Attributes and Risks

| Attribute | Priority | Threshold |
|-----------|----------|-----------|
| Reliability | Critical | Exit 0 always, fail-open per Article X |
| Performance | High | Display-refresh < 5ms, data-refresh < 5s |
| Accuracy | High | Dual-metric staleness (commits + files) |
| Portability | High | Git + SVN, Claude + Codex |

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `git fetch` latency on slow networks | Medium | Low | Timeout 5s, gated by configurable interval |
| SVN `svn info` latency on slow server | Medium | Low | Timeout 3s, fail-open |
| Claude Code status line API changes | Low | Medium | Fail-silent, verify API at startup |
| Health file read race with tool-router | Low | Low | Atomic writes (tmp + rename) |

## 6. Functional Requirements

### FR-001: Status Line / Status Rendering
**Confidence**: High

Single CJS script registered in Claude Code's `settings.json` under `statusLine`. Two-tier refresh: display-refresh reads cached health file (<5ms), data-refresh does full probe + VCS check (on configurable interval). Codex adapter reads health file and injects `EMBEDDING_STATUS` into agent projection.

**AC-001-01**: Given server running and embeddings fresh, When status line renders, Then shows `emb: {N} chunks ✓`
**AC-001-02**: Given server running but remote commits behind, When status line renders, Then shows `emb: stale ({N} commits behind)`
**AC-001-03**: Given server running but local files modified, When status line renders, Then shows `emb: stale ({N} files modified)`
**AC-001-04**: Given both remote commits and local changes, When status line renders, Then shows `emb: stale ({N} commits behind, {M} files modified)`
**AC-001-05**: Given server not running, When status line renders, Then shows `emb: offline`
**AC-001-06**: Given embedding generation in progress, When status line renders, Then shows `emb: loading...`
**AC-001-07**: Given no `.emb` files exist, When status line renders, Then shows `emb: not configured`
**AC-001-08**: Given status line disabled via config, When Claude Code starts, Then no status line output
**AC-001-09**: Given health file is fresh (within interval), When status line script runs, Then reads from file without probing — display-refresh cost < 5ms
**AC-001-10**: Given Codex provider, When agent projection is built, Then `EMBEDDING_STATUS` line reflects current health file data

### FR-002: Periodic Health Monitor (from #252)
**Confidence**: High

Full HTTP health check to `localhost:{port}/health` on data-refresh cycle. Combines server health with VCS staleness into unified health file. Configurable interval. Transition detection.

Health file schema: `{ "status": "healthy"|"stale"|"offline"|"loading"|"missing", "checked_at": "<ISO>", "port": N, "chunks": N, "commits_behind": N|null, "files_changed": N|null, "vcs": "git"|"svn"|"unknown", "generated_at_commit": "<ref>", "error": null|"string" }`

Stale threshold: `commits_behind > 0 OR files_changed > 0`

**AC-002-01**: Given server healthy and embeddings fresh, When data-refresh fires, Then health file shows `status: "healthy"` with chunk count and port
**AC-002-02**: Given server goes down between checks, When next data-refresh fires, Then health file updates to `"offline"` and transition is logged
**AC-002-03**: Given `health_check_interval_minutes` set to 2, When status line script runs, Then data-refresh uses 2-minute threshold
**AC-002-04**: Given health probe fails (timeout, network error), When data-refresh fires, Then health file shows `"offline"` with error — never crashes
**AC-002-05**: Given health file exists, When tool-router (from #252) reads it, Then it gets the same structured data for routing decisions

### FR-003: VCS Staleness Detection (dual-metric)
**Confidence**: High

VCS abstraction supporting Git and SVN. Returns both commits behind remote and files changed locally. Manifest stores `generatedAtCommit`.

**AC-003-01**: Given Git repo with remote, When staleness runs, Then returns both `commits_behind` (remote delta) and `files_changed` (local diff since generation)
**AC-003-02**: Given SVN repo with local modifications but no new revisions, When staleness runs, Then `files_changed` reflects `svn status` count, `commits_behind` is 0
**AC-003-03**: Given no VCS detected, When staleness runs, Then returns `{ commits_behind: null, files_changed: null, vcs: "unknown" }`
**AC-003-04**: Given Git repo with no upstream configured, When staleness runs, Then falls back to local HEAD for commits, still reports local file changes
**AC-003-05**: Given `git fetch` fails (no network), When staleness runs, Then falls back to local HEAD — fail-open, still reports local file changes
**AC-003-06**: Given embeddings generated, When `.emb` manifest is written, Then `generatedAtCommit` field contains current VCS ref
**AC-003-07**: Given files modified locally but not committed, When staleness runs, Then status shows stale with file count — doesn't wait for a commit

### FR-004: Fail-Open Behavior (Cross-cutting)
**Confidence**: High (Article X constitutional)

**AC-004-01**: Given any error in status line script, When Claude Code calls it, Then exit 0 with no output — never crash
**AC-004-02**: Given health probe times out, When data-refresh runs, Then status = "offline", script continues
**AC-004-03**: Given VCS commands fail, When staleness runs, Then commits_behind = null, files_changed = null, script continues

## 7. Out of Scope

| Item | Reason | Tracked |
|------|--------|---------|
| Server auto-start | User decision: manual lifecycle | — |
| SVN support for chunking/indexing | Broader VCS abstraction | Future |
| OS-level daemon (launchd/systemd) | Separate feature | #246 |
| Tool-router semantic routing | Completed | #252 |
| ANSI color coding | Nice-to-have, add later | — |

## 8. MoSCoW Prioritization

| FR | Title | Priority | Rationale |
|----|-------|----------|-----------|
| FR-001 | Status line / status rendering | Must Have | Core deliverable |
| FR-002 | Periodic health monitor | Must Have | Required by FR-001 and #252 |
| FR-003 | VCS staleness detection (dual-metric) | Must Have | Required for stale state |
| FR-004 | Fail-open behavior | Must Have | Article X constitutional |
