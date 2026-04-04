# Module Design: task-completion-gate hook

**Source**: GitHub #232
**Slug**: REQ-GH-232-task-completion-gate-hook
**Created**: 2026-04-05
**Status**: Accepted

## 1. Module Inventory

| Module | Location | Kind | Responsibility |
|--------|----------|------|----------------|
| M1: task-completion-gate | `src/claude/hooks/task-completion-gate.cjs` | Hook entry (CJS) | stdin parsing, state loading, delegate to logic, emit block response |
| M2: task-completion-logic | `src/claude/hooks/lib/task-completion-logic.cjs` | Pure logic (CJS) | State diff, transition detection, task counting, message formatting |
| M3: tasks-bridge | `src/core/bridge/tasks.cjs` | Bridge (CJS → ESM) | CJS wrapper for `readTaskPlan()` from `src/core/tasks/task-reader.js` |
| M4: isdlc.md amendment | `src/claude/commands/isdlc.md` | Markdown spec | Add `3f-task-completion` handler to STEP 3f dispatch |
| M5: settings.json registration | `src/claude/settings.json` | Config | Register M1 in `hooks.PreToolUse` |

**Dependency graph** (no circular dependencies):
```
M1 (hook)  -->  M2 (logic)
                M3 (bridge)  -->  src/core/tasks/task-reader.js (ESM, unchanged)
                common.cjs (existing, unchanged)

M4 (isdlc.md) -->  M1 (via block message format contract)
M5 (settings.json) -->  M1 (via hook registration)
```

## 2. Interface Contracts

### 2.1 M1: task-completion-gate.cjs (hook entry)

**Input**: stdin JSON from Claude Code event loop.
```
{
  "tool_name": "Edit" | "Write",
  "tool_input": {
    "file_path": string,
    "new_string"?: string,    // Edit tool
    "content"?: string        // Write tool
  }
}
```

**Output**: stderr text + process exit code.
- Exit 0: allow (fail-open or no violation)
- Exit 2: block (violation detected); stderr contains TASKS INCOMPLETE message

**Entry point**: `if (require.main === module) { ... }` — async IIFE reading stdin, loading state, calling M2, emitting response.

**Pseudocode**:
```
async main():
    inputStr = readStdin()
    if empty or malformed: exit 0                           # TCG-001
    input = JSON.parse(inputStr)
    if input.tool_input.file_path does not end ".isdlc/state.json": exit 0
    state = readState()                                     # common.cjs
    if state missing or active_workflow.type !== "build": exit 0  # TCG-004
    tasksPath = resolve(projectRoot, "docs/isdlc/tasks.md")
    taskPlan = await readTaskPlan(tasksPath)                # via M3 bridge
    result = check({ input, state, taskPlan })              # M2
    if result.decision === "block":
        console.error(result.stderr)
        outputBlockResponse(result.stopReason)
        exit 2
    exit 0
catch any error: exit 0                                     # TCG-009
```

### 2.2 M2: task-completion-logic.cjs (pure logic)

**Exported functions**:

```
check(ctx) → Result
  ctx = { input, state, taskPlan }
  Result = {
    decision: "block" | "allow",
    stderr?: string,
    stopReason?: string,
    phaseKey?: string,
    unfinishedTasks?: Array<{ id, description }>
  }
```

```
detectPhaseCompletionTransition(oldState, newState)
  → { phaseKey: string, isTransition: true } | null

  Scans newState.phases for any key where:
    newState.phases[k].status === "completed"
    AND (oldState.phases[k]?.status || null) !== "completed"
  Returns first match; null if none.
```

```
countUnfinishedTopLevelTasks(taskPlan, phaseKey)
  → Array<{ id: string, description: string }>

  Filters taskPlan tasks where:
    task.phase === phaseKey
    task.status === "pending"   (i.e., [ ] marker)
    task.parent_id === null     (top-level only, excludes sub-tasks)
  Maps to { id, description }; returns empty array on any null/undefined.
```

```
formatBlockMessage(phaseKey, unfinishedTasks) → string

  Returns exact message per AC-001-02:
    TASKS INCOMPLETE: Phase {phaseKey} has {N} unfinished top-level tasks.

    Unfinished tasks (docs/isdlc/tasks.md):
      - [ ] T{id}: {description}
      ...

    Article I.5: User-confirmed task plans are binding specifications.
    Complete remaining tasks, then retry phase completion.
```

