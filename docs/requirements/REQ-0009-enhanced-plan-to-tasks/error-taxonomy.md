# Error Taxonomy: REQ-0009 Enhanced Plan-to-Tasks Pipeline

**Version**: 1.0.0
**Date**: 2026-02-11
**Author**: System Designer (Agent 03)
**Phase**: 04-design
**Traces**: All FRs and NFRs

---

## 1. Overview

This document classifies all failure modes across the six enhanced components: ORCH-012 plan generation, task refinement step, mechanical execution mode, PLAN INTEGRATION PROTOCOL v2, plan-surfacer format validation, and the enhanced tasks.md format itself.

### Error Classification

| Severity | Definition | System Response |
|----------|-----------|-----------------|
| FATAL | System cannot proceed; data integrity at risk | BLOCK the operation, emit clear error, log event |
| RECOVERABLE | Operation cannot complete as intended but has a safe fallback | WARN, fall back to degraded behavior, log event |
| INFORMATIONAL | Suboptimal condition detected; no impact on correctness | LOG, continue normally |

### Recovery Strategy Patterns

| Pattern | Description | Used When |
|---------|-------------|-----------|
| FALLBACK | Switch to a less-capable but functional alternative | Feature unavailable but system can proceed |
| SKIP | Skip the operation entirely and continue | Optional step that failed |
| RETRY | Attempt the operation again (with or without changes) | Transient failures |
| BLOCK | Stop the operation and request intervention | Correctness at risk |
| DEGRADE | Continue with reduced functionality | Partial data available |

---

## 2. ORCH-012 Plan Generation Errors

### E-GEN-001: Requirements spec not found

| Field | Value |
|-------|-------|
| Severity | RECOVERABLE |
| Component | ORCH-012 Step 1 |
| Condition | `docs/requirements/{folder}/requirements-spec.md` does not exist |
| Impact | Tasks generated without traceability annotations; Traceability Matrix empty |
| Recovery | DEGRADE: Generate tasks without `\| traces:` annotations. Log warning. Include empty Traceability Matrix with note. |
| Traces | FR-02, AC-02c |

### E-GEN-002: Template not found

| Field | Value |
|-------|-------|
| Severity | FATAL |
| Component | ORCH-012 Step 2 |
| Condition | `.isdlc/templates/workflow-tasks-template.md` does not exist |
| Impact | Cannot generate any tasks; no template to work from |
| Recovery | BLOCK: Emit error. Orchestrator must resolve. The template is a framework file that should always exist. |
| Traces | FR-06 |

### E-GEN-003: Workflow type not in template

| Field | Value |
|-------|-------|
| Severity | FATAL |
| Component | ORCH-012 Step 2 |
| Condition | Template does not have a section matching `active_workflow.type` |
| Impact | Cannot generate tasks for this workflow type |
| Recovery | BLOCK: Emit error with available workflow types. |
| Traces | FR-06 |

### E-GEN-004: State.json missing active_workflow

| Field | Value |
|-------|-------|
| Severity | FATAL |
| Component | ORCH-012 Step 1 |
| Condition | `state.json` has no `active_workflow` or it is null |
| Impact | Cannot determine workflow type, phases, or artifact folder |
| Recovery | BLOCK: Emit error. This should never happen if GATE-01 passed. |
| Traces | FR-06 |

### E-GEN-005: No REQ/AC identifiers found in requirements

| Field | Value |
|-------|-------|
| Severity | INFORMATIONAL |
| Component | ORCH-012 Step 1 (new) |
| Condition | Requirements-spec.md exists but contains no `FR-NN` or `AC-NNx` patterns |
| Impact | Traceability annotations will be empty |
| Recovery | DEGRADE: Continue without traces. Log informational message. |
| Traces | FR-02 |

### E-GEN-006: Traceability coverage below 80%

