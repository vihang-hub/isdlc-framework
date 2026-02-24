# Architecture Overview: REQ-0009 Enhanced Plan-to-Tasks Pipeline

**Version**: 1.0.0
**Date**: 2026-02-11
**Author**: Solution Architect (Agent 02)
**Phase**: 03-architecture
**Traces**: FR-01 through FR-08, NFR-01 through NFR-04, C-01 through C-04

---

## 1. Executive Summary

This architecture extends the existing iSDLC plan-generation pipeline to transform tasks.md from a passive progress tracker into an active implementation contract. The design is strictly additive -- it enhances existing components without replacing them, maintaining full backward compatibility with the 14 agents that consume tasks.md via the PLAN INTEGRATION PROTOCOL.

### Key Architectural Decisions

| Decision | Choice | ADR |
|----------|--------|-----|
| Task metadata storage | Inline annotations in tasks.md (no separate file) | ADR-0001 |
| Refinement step placement | Orchestrator Section 3c (not a new phase) | ADR-0002 |
| Mechanical mode activation | Workflow option flag + agent modifier (mirrors ATDD) | ADR-0003 |
| Dependency format | Dual: inline sub-lines + summary section | ADR-0004 |

---

## 2. System Context (C4 Level 1)

The enhanced plan-to-tasks pipeline operates within the existing iSDLC agent orchestration system. No new external actors or systems are introduced.

### Actors

| Actor | Role | Interaction |
|-------|------|-------------|
| Human Developer | Initiates workflows, reviews plans, activates mechanical mode | Reads tasks.md; optionally passes `--mechanical` flag |
| Orchestrator (Agent 00) | Generates plan, triggers refinement, delegates phases | Writes tasks.md (initial + refined); reads design artifacts |
| Phase Agents (01-14) | Execute phase work, update task checkboxes | Read/write tasks.md (checkbox toggle + phase status) |
| Software Developer (Agent 05) | Implements code -- standard or mechanical mode | Reads tasks.md task-by-task in mechanical mode |
| Plan Surfacer Hook | Validates tasks.md existence + optional format | Reads tasks.md; blocks or warns |

### Data Flow

```
Human Developer
  |
  |-- /isdlc feature "..." [--mechanical]
  v
Orchestrator (Agent 00)
  |
  |-- GATE-01 passes --> Section 3b: Generate Plan (ORCH-012)
  |     |
  |     +--> Reads: requirements-spec.md, workflow-tasks-template.md, state.json
  |     +--> Writes: docs/isdlc/tasks.md (v2.0 with traceability)
  |
  |-- GATE-04 passes --> Section 3c: Task Refinement [NEW]
  |     |
  |     +--> Reads: design artifacts (interface-spec, module-designs)
  |     +--> Reads: tasks.md (current high-level tasks)
  |     +--> Reads: requirements-spec.md (for traceability cross-ref)
  |     +--> Writes: tasks.md (updated with file-level Phase 06 tasks)
  |     +--> Writes: task-refinement-log.md
  |
  |-- Delegates Phase 06 --> Software Developer (Agent 05)
        |
        +--> Standard mode: self-decomposes work (existing behavior)
        +--> Mechanical mode: follows tasks.md task-by-task [NEW]
```

---

## 3. Component Architecture (C4 Level 2)

### 3.1 Component Map

