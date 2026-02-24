# BUG-0012: Implementation Notes

## Summary

Implemented phase-aware commit blocking in `branch-guard.cjs` and added explicit no-commit instructions to the software-developer and quality-loop-engineer agent files.

## Changes Made

### 1. `src/claude/hooks/branch-guard.cjs` (v1.0.0 -> v2.0.0)

**What changed**: Added phase-aware commit blocking logic after the existing main/master protection.

**How it works**:
1. After the existing main/master check, the hook now checks if the current git branch matches the workflow's git branch
2. If on a different branch (e.g., `hotfix/urgent`), commits are allowed unconditionally (not the workflow's concern)
3. If on the workflow branch, the hook reads `current_phase` and `phases` from `active_workflow`
4. If either is missing, the hook fails open (allows the commit) -- defensive fail-open policy
5. If `current_phase` equals the last element of `phases` (the final phase), commits are allowed
6. Otherwise, the commit is BLOCKED with a helpful message including:
   - The current phase name
   - Explanation that quality-loop and code-review have not run
   - Suggestion to use `git stash` if work needs to be saved
   - Note that the orchestrator handles commits at finalize

**Design decisions**:
- "Last phase = commit allowed" is flexible: works for any workflow shape, not just standard 6-phase fix workflows
- Non-workflow branches (hotfix, etc.) are never blocked -- the hook only governs the workflow's own branch
- Fail-open on missing data prevents accidental lockout during edge cases or state corruption

### 2. `src/claude/agents/05-software-developer.md`

**What changed**: Added a `# CRITICAL: Do NOT Run Git Commits` section after the MANDATORY ITERATION ENFORCEMENT section (within first 80 lines for prominence).

**Content**: Explicitly instructs the agent to not run `git add`, `git commit`, or `git push` during implementation. Explains why: commits should represent validated work that has passed Phase 16 (quality-loop) and Phase 08 (code-review). The orchestrator manages all git operations.

### 3. `src/claude/agents/16-quality-loop-engineer.md`

**What changed**: Added a `## CRITICAL: Do NOT Run Git Commits` section before the MANDATORY ITERATION ENFORCEMENT section.

**Content**: Instructs the agent to not run `git add`, `git commit`, or `git push` during the quality loop. Explains that Phase 08 (code-review) has not yet run. The orchestrator handles git operations at workflow finalize.

## Test Results

- **31/31 tests passing** (14 existing + 17 new from Phase 05 test strategy)
- **1129/1129 CJS hook tests passing** (full regression suite)
- **0 failures, 0 regressions**

## Traceability

| Requirement | Implementation | Test |
|-------------|---------------|------|
| FR-01 (phase-aware blocking) | branch-guard.cjs lines 136-183 | T15, T16, T17 |
| FR-02 (agent no-commit) | 05-software-developer.md lines 38-42 | T27, T28, T29 |
| FR-03 (quality-loop no-commit) | 16-quality-loop-engineer.md lines 32-34 | T30, T31 |
| FR-04 (block message quality) | branch-guard.cjs outputBlockResponse | T24 |
| FR-05 (regression safety) | existing main/master check preserved | T26, T1-T14 |
| AC-07 through AC-10 | phase blocking + final phase allow | T15-T18 |
| AC-11, AC-14 | fail-open behavior | T19, T21, T22 |
| AC-12 | non-workflow branch pass-through | T20 |
| AC-13 | phase name in block message | T24 |
| AC-15, AC-16 | last phase = allowed | T18, T25 |
| AC-18 | git add allowed (no commit) | T23 |
| AC-19 | stash suggestion | T24 |
| AC-20 | orchestrator mention | T24 |
