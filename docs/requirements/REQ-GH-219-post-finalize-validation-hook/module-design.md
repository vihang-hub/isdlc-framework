# Module Design: Post-finalize validation hook

**Slug**: REQ-GH-219-post-finalize-validation-hook
**Created**: 2026-04-03

---

## Module Overview

| Module | Location | Responsibility |
|--------|----------|---------------|
| finalize-runner.js | src/core/finalize/ (CREATE) | Core runner: reads checklist, executes steps, tracks results, retries failures |
| finalize-utils.js | src/core/finalize/ (CREATE) | Extracted common finalize functions: merge, state cleanup, external sync |
| finalize-steps.default.md | src/core/finalize/ (CREATE) | Default finalize checklist template |
| task-reader.js | src/core/tasks/ (MODIFY) | Extended metadata parsing for critical, fail_open, max_retries, type |

## Module Design

### finalize-runner.js

**Responsibility**: Read the finalize checklist, execute steps sequentially respecting dependencies, track per-step results, retry failures using #220 pattern.

**Public interface**:
- `runFinalizeChecklist(projectRoot, options)` → `{ steps: [{ id, name, status, retries, error? }], summary: { total, passed, failed, skipped } }`
  - `options.configPath` -- override config file path (default: `.isdlc/config/finalize-steps.md`)
  - `options.defaultPath` -- fallback default template path
  - `options.provider` -- current provider name (for filtering `type: provider` steps)
  - `options.context` -- workflow context (branch name, workflow type, artifact folder)
  - `options.onStepComplete(step, result)` -- callback for per-step progress display

**Internal functions**:
- `executeStep(step, context)` -- runs a single step based on `type`:
  - `shell` -- `child_process.execSync(step.command, { cwd: projectRoot, timeout: 30000 })`
  - `internal` -- calls named function from finalize-utils.js via a registry map
  - `mcp` -- returns `{ status: 'skipped', reason: 'mcp-steps-handled-by-controller' }` (MCP calls are provider-specific, handled by the Phase-Loop Controller outside the runner)
  - `provider` -- skipped if `options.provider` doesn't match; executed otherwise
- `shouldRetry(step, attempt, maxRetries)` -- checks attempt < maxRetries from step metadata
- `handleFailure(step, error)` -- if `critical: true` and `fail_open: false`: returns escalation result. Otherwise: logs warning, returns continue result

**Dependencies**: task-reader.js, finalize-utils.js, child_process, fs, path

### finalize-utils.js

**Responsibility**: Provider-neutral finalize operations extracted from workflow-finalize.cjs.

**Public interface**:
- `mergeBranch(branch, projectRoot)` → `{ success, message, error? }`
  - git checkout main, git merge --no-ff {branch}, git branch -d {branch}
- `moveWorkflowToHistory(state)` → `state` (mutated)
  - Calls collectPhaseSnapshots, pushes to workflow_history with phases, snapshots, metrics
- `clearTransientFields(state)` → `state` (mutated)
  - Nulls active_workflow, current_phase, active_agent, clears phases object
- `syncExternalStatus(state, projectRoot)` → `{ github?, jira?, backlog? }`
  - GitHub: `gh issue close N`
  - Jira: transition to Done (via MCP or skipped)
  - BACKLOG.md: mark `[x]`, move to Completed section
- `rebuildSessionCache(projectRoot)` → `{ success, error? }`
  - `node bin/rebuild-cache.js`
- `regenerateContracts(projectRoot)` → `{ success, error? }`
  - `node bin/generate-contracts.js` + `node bin/generate-contracts.js --output .isdlc/config/contracts`
- `rebuildMemoryEmbeddings(projectRoot)` → `{ success, error? }`
  - Runs embedding rebuild for user and project memory indexes

**Dependencies**: child_process, fs, path, common.cjs (for readState, writeState, collectPhaseSnapshots)

### task-reader.js extension

**Change**: Extend pipe annotation parsing to support arbitrary `key: value` metadata.

**Current behavior**: Parses `| traces: FR-001, AC-001-01` into `task.traces[]`

**New behavior**: Parses all `key: value` pairs after `|` into `task.metadata`:
```
| traces: FR-001, critical: true, fail_open: false, max_retries: 1, type: shell
→ task.traces = ["FR-001"]
→ task.metadata = { critical: true, fail_open: false, max_retries: 1, type: "shell" }
```

- Boolean values: `true`/`false` strings parsed to booleans
- Numeric values: digit-only strings parsed to numbers
- `traces` key continues to populate both `task.traces[]` and `task.metadata.traces` for backward compatibility
- If no metadata keys beyond traces: `task.metadata = {}` (empty object, never undefined)

### finalize-steps.default.md

**Format**: Standard tasks.md syntax per task-reader.js parser.

```markdown
# Finalize Steps

## Phase FN: Finalize -- PENDING

- [ ] F0001 Merge feature branch to main | critical: true, fail_open: false, max_retries: 1, type: internal
- [ ] F0002 Sync external status (GitHub/Jira/BACKLOG) | critical: false, fail_open: true, max_retries: 1, type: internal
- [ ] F0003 Move workflow to history and clear state | critical: true, fail_open: false, max_retries: 1, type: internal
  blocked_by: [F0001]
- [ ] F0004 Clean up session tasks | critical: false, fail_open: true, max_retries: 0, type: provider
  blocked_by: [F0003]
- [ ] F0005 Rebuild session cache | critical: false, fail_open: true, max_retries: 1, type: shell
  blocked_by: [F0003]
- [ ] F0006 Regenerate contracts | critical: false, fail_open: true, max_retries: 1, type: shell
  blocked_by: [F0003]
- [ ] F0007 Refresh code index | critical: false, fail_open: true, max_retries: 1, type: mcp
  blocked_by: [F0003]
- [ ] F0008 Rebuild memory embeddings | critical: false, fail_open: true, max_retries: 1, type: shell
  blocked_by: [F0003]
- [ ] F0009 Refresh code embeddings | critical: false, fail_open: true, max_retries: 1, type: shell
  blocked_by: [F0003]
```

Inline comments in the shipped template explain each step and how to customize.

## Changes to Existing Modules

- **isdlc.md STEP 4**: Replace orchestrator delegation + inline INDEX REFRESH with call to finalize-runner (or inline equivalent for prompt-based execution)
- **workflow-finalize.cjs**: Refactor to thin wrapper calling finalize-utils.js functions
- **init-project.sh**: Add copy of finalize-steps.default.md to .isdlc/config/finalize-steps.md
- **lib/updater.js**: Add finalize-steps.md to preserve-list
- **README.md**: Add Configuration section listing .isdlc/config/ files
- **CLAUDE.md**: Add finalize-steps.md to Key Files section

## Wiring Summary

1. Phase-Loop Controller completes STEP 3-dashboard
2. Reads .isdlc/config/finalize-steps.md (falls back to src/core/finalize/finalize-steps.default.md)
3. Parses via task-reader.js (with extended metadata)
4. Calls finalize-runner.js with parsed steps and workflow context
5. Runner iterates steps respecting blocked_by order, executes each, retries on failure
6. Per-step status displayed to user via onStepComplete callback
7. Runner returns structured result; controller logs and exits
