# Module Design: Mechanical Execution Mode (Agent 05)

**Version**: 1.0.0
**Date**: 2026-02-11
**Author**: System Designer (Agent 03)
**Phase**: 04-design
**Traces**: FR-05, AC-05a through AC-05g, ADR-0003

---

## 1. Module Overview

Mechanical execution mode is an opt-in execution strategy for the software-developer agent (Agent 05) during Phase 06 (Implementation). When active, the agent follows tasks.md task-by-task in dependency order rather than self-decomposing work. This mode is specified as a new section within `src/claude/agents/05-software-developer.md`.

### Mode Detection Logic

```
ON PHASE START:
  1. Read state.json -> active_workflow.mechanical_mode
  2. IF mechanical_mode === true:
     a. Read docs/isdlc/tasks.md
     b. Locate Phase 06 section
     c. Check if ANY Phase 06 task has a 'files:' sub-line
     d. IF file-level tasks exist:
        -> ENTER MECHANICAL MODE
     e. ELSE (no file-level tasks):
        -> EMIT WARNING: "Mechanical mode requested but Phase 06 tasks lack
           file-level detail. Falling back to standard mode."
        -> ENTER STANDARD MODE
  3. IF mechanical_mode is false, missing, or undefined:
     -> ENTER STANDARD MODE (default, existing behavior)
```

---

## 2. Execution Algorithm (Pseudocode)

### 2.1 Task Parsing

```
FUNCTION parse_phase06_tasks(tasks_md_content):
  tasks = []
  in_phase06 = false
  current_task = null

  FOR each line in tasks_md_content:
    IF line matches "## Phase 06:" or "## Phase NN: Implementation":
      in_phase06 = true
      CONTINUE

    IF in_phase06 AND line matches "## Phase":
      // Next phase section reached, stop
      in_phase06 = false
      IF current_task: tasks.append(current_task)
      BREAK

    IF in_phase06 AND line matches "^- \[([ X]|BLOCKED)\] (T\d{4}) (.+)":
      IF current_task: tasks.append(current_task)
      current_task = {
        id: match.group(2),           // T0040
        status: match.group(1),       // ' ' or 'X' or 'BLOCKED'
        description: match.group(3),  // Full line after ID
        traces: [],
        blocked_by: [],
        blocks: [],
        files: [],
        reason: null
      }
      // Parse pipe annotations on same line
      IF '|' in match.group(3):
        parts = match.group(3).split('|')
        current_task.description = parts[0].strip()
        FOR each annotation in parts[1:]:
          key, value = annotation.strip().split(':', 1)
          IF key.strip() == 'traces':
            current_task.traces = parse_csv(value)

    ELIF in_phase06 AND current_task AND line matches "^  (blocked_by|blocks): \[(.+)\]":
      key = match.group(1)
      ids = parse_task_id_list(match.group(2))
      current_task[key] = ids

    ELIF in_phase06 AND current_task AND line matches "^  files: (.+)":
      current_task.files = parse_file_specs(match.group(1))

    ELIF in_phase06 AND current_task AND line matches "^  reason: (.+)":
      current_task.reason = match.group(1)

  IF current_task: tasks.append(current_task)
  RETURN tasks
```

### 2.2 Dependency Graph Construction

```
FUNCTION build_dependency_graph(tasks):
  // Build adjacency list
  graph = {}    // task_id -> [dependent_task_ids]
  in_degree = {}

  FOR each task in tasks:
    graph[task.id] = []
    in_degree[task.id] = 0

  FOR each task in tasks:
    FOR each blocker_id in task.blocked_by:
      IF blocker_id in graph:
        graph[blocker_id].append(task.id)
        in_degree[task.id] += 1

  RETURN graph, in_degree
```

### 2.3 Topological Sort (Execution Order)

```
FUNCTION compute_execution_order(tasks, graph, in_degree):
  // Kahn's algorithm
  queue = []
  FOR each task in tasks:
    IF in_degree[task.id] == 0:
      queue.append(task.id)

  execution_order = []
  WHILE queue is not empty:
    // Pick the task with lowest ID for deterministic ordering
    queue.sort()
    current_id = queue.pop(0)
    execution_order.append(current_id)

    FOR each dependent_id in graph[current_id]:
      in_degree[dependent_id] -= 1
      IF in_degree[dependent_id] == 0:
        queue.append(dependent_id)

  // Cycle detection
  IF len(execution_order) != len(tasks):
    remaining = [t.id for t in tasks if t.id not in execution_order]
    EMIT WARNING: "Dependency cycle detected involving: {remaining}"
    // Append remaining tasks in ID order (best effort)
    execution_order.extend(sorted(remaining))

  RETURN execution_order
```

