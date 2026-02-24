# Impact Analysis: REQ-0013 Supervised Mode

**Generated**: 2026-02-14T10:20:00Z
**Feature**: Supervised mode -- configurable per-phase review gates with parallel change summaries, redo with guidance, review history
**Based On**: Phase 01 Requirements (finalized: requirements-spec.md v1.0.0)
**Phase**: 02-impact-analysis

---

## Scope Comparison

| Aspect | Original (Delegation Prompt) | Clarified (Phase 01) |
|--------|------------------------------|----------------------|
| Description | Per-phase review gates with parallel change summaries. Three components: summary generation, review gate, resume after review | 8 FRs: Config block, summary generation, review gate menu (C/R/D), pause/resume, redo with guidance, gate-blocker integration, phase-loop-controller integration, review history in workflow state |
| Keywords | supervised, review, summary, pause, resume | supervised_mode, review_phases, parallel_summary, redo, circuit_breaker, gate-blocker, phase-loop-controller, review_history, session_recovery |
| Estimated Files | 6 (from delegation prompt) | 8-10 (refined below) |
| Scope Change | - | EXPANDED: Added redo with guidance (FR-05), circuit breaker (NFR-05), gate-blocker integration (FR-06), review history (FR-08), session recovery (NFR-04) |

---

## Executive Summary

Supervised mode is a **medium-complexity feature** that modifies the phase-loop controller and gate-blocker infrastructure rather than creating new agents or hooks. The primary integration point is `isdlc.md` STEP 3e (post-phase state update), where a new STEP 3e-review is inserted. The feature follows the established `code_review.enabled` configuration pattern in state.json, keeping architectural consistency high. The main risk is the isdlc.md modification -- it is the most complex file in the framework (1048 lines of markdown instruction) and the central orchestration point for all workflows. Gate-blocker modifications are well-tested (1214 lines of tests) and follow existing patterns. No new npm dependencies, agents, or skills are required (NFR-06).

**Blast Radius**: MEDIUM (8-10 files directly affected across 4 modules)
**Risk Level**: MEDIUM (isdlc.md complexity + session recovery edge cases)
**Affected Files**: 8 direct, 4 cascade
**Affected Modules**: 4 (commands, hooks, config, agents)

---

## Impact Analysis

### M1: File-Level Impact Assessment

#### Directly Affected Files

