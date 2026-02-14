# Technical Debt Assessment: BUG-0015 / BUG-0016 Hook False Positives

**Date**: 2026-02-14
**Phase**: 08-code-review
**Workflow**: fix (BUG-0015-hook-false-positives)

---

## New Technical Debt

None introduced. Both fixes are minimal, targeted changes that reduce false positives without adding complexity.

## Existing Technical Debt Addressed

### TD-RESOLVED-01: Hook False Positives in Post-Merge Window (was HIGH)

- **Bug**: BUG-0015 -- branch-guard.cjs blocked commits to main after merge when state.json still showed active_workflow with status='active' for a deleted branch
- **Resolution**: Added `branchExistsInGit()` verification. If the branch no longer exists in git, the hook allows the commit (fail-open).
- **Net effect**: Reduces operational friction during the post-merge, pre-finalize window

### TD-RESOLVED-02: Overly Broad Inline Script Blocking (was MEDIUM)

- **Bug**: BUG-0016 -- state-file-guard.cjs treated ALL `node -e`, `python -c`, `ruby -e`, `perl -e` commands as writes, even read-only ones
- **Resolution**: Added `isInlineScriptWrite()` that inspects the script body for actual write operations
- **Net effect**: Read-only diagnostic commands (e.g., `node -e "console.log(JSON.parse(fs.readFileSync('.isdlc/state.json','utf8')).current_phase)"`) now pass through correctly

## Informational Notes

### I-01: Shell Interpolation in branchExistsInGit (LOW)

- **File**: `src/claude/hooks/branch-guard.cjs`, line 74
- **Description**: Branch name is interpolated into execSync template string. Data source is trusted (state.json written by orchestrator), and git branch name character restrictions prevent injection.
- **Recommendation**: Consider refactoring to `spawnSync(['git', 'rev-parse', '--verify', ...])` with args array in a future cleanup pass.
- **Priority**: Low -- no action needed now

## Summary

| Category | Count | Status |
|----------|-------|--------|
| New Debt | 0 | -- |
| Resolved Debt | 2 | CLOSED |
| Informational | 1 | Documented |

**Net Technical Debt Change**: -2 (two items resolved, zero introduced)