### 2.4 Main Execution Loop

```
FUNCTION execute_mechanical_mode(tasks_md_path):
  // Phase 1: Parse and prepare
  content = read_file(tasks_md_path)
  tasks = parse_phase06_tasks(content)
  task_map = { t.id: t for t in tasks }
  graph, in_degree = build_dependency_graph(tasks)
  execution_order = compute_execution_order(tasks, graph, in_degree)

  // Phase 2: Execute
  completed = set()
  blocked = set()
  deviations = []

  FOR each task_id in execution_order:
    task = task_map[task_id]

    // Skip already completed tasks
    IF task.status == 'X':
      completed.add(task_id)
      CONTINUE

    // Skip already blocked tasks
    IF task.status == 'BLOCKED':
      blocked.add(task_id)
      CONTINUE

    // Check dependencies are satisfied
    unmet = [b for b in task.blocked_by if b not in completed]
    IF unmet:
      // Dependencies not met (should not happen with correct topo sort,
      // but possible if a dependency was BLOCKED)
      mark_blocked(tasks_md_path, task_id,
        "Unmet dependencies: " + ", ".join(unmet))
      blocked.add(task_id)
      CONTINUE

    // Execute the task
    LOG: "Executing {task_id}: {task.description}"
    success = execute_single_task(task)

    IF success:
      mark_completed(tasks_md_path, task_id)
      completed.add(task_id)
    ELSE:
      // Task failed after retry attempts
      mark_blocked(tasks_md_path, task_id,
        "Implementation failed after retries -- see iteration log")
      blocked.add(task_id)

  // Phase 3: Report
  remaining = len(tasks) - len(completed) - len(blocked)
  EMIT SUMMARY:
    "Mechanical execution complete:
     {len(completed)} completed, {len(blocked)} blocked, {remaining} remaining"
  IF deviations:
    EMIT: "Deviations detected: {len(deviations)}"
    FOR each d in deviations:
      EMIT: "  [DEVIATION] {d}"

  RETURN completed, blocked, deviations
```

### 2.5 Single Task Execution

```
FUNCTION execute_single_task(task):
  // Step 1: Understand the task
  LOG: "Task {task.id}: {task.description}"
  LOG: "  Traces: {task.traces}"
  LOG: "  Files: {task.files}"

  // Step 2: For each file in the task
  FOR each file_spec in task.files:
    path = file_spec.path
    action = file_spec.action  // CREATE or MODIFY

    IF action == "CREATE":
      // Create the file with the specified content
      // Read the traces to understand what acceptance criteria to fulfill
      // Read the module design for implementation details
      create_file(path, guided_by=task.traces)

    ELIF action == "MODIFY":
      // Read the existing file
      // Apply the changes described in the task description
      // Preserve existing content not mentioned in the task
      modify_file(path, guided_by=task.traces, description=task.description)

  // Step 3: TDD cycle (even in mechanical mode, TDD is mandatory)
  IF task has associated test expectations:
    write_or_update_tests(task)
    run_tests()
    IF tests_fail:
      fix_implementation()
      run_tests()  // retry

  // Step 4: Verify
  IF all_tests_pass:
    RETURN true
  ELSE:
    // Allow up to 3 retries within a single task
    FOR attempt in 1..3:
      fix_and_retry()
      IF all_tests_pass:
        RETURN true
    RETURN false  // Failed after retries
```

---

## 3. Task State Transitions

### 3.1 Checkbox States

| State | Syntax | Meaning | Set By |
|-------|--------|---------|--------|
| Pending | `- [ ]` | Not yet attempted | Initial generation |
| Completed | `- [X]` | Successfully implemented and tested | Agent 05 on success |
| Blocked | `- [BLOCKED]` | Cannot be completed as specified | Agent 05 on failure |

### 3.2 Transition Rules

```
[ ] -> [X]        : Task completed successfully
[ ] -> [BLOCKED]  : Task failed after retries, or dependencies blocked
[X] -> (no change): Completed tasks are never reverted
[BLOCKED] -> [ ]  : Only on manual re-run (human intervention)
```

### 3.3 Marking Functions

