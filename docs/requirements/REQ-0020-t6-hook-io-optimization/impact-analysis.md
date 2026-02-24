# Impact Analysis: T6 Hook I/O Optimization

**Generated**: 2026-02-16T21:00:00.000Z
**Feature**: Reduce redundant disk I/O in hook dispatchers by caching config files, consolidating state reads, and eliminating repeated filesystem traversals
**Based On**: Phase 01 Requirements (finalized)
**Phase**: 02-impact-analysis

---

## Scope Comparison

| Aspect | Original (Phase 00) | Clarified (Phase 01) |
|--------|---------------------|----------------------|
| Description | Reduce redundant disk I/O in hook dispatchers | Reduce redundant disk I/O via config caching, getProjectRoot caching, state read consolidation, sub-hook config passthrough, writeState batching |
| Keywords | getProjectRoot, readFileSync, loadManifest, writeState, readState | config cache, mtime invalidation, per-process cache, state consolidation, ctx passthrough, batch write |
| Estimated Files | 12 | 12 (confirmed) |
| Scope Change | - | REFINED (T6-B revised to batch optimization; FR-004 added for sub-hook passthrough) |

---

## Executive Summary

The T6 Hook I/O Optimization targets 12 files across 2 modules (`hooks/`, `hooks/lib/`) with changes concentrated in `common.cjs` (the shared utility library) and the 5 dispatcher files. The blast radius is **low-medium** because all changes are internal performance optimizations with no behavioral changes to the hook protocol. The primary risk is backward compatibility -- sub-hooks must continue working in standalone mode (outside dispatchers) while benefiting from ctx-based config passthrough when running inside dispatchers. The state-write-validator has a self-contained optimization opportunity (FR-003) with 3 redundant disk reads that can be consolidated to 1. Test coverage is strong across all affected files (600+ tests covering the 12 files), reducing regression risk.

**Blast Radius**: LOW-MEDIUM (12 files, 2 modules, all internal)
**Risk Level**: LOW (pure performance optimization, no behavioral change, strong test coverage)
**Affected Files**: 12
**Affected Modules**: 2 (`src/claude/hooks/`, `src/claude/hooks/lib/`)

---

## Impact Analysis

### FR-001: Config File Caching (common.cjs)

**Directly Affected**: `src/claude/hooks/lib/common.cjs`

| Function | Current Behavior | Change Required |
|----------|-----------------|-----------------|
| `loadManifest()` (line 757) | Reads `skills-manifest.json` from disk every call | Add mtime-based cache; return cached copy if mtime unchanged |
| `loadIterationRequirements()` (line 1989) | Reads `iteration-requirements.json` from disk every call | Add mtime-based cache; return cached copy if mtime unchanged |
| `loadWorkflowDefinitions()` (line 2017) | Reads `workflows.json` from disk every call | Add mtime-based cache; return cached copy if mtime unchanged |
| `getManifestPath()` (line 735) | Calls `getProjectRoot()` + 2x `existsSync` | Cache resolved path alongside manifest content |

**Outward Dependencies** (callers of these functions):
- All 5 dispatchers call all 3 loaders at startup
- `getSkillOwner()` (line 775) calls `loadManifest()` internally
- `getAgentPhase()` (line 788) calls `loadManifest()` internally
- `detectPhaseDelegation()` scans manifest ownership map
- gate-blocker `checkAgentDelegationRequirement()` (line 369) calls `loadManifest()`

**Inward Dependencies**: `fs.readFileSync`, `fs.existsSync`, `fs.statSync` (new for mtime)

**Cache Invalidation Scenarios**:
- Same process, same file mtime: cache hit (expected common case)
- Same process, file modified externally: mtime check detects change, re-read
- Different project root (monorepo AC-001e): per-root cache key needed
- File does not exist (AC-001d): return null, do not cache

### FR-002: getProjectRoot() Per-Process Caching (common.cjs)

**Directly Affected**: `src/claude/hooks/lib/common.cjs` -- function at line 69

**Current I/O Cost**: 33 calls across 7 files (21 in common.cjs alone). Each call without `CLAUDE_PROJECT_DIR` performs:
- `process.cwd()` (cheap)
- Upward directory traversal with `fs.existsSync()` at each level (expensive)

