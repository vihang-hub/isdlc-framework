# Implementation Notes — REQ-0134 + REQ-0135 ProviderRuntime Adapters

## Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `src/providers/claude/runtime.js` | ~165 | Claude ProviderRuntime adapter (delegation shim) |
| `src/providers/codex/runtime.js` | ~215 | Codex ProviderRuntime adapter (child_process execution) |
| `tests/providers/claude/runtime.test.js` | ~300 | 33 unit tests for Claude adapter |
| `tests/providers/codex/runtime.test.js` | ~370 | 35 unit tests for Codex adapter |
| `docs/requirements/REQ-0134-claude-runtime-adapter/test-strategy.md` | ~85 | Test strategy document |

## Files Modified

| File | Change |
|------|--------|
| `tests/core/orchestration/provider-runtime.test.js` | Updated PR-24 test — was asserting provider runtime does NOT load (comment: "No provider runtime.js files exist yet"), updated to assert it loads successfully now that runtime.js exists |

## Key Design Decisions

### 1. Dependency Injection over Module Mocking

Both runtime adapters accept injectable dependencies via the config object:
- `_execSync` — replaces `child_process.execSync`
- `_execFile` — replaces `child_process.execFile` (Codex only)
- `_spawn` — replaces `child_process.spawn` (Codex only)
- `_readline` — replaces `node:readline` (Codex only)
- `_projectInstructions` — replaces `./projection.js` import (Codex only)

This avoids ESM module mocking complexity and keeps tests deterministic.

### 2. Claude Adapter is a Delegation Shim

The Claude runtime does NOT spawn processes. It structures a delegation prompt
and returns `{ status: 'delegated', output: { phase, agent, prompt } }`. The
actual Task tool invocation happens at the isdlc.md orchestration layer (Phase 11+).

### 3. Codex Adapter Uses Real child_process

The Codex runtime spawns `codex exec` processes via `child_process.execFile`
with a 5-minute timeout. It integrates with the projection service to build
instruction bundles from core models.

### 4. Fail-Open Pattern

Both adapters use fail-open patterns:
- `validateRuntime()` catches execSync errors and returns `{ available: false }` instead of throwing
- Codex `executeTask()` catches projection failures and falls back to minimal instructions
- Codex `presentInteractive()` resolves with empty string on spawn errors

## Test Summary

| Suite | Tests | Pass | Fail |
|-------|-------|------|------|
| Claude runtime | 33 | 33 | 0 |
| Codex runtime | 35 | 35 | 0 |
| **Total new** | **68** | **68** | **0** |
| Provider suite (full) | 161 | 161 | 0 |
| Core suite (full) | 981 | 981 | 0 |

## Constitutional Compliance

- **Article I (Specification Primacy)**: All 5 ProviderRuntime methods implemented per interface contract
- **Article II (Test-First Development)**: Tests written before implementation (TDD Red-Green)
- **Article V (Simplicity First)**: Claude adapter is minimal shim; Codex uses straightforward child_process wrappers
- **Article VII (Artifact Traceability)**: Test IDs (CRT-/XRT-) trace to AC numbers; JSDoc references REQ IDs
- **Article IX (Quality Gate Integrity)**: All artifacts present, all tests passing