```
FUNCTION mark_completed(tasks_md_path, task_id):
  content = read_file(tasks_md_path)
  // Replace "- [ ] {task_id}" with "- [X] {task_id}"
  // Preserve everything after the checkbox (description, annotations, sub-lines)
  updated = content.replace(
    "- [ ] {task_id} ",
    "- [X] {task_id} "
  )
  write_file(tasks_md_path, updated)

FUNCTION mark_blocked(tasks_md_path, task_id, reason):
  content = read_file(tasks_md_path)
  // Replace "- [ ] {task_id}" with "- [BLOCKED] {task_id}"
  updated = content.replace(
    "- [ ] {task_id} ",
    "- [BLOCKED] {task_id} "
  )
  // Add or update reason sub-line
  // Insert "  reason: {reason}" after the task's existing sub-lines
  // (before the next task line or section header)
  updated = insert_reason_subline(updated, task_id, reason)
  write_file(tasks_md_path, updated)
```

---

## 4. Deviation Handling

In mechanical mode, the agent has strict rules about modifying the plan:

### 4.1 Prohibited Actions

| Action | Rule | If Needed |
|--------|------|-----------|
| Add a new task | MUST NOT without [DEVIATION] flag | Emit `[DEVIATION] Added task: {reason}` and document |
| Remove a task | MUST NOT | Mark as `[BLOCKED] reason: Task unnecessary -- {explanation}` |
| Reorder tasks | MUST NOT beyond dependency order | Execute in computed topological order only |
| Skip a task | MUST NOT without reason | Mark `[BLOCKED]` with reason |

### 4.2 Permitted Actions

| Action | Rule |
|--------|------|
| Adjust implementation details within a task | OK -- variable names, internal structure, etc. |
| Add helper functions not mentioned in task | OK -- implementation detail |
| Run additional tests beyond what task specifies | OK -- more testing is always allowed |
| Read additional files for context | OK -- reading is not a deviation |

### 4.3 Deviation Documentation

When a deviation is necessary:

```
[DEVIATION] {task_id}: {description}
  Reason: {why the task specification was insufficient}
  Action taken: {what was done instead}
  Impact: {what other tasks may be affected}
```

Deviations are logged in the agent's output and appended to the task-refinement-log.md.

---

## 5. Integration with Existing Modes

### 5.1 Mode Priority Matrix

| ATDD Mode | Mechanical Mode | Behavior |
|-----------|----------------|----------|
| false | false | **Standard** (existing): Agent self-decomposes work, TDD cycle |
| true | false | **ATDD**: Agent follows ATDD test-first unskipping order |
| false | true | **Mechanical**: Agent follows tasks.md task-by-task per this design |
| true | true | **ATDD + Mechanical**: ATDD controls test ordering; Mechanical controls file targeting |

### 5.2 ATDD + Mechanical Combined

When both modes are active:
1. Task execution order follows the mechanical dependency graph
2. Within each task, the ATDD test-first pattern applies:
   - Read the associated acceptance criteria from traces
   - Write/unskip the test for that AC
   - Implement to pass the test
   - Move to next AC within the task
3. File targeting comes from the mechanical task's `files:` annotation
4. Test prioritization comes from the ATDD priority order

---

## 6. Fallback Behavior (AC-05g)

When mechanical mode is requested but cannot operate:

```
FUNCTION check_mechanical_feasibility(tasks):
  has_file_tasks = any(t.files for t in tasks if t.files)

  IF NOT has_file_tasks:
    EMIT WARNING:
      "------------------------------------------------------------
       MECHANICAL MODE FALLBACK

       Mechanical execution was requested (--mechanical flag or
       mechanical_mode: true), but Phase 06 tasks do not contain
       file-level annotations (files: sub-lines).

       This typically happens when:
       - The task refinement step did not run (no design phase)
       - The refinement step found no design artifacts
       - The workflow is a fix workflow (no design phase)

       Falling back to standard execution mode.
       The agent will self-decompose work as usual.
       ------------------------------------------------------------"
    RETURN false  // Use standard mode

  RETURN true  // Mechanical mode is feasible
```

---

## 7. Configuration in workflows.json

Add to the feature workflow's options and agent_modifiers:

### 7.1 New Option

```json
{
  "workflows": {
    "feature": {
      "options": {
        "mechanical_mode": {
          "description": "Enable mechanical execution -- Agent 05 follows tasks.md task-by-task in dependency order",
          "default": false,
          "flag": "--mechanical"
        }
      }
    }
  }
}
```

