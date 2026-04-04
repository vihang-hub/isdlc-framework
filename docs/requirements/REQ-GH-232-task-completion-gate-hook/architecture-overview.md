# Architecture Overview: task-completion-gate hook

**Source**: GitHub #232
**Slug**: REQ-GH-232-task-completion-gate-hook
**Created**: 2026-04-05
**Status**: Accepted

## 1. Architecture Options

### Decision: Hook Location Strategy

| Option | Summary | Pros | Cons | Verdict |
|--------|---------|------|------|---------|
| A. New standalone hook | `src/claude/hooks/task-completion-gate.cjs` | Single responsibility; matches blast-radius-validator precedent; isolated tests; narrow blast radius | One new file, one new settings.json entry | **Selected** |
| B. Extend state-write-validator | Convert to dual PreToolUse + PostToolUse; task-completion becomes one of several pre-write checks | Reuses existing hook file; centralizes state.json gating | Conflates schema validation with semantic gating; widens state-write-validator's blast radius | Eliminated |
| C. Extend gate-blocker | Add Edit/Write matcher; introduce `task_completion` requirement type to iteration-requirements.json | Centralizes gate enforcement; config-driven | Doubles gate-blocker's event surface (Task + Edit/Write); bugs ripple to both manual-advance and phase-loop-write paths | Eliminated |

### Decision: Hook Event Binding

| Option | Summary | Pros | Cons | Verdict |
|--------|---------|------|------|---------|
| PreToolUse on `Edit\|Write` to `.isdlc/state.json` | Intercept before mutation; diff old vs new state for transition detection | Only event type that can block before violation; mirrors `state-write-validator.cjs` convention | Must parse tool_input and diff against on-disk state | **Selected** |
| PostToolUse on Edit/Write | Validate after write completes | Simpler (state on disk) | Cannot block — violation already happened | Eliminated |
| Custom hook event | Semantic fit ("PhaseComplete") | — | Not supported by Claude Code hook API | Eliminated |

### Decision: Task Parsing Strategy

| Option | Summary | Pros | Cons | Verdict |
|--------|---------|------|------|---------|
| Bridge to core ESM `readTaskPlan()` | New `src/core/bridge/tasks.cjs` exports CJS wrapper of `src/core/tasks/task-reader.js` | Single source of truth; matches Article XIII bridge pattern; existing precedent (validators.cjs, config.cjs) | One new bridge file (<20 LOC) | **Selected** |
| Duplicate parser in hook | Inline regex-based parser | Self-contained | Parser drift risk; violates Article VIII (documentation currency) | Eliminated |
| Inline regex | Minimal code | Fewest files | Brittle against tasks.md schema evolution | Eliminated |

### Decision: Retry Counter and Audit Trail

| Option | Summary | Pros | Cons | Verdict |
|--------|---------|------|------|---------|
| Reuse `active_workflow.hook_block_retries["task-completion-gate:{phase_key}"]` + new `active_workflow.skipped_tasks[]` | Matches 3f-retry-protocol convention; audit stays in state.json (Article XIV) | Schema addition (additive only) | — | **Selected** |
| Dedicated `task_completion_retries` field | Explicit naming | Inconsistent with other hooks' convention | — | Eliminated |
| External log `.isdlc/skipped-tasks.jsonl` | Decoupled from state | Violates Article XIV; harder to reason about workflow state | — | Eliminated |

## 2. Selected Architecture

### ADR-000: Hook Location Strategy

**Status**: Accepted

**Context**: No existing PreToolUse hook fires on Edit/Write to `.isdlc/state.json`. The Phase-Loop Controller's direct state writes in STEP 3e bypass `gate-blocker` (which fires on Task delegations) and `state-write-validator` (which is PostToolUse). Extending either to cover this new event would widen their scope and blast radius.

**Decision**: Create a new standalone hook `src/claude/hooks/task-completion-gate.cjs`.

