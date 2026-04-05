# Test Fixtures: task-completion-gate hook

**Source**: GitHub #232
**Slug**: REQ-GH-232-task-completion-gate-hook
**Phase**: 05 - Test Strategy
**Task**: T005
**Traces**: FR-001, FR-002
**Created**: 2026-04-05

---

## Purpose

This document catalogs test fixtures used by unit and integration tests for:

- `src/claude/hooks/lib/task-completion-logic.cjs` — pure logic (`check`, `detectPhaseCompletionTransition`, `countUnfinishedTopLevelTasks`, `formatBlockMessage`)
- `src/claude/hooks/task-completion-gate.cjs` — hook entry (stdin → block response)
- `src/core/bridge/tasks.cjs` — ESM dynamic-import wrapper for `readTaskPlan()`

Each fixture is assigned a stable `FIX-ID` that test cases reference from `test-cases.md`.

Fixtures are grouped into four sections:

1. **tasks.md fixtures** — sample markdown files for various task-completeness scenarios
2. **state.json diff fixtures** — old/new state pairs for transition detection
3. **tool_input fixtures** — Edit/Write payloads as delivered by the hook event loop
4. **TaskPlan object fixtures** — shapes returned by `readTaskPlan()` after parsing

---

## 1. tasks.md Fixtures

Format reference: v3.0 tasks.md parser (see `src/core/tasks/task-reader.js`). Parent tasks use `TNNN` (3-digit) IDs; sub-tasks use `TNNNA` (3-digit + letter). Only top-level (parent) tasks participate in the completion check.

---

### FIX-TM-001: All Tasks Done (No Violation)

**Scenario**: Phase 06 has 3 top-level tasks, all marked `[X]`. The hook MUST allow the transition (no violation).

**Used by**: Happy-path tests for `countUnfinishedTopLevelTasks`, `check`, and end-to-end hook tests.

```markdown
# Task Plan: REQ-GH-XXX sample-feature

Format: v3.0

## Phase 06: Implementation -- IN PROGRESS

- [X] T001 Create authentication service module | traces: FR-001
  files: src/auth/service.js (CREATE)
- [X] T002 Wire router middleware | traces: FR-002
  files: src/router/middleware.js (MODIFY)
  blocked_by: [T001]
- [X] T003 Add integration smoke test | traces: FR-003
  files: tests/auth/smoke.test.js (CREATE)
  blocked_by: [T002]
```

**Expected parser output**: 3 tasks in `phases["06"]`, all `complete: true`.
**Expected `countUnfinishedTopLevelTasks` result**: `[]`
**Expected `check` decision**: `"allow"`

---

### FIX-TM-002: Some Tasks Pending (Block Trigger)

**Scenario**: Phase 06 has 5 top-level tasks; 2 are still `[ ]`. The hook MUST block with a TASKS INCOMPLETE message listing both unfinished tasks.

**Used by**: Block-path tests for `check`, `formatBlockMessage`, end-to-end block tests.

```markdown
# Task Plan: REQ-GH-XXX sample-feature

Format: v3.0

## Phase 06: Implementation -- IN PROGRESS

- [X] T001 Create authentication service module | traces: FR-001
  files: src/auth/service.js (CREATE)
- [X] T002 Wire router middleware | traces: FR-002
  files: src/router/middleware.js (MODIFY)
- [ ] T003 Add integration smoke test | traces: FR-003
  files: tests/auth/smoke.test.js (CREATE)
- [X] T004 Update API documentation | traces: FR-004
  files: docs/api.md (MODIFY)
- [ ] T005 Register hook in settings.json | traces: FR-005
  files: src/claude/settings.json (MODIFY)
```

**Expected parser output**: 5 tasks; T003 and T005 have `complete: false`.
**Expected `countUnfinishedTopLevelTasks` result**:
```js
[
  { id: "T003", description: "Add integration smoke test" },
  { id: "T005", description: "Register hook in settings.json" }
]
```
**Expected `check` decision**: `"block"` with 2 unfinished tasks in message.

---

### FIX-TM-003: Mix of Parent + Sub-tasks (Sub-task Exclusion)

**Scenario**: Phase 06 has 2 top-level tasks (T001, T002). T001 has two sub-tasks (T001A, T001B) that are incomplete, while T001 itself is marked `[X]`. T002 is `[ ]`. The hook MUST count only T002 as unfinished because sub-tasks are excluded from top-level counting (per REQ-GH-223 auto-completion semantics).

**Used by**: Sub-task exclusion tests for `countUnfinishedTopLevelTasks`.

```markdown
# Task Plan: REQ-GH-XXX sample-feature

Format: v3.0

## Phase 06: Implementation -- IN PROGRESS

- [X] T001 Build login flow | traces: FR-001
  files: src/auth/login.js (CREATE)
- [ ] T001A Validate email format | traces: FR-001
  files: src/auth/login.js (MODIFY)
- [ ] T001B Validate password strength | traces: FR-001
  files: src/auth/login.js (MODIFY)
- [ ] T002 Build logout flow | traces: FR-002
  files: src/auth/logout.js (CREATE)
```

