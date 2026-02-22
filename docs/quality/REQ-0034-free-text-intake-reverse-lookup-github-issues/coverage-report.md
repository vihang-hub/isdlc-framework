# Coverage Report: REQ-0034 Free-Text Intake Reverse-Lookup GitHub Issues

**Date**: 2026-02-22
**Test File**: `src/claude/hooks/tests/test-three-verb-utils.test.cjs`
**Source File**: `src/claude/hooks/lib/three-verb-utils.cjs`

---

## Summary

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Line coverage | 96.83% | 80% | PASS |
| Branch coverage | 93.01% | 80% | PASS |
| Function coverage | 97.67% | 80% | PASS |

## Test Counts

| Category | Count |
|----------|-------|
| Total tests | 306 |
| Passing | 306 |
| Failing | 0 |
| Skipped | 0 |

## New REQ-0034 Function Coverage

### checkGhAvailability()
- Lines: 100% (all branches tested: success, not_installed, not_authenticated)
- Branches: 100% (2 try/catch paths + success path)

### searchGitHubIssues(query, options?)
- Lines: 100% (success path, timeout, command_error, parse_error)
- Branches: 100% (e.killed check, JSON.parse success/failure, default options)

### createGitHubIssue(title, body?)
- Lines: 100% (success path, command failure, URL parse failure)
- Branches: 100% (default body, URL match/no-match, execSync success/failure)

## Coverage by Module

| File | Lines | Branches | Functions |
|------|-------|----------|-----------|
| `three-verb-utils.cjs` | 96.83% | 93.01% | 97.67% |

Coverage measured across all 306 tests covering the entire `three-verb-utils.cjs` module,
including the 3 new REQ-0034 functions.