```
+------------------------------------------------------------------+
|  iSDLC Framework                                                   |
|                                                                    |
|  +--------------------+   +---------------------------+            |
|  | ORCH-012           |   | Orchestrator (Agent 00)   |            |
|  | generate-plan      |   |                           |            |
|  | SKILL.md           |   | Section 3b: Plan Gen      |            |
|  |                    |   | Section 3c: Refinement [N] |            |
|  | - Read reqs        |<--| Section 3d: Phase Delegate |            |
|  | - Read template    |   +---------------------------+            |
|  | - Generate tasks   |                                            |
|  | - Add traceability |   +---------------------------+            |
|  | - Add dependencies |   | isdlc.md Phase-Loop       |            |
|  | - Detect cycles    |   | Controller                |            |
|  | - Compute crit path|   |                           |            |
|  +--------------------+   | 3e: Post-phase update     |            |
|                           | --> 3c-trigger check [N]  |            |
|  +--------------------+   | 3d: Phase delegation      |            |
|  | workflow-tasks-     |   +---------------------------+            |
|  | template.md        |                                            |
|  | (format templates) |   +---------------------------+            |
|  +--------------------+   | Software Developer (05)   |            |
|                           |                           |            |
|  +--------------------+   | - Standard mode (existing) |           |
|  | plan-surfacer.cjs  |   | - Mechanical mode [NEW]   |            |
|  | Hook               |   |   - Read tasks by order   |            |
|  |                    |   |   - Execute task-by-task   |            |
|  | - Existence check  |   |   - Mark [X] / [BLOCKED]  |            |
|  | - Format valid [N] |   |   - Detect deviations     |            |
|  +--------------------+   +---------------------------+            |
|                                                                    |
|  +------------------------------------------------+               |
|  | PLAN INTEGRATION PROTOCOL (14 agents)           |               |
|  | - Read phase section                            |               |
|  | - Update status header                          |               |
|  | - Toggle [X]/[ ] checkboxes                     |               |
|  | - Preserve annotations [NEW rule]               |               |
|  +------------------------------------------------+               |
|                                                                    |
|  +--------------------+                                            |
|  | tasks.md (v2.0)    |   Single file authority (C-02)             |
|  | - Phase sections   |                                            |
|  | - Task checkboxes  |                                            |
|  | - Traceability     |   [N] = NEW component/behavior             |
|  | - Dependencies     |                                            |
|  | - File annotations |                                            |
|  | - Dep Graph section|                                            |
|  | - Trace Matrix     |                                            |
|  +--------------------+                                            |
+------------------------------------------------------------------+
```

### 3.2 Component Responsibilities

| Component | Current Responsibility | New Responsibility | Change Size |
|-----------|----------------------|-------------------|-------------|
| ORCH-012 SKILL.md | Generate tasks.md with TNNNN checkboxes and [P] markers | + Read requirements for traceability tags, generate pipe-delimited annotations, generate dependency sub-lines, add Dependency Graph and Traceability Matrix sections, validate acyclicity | LARGE |
| Orchestrator (Agent 00) | Section 3b: invoke ORCH-012 after GATE-01 | + Section 3c: invoke refinement after GATE-04 to convert high-level tasks to file-level tasks | MEDIUM |
| isdlc.md Phase-Loop | Steps 3a-3f: delegate phases sequentially | + Insert refinement trigger check between 3e (post-phase update) and 3d (next delegation) when design phase just completed | SMALL |
| Software Developer (05) | TDD workflow: self-decompose, test, implement, iterate | + Mechanical mode: read tasks.md, execute in dependency order, mark completion, flag deviations | LARGE |
| plan-surfacer.cjs | Block Task tool when tasks.md missing for impl+ phases | + Optional format validation: warn if Phase 06 lacks file-level tasks | MEDIUM |
| PLAN INTEGRATION PROTOCOL | Read section, toggle checkboxes, update status | + Preserve annotations: do not remove sub-lines or pipe annotations when updating | SMALL |
| workflow-tasks-template.md | Plain text task descriptions by phase | + File-level placeholder syntax for implementation phase | MEDIUM |
| workflows.json | Feature/fix workflow definitions with agent_modifiers | + `mechanical_mode` option for feature workflow | SMALL |

---

## 4. Data Flow Architecture

### 4.1 Plan Generation Flow (Post-GATE-01)

```
requirements-spec.md ----+
                         |
workflow-tasks-template --+--> ORCH-012 generate-plan --> tasks.md (v2.0)
                         |
state.json (workflow) ---+
```

**Inputs read by ORCH-012:**
1. `state.json -> active_workflow` (type, phases, artifact_folder)
2. `requirements-spec.md` (REQ-NNN and AC-NNx identifiers for traceability) [NEW]
3. `workflow-tasks-template.md` (task descriptions by phase)

**Output produced:**
- `tasks.md` with v2.0 format: checkboxes + traceability annotations on task lines
- High-level tasks for ALL phases (no file-level detail yet)
- Traceability Matrix section (requirements -> tasks)
- No Dependency Graph section yet (dependencies come from refinement)

### 4.2 Task Refinement Flow (Post-GATE-04)

