# Module Design: User-Space Hooks

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-03-08
**Coverage**: 100%

---

## 1. Module: `user-hooks.cjs`

**Location**: `src/claude/hooks/lib/user-hooks.cjs`
**Responsibility**: Discover, resolve, and execute user-space hooks from `.isdlc/hooks/`
**Dependencies**: `child_process` (Node built-in), `fs`, `path`, `common.cjs` (co-located, for `getProjectRoot`)
**Update safety**: This file lives in `src/claude/hooks/lib/` and is copied to `.claude/hooks/lib/` during install/update. The user's hook scripts in `.isdlc/hooks/` are never touched by the updater.

---

## 2. Exported Functions

### 2.1 `executeHooks(hookPoint, context)`

Main entry point. Discovers and runs all hooks for a given hook point.

```javascript
/**
 * @param {string} hookPoint - e.g., 'pre-gate', 'post-implementation', 'post-workflow'
 * @param {HookContext} context - Workflow context for environment variable injection
 * @returns {HookResult} - Aggregated results from all hooks
 */
function executeHooks(hookPoint, context) { ... }
```

**Behavior**:
1. Resolve hook point name (alias resolution)
2. Discover hooks in resolved directory
3. Execute each hook sequentially (alphabetical order)
4. Collect results
5. Return aggregated result with block/warning status

**Error handling**: Never throws. All errors are captured in the result object. A crashed hook is reported as a warning, not a block.

### 2.2 `discoverHooks(hookDir)`

Scans a directory for executable hook scripts.

```javascript
/**
 * @param {string} hookDir - Absolute path to hook point directory
 * @returns {string[]} - Sorted list of absolute file paths
 */
function discoverHooks(hookDir) { ... }
```

**Behavior**:
1. Check if directory exists. If not, return empty array.
2. Read directory entries, filter to files only (skip subdirectories).
3. Sort alphabetically by filename.
4. Return absolute paths.

### 2.3 `resolveHookPoint(hookPoint, projectRoot)`

Resolves a hook point name to a directory path, applying alias resolution.

```javascript
/**
 * @param {string} hookPoint - e.g., 'post-implementation' or 'post-06-implementation'
 * @param {string} projectRoot - Project root directory
 * @returns {{ resolved: string, dir: string } | null} - Resolved name and directory path, or null
 */
function resolveHookPoint(hookPoint, projectRoot) { ... }
```

**Resolution order**:
1. Try exact match: `.isdlc/hooks/{hookPoint}/`
2. If hook point has a phase component (e.g., `post-implementation`), try alias resolution:
   - Extract the phase portion (`implementation`)
   - Look up in `PHASE_ALIASES` map
   - Construct aliased path (e.g., `.isdlc/hooks/post-06-implementation/`)
3. If neither exists, return null

### 2.4 `buildContext(state)`

Builds a context object from the current workflow state.

```javascript
/**
 * @param {object} state - state.json content
 * @returns {HookContext}
 */
function buildContext(state) { ... }
```

---

## 3. Data Structures

### 3.1 `HookContext`

```javascript
/**
 * @typedef {Object} HookContext
 * @property {string} phase - Current phase identifier (e.g., '06-implementation')
 * @property {string} workflowType - Workflow type (e.g., 'feature', 'fix')
 * @property {string} slug - Workflow slug
 * @property {string} projectRoot - Absolute path to project root
 * @property {string|null} artifactFolder - Artifact folder path (relative to project root)
 * @property {number} timeoutMs - Timeout per hook in milliseconds
 */
```

### 3.2 `HookResult`

```javascript
/**
 * @typedef {Object} HookResult
 * @property {string} hookPoint - Resolved hook point name
 * @property {HookEntry[]} hooks - Results per hook
 * @property {boolean} blocked - True if any hook exited with code 2
 * @property {HookEntry[]} warnings - Hooks that exited with code 1 or 3+
 * @property {HookEntry|null} blockingHook - First hook that blocked (if any)
 */
```

### 3.3 `HookEntry`

```javascript
/**
 * @typedef {Object} HookEntry
 * @property {string} name - Script filename
 * @property {number} exitCode - Process exit code
 * @property {string} stdout - Captured stdout
 * @property {string} stderr - Captured stderr
 * @property {number} durationMs - Execution duration
 * @property {'pass'|'warning'|'block'|'timeout'|'error'} status - Interpreted status
 */
```

---

## 4. Phase Alias Map

