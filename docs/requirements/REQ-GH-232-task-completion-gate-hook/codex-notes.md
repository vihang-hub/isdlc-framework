# Codex Provider Notes: task-completion-gate hook

**Source**: GitHub #232
**Traces**: ADR-000 (Hook Location Strategy)
**Decision**: No Codex wiring required for this requirement.

## Rationale

The task-completion-gate hook is a Claude Code PreToolUse hook registered via
`src/claude/settings.json`. It intercepts `Edit|Write` tool calls targeting
`.isdlc/state.json` and blocks phase completion transitions when tasks.md has
unfinished top-level tasks.

Claude Code hooks are **provider-specific**: the `settings.json` → `PreToolUse`
contract (stdin JSON, exit 2 to block, stderr for block messages) is a Claude
Code runtime mechanism. It has no direct equivalent in the Codex provider.

## Codex Architecture (for reference)

Codex uses a different execution model — see `src/providers/codex/`:
- **Projection bundles** (`projection.js`): bundle agent/skill/command content for `codex exec`
- **Runtime adapter** (`runtime.js`): invokes `codex exec` with the projected bundle
- **Task dispatch** (`task-dispatch.js`): orchestrates multi-agent delegation

Codex does not expose a per-tool-call PreToolUse event. Provider-neutral gating
in Codex happens through the projection/verb-resolver layer, not through
intercepting tool invocations.

## Scope Boundary

REQ-GH-232 implements **Claude Code enforcement only** for Article I.5
(task completion before phase advancement). Cross-provider parity for this
behavior is a separate concern and not in scope.

## Future Consideration

If/when Codex adds a pre-mutation gate mechanism (or if provider-neutral
enforcement becomes required), revisit this decision and consider either:
1. A provider-neutral guard in `src/core/` invoked by both runtimes, or
2. A Codex-specific adapter in `src/providers/codex/` that mirrors the Claude
   hook's gate semantics.

For now, the single-provider implementation is deliberate and sufficient.
