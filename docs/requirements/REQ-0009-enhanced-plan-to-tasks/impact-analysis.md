# Impact Analysis: REQ-0009 Enhanced Plan-to-Tasks Pipeline

**Generated**: 2026-02-11T23:00:00Z
**Feature**: Enhanced plan-to-tasks pipeline -- make tasks.md the implementation authority with file-level granularity, traceability, dependency graphs, task refinement step, and mechanical execution mode
**Based On**: Phase 01 Requirements (requirements-spec.md, user-stories.json, nfr-matrix.md)
**Phase**: 02-impact-analysis

---

## Scope Comparison

| Aspect | Original (Phase 00 Quick Scan) | Clarified (Phase 01 Requirements) |
|--------|-------------------------------|-----------------------------------|
| Description | 5 sub-features: file-level tasks, traceability, dependency graph, refinement step, mechanical mode | 8 formal requirements (FR-01 through FR-08) with 38 acceptance criteria across 8 user stories |
| Keywords | tasks.md, generate-plan, ORCH-012, PLAN INTEGRATION, traceability, dependency | + backward compatibility, format schema, pipe-delimited annotations, cycle detection, critical path, orphan detection |
| Estimated Files | 8-15 | 20-25 (14 agents with PLAN INTEGRATION PROTOCOL + 6 core files + 3 config/template files) |
| Scope Change | - | EXPANDED: Added FR-06 (enhanced format spec), FR-07 (protocol update), FR-08 (hook validation) as explicit first-class requirements |

---

## Executive Summary

This feature touches the heart of the iSDLC execution pipeline. The primary blast radius centers on the ORCH-012 generate-plan skill (the single most important file to modify), the software-developer agent (05), the orchestrator (00), and the isdlc.md command controller. A secondary wave propagates through the PLAN INTEGRATION PROTOCOL shared across 14 of the 17 agent files. The risk profile is MEDIUM: the additive nature of the format changes (pipe-delimited annotations on sub-lines) provides strong backward compatibility, but the task refinement step introduces a new orchestrator-level concept that must integrate cleanly with the existing phase-loop controller. The mechanical execution mode is self-contained to a single agent file and is opt-in, keeping its risk low.

**Blast Radius**: MEDIUM (20-25 files across 5 modules)
**Risk Level**: MEDIUM
**Affected Files**: 25 (6 primary, 14 agent protocol, 5 config/test)
**Affected Modules**: 5 (orchestration skills, agents, hooks, commands, templates)

---

## Impact Analysis (M1)

### Directly Affected Files by Requirement

#### FR-01: File-Level Task Granularity
| File | Change Type | Impact |
|------|-------------|--------|
| `src/claude/skills/orchestration/generate-plan/SKILL.md` | MODIFY (major) | Add file-level task output format, file path annotations, CREATE/MODIFY markers. Rewrite Step 3 (Generate Task IDs and Format) and Output Format section. |
| `src/isdlc/templates/workflow-tasks-template.md` | MODIFY (major) | Add file-level placeholder syntax to implementation phase tasks. Template must support both high-level (phases 01-05) and file-level (phase 06) formats. |

#### FR-02: User-Story Traceability
| File | Change Type | Impact |
|------|-------------|--------|
| `src/claude/skills/orchestration/generate-plan/SKILL.md` | MODIFY (major) | Add requirement reading step (Step 1 must now also read requirements-spec.md to extract REQ/AC IDs). Add traceability tag generation logic. Add Traceability Matrix section to output format. |
| `src/claude/skills/orchestration/task-decomposition/SKILL.md` | MODIFY (minor) | Align task-decomposition output format with new traceability annotation style. Currently uses TASK-XXX-NN format which should be consistent with TNNNN + traces. |

#### FR-03: Explicit Dependency Graph
| File | Change Type | Impact |
|------|-------------|--------|
| `src/claude/skills/orchestration/generate-plan/SKILL.md` | MODIFY (major) | Add dependency annotation generation (blocked_by, blocks). Add cycle detection validation step. Add Dependency Graph and Critical Path sections to output format. |
| `src/claude/skills/orchestration/task-decomposition/SKILL.md` | MODIFY (minor) | Already has Step 5 (Create Dependency Graph) with blocks/blocked-by concept. Align annotation format with generate-plan. |

