# Module Design: Task Refinement Step (Orchestrator Section 3c-refine)

**Version**: 1.0.0
**Date**: 2026-02-11
**Author**: System Designer (Agent 03)
**Phase**: 04-design
**Traces**: FR-04, AC-04a through AC-04g, ADR-0002, C-01

---

## 1. Module Overview

The task refinement step is a new orchestrator action that converts high-level Phase 06 (Implementation) tasks into file-level tasks after design artifacts are available. It runs as an inline step in the phase-loop controller (isdlc.md), NOT as a new workflow phase.

### Placement in Phase Loop

The refinement step inserts between steps 3e (POST-PHASE STATE UPDATE) and 3f (result check) when the just-completed phase is a design phase:

```
Phase Loop Iteration for 04-design:
  3a. Mark phase task in_progress
  3b. Check for escalations
  3c. [existing] Handle escalations if present
  3d. Delegate to system-designer agent
  3e. POST-PHASE STATE UPDATE (mark 04-design complete, advance index)
  3e-refine. [NEW] TASK REFINEMENT — if conditions met     <-- NEW
  3f. Check result, mark task completed, continue
```

### Trigger Conditions

The refinement step runs when ALL of these are true:

1. The phase that just completed has key matching `04-design`
2. The active workflow's phases array contains `06-implementation`
3. `state.json -> active_workflow.refinement_completed` is NOT `true` (guard against re-runs)

If any condition is false, skip refinement silently.

---

## 2. Interface Contract

### 2.1 Exact Text for isdlc.md (Between 3e and 3f)

The following text is inserted into `src/claude/commands/isdlc.md` after step 3e:

```markdown
**3e-refine.** TASK REFINEMENT (conditional) -- After the post-phase state update, check if task refinement should run:

**Trigger check**:
1. Read the phase key that was just completed from the state update in 3e
2. If `phase_key === '04-design'`:
   a. Check if `active_workflow.phases` includes `'06-implementation'`
   b. Check if `active_workflow.refinement_completed` is NOT `true`
   c. If BOTH true: execute refinement (below)
   d. If either false: skip to 3f

**Refinement execution**:
1. Read `active_workflow.artifact_folder` from state.json
2. Set `artifact_path` = `docs/requirements/{artifact_folder}`
3. Read design artifacts:
   - `{artifact_path}/module-design-*.md` (all module design files)
   - `{artifact_path}/interface-spec.yaml` or `{artifact_path}/interface-spec.md` (if exists)
   - `{artifact_path}/component-spec.md` (if exists)
4. Read `{artifact_path}/requirements-spec.md` for REQ/AC cross-reference
5. Read `docs/isdlc/tasks.md` (current plan)
6. Execute the refinement algorithm (see Section 3 below)
7. Write updated `docs/isdlc/tasks.md`
8. Write `{artifact_path}/task-refinement-log.md`
9. Set `active_workflow.refinement_completed = true` in state.json
10. Display refinement summary to user:

```
+----------------------------------------------------------+
|  TASK REFINEMENT COMPLETE                                 |
|                                                           |
|  Phase 06 tasks refined: {N} high-level -> {M} file-level|
|  Dependencies added: {D} edges                           |
|  Critical path length: {L} tasks                         |
|  Traceability: {T}% AC coverage                          |
|  Details: {artifact_path}/task-refinement-log.md          |
+----------------------------------------------------------+
```
```

### 2.2 Inputs

| Input | Path | Required | Purpose |
|-------|------|----------|---------|
| tasks.md | `docs/isdlc/tasks.md` | YES | Current plan with high-level Phase 06 tasks |
| requirements-spec.md | `docs/requirements/{folder}/requirements-spec.md` | YES | REQ/AC identifiers for traceability cross-ref |
| module-design-*.md | `docs/requirements/{folder}/module-design-*.md` | YES | Module -> file mappings, component responsibilities |
| interface-spec.yaml/md | `docs/requirements/{folder}/interface-spec.*` | NO | API contracts -> file targets (if API project) |
| component-spec.md | `docs/requirements/{folder}/component-spec.md` | NO | Component specifications |
| state.json | `.isdlc/state.json` | YES | Workflow state, artifact folder |

### 2.3 Outputs

| Output | Path | Purpose |
|--------|------|---------|
| tasks.md (updated) | `docs/isdlc/tasks.md` | Phase 06 replaced with file-level tasks; Dependency Graph added |
| task-refinement-log.md | `docs/requirements/{folder}/task-refinement-log.md` | Decomposition log: original -> refined mapping |

---

## 3. Refinement Algorithm

### 3.1 Parse Current tasks.md

```
1. Read the full tasks.md file
2. Split into sections by "## Phase" headers
3. Identify the Phase 06 section (look for "## Phase 06:" or
   "## Phase NN: Implementation")
4. Extract all Phase 06 task lines (lines matching "^- \[[ X]\] T\d{4}")
5. Record the last TNNNN ID used across ALL phases (for continuing numbering)
6. Preserve ALL non-Phase-06 sections verbatim (Phase 01, 02, 03, 04, 05, 07+)
7. Preserve the header block verbatim
```

