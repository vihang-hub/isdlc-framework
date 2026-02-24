# Requirements Specification: T6 Hook I/O Optimization

**ID**: REQ-0020
**Type**: Performance Enhancement
**Generated**: 2026-02-16
**Backlog Item**: 2.2

---

## 1. Overview

Reduce redundant disk I/O in hook dispatchers by caching config files, consolidating state reads, and eliminating repeated filesystem traversals. Target: ~70% reduction in per-invocation I/O operations.

---

## 2. Functional Requirements

### FR-001: Config File Caching (T6-A)
The framework SHALL cache `skills-manifest.json`, `iteration-requirements.json`, and `workflows.json` in memory after first load, invalidating the cache when the file's mtime changes.

**Acceptance Criteria:**
- AC-001a: Given a dispatcher invocation, when `loadManifest()` is called multiple times within the same process, then the file is read from disk at most once.
- AC-001b: Given a cached config file, when the file's mtime has changed since the cache was populated, then the cache is invalidated and the file is re-read from disk.
- AC-001c: Given a cached config file, when the file's mtime has NOT changed, then the cached in-memory copy is returned without any disk read.
- AC-001d: Given a config file that does not exist, when `loadManifest()` is called, then the function returns null/undefined gracefully (no crash) and does not cache the failure.
- AC-001e: Given the cache is populated, when a different project root is detected (monorepo scenario), then the cache is invalidated for the previous root.

### FR-002: getProjectRoot() Per-Process Caching (T6-C)
The framework SHALL cache the result of `getProjectRoot()` after the first call within each process invocation.

**Acceptance Criteria:**
- AC-002a: Given a dispatcher invocation, when `getProjectRoot()` is called N times (N > 1), then the filesystem traversal executes at most once.
- AC-002b: Given `CLAUDE_PROJECT_DIR` is set in the environment, when `getProjectRoot()` is called, then the env var is returned immediately without filesystem traversal (existing behavior preserved).
- AC-002c: Given the cached project root, when any function calls `getProjectRoot()`, then the same value is returned consistently within the same process.

### FR-003: State Read Consolidation in state-write-validator (T6-D)
The `state-write-validator` hook SHALL read the disk state file at most once per invocation, sharing the result across all validation rules (V1-V3, V7, V8).

**Acceptance Criteria:**
- AC-003a: Given a Write/Edit event targeting state.json, when state-write-validator runs, then `fs.readFileSync(stateFile)` is called at most once for the disk comparison.
- AC-003b: Given V7 (version lock) reads disk state, when V8 (phase protection) also needs disk state, then V8 uses the same parsed object from V7's read.
- AC-003c: Given disk state is read once, when V1-V3 (content validation) need the written content, then they parse the INCOMING content from the tool input (not re-reading from disk).
- AC-003d: Given the state file does not exist on disk, when state-write-validator runs, then all rules that need disk comparison gracefully handle null and do not attempt additional reads.

### FR-004: Sub-Hook Config Passthrough (T6-A follow-through)
Sub-hooks that currently call `loadManifest()`, `loadIterationRequirements()`, or `loadWorkflowDefinitions()` directly SHALL use the pre-loaded configs from the dispatcher context (`ctx.manifest`, `ctx.requirements`, `ctx.workflows`) when running inside a dispatcher.

**Acceptance Criteria:**
- AC-004a: Given a sub-hook running inside a dispatcher, when it needs the skills manifest, then it reads from `ctx.manifest` (not calling `loadManifest()` again).
- AC-004b: Given a sub-hook running in standalone mode (no dispatcher), when it needs the skills manifest, then it calls `loadManifest()` as a fallback (backward compatibility preserved).
- AC-004c: Given `gate-blocker.cjs` `checkAgentDelegationRequirement()`, when called from a dispatcher, then it uses `ctx.manifest` instead of calling `loadManifest()` at line 369.
- AC-004d: Given `iteration-corridor.cjs`, `constitution-validator.cjs`, `test-watcher.cjs`, when called from dispatchers, then they use `ctx.requirements` instead of loading from disk.