**Expected parser output**: 4 tasks; T001A.parentId="T001", T001B.parentId="T001", T001/T002 parentId=null.
**Expected `countUnfinishedTopLevelTasks` result** (filter: `parentId === null && status === "pending"`):
```js
[
  { id: "T002", description: "Build logout flow" }
]
```
T001A and T001B are excluded (non-null parentId).
**Expected `check` decision**: `"block"` with 1 unfinished task.

---

### FIX-TM-004: Missing Phase Section (Fail-Open Scope Mismatch)

**Scenario**: tasks.md exists and is well-formed, but has no `## Phase 06:` section (only phases 05, 07, 08). The hook intercepts a state.json write transitioning phase "06-implementation" to completed; since no matching section exists, hook MUST fail-open (exit 0, silent).

**Used by**: `hasMatchingPhaseSection` tests, AC-002-03 fail-open tests, TCG-007.

```markdown
# Task Plan: REQ-GH-XXX sample-feature

Format: v3.0

## Phase 05: Test Strategy -- COMPLETE

- [X] T001 Design test cases | traces: FR-001
  files: docs/test-cases.md (CREATE)

## Phase 07: Code Review -- PENDING

- [ ] T010 Review implementation | traces: FR-002
  files: src/**/*.js (REVIEW)

## Phase 08: Quality Loop -- PENDING

- [ ] T020 Run coverage report | traces: FR-003
  files: coverage/lcov.info (CREATE)
```

**Expected parser output**: 3 tasks across phases 05, 07, 08; no phase "06" key in `plan.phases`.
**Expected `hasMatchingPhaseSection(plan, "06")` result**: `false`
**Expected `check` decision**: `"allow"` (fail-open scope mismatch).

---

### FIX-TM-005: Empty tasks.md (Fail-Open Parse Error)

**Scenario**: tasks.md exists but is empty or whitespace-only. `readTaskPlan()` returns `{ error: "parse_failed", reason: "empty file" }`. The bridge wrapper MUST return `null`, and the hook MUST fail-open.

**Used by**: Bridge fail-open tests, `check` null-taskPlan tests, TCG-006.

**File content**: (empty file, 0 bytes)

Alternative variant: whitespace-only
```


```

**Expected parser output**: `{ error: "parse_failed", reason: "empty file" }`
**Expected bridge `readTaskPlan()` result**: `null` (bridge normalizes error objects to null via the try/catch contract)

> **Note**: The bridge contract in module-design.md §2.3 specifies return `null` on error. The bridge MAY map `{error, reason}` objects from the ESM parser to `null` for caller simplicity. Test T007 covers this normalization.

**Expected `check` decision** (with `taskPlan === null`): `"allow"` (fail-open).

---

### FIX-TM-006: Missing tasks.md File (Fail-Open File-Not-Found)

**Scenario**: `docs/isdlc/tasks.md` does not exist on disk. `readTaskPlan()` returns `null` (per AC-011-03 of task-reader). Hook MUST fail-open.

**Used by**: File-not-found tests, TCG-006.

**Fixture setup**: Ensure path `docs/isdlc/tasks.md` does NOT exist in the test's temp workspace.

**Expected `readTaskPlan(path)` result**: `null`
**Expected `check` decision**: `"allow"` (fail-open).

---

### FIX-TM-007: Malformed tasks.md (Fail-Open Parse Error)

**Scenario**: tasks.md exists with content but has no `## Phase NN:` section headers at all. Parser returns `{ error: "parse_failed", reason: "no phase sections" }`.

**Used by**: Malformed-input fail-open tests, TCG-006.

```markdown
# Task Plan: corrupted

This file is missing all phase headers.

- Some arbitrary bullet point
- Another bullet
```

**Expected parser output**: `{ error: "parse_failed", reason: "no phase sections" }`
**Expected bridge result**: `null`
**Expected `check` decision**: `"allow"` (fail-open).

---

### FIX-TM-008: Large tasks.md with Multiple Phases

**Scenario**: Realistic tasks.md with 4 phases (05, 06, 16, 08) totalling 20 tasks. Phase 06 has 11 tasks, 3 of which are unfinished. Used to validate that the hook correctly scopes counting to only the transitioning phase and ignores other phases' completion state.

**Used by**: Phase-scoping tests, realistic fixture for end-to-end tests.