| Field | Value |
|-------|-------|
| Severity | INFORMATIONAL |
| Component | ORCH-012 Step 5 (new) |
| Condition | Traceability Matrix shows <80% of FRs have at least one task with traces |
| Impact | Potential orphan requirements; traceability chain incomplete |
| Recovery | LOG: Include warning in Traceability Matrix "Uncovered Requirements" section. Do not block. |
| Traces | FR-02, AC-02e |

---

## 3. Task Refinement Step Errors

### E-REF-001: No design artifacts found

| Field | Value |
|-------|-------|
| Severity | RECOVERABLE |
| Component | Refinement Step 3e-refine |
| Condition | No `module-design-*.md` files in `docs/requirements/{folder}/` |
| Impact | Cannot decompose high-level tasks to file-level; refinement skipped |
| Recovery | SKIP: Phase 06 tasks remain high-level. Log warning. Software-developer agent will self-decompose. |
| Traces | FR-04, AC-04b |

### E-REF-002: tasks.md not found

| Field | Value |
|-------|-------|
| Severity | RECOVERABLE |
| Component | Refinement Step 3e-refine |
| Condition | `docs/isdlc/tasks.md` does not exist at refinement time |
| Impact | Nothing to refine |
| Recovery | SKIP: Refinement cannot run without a base plan. Log warning. Plan-surfacer hook would block later phases. |
| Traces | FR-04 |

### E-REF-003: Phase 06 section not found in tasks.md

| Field | Value |
|-------|-------|
| Severity | RECOVERABLE |
| Component | Refinement Step Algorithm (3.1) |
| Condition | tasks.md exists but has no Phase 06 / Implementation section |
| Impact | No implementation tasks to refine |
| Recovery | SKIP: Log warning. This edge case occurs if workflow has implementation phase but plan lacks it (inconsistency). |
| Traces | FR-04, AC-04c |

### E-REF-004: Dependency cycle detected during refinement

| Field | Value |
|-------|-------|
| Severity | RECOVERABLE |
| Component | Refinement Step Algorithm (3.4) |
| Condition | Computed dependency graph contains a cycle |
| Impact | Topological sort cannot produce valid execution order |
| Recovery | DEGRADE: Break the weakest edge in the cycle (the dependency with least justification). Document the broken edge and the original cycle in task-refinement-log.md. Emit warning. |
| Traces | FR-03, AC-03c |

### E-REF-005: Design artifact partially unreadable

| Field | Value |
|-------|-------|
| Severity | RECOVERABLE |
| Component | Refinement Step Algorithm (3.2) |
| Condition | A module-design file exists but cannot be fully parsed (malformed markdown, missing sections) |
| Impact | Incomplete file-level decomposition for that module |
| Recovery | DEGRADE: Process what can be read. Log the skipped portions in task-refinement-log.md. Tasks for that module may be less detailed. |
| Traces | FR-04 |

### E-REF-006: Refinement already completed

| Field | Value |
|-------|-------|
| Severity | INFORMATIONAL |
| Component | Refinement Step trigger check |
| Condition | `state.json -> active_workflow.refinement_completed` is already `true` |
| Impact | None (guard against re-runs) |
| Recovery | SKIP: Silently skip refinement. This is expected behavior on workflow resume. |
| Traces | FR-04 |

### E-REF-007: Task ID numbering gap

| Field | Value |
|-------|-------|
| Severity | INFORMATIONAL |
| Component | Refinement Step Algorithm (3.3) |
| Condition | After replacing Phase 06 tasks, the TNNNN sequence has gaps (old IDs retired) |
| Impact | Task IDs are not strictly sequential (cosmetic only) |
| Recovery | LOG: Document the gap in task-refinement-log.md. IDs do not need to be sequential; they just need to be unique. |
| Traces | FR-06 |

---

## 4. Mechanical Execution Mode Errors

### E-MECH-001: Mechanical mode requested but no file-level tasks

| Field | Value |
|-------|-------|
| Severity | RECOVERABLE |
| Component | Agent 05 Mode Detection |
| Condition | `mechanical_mode: true` but Phase 06 tasks lack `files:` sub-lines |
| Impact | Cannot execute mechanically without file targets |
| Recovery | FALLBACK: Emit warning (see module-design-mechanical-mode.md Section 6). Fall back to standard mode. |
| Traces | FR-05, AC-05g |