### 3.2 Read Design Artifacts

```
1. Read all module-design-*.md files from the artifact folder
2. For each module design, extract:
   a. Module name and responsibility
   b. Target files with paths (look for file tables, code blocks with paths)
   c. Whether each file is CREATE (new) or MODIFY (existing)
   d. Dependencies on other modules (imports, uses)
   e. Which REQ/AC the module traces to (from its Traces section)
3. Build a Module Map:
   {
     "module-name": {
       "files": [
         { "path": "src/claude/hooks/plan-surfacer.cjs", "action": "MODIFY" },
         { "path": "src/claude/agents/05-software-developer.md", "action": "MODIFY" }
       ],
       "depends_on": ["module-other"],
       "traces": ["FR-08", "AC-08a", "AC-08b", "AC-08c"]
     }
   }
4. If interface-spec exists, extract additional file targets for API routes
5. If component-spec exists, extract component -> file mappings
```

### 3.3 Generate File-Level Tasks

```
For each module in the Module Map:
  1. Group files into logical task units:
     - One task per tightly-coupled file group (e.g., hook + its test)
     - One task per independent file (e.g., a single agent file modification)
     - Multi-file tasks allowed for batch changes (e.g., 14 agent protocol updates)
  2. For each task unit:
     a. Assign next TNNNN ID (continuing from last_id + 1)
     b. Write description: "{action verb} {component} in {file(s)}"
        - Action verbs: "Add", "Implement", "Update", "Enhance", "Create"
     c. Add traces annotation from module's traces
     d. Add files sub-line with all file paths and CREATE/MODIFY
     e. Record task ID for dependency computation
```

### 3.4 Compute Dependencies

```
1. For each task, check if its module depends on another module:
   - If module A depends on module B, then task(A) blocked_by task(B)
2. For each task with multiple files, check imports:
   - If file B imports from file A, and they are in different tasks,
     then task(B) blocked_by task(A)
3. Apply ordering heuristics:
   - Format/schema definitions before implementations
   - Core components before consumers
   - Templates before skills that read templates
   - Skills before agents that invoke skills
   - Agents before hooks that validate agent behavior
4. For each task, add blocked_by and blocks sub-lines
5. Validate acyclicity:
   - Trace all dependency chains
   - Confirm no task transitively depends on itself
   - If cycle detected: break the cycle at the weakest link
     (the dependency that is least critical) and document in log
```

### 3.5 Generate Dependency Graph Section

```
1. From the dependency edges, build the full graph
2. Find the critical path:
   a. Identify root tasks (no blocked_by)
   b. For each root, compute the longest chain to a leaf
   c. The longest chain overall is the critical path
3. Format the Dependency Graph section:

## Dependency Graph

### Critical Path
T0040 -> T0043 -> T0045 -> T0047
Length: 4 tasks

### All Dependencies
| Task | Description | Blocked By | Blocks |
|------|-------------|-----------|--------|
| T0040 | Add traceability to ORCH-012 | T0039 | T0043, T0046 |
| ... | ... | ... | ... |
```

### 3.6 Re-compute Traceability Matrix

```
1. With the new file-level tasks, re-scan all tasks for traces annotations
2. Rebuild the Traceability Matrix section
3. Coverage may change (more specific AC mappings at file level)
4. Report any newly uncovered ACs
```

### 3.7 Assemble Updated tasks.md

```
1. Start with the header block (preserved verbatim)
2. Add all Phase 01 through Phase 05 sections (preserved verbatim)
3. Replace Phase 06 section with refined file-level tasks:
   - Header: ## Phase 06: Implementation -- PENDING
   - All new file-level tasks with annotations and sub-lines
4. Add all Phase 07+ sections (preserved verbatim)
5. Add Dependency Graph section (new or updated)
6. Add Traceability Matrix section (updated)
7. Add Progress Summary section (updated counts)
```

### 3.8 Write Refinement Log

```
Generate task-refinement-log.md with:

# Task Refinement Log

**Generated**: {timestamp}
**Workflow**: {type} {artifact_folder}
**Design Artifacts Read**: {list of files}

## Decomposition Summary

| Original Task | Refined Into | File Count |
|---------------|-------------|------------|
| T0030 Check existing test infrastructure | T0039 (unchanged) | 0 |
| T0031 Write failing unit tests | T0040, T0041, T0042 | 5 |
| T0032 Implement code to pass tests | T0043, T0044, T0045, T0046, T0047 | 12 |
| ... | ... | ... |

## Dependency Edges Added

| From | To | Reason |
|------|-----|--------|
| T0040 | T0043 | T0043 imports from module defined in T0040 |
| ... | ... | ... |

## Traceability Changes

| AC | Before (task) | After (task) |
|----|---------------|-------------|
| AC-01a | T0031 | T0041 |
| ... | ... | ... |
```

