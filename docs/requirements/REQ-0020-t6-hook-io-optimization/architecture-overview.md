# Architecture Overview: T6 Hook I/O Optimization

**REQ-0020** | Phase 03 - Architecture | 2026-02-16

---

## 1. Context

The iSDLC framework uses 5 dispatcher hooks that consolidate 21+ sub-hooks into single-process invocations (REQ-0010 Tier 1). Each dispatcher currently performs redundant filesystem I/O:

- **Config loading**: `loadManifest()`, `loadIterationRequirements()`, `loadWorkflowDefinitions()` each read from disk on every call, even when invoked multiple times within a single dispatcher process.
- **Project root resolution**: `getProjectRoot()` traverses the directory tree upward on every call (33 calls across 7 files, 21 in common.cjs alone).
- **State reads**: `state-write-validator.cjs` reads the same disk state file 3 times (once per validation rule V7, V8, and V1-V3).
- **Sub-hook config duplication**: Sub-hooks like `gate-blocker.cjs` bypass the dispatcher's pre-loaded configs and call `loadManifest()` directly.

This architecture addresses the optimization by introducing **per-process caching** at the `common.cjs` module level, **context passthrough** from dispatchers to sub-hooks, and **state read consolidation** within `state-write-validator.cjs`.

---

## 2. Architecture Pattern

**Pattern**: Module-Level Memoization with Context Injection

This is NOT a new architectural pattern -- it extends the existing dispatcher-consolidation pattern (REQ-0010) by adding a caching layer within the same process boundary. The key constraint is that hooks run as independent Node.js processes with no shared memory between invocations. Caching is therefore **per-process only**, meaning it saves reads within a single dispatcher run (where 3-9 sub-hooks share a process).

**Rationale** (ADR-0001):
- Simplest solution that satisfies the 50%+ I/O reduction target (Article V: Simplicity First)
- No new dependencies, no new processes, no architectural changes
- Preserves all existing contracts: `check(ctx)` signature, fail-open behavior, optimistic locking
- Module-level variables in CommonJS are naturally scoped to the process lifetime

---

## 3. System Context (C4 Level 1)

The T6 optimization is entirely internal to the hook subsystem. No external boundaries change.

```
+-------------------+         +-------------------+
|   Claude Code     |-------->|  iSDLC Hooks      |
|   (Host Process)  |  stdin  |  (5 Dispatchers)  |
+-------------------+         +--------+----------+
                                       |
                              +--------v----------+
                              |  Filesystem       |
                              |  - state.json     |
                              |  - config/*.json  |
                              |  - .isdlc/        |
                              +-------------------+
```

T6 reduces the number of arrows from "Hooks" to "Filesystem" without changing the arrows from "Claude Code" to "Hooks".

---

## 4. Container Diagram (C4 Level 2)

See `diagrams/c4-level2-container.mermaid` for the full diagram.

The key containers affected:

| Container | Role | T6 Change |
|-----------|------|-----------|
| `common.cjs` | Shared utility library for all hooks | Add module-level config cache, getProjectRoot cache |
| 5 Dispatchers | Process entry points that orchestrate sub-hooks | Already batch writes; populate ctx.manifest/requirements/workflows |
| `state-write-validator.cjs` | PostToolUse validator for state.json writes | Consolidate 3 disk reads into 1 |
| 4 Sub-hooks | Individual enforcement rules (gate-blocker, iteration-corridor, constitution-validator, test-watcher) | Use ctx passthrough instead of direct config loading |

---

## 5. Component Architecture

### 5.1 Caching Layer (FR-001, FR-002)

Location: `src/claude/hooks/lib/common.cjs` (module-level variables)