### E-MECH-002: Unmet dependencies (blocked task)

| Field | Value |
|-------|-------|
| Severity | RECOVERABLE |
| Component | Agent 05 Execution Loop (2.4) |
| Condition | Task's `blocked_by` includes a task that is not `[X]` (it is `[ ]` or `[BLOCKED]`) |
| Impact | Task cannot proceed |
| Recovery | BLOCK (task-level): Mark task as `[BLOCKED]` with `reason: Unmet dependencies: TNNNN, TNNNN`. Continue to next eligible task. |
| Traces | FR-05, AC-05e |

### E-MECH-003: Task implementation failure after retries

| Field | Value |
|-------|-------|
| Severity | RECOVERABLE |
| Component | Agent 05 Single Task Execution (2.5) |
| Condition | A task fails after 3 retry attempts (tests do not pass, file cannot be created/modified) |
| Impact | Task cannot be completed; downstream tasks may be blocked |
| Recovery | BLOCK (task-level): Mark as `[BLOCKED]` with reason. Continue to next task. Report blocked tasks in final summary. |
| Traces | FR-05, AC-05e |

### E-MECH-004: Dependency cycle in task graph

| Field | Value |
|-------|-------|
| Severity | RECOVERABLE |
| Component | Agent 05 Topological Sort (2.3) |
| Condition | The parsed dependency graph has a cycle (should have been caught by refinement, but could occur if tasks.md was manually edited) |
| Impact | Some tasks cannot be ordered |
| Recovery | DEGRADE: Emit warning about cycle. Append remaining tasks in ID order (best effort). Continue execution. |
| Traces | FR-03, AC-03c |

### E-MECH-005: tasks.md write conflict

| Field | Value |
|-------|-------|
| Severity | RECOVERABLE |
| Component | Agent 05 mark_completed / mark_blocked |
| Condition | Cannot write to tasks.md (file locked, permissions, etc.) |
| Impact | Task completion not recorded; progress tracking broken |
| Recovery | RETRY: Attempt write 3 times with 1-second delay. If still failing, log error and continue execution without updating tasks.md. Report at end. |
| Traces | FR-05, AC-05d |

### E-MECH-006: Deviation detected

| Field | Value |
|-------|-------|
| Severity | INFORMATIONAL |
| Component | Agent 05 Deviation Handling (4.0) |
| Condition | Agent needs to do work not described in any task (discovered during implementation) |
| Impact | Plan is incomplete; actual work differs from planned work |
| Recovery | LOG: Emit `[DEVIATION]` marker with reason. Document in output. Continue execution. |
| Traces | FR-05, AC-05c |

### E-MECH-007: All tasks blocked

| Field | Value |
|-------|-------|
| Severity | RECOVERABLE |
| Component | Agent 05 Execution Loop (2.4) |
| Condition | After processing all tasks, zero tasks completed and all remaining are `[BLOCKED]` |
| Impact | No progress made; implementation stalled |
| Recovery | FALLBACK: Emit error summary. Suggest human intervention. If the first task in dependency order failed, the entire chain is blocked. Report the root blocker. |
| Traces | FR-05 |

---

## 5. PLAN INTEGRATION PROTOCOL v2 Errors

### E-PIP-001: Agent accidentally removes annotations

| Field | Value |
|-------|-------|
| Severity | RECOVERABLE |
| Component | Any phase agent during checkbox toggle |
| Condition | Agent writes tasks.md without preserving pipe annotations or sub-lines |
| Impact | Traceability and dependency information lost for affected tasks |
| Recovery | DEGRADE: Information loss is not immediately detected. The Traceability Matrix becomes stale. Future refinement or manual correction needed. Prevention: the protocol rules make this expectation explicit. |
| Traces | FR-07, AC-07d |

### E-PIP-002: Agent modifies Dependency Graph section

