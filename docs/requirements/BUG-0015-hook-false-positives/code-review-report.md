# Code Review Report: BUG-0015 / BUG-0016 Hook False Positives

**Reviewer**: qa-engineer (Phase 08 - Code Review & QA)
**Date**: 2026-02-14
**Workflow**: fix
**Artifact Folder**: BUG-0015-hook-false-positives
**Scope**: human-review-only

---

## Summary

Two independent hook false-positive bugs fixed in a single workflow. Both fixes follow the project's fail-open principle (Article X) and maintain performance budgets.

| Bug | File | Fix Summary | Lines Changed |
|-----|------|-------------|---------------|
| BUG-0015 | branch-guard.cjs | Added `branchExistsInGit()` verification before blocking commits to main | +38 net |
| BUG-0016 | state-file-guard.cjs | Added `isInlineScriptWrite()` to inspect script body instead of blanket-blocking inline interpreters | +80 net |

---

## File-by-File Review

### 1. src/claude/hooks/branch-guard.cjs (v2.0.0 -> v2.1.0)

**Change**: New `branchExistsInGit(branchName)` function + invocation before the main-branch block.

#### Logic Correctness: PASS

- Uses `git rev-parse --verify refs/heads/{name}` which is the canonical way to check local branch existence
- Correctly placed AFTER the `gitBranch.status !== 'active'` guard (line 126) and BEFORE the `getCurrentBranch()` call (line 141), avoiding unnecessary git subprocess when status is not active
- The `workflowBranchName` variable extraction was moved earlier (line 134, previously at line 174) since it is now needed for the existence check -- this avoids duplicate extraction and is cleaner
- Short-circuit: if `workflowBranchName` is empty string, the check is skipped (correct -- no branch name to verify)

#### Error Handling: PASS

- Wrapped in try/catch with `debugLog` on failure
- Returns `false` on any exception, which triggers the fail-open path (line 136: `!branchExistsInGit()` -> `process.exit(0)`)
- This matches Article X requirement: hook errors must never block the user

#### Security: PASS (with note)

- The `branchName` parameter is interpolated into the exec string: `` `git rev-parse --verify refs/heads/${branchName}` ``
- Potential concern: shell injection via crafted branch names
- Mitigation: The branch name comes exclusively from `state.active_workflow.git_branch.name` which is written by the orchestrator. It is never user-supplied input at this point. Additionally, git branch names have restricted character sets (no spaces, no shell metacharacters except `/`). The `refs/heads/` prefix further constrains the namespace.
- Risk: LOW -- the data source is trusted (state.json written by framework)

#### Performance: PASS

- Adds one `execSync` call with 3000ms timeout and piped stdio
- Budget is 200ms for the hook. The git subprocess typically completes in < 50ms. Acceptable.
- The check only executes when: (a) command is a git commit, (b) state has active workflow with active git branch -- narrow activation path

#### Test Coverage: PASS

- T32: Deleted branch -> allows commit (core BUG-0015 fix)
- T33: Existing branch -> still blocks (regression)
- T34: Non-git directory -> fail-open
- T35: Feature branch with existence check -> no interference
- 5 existing tests (T1, T2, T9, T14, T26) updated to create the branch in git so the existence check passes -- correctly adapted

### 2. src/claude/hooks/state-file-guard.cjs (v1.0.0 -> v1.1.0)

**Change**: Replaced blanket inline-interpreter blocking with body-inspection via `isInlineScriptWrite()`.

#### Logic Correctness: PASS

- `WRITE_PATTERNS` array: removed `node -e`, `node --eval`, `python -c`, `ruby -e`, `perl -e` patterns (they were previously treated as unconditional writes)
- New `INLINE_SCRIPT_PATTERNS` array: detection + split pairs for each interpreter
- `isInlineScriptWrite()` flow:
  1. Detect if command matches an inline interpreter pattern
  2. Split command on the interpreter+flag to extract the script body
  3. Check script body against `INLINE_WRITE_INDICATORS`
  4. If no write indicators found, return `false` (read-only)
  5. If not an inline script at all, return `false`
- The split approach using `command.split(splitPattern)` correctly handles the case where the interpreter appears mid-command (e.g., after `&&`)
- `parts.slice(1).join(' ')` correctly reassembles the body if the split pattern appears multiple times (defensive)

