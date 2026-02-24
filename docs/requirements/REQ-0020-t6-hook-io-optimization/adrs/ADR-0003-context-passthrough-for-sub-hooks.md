# ADR-0003: Context Passthrough for Sub-Hook Config Access

## Status
Accepted

## Context
Sub-hooks running inside dispatchers receive a `ctx` object containing `{ input, state, manifest, requirements, workflows }`. Some sub-hooks already use `ctx.requirements || fallback` to prefer the dispatcher-provided config. However, `gate-blocker.cjs` at line 369 (`checkAgentDelegationRequirement`) bypasses this pattern and calls `loadManifest()` directly, triggering an unnecessary disk read even though `ctx.manifest` is available.

The goal is to ensure all sub-hooks consistently use the dispatcher-provided config from `ctx` when available, while preserving standalone mode (backward compatibility).

Traces to: FR-004, AC-004a, AC-004b, AC-004c, AC-004d, NFR-002

## Decision
Standardize the **context passthrough pattern** across all sub-hooks:

1. **Dispatcher populates ctx**: All 5 dispatchers already populate `ctx.manifest`, `ctx.requirements`, `ctx.workflows` from the cached loaders. No change needed.

2. **Sub-hooks prefer ctx**: Each sub-hook's `check(ctx)` function uses the pattern:
   ```javascript
   const manifest = ctx.manifest || loadManifest();
   ```

3. **gate-blocker fix**: The `checkAgentDelegationRequirement` function signature is changed to accept a `manifest` parameter (or read from a closure variable set in `check(ctx)`), eliminating the direct `loadManifest()` call at line 369.

4. **Standalone mode preserved**: When a hook is run via `require.main === module` (standalone execution outside a dispatcher), the standalone entrypoint builds its own `ctx` with freshly loaded configs. This path is unchanged.

## Consequences

**Positive:**
- Eliminates 1-3 redundant config reads per dispatcher invocation (from sub-hooks that bypass ctx)
- Establishes a consistent pattern: all config access goes through ctx when inside a dispatcher
- No breaking changes: `check(ctx)` signature is unchanged; ctx fields are optional (fail-open via `|| fallback`)
- Standalone mode continues to work identically

**Negative:**
- gate-blocker's `checkAgentDelegationRequirement` needs a signature change or closure refactoring. This is a minor code change (~5 lines) but requires updating the corresponding test.
- Sub-hooks become more reliant on dispatchers populating ctx correctly. If a dispatcher omits `ctx.manifest`, the fallback to `loadManifest()` fires (fail-open), but with a disk read. This is the existing behavior, so no regression.

## Alternatives Considered

| Alternative | Reason for Rejection |
|-------------|---------------------|
| Remove standalone mode from sub-hooks | Breaks backward compatibility; standalone mode is used for testing and debugging |
| Global singleton pattern | Would require a module-level state object shared across all hooks; more complex than ctx passthrough |
| Environment variable for config paths | Hooks already have CLAUDE_PROJECT_DIR; adding more env vars adds complexity |
| Dependency injection framework | Massively over-engineered for the use case (Article V) |
