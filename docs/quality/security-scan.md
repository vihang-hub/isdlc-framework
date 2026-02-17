# Security Scan: BUG-0021-GH-5

**Phase**: 16-quality-loop
**Date**: 2026-02-17
**Fix**: delegation-gate infinite loop on /isdlc analyze -- Phase A carve-out (GitHub #5)

## SAST Scan (QL-008)

**Tool**: Manual pattern-based review (no Semgrep/CodeQL configured)
**Files scanned**: 4 changed files (2 hooks + 2 test files)

### Results

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | PASS |
| HIGH | 0 | PASS |
| MEDIUM | 0 | PASS |
| LOW | 0 | PASS |

### BUG-0021 Security Assessment

| Check | Result | Notes |
|-------|--------|-------|
| Command injection | NONE | `EXEMPT_ACTIONS` is a hardcoded `Set` -- no external input modifies it |
| Regex denial of service (ReDoS) | NONE | Regex `^(?:--?\w+\s+)*(\w+)` operates on bounded tool input, not user-controlled raw input; pattern is non-catastrophic |
| Prototype pollution | NONE | No dynamic property access on user input |
| `eval()` / `Function()` | NONE | Not used |
| Shell command execution | NONE | Not used (`child_process` only in test files for subprocess spawning) |
| Hardcoded secrets | NONE | Only contains action names ("analyze") |
| Unvalidated require | NONE | All requires are static |
| Information disclosure | NONE | `debugLog()` output goes to stderr only when `ISDLC_DEBUG` is set |
| Fail-open bypass | ACCEPTABLE | `process.exit(0)` on all paths is intentional fail-open design |
| Defense-in-depth gap | NONE | Both enforcer (skip marker) AND gate (auto-clear) handle exempt actions independently |

### Attack Surface Analysis

The changes add a new code path (exempt action bypass) to two hooks:

1. **skill-delegation-enforcer.cjs**: If `args` contains an exempt action word as its first non-flag token, the hook exits without writing a `pending_delegation` marker. This is safe because:
   - The `args` value comes from Claude's structured `tool_input`, not raw user text
   - The exempt set is hardcoded and immutable at runtime
   - The regex match only extracts word characters (`\w+`), preventing injection

2. **delegation-gate.cjs**: If a pending marker's `args` field contains an exempt action, the gate auto-clears without blocking. This is safe because:
   - The `pending.args` was written by the enforcer (trusted internal state)
   - Auto-clear calls `clearPendingDelegation()` which removes the marker file
   - Error count is properly reset to prevent stale error accumulation

## Dependency Audit (QL-009)

```
$ npm audit
found 0 vulnerabilities
```

| Check | Result |
|-------|--------|
| Total vulnerabilities | 0 |
| New dependencies added | None |
| Dependency changes | None |

## Verdict

**PASS** -- Zero vulnerabilities across all severity levels. No new security surface introduced by BUG-0021 changes. Defense-in-depth pattern ensures both hooks independently handle the exempt action case.
