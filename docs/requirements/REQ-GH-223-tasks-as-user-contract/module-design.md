# Module Design: Tasks as User Contract

**Item**: REQ-GH-223
**Status**: Accepted

---

## 1. Module Overview

| Module | Responsibility | Status |
|--------|---------------|--------|
| `src/core/tasks/task-validator.js` | Validate task coverage against FRs, ACs, blast radius | NEW |
| `src/core/tasks/task-reader.js` | Parse tasks.md with TNNN/TNNNABC IDs and parent derivation | MODIFY |
| `src/core/tasks/task-dispatcher.js` | addSubTask(), parent auto-completion on markTaskComplete() | MODIFY |
| `src/claude/hooks/config/templates/traceability.template.json` | Human-readable traceability column definition | NEW |
| `.isdlc/config/config.json` | User-facing config with show_subtasks_in_ui | NEW |
| `src/claude/commands/isdlc.md` | Remove 3e-plan, update BUILD-INIT COPY, update STEP 2 hydration | MODIFY |
| `src/claude/agents/04-test-design-engineer.md` | Sub-Task Creation Protocol | MODIFY |
| `src/claude/agents/05-software-developer.md` | Sub-Task Creation Protocol | MODIFY |
| `src/claude/agents/16-quality-loop-engineer.md` | Sub-Task Creation Protocol | MODIFY |
| `src/claude/agents/roundtable-analyst.md` | Call task-validator before PRESENTING_TASKS, use traceability template | MODIFY |
| `CLAUDE.md` | Add Sub-Task Creation Protocol | MODIFY |
| `src/claude/hooks/config/templates/tasks.template.json` | Update ID format TNNN, add sub-task syntax | MODIFY |
| `src/claude/hooks/traceability-enforcer.cjs` | Build-phase traceability enforcement hook | NEW |
| `src/claude/hooks/dispatchers/pre-task-dispatcher.cjs` | Register traceability-enforcer in hook chain | MODIFY |

## 2. Module Designs

### task-validator.js (NEW)

**Responsibility**: Validate that every FR, AC, and blast radius file has a covering task.

**Public Interface**:
```
export function validateTaskCoverage(plan, requirementsContent, impactAnalysisContent)
  → {
      valid: boolean,
      covered: CoverageEntry[],
      uncovered: UncoveredEntry[],
      orphanTasks: string[],
      summary: string
    }
```

**Types**:
```
CoverageEntry: {
  frId: string,           // "FR-001"
  frDescription: string,  // "Task Quality Gate"
  acIds: string[],        // ["AC-001-01", "AC-001-02"]
  taskIds: string[],      // ["T003"]
  files: string[],        // ["src/core/tasks/task-validator.js"]
  coverage: string        // "2/2 (100%)"
}

UncoveredEntry: {
  id: string,             // "FR-003" or "AC-003-02" or "src/foo.js"
  description: string,    // human-readable description
  type: 'fr' | 'ac' | 'blast_radius_file'
}
```

**Algorithm**:
1. Parse requirements content: extract all `### FR-NNN:` headings with descriptions, all `- AC-NNN-NN:` lines
2. Parse impact analysis content: extract Tier 1 file paths from blast radius table
3. For each FR: check plan tasks for matching `traces` containing `FR-NNN`
4. For each AC: check plan tasks for matching `traces` containing `AC-NNN-NN`
5. For each blast radius file: check plan tasks for matching `files[].path`
6. Orphan tasks: tasks with empty `traces` array
7. Build summary string

**Dependencies**: `node:fs` (readFileSync)

### task-reader.js (MODIFY)

**Changes**:
- ID regex: `T\d{4}` → `T\d{3}[A-Z]?`
- `parsePhaseSection()`: derive `parentId` — `T005B` → `T005`, `T005` → null
- Parsed task object gains: `parentId: string | null`, `children: string[]`
- Post-parse pass: for each task with parentId, push its ID to parent's children array
- `formatTaskContext()`: include `parent` and `children` fields in output
- `assignTiers()`: sub-tasks inherit minimum tier of `parentTier + 1`
- Header validation: accept `Format: v3.0`
- EBNF update: `task_id ::= "T" DIGIT{3} [ALPHA]`

### task-dispatcher.js (MODIFY)

**New function**:
```
export function addSubTask(tasksPath, parentId, description, metadata)
  → { taskId: string, written: boolean }

metadata: {
  files: { path: string, operation: string }[],
  traces: string[],
  blockedBy: string[],
  blocks: string[]
}
```