**Propagation**: getProjectRoot() is called by 20 other functions in common.cjs:
- `isMonorepoMode()`, `readMonorepoConfig()`, `writeMonorepoConfig()`, `resolveProjectFromCwd()`
- `resolveStatePath()`, `resolveConstitutionPath()`, `resolveDocsPath()`, `resolveExternalSkillsPath()`
- `resolveExternalManifestPath()`, `resolveSkillReportPath()`, `resolveTasksPath()`
- `resolveTestEvaluationPath()`, `resolveAtddChecklistPath()`, `resolveIsdlcDocsPath()`
- `isMigrationNeeded()`, `loadExternalManifest()`, `getManifestPath()`
- `loadIterationRequirements()`, `loadWorkflowDefinitions()`, `logHookEvent()`

**Change**: Add module-level `let _cachedProjectRoot = null;` and return cached value after first resolution. When `CLAUDE_PROJECT_DIR` is set, the env var path is returned immediately (existing behavior, already optimal).

### FR-003: State Read Consolidation in state-write-validator

**Directly Affected**: `src/claude/hooks/state-write-validator.cjs`

**Current Disk Reads** (for a single Write event targeting state.json):
1. **V7** `checkVersionLock()` line 140-143: `existsSync` + `readFileSync` + `JSON.parse`
2. **V8** `checkPhaseFieldProtection()` line 262-265: `existsSync` + `readFileSync` + `JSON.parse`
3. **V1-V3** `check()` line 395: `readFileSync` + `JSON.parse`

Total: 3 `existsSync` + 3 `readFileSync` + 3 `JSON.parse` for the SAME file.

**Change**: Read disk state once at the top of `check()`, pass the parsed object to `checkVersionLock()` and `checkPhaseFieldProtection()` as a parameter.

**No Outward Dependencies**: This change is fully self-contained within state-write-validator.cjs. The `check(ctx)` signature does not change.

### FR-004: Sub-Hook Config Passthrough

**Directly Affected** (4 sub-hooks):

| File | Current Pattern | Lines Affected |
|------|----------------|----------------|
| `gate-blocker.cjs` | `loadManifest()` at line 369 (inside `checkAgentDelegationRequirement`) | Needs ctx.manifest passed as parameter |
| `iteration-corridor.cjs` | `ctx.requirements \|\| loadIterationRequirementsFromCommon() \|\| loadIterationRequirements()` at line 276 | Already uses ctx fallback pattern -- optimization is ensuring ctx.requirements is always populated |
| `constitution-validator.cjs` | `ctx.requirements \|\| loadIterationRequirementsFromCommon() \|\| loadIterationRequirements()` at line 274 | Same as above |
| `test-watcher.cjs` | `ctx.requirements \|\| loadIterationRequirementsFromCommon() \|\| loadIterationRequirements()` at line 448 | Same as above |

**Key Finding**: iteration-corridor, constitution-validator, and test-watcher already have the `ctx.requirements || fallback` pattern. The optimization is:
1. Ensuring dispatchers always populate `ctx.requirements` (already done in all 5 dispatchers)
2. Fixing gate-blocker line 369 which bypasses ctx and calls `loadManifest()` directly

**Backward Compatibility**: All 4 sub-hooks have standalone mode sections (triggered by `require.main === module`) that build their own ctx with fresh config loads. This must be preserved.

### FR-005: writeState() Batch Optimization

**Directly Affected**: All 5 dispatchers

**Current Pattern** (per dispatcher):

| Dispatcher | writeState Calls | Scenario |
|------------|-----------------|----------|
| `pre-task-dispatcher.cjs` | 2 max (line 162 on block, line 180 at end) | Already batched -- only writes if stateModified |
| `pre-skill-dispatcher.cjs` | 2 max (line 90 on block, line 108 at end) | Already batched |
| `post-task-dispatcher.cjs` | 1 (line 111 at end) | Already batched |
| `post-bash-dispatcher.cjs` | 1 (line 100 at end) | Already batched |
| `post-write-edit-dispatcher.cjs` | 0 (hooks manage own I/O) | No change needed |

**Key Finding**: The dispatchers already implement a batch-write pattern. The `writeState(state)` call happens at most once per dispatcher (or twice in pre-* dispatchers: once on block, once at end -- but only one path executes per invocation). The writeState function's internal read-before-write (for optimistic locking) cannot be eliminated.