#### FR-04: Task Refinement Step
| File | Change Type | Impact |
|------|-------------|--------|
| `src/claude/agents/00-sdlc-orchestrator.md` | MODIFY (major) | Add new section (3c or similar) for task refinement step between design and implementation phases. Must read design artifacts and update tasks.md in-place. |
| `src/claude/commands/isdlc.md` | MODIFY (medium) | Phase-loop controller (STEP 3) may need awareness of refinement step if it runs as an orchestrator-level action between phases rather than as a phase itself. |
| `src/isdlc/config/workflows.json` | NO CHANGE (constraint C-01) | Refinement is an orchestrator step, not a new phase. workflows.json remains unchanged. |

#### FR-05: Mechanical Execution Mode
| File | Change Type | Impact |
|------|-------------|--------|
| `src/claude/agents/05-software-developer.md` | MODIFY (major) | Add MECHANICAL EXECUTION MODE section: opt-in flag detection, task-by-task execution protocol, deviation flagging, BLOCKED annotation support, fallback to standard mode. |
| `src/isdlc/config/workflows.json` | MODIFY (minor) | Add `mechanical_mode` option to feature workflow's `06-implementation` agent_modifiers. |

#### FR-06: Enhanced Tasks.md Format
| File | Change Type | Impact |
|------|-------------|--------|
| `src/claude/skills/orchestration/generate-plan/SKILL.md` | MODIFY (major) | Central format definition. Add schema reference section documenting pipe-delimited annotations, sub-line format for traces/blocked_by/files, Dependency Graph section, Traceability Matrix section. |
| `src/isdlc/templates/workflow-tasks-template.md` | MODIFY (medium) | Template must support new annotation placeholders while remaining parseable by current format. |

#### FR-07: PLAN INTEGRATION PROTOCOL Update
| File | Change Type | Impact |
|------|-------------|--------|
| `src/claude/agents/01-requirements-analyst.md` | MODIFY (minor) | Update PLAN INTEGRATION PROTOCOL section |
| `src/claude/agents/02-solution-architect.md` | MODIFY (minor) | Update PLAN INTEGRATION PROTOCOL section |
| `src/claude/agents/03-system-designer.md` | MODIFY (minor) | Update PLAN INTEGRATION PROTOCOL section |
| `src/claude/agents/04-test-design-engineer.md` | MODIFY (minor) | Update PLAN INTEGRATION PROTOCOL section |
| `src/claude/agents/05-software-developer.md` | MODIFY (medium) | Update PLAN INTEGRATION PROTOCOL + add mechanical mode instructions |
| `src/claude/agents/06-integration-tester.md` | MODIFY (minor) | Update PLAN INTEGRATION PROTOCOL section |
| `src/claude/agents/07-qa-engineer.md` | MODIFY (minor) | Update PLAN INTEGRATION PROTOCOL section |
| `src/claude/agents/08-security-compliance-auditor.md` | MODIFY (minor) | Update PLAN INTEGRATION PROTOCOL section |
| `src/claude/agents/09-cicd-engineer.md` | MODIFY (minor) | Update PLAN INTEGRATION PROTOCOL section |
| `src/claude/agents/10-dev-environment-engineer.md` | MODIFY (minor) | Update PLAN INTEGRATION PROTOCOL section |
| `src/claude/agents/11-deployment-engineer-staging.md` | MODIFY (minor) | Update PLAN INTEGRATION PROTOCOL section |
| `src/claude/agents/12-release-manager.md` | MODIFY (minor) | Update PLAN INTEGRATION PROTOCOL section |
| `src/claude/agents/13-site-reliability-engineer.md` | MODIFY (minor) | Update PLAN INTEGRATION PROTOCOL section |
| `src/claude/agents/14-upgrade-engineer.md` | MODIFY (minor) | Update PLAN INTEGRATION PROTOCOL section |

**Note**: These 14 agents share an identical PLAN INTEGRATION PROTOCOL block. The update is a single text change replicated 14 times. The protocol currently only describes `[X]`/`[ ]` checkbox toggling and phase header updates. The enhanced protocol must add: "MUST NOT remove traceability or dependency annotations when updating tasks."

