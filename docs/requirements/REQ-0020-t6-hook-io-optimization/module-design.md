# Module Design: T6 Hook I/O Optimization

**REQ-0020** | Phase 04 - Design | 2026-02-16

---

## 1. Scope

This document specifies exact code-level changes for 4 functional requirements across 7 source files. There are no new modules, no new APIs, no UI, and no external interfaces. All changes are internal refactoring of existing CommonJS hook utilities.

**Implementation order**: FR-002 -> FR-001 -> FR-003 -> FR-004 -> FR-005 (verification only)

---

## 2. Module: common.cjs -- Caching Layer (FR-001, FR-002)

**File**: `src/claude/hooks/lib/common.cjs`
**Traces to**: FR-001 (AC-001a..e), FR-002 (AC-002a..c), NFR-001, NFR-002, NFR-003

### 2.1 New Module-Level Variables

Add after the existing `const path = require('path');` (line 12), before the PHASE_PREFIXES section (line 14):

```javascript
// =========================================================================
// Per-Process Caching (REQ-0020: T6 Hook I/O Optimization)
// =========================================================================

/**
 * Cached project root path. Set on first getProjectRoot() call.
 * Per-process lifetime -- garbage-collected when process exits.
 * @type {string|null}
 */
let _cachedProjectRoot = null;

/**
 * Config file cache. Key: "{projectRoot}:{configFileName}".
 * Value: { mtimeMs: number, data: object }.
 * Per-process lifetime -- garbage-collected when process exits.
 * @type {Map<string, { mtimeMs: number, data: object }>}
 */
const _configCache = new Map();
```

### 2.2 getProjectRoot() -- Before/After (FR-002)

**BEFORE** (current, lines 69-86):
```javascript
function getProjectRoot() {
    if (process.env.CLAUDE_PROJECT_DIR) {
        return process.env.CLAUDE_PROJECT_DIR;
    }
    let dir = process.cwd();
    while (dir !== path.parse(dir).root) {
        if (fs.existsSync(path.join(dir, '.isdlc'))) {
            return dir;
        }
        dir = path.dirname(dir);
    }
    return process.cwd();
}
```

**AFTER**:
```javascript
function getProjectRoot() {
    // FR-002: Return cached value if available (AC-002a, AC-002c)
    if (_cachedProjectRoot !== null) {
        return _cachedProjectRoot;
    }

    // AC-002b: CLAUDE_PROJECT_DIR shortcut (existing behavior preserved)
    if (process.env.CLAUDE_PROJECT_DIR) {
        _cachedProjectRoot = process.env.CLAUDE_PROJECT_DIR;
        return _cachedProjectRoot;
    }

    // Fallback: traverse up to find .isdlc folder
    let dir = process.cwd();
    while (dir !== path.parse(dir).root) {
        if (fs.existsSync(path.join(dir, '.isdlc'))) {
            _cachedProjectRoot = dir;
            return _cachedProjectRoot;
        }
        dir = path.dirname(dir);
    }

    // Default to current directory
    _cachedProjectRoot = process.cwd();
    return _cachedProjectRoot;
}
```

**Signature change**: None. `getProjectRoot()` -> `string` (unchanged).
**Behavioral change**: First call traverses filesystem (same as before). Subsequent calls return `_cachedProjectRoot` without filesystem traversal.
**AC mapping**:
- AC-002a: N>1 calls execute traversal at most once
- AC-002b: CLAUDE_PROJECT_DIR still returned immediately, now also cached
- AC-002c: Same value returned consistently within process

### 2.3 Internal Cache Helper (FR-001)

Add a new internal (non-exported) helper function after `getProjectRoot()`:

```javascript
/**
 * Load a JSON config file with mtime-based caching.
 * Cache key: "{projectRoot}:{configName}" for monorepo isolation (AC-001e).
 *
 * @param {string} configPath - Absolute path to the config file
 * @param {string} configName - Short name for cache key (e.g., 'skills-manifest')
 * @returns {object|null} Parsed JSON data or null if file missing/invalid
 */
function _loadConfigWithCache(configPath, configName) {
    const cacheKey = `${getProjectRoot()}:${configName}`;

    try {
        const stat = fs.statSync(configPath);
        const currentMtime = stat.mtimeMs;

        const cached = _configCache.get(cacheKey);
        if (cached && cached.mtimeMs === currentMtime) {
            // AC-001c: mtime unchanged, return cached copy
            debugLog(`Config cache HIT: ${configName}`);
            return cached.data;
        }

        // AC-001a (first load) or AC-001b (mtime changed): read from disk
        const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        _configCache.set(cacheKey, { mtimeMs: currentMtime, data });
        debugLog(`Config cache MISS: ${configName} (${cached ? 'mtime changed' : 'first load'})`);
        return data;
    } catch (e) {
        // AC-001d: file does not exist or read error -- return null, do NOT cache
        debugLog(`Config cache ERROR: ${configName} -- ${e.code || e.message}`);
        return null;
    }
}
```

