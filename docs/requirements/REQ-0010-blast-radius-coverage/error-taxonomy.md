# Error Taxonomy: blast-radius-validator.cjs

**Version**: 1.0.0
**Date**: 2026-02-12
**Phase**: 04-design
**Traces to**: REQ-002 (graceful degradation), REQ-007 AC-007-04 (fail-open), NFR-002, Article X

---

## 1. Error Design Principle

**Fail-Open**: Every error path in the blast-radius-validator returns `{ decision: 'allow' }`. The hook MUST NEVER block the user's workflow due to its own internal errors. This is mandated by Constitutional Article X (Fail-Safe Defaults) and NFR-002.

**Diagnostic Output**: Errors are reported to stderr for observability. Silent skip (no output) is used when the hook legitimately does not apply. Warning/error messages are used when something unexpected occurs.

---

## 2. Error Classification

### 2.1 Silent Skip (No Output)

These are NOT errors -- the hook correctly determines it should not run.

| Code | Condition | Return | Output | Traces to |
|------|-----------|--------|--------|-----------|
| E-SKIP-01 | No active workflow (`!ctx.state?.active_workflow`) | `allow` | None | AC-002-03 |
| E-SKIP-02 | Not a feature workflow (`type !== 'feature'`) | `allow` | None | CON-005 |
| E-SKIP-03 | Not Phase 06 (`current_phase !== '06-implementation'`) | `allow` | None | AC-001-06 |
| E-SKIP-04 | No input context (`!ctx.input`) | `allow` | None | -- |
| E-SKIP-05 | No state context (`!ctx.state`) | `allow` | None | -- |

**Note**: E-SKIP-01 through E-SKIP-03 are handled by the `shouldActivate` guard in the dispatcher. The hook's `check()` function is never called. E-SKIP-04 and E-SKIP-05 are handled at the top of `check()` as defensive checks.

### 2.2 Graceful Degradation (Debug Log)

The hook has enough context to run but cannot complete validation. Returns `allow` with a debug log message.

| Code | Condition | Return | Output | Traces to |
|------|-----------|--------|--------|-----------|
| E-DEGRADE-01 | No `artifact_folder` in active_workflow | `allow` | debugLog: "no artifact_folder" | AC-002-03 |
| E-DEGRADE-02 | `impact-analysis.md` does not exist | `allow` | debugLog: "impact-analysis.md not found, skipping" | AC-002-01 |
| E-DEGRADE-03 | `impact-analysis.md` exists but has no parseable tables | `allow` | stderr: warning | AC-002-02 |
| E-DEGRADE-04 | Git diff returned null (empty set of files) | `allow` | This is not an error -- empty diff is valid | -- |

### 2.3 Parse Errors (Stderr Warning)

The input data exists but cannot be parsed correctly. Returns `allow` with stderr output.

| Code | Condition | Return | Output | Traces to |
|------|-----------|--------|--------|-----------|
| E-PARSE-01 | `parseImpactAnalysis()` returns null (non-string input) | `allow` | stderr: "blast-radius-validator: parse error in impact-analysis.md" | AC-002-04 |
| E-PARSE-02 | `parseBlastRadiusCoverage()` returns empty Map on malformed content | Continue (no deferred files) | debugLog: "blast-radius-coverage.md parse yielded no deferred files" | -- |

**Design Note**: E-PARSE-01 is the only true parse error. E-PARSE-02 is not an error per se -- the coverage file might legitimately have no deferred files (all files were covered). The hook treats a missing or unparseable coverage file as "no deferrals" rather than an error.

### 2.4 External Command Failures (Stderr Warning)

External commands (git) fail. Returns `allow` with stderr output.

