# Impact Analysis: REQ-0010 -- Blast Radius Coverage Validation

**Generated**: 2026-02-12
**Feature**: New CJS hook that cross-references impact-analysis.md affected files against git diff, generates blast-radius-coverage.md, and adds GATE-06 validation
**Based On**: Phase 01 Requirements (finalized -- 7 requirements, 32 AC, 5 NFRs, 5 constraints)
**Phase**: 02-impact-analysis

---

## Scope Comparison

| Aspect | Original (Workflow Init) | Clarified (Phase 01) |
|--------|--------------------------|----------------------|
| Description | Pre-gate hook or gate check at GATE-05 that cross-references affected files from impact-analysis.md against git diff | 7 functional requirements: CJS hook with `check(ctx)` contract, `shouldActivate` guard for Phase 06 only, fail-open design, markdown table parser, dispatcher integration, GATE-06 validation |
| Keywords | blast radius, gate, hook, coverage, git diff, impact-analysis.md | blast-radius-validator, CJS, check(ctx), shouldActivate, fail-open, markdown table parser, backtick paths, deduplication, NO CHANGE exclusion, dispatcher, GATE-06, feature-workflow-only |
| Estimated Files | ~5 (hook, agent, gate, tests) | 8-12 (1 new hook, 1 agent mod, 1 dispatcher mod, 1 config mod, 1 test file, optional: settings.json sync) |
| Scope Change | -- | REFINED (GATE-05 corrected to GATE-06, parser details specified, constraints added: CJS-only, no new deps, feature workflow only) |

---

## Executive Summary

This feature introduces a new enforcement hook (`blast-radius-validator.cjs`) that closes the gap between Phase 02 impact analysis and Phase 06 implementation. The blast radius is **MEDIUM** -- 8-12 files across 4 module areas (hooks, dispatchers, agents, config). The core deliverable is a single new CJS hook file (~200-300 lines) that parses markdown tables, runs git diff, and compares results. Integration requires additive modifications to the pre-task dispatcher (1 new import + 1 HOOKS array entry), the software-developer agent (new pre-implementation section), and optionally the iteration-requirements config (new `blast_radius_validation` check type). Risk is LOW-MEDIUM: the hook follows well-established patterns (gate-blocker.cjs, test-watcher.cjs) and the fail-open design (Article X) prevents the hook from ever blocking legitimate work due to its own errors.

**Blast Radius**: MEDIUM (8-12 files, 4 modules)
**Risk Level**: LOW-MEDIUM
**Affected Files**: 8-12 files across hooks, dispatchers, agents, config, tests
**Affected Modules**: hooks (core), dispatchers (integration), agents (consumer), config (registration)

---

## Impact Analysis (M1)

### Files Directly Affected by Each Requirement

#### REQ-001: Blast Radius Validator Hook

| File | Change Type | Change Description |
|------|-------------|-------------------|
| `src/claude/hooks/blast-radius-validator.cjs` | CREATE | New CJS hook file (~200-300 lines). Exports `check(ctx)` and `shouldActivate(ctx)`. Parses impact-analysis.md, runs git diff, compares coverage. Returns `{ decision, stopReason?, stderr?, stateModified? }` per standard hook contract. |

#### REQ-002: Graceful Degradation

| File | Change Type | Change Description |
|------|-------------|-------------------|
| `src/claude/hooks/blast-radius-validator.cjs` | CREATE | (same file as REQ-001) Includes fail-open paths for: missing impact-analysis.md, empty tables, no active_workflow, malformed markdown, git command failures. All return `decision: "allow"`. |

#### REQ-003: Blast Radius Coverage Checklist Generation

| File | Change Type | Change Description |
|------|-------------|-------------------|
| `src/claude/agents/05-software-developer.md` | MODIFY | Add new section "Blast Radius Coverage" that instructs the agent to generate blast-radius-coverage.md after implementation. ~30-50 lines of markdown instructions. |

#### REQ-004: Software Developer Agent Integration

| File | Change Type | Change Description |
|------|-------------|-------------------|
| `src/claude/agents/05-software-developer.md` | MODIFY | Add pre-implementation step that reads impact-analysis.md and creates a "Blast Radius Acknowledgement" section in the implementation plan. ~20-30 lines of markdown instructions (additive, no existing sections modified). |

#### REQ-005: GATE-06 Validation Update

