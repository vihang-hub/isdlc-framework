# Module Design — REQ-0134 Claude ProviderRuntime adapter

## File: src/providers/claude/runtime.js (~180 lines)

### createRuntime(config)

Returns an object implementing all 5 ProviderRuntime methods.

### Methods

#### executeTask(phase, agent, context)
- Constructs prompt with phase/agent/context + skill injection + gate requirements
- Delegates to Task tool with `subagent_type` resolved from `PHASE_AGENT_MAP`
- Returns `TaskResult` with `status`, `output`, `duration_ms`

#### executeParallel(tasks[])
- Launches multiple Task tools in one message (Claude's parallel tool calling)
- Collects results via `Promise.allSettled`
- Preserves order; per-task error handling (individual failures do not reject all)

#### presentInteractive(prompt)
- Outputs text to user, waits for reply, returns it
- Implements the relay loop from `isdlc.md` step 3d-relay
- Used for conversational agents (roundtable, requirements elicitation)

#### readUserResponse(options)
- Simple prompt → response via AskUserQuestion tool or natural conversation
- Returns user's text

#### validateRuntime()
- Checks for Claude CLI via `which`/`where`
- Returns `{ available: boolean, reason?: string }`

### Constants

#### PHASE_AGENT_MAP
Frozen object mapping phase keys to Claude agent `subagent_type` names. Used by `executeTask` to resolve which agent `.md` file to delegate to.
