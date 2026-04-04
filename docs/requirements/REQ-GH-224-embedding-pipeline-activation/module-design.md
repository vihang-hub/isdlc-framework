# Module Design: Embedding Pipeline Activation

**Item**: REQ-GH-224
**Status**: Accepted

---

## 1. Module Overview

| Module | Path | Action | Responsibility |
|--------|------|--------|----------------|
| http-server | `lib/embedding/server/http-server.js` | CREATE | HTTP wrapper around existing MCP server, exposes all endpoints |
| isdlc-embedding-server | `bin/isdlc-embedding-server.js` | CREATE | Runner entry point, reads config, starts HTTP |
| lifecycle | `lib/embedding/server/lifecycle.js` | CREATE | Daemon spawn/stop/status, PID+lock management |
| port-discovery | `lib/embedding/server/port-discovery.js` | CREATE | Client-side: read config host:port, ping /health |
| refresh-client | `lib/embedding/server/refresh-client.js` | CREATE | Client-side: POST /refresh and /add-content helpers |
| embedding-session-check | `src/core/hooks/embedding-session-check.cjs` | CREATE | SessionStart hook: ping server, prompt if down |
| refresh-embeddings | `src/core/finalize/refresh-embeddings.js` | CREATE | Finalize step: push delta changes to server |
| isdlc-embedding | `bin/isdlc-embedding.js` | MODIFY | Add `server {start/stop/status/restart/reload}` subcommands |
| config-defaults | `src/core/config/config-defaults.js` | MODIFY | Add `embeddings` section with defaults |
| updater | `lib/updater.js` | MODIFY | Migrate old search-config.json fields; version migration |

## 2. Module Design

### 2.1 http-server.js

```js
export function createHttpServer(config) {
  // Wraps existing lib/embedding/mcp-server/server.js
  const mcpServer = createServer(config);

  const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') { ... }
    if (req.method === 'POST' && req.url === '/search') { ... }
    if (req.method === 'GET' && req.url === '/modules') { ... }
    if (req.method === 'POST' && req.url === '/refresh') { ... }
    if (req.method === 'POST' && req.url === '/add-content') { ... }
    if (req.method === 'POST' && req.url === '/reload') { ... }
  });

  return { start(port), stop(), server };
}
```

### 2.2 lifecycle.js

```js
export function startServer(config) {
  // Check lock file, acquire
  // Spawn node child_process detached
  // Redirect stdout/stderr to .isdlc/logs/embedding-server.log
  // Write PID to .isdlc/logs/embedding-server.pid
  // Wait for /health to respond (timeout 30s)
  // Release lock, return { pid, port }
}

export function stopServer() {
  // Read PID, SIGTERM, wait for exit
}

export function serverStatus() {
  // Read PID, check alive, ping /health, return { running, pid, port, uptime, loadedPackages }
}

export function restartServer() { /* stop + start */ }
export function reloadServer() { /* POST /reload */ }
```

### 2.3 port-discovery.js (client-side)

```js
export function getServerConfig(projectRoot) {
  // Read .isdlc/config.json → embeddings.server
  // Returns { host, port }
}

export async function isServerReachable(host, port, timeoutMs = 2000) {
  // HTTP GET /health with timeout
}

export async function waitForServer(host, port, timeoutMs = 10000) {
  // Poll /health until reachable or timeout
}
```

### 2.4 refresh-client.js (client-side)

```js
export async function pushRefresh(host, port, changedFiles) {
  // POST /refresh { files: [{path, operation}] }
  // Returns { refreshed, deleted, errors }
}

export async function pushContent(host, port, chunks, source, tier) {
  // POST /add-content { chunks, source, tier }
  // Returns { added, errors }
}
```

### 2.5 embedding-session-check.cjs

```js
module.exports = async function sessionStartHook(context) {
  const { projectRoot } = context;
  const config = getServerConfig(projectRoot);
  const reachable = await isServerReachable(config.host, config.port);

  if (!reachable) {
    // Check lock file - is another session starting?
    // If yes: wait briefly, retry
    // If no: prompt user "Embedding server not running. Start it? [Y/n]"
    //   On Y: spawn lifecycle.startServer (non-blocking)
    //   On n: log warning, continue
  }
  // Never throws, never blocks
};
```

### 2.6 refresh-embeddings.js (finalize step)

