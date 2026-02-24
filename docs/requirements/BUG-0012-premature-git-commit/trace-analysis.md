# Trace Analysis: Premature Git Commit During Implementation (BUG-0012)

**Generated**: 2026-02-13T07:10:00Z
**Bug**: Git add/commit runs before quality-loop and code-review
**Bug ID**: BUG-0012
**Workflow**: fix
**Phase**: 02-tracing

---

## Executive Summary

Claude Code proactively runs `git add` and `git commit` during Phase 06 (implementation) on feature/bugfix branches, creating commits of unvalidated, unreviewed code. The root cause is a two-layer defense gap: (1) the `branch-guard.cjs` hook only blocks commits to main/master but allows all commits on feature branches regardless of workflow phase, and (2) no agent (software-developer, quality-loop-engineer, qa-engineer) contains an explicit instruction prohibiting commits during their phase. The orchestrator's git lifecycle design assumes agents will not commit, but this assumption is never enforced either programmatically or via agent instructions.

**Root Cause Confidence**: HIGH
**Severity**: MEDIUM (process integrity defect, no data loss or security risk)
**Estimated Complexity**: LOW (agent instruction additions + hook enhancement with phase-aware logic)

---

## Symptom Analysis

### Observed Behavior

Claude Code runs `git add -A && git commit` during Phase 06 (Implementation) on the active feature/bugfix branch. This occurs without any agent instruction triggering it -- it is Claude Code's default behavior when it completes a chunk of work.

### Error Messages

No error messages are produced. This is a **silent process integrity violation**. The commit succeeds and the workflow continues, but the committed code has not been validated by Phase 16 (Quality Loop) or Phase 08 (Code Review).

### Reproduction Steps

1. Start a fix or feature workflow (`/isdlc fix "some bug"` or `/isdlc feature "some feature"`)
2. Proceed through Phase 01 (Requirements) and subsequent phases until Phase 06 (Implementation)
3. The software-developer agent writes code and tests
4. Observe: Claude Code runs `git add` and `git commit` on the feature branch during implementation
5. Phase 16 (Quality Loop) has not yet run
6. Phase 08 (Code Review) has not yet run
7. The commit on the feature branch contains unvalidated, unreviewed work

### Triggering Conditions

- **Workflow**: Any active fix or feature workflow with a git branch
- **Phase**: Phase 06 (Implementation), but also potentially Phase 16 (Quality Loop) and Phase 05 (Test Strategy) where code modifications occur
- **Branch**: Any feature/ or bugfix/ branch (not main/master)
- **Trigger**: Claude Code's built-in behavior to commit completed work, in the absence of an explicit instruction not to

### Affected Components

| Component | Role | Gap |
|-----------|------|-----|
| `src/claude/hooks/branch-guard.cjs` | Intercepts `git commit` commands | Only checks branch name, not workflow phase |
| `src/claude/agents/05-software-developer.md` | Implementation agent | No "do not commit" instruction |
| `src/claude/agents/16-quality-loop-engineer.md` | Quality validation agent | No "do not commit" instruction |
| `src/claude/agents/07-qa-engineer.md` | Code review agent | No "do not commit" instruction |
| `src/claude/agents/00-sdlc-orchestrator.md` | Git lifecycle owner | Assumes agents will not commit, but does not enforce |

---

## Execution Path

### Entry Point

The workflow begins with `/isdlc fix "bug description"` or `/isdlc feature "description"`, which triggers the Phase-Loop Controller defined in `src/claude/commands/isdlc.md`.

### Call Chain (Normal Flow)

```
1. User invokes: /isdlc fix "bug description"
2. Phase-Loop Controller initializes workflow in state.json
3. Phase 01 (Requirements): requirements-analyst captures spec
4. GATE-01 passes
5. Orchestrator creates feature/bugfix branch:
   a. git status --porcelain (check for dirty state)
   b. git add -A && git commit -m "chore: pre-branch checkpoint" (if dirty)
   c. git checkout -b bugfix/BUG-NNNN-description
   d. Updates state.json with git_branch info
6. Phase 02 (Tracing): trace-analyst identifies root cause
7. Phase 05 (Test Strategy): test-design-engineer creates test plan
8. Phase 06 (Implementation): software-developer writes code/tests
   >> PREMATURE COMMIT OCCURS HERE <<
   Claude Code default behavior: git add -A && git commit -m "..."
   branch-guard.cjs intercepts:
     - Detects git commit in command: YES
     - Reads state.json: active_workflow exists
     - Checks git_branch.status: "active"
     - Gets current branch: "bugfix/BUG-NNNN-..."
     - Checks if main/master: NO
     - Result: ALLOW (line 128-129)
9. Phase 16 (Quality Loop): quality-loop-engineer runs tests/lint/coverage
   >> Code is ALREADY committed (unvalidated) <<
10. Phase 08 (Code Review): qa-engineer reviews code
    >> Code is ALREADY committed (unreviewed) <<
11. Finalize: Orchestrator merges branch to main
```

