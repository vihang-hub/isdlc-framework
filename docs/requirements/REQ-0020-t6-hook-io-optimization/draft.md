# T6: Hook I/O Optimization

**Source**: BACKLOG.md item 2.2
**Category**: Performance

## Description

Reduce disk reads in hook dispatchers. The hook system currently performs redundant file I/O operations that add latency to every tool invocation. Four optimization opportunities have been identified:

### T6-A: Config caching
Cache skills-manifest.json (50-200KB), iteration-requirements.json, and workflows.json with mtime invalidation. Saves 30-50ms per invocation.

### T6-B: writeState() double-read elimination
BUG-0009 optimistic locking reads disk to get version before writing, adds 10-20ms per write. Trust in-memory version instead.

### T6-C: getProjectRoot() caching
Compute once per dispatcher, not per sub-hook. Saves 5-10ms per hook.

### T6-D: Post-write/edit triple I/O consolidation
Dispatcher + validators + workflow-completion-enforcer do 4-5 sequential state reads. Consolidate to single read passed through context.
