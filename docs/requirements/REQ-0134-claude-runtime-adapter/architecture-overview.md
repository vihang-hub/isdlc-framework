# Architecture Overview — REQ-0134 Claude ProviderRuntime adapter

**ADR**: ADR-CODEX-035

## Components

### src/providers/claude/runtime.js (~180 lines)

Single-module provider implementing the ProviderRuntime interface for Claude Code.

- Exports `createRuntime(config)` factory function
- All 5 ProviderRuntime methods implemented on the returned object
- Task tool delegation for phase agent execution
- Relay-and-resume pattern for interactive phases
- Agent `.md` files referenced via PHASE_AGENT_MAP

## Dependencies

- **REQ-0128** — ProviderRuntime interface contract
- **REQ-0087** — Provider-aware infrastructure