| File | Change Type | Change Description |
|------|-------------|-------------------|
| `src/claude/hooks/blast-radius-validator.cjs` | CREATE | (same file) The hook IS the GATE-06 validation -- it blocks gate advancement when unaddressed files exist. |
| `src/claude/hooks/gate-blocker.cjs` | NO CHANGE | Gate-blocker itself does NOT need modification. The blast-radius-validator runs as a separate hook in the pre-task dispatcher, before gate-blocker. Gate-blocker checks iteration requirements (test iteration, constitutional validation, etc.) -- blast radius is a separate concern. |

#### REQ-006: Impact Analysis File Path Extraction

| File | Change Type | Change Description |
|------|-------------|-------------------|
| `src/claude/hooks/blast-radius-validator.cjs` | CREATE | (same file) Contains `parseImpactAnalysis(content)` function that extracts backtick-wrapped file paths from markdown tables, handles multiple sections, deduplicates, extracts Change Type, and excludes NO CHANGE entries. |

#### REQ-007: Hook Integration with Dispatcher Architecture

| File | Change Type | Change Description |
|------|-------------|-------------------|
| `src/claude/hooks/dispatchers/pre-task-dispatcher.cjs` | MODIFY | Add 1 new `require()` import for blast-radius-validator.cjs. Add 1 new entry to the HOOKS array with `shouldActivate` guard that checks for active workflow, Phase 06, and gate advancement attempt. ~5-8 lines changed. |

### Secondary Files (Registration and Config)

| File | Change Type | Change Description |
|------|-------------|-------------------|
| `src/claude/hooks/config/iteration-requirements.json` | MODIFY | Add `blast_radius_validation` field to `06-implementation` phase requirements (optional -- depends on architecture decision whether validation is done as a standalone hook or as a gate-blocker check type). ~5-10 lines. |
| `src/claude/hooks/tests/test-blast-radius-validator.test.cjs` | CREATE | New CJS test file (~300-500 lines) following existing patterns from test-gate-blocker-extended.test.cjs. Uses hook-test-utils.cjs (setupTestEnv, runHook, writeState, etc.). |

### Outward Dependencies (What Depends on Changed Files)

| Changed File | Dependents | Impact |
|-------------|------------|--------|
| `blast-radius-validator.cjs` (NEW) | `pre-task-dispatcher.cjs` (imports it) | Dispatcher gains a new hook in its HOOKS array. Fail-open design ensures dispatcher is not impacted by hook errors. |
| `pre-task-dispatcher.cjs` | `settings.json` (registered hook command) | settings.json does NOT need modification -- the dispatcher is already registered. The new hook is internal to the dispatcher. |
| `05-software-developer.md` | All future feature workflows (Phase 06 agent instructions) | Agent will now read impact-analysis.md and generate blast-radius-coverage.md. Additive-only -- existing TDD workflow, iteration enforcement, and test sections are NOT modified. |
| `iteration-requirements.json` | `gate-blocker.cjs` (loads this config), all dispatchers | If blast_radius_validation is added as a new check type, gate-blocker would need a new `checkBlastRadiusRequirement()` function. ALTERNATIVE: keep it as a standalone hook in the dispatcher (simpler, no gate-blocker changes). |

### Inward Dependencies (What Changed Files Depend On)

| Changed File | Dependencies | Impact |
|-------------|-------------|--------|
| `blast-radius-validator.cjs` | `./lib/common.cjs` (readState, getProjectRoot, debugLog, getTimestamp) | Uses existing common utilities -- no changes to common.cjs needed. |
| `blast-radius-validator.cjs` | `fs`, `path`, `child_process` (Node.js builtins) | Standard CJS builtins, no new npm deps. |
| `blast-radius-validator.cjs` | `impact-analysis.md` (runtime artifact) | Reads this file at runtime. Parser must handle the existing markdown table format from impact-analysis-orchestrator. |
| `blast-radius-validator.cjs` | `blast-radius-coverage.md` (runtime artifact) | Reads this file for deferred file rationales. Generated by software-developer agent. |
| `blast-radius-validator.cjs` | `git diff --name-only main...HEAD` (git command) | Executes git command at runtime. Must handle: not a git repo, no main branch, merge-base errors. |

### Change Propagation

The change propagation is **contained and well-bounded**:

1. `blast-radius-validator.cjs` (NEW) -- self-contained hook, follows existing patterns
2. `pre-task-dispatcher.cjs` -- 1 new import + 1 HOOKS array entry (additive)
3. `05-software-developer.md` -- new sections (additive, no existing content modified)
4. `iteration-requirements.json` -- optional new field in `06-implementation` (additive)
5. No cascading import chain changes
6. No runtime behavior changes to existing hooks
7. `settings.json` does NOT need modification (dispatcher already registered)

