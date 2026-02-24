# ADR-0002: mtime-Based Cache Invalidation Strategy

## Status
Accepted

## Context
The config file cache (ADR-0001) needs an invalidation strategy. The cache must detect when a config file has been modified so it does not serve stale data. The key constraints are:

- Hooks run as short-lived processes (<1 second)
- Config files change rarely (typically only during `isdlc update` or manual edits)
- The invalidation check must be cheaper than re-reading the file
- Monorepo scenarios mean different project roots may have different configs (AC-001e)
- Missing files must be handled gracefully without caching the absence (AC-001d)

Traces to: AC-001b, AC-001c, AC-001d, AC-001e, NFR-003

## Decision
Use **filesystem mtime** (modification timestamp) as the cache invalidation signal:

```javascript
function loadWithCache(configPath, configName) {
    const cacheKey = `${getProjectRoot()}:${configName}`;

    try {
        const stat = fs.statSync(configPath);
        const currentMtime = stat.mtimeMs;

        const cached = _configCache.get(cacheKey);
        if (cached && cached.mtimeMs === currentMtime) {
            debugLog(`Cache HIT: ${configName}`);
            return cached.data;
        }

        const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        _configCache.set(cacheKey, { mtimeMs: currentMtime, data });
        debugLog(`Cache MISS: ${configName} (${cached ? 'mtime changed' : 'first load'})`);
        return data;
    } catch (e) {
        return null; // fail-open
    }
}
```

The `mtimeMs` property of `fs.statSync()` returns the file's last modification time as a Number with millisecond precision. Two files with the same path and same mtime are considered identical.

## Consequences

**Positive:**
- `statSync` is ~10x cheaper than `readFileSync + JSON.parse` on typical config files (0.5ms vs 5ms)
- Deterministic: mtime changes if and only if the file is written (no false negatives under normal operation)
- No external dependencies
- Cross-platform: `mtimeMs` works on macOS, Linux, and Windows

**Negative:**
- On some filesystems (e.g., FAT32), mtime resolution is 2 seconds. If a file is modified twice within 2 seconds, the second modification might have the same mtime. This is irrelevant for iSDLC hooks (config files are not modified during hook execution).
- `statSync` on a non-existent file throws an error, which must be caught. The `existsSync` + `statSync` pattern adds one extra syscall vs just `readFileSync` with error handling. We mitigate this by catching the statSync error directly.

## Alternatives Considered

| Alternative | Reason for Rejection |
|-------------|---------------------|
| Content hash (SHA-256) | Requires reading the full file to compute hash -- defeats the purpose of caching |
| TTL-based (cache for N seconds) | Hooks are <1 second processes; any TTL would either always hit or always miss |
| File size comparison | Not a reliable change indicator (content can change without size changing) |
| inode number | Platform-dependent; some file operations preserve inode, some don't |
| No invalidation (read once per process) | Safe for hooks (single invocation), but mtime adds minimal cost and handles edge cases where a config is loaded, modified externally, then loaded again within the same process |