```
design artifacts --------+
  - interface-spec.md    |
  - module-designs/      |
  - design-spec.md       |
                         +--> Orchestrator Section 3c --> tasks.md (updated)
requirements-spec.md ----+                               task-refinement-log.md
                         |
tasks.md (current) ------+
```

**Refinement Actions:**
1. Read design artifacts to identify: target files, functions, modules
2. Read existing tasks.md Phase 06 section (high-level tasks from ORCH-012)
3. Replace high-level Phase 06 tasks with file-level tasks
4. Add `files:` sub-lines based on module-design file mappings
5. Add `blocked_by:` / `blocks:` sub-lines based on module dependencies
6. Re-compute Traceability Matrix (file-level tasks may cover different ACs)
7. Generate Dependency Graph section with critical path
8. Preserve all Phase 01-05 and 07+ tasks unchanged (AC-04d)
9. Write updated tasks.md and task-refinement-log.md

### 4.3 Mechanical Execution Flow (Phase 06)

```
tasks.md (refined) -----> Agent 05 (Mechanical Mode)
                              |
                              +--> For each task in dependency order:
                              |      1. Read task (file annotations, traces)
                              |      2. Execute: create/modify specified files
                              |      3. Run tests
                              |      4. Mark [X] in tasks.md
                              |      5. If blocked: mark [BLOCKED] with reason
                              |
                              +--> If NO file-level tasks: fallback to standard mode
```

### 4.4 Hook Validation Flow

```
tasks.md -----> plan-surfacer.cjs
                    |
                    +--> Existence check (existing, unchanged)
                    |      Block if missing for impl+ phases
                    |
                    +--> Format validation [NEW, optional]
                           Warn if Phase 06 lacks file-level tasks
                           Warn if traceability annotations missing
                           NEVER block on format issues (AC-08c)
```

---

## 5. Refinement Pipeline Architecture

### 5.1 Trigger Mechanism

The refinement step is triggered by the phase-loop controller when:

1. A design phase just completed (phase key matches `04-design`)
2. The active workflow has a subsequent implementation phase (`06-implementation` in phases array)
3. Refinement has not already run for this workflow (guard against re-runs)

The trigger is a conditional check inserted into the phase-loop's post-phase update logic:

```
// In isdlc.md STEP 3e (after marking phase complete):
if (just_completed_phase === '04-design' && workflow_has_phase('06-implementation')) {
    // Invoke refinement (Section 3c)
}
```

### 5.2 Refinement Step Inputs

| Input | Source | Purpose |
|-------|--------|---------|
| `tasks.md` | `docs/isdlc/tasks.md` | Current plan with high-level Phase 06 tasks |
| `requirements-spec.md` | `docs/requirements/{folder}/requirements-spec.md` | REQ and AC identifiers for traceability |
| `interface-spec.md` | `docs/requirements/{folder}/interface-spec.md` | API contracts -> file targets |
| `module-designs/` | `docs/requirements/{folder}/module-designs/` | Module -> file mappings |
| `design-specification.md` | `docs/requirements/{folder}/design-specification.md` | Overall design -> component breakdown |

### 5.3 Refinement Step Outputs

| Output | Path | Content |
|--------|------|---------|
| Updated `tasks.md` | `docs/isdlc/tasks.md` | Phase 06 tasks replaced with file-level tasks; Dependency Graph section added |
| `task-refinement-log.md` | `docs/requirements/{folder}/task-refinement-log.md` | Log of what was decomposed: original tasks -> refined tasks mapping |

### 5.4 Refinement Algorithm

```
1. Parse tasks.md: extract Phase 06 section tasks (preserve Phase 01-05, 07+ verbatim)
2. Read design artifacts: build a map of { module -> files -> functions/exports }
3. Read requirements-spec.md: build a map of { REQ-NNN -> [AC-NNx, ...] }
4. For each Phase 06 high-level task:
   a. Identify which design modules it maps to
   b. Identify which files need CREATE or MODIFY
   c. Identify which REQ/AC the files fulfill
   d. Generate one task per logical unit of work (one file or tightly coupled file group)
   e. Assign new TNNNN IDs (continuing from last ID in tasks.md)
   f. Add traces: annotation linking to REQ/AC
   g. Add files: annotation with file paths and CREATE/MODIFY
5. Compute dependencies:
   a. If file B imports from file A, the task for B is blocked_by the task for A
   b. If module X depends on module Y, tasks for X are blocked_by tasks for Y
   c. Add blocked_by: and blocks: sub-lines
6. Validate acyclicity: trace all dependency chains, confirm no task depends on itself transitively
7. Compute critical path: find longest dependency chain
8. Generate Dependency Graph section
9. Re-compute Traceability Matrix with refined tasks
10. Assemble updated tasks.md (preserve header, Phase 01-05 sections, replace Phase 06, add new sections)
11. Write task-refinement-log.md documenting the decomposition
```

