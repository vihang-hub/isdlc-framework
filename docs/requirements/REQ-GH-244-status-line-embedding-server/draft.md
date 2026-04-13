# Claude Code status line integration for embedding server

**Source**: GitHub Issue #244
**Type**: Enhancement

## Problem

The embedding server runs in the background and the only way to know its state mid-session is to run a curl command or look at log files. Users have no constant visibility.

## Proposed

Add a Claude Code status line entry that shows the embedding pipeline state at a glance:

- **Healthy**: `emb: 19811 chunks ✓`
- **Stale**: `emb: stale (47 edits behind)`
- **Offline**: `emb: offline` (in yellow/red)
- **Loading**: `emb: loading...` (during generation)

Claude Code's status line is configurable via `settings.json` — a status line script can be registered that runs periodically and outputs a line to stdout.

## Implementation sketch

1. Create `src/core/hooks/embedding-statusline.cjs`:
   - Pings `GET /health` on configured port (with cache to avoid spamming, e.g. 10s TTL in `/tmp`)
   - Reads staleness info from the health response or filesystem
   - Outputs a single formatted line
2. Register in `src/claude/settings.json` under `statusLine` config
3. Document in `docs/isdlc/config-reference.md`

## Design considerations

- **Low overhead** — the status line is rendered frequently; cache the result with short TTL
- **Fail-silent** — if server unreachable or script errors, print nothing (don't crash the status line)
- **Opt-in** — some users may not want it; provide a config flag to disable
- **Color coding** — use ANSI escapes sparingly for critical states (offline, stale)
- **Multi-project** — if user switches between projects in same terminal, detect via `$CLAUDE_PROJECT_DIR`

## Context from #252 Analysis

During the #252 roundtable, the periodic health monitor (FR-002) was moved to #244's scope:
- Periodic health check with configurable frequency (default 5 min, min 1, max 60)
- Config: `embeddings.health_check_interval_minutes` in `.isdlc/config.json`
- Health status file: `.isdlc/embedding-health.json` with `{ status, checked_at, port, chunks, error }`
- Health transition notifications (active→inactive, inactive→active)
- The tool-router (from #252) reads this health file for routing decisions

## Acceptance (from issue)

- Status line shows embedding state in Claude Code on this project
- Refreshes without noticeable overhead
- Handles all states: healthy, stale, offline, loading, missing
- Opt-out via `.isdlc/config.json` `embeddings.statusline.enabled: false`
- Works on both Claude Code providers (Claude app, Claude Code CLI)

## Related

- #252 (smooth embeddings UX) — tool-router consumes the health file this produces
- #246 (launchd/systemd) — OS-level lifecycle, complementary
- #241 (port collision false success) — completed
