# Test Cases: task-completion-logic (pure functions)

**Source**: GitHub #232
**Slug**: REQ-GH-232-task-completion-gate-hook
**Module Under Test**: `src/claude/hooks/lib/task-completion-logic.cjs` (Phase 06)
**Test File**: `src/claude/hooks/tests/task-completion-logic.test.cjs` (Phase 06)
**Traces**: FR-001, FR-002, AC-001-01, AC-001-02, AC-002-01, AC-002-02, AC-002-03, AC-002-04, AC-002-05, AC-002-06

## Scope

This document specifies the unit test catalog for the four exported pure functions in M2 (`task-completion-logic.cjs`):

1. `check(ctx)` — top-level orchestration
2. `detectPhaseCompletionTransition(oldState, newState)` — diff-based transition detector
3. `countUnfinishedTopLevelTasks(taskPlan, phaseKey)` — task filter
4. `formatBlockMessage(phaseKey, unfinishedTasks)` — stderr message formatter

All four are 100% pure functions (no I/O, no mocks) per module-design.md §6 "Testability Considerations". The hook entry point (M1) and bridge (M3) are covered by separate integration tests (out of scope for this document — tracked as Phase 06 tasks T010-T014).

## Conventions

- **TC-ID format**: `TC-{FUNC}-{NN}` where FUNC ∈ {CHK, DPT, CNT, FMT}
- **Traces** reference FR/AC IDs from requirements-spec.md and TCG error codes from module-design.md §4
- **Task shape** (from `src/core/tasks/task-reader.js`):
  ```
  {
    id: "T001",
    description: "...",
    complete: false,          // boolean; true when [X], false when [ ]
    parentId: null | "T001",  // null = top-level, string = sub-task
    children: [],
    files: [...], traces: [...], metadata: {...}, ...
  }
  ```
- **TaskPlan shape** (from `readTaskPlan()`):
  ```
  {
    slug: "...",
    format: "v2.0" | "v3.0",
    phases: {
      "06-implementation": { name, status, tasks: [Task, ...] },
      ...
    },
    summary: {...}
  }
  ```
- **phaseKey** is the tasks.md section identifier: `"06-implementation"`, `"05-test-strategy"`, etc.
- **Implementation note for Phase 06**: module-design.md §2.2 writes `task.status === "pending"` as the filter predicate, but the actual task-reader emits `task.complete === false`. Tests below follow the semantic contract (filter unfinished `[ ]` top-level tasks) — the implementer MUST reconcile the predicate against `task.complete` when writing the logic module.

---

## Section 1 — `check(ctx)` tests

Orchestrates all sub-steps: parses input → detects transition → verifies build workflow → counts unfinished tasks → returns decision.

**Signature**:
```
check(ctx) → Result
  ctx = { input, state, taskPlan }
  Result = { decision: "block"|"allow", stderr?, stopReason?, phaseKey?, unfinishedTasks? }
```

### Happy path

| TC-ID | Description | Input | Expected Output | Traces |
|-------|-------------|-------|-----------------|--------|
| TC-CHK-01 | Transition to completed with all tasks done → allow | `ctx` where newState has `phases["06-implementation"].status="completed"`, oldState has `status="in_progress"`, active_workflow.type=`"build"`, taskPlan has Phase 06 section with all tasks `complete=true` | `{ decision: "allow" }` | FR-001, AC-001-01 (negative case), FR-002 |
| TC-CHK-02 | Transition to completed with 1 unfinished task → block | same as TC-CHK-01 but one task has `complete=false, parentId=null` | `{ decision: "block", phaseKey: "06-implementation", unfinishedTasks: [{id, description}], stderr: <formatBlockMessage output>, stopReason: <non-empty string> }` | FR-001, AC-001-01, AC-001-02, TCG-008 |
| TC-CHK-03 | Transition to completed with multiple unfinished tasks → block, all listed | same, with 3 top-level tasks `complete=false` | `{ decision: "block", unfinishedTasks: [3 items in tasks.md order] }` and stderr contains all 3 IDs | FR-001, AC-001-01, AC-001-02 |

### Fail-open short-circuits (AC-002-* coverage)

| TC-ID | Description | Input | Expected Output | Traces |
|-------|-------------|-------|-----------------|--------|
| TC-CHK-04 | No state.json content → allow | `ctx.state = null` | `{ decision: "allow" }` | AC-002-01, TCG-003 |
| TC-CHK-05 | active_workflow missing → allow | `ctx.state = { phases: {...} }` (no active_workflow) | `{ decision: "allow" }` | AC-002-01, TCG-004 |
| TC-CHK-06 | active_workflow.type === "fix" → allow | `ctx.state.active_workflow.type = "fix"` | `{ decision: "allow" }` | AC-002-01, TCG-004 |
| TC-CHK-07 | active_workflow.type === "upgrade" → allow | `ctx.state.active_workflow.type = "upgrade"` | `{ decision: "allow" }` | AC-002-01, TCG-004 |
| TC-CHK-08 | No phase transition to completed → allow (short-circuit) | newState phase status unchanged vs oldState | `{ decision: "allow" }` (no taskPlan inspection occurs — short-circuit before task count) | AC-002-05, TCG-005 |
| TC-CHK-09 | Phase already completed in oldState (idempotent re-write) → allow | oldState has `status="completed"`, newState has `status="completed"` for same phase | `{ decision: "allow" }` | AC-002-05, TCG-005, Risk mitigation (idempotent writes) |
| TC-CHK-10 | newState has status="in_progress" (no completion transition) → allow | newState.phases[*].status never equals "completed" | `{ decision: "allow" }` | AC-002-05, TCG-005 |
| TC-CHK-11 | taskPlan is null (tasks.md missing) → allow | `ctx.taskPlan = null`, all other preconditions met | `{ decision: "allow" }` | AC-002-02, TCG-006 |
| TC-CHK-12 | taskPlan is error object (`{error, reason}`) → allow | `ctx.taskPlan = { error: "parse_failed", reason: "empty file" }` | `{ decision: "allow" }` | AC-002-02, TCG-006 |
| TC-CHK-13 | No matching `## Phase NN:` section → allow | taskPlan has phases `{"01-requirements", "05-test-strategy"}` but transition phaseKey is `"06-implementation"` | `{ decision: "allow" }` | AC-002-03, TCG-007 |
| TC-CHK-14 | tool_input.new_string unparseable → allow | `ctx.input.tool_input.new_string = "not-json{{{"` | `{ decision: "allow" }` | AC-002-04, TCG-002 |
| TC-CHK-15 | tool_input.content unparseable (Write tool) → allow | `ctx.input.tool_name = "Write"`, `tool_input.content = "<<>>"` | `{ decision: "allow" }` | AC-002-04, TCG-002 |
| TC-CHK-16 | tool_input missing new_string AND content → allow | `ctx.input.tool_input = { file_path: "..." }` | `{ decision: "allow" }` | AC-002-04, TCG-002 |

### Error paths / defensive

| TC-ID | Description | Input | Expected Output | Traces |
|-------|-------------|-------|-----------------|--------|
| TC-CHK-17 | ctx is undefined → allow (no throw) | `check(undefined)` | `{ decision: "allow" }` (does NOT throw) | AC-002-06, TCG-009 |
| TC-CHK-18 | ctx is empty object → allow | `check({})` | `{ decision: "allow" }` | AC-002-06, TCG-009 |
| TC-CHK-19 | ctx.input is null → allow | `check({ input: null, state: {...}, taskPlan: {...} })` | `{ decision: "allow" }` | AC-002-06, TCG-009 |
| TC-CHK-20 | Task missing `description` field → allow/block with empty description | taskPlan has unfinished top-level task with `description=""` | `{ decision: "block", unfinishedTasks: [{id, description: ""}] }` (no throw) | AC-002-06, TCG-009 |
| TC-CHK-21 | Malformed newState (phases is non-object) → allow | `newState = { phases: "not-an-object" }` | `{ decision: "allow" }` | AC-002-06, TCG-009 |

### Edge cases

| TC-ID | Description | Input | Expected Output | Traces |
|-------|-------------|-------|-----------------|--------|
| TC-CHK-22 | Phase has only sub-tasks, all parents done → allow (sub-tasks excluded) | taskPlan has T001 `complete=true, parentId=null`, T001A `complete=false, parentId="T001"` | `{ decision: "allow" }` (sub-task filtered out) | FR-001, AC-001-01, M2 contract ("top-level only, excludes sub-tasks") |
| TC-CHK-23 | Phase 05 (test-strategy) transitions to completed with unfinished tasks → block | phaseKey=`"05-test-strategy"`, 2 top-level `[ ]` tasks | `{ decision: "block", phaseKey: "05-test-strategy", unfinishedTasks: [2] }` | FR-001 (confirms hook applies beyond Phase 06) |
| TC-CHK-24 | Phase transitions from undefined (new key) to completed → block if unfinished | oldState has no entry for `"06-implementation"`, newState has `status="completed"` | `{ decision: "block" }` if tasks unfinished | FR-001, AC-001-01 (first-ever transition) |

---

## Section 2 — `detectPhaseCompletionTransition(oldState, newState)` tests

Scans `newState.phases` for a key where `newState.phases[k].status === "completed"` AND `(oldState.phases[k]?.status || null) !== "completed"`. Returns `{ phaseKey, isTransition: true }` for first match, else `null`.

### Happy path

| TC-ID | Description | Input | Expected Output | Traces |
|-------|-------------|-------|-----------------|--------|
| TC-DPT-01 | Clean transition pending → completed | oldState: `{ phases: { "06-implementation": { status: "in_progress" } } }`, newState: `{ phases: { "06-implementation": { status: "completed" } } }` | `{ phaseKey: "06-implementation", isTransition: true }` | FR-001, AC-001-01 |
| TC-DPT-02 | Transition with other phases unchanged | oldState has 3 phases (01, 05, 06), newState changes only 06 from in_progress → completed | `{ phaseKey: "06-implementation", isTransition: true }` | FR-001, AC-001-01 |
| TC-DPT-03 | First occurrence of phaseKey (oldState missing phase entirely) | oldState: `{ phases: { "01-requirements": {...} } }`, newState adds `"06-implementation": { status: "completed" }` | `{ phaseKey: "06-implementation", isTransition: true }` | AC-001-01 ("current on-disk value NOT completed" — missing == null) |

### No-transition cases (returns null)

| TC-ID | Description | Input | Expected Output | Traces |
|-------|-------------|-------|-----------------|--------|
| TC-DPT-04 | Idempotent completed → completed | oldState and newState both have `status="completed"` for same phase | `null` | AC-002-05, TCG-005, Risk mitigation |
| TC-DPT-05 | in_progress → in_progress | both states have `status="in_progress"` | `null` | AC-002-05, TCG-005 |
| TC-DPT-06 | pending → in_progress | oldState `"pending"`, newState `"in_progress"` | `null` | AC-002-05, TCG-005 |
| TC-DPT-07 | completed → in_progress (regression, rare) | oldState `"completed"`, newState `"in_progress"` | `null` (not our concern) | AC-002-05, TCG-005 |
| TC-DPT-08 | No phases changed at all | oldState === newState (deep-equal) | `null` | AC-002-05, TCG-005 |
| TC-DPT-09 | Non-phase fields changed only | oldState and newState differ only in `active_workflow` | `null` | AC-002-05, TCG-005 |

### Edge / boundary

