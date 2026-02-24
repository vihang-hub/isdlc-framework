# Test Case Specifications: T6 Hook I/O Optimization

**REQ-0020** | Phase 05 - Test Strategy | 2026-02-16

Test file: `src/claude/hooks/tests/test-io-optimization.test.cjs` (new)
Extended files: `state-write-validator.test.cjs`, `test-gate-blocker-extended.test.cjs`

---

## FR-001: Config File Caching (11 unit tests)

### AC-001a: First load reads from disk (cache miss)

**TC-001a-01: loadManifest first call reads from disk**
- **Given**: A fresh process (caches reset via `_resetCaches()`)
- **When**: `loadManifest()` is called for the first time
- **Then**: A valid manifest object is returned (non-null)
- **And**: `_getCacheStats().configCacheSize` equals 1 (entry cached)
- **Verify**: The returned object has expected keys (`skill_lookup`, `ownership`)

**TC-001a-02: loadManifest second call returns cached copy**
- **Given**: `loadManifest()` has been called once (cache populated)
- **When**: `loadManifest()` is called a second time
- **Then**: The same object is returned (strict reference equality via `===`)
- **And**: `_getCacheStats().configCacheSize` still equals 1 (no new entry)

**TC-001a-03: loadIterationRequirements first call caches result**
- **Given**: A fresh process (caches reset)
- **When**: `loadIterationRequirements()` is called
- **Then**: A valid config object is returned (non-null)
- **And**: `_getCacheStats().configCacheSize` includes an entry for iteration-requirements

**TC-001a-04: loadWorkflowDefinitions first call caches result**
- **Given**: A fresh process (caches reset)
- **And**: A `workflows.json` file exists in the config directory
- **When**: `loadWorkflowDefinitions()` is called
- **Then**: A valid config object is returned (non-null)
- **And**: `_getCacheStats().configCacheSize` increases by 1

### AC-001b: Cache invalidation on mtime change

**TC-001b-01: Config re-read after file modification**
- **Given**: `loadManifest()` has been called once (cache populated)
- **And**: The `skills-manifest.json` file is modified on disk (content changed)
- **And**: The file's mtime has changed (verified via `fs.statSync`)
- **When**: `loadManifest()` is called again
- **Then**: The new content is returned (not the previously cached value)
- **And**: `_getCacheStats().configCacheSize` still equals 1 (replaced, not added)

**TC-001b-02: Touch file without content change triggers re-read**
- **Given**: `loadManifest()` has been called once
- **And**: The file is touched (mtime updated via `fs.utimesSync`) without changing content
- **When**: `loadManifest()` is called again
- **Then**: The file is re-read from disk (cache miss due to mtime change)
- **And**: The returned data is identical in content (deep equal) but is a fresh parse

### AC-001c: Cache hit when mtime unchanged

**TC-001c-01: Repeated calls without file changes return cached object**
- **Given**: `loadManifest()` has been called once
- **And**: No file modifications have occurred
- **When**: `loadManifest()` is called 5 more times
- **Then**: All calls return the exact same object reference (`===`)
- **And**: `_getCacheStats().configCacheSize` equals 1 (no growth)

### AC-001d: Missing file returns null, not cached

**TC-001d-01: loadManifest returns null when manifest file missing**
- **Given**: A fresh process (caches reset)
- **And**: `skills-manifest.json` does not exist in any config path
- **When**: `loadManifest()` is called
- **Then**: `null` is returned
- **And**: `_getCacheStats().configCacheSize` equals 0 (failure not cached)

**TC-001d-02: Missing file null result is retried on next call**
- **Given**: `loadManifest()` returned null (file missing)
- **And**: The file is then created on disk with valid JSON
- **When**: `loadManifest()` is called again
- **Then**: The valid manifest object is returned (not null)
- **And**: `_getCacheStats().configCacheSize` equals 1 (now cached)

**TC-001d-03: Corrupt JSON returns null, not cached**
- **Given**: A config file exists but contains invalid JSON (`{invalid:}`)
- **When**: `_loadConfigWithCache()` is called for that file
- **Then**: `null` is returned
- **And**: `_getCacheStats().configCacheSize` equals 0

### AC-001e: Monorepo cache isolation

**TC-001e-01: Different project roots get different cache entries**
- **Given**: Process has `CLAUDE_PROJECT_DIR=/tmp/projectA` and loads manifest
- **And**: Cache is populated with projectA's manifest
- **When**: `CLAUDE_PROJECT_DIR` is changed to `/tmp/projectB` and `_cachedProjectRoot` is reset
- **And**: `loadManifest()` is called in the projectB context
- **Then**: projectB's manifest is loaded from disk (not projectA's cached copy)
- **And**: `_getCacheStats().configCacheSize` equals 2 (both entries present)