### FR-005: writeState() Batch Optimization (T6-B revised)
Dispatchers that modify state SHALL accumulate state changes and call `writeState()` at most once at the end of the dispatcher invocation, rather than writing after each sub-hook.

**Acceptance Criteria:**
- AC-005a: Given a dispatcher invocation where 3 sub-hooks modify `ctx.state`, when the dispatcher completes, then `writeState()` is called exactly once (not 3 times).
- AC-005b: Given a sub-hook sets `stateModified: true` in its return, when the dispatcher processes results, then it defers the write until all hooks have been processed.
- AC-005c: Given `workflow-completion-enforcer.cjs` which manages its own reads/writes, when it returns `stateModified: false` (existing contract), then the dispatcher does not double-write.
- AC-005d: Given a dispatcher invocation where no sub-hook modifies state, when the dispatcher completes, then `writeState()` is NOT called.

---

## 3. Non-Functional Requirements

### NFR-001: Performance Improvement
- Config file reads per dispatcher invocation SHALL decrease from 3-6 to 1 (amortized via cache).
- `getProjectRoot()` filesystem traversals SHALL decrease from 5-10 to 1 per dispatcher invocation.
- State reads in post-write-edit dispatcher SHALL decrease from 4-6 to 2 per event.
- Overall I/O reduction target: ≥50% per dispatcher invocation.

### NFR-002: Backward Compatibility
- All sub-hooks SHALL continue to work in standalone mode (without dispatcher context).
- The `check(ctx)` function signature SHALL not change.
- Existing test suites (1300+ tests) SHALL pass without modification.

### NFR-003: Correctness Preservation
- Optimistic locking (BUG-0009) SHALL remain functional — writeState() MUST still read disk version.
- State-write-validator version lock (V7) and phase protection (V8) SHALL produce identical block/allow decisions.
- Config cache invalidation SHALL be mtime-based (not stale cache served).

### NFR-004: Observability
- Cache hits/misses SHOULD be logged to stderr when debug mode is enabled.
- Performance improvement SHOULD be measurable via existing `console.time()` instrumentation in dispatchers.

---

## 4. User Stories

### US-001: Developer experiences faster hook execution
**As a** developer using the iSDLC framework,
**I want** hook dispatchers to execute with minimal redundant I/O,
**So that** the per-tool-call overhead is reduced and workflows complete faster.

### US-002: Framework maintainer can verify I/O reduction
**As a** framework maintainer,
**I want** cache hit/miss logging available in debug mode,
**So that** I can verify the optimization is working and diagnose cache issues.

### US-003: Monorepo user gets correct config resolution
**As a** developer working in a monorepo,
**I want** config caching to correctly handle per-project configs,
**So that** switching projects doesn't serve stale cached configs.

---

## 5. Constraints

- Hooks run as independent Node.js processes — no shared memory between invocations.
- `writeState()` read-before-write cannot be eliminated (required for optimistic locking across processes).
- Config cache is per-process only (not persistent across invocations) — but still saves multiple reads within a single dispatcher run.
- Must maintain `.cjs` extension (CommonJS, Node 24+ compatible).

---

## 6. Out of Scope

- Cross-process caching (shared memory, IPC) — too complex for the benefit.
- Changing the hook execution model (e.g., long-lived daemon) — architectural change beyond T6.
- Reducing the number of hooks or dispatcher invocations — separate optimization (T1 already addressed this).
- Agent prompt optimization — separate backlog item (T7 / 2.3).

---

## 7. Traceability

| FR | ACs | Backlog Sub-Task | Files Affected |
|----|-----|-----------------|----------------|
| FR-001 | AC-001a..e | T6-A | common.cjs |
| FR-002 | AC-002a..c | T6-C | common.cjs |
| FR-003 | AC-003a..d | T6-D | state-write-validator.cjs |
| FR-004 | AC-004a..d | T6-A (follow-through) | gate-blocker, iteration-corridor, constitution-validator, test-watcher |
| FR-005 | AC-005a..d | T6-B (revised) | all 5 dispatchers |