```javascript
const PHASE_ALIASES = {
  'quick-scan':       '00-quick-scan',
  'requirements':     '01-requirements',
  'impact-analysis':  '02-impact-analysis',
  'architecture':     '03-architecture',
  'design':           '04-design',
  'test-strategy':    '05-test-strategy',
  'implementation':   '06-implementation',
  'testing':          '07-testing',
  'code-review':      '08-code-review',
  'local-testing':    '11-local-testing',
  'upgrade-plan':     '15-upgrade-plan',
  'upgrade-execute':  '15-upgrade-execute',
  'quality-loop':     '16-quality-loop',
  'tracing':          '02-tracing'
};
```

**Resolution logic**: For a hook point like `post-implementation`:
1. Split on first `-` after `pre`/`post` prefix: prefix = `post`, phase = `implementation`
2. Look up `implementation` in `PHASE_ALIASES` -> `06-implementation`
3. Construct resolved name: `post-06-implementation`

---

## 5. Timeout Handling

```javascript
function executeOneHook(scriptPath, context) {
  const timeoutMs = context.timeoutMs || 60000;
  const env = {
    ...process.env,
    ISDLC_PHASE: context.phase,
    ISDLC_WORKFLOW_TYPE: context.workflowType,
    ISDLC_SLUG: context.slug,
    ISDLC_PROJECT_ROOT: context.projectRoot,
    ISDLC_ARTIFACT_FOLDER: context.artifactFolder || '',
    ISDLC_HOOK_POINT: context.hookPoint || ''
  };

  try {
    const start = Date.now();
    const result = spawnSync('sh', [scriptPath], {
      cwd: context.projectRoot,
      env,
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,  // 1MB stdout/stderr limit
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const durationMs = Date.now() - start;

    if (result.error && result.error.code === 'ETIMEDOUT') {
      return { name: path.basename(scriptPath), exitCode: -1, stdout: '', stderr: 'Hook timed out', durationMs, status: 'timeout' };
    }

    const exitCode = result.status ?? -1;
    const status = exitCode === 0 ? 'pass' : exitCode === 2 ? 'block' : 'warning';

    return {
      name: path.basename(scriptPath),
      exitCode,
      stdout: (result.stdout || '').toString().trim(),
      stderr: (result.stderr || '').toString().trim(),
      durationMs,
      status
    };
  } catch (err) {
    return { name: path.basename(scriptPath), exitCode: -1, stdout: '', stderr: err.message, durationMs: 0, status: 'error' };
  }
}
```

---

## 6. Config Loading

Hook timeout is read from `.isdlc/config.json` if it exists:

```javascript
function loadHookConfig(projectRoot) {
  const configPath = path.join(projectRoot, '.isdlc', 'config.json');
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return { timeoutMs: config.hook_timeout_ms || 60000 };
    }
  } catch (e) { /* config is optional */ }
  return { timeoutMs: 60000 };
}
```

---

## 7. Integration Modifications

### 7.1 `phase-advance.cjs` Changes

Insert before gate validation (after line ~69):

```javascript
const { executeHooks, buildContext } = require('../claude/hooks/lib/user-hooks.cjs');

// Before gate validation
const hookCtx = buildContext(state);
const preGateResult = executeHooks('pre-gate', hookCtx);
if (preGateResult.blocked) {
  output({
    result: 'HOOK_BLOCKED',
    phase: currentPhase,
    hook: preGateResult.blockingHook.name,
    hook_output: preGateResult.blockingHook.stdout,
    message: `User hook "${preGateResult.blockingHook.name}" blocked gate advancement`
  });
  process.exit(1);
}
```

Insert after successful advancement (after line ~140):

```javascript
// After advancement - fire post-phase hooks (non-blocking)
try {
  const postPhaseResult = executeHooks(`post-${currentPhase}`, hookCtx);
  // Warnings logged but don't block -- phase already advanced
} catch (e) { /* post-phase hooks are non-blocking */ }
```

### 7.2 `workflow-init.cjs` Changes

Insert after state write (after line ~165):

```javascript
const { executeHooks, buildContext } = require('../claude/hooks/lib/user-hooks.cjs');
try {
  const hookCtx = buildContext(state);
  const preWorkflowResult = executeHooks('pre-workflow', hookCtx);
  // Pre-workflow hooks are informational -- blocks reported but don't prevent init
} catch (e) { /* non-blocking */ }
```

### 7.3 `workflow-finalize.cjs` Changes

Insert after merge, before final output (after line ~134):

```javascript
const { executeHooks, buildContext } = require('../claude/hooks/lib/user-hooks.cjs');
try {
  const hookCtx = buildContext(state);
  const postWorkflowResult = executeHooks('post-workflow', hookCtx);
  // Post-workflow hooks are informational
} catch (e) { /* non-blocking */ }
```
