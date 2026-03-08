# Data Flow: User-Space Hooks

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-03-08
**Coverage**: 100%

---

## 1. Hook Discovery Flow

```
Trigger Point (e.g., phase-advance.cjs)
  |
  v
executeHooks(hookPoint, context)
  |
  v
resolveHookPoint(hookPoint, projectRoot)
  |-- Try exact: .isdlc/hooks/{hookPoint}/
  |-- Try alias: .isdlc/hooks/{resolved-hookPoint}/
  |-- No match? return null (skip silently)
  |
  v
discoverHooks(resolvedDir)
  |-- fs.readdirSync(dir)
  |-- Filter to files only
  |-- Sort alphabetically
  |
  v
[script1.sh, script2.sh, ...]
```

## 2. Hook Execution Flow

```
For each script in discovery order:
  |
  v
executeOneHook(scriptPath, context)
  |
  |-- Build env vars from context
  |     ISDLC_PHASE, ISDLC_WORKFLOW_TYPE, ISDLC_SLUG,
  |     ISDLC_PROJECT_ROOT, ISDLC_ARTIFACT_FOLDER, ISDLC_HOOK_POINT
  |
  |-- spawnSync('sh', [scriptPath], { env, timeout, cwd })
  |
  |-- Capture stdout, stderr, exitCode, duration
  |
  |-- Interpret exit code:
  |     0 -> pass
  |     1 -> warning
  |     2 -> block
  |     3+ -> warning
  |     timeout -> timeout
  |     error -> error
  |
  v
HookEntry { name, exitCode, stdout, stderr, durationMs, status }
```

## 3. Result Aggregation Flow

```
All HookEntry results collected
  |
  v
Aggregate into HookResult:
  |-- blocked = any entry.status === 'block'
  |-- warnings = entries where status === 'warning'
  |-- blockingHook = first entry with status === 'block' (or null)
  |
  v
Return to caller (phase-advance.cjs / workflow-init.cjs / workflow-finalize.cjs)
```

## 4. Integration Point Flows

### 4.1 Pre-Gate (phase-advance.cjs)

```
phase-advance.cjs main()
  |
  v
buildContext(state) -> HookContext
  |
  v
executeHooks('pre-gate', ctx)
  |
  |-- blocked?
  |     YES -> output HOOK_BLOCKED, exit(1)
  |     NO  -> continue to gate validation
  |
  v
[existing gate validation logic]
  |
  v
[advance phase]
  |
  v
executeHooks('post-{completedPhase}', ctx)  // non-blocking
  |
  v
output ADVANCED
```

### 4.2 Pre-Workflow (workflow-init.cjs)

```
workflow-init.cjs main()
  |
  v
[initialize workflow state]
  |
  v
executeHooks('pre-workflow', ctx)  // informational
  |
  v
[create branch, output INITIALIZED]
```

### 4.3 Post-Workflow (workflow-finalize.cjs)

```
workflow-finalize.cjs main()
  |
  v
[merge branch, update state]
  |
  v
executeHooks('post-workflow', ctx)  // informational
  |
  v
output FINALIZED
```

## 5. Config Loading Flow

```
loadHookConfig(projectRoot)
  |
  v
Read .isdlc/config.json
  |-- Exists? Parse JSON, extract hook_timeout_ms
  |-- Missing? Use default (60000ms)
  |-- Parse error? Use default (60000ms), log warning
  |
  v
{ timeoutMs: number }
```