---

## Entry Points (M2)

### Existing Entry Points Relevant to This Feature

| Entry Point | Type | Relevance | Change Needed |
|-------------|------|-----------|---------------|
| `pre-task-dispatcher.cjs` HOOKS array | Hook dispatcher | The main integration point -- all PreToolUse[Task] hooks run through this dispatcher | Add blast-radius-validator as a new entry |
| `gate-blocker.cjs` `check()` | Gate validation | Checks iteration requirements for gate advancement | NO CHANGE needed -- blast-radius-validator is a separate hook that short-circuits BEFORE gate-blocker in the dispatcher |
| `05-software-developer.md` Pre-Phase Check | Agent instructions | Where the agent reads state.json and test infrastructure before implementing | Add new "Blast Radius Coverage" section after existing Pre-Phase Check |
| `impact-analysis.md` | Runtime artifact | Generated by Phase 02, consumed by the new hook at Phase 06 gate check | NO CHANGE -- consumer only |
| `blast-radius-coverage.md` | Runtime artifact (new) | Generated by software-developer agent, consumed by the new hook | NEW artifact type |
| `git diff --name-only main...HEAD` | Git command | Used by test-watcher.cjs pattern; the new hook uses the same approach | Reuse pattern from existing hooks |

### New Entry Points That Need to Be Created

| Entry Point | Type | Description |
|-------------|------|-------------|
| `blast-radius-validator.cjs` `check(ctx)` | Hook function | Main entry point for the dispatcher. Receives `{ input, state, manifest, requirements, workflows }`, returns `{ decision, stopReason?, stderr?, stateModified? }`. |
| `blast-radius-validator.cjs` `shouldActivate(ctx)` | Guard function | Returns `true` only when: (a) active workflow exists AND is feature type, (b) current phase is `06-implementation`, (c) the tool call is a gate advancement attempt. |
| `parseImpactAnalysis(content)` | Internal function | Parses impact-analysis.md markdown content, extracts file paths from tables, deduplicates, returns `[{ filePath, changeType }]`. |
| `parseBlastRadiusCoverage(content)` | Internal function | Parses blast-radius-coverage.md to find deferred files with rationales. Returns `Map<filePath, { status, notes }>`. |

### Implementation Chain

```
pre-task-dispatcher.cjs
  |-- requires blast-radius-validator.cjs
        |-- shouldActivate(ctx)
        |     |-- checks state.active_workflow exists
        |     |-- checks active_workflow.type === 'feature'
        |     |-- checks current_phase === '06-implementation'
        |     |-- checks isGateAdvancementAttempt(input)
        |
        |-- check(ctx)
              |-- reads impact-analysis.md from artifact folder
              |     |-- parseImpactAnalysis(content)
              |           |-- regex: markdown table rows with backtick paths
              |           |-- deduplicates across sections
              |           |-- excludes NO CHANGE entries
              |
              |-- runs git diff --name-only main...HEAD
              |     |-- child_process.execSync()
              |     |-- returns Set of modified file paths
              |
              |-- reads blast-radius-coverage.md (if exists)
              |     |-- parseBlastRadiusCoverage(content)
              |     |-- extracts deferred files with rationale
              |
              |-- compares: affected files vs (modified + deferred)
              |     |-- covered = in git diff
              |     |-- deferred = in blast-radius-coverage.md with rationale
              |     |-- unaddressed = neither
              |
              |-- if unaddressed.length > 0 -> { decision: 'block', stopReason: list }
              |-- else -> { decision: 'allow' }
```

### Recommended Implementation Order

1. **`blast-radius-validator.cjs`** -- Core hook file with `parseImpactAnalysis()`, `parseBlastRadiusCoverage()`, `shouldActivate()`, `check()` (REQ-001, REQ-002, REQ-005, REQ-006, REQ-007)
2. **`test-blast-radius-validator.test.cjs`** -- TDD: write tests first for all parsing, validation, and fail-open paths (NFR-004)
3. **`pre-task-dispatcher.cjs`** -- Add import and HOOKS array entry (REQ-007)
4. **`05-software-developer.md`** -- Add blast radius acknowledgement and checklist generation sections (REQ-003, REQ-004)
5. **`iteration-requirements.json`** -- Optional: add blast_radius_validation config (REQ-005)
6. **Runtime sync** -- Sync changed files from `src/claude/` to `.claude/` (standard iSDLC process)

