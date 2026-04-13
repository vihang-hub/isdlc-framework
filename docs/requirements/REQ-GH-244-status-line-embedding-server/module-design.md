# Module Design: REQ-GH-244

## Module Overview

| Module | Responsibility | Dependencies |
|--------|---------------|-------------|
| `staleness` | VCS abstraction — git + SVN dual-metric staleness | `child_process`, `fs`, `path` |
| `health-monitor` | HTTP probe + VCS staleness + health file writer | `staleness`, `port-discovery` (via config read) |
| `embedding-statusline` | Claude status line — read health, format, output | `health-monitor` |
| `manifest` (modified) | Add generatedAtCommit to .emb packages | None new |
| `projection` (modified) | Codex EMBEDDING_STATUS injection | `fs` (read health file) |

## src/core/vcs/staleness.cjs (NEW)

```javascript
/**
 * @typedef {Object} StalenessResult
 * @property {number|null} commits_behind - Remote commits since generation
 * @property {number|null} files_changed - Local files modified since generation
 * @property {"git"|"svn"|"unknown"} vcs - Detected VCS type
 * @property {string|null} remote - Remote ref used (e.g., "origin/main")
 * @property {string|null} error - Error description if any check failed
 */

/**
 * Check staleness against remote and local changes.
 * @param {string} generatedRef - VCS ref when embeddings were generated
 * @param {string} projectRoot - Absolute path to project root
 * @returns {StalenessResult}
 */
function getCommitsBehind(generatedRef, projectRoot)
```

### Git Implementation
1. Detect `.git/` in projectRoot
2. `git fetch --quiet` (5s timeout, fail-open → skip to local)
3. `git rev-list --count {ref}..@{upstream}` → commits_behind (fallback to HEAD if no upstream)
4. `git diff --name-only {ref}` → count lines → files_changed (staged + unstaged)

### SVN Implementation
1. Detect `.svn/` in projectRoot
2. `svn info --show-item revision` → current revision (3s timeout)
3. `parseInt(currentRev) - parseInt(generatedRef)` → commits_behind
4. `svn status` → count non-empty lines → files_changed

### No VCS
Return `{ commits_behind: null, files_changed: null, vcs: "unknown" }`

~80 lines. CJS. No external dependencies.

## src/core/embedding/health-monitor.cjs (NEW)

```javascript
/**
 * @typedef {Object} HealthResult
 * @property {"healthy"|"stale"|"offline"|"loading"|"missing"} status
 * @property {string} checked_at - ISO timestamp
 * @property {number|null} port
 * @property {number|null} chunks
 * @property {number|null} commits_behind
 * @property {number|null} files_changed
 * @property {"git"|"svn"|"unknown"} vcs
 * @property {string|null} generated_at_commit
 * @property {string|null} error
 */

/**
 * Full health check: server probe + VCS staleness + file write.
 * @param {string} projectRoot
 * @returns {HealthResult}
 */
function refreshHealth(projectRoot)

/**
 * Check if health file needs refresh based on interval.
 * @param {string} healthFilePath
 * @param {number} intervalMinutes
 * @returns {boolean}
 */
function shouldRefresh(healthFilePath, intervalMinutes)
```

### State Resolution Order
1. Check `.emb` files exist → if not: `"missing"`
2. Check generation lock marker → if exists: `"loading"`
3. HTTP GET `localhost:{port}/health` (2s timeout) → if fails: `"offline"`
4. Read `generatedAtCommit` from `.emb` manifest
5. `getCommitsBehind(generatedAtCommit, projectRoot)` → if commits_behind > 0 OR files_changed > 0: `"stale"`, else: `"healthy"`

### Atomic Write
Write to `.isdlc/embedding-health.json.tmp`, rename to `.isdlc/embedding-health.json`.

### Transition Detection
Read previous health file before writing. If `previousStatus !== newStatus`, log `[embedding] status: {prev} → {new}` to stderr.

~100 lines. CJS.

## src/providers/claude/embedding-statusline.cjs (NEW)

Entry point script called by Claude Code.

```
Main flow:
1. Read embeddings.statusline.enabled from .isdlc/config.json → if false: exit 0
2. Read embeddings.health_check_interval_minutes (default: 5)
3. shouldRefresh(healthFilePath, interval)?
   → YES: refreshHealth(projectRoot) → writes health file
   → NO: read health file from disk
4. Format status string from health data
5. process.stdout.write(formatted), exit 0
```

### Format Map

| Status | Output |
|--------|--------|
| healthy | `emb: {chunks} chunks ✓` |
| stale (commits only) | `emb: stale ({N} commits behind)` |
| stale (files only) | `emb: stale ({N} files modified)` |
| stale (both) | `emb: stale ({N} commits behind, {M} files modified)` |
| offline | `emb: offline` |
| loading | `emb: loading...` |
| missing | `emb: not configured` |

On any error: no output, exit 0. ~60 lines.

## lib/embedding/package/manifest.js (MODIFY)

Add to `createManifest()`:
```javascript
if (meta.generatedAtCommit) {
  manifest.generatedAtCommit = meta.generatedAtCommit;
}
```

Add to `REQUIRED_FIELDS` consideration: `generatedAtCommit` is optional (backward compat).

## lib/embedding/package/builder.js (MODIFY)

In build flow, before calling `createManifest()`, detect VCS and capture ref:
```javascript
let generatedAtCommit = null;
try {
  if (existsSync(join(projectRoot, '.git'))) {
    generatedAtCommit = execSync('git rev-parse HEAD', { cwd: projectRoot, timeout: 3000 }).toString().trim();
  } else if (existsSync(join(projectRoot, '.svn'))) {
    generatedAtCommit = execSync('svn info --show-item revision', { cwd: projectRoot, timeout: 3000 }).toString().trim();
  }
} catch { /* fail-open */ }
```

Pass `generatedAtCommit` to `createManifest()`.

## src/providers/codex/projection.js (MODIFY)

```javascript
function buildEmbeddingStatusInstruction(projectRoot) {
  // Read .isdlc/embedding-health.json
  // Format: "EMBEDDING_STATUS: {status}, {chunks} chunks, {commits_behind} commits behind, {files_changed} files modified"
  // Return instruction string or null if file missing
}
```

Injected alongside semantic search instruction from #252. ~25 lines.