| Field | Value |
|-------|-------|
| Severity | INFORMATIONAL |
| Component | Any phase agent (non-Agent-05) |
| Condition | Agent edits the Dependency Graph section (should only be modified by refinement step or Agent 05) |
| Impact | Dependency information may become inconsistent with inline annotations |
| Recovery | LOG: No automated detection. The section is regenerated during refinement. Manual review during code review phase. |
| Traces | FR-07, AC-07d |

---

## 6. Plan-Surfacer Format Validation Errors

### E-HOOK-001: Format validation throws exception

| Field | Value |
|-------|-------|
| Severity | INFORMATIONAL |
| Component | plan-surfacer.cjs `validateTasksFormat()` |
| Condition | Unexpected error during format validation (malformed content, regex failure) |
| Impact | None -- validation is skipped |
| Recovery | SKIP: Caught by try/catch in `validateTasksFormat()`. Return empty warnings array. Existing fail-open behavior. |
| Traces | FR-08, AC-08c, Article X |

### E-HOOK-002: Cycle detection throws exception

| Field | Value |
|-------|-------|
| Severity | INFORMATIONAL |
| Component | plan-surfacer.cjs `detectCyclesInDependencyGraph()` |
| Condition | Unexpected error during cycle detection parsing |
| Impact | None -- cycle detection is skipped |
| Recovery | SKIP: Return null. No warning emitted. |
| Traces | FR-08, Article X |

### E-HOOK-003: tasks.md read error during validation

| Field | Value |
|-------|-------|
| Severity | INFORMATIONAL |
| Component | plan-surfacer.cjs `validateTasksFormat()` |
| Condition | `fs.readFileSync()` fails (permissions, encoding, etc.) |
| Impact | None -- validation is skipped |
| Recovery | SKIP: Caught by outer try/catch. The existence check already passed, so this is an edge case. |
| Traces | FR-08, Article X |

---

## 7. Enhanced tasks.md Format Errors

### E-FMT-001: Missing Format header

| Field | Value |
|-------|-------|
| Severity | INFORMATIONAL |
| Component | tasks.md parsing |
| Condition | tasks.md has no `Format: v2.0` line in header block |
| Impact | Treated as legacy v1.0 format; no enhanced features expected |
| Recovery | SKIP: All v2.0 features gracefully degrade. No annotations, no dependency graph, no traceability matrix. |
| Traces | FR-06, NFR-02 |

### E-FMT-002: Malformed pipe annotation

| Field | Value |
|-------|-------|
| Severity | INFORMATIONAL |
| Component | Any consumer parsing task lines |
| Condition | Pipe annotation has invalid syntax (e.g., `| traces FR-01` missing colon) |
| Impact | Annotation cannot be parsed; treated as part of description text |
| Recovery | SKIP: Consumers that fail to parse a pipe annotation treat the entire post-pipe content as description text. No data loss (task line still works for checkbox toggle). |
| Traces | FR-06, AC-06a |

### E-FMT-003: Invalid task ID reference in dependency

| Field | Value |
|-------|-------|
| Severity | INFORMATIONAL |
| Component | Dependency graph parsing |
| Condition | `blocked_by: [T9999]` where T9999 does not exist in tasks.md |
| Impact | Dependency edge points to nonexistent task |
| Recovery | SKIP: Ignore invalid references. In mechanical mode, treat the dependency as satisfied (non-blocking). Log warning. |
| Traces | FR-03, AC-03a |

### E-FMT-004: Inconsistency between inline and summary dependencies

| Field | Value |
|-------|-------|
| Severity | INFORMATIONAL |
| Component | Dependency Graph section vs inline sub-lines |
| Condition | The Dependency Graph table shows different edges than inline `blocked_by:`/`blocks:` sub-lines |
| Impact | Ambiguity about true dependencies |
| Recovery | LOG: Inline sub-lines are authoritative (they are collocated with the task). The Dependency Graph section is a summary view. In case of conflict, inline wins. |
| Traces | FR-03, ADR-0004 |

---

## 8. Cross-Cutting Error Patterns