Rationale: Start with the core hook and its tests (TDD), then integrate with the dispatcher, then update the agent instructions. Config changes last since they are optional and depend on architecture decisions.

---

## Risk Assessment (M3)

### Test Coverage in Affected Areas

| Affected File | Direct Tests | Coverage Status | Risk |
|---------------|-------------|-----------------|------|
| `blast-radius-validator.cjs` (NEW) | `test-blast-radius-validator.test.cjs` (NEW) | WILL BE CREATED -- target >=80% per NFR-004 | LOW (new code, tested from scratch) |
| `pre-task-dispatcher.cjs` | `test-pre-task-dispatcher.test.cjs` (16 existing tests) | GOOD -- existing tests cover dispatcher hook execution order, short-circuit on block, state write, stderr aggregation | LOW (additive change -- 1 new import + 1 array entry) |
| `05-software-developer.md` | No direct test (markdown agent instructions) | N/A -- agent .md files are not unit-tested | LOW (additive markdown, no behavioral change to existing sections) |
| `gate-blocker.cjs` | `test-gate-blocker-extended.test.cjs` (26 existing tests) | GOOD -- covers gate advancement detection, all check types, fail-open | NONE (NO CHANGE to this file) |
| `iteration-requirements.json` | Multiple hooks read this config | GOOD -- validated by multiple hook tests | LOW (additive field, existing fields unchanged) |
| `lib/common.cjs` | `test-common.test.cjs` (61 existing tests) | GOOD | NONE (NO CHANGE to this file) |

### Complexity Analysis

| Component | Complexity | Risk |
|-----------|-----------|------|
| Markdown table parser (`parseImpactAnalysis`) | MEDIUM -- regex-based extraction from markdown tables with backtick-wrapped paths, multiple sections, deduplication | MEDIUM -- edge cases in markdown formatting (missing backticks, extra whitespace, mixed table formats). Mitigated by extensive test cases and fail-open on parse errors. |
| Git diff execution | LOW -- single `execSync` call with `--name-only` flag, well-established pattern from test-watcher.cjs | LOW -- main risk is timeout or non-git-repo, handled by try/catch with fail-open. |
| Coverage comparison logic | LOW -- set comparison (affected vs modified + deferred) | LOW -- straightforward set operations. |
| `shouldActivate` guard | LOW -- 3 condition checks (workflow exists, feature type, Phase 06) | LOW -- follows established patterns from other hooks in the dispatcher. |
| Dispatcher integration | LOW -- 1 require + 1 array entry | LOW -- identical pattern to all other hooks in the dispatcher. |
| Agent markdown additions | LOW -- additive text sections | LOW -- no behavioral code changes, no existing content modified per CON-004. |

### Technical Debt in Affected Areas

| Area | Debt Item | Impact on This Feature |
|------|-----------|----------------------|
| `pre-task-dispatcher.cjs` | Hook count growing (currently 8 hooks) | Adding a 9th hook increases dispatcher execution time slightly. Mitigated by `shouldActivate` guard that skips the hook in non-Phase-06 contexts. |
| `gate-blocker.cjs` | Has 5 check types already (test_iteration, constitutional, elicitation, delegation, artifact) | If blast_radius_validation is added as a 6th check type inside gate-blocker, increases coupling. RECOMMENDATION: Keep as standalone dispatcher hook instead. |
| `impact-analysis.md` format | No formal schema -- markdown tables parsed by convention | Risk: format changes in future versions could break the parser. Mitigated by fail-open design and documented format assumptions (ASM-001). |
| `05-software-developer.md` | Already 350+ lines | Adding ~50-80 lines of blast radius instructions increases agent context. Risk is minimal -- the additions are conditional (only applies when impact-analysis.md exists). |

### Risk Zones

