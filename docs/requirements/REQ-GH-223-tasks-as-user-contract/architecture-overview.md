# Architecture Overview: Tasks as User Contract

**Item**: REQ-GH-223
**Status**: Accepted

---

## 1. Architecture Options

### Task Validation Placement

| Option | Approach | Pros | Cons | Verdict |
|--------|----------|------|------|---------|
| A | Standalone core module `src/core/tasks/task-validator.js` called inline before PRESENTING_TASKS | Single responsibility, testable, reusable by traceability enforcement hook | One more module | **Selected** |
| B | Embedded in generate-plan skill | Co-located with generation | Mixes concerns, not reusable | Eliminated |

### Sub-Task ID Format

| Option | Approach | Pros | Cons | Verdict |
|--------|----------|------|------|---------|
| A | Dot notation `T005.1, T005.2` | Parent visible in ID | Breaks `T\d{4}` regex across codebase | Eliminated |
| B | Sequential `T0050` with `parent:` sub-line | No regex changes | Parent not in ID, extra syntax | Eliminated |
| C | Suffix letter `T005A, T005B` with 3-digit parents | Parent encoded in ID, single regex `T\d{3}[A-Z]?`, no extra sub-line needed | 26 sub-task limit per parent | **Selected** |

### Traceability Template Format

| Option | Approach | Pros | Cons | Verdict |
|--------|----------|------|------|---------|
| A | JSON template defining column structure | Consistent with existing templates, machine-parseable | Less flexible | **Selected** |
| B | Markdown snippet template | More readable | Harder to enforce consistency | Eliminated |

## 2. Selected Architecture (ADRs)

### ADR-001: Task Validator as Core Module
- **Status**: Accepted
- **Context**: Task coverage must be validated before PRESENTING_TASKS and at build-phase gates
- **Decision**: Create `src/core/tasks/task-validator.js` as a standalone, provider-neutral module
- **Rationale**: Reusable by both the roundtable (analysis-time) and the traceability enforcement hook (build-time). Testable in isolation.
- **Consequences**: New module in `src/core/tasks/`. Both providers can use it.

### ADR-002: TNNN/TNNNABC ID Scheme
- **Status**: Accepted
- **Context**: Sub-tasks need parent linkage without breaking existing parsers
- **Decision**: Parents use `TNNN` (3-digit), sub-tasks append a letter suffix `TNNNABC`. Parent derivation is regex-based (strip suffix letter). Format version bumped to v3.0.
- **Rationale**: Parent encoded in the ID itself — no separate `parent:` sub-line needed. Single regex `T\d{3}[A-Z]?` handles both. 26 sub-tasks per parent is sufficient.
- **Consequences**: task-reader regex changes from `T\d{4}` to `T\d{3}[A-Z]?`. All existing task ID references in hooks, dispatchers, and agents must be updated.

### ADR-003: Remove 3e-plan Entirely
- **Status**: Accepted
- **Context**: Tasks are now generated once during analysis. No legacy items exist without tasks.md.
- **Decision**: Remove the `3e-plan` step from the Phase-Loop Controller. BUILD-INIT COPY is the sole mechanism — if tasks.md doesn't exist in the artifact folder, build fails with an error.
- **Rationale**: No backward compatibility needed. Single generation eliminates redundancy.
- **Consequences**: `3e-plan` section removed from isdlc.md. ORCH-012 skill remains available for analysis-time generation but is never called at build start.

### ADR-004: Sub-Task Display Config in .isdlc/config/config.json
- **Status**: Accepted
- **Context**: Sub-task visibility in Claude Task tool should be user-configurable
- **Decision**: `show_subtasks_in_ui` setting in `.isdlc/config/config.json` (not workflows.json)
- **Rationale**: This is a presentation preference, not a workflow definition. Config.json is user-editable and project-scoped.
- **Consequences**: New config file. One-time hint message on first sub-task creation.

## 3. Technology Decisions

| Technology | Version | Rationale | Alternatives |
|-----------|---------|-----------|--------------|
| No new dependencies | N/A | All changes use existing Node.js fs/path and task-reader/task-dispatcher patterns | N/A |
| `.isdlc/config/config.json` | New file | User-facing config for display preferences | workflows.json (rejected — wrong concern), settings.local.json (rejected — gitignored) |
| `traceability.template.json` | New file | Joins existing template family in `src/claude/hooks/config/templates/` | Markdown template (rejected — harder to enforce consistency) |

## 4. Integration Architecture

| ID | Source | Target | Interface | Data | Error Handling |
|----|--------|--------|-----------|------|----------------|
| INT-001 | Roundtable (PRESENTING_TASKS) | task-validator.js | Function call | `validateTaskCoverage(plan, reqContent, iaContent)` → coverage result | Re-run generation on gaps |
| INT-002 | Build start (STEP 2) | task-reader.js | Function call | `readTaskPlan()` → hydrate TaskCreate | Error if tasks.md missing |
| INT-003 | Phase agents (04, 05, 16) | task-dispatcher.js | Function call | `addSubTask(path, parentId, desc, meta)` → new task ID | Log and skip on failure |
| INT-004 | Phase agents | task-dispatcher.js | Function call | `markTaskComplete(path, taskId)` → parent auto-complete | Standard error handling |
| INT-005 | Gate blocker | task-validator.js | Function call | `validateTaskCoverage()` at gate | Block on uncovered items |
| INT-006 | All confirmations | traceability.template.json | Template read | Render ID + description per domain | Fall back to ID-only |

## 5. Risk Zones

| ID | Risk | Area | Likelihood | Impact | Mitigation |
|----|------|------|------------|--------|------------|
| R-001 | task-reader regex change breaks existing parsers | task-reader.js, plan-surfacer.cjs, task-dispatcher.js | Medium | High | 48 existing tests + new format tests |
| R-002 | Claude Task tool has no native parent-child hierarchy | Phase-Loop Controller | Low | Medium | Naming convention encodes parent in ID |
| R-003 | Sub-task creation slows phase agent execution | task-dispatcher.js | Low | Medium | NFR-002: <500ms target |