| TC-ID | Description | Input | Expected Output | Traces |
|-------|-------------|-------|-----------------|--------|
| TC-DPT-10 | newState.phases missing entirely | `newState = { active_workflow: {...} }` (no phases key) | `null` | AC-002-06, TCG-009 |
| TC-DPT-11 | newState.phases is empty object | `newState = { phases: {} }` | `null` | AC-002-06 |
| TC-DPT-12 | oldState is null | `detectPhaseCompletionTransition(null, {phases: {"06-implementation": {status: "completed"}}})` | `{ phaseKey: "06-implementation", isTransition: true }` (null oldState treated as no prior state) | AC-002-06, AC-001-01 |
| TC-DPT-13 | oldState is undefined | `detectPhaseCompletionTransition(undefined, <validNewState>)` | `{ phaseKey: ..., isTransition: true }` (treats missing as null) | AC-002-06, TCG-009 |
| TC-DPT-14 | newState is null | `detectPhaseCompletionTransition(<state>, null)` | `null` (cannot detect transition without newState) | AC-002-06, TCG-009 |
| TC-DPT-15 | newState.phases[k].status is undefined | `newState.phases = { "06-implementation": {} }` (no status field) | `null` | AC-002-06, TCG-009 |
| TC-DPT-16 | newState.phases[k].status is non-string | `newState.phases["06-implementation"].status = 42` | `null` | AC-002-06, TCG-009 |
| TC-DPT-17 | Multiple phases transition simultaneously | oldState: both "05" and "06" are `"in_progress"`; newState: both are `"completed"` | `{ phaseKey: <first matching key by iteration order>, isTransition: true }` (returns first match per contract "Returns first match") | FR-001, M2 contract |
| TC-DPT-18 | status casing difference ("Completed" vs "completed") | `newState.phases[k].status = "Completed"` (capital C) | `null` (strict equality; only exact `"completed"` matches) | AC-001-01 |
| TC-DPT-19 | Status is "completed" with extra whitespace | `newState.phases[k].status = " completed "` | `null` (strict equality; no trim) | AC-001-01 |
| TC-DPT-20 | oldState.phases[k] is null | `oldState.phases["06-implementation"] = null`, newState has completed | `{ phaseKey: "06-implementation", isTransition: true }` (null treated as non-completed) | AC-001-01, M2 contract "(oldState.phases[k]?.status || null) !== 'completed'" |

---

## Section 3 — `countUnfinishedTopLevelTasks(taskPlan, phaseKey)` tests

Filters `taskPlan.phases[phaseKey].tasks` where `task.complete === false` AND `task.parentId === null`. Returns `Array<{id, description}>`. Empty array on any null/undefined.

### Happy path

| TC-ID | Description | Input | Expected Output | Traces |
|-------|-------------|-------|-----------------|--------|
| TC-CNT-01 | 1 unfinished top-level task → returns [1 item] | taskPlan.phases["06-implementation"].tasks = [{id:"T001", description:"Do X", complete:false, parentId:null}] | `[{id: "T001", description: "Do X"}]` | FR-001, AC-001-01 |
| TC-CNT-02 | 3 unfinished top-level tasks in order → returns [3 items, preserving order] | 3 tasks all `complete=false, parentId=null`, IDs T001/T002/T003 | `[{id:"T001",...}, {id:"T002",...}, {id:"T003",...}]` | FR-001, AC-001-01 |
| TC-CNT-03 | All tasks complete → returns [] | all tasks `complete=true` | `[]` | FR-002 (allow path) |
| TC-CNT-04 | Mix of complete and incomplete → returns only incomplete | [T001 complete=true, T002 complete=false, T003 complete=true, T004 complete=false] | `[{id:"T002",...}, {id:"T004",...}]` | FR-001, AC-001-01 |

### Sub-task exclusion (M2 contract: "top-level only, excludes sub-tasks")

| TC-ID | Description | Input | Expected Output | Traces |
|-------|-------------|-------|-----------------|--------|
| TC-CNT-05 | Unfinished sub-task (parentId set), parent complete → returns [] | [T001 complete=true parentId=null, T001A complete=false parentId="T001"] | `[]` | FR-001, M2 contract (excludes sub-tasks), Out-of-scope "Sub-task drill-down" |
| TC-CNT-06 | Unfinished sub-task under unfinished parent → returns only parent | [T001 complete=false parentId=null, T001A complete=false parentId="T001"] | `[{id:"T001",...}]` (only parent) | FR-001, AC-001-01 |
| TC-CNT-07 | Mixed parent/child across multiple tasks | [T001 complete=false parentId=null, T001A complete=false parentId="T001", T002 complete=false parentId=null, T002A complete=true parentId="T002"] | `[{id:"T001",...}, {id:"T002",...}]` | FR-001, AC-001-01 |

### Phase filtering / missing section

| TC-ID | Description | Input | Expected Output | Traces |
|-------|-------------|-------|-----------------|--------|
| TC-CNT-08 | phaseKey not in taskPlan.phases → returns [] | taskPlan has only "01-requirements"; phaseKey="06-implementation" | `[]` | AC-002-03, TCG-007 |
| TC-CNT-09 | phaseKey matches but phase.tasks is empty | taskPlan.phases["06-implementation"] = {name, status, tasks: []} | `[]` | AC-002-03 |
| TC-CNT-10 | phaseKey matches, phase.tasks is undefined | taskPlan.phases["06-implementation"] = {name, status} (no tasks field) | `[]` (no throw) | AC-002-06, TCG-009 |

### Null / empty / invalid inputs

| TC-ID | Description | Input | Expected Output | Traces |
|-------|-------------|-------|-----------------|--------|
| TC-CNT-11 | taskPlan is null | `countUnfinishedTopLevelTasks(null, "06-implementation")` | `[]` | AC-002-02, AC-002-06 |
| TC-CNT-12 | taskPlan is undefined | `countUnfinishedTopLevelTasks(undefined, "06-implementation")` | `[]` | AC-002-06 |
| TC-CNT-13 | taskPlan is error object | `countUnfinishedTopLevelTasks({error:"parse_failed", reason:"empty"}, "06-implementation")` | `[]` (no throw) | AC-002-02, TCG-006 |
| TC-CNT-14 | taskPlan.phases is missing | `countUnfinishedTopLevelTasks({slug:"x"}, "06-implementation")` | `[]` | AC-002-06 |
| TC-CNT-15 | phaseKey is null | `countUnfinishedTopLevelTasks(<validTaskPlan>, null)` | `[]` | AC-002-06 |
| TC-CNT-16 | phaseKey is undefined | `countUnfinishedTopLevelTasks(<validTaskPlan>, undefined)` | `[]` | AC-002-06 |
| TC-CNT-17 | phaseKey is empty string | `countUnfinishedTopLevelTasks(<validTaskPlan>, "")` | `[]` | AC-002-06 |

### Defensive task-shape variations

| TC-ID | Description | Input | Expected Output | Traces |
|-------|-------------|-------|-----------------|--------|
| TC-CNT-18 | Task missing `complete` field (undefined) → treated as unfinished OR skipped (per implementer choice; document in code) | task = {id:"T001", description:"X", parentId:null} (no complete field) | Either `[]` (skip undefined) OR `[{id:"T001",...}]` (treat undefined as falsy = unfinished). Per M2 contract "Returns empty array on any null/undefined" AND safe default → **skip tasks without boolean complete field** → `[]` | AC-002-06, TCG-009 |
| TC-CNT-19 | Task missing `parentId` field (undefined) → treated as top-level (parentId===null OR undefined) | task = {id:"T001", description:"X", complete:false} (no parentId) | `[{id:"T001",...}]` (undefined === null for top-level check; common after older parsers) | AC-002-06 |
| TC-CNT-20 | Task missing `id` → skipped | task = {description:"X", complete:false, parentId:null} (no id) | `[]` (cannot report task without id) | AC-002-06, TCG-009 |
| TC-CNT-21 | Task has extra unknown fields → ignored | task with id, description, complete, parentId PLUS metadata/files/traces/children | returns `[{id, description}]` (extra fields stripped) | M2 contract ("Maps to {id, description}") |

### Boundary — large input

| TC-ID | Description | Input | Expected Output | Traces |
|-------|-------------|-------|-----------------|--------|
| TC-CNT-22 | Phase with 100 tasks, 50 unfinished top-level | taskPlan.phases[phaseKey].tasks has 100 entries, 50 with `complete=false, parentId=null`, 50 with `complete=true` | returns array of length 50 in original order | FR-001 (performance), NFR "runtime < 100ms" |
| TC-CNT-23 | Phase with 0 tasks | taskPlan.phases[phaseKey].tasks = [] | `[]` | Edge |

---

## Section 4 — `formatBlockMessage(phaseKey, unfinishedTasks)` tests

Produces the exact stderr format per AC-001-02.

### Happy path

| TC-ID | Description | Input | Expected Output | Traces |
|-------|-------------|-------|-----------------|--------|
| TC-FMT-01 | Single unfinished task → format matches AC-001-02 | phaseKey="06-implementation", unfinishedTasks=[{id:"T019", description:"Wire MCP registration"}] | Exact string:<br>`TASKS INCOMPLETE: Phase 06-implementation has 1 unfinished top-level tasks.\n\nUnfinished tasks (docs/isdlc/tasks.md):\n  - [ ] TT019: Wire MCP registration\n\nArticle I.5: User-confirmed task plans are binding specifications.\nComplete remaining tasks, then retry phase completion.`  — **NOTE**: AC-001-02 literally specifies `- [ ] T{id}` — i.e. if input id already has the `T` prefix, output MUST NOT double it. Implementer should emit `- [ ] T019` (use `id` as-is since parser keeps the `T` prefix). | AC-001-02 |
| TC-FMT-02 | Multiple unfinished tasks → all listed in order | phaseKey="06-implementation", unfinishedTasks=[{id:"T017",description:"A"}, {id:"T019",description:"B"}, {id:"T020",description:"C"}] | Message contains 3 lines `  - [ ] T017: A`, `  - [ ] T019: B`, `  - [ ] T020: C` in order; count is "3 unfinished top-level tasks" | AC-001-02 |
| TC-FMT-03 | Different phaseKey substituted literally | phaseKey="05-test-strategy", unfinishedTasks=[{id:"T001",description:"Design"}] | Starts with `TASKS INCOMPLETE: Phase 05-test-strategy has 1 unfinished top-level tasks.` | AC-001-02 |

### Format invariants

| TC-ID | Description | Assertion | Traces |
|-------|-------------|-----------|--------|
| TC-FMT-04 | Message starts with "TASKS INCOMPLETE:" exactly | `output.startsWith("TASKS INCOMPLETE:")` is true | AC-001-02, FR-004 (dispatch rule matches on "TASKS INCOMPLETE") |
| TC-FMT-05 | Message contains "Article I.5: User-confirmed task plans are binding specifications." verbatim | substring match | AC-001-02 |
| TC-FMT-06 | Message contains "Complete remaining tasks, then retry phase completion." verbatim | substring match | AC-001-02 |
| TC-FMT-07 | Each task line is indented with exactly 2 spaces before `- [ ]` | regex match `/^  - \[ \] /m` per task line | AC-001-02 |
| TC-FMT-08 | Message contains "Unfinished tasks (docs/isdlc/tasks.md):" heading | substring match | AC-001-02 |
| TC-FMT-09 | Count in first line matches unfinishedTasks.length | regex `/has (\d+) unfinished top-level tasks\./` captures the array length | AC-001-02 |
| TC-FMT-10 | phaseKey is interpolated unescaped into the message | phaseKey with hyphens (e.g. "06-implementation") appears verbatim | AC-001-02 |

### Edge cases

