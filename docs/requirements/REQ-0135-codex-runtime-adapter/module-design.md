# Module Design — REQ-0135 Codex ProviderRuntime adapter

## File: src/providers/codex/runtime.js (~200 lines)

### createRuntime(config)

Returns an object implementing all 5 ProviderRuntime methods.

### Methods

#### executeTask(phase, agent, context)
- Calls `projectInstructions(phase, agent)` to build markdown instruction bundle
- Invokes `codex exec --prompt "{instructions}"` via `child_process.execFile` with timeout
- Parses stdout as JSON if possible, else wraps as `{ status: 'completed', output: stdout }`
- Returns `TaskResult`

#### executeParallel(tasks[])
- `Promise.allSettled(tasks.map(t => executeTask(t.phase, t.agent, t.context)))`
- Preserves order; per-task error handling (individual failures do not reject all)

#### presentInteractive(prompt)
- `spawn('codex', [prompt])` with `stdio: 'inherit'` for interactive mode
- Captures exit code and output
- Used for conversational phases (roundtable, requirements elicitation)

#### readUserResponse(options)
- `process.stdin` readline with prompt
- Formats choices if `options.choices` provided

#### validateRuntime()
- `execSync('which codex')` wrapped in try/catch
- Returns `{ available: boolean, reason?: string }`