**Key design decisions**:
- `fs.statSync` throws on missing file, caught by try/catch (no separate existsSync call)
- `null` returns are NOT cached (AC-001d) -- next call will retry
- Cache key includes `getProjectRoot()` for monorepo isolation (AC-001e)
- `debugLog` calls for observability (NFR-004) -- only writes to stderr when debug mode enabled

### 2.4 loadManifest() -- Before/After (FR-001)

**BEFORE** (current, lines 757-768):
```javascript
function loadManifest() {
    const manifestPath = getManifestPath();
    if (!manifestPath) {
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (e) {
        return null;
    }
}
```

**AFTER**:
```javascript
function loadManifest() {
    const manifestPath = getManifestPath();
    if (!manifestPath) {
        return null;
    }
    return _loadConfigWithCache(manifestPath, 'skills-manifest');
}
```

**Signature change**: None. `loadManifest()` -> `object|null` (unchanged).
**Behavioral change**: Returns cached data on subsequent calls if mtime unchanged.

### 2.5 loadIterationRequirements() -- Before/After (FR-001)

**BEFORE** (current, lines 1989-2007):
```javascript
function loadIterationRequirements() {
    const projectRoot = getProjectRoot();
    const configPaths = [
        path.join(projectRoot, '.claude', 'hooks', 'config', 'iteration-requirements.json'),
        path.join(projectRoot, '.isdlc', 'config', 'iteration-requirements.json')
    ];
    for (const configPath of configPaths) {
        if (fs.existsSync(configPath)) {
            try {
                return JSON.parse(fs.readFileSync(configPath, 'utf8'));
            } catch (e) {
                debugLog('Error loading iteration requirements:', e.message);
                return null;
            }
        }
    }
    return null;
}
```

**AFTER**:
```javascript
function loadIterationRequirements() {
    const projectRoot = getProjectRoot();
    const configPaths = [
        path.join(projectRoot, '.claude', 'hooks', 'config', 'iteration-requirements.json'),
        path.join(projectRoot, '.isdlc', 'config', 'iteration-requirements.json')
    ];
    for (const configPath of configPaths) {
        // Use statSync inside _loadConfigWithCache to check existence + cache
        const result = _loadConfigWithCache(configPath, 'iteration-requirements');
        if (result !== null) {
            return result;
        }
    }
    return null;
}
```

**Signature change**: None. `loadIterationRequirements()` -> `object|null` (unchanged).
**Note**: The fallback path logic (two directories) is preserved. `_loadConfigWithCache` returns null for missing files, so the loop continues to the next path.

### 2.6 loadWorkflowDefinitions() -- Before/After (FR-001)

**BEFORE** (current, lines 2017-2035):
```javascript
function loadWorkflowDefinitions() {
    const projectRoot = getProjectRoot();
    const configPaths = [
        path.join(projectRoot, '.isdlc', 'config', 'workflows.json'),
        path.join(projectRoot, '.claude', 'hooks', 'config', 'workflows.json')
    ];
    for (const configPath of configPaths) {
        if (fs.existsSync(configPath)) {
            try {
                return JSON.parse(fs.readFileSync(configPath, 'utf8'));
            } catch (e) {
                debugLog('Error loading workflow definitions:', e.message);
                return null;
            }
        }
    }
    return null;
}
```

**AFTER**:
```javascript
function loadWorkflowDefinitions() {
    const projectRoot = getProjectRoot();
    const configPaths = [
        path.join(projectRoot, '.isdlc', 'config', 'workflows.json'),
        path.join(projectRoot, '.claude', 'hooks', 'config', 'workflows.json')
    ];
    for (const configPath of configPaths) {
        const result = _loadConfigWithCache(configPath, 'workflows');
        if (result !== null) {
            return result;
        }
    }
    return null;
}
```

**Signature change**: None. `loadWorkflowDefinitions()` -> `object|null` (unchanged).

### 2.7 getSkillOwner() and getAgentPhase() -- No Signature Change

These functions call `loadManifest()` internally. They automatically benefit from the cache without any code change because `loadManifest()` now uses `_loadConfigWithCache`.

```javascript
// NO CHANGE NEEDED -- these benefit from loadManifest() caching automatically
function getSkillOwner(skillId) {
    const manifest = loadManifest(); // <-- now cached
    if (!manifest || !manifest.skill_lookup) return null;
    return manifest.skill_lookup[skillId] || null;
}

function getAgentPhase(agentName) {
    const manifest = loadManifest(); // <-- now cached
    if (!manifest || !manifest.ownership || !manifest.ownership[agentName]) return null;
    return manifest.ownership[agentName].phase || null;
}
```