| Zone | Files | Risk Level | Recommendation |
|------|-------|------------|----------------|
| Markdown Parser | `blast-radius-validator.cjs` `parseImpactAnalysis()` | MEDIUM | Write comprehensive test cases for: standard tables, missing backticks, extra whitespace, empty tables, tables with no data rows, multiple sections, NO CHANGE exclusion, deduplication. The parser is the most complex and error-prone component. |
| Git Diff Integration | `blast-radius-validator.cjs` git command | LOW | Test with mocked child_process. Handle: non-git-repo, detached HEAD, no `main` branch (some repos use `master`), timeout. Fail-open on all errors. |
| Dispatcher Hook Ordering | `pre-task-dispatcher.cjs` HOOKS array | LOW | Place blast-radius-validator BEFORE gate-blocker (index 5.5) so it runs during gate advancement checks but before gate-blocker's own checks. This ensures blast radius violations are reported alongside (not instead of) other gate failures. ALTERNATIVE: place AFTER gate-blocker so it only runs when all other checks pass. Architecture decision needed. |
| Agent Instruction Coherence | `05-software-developer.md` | LOW | Ensure the new "Blast Radius Coverage" section does not conflict with existing TDD workflow instructions. The new section should reference impact-analysis.md reading as a PRE-implementation step and blast-radius-coverage.md generation as a POST-implementation step. |
| Feature Workflow Guard | `shouldActivate` | LOW | Must correctly identify feature workflows (not fix workflows which use trace-analysis.md per CON-005). Test with: feature workflow active, fix workflow active, no workflow active, upgrade workflow active. |

### Recommended Pre-Implementation Actions

1. **Write tests first** -- Create `test-blast-radius-validator.test.cjs` with test cases for all 32 acceptance criteria BEFORE writing the hook (TDD per Article II).
2. **Validate impact-analysis.md format** -- Review 3-4 existing impact-analysis.md files to confirm the markdown table format is consistent (REQ-0005 through REQ-0009). Already done in this analysis -- format is consistent.
3. **Review test-watcher.cjs** -- The test-watcher hook uses a similar pattern (parse output, compare, fail-open). Study its `check()` structure for the hook contract pattern.
4. **Review pre-task-dispatcher.cjs** -- Confirm the HOOKS array insertion point. The blast-radius-validator should activate only during gate advancement attempts (same trigger as gate-blocker).

---

## Implementation Recommendations

Based on the impact analysis:

1. **Suggested Order**: blast-radius-validator.cjs (core) -> test file (TDD) -> pre-task-dispatcher.cjs (integration) -> 05-software-developer.md (agent) -> iteration-requirements.json (optional config)
2. **High-Risk Areas**: Markdown table parser (`parseImpactAnalysis`) -- add extensive tests for edge cases (missing backticks, extra whitespace, empty tables, deduplication)
3. **Dependencies to Resolve**: Architecture decision needed on hook placement -- standalone dispatcher hook (simpler, recommended) vs. gate-blocker check type (more coupling, not recommended)
4. **Key Design Constraint**: Fail-open design is mandatory (Article X). Every possible error path in the hook MUST result in `decision: "allow"` with diagnostic output to stderr.
5. **CON-004 Compliance**: Changes to `05-software-developer.md` MUST be additive only -- no modifications to existing TDD workflow, iteration enforcement, or test infrastructure sections.
6. **CON-005 Compliance**: `shouldActivate` guard MUST check `active_workflow.type === 'feature'` to exclude bug-fix workflows (which use trace-analysis.md, not impact-analysis.md).

---

## Impact Analysis Metadata

```json
{
  "analysis_completed_at": "2026-02-12T21:15:00.000Z",
  "sub_agents": ["M1-impact-analyzer", "M2-entry-point-finder", "M3-risk-assessor"],
  "requirements_document": "docs/requirements/REQ-0010-blast-radius-coverage/requirements-spec.md",
  "quick_scan_used": null,
  "scope_change_from_original": "refined",
  "requirements_keywords": ["blast-radius-validator", "CJS", "check(ctx)", "shouldActivate", "fail-open", "markdown table parser", "backtick paths", "deduplication", "NO CHANGE exclusion", "dispatcher", "GATE-06", "feature-workflow-only", "git diff", "blast-radius-coverage.md"],
  "files_analyzed": {
    "new_files": 2,
    "modified_files": 3,
    "no_change_files": 3,
    "total_blast_radius": 8
  },
  "affected_files_summary": [
    { "path": "src/claude/hooks/blast-radius-validator.cjs", "type": "CREATE" },
    { "path": "src/claude/hooks/tests/test-blast-radius-validator.test.cjs", "type": "CREATE" },
    { "path": "src/claude/hooks/dispatchers/pre-task-dispatcher.cjs", "type": "MODIFY" },
    { "path": "src/claude/agents/05-software-developer.md", "type": "MODIFY" },
    { "path": "src/claude/hooks/config/iteration-requirements.json", "type": "MODIFY" },
    { "path": "src/claude/hooks/gate-blocker.cjs", "type": "NO CHANGE" },
    { "path": "src/claude/hooks/lib/common.cjs", "type": "NO CHANGE" },
    { "path": "src/claude/settings.json", "type": "NO CHANGE" }
  ]
}
```