```
common.cjs
  |
  +-- Module-level cache variables:
  |     let _cachedProjectRoot = null;
  |     let _configCache = new Map();  // key: filepath, value: { mtime, data }
  |
  +-- getProjectRoot() [FR-002]
  |     - First call: traverse filesystem, cache result in _cachedProjectRoot
  |     - Subsequent calls: return _cachedProjectRoot
  |     - CLAUDE_PROJECT_DIR: return env var immediately (existing behavior)
  |
  +-- loadManifest() [FR-001]
  |     - Check _configCache for manifest path
  |     - If cached AND mtime unchanged: return cached data
  |     - If not cached OR mtime changed: read disk, update cache
  |     - If file missing: return null, do NOT cache
  |
  +-- loadIterationRequirements() [FR-001]
  |     - Same mtime-based cache pattern as loadManifest()
  |
  +-- loadWorkflowDefinitions() [FR-001]
        - Same mtime-based cache pattern as loadManifest()
```

### 5.2 Cache Invalidation Strategy

| Scenario | Action | Traces To |
|----------|--------|-----------|
| Same process, same file, same mtime | Return cached copy | AC-001a, AC-001c |
| Same process, file mtime changed | Re-read from disk, update cache | AC-001b |
| File does not exist | Return null, do not cache | AC-001d |
| Different project root (monorepo) | Cache key includes project root path | AC-001e |
| Process ends | Cache is garbage-collected (per-process) | Constraint |

**Cache key structure**: `{projectRoot}:{configFileName}`

This avoids monorepo cache pollution (AC-001e) by incorporating the project root into the cache key. If `getProjectRoot()` returns a different value (which cannot happen within a single process since getProjectRoot is itself cached), the config cache entries for the previous root are effectively orphaned.

### 5.3 Context Passthrough (FR-004)

Dispatchers already build a `ctx` object with `{ input, state, manifest, requirements, workflows }`. Sub-hooks already have the `ctx.requirements || fallback` pattern. The optimization ensures:

1. Dispatchers always populate `ctx.manifest`, `ctx.requirements`, `ctx.workflows` from the cached loaders (already done in all 5 dispatchers).
2. `gate-blocker.cjs` line 369 (`checkAgentDelegationRequirement`) uses `ctx.manifest` or a manifest parameter instead of calling `loadManifest()` directly.
3. All standalone fallbacks (for hooks running outside dispatchers via `require.main === module`) continue to work.

### 5.4 State Read Consolidation (FR-003)

Location: `src/claude/hooks/state-write-validator.cjs`

Current flow (3 reads):
```
check(ctx) -> checkVersionLock(filePath, toolInput, toolName)
                -> existsSync + readFileSync + JSON.parse           [read 1]
           -> checkPhaseFieldProtection(filePath, toolInput, toolName)
                -> existsSync + readFileSync + JSON.parse           [read 2]
           -> readFileSync + JSON.parse (for V1-V3 phase scan)     [read 3]
```

Optimized flow (1 read):
```
check(ctx) -> readDiskState(filePath)                              [read 1]
           -> checkVersionLock(filePath, toolInput, toolName, diskState)
                -> uses diskState parameter
           -> checkPhaseFieldProtection(filePath, toolInput, toolName, diskState)
                -> uses diskState parameter
           -> V1-V3 use incoming content from toolInput (no disk read)
```

The `diskState` parameter is added to `checkVersionLock()` and `checkPhaseFieldProtection()`. Both functions retain their fail-open behavior when `diskState` is null.

### 5.5 Batch Write Verification (FR-005)

Analysis confirms dispatchers already implement the batch-write pattern:

| Dispatcher | writeState calls | Pattern |
|------------|-----------------|---------|
| pre-task-dispatcher | 1 (on block) OR 1 (at end) | Already batched |
| pre-skill-dispatcher | 1 (on block) OR 1 (at end) | Already batched |
| post-task-dispatcher | 1 (at end) | Already batched |
| post-bash-dispatcher | 1 (at end) | Already batched |
| post-write-edit-dispatcher | 0 (hooks manage own I/O) | No write needed |

No code changes required for FR-005 beyond verification. The `writeState()` function's internal read-before-write for optimistic locking (BUG-0009) is preserved as-is.

---

## 6. Data Flow

### 6.1 Cached Config Load Flow