| TC-ID | Description | Input | Expected Output | Traces |
|-------|-------------|-------|-----------------|--------|
| TC-FMT-11 | Empty unfinishedTasks array (defensive — should never happen in practice) | `formatBlockMessage("06-implementation", [])` | Message with "has 0 unfinished top-level tasks" (no task lines between heading and Article I.5) — no throw | Defensive |
| TC-FMT-12 | Task description with special characters (colons, brackets) | `unfinishedTasks=[{id:"T001", description:"Parse [[ foo:bar ]] input"}]` | Description embedded verbatim: `  - [ ] T001: Parse [[ foo:bar ]] input` | AC-001-02 (no escaping required) |
| TC-FMT-13 | Task description with newline characters | `unfinishedTasks=[{id:"T001", description:"Line1\nLine2"}]` | Either: (a) newline preserved verbatim (expected), OR (b) replaced with space. Document choice — **expected: preserve verbatim** since task descriptions in practice are single-line | AC-001-02, Defensive |
| TC-FMT-14 | Empty task description | `unfinishedTasks=[{id:"T001", description:""}]` | Line is `  - [ ] T001: ` (trailing colon+space, no description) — no throw | AC-002-06 |
| TC-FMT-15 | Task description is undefined | `unfinishedTasks=[{id:"T001"}]` | Line is `  - [ ] T001: ` (undefined → empty) — no throw | AC-002-06 |
| TC-FMT-16 | Task id is empty string | `unfinishedTasks=[{id:"", description:"X"}]` | Line is `  - [ ] : X` — no throw, emits as-is (defensive; should never occur in practice) | AC-002-06 |
| TC-FMT-17 | Non-numeric task id (future-proof) | `unfinishedTasks=[{id:"TASK-001", description:"X"}]` | Line is `  - [ ] TASK-001: X` — id passthrough | Defensive |

### Boundary

| TC-ID | Description | Input | Expected Output | Traces |
|-------|-------------|-------|-----------------|--------|
| TC-FMT-18 | Large list (50 tasks) | unfinishedTasks has 50 entries | Message has 50 `  - [ ]` lines between the heading and "Article I.5"; count is "50 unfinished top-level tasks" | Boundary |
| TC-FMT-19 | Task description is maximum-length (long single line) | description is a 500-char string | Line contains full 500-char description; no truncation | Boundary |
| TC-FMT-20 | Null unfinishedTasks | `formatBlockMessage("06-implementation", null)` | Either `[]` behavior (empty list line) OR throws. **Expected**: defensive — treat null as empty list, no throw | AC-002-06, TCG-009 |

---

## Traceability Summary

| Requirement / AC | Test Case IDs |
|------------------|---------------|
| **FR-001** (Pre-completion task check) | TC-CHK-01, 02, 03, 22, 23, 24; TC-DPT-01, 02, 03, 17; TC-CNT-01, 02, 04, 05, 06, 07, 22 |
| **FR-002** (Fail-open conditions) | TC-CHK-04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16; TC-CNT-03 |
| **AC-001-01** | TC-CHK-02, 03, 22, 23, 24; TC-DPT-01, 02, 03, 18, 19, 20; TC-CNT-01, 02, 04, 05, 06, 07 |
| **AC-001-02** (message format) | TC-CHK-02, 03; TC-FMT-01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 12, 13 |
| **AC-002-01** (no active workflow / non-build) | TC-CHK-04, 05, 06, 07 |
| **AC-002-02** (tasks.md missing / null) | TC-CHK-11, 12; TC-CNT-11, 13 |
| **AC-002-03** (no matching phase section) | TC-CHK-13; TC-CNT-08, 09 |
| **AC-002-04** (unparseable new_string/content) | TC-CHK-14, 15, 16 |
| **AC-002-05** (no transition detected) | TC-CHK-08, 09, 10; TC-DPT-04, 05, 06, 07, 08, 09 |
| **AC-002-06** (top-level exception caught) | TC-CHK-17, 18, 19, 20, 21; TC-DPT-10, 11, 12, 13, 14, 15, 16; TC-CNT-10, 11, 12, 14, 15, 16, 17, 18, 19, 20; TC-FMT-11, 14, 15, 16, 20 |

## Error-Code Coverage Matrix (TCG-001 through TCG-009)

| Code | Covered By |
|------|------------|
| TCG-001 (stdin empty/JSON fail) | Covered by M1 hook integration tests (out of scope for pure logic) |
| TCG-002 (tool_input unparseable) | TC-CHK-14, 15, 16 |
| TCG-003 (state.json missing) | TC-CHK-04 (ctx.state=null simulates common.cjs returning null) |
| TCG-004 (non-build workflow) | TC-CHK-05, 06, 07 |
| TCG-005 (no transition) | TC-CHK-08, 09, 10; TC-DPT-04, 05, 06, 07, 08, 09 |
| TCG-006 (tasks.md null/parse fail) | TC-CHK-11, 12; TC-CNT-13 |
| TCG-007 (no matching section) | TC-CHK-13; TC-CNT-08 |
| TCG-008 (unfinished tasks → block) | TC-CHK-02, 03, 22, 23, 24 |
| TCG-009 (top-level exception) | TC-CHK-17, 18, 19, 20, 21; TC-DPT-10-16; TC-CNT-10, 14-20; TC-FMT-11, 20 |

## Coverage Commitments

- **>= 80% line coverage** of `task-completion-logic.cjs` (per NFR, Article II, requirements-spec §4)
- **100% branch coverage** of fail-open short-circuits in `check()` (TCG-001 through TCG-007)
- **100% of AC-001-02 format invariants** assertable via TC-FMT-04 through TC-FMT-10
- **Zero throws**: every test case in Section 1-4 asserts the function either returns a value or (for `check()`) returns `{decision: "allow"}` — no function in M2 is allowed to throw under any input

## Out of Scope for This Document

- M1 hook integration tests (stdin parsing, process exit codes, stderr capture) → Phase 06 tasks T010-T014
- M3 bridge tests (dynamic ESM import, readTaskPlan error handling) → separate test file
- M4 Phase-Loop Controller 3f handler integration tests → separate test file
- M5 settings.json registration smoke test → separate test file
- End-to-end workflow test (trigger block, verify re-delegation occurs) → Phase 06 task T014

---

**Total test cases**: 74
- check(): 24
- detectPhaseCompletionTransition(): 20
- countUnfinishedTopLevelTasks(): 23
- formatBlockMessage(): 20 (with TC-FMT-04..10 being shared assertions on TC-FMT-01 output)

---

## Hook Entry Tests (task-completion-gate.cjs)

**Module Under Test**: `src/claude/hooks/task-completion-gate.cjs` (M1, Phase 06)
**Test File**: `src/claude/hooks/tests/test-task-completion-gate.test.cjs` (Phase 06)
**Traces**: FR-001, FR-002, AC-001-03, TCG-001, TCG-002, TCG-003, TCG-004, TCG-008, TCG-009

### Scope

This section specifies the integration test catalog for the M1 hook entry point. Unlike the pure logic tests in Sections 1-4 above (which exercise `task-completion-logic.cjs` as a library), these tests exercise the hook as a **running subprocess**:

- Spawn `node <hook>.cjs` as a child process
- Inject JSON to stdin
- Capture stderr and exit code
- Assert behavior matches the Article XIII "copy-to-temp" contract (hook runs from a temp dir outside the package, with all its `require()` dependencies satisfied)

Per module-design.md §6: *"M1 (hook) tested via copy-to-temp pattern (Article XIII req 6): copy hook.cjs to temp dir outside package, inject stdin via child_process, capture stderr and exit code"*.

### Test Harness

All tests in this section use `src/claude/hooks/tests/hook-test-utils.cjs`:

```
const {
    setupTestEnv,      // Creates temp dir, copies config, writes state.json
    cleanupTestEnv,    // Removes temp dir
    writeState,        // Writes .isdlc/state.json in temp dir
    prepareHook,       // Copies hook.cjs + lib/ dependencies to temp dir
    runHook            // Spawns node child, pipes stdin JSON, captures stdout/stderr/code
} = require('./hook-test-utils.cjs');
```

**Per-test lifecycle** (beforeEach / afterEach):
```
beforeEach:
  1. testDir = setupTestEnv(buildWorkflowState)
  2. hookPath = prepareHook(<abs path to src/claude/hooks/task-completion-gate.cjs>)
  3. Write docs/isdlc/tasks.md fixture into testDir (when test needs it)
afterEach:
  1. cleanupTestEnv()
```

**runHook contract** (from hook-test-utils.cjs):
- Spawns `node <hookPath>` as child with `CLAUDE_PROJECT_DIR=<testDir>` env
- Writes `JSON.stringify(input)` to stdin and closes stdin
- Returns `Promise<{ stdout, stderr, code }>` with 10s timeout

### Conventions

- **TC-ID format**: `TC-HOOK-{NN}`
- **Happy path input shape**:
  ```json
  {
    "tool_name": "Edit",
    "tool_input": {
      "file_path": "<testDir>/.isdlc/state.json",
      "old_string": "...",
      "new_string": "<JSON with phases.*.status=completed>"
    }
  }
  ```
- **Assertions**: assert on `result.code` (exit code) and `result.stderr` (block message substring match)
- **Article X compliance**: every test except TC-HOOK-10..14 MUST assert `result.code === 0`

---

### Section 5 — Stdin handling

| TC-ID | Description | Input | Expected Output | Traces |
|-------|-------------|-------|-----------------|--------|
| TC-HOOK-01 | Empty stdin → exit 0 | `runHook(hookPath, '')` (empty string input) | `result.code === 0`, `result.stderr === ''` | FR-002, AC-002-04, TCG-001 |
| TC-HOOK-02 | Stdin is non-JSON garbage → exit 0 | Use raw spawn with stdin=`'not-json{{{'`; bypasses runHook's `JSON.stringify` | `result.code === 0`, no throw, no stack trace in stderr | FR-002, AC-002-04, TCG-001 |
| TC-HOOK-03 | Stdin is JSON null → exit 0 | `runHook(hookPath, null)` | `result.code === 0` | FR-002, AC-002-06, TCG-001 |
| TC-HOOK-04 | Stdin is JSON empty object `{}` → exit 0 | `runHook(hookPath, {})` | `result.code === 0` | FR-002, AC-002-06, TCG-001 |
| TC-HOOK-05 | Stdin is JSON array (wrong shape) → exit 0 | `runHook(hookPath, [1,2,3])` | `result.code === 0` | FR-002, AC-002-06, TCG-009 |
| TC-HOOK-06 | Stdin truncated mid-JSON → exit 0 | Use raw spawn with stdin=`'{"tool_name":"Edit","tool_input":'` (unclosed) | `result.code === 0`, no throw | FR-002, AC-002-04, TCG-001 |

### Section 6 — File-path gating

| TC-ID | Description | Input | Expected Output | Traces |
|-------|-------------|-------|-----------------|--------|
| TC-HOOK-07 | tool_input.file_path does not end in `.isdlc/state.json` → exit 0 (short-circuit, no state read) | `{ tool_name: "Edit", tool_input: { file_path: "<testDir>/docs/foo.md", new_string: "{}" } }` | `result.code === 0`, `result.stderr === ''` | FR-002, AC-002-05, TCG-005 |
| TC-HOOK-08 | tool_input.file_path missing entirely → exit 0 | `{ tool_name: "Edit", tool_input: { new_string: "{}" } }` | `result.code === 0` | FR-002, AC-002-06, TCG-009 |
| TC-HOOK-09 | tool_name is neither Edit nor Write → exit 0 (defensive; settings.json matcher already filters, but hook double-checks) | `{ tool_name: "Task", tool_input: { file_path: "<testDir>/.isdlc/state.json" } }` | `result.code === 0` | FR-002, TCG-005 |