### Data Flow Through branch-guard.cjs

```
Input (PreToolUse stdin):
{
  "tool_name": "Bash",
  "tool_input": { "command": "git add -A && git commit -m \"feat: implement fix\"" }
}

Processing:
  Line 66:  tool_name === 'Bash' ? YES -> continue
  Line 73:  isGitCommit(command) ? YES -> continue (regex: /\bgit\s+commit\b/)
  Line 80:  readState() -> { active_workflow: { git_branch: { status: "active" } } }
  Line 86:  active_workflow exists? YES -> continue
  Line 92:  git_branch.status === "active"? YES -> continue
  Line 98:  getCurrentBranch() -> "bugfix/BUG-0012-premature-git-commit"
  Line 107: currentBranch === "main" || "master"? NO
  Line 128: // On feature branch or other branch, allow
  Line 129: debugLog('Not on main/master, allowing')

Output: (empty stdout, exit 0) -> ALLOWED
```

### Where the Failure Occurs

The failure is at `branch-guard.cjs` lines 107-129. After confirming the branch is not main/master, the hook unconditionally allows the commit. There is no check for the current workflow phase.

The designed git lifecycle (from `00-sdlc-orchestrator.md` Section 3a) is:
- **Pre-branch checkpoint** (orchestrator, after GATE-01): `git add -A && git commit -m "chore: pre-branch checkpoint"`
- **Branch merge** (orchestrator, after all gates pass): `git checkout main && git merge --no-ff {branch_name}`
- **No intermediate commits** by phase agents

This design is documented but never enforced.

---

## Root Cause Analysis

### Hypothesis 1: Missing Phase-Aware Commit Blocking in branch-guard.cjs (HIGH Confidence)

**Description**: The `branch-guard.cjs` hook is the only programmatic control point for `git commit` commands. Its logic only checks whether the commit targets main/master. It does not consult `active_workflow.current_phase` or `active_workflow.phases` to determine whether the current phase allows commits.

**Evidence**:
- `branch-guard.cjs` line 106-129: Only branch-name check, no phase check
- `state.json` provides `active_workflow.current_phase` (e.g., "06-implementation") and `active_workflow.phases` (e.g., `["01-requirements", "02-tracing", "05-test-strategy", "06-implementation", "16-quality-loop", "08-code-review"]`)
- The hook already reads `state.json` and has access to `active_workflow`

**Fix**: Add phase-aware logic after the main/master check. Read `active_workflow.current_phase` and `active_workflow.phases`, determine if the current phase is the last phase (or after workflow completion), and block commits during intermediate phases.

**Complexity**: LOW -- approximately 30-40 lines of additional logic in the existing hook, plus test cases.

### Hypothesis 2: Missing No-Commit Instruction in Agent Prompts (HIGH Confidence)

**Description**: The software-developer agent (`05-software-developer.md`), quality-loop-engineer agent (`16-quality-loop-engineer.md`), and qa-engineer agent (`07-qa-engineer.md`) all lack explicit instructions prohibiting git commit operations. Claude Code's default behavior is to commit completed work, and without an explicit counter-instruction, it will do so.

**Evidence**:
- `05-software-developer.md`: 760 lines, zero mentions of `git commit`, `git add`, or commit prohibition
- `16-quality-loop-engineer.md`: Zero matches for git commit patterns
- `07-qa-engineer.md`: Zero matches for git commit patterns
- The orchestrator's git lifecycle description (`00-sdlc-orchestrator.md` line 527+) states the orchestrator owns all branch operations, but this is never communicated to phase agents

**Fix**: Add a prominent "DO NOT COMMIT" section to `05-software-developer.md` and `16-quality-loop-engineer.md`, explaining that the orchestrator manages git operations and commits should only occur after all quality gates pass.

