# Requirements Specification: BUG-0012 — Premature Git Commit During Implementation

**Bug ID**: BUG-0012
**Artifact Folder**: BUG-0012-premature-git-commit
**Reported**: 2026-02-13
**Severity**: Medium
**Type**: Process Integrity Defect

---

## 1. Problem Statement

Claude Code proactively runs `git add` and `git commit` during Phase 06 (Implementation), before Phase 16 (Quality Loop) and Phase 08 (Code Review) have validated the code. No agent explicitly instructs this behavior, but no agent or hook prevents it either.

The result is that unvalidated code gets committed to the feature/bugfix branch before quality checks, test validation, and code review have completed. Commits should represent validated, quality-checked work.

## 2. Reproduction Steps

1. Start a fix or feature workflow (e.g., `/isdlc fix "some bug"`)
2. Proceed through Phase 01 (Requirements), Phase 02 (Tracing/Impact Analysis), Phase 05 (Test Strategy)
3. Enter Phase 06 (Implementation) -- the software-developer agent writes code and tests
4. Observe: Claude Code runs `git add` and `git commit` during implementation
5. Phase 16 (Quality Loop) has not yet run -- code is unvalidated
6. Phase 08 (Code Review) has not yet run -- code is unreviewed
7. The commit on the feature branch contains unvalidated work

## 3. Expected Behavior

- Commits should only occur AFTER all quality phases (Phase 16 + Phase 08) have passed
- During implementation and testing phases, code should remain uncommitted on the feature branch
- The orchestrator manages the final merge commit, not individual phase agents

## 4. Actual Behavior

- Claude Code's built-in behavior runs `git add -A && git commit` during Phase 06
- This creates commits of unvalidated, unreviewed code on the feature branch
- The branch-guard hook (`branch-guard.cjs`) only blocks commits to `main/master`, not premature commits on the feature branch

## 5. Root Cause Analysis

Two contributing factors:

1. **Missing agent instruction**: The software-developer agent (`05-software-developer.md`) does not explicitly instruct Claude Code NOT to commit during implementation. Claude Code's default behavior is to commit completed work.

2. **Missing hook enforcement**: The `branch-guard.cjs` hook only checks if commits are going to `main/master` while a feature branch exists. It does not check whether the current phase is appropriate for committing.

## 6. Functional Requirements

### FR-01: Software Developer Agent No-Commit Instruction
The software-developer agent (`05-software-developer.md`) MUST include an explicit instruction prohibiting `git add` and `git commit` during Phase 06. The instruction must be prominent and unambiguous.

**Acceptance Criteria**:
- AC-01: The agent markdown contains a clearly marked section instructing "Do NOT run git add or git commit"
- AC-02: The instruction is placed in a prominent position (near the top, in the mandatory enforcement section)
- AC-03: The instruction explains WHY commits are prohibited (quality loop and code review have not yet run)
- AC-04: The instruction specifies that the orchestrator manages all git operations

### FR-02: Quality Loop Agent No-Commit Instruction
The quality-loop-engineer agent (`16-quality-loop-engineer.md`) MUST include an explicit instruction prohibiting `git add` and `git commit` during Phase 16.

**Acceptance Criteria**:
- AC-05: The agent markdown contains a clearly marked section instructing "Do NOT run git add or git commit"
- AC-06: The instruction explains that code review (Phase 08) has not yet run

### FR-03: Branch Guard Hook Enhancement — Phase-Aware Commit Blocking
The `branch-guard.cjs` hook MUST be enhanced to block `git commit` on feature/bugfix branches during phases where commits are premature (before quality loop and code review complete).

**Acceptance Criteria**:
- AC-07: Hook reads `active_workflow.current_phase` from state.json
- AC-08: Hook reads `active_workflow.phases` array to determine if current phase is a "commit-allowed" phase
- AC-09: Commits are BLOCKED on feature/bugfix branches during phases BEFORE the final phase (08-code-review) completes
- AC-10: Commits are ALLOWED during the final phase or after workflow completion
- AC-11: Commits are ALLOWED when no active workflow exists (fail-open)
- AC-12: Commits are ALLOWED when the branch is not a feature/bugfix branch (non-workflow branches)
- AC-13: Hook provides a clear, helpful error message explaining why the commit was blocked
- AC-14: Hook fails open on any error (consistent with existing fail-open convention)

### FR-04: Allowed Commit Phases Configuration
The set of phases where commits are allowed MUST be configurable or deterministic based on the workflow definition.

**Acceptance Criteria**:
- AC-15: The "commit-allowed" phase is determined as the LAST phase in `active_workflow.phases` (08-code-review for standard workflows)
- AC-16: During the last phase, commits are allowed (code review may want to commit review artifacts)
- AC-17: The orchestrator's own git operations (branch creation, merge) are not affected by this hook
- AC-18: `git add` without `git commit` remains ALLOWED during all phases (staging is harmless)

### FR-05: Git Stash as Alternative
When a commit is blocked, the hook SHOULD suggest `git stash` as an alternative for saving work-in-progress.

**Acceptance Criteria**:
- AC-19: Block message includes suggestion to use `git stash` if the user wants to save WIP
- AC-20: Block message explains that the orchestrator will handle commits after all phases pass

## 7. Non-Functional Requirements

### NFR-01: Performance
The enhanced branch-guard hook MUST complete within 200ms (existing performance budget).

### NFR-02: Fail-Open Behavior
Any error in the enhanced logic MUST result in allowing the commit (fail-open), consistent with Article X of the constitution.

### NFR-03: Backward Compatibility
The existing main/master protection MUST remain functional. The new phase-aware blocking is additive.

## 8. Out of Scope

- Blocking `git push` (not relevant -- pushes are managed by the orchestrator)
- Blocking commits in non-iSDLC workflows
- Modifying other agents beyond software-developer and quality-loop-engineer

## 9. Affected Files

| File | Change Type | Description |
|------|-------------|-------------|
| `src/claude/agents/05-software-developer.md` | Modify | Add no-commit instruction |
| `src/claude/agents/16-quality-loop-engineer.md` | Modify | Add no-commit instruction |
| `src/claude/hooks/branch-guard.cjs` | Modify | Add phase-aware commit blocking |
| `src/claude/hooks/tests/branch-guard.test.cjs` | Modify/Create | Add tests for new blocking logic |

## 10. Constitutional Compliance

| Article | Relevance | How Addressed |
|---------|-----------|---------------|
| Article I (Specification Primacy) | Requirements defined before implementation | This document |
| Article IV (Explicit Over Implicit) | No ambiguity in commit policy | Explicit agent instructions |
| Article VII (Artifact Traceability) | All changes trace to BUG-0012 | Artifact folder, commit messages |
| Article IX (Quality Gate Integrity) | Gates cannot be bypassed by premature commits | Hook enforcement |
| Article X (Fail-Safe Defaults) | Hook fails open | NFR-02 |
| Article XIV (State Management) | Reads state.json for phase context | FR-03 |