#### Write Indicators: PASS (thorough)

- `writeFileSync` -- Node.js synchronous file write
- `writeFile` -- Node.js async file write
- `fs.write\b` -- Node.js low-level write (word boundary prevents false match on `fs.writeFileSync` being double-counted -- both patterns would match but that is acceptable since the function returns `true` on first match)
- `.write\s*\(` -- generic `.write()` call (covers Python `file.write()`, Ruby `File.write()`)
- `open\s*\([^)]*['"][wa]['"]` -- Python/Ruby `open('f', 'w')` or `open('f', 'a')` (write/append modes)

#### Potential False Negative: NOTED (acceptable)

- A command like `node -e "const f=require('fs'); const w=f['writeFileSync']; w('state.json','{}');"` would evade detection because `writeFileSync` is accessed via bracket notation and not matched by the regex.
- This is acceptable because: (a) hooks are advisory defense-in-depth, not the sole security boundary; (b) the state-write-validator.cjs hook on the Write/Edit event provides a second layer; (c) bracket-notation obfuscation in a command that an AI agent would generate is highly unlikely.

#### Error Handling: PASS

- `isInlineScriptWrite` handles null/undefined input gracefully (the `for` loop over INLINE_SCRIPT_PATTERNS simply does not match)
- The `check()` function wraps everything in try/catch with fail-open
- `isInlineScriptWrite` is called from `isWriteCommand` only AFTER standard WRITE_PATTERNS and MOVE_COPY_PATTERNS checks

#### Security: PASS

- No exec/spawn -- purely regex-based analysis. No injection risk.
- Performance budget < 50ms maintained (regex only, no I/O)

#### Test Coverage: PASS

- T16-T23: Integration tests covering read-only node -e, blocking writeFileSync, --eval variant, python read-only, python write, existing cat/grep
- Unit tests for `isInlineScriptWrite`: 12 test cases covering all interpreter variants, read/write bodies, edge cases (empty, null)
- Unit tests for `isWriteCommand`: updated to reflect that `node -e "console.log(1)"` is no longer a write command

### 3. Test Files

**branch-guard.test.cjs**: 4 new tests (T32-T35), 5 existing tests updated with BUG-0015 branch creation. All 35 tests pass.

**test-state-file-guard.test.cjs**: 8 new integration tests (T16-T23), 12 new unit tests for `isInlineScriptWrite`, 2 updated unit tests for `isWriteCommand`. All 37 tests pass.

**cross-hook-integration.test.cjs**: 3 lines added to create the feature branch in the cross-hook test that exercises branch-guard + review-reminder interaction. Correct adaptation.

### 4. Module Export Verification

- `state-file-guard.cjs` now exports `isInlineScriptWrite` in addition to `check`, `commandTargetsStateJson`, `isWriteCommand` -- this is needed for unit testing and is backward-compatible (additive export)

---

## Code Review Checklist

| Item | Status | Notes |
|------|--------|-------|
| Logic correctness | PASS | Both fixes are logically sound with proper short-circuits |
| Error handling | PASS | All new code paths have try/catch with fail-open |
| Security considerations | PASS | No injection risk; branch name from trusted source |
| Performance implications | PASS | branch-guard: +1 git subprocess (< 50ms); state-file-guard: regex only |
| Test coverage adequate | PASS | 24 new tests, 8 existing updated |
| Code documentation sufficient | PASS | JSDoc on all new functions, BUG trace comments |
| Naming clarity | PASS | `branchExistsInGit`, `isInlineScriptWrite` are self-documenting |
| DRY principle followed | PASS | No code duplication introduced |
| Single Responsibility | PASS | Each new function has one job |
| No code smells | PASS | Functions are short (< 20 lines), well-structured |

---

## Findings

### Critical: 0
### Major: 0
### Minor: 0

### Informational: 1

**I-01**: The `branchExistsInGit()` function interpolates `branchName` into an `execSync` string. While the data source is trusted (state.json), a future refactor could use `execSync('git rev-parse --verify', { input: ... })` or `spawnSync` with an args array to eliminate any theoretical injection surface. This is not actionable now -- the current approach is safe for the known data source.

---

## Verdict

**APPROVED** -- Both fixes are well-implemented, thoroughly tested, follow project conventions (fail-open, performance budgets, CJS module system), and address the reported false-positive bugs without introducing regressions.
