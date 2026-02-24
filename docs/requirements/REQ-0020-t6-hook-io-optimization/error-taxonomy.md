# Error Taxonomy: T6 Hook I/O Optimization

**REQ-0020** | Phase 04 - Design | 2026-02-16

---

## 1. Scope

This error taxonomy covers error conditions introduced or modified by the T6 optimization. All errors follow the existing fail-open contract (Article X): errors result in graceful degradation, never blocking the user's workflow.

There are no new user-facing error codes or HTTP status codes. All errors are internal to hook execution and are logged to stderr (debug mode only) or hook-activity.log.

---

## 2. Cache Error Conditions (FR-001, FR-002)

### 2.1 Config Cache Errors

| Error ID | Condition | Source | Behavior | Log Output (debug mode) |
|----------|-----------|--------|----------|------------------------|
| CACHE-001 | `fs.statSync(configPath)` throws ENOENT | `_loadConfigWithCache()` | Return null (file does not exist). Do NOT cache null. | `Config cache ERROR: {configName} -- ENOENT` |
| CACHE-002 | `fs.statSync(configPath)` throws EACCES | `_loadConfigWithCache()` | Return null (permission denied). Do NOT cache null. | `Config cache ERROR: {configName} -- EACCES` |
| CACHE-003 | `fs.readFileSync(configPath)` throws | `_loadConfigWithCache()` | Return null. Do NOT cache null. Existing cache entry (if any) is NOT cleared. | `Config cache ERROR: {configName} -- {error.message}` |
| CACHE-004 | `JSON.parse()` throws SyntaxError | `_loadConfigWithCache()` | Return null. Do NOT cache null. Existing cache entry (if any) is NOT cleared. | `Config cache ERROR: {configName} -- Unexpected token...` |
| CACHE-005 | Cache hit: mtime matches | `_loadConfigWithCache()` | Return cached data. No disk read. | `Config cache HIT: {configName}` |
| CACHE-006 | Cache miss: first load | `_loadConfigWithCache()` | Read from disk, parse, cache, return. | `Config cache MISS: {configName} (first load)` |
| CACHE-007 | Cache miss: mtime changed | `_loadConfigWithCache()` | Re-read from disk, parse, update cache, return. | `Config cache MISS: {configName} (mtime changed)` |

### 2.2 Project Root Cache Errors

| Error ID | Condition | Source | Behavior | Log Output |
|----------|-----------|--------|----------|------------|
| ROOT-001 | `CLAUDE_PROJECT_DIR` set | `getProjectRoot()` | Return env var, cache it. No filesystem traversal. | (none -- existing behavior) |
| ROOT-002 | Traversal finds `.isdlc` directory | `getProjectRoot()` | Return found dir, cache it. | (none -- existing behavior) |
| ROOT-003 | Traversal reaches filesystem root without finding `.isdlc` | `getProjectRoot()` | Return `process.cwd()`, cache it. | (none -- existing behavior) |

Note: All ROOT-* conditions are existing behaviors. The only change is that the result is now cached in `_cachedProjectRoot` for subsequent calls.

---

## 3. State Read Consolidation Errors (FR-003)

### 3.1 Disk State Read Errors

| Error ID | Condition | Source | Behavior | Log Output |
|----------|-----------|--------|----------|------------|
| DISK-001 | `fs.existsSync(filePath)` returns false | `check()` in state-write-validator | `diskState = null`. V7 and V8 receive null, both fail-open (allow write). | `Could not read disk state for V7/V8: file does not exist` |
| DISK-002 | `fs.readFileSync(filePath)` throws | `check()` in state-write-validator | `diskState = null`. Same fail-open. | `Could not read disk state for V7/V8: {error.message}` |
| DISK-003 | `JSON.parse()` throws (corrupt state.json) | `check()` in state-write-validator | `diskState = null`. Same fail-open. | `Could not read disk state for V7/V8: Unexpected token...` |
| DISK-004 | Parsed value is not an object (e.g., null, number) | `check()` in state-write-validator | `diskState = null`. Same fail-open. | (none -- guard prevents assignment) |

