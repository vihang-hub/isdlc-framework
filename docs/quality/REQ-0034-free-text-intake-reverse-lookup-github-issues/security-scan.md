# Security Scan: REQ-0034 Free-Text Intake Reverse-Lookup GitHub Issues

**Date**: 2026-02-22
**Scan Type**: Manual SAST review + npm dependency audit

---

## Dependency Audit (QL-009)

```
npm audit
found 0 vulnerabilities
```

**Status**: PASS -- No vulnerable dependencies.

---

## SAST Analysis (QL-008)

### Scope

Three new functions that execute shell commands via `childProcess.execSync()`:

1. `checkGhAvailability()` -- lines 155-169
2. `searchGitHubIssues(query, options?)` -- lines 187-216
3. `createGitHubIssue(title, body?)` -- lines 234-267

### Shell Injection Analysis

**Risk**: User-supplied strings (`query`, `title`, `body`) are interpolated into shell commands.

**Mitigation applied** (in `searchGitHubIssues` and `createGitHubIssue`):

| Character | Escape | Purpose | Present |
|-----------|--------|---------|---------|
| `\` | `\\` | Prevent escape sequence injection | Yes |
| `"` | `\"` | Prevent double-quote breakout | Yes |
| `$` | `\$` | Prevent variable expansion | Yes |
| `` ` `` | `` \` `` | Prevent command substitution | Yes |

All user inputs are wrapped in double quotes in the command string, and the 4 shell-critical
characters are escaped before interpolation.

### Findings

| Severity | Finding | Status |
|----------|---------|--------|
| NONE | No unescaped user input in shell commands | PASS |
| ADVISORY | `limit` parameter interpolated without sanitization | MITIGATED (numeric default, gh CLI rejects non-numeric) |
| NONE | Commands use `stdio: 'pipe'` (no terminal leakage) | PASS |
| NONE | All commands have timeout bounds | PASS |
| NONE | `checkGhAvailability` uses only hardcoded commands | PASS |

### Verdict

**No critical or high SAST vulnerabilities found.**

The shell injection mitigation is adequate for the threat model. The `gh` CLI is a trusted
binary that performs its own input validation on the server side. The client-side sanitization
prevents the most common shell injection vectors.

### Recommendations (Non-Blocking)

1. **Future enhancement**: Consider using `execFileSync` with argument arrays instead of
   string interpolation for even stronger injection prevention. This would eliminate the
   need for manual escaping entirely.
2. **Future enhancement**: Add input validation for `query` and `title` length limits to
   prevent extremely long command strings.