### 5.5 Workflows Without Design Phase

| Workflow | Has Design? | Has Implementation? | Refinement? |
|----------|------------|---------------------|-------------|
| feature | YES (04-design) | YES (06-implementation) | YES |
| fix | NO | YES (06-implementation) | NO -- tasks remain high-level |
| test-run | NO | NO | NO |
| test-generate | NO | NO | NO |

For fix workflows, the software-developer agent operates in standard mode (self-decomposition) since there are no file-level tasks. Mechanical mode with `--mechanical` flag on a fix workflow will trigger the fallback behavior (AC-05g: warning, then standard mode).

---

## 6. Mechanical Execution Mode Architecture

### 6.1 Mode Detection

At the start of Phase 06, Agent 05 checks:

```
1. Read state.json -> active_workflow.mechanical_mode
2. If true:
   a. Read tasks.md -> locate Phase 06 section
   b. Check if ANY Phase 06 task has a 'files:' sub-line
   c. If YES: enter mechanical mode
   d. If NO: emit warning, enter standard mode (fallback per AC-05g)
3. If false or missing: enter standard mode (default)
```

### 6.2 Execution Loop (Mechanical Mode)

```
1. Parse all Phase 06 tasks from tasks.md
2. Build dependency graph from blocked_by/blocks annotations
3. Compute execution order (topological sort)
4. For each task in order:
   a. Check all blocked_by tasks are [X] -- if not, skip (will retry)
   b. Read task details: files, traces, description
   c. Execute the task:
      - If files: contains CREATE -> create the file with specified functions/exports
      - If files: contains MODIFY -> modify the specified file
      - Follow the traces: to understand the acceptance criteria being fulfilled
   d. Run tests (TDD: write test first if not already written, then implement)
   e. If task succeeds: mark [X] in tasks.md, continue to next task
   f. If task fails after iterations: mark [BLOCKED] with reason, continue to next unblocked task
5. After all tasks attempted:
   - If any [BLOCKED]: report blocked tasks with reasons
   - Compute final progress: X complete, Y blocked, Z remaining
```

### 6.3 Deviation Handling

In mechanical mode, Agent 05:
- MUST NOT add new tasks without flagging: if work is needed that is not in tasks.md, emit `[DEVIATION]` marker and document the reason
- MUST NOT remove tasks: if a task is unnecessary, mark as `[BLOCKED] reason: Task unnecessary -- {explanation}`
- MUST NOT reorder tasks beyond dependency order: execute in the computed topological order
- CAN adjust implementation details within a task (e.g., specific variable names, internal structure) without flagging

### 6.4 Integration with Existing Modes

| Mode | Priority | Condition |
|------|----------|-----------|
| ATDD + Mechanical | ATDD takes priority for test ordering; Mechanical controls file targeting | Both flags set |
| ATDD only | ATDD workflow (existing) | `atdd_mode: true`, `mechanical_mode: false` |
| Mechanical only | Mechanical execution with standard TDD | `mechanical_mode: true`, `atdd_mode: false` |
| Standard | Current behavior | Both false (default) |

When both ATDD and mechanical modes are active, the agent follows the ATDD priority-based test unskipping order but targets the specific files listed in the mechanical task annotations.

---

## 7. PLAN INTEGRATION PROTOCOL v2

### 7.1 Current Protocol (Preserved)

```markdown
# PLAN INTEGRATION PROTOCOL

If `docs/isdlc/tasks.md` exists:

## On Phase Start
1. Read tasks.md, locate your phase section (`## Phase NN:`)
2. Update phase status header from `PENDING` to `IN PROGRESS`
3. Refine template tasks with specifics from input artifacts
4. Preserve TNNNN IDs when refining. Append new tasks at section end if needed.

