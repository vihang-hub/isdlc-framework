# Technical Debt Inventory

**Project:** iSDLC Framework
**Workflow:** sizing-in-analyze-GH-57 (feature)
**Phase:** 08 - Code Review & QA
**Date:** 2026-02-20

---

## 1. New Technical Debt (This Feature)

### TD-GH57-001: computeStartPhase() Approaching Complexity Threshold

**Severity**: Low
**Location**: `src/claude/hooks/lib/three-verb-utils.cjs`, function `computeStartPhase()` (lines 393-488)
**Description**: The function has grown to 96 lines with 7 if-statements (estimated cyclomatic complexity: 8). The new Step 3.5 (light-sizing detection) adds one conditional block. While still within the < 10 threshold, future additions should consider extracting the light-sizing branch into a named helper function.
**Recommended Action**: On the next feature that touches this function, extract Step 3.5 into `handleLightSizedAnalysis(valid, meta, workflowPhases, warnings)`.
**Effort**: Small (< 1 hour)

### TD-GH57-002: No Automated Linting or Type Checking

**Severity**: Medium (pre-existing)
**Location**: Project-wide
**Description**: The project has no ESLint configuration and no TypeScript. All static analysis is done manually during code review. This pre-dates GH-57 but is noted because this feature adds 37 lines of new production code without automated static checks.
**Recommended Action**: Configure ESLint with a basic JavaScript ruleset (e.g., `eslint:recommended`).
**Effort**: Medium (2-4 hours for initial setup + baseline)

---

## 2. Existing Technical Debt (Not Changed by This Feature)

### TD-PRE-001: 4 Pre-Existing Test Failures

**Severity**: Low
**Description**: 4 tests fail on main branch, unrelated to any feature work:
1. gate-blocker-extended: timing-sensitive assertion on stderr
2. TC-E09: README agent count mismatch
3. TC-07: task cleanup instructions
4. TC-13-01: agent file count expectations

### TD-PRE-002: No Mutation Testing

**Severity**: Low
**Description**: No mutation testing framework (Stryker, etc.) is configured. Test quality relies on manual review.

### TD-PRE-003: No Native Coverage Reporting

**Severity**: Low
**Description**: Node.js built-in `node:test` does not provide native coverage reporting. Coverage is estimated from test case analysis.

---

## 3. Technical Debt Introduced vs Resolved

| Category | Count | Details |
|----------|-------|---------|
| New debt items | 1 | TD-GH57-001 (computeStartPhase complexity) |
| Pre-existing debt noted | 3 | TD-PRE-001 through TD-PRE-003 |
| Debt resolved | 1 | writeMetaJson inline derivation logic eliminated (DRY improvement) |
| Net change | 0 | One added, one resolved |

---

## 4. Summary

This feature does not introduce significant technical debt. The one new item (TD-GH57-001) is a low-severity observation about function size approaching a threshold, with a clear mitigation path. The writeMetaJson refactoring actually reduces existing debt by eliminating duplicated logic.
