# Trace Analysis: BUG-0015 / BUG-0016 — Hook False Positives

**Confidence**: HIGH
**Root Cause Count**: 2 (independent bugs)

---

## BUG-0015: branch-guard.cjs — Missing Branch Existence Check

### Root Cause

**File**: `src/claude/hooks/branch-guard.cjs`, lines 99-103 and 114-133

The branch-guard checks `state.active_workflow.git_branch.status === 'active'` (line 100) and then checks if `currentBranch === 'main'` (line 115). If on main with an active workflow branch in state, it blocks.

**The missing check**: Between the orchestrator merging a branch to main (`git merge && git branch -d`) and finalizing state.json (`active_workflow = null`), there is a window where:
- state.json still has `git_branch.status = 'active'`
- The branch has been deleted from git
- The user is on `main` (post-merge)
- Any commit attempt is falsely blocked

**Fix Location**: After line 103 (git_branch.status check), before line 115 (main/master check), add:
```javascript
// Verify the branch actually exists in git
const branchExists = branchExistsInGit(gitBranch.name);
if (!branchExists) {
    debugLog('Workflow branch does not exist in git, allowing (fail-open)');
    process.exit(0);
}
```

Where `branchExistsInGit(name)` runs `git rev-parse --verify refs/heads/{name}` and returns false on failure.

### Affected Code Path
```
main() -> readState() -> check git_branch.status -> getCurrentBranch()
  -> [MISSING: verifyBranchExists()] -> check currentBranch === main -> BLOCK
```

---

## BUG-0016: state-file-guard.cjs — Over-broad Inline Script Detection

### Root Cause

**File**: `src/claude/hooks/state-file-guard.cjs`, lines 38-51 (WRITE_PATTERNS array)

Line 43: `/\bnode\s+-e\b/` matches ANY `node -e` command.
Line 44: `/\bnode\s+--eval\b/` matches ANY `node --eval` command.

The `isWriteCommand()` function (line 79) returns `true` for any command matching any WRITE_PATTERN. When combined with `commandTargetsStateJson()` returning `true` (because state.json appears in the command), the hook blocks.

**Problem**: `node -e "console.log(JSON.parse(require('fs').readFileSync('.isdlc/state.json','utf8')).field)"` is a read-only command that gets blocked because `node -e` is treated as a write pattern unconditionally.

**Fix Location**: In `isWriteCommand()`, for inline script patterns (`node -e`, `node --eval`, `python -c`, `ruby -e`, `perl -e`), extract the script body and check it for actual write indicators (writeFileSync, writeFile, `>`, `>>`, open(...,'w')). If no write indicators found, do NOT match.

### Affected Code Path
```
check(ctx) -> commandTargetsStateJson() -> true
           -> isWriteCommand() -> WRITE_PATTERNS includes node -e -> true
           -> BLOCK (false positive for read-only scripts)
```

**Fix**: Replace the flat `node -e` pattern with a function `isInlineScriptWrite(command)` that:
1. Extracts the script body from the command
2. Checks the body for write indicators
3. Returns true only if write indicators are found

### Write Indicators for Inline Scripts
- `writeFileSync`, `writeFile`, `fs.write`
- `open(..., 'w')`, `open(..., 'a')` (Python)
- `File.write`, `File.open(..., 'w')` (Ruby)

---

## Fix Summary

| Bug | File | Change | Risk |
|-----|------|--------|------|
| BUG-0015 | branch-guard.cjs | Add `branchExistsInGit()` check before main block | LOW — new early-exit path, fail-open on error |
| BUG-0016 | state-file-guard.cjs | Replace flat node -e pattern with body inspection | MEDIUM — regex change, must preserve all existing blocks |

---

## Test Impact
- branch-guard: 31 existing tests (T1-T31), add ~4 new for branch existence
- state-file-guard: 15 integration + 13 unit = 28 existing, add ~8 new for script body inspection