### Section 7 — Happy path (allow, exit 0)

| TC-ID | Description | Input | Expected Output | Traces |
|-------|-------------|-------|-----------------|--------|
| TC-HOOK-10 | No active workflow in state.json → exit 0 silent | state.json written WITHOUT `active_workflow` field; input targets `.isdlc/state.json` with completion transition | `result.code === 0`, `result.stderr === ''` | FR-002, AC-002-01, TCG-004 |
| TC-HOOK-11 | active_workflow.type === "fix" → exit 0 silent | state has `active_workflow.type = "fix"`; input has completion transition | `result.code === 0`, `result.stderr === ''` | FR-002, AC-002-01, TCG-004 |
| TC-HOOK-12 | active_workflow.type === "build", no transition detected → exit 0 | newState phase status unchanged (in_progress → in_progress) | `result.code === 0`, `result.stderr === ''` | FR-002, AC-002-05, TCG-005 |
| TC-HOOK-13 | build workflow, transition detected, all tasks complete → exit 0 | state.json on disk has phase `status="in_progress"`; input new_string has same phase `status="completed"`; tasks.md has Phase 06 section with all tasks `[X]` | `result.code === 0`, `result.stderr === ''` | FR-001, FR-002, TCG-008 (negative) |
| TC-HOOK-14 | build workflow, transition detected, tasks.md missing → exit 0 with warning | tasks.md NOT written to testDir; otherwise valid transition input | `result.code === 0`, warning substring in stderr (e.g., `"tasks.md not found"` or similar per implementer) | FR-002, AC-002-02, TCG-006 |
| TC-HOOK-15 | build workflow, transition, but tasks.md has no matching `## Phase NN:` section → exit 0 silent | tasks.md contains only `## Phase 01: Requirements` section; transition is for `06-implementation` | `result.code === 0`, `result.stderr === ''` | FR-002, AC-002-03, TCG-007 |
| TC-HOOK-16 | build workflow, transition, sub-tasks unfinished but parents all complete → exit 0 | tasks.md has `[X] T001` and `[ ] T001A` (indented 2 spaces); top-level only check ignores T001A | `result.code === 0`, `result.stderr === ''` | FR-001, M2 contract (excludes sub-tasks) |

### Section 8 — Block path (exit 2 + stderr)

All block tests assert `result.code === 2` AND the stderr format per AC-001-02.

| TC-ID | Description | Input | Expected Output | Traces |
|-------|-------------|-------|-----------------|--------|
| TC-HOOK-17 | build + transition + 1 unfinished top-level task → exit 2 + formatted stderr | state on disk: phases["06-implementation"].status="in_progress"; input new_string: phases["06-implementation"].status="completed"; tasks.md: 1 top-level `[ ] T019: Wire MCP` under `## Phase 06: Implementation` | `result.code === 2`; `result.stderr` STARTS WITH `"TASKS INCOMPLETE:"`; contains `"Phase 06-implementation has 1 unfinished"`; contains `"- [ ] T019: Wire MCP"`; contains `"Article I.5:"` | FR-001, AC-001-01, AC-001-02, AC-001-03, TCG-008 |
| TC-HOOK-18 | build + transition + 3 unfinished top-level tasks → exit 2 + all 3 listed in stderr | tasks.md: `[ ] T017: A`, `[ ] T019: B`, `[ ] T020: C` | `result.code === 2`; stderr contains all 3 lines (`"- [ ] T017: A"`, `"- [ ] T019: B"`, `"- [ ] T020: C"`); count is "3 unfinished top-level tasks" | FR-001, AC-001-01, AC-001-02 |
| TC-HOOK-19 | build + transition + unfinished tasks for phase 05 (test-strategy) → exit 2 | phaseKey=`"05-test-strategy"`, 2 top-level `[ ]` tasks | `result.code === 2`; stderr contains `"Phase 05-test-strategy has 2 unfinished"` | FR-001, AC-001-01 |
| TC-HOOK-20 | Write tool block path → exit 2 | `tool_name="Write"`, `tool_input.content="<JSON with completion transition>"` (no new_string) | `result.code === 2`; stderr contains TASKS INCOMPLETE | FR-001, AC-001-01 (Write path) |
| TC-HOOK-21 | stdout contains outputBlockResponse JSON (stopReason) | same as TC-HOOK-17 | `result.stdout` parses as JSON; has `stopReason` field (non-empty string); OR stdout contains block response marker per existing hook convention | AC-001-03, FR-004 (Phase-Loop Controller parses stopReason) |

### Section 9 — Internal exception handling (fail-open)

These tests deliberately induce exceptions inside the hook to verify the top-level try/catch catches them (TCG-009, Article X compliance).

| TC-ID | Description | Input | Expected Output | Traces |
|-------|-------------|-------|-----------------|--------|
| TC-HOOK-22 | state.json is malformed JSON → exit 0 (common.cjs readState returns null) | Write `"not-json{{{"` as state.json content; valid completion-transition input | `result.code === 0`, no stack trace in stderr | FR-002, AC-002-06, TCG-003, TCG-009 |
| TC-HOOK-23 | state.json missing entirely → exit 0 | Delete `<testDir>/.isdlc/state.json` after setupTestEnv; valid input | `result.code === 0`, `result.stderr === ''` | FR-002, AC-002-01, TCG-003 |
| TC-HOOK-24 | tool_input.new_string is not parseable JSON → exit 0 (TCG-002) | `tool_input.new_string="not-json{{{"`, valid file_path | `result.code === 0`, `result.stderr === ''` | FR-002, AC-002-04, TCG-002 |
| TC-HOOK-25 | tool_input.new_string is valid JSON but `phases` field missing → exit 0 | `new_string='{"active_workflow":{"type":"build"}}'` (no phases) | `result.code === 0`, `result.stderr === ''` | FR-002, AC-002-05, TCG-005 |
| TC-HOOK-26 | tasks.md exists but is corrupt/unparseable → exit 0 with warning | tasks.md contains garbage characters that make readTaskPlan return null or throw | `result.code === 0`, warning substring in stderr per TCG-006 | FR-002, AC-002-02, TCG-006 |
| TC-HOOK-27 | Bridge dynamic import fails (simulate by removing task-reader.js dependency) | Remove `<testDir>/../src/core/tasks/task-reader.js` path resolution OR prepareHook doesn't copy bridge module | `result.code === 0` (fail-open via TCG-009 top-level catch) | FR-002, AC-002-02, TCG-006, TCG-009 |
| TC-HOOK-28 | Top-level synchronous exception during state read → exit 0 | Set state.json permissions to 000 (unreadable) after setupTestEnv; skip on Windows | `result.code === 0` (Article X fail-safe) | FR-002, AC-002-06, TCG-009 |
| TC-HOOK-29 | Runtime exception inside M2 logic bubbles up → caught by top-level → exit 0 | Inject a taskPlan-shaped input that would make M2 throw (e.g., via patched hook binary in copy-to-temp); alternative: document as white-box test that the try/catch exists in the entry IIFE | `result.code === 0` (no process crash) | FR-002, AC-002-06, TCG-009 |

### Section 10 — Copy-to-temp pattern verification (Article XIII req 6)

These tests verify that the hook runs correctly when copied to a temp directory **outside** the source package, with `require()` resolving all dependencies via the temp-dir layout (not source paths).

| TC-ID | Description | Input | Expected Output | Traces |
|-------|-------------|-------|-----------------|--------|
| TC-HOOK-30 | prepareHook copies task-completion-gate.cjs to temp dir and lib/common.cjs alongside | call `prepareHook(hookSrcPath)` in beforeEach | Returned hookPath exists at `<testDir>/task-completion-gate.cjs`; `<testDir>/lib/common.cjs` exists | Article XIII req 6 |
| TC-HOOK-31 | prepareHook copies lib/task-completion-logic.cjs (M2) to temp dir | Same beforeEach | `<testDir>/lib/task-completion-logic.cjs` exists after prepareHook returns | Article XIII req 6 |
| TC-HOOK-32 | prepareHook copies bridge module (tasks.cjs) to temp dir location that hook's require() resolves | Same beforeEach | Hook's `require('../../core/bridge/tasks.cjs')` (or equivalent path used by M1) resolves in temp-dir layout; if not, hook MUST fail-open (exit 0) per TCG-006 | Article XIII req 6, TCG-006 |
| TC-HOOK-33 | Hook runs with no stack trace leakage when any dependency fails to load | Run hook in temp dir where bridge module is intentionally missing | `result.code === 0`; `result.stderr` does NOT contain `"Error: Cannot find module"` or any raw stack trace | FR-002, AC-002-06, TCG-009, Article X |
| TC-HOOK-34 | Hook process does NOT modify any file in testDir | Run happy-path block scenario (TC-HOOK-17) | After runHook completes: `state.json` mtime unchanged, `tasks.md` mtime unchanged (hook is pure read-and-block per module-design.md §3) | FR-001, §3 "No state mutations by the hook" |
| TC-HOOK-35 | Hook completes within NFR runtime budget | Run TC-HOOK-17 scenario, measure wall time | `result` arrives within 100ms on typical CI (soft assertion; hard timeout is 5s per settings.json) | NFR (requirements §5: "Hook runtime < 100ms end-to-end"), Article XIII req 6 |
| TC-HOOK-36 | Hook is registered as `command: "node <project>/.claude/hooks/task-completion-gate.cjs"` with `timeout: 5` in settings.json | Read `src/claude/settings.json` after Phase 06 implementation; assert PreToolUse entry with matcher `"Edit\|Write"` includes this hook | JSON structure matches module-design.md §2.5 | Article XIII req 6, M5 contract |

### Section 11 — Phase-Loop Controller 3f routing assertion (AC-001-03)

These tests verify the hook emits output in the exact shape the Phase-Loop Controller 3f dispatch expects. The actual 3f handler routing is covered by a separate integration test (out of scope for this file, tracked as T004). These tests assert the **contract** that the controller depends on.

| TC-ID | Description | Input | Expected Output | Traces |
|-------|-------------|-------|-----------------|--------|
| TC-HOOK-37 | Block stderr starts with exact dispatch trigger substring `"TASKS INCOMPLETE"` | TC-HOOK-17 input | `result.stderr.startsWith("TASKS INCOMPLETE")` (no leading whitespace, no prefix) | AC-001-03, FR-004, AC-004-01 |
| TC-HOOK-38 | Block stderr contains unfinished task list in parseable format | TC-HOOK-18 input (3 tasks) | Regex `/^  - \[ \] (T\w+): (.+)$/gm` applied to stderr yields exactly 3 matches with correct IDs/descriptions | AC-001-03, FR-004, AC-004-02 (controller parses unfinished task list from block message) |
| TC-HOOK-39 | Exit code is exactly 2 (not 1, not 3) so 3f `blocked_by_hook` router activates | TC-HOOK-17 input | `result.code === 2` (strict equality) | AC-001-03, existing 3f-retry-protocol convention |

---

### Traceability Summary (Hook Entry Tests)

