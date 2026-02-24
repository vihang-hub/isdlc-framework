# Quick Scan: T6 Hook I/O Optimization

**Generated**: 2026-02-16
**Codebase Hash**: 9780bd7

## Scope Estimate

| Metric | Value |
|--------|-------|
| Files in scope | 12 (5 dispatchers + 5 sub-hooks + 2 lib files) |
| Modules affected | 2 (hooks, hooks/lib) |
| Risk level | Low-medium (pure performance, no behavior change) |
| Estimated complexity | Medium (internal refactoring across shared functions) |

## Keyword Matches

| Pattern | Files | Occurrences |
|---------|-------|-------------|
| `getProjectRoot()` | 8 | 33 calls |
| `readFileSync` (config) | 7 | ~15 config reads per workflow event |
| `loadManifest()` | 6 | 6+ calls per pre-task invocation |
| `loadIterationRequirements()` | 5 | 5+ calls per invocation |
| `loadWorkflowDefinitions()` | 4 | 4+ calls per invocation |
| `writeState()` | 8 | 1 read-before-write per call |
| `readState()` | 10 | 4-6 reads per post-write/edit event |

## Sub-Task Viability Assessment

| Sub-Task | Still Relevant? | Estimated Savings | Notes |
|----------|----------------|-------------------|-------|
| T6-A: Config caching | YES | 30-50ms/invocation | No caching exists. 3 config files loaded fresh every invocation. |
| T6-B: writeState() double-read | PARTIALLY — cannot eliminate | 0ms (needed for locking) | Read-before-write is required for optimistic locking (BUG-0009). Hooks run as independent processes. Can reduce write frequency instead. |
| T6-C: getProjectRoot() caching | YES | 5-10ms/invocation | 5-10 traversals per dispatcher invocation. Easy win with per-process cache. |
| T6-D: Post-write/edit I/O | YES | 15-25ms/event | state-write-validator reads state.json 3-4 times internally. Consolidatable. |

## Key Finding: T6-B Revised

The original backlog spec assumed writeState() could trust in-memory versions. Analysis shows this is **not safe** because hooks run as independent Node.js processes (no shared memory). The read-before-write is necessary for correctness.

**Revised T6-B scope**: Instead of eliminating the read, reduce the frequency of writeState() calls by batching state modifications within each dispatcher invocation. Currently some dispatchers write state multiple times (once per hook that modifies state). Batching to a single write-at-end saves 1-2 writes per invocation.

## Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `src/claude/hooks/lib/common.cjs` | MODIFY | Add config cache, projectRoot cache, expose cached loaders |
| `src/claude/hooks/pre-task-dispatcher.cjs` | MODIFY | Use cached configs, pass projectRoot to sub-hooks |
| `src/claude/hooks/pre-skill-dispatcher.cjs` | MODIFY | Use cached configs, pass projectRoot to sub-hooks |
| `src/claude/hooks/post-task-dispatcher.cjs` | MODIFY | Use cached configs, pass projectRoot to sub-hooks |
| `src/claude/hooks/post-bash-dispatcher.cjs` | MODIFY | Use cached configs, pass projectRoot to sub-hooks |
| `src/claude/hooks/post-write-edit-dispatcher.cjs` | MODIFY | Use cached configs, consolidate state reads |
| `src/claude/hooks/state-write-validator.cjs` | MODIFY | Read state once, share across V7/V8/V1-V3 |
| `src/claude/hooks/gate-blocker.cjs` | MODIFY | Use ctx.manifest instead of loadManifest() |
| `src/claude/hooks/iteration-corridor.cjs` | MODIFY | Use ctx.requirements instead of loading |
| `src/claude/hooks/constitution-validator.cjs` | MODIFY | Use ctx.requirements instead of loading |
| `src/claude/hooks/test-watcher.cjs` | MODIFY | Use ctx.requirements instead of loading |
| `src/claude/hooks/blast-radius-validator.cjs` | MODIFY | Use ctx passed from dispatcher |
