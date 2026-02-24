# Component Specifications: T6 Hook I/O Optimization

**REQ-0020** | Phase 04 - Design | 2026-02-16

---

## 1. Overview

This feature modifies 3 existing files and adds 0 new files. There are no new modules, no new components, no UI, and no external integrations. This document specifies the reusable internal components that are being modified.

---

## 2. Component: Config Cache (_loadConfigWithCache)

### 2.1 Purpose
Centralized mtime-based config file caching for all JSON config loaders in common.cjs.

### 2.2 Interface

```javascript
/**
 * @param {string} configPath - Absolute path to JSON config file
 * @param {string} configName - Short identifier for cache key
 * @returns {object|null} Parsed JSON or null on any error
 * @private - Not exported, internal to common.cjs
 */
function _loadConfigWithCache(configPath, configName)
```

### 2.3 State

| Variable | Type | Scope | Lifetime | Reset |
|----------|------|-------|----------|-------|
| `_cachedProjectRoot` | `string\|null` | Module-level | Process | On process exit (automatic) |
| `_configCache` | `Map<string, {mtimeMs: number, data: object}>` | Module-level | Process | On process exit (automatic) |

### 2.4 Behavior Table

| Input State | Action | Output | Cache Side Effect |
|-------------|--------|--------|-------------------|
| Cache miss, file exists | statSync + readFileSync + JSON.parse | Parsed data | Set cache entry |
| Cache hit, mtime unchanged | statSync only | Cached data | None |
| Cache hit, mtime changed | statSync + readFileSync + JSON.parse | New parsed data | Update cache entry |
| File does not exist | statSync throws ENOENT | null | No entry added |
| File unreadable | readFileSync throws | null | No entry added |
| File contains invalid JSON | JSON.parse throws | null | No entry added |

### 2.5 Consumers

| Consumer Function | Config Name | Call Frequency |
|-------------------|-------------|----------------|
| `loadManifest()` | `'skills-manifest'` | 1-3 per dispatcher |
| `loadIterationRequirements()` | `'iteration-requirements'` | 1-2 per dispatcher |
| `loadWorkflowDefinitions()` | `'workflows'` | 1 per dispatcher |
| `getSkillOwner()` (via loadManifest) | `'skills-manifest'` | 0-5 per dispatcher |
| `getAgentPhase()` (via loadManifest) | `'skills-manifest'` | 0-3 per dispatcher |

---

## 3. Component: Project Root Cache

### 3.1 Purpose
Eliminate repeated filesystem traversals for project root resolution.

### 3.2 Interface

```javascript
// Existing function, unchanged signature
function getProjectRoot(): string
```

### 3.3 Behavior Change

| Call # | Before | After |
|--------|--------|-------|
| 1st | Traverse filesystem or read env var | Same + cache result in _cachedProjectRoot |
| 2nd+ | Traverse filesystem or read env var (again) | Return _cachedProjectRoot immediately |

### 3.4 Invariant
Within a single process, `getProjectRoot()` always returns the same value. This was already true in practice (the filesystem does not change during hook execution), but is now enforced by caching.

---

## 4. Component: diskState Parameter Pattern

### 4.1 Purpose
Share a single disk state read across V7 and V8 validation rules in state-write-validator.

### 4.2 Pattern

```
check(ctx)
  |-- Read disk state ONCE --> diskState (object|null)
  |-- checkVersionLock(filePath, toolInput, toolName, diskState)
  |-- checkPhaseFieldProtection(filePath, toolInput, toolName, diskState)
  |-- (V1-V3 use toolInput.content, not diskState)
```

### 4.3 Null Handling Contract

When `diskState` is null (file missing, corrupt, or unreadable):
- `checkVersionLock` returns null (allow)
- `checkPhaseFieldProtection` returns null (allow)

This preserves the existing fail-open behavior where each function independently handled read errors.

---

## 5. Component: Manifest Passthrough Pattern

### 5.1 Purpose
Eliminate the direct `loadManifest()` call in `gate-blocker.cjs:checkAgentDelegationRequirement()`.

### 5.2 Pattern

```javascript
// In gate-blocker check():
const manifest = ctx.manifest || null;
const result = checkAgentDelegationRequirement(phaseState, phaseReq, state, currentPhase, manifest);

// In checkAgentDelegationRequirement:
function checkAgentDelegationRequirement(phaseState, phaseRequirements, state, currentPhase, manifest) {
    const resolvedManifest = manifest || loadManifest();
    // ...
}
```

### 5.3 Backward Compatibility

| Mode | ctx.manifest | manifest param | Behavior |
|------|-------------|----------------|----------|
| Dispatcher (normal) | Populated by dispatcher | Passed from ctx | Uses ctx.manifest, no disk read |
| Standalone (debug) | Loaded in standalone entrypoint | Passed from ctx | Uses loaded manifest, no extra read |
| Standalone (no ctx) | undefined | undefined/null | Falls back to loadManifest() |

---

## 6. Test-Only Components

### 6.1 _resetCaches()

```javascript
/**
 * Reset all module-level caches. Test use only.
 * Available when NODE_ENV=test or ISDLC_TEST_MODE=1.
 * @private
 */
function _resetCaches()
```

### 6.2 _getCacheStats()

```javascript
/**
 * Get cache state snapshot. Test use only.
 * Available when NODE_ENV=test or ISDLC_TEST_MODE=1.
 * @private
 * @returns {{ projectRootCached: boolean, configCacheSize: number }}
 */
function _getCacheStats()
```

These are conditionally exported for test isolation. They allow tests to reset cache state between test cases and verify cache behavior.

---

## 7. Files Modified Summary

| File | Change Type | LOC Estimate | FR |
|------|-----------|-------------|-----|
| `src/claude/hooks/lib/common.cjs` | Add cache variables, modify 4 functions, add 3 helpers | +60, -20 | FR-001, FR-002 |
| `src/claude/hooks/state-write-validator.cjs` | Modify 3 functions (check, checkVersionLock, checkPhaseFieldProtection) | +25, -35 | FR-003 |
| `src/claude/hooks/gate-blocker.cjs` | Modify 1 function signature + 1 call site | +5, -2 | FR-004 |

**Total estimated changes**: +90 lines added, -57 lines removed (net +33 lines)