```markdown
# Task Plan: REQ-GH-XXX sample-feature

Format: v3.0

## Progress Summary

| Phase | Tasks | Complete | Status |
|-------|-------|----------|--------|
| 05 | 5 | 5 | COMPLETE |
| 06 | 11 | 8 | IN PROGRESS |
| 16 | 2 | 0 | PENDING |
| 08 | 2 | 0 | PENDING |

## Phase 05: Test Strategy -- COMPLETE

- [X] T001 Task one | traces: FR-001
- [X] T002 Task two | traces: FR-001
- [X] T003 Task three | traces: FR-001
- [X] T004 Task four | traces: FR-001
- [X] T005 Task five | traces: FR-001

## Phase 06: Implementation -- IN PROGRESS

- [X] T006 Task six | traces: FR-002
- [X] T007 Task seven | traces: FR-002
- [X] T008 Task eight | traces: FR-002
- [X] T009 Task nine | traces: FR-002
- [X] T010 Task ten | traces: FR-002
- [X] T011 Task eleven | traces: FR-002
- [X] T012 Task twelve | traces: FR-002
- [X] T013 Task thirteen | traces: FR-002
- [ ] T014 Task fourteen | traces: FR-002
- [ ] T015 Task fifteen | traces: FR-002
- [ ] T016 Task sixteen | traces: FR-002

## Phase 16: Quality Loop -- PENDING

- [ ] T017 Task seventeen | traces: FR-003
- [ ] T018 Task eighteen | traces: FR-003

## Phase 08: Code Review -- PENDING

- [ ] T019 Task nineteen | traces: FR-004
- [ ] T020 Task twenty | traces: FR-004
```

**Expected `countUnfinishedTopLevelTasks(plan, "06")` result**:
```js
[
  { id: "T014", description: "Task fourteen" },
  { id: "T015", description: "Task fifteen" },
  { id: "T016", description: "Task sixteen" }
]
```
**Expected `check` decision** (for phase "06" transition): `"block"` with 3 unfinished tasks.

---

## 2. state.json Diff Fixtures

Each fixture contains an `oldState` (current on-disk value) and `newState` (proposed value from `tool_input.new_string` / `tool_input.content`). These exercise `detectPhaseCompletionTransition(oldState, newState)`.

Only the relevant fields are shown for brevity; real state objects contain many more fields which are irrelevant to this hook.

---

### FIX-SD-001: Pending → Completed Transition (Block Trigger)

**Scenario**: Phase "06-implementation" transitions from `"in_progress"` to `"completed"`. Hook MUST detect transition and (if tasks incomplete) block.

**Used by**: Happy-path transition detection, AC-001-01.

**oldState**:
```json
{
  "active_workflow": { "type": "build" },
  "phases": {
    "05-test-strategy": { "status": "completed" },
    "06-implementation": { "status": "in_progress" }
  }
}
```

**newState**:
```json
{
  "active_workflow": { "type": "build" },
  "phases": {
    "05-test-strategy": { "status": "completed" },
    "06-implementation": { "status": "completed" }
  }
}
```

**Expected `detectPhaseCompletionTransition(oldState, newState)` result**:
```js
{ phaseKey: "06-implementation", isTransition: true }
```

---

### FIX-SD-002: Idempotent Write — Completed → Completed (No-Op)

**Scenario**: Both old and new states have phase "06-implementation" status=completed (e.g., a re-write of the same state). Hook MUST NOT treat this as a transition; fail-open.

**Used by**: Idempotency tests, AC-002-05, TCG-005.

**oldState**:
```json
{
  "active_workflow": { "type": "build" },
  "phases": {
    "06-implementation": { "status": "completed" }
  }
}
```

**newState**:
```json
{
  "active_workflow": { "type": "build" },
  "phases": {
    "06-implementation": { "status": "completed", "finished_at": "2026-04-05T12:00:00Z" }
  }
}
```

**Expected `detectPhaseCompletionTransition` result**: `null`
**Expected `check` decision**: `"allow"` (short-circuit, no tasks.md read).

---

### FIX-SD-003: Non-Status Change (Other Fields Modified)

**Scenario**: Phase "06-implementation" status stays `"in_progress"`, but other fields change (e.g., `current_iteration++`). Hook MUST NOT treat as transition; fail-open.

**Used by**: AC-002-05, TCG-005.

**oldState**:
```json
{
  "active_workflow": { "type": "build" },
  "phases": {
    "06-implementation": { "status": "in_progress", "current_iteration": 2 }
  }
}
```

**newState**:
```json
{
  "active_workflow": { "type": "build" },
  "phases": {
    "06-implementation": { "status": "in_progress", "current_iteration": 3 }
  }
}
```

**Expected `detectPhaseCompletionTransition` result**: `null`
**Expected `check` decision**: `"allow"`.

---

### FIX-SD-004: New State Has No phases Object (Fail-Open)

**Scenario**: The edit rewrites a top-level field (e.g., `user_preferences`) and the new state object does not contain a `phases` key at all. Hook MUST fail-open.

**Used by**: Defensive tests, TCG-009.

**oldState**:
```json
{
  "active_workflow": { "type": "build" },
  "phases": {
    "06-implementation": { "status": "in_progress" }
  }
}
```

**newState**:
```json
{
  "active_workflow": { "type": "build" },
  "user_preferences": { "theme": "dark" }
}
```

**Expected `detectPhaseCompletionTransition` result**: `null`
**Expected `check` decision**: `"allow"`.

---

### FIX-SD-005: active_workflow.type != "build" (Fail-Open)

**Scenario**: Workflow is a `test-generate` or `upgrade`, not `build`. Even though a phase may be transitioning to completed, hook MUST fail-open silently.