| Requirement / AC | Hook Test Case IDs |
|------------------|--------------------|
| **FR-001** (Pre-completion task check) | TC-HOOK-13, 16, 17, 18, 19, 20, 34 |
| **FR-002** (Fail-open conditions) | TC-HOOK-01..16, 22..29, 33 |
| **FR-004** (3f dispatch integration) | TC-HOOK-37, 38, 39 |
| **AC-001-01** (block on unfinished) | TC-HOOK-17, 18, 19, 20 |
| **AC-001-02** (message format) | TC-HOOK-17, 18, 19, 37, 38 |
| **AC-001-03** (3f routing contract) | TC-HOOK-21, 37, 38, 39 |
| **AC-002-01** (no build workflow) | TC-HOOK-10, 11, 23 |
| **AC-002-02** (tasks.md missing) | TC-HOOK-14, 26, 27 |
| **AC-002-03** (no matching section) | TC-HOOK-15 |
| **AC-002-04** (unparseable input) | TC-HOOK-01, 02, 06, 24 |
| **AC-002-05** (no transition) | TC-HOOK-07, 12, 25 |
| **AC-002-06** (top-level exception) | TC-HOOK-03, 04, 05, 08, 22, 28, 29, 33 |
| **AC-004-01** (dispatch trigger substring) | TC-HOOK-37 |
| **AC-004-02** (parseable task list in message) | TC-HOOK-38 |
| **Article XIII req 6** (copy-to-temp) | TC-HOOK-30, 31, 32, 33, 35, 36 |
| **Article X** (fail-open on errors) | TC-HOOK-22, 23, 26, 27, 28, 29, 33 |

### Hook Entry Error-Code Coverage

| Code | Covered By |
|------|------------|
| TCG-001 (stdin empty/JSON fail) | TC-HOOK-01, 02, 03, 04, 06 |
| TCG-002 (tool_input unparseable) | TC-HOOK-24 |
| TCG-003 (state.json missing) | TC-HOOK-22, 23 |
| TCG-004 (non-build workflow) | TC-HOOK-10, 11 |
| TCG-005 (no transition) | TC-HOOK-07, 09, 12, 25 |
| TCG-006 (tasks.md null/parse fail) | TC-HOOK-14, 26, 27 |
| TCG-007 (no matching section) | TC-HOOK-15 |
| TCG-008 (unfinished tasks → block) | TC-HOOK-17, 18, 19, 20 |
| TCG-009 (top-level exception) | TC-HOOK-03, 05, 08, 22, 27, 28, 29, 33 |

### Coverage Commitments (Hook Entry)

- **100% of AC-001-03 routing contract** assertable via TC-HOOK-37, 38, 39
- **100% of fail-open short-circuits** covered by subprocess tests (not just logic tests)
- **Zero-crash contract**: every test case in Sections 5-11 asserts `result.code === 0` OR `result.code === 2` — no test permits non-deterministic exit codes (no 1, 3, 130, etc.)
- **Copy-to-temp verified**: TC-HOOK-30, 31, 32 verify the temp-dir layout matches Article XIII requirement 6 before any behavioral test runs

### Out of Scope for This Section

- 3f-task-completion handler routing logic → Phase 06 task T004 (separate integration test file)
- End-to-end workflow test (actual state.json edit → hook fires → controller re-delegates) → Phase 06 task T014
- M5 settings.json registration smoke test → verified by TC-HOOK-36 (structural) + separate dispatcher integration test

---

**Total hook entry test cases**: 39
- Stdin handling: 6 (TC-HOOK-01..06)
- File-path gating: 3 (TC-HOOK-07..09)
- Happy path allow: 7 (TC-HOOK-10..16)
- Block path: 5 (TC-HOOK-17..21)
- Internal exception handling: 8 (TC-HOOK-22..29)
- Copy-to-temp verification: 7 (TC-HOOK-30..36)
- Phase-Loop Controller contract: 3 (TC-HOOK-37..39)

**Grand total test cases (logic + hook entry)**: 74 + 39 = 113

---

## Bridge Tests (src/core/bridge/tasks.cjs)

**Module Under Test**: `src/core/bridge/tasks.cjs` (M3, Phase 06)
**Test File**: `src/core/bridge/tasks.test.cjs` (Phase 06)
**Traces**: FR-002, AC-002-02, ADR-002, TCG-006

### Scope

This section specifies the unit test catalog for the M3 tasks-bridge. The bridge is a thin CJS wrapper around the ESM `src/core/tasks/task-reader.js` module, providing:

1. A **synchronous-surface `require()` API** for CJS consumers (hooks) via an `async` function that internally uses dynamic `import()`
2. **Fail-open error normalization**: any ESM import failure, thrown exception, or `null`/`undefined`/error-object return from the underlying `readTaskPlan()` is normalized to `null`
3. **Lazy module caching**: the ESM module is imported once on first invocation and cached for the process lifetime (no re-import on subsequent calls)

Per module-design.md §2.3 (contract) and ADR-002 (CJS bridge for ESM task-reader), the bridge must satisfy Article X (fail-open) and Article XIII req 6 (CJS hook layer calls into ESM core via bridges).

### Contract Under Test

From module-design.md §2.3:

```javascript
// Exported contract
async function readTaskPlan(absolutePath) → TaskPlan | null

// Returns null on:
//   - ESM import failure
//   - readTaskPlan throwing
//   - readTaskPlan returning null/undefined
//   - readTaskPlan returning error object { error, reason } (FR-002 fail-open normalization)

// Module caching:
//   - First call: await import('../tasks/task-reader.js'), cache result
//   - Subsequent calls: reuse cached module (no re-import)
//   - Concurrent first calls: both await the same in-flight import (no duplicate imports)
```

### Test Harness

All tests in this section use Node's built-in test runner (`node:test`) matching the existing bridge test convention in `src/core/bridge/config.test.cjs`:

```javascript
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function requireBridge() {
    // Clear require cache so each test gets a fresh module instance
    // (resets the internal _taskReaderModule cache variable)
    delete require.cache[require.resolve('../bridge/tasks.cjs')];
    return require('../bridge/tasks.cjs');
}

function createTmpTasksFile(content) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'isdlc-bridge-tasks-'));
    const tasksPath = path.join(tmp, 'tasks.md');
    fs.writeFileSync(tasksPath, content, 'utf8');
    return { tmp, tasksPath };
}
```

**Per-test lifecycle**:
- `beforeEach`: `bridge = requireBridge()` (fresh instance, empty module cache)
- `afterEach`: clean up any temp directories created during the test

### Conventions

- **TC-ID format**: `TC-BRIDGE-{NN}`
- **Fixtures**: Reference FIX-TM-* series from test-fixtures.md §1
- **Return-value assertions**: Exact equality on `null` for fail-open cases; shape checks (`result.phases`, `result.slug`) for happy path
- **No mocking of the ESM module**: Tests exercise the real `src/core/tasks/task-reader.js` via real `tasks.md` fixtures written to temp directories. This follows module-design.md §6 ("M3 (bridge) tested with real tasks.md fixtures from existing test suite")

---

### Section 12 — Happy path (valid tasks.md → TaskPlan object)

| TC-ID | Description | Setup | Expected Output | Traces |
|-------|-------------|-------|-----------------|--------|
| TC-BRIDGE-01 | Valid tasks.md with single phase + top-level tasks → returns TaskPlan object | Write FIX-TM-001 content to tmp/tasks.md; call `await bridge.readTaskPlan(tasksPath)` | Result is non-null object; `result.slug` is a non-empty string; `result.phases` is an object; `result.phases["06-implementation"]` exists with `.tasks` array; `result.format` is `"v2.0"` or `"v3.0"` | FR-002, ADR-002, AC-011-01 (task-reader contract preserved) |
| TC-BRIDGE-02 | Valid tasks.md with unfinished tasks → TaskPlan contains those tasks with `complete: false` | Write FIX-TM-002 content to tmp/tasks.md; call `await bridge.readTaskPlan(tasksPath)` | Result is non-null; `result.phases["06-implementation"].tasks` contains ≥1 entry where `task.complete === false`; every task has `id`, `description`, `parentId` fields | FR-001, FR-002, ADR-002 |
| TC-BRIDGE-03 | Valid tasks.md with sub-tasks → TaskPlan preserves parent/child relationship | Write FIX-TM-003 content to tmp/tasks.md; call `await bridge.readTaskPlan(tasksPath)` | Result is non-null; at least one task has `parentId !== null` (sub-task); at least one task has `parentId === null` (top-level); shapes match task-reader contract | FR-001, ADR-002 |
| TC-BRIDGE-04 | Valid tasks.md with multiple phases → TaskPlan.phases has all phase keys | Write FIX-TM-008 content to tmp/tasks.md; call `await bridge.readTaskPlan(tasksPath)` | Result is non-null; `Object.keys(result.phases).length >= 4`; phase keys match tasks.md section headers (e.g., `"05-test-strategy"`, `"06-implementation"`) | FR-001, ADR-002 |
| TC-BRIDGE-05 | Return value is a Promise (async function contract) | Call `const p = bridge.readTaskPlan(tasksPath)` (without await) against valid tasks.md | `p instanceof Promise === true`; `await p` resolves to TaskPlan object | ADR-002 (async surface) |

### Section 13 — File not found (readTaskPlan returns null → bridge returns null)

| TC-ID | Description | Setup | Expected Output | Traces |
|-------|-------------|-------|-----------------|--------|
| TC-BRIDGE-06 | Path points to non-existent file → returns null | `tasksPath = "/nonexistent/path/tasks.md"`; call `await bridge.readTaskPlan(tasksPath)` | Result is strictly `null` (not `undefined`, not an error object) | FR-002, AC-002-02, TCG-006, FIX-TM-006 |
| TC-BRIDGE-07 | Path points to a directory, not a file → returns null (fail-open) | `tasksPath = /tmp/some-dir` (directory exists, not file); call `await bridge.readTaskPlan(tasksPath)` | Result is strictly `null`; no exception thrown | FR-002, AC-002-02, TCG-006 |
| TC-BRIDGE-08 | Relative path instead of absolute → contract allows bridge to pass-through or fail-open | `tasksPath = "docs/isdlc/tasks.md"` (relative); call `await bridge.readTaskPlan(tasksPath)` | Result is `null` OR a valid TaskPlan (depends on CWD); MUST NOT throw | FR-002, TCG-006 |
| TC-BRIDGE-09 | Empty string path → returns null | `tasksPath = ""`; call `await bridge.readTaskPlan(tasksPath)` | Result is strictly `null`; no exception | FR-002, AC-002-02, TCG-006 |
| TC-BRIDGE-10 | `null` path argument → returns null (defensive) | call `await bridge.readTaskPlan(null)` | Result is strictly `null`; no exception thrown (caught by bridge try/catch) | FR-002, TCG-006, TCG-009 |
| TC-BRIDGE-11 | `undefined` path argument → returns null (defensive) | call `await bridge.readTaskPlan(undefined)` | Result is strictly `null`; no exception thrown | FR-002, TCG-006, TCG-009 |

### Section 14 — Malformed tasks.md (readTaskPlan returns error object → bridge returns null)

The underlying `readTaskPlan()` (per `src/core/tasks/task-reader.js` contract) returns `{ error, reason }` objects when the file exists but cannot be parsed. The bridge MUST normalize these to `null` (module-design.md §2.3, FR-002).