**Algorithm**:
1. Read tasks.md, find parent's phase section
2. Scan for existing `T{parentNum}[A-Z]` entries, determine next letter
3. If next letter > 'Z': return error (TASK-SUB-002)
4. Format task line with sub-lines (files, blocked_by, blocks, traces)
5. Insert after parent's last sub-line or last sibling
6. Recalculate progress summary
7. Write file

**Modified function** — `markTaskComplete()`:
- After marking a task `[X]`, if it has a parentId:
  1. Read all siblings (tasks with same parentId)
  2. If all siblings are `[X]`: auto-mark parent `[X]`
  3. Recalculate progress summary

### traceability.template.json (NEW)

```json
{
  "domain": "traceability",
  "version": "1.0.0",
  "format": {
    "columns": [
      { "key": "requirement", "header": "Requirement", "includes_description": true },
      { "key": "acceptance_criteria", "header": "ACs", "includes_description": true },
      { "key": "tasks", "header": "Tasks", "includes_description": true },
      { "key": "files", "header": "Files" },
      { "key": "coverage", "header": "Coverage" }
    ],
    "scoping_rules": {
      "requirements": "Show FR → AC → Task mapping",
      "architecture": "Show Decision → FR mapping",
      "design": "Show Module → FR → File mapping",
      "tasks": "Show Task → FR → AC → File mapping"
    }
  }
}
```

### traceability-enforcer.cjs (NEW)

**Responsibility**: Build-phase hook that blocks phase completion if any FR, AC, or blast radius file lacks a covering task.

**Integration**: Added to `pre-task-dispatcher.cjs` hook chain after `blast-radius-validator`.

**Interface**:
```
function check(ctx) → { decision: 'allow' | 'block', stopReason?: string }
```

**Algorithm**:
1. Only activate for build workflows during implementation+ phases
2. Read tasks.md via task-reader bridge
3. Read requirements-spec.md and impact-analysis.md from artifact folder
4. Call validateTaskCoverage() via core bridge
5. If uncovered items: block with list of uncovered FRs/ACs/files
6. If all covered: allow

### config.json (NEW)

**Location**: `.isdlc/config/config.json`

```json
{
  "task_display": {
    "show_subtasks_in_ui": true
  }
}
```

Read by Phase-Loop Controller before TaskCreate calls. Missing file defaults to `show_subtasks_in_ui: true`.

### Sub-Task Creation Protocol (CLAUDE.md)

New shared protocol section referenced by agents 04, 05, 16:

1. Read parent task from TASK_CONTEXT
2. For each concrete work item: call `addSubTask()`
3. Read `show_subtasks_in_ui` from config.json (default: true)
4. If true: create Claude TaskCreate entry
5. If true AND `subtask_hint_shown` is false: display hint, set flag
6. Execute sub-task work
7. Mark sub-task `[X]` — parent auto-completes when all children done
8. Phase agents MUST NOT alter parent task scope (Article I.5)

## 3. Data Flow

```
Analysis roundtable
  → generates tasks.md (TNNN parent tasks)
  → task-validator.validateTaskCoverage() checks coverage
  → if gaps: re-generate with gaps flagged, re-validate
  → PRESENTING_TASKS with traceability template
  → user Accept → write tasks.md to artifact folder

Build start
  → BUILD-INIT COPY: artifact folder → docs/isdlc/tasks.md
  → STEP 2: readTaskPlan() → TaskCreate per parent task
  → Phase loop begins

Phase 05 (test-design-engineer)
  → reads TASK_CONTEXT with parent tasks
  → addSubTask() for each test case → T001A, T001B...
  → TaskCreate entries if show_subtasks_in_ui

Phase 06 (software-developer)
  → reads TASK_CONTEXT with parents + sub-tasks from Phase 05
  → addSubTask() for each implementation unit
  → executes in tier order, marks [X]
  → parents auto-complete when all children done

Phase 16 / Phase 08
  → same sub-task creation pattern
```

## 4. Error Taxonomy

| Code | Trigger | Severity | Recovery |
|------|---------|----------|----------|
| TASK-VAL-001 | FR has no covering task | error | Re-run task generation with gap list |
| TASK-VAL-002 | Blast radius file has no covering task | error | Re-run task generation with gap list |
| TASK-VAL-003 | Task has no traces (orphan) | warning | Flag in traceability matrix |
| TASK-SUB-001 | Parent task not found for addSubTask | error | Log and skip sub-task creation |
| TASK-SUB-002 | 26 sub-tasks exceeded for one parent | error | Escalate to user |
| TASK-FMT-001 | tasks.md format version mismatch | warning | Attempt parse with fallback |
