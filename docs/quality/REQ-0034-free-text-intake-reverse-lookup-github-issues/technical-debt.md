# Technical Debt: REQ-0034 Free-Text Intake Reverse-Lookup GitHub Issues

**Date:** 2026-02-22
**Phase:** 08 - Code Review & QA

---

## 1. Debt Items

### TD-001: Duplicated Shell Sanitization Logic

**Priority:** Low
**Effort:** Small (30 minutes)
**Location:** `src/claude/hooks/lib/three-verb-utils.cjs`, lines 192-196 and 238-247

The 4-character shell escaping chain (`\`, `"`, `$`, backtick) is duplicated across `searchGitHubIssues` (1x) and `createGitHubIssue` (2x: title and body). Extracting a `sanitizeForShell(str)` helper would:
- Reduce duplication from 12 lines to 4 lines + 3 calls
- Ensure future security fixes (e.g., newline escaping) apply uniformly
- Improve readability

**Mitigation:** Extract helper in next maintenance cycle. Not a correctness issue.

### TD-002: Dual Mock Pattern (childProcess vs execSync)

**Priority:** Low
**Effort:** Medium (1-2 hours)
**Location:** `src/claude/hooks/lib/three-verb-utils.cjs` and `src/claude/hooks/tests/test-three-verb-utils.test.cjs`

The REQ-0034 functions use `childProcess.execSync()` (module-level reference) while older functions use the destructured `execSync` (direct import). This creates two mock patterns in the test file:
- Old tests: Cannot easily mock `execSync` (destructured at import time)
- New tests: Use `t.mock.method(childProcess, 'execSync', ...)` which works correctly

This dual pattern is intentional (documented in implementation-notes.md) and does not affect correctness, but it means the codebase has two conventions for the same underlying call.

**Mitigation:** When older functions are refactored, migrate them to `childProcess.execSync()` for consistency. Not urgent.

### TD-003: Missing Newline/CR Escaping in Shell Sanitization

**Priority:** Low
**Effort:** Small (15 minutes)
**Location:** `src/claude/hooks/lib/three-verb-utils.cjs`, lines 192-196 and 238-247

Newline and carriage return characters are not stripped or escaped in the sanitization chain. While the `execSync` + `/bin/sh -c` execution context handles embedded newlines within double quotes, adding `.replace(/[\n\r]/g, ' ')` would be defense-in-depth.

**Mitigation:** Add newline stripping when TD-001 (sanitization helper extraction) is addressed.

---

## 2. Debt Summary

| Item | Priority | Effort | Risk if Unaddressed |
|------|----------|--------|-------------------|
| TD-001 | Low | Small | Inconsistent security fixes if sanitization needs updating |
| TD-002 | Low | Medium | Developer confusion about which mock pattern to use |
| TD-003 | Low | Small | Theoretical shell injection edge case |

**Total new debt introduced:** 3 items, all Low priority.
**Recommendation:** Bundle TD-001 and TD-003 into a single follow-up cleanup. TD-002 can be deferred to a broader refactoring effort.
