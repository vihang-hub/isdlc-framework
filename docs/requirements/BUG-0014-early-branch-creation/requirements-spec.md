# BUG-0014: Early Branch Creation — Requirements Specification

**Type**: Bug Fix
**Priority**: High
**Status**: Approved
**Created**: 2026-02-13

---

## Problem Statement

Branch creation currently happens **after GATE-01 passes** (post-requirements). This means Phase 01 (requirements capture) and Phase 00 (quick scan, for feature workflows) execute on the `main` branch. Any file writes during these early phases (artifact creation, state.json updates) dirty the main branch.

The sequential ID (BUG-NNNN / REQ-NNNN) and the artifact folder name are computed at **workflow initialization time** — before Phase 01 starts. Therefore, the branch name is fully known at init time, and there is no technical reason to delay branch creation until after GATE-01.

## Expected Behavior

For workflows with `requires_branch: true` (feature, fix, upgrade):
1. Branch is created **immediately after workflow initialization**, before any phases execute
2. All phases (including 00-quick-scan and 01-requirements) execute on the feature/bugfix branch
3. The `main` branch remains completely untouched during the entire workflow

## Actual Behavior

1. Workflow initializes on `main`
2. Phase 00 (quick scan) runs on `main` — writes artifacts to main
3. Phase 01 (requirements) runs on `main` — writes requirements artifacts and state.json updates to main
4. GATE-01 passes, **then** branch is created
5. Phases 02+ run on the branch

## Root Cause

The orchestrator's `init-and-phase-01` mode creates the branch **after** GATE-01 validation, as documented in:
- `src/claude/agents/00-sdlc-orchestrator.md` (Section 3a: "When GATE-01 passes AND the active workflow has requires_branch: true")
- `src/claude/commands/isdlc.md` (STEP 1: "validates GATE-01, creates the branch")

## Impact

- Main branch gets polluted with in-progress artifact writes
- If a workflow is cancelled during Phase 00 or Phase 01, artifacts remain on main
- Violates the principle that main should only change via merge at workflow completion
- Git history on main contains intermediate state changes

---

## Functional Requirements

### FR-01: Move Branch Creation to Workflow Initialization
**Description**: When `requires_branch: true` in the workflow definition, create the git branch immediately after writing `active_workflow` to state.json, before any phases run.
**Acceptance Criteria**:
- AC-01a: Branch is created before Phase 00 (quick-scan) for feature workflows
- AC-01b: Branch is created before Phase 01 (requirements) for fix workflows
- AC-01c: Branch name uses the artifact_folder computed at init time (e.g., `bugfix/BUG-0014-early-branch-creation`)
- AC-01d: All subsequent phase work happens on the new branch

### FR-02: Update Orchestrator Agent Documentation
**Description**: Update the orchestrator agent's Section 3a to specify branch creation at init time rather than post-GATE-01.
**Acceptance Criteria**:
- AC-02a: Section 3a "Branch Creation" moved from "Post-GATE-01" to "Post-Initialization"
- AC-02b: The `init-and-phase-01` mode description includes branch creation before Phase 01
- AC-02c: Plan generation (Section 3b) still happens after GATE-01 (only branch timing changes)

### FR-03: Update isdlc.md Phase-Loop Controller
**Description**: Update the STEP 1 (INIT) section of isdlc.md to document that the orchestrator creates the branch during init, before Phase 01.
**Acceptance Criteria**:
- AC-03a: STEP 1 description updated to mention branch creation happens during init
- AC-03b: Post-GATE-01 branch creation references removed from STEP 1
- AC-03c: Plan generation remains documented as post-GATE-01

### FR-04: Pre-Flight Checks at Init Time
**Description**: The pre-flight checks (git repo validation, dirty working directory handling, main branch verification) must run at init time instead of post-GATE-01.
**Acceptance Criteria**:
- AC-04a: `git rev-parse --is-inside-work-tree` check runs during workflow init
- AC-04b: Dirty working directory auto-commit runs before branch creation
- AC-04c: Checkout to main happens before branch creation if not already on main
- AC-04d: Non-git VCS detection and warning runs at init time

### FR-05: State Recording
**Description**: The `git_branch` object must be written to `active_workflow` in state.json immediately after branch creation at init time.
**Acceptance Criteria**:
- AC-05a: `active_workflow.git_branch.name` is set after branch creation
- AC-05b: `active_workflow.git_branch.created_from` records the source branch (main)
- AC-05c: `active_workflow.git_branch.created_at` records the ISO-8601 timestamp
- AC-05d: `active_workflow.git_branch.status` is set to "active"

---

## Non-Functional Requirements

### NFR-01: Backward Compatibility
Branch creation must still work correctly for all workflow types: feature, fix, and upgrade. Workflows with `requires_branch: false` (test-run, test-generate) must be unaffected.

### NFR-02: Error Handling
If branch creation fails (e.g., not a git repo, branch already exists), the workflow should still initialize but with a warning that no branch was created. This maintains fail-open behavior (Article X).

### NFR-03: No Behavioral Change Post-GATE-01
Plan generation (Section 3b) and all post-GATE-01 logic other than branch creation must remain unchanged. Only the branch creation timing moves earlier.

---

## Affected Files

1. `src/claude/agents/00-sdlc-orchestrator.md` — Section 3a (Branch Creation), Section 3c (init-and-phase-01 mode)
2. `src/claude/commands/isdlc.md` — STEP 1 (INIT), branch creation references
3. `.isdlc/state.json` — runtime state updates

---

## Traceability

| Requirement | Acceptance Criteria | Constitutional Articles |
|-------------|--------------------|-----------------------|
| FR-01 | AC-01a, AC-01b, AC-01c, AC-01d | IX (Gate Integrity), XIV (State Management) |
| FR-02 | AC-02a, AC-02b, AC-02c | VIII (Documentation Currency) |
| FR-03 | AC-03a, AC-03b, AC-03c | VIII (Documentation Currency) |
| FR-04 | AC-04a, AC-04b, AC-04c, AC-04d | X (Fail-Safe Defaults) |
| FR-05 | AC-05a, AC-05b, AC-05c, AC-05d | XIV (State Management) |