```
Dispatcher Process Start
  |
  v
getProjectRoot() --[cache miss]--> traverse filesystem --> cache result
  |                [cache hit]---> return cached value
  v
loadManifest()
  |-- getManifestPath() --[uses cached projectRoot]
  |-- check _configCache for manifestPath
  |     [miss or mtime changed] --> fs.statSync(path) --> fs.readFileSync --> JSON.parse --> cache
  |     [hit and mtime same]    --> return cached data
  v
loadIterationRequirements() -- same pattern
  v
loadWorkflowDefinitions()  -- same pattern
  v
Build ctx = { input, state, manifest, requirements, workflows }
  v
Sub-hook 1: check(ctx) -- uses ctx.manifest, ctx.requirements
Sub-hook 2: check(ctx) -- uses ctx.manifest, ctx.requirements
...
Sub-hook N: check(ctx) -- uses ctx.manifest, ctx.requirements
```

### 6.2 I/O Count Before vs After

| Operation | Before (per dispatcher) | After (per dispatcher) | Reduction |
|-----------|------------------------|----------------------|-----------|
| getProjectRoot filesystem traversals | 5-10 | 1 | 80-90% |
| Config file reads (manifest) | 1-3 (sub-hooks re-read) | 1 | 66-80% |
| Config file reads (requirements) | 1-3 | 1 | 66-80% |
| Config file reads (workflows) | 1 | 1 | 0% (already single) |
| state-write-validator disk reads | 3 | 1 | 67% |
| writeState calls (per dispatcher) | 1 | 1 | 0% (already optimal) |
| **Total I/O operations** | **~15-25** | **~5-7** | **~65-72%** |

---

## 7. Technology Decisions

No new technologies. All changes use existing Node.js CommonJS patterns:

- **Caching**: Module-level `let` variables and `Map` (no external cache library)
- **mtime checking**: `fs.statSync(path).mtimeMs` (sub-millisecond precision)
- **Cache key**: String concatenation of project root + config name
- **Parameter injection**: Standard JavaScript function parameters

See `tech-stack-decision.md` for full justification.

---

## 8. Scalability

This optimization scales linearly with:
- **Number of sub-hooks per dispatcher**: More sub-hooks = more cache hits per process
- **Number of dispatcher invocations**: Each invocation benefits independently (per-process cache)
- **Config file size**: Larger files benefit more from caching (avoids repeated parse)

The per-process nature means no memory leak risk -- cache is garbage-collected when the Node.js process exits after each dispatcher invocation.

---

## 9. Deployment

No deployment changes. The optimization is a drop-in replacement within existing `.cjs` files. The `isdlc update` mechanism handles file distribution to `.claude/hooks/`.

---

## 10. Risk Summary

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| Stale config served | Medium | Low | mtime-based invalidation; config files rarely change mid-process |
| Monorepo cache pollution | Medium | Very Low | Per-root cache key; getProjectRoot cached per-process prevents root switching |
| Standalone mode regression | Low | Low | ctx.X OR fallback pattern preserved; 600+ existing tests |
| Optimistic locking break | High | Very Low | writeState read-before-write NOT changed |
| fs.statSync overhead | Low | N/A | statSync adds ~0.5ms vs ~5ms for full read+parse; net positive |

---

## 11. Traceability

| Architecture Decision | Requirements | NFRs |
|----------------------|--------------|------|
| Module-level caching in common.cjs | FR-001, FR-002 | NFR-001 (performance), NFR-002 (backward compat) |
| mtime-based cache invalidation | AC-001b, AC-001c | NFR-003 (correctness) |
| Per-root cache key | AC-001e | NFR-003 (correctness) |
| Context passthrough | FR-004 | NFR-001 (performance), NFR-002 (backward compat) |
| State read consolidation | FR-003 | NFR-001 (performance) |
| Batch write verification | FR-005 | NFR-001 (performance) |
| Debug logging for cache | AC-001a-e | NFR-004 (observability) |
