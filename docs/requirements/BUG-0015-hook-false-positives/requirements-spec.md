# Bug Report: BUG-0015 / BUG-0016 — Hook False Positives

**ID**: BUG-0015 (combined with BUG-0016)
**Severity**: Medium
**Priority**: High
**Component**: Hook system (branch-guard.cjs, state-file-guard.cjs)
**Reported**: 2026-02-14

---

## Bug Descriptions

### BUG-0015: branch-guard blocks commits to main after merge

**Summary**: After a feature/bugfix branch is merged and deleted, but before the orchestrator finalizes state.json (setting `active_workflow` to null), the branch-guard hook blocks commits to main. This happens because branch-guard checks `state.active_workflow.git_branch.status === 'active'` and the workflow branch name exists in state -- but the branch itself has already been deleted from git.

**Reproduction Steps**:
1. Complete a workflow with `requires_branch: true`
2. Orchestrator merges branch to main and deletes the branch
3. Before finalize clears `active_workflow`, attempt a commit on main
4. branch-guard reads state, sees `git_branch.status === 'active'`, and blocks

**Expected**: Commit should succeed because the branch no longer exists in git.

**Actual**: `COMMIT TO MAIN BLOCKED: You are attempting to commit to 'main' while an active workflow has a feature branch 'feature/REQ-XXXX-name'`

**Root Cause**: branch-guard trusts state.json `git_branch.status` without verifying the branch actually exists in the git repository. During the window between branch deletion and state finalization, the guard produces false positives.

**Fix**: Add `git rev-parse --verify refs/heads/{branch_name}` check. If the branch does not exist in git, allow the commit (fail-open).

### BUG-0016: state-file-guard blocks read-only node -e commands

**Summary**: The state-file-guard hook blocks `node -e` commands that reference `.isdlc/state.json` even when the script body only reads the file (e.g., `node -e "console.log(JSON.parse(require('fs').readFileSync('.isdlc/state.json','utf8')).current_phase)"`). This is because `node -e` and `node --eval` are unconditionally listed in `WRITE_PATTERNS`.

**Reproduction Steps**:
1. Run any `node -e` command that references state.json, e.g.:
   `node -e "console.log(JSON.parse(require('fs').readFileSync('.isdlc/state.json','utf8')).state_version)"`
2. state-file-guard blocks the command

**Expected**: Read-only `node -e` commands should be allowed.

**Actual**: `BASH STATE GUARD: Direct writes to state.json via Bash are not permitted.`

**Root Cause**: `WRITE_PATTERNS` includes `/\bnode\s+-e\b/` and `/\bnode\s+--eval\b/` as write indicators. These patterns match ANY `node -e` command regardless of whether the inline script actually writes to the file. The guard should inspect the script body for actual write operations (writeFileSync, writeFile, fs.write, `>`, etc.) before blocking.

**Fix**: For `node -e` / `node --eval` commands, extract the script body and check it for actual write patterns. Only block if the script body contains write operations targeting state.json.

---

## Functional Requirements

### FR-01: Branch Existence Verification
The branch-guard hook MUST verify that the workflow branch actually exists in the local git repository before blocking a commit to main.

### FR-02: Fail-Open on Missing Branch
If `git rev-parse --verify` indicates the branch does not exist, branch-guard MUST allow the commit (fail-open behavior).

### FR-03: Node Inline Script Body Inspection
The state-file-guard hook MUST inspect the script body of `node -e` / `node --eval` commands for actual write operations before deciding to block.

### FR-04: Read-Only Inline Scripts Allowed
`node -e` commands that only read state.json (readFileSync, readFile, JSON.parse, console.log) MUST be allowed through.

### FR-05: Write Inline Scripts Still Blocked
`node -e` commands that contain write operations (writeFileSync, writeFile, fs.write, `>`, `>>`) targeting state.json MUST still be blocked.

### FR-06: Python/Ruby/Perl Inline Script Consistency
Apply the same script-body inspection pattern to `python -c`, `ruby -e`, and `perl -e` commands for consistency.

---

## Non-Functional Requirements

### NFR-01: Performance
- branch-guard git check MUST complete within 200ms (existing budget)
- state-file-guard regex inspection MUST complete within 50ms (existing budget)

### NFR-02: Fail-Open Safety
Both fixes MUST maintain fail-open behavior: any error in the new logic results in allowing the command (not blocking).

### NFR-03: Backward Compatibility
All existing test cases for both hooks MUST continue to pass. No behavioral regression for currently-working scenarios.

---

## Acceptance Criteria

### BUG-0015 (branch-guard)
- **AC-01**: When `git_branch.status === 'active'` but the branch does not exist in git, commits to main are ALLOWED
- **AC-02**: When `git_branch.status === 'active'` AND the branch exists in git, commits to main are still BLOCKED (existing behavior preserved)
- **AC-03**: `git rev-parse --verify` failure (timeout, not a git repo) results in fail-open (allow)
- **AC-04**: The git check adds < 50ms overhead (within the existing 200ms budget)

### BUG-0016 (state-file-guard)
- **AC-05**: `node -e "console.log(JSON.parse(require('fs').readFileSync('.isdlc/state.json','utf8')).field)"` is ALLOWED
- **AC-06**: `node -e "require('fs').writeFileSync('.isdlc/state.json', '{}')"` is BLOCKED
- **AC-07**: `node -e "require('fs').readFileSync('.isdlc/state.json','utf8')"` (pure read) is ALLOWED
- **AC-08**: `node --eval "require('fs').writeFile('.isdlc/state.json', '{}', ()=>{})"` is BLOCKED
- **AC-09**: `node -e` commands that do NOT reference state.json are unaffected (not checked)
- **AC-10**: `python -c` / `ruby -e` / `perl -e` read-only commands referencing state.json are ALLOWED
- **AC-11**: `python -c` / `ruby -e` / `perl -e` commands with write operations are still BLOCKED
- **AC-12**: Commands without inline script markers (plain `cat`, `grep`) continue to work as before

### Cross-cutting
- **AC-13**: All existing branch-guard tests pass (zero regressions)
- **AC-14**: All existing state-file-guard tests pass (zero regressions)
- **AC-15**: New tests added for each AC above

---

## Affected Files

| File | Change Type |
|------|-------------|
| `src/claude/hooks/branch-guard.cjs` | Modify: add branch existence check |
| `src/claude/hooks/state-file-guard.cjs` | Modify: add inline script body inspection |
| `src/claude/hooks/tests/branch-guard.test.cjs` | Add: new test cases |
| `src/claude/hooks/tests/state-file-guard.test.cjs` | Add: new test cases |

---

## Out of Scope
- Changing the overall hook architecture
- Modifying other hooks (only branch-guard and state-file-guard)
- Changing the state.json schema