**Agents WITHOUT PLAN INTEGRATION PROTOCOL** (3 files -- no changes needed):
- `src/claude/agents/00-sdlc-orchestrator.md` (orchestrator manages plan directly via ORCH-012)
- `src/claude/agents/16-quality-loop-engineer.md` (no tasks.md interaction)
- `src/claude/agents/discover-orchestrator.md` (pre-workflow, no tasks.md)

#### FR-08: Plan Surfacer Hook Enhancement
| File | Change Type | Impact |
|------|-------------|--------|
| `src/claude/hooks/plan-surfacer.cjs` | MODIFY (medium) | Add optional format validation for Phase 06 sections: check for file-level tasks. Validation failures must be warnings (AC-08c), not blocks. |
| `src/claude/hooks/tests/plan-surfacer.test.cjs` | MODIFY (medium) | Add test cases for format validation (warning on missing file-level tasks, no block on missing annotations). |

### Outward Dependencies (What Depends on Modified Files)

| Modified File | Dependents | Impact Direction |
|---------------|-----------|-----------------|
| `generate-plan/SKILL.md` | Orchestrator (00), all agents via tasks.md, plan-surfacer hook | Format changes cascade to all task consumers |
| `05-software-developer.md` | Phase-loop controller (isdlc.md), orchestrator delegation, test-watcher hook | Mechanical mode adds a new execution path; hook interactions unchanged |
| `00-sdlc-orchestrator.md` | isdlc.md command, all phase agents (receives delegation results) | Refinement step is a new orchestrator action; phase agents unaware |
| `plan-surfacer.cjs` | Pre-task dispatcher, all Task tool invocations | Warning-only validation means no breakage for existing flows |
| `workflows.json` | Orchestrator, isdlc.md, all workflow-dependent hooks | Minimal change (agent_modifiers only), no phase sequence changes |
| `workflow-tasks-template.md` | ORCH-012 generate-plan skill only | Template is read only by generate-plan; changes isolated |

### Inward Dependencies (What Modified Files Depend On)

| Modified File | Dependencies | Risk |
|---------------|-------------|------|
| `generate-plan/SKILL.md` | state.json (active_workflow), Phase 01 artifacts, workflow-tasks-template.md | LOW -- all inputs already exist |
| `05-software-developer.md` | Design artifacts, tasks.md, state.json, test infrastructure | LOW -- reads same inputs, adds new execution path |
| `00-sdlc-orchestrator.md` | GATE-04 (design), design artifacts, tasks.md | MEDIUM -- refinement step adds new dependency on design artifacts |
| `plan-surfacer.cjs` | common.cjs (resolveTasksPath), state.json | LOW -- extends existing check function |
| `isdlc.md` | state.json, workflows.json, agent table | LOW -- may need refinement step awareness |

### Change Propagation Estimate

```
Level 0 (Core):     ORCH-012 SKILL.md, orchestrator (00), software-developer (05)
Level 1 (Direct):   isdlc.md, plan-surfacer.cjs, workflow-tasks-template.md, workflows.json
Level 2 (Protocol): 14 agent files (PLAN INTEGRATION PROTOCOL update)
Level 3 (Config):   skills-manifest.json (metadata only), plan-surfacer.test.cjs
```

---

## Entry Points (M2)

### Existing Entry Points Relevant to Each Requirement

| Entry Point | File | Relevant FRs | Current State |
|-------------|------|-------------|---------------|
| ORCH-012 generate-plan invocation | `src/claude/agents/00-sdlc-orchestrator.md` Section 3b | FR-01, FR-02, FR-03, FR-06 | Called post-GATE-01 for feature/fix workflows |
| Phase-loop controller STEP 3d | `src/claude/commands/isdlc.md` lines 772-811 | FR-04 | Delegates to phase agents sequentially |
| PLAN INTEGRATION PROTOCOL "On Phase Start" | 14 agent files | FR-07 | Reads tasks.md, updates headers, refines tasks |
| plan-surfacer check() function | `src/claude/hooks/plan-surfacer.cjs` line 42 | FR-08 | Blocks Task tool when tasks.md missing for impl+ phases |
| Software developer TDD workflow | `src/claude/agents/05-software-developer.md` lines 206-303 | FR-05 | Iterates test-write-run-fix; self-decomposes work |
| workflow-tasks-template task descriptions | `src/isdlc/templates/workflow-tasks-template.md` | FR-01, FR-06 | Plain text descriptions for generate-plan to format |