**Complexity**: LOW -- adding 5-10 lines to each agent file.

### Hypothesis 3: Orchestrator Assumes Non-Committing Agents (MEDIUM Confidence)

**Description**: The orchestrator design (`00-sdlc-orchestrator.md` Section 3a) defines a clean git lifecycle where only the orchestrator performs git operations. However, this assumption is encoded only in the orchestrator's own documentation -- it is never communicated to phase agents or enforced by hooks.

**Evidence**:
- `00-sdlc-orchestrator.md` line 529: "The orchestrator owns all branch operations -- phase agents work on the branch without awareness of branch management"
- This statement contradicts the reality: phase agents DO interact with git (via Claude Code default behavior)
- No agent receives a "the orchestrator manages git" instruction

**Fix**: This is addressed by Hypotheses 1 and 2. No separate fix needed -- the orchestrator's assumption becomes valid once hook enforcement and agent instructions are added.

### Root Cause Ranking

| Rank | Hypothesis | Confidence | Fix Priority |
|------|-----------|------------|--------------|
| 1 | H1: Missing phase-aware commit blocking in branch-guard.cjs | HIGH | PRIMARY (programmatic enforcement) |
| 2 | H2: Missing no-commit instruction in agent prompts | HIGH | PRIMARY (defense-in-depth) |
| 3 | H3: Orchestrator assumes non-committing agents | MEDIUM | COVERED by H1 + H2 |

### Suggested Fixes

**Fix 1 (Hook Enhancement)**: Enhance `branch-guard.cjs` to add phase-aware commit blocking:
- After the main/master check (line 106), add a new block:
- Read `active_workflow.current_phase` and `active_workflow.phases`
- Determine the last phase in the workflow (e.g., "08-code-review")
- If `current_phase` is NOT the last phase, BLOCK the commit with a helpful message
- If no `active_workflow` or no `phases` array, fail-open (allow)
- `git add` without `git commit` should remain ALLOWED (staging is harmless)

**Fix 2 (Agent Instructions)**: Add no-commit instructions to agent files:
- `05-software-developer.md`: Add prominent "DO NOT run git add or git commit" section in the MANDATORY ITERATION ENFORCEMENT area
- `16-quality-loop-engineer.md`: Add similar no-commit instruction

**Fix 3 (Error Message)**: When commit is blocked, provide a helpful message:
- Explain which phase the workflow is currently in
- Explain that commits are allowed only after all quality gates pass
- Suggest `git stash` as an alternative for saving work-in-progress
- Explain that the orchestrator handles the final merge

### Files Requiring Modification

| File | Change Type | Lines Affected |
|------|-------------|---------------|
| `src/claude/hooks/branch-guard.cjs` | Modify | Add ~40 lines after line 129 |
| `src/claude/agents/05-software-developer.md` | Modify | Add ~10 lines in mandatory section |
| `src/claude/agents/16-quality-loop-engineer.md` | Modify | Add ~10 lines |
| `src/claude/hooks/tests/branch-guard.test.cjs` | Modify | Add ~15 new test cases |

---

## Tracing Metadata

```json
{
  "tracing_completed_at": "2026-02-13T07:10:00Z",
  "sub_agents": ["T1-symptom-analyzer", "T2-execution-path-tracer", "T3-root-cause-identifier"],
  "discovery_report_used": "docs/project-discovery-report.md",
  "requirements_spec_used": "docs/requirements/BUG-0012-premature-git-commit/requirements-spec.md",
  "error_keywords": ["premature commit", "git add", "git commit", "branch-guard", "phase-aware", "feature branch"],
  "files_traced": [
    "src/claude/hooks/branch-guard.cjs",
    "src/claude/agents/05-software-developer.md",
    "src/claude/agents/16-quality-loop-engineer.md",
    "src/claude/agents/07-qa-engineer.md",
    "src/claude/agents/00-sdlc-orchestrator.md",
    "src/claude/commands/isdlc.md",
    "src/claude/hooks/tests/branch-guard.test.cjs",
    "src/claude/settings.json"
  ],
  "hypotheses_count": 3,
  "primary_hypothesis": "H1: Missing phase-aware commit blocking in branch-guard.cjs",
  "root_cause_confidence": "high",
  "fix_complexity": "low"
}
```
