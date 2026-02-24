# Quick Scan: REQ-0009 Enhanced Plan-to-Tasks Pipeline

**Scanned**: 2026-02-11T20:00:00Z
**Feature**: Enhanced plan-to-tasks pipeline — make tasks.md the implementation authority

---

## Scope Estimate

| Dimension | Estimate | Notes |
|-----------|----------|-------|
| Blast radius | MEDIUM | Touches orchestrator, generate-plan skill, software-developer agent, command file, hooks |
| Files affected | 8-15 | Core skill (ORCH-012), agent definitions, hooks, templates, state schema |
| Complexity | MEDIUM | Schema evolution for tasks.md + new refinement step + execution mode flag |
| Risk | LOW-MEDIUM | Additive changes mostly; backward compatible if tasks.md format is extended not replaced |

## Keyword Matches

| Keyword | Files Found | Key Locations |
|---------|-------------|---------------|
| `tasks.md` | 23 | All agents (PLAN INTEGRATION PROTOCOL), generate-plan SKILL.md, plan-surfacer.cjs |
| `generate-plan` / `ORCH-012` | 22 | Orchestrator, isdlc.md command, skills-manifest |
| `task-decomposition` / `ORCH-002` | 2 | Orchestrator, skill definition |
| `PLAN INTEGRATION` | 17 | All phase agents (shared protocol) |
| `traceability` | 8+ | Requirements skills, reverse-engineer skills, testing skills |
| `dependency` | 6+ | Requirements skills, impact-analysis skills |

## Primary Files to Modify

1. **`src/claude/skills/orchestration/generate-plan/SKILL.md`** — Core skill to enhance with file-level granularity, traceability tags, dependency graph
2. **`src/claude/agents/05-software-developer.md`** — Add mechanical execution mode, consume enhanced tasks.md
3. **`src/claude/agents/00-sdlc-orchestrator.md`** — Add task refinement step between design and implementation
4. **`src/claude/commands/isdlc.md`** — Update phase-loop controller for new refinement step
5. **`.isdlc/templates/workflow-tasks-template.md`** — Create/update template with new task format
6. **`src/claude/hooks/plan-surfacer.cjs`** — Potentially update to validate enhanced format
7. **`src/claude/skills/orchestration/task-decomposition/SKILL.md`** — Integrate with generate-plan enhancement
8. **`.isdlc/config/workflows.json`** — May need new phase or modifier for refinement step

## Secondary Files (Documentation/Config)

9. **`src/claude/hooks/config/skills-manifest.json`** — Update skill metadata if ORCH-012 changes scope
10. **All phase agent files** — PLAN INTEGRATION PROTOCOL section may need updates for new format

## Existing Infrastructure

- **Plan Surfacer Hook**: Already enforces that tasks.md exists before implementation phases
- **PLAN INTEGRATION PROTOCOL**: Standardized across all 17 agents — update propagates to all
- **Task IDs**: Sequential TNNNN format already in place
- **Progress tracking**: Checkbox-based `[X]`/`[ ]` already working
- **Template system**: `.isdlc/templates/workflow-tasks-template.md` referenced but may not exist yet

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Breaking existing tasks.md format | MEDIUM | Extend format additively (new columns/tags), keep `[X]`/`[ ]` checkboxes |
| Agent protocol update propagation | LOW | PLAN INTEGRATION PROTOCOL is identical across agents; update once in shared section |
| Refinement step adds latency | LOW | Keep refinement lightweight — file-level decomposition from design artifacts |
| Mechanical mode bypasses agent judgment | MEDIUM | Make it opt-in flag, not default; agent retains override ability for edge cases |

## Recommendation

Proceed with full feature workflow. Estimated 5 sub-features map well to the existing architecture. The generate-plan skill (ORCH-012) is the natural anchor point for enhancements.
