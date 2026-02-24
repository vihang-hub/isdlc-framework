# ADR-0027: Self-Contained SessionStart Hook (No common.cjs Dependency)

## Status

Accepted

## Context

The `inject-session-cache.cjs` SessionStart hook needs to read `.isdlc/session-cache.md` and output it to stdout. It fires at every session startup and resume event.

The project has a shared utility library (`common.cjs`, 3,909 lines) that provides project root resolution, state management, and other functions. All existing hooks depend on common.cjs.

We need to decide whether the SessionStart hook should import common.cjs or be self-contained.

## Decision

The SessionStart hook is **self-contained** with zero dependency on common.cjs. It uses only Node.js built-in modules (`fs`, `path`) and the `CLAUDE_PROJECT_DIR` environment variable.

```javascript
const cachePath = path.join(
  process.env.CLAUDE_PROJECT_DIR || process.cwd(),
  '.isdlc', 'session-cache.md'
);
```

## Consequences

**Positive:**
- Hook startup time is minimal (<10ms). Loading common.cjs takes measurably longer due to its 3,909-line module initialization.
- No coupling to common.cjs changes. The hook is immune to regressions in the shared library.
- The hook does exactly one thing: read a file and write it to stdout. This aligns with the Unix philosophy and Article V (Simplicity First).
- No risk of common.cjs side effects (cache warming, state reads) at session start.

**Negative:**
- Cannot use `getProjectRoot()` for resolution. Must rely on `CLAUDE_PROJECT_DIR` or `process.cwd()`. Claude Code always sets `CLAUDE_PROJECT_DIR`, so this is reliable.
- Monorepo project resolution is not available. The cache file is at a fixed path (`.isdlc/session-cache.md`), not project-scoped. This matches the out-of-scope declaration (OOS-003: multi-project cache isolation is a future enhancement).
- Duplicate path logic (project root resolution) -- a minor DRY violation that is justified by the performance and simplicity benefits.

## Alternatives Considered

- **Import common.cjs**: Provides `getProjectRoot()` and monorepo support. Rejected because it adds ~50-100ms module initialization overhead at every session start, and the hook does not need any common.cjs functionality beyond project root resolution (which `CLAUDE_PROJECT_DIR` provides directly).
- **Import only getProjectRoot**: Destructured import. Rejected because Node.js still loads and parses the entire common.cjs module even for a single destructured export.

## Traces

- **Requirements**: FR-002, NFR-003 (hook execution <5000ms), NFR-008 (CommonJS convention)
- **Constitutional Articles**: Article V (Simplicity First)