| Code | Condition | Return | Output | Traces to |
|------|-----------|--------|--------|-----------|
| E-GIT-01 | `execSync` throws (not a git repo) | `allow` | stderr: "blast-radius-validator: git diff failed, skipping validation" | AC-007-04, NFR-002 |
| E-GIT-02 | `execSync` throws (no `main` branch) | `allow` | stderr: "blast-radius-validator: git diff failed, skipping validation" | AC-007-04, NFR-002 |
| E-GIT-03 | `execSync` times out (> 5s) | `allow` | stderr: "blast-radius-validator: git diff failed, skipping validation" | NFR-001, NFR-002 |
| E-GIT-04 | `execSync` throws (detached HEAD) | `allow` | stderr: "blast-radius-validator: git diff failed, skipping validation" | AC-007-04, NFR-002 |

**Note**: All git errors produce the same user-visible message. The specific error is logged via `debugLog` (visible only when `ISDLC_DEBUG=1`).

### 2.5 File I/O Errors (Stderr Warning)

File system operations fail unexpectedly. Returns `allow` with stderr output.

| Code | Condition | Return | Output | Traces to |
|------|-----------|--------|--------|-----------|
| E-IO-01 | `fs.readFileSync` throws on impact-analysis.md (permission denied, encoding error) | `allow` | stderr: "blast-radius-validator: error reading impact-analysis.md" | AC-007-04, NFR-002 |
| E-IO-02 | `fs.readFileSync` throws on blast-radius-coverage.md | Continue (no deferred files) | debugLog: "error reading blast-radius-coverage.md" | -- |

### 2.6 Uncaught Exceptions (Top-Level Catch)

Any error not caught by specific handlers. Returns `allow` with debug log.

| Code | Condition | Return | Output | Traces to |
|------|-----------|--------|--------|-----------|
| E-UNCAUGHT-01 | Any unhandled exception in `check()` | `allow` | debugLog: "unexpected error: {message}" | AC-007-04, Article X |

---

## 3. Blocking Conditions (Non-Error)

These are NOT errors -- they are the hook's primary enforcement function. The hook blocks when validation succeeds but coverage is incomplete.

| Code | Condition | Return | Output | Traces to |
|------|-----------|--------|--------|-----------|
| B-BLOCK-01 | One or more affected files are unaddressed | `block` | stopReason: formatted block message listing unaddressed files | AC-001-04, AC-005-02, AC-005-04 |

---

## 4. Allow Conditions (Non-Error)

The hook completes successfully and allows the operation.

| Code | Condition | Return | Output | Traces to |
|------|-----------|--------|--------|-----------|
| A-ALLOW-01 | All affected files are covered or deferred | `allow` | logHookEvent: "allow" with coverage stats | AC-001-05 |
| A-ALLOW-02 | No affected files in impact-analysis.md | `allow` | stderr: "no affected files found" | AC-002-02 |

---

## 5. Error Flow Diagram

```
check(ctx) entry
    |
    +-- ctx.input missing? -----> E-SKIP-04: allow (silent)
    +-- ctx.state missing? -----> E-SKIP-05: allow (silent)
    +-- no active_workflow? ----> E-SKIP-01: allow (silent) [via shouldActivate]
    +-- not feature? -----------> E-SKIP-02: allow (silent) [via shouldActivate]
    +-- not Phase 06? ----------> E-SKIP-03: allow (silent) [via shouldActivate]
    +-- no artifact_folder? ----> E-DEGRADE-01: allow (debug)
    |
    +-- Read impact-analysis.md
    |   +-- file missing? ------> E-DEGRADE-02: allow (debug)
    |   +-- read error? --------> E-IO-01: allow (stderr)
    |   +-- parse returns null? -> E-PARSE-01: allow (stderr)
    |   +-- parse returns []? ---> A-ALLOW-02: allow (no files)
    |
    +-- Run git diff
    |   +-- git fails? ---------> E-GIT-01/02/03/04: allow (stderr)
    |
    +-- Read blast-radius-coverage.md
    |   +-- file missing? ------> continue (no deferred)
    |   +-- read error? --------> E-IO-02: continue (no deferred, debug)
    |   +-- parse empty? -------> E-PARSE-02: continue (no deferred, debug)
    |
    +-- Build coverage report
    |   +-- unaddressed > 0? ---> B-BLOCK-01: block (stopReason)
    |   +-- all addressed? -----> A-ALLOW-01: allow (log event)
    |
    +-- Uncaught exception? ----> E-UNCAUGHT-01: allow (debug)
```