## During Execution
1. Change `- [ ]` to `- [X]` as each task completes
2. Update after each major step, not just at phase end

## On Phase End
1. Verify all phase tasks are `[X]` or documented as skipped
2. Update phase status header to `COMPLETE`
3. Update Progress section at bottom of tasks.md

## If tasks.md Does Not Exist
Skip this protocol entirely. TaskCreate spinners are sufficient.
```

### 7.2 New Rules (Additive)

Add these rules to the protocol:

```markdown
## Annotation Preservation
When updating tasks.md (toggling checkboxes, updating status headers):
1. MUST NOT remove or modify pipe-delimited annotations (`| traces: ...`) on task lines
2. MUST NOT remove or modify indented sub-lines (lines starting with 2+ spaces below a task)
3. MUST NOT remove or modify the Dependency Graph, Traceability Matrix, or Progress Summary sections
4. When refining template tasks with specifics, preserve existing annotations and extend them
```

These rules are additive. Agents that already only touch checkboxes and status headers are already compliant -- the rules simply make the expectation explicit.

### 7.3 Agent 05 Protocol Extension

The software-developer agent's protocol section gets an additional block:

```markdown
## Mechanical Execution Mode (Agent 05 only)
If `active_workflow.mechanical_mode: true` AND Phase 06 tasks have `files:` sub-lines:
1. Read all Phase 06 tasks and parse their file annotations
2. Build dependency graph from blocked_by/blocks sub-lines
3. Execute tasks in topological (dependency) order
4. For each task: implement the specified files, run tests, mark [X] or [BLOCKED]
5. Do NOT add, remove, or reorder tasks without flagging as [DEVIATION]
6. If tasks lack file-level detail, fall back to standard mode with a warning
```

---

## 8. Hook Enhancement Architecture

### 8.1 plan-surfacer.cjs Changes

The hook gains an optional format validation step that runs AFTER the existing existence check passes:

```
check(ctx):
  1. [EXISTING] If not Task tool -> allow
  2. [EXISTING] If no active workflow -> allow
  3. [EXISTING] If early phase -> allow
  4. [EXISTING] If tasks.md missing -> BLOCK
  5. [NEW] If tasks.md exists AND current_phase is '06-implementation':
     a. Read tasks.md
     b. Find Phase 06 section
     c. Check if any task has 'files:' sub-line
     d. If NO file-level tasks:
        - Emit WARNING to stderr (not a block)
        - Log event as 'format-validation-warning'
     e. Allow regardless (AC-08c: warnings only)
  6. [EXISTING] Allow
```

### 8.2 Performance Budget

The format validation step adds file reading (tasks.md is already on disk, typically <50KB) and a simple string search for `files:` pattern. Estimated overhead: <10ms, well within the 100ms budget (NFR-01a).

### 8.3 Optional Cycle Detection in Hook

If the hook detects a `## Dependency Graph` section, it can optionally parse the dependency table and run a simple cycle check. This is a stretch goal -- the primary cycle detection happens at generation time in the ORCH-012 skill. The hook validation is a safety net.

---

## 9. Phase Key Standardization

The impact analysis identified a phase key inconsistency: ORCH-012 and the template use `05-implementation` while workflows.json and state.json use `06-implementation`.

### Resolution

The canonical phase key is `06-implementation` (matching workflows.json, state.json, and the PHASE->AGENT table in isdlc.md). The template and ORCH-012 must be updated to use `06-implementation` in their Phase Name Mapping tables.

This is a prerequisite fix that must happen before or alongside the enhanced format implementation. It is NOT a new requirement but a pre-existing inconsistency that this feature exposes.

---

## 10. File Change Summary

### Primary Changes (6 files)