```js
export async function refreshEmbeddings({ projectRoot, state }) {
  const config = getServerConfig(projectRoot);
  const changedFiles = extractChangedFiles(state);

  try {
    const result = await pushRefresh(config.host, config.port, changedFiles);
    return { success: true, refreshed: result.refreshed };
  } catch (err) {
    // Fail-open: log, continue
    return { success: false, reason: err.message };
  }
}
```

## 3. Changes to Existing Modules

### 3.1 bin/isdlc-embedding.js (MODIFY)

Add `server` subcommand router:
- `isdlc embedding server start` → calls `lifecycle.startServer()`
- `isdlc embedding server stop` → calls `lifecycle.stopServer()`
- `isdlc embedding server status` → calls `lifecycle.serverStatus()`, prints JSON
- `isdlc embedding server restart` → stop + start
- `isdlc embedding server reload` → POST `/reload`

Add `regenerate` subcommand:
- `isdlc embedding regenerate [--tier=full|guided|interface]` → full rebuild

Add `configure` subcommand:
- `isdlc embedding configure` → interactive provider/port setup

### 3.2 config-defaults.js (MODIFY)

Add `embeddings` section:
```js
embeddings: {
  server: {
    port: 7777,
    host: 'localhost',
    auto_start: true,
    startup_timeout_ms: 30000,
  },
  provider: 'codebert',
  model: 'microsoft/codebert-base',
  api_key_env: null,
  sources: [
    { type: 'code', path: 'src/', tier: 'full' },
    { type: 'docs', path: 'docs/' },
  ],
}
```

### 3.3 updater.js (MODIFY)

Add version migration:
- Read existing .emb manifests, check model version
- If mismatch detected, prompt user: "Embedding model version mismatch. Regenerate? [Y/n]"
- On Y: stop server, run `isdlc embedding regenerate`, start server

### 3.4 Provider hook registration

**Claude** (`src/claude/settings.json` SessionStart hooks):
- Add entry for `embedding-session-check.cjs`

**Codex** (projection bundle configs):
- Equivalent SessionStart registration

**Antigravity** (separate hook config):
- Equivalent SessionStart registration

### 3.5 MCP tool registration

**Claude** (`src/claude/settings.json` mcpServers):
```json
"isdlc-embedding": {
  "command": "node",
  "args": ["bin/isdlc-embedding-mcp-bridge.js"],
  "env": {}
}
```
(or direct HTTP MCP if Claude Code supports it)

**Codex**: equivalent MCP registration

**Antigravity**: equivalent MCP registration

## 4. Error Taxonomy

| Code | Description | Severity | Recovery |
|------|-------------|----------|----------|
| EMB-SRV-001 | Server not reachable at session start | Warning | Prompt user to run `isdlc embedding server start` |
| EMB-SRV-002 | Port already in use | Error | Suggest different port in config |
| EMB-SRV-003 | Provider adapter init failed (model missing, bad API key) | Error | Log, fall back to CodeBERT |
| EMB-SRV-004 | .emb package load failed | Warning | Skip that package, log, continue |
| EMB-SRV-005 | Stale lock file (PID not alive) | Warning | Clean up, proceed |
| EMB-SRV-006 | Delta refresh failed | Warning | Finalize continues (fail-open), log |
| EMB-SRV-007 | Model version mismatch | Warning | Prompt to regenerate |
| EMB-SRV-008 | Server crash (OOM or other) | Error | Log, user restarts manually |

## 5. Wiring Summary

**Server startup flow**:
```
isdlc embedding server start
  → acquire .isdlc/logs/embedding-server.lock
  → spawn detached node bin/isdlc-embedding-server.js
  → child reads .isdlc/config.json
  → child initializes provider adapter
  → child loads .emb packages from docs/.embeddings/
  → child starts HTTP server on configured port
  → parent waits for /health to respond (30s timeout)
  → parent writes PID file
  → parent releases lock
```

**Session start flow** (all 3 providers):
```
SessionStart hook fires
  → reads .isdlc/config.json → embeddings.server
  → pings http://localhost:7777/health
  → reachable: log success, continue
  → unreachable: check lock, wait if locked, else prompt user
```

**Workflow finalize flow**:
```
Workflow finalize step F0009
  → read active_workflow.changed_files from state
  → POST localhost:7777/refresh { files: [...] }
  → server re-chunks + re-embeds delta files
  → updates in-memory store, persists to .emb
```

**Dogfooding dual-file**:
- `.claude/settings.json` symlinked to `src/claude/settings.json` (auto-sync)
- `.isdlc/config.json` generated at install time
- `.isdlc/logs/` added to `.gitignore`
