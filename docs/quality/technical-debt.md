# Technical Debt Assessment -- BUG-0009 Batch D Tech Debt

**Date**: 2026-02-15
**Phase**: 08-code-review
**Workflow**: Fix (BUG-0009-batch-d-tech-debt)

---

## 1. Technical Debt Resolved by This Batch

This batch resolves 4 pre-existing tech debt items from BACKLOG.md:

| Item | Description | Resolution |
|------|-------------|------------|
| 0.13 | Hardcoded phase prefixes scattered across 5 hook files | Centralized in PHASE_PREFIXES constant |
| 0.14 | Inconsistent null-check patterns (&&-chains vs optional chaining) | Standardized to optional chaining for property reads |
| 0.15 | detectPhaseDelegation() undocumented | Added comprehensive JSDoc (60 lines) |
| 0.16 | Dead code else branch in gate-blocker.cjs | Simplified to direct state.current_phase assignment |

---

## 2. New Technical Debt Introduced

**None.** All changes are non-behavioral refactoring. No new abstractions, no new dependencies, no deferred work.

---

## 3. Remaining Technical Debt Observations

### TD-001: Pre-existing test failures (workflow-finalizer)

**Type**: Test debt
**Impact**: Low (not caused by BUG-0009)
**Details**: 43 failures in workflow-finalizer.test.cjs -- pre-existing across all recent workflows.
**Recommendation**: Track as maintenance backlog item.

### TD-002: No ESLint configuration

**Type**: Tooling debt
**Impact**: Low
**Details**: No automated linting. Manual review substitutes.
**Recommendation**: Add ESLint in a future workflow (BACKLOG item).

### TD-003: Remaining inline phase strings in non-scoped files

**Type**: Consistency debt
**Impact**: Low
**Details**: Phase strings `'01-requirements'`, `'06-implementation'` remain in:
  - `log-skill-usage.cjs:87` (default fallback)
  - `plan-surfacer.cjs:30` (EARLY_PHASES set -- different usage pattern)
  - `menu-tracker.cjs:147` (phase check)
  - `common.cjs:1470,2453` (lookup maps)
These were deliberately excluded from BUG-0009 scope because they are in different usage contexts (sets, maps, files not targeted by the requirements).
**Recommendation**: Consider extending PHASE_PREFIXES adoption in a future housekeeping pass.

### TD-004: No coverage tooling

**Type**: Tooling debt
**Impact**: Medium
**Details**: No c8/istanbul/nyc configured. Coverage is assessed qualitatively, not quantitatively.
**Recommendation**: Add coverage tooling in a future workflow.

---

## 4. Technical Debt Summary

| Category | Resolved | New | Pre-Existing | Total Remaining |
|----------|----------|-----|-------------|----------------|
| Code consistency | 4 | 0 | 1 (remaining inline strings) | 1 |
| Testing | 0 | 0 | 1 (workflow-finalizer failures) | 1 |
| Tooling | 0 | 0 | 2 (ESLint, coverage) | 2 |
| **Total** | **4** | **0** | **4** | **4** |

**Net debt change**: -4 resolved, +0 introduced = **net reduction of 4 items**.
