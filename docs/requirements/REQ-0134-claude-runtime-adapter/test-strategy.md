# Test Strategy — REQ-0134 Claude ProviderRuntime Adapter + REQ-0135 Codex ProviderRuntime Adapter

## Scope

Unit tests for two provider runtime adapters that implement the ProviderRuntime
interface defined in `src/core/orchestration/provider-runtime.js`.

| Adapter | Source | Test File | Est. Tests |
|---------|--------|-----------|------------|
| Claude | `src/providers/claude/runtime.js` | `tests/providers/claude/runtime.test.js` | ~30 |
| Codex | `src/providers/codex/runtime.js` | `tests/providers/codex/runtime.test.js` | ~35 |

## Test Framework

- **Runner**: `node:test` (project standard)
- **Assertions**: `node:assert/strict`
- **Mocking**: `node:test` mock API (`mock.method`, `mock.fn`)
- **Test command**: `npm run test:providers`
- **Naming**: `{PREFIX}-NN: description (AC-NNN-NN)` per project convention

## Mocking Strategy

Both adapters use `child_process` for CLI validation and (Codex) task execution.
All `child_process` calls are mocked — no real CLI spawning in tests.

### Claude Runtime Mocks
- `child_process.execSync` — mocked for `validateRuntime()` (which claude)
- No other child_process calls (Claude runtime is a delegation shim)

### Codex Runtime Mocks
- `child_process.execSync` — mocked for `validateRuntime()` (which codex)
- `child_process.execFile` — mocked for `executeTask()` (codex exec)
- `child_process.spawn` — mocked for `presentInteractive()` (codex interactive)
- `readline` — mocked for `readUserResponse()` (stdin prompting)
- `projectInstructions` — imported from `./projection.js`, tested via real call

### Dependency Injection Pattern
Both runtime modules accept a `config` object. For testability, the config can
include `_execSync`, `_execFile`, `_spawn` overrides that tests provide instead
of the real `child_process` functions. This avoids module-level mocking complexity
with ESM and keeps tests deterministic.

## Test Categories

### 1. Interface Compliance (both adapters)
- `createRuntime(config)` returns object passing `validateProviderRuntime()`
- All 5 methods exist and are functions
- Test ID prefix: `CRT-` (Claude Runtime), `XRT-` (Codex Runtime)

### 2. executeTask (both adapters)
- Returns TaskResult with `status`, `output`, `duration_ms` fields
- Claude: returns `{ status: 'delegated', output: { phase, agent, prompt } }`
- Codex: calls projectInstructions, invokes codex exec, parses result
- Codex: handles exec failure gracefully (returns status: 'failed')
- Input validation: rejects missing phase/agent

### 3. executeParallel (both adapters)
- Returns array matching input length
- Preserves order
- Handles per-task failures without rejecting all
- Empty input returns empty array

### 4. presentInteractive (both adapters)
- Claude: returns structured intent `{ type: 'interactive', prompt }`
- Codex: spawns codex process, returns collected output

### 5. readUserResponse (both adapters)
- Claude: returns structured intent `{ type: 'user_input', options }`
- Codex: uses readline, formats choices as numbered list

### 6. validateRuntime (both adapters)
- Success path: CLI found, returns `{ available: true }`
- Failure path: CLI not found, returns `{ available: false, reason: '...' }`

### 7. PHASE_AGENT_MAP (Claude only)
- Exported and frozen
- Has entries for all standard phases (01 through 16+)
- Values are strings (agent subagent_type names)

## Coverage Target

- Line coverage: >= 80%
- Branch coverage: >= 80%
- All error paths exercised (try/catch in validateRuntime, exec failures)

## Constitutional Compliance

- **Article I**: Tests verify exact spec compliance (TaskResult fields, method signatures)
- **Article II**: Tests written before implementation (TDD Red phase)
- **Article V**: Minimal test setup, no over-mocking
- **Article VII**: Test IDs trace to requirement ACs
- **Article IX**: All artifacts present before gate
