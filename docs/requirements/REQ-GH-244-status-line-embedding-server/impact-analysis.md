# Impact Analysis: REQ-GH-244

## Blast Radius

### Tier 1 — Direct Changes

| File | Change Type | FR |
|------|-----------|-----|
| `src/core/vcs/staleness.cjs` | NEW | FR-003 |
| `src/core/embedding/health-monitor.cjs` | NEW | FR-002 |
| `src/providers/claude/embedding-statusline.cjs` | NEW | FR-001 |
| `lib/embedding/package/manifest.js` | MODIFY | FR-003 |
| `lib/embedding/package/builder.js` | MODIFY | FR-003 |
| `src/providers/codex/projection.js` | MODIFY | FR-001 |
| `src/claude/settings.json` | MODIFY | FR-001 |

### Tier 2 — Transitive Impact

| File | Impact Reason |
|------|--------------|
| `lib/embedding/package/manifest.test.js` | Existing tests need case for generatedAtCommit |
| `.isdlc/embedding-health.json` | NEW runtime file — consumed by tool-router (#252) |
| Tool-router (#252) `health-probe.cjs` | May need update to prefer health file over PID check |
| Codex projection tests | Need cases for EMBEDDING_STATUS |

### Tier 3 — Potential Side Effects

| Area | Risk | Mitigation |
|------|------|------------|
| Status line overhead | Frequent script execution | Two-tier caching, display-refresh is file-read only |
| `git fetch` network calls | Latency on slow networks | 5s timeout, gated by configurable interval |
| Health file contention | Multiple readers, one writer | Atomic writes (tmp + rename) |

## Summary

| Metric | Count |
|--------|-------|
| Direct modifications | 4 |
| New files | 3 |
| New test files | 5 |
| Transitive modifications | 3 |
| Total affected | 15 |
| Risk level | Medium |
| Estimated scope | Standard |