---

## 6. Stderr Message Format

All stderr messages follow the existing hook pattern: `{hook-name}: {message}`.

```
blast-radius-validator: impact-analysis.md not found, skipping validation
blast-radius-validator: parse error in impact-analysis.md (fail-open)
blast-radius-validator: git diff failed, skipping validation
blast-radius-validator: error reading impact-analysis.md: {error.message}
blast-radius-validator: no affected files found in impact-analysis.md
```

**Debug messages** (only visible when `ISDLC_DEBUG=1`):

```
blast-radius-validator: no artifact_folder in active workflow
blast-radius-validator: blast-radius-coverage.md not found (no deferred files)
blast-radius-validator: git diff failed: {error.message}
blast-radius-validator: unexpected error: {error.message}
blast-radius-validator: coverage result - total: N, covered: N, deferred: N, unaddressed: N
```

---

## 7. Block Message Format (B-BLOCK-01)

```
BLAST RADIUS COVERAGE INCOMPLETE: 3 of 8 affected files are unaddressed.

  - src/claude/hooks/dispatchers/pre-task-dispatcher.cjs (expected: MODIFY)
  - src/claude/agents/05-software-developer.md (expected: MODIFY)
  - src/claude/hooks/config/iteration-requirements.json (expected: MODIFY)

Coverage: 5 covered, 0 deferred, 3 unaddressed

To resolve:
  1. Modify the unaddressed files as indicated by impact analysis, OR
  2. Add deferral rationale for each file in blast-radius-coverage.md:
     | `file/path` | CHANGE_TYPE | deferred | Rationale for deferral |

Generate blast-radius-coverage.md with a complete checklist of all 8 affected files before advancing.
```

---

## 8. logHookEvent Payloads

```javascript
// On successful allow (coverage complete)
logHookEvent('blast-radius-validator', 'allow', {
    total: 8,
    covered: 6,
    deferred: 2,
    reason: 'All affected files addressed'
});

// On block (unaddressed files)
logHookEvent('blast-radius-validator', 'block', {
    total: 8,
    unaddressed: 3,
    files: ['src/hooks/foo.cjs', 'src/agents/bar.md', 'src/config/baz.json'],
    reason: 'Unaddressed files in blast radius'
});

// On skip (graceful degradation)
logHookEvent('blast-radius-validator', 'skip', {
    reason: 'impact-analysis.md not found'
});
```

---

## 9. Traceability

| Error Code | Requirement | AC | Article |
|-----------|-------------|-----|---------|
| E-SKIP-01 through E-SKIP-05 | REQ-002 | AC-002-03 | -- |
| E-DEGRADE-01 | REQ-002 | AC-002-03 | -- |
| E-DEGRADE-02 | REQ-002 | AC-002-01 | Article X |
| E-DEGRADE-03 | REQ-002 | AC-002-02 | Article X |
| E-PARSE-01 | REQ-002 | AC-002-04 | Article X |
| E-GIT-01 through E-GIT-04 | REQ-007 | AC-007-04 | Article X |
| E-IO-01, E-IO-02 | REQ-007 | AC-007-04 | Article X |
| E-UNCAUGHT-01 | REQ-007 | AC-007-04 | Article X |
| B-BLOCK-01 | REQ-001, REQ-005 | AC-001-04, AC-005-02, AC-005-04 | Article IX |
| A-ALLOW-01 | REQ-001 | AC-001-05 | -- |
| A-ALLOW-02 | REQ-002 | AC-002-02 | -- |
