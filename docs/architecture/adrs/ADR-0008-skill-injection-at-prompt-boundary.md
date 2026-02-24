# ADR-0008: External Skill Injection at Prompt Boundary (STEP 3d)

## Status

Accepted

## Context

The custom skill management feature (REQ-0022) requires injecting user-provided skill content into agent Task prompts during workflow execution. The injection must be:

- Fail-open (NFR-003): injection failures must never block workflow progression
- Non-interfering with hooks (CON-004): must not affect the 26-hook dispatch system
- Backward compatible (NFR-005): projects without skills must experience zero change
- Performant (NFR-001): <100ms additional latency

There are three candidate injection points:
1. **Hook level** (PreToolUse hooks): Intercept Task tool calls and modify prompts
2. **Agent level** (agent .md files): Embed injection logic in each agent's prompt
3. **Prompt boundary** (STEP 3d in isdlc.md): Insert between prompt construction and Task tool invocation

## Decision

Inject external skill content at the prompt boundary in STEP 3d of `isdlc.md`, after constructing the base delegation prompt and before invoking the Task tool.

## Consequences

**Positive:**
- Single injection point for all phase agents (no per-agent modifications needed)
- Fail-open design is trivial: wrap in try/catch, fall through to unmodified prompt on error
- No hook interference: injection happens before hooks see the Task tool call
- Backward compatible: when no manifest exists, `loadExternalManifest()` returns null and injection is a no-op
- Agent prompts remain clean: skill content is appended, not embedded
- Easy to reason about: one code block in one file handles all injection

**Negative:**
- isdlc.md grows by ~50-80 lines (already 1407 lines)
- Injection logic is in a markdown prompt file, not testable via unit tests (integration test only)
- Cannot inject skills for agents invoked outside the phase-loop controller (e.g., direct Task tool calls)

## Alternatives Considered

### Hook-level injection (Rejected)
- Would require a new hook or modifying PreToolUse dispatchers
- Hooks operate on tool inputs, not prompt content -- would need to parse and modify Task tool parameters
- Violates CON-004 (hook system compatibility)
- Adds complexity to the already-complex 5-dispatcher hook architecture

### Agent-level injection (Rejected)
- Would require modifying each of the ~20 phase agent .md files
- Each agent would need to read the manifest and inject skills independently
- Massive blast radius and maintenance burden
- Inconsistent behavior if one agent's injection logic diverges

## Requirement Traceability

- FR-005 (Runtime Skill Injection)
- NFR-001 (Injection Performance)
- NFR-003 (Fail-Open Injection)
- NFR-005 (Backward Compatibility)
- CON-004 (Hook System Compatibility)
- Article X (Fail-Safe Defaults)