**Note**: This test requires two temp dirs with different manifest content.

---

## FR-002: getProjectRoot() Per-Process Caching (6 unit + 0 integration = 6 tests)

### AC-002a: Single traversal for N>1 calls

**TC-002a-01: Second call returns without filesystem traversal**
- **Given**: A fresh process (caches reset via `_resetCaches()`)
- **And**: `CLAUDE_PROJECT_DIR` is set to a temp directory
- **When**: `getProjectRoot()` is called twice
- **Then**: Both calls return the same value
- **And**: `_getCacheStats().projectRootCached` is `true` after first call

**TC-002a-02: Ten calls all return same value**
- **Given**: A fresh process
- **When**: `getProjectRoot()` is called 10 times in a loop
- **Then**: All 10 return values are identical (strict `===` with first)
- **And**: `_getCacheStats().projectRootCached` is `true`

### AC-002b: CLAUDE_PROJECT_DIR env var shortcut preserved

**TC-002b-01: Env var value returned and cached**
- **Given**: `CLAUDE_PROJECT_DIR` is set to `/tmp/test-project-root`
- **And**: Caches are reset
- **When**: `getProjectRoot()` is called
- **Then**: `/tmp/test-project-root` is returned
- **And**: `_getCacheStats().projectRootCached` is `true`

**TC-002b-02: Env var takes priority over .isdlc folder traversal**
- **Given**: `CLAUDE_PROJECT_DIR` is set to `/tmp/env-root`
- **And**: The process cwd contains a `.isdlc` folder (different path)
- **When**: `getProjectRoot()` is called
- **Then**: `/tmp/env-root` is returned (env var takes priority)

### AC-002c: Consistent value within process

**TC-002c-01: Value remains consistent even if env var changes after first call**
- **Given**: `CLAUDE_PROJECT_DIR` is set to `/tmp/original-root`
- **And**: `getProjectRoot()` is called once (value cached)
- **When**: `process.env.CLAUDE_PROJECT_DIR` is changed to `/tmp/new-root`
- **And**: `getProjectRoot()` is called again
- **Then**: `/tmp/original-root` is still returned (cached value, not new env var)

**TC-002c-02: Cache starts null before first call**
- **Given**: A fresh require of common.cjs (module cache cleared)
- **And**: `NODE_ENV=test`
- **When**: `_getCacheStats()` is called before any `getProjectRoot()` call
- **Then**: `projectRootCached` is `false`

---

## FR-003: State Read Consolidation (6 unit + 3 integration = 9 tests)

### AC-003a: Single disk read per check() invocation

**TC-003a-01: Write event reads state file at most once**
- **Given**: A valid state.json exists on disk with `state_version: 5`
- **And**: A Write event targets that state.json with `state_version: 5`
- **When**: `check(ctx)` is invoked via the hook subprocess
- **Then**: The hook returns `{ decision: 'allow' }`
- **Verify**: Debug stderr output shows exactly one disk read log (not multiple)

**TC-003a-02: Write event with version mismatch still reads once**
- **Given**: A valid state.json exists on disk with `state_version: 10`
- **And**: A Write event targets that state.json with `state_version: 5`
- **When**: `check(ctx)` is invoked
- **Then**: The hook returns `{ decision: 'block' }` (V7 triggers)
- **Verify**: Only one disk read occurred (V7 blocked before V8 needed to run)

**TC-003a-03: Edit event behavior unchanged**
- **Given**: A valid state.json exists on disk
- **And**: An Edit event targets that state.json
- **When**: `check(ctx)` is invoked
- **Then**: The hook returns `{ decision: 'allow' }` (V7/V8 skip for Edit)

### AC-003b: V7 and V8 share same diskState object

**TC-003b-01: V7 version check and V8 phase protection use same disk data**
- **Given**: Disk state has `state_version: 5` and `active_workflow.current_phase_index: 3`
- **And**: Incoming write has `state_version: 5` and `current_phase_index: 3`
- **When**: `check(ctx)` is invoked
- **Then**: Both V7 and V8 allow (neither blocks)
- **And**: Only one readFileSync occurred for the disk state

**TC-003b-02: V7 passes but V8 blocks using same diskState**
- **Given**: Disk state has `state_version: 5` and `current_phase_index: 3`
- **And**: Incoming write has `state_version: 5` but `current_phase_index: 1` (regression)
- **When**: `check(ctx)` is invoked
- **Then**: V7 allows (version matches) but V8 blocks (phase index regression)
- **And**: The block reason mentions phase index regression

### AC-003c: V1-V3 use incoming content, not disk re-read

**TC-003c-01: Write event validates incoming content (not disk)**
- **Given**: Disk state has some phases data
- **And**: Incoming Write content has different phases data (valid)
- **When**: `check(ctx)` is invoked
- **Then**: Validation runs against the INCOMING content (not what is on disk)
- **And**: The hook allows the write