**Internal helpers** (not exported):
- `parseNewStateFromInput(toolInput)` → parsed object | null (tries new_string then content)
- `isBuildWorkflowActive(state)` → boolean
- `hasMatchingPhaseSection(taskPlan, phaseKey)` → boolean

### 2.3 M3: tasks-bridge (src/core/bridge/tasks.cjs)

```
async function readTaskPlan(absolutePath) → TaskPlan | null

  Dynamically imports src/core/tasks/task-reader.js (ESM) and calls its readTaskPlan.
  Returns null on:
    - ESM import failure
    - readTaskPlan throwing
    - readTaskPlan returning null/undefined
```

**Implementation**:
```
let _taskReaderModule;
async function getTaskReader() {
    if (_taskReaderModule) return _taskReaderModule;
    try {
        _taskReaderModule = await import('../tasks/task-reader.js');
        return _taskReaderModule;
    } catch (e) { return null; }
}

async function readTaskPlan(path) {
    const mod = await getTaskReader();
    if (!mod || typeof mod.readTaskPlan !== 'function') return null;
    try { return await mod.readTaskPlan(path); }
    catch (e) { return null; }
}

module.exports = { readTaskPlan };
```

### 2.4 M4: isdlc.md amendment (STEP 3f)

**Dispatch table change** (around line ~900 of isdlc.md STEP 3f):
- Add line item after `"ITERATION CORRIDOR"`: `6. Contains "TASKS INCOMPLETE" → Follow 3f-task-completion below`
- Renumber subsequent items

**New `3f-task-completion` section** (after `3f-iteration-corridor`):

```markdown
**3f-task-completion.** TASK COMPLETION RE-DELEGATION

When the block message contains "TASKS INCOMPLETE":

1. Parse the unfinished task list from the block message (lines matching `- [ ] T{id}: {desc}`).
2. Check retry counter (`task-completion-gate:{phase_key}`) per 3f-retry-protocol.
3. If retries >= 3, present escalation menu:
   ```
   I have asked the orchestrator to implement these tasks T{id1}, T{id2}, T{id3} but does not look like I am able to make progress.
   Options:
   [M] Manually prompt the orchestrator
   [S] Skip for now
   [C] Cancel workflow
   ```
4. On [M]: Prompt user for guidance text, reset retry counter to 0, re-delegate with guidance appended.
5. On [S]: Append `{ phase, tasks, skipped_at, reason: "user_skip_after_retries" }` to `active_workflow.skipped_tasks[]`, clear counter, allow phase advancement.
6. On [C]: Cancel workflow per existing 3f cancellation path.
7. If retries < 3, re-delegate to the SAME phase agent (from PHASE→AGENT table) with prompt:

   ```
   TASKS INCOMPLETE — Retry {N} of 3

   The task-completion-gate hook blocked phase advancement. The following tasks in docs/isdlc/tasks.md are still [ ] (not done):

   {for each unfinished task}: T{id}: {description}

   You MUST complete these tasks and mark them [X] in tasks.md before signaling phase completion. Do not abandon them or mark them as skipped.
   ```

8. On return, loop back to STEP 3d per the retry protocol.
```

**Retry limit entry** in 3f-retry-protocol table:
| 3f-task-completion | 3 | Matches blast-radius pattern |

### 2.5 M5: settings.json registration

Add to `hooks.PreToolUse` array:
```json
{
  "matcher": "Edit|Write",
  "hooks": [
    { "type": "command", "command": "node <project>/.claude/hooks/task-completion-gate.cjs", "timeout": 5 }
  ]
}
```

Note: merges with existing Edit|Write PreToolUse entries (state-write-validator is PostToolUse, different block).

## 3. Data Flow