### 8.1 Fail-Open Hierarchy

```
                    BLOCK (fatal errors only)
                         |
                    FALLBACK (recoverable with alternative)
                         |
                    DEGRADE (partial functionality)
                         |
                    SKIP (optional feature bypassed)
                         |
                    LOG (informational only)
```

All errors default to the LOWEST severity that maintains system safety. Blocking is reserved for situations where data integrity is at risk (missing template, missing state).

### 8.2 Error Propagation

| Source | Propagates To | How |
|--------|--------------|-----|
| ORCH-012 generation error | Orchestrator | Orchestrator receives error from skill execution |
| Refinement step error | Phase loop | Phase loop detects skip/failure and continues |
| Mechanical mode error | Task-level blocking | Individual tasks marked [BLOCKED]; loop continues |
| Protocol violation | Stale data | Detected only during code review or next refinement |
| Hook validation error | stderr warning | Agent receives warning in context; no action required |

### 8.3 Human Escalation Triggers

| Condition | Escalation |
|-----------|-----------|
| All mechanical tasks blocked (E-MECH-007) | Report to user; suggest manual plan review |
| Persistent dependency cycle after break attempt (E-REF-004) | Report to user; design may need correction |
| Template missing (E-GEN-002) | Report to user; framework installation may be corrupted |
| State.json missing active_workflow (E-GEN-004) | Report to user; workflow may have been interrupted |

---

## 9. Error Code Summary

| Code | Component | Severity | Recovery |
|------|-----------|----------|----------|
| E-GEN-001 | ORCH-012 | RECOVERABLE | DEGRADE |
| E-GEN-002 | ORCH-012 | FATAL | BLOCK |
| E-GEN-003 | ORCH-012 | FATAL | BLOCK |
| E-GEN-004 | ORCH-012 | FATAL | BLOCK |
| E-GEN-005 | ORCH-012 | INFORMATIONAL | DEGRADE |
| E-GEN-006 | ORCH-012 | INFORMATIONAL | LOG |
| E-REF-001 | Refinement | RECOVERABLE | SKIP |
| E-REF-002 | Refinement | RECOVERABLE | SKIP |
| E-REF-003 | Refinement | RECOVERABLE | SKIP |
| E-REF-004 | Refinement | RECOVERABLE | DEGRADE |
| E-REF-005 | Refinement | RECOVERABLE | DEGRADE |
| E-REF-006 | Refinement | INFORMATIONAL | SKIP |
| E-REF-007 | Refinement | INFORMATIONAL | LOG |
| E-MECH-001 | Mechanical | RECOVERABLE | FALLBACK |
| E-MECH-002 | Mechanical | RECOVERABLE | BLOCK (task) |
| E-MECH-003 | Mechanical | RECOVERABLE | BLOCK (task) |
| E-MECH-004 | Mechanical | RECOVERABLE | DEGRADE |
| E-MECH-005 | Mechanical | RECOVERABLE | RETRY |
| E-MECH-006 | Mechanical | INFORMATIONAL | LOG |
| E-MECH-007 | Mechanical | RECOVERABLE | FALLBACK |
| E-PIP-001 | Protocol | RECOVERABLE | DEGRADE |
| E-PIP-002 | Protocol | INFORMATIONAL | LOG |
| E-HOOK-001 | Hook | INFORMATIONAL | SKIP |
| E-HOOK-002 | Hook | INFORMATIONAL | SKIP |
| E-HOOK-003 | Hook | INFORMATIONAL | SKIP |
| E-FMT-001 | Format | INFORMATIONAL | SKIP |
| E-FMT-002 | Format | INFORMATIONAL | SKIP |
| E-FMT-003 | Format | INFORMATIONAL | SKIP |
| E-FMT-004 | Format | INFORMATIONAL | LOG |

**Total**: 29 classified error conditions
**Fatal**: 3 (all in ORCH-012, requiring framework prerequisites)
**Recoverable**: 14 (all with explicit fallback or skip strategies)
**Informational**: 12 (logged but do not affect operation)