### 3.2 V7 Version Lock with diskState Parameter

| Error ID | Condition | Source | Behavior |
|----------|-----------|--------|----------|
| V7-NULL | `diskState` is null | `checkVersionLock()` | Return null (allow). No disk file to compare. First write scenario. |
| V7-TYPE | `diskState` is not an object | `checkVersionLock()` | Return null (allow). Type guard catches non-object values. |
| V7-NOVERSION | `diskState.state_version` undefined | `checkVersionLock()` | Return null (allow). Migration case -- disk has no version. |

### 3.3 V8 Phase Protection with diskState Parameter

| Error ID | Condition | Source | Behavior |
|----------|-----------|--------|----------|
| V8-NULL | `diskState` is null | `checkPhaseFieldProtection()` | Return null (allow). |
| V8-TYPE | `diskState` is not an object | `checkPhaseFieldProtection()` | Return null (allow). |
| V8-NOAW | `diskState.active_workflow` missing | `checkPhaseFieldProtection()` | Return null (allow). Workflow init scenario. |

### 3.4 V1-V3 Content Source Change

| Error ID | Condition | Source | Behavior |
|----------|-----------|--------|----------|
| V1V3-WRITE | Write event: incoming content parsed from `toolInput.content` | `check()` | Parse once, validate phases. If unparseable, allow. |
| V1V3-EDIT | Edit event: read from disk (post-edit state) | `check()` | Single disk read (separate from V7/V8 disk read, which is pre-write). If unreadable, allow. |
| V1V3-EMPTY | `toolInput.content` is empty or not a string (Write) | `check()` | Return allow. Nothing to validate. |

---

## 4. Context Passthrough Errors (FR-004)

| Error ID | Condition | Source | Behavior |
|----------|-----------|--------|----------|
| CTX-001 | `ctx.manifest` is undefined/null (dispatcher did not populate) | `checkAgentDelegationRequirement()` | Falls back to `loadManifest()`. Standalone mode. |
| CTX-002 | `manifest` parameter is provided but empty object `{}` | `checkAgentDelegationRequirement()` | `resolvedManifest.ownership` is falsy. Returns `{ satisfied: true, reason: 'no_manifest' }`. |
| CTX-003 | `ctx.requirements` is undefined (standalone sub-hook) | sub-hook `check()` | Falls back to `loadIterationRequirementsFromCommon() \|\| loadIterationRequirements()`. Existing fallback chain preserved. |

---

## 5. Error Handling Principles

1. **Fail-open**: Every error path returns null (for sub-checks) or `{ decision: 'allow' }` (for `check()`). Cache errors return null.
2. **No throw propagation**: All errors are caught within try/catch blocks. No error escapes to the caller.
3. **Debug-only logging**: Cache hit/miss and error messages use `debugLog()`, which only writes to stderr when `ISDLC_DEBUG=1` is set.
4. **No user-visible changes**: The existing stderr warning format for V7/V8 blocks is unchanged. No new user-facing error messages.

---

## 6. Traceability

| Error Category | FR | AC | Article |
|---------------|----|----|---------|
| CACHE-001..007 | FR-001 | AC-001a,b,c,d | Article X (Fail-Safe Defaults) |
| ROOT-001..003 | FR-002 | AC-002a,b,c | Article X |
| DISK-001..004 | FR-003 | AC-003a,d | Article X, Article XIV |
| V7-NULL..NOVERSION | FR-003 | AC-003b,d | Article X |
| V8-NULL..NOAW | FR-003 | AC-003b,d | Article X |
| V1V3-WRITE..EMPTY | FR-003 | AC-003c | Article X |
| CTX-001..003 | FR-004 | AC-004b | Article X, NFR-002 |