**Used by**: AC-002-01, TCG-004.

**oldState**:
```json
{
  "active_workflow": { "type": "test-generate" },
  "phases": {
    "06-implementation": { "status": "in_progress" }
  }
}
```

**newState**:
```json
{
  "active_workflow": { "type": "test-generate" },
  "phases": {
    "06-implementation": { "status": "completed" }
  }
}
```

**Expected `isBuildWorkflowActive(newState)` result**: `false` (evaluated against the state read from disk by common.cjs, which matches newState semantically)
**Expected hook behavior**: exit 0 silent before tasks.md is even read.

---

### FIX-SD-006: No active_workflow at All (Fail-Open)

**Scenario**: state.json has no `active_workflow` key (framework not initialized or idle). Hook MUST fail-open.

**Used by**: AC-002-01, TCG-004, TCG-003.

**oldState**:
```json
{
  "phases": {
    "06-implementation": { "status": "in_progress" }
  }
}
```

**newState**:
```json
{
  "phases": {
    "06-implementation": { "status": "completed" }
  }
}
```

**Expected `isBuildWorkflowActive(state)` result**: `false`
**Expected hook behavior**: exit 0 silent.

---

### FIX-SD-007: Multiple Phases Transitioning Simultaneously

**Scenario**: Unusual edit changes two phases at once: 05 → completed AND 06 → completed. Per module-design.md §2.2, `detectPhaseCompletionTransition` returns **first match**. The hook evaluates that one phase only (first wins).

**Used by**: Edge-case tests for `detectPhaseCompletionTransition`.

**oldState**:
```json
{
  "active_workflow": { "type": "build" },
  "phases": {
    "05-test-strategy": { "status": "in_progress" },
    "06-implementation": { "status": "pending" }
  }
}
```

**newState**:
```json
{
  "active_workflow": { "type": "build" },
  "phases": {
    "05-test-strategy": { "status": "completed" },
    "06-implementation": { "status": "completed" }
  }
}
```

**Expected `detectPhaseCompletionTransition` result**: `{ phaseKey: "05-test-strategy", isTransition: true }` (insertion order of Object.keys iteration — first key wins)
**Expected `check` decision**: depends on phase "05-test-strategy" section in the paired tasks.md fixture.

> **Note**: Tests MUST rely on documented first-match semantics; do not assume a specific phase wins without checking key order.

---

### FIX-SD-008: New Phase Key Appears (First-Time Completed)

**Scenario**: oldState has no entry for "07-code-review"; newState adds phase "07-code-review" with status=completed. Per transition rule `(oldState.phases[k]?.status || null) !== "completed"`, this IS a transition.

**Used by**: New-phase-key tests.

**oldState**:
```json
{
  "active_workflow": { "type": "build" },
  "phases": {
    "06-implementation": { "status": "completed" }
  }
}
```

**newState**:
```json
{
  "active_workflow": { "type": "build" },
  "phases": {
    "06-implementation": { "status": "completed" },
    "07-code-review": { "status": "completed" }
  }
}
```

**Expected `detectPhaseCompletionTransition` result**: `{ phaseKey: "07-code-review", isTransition: true }`
**Expected `check` behavior**: look up phase section for "07-code-review" in tasks.md; if no matching `## Phase 07:` section, fail-open per FIX-TM-004.

---

## 3. tool_input Fixtures

These fixtures represent the `tool_input` payload delivered to the hook via stdin JSON. The hook extracts either `new_string` (Edit) or `content` (Write) and JSON-parses it to obtain `newState`.

---

### FIX-TI-001: Edit with Valid JSON new_string (Happy Path)

**Scenario**: Phase-Loop Controller issues an Edit to `.isdlc/state.json` replacing the status field. The `new_string` contains the complete new state as valid JSON.

**Used by**: Happy-path hook-entry tests, AC-001-01.

```json
{
  "tool_name": "Edit",
  "tool_input": {
    "file_path": "/abs/path/to/project/.isdlc/state.json",
    "old_string": "\"status\": \"in_progress\"",
    "new_string": "{\n  \"active_workflow\": { \"type\": \"build\" },\n  \"phases\": {\n    \"06-implementation\": { \"status\": \"completed\" }\n  }\n}"
  }
}
```

**Note**: In the actual Edit tool flow, `new_string` contains only the replacement snippet, not the entire file. For testing, the hook treats `new_string` as a candidate JSON blob. If it cannot be parsed as complete JSON (FIX-TI-003), hook fails open per AC-002-04. Real-world tests SHOULD use the Write tool fixture (FIX-TI-002) for clean JSON parsing.

**Expected behavior**: Extract `new_string`, JSON.parse succeeds, proceed to transition detection.

---

### FIX-TI-002: Write with Valid JSON content (Happy Path)

**Scenario**: Phase-Loop Controller uses Write (full rewrite) to update state.json. The `content` field contains the complete new JSON document.

**Used by**: Write-path hook-entry tests, most realistic fixture.

