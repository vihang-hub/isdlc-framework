# Technology Stack Decision: T6 Hook I/O Optimization

**REQ-0020** | Phase 03 - Architecture | 2026-02-16

---

## Scope

This is a pure performance optimization within the existing hook infrastructure. No new technologies are introduced. This document justifies the decision to use existing patterns rather than introducing external dependencies.

---

## Existing Stack (No Change)

### Runtime
**Choice**: Node.js 20+ LTS (CommonJS hooks)
**Status**: RETAINED -- no change required
**Rationale**: Hooks are CommonJS files spawned as independent Node.js processes by Claude Code. The runtime is fixed by the host environment. Article XIII (Module System Consistency) requires hooks to remain CommonJS.

### Caching Mechanism
**Choice**: Module-level `let` variables + `Map` in `common.cjs`
**Status**: NEW pattern within existing technology
**Rationale**:
- CommonJS module-level variables persist for the lifetime of the `require()` cache, which equals the process lifetime for hooks
- No external cache library needed -- `Map` is a built-in JavaScript data structure
- Per-process scope means no cross-process contamination and no memory leaks
- Simplest possible implementation (Article V: Simplicity First)

**Alternatives Considered**:

| Alternative | Verdict | Reason for Rejection |
|-------------|---------|---------------------|
| `node-cache` npm package | Rejected | Adds external dependency for trivial functionality; hooks must minimize dependencies |
| `lru-cache` npm package | Rejected | LRU eviction is unnecessary -- cache holds 3 items max and lives for <1 second |
| Environment variable passing | Rejected | Claude Code does not support passing structured data via env vars to hooks |
| Shared memory (IPC) | Rejected | Hooks are independent processes; IPC adds complexity for marginal benefit |
| Persistent disk cache | Rejected | Adds a cache file that could become stale; adds more I/O, not less |
| Redis/memcached | Rejected | Massively over-engineered for 3 config files cached within a single process |

### mtime Checking
**Choice**: `fs.statSync(path).mtimeMs`
**Status**: NEW usage of existing Node.js API
**Rationale**:
- `statSync` is ~0.5ms vs ~5ms for `readFileSync` + `JSON.parse` on a typical config file
- `mtimeMs` provides sub-millisecond precision (Number, not Date object)
- No external file-watching library needed (e.g., `chokidar`) since hooks are short-lived processes
- Standard Node.js fs API -- no compatibility concerns

### File System Operations
**Choice**: `fs.readFileSync`, `fs.existsSync`, `fs.statSync` (synchronous)
**Status**: RETAINED -- hooks are synchronous by design
**Rationale**: Hooks run in a blocking stdin-read pattern (`readStdin()` is async, but all filesystem operations are synchronous). Introducing async I/O would require rewriting the hook execution model, which is out of scope.

### State Management
**Choice**: JSON file (`state.json`) with optimistic locking via `state_version`
**Status**: RETAINED -- `writeState()` read-before-write is preserved
**Rationale**: Article XIV (State Management Integrity) requires atomic JSON writes. The `writeState()` function reads the current `state_version` from disk before writing. This read cannot be cached or eliminated -- it is the optimistic locking mechanism (BUG-0009). FR-005 confirms dispatchers already batch their `writeState()` calls.

### Testing
**Choice**: Node.js built-in `node:test` + `node:assert/strict`
**Status**: RETAINED
**Rationale**: 600+ existing tests cover the 12 affected files. New tests for cache hit/miss, mtime invalidation, and state read consolidation will use the same framework. Test files use `.test.cjs` extension and run from temp directories (Article XIII compliance).

---

## Evaluation Summary

| Layer | Technology | Change | Justification |
|-------|-----------|--------|---------------|
| Runtime | Node.js 20+ CJS | None | Fixed by host environment |
| Caching | Module-level Map | New pattern | Simplest solution, no dependencies |
| Invalidation | fs.statSync mtime | New usage | Cheap stat vs expensive read+parse |
| State I/O | writeState() optimistic locking | None | Correctness preserved |
| Testing | node:test + assert/strict | None | 600+ existing tests |
| Dependencies | None added | None | Article V: no unnecessary complexity |

---

## Cost Impact

Zero infrastructure cost change. This optimization reduces CPU time per hook invocation by eliminating redundant I/O, which has no monetary cost impact (hooks run locally on the developer's machine, not in cloud infrastructure).

---

## Traceability

| Decision | Traces To |
|----------|-----------|
| Use module-level Map for caching | FR-001, FR-002, NFR-001, Article V |
| Use fs.statSync for mtime checking | AC-001b, AC-001c, NFR-003 |
| No external dependencies | Article V, NFR-002 |
| Preserve writeState read-before-write | NFR-003, Article XIV |
| Retain node:test framework | Article II, NFR-002 |