**Remaining Optimization**: The `writeState()` function reads disk state to get `state_version` before writing. This is 1 read per write call. Since dispatchers already call `writeState` at most once, the optimization here is minimal. The real savings come from ensuring sub-hooks that call `writeState` indirectly (e.g., `writePendingEscalation`, `appendSkillLog`) do not trigger extra writes during the dispatcher run.

**Special Case**: `workflow-completion-enforcer.cjs` in post-write-edit-dispatcher manages its own state I/O and returns `stateModified: false`. This contract must not change.

---

## Entry Points

### Recommended Implementation Order

| Order | Target | FR | Rationale |
|-------|--------|-----|-----------|
| 1 | `common.cjs`: getProjectRoot() caching | FR-002 | Smallest change, largest cascade benefit (33 calls cached). No API change. |
| 2 | `common.cjs`: Config file caching | FR-001 | Builds on FR-002 (getProjectRoot used by config loaders). 3 functions to cache. |
| 3 | `state-write-validator.cjs`: State read consolidation | FR-003 | Self-contained, no outward impact. Reduces 3 disk reads to 1. |
| 4 | `gate-blocker.cjs`: ctx.manifest passthrough | FR-004 | Single line change (369). Test with existing 54-test suite. |
| 5 | All dispatchers: Verify batch write pattern | FR-005 | Confirm existing pattern is correct. Minimal code change needed. |

### Entry Point Map

```
common.cjs (epicenter)
  |
  +-- getProjectRoot()  [FR-002: add per-process cache]
  |     |
  |     +-- 20 internal callers (resolve*, load*, isMonorepo*, etc.)
  |     +-- 12 external callers (6 sub-hooks, 5 dispatchers + provider-utils)
  |
  +-- loadManifest()  [FR-001: add mtime cache]
  |     |
  |     +-- getSkillOwner()
  |     +-- getAgentPhase()
  |     +-- detectPhaseDelegation()
  |     +-- gate-blocker.cjs:369 (direct call - FR-004 target)
  |
  +-- loadIterationRequirements()  [FR-001: add mtime cache]
  |     |
  |     +-- iteration-corridor.cjs:276 (ctx fallback)
  |     +-- constitution-validator.cjs:274 (ctx fallback)
  |     +-- test-watcher.cjs:448 (ctx fallback)
  |
  +-- loadWorkflowDefinitions()  [FR-001: add mtime cache]
  |
  +-- writeState()  [FR-005: no change needed to function itself]

state-write-validator.cjs (isolated)
  |
  +-- check()  [FR-003: read disk once, pass to V7/V8/V1-V3]
  |     |
  |     +-- checkVersionLock()  [receive diskState parameter]
  |     +-- checkPhaseFieldProtection()  [receive diskState parameter]
  |     +-- validatePhase()  [no change, uses parsed content]

dispatchers/ (5 files, uniform pattern)
  |
  +-- pre-task-dispatcher.cjs     [FR-005: already batched]
  +-- pre-skill-dispatcher.cjs    [FR-005: already batched]
  +-- post-task-dispatcher.cjs    [FR-005: already batched]
  +-- post-bash-dispatcher.cjs    [FR-005: already batched]
  +-- post-write-edit-dispatcher.cjs [FR-005: no writeState call]
```

---

## Risk Assessment

### Test Coverage Summary

| File | Tests | Coverage Level | Risk |
|------|-------|---------------|------|
| `common.cjs` | 195 | HIGH | LOW -- well-tested utility functions |
| `state-write-validator.cjs` | 73 | HIGH | LOW -- thorough V1-V8 rule testing |
| `pre-task-dispatcher.cjs` | 16 | MODERATE | LOW -- dispatcher integration tests |
| `pre-skill-dispatcher.cjs` | 14 | MODERATE | LOW -- dispatcher integration tests |
| `post-task-dispatcher.cjs` | 15 | MODERATE | LOW -- dispatcher integration tests |
| `post-bash-dispatcher.cjs` | 15 | MODERATE | LOW -- dispatcher integration tests |
| `post-write-edit-dispatcher.cjs` | 16 | MODERATE | LOW -- dispatcher integration tests |
| `gate-blocker.cjs` | 54 | HIGH | LOW -- ctx.manifest change at line 369 |
| `iteration-corridor.cjs` | 33 | HIGH | MINIMAL -- already uses ctx fallback |
| `constitution-validator.cjs` | 33 | HIGH | MINIMAL -- already uses ctx fallback |
| `test-watcher.cjs` | 70 | HIGH | MINIMAL -- already uses ctx fallback |
| `blast-radius-validator.cjs` | 66 | HIGH | MINIMAL -- standalone mode only loads configs |
| **TOTAL** | **600+** | | |