```json
{
  "tool_name": "Write",
  "tool_input": {
    "file_path": "/abs/path/to/project/.isdlc/state.json",
    "content": "{\"active_workflow\":{\"type\":\"build\"},\"phases\":{\"06-implementation\":{\"status\":\"completed\"}}}"
  }
}
```

**Expected behavior**: Extract `content`, JSON.parse succeeds, newState object available for diff.

---

### FIX-TI-003: Malformed JSON (Fail-Open)

**Scenario**: `new_string` is not valid JSON (e.g., a fragment snippet). Hook MUST catch JSON.parse error and fail-open.

**Used by**: AC-002-04, TCG-002.

```json
{
  "tool_name": "Edit",
  "tool_input": {
    "file_path": "/abs/path/to/project/.isdlc/state.json",
    "old_string": "\"in_progress\"",
    "new_string": "\"completed\""
  }
}
```

**Expected behavior**: `parseNewStateFromInput` returns `null`; hook exits 0 silently.

---

### FIX-TI-004: file_path Does Not Target state.json (Fail-Open)

**Scenario**: The Edit targets a different file (e.g., `tasks.md`, `README.md`). Hook MUST short-circuit on file_path check BEFORE attempting any state reads.

**Used by**: AC-002-01 (broad scope guard), file-path filter tests.

```json
{
  "tool_name": "Edit",
  "tool_input": {
    "file_path": "/abs/path/to/project/docs/isdlc/tasks.md",
    "old_string": "- [ ] T001",
    "new_string": "- [X] T001"
  }
}
```

**Expected behavior**: Hook checks `file_path.endsWith(".isdlc/state.json")` → false → exit 0 immediately.

---

### FIX-TI-005: Different tool_name (e.g., Read, Bash)

**Scenario**: Hook matcher is `"Edit|Write"`, so theoretically Claude Code dispatches only on those. If for some reason a different tool_name arrives, hook should be resilient.

**Used by**: Defensive tests.

```json
{
  "tool_name": "Read",
  "tool_input": {
    "file_path": "/abs/path/to/project/.isdlc/state.json"
  }
}
```

**Expected behavior**: Hook proceeds (settings.json matcher filters by tool_name); if no `new_string`/`content` present, `parseNewStateFromInput` returns null → exit 0.

---

### FIX-TI-006: Empty stdin (Fail-Open)