| # | File | Module | Change Type | LOC Estimate | ACs Addressed | Risk |
|---|------|--------|-------------|--------------|---------------|------|
| 1 | `src/claude/commands/isdlc.md` | commands | MODIFY | +80-120 lines | AC-03a-g, AC-04a-e, AC-05a-f, AC-07a-d | HIGH |
| 2 | `src/claude/hooks/gate-blocker.cjs` | hooks | MODIFY | +20-35 lines | AC-06a-c | MEDIUM |
| 3 | `src/claude/hooks/lib/common.cjs` | hooks/lib | MODIFY | +60-100 lines | AC-01a-h, AC-02a-e, AC-08a-c | MEDIUM |
| 4 | `src/claude/agents/00-sdlc-orchestrator.md` | agents | MODIFY | +15-25 lines | AC-01a, AC-08b | LOW |
| 5 | `.isdlc/config/workflows.json` | config | MODIFY | +10-15 lines | AC-01a | LOW |
| 6 | `src/claude/hooks/config/workflows.json` | config (source) | MODIFY | +10-15 lines | AC-01a | LOW |
| 7 | `src/claude/hooks/tests/test-gate-blocker-extended.test.cjs` | tests | MODIFY | +80-120 lines | AC-06a-c | LOW |
| 8 | `src/claude/hooks/lib/common.cjs` (new functions) | hooks/lib | MODIFY | (included in #3) | AC-02a-e | MEDIUM |

#### New Files Created

| # | File | Purpose | Risk |
|---|------|---------|------|
| 1 | `.isdlc/reviews/phase-NN-summary.md` | Runtime artifact (auto-generated per phase) | LOW |
| 2 | `src/claude/hooks/tests/test-supervised-mode.test.cjs` | New test file for supervised mode functions | LOW |

#### Cascade Analysis (Outward Dependencies)

Files that DEPEND ON the directly affected files:

| Affected File | Dependent Files | Impact Type |
|---------------|----------------|-------------|
| `isdlc.md` | All phase agents (read by phase-loop controller) | Behavioral -- agents are delegated differently when review gate is active |
| `gate-blocker.cjs` | `pre-skill-dispatcher.cjs` (dispatches to gate-blocker) | No code change needed -- dispatcher calls check() which returns allow/block |
| `common.cjs` | All hooks that import common.cjs (21 hooks) | No code change needed -- new functions are additive, no existing API changes |
| `workflows.json` | gate-blocker.cjs, isdlc.md (both read workflows.json) | Config addition -- existing consumers ignore unknown fields |
| `sdlc-orchestrator.md` | isdlc.md (delegates to orchestrator for init/finalize) | Behavioral -- orchestrator must handle supervised_mode flag in init and preserve review_history in finalize |

#### Inward Dependencies (What affected files depend on)

| Affected File | Depends On | Dependency Type |
|---------------|-----------|-----------------|
| `isdlc.md` STEP 3e-review | `common.cjs` readState/writeState | Data -- reads supervised_mode config from state |
| `isdlc.md` STEP 3e-review | `git diff` CLI | External -- file change detection for summaries |
| `gate-blocker.cjs` | `common.cjs` readState | Data -- reads supervised_mode config |
| `gate-blocker.cjs` | `iteration-requirements.json` | Config -- no change needed to this file |
| Summary generation | `state.json` phases[key].artifacts | Data -- reads artifact list per phase |

#### Change Propagation Paths

```
Path 1 (Config -> Phase Loop -> Review Gate):
  state.json:supervised_mode.enabled=true
  -> isdlc.md STEP 3e reads config
  -> STEP 3e-review activates
  -> Summary generated to .isdlc/reviews/
  -> C/R/D menu presented via AskUserQuestion
  -> User choice drives next action

Path 2 (Config -> Gate Blocker):
  state.json:supervised_mode.enabled=true
  -> gate-blocker.cjs reads config
  -> Allows phase completion but defers auto-advance to review gate
  -> No change to gate blocking logic itself

Path 3 (Redo -> Phase Re-delegation):
  User selects [D] Redo
  -> isdlc.md re-delegates to same phase agent
  -> Phase agent runs with REDO GUIDANCE appended
  -> Post-phase state update (STEP 3e) runs again
  -> STEP 3e-review presents menu again

Path 4 (Review History -> Workflow Finalize):
  Review gate interactions recorded in active_workflow.review_history
  -> Orchestrator finalize preserves review_history in workflow_history
  -> collectPhaseSnapshots() unaffected (does not touch review_history)
```

---

## Entry Points

### M2: Entry Point Analysis

#### Primary Integration Point

**File**: `src/claude/commands/isdlc.md`
**Location**: Between STEP 3e (post-phase state update) and STEP 3e-sizing (sizing decision point)
**New Step**: STEP 3e-review (conditional)

```
Current flow:
  3d. DIRECT PHASE DELEGATION
  3e. POST-PHASE STATE UPDATE
  3e-sizing. SIZING DECISION POINT (conditional)
  3e-refine. TASK REFINEMENT (conditional)
  3f. Check result status

New flow:
  3d. DIRECT PHASE DELEGATION
  3e. POST-PHASE STATE UPDATE
  3e-review. SUPERVISED REVIEW GATE (conditional)  <-- NEW
  3e-sizing. SIZING DECISION POINT (conditional)
  3e-refine. TASK REFINEMENT (conditional)
  3f. Check result status
```

**Why after 3e, before 3e-sizing**: The review gate should fire after the phase state is updated (so the summary has accurate data) but before sizing decisions (which only apply to Phase 02). This ordering ensures:
1. Phase state is committed before review
2. User can review impact analysis results before sizing decision
3. Redo re-runs the phase agent and re-updates state naturally

#### Secondary Integration Points

| # | File | Location | Purpose |
|---|------|----------|---------|
| 1 | `gate-blocker.cjs` | `check()` function, after existing checks pass | Add supervised_mode awareness: when review gate is pending, prevent auto-advance past it |
| 2 | `common.cjs` | New exported functions | `readSupervisedModeConfig(state)`, `generatePhaseSummary(state, phaseKey, projectRoot)`, `shouldReviewPhase(config, phaseKey)`, `recordReviewAction(state, phaseKey, action, details)` |
| 3 | `sdlc-orchestrator.md` | Section 3 (workflow init) | Parse `--supervised` flag or `supervised_mode` from state.json; set config during init |
| 4 | `sdlc-orchestrator.md` | Finalize mode | Preserve `review_history` in workflow_history entry |
| 5 | `workflows.json` | `workflows.feature.options` | Add `supervised` option with `--supervised` flag |

#### New Entry Points to Create

| # | Entry Point | Type | Description |
|---|------------|------|-------------|
| 1 | STEP 3e-review in isdlc.md | Phase boundary gate | Conditional review gate after each phase completion |
| 2 | `readSupervisedModeConfig()` in common.cjs | Utility function | Reads and validates supervised_mode config with fail-open defaults |
| 3 | `generatePhaseSummary()` in common.cjs | Utility function | Generates phase summary markdown file |
| 4 | `shouldReviewPhase()` in common.cjs | Utility function | Checks if a phase should trigger a review gate |
| 5 | `recordReviewAction()` in common.cjs | Utility function | Appends review action to review_history array |
| 6 | `.isdlc/reviews/` directory | Runtime directory | Auto-created by summary generation |

#### Implementation Chain (Entry to Data Layer)

```
User starts workflow with --supervised flag
  -> sdlc-orchestrator.md: init-and-phase-01 mode
     -> Sets supervised_mode.enabled=true in state.json
     -> Returns phases array + artifact_folder

Phase completes (STEP 3e done)
  -> isdlc.md STEP 3e-review:
     1. readState() -> supervised_mode config
     2. shouldReviewPhase(config, phaseKey) -> boolean
     3. If true:
        a. generatePhaseSummary(state, phaseKey, projectRoot) -> .isdlc/reviews/phase-NN-summary.md
        b. AskUserQuestion with C/R/D options
        c. On [C]: recordReviewAction(state, phaseKey, 'continue') -> advance
        d. On [R]: recordReviewAction(state, phaseKey, 'review') -> pause, wait, advance
        e. On [D]: prompt for guidance, re-delegate, loop back to 3e
     4. If false: skip to 3e-sizing
```

#### Recommended Implementation Order

1. **common.cjs helper functions** -- Build the utility layer first (readSupervisedModeConfig, shouldReviewPhase, generatePhaseSummary, recordReviewAction). These are independently testable with unit tests.
2. **workflows.json config** -- Add the `supervised` option to feature (and optionally fix) workflow definitions.
3. **gate-blocker.cjs modification** -- Add supervised_mode awareness to the check() function. This is a small, isolated change.
4. **isdlc.md STEP 3e-review** -- The main integration point. Depends on common.cjs helpers being available.
5. **sdlc-orchestrator.md** -- Init and finalize modifications. Depends on understanding the full state structure.
6. **Tests** -- Add unit tests for common.cjs functions, extend gate-blocker tests, add integration-level supervised mode tests.

---

## Risk Assessment

### M3: Risk Analysis

#### Test Coverage Gaps

| File | Current Coverage | Tests | Risk Impact |
|------|-----------------|-------|-------------|
| `gate-blocker.cjs` | HIGH (1214 lines of tests in test-gate-blocker-extended.test.cjs) | 26+ test cases | LOW -- well-tested, modification follows existing patterns |
| `common.cjs` | HIGH (tested across 18 test files) | Extensive unit tests | LOW -- new functions are additive |
| `isdlc.md` | NONE (markdown command, no direct tests) | Validated by integration flows only | HIGH -- the most complex modification has no automated tests |
| `sdlc-orchestrator.md` | NONE (markdown agent, no direct tests) | Validated by integration flows only | MEDIUM -- small modification but no regression safety net |
| `workflows.json` | MEDIUM (validated by workflow-related tests) | Config schema tested | LOW -- additive config change |

#### Complexity Hotspots

| Hotspot | Complexity | Reason | Mitigation |
|---------|-----------|--------|------------|
| `isdlc.md` STEP 3e-review | HIGH | Nested control flow (C/R/D menu), redo loop with circuit breaker, interaction with sizing/refinement steps | Clear conditional ordering; redo counter bounded at 3 |
| Review pause + session recovery (NFR-04) | HIGH | If user's Claude Code session ends during review pause, next session must detect and recover | `supervised_review` state in state.json persists across sessions; isdlc.md scenario 4 can detect it |
| Redo re-delegation | MEDIUM | Phase re-run must properly reset state, avoid double-counting in metrics | Phase status transitions: completed -> in_progress (redo) -> completed |
| Summary generation with git diff | MEDIUM | Requires git availability, may fail in edge cases | Degrade gracefully (NFR-02 fail-open): skip diff section if git unavailable |

#### Technical Debt Markers

| Area | Debt Type | Impact on This Feature |
|------|-----------|----------------------|
| `isdlc.md` is 1048 lines of markdown | Monolithic instruction file | Adding STEP 3e-review increases complexity further; consider extracting review gate logic into a separate skill or section |
| `common.cjs` is 2476 lines | Growing utility file | Adding 60-100 lines is manageable but pushes toward module split threshold |
| No test coverage for isdlc.md or orchestrator.md | Test gap | Supervised mode behavior can only be validated through end-to-end workflow runs, not unit tests |
| `auto_advance_timeout` reserved but not implemented | Deferred feature | Config schema includes the field; implementation must ensure it is safely ignored |

#### Risk Recommendations per Acceptance Criterion

| AC Group | Risk | Recommendation |
|----------|------|----------------|
| AC-01a-h (Config) | LOW | Follow `code_review.enabled` pattern; fail-open on missing/corrupt config |
| AC-02a-e (Summary Generation) | MEDIUM | Test with phases that produce 0 changes, many changes, and missing git |
| AC-03a-g (Review Gate Menu) | MEDIUM | Test menu presentation with AskUserQuestion; ensure [C]/[R]/[D] mappings are correct |
| AC-04a-e (Pause/Resume) | HIGH | Test session recovery: kill session during pause, restart, verify state detection |
| AC-05a-f (Redo) | HIGH | Test redo counter (max 3), state transitions, redo guidance appending |
| AC-06a-c (Gate Blocker) | LOW | Existing test infrastructure covers gate-blocker patterns well |
| AC-07a-d (Phase Loop Controller) | HIGH | isdlc.md has no automated tests; validate through integration workflow |
| AC-08a-c (Review History) | LOW | Simple array append + preservation in finalize |

#### Risk Zones (Breaking Change Intersections)

1. **STEP 3e-review vs STEP 3e-sizing conflict**: Both fire after Phase 02. Review gate must fire FIRST so the user can review impact analysis before the sizing recommendation. If ordering is wrong, user sees sizing menu before they can review the analysis.

2. **Redo + state_version conflict**: Each redo re-delegates to the phase agent, which writes to state.json. The BUG-0009 optimistic locking (state_version auto-increment in writeState) handles this, but redo loops increase state_version rapidly. Not a functional risk but worth monitoring.

3. **Review pause + branch-guard interaction**: During review pause, the user may edit files outside Claude Code. Branch-guard enforces commit timing. This is acceptable since the user is on the feature branch and edits are tracked by git, but the user should not be blocked from making changes during review.

4. **collectPhaseSnapshots + redo metrics**: If a phase is redone, the phase snapshot captures the final (post-redo) state. The redo_count is tracked in review_history, not in phase snapshots. This means metrics.phases_completed reflects the final count, not intermediate redo attempts. This is correct behavior.

---

## Implementation Recommendations

Based on the impact analysis:

1. **Suggested Implementation Order**:
   - common.cjs helper functions (independently testable)
   - workflows.json config updates
   - gate-blocker.cjs supervised_mode check
   - isdlc.md STEP 3e-review (main integration)
   - sdlc-orchestrator.md init/finalize modifications
   - Tests (unit tests for helpers, extended gate-blocker tests, integration tests)

2. **High-Risk Areas -- Add Tests First**:
   - Write unit tests for `readSupervisedModeConfig()`, `shouldReviewPhase()`, `generatePhaseSummary()`, `recordReviewAction()` BEFORE implementing them
   - Extend gate-blocker tests with supervised_mode scenarios BEFORE modifying gate-blocker.cjs
   - Consider adding a dedicated `test-supervised-mode.test.cjs` file

3. **Dependencies to Resolve**:
   - Confirm `AskUserQuestion` tool supports the C/R/D menu pattern (it does -- used by orchestrator and upgrade-engineer)
   - Confirm `git diff --name-status` works from the phase-loop controller context (it does -- used by orchestrator review-summary generation)
   - Confirm `.isdlc/reviews/` directory can be created by `fs.mkdirSync` with `recursive: true` (standard Node.js)

4. **Architecture Decision**: STEP 3e-review should be placed BEFORE 3e-sizing to allow users to review the impact analysis before the framework presents the sizing recommendation. This maintains user control over the workflow while keeping the existing sizing logic intact.

---

## Impact Analysis Metadata

```json
{
  "analysis_completed_at": "2026-02-14T10:20:00Z",
  "sub_agents": ["M1-impact-analyzer", "M2-entry-point-finder", "M3-risk-assessor"],
  "requirements_document": "docs/requirements/REQ-0013-supervised-mode/requirements-spec.md",
  "quick_scan_used": null,
  "scope_change_from_original": "expanded",
  "requirements_keywords": ["supervised_mode", "review_phases", "parallel_summary", "review_gate", "redo", "circuit_breaker", "gate-blocker", "phase-loop-controller", "review_history", "session_recovery"],
  "files_directly_affected": 8,
  "files_cascade_affected": 4,
  "modules_affected": 4,
  "blast_radius": "medium",
  "risk_level": "medium",
  "new_functions_needed": 4,
  "new_files_needed": 2,
  "existing_test_coverage": {
    "gate-blocker.cjs": "high",
    "common.cjs": "high",
    "isdlc.md": "none",
    "sdlc-orchestrator.md": "none"
  }
}
```