**TC-003c-02: Write with invalid incoming phases produces warning from incoming**
- **Given**: Disk state has valid phases
- **And**: Incoming Write content has phases with issues (e.g., constitutional_validation incomplete)
- **When**: `check(ctx)` is invoked
- **Then**: Warnings in stderr reference the incoming content's issues
- **And**: The hook allows with stderr warnings

### AC-003d: Graceful null handling when state file missing

**TC-003d-01: No state file on disk allows all writes (fail-open)**
- **Given**: The state.json file does NOT exist on disk
- **And**: A Write event targets that path with valid content
- **When**: `check(ctx)` is invoked
- **Then**: The hook returns `{ decision: 'allow' }` (fail-open)
- **And**: No errors or crashes in stderr

**TC-003d-02: Corrupt state file on disk allows all writes (fail-open)**
- **Given**: The state.json file exists but contains invalid JSON
- **And**: A Write event targets that path with valid content
- **When**: `check(ctx)` is invoked
- **Then**: The hook returns `{ decision: 'allow' }` (fail-open)

---

## FR-004: Sub-Hook Config Passthrough (6 unit + 2 integration = 8 tests)

### AC-004a: Sub-hook uses ctx.manifest inside dispatcher

**TC-004a-01: gate-blocker reads manifest from ctx when available**
- **Given**: `ctx.manifest` is populated with a valid manifest object
- **And**: The manifest contains ownership data for the current phase
- **When**: `checkAgentDelegationRequirement()` is called with `manifest` as 5th arg
- **Then**: The function uses the provided manifest (does not call `loadManifest()`)
- **Verify**: The delegation check result references data from the provided manifest

**TC-004a-02: gate-blocker delegation check works with ctx.manifest**
- **Given**: A dispatcher has loaded manifest into `ctx.manifest`
- **And**: The current phase is `06-implementation` with a known expected agent
- **And**: State shows the expected agent was delegated
- **When**: `checkAgentDelegationRequirement(phaseState, phaseReq, state, currentPhase, ctx.manifest)` is called
- **Then**: `{ satisfied: true }` is returned

### AC-004b: Standalone mode fallback

**TC-004b-01: checkAgentDelegationRequirement works without manifest param**
- **Given**: `manifest` parameter is `undefined` (standalone mode)
- **And**: A valid `skills-manifest.json` exists on disk
- **When**: `checkAgentDelegationRequirement(phaseState, phaseReq, state, currentPhase)` is called
- **Then**: The function loads manifest from disk via `loadManifest()` (backward compat)
- **And**: The delegation check returns a valid result

**TC-004b-02: checkAgentDelegationRequirement works with null manifest**
- **Given**: `manifest` parameter is explicitly `null`
- **And**: A valid `skills-manifest.json` exists on disk
- **When**: `checkAgentDelegationRequirement(phaseState, phaseReq, state, currentPhase, null)` is called
- **Then**: The function falls back to `loadManifest()` from disk
- **And**: Returns a valid result

### AC-004c: gate-blocker.cjs call site passes ctx.manifest

**TC-004c-01: gate-blocker check() passes ctx.manifest to delegation check**
- **Given**: A gate advancement input (Task tool with "Continue to" keyword)
- **And**: State has `06-implementation` phase with delegation validation enabled
- **And**: The `skills-manifest.json` exists on disk
- **When**: The gate-blocker hook is invoked via `runHook()`
- **Then**: The hook does not crash
- **And**: The delegation check runs successfully (either satisfied or not, depending on state)

**TC-004c-02: gate-blocker check() with no ctx.manifest (standalone) still works**
- **Given**: The gate-blocker hook is invoked standalone (not via dispatcher)
- **And**: No `ctx.manifest` is provided in the input
- **When**: The hook processes a gate advancement
- **Then**: The hook falls back to loading manifest from disk
- **And**: Returns a valid decision

### AC-004d: Other sub-hooks already use ctx.requirements

**TC-004d-01: iteration-corridor uses ctx.requirements (existing pattern verified)**
- **Given**: A dispatcher invocation where `ctx.requirements` is populated
- **When**: `iteration-corridor.check(ctx)` is called
- **Then**: The hook uses `ctx.requirements` (no loadIterationRequirements call needed)
- **Note**: This is a verification test -- the existing code already follows this pattern

**TC-004d-02: constitution-validator uses ctx.requirements (existing pattern verified)**
- **Given**: A dispatcher invocation where `ctx.requirements` is populated
- **When**: `constitution-validator.check(ctx)` is called
- **Then**: The hook uses `ctx.requirements`
- **Note**: Verification test -- existing pattern confirmed in module-design.md

