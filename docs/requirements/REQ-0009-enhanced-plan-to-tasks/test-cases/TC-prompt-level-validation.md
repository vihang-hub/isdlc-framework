# Test Cases: Prompt-Level Validation (MV-01 through MV-06 + AC Coverage)

**Components**: ORCH-012 SKILL.md, isdlc.md refinement step, Agent 05 mechanical mode, PLAN INTEGRATION PROTOCOL v2, workflow-tasks-template.md
**Method**: Manual verification during Phase 16 (Quality Loop) and Phase 08 (Code Review)
**Traces**: FR-01 through FR-07 (all prompt-level ACs)

These test cases cover acceptance criteria that cannot be verified through automated unit tests because the components under test are LLM instruction sets (markdown prompt files), not executable code.

---

## MV-01: ORCH-012 SKILL.md Output Format Validation

**Component**: `src/claude/skills/orchestration/generate-plan/SKILL.md`
**Traces**: FR-01 (AC-01a through AC-01e), FR-02 (AC-02a through AC-02e), FR-06 (AC-06a through AC-06g)
**Phase**: Quality Loop (Phase 16)

### MV-01a: v2.0 header present in generated tasks.md
**Traces**: FR-06, AC-06a
**Verification**: After running generate-plan skill on a feature workflow, check that the output tasks.md contains `Format: v2.0` in the header block.
**Pass criteria**: `Format: v2.0` line is present.

### MV-01b: Traceability annotations on task lines
**Traces**: FR-02, AC-02a
**Verification**: Check that generated task lines include `| traces: FR-NN, AC-NNx` annotations.
**Pass criteria**: At least 80% of task lines have `| traces:` annotations.

### MV-01c: Traceability Matrix section generated
**Traces**: FR-02, AC-02b
**Verification**: Check that the generated tasks.md includes a `## Traceability Matrix` section with a Requirement Coverage table, Orphan Tasks list, and Uncovered Requirements list.
**Pass criteria**: Section present with all three sub-sections.

### MV-01d: Orphan detection warns about untraced tasks
**Traces**: FR-02, AC-02d
**Verification**: If any tasks lack `| traces:` annotations, they appear in the Orphan Tasks list in the Traceability Matrix section.
**Pass criteria**: Orphan tasks listed or "None" if all tasks have traces.

### MV-01e: Gap detection warns about uncovered requirements
**Traces**: FR-02, AC-02e
**Verification**: If any FR/AC from requirements-spec.md has no corresponding task, it appears in the Uncovered Requirements list.
**Pass criteria**: Uncovered requirements listed or "None" if all are covered.

### MV-01f: Phase 06 tasks are high-level at initial generation
**Traces**: FR-01, AC-01e
**Verification**: At initial plan generation (before refinement), Phase 06 tasks should NOT have `files:` sub-lines. File-level detail is added by the refinement step.
**Pass criteria**: Phase 06 tasks have no `files:` sub-lines in the initially generated tasks.md.

### MV-01g: Non-implementation phase tasks retain high-level format
**Traces**: FR-01, AC-01e
**Verification**: Phases 01 through 05 and 07+ tasks remain high-level (no file paths, no `files:` sub-lines).
**Pass criteria**: Only Phase 06 section (after refinement) has file-level annotations.

### MV-01h: Requirements spec cross-reference
**Traces**: FR-02, AC-02c
**Verification**: Confirm the generate-plan skill reads `requirements-spec.md` to extract FR/AC identifiers. Check that the traces in generated tasks match identifiers from the spec.
**Pass criteria**: Traces reference valid FR-NN and AC-NNx from requirements-spec.md.

---

## MV-02: Task Refinement Step Verification

**Component**: `src/claude/commands/isdlc.md` (Section 3e-refine)
**Traces**: FR-04 (AC-04a through AC-04g), FR-01 (AC-01a through AC-01d), FR-03 (AC-03a through AC-03e)
**Phase**: Quality Loop (Phase 16) -- requires running a full feature workflow through design phase

### MV-02a: Refinement triggers after GATE-04
**Traces**: FR-04, AC-04a
**Verification**: After the design phase (Phase 04) completes, the refinement step runs automatically before the next phase starts.
**Pass criteria**: Refinement executes between Phase 04 completion and Phase 05 start.

### MV-02b: Refinement reads design artifacts
**Traces**: FR-04, AC-04b
**Verification**: The refinement step reads `module-design-*.md`, `interface-spec.*`, and `component-spec.md` from the artifact folder.
**Pass criteria**: task-refinement-log.md lists the design artifacts that were read.

