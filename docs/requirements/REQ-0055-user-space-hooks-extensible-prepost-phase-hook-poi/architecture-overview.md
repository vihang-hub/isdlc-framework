# Architecture Overview: User-Space Hooks

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-03-08
**Coverage**: 100%

---

## 1. Architecture Decision: Hook Execution Model

### ADR-001: Separate Engine vs. Extend Existing Hook System

**Context**: The framework has 26 existing hooks using Claude Code's JSON stdin/stdout protocol. User-space hooks need a simpler execution model (shell scripts with exit codes).

**Option A: Extend existing hook system** -- Add user-space hooks as a new hook type within `src/claude/hooks/`
- Pros: Single hook infrastructure, shared utilities
- Cons: Claude Code hooks have a specific JSON protocol (PreToolUse/PostToolUse/Stop); user hooks are shell scripts. Mixing creates coupling. A broken user hook could interfere with framework enforcement hooks.

**Option B: Separate engine** (SELECTED) -- New `user-hooks.cjs` module in `src/claude/hooks/lib/` (alongside `common.cjs` and `gate-logic.cjs`) with its own discovery and execution logic
- Pros: Clean isolation -- user hooks cannot affect framework hooks. Simpler API (exit codes vs. JSON). Independent timeout and error handling. Matches the "isolation between layers" design principle from the hackability roadmap. Lives in the shared harness infrastructure layer, accessible to any consumer (antigravity scripts, future tools). Follows the same pattern as user skills -- engine is framework code, user content is in `.isdlc/`.
- Cons: Minimal -- shares the `lib/` directory with framework hook utilities, but the module is self-contained.

**Decision**: Option B. The engine is harness infrastructure (like the user skills engine), not an antigravity-specific feature. Placing it in `src/claude/hooks/lib/` makes it available to any tool that uses the harness. The user's hook scripts live in `.isdlc/hooks/` (user space, never overwritten by the updater). The update scripts (`update.sh`, `lib/updater.js`) already preserve `.isdlc/hooks/` -- it is not in the overwrite list.

---

## 2. Architecture Decision: Phase Name Resolution Strategy

### ADR-002: Strict Matching vs. Alias Resolution

**Context**: Phases have internal identifiers (e.g., `06-implementation`) that are not intuitive for users to type as directory names.

**Option A: Strict matching only** -- User must use exact phase identifiers
- Pros: No ambiguity, simple implementation
- Cons: Poor developer experience; requires documentation lookup for every hook

**Option B: Alias resolution with fallback** (SELECTED) -- Maintain a map of friendly names to internal identifiers. Try friendly name first, then exact match, then warn.
- Pros: Good developer experience ("post-implementation" just works). Exact names still work for power users. Unrecognized names produce a warning, not a silent failure.
- Cons: Alias map must be maintained. Mitigated by deriving aliases from phase identifiers (strip numeric prefix).

**Decision**: Option B. The alias map is small (derived from the fixed phase library) and the developer experience improvement is significant.

---

## 3. Architecture Decision: Hook-to-Framework Communication

### ADR-003: Environment Variables vs. JSON Stdin vs. Temporary File

**Context**: Hooks need workflow context (phase, workflow type, slug, project root) to make meaningful decisions.

**Option A: JSON stdin** -- Pipe workflow context as JSON to hook's stdin
- Pros: Structured data, extensible
- Cons: Requires hooks to parse JSON (not all languages have trivial JSON parsing). Adds complexity for simple bash scripts.

**Option B: Environment variables** (SELECTED) -- Set `ISDLC_*` environment variables before execution
- Pros: Universal -- every language and shell can read environment variables. Simple for bash scripts (`$ISDLC_PHASE`). No parsing required. Easy to extend (add new vars without breaking existing hooks).
- Cons: Flat namespace (no nested data). Mitigated by keeping context shallow.

**Option C: Temporary JSON file** -- Write context to a temp file, pass path as argument
- Pros: Structured, no stdin complexity
- Cons: File cleanup needed, race conditions on parallel execution

**Decision**: Option B. Environment variables are the simplest and most universally accessible mechanism. Hooks that need structured data can read files themselves.

---

## 4. Component Architecture

```
.isdlc/hooks/                          (User's project)
  pre-workflow/
    notify-team.sh
  post-implementation/
    run-sast.sh
    validate-xml.sh
  pre-gate/
    custom-lint.sh
  post-workflow/
    update-jira.sh

src/claude/hooks/lib/                   (Framework - harness infrastructure)
  user-hooks.cjs          <-- NEW: Discovery + Execution engine
  common.cjs              <-- EXISTING: Shared utilities (getProjectRoot, readState)
  gate-logic.cjs           <-- EXISTING: Gate requirement checks

src/antigravity/                        (Framework - workflow lifecycle)
  phase-advance.cjs       <-- MODIFIED: Calls user-hooks at pre-gate, post-phase
  workflow-init.cjs        <-- MODIFIED: Calls user-hooks at pre-workflow
  workflow-finalize.cjs    <-- MODIFIED: Calls user-hooks at post-workflow
```

### 4.1 `user-hooks.cjs` Responsibilities

1. **discoverHooks(hookPoint)**: Scan `.isdlc/hooks/{hookPoint}/` for executable files. Return sorted list.
2. **resolveHookPoint(hookPoint)**: Apply phase alias resolution. `post-implementation` -> `post-06-implementation`. Try alias first, then exact match.
3. **executeHooks(hookPoint, context)**: Run discovered hooks sequentially. Set env vars from context. Enforce timeout. Collect results.
4. **buildContext(state)**: Build the context object from current workflow state (phase, type, slug, root, artifact folder).

### 4.2 Integration Pattern

Each integration point follows the same pattern:

```javascript
const { executeHooks, buildContext } = require('../claude/hooks/lib/user-hooks.cjs');

// In phase-advance.cjs, before gate validation:
const ctx = buildContext(state);
const preGateResults = executeHooks('pre-gate', ctx);
// Handle blocks/warnings from preGateResults

// After successful advancement:
const postPhaseResults = executeHooks(`post-${previousPhase}`, ctx);
```

### 4.3 Result Object

```javascript
{
  hookPoint: 'pre-gate',
  hooks: [
    { name: 'custom-lint.sh', exitCode: 0, stdout: '...', stderr: '', durationMs: 1200, status: 'pass' },
    { name: 'sast-scan.sh', exitCode: 2, stdout: '...', stderr: '', durationMs: 5400, status: 'block' }
  ],
  blocked: true,
  warnings: [],
  blockingHook: { name: 'sast-scan.sh', stdout: '...' }
}
```

---

## 5. Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Engine language | Node.js (CJS) | Consistent with harness infrastructure (common.cjs, gate-logic.cjs) |
| Child process API | `execSync` / `spawnSync` | Sequential execution, timeout support via `timeout` option |
| Config location | `.isdlc/config.json` | Consistent with roadmap convention for user-space config |
| Alias derivation | Strip numeric prefix from phase ID | `06-implementation` -> `implementation`. Simple, predictable. |

---

## 6. Integration Points

| Integration Point | Trigger | Hook Points Available |
|-------------------|---------|----------------------|
| `workflow-init.cjs` | After workflow state initialized | `pre-workflow` |
| `phase-advance.cjs` | Before gate validation | `pre-gate` |
| `phase-advance.cjs` | After successful advancement | `post-{completed-phase}` |
| `workflow-finalize.cjs` | After merge/finalize | `post-workflow` |

Note: `pre-{phase}` hooks for the next phase would fire at the start of the next phase's agent delegation, not during phase-advance. This may be deferred to a follow-up if the current integration points prove sufficient.