### New Entry Points to Create

| Entry Point | Location | FR | Description |
|-------------|----------|-----|-------------|
| Task refinement step | `src/claude/agents/00-sdlc-orchestrator.md` (new Section 3c) | FR-04 | New orchestrator section between design and implementation. Reads design artifacts, updates tasks.md with file-level detail. |
| Refinement trigger in phase-loop | `src/claude/commands/isdlc.md` (STEP 3, after GATE-04) | FR-04 | Phase-loop must invoke refinement after design phase completes and before implementation starts. |
| Mechanical mode detection | `src/claude/agents/05-software-developer.md` (new section) | FR-05 | On phase start: check agent_modifiers for mechanical_mode:true or --mechanical flag in workflow options. |
| Format validation in hook | `src/claude/hooks/plan-surfacer.cjs` (extend check()) | FR-08 | After existence check passes, optionally validate Phase 06 sections for file-level tasks. |
| Traceability Matrix generator | `src/claude/skills/orchestration/generate-plan/SKILL.md` (new Step) | FR-02 | After generating tasks, create a traceability summary cross-referencing requirements-spec.md. |
| Cycle detection validator | `src/claude/skills/orchestration/generate-plan/SKILL.md` (new Step) | FR-03 | After generating dependency annotations, validate acyclicity. |

### Implementation Chain (Entry to Data Layer)

```
1. ORCH-012 SKILL.md reads:
   - state.json -> active_workflow (type, phases, artifact_folder)
   - requirements-spec.md -> REQ/AC IDs [NEW for FR-02]
   - workflow-tasks-template.md -> task descriptions
   - design artifacts [NEW for FR-04 refinement]

2. ORCH-012 SKILL.md writes:
   - docs/isdlc/tasks.md (enhanced format with traces, dependencies, files)
   - task-refinement-log.md [NEW for FR-04]

3. plan-surfacer.cjs reads:
   - state.json -> active_workflow.current_phase
   - docs/isdlc/tasks.md (existence + optional format validation)

4. software-developer (05) reads:
   - docs/isdlc/tasks.md (mechanical mode: task-by-task)
   - state.json -> agent_modifiers (mechanical_mode flag)

5. 14 agent files read/write:
   - docs/isdlc/tasks.md (PLAN INTEGRATION PROTOCOL: [X]/[ ] toggle)
```

### Recommended Implementation Order

The following order minimizes rework and respects dependency chains:

| Order | Component | FR | Rationale |
|-------|-----------|-----|-----------|
| 1 | Enhanced tasks.md format schema (FR-06) | FR-06 | Foundation -- defines the format all other changes build on |
| 2 | Update ORCH-012 generate-plan skill (FR-01, FR-02, FR-03) | FR-01, FR-02, FR-03 | Core skill produces the enhanced output. Must know format before coding. |
| 3 | Update workflow-tasks-template.md | FR-01 | Template feeds into generate-plan; update format here |
| 4 | Update PLAN INTEGRATION PROTOCOL (FR-07) | FR-07 | All 14 agents need the protocol update before refinement/mechanical mode can rely on preserved annotations |
| 5 | Task refinement step (FR-04) | FR-04 | Orchestrator + isdlc.md changes. Depends on format + protocol being defined. |
| 6 | Mechanical execution mode (FR-05) | FR-05 | Software developer agent only. Can be implemented independently after format is settled. |
| 7 | Plan surfacer hook enhancement (FR-08) | FR-08 | Validation layer -- implement last since it validates what the others produce. |
| 8 | Update workflows.json (agent_modifiers) | FR-05 | Minimal config change to support mechanical_mode option. |

---

## Risk Assessment (M3)

### Test Coverage for Affected Modules