### MV-02c: Phase 06 tasks replaced with file-level tasks
**Traces**: FR-04, AC-04c; FR-01, AC-01a
**Verification**: After refinement, Phase 06 section in tasks.md contains file-level tasks with `files:` sub-lines specifying target file paths.
**Pass criteria**: Every Phase 06 task has at least one `files:` sub-line with a valid file path.

### MV-02d: Non-Phase-06 tasks preserved unchanged
**Traces**: FR-04, AC-04d
**Verification**: Compare Phase 01-05 and Phase 07+ sections before and after refinement.
**Pass criteria**: All non-Phase-06 tasks have identical text, task IDs, checkbox states, and annotations.

### MV-02e: Traceability tags added via cross-reference
**Traces**: FR-04, AC-04e; FR-02, AC-02a
**Verification**: After refinement, file-level tasks have `| traces:` annotations that correctly map to the AC from the design module they came from.
**Pass criteria**: Every refined Phase 06 task has `| traces:` annotation.

### MV-02f: Dependency annotations added from design relationships
**Traces**: FR-04, AC-04f; FR-03, AC-03a, AC-03b
**Verification**: After refinement, tasks with module dependencies have `blocked_by:` and/or `blocks:` sub-lines.
**Pass criteria**: At least some Phase 06 tasks have dependency annotations.

### MV-02g: task-refinement-log.md produced
**Traces**: FR-04, AC-04g
**Verification**: After refinement, `docs/requirements/{folder}/task-refinement-log.md` exists with decomposition summary, dependency edges, and traceability changes.
**Pass criteria**: File exists with the three expected sections.

### MV-02h: File paths use project-relative format
**Traces**: FR-01, AC-01d
**Verification**: All file paths in `files:` sub-lines start with a project-relative path (e.g., `src/...`), not absolute paths.
**Pass criteria**: No `files:` path starts with `/`.

### MV-02i: File action is CREATE or MODIFY
**Traces**: FR-01, AC-01b
**Verification**: All `files:` sub-lines specify either `(CREATE)` or `(MODIFY)`.
**Pass criteria**: No other actions present.

### MV-02j: Functions/exports specified in task description
**Traces**: FR-01, AC-01c
**Verification**: File-level tasks include descriptions of what to add or change (functions, exports, sections).
**Pass criteria**: Task descriptions are actionable, not just file paths.

### MV-02k: Dependency graph is acyclic
**Traces**: FR-03, AC-03c
**Verification**: After refinement, no circular dependency chains exist in the task graph.
**Pass criteria**: Dependency Graph section shows valid DAG. No cycle warnings in refinement log.

### MV-02l: Critical path identified
**Traces**: FR-03, AC-03d
**Verification**: The Dependency Graph section includes a Critical Path sub-section showing the longest dependency chain.
**Pass criteria**: Critical Path sub-section present with task chain and length.

### MV-02m: Cross-phase dependencies supported
**Traces**: FR-03, AC-03e
**Verification**: If a Phase 05 task produces test specifications consumed by Phase 06, the dependency is represented.
**Pass criteria**: Cross-phase dependency annotations are allowed (not blocked by validation).

---

## MV-03: Mechanical Execution Mode Verification

**Component**: `src/claude/agents/05-software-developer.md`
**Traces**: FR-05 (AC-05a through AC-05g)
**Phase**: Quality Loop (Phase 16) -- requires running Phase 06 with `--mechanical` flag

### MV-03a: --mechanical flag enables mechanical mode
**Traces**: FR-05, AC-05a
**Verification**: When `--mechanical` flag is passed (or `mechanical_mode: true` in state), Agent 05 enters mechanical mode.
**Pass criteria**: Agent reads `state.json -> active_workflow.mechanical_mode` and enters mechanical mode.

### MV-03b: Tasks executed in dependency order
**Traces**: FR-05, AC-05b
**Verification**: In mechanical mode, Agent 05 executes tasks in topological sort order based on `blocked_by`/`blocks` annotations.
**Pass criteria**: Task completion order follows dependency graph (no task executed before its prerequisites).

### MV-03c: No unauthorized task additions
**Traces**: FR-05, AC-05c
**Verification**: In mechanical mode, Agent 05 does not add new tasks without flagging as `[DEVIATION]`.
**Pass criteria**: Any new work is flagged with `[DEVIATION]` marker.

### MV-03d: Immediate completion marking
**Traces**: FR-05, AC-05d
**Verification**: After each task completes, `- [ ]` is immediately changed to `- [X]` in tasks.md.
**Pass criteria**: tasks.md is updated after each task, not just at the end.

### MV-03e: BLOCKED annotation with reason
**Traces**: FR-05, AC-05e
**Verification**: If a task cannot be completed, it is marked `- [BLOCKED]` with a `reason:` sub-line explaining why.
**Pass criteria**: Blocked tasks have both `[BLOCKED]` checkbox and `reason:` sub-line.