---

## FR-005: writeState() Batch Optimization (4 unit + 3 integration = 7 tests)

### AC-005a: Single writeState() per dispatcher

**TC-005a-01: pre-task-dispatcher writes state at most once**
- **Given**: A pre-task-dispatcher invocation with 3 sub-hooks that modify state
- **When**: The dispatcher runs to completion
- **Then**: State file is written at most once (verify by reading final state)
- **And**: All 3 sub-hook modifications are present in the written state

**TC-005a-02: post-task-dispatcher writes state at most once**
- **Given**: A post-task-dispatcher invocation
- **When**: The dispatcher runs to completion with state modifications
- **Then**: State file is written at most once

**TC-005a-03: post-bash-dispatcher writes state at most once**
- **Given**: A post-bash-dispatcher invocation
- **When**: The dispatcher runs to completion with state modifications
- **Then**: State file is written at most once

### AC-005b: Deferred write until all hooks processed

**TC-005b-01: State modifications accumulated before write**
- **Given**: A dispatcher where hook 1 sets `stateModified: true`
- **And**: Hook 2 also modifies state
- **When**: The dispatcher processes all hooks
- **Then**: Both modifications are present in the final written state
- **And**: writeState was not called between hook 1 and hook 2

### AC-005c: workflow-completion-enforcer contract

**TC-005c-01: WCE returns stateModified false**
- **Given**: A post-task-dispatcher invocation where WCE runs
- **When**: The dispatcher checks WCE's result
- **Then**: `stateModified` from WCE's return is `false`
- **And**: The dispatcher does not write state on WCE's behalf

**TC-005c-02: No double-write when WCE manages its own state**
- **Given**: WCE internally writes state (own read/write cycle)
- **And**: The dispatcher accumulates state changes from other hooks
- **When**: The dispatcher writes state once at the end
- **Then**: Only one dispatcher-level writeState occurs (WCE's write is separate)

### AC-005d: No writeState when no hook modified state

**TC-005d-01: Dispatcher skips writeState when stateModified is false**
- **Given**: A dispatcher invocation where all sub-hooks return `stateModified: false` or no state modifications
- **When**: The dispatcher completes
- **Then**: The state file on disk is unchanged (same content, same mtime)

---

## NFR Tests (5 tests)

### NFR-001: Performance Improvement

**TC-NFR001-01: Config cache reduces redundant reads**
- **Given**: A fresh common.cjs module
- **When**: `loadManifest()` is called 5 times
- **Then**: `_getCacheStats().configCacheSize` is 1 (1 disk read, 4 cache hits)

**TC-NFR001-02: getProjectRoot cache eliminates traversals**
- **Given**: A fresh common.cjs module
- **When**: `getProjectRoot()` is called 10 times
- **Then**: `_getCacheStats().projectRootCached` is true after first call

### NFR-002: Backward Compatibility

**TC-NFR002-01: Existing test suite passes unchanged**
- **Verify**: `npm run test:hooks` passes all 1300+ existing tests
- **Note**: This is not a new test case but a gate requirement

### NFR-003: Correctness Preservation

**TC-NFR003-01: V7 version lock still blocks on mismatch**
- **Given**: Disk state has `state_version: 10`
- **And**: Incoming write has `state_version: 5`
- **When**: state-write-validator runs
- **Then**: V7 blocks with version mismatch reason (same behavior as before)

**TC-NFR003-02: V8 phase protection still blocks on regression**
- **Given**: Disk state has `current_phase_index: 5`
- **And**: Incoming write has `current_phase_index: 2`
- **When**: state-write-validator runs
- **Then**: V8 blocks with phase index regression reason

### NFR-004: Observability

**TC-NFR004-01: Debug mode logs cache hit/miss**
- **Given**: `SKILL_VALIDATOR_DEBUG=true` (enables debug logging)
- **And**: A fresh cache
- **When**: `loadManifest()` is called (cache miss), then called again (cache hit)
- **Then**: stderr contains "Config cache MISS: skills-manifest" and "Config cache HIT: skills-manifest"

---

## Test Count Summary

| FR | Unit Tests | Integration Tests | Total |
|----|-----------|-------------------|-------|
| FR-001 (Config Cache) | 11 | 0 | 11 |
| FR-002 (getProjectRoot Cache) | 6 | 0 | 6 |
| FR-003 (State Read Consolidation) | 3 | 6 | 9 |
| FR-004 (Config Passthrough) | 6 | 2 | 8 |
| FR-005 (Batch Write) | 2 | 5 | 7 |
| NFR (Performance, Compat, Correctness, Observability) | 5 | 0 | 5 |
| **Total** | **33** | **13** | **46** |

All 20 ACs covered (5+3+4+4+4). All 4 NFRs have at least one verification test.