### 7.2 New Agent Modifier

```json
{
  "workflows": {
    "feature": {
      "agent_modifiers": {
        "06-implementation": {
          "_when_mechanical_mode": {
            "follow_task_plan": true,
            "respect_dependency_order": true,
            "flag_deviations": true,
            "fallback_on_missing_file_tasks": true
          }
        }
      }
    }
  }
}
```

### 7.3 State Storage

When the user passes `--mechanical`, the orchestrator stores:

```json
{
  "active_workflow": {
    "mechanical_mode": true
  }
}
```

This mirrors the existing `atdd_mode` pattern exactly.

---

## 8. Section to Add to 05-software-developer.md

The following is the exact markdown text to insert into the software-developer agent file:

```markdown
# MECHANICAL EXECUTION MODE

## Overview

Mechanical execution mode is an opt-in mode where you follow tasks.md task-by-task instead of self-decomposing work. This mode is activated by the `--mechanical` flag or `mechanical_mode: true` in workflow modifiers.

## Mode Detection

At the start of Phase 06:

1. Read `state.json -> active_workflow.mechanical_mode`
2. If `true`: read tasks.md and check for file-level tasks in Phase 06
3. If file-level tasks exist: enter mechanical mode
4. If no file-level tasks: emit fallback warning, use standard mode
5. If `mechanical_mode` is false or missing: use standard mode (default)

## Execution Protocol

When in mechanical mode:

### Step 1: Parse Phase 06 Tasks
Read `docs/isdlc/tasks.md`, extract all Phase 06 tasks with their annotations:
- `| traces:` -- which requirements this task fulfills
- `blocked_by:` -- prerequisite tasks
- `blocks:` -- downstream dependent tasks
- `files:` -- target file paths with CREATE/MODIFY action

### Step 2: Build Execution Order
Compute topological sort of tasks based on blocked_by/blocks dependencies.
Tasks with no dependencies execute first. Among equal-priority tasks, execute
in TNNNN order (lowest ID first).

### Step 3: Execute Each Task
For each task in dependency order:

1. **Check dependencies**: All `blocked_by` tasks must be `[X]`. If any are
   `[BLOCKED]` or `[ ]`, mark this task `[BLOCKED]` with reason.

2. **Read task context**: Parse the description, traces, and file annotations.

3. **Implement**: For each file in `files:`:
   - `CREATE`: Create the file, implement the specified functionality
   - `MODIFY`: Read the existing file, apply the described changes
   - Follow the `traces:` annotations to understand which acceptance criteria
     to fulfill

4. **Test (TDD)**: Write or update tests for the implemented functionality.
   Run tests. Fix failures. Repeat until passing.

5. **Mark completion**: Update tasks.md:
   - Success: Change `- [ ]` to `- [X]`
   - Failure after retries: Change `- [ ]` to `- [BLOCKED]` and add
     `reason:` sub-line explaining why

### Step 4: Report Results
After all tasks are attempted, report:
- Number completed, blocked, and remaining
- Any deviations flagged
- Updated Progress Summary in tasks.md

## Deviation Rules

In mechanical mode:
- **DO NOT** add tasks without flagging as `[DEVIATION]` with reason
- **DO NOT** remove tasks -- mark unnecessary ones as `[BLOCKED] reason: Task unnecessary`
- **DO NOT** reorder tasks beyond dependency order
- **DO** adjust implementation details (variable names, internal structure)
- **DO** write additional tests beyond what is specified

## Fallback

If tasks.md Phase 06 section lacks file-level annotations (`files:` sub-lines),
emit a warning and fall back to standard execution mode (self-decomposition).
```

---

## 9. Traces

| Requirement | How Addressed |
|-------------|---------------|
| AC-05a | `--mechanical` flag in workflows.json options; `mechanical_mode` in state.json |
| AC-05b | Topological sort execution order; task-by-task execution loop |
| AC-05c | Deviation rules: MUST NOT add/remove/reorder without [DEVIATION] flag |
| AC-05d | mark_completed() immediately updates tasks.md on success |
| AC-05e | mark_blocked() creates [BLOCKED] annotation with reason sub-line |
| AC-05f | Default is false; standard mode remains default behavior |
| AC-05g | Fallback check: if no file-level tasks, warn and use standard mode |
| ADR-0003 | Workflow option flag + agent modifier pattern (mirrors ATDD) |
