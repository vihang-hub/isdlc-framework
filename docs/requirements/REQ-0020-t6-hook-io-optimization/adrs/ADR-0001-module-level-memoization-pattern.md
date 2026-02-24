# ADR-0001: Module-Level Memoization Pattern for Config Caching

## Status
Accepted

## Context
The iSDLC hook dispatchers (5 files) consolidate 21+ sub-hooks into single-process invocations. Within each process, the shared utility library `common.cjs` provides config-loading functions (`loadManifest()`, `loadIterationRequirements()`, `loadWorkflowDefinitions()`) that are called multiple times by different sub-hooks. Each call performs `getProjectRoot()` (filesystem traversal), `existsSync()` (path check), `readFileSync()` (disk read), and `JSON.parse()` (CPU). This results in 15-25 filesystem I/O operations per dispatcher invocation when only 5-7 are necessary.

We need a caching mechanism that:
- Eliminates redundant reads within a single process
- Invalidates correctly when config files change
- Handles monorepo scenarios (multiple project roots)
- Adds no external dependencies
- Preserves fail-open behavior (Article X)

Traces to: FR-001, FR-002, NFR-001, NFR-002, NFR-003

## Decision
Use **module-level variables** in `common.cjs` for caching:

1. **getProjectRoot()**: Cache in `let _cachedProjectRoot = null`. Set on first call, return cached value on subsequent calls. Per-process lifetime means no invalidation needed within a process.

2. **Config loaders**: Cache in `const _configCache = new Map()` with entries keyed by `{projectRoot}:{configFileName}`. Each entry stores `{ mtimeMs, data }`. On each call:
   - Resolve the file path (using cached projectRoot)
   - `fs.statSync(path)` to get current mtimeMs (~0.5ms)
   - If cache entry exists AND mtimeMs matches: return cached `data`
   - If cache miss OR mtime changed: `readFileSync` + `JSON.parse`, update cache
   - If file does not exist: return null, do NOT cache the absence

This approach leverages the fact that CommonJS module-level variables persist for the lifetime of the `require()` cache, which equals the process lifetime for hooks.

## Consequences

**Positive:**
- Reduces I/O from 15-25 to 5-7 operations per dispatcher invocation (~65-72% reduction, exceeding the 50% target in NFR-001)
- Zero external dependencies (Article V: Simplicity First)
- Per-process scope eliminates memory leak risk -- cache is garbage-collected when process exits
- mtime-based invalidation is deterministic (not time-based TTL, which could serve stale data)
- Backward compatible -- all functions retain the same return type and fail-open behavior

**Negative:**
- Adds `fs.statSync()` call on each cache check (~0.5ms). Net positive since it replaces `readFileSync` + `JSON.parse` (~5ms), but not zero-cost.
- Within a single process invocation (~100ms), if a config file is modified externally, the cached version is served. This is an acceptable trade-off since config files do not change during normal hook execution.
- Cache key includes projectRoot, which adds a string operation per lookup. Negligible cost.

## Alternatives Considered

| Alternative | Reason for Rejection |
|-------------|---------------------|
| External cache library (node-cache, lru-cache) | Unnecessary dependency for 3 items cached for <1 second |
| No caching (status quo) | Does not meet NFR-001 (50% I/O reduction target) |
| Dispatcher-level caching (pass configs to sub-hooks only) | Already partially done via ctx; FR-001 addresses the deeper issue of sub-hooks calling loaders directly or internal functions like getSkillOwner() calling loadManifest() |
| WeakRef-based caching | Over-engineered; process lifetime is <1 second, no need for GC-aware references |
| File watcher (chokidar/fs.watch) | Hooks are short-lived processes; watchers cannot initialize fast enough |
