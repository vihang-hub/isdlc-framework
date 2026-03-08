# Design Summary: User-Space Hooks

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-03-08
**Coverage**: 100%

---

## Overview

User-space hooks add a general-purpose extension mechanism to iSDLC. Developers drop shell scripts into `.isdlc/hooks/{hook-point}/` directories and the framework executes them at the corresponding workflow lifecycle moments. No registration, no configuration, no framework modifications required.

## Key Design Decisions

1. **Separate engine in harness layer** (ADR-001): User-space hooks run via a new `user-hooks.cjs` module in `src/claude/hooks/lib/` (harness infrastructure, alongside `common.cjs` and `gate-logic.cjs`). Completely isolated from the 26 existing framework hooks. Different execution model (shell + exit codes vs. JSON stdin/stdout), different user content directory (`.isdlc/hooks/` vs. `src/claude/hooks/`), no interaction between the two systems. The engine is harness infrastructure accessible to any consumer, not scoped to antigravity.

2. **Phase alias resolution** (ADR-002): Developers can use friendly names (`post-implementation`) or internal identifiers (`post-06-implementation`). The framework resolves aliases by stripping numeric prefixes from the phase library.

3. **Environment variable context** (ADR-003): Workflow context (phase, type, slug, project root) is passed via `ISDLC_*` environment variables. Universal access from any language, no parsing required.

## Module Structure

- **`src/claude/hooks/lib/user-hooks.cjs`** (new): Core engine with 4 exported functions -- `executeHooks`, `discoverHooks`, `resolveHookPoint`, `buildContext`. Part of harness infrastructure, updated with the framework. User hook scripts in `.isdlc/hooks/` are preserved across updates.
- **3 initial integration points**: `phase-advance.cjs` (pre-gate + post-phase), `workflow-init.cjs` (pre-workflow), `workflow-finalize.cjs` (post-workflow). Any future tool using the harness can also import and call `executeHooks`.

## Hook Point Pattern

| Pattern | When It Fires |
|---------|--------------|
| `pre-workflow` | After workflow initialization |
| `pre-{phase}` | Before a phase executes |
| `post-{phase}` | After a phase completes |
| `pre-gate` | Before gate validation |
| `post-workflow` | After workflow finalization |

## Safety Model

- Exit 0 = pass, Exit 1 = warning, Exit 2 = block
- Blocks only halt at pre-gate (other hook points are informational)
- User has final authority over block resolution
- Configurable timeout (default 60s) with kill enforcement
- Hook failures never crash the framework