### Risk Zones

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Cache serving stale config** | MEDIUM | mtime-based invalidation (AC-001b/c). Test with file modification between calls. |
| **Monorepo cache pollution** | MEDIUM | Per-project-root cache key (AC-001e). Test with different project roots. |
| **Standalone mode regression** | LOW | Sub-hooks already have `ctx.X \|\| fallback` pattern. Keep fallback path. |
| **writeState optimistic locking break** | HIGH (impact) / LOW (probability) | writeState read-before-write is NOT being changed. NFR-003 preserved. |
| **state-write-validator test isolation** | LOW | state-write-validator.test.cjs uses spawnSync (own process). Must test consolidated reads. |
| **Performance regression** | LOW | `fs.statSync` for mtime adds ~0.5ms per cache check vs ~5ms for full read+parse. Net positive. |

### Technical Debt Markers in Affected Files

| File | Debt | Impact on T6 |
|------|------|-------------|
| `common.cjs` | 21 getProjectRoot calls (no caching) | FR-002 resolves this |
| `gate-blocker.cjs` | Direct `loadManifest()` at line 369 bypasses ctx | FR-004 resolves this |
| `state-write-validator.cjs` | 3 redundant disk reads | FR-003 resolves this |
| `gate-blocker.cjs` | Local `loadIterationRequirements()` function (line 35) duplicating common.cjs | Not in scope, but FR-004 reduces its usage |
| `iteration-corridor.cjs` | Local `loadIterationRequirements()` function (line 83) | Same as above |

### NFR Compliance Check

| NFR | Status | Notes |
|-----|--------|-------|
| NFR-001 (Performance) | ON TRACK | Config reads drop from 3-6 to 1 (cached), getProjectRoot from 33 to 1, state reads from 3 to 1 |
| NFR-002 (Backward Compat) | ON TRACK | ctx fallback pattern preserves standalone mode. check(ctx) signature unchanged. |
| NFR-003 (Correctness) | ON TRACK | writeState read-before-write preserved. mtime-based invalidation prevents stale cache. |
| NFR-004 (Observability) | ON TRACK | debugLog for cache hit/miss. Existing console.time instrumentation in dispatchers. |

---

## Implementation Recommendations

Based on the impact analysis:

1. **Suggested Order**: FR-002 (getProjectRoot cache) -> FR-001 (config cache) -> FR-003 (state-write-validator) -> FR-004 (ctx passthrough) -> FR-005 (verify batch pattern)
2. **High-Risk Areas**: None critical. Gate-blocker line 369 is the only "bypass" of the ctx pattern -- fix with parameter injection or ctx reference.
3. **Dependencies to Resolve**:
   - FR-001 depends on FR-002 (config loaders call getProjectRoot)
   - FR-004 depends on FR-001 (ctx.manifest populated from cached loader)
   - FR-003 is independent (self-contained in state-write-validator)
   - FR-005 is largely a verification task (dispatchers already batch writes)
4. **Test Strategy Hint**: Focus new tests on cache invalidation (mtime change, file deletion, monorepo root switch). Existing 600+ tests provide regression coverage.
5. **Key Constraint**: Hooks run as independent Node.js processes. Per-process caching only saves reads within a single dispatcher invocation (multiple sub-hooks calling the same loader). This is still valuable -- each dispatcher runs 3-9 sub-hooks in a single process.

---

## Impact Analysis Metadata

```json
{
  "analysis_completed_at": "2026-02-16T21:00:00.000Z",
  "sub_agents": ["M1-impact-analyzer", "M2-entry-point-finder", "M3-risk-assessor"],
  "requirements_document": "docs/requirements/REQ-0020-t6-hook-io-optimization/requirements.md",
  "quick_scan_used": "docs/requirements/REQ-0020-t6-hook-io-optimization/quick-scan.md",
  "scope_change_from_original": "refined",
  "requirements_keywords": ["config cache", "mtime", "getProjectRoot", "state consolidation", "ctx passthrough", "batch write", "dispatcher", "sub-hook"],
  "files_analyzed": 12,
  "total_tests_in_affected_files": 600,
  "blast_radius": "low-medium",
  "risk_level": "low"
}
```
