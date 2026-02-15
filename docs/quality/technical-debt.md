# Technical Debt Assessment: BUG-0004-orchestrator-overrides-conversational-opening

**Date**: 2026-02-15
**Phase**: 08-code-review
**Workflow**: Bug Fix (BUG-0004)

---

## 1. New Technical Debt Introduced

None. This bug fix is a clean text replacement with no new debt.

## 2. Technical Debt Resolved by This Fix

### TD-RESOLVED-001: Stale protocol copy in orchestrator

**Type**: Consistency debt
**Resolved**: Yes
**Details**: The orchestrator had a stale copy of the Phase 01 delegation protocol (the old 3-question INTERACTIVE PROTOCOL from pre-REQ-0014). This fix replaces it with the current conversational protocol matching REQ-0014. This was a form of technical debt created during REQ-0014 when the analyst's protocol was updated but the orchestrator's copy was not.

## 3. Existing Technical Debt Observations

### TD-001: Pre-existing test failures (43 hook + 1 E2E)

**Type**: Test debt
**Impact**: Low (not caused by BUG-0004; 0 new failures introduced)
**Details**: 44 pre-existing failures across 3 suites:
  - `cleanup-completed-workflow.test.cjs`: 28 failures (hook not yet implemented)
  - `workflow-finalizer.test.cjs`: 15 failures (hook not yet implemented)
  - `cli-lifecycle.test.js`: 1 failure (missing test-helpers.js import)
**Recommendation**: Existing documented debt. No action for this fix.

### TD-002: Delegation table references "INTERACTIVE PROTOCOL" (line 984)

**Type**: Naming consistency debt
**Impact**: Low (cosmetic -- does not affect behavior)
**Details**: Line 984 of `00-sdlc-orchestrator.md` still says `INTERACTIVE PROTOCOL (below)` while the block header at line 1007 now reads `CONVERSATIONAL PROTOCOL`. This is a residual inconsistency from the fix that renamed the block header but did not update the table reference.
**Recommendation**: Fix before merge. Single-word replacement on line 984.

### TD-003: Protocol text duplication between orchestrator and analyst

**Type**: Duplication debt
**Impact**: Low (architecturally necessary)
**Details**: The conversational protocol text exists in two places: `01-requirements-analyst.md` (lines 23-65) and `00-sdlc-orchestrator.md` (lines 1008-1050). The orchestrator cannot dynamically include the analyst's file content at delegation time, so the duplication is architecturally necessary. Future changes to the protocol must update both files.
**Recommendation**: This is a known trade-off. Consider adding a comment in both files noting the duplication and cross-referencing the other file. No immediate action required.

### TD-004: No ESLint configuration

**Type**: Tooling debt
**Impact**: Low
**Details**: Pre-existing. No `eslint.config.js`. Manual review substitutes for automated linting.
**Recommendation**: Track as backlog item.

### TD-005: No mutation testing framework

**Type**: Testing debt
**Impact**: Low
**Details**: Pre-existing. No mutation testing framework installed.
**Recommendation**: Track as backlog item.

---

## 4. Technical Debt Summary

| Category | New Items | Resolved | Pre-Existing | Total Open |
|----------|-----------|----------|-------------|------------|
| Consistency | 0 | 1 (stale protocol) | 1 (table reference) | 1 |
| Duplication | 0 | 0 | 1 (protocol in 2 files) | 1 |
| Testing | 0 | 0 | 2 (failures, mutation) | 2 |
| Tooling | 0 | 0 | 1 (ESLint) | 1 |
| **Total** | **0** | **1** | **5** | **5** |

**New debt introduced by BUG-0004**: 0 items
**Debt resolved by BUG-0004**: 1 item (stale protocol copy)
**No functional, security, or performance debt introduced.**