### 2.8 getManifestPath() -- No Signature Change

`getManifestPath()` calls `getProjectRoot()` (line 736), which now returns a cached value. This eliminates one filesystem traversal per call. No code change needed in `getManifestPath()` itself.

### 2.9 Cache Invalidation for Multi-Path Configs

**Design decision**: `loadIterationRequirements` and `loadWorkflowDefinitions` search two paths. The cache key uses `configName` (e.g., `'iteration-requirements'`), NOT the full path. This means:

- If the first path exists, it is cached under `{root}:iteration-requirements`
- If the first path does not exist (returns null), the second path is tried
- If the second path exists, it is cached under the SAME key `{root}:iteration-requirements`

This is correct because within a single process, the config file location does not change. The first-found path will be cached, and subsequent calls will return the cached data (from whichever path was found first).

**Edge case**: If a config file is deleted from the first path and created at the second path DURING a process lifetime, the cache will serve `null` (because `statSync` on the first path will throw, returning null, and the second path's result will be cached). This is acceptable because config files do not move during hook execution.

### 2.10 Exported API Changes

**No exports added or removed.** `_loadConfigWithCache` and the cache variables are internal (not exported). The `module.exports` block at the bottom of common.cjs is unchanged.

### 2.11 Test Exposure for Cache State

For testing purposes, add two internal-only functions to allow tests to inspect and reset cache state. These are NOT added to `module.exports`:

```javascript
/**
 * Reset all caches. For testing only.
 * @private
 */
function _resetCaches() {
    _cachedProjectRoot = null;
    _configCache.clear();
}

/**
 * Get cache statistics. For testing only.
 * @private
 * @returns {{ projectRootCached: boolean, configCacheSize: number }}
 */
function _getCacheStats() {
    return {
        projectRootCached: _cachedProjectRoot !== null,
        configCacheSize: _configCache.size
    };
}
```

These will be exported via a conditional test-only export pattern:

```javascript
// Test-only exports (not part of public API)
if (process.env.NODE_ENV === 'test' || process.env.ISDLC_TEST_MODE === '1') {
    module.exports._resetCaches = _resetCaches;
    module.exports._getCacheStats = _getCacheStats;
}
```

---

## 3. Module: state-write-validator.cjs -- State Read Consolidation (FR-003)

**File**: `src/claude/hooks/state-write-validator.cjs`
**Traces to**: FR-003 (AC-003a..d), NFR-001, NFR-003

### 3.1 checkVersionLock() -- Before/After

**BEFORE** (current, line 105):
```javascript
function checkVersionLock(filePath, toolInput, toolName) {
    if (toolName !== 'Write') {
        return null;
    }
    try {
        const incomingContent = toolInput.content;
        if (!incomingContent || typeof incomingContent !== 'string') {
            return null;
        }
        let incomingState;
        try {
            incomingState = JSON.parse(incomingContent);
        } catch (e) {
            return null;
        }
        if (!incomingState || typeof incomingState !== 'object') {
            return null;
        }
        const incomingVersion = incomingState.state_version;

        // Reads disk state independently
        let diskVersion;
        try {
            if (!fs.existsSync(filePath)) {
                return null;
            }
            const diskContent = fs.readFileSync(filePath, 'utf8');
            const diskState = JSON.parse(diskContent);
            if (!diskState || typeof diskState !== 'object') {
                return null;
            }
            diskVersion = diskState.state_version;
        } catch (e) {
            return null;
        }
        // ... version comparison logic ...
    } catch (e) {
        return null;
    }
}
```

**AFTER**:
```javascript
/**
 * Rule V7: Optimistic locking version check (BUG-0009).
 *
 * @param {string} filePath - Path to the state.json file
 * @param {object} toolInput - The tool_input from the hook event
 * @param {string} toolName - 'Write' or 'Edit'
 * @param {object|null} diskState - Pre-read disk state (FR-003), or null if unavailable
 * @returns {{ decision: string, stopReason?: string, stderr?: string } | null}
 */
function checkVersionLock(filePath, toolInput, toolName, diskState) {
    if (toolName !== 'Write') {
        return null;
    }
    try {
        const incomingContent = toolInput.content;
        if (!incomingContent || typeof incomingContent !== 'string') {
            return null;
        }
        let incomingState;
        try {
            incomingState = JSON.parse(incomingContent);
        } catch (e) {
            return null;
        }
        if (!incomingState || typeof incomingState !== 'object') {
            debugLog('V7 version check skipped: incoming content parsed to', typeof incomingState, '-- not an object');
            return null;
        }
        const incomingVersion = incomingState.state_version;

        // AC-003b: Use pre-read diskState instead of reading from disk
        // AC-003d: diskState is null when file does not exist -- fail-open
        if (!diskState || typeof diskState !== 'object') {
            // Backward compat: if diskState not provided, allow (fail-open)
            if (incomingVersion === undefined || incomingVersion === null) {
                return null; // Both unversioned
            }
            return null; // No disk to compare against
        }
        const diskVersion = diskState.state_version;

        // BUG-0017: If incoming has no state_version, check disk before allowing
        if (incomingVersion === undefined || incomingVersion === null) {
            if (diskVersion === undefined || diskVersion === null) {
                return null;
            }
            const reason = `Unversioned write rejected: disk state has state_version ${diskVersion} but incoming write has no state_version. Include state_version in your write. Re-read .isdlc/state.json before writing.`;
            console.error(`[state-write-validator] V7 BLOCK: ${reason}`);
            logHookEvent('state-write-validator', 'block', {
                reason: `V7: incoming has no state_version, disk has ${diskVersion}`
            });
            return {
                decision: 'block',
                stopReason: reason
            };
        }

        if (diskVersion === undefined || diskVersion === null) {
            return null;
        }

        if (incomingVersion < diskVersion) {
            const reason = `Version mismatch: expected state_version >= ${diskVersion}, got ${incomingVersion}. Re-read .isdlc/state.json before writing.`;
            console.error(`[state-write-validator] V7 BLOCK: ${reason}`);
            logHookEvent('state-write-validator', 'block', {
                reason: `V7: state_version ${incomingVersion} < disk ${diskVersion}`
            });
            return {
                decision: 'block',
                stopReason: reason
            };
        }

        return null;
    } catch (e) {
        debugLog('V7 version check error:', e.message);
        return null;
    }
}
```

**Signature change**: `(filePath, toolInput, toolName)` -> `(filePath, toolInput, toolName, diskState)`
- `diskState` is the 4th parameter: `object|null`
- When `null`, function allows all writes (fail-open, AC-003d)

### 3.2 checkPhaseFieldProtection() -- Before/After

**BEFORE** (current, line 232):
```javascript
function checkPhaseFieldProtection(filePath, toolInput, toolName) {
    if (toolName !== 'Write') {
        return null;
    }
    try {
        const incomingContent = toolInput.content;
        // ... parses incoming ...

        // Reads disk state independently
        let diskState;
        try {
            if (!fs.existsSync(filePath)) {
                return null;
            }
            const diskContent = fs.readFileSync(filePath, 'utf8');
            diskState = JSON.parse(diskContent);
        } catch (e) {
            return null;
        }
        // ... comparison logic ...
    } catch (e) {
        return null;
    }
}
```

**AFTER**:
```javascript
/**
 * Rule V8: Phase Orchestration Field Protection (BUG-0011).
 *
 * @param {string} filePath - Path to the state.json file
 * @param {object} toolInput - The tool_input from the hook event
 * @param {string} toolName - 'Write' or 'Edit'
 * @param {object|null} diskState - Pre-read disk state (FR-003), or null if unavailable
 * @returns {{ decision: string, stopReason?: string } | null}
 */
function checkPhaseFieldProtection(filePath, toolInput, toolName, diskState) {
    if (toolName !== 'Write') {
        return null;
    }
    try {
        const incomingContent = toolInput.content;
        if (!incomingContent || typeof incomingContent !== 'string') {
            return null;
        }
        let incomingState;
        try {
            incomingState = JSON.parse(incomingContent);
        } catch (e) {
            return null;
        }

        const incomingAW = incomingState?.active_workflow;
        if (!incomingAW || typeof incomingAW !== 'object') {
            return null;
        }

        // AC-003b: Use pre-read diskState instead of reading from disk
        // AC-003d: diskState is null when file does not exist -- fail-open
        if (!diskState || typeof diskState !== 'object') {
            return null;
        }

        const diskAW = diskState?.active_workflow;
        if (!diskAW || typeof diskAW !== 'object') {
            return null;
        }

        // --- Check 1: current_phase_index regression (FR-01) ---
        // (unchanged comparison logic)
        const incomingIndex = incomingAW.current_phase_index;
        const diskIndex = diskAW.current_phase_index;
        if (
            incomingIndex !== undefined && incomingIndex !== null &&
            diskIndex !== undefined && diskIndex !== null
        ) {
            if (typeof incomingIndex === 'number' && typeof diskIndex === 'number') {
                if (incomingIndex < diskIndex) {
                    const reason = `Phase index regression: incoming current_phase_index (${incomingIndex}) < disk (${diskIndex}). Subagents must not regress phase orchestration fields. Re-read state.json.`;
                    console.error(`[state-write-validator] V8 BLOCK: ${reason}`);
                    logHookEvent('state-write-validator', 'block', {
                        reason: `V8: phase_index ${incomingIndex} < disk ${diskIndex}`
                    });
                    return { decision: 'block', stopReason: reason };
                }
            }
        }

        // --- Check 2: phase_status regression (FR-02) ---
        // (unchanged comparison logic)
        const incomingPS = incomingAW.phase_status;
        const diskPS = diskAW.phase_status;
        if (incomingPS && typeof incomingPS === 'object' &&
            diskPS && typeof diskPS === 'object') {
            for (const [phase, incomingStatus] of Object.entries(incomingPS)) {
                const diskStatus = diskPS[phase];
                if (diskStatus === undefined || diskStatus === null) continue;
                const incomingOrd = PHASE_STATUS_ORDINAL[incomingStatus];
                const diskOrd = PHASE_STATUS_ORDINAL[diskStatus];
                if (incomingOrd === undefined || diskOrd === undefined) continue;
                if (incomingOrd < diskOrd) {
                    const reason = `Phase status regression: phase '${phase}' changed from '${diskStatus}' to '${incomingStatus}'. Subagents must not regress phase_status. Re-read state.json.`;
                    console.error(`[state-write-validator] V8 BLOCK: ${reason}`);
                    logHookEvent('state-write-validator', 'block', {
                        reason: `V8: phase_status '${phase}' ${diskStatus} -> ${incomingStatus}`
                    });
                    return { decision: 'block', stopReason: reason };
                }
            }
        }

        return null;
    } catch (e) {
        debugLog('V8 phase field protection error:', e.message);
        return null;
    }
}
```

**Signature change**: `(filePath, toolInput, toolName)` -> `(filePath, toolInput, toolName, diskState)`
- Same pattern as checkVersionLock -- 4th parameter is pre-read disk state

### 3.3 check() -- Before/After (orchestrating single read)

**BEFORE** (current, line 358):
```javascript
function check(ctx) {
    try {
        // ... guards ...

        // Rule V7
        const v7Result = checkVersionLock(filePath, toolInput, input.tool_name);
        if (v7Result && v7Result.decision === 'block') return v7Result;

        // Rule V8
        const v8Result = checkPhaseFieldProtection(filePath, toolInput, input.tool_name);
        if (v8Result && v8Result.decision === 'block') return v8Result;

        // V1-V3: Read from disk (3rd read)
        let stateData;
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            stateData = JSON.parse(content);
        } catch (e) {
            return { decision: 'allow' };
        }
        // ... validate phases ...
    } catch (error) {
        return { decision: 'allow' };
    }
}
```

**AFTER**:
```javascript
function check(ctx) {
    try {
        const input = ctx.input;
        if (!input) {
            return { decision: 'allow' };
        }
        if (input.tool_name !== 'Write' && input.tool_name !== 'Edit') {
            return { decision: 'allow' };
        }

        const toolInput = input.tool_input || {};
        const filePath = toolInput.file_path || toolInput.filePath || '';
        if (!STATE_JSON_PATTERN.test(filePath)) {
            return { decision: 'allow' };
        }

        debugLog('State.json write detected:', filePath);

        // FR-003 / AC-003a: Read disk state ONCE for V7 + V8
        let diskState = null;
        try {
            if (fs.existsSync(filePath)) {
                const diskContent = fs.readFileSync(filePath, 'utf8');
                const parsed = JSON.parse(diskContent);
                if (parsed && typeof parsed === 'object') {
                    diskState = parsed;
                }
            }
        } catch (e) {
            // AC-003d: fail-open, diskState remains null
            debugLog('Could not read disk state for V7/V8:', e.message);
        }

        // Rule V7: Version check (uses diskState)
        const v7Result = checkVersionLock(filePath, toolInput, input.tool_name, diskState);
        if (v7Result && v7Result.decision === 'block') {
            return v7Result;
        }

        // Rule V8: Phase field protection (uses same diskState)
        const v8Result = checkPhaseFieldProtection(filePath, toolInput, input.tool_name, diskState);
        if (v8Result && v8Result.decision === 'block') {
            return v8Result;
        }

        // V1-V3: Validate INCOMING content from toolInput (AC-003c)
        // For Write events, parse from toolInput.content
        // For V1-V3 phase scanning, we need the WRITTEN state (not disk state)
        let stateData;
        if (input.tool_name === 'Write') {
            // AC-003c: Parse from incoming content, not disk
            try {
                const incomingContent = toolInput.content;
                if (!incomingContent || typeof incomingContent !== 'string') {
                    return { decision: 'allow' };
                }
                stateData = JSON.parse(incomingContent);
            } catch (e) {
                debugLog('Could not parse incoming state content:', e.message);
                return { decision: 'allow' };
            }
        } else {
            // Edit events: read from disk (the edit was just applied)
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                stateData = JSON.parse(content);
            } catch (e) {
                debugLog('Could not read/parse state.json:', e.message);
                return { decision: 'allow' };
            }
        }

        // Validate each phase
        const phases = stateData.phases;
        if (!phases || typeof phases !== 'object') {
            return { decision: 'allow' };
        }

        const allWarnings = [];
        for (const [phaseName, phaseData] of Object.entries(phases)) {
            if (!phaseData || typeof phaseData !== 'object') continue;
            const warnings = validatePhase(phaseName, phaseData, filePath);
            for (const warning of warnings) {
                allWarnings.push(warning);
                logHookEvent('state-write-validator', 'warn', {
                    phase: phaseName,
                    reason: warning.split('\n')[0].replace('[state-write-validator] WARNING: ', '')
                });
            }
        }

        if (allWarnings.length > 0) {
            return { decision: 'allow', stderr: allWarnings.join('\n') };
        }

        return { decision: 'allow' };
    } catch (error) {
        debugLog('Error in state-write-validator:', error.message);
        return { decision: 'allow' };
    }
}
```

**Signature change**: None. `check(ctx)` -> `{ decision, stopReason?, stderr? }` (unchanged).
**Behavioral change**:
- Disk state read reduced from 3 to 1 (AC-003a)
- V7 and V8 share the same `diskState` object (AC-003b)
- V1-V3 parse from `toolInput.content` for Write events instead of re-reading disk (AC-003c)
- V1-V3 still read from disk for Edit events (edits modify in-place; incoming content is a diff, not full state)

### 3.4 I/O Count Summary for state-write-validator

| Operation | Before | After | Notes |
|-----------|--------|-------|-------|
| `fs.existsSync(filePath)` | 2 (V7+V8) | 1 (check) | Consolidated into single guard |
| `fs.readFileSync(filePath)` | 3 (V7+V8+V1-V3) | 1 (check, for disk) + 0 (V1-V3 uses toolInput) | Write events: 1 disk read. Edit events: 2 reads (1 disk + 1 post-edit) |
| `JSON.parse` | 3 (disk) + 1 (incoming) | 1 (disk) + 1 (incoming) | Incoming parsed once for V7/V8 (in their own scope), once for V1-V3 |

**Net reduction for Write events**: 3 disk reads -> 1 disk read (67% reduction)
**Net reduction for Edit events**: 3 disk reads -> 2 disk reads (V7/V8 skip for Edit, V1-V3 must read post-edit)

---

## 4. Module: gate-blocker.cjs -- Context Passthrough (FR-004)

**File**: `src/claude/hooks/gate-blocker.cjs`
**Traces to**: FR-004 (AC-004a, AC-004b, AC-004c), NFR-002

### 4.1 checkAgentDelegationRequirement() -- Before/After

**BEFORE** (current, line 363):
```javascript
function checkAgentDelegationRequirement(phaseState, phaseRequirements, state, currentPhase) {
    const delegationReq = phaseRequirements.agent_delegation_validation;
    if (!delegationReq || !delegationReq.enabled) {
        return { satisfied: true, reason: 'not_required' };
    }

    const manifest = loadManifest();  // <-- direct disk read (AC-004c)
    if (!manifest || !manifest.ownership) {
        return { satisfied: true, reason: 'no_manifest' };
    }
    // ... find expectedAgent from manifest.ownership ...
}
```

**AFTER**:
```javascript
/**
 * Check if agent delegation requirement is satisfied.
 * Verifies the expected agent for the current phase was invoked at least once.
 *
 * @param {object} phaseState - Current phase state
 * @param {object} phaseRequirements - Phase requirements config
 * @param {object} state - Full state.json
 * @param {string} currentPhase - Current phase key
 * @param {object|null} [manifest] - Pre-loaded manifest (FR-004). Falls back to loadManifest() if null.
 * @returns {{ satisfied: boolean, reason: string }}
 */
function checkAgentDelegationRequirement(phaseState, phaseRequirements, state, currentPhase, manifest) {
    const delegationReq = phaseRequirements.agent_delegation_validation;
    if (!delegationReq || !delegationReq.enabled) {
        return { satisfied: true, reason: 'not_required' };
    }

    // AC-004c: Use provided manifest, fall back to loadManifest() (AC-004b: standalone compat)
    const resolvedManifest = manifest || loadManifest();
    if (!resolvedManifest || !resolvedManifest.ownership) {
        return { satisfied: true, reason: 'no_manifest' };
    }

    // ... rest unchanged, using resolvedManifest instead of manifest ...
}
```

**Signature change**: `(phaseState, phaseRequirements, state, currentPhase)` -> `(phaseState, phaseRequirements, state, currentPhase, manifest)`
- 5th parameter `manifest` is optional (`object|null|undefined`)
- When omitted or null, falls back to `loadManifest()` (backward compat, AC-004b)

### 4.2 Call Site Update in gate-blocker check()

**BEFORE** (line 730):
```javascript
const delegationCheck = checkAgentDelegationRequirement(phaseState, phaseReq, state, currentPhase);
```

**AFTER**:
```javascript
// AC-004a: Pass ctx.manifest to avoid redundant loadManifest() call
const manifest = ctx.manifest || null;
const delegationCheck = checkAgentDelegationRequirement(phaseState, phaseReq, state, currentPhase, manifest);
```

**Note**: `ctx.manifest` is already populated by all 5 dispatchers (see pre-task-dispatcher.cjs line 104). When running standalone, `ctx.manifest` is loaded once in the standalone entrypoint.

### 4.3 Other Sub-Hooks -- Already Compliant (FR-004 verification)

These sub-hooks already use the `ctx.requirements || fallback` pattern:

| Sub-Hook | Current Pattern (verified) | Change Needed |
|----------|--------------------------|---------------|
| `constitution-validator.cjs:274` | `ctx.requirements \|\| loadIterationRequirementsFromCommon() \|\| loadIterationRequirements()` | None (AC-004d satisfied) |
| `iteration-corridor.cjs:276` | `ctx.requirements \|\| loadIterationRequirementsFromCommon() \|\| loadIterationRequirements()` | None (AC-004d satisfied) |
| `test-watcher.cjs:448` | `ctx.requirements \|\| loadIterationRequirementsFromCommon() \|\| loadIterationRequirements()` | None (AC-004d satisfied) |
| `log-skill-usage.cjs:90` | `ctx.manifest \|\| loadManifest()` | None (AC-004a pattern already present) |
| `gate-blocker.cjs:571` | `ctx.requirements \|\| loadIterationRequirementsFromCommon() \|\| loadIterationRequirements()` | None (AC-004d satisfied) |

**Only gate-blocker.cjs line 369 (`checkAgentDelegationRequirement`) requires a change.** All other sub-hooks already follow the context passthrough pattern.

---

## 5. Module: Dispatchers -- Batch Write Verification (FR-005)

**Files**: All 5 dispatchers in `src/claude/hooks/dispatchers/`
**Traces to**: FR-005 (AC-005a..d), NFR-001

### 5.1 Verification Results

Analysis of all 5 dispatchers confirms batch writes are already implemented:

| Dispatcher | writeState Pattern | Compliant | Evidence |
|------------|-------------------|-----------|----------|
| `pre-task-dispatcher.cjs` | `stateModified` flag, write at line 162 (on block) or line 180 (at end) | Yes | AC-005a, AC-005b |
| `pre-skill-dispatcher.cjs` | Same `stateModified` flag pattern | Yes | AC-005a, AC-005b |
| `post-task-dispatcher.cjs` | Single `writeState` at end | Yes | AC-005a |
| `post-bash-dispatcher.cjs` | Single `writeState` at end | Yes | AC-005a |
| `post-write-edit-dispatcher.cjs` | No `writeState` (hooks manage own I/O) | Yes | AC-005d |

### 5.2 workflow-completion-enforcer Contract

`workflow-completion-enforcer.cjs` returns `stateModified: false` by contract (it manages its own read/write cycle for optimistic locking). All dispatchers correctly check this flag, so no double-write occurs (AC-005c).

### 5.3 No Code Changes Required for FR-005

FR-005 is verification-only. No code changes are needed. The test strategy (Phase 05) should include verification tests that confirm the batch-write pattern remains intact.

---

## 6. Data Flow Diagram

### 6.1 Before Optimization (per pre-task-dispatcher invocation)

```
pre-task-dispatcher
  |-- readStdin()                           [1 stdin read]
  |-- readState()                           [1 disk read]
  |-- loadManifest()                        [1 getProjectRoot traversal + 1 disk read]
  |-- loadIterationRequirements()           [1 getProjectRoot traversal + 1 disk read]
  |-- loadWorkflowDefinitions()             [1 getProjectRoot traversal + 1 disk read]
  |-- Build ctx
  |-- sub-hook 1: gate-blocker.check(ctx)
  |     |-- ctx.requirements (OK, from ctx)
  |     |-- checkAgentDelegationRequirement()
  |           |-- loadManifest()            [1 getProjectRoot traversal + 1 disk read]  <-- REDUNDANT
  |-- sub-hook 2: iteration-corridor.check(ctx)
  |     |-- ctx.requirements (OK)
  |-- sub-hook 3: constitution-validator.check(ctx)
  |     |-- ctx.requirements (OK)
  |-- writeState() (if stateModified)       [1 disk read + 1 disk write]

  Total: 5 getProjectRoot traversals, 5 config reads, 1 state read, 0-1 state write
```

### 6.2 After Optimization

```
pre-task-dispatcher
  |-- readStdin()                           [1 stdin read]
  |-- readState()                           [1 disk read]
  |-- loadManifest()                        [1 getProjectRoot traversal + 1 statSync + 1 disk read (CACHE MISS)]
  |-- loadIterationRequirements()           [0 traversals (cached root) + 1 statSync + 1 disk read (CACHE MISS)]
  |-- loadWorkflowDefinitions()             [0 traversals (cached root) + 1 statSync + 1 disk read (CACHE MISS)]
  |-- Build ctx
  |-- sub-hook 1: gate-blocker.check(ctx)
  |     |-- ctx.requirements (OK, from ctx)
  |     |-- checkAgentDelegationRequirement(..., ctx.manifest)
  |           |-- uses provided manifest    [0 disk reads]  <-- OPTIMIZED
  |-- sub-hook 2: iteration-corridor.check(ctx)
  |     |-- ctx.requirements (OK)
  |-- sub-hook 3: constitution-validator.check(ctx)
  |     |-- ctx.requirements (OK)
  |-- writeState() (if stateModified)       [1 disk read + 1 disk write]

  Total: 1 getProjectRoot traversal, 3 statSyncs + 3 config reads (first call), 1 state read, 0-1 state write
  Subsequent calls in same process: 0 traversals, 3 statSyncs + 0 config reads (CACHE HIT)
```

---

## 7. Cross-Cutting Concerns

### 7.1 Fail-Open Preservation

Every code path that currently returns `null` or `{ decision: 'allow' }` on error continues to do so. The new `_loadConfigWithCache` catches all errors and returns null. The `diskState` parameter in state-write-validator falls back to null on any error. No change to fail-open contract.

### 7.2 Thread Safety

Not applicable. Node.js hooks are single-threaded. Module-level variables are safe within a single process. No concurrent access concerns.

### 7.3 Memory Impact

- `_cachedProjectRoot`: One string (~50-200 bytes)
- `_configCache`: At most 3 entries (manifest, requirements, workflows), each containing one parsed JSON object. Typical total: ~50-200KB. Freed when process exits (~100ms lifetime).

### 7.4 Performance Budget

All changes must stay within the existing 100ms performance budget per dispatcher invocation. The optimization reduces I/O, so this budget is more easily met, not harder.

---

## 8. Traceability Matrix

| Design Element | FR | AC | ADR | File:Line |
|---------------|----|----|-----|-----------|
| `_cachedProjectRoot` variable | FR-002 | AC-002a,c | ADR-0001 | common.cjs:~14 (new) |
| `_configCache` Map | FR-001 | AC-001a,e | ADR-0001 | common.cjs:~21 (new) |
| `getProjectRoot()` cache check | FR-002 | AC-002a,b,c | ADR-0001 | common.cjs:69 |
| `_loadConfigWithCache()` helper | FR-001 | AC-001a,b,c,d,e | ADR-0001,0002 | common.cjs (new) |
| `loadManifest()` cache integration | FR-001 | AC-001a | ADR-0001 | common.cjs:757 |
| `loadIterationRequirements()` cache | FR-001 | AC-001a | ADR-0001 | common.cjs:1989 |
| `loadWorkflowDefinitions()` cache | FR-001 | AC-001a | ADR-0001 | common.cjs:2017 |
| `check()` single disk read | FR-003 | AC-003a | ADR-0004 | state-write-validator.cjs:358 |
| `checkVersionLock()` diskState param | FR-003 | AC-003b,d | ADR-0004 | state-write-validator.cjs:105 |
| `checkPhaseFieldProtection()` diskState | FR-003 | AC-003b,d | ADR-0004 | state-write-validator.cjs:232 |
| V1-V3 incoming content parse | FR-003 | AC-003c | ADR-0004 | state-write-validator.cjs:~392 |
| `checkAgentDelegationRequirement()` manifest param | FR-004 | AC-004c | ADR-0003 | gate-blocker.cjs:363 |
| Call site manifest passthrough | FR-004 | AC-004a | ADR-0003 | gate-blocker.cjs:730 |
| Dispatcher batch write verification | FR-005 | AC-005a,b,c,d | - | all 5 dispatchers (no change) |
| `_resetCaches()` test helper | - | - | - | common.cjs (new, test-only) |
| `debugLog` cache hit/miss | NFR-004 | - | ADR-0002 | common.cjs (new calls) |