**Scenario**: stdin closes with zero bytes (shouldn't happen in practice, but defensive fail-open required).

**Used by**: AC-002-06, TCG-001.

**stdin input**: `""` (empty string)

**Expected behavior**: Hook detects empty input, exits 0 silently.

---

### FIX-TI-007: Malformed Top-Level stdin JSON (Fail-Open)

**Scenario**: stdin contains non-JSON text.

**Used by**: TCG-001, TCG-009.

**stdin input**:
```
this is not json
```

**Expected behavior**: JSON.parse throws, caught at top level, exit 0.

---

### FIX-TI-008: file_path Ending with state.json But Wrong Directory

**Scenario**: file_path is `some/other/path/state.json` (not under `.isdlc/`). Depending on match implementation, hook MAY short-circuit. Canonical check per module-design.md §2.1 pseudocode: `file_path.endsWith(".isdlc/state.json")`.

**Used by**: Edge-case file-path matching tests.

```json
{
  "tool_name": "Edit",
  "tool_input": {
    "file_path": "/abs/path/to/project/docs/examples/state.json",
    "new_string": "{}"
  }
}
```

**Expected behavior**: `endsWith(".isdlc/state.json")` → false → exit 0.

---

## 4. TaskPlan Object Fixtures

These are the in-memory shapes returned by `readTaskPlan()` after parsing. Tests for `countUnfinishedTopLevelTasks` and `hasMatchingPhaseSection` can use these directly without reading files.

Reference type definition: `src/core/tasks/types.js` (not shown, but inferred from task-reader.js output).

---

### FIX-TP-001: TaskPlan with All Complete Tasks (Mirrors FIX-TM-001)

```js
{
  slug: "REQ-GH-XXX sample-feature",
  format: "v3.0",
  phases: {
    "06": {
      name: "Implementation",
      status: "IN PROGRESS",
      tasks: [
        { id: "T001", description: "Create authentication service module",
          complete: true, parallel: false, parentId: null, children: [],
          files: [{path: "src/auth/service.js", operation: "CREATE"}],
          blockedBy: [], blocks: [], traces: ["FR-001"], metadata: { traces: ["FR-001"] } },
        { id: "T002", description: "Wire router middleware",
          complete: true, parallel: false, parentId: null, children: [],
          files: [{path: "src/router/middleware.js", operation: "MODIFY"}],
          blockedBy: ["T001"], blocks: [], traces: ["FR-002"], metadata: { traces: ["FR-002"] } },
        { id: "T003", description: "Add integration smoke test",
          complete: true, parallel: false, parentId: null, children: [],
          files: [{path: "tests/auth/smoke.test.js", operation: "CREATE"}],
          blockedBy: ["T002"], blocks: [], traces: ["FR-003"], metadata: { traces: ["FR-003"] } }
      ]
    }
  },
  summary: { total: 3, byPhase: { "06": { total: 3, done: 3 } } }
}
```

**Expected `countUnfinishedTopLevelTasks(plan, "06")`**: `[]`
**Expected `hasMatchingPhaseSection(plan, "06")`**: `true`
**Expected `hasMatchingPhaseSection(plan, "07")`**: `false`

---

### FIX-TP-002: TaskPlan with Pending Top-Level Tasks (Mirrors FIX-TM-002)

```js
{
  slug: "REQ-GH-XXX sample-feature",
  format: "v3.0",
  phases: {
    "06": {
      name: "Implementation",
      status: "IN PROGRESS",
      tasks: [
        { id: "T001", description: "Create authentication service module",
          complete: true, parentId: null, children: [],
          files: [{path: "src/auth/service.js", operation: "CREATE"}],
          blockedBy: [], blocks: [], traces: ["FR-001"], parallel: false, metadata: {} },
        { id: "T002", description: "Wire router middleware",
          complete: true, parentId: null, children: [],
          files: [{path: "src/router/middleware.js", operation: "MODIFY"}],
          blockedBy: [], blocks: [], traces: ["FR-002"], parallel: false, metadata: {} },
        { id: "T003", description: "Add integration smoke test",
          complete: false, parentId: null, children: [],
          files: [{path: "tests/auth/smoke.test.js", operation: "CREATE"}],
          blockedBy: [], blocks: [], traces: ["FR-003"], parallel: false, metadata: {} },
        { id: "T004", description: "Update API documentation",
          complete: true, parentId: null, children: [],
          files: [{path: "docs/api.md", operation: "MODIFY"}],
          blockedBy: [], blocks: [], traces: ["FR-004"], parallel: false, metadata: {} },
        { id: "T005", description: "Register hook in settings.json",
          complete: false, parentId: null, children: [],
          files: [{path: "src/claude/settings.json", operation: "MODIFY"}],
          blockedBy: [], blocks: [], traces: ["FR-005"], parallel: false, metadata: {} }
      ]
    }
  },
  summary: { total: 5, byPhase: { "06": { total: 5, done: 3 } } }
}
```

**Expected `countUnfinishedTopLevelTasks(plan, "06")`**:
```js
[
  { id: "T003", description: "Add integration smoke test" },
  { id: "T005", description: "Register hook in settings.json" }
]
```

---

### FIX-TP-003: TaskPlan with Sub-tasks (Mirrors FIX-TM-003)

```js
{
  slug: "REQ-GH-XXX sample-feature",
  format: "v3.0",
  phases: {
    "06": {
      name: "Implementation",
      status: "IN PROGRESS",
      tasks: [
        { id: "T001", description: "Build login flow",
          complete: true, parentId: null, children: ["T001A", "T001B"],
          files: [{path: "src/auth/login.js", operation: "CREATE"}],
          blockedBy: [], blocks: [], traces: ["FR-001"], parallel: false, metadata: {} },
        { id: "T001A", description: "Validate email format",
          complete: false, parentId: "T001", children: [],
          files: [{path: "src/auth/login.js", operation: "MODIFY"}],
          blockedBy: [], blocks: [], traces: ["FR-001"], parallel: false, metadata: {} },
        { id: "T001B", description: "Validate password strength",
          complete: false, parentId: "T001", children: [],
          files: [{path: "src/auth/login.js", operation: "MODIFY"}],
          blockedBy: [], blocks: [], traces: ["FR-001"], parallel: false, metadata: {} },
        { id: "T002", description: "Build logout flow",
          complete: false, parentId: null, children: [],
          files: [{path: "src/auth/logout.js", operation: "CREATE"}],
          blockedBy: [], blocks: [], traces: ["FR-002"], parallel: false, metadata: {} }
      ]
    }
  },
  summary: { total: 4, byPhase: { "06": { total: 4, done: 1 } } }
}
```

**Expected `countUnfinishedTopLevelTasks(plan, "06")`**:
```js
[
  { id: "T002", description: "Build logout flow" }
]
```
(T001A, T001B excluded because `parentId !== null`.)

---

### FIX-TP-004: TaskPlan with No Matching Phase (Mirrors FIX-TM-004)

```js
{
  slug: "REQ-GH-XXX sample-feature",
  format: "v3.0",
  phases: {
    "05": {
      name: "Test Strategy",
      status: "COMPLETE",
      tasks: [
        { id: "T001", description: "Design test cases",
          complete: true, parentId: null, children: [],
          files: [{path: "docs/test-cases.md", operation: "CREATE"}],
          blockedBy: [], blocks: [], traces: ["FR-001"], parallel: false, metadata: {} }
      ]
    },
    "07": {
      name: "Code Review",
      status: "PENDING",
      tasks: [
        { id: "T010", description: "Review implementation",
          complete: false, parentId: null, children: [],
          files: [{path: "src/**/*.js", operation: "REVIEW"}],
          blockedBy: [], blocks: [], traces: ["FR-002"], parallel: false, metadata: {} }
      ]
    },
    "08": {
      name: "Quality Loop",
      status: "PENDING",
      tasks: [
        { id: "T020", description: "Run coverage report",
          complete: false, parentId: null, children: [],
          files: [{path: "coverage/lcov.info", operation: "CREATE"}],
          blockedBy: [], blocks: [], traces: ["FR-003"], parallel: false, metadata: {} }
      ]
    }
  },
  summary: { total: 3, byPhase: { "05": { total: 1, done: 1 }, "07": { total: 1, done: 0 }, "08": { total: 1, done: 0 } } }
}
```

**Expected `hasMatchingPhaseSection(plan, "06")`**: `false`
**Expected `check` decision** (for phase "06-implementation" transition): `"allow"` (TCG-007 fail-open).

---

### FIX-TP-005: Null TaskPlan (Missing or Malformed tasks.md)

**Scenario**: The bridge returned `null` (file not found, parse error, empty file).

```js
const plan = null;
```

**Expected `countUnfinishedTopLevelTasks(null, "06")`**: `[]` (per module-design.md §2.2: "returns empty array on any null/undefined")
**Expected `hasMatchingPhaseSection(null, "06")`**: `false`
**Expected `check` decision**: `"allow"` (TCG-006 fail-open).

---

### FIX-TP-006: Phase Key Mapping Mismatch (tasks.md uses "06", state.json uses "06-implementation")

**Scenario**: tasks.md parser produces phase keys like `"06"` (numeric), while state.json uses long-form keys like `"06-implementation"`. This is a real concern — tests MUST validate how the hook reconciles these two key schemes.

**Used by**: Phase-key matching tests.

**TaskPlan** (from FIX-TM-001):
```js
{
  phases: {
    "06": { name: "Implementation", status: "IN PROGRESS", tasks: [...] }
  }
}
```

**state.json phase key**: `"06-implementation"`

**Expected behavior**: `hasMatchingPhaseSection(plan, "06-implementation")` MUST normalize by extracting the leading digits from the state.json key (e.g., via `phaseKey.match(/^(\d+)/)[1]`) to match against the tasks.md key. If numeric prefix match succeeds → section found. If no match → fail-open per FIX-TM-004.

> **Implementation note**: This normalization rule is a requirement of the phase-key bridge. Tests MUST cover:
> - `"06-implementation"` → normalizes to `"06"` → matches
> - `"05-test-strategy"` → normalizes to `"05"` → matches
> - `"16-quality-loop"` → normalizes to `"16"` → matches
> - Invalid key without numeric prefix → no match → fail-open

This normalization is implicit in module-design.md §2.2 (`hasMatchingPhaseSection`); the test suite should assert the exact mapping rules chosen during implementation.

---

## 5. Composite Fixtures (for end-to-end hook tests)

These fixtures bundle a tasks.md file + a tool_input payload + expected hook behavior, for use in copy-to-temp integration tests of `task-completion-gate.cjs`.

---

### FIX-C-001: End-to-End Block (Happy Block Path)

- **tasks.md**: FIX-TM-002 (2 unfinished tasks)
- **tool_input**: FIX-TI-002 (Write with valid JSON, transitioning "06-implementation" to completed)
- **state.json (on disk)**: `{ "active_workflow": { "type": "build" }, "phases": { "06-implementation": { "status": "in_progress" } } }`
- **Expected hook**:
  - Exit code: 2
  - stderr contains: `"TASKS INCOMPLETE: Phase 06-implementation has 2 unfinished top-level tasks"`
  - stderr contains: `"- [ ] TT003: Add integration smoke test"` (format per AC-001-02; note: the T prefix is duplicated in the template — see note below)
  - stderr contains: `"- [ ] TT005: Register hook in settings.json"`
  - stdout contains: `{"decision": "block", ...}` (outputBlockResponse format)

> **Format note**: AC-001-02 specifies `- [ ] T{id}: {description}` where `{id}` is the numeric portion. Since parsed task IDs already include the "T" prefix (e.g., "T003"), tests MUST assert the exact format chosen during implementation. Options:
> - Strip T prefix: `"- [ ] T003: Add..."` (treats id as "003")
> - Use full id: `"- [ ] T003: Add..."` (treats id as "T003" without template T prefix)
>
> Recommended: the implementation should produce `"- [ ] T003: Add integration smoke test"` (no double T). Tests should assert single T prefix. This is a minor disambiguation of AC-001-02.

---

### FIX-C-002: End-to-End Allow (Happy Allow Path)

- **tasks.md**: FIX-TM-001 (all tasks done)
- **tool_input**: FIX-TI-002
- **state.json (on disk)**: `{ "active_workflow": { "type": "build" }, "phases": { "06-implementation": { "status": "in_progress" } } }`
- **Expected hook**:
  - Exit code: 0
  - stderr: empty
  - stdout: empty

---

### FIX-C-003: End-to-End Fail-Open (Non-Build Workflow)

- **tasks.md**: FIX-TM-002 (2 unfinished tasks — irrelevant, never read)
- **tool_input**: FIX-TI-002
- **state.json (on disk)**: `{ "active_workflow": { "type": "test-generate" }, "phases": { "06-implementation": { "status": "in_progress" } } }`
- **Expected hook**:
  - Exit code: 0
  - stderr: empty
  - stdout: empty
  - Behavior: `isBuildWorkflowActive(state)` returns false BEFORE tasks.md is read.

---

### FIX-C-004: End-to-End Fail-Open (No tasks.md)

- **tasks.md**: FIX-TM-006 (file does not exist)
- **tool_input**: FIX-TI-002
- **state.json (on disk)**: `{ "active_workflow": { "type": "build" }, "phases": { "06-implementation": { "status": "in_progress" } } }`
- **Expected hook**:
  - Exit code: 0
  - stderr: may contain warning (`"tasks.md missing or unreadable"`) per TCG-006
  - stdout: empty

---

### FIX-C-005: End-to-End Fail-Open (Malformed stdin)

- **tasks.md**: any
- **tool_input**: FIX-TI-007 (non-JSON stdin)
- **state.json (on disk)**: any
- **Expected hook**:
  - Exit code: 0
  - stderr: empty
  - stdout: empty

---

## 6. Fixture-to-Test Mapping (cross-reference)

| FIX-ID | Primary Test Cases | FRs/ACs / Error Codes Covered |
|--------|-------------------|-------------------------------|
| FIX-TM-001 | TC-LOGIC-001, TC-E2E-002 | AC-001-01 (happy allow) |
| FIX-TM-002 | TC-LOGIC-002, TC-E2E-001 | AC-001-01, AC-001-02 (block) |
| FIX-TM-003 | TC-LOGIC-003 | Sub-task exclusion (module-design §2.2) |
| FIX-TM-004 | TC-LOGIC-004 | AC-002-03, TCG-007 |
| FIX-TM-005 | TC-BRIDGE-002 | TCG-006 (empty file) |
| FIX-TM-006 | TC-BRIDGE-001, TC-E2E-004 | AC-002-02, TCG-006 (file missing) |
| FIX-TM-007 | TC-BRIDGE-003 | TCG-006 (no phase sections) |
| FIX-TM-008 | TC-LOGIC-005 | Phase scoping |
| FIX-SD-001 | TC-LOGIC-006 | AC-001-01 (transition detection) |
| FIX-SD-002 | TC-LOGIC-007 | AC-002-05, TCG-005 (idempotent) |
| FIX-SD-003 | TC-LOGIC-008 | AC-002-05, TCG-005 (non-status change) |
| FIX-SD-004 | TC-LOGIC-009 | Defensive; TCG-009 |
| FIX-SD-005 | TC-LOGIC-010, TC-E2E-003 | AC-002-01, TCG-004 |
| FIX-SD-006 | TC-LOGIC-011 | AC-002-01, TCG-003/004 |
| FIX-SD-007 | TC-LOGIC-012 | Multiple transitions (first-match) |
| FIX-SD-008 | TC-LOGIC-013 | New phase key |
| FIX-TI-001 | TC-GATE-001 | Edit input parsing |
| FIX-TI-002 | TC-GATE-002, TC-E2E-001..005 | Write input parsing (canonical) |
| FIX-TI-003 | TC-GATE-003 | AC-002-04, TCG-002 |
| FIX-TI-004 | TC-GATE-004 | file_path filter |
| FIX-TI-005 | TC-GATE-005 | Defensive tool_name |
| FIX-TI-006 | TC-GATE-006 | AC-002-06, TCG-001 |
| FIX-TI-007 | TC-GATE-007, TC-E2E-005 | TCG-001, TCG-009 |
| FIX-TI-008 | TC-GATE-008 | file_path edge case |
| FIX-TP-001..006 | TC-LOGIC-001..013 | Used as in-memory inputs to pure functions |
| FIX-C-001 | TC-E2E-001 | Full block path |
| FIX-C-002 | TC-E2E-002 | Full allow path |
| FIX-C-003 | TC-E2E-003 | Non-build fail-open |
| FIX-C-004 | TC-E2E-004 | Missing tasks.md fail-open |
| FIX-C-005 | TC-E2E-005 | Malformed stdin fail-open |

---

## 7. Fixture Maintenance Notes

1. **Single source of truth**: When implementation clarifies the T-prefix format (FIX-C-001 note) or the phase-key normalization rule (FIX-TP-006 note), update this document AND the corresponding test assertions in lockstep.
2. **Backward compat**: If the TaskPlan schema changes (e.g., adds a field), update FIX-TP-* fixtures. The parser ignores unknown fields; fixtures should include all documented fields.
3. **Realism**: Fixtures are minimal but realistic — they mirror the parsing path of the real `readTaskPlan()` so that migrating tests between mock-mode and file-mode is a single-line change.
4. **Path handling**: All `file_path` values in tool_input fixtures use forward-slash notation. Tests on Windows must normalize paths before assertion.