| File/Module | Existing Test Coverage | Test File | Risk |
|-------------|----------------------|-----------|------|
| `plan-surfacer.cjs` | 10 test cases, covers block/allow/fail-open | `plan-surfacer.test.cjs` | LOW -- well-tested, but no format validation tests yet |
| `generate-plan/SKILL.md` | No automated tests (skill is a markdown spec, executed by LLM) | None | MEDIUM -- skill correctness validated by output format, not unit tests |
| `05-software-developer.md` | No automated tests (agent spec) | None | MEDIUM -- mechanical mode is a new execution path with no test harness |
| `00-sdlc-orchestrator.md` | No automated tests (agent spec) | None | MEDIUM -- refinement step adds new orchestrator logic |
| `isdlc.md` | No automated tests (command spec) | None | LOW -- phase-loop changes are minimal |
| `workflow-tasks-template.md` | Indirectly tested via generate-plan output | None | LOW -- template changes are data, not logic |
| `workflows.json` | Validated by workflow-completion-enforcer hook | Various hook tests | LOW -- adding agent_modifiers, not phase changes |
| `common.cjs` (resolveTasksPath) | Tested via hook integration tests | `plan-surfacer.test.cjs` + others | LOW -- no changes needed to this function |
| `skills-manifest.json` | Tested by skill-validator hook tests | `skill-validator.test.cjs` | LOW -- metadata-only update if any |

### Complexity Hotspots

| Hotspot | Complexity | Why |
|---------|-----------|-----|
| ORCH-012 SKILL.md format spec | HIGH | Single file must coherently define: task ID generation, traceability tags, dependency annotations, file-level details, cycle detection, critical path, traceability matrix. Six new concepts in one skill. |
| Orchestrator refinement step (Section 3c) | MEDIUM-HIGH | Must read design artifacts (interface-spec, module-designs) and cross-reference with requirements to produce file-level tasks. Complex input → output transformation. |
| Mechanical execution mode | MEDIUM | New execution path in software-developer agent. Must handle: task ordering by dependencies, deviation detection, BLOCKED annotations, fallback to standard mode. |
| PLAN INTEGRATION PROTOCOL propagation | LOW (per file), MEDIUM (aggregate) | Same change replicated 14 times. Risk of inconsistency if not done systematically. |

### Technical Debt Markers

| Area | Debt | Impact on This Feature |
|------|------|----------------------|
| ORCH-002 task-decomposition skill | Stale references (Spec-Kit, BMAD, Ralph Wiggum) in Integration Points section. Overlapping scope with ORCH-012. | MEDIUM -- Must decide: merge task-decomposition into enhanced generate-plan, or keep separate with aligned format. Recommend merging concepts into ORCH-012. |
| Phase name mapping inconsistency | ORCH-012 maps `05-implementation` but workflows.json uses `06-implementation`. Orchestrator state uses `06-implementation`. Template uses `05-implementation`. | HIGH -- File-level tasks reference "Phase 06" or "Phase 05" inconsistently. Must standardize before adding file-level granularity. |
| workflow-tasks-template.md path | Quick scan references `.isdlc/templates/` but actual file is at `src/isdlc/templates/`. ORCH-012 references `.isdlc/templates/`. | LOW -- Path resolution already handled by runtime; just document correctly. |
| PLAN INTEGRATION PROTOCOL duplication | Identical block copy-pasted across 14 agent files. No single source of truth. | MEDIUM -- Any protocol update requires 14 identical edits. Consider extracting to a shared include reference, but this is out of scope (would be a refactor). |

### Risk Zones (Breaking Changes Intersection with Low Coverage)

