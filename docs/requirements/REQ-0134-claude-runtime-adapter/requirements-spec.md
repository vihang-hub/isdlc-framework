# Requirements Specification — REQ-0134 Claude ProviderRuntime adapter

## Functional Requirements

### FR-001: createRuntime(config)
Factory function returning a runtime object implementing all 5 ProviderRuntime methods.

**MoSCoW**: Must Have

### FR-002: executeTask(phase, agent, context)
Spawns a Claude Code Task tool subagent with the agent name as `subagent_type`, passes context as the prompt. Returns `TaskResult` with `status`, `output`, `duration_ms`.

**MoSCoW**: Must Have

### FR-003: executeParallel(tasks[])
Spawns multiple Task tool calls in a single message (Claude's parallel tool calling). Collects all results preserving order. Per-task error handling — individual failures do not reject all.

**MoSCoW**: Must Have

### FR-004: presentInteractive(prompt)
Implements the relay-and-resume pattern: outputs prompt to user, collects response, returns it. For conversational agents (roundtable, requirements), maintains the resume loop.

**MoSCoW**: Must Have

### FR-005: readUserResponse(options)
Presents options/prompt to user via AskUserQuestion tool or natural conversation, returns their text.

**MoSCoW**: Must Have

### FR-006: validateRuntime()
Checks Claude CLI is available (`which claude`), returns `{ available, reason? }`.

**MoSCoW**: Must Have

## Out of Scope

- Modifying `isdlc.md` or agent `.md` files
