# Architecture Overview — REQ-0135 Codex ProviderRuntime adapter

**ADR**: ADR-CODEX-036

## Components

### src/providers/codex/runtime.js (~200 lines)

Single-module provider implementing the ProviderRuntime interface for Codex.

- Exports `createRuntime(config)` factory function
- All 5 ProviderRuntime methods implemented on the returned object
- Uses `child_process` for `codex exec` invocation
- Integrates with `projectInstructions()` from `src/providers/codex/projection.js` for instruction bundling
- Interactive session support via spawned `codex` process with inherited stdio

## Dependencies

- **REQ-0128** — ProviderRuntime interface contract
- **REQ-0114** — Codex instruction projection
- **REQ-0116** — Codex provider infrastructure