**Rationale**: Matches the single-responsibility precedent set by `blast-radius-validator.cjs` — a narrow PreToolUse hook that parses state transitions and blocks on one specific condition. The current 30-hook architecture has survived hook proliferation by keeping each hook small and focused.

**Consequences**:
- One new hook file and one new settings.json entry
- No changes to `state-write-validator.cjs`, `gate-blocker.cjs`, or any existing hook
- Clear ownership boundary: task-completion-gate owns Article I.5 runtime enforcement for phases 05 and 06

### ADR-001: PreToolUse on Edit/Write to state.json

**Status**: Accepted

**Context**: The violation happens when `phases[phase_key].status` transitions to `"completed"` in state.json while tasks.md has unfinished tasks. To block the violation, the hook must intercept BEFORE the write is applied.

**Decision**: Register as `PreToolUse` with matcher `Edit|Write`, filtering on `tool_input.file_path` ending with `.isdlc/state.json`.

**Rationale**: PreToolUse is the only event type that can block the mutation. Mirrors `state-write-validator.cjs`'s event type (inverse direction: pre vs post).

**Consequences**:
- Hook MUST parse `tool_input.new_string` (Edit) or `tool_input.content` (Write) as JSON
- Hook MUST read current on-disk state.json and diff to detect the status transition
- Hook short-circuits (exit 0) if no transition to `"completed"` is detected

### ADR-002: Task Parsing via Core Bridge

**Status**: Accepted

**Context**: Hook is CommonJS (Article XIII); task-reader is ESM (`src/core/tasks/task-reader.js`). Cannot `require()` ESM directly.

**Decision**: Create `src/core/bridge/tasks.cjs` exposing `readTaskPlan(tasksPath)` that dynamically imports the ESM task-reader and returns the parsed TaskPlan.

**Rationale**: Single source of truth for tasks.md parsing. Matches Article XIII bridge pattern. Existing precedent: `src/core/bridge/validators.cjs`, `src/core/bridge/config.cjs`.

**Consequences**:
- When task-reader schema evolves, hook automatically picks up changes
- Bridge adds one indirection layer but < 20 LOC

### ADR-003: Retry Counter and Skipped-Task Audit

**Status**: Accepted

**Context**: Phase-Loop Controller needs a retry counter to limit re-delegation attempts. User needs an audit trail when they opt to skip unfinished tasks.

**Decision**:
- Retry counter: `active_workflow.hook_block_retries["task-completion-gate:{phase_key}"]`, max=3
- Audit trail: new array `active_workflow.skipped_tasks[]` with schema `{ phase, tasks[], skipped_at, reason }`

**Rationale**: Retry counter reuses the documented 3f-retry-protocol key format. Audit stays in state.json as the single runtime source (Article XIV).

**Consequences**:
- state.json schema gains one new optional field (`skipped_tasks[]`)
- Schema documented in requirements-spec.md §6 AC-003-04

## 3. Technology Decisions

| Technology | Version | Rationale | Alternatives Considered |
|------------|---------|-----------|-------------------------|
| Node.js CommonJS (.cjs) | — | Article XIII mandates .cjs for hooks | ESM — eliminated by Article XIII |
| Built-ins only (`fs`, `path`) | Node 20+ | No new dependencies | Any third-party package — eliminated (Article V) |
| `common.cjs` utilities | existing | Reuse `getProjectRoot`, `debugLog`, `readStdin`, `outputBlockResponse` | Inline re-implementation — eliminated (duplication) |
| New `src/core/bridge/tasks.cjs` | new, < 20 LOC | Bridge CJS hook to ESM task-reader | Duplicate parser — eliminated (Article VIII) |

## 4. Integration Architecture

### Integration Points

