# Architecture Overview: Post-finalize validation hook

**Slug**: REQ-GH-219-post-finalize-validation-hook
**Created**: 2026-04-03

---

## 1. Architecture Options

### Option A: Extend task-reader + new core runner (Selected)

- **Summary**: Reuse `task-reader.js` to parse `finalize-steps.md` in the same tasks.md format. New `finalize-runner.js` in `src/core/finalize/` reuses #220 retry pattern from `task-dispatcher.js`. Phase-Loop Controller calls the runner directly.
- **Pros**: Consistent with existing task infrastructure, no new parsing code, user-editable markdown, provider-neutral
- **Cons**: Extends task-reader with new metadata fields (minor complexity)
- **Pattern alignment**: Follows #220 pattern exactly
- **Verdict**: Selected

### Option B: Embed finalize steps in workflows.json as JSON

- **Summary**: Define finalize steps as a JSON array inside `workflows.json`
- **Pros**: Single config file for workflow definitions
- **Cons**: Inconsistent with tasks.md format, less hackable, breaks user expectation of markdown editability
- **Pattern alignment**: Breaks the tasks.md convention established by #220
- **Verdict**: Eliminated -- contradicts format consistency and hackability requirements

## 2. Selected Architecture

### ADR-001: Config-driven finalize checklist with tasks.md format

- **Status**: Accepted
- **Context**: Finalization steps are silently skipped when the orchestrator agent returns early during STEP 4. Need per-step tracking with retry. Same root cause as #220 (agent early return).
- **Decision**: Config-driven finalize checklist using tasks.md format, executed by a core runner that reuses #220's dispatch/retry pattern. Finalization pulled out of orchestrator delegation and into the Phase-Loop Controller.
- **Rationale**: Consistent with existing task infrastructure (#220), no new parsing code, user-editable markdown, provider-neutral. Eliminates the orchestrator as a single point of failure for finalization.
- **Consequences**: STEP 4 in `isdlc.md` changes from orchestrator delegation to direct runner invocation. `workflow-finalize.cjs` logic migrates to `src/core/finalize/`. Existing `workflow-completion-enforcer.cjs` continues to handle history entry quality (separate concern).

## 3. Technology Decisions

| Technology | Version | Rationale | Alternatives Considered |
|-----------|---------|-----------|------------------------|
| task-reader.js (extended) | Existing | Reuse #220 parser, add metadata annotations | New parser -- rejected (NFR-004) |
| task-dispatcher.js retry pattern | Existing | Reuse #220 retry loop | Custom retry logic -- rejected (NFR-004) |
| No new dependencies | -- | Zero new packages needed | -- |

## 4. Integration Architecture

### Integration Points

| ID | Source | Target | Interface | Data Format | Error Handling |
|----|--------|--------|-----------|-------------|----------------|
| INT-001 | Phase-Loop Controller (STEP 4) | finalize-runner.js | Function call | Parsed task list + project context | Escalate on critical failure |
| INT-002 | finalize-runner.js | task-reader.js | Import | tasks.md parsed structure | Fall back to default if parse fails |
| INT-003 | finalize-runner.js | finalize-utils.js | Import | Function calls (merge, cleanup, sync) | Per-step retry + fail-open |
| INT-004 | finalize-runner.js | Shell / MCP | Per-step execution | Command strings | Per-step retry + fail-open |
| INT-005 | init-project.sh | .isdlc/config/finalize-steps.md | File copy | Default template | Warn if copy fails |
| INT-006 | updater.js | .isdlc/config/finalize-steps.md | Preserve check | Skip if exists | No action needed |

### Data Flow

1. Phase-Loop Controller completes all phases and renders STEP 3-dashboard
2. Controller reads `.isdlc/config/finalize-steps.md` (falls back to default)
3. Passes to `task-reader.js` for parsing
4. `finalize-runner.js` iterates steps, respecting `blocked_by` dependencies
5. Each step: execute → check result → retry if failed → record outcome
6. Runner returns structured result with per-step status
7. Controller displays per-step progress to user
8. On all steps complete (or critical failure escalated): workflow ends

## 5. Summary

| Metric | Value |
|--------|-------|
| New files | 3 (finalize-runner.js, finalize-utils.js, finalize-steps.default.md) |
| Modified files | 5 (task-reader.js, isdlc.md, workflow-finalize.cjs, init-project.sh, updater.js) |
| Documentation files | 2 (README.md, CLAUDE.md) |
| Config files | 1 (.isdlc/config/finalize-steps.md) |
| New dependencies | 0 |
| Risk level | Low-Medium |
