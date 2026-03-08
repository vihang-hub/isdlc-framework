# Interface Specification: User-Space Hooks

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-03-08
**Coverage**: 100%

---

## 1. Public API: `user-hooks.cjs`

### 1.1 `executeHooks(hookPoint: string, context: HookContext): HookResult`

Execute all hooks discovered for the given hook point.

**Parameters**:
- `hookPoint` (string, required): Hook point identifier. Accepts both friendly names (`post-implementation`) and internal names (`post-06-implementation`). Special hook points `pre-workflow`, `post-workflow`, and `pre-gate` are used as-is (no phase resolution).
- `context` (HookContext, required): Workflow context for environment variable injection.

**Returns**: `HookResult` -- aggregated execution results. Never throws.

**Example**:
```javascript
const { executeHooks, buildContext } = require('../claude/hooks/lib/user-hooks.cjs');
const ctx = buildContext(state);
const result = executeHooks('pre-gate', ctx);
if (result.blocked) {
  // Handle block
}
```

### 1.2 `buildContext(state: object): HookContext`

Build a HookContext from the current state.json content.

**Parameters**:
- `state` (object, required): Parsed state.json content with `active_workflow` field.

**Returns**: `HookContext`

**Example**:
```javascript
const state = readState();
const ctx = buildContext(state);
// ctx.phase === '06-implementation'
// ctx.workflowType === 'feature'
```

---

## 2. Environment Variable Contract

When executing a hook script, the following environment variables are set:

| Variable | Type | Example | Description |
|----------|------|---------|-------------|
| `ISDLC_PHASE` | string | `06-implementation` | Current phase identifier |
| `ISDLC_WORKFLOW_TYPE` | string | `feature` | Workflow type |
| `ISDLC_SLUG` | string | `REQ-0055-user-space-hooks` | Workflow slug |
| `ISDLC_PROJECT_ROOT` | string | `/home/user/my-project` | Absolute path to project root |
| `ISDLC_ARTIFACT_FOLDER` | string | `docs/requirements/REQ-0055-user-space-hooks` | Artifact folder (relative path, empty string if N/A) |
| `ISDLC_HOOK_POINT` | string | `pre-gate` | The hook point being executed |

All variables are strings. Empty string for absent values (never undefined).

---

## 3. Exit Code Contract

| Exit Code | Status | Framework Behavior |
|-----------|--------|-------------------|
| 0 | Pass | Continue normally |
| 1 | Warning | Show output to user, continue |
| 2 | Block | Report to user, halt operation, present options |
| 3+ | Warning | Treated same as exit 1 (unknown codes are non-fatal) |
| -1 (internal) | Timeout/Error | Hook timed out or crashed; reported as warning |

---

## 4. Directory Convention

```
.isdlc/hooks/
  {hook-point}/
    {script-name}          # Any executable script
```

**Hook point naming**:
- `pre-workflow` -- before workflow starts
- `post-workflow` -- after workflow finalize
- `pre-gate` -- before gate validation
- `pre-{phase}` -- before a phase executes
- `post-{phase}` -- after a phase completes

**Phase names**: Both friendly (`implementation`) and internal (`06-implementation`) forms accepted.

**Script naming**: Any filename. Execution order is alphabetical. Use numeric prefixes for ordering: `01-lint.sh`, `02-test.sh`.

**Script format**: Any executable. The framework runs scripts via `sh {scriptPath}`. For non-shell scripts, use a shebang line: `#!/usr/bin/env python3`.

---

## 5. Configuration Interface

### `.isdlc/config.json` (optional)

```json
{
  "hook_timeout_ms": 60000
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `hook_timeout_ms` | number | 60000 | Maximum execution time per hook in milliseconds |

The config file is optional. All values have sensible defaults.

---

## 6. Output Contract: `phase-advance.cjs`

When a user hook blocks gate advancement, `phase-advance.cjs` outputs:

```json
{
  "result": "HOOK_BLOCKED",
  "phase": "06-implementation",
  "hook": "sast-scan.sh",
  "hook_output": "Critical vulnerability found in auth.js:42",
  "message": "User hook \"sast-scan.sh\" blocked gate advancement"
}
```

This is a new result type alongside the existing `ADVANCED`, `BLOCKED`, `WORKFLOW_COMPLETE`, and `ERROR` results.

| Field | Type | Description |
|-------|------|-------------|
| `result` | `"HOOK_BLOCKED"` | Distinguishes user-hook blocks from gate-requirement blocks |
| `phase` | string | Current phase |
| `hook` | string | Name of the blocking hook script |
| `hook_output` | string | Captured stdout from the hook |
| `message` | string | Human-readable description |

---

## 7. Internal Interface: Phase Alias Map

```javascript
// Exported for testing, not part of public API
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

Resolution algorithm:
1. For non-phase hook points (`pre-workflow`, `post-workflow`, `pre-gate`): use as-is
2. For phase-based hook points: extract prefix (`pre-`/`post-`) and phase portion
3. If phase portion matches an alias key: construct resolved name with internal identifier
4. If phase portion matches an internal identifier directly: use as-is
5. If no match: log warning, return null (hook point skipped)
