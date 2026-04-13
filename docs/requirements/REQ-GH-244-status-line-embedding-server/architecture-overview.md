# Architecture Overview: REQ-GH-244

## 1. Architecture Options

### Decision 1: Health monitor execution model

| Option | Summary | Pros | Cons | Verdict |
|--------|---------|------|------|---------|
| A. Separate daemon | Background process on interval | Always-on | Extra process, lifecycle management | Eliminated |
| B. Status line script = health checker | Claude Code's refresh drives check | No extra process, single script | Codex needs different trigger | **Selected** |
| C. Hook-triggered | Check on every PreToolUse | No extra process | Too frequent, adds latency | Eliminated |

### Decision 2: VCS staleness model

| Option | Summary | Pros | Cons | Verdict |
|--------|---------|------|------|---------|
| A. Commits only | Count commits behind remote | Simple | Misses local changes (critical for SVN) | Eliminated |
| B. Files only | Count changed files locally | Captures local drift | Misses remote changes | Eliminated |
| C. Dual-metric | Both remote commits + local files | Full picture for Git and SVN | Two VCS commands | **Selected** |

### Decision 3: VCS abstraction

| Option | Summary | Pros | Cons | Verdict |
|--------|---------|------|------|---------|
| A. Git-only | Ship git, SVN later | Faster | User needs SVN now | Eliminated |
| B. Git + SVN abstraction | Interface with two implementations | Both supported | More code | **Selected** |

### Decision 4: Provider rendering

| Option | Summary | Pros | Cons | Verdict |
|--------|---------|------|------|---------|
| A. Claude-only | Status line for Claude Code only | Simpler | Codex gets nothing | Eliminated |
| B. Provider-neutral data + provider-specific rendering | Shared health file, Claude status line + Codex instruction | Both providers benefit | Two rendering paths | **Selected** |

## 2. Selected Architecture

### ADR-001: Status line script as health checker
- **Status**: Accepted
- **Context**: Need periodic health monitoring without a separate daemon.
- **Decision**: Claude Code status line script does both jobs. Two-tier refresh: display-refresh reads cached file (<5ms), data-refresh does full probe + VCS check (on configurable interval).
- **Rationale**: No daemon, no cron. Piggybacks on existing mechanism.
- **Consequences**: Codex reads health file during projection generation.

### ADR-002: Dual-metric VCS staleness
- **Status**: Accepted
- **Context**: SVN workflows have infrequent commits but high local churn.
- **Decision**: Returns both `commits_behind` (remote delta) and `files_changed` (local modifications). Stale if either > 0.
- **Rationale**: Captures both team drift and local work.
- **Consequences**: Two VCS commands per data-refresh, gated by interval.

### ADR-003: VCS abstraction with git + SVN
- **Status**: Accepted
- **Context**: Framework must support both Git and SVN.
- **Decision**: `src/core/vcs/staleness.cjs` with unified interface. VCS detected via `.git/` or `.svn/`.
- **Rationale**: Clean abstraction, fail-open if neither detected.
- **Consequences**: `git fetch` adds ~500ms-2s on data-refresh.

### ADR-004: Provider-neutral data layer
- **Status**: Accepted
- **Context**: Both Claude and Codex need embedding status.
- **Decision**: `.isdlc/embedding-health.json` is shared data layer. One writer, multiple readers.
- **Rationale**: Clean contract between health monitor, status line, tool-router, and Codex projection.
- **Consequences**: Health file schema is a cross-consumer contract.

## 3. Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| HTTP health check | Node.js `http.request` sync wrapper | Consistent with port-discovery.js |
| VCS commands | `child_process.execSync` with timeout | Sync for status line, 5s git fetch, 3s svn |
| Health file atomicity | Write to `.tmp`, rename | Prevents partial reads |
| Script format | CJS (`.cjs`) | Claude Code hooks/scripts are CJS |
| Git local changes | `git diff --name-only {ref}` | Staged + unstaged against generation commit |
| SVN local changes | `svn status` line count | Modified/added/deleted in working copy |

## 4. Integration Architecture

| Source | Target | Interface | Data Format | Error Handling |
|--------|--------|-----------|-------------|----------------|
| Status line script | `/health` endpoint | HTTP GET | JSON | Timeout 2s → "offline" |
| Status line script | `getCommitsBehind()` | function call | `{ commits_behind, files_changed, vcs }` | VCS error → null |
| Status line script | Health file | atomic write | JSON schema (FR-002) | Write error → log, skip |
| Status line script | stdout | text | Formatted line | Error → no output, exit 0 |
| `.emb` builder | VCS ref | `execSync` | `generatedAtCommit: string` | Error → field omitted |
| Tool-router (#252) | Health file | file read | Same JSON | Missing → "offline" |
| Codex projection | Health file | file read | Same JSON | Missing → omit status |

## 5. Summary

| Decision | Selected | Risk |
|----------|----------|------|
| Execution model | Status line = health checker (ADR-001) | Low |
| Staleness model | Dual-metric commits + files (ADR-002) | Low |
| VCS support | Git + SVN abstraction (ADR-003) | Low |
| Provider rendering | Neutral data + specific rendering (ADR-004) | Low |
