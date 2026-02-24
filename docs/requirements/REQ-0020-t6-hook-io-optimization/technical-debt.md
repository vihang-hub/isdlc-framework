# Technical Debt Assessment: REQ-0020 T6 Hook I/O Optimization

**Date**: 2026-02-16
**Phase**: 08-code-review

---

## 1. Debt Introduced

### TD-001: Duplicate JSDoc Blocks (Cosmetic)

**Location**: `src/claude/hooks/state-write-validator.cjs` lines 99-111 and 220-233
**Severity**: Low (cosmetic)
**Description**: Both `checkVersionLock()` and `checkPhaseFieldProtection()` have two consecutive JSDoc comment blocks -- the original (without `diskState` parameter) and the new one (with `diskState`). The old blocks were left in place rather than replaced.
**Impact**: Confuses future readers; no functional impact.
**Remediation**: Merge the two JSDoc blocks into one for each function.
**Estimated Effort**: 5 minutes.

---

## 2. Debt Reduced

### TD-R01: Redundant Config File Reads (RESOLVED)

**Before**: `loadManifest()`, `loadIterationRequirements()`, and `loadWorkflowDefinitions()` each performed a full `fs.readFileSync` + `JSON.parse` on every call. In a typical dispatcher run with 3-5 sub-hooks, this resulted in 9-15 redundant file reads per tool invocation.
**After**: `_loadConfigWithCache()` ensures each config file is read at most once per process, with mtime invalidation for correctness.
**Reduction**: 70-85% fewer config file reads.

### TD-R02: Redundant getProjectRoot() Traversals (RESOLVED)

**Before**: `getProjectRoot()` traversed the filesystem on every call (unless `CLAUDE_PROJECT_DIR` was set). With 5-10 calls per dispatcher invocation, this added significant overhead.
**After**: Per-process caching with env-var change detection. One traversal per process.
**Reduction**: 80-90% fewer filesystem traversals.

### TD-R03: Duplicate Disk Reads in state-write-validator (RESOLVED)

**Before**: V7 (version lock) and V8 (phase field protection) each independently read the disk state file using `fs.readFileSync`. For Write events, the disk was read 2-3 times.
**After**: `check()` reads disk state once and passes the parsed object to both V7 and V8. V1-V3 parse from incoming content.
**Reduction**: 50-67% fewer state file reads.

### TD-R04: Redundant loadManifest() in gate-blocker (RESOLVED)

**Before**: `checkAgentDelegationRequirement()` called `loadManifest()` internally even when running inside a dispatcher that had already loaded the manifest.
**After**: Accepts manifest as optional parameter, falling back to `loadManifest()` for standalone mode.
**Reduction**: 1 fewer manifest read per gate-blocker invocation in dispatcher mode.

---

## 3. Pre-Existing Debt (Unchanged)

### TD-PRE-01: Schema Cache Lacks mtime Invalidation

**Location**: `src/claude/hooks/lib/common.cjs` lines 1325-1362, `_schemaCache` Map
**Description**: The `loadSchema()` function caches schemas forever once loaded (no mtime check). This pre-dates REQ-0020 and was not part of its scope.
**Risk**: Low. Schema files are framework constants that do not change during a session.
**Recommendation**: If schema files ever become user-configurable, add mtime invalidation similar to `_loadConfigWithCache()`.

### TD-PRE-02: gate-blocker.cjs Local Config Loaders

**Location**: `src/claude/hooks/gate-blocker.cjs` lines 35-76
**Description**: `gate-blocker.cjs` has local `loadIterationRequirements()` and `loadWorkflowDefinitions()` functions that duplicate logic from `common.cjs`. These exist as fallbacks but use raw `fs.readFileSync` without caching.
**Risk**: Low. The dispatcher path uses `ctx.requirements` / `ctx.workflows` from cached sources. The local loaders are only used in standalone mode (which is rare in production).
**Recommendation**: In a future consolidation, these local loaders could delegate to `common.loadIterationRequirements()` and `common.loadWorkflowDefinitions()`, inheriting caching benefits.

---

## 4. Summary

| Category | Count | Severity |
|----------|-------|----------|
| Debt introduced | 1 | Low (cosmetic) |
| Debt reduced | 4 | Significant I/O reduction |
| Pre-existing (unchanged) | 2 | Low |
| **Net debt delta** | **-3** | **Positive (debt reduced)** |