| Risk Zone | Severity | Description | Mitigation |
|-----------|----------|-------------|------------|
| Format backward compatibility | HIGH | If the enhanced tasks.md format breaks existing `[X]`/`[ ]` parsing in any agent, all 14 agents fail. | AC-06g explicitly requires backward compatibility. Use sub-lines only (annotations below the checkbox line). Test with existing tasks.md format to verify no regression. |
| Phase key inconsistency | HIGH | `05-implementation` vs `06-implementation` confusion could cause refinement step to target wrong phase section. | Audit all phase key references before implementation. Standardize on `06-implementation` (matching workflows.json and state.json). |
| Refinement step timing | MEDIUM | If refinement runs at wrong point in phase-loop, tasks.md may be overwritten or missing design input. | Refinement must run AFTER GATE-04 passes, BEFORE Phase 05/06 starts. Add explicit guard in orchestrator. |
| Mechanical mode + existing hooks | MEDIUM | test-watcher hook monitors test executions. If mechanical mode changes iteration pattern, hook may misfire. | Verify test-watcher hook uses same signals regardless of execution mode. Mechanical mode still runs tests. |
| Cycle detection edge cases | LOW-MEDIUM | Dependency graph cycle detection must handle: self-references, cross-phase dependencies, disconnected subgraphs. | Implement standard topological sort with cycle detection. Document edge case handling in ORCH-012. |

### Recommended Test Additions BEFORE Implementation

| Test | Priority | Covers |
|------|----------|--------|
| plan-surfacer format validation tests | P0 | AC-08b, AC-08c: Add 3-4 tests for optional format validation (warn on missing file-level tasks, no block on missing annotations, pass when annotations present) |
| Backward compatibility snapshot test | P0 | AC-06g: Create a "legacy format" tasks.md fixture and verify all agents' PLAN INTEGRATION PROTOCOL patterns still match |
| Enhanced format parsing test | P1 | AC-06a-f: Create an "enhanced format" tasks.md fixture and verify pipe-delimited annotations, sub-lines, Dependency Graph section, Traceability Matrix section parse correctly |
| Cycle detection unit test | P1 | AC-03c: Test topological sort with valid DAG, cycle, self-reference, cross-phase dependencies |
| Traceability coverage test | P2 | AC-02d, AC-02e: Verify orphan detection (tasks without traces) and gap detection (requirements without tasks) |

---

## Implementation Recommendations

Based on the impact analysis:

1. **Suggested Implementation Order**:
   - Start with format schema definition (FR-06) as the foundation
   - Then enhance ORCH-012 (FR-01, FR-02, FR-03) -- the highest-impact single file
   - Propagate PLAN INTEGRATION PROTOCOL (FR-07) to 14 agents -- repetitive but critical
   - Add refinement step (FR-04) to orchestrator and isdlc.md
   - Add mechanical mode (FR-05) to software-developer agent
   - Enhance plan-surfacer hook (FR-08) last (validates everything else)

2. **High-Risk Areas (Add Tests First)**:
   - `plan-surfacer.cjs` -- add format validation tests before modifying hook (10 existing tests, add 4 more)
   - Create backward compatibility fixture test for tasks.md format before changing any format
   - Resolve phase key inconsistency (`05-implementation` vs `06-implementation`) before adding file-level task sections

3. **Dependencies to Resolve Before Starting**:
   - Phase key standardization: Audit and fix `05-implementation` vs `06-implementation` references in ORCH-012 SKILL.md and workflow-tasks-template.md
   - ORCH-002 task-decomposition relationship: Decide if concepts merge into ORCH-012 or remain separate. Recommend merging the dependency-graph and traceability concepts into ORCH-012 since generate-plan is the active skill.
   - Template path: Verify ORCH-012 correctly references `src/isdlc/templates/workflow-tasks-template.md` (not `.isdlc/templates/`)

4. **Key Architectural Decision Needed**:
   - **Refinement step trigger mechanism**: The refinement step (FR-04) must run between GATE-04 (Design) and Phase 05/06 (Implementation). Two options:
     - **Option A**: Orchestrator-level action in Section 3c, triggered by phase-loop controller after design phase completes (similar to plan generation in 3b after GATE-01)
     - **Option B**: Agent modifier on the implementation phase that triggers refinement at the start of Phase 06
   - Recommendation: **Option A** -- keeps refinement as an orchestrator concern, consistent with how plan generation works

---

## Comprehensive File List

### Primary Files (Direct Modification Required)