| TC-ID | Description | Setup | Expected Output | Traces |
|-------|-------------|-------|-----------------|--------|
| TC-BRIDGE-12 | Empty tasks.md file → bridge returns null (normalizes error object) | Write FIX-TM-005 (empty file content) to tmp/tasks.md; call `await bridge.readTaskPlan(tasksPath)` | Result is strictly `null` (NOT `{ error: "parse_failed", reason: "empty file" }`) | FR-002, TCG-006, FIX-TM-005 |
| TC-BRIDGE-13 | Whitespace-only tasks.md → bridge returns null | Write `"\n   \n\t\n"` to tmp/tasks.md; call `await bridge.readTaskPlan(tasksPath)` | Result is strictly `null` | FR-002, TCG-006, FIX-TM-005 (variant) |
| TC-BRIDGE-14 | Malformed tasks.md (no phase headers) → bridge returns null | Write FIX-TM-007 content to tmp/tasks.md; call `await bridge.readTaskPlan(tasksPath)` | Result is strictly `null` (NOT error object from parser) | FR-002, TCG-006, FIX-TM-007 |
| TC-BRIDGE-15 | tasks.md with garbage characters → bridge returns null or fail-open | Write binary/non-UTF8 bytes to tmp/tasks.md; call `await bridge.readTaskPlan(tasksPath)` | Result is strictly `null`; no exception propagates | FR-002, TCG-006, TCG-009 |
| TC-BRIDGE-16 | tasks.md with only H1 heading but no phase sections → bridge returns null | Write `"# Task Plan: foo\n\nNo phases here.\n"` to tmp/tasks.md | Result is strictly `null` | FR-002, TCG-006, FIX-TM-007 (variant) |
| TC-BRIDGE-17 | Bridge NEVER returns an object with `error` key | For every fail-open case (TC-BRIDGE-06..16): assert result does not have shape `{ error: ..., reason: ... }` | For each prior fixture: `result === null` AND NOT (`typeof result === "object" && result !== null && "error" in result`) | FR-002, module-design.md §2.3 ("bridge normalizes error objects to null") |

### Section 15 — ESM import failure (bridge returns null)

These tests simulate conditions where the dynamic `import('../tasks/task-reader.js')` cannot resolve or the imported module lacks the expected `readTaskPlan` export. The bridge MUST fail-open (return `null`) without throwing.

| TC-ID | Description | Setup | Expected Output | Traces |
|-------|-------------|-------|-----------------|--------|
| TC-BRIDGE-18 | ESM module missing `readTaskPlan` export → returns null | Mock-require a stub module at `../tasks/task-reader.js` path that exports only `{ somethingElse: () => {} }`; call `await bridge.readTaskPlan(path)` | Result is strictly `null`; contract check (`typeof mod.readTaskPlan !== 'function'`) triggers fail-open | FR-002, TCG-006, TCG-009, module-design.md §2.3 |
| TC-BRIDGE-19 | ESM import() rejects (module path resolution failure) → returns null | White-box test: temporarily rename/move `src/core/tasks/task-reader.js` OR use a test harness that stubs `import()` to reject; call `await bridge.readTaskPlan(path)` | Result is strictly `null`; no unhandled rejection; no thrown exception | FR-002, TCG-006, TCG-009, module-design.md §2.3 |
| TC-BRIDGE-20 | ESM module throws during import (top-level error in task-reader.js) → returns null | Mock-require a stub ESM module that throws on import; call `await bridge.readTaskPlan(path)` | Result is strictly `null`; caught by `getTaskReader` try/catch | FR-002, TCG-009, module-design.md §2.3 |
| TC-BRIDGE-21 | ESM `readTaskPlan` throws synchronously → bridge returns null | Stub `readTaskPlan` to `() => { throw new Error("boom"); }`; call `await bridge.readTaskPlan(path)` | Result is strictly `null`; caught by inner try/catch in `readTaskPlan` wrapper | FR-002, TCG-009, module-design.md §2.3 |
| TC-BRIDGE-22 | ESM `readTaskPlan` returns a rejected Promise → bridge returns null | Stub `readTaskPlan` to `async () => { throw new Error("async boom"); }`; call `await bridge.readTaskPlan(path)` | Result is strictly `null`; async exception caught by `await` inside try/catch | FR-002, TCG-009, module-design.md §2.3 |
| TC-BRIDGE-23 | ESM `readTaskPlan` returns `undefined` → bridge returns null | Stub `readTaskPlan` to `() => undefined`; call `await bridge.readTaskPlan(path)` | Result is strictly `null` (bridge contract normalizes undefined to null) | FR-002, module-design.md §2.3 |
| TC-BRIDGE-24 | ESM `readTaskPlan` returns `null` → bridge returns null (pass-through) | Stub `readTaskPlan` to `() => null`; call `await bridge.readTaskPlan(path)` | Result is strictly `null` | FR-002, AC-002-02, module-design.md §2.3 |

### Section 16 — Module caching (second call uses cached module, no re-import)

| TC-ID | Description | Setup | Expected Output | Traces |
|-------|-------------|-------|-----------------|--------|
| TC-BRIDGE-25 | Second call to `readTaskPlan` does NOT re-invoke dynamic `import()` | White-box test: spy on dynamic import via test harness OR count module-evaluation side effects by placing a `console.log("TASK_READER_LOADED")` marker in a test double; call `bridge.readTaskPlan(path1)` then `bridge.readTaskPlan(path2)`; count marker invocations | Marker appears EXACTLY 1 time across both calls (ESM module loaded once, cached for second call) | ADR-002, module-design.md §2.3 (caching clause) |
| TC-BRIDGE-26 | Cached module is returned synchronously on second call (fast path) | Call `bridge.readTaskPlan(path1)` (first call, triggers import), measure wall time; call `bridge.readTaskPlan(path2)` (second call, should reuse cache), measure wall time | Second-call wall time < first-call wall time (soft assertion); OR assert `_taskReaderModule` internal cache variable is truthy after first call (white-box) | ADR-002, module-design.md §2.3 |
| TC-BRIDGE-27 | Module cache persists across multiple distinct path arguments | Call bridge with 5 different `tasksPath` values in sequence | First call imports; calls 2-5 reuse cached module; all 5 return correct TaskPlan/null for their respective path | ADR-002 |
| TC-BRIDGE-28 | Cache is module-level (survives across many calls in same process) | Call bridge 100 times with valid paths | Import triggered once; no memory leak; all 100 calls return valid results within reasonable budget (< 500ms total on typical CI) | ADR-002, NFR runtime budget |
| TC-BRIDGE-29 | Fresh `requireBridge()` (clears require.cache) resets the module cache | Call `bridge1 = requireBridge()`; `await bridge1.readTaskPlan(path)`; then `bridge2 = requireBridge()`; `await bridge2.readTaskPlan(path)` | Each freshly-required bridge instance starts with empty cache; ESM import executes once per bridge instance (2 total across both instances) | Test harness contract (cache isolation between tests) |

### Section 17 — Concurrent calls (both resolve without duplicate imports)

| TC-ID | Description | Setup | Expected Output | Traces |
|-------|-------------|-------|-----------------|--------|
| TC-BRIDGE-30 | Two concurrent first-calls → both resolve; ESM module imported exactly once | Fresh bridge; fire `[bridge.readTaskPlan(p1), bridge.readTaskPlan(p2)]` in parallel via `Promise.all`; count import-marker invocations (white-box) | Both promises resolve to valid results; marker appears exactly 1 time (NOT 2); no race-condition double-import | ADR-002, module-design.md §2.3 (caching clause) |
| TC-BRIDGE-31 | 10 concurrent calls → all resolve; module imported exactly once | Fresh bridge; fire 10 concurrent `readTaskPlan` calls via `Promise.all` | All 10 promises resolve without rejection; marker appears exactly 1 time (OR `_taskReaderModule` references the same object instance across all in-flight invocations) | ADR-002, thread-safety contract |
| TC-BRIDGE-32 | Concurrent calls with mix of valid/invalid paths → each resolves correctly | Fresh bridge; `Promise.all([readTaskPlan(validPath), readTaskPlan("/nonexistent"), readTaskPlan(validPath2)])` | Results = [TaskPlan, null, TaskPlan]; no promise rejects; each result matches its path's expected outcome | FR-002, ADR-002 |
| TC-BRIDGE-33 | Concurrent calls during in-flight import do NOT trigger duplicate imports | Implementation MAY cache the in-flight import Promise (`_taskReaderModulePromise`) so concurrent calls await the same import | Either: (a) import marker fires exactly 1 time under concurrency; OR (b) white-box assert `_taskReaderModule` reference equality across concurrent call stacks | ADR-002 |
| TC-BRIDGE-34 | Concurrent failures do not corrupt cache | Fresh bridge; simulate first call with failing ESM import (stub rejects); await failure; then call again with fixed import | Implementation note: spec does NOT require caching failed imports. Either: (a) second call retries import and succeeds; OR (b) second call returns null (cached failure). The test asserts the implementer's chosen behavior is deterministic and documented, not which option is chosen. | FR-002, TCG-009 |

### Section 18 — Integration with fixtures

