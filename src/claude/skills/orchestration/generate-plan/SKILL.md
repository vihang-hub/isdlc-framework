---
name: generate-plan
description: Generate a detailed task plan (tasks.md) from workflow definition and Phase 01 artifacts
skill_id: ORCH-012
owner: sdlc-orchestrator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: After GATE-01 passes, before branch creation, for feature/fix workflows
dependencies: [ORCH-001]
---

# Generate Plan

## Purpose

Generate a persistent task plan file (`docs/isdlc/tasks.md`) that shows the user all planned work across every phase of the active workflow. The plan provides phase-grouped, numbered tasks with progress tracking via checkboxes. Phase agents update this file as they complete work, giving the user a single view of overall progress.

## When to Use

- After GATE-01 passes for `feature` or `fix` workflows
- Before branch creation (Section 3a of the orchestrator)
- **Skip** for `test-run` and `test-generate` workflows (too few phases; TaskCreate spinners are sufficient)

## Prerequisites

- GATE-01 has passed
- `active_workflow` exists in state.json with a valid `type`
- Phase 01 artifacts exist (requirements-spec.md or bug-report.md)
- `.isdlc/templates/workflow-tasks-template.md` is accessible

## Process

### Step 1: Read Workflow Context

```
1. Read active_workflow from .isdlc/state.json
2. Extract: type, artifact_folder, phases array
3. Read Phase 01 artifacts to understand scope:
   - feature: docs/requirements/REQ-NNNN-*/requirements-spec.md
   - fix: docs/requirements/BUG-NNNN-*/bug-report.md
```

### Step 2: Load Template

```
1. Read .isdlc/templates/workflow-tasks-template.md
2. Locate the section matching active_workflow.type (## feature or ## fix)
3. Extract task descriptions for each phase listed in the workflow
```

### Step 3: Generate Task IDs and Format

```
For each phase in the workflow's phases array:
  1. Start task counter at T0001 (incrementing across all phases)
  2. For each task description in the template:
     - Format as: - [ ] TNNNN Description
     - Add [P] marker if phase is parallel-eligible (see Parallel Rules)
  3. Group under phase header with status:
     - Phase 01: ## Phase NN: Name — COMPLETE (mark all tasks [X])
     - All others: ## Phase NN: Name — PENDING
```

### Step 4: Add Parallel Markers

Apply `[P]` markers based on workflow type:

| Workflow | Parallel Phases | Condition |
|----------|-----------------|-----------|
| feature | 06-testing, 09-cicd | Both can start after Phase 10 completes |
| fix | 06-testing, 09-cicd | Both can start after Phase 10 completes |

Markers are **informational only** — the orchestrator still executes sequentially. They signal future parallelization opportunities.

Format for parallel tasks: `- [ ] TNNNN [P] Description`

### Step 5: Write tasks.md

```
1. Compose the full document with header, phase sections, and summary
2. Write to docs/isdlc/tasks.md (single-project) or
   docs/isdlc/projects/{project-id}/tasks.md (monorepo)
3. Display the full plan to the user with announcement banner
```

### Step 6: Display to User

Output the full plan with a banner:

```
════════════════════════════════════════════════════════════════
  TASK PLAN: {type} {artifact_folder}
════════════════════════════════════════════════════════════════

[Full tasks.md content]

════════════════════════════════════════════════════════════════
  Summary: {total} tasks across {phase_count} phases | {done} completed | {parallel} parallel phases
════════════════════════════════════════════════════════════════
```

## Output Format

The generated `tasks.md` follows this structure:

```markdown
# Task Plan: {type} {artifact_folder}

Generated: {ISO-8601 timestamp}
Workflow: {type}
Phases: {count}

---

## Phase 01: Requirements Capture — COMPLETE
- [X] T0001 Discover project context and business requirements
- [X] T0002 Identify users and define personas
- [X] T0003 Write user stories with acceptance criteria
...

## Phase 02: Architecture Assessment — PENDING
- [ ] T0008 Analyze requirements and identify architectural drivers
- [ ] T0009 Select architecture pattern and document ADR
...

## Phase 06: Integration Testing [P] — PENDING
- [ ] T0025 [P] Read testing environment URL from state
- [ ] T0026 [P] Run integration tests
...

---

## Progress
- Total: {N} tasks
- Completed: {N}
- Remaining: {N}
- Parallel phases: {list}
```

## Phase Name Mapping

Use these display names for phase headers:

| Phase Key | Display Name |
|-----------|-------------|
| 01-requirements | Requirements Capture |
| 02-architecture | Architecture Assessment |
| 03-design | System Design |
| 04-test-strategy | Test Strategy |
| 05-implementation | Implementation |
| 10-local-testing | Environment Build (Local) |
| 06-testing | Integration Testing |
| 07-code-review | Code Review & QA |
| 08-validation | Security Validation |
| 09-cicd | CI/CD Pipeline |
| 10-remote-build | Environment Build (Remote) |
| 11-test-deploy | Staging Deployment |
| 12-production | Production Release |
| 13-operations | Operations & Monitoring |

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| state.json | JSON | Yes | Active workflow with type, phases, artifact_folder |
| Phase 01 artifacts | Markdown | Yes | Requirements or bug report from Phase 01 |
| workflow-tasks-template.md | Markdown | Yes | Template task descriptions by workflow and phase |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| docs/isdlc/tasks.md | Markdown | Persistent task plan with checkboxes and progress |

## Monorepo Support

In monorepo mode, write the tasks file to the project-scoped path:
- **Single-project**: `docs/isdlc/tasks.md`
- **Monorepo**: `docs/isdlc/projects/{project-id}/tasks.md`

## Integration Points

- **Orchestrator (Agent 00)**: Invokes this skill after GATE-01; reads tasks.md for progress summaries at phase transitions
- **All Phase Agents (01-13)**: Read and update tasks.md via the PLAN INTEGRATION PROTOCOL
- **workflow-management (ORCH-001)**: Provides workflow definition as input

## Validation

- Every phase in the active workflow has a corresponding section in tasks.md
- All Phase 01 tasks are marked `[X]`
- All other phase tasks are marked `[ ]`
- Task IDs are sequential (T0001, T0002, ...) with no gaps
- `[P]` markers appear only on phases designated as parallel for the workflow type
- Progress summary counts match actual checkbox counts