---

## 4. Preservation Rules (AC-04d)

The refinement step MUST NOT modify:

1. The header block (except updating the timestamp if desired)
2. Any phase section other than Phase 06
3. Task IDs for non-Phase-06 tasks
4. Status headers for non-Phase-06 phases
5. Checkbox states for completed phases (Phase 01 stays [X])

The refinement step MAY:

1. Replace ALL Phase 06 task lines with new file-level tasks
2. Reassign TNNNN IDs for Phase 06 tasks (old IDs are retired)
3. Add the Dependency Graph section (new)
4. Update the Traceability Matrix section (re-computed)
5. Update the Progress Summary section (counts change)

---

## 5. Workflows Without Refinement

| Workflow | Has 04-design? | Has 06-implementation? | Refinement? |
|----------|---------------|----------------------|-------------|
| feature | YES | YES | YES |
| fix | NO | YES | NO -- no design artifacts to refine from |
| test-run | NO | NO | NO |
| test-generate | NO | NO | NO |

For fix workflows, the software-developer agent operates in standard mode. Mechanical mode with `--mechanical` on a fix workflow triggers fallback behavior (AC-05g: warning, then standard mode).

---

## 6. Error Handling

| Error Condition | Recovery |
|-----------------|----------|
| No module-design files found | Skip refinement, log warning, proceed with high-level tasks |
| tasks.md does not exist | Skip refinement entirely (plan-surfacer would have blocked earlier) |
| Phase 06 section not found in tasks.md | Log warning, skip refinement (edge case: workflow has implementation but plan lacks it) |
| Cycle detected in dependency graph | Break weakest edge, log the cycle in refinement log, emit warning |
| requirements-spec.md missing | Proceed without traceability cross-reference; log warning |
| Design artifact partially unreadable | Process what can be read; log skipped artifacts in refinement log |

---

## 7. State Changes

After refinement completes, set in `.isdlc/state.json`:

```json
{
  "active_workflow": {
    "refinement_completed": true,
    "refinement_timestamp": "2026-02-11T20:30:00Z",
    "refinement_stats": {
      "original_tasks": 6,
      "refined_tasks": 12,
      "dependency_edges": 8,
      "critical_path_length": 4,
      "ac_coverage_percent": 100
    }
  }
}
```

---

## 8. Orchestrator Section 3c Text (Exact Insertion for 00-sdlc-orchestrator.md)

This is the exact text to add to the orchestrator agent file as a new section:

```markdown
# SECTION 3c: TASK REFINEMENT

## When This Runs

This section is triggered by the phase-loop controller (isdlc.md step 3e-refine) after the design phase completes. The orchestrator does NOT invoke this section directly -- the phase-loop controller detects the trigger condition and executes the refinement inline.

## What It Does

Converts high-level Phase 06 (Implementation) tasks in tasks.md into file-level tasks using design artifacts produced by Phase 04.

## Process

1. **Read design artifacts** from `docs/requirements/{artifact_folder}/`:
   - All `module-design-*.md` files
   - `interface-spec.yaml` or `interface-spec.md` (if exists)
   - `component-spec.md` (if exists)

2. **Read requirements** from `docs/requirements/{artifact_folder}/requirements-spec.md`

3. **Read current plan** from `docs/isdlc/tasks.md`

4. **For each design module**, identify:
   - Target files (paths, CREATE or MODIFY)
   - Module dependencies (imports, uses)
   - Requirement traces (REQ-NNN, AC-NNx)

5. **Replace Phase 06 tasks** with file-level tasks:
   - One task per logical file group
   - Each task has: description, traces annotation, files sub-line
   - Add blocked_by/blocks sub-lines based on module dependencies

6. **Validate the dependency graph** is acyclic

7. **Generate Dependency Graph section** with critical path

8. **Re-compute Traceability Matrix**

9. **Write updated tasks.md** and **task-refinement-log.md**

10. **Update state.json**: set `refinement_completed: true`

## Fallback

If no design artifacts are found, skip refinement. Phase 06 tasks remain high-level. The software-developer agent will self-decompose work as it does today.
```

---

## 9. Traces

| Requirement | How Addressed |
|-------------|---------------|
| AC-04a | Refinement triggered after GATE-04 passes (step 3e-refine in phase loop) |
| AC-04b | Reads interface-spec, module-designs, design-specification from artifact folder |
| AC-04c | Replaces high-level Phase 06 tasks with file-level tasks in-place |
| AC-04d | Preserves all Phase 01-05 tasks unchanged (Section 4: Preservation Rules) |
| AC-04e | Adds traceability tags by cross-referencing requirements-spec.md |
| AC-04f | Adds dependency annotations based on module relationships from design |
| AC-04g | Produces task-refinement-log.md documenting decomposition |
| ADR-0002 | Refinement is an orchestrator step (Section 3c), not a new workflow phase |
| C-01 | No new workflow phases added -- workflows.json unchanged |
