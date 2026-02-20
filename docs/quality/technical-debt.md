# Technical Debt Inventory

**Project:** iSDLC Framework
**Workflow:** REQ-0031-GH-60-61-build-consumption (feature)
**Phase:** 08 - Code Review & QA
**Date:** 2026-02-20
**Updated by:** QA Engineer (Phase 08)

---

## 1. New Technical Debt (This Feature)

### TD-GH60-001: init-and-phase-01 Deprecation (GH-60)

**Severity**: Low
**Location**: `src/claude/agents/00-sdlc-orchestrator.md`
**Description**: The `init-and-phase-01` orchestrator mode is deprecated in favor of `init-only`. The old mode still works for backward compatibility but emits a stderr deprecation warning. It should be removed in v0.3.0 after all callers have migrated.
**Recommended Action**: Remove init-and-phase-01 mode after 2 release cycles (target: v0.3.0).
**Effort**: Small (remove deprecated code path and related tests)
**Constitutional Impact**: None (backward compatibility preserved during transition)

### TD-GH61-001: execSync in checkBlastRadiusStaleness

**Severity**: Low
**Location**: `src/claude/hooks/lib/three-verb-utils.cjs`, line 677
**Description**: `checkBlastRadiusStaleness` uses `execSync('git diff --name-only ...')` when `changedFiles` is null. This is a synchronous subprocess call in a utility function. While mitigated by a 5000ms timeout and try/catch, the caller (isdlc.md Step 4b) currently passes `null`, meaning every staleness check triggers a subprocess.
**Recommended Action**: Update isdlc.md Step 4b to pre-compute `changedFiles` before calling `checkBlastRadiusStaleness`, passing the array directly. This eliminates the subprocess call and makes the function purely computational.
**Effort**: Small (1 hour)
**Constitutional Impact**: None (function remains correct; optimization only)

### TD-GH61-002: Hash Validation Before Command Interpolation

**Severity**: Low
**Location**: `src/claude/hooks/lib/three-verb-utils.cjs`, line 677
**Description**: The `meta.codebase_hash` value is interpolated directly into the `git diff` command without format validation. While the hash is framework-managed (written by the orchestrator from `git rev-parse --short HEAD`), a corrupted meta.json could theoretically contain shell metacharacters.
**Recommended Action**: Add a regex validation (`/^[0-9a-f]{7,40}$/`) before using the hash in the command string. Alternatively, rely on the caller to pre-compute changed files (resolves TD-GH61-001 and this simultaneously).
**Effort**: Small (15 minutes)
**Constitutional Impact**: Improves Article III (Security by Design) compliance

---

## 2. Resolved Technical Debt (This Feature)

### TD-GH60-002: Plan-Tracking Test TC-04 (RESOLVED)

**Severity**: Info
**Location**: `lib/plan-tracking.test.js`
**Description**: TC-04 was testing for strikethrough instructions in STEP 2, which the GH-60 init-only design intentionally removed. The test was updated during Phase 16 to validate the new behavior (all tasks start as pending).
**Status**: RESOLVED in Phase 16 quality loop

---

## 3. Pre-Existing Technical Debt (Not Changed by This Feature)

### TD-PRE-001: 4 Pre-Existing Test Failures

**Severity**: Low
**Description**: 4 tests fail across the full suite, all pre-existing and unrelated to feature work:
1. **TC-E09**: README.md agent count (48 expected, 61 actual)
2. **T07**: STEP 1 description mentions branch creation before Phase 01
3. **TC-07**: STEP 4 contains task cleanup instructions
4. **TC-13-01**: Exactly 48 agent markdown files exist (48 expected, 61 actual)

Note: This was 5 failures on main; this feature resolved one (TC-04 plan-tracking).

### TD-PRE-002: No Mutation Testing

**Severity**: Low
**Description**: No mutation testing framework (Stryker, etc.) is configured. Article XI requires mutation score >= 80%.

### TD-PRE-003: No Native Coverage Reporting

**Severity**: Low
**Description**: Node.js built-in `node:test` does not provide native coverage reporting. Coverage is estimated from test case analysis.

### TD-PRE-004: No Automated Linting

**Severity**: Medium (pre-existing, noted again)
**Location**: Project-wide
**Description**: No ESLint or TypeScript configuration. All static analysis is manual during code review.
**Recommended Action**: Configure ESLint with `eslint:recommended` ruleset.

### TD-PRE-005: checkBlastRadiusStaleness Cyclomatic Complexity at Threshold

**Severity**: Low
**Description**: `checkBlastRadiusStaleness()` has estimated cyclomatic complexity of 10. Within bounds (< 15) but near the review threshold. If the function grows further, consider extracting the severity determination into a separate helper.

---

## 4. Technical Debt Ledger

| Category | Count | Details |
|----------|-------|---------|
| New debt items | 3 | TD-GH60-001 (deprecation), TD-GH61-001 (execSync), TD-GH61-002 (hash validation) |
| Resolved debt items | 1 | TD-GH60-002 (TC-04 test) |
| Pre-existing debt | 5 | TD-PRE-001 through TD-PRE-005 |
| Net change | +2 | All new items are low-severity |

---

## 5. Summary

This feature introduces minimal, low-severity technical debt. The three new items are: (1) a planned deprecation with a clear removal timeline, (2) an execSync call that could be eliminated by caller-side computation, and (3) a minor defensive validation. None are blockers. One pre-existing debt item was resolved (TC-04 plan-tracking test). The overall debt trend is manageable and well-documented.
