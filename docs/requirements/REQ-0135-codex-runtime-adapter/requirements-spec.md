# Requirements Specification — REQ-0135 Codex ProviderRuntime adapter

## Functional Requirements

### FR-001: createRuntime(config)
Factory function returning a runtime object implementing all 5 ProviderRuntime methods.

**MoSCoW**: Must Have

### FR-002: executeTask(phase, agent, context)
Calls `projectInstructions(phase, agent)` to build a markdown instruction bundle, then invokes `codex exec` with that instruction as prompt. Parses output. Returns `TaskResult`.

**MoSCoW**: Must Have

### FR-003: executeParallel(tasks[])
Spawns concurrent `codex exec` processes (`child_process.spawn`), waits for all via `Promise.allSettled`. Per-task error handling — individual failures do not reject all.

**MoSCoW**: Must Have

### FR-004: presentInteractive(prompt)
Launches interactive `codex` session with the prompt, captures user interaction, returns final output.

**MoSCoW**: Must Have

### FR-005: readUserResponse(options)
Reads from stdin (`process.stdin`) with optional prompt display. For menu selections, formats choices.

**MoSCoW**: Must Have

### FR-006: validateRuntime()
Checks Codex CLI is available (`which codex`), returns `{ available, reason? }`.

**MoSCoW**: Must Have

### FR-007: Instruction projection integration
Uses `projectInstructions()` from `src/providers/codex/projection.js` to generate per-task instruction bundles.

**MoSCoW**: Must Have

## Out of Scope

- Modifying the Codex CLI itself