| ID | Source | Target | Interface | Data Format | Error Handling |
|----|--------|--------|-----------|-------------|----------------|
| I-01 | Claude Code event loop | task-completion-gate.cjs | stdin (hook JSON contract) | `{tool_name, tool_input: {file_path, new_string?, content?}}` | Fail-open via `process.exit(0)` on malformed input |
| I-02 | Hook | `.isdlc/state.json` (current on-disk) | `readState()` from common.cjs | JSON | Fail-open on missing/corrupt |
| I-03 | Hook | tool_input (proposed new state) | `JSON.parse(new_string \|\| content)` | JSON | Fail-open on parse error |
| I-04 | Hook | `docs/isdlc/tasks.md` | `readTaskPlan(path)` via bridge | TaskPlan object `{tasks[], phases{}, ...}` | Fail-open on null / throw |
| I-05 | Hook | stderr | Block message emit via `outputBlockResponse()` | Plain text + exit 2 | N/A (only on confirmed block) |
| I-06 | Phase-Loop Controller STEP 3f | Phase agent | Task tool re-delegation | Prompt text naming unfinished task IDs | 3 retries → user escalation menu |
| I-07 | Phase-Loop Controller | state.json | Edit tool | JSON (adds skipped_tasks[] entry) | Standard Edit error handling |

### Data Flow

```
[Phase agent signals completion]
    |
    v
[Phase-Loop Controller STEP 3e: writes state.json phases[key].status = "completed"]
    |
    v
[PreToolUse hook fires: task-completion-gate.cjs]
    |
    +-- fail-open checks (wrong workflow type, missing tasks.md, no section, etc.) --> exit 0 (allow)
    |
    +-- diff check: old != "completed" AND new == "completed" AND phase in task_dispatch? --> no --> exit 0 (allow)
    |
    v
[readTaskPlan(docs/isdlc/tasks.md) via core bridge]
    |
    v
[Count top-level [ ] tasks in matching "## Phase NN:" section]
    |
    +-- count == 0 --> exit 0 (allow)
    |
    +-- count > 0 --> emit "TASKS INCOMPLETE" block message --> exit 2 (block)
                        |
                        v
[Phase-Loop Controller receives blocked_by_hook]
    |
    v
[STEP 3f-task-completion handler]
    |
    +-- retries < 3 --> increment counter --> re-delegate with named task IDs
    |
    +-- retries >= 3 --> escalation menu [M]/[S]/[C]
                          |
                          +-- [M] user guidance --> re-delegate, reset counter
                          +-- [S] append to skipped_tasks[], clear counter, advance
                          +-- [C] cancel workflow
```

### Synchronization and Concurrency

- Hook is stateless (reads state and tasks.md per invocation; no caching)
- PreToolUse runs synchronously before the tool call; no race with the Edit/Write
- No concurrency concerns — Claude Code hooks execute serially per tool invocation

## 5. Summary

| Decision | Selected Approach | Key Tradeoff |
|----------|-------------------|--------------|
| Hook location | New standalone hook | +1 file vs. cleaner separation of concerns |
| Event binding | PreToolUse on Edit/Write to state.json | Parse-and-diff complexity vs. pre-mutation blocking |
| Task parsing | Core bridge to task-reader ESM | Indirection vs. single source of truth |
| Retry/audit | Existing hook_block_retries + new skipped_tasks[] | Schema addition vs. runtime centralization |

**Architectural Risks**:

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| JSON diff misses edge cases (nested status fields) | Medium | High | Narrow diff scope: `phases[*].status` only; unit tests cover edge cases |
| Bridge adds indirection | Low | Low | Bridge is thin (<20 LOC), tested, documented |
| state.json write race | Low | Low | PreToolUse runs before Edit; on-disk state is pre-edit reality |
| Large tasks.md slows hook beyond 100ms | Low | Medium | Benchmark during implementation; readTaskPlan already handles 100+ tasks |
| Phase-Loop Controller 3f handler not wired | Low | High | Add 3f-task-completion section to isdlc.md in same commit; integration test verifies routing |

**Cross-cutting considerations**:
- Article X (fail-safe defaults): every code path exits 0 on error
- Article III (security): filesystem reads only, no user input parsing beyond JSON
- Article XIII (module consistency): hook CJS, bridge CJS→ESM wrapper
- Article XIV (state integrity): all state reads/writes via common.cjs