### MV-03f: Mechanical mode OFF by default
**Traces**: FR-05, AC-05f
**Verification**: Without `--mechanical` flag, Agent 05 uses standard self-decomposition mode.
**Pass criteria**: Default behavior unchanged from current implementation.

### MV-03g: Fallback when no file-level tasks
**Traces**: FR-05, AC-05g
**Verification**: When `--mechanical` is set but Phase 06 tasks lack `files:` sub-lines, Agent 05 emits a warning and falls back to standard mode.
**Pass criteria**: Warning emitted, standard mode used, no crash or block.

---

## MV-04: PLAN INTEGRATION PROTOCOL v2 Consistency

**Component**: 14 agent files + 1 extended (Agent 05)
**Traces**: FR-07 (AC-07a through AC-07d)
**Phase**: Code Review (Phase 08)

### MV-04a: All 14 agents have Annotation Preservation section
**Traces**: FR-07, AC-07c, AC-07d
**Verification**: Diff all 14 agent files listed in module-design-plan-integration-protocol-v2.md. Each must contain the identical `## Annotation Preservation (v2.0)` section with 5 rules.
**Pass criteria**: All 14 files contain the section; text is identical across all.

### MV-04b: Only Agent 05 has Mechanical Execution Mode section
**Traces**: FR-07, AC-07b
**Verification**: Only `05-software-developer.md` contains the `## Mechanical Execution Mode` section. The other 13 agents do not.
**Pass criteria**: Exactly 1 file has the mechanical mode section.

### MV-04c: Backward compatible for checkbox-only agents
**Traces**: FR-07, AC-07a
**Verification**: Agents that only toggle `- [ ]` to `- [X]` continue to work. The new annotation preservation rules are additive and do not change checkbox behavior.
**Pass criteria**: v1.0 tasks.md works identically with v2 protocol agents.

### MV-04d: Annotations preserved during checkbox toggle
**Traces**: FR-07, AC-07d
**Verification**: When an agent marks a task complete, the `| traces:` annotation, `blocked_by:`, `blocks:`, and `files:` sub-lines are all preserved.
**Pass criteria**: Before and after comparison shows only checkbox changed; all annotations intact.

---

## MV-05: Template Format Verification

**Component**: `.isdlc/templates/workflow-tasks-template.md`
**Traces**: FR-06
**Phase**: Code Review (Phase 08)

### MV-05a: Template has 06-implementation heading
**Verification**: The template contains `### 06-implementation` (not `### 05-implementation`).
**Pass criteria**: Heading present with correct phase key.

### MV-05b: Template has refinement comment
**Verification**: The template contains a comment indicating implementation tasks are high-level placeholders that get refined by Section 3c.
**Pass criteria**: HTML comment or markdown comment present in the implementation section.

---

## MV-06: End-to-End Backward Compatibility

**Component**: Full workflow execution
**Traces**: NFR-02, AC-06g, AC-07a
**Phase**: Quality Loop (Phase 16)

### MV-06a: Workflow without enhanced features works
**Verification**: Run a fix workflow (which has no design phase and no refinement step). Verify the entire workflow completes without errors. tasks.md is v1.0 format. No annotations or sub-lines. All agents work as before.
**Pass criteria**: Fix workflow completes end-to-end with zero errors related to the enhanced format.

### MV-06b: Agents without changes handle v2.0 tasks.md
**Verification**: Agents that were NOT modified to be v2-aware (e.g., Agent 16 quality-loop-engineer) can still work when tasks.md is in v2.0 format. They ignore annotations they do not understand.
**Pass criteria**: Non-updated agents do not crash or produce errors when encountering v2.0 annotations.

---

## Summary

| Validation ID | ACs Covered | Method |
|---------------|-------------|--------|
| MV-01 (8 sub-checks) | AC-01a, AC-01e, AC-02a through AC-02e, AC-06a, AC-06g | Output format review |
| MV-02 (13 sub-checks) | AC-01a through AC-01d, AC-03a through AC-03e, AC-04a through AC-04g | Workflow run + artifact review |
| MV-03 (7 sub-checks) | AC-05a through AC-05g | Mechanical mode run |
| MV-04 (4 sub-checks) | AC-07a through AC-07d | File diff + behavioral review |
| MV-05 (2 sub-checks) | FR-06 (template format) | Template file review |
| MV-06 (2 sub-checks) | AC-06g, AC-07a, NFR-02 | End-to-end backward compat run |
| **TOTAL: 36 sub-checks** | **All 38 ACs** | **Manual + output review** |