| File | Change | Size | Traces |
|------|--------|------|--------|
| `src/claude/skills/orchestration/generate-plan/SKILL.md` | Add traceability reading, annotation generation, dependency logic, new sections, cycle validation | LARGE | FR-01, FR-02, FR-03, FR-06 |
| `src/claude/agents/00-sdlc-orchestrator.md` | Add Section 3c (refinement step) | MEDIUM | FR-04 |
| `src/claude/commands/isdlc.md` | Add refinement trigger check after 3e | SMALL | FR-04 |
| `src/claude/agents/05-software-developer.md` | Add MECHANICAL EXECUTION MODE section | LARGE | FR-05 |
| `src/claude/hooks/plan-surfacer.cjs` | Add optional format validation (warning only) | MEDIUM | FR-08 |
| `src/isdlc/templates/workflow-tasks-template.md` | Add file-level placeholder syntax for Phase 06 | MEDIUM | FR-01, FR-06 |

### Protocol Changes (14 files)

All 14 agent files with PLAN INTEGRATION PROTOCOL receive the same additive rule (Annotation Preservation). This is a single text insertion replicated 14 times.

### Config Changes (2 files)

| File | Change | Size | Traces |
|------|--------|------|--------|
| `src/isdlc/config/workflows.json` | Add `mechanical_mode` workflow option + agent modifier | SMALL | FR-05 |
| `src/claude/hooks/tests/plan-surfacer.test.cjs` | Add format validation test cases | MEDIUM | FR-08 |

### Alignment Changes (1 file)

| File | Change | Size | Traces |
|------|--------|------|--------|
| `src/claude/skills/orchestration/task-decomposition/SKILL.md` | Align format with ORCH-012 annotations | SMALL | FR-02, FR-03 |

**Total: 23 files** (6 primary + 14 protocol + 2 config + 1 alignment)

---

## 11. Risk Mitigation

| Risk | Probability | Impact | Mitigation | Traces |
|------|------------|--------|------------|--------|
| Enhanced format breaks existing agents | LOW | HIGH | Backward-compatible design (additive only), regression tests with old-format fixture | NFR-02, AC-06g |
| Phase key confusion (05 vs 06) | HIGH | MEDIUM | Standardize on `06-implementation` before any format changes | Impact analysis tech debt |
| Refinement produces wrong file mappings | MEDIUM | MEDIUM | Refinement log for human review, GATE-05 validation | FR-04, AC-04g |
| Cycle in generated dependency graph | LOW | MEDIUM | Agent-level validation + optional hook cycle check | FR-03, AC-03c |
| Mechanical mode too rigid | MEDIUM | LOW | Opt-in flag, fallback to standard mode | FR-05, AC-05f, AC-05g |
| tasks.md grows too large | LOW | LOW | Only Phase 06 gets file-level tasks; other phases remain high-level | C-02, NFR-01 |

---

## 12. Constitutional Compliance

| Article | How Addressed |
|---------|---------------|
| I (Specification Primacy) | tasks.md becomes the implementation specification; mechanical mode enforces literal execution |
| III (Security by Design) | No new security surfaces; hook fail-open behavior preserved (Article X) |
| IV (Explicit Over Implicit) | All annotations are explicit; mechanical mode flag is explicit opt-in; no assumed behavior |
| V (Simplicity First) | Pipe-delimited format is the simplest extensible annotation syntax; no new file formats, no JSON metadata |
| VII (Artifact Traceability) | Every task traces to REQ-NNN/AC-NNx; Traceability Matrix section provides coverage view |
| IX (Quality Gate Integrity) | Refinement integrates with existing GATE-04 -> GATE-05 pipeline; no gates skipped |
| X (Fail-Safe Defaults) | Hook format validation is warning-only (never blocks); mechanical mode defaults OFF; missing annotations trigger fallback |
| XIII (Module System) | Hook changes remain CJS; no new files in lib/ (ESM) needed |
| XIV (State Management) | Single tasks.md file (no shadow state); format version in header |

---

## 13. Handoff to System Designer

The System Designer (Phase 04) should focus on:

1. **ORCH-012 SKILL.md detailed specification**: Step-by-step instructions for the enhanced generation process, including the exact output templates
2. **Refinement step interface contract**: Exact inputs, outputs, and the orchestrator section 3c text
3. **Mechanical mode execution algorithm**: Detailed pseudocode for task parsing, dependency ordering, and execution loop
4. **PLAN INTEGRATION PROTOCOL v2 exact text**: The annotation preservation rules as they will appear in all 14 agent files
5. **plan-surfacer.cjs format validation logic**: The exact validation function signature and behavior
6. **Error taxonomy**: All error/warning conditions across the five sub-features