```
Phase-Loop Controller STEP 3e
    writes state.json (Edit tool) with phases["06-implementation"].status = "completed"
         |
         v
Claude Code event loop fires PreToolUse hooks
         |
         v
task-completion-gate.cjs receives stdin { tool_name: "Edit", tool_input: { file_path, new_string } }
         |
         v
Load current state.json from disk
         |
         v
Parse new_string as JSON → newState
         |
         v
detectPhaseCompletionTransition(oldState, newState)
    |
    +-- null (no transition) --> exit 0
    |
    +-- { phaseKey: "06-implementation" } --> continue
         |
         v
Check active_workflow.type === "build"
    |
    +-- no --> exit 0
    |
    +-- yes --> continue
         |
         v
readTaskPlan(docs/isdlc/tasks.md) via M3 bridge
    |
    +-- null --> log warning, exit 0 (TCG-006)
    |
    +-- TaskPlan --> continue
         |
         v
hasMatchingPhaseSection(taskPlan, "06-implementation")
    |
    +-- false --> exit 0 (TCG-007)
    |
    +-- true --> continue
         |
         v
countUnfinishedTopLevelTasks(taskPlan, "06-implementation")
    |
    +-- [] --> exit 0 (allow; all tasks done)
    |
    +-- [{T019, ...}] --> formatBlockMessage → emit stderr → outputBlockResponse → exit 2
```

**No state mutations by the hook** — it is a pure read-and-block. All state writes happen in the Phase-Loop Controller 3f handler (counter increment, skipped_tasks append).

## 4. Error Taxonomy

| Code | Trigger | Severity | Hook Action | User Impact |
|------|---------|----------|-------------|-------------|
| TCG-001 | stdin empty or JSON parse fail | Info | Exit 0, silent | None (nothing was going to happen anyway) |
| TCG-002 | tool_input.new_string/content unparseable as JSON | Info | Exit 0, silent | None; probably not our event |
| TCG-003 | state.json missing | Info | Exit 0, silent | None; framework not initialized |
| TCG-004 | active_workflow.type !== "build" | Info | Exit 0, silent | None; hook not in scope |
| TCG-005 | No phases[*].status transition to "completed" | Info | Exit 0 short-circuit | None; most common case |
| TCG-006 | tasks.md missing / readTaskPlan null | Warning | Log stderr, exit 0 | Warning visible in debug logs |
| TCG-007 | No matching `## Phase NN:` section | Info | Exit 0 silent | None; hook fails open for scope mismatch |
| TCG-008 | Unfinished tasks detected | Block | Exit 2, stderr = formatBlockMessage | Phase-Loop Controller receives block; re-delegates or escalates |
| TCG-009 | Any top-level exception | Error | Caught, debug log, exit 0 | None; Article X fail-safe |

All codes except TCG-008 exit 0 (Article X compliance).

## 5. Validation and Security

- **Input validation at boundary** (Article III): All inputs from stdin and tool_input.new_string are validated via `try/catch JSON.parse()`; failures fail-open.
- **No user-controlled input execution**: Hook does not eval or execute task descriptions; tasks.md content is only parsed as data.
- **File path safety**: tasks.md path is constructed via `path.resolve(projectRoot, "docs/isdlc/tasks.md")` — no user input in path construction.
- **No secrets accessed**: Hook reads only state.json and tasks.md; never touches credentials or settings.local.json.

## 6. Testability Considerations

- **M2 (logic)** is 100% pure functions → direct unit tests with fixture data, no mocks
- **M1 (hook)** tested via copy-to-temp pattern (Article XIII req 6): copy hook.cjs to temp dir outside package, inject stdin via child_process, capture stderr and exit code
- **M3 (bridge)** tested with real tasks.md fixtures from existing test suite
- **M4 (isdlc.md)** verified via integration test: trigger block, assert 3f-task-completion handler fires, assert re-delegation prompt contains explicit task IDs

## 7. Consistency Check

- ✅ No circular dependencies (M1 → M2, M1 → M3, M1 → common.cjs; M3 → task-reader.js only)
- ✅ Every interface has concrete types (no `any`)
- ✅ Every error path has defined behavior (TCG-001 through TCG-009)
- ✅ Aligned with ADR-000, ADR-001, ADR-002, ADR-003 from architecture-overview.md
- ✅ Article X: 8 of 9 error codes exit 0
- ✅ Article XIII: M1 and M3 are `.cjs`; bridge uses dynamic import
- ✅ Article XIV: state reads via common.cjs; no shadow state
- ✅ Article II: logic split enables >80% unit test coverage

## 8. Open Questions

None. All interfaces and error paths trace to accepted requirements (FR-001 through FR-004) and architecture decisions (ADR-000 through ADR-003).