| # | File Path | Change Size | FRs Affected |
|---|-----------|------------|--------------|
| 1 | `src/claude/skills/orchestration/generate-plan/SKILL.md` | LARGE | FR-01, FR-02, FR-03, FR-06 |
| 2 | `src/claude/agents/05-software-developer.md` | LARGE | FR-05, FR-07 |
| 3 | `src/claude/agents/00-sdlc-orchestrator.md` | MEDIUM | FR-04 |
| 4 | `src/claude/commands/isdlc.md` | MEDIUM | FR-04 |
| 5 | `src/claude/hooks/plan-surfacer.cjs` | MEDIUM | FR-08 |
| 6 | `src/isdlc/templates/workflow-tasks-template.md` | MEDIUM | FR-01, FR-06 |

### Protocol Files (PLAN INTEGRATION PROTOCOL Update)

| # | File Path | Change Size | FRs Affected |
|---|-----------|------------|--------------|
| 7 | `src/claude/agents/01-requirements-analyst.md` | SMALL | FR-07 |
| 8 | `src/claude/agents/02-solution-architect.md` | SMALL | FR-07 |
| 9 | `src/claude/agents/03-system-designer.md` | SMALL | FR-07 |
| 10 | `src/claude/agents/04-test-design-engineer.md` | SMALL | FR-07 |
| 11 | `src/claude/agents/06-integration-tester.md` | SMALL | FR-07 |
| 12 | `src/claude/agents/07-qa-engineer.md` | SMALL | FR-07 |
| 13 | `src/claude/agents/08-security-compliance-auditor.md` | SMALL | FR-07 |
| 14 | `src/claude/agents/09-cicd-engineer.md` | SMALL | FR-07 |
| 15 | `src/claude/agents/10-dev-environment-engineer.md` | SMALL | FR-07 |
| 16 | `src/claude/agents/11-deployment-engineer-staging.md` | SMALL | FR-07 |
| 17 | `src/claude/agents/12-release-manager.md` | SMALL | FR-07 |
| 18 | `src/claude/agents/13-site-reliability-engineer.md` | SMALL | FR-07 |
| 19 | `src/claude/agents/14-upgrade-engineer.md` | SMALL | FR-07 |

### Config and Test Files

| # | File Path | Change Size | FRs Affected |
|---|-----------|------------|--------------|
| 20 | `src/isdlc/config/workflows.json` | SMALL | FR-05 |
| 21 | `src/claude/hooks/tests/plan-surfacer.test.cjs` | MEDIUM | FR-08 |
| 22 | `src/claude/skills/orchestration/task-decomposition/SKILL.md` | SMALL | FR-02, FR-03 (alignment) |
| 23 | `src/claude/hooks/config/skills-manifest.json` | SMALL (if needed) | Metadata update |

### Files NOT Modified (Verified No Impact)

| File | Reason |
|------|--------|
| `src/claude/agents/16-quality-loop-engineer.md` | No PLAN INTEGRATION PROTOCOL, no tasks.md interaction |
| `src/claude/agents/discover-orchestrator.md` | Pre-workflow agent, no tasks.md interaction |
| `src/claude/hooks/lib/common.cjs` | resolveTasksPath() unchanged; format validation logic goes in plan-surfacer.cjs |
| All other hooks (26 total) | No interaction with tasks.md format; plan-surfacer is the only plan-related hook |
| `.isdlc/state.json` schema | No schema changes needed; mechanical_mode comes via agent_modifiers in workflows.json |

---

## Impact Analysis Metadata

```json
{
  "analysis_completed_at": "2026-02-11T23:00:00Z",
  "sub_agents": ["M1-impact-analyzer", "M2-entry-point-finder", "M3-risk-assessor"],
  "requirements_document": "docs/requirements/REQ-0009-enhanced-plan-to-tasks/requirements-spec.md",
  "quick_scan_used": "docs/requirements/REQ-0009-enhanced-plan-to-tasks/quick-scan.md",
  "scope_change_from_original": "expanded",
  "requirements_keywords": ["tasks.md", "generate-plan", "ORCH-012", "PLAN INTEGRATION PROTOCOL", "traceability", "dependency", "file-level", "mechanical", "refinement", "backward-compatible", "cycle-detection", "critical-path"],
  "total_files_affected": 23,
  "primary_files": 6,
  "protocol_files": 13,
  "config_test_files": 4,
  "acceptance_criteria_analyzed": 38,
  "functional_requirements_analyzed": 8
}
```