| TC-ID | Description | Setup | Expected Output | Traces |
|-------|-------------|-------|-----------------|--------|
| TC-BRIDGE-35 | FIX-TM-001 end-to-end (all tasks done) → bridge returns TaskPlan with `task.complete === true` for all tasks in Phase 06 | Write FIX-TM-001 to tmp/tasks.md; call `await bridge.readTaskPlan(tasksPath)`; inspect `result.phases["06-implementation"].tasks` | Every top-level task has `complete === true`; no task has `complete === false` | FIX-TM-001 → AC-001-01 (happy allow) |
| TC-BRIDGE-36 | FIX-TM-002 end-to-end (some pending) → bridge returns TaskPlan with ≥2 `complete: false` top-level tasks | Write FIX-TM-002 to tmp/tasks.md; call bridge | Result contains ≥2 top-level tasks (`parentId === null`) with `complete === false` | FIX-TM-002 → AC-001-01, AC-001-02 (block) |
| TC-BRIDGE-37 | FIX-TM-003 end-to-end (sub-tasks) → bridge returns TaskPlan preserving sub-task parentId references | Write FIX-TM-003 to tmp/tasks.md; call bridge | Result contains tasks where `parentId !== null` (sub-tasks) AND tasks where `parentId === null` (top-level) | FIX-TM-003 → sub-task exclusion contract |
| TC-BRIDGE-38 | FIX-TM-004 end-to-end (missing phase) → bridge returns TaskPlan (phase mismatch is logic-layer concern, not bridge's) | Write FIX-TM-004 to tmp/tasks.md (contains only Phase 05, 07, 08 sections); call bridge | Result is NON-null TaskPlan; `result.phases` lacks "06-implementation" key; bridge does NOT filter by phase — that's M2's job | FIX-TM-004, separation of concerns |
| TC-BRIDGE-39 | FIX-TM-008 end-to-end (large file) → bridge correctly parses all 20 tasks across 4 phases | Write FIX-TM-008 to tmp/tasks.md; call bridge | Result has 4 phase keys; total task count (across all phases) ≥ 20; no task is dropped or duplicated | FIX-TM-008 → phase scoping |

---

### Traceability Summary (Bridge Tests)

| Requirement / AC / ADR | Bridge Test Case IDs |
|------------------------|----------------------|
| **FR-001** (Pre-completion task check — preserves task-reader contract) | TC-BRIDGE-01, 02, 03, 04, 35, 36, 37, 39 |
| **FR-002** (Fail-open conditions — normalize errors to null) | TC-BRIDGE-06..24, 32, 34 |
| **AC-002-02** (tasks.md missing → fail-open) | TC-BRIDGE-06, 07, 09, 24 |
| **ADR-002** (CJS bridge for ESM task-reader) | TC-BRIDGE-01..05, 18, 19, 20, 25..33, 38 |
| **TCG-006** (tasks.md null/parse fail) | TC-BRIDGE-06, 07, 09, 12..16, 18 |
| **TCG-009** (top-level exception caught) | TC-BRIDGE-10, 11, 15, 18..22, 34 |
| **Module caching clause** (module-design.md §2.3) | TC-BRIDGE-25..33 |
| **Article X** (fail-open on errors) | TC-BRIDGE-06..24, 34 |
| **Article XIII req 6** (CJS-to-ESM bridge pattern) | TC-BRIDGE-01, 05, 18, 19, 25 |

### Bridge Error-Code Coverage

| Code | Covered By |
|------|------------|
| TCG-006 (tasks.md null/parse fail) | TC-BRIDGE-06, 07, 08, 09, 12, 13, 14, 15, 16, 18, 24 |
| TCG-009 (top-level exception normalized to null) | TC-BRIDGE-10, 11, 15, 18, 19, 20, 21, 22 |

### Fixture Coverage (Bridge Tests)

| Fixture | Used By |
|---------|---------|
| FIX-TM-001 (all done) | TC-BRIDGE-01, 35 |
| FIX-TM-002 (some pending) | TC-BRIDGE-02, 36 |
| FIX-TM-003 (sub-tasks) | TC-BRIDGE-03, 37 |
| FIX-TM-004 (missing phase) | TC-BRIDGE-38 |
| FIX-TM-005 (empty file) | TC-BRIDGE-12, 13 |
| FIX-TM-006 (file missing) | TC-BRIDGE-06 |
| FIX-TM-007 (malformed) | TC-BRIDGE-14, 16 |
| FIX-TM-008 (large file) | TC-BRIDGE-04, 39 |

### Coverage Commitments (Bridge)

- **100% of bridge contract surface** (module-design.md §2.3): every fail-open clause has ≥1 test
- **100% of fixture fail-open paths**: FIX-TM-005, 006, 007 each have a dedicated TC-BRIDGE-*
- **Caching guarantee**: TC-BRIDGE-25 asserts single-import invariant directly (white-box); TC-BRIDGE-30, 31, 33 assert it under concurrency
- **No exception leakage**: every test in Sections 13-15, 17 asserts either `result === null` OR a successful resolution — NO test permits a thrown exception or unhandled rejection
- **Separation of concerns**: TC-BRIDGE-38 verifies the bridge does NOT filter by phase key (that's M2/logic's responsibility) — the bridge is a pass-through wrapper

### Out of Scope for This Section

- M2 logic tests that consume bridge output → Sections 1-4 above (TC-LOGIC-*, TC-CHK-*, TC-CNT-*)
- M1 hook integration tests that call bridge via copy-to-temp layout → Section 10 above (TC-HOOK-30..33)
- Performance benchmarks for bridge under sustained load → deferred (NFR soft target: TC-BRIDGE-28 uses reasonable budget)
- Testing the ESM `readTaskPlan` implementation itself → covered by existing task-reader test suite (out of scope for #232)

---

**Total bridge test cases**: 39
- Happy path: 5 (TC-BRIDGE-01..05)
- File not found: 6 (TC-BRIDGE-06..11)
- Malformed tasks.md: 6 (TC-BRIDGE-12..17)
- ESM import failure: 7 (TC-BRIDGE-18..24)
- Module caching: 5 (TC-BRIDGE-25..29)
- Concurrent calls: 5 (TC-BRIDGE-30..34)
- Integration with fixtures: 5 (TC-BRIDGE-35..39)

**Grand total test cases (logic + hook entry + bridge)**: 74 + 39 + 39 = 152

---

## 3f Dispatch Integration Tests

**Source**: Task T004 (Phase 05)
**Module Under Test**: `src/claude/commands/isdlc.md` STEP 3f dispatch table + new `3f-task-completion` handler section (Phase 06, M4 per module-design.md §2.4)
**Test File (proposed)**: `src/claude/hooks/tests/test-task-completion-step3f.test.cjs`
**Traces**: FR-003, FR-004, AC-003-01, AC-003-02, AC-003-03, AC-003-04, AC-003-05, AC-004-01, AC-004-02

### Scope

STEP 3f is a markdown protocol specification (not executable JavaScript). These tests follow the **markdown-contract verification pattern** established by `test-blast-radius-step3f.test.cjs` (REQ for BUG-0019): they read `src/claude/commands/isdlc.md` as text, assert the dispatch rule and handler section exist with the required content, and verify downstream behaviors (retry counter increment, skipped_tasks schema append, escalation menu rendering) against small helper functions that the phase-loop controller follows verbatim.

**Two layers of assertion**:
1. **Markdown-contract layer** (string assertions against isdlc.md content): dispatch rule present, handler section present, retry-limit table entry present, re-delegation prompt template contains required elements.
2. **Behavioral layer** (pure-function assertions): retry counter increment logic, skipped_tasks schema append, escalation menu format — modeled against small helper functions in `src/claude/hooks/lib/` (if extracted during Phase 06) OR against inline fixtures that mirror the markdown protocol exactly.

### Conventions

- **TC-ID format**: `TC-3F-{NN}` (01..25)
- **Block message fixture** (reused across tests):
  ```
  TASKS INCOMPLETE: Phase 06-implementation has 2 unfinished top-level tasks.

  Unfinished tasks (docs/isdlc/tasks.md):
    - [ ] T017: Wire the orchestrator bridge to phase loop
    - [ ] T019: Validate the persistence path end-to-end

  Article I.5: User-confirmed task plans are binding specifications.
  Complete remaining tasks, then retry phase completion.
  ```
- **isdlc.md path**: `path.resolve(__dirname, '..', '..', 'commands', 'isdlc.md')`
- **phase_key under test**: `"06-implementation"` (primary); `"05-test-strategy"` (cross-phase case)

---

### Section A — Dispatch rule wiring (AC-004-01)

Verifies `src/claude/commands/isdlc.md` STEP 3f dispatch table recognizes `TASKS INCOMPLETE` and routes to the new handler.

| TC-ID | Description | Assertion | Traces |
|-------|-------------|-----------|--------|
| TC-3F-01 | Dispatch table contains TASKS INCOMPLETE rule | Read isdlc.md. Assert text matches regex `/Contains\s+"TASKS INCOMPLETE"\s+.*→.*3f-task-completion/i` in the STEP 3f dispatch list (between lines containing `"BLAST RADIUS COVERAGE INCOMPLETE"` and the fallback clause) | AC-004-01, FR-004 |
| TC-3F-02 | Dispatch rule is numbered and ordered | Assert the TASKS INCOMPLETE rule is item 6 (per module-design.md §2.4), placed after `"ITERATION CORRIDOR"` (item 4) and before the generic fallback | AC-004-01 |
| TC-3F-03 | `3f-task-completion` handler section exists | Assert `/\*\*3f-task-completion\.\*\*.*TASK COMPLETION RE-DELEGATION/` matches isdlc.md | AC-004-01, FR-004 |
| TC-3F-04 | Handler is anchored in the STEP 3f subsection | Assert `3f-task-completion` section appears AFTER `3f-iteration-corridor` and BEFORE or at the end of the 3f handler group | AC-004-01 |
| TC-3F-05 | Retry-limit table includes task-completion entry | Assert the `3f-retry-protocol` table (lines 2404-2410 region) includes a row matching `/3f-task-completion\s*\|\s*3\s*\|/` | AC-003-01, FR-003 |
| TC-3F-06 | Cross-phase dispatch — phase 05-test-strategy variant | Feed block message with `phase_key=05-test-strategy`; assert dispatch logic is phase-agnostic (handler reads phase_key from message, not hardcoded) | AC-004-01 |
| TC-3F-07 | Negative — no TASKS INCOMPLETE → no dispatch | Block message containing only `"GATE BLOCKED"` must NOT match the task-completion dispatch rule (mutual-exclusion with other 3f rules) | AC-004-01 |
| TC-3F-08 | Case sensitivity — exact string match | Block message containing `"tasks incomplete"` (lowercase) must NOT match; dispatch rule is case-sensitive per existing 3f convention | AC-004-01 |

---

### Section B — Re-delegation prompt content (AC-004-02)

Verifies the `3f-task-completion` handler section in isdlc.md contains the required prompt template and the template, when instantiated with fixture tasks, produces a prompt that names each unfinished task explicitly.

| TC-ID | Description | Assertion | Traces |
|-------|-------------|-----------|--------|
| TC-3F-09 | Prompt template includes retry count | Assert `3f-task-completion` section contains text matching `/Retry\s*\{N\}\s*of\s*3/i` | AC-004-02 (a) |
| TC-3F-10 | Prompt template includes block message body | Assert handler instructs "paste" or equivalent inclusion of the original block message (full body) | AC-004-02 (b) |
| TC-3F-11 | Prompt template includes per-task imperative | Assert template contains a for-each construct producing `T{id}: {description}` lines for every unfinished task | AC-004-02 (c) |
| TC-3F-12 | Prompt template includes reminder about tasks.md | Assert template mentions that `phase_status` cannot be `"completed"` until tasks are `[X]` in `docs/isdlc/tasks.md` | AC-004-02 (d) |
| TC-3F-13 | Instantiated prompt with 1 task names it by ID + description | Simulate handler instantiation with `unfinishedTasks=[{id:"T019", description:"Validate the persistence path end-to-end"}]`; assert produced prompt contains the literal substring `T019: Validate the persistence path end-to-end` | AC-004-02 (c) |
| TC-3F-14 | Instantiated prompt with 3 tasks names all 3 | `unfinishedTasks=[{id:"T017",...},{id:"T019",...},{id:"T020",...}]`; assert produced prompt contains all 3 IDs and all 3 descriptions | AC-004-02 (c) |
| TC-3F-15 | Instantiated prompt preserves task order from block message | Tasks ordered T020, T017, T019 in block message (parse order); assert prompt lists them in the same order | AC-004-02 (c) |
| TC-3F-16 | Prompt includes "DO NOT abandon" directive | Assert template contains prohibition language such as "Do not abandon them or mark them as skipped" (per module-design.md §2.4 step 7) | AC-004-02, Article I.5 |

---

### Section C — Retry counter increment (AC-003-01)

Verifies the phase-loop controller increments `hook_block_retries["task-completion-gate:{phase_key}"]` on each block and re-delegates when counter < 3.

| TC-ID | Description | Setup | Assertion | Traces |
|-------|-------------|-------|-----------|--------|
| TC-3F-17 | First block → counter=1, re-delegate | `state.active_workflow.hook_block_retries = {}` (empty); simulate block | After handler runs: `hook_block_retries["task-completion-gate:06-implementation"] === 1`; handler returns `action="redelegate"` | AC-003-01 |
| TC-3F-18 | Second block → counter=2, re-delegate | `hook_block_retries["task-completion-gate:06-implementation"] = 1`; simulate block | Counter becomes 2; handler returns `action="redelegate"` | AC-003-01 |
| TC-3F-19 | Third block → counter=3, re-delegate (last retry) | `hook_block_retries["task-completion-gate:06-implementation"] = 2`; simulate block | Counter becomes 3; handler returns `action="redelegate"` (3rd retry still proceeds per `<3` wording; module-design table says max=3) | AC-003-01 |
| TC-3F-20 | Counter key is namespaced by phase_key | Block fires on phase 05-test-strategy; assert counter key is `"task-completion-gate:05-test-strategy"` (not `"06-implementation"`) | | AC-003-01 |
| TC-3F-21 | Counter does NOT increment on non-TASKS-INCOMPLETE blocks | Simulate GATE BLOCKED block; assert `hook_block_retries["task-completion-gate:*"]` unchanged | | AC-003-01 (negative) |

---

### Section D — Max retries enforcement + escalation menu (AC-003-02)

Verifies that when the counter reaches the max, the escalation menu is displayed with the exact format specified in AC-003-02.

| TC-ID | Description | Setup | Assertion | Traces |
|-------|-------------|-------|-----------|--------|
| TC-3F-22 | counter >= 3 → escalation menu displayed | `hook_block_retries["task-completion-gate:06-implementation"] = 3`; simulate block | Handler returns `action="escalate"`; escalation output contains the AC-003-02 preamble `"I have asked the orchestrator to implement these tasks"` | AC-003-02 |
| TC-3F-23 | Escalation menu lists all unfinished task IDs | Block message has 3 unfinished tasks T017/T019/T020; counter=3 | Escalation preamble contains `T017, T019, T020` (comma-separated) | AC-003-02 |
| TC-3F-24 | Escalation menu contains exactly 3 options [M]/[S]/[C] | counter=3; capture menu output | Output contains lines matching `/\[M\].*Manually prompt/`, `/\[S\].*Skip for now/`, `/\[C\].*Cancel workflow/` | AC-003-02 |
| TC-3F-25 | Escalation menu format matches module-design §2.4 step 3 | counter=3; assert exact multi-line format | Output matches the 6-line menu template (preamble + "Options:" + 3 option lines + optional trailing blank) byte-for-byte modulo task IDs | AC-003-02 |
| TC-3F-26 | Escalation does NOT re-delegate | counter=3 (already at max) | Handler does NOT call re-delegate; returns `action="escalate"` only | AC-003-02 |
| TC-3F-27 | isdlc.md handler section documents escalation trigger at >= 3 | Read isdlc.md `3f-task-completion` section; assert it contains `/If retries >= 3, present escalation menu/i` | AC-003-02, FR-004 |

---

### Section E — [M] Manually prompt (AC-003-03)

Verifies that on `[M]` selection, user guidance is captured, retry counter is reset, and re-delegation proceeds with guidance appended.

| TC-ID | Description | Setup | Assertion | Traces |
|-------|-------------|-------|-----------|--------|
| TC-3F-28 | [M] selection triggers guidance prompt | User answer = "M"; counter=3 | Handler requests user input for guidance text | AC-003-03 |
| TC-3F-29 | Guidance is appended to re-delegation prompt | User provides guidance `"Check auth.service.ts dependency first"`; counter=3 | Re-delegation prompt contains the verbatim guidance string as an appended section | AC-003-03 |
| TC-3F-30 | Retry counter reset to 0 after [M] | Before: `hook_block_retries["task-completion-gate:06-implementation"] = 3`; user picks [M] | After: counter === 0 | AC-003-03 |
| TC-3F-31 | [M] re-delegates to same phase agent | counter=3; user picks [M] for phase 06-implementation | Handler re-delegates to `software-developer` (agent from PHASE→AGENT table for phase 06) | AC-003-03 |
| TC-3F-32 | [M] handler preserves original block message | counter=3; user picks [M] with guidance | Re-delegation prompt still contains the original TASKS INCOMPLETE block body + task list | AC-003-03 |
| TC-3F-33 | isdlc.md documents [M] behavior | Read `3f-task-completion` section | Contains text matching `/\[M\].*reset retry counter to 0.*re-delegate with guidance appended/is` OR equivalent per module-design.md §2.4 step 4 | AC-003-03, FR-004 |

---

### Section F — [S] Skip + skipped_tasks[] schema (AC-003-04)

Verifies that on `[S]` selection, unfinished task IDs are appended to `active_workflow.skipped_tasks[]` with the exact schema specified in AC-003-04.

| TC-ID | Description | Setup | Assertion | Traces |
|-------|-------------|-------|-----------|--------|
| TC-3F-34 | [S] appends record with full schema | counter=3; unfinished=[T017, T019]; user picks [S] | After handler: `active_workflow.skipped_tasks[0]` has all 4 keys: `phase`, `tasks`, `skipped_at`, `reason` | AC-003-04 |
| TC-3F-35 | skipped_tasks record has correct phase | counter=3 on phase 06-implementation; user picks [S] | `skipped_tasks[0].phase === "06-implementation"` | AC-003-04 |
| TC-3F-36 | skipped_tasks record has task ID array | unfinished=[T017, T019]; user picks [S] | `skipped_tasks[0].tasks` is array equal to `["T017", "T019"]` (preserves order from block message) | AC-003-04 |
| TC-3F-37 | skipped_tasks record has ISO-8601 timestamp | user picks [S] at wall-clock time T | `skipped_tasks[0].skipped_at` is valid ISO-8601 string (regex `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/`) AND parses to a Date within ±5s of T | AC-003-04 |
| TC-3F-38 | skipped_tasks record has fixed reason string | user picks [S] | `skipped_tasks[0].reason === "user_skip_after_retries"` (exact literal) | AC-003-04 |
| TC-3F-39 | [S] appends (does not overwrite) existing records | `active_workflow.skipped_tasks = [{phase:"05-test-strategy", tasks:["T005"], ...}]`; user picks [S] for phase 06 | After: `skipped_tasks.length === 2`; index 0 unchanged; index 1 is new record | AC-003-04 |
| TC-3F-40 | [S] clears retry counter | Before: counter=3; user picks [S] | After: `hook_block_retries["task-completion-gate:06-implementation"] === 0` OR key deleted from object | AC-003-04 |
| TC-3F-41 | [S] allows phase to advance | user picks [S] | Handler returns `action="allow_advance"`; next hook invocation on state.json write for the same phase does NOT re-block | AC-003-04 |
| TC-3F-42 | [S] requires confirmation before recording | user picks [S]; asked "confirm skip?" | Handler uses `AskUserQuestion` to confirm before mutating skipped_tasks | AC-003-04 ("confirms") |
| TC-3F-43 | [S] declined → no state change | user picks [S] but declines confirmation | `skipped_tasks` unchanged; counter unchanged; handler re-shows escalation menu | AC-003-04 (defensive) |
| TC-3F-44 | isdlc.md documents skipped_tasks schema | Read `3f-task-completion` section | Contains text documenting append to `active_workflow.skipped_tasks[]` with `reason: "user_skip_after_retries"` | AC-003-04, FR-004 |

---

### Section G — [C] Cancel (AC-003-05)

Verifies that on `[C]` selection, the existing cancellation path is invoked.

| TC-ID | Description | Setup | Assertion | Traces |
|-------|-------------|-------|-----------|--------|
| TC-3F-45 | [C] invokes existing 3f cancellation | counter=3; user picks [C]; confirms | Handler invokes the existing 3f cancellation path (does NOT duplicate cancellation logic) | AC-003-05 |
| TC-3F-46 | [C] requires confirmation | user picks [C]; asked "confirm cancel?" | `AskUserQuestion` confirms before cancelling | AC-003-05 ("confirms") |
| TC-3F-47 | [C] declined → no cancellation | user picks [C] but declines | Workflow continues; escalation menu re-shown | AC-003-05 (defensive) |
| TC-3F-48 | isdlc.md documents [C] delegates to existing path | Read `3f-task-completion` section | Contains text referencing "existing 3f cancellation handler" or "existing 3f cancellation path" (per module-design.md §2.4 step 6) | AC-003-05, FR-004 |

---

### Section H — End-to-end markdown-contract regression

Verifies the complete isdlc.md amendment is well-formed and consistent with surrounding handlers.

| TC-ID | Description | Assertion | Traces |
|-------|-------------|-----------|--------|
| TC-3F-49 | 3f-task-completion section follows shared 3f-retry-protocol | Assert handler body references `3f-retry-protocol` (the shared retry mechanism) | FR-003, AC-003-01 |
| TC-3F-50 | Handler section has numbered steps 1-8 per module-design §2.4 | Assert handler contains at least steps labeled 1., 2., 3., 4., 5., 6., 7., 8. in order | FR-004 |
| TC-3F-51 | Handler loops back to STEP 3d on return | Assert step 8 (or final step) contains `/loop back to STEP 3d/i` | FR-003, AC-003-01 |
| TC-3F-52 | No orphan references — all mentioned sections exist | For every `/3f-[a-z-]+/` reference in the new handler, assert the target section exists elsewhere in isdlc.md | FR-004 (regression safety) |
| TC-3F-53 | Block message parse pattern documented | Assert handler section includes the parse pattern `/- \[ \] T\{id\}:\s*\{desc\}/` (or equivalent) per module-design.md §2.4 step 1 | AC-004-02 (parsing) |
| TC-3F-54 | Dispatch list renumbering is correct | After TASKS INCOMPLETE insertion at item 6, assert the fallback clause (previously item 6) is renumbered to 7 | AC-004-01 (module-design §2.4) |

---

### Traceability Summary (3f Dispatch Integration)

| Requirement / AC | Test Case IDs |
|------------------|---------------|
| **FR-003** (Retry and escalation) | TC-3F-05, 17, 18, 19, 20, 21, 22, 26, 49, 51 |
| **FR-004** (Phase-Loop Controller integration) | TC-3F-01, 02, 03, 04, 05, 27, 33, 44, 48, 50, 52, 54 |
| **AC-003-01** (retry counter increment) | TC-3F-05, 17, 18, 19, 20, 21, 49, 51 |
| **AC-003-02** (escalation menu format) | TC-3F-22, 23, 24, 25, 26, 27 |
| **AC-003-03** ([M] manually prompt) | TC-3F-28, 29, 30, 31, 32, 33 |
| **AC-003-04** ([S] skip + schema) | TC-3F-34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44 |
| **AC-003-05** ([C] cancel) | TC-3F-45, 46, 47, 48 |
| **AC-004-01** (dispatch routing) | TC-3F-01, 02, 03, 04, 06, 07, 08, 54 |
| **AC-004-02** (re-delegation prompt) | TC-3F-09, 10, 11, 12, 13, 14, 15, 16, 53 |

### Coverage Commitments (3f Dispatch)

- **100% of AC-004-01 dispatch semantics**: mutual-exclusion with other 3f rules (TC-3F-07), case-sensitivity (TC-3F-08), phase-agnostic routing (TC-3F-06), numbering stability (TC-3F-02, 54)
- **100% of AC-004-02 prompt elements** (a-d): TC-3F-09, 10, 11, 12
- **100% of AC-003-02 menu options** [M]/[S]/[C]: TC-3F-24
- **100% of AC-003-04 skipped_tasks schema fields** (phase, tasks, skipped_at, reason): TC-3F-35, 36, 37, 38
- **Regression safety** for isdlc.md amendments: TC-3F-49, 50, 51, 52, 54 assert structural consistency with surrounding 3f handlers

### Out of Scope for This Section

- Actual execution of the Phase-Loop Controller end-to-end with live sub-agent delegation → deferred to Phase 06 task T014 (if tracked) or out-of-scope for this requirement (requires running agents)
- Testing AskUserQuestion / user-input mocking beyond handler-internal branches → covered by inline simulations (user answers injected as fixtures)
- Verifying the TaskCreate/TaskUpdate side-effects of the phase agent during re-delegation → out of scope (tested in REQ-GH-223 TaskCreate suite)
- Performance of the dispatch handler → micro-optimization; handler runs at most 3 times per phase

---

**Total 3f dispatch integration test cases**: 54
- Section A (dispatch wiring): 8 (TC-3F-01..08)
- Section B (prompt content): 8 (TC-3F-09..16)
- Section C (retry counter): 5 (TC-3F-17..21)
- Section D (max retries + menu): 6 (TC-3F-22..27)
- Section E ([M] manually): 6 (TC-3F-28..33)
- Section F ([S] skip): 11 (TC-3F-34..44)
- Section G ([C] cancel): 4 (TC-3F-45..48)
- Section H (regression): 6 (TC-3F-49..54)

**Updated grand total test cases (logic + hook entry + bridge + 3f dispatch)**: 74 + 39 + 39 + 54 = 206
