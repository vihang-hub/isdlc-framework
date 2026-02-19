# Technical Debt Inventory

**Project:** iSDLC Framework
**Workflow:** REQ-0022-performance-budget-guardrails (feature)
**Phase:** 08 - Code Review & QA
**Date:** 2026-02-19

---

## 1. New Technical Debt (Introduced by REQ-0022)

No new technical debt introduced by this feature. The implementation is complete relative to the requirements specification:

- All 8 functional requirements fully implemented
- All 35 acceptance criteria covered
- All 5 non-functional requirements satisfied
- No design deviations detected

The two minor code review findings (test comment typo and missing no_fan_out explicit test) do not constitute technical debt -- they are documentation accuracy and test completeness observations that can be addressed opportunistically.

---

## 2. Pre-Existing Technical Debt (Not affected by REQ-0022)

### TD-PRE-001: Pre-existing test failures

- **Location:** Various (gate-blocker-extended, prompt-format, deep-discovery-consistency)
- **Description:** 4 pre-existing test failures:
  - `supervised_review` logging test in gate-blocker-extended (assertion on stderr content)
  - README agent count test (TC-E09, expects 40 agents)
  - Agent file count test (TC-13-01, expects 48 files, actual is 60)
  - Plan tracking test (TC-07, STEP 4 task cleanup instructions)
- **Priority:** Medium
- **Unchanged by this feature**

### TD-PRE-002: No automated coverage tooling

- **Location:** Project-wide
- **Description:** No code coverage tool (c8, istanbul, nyc) is installed. Coverage is estimated manually based on test enumeration.
- **Priority:** Medium
- **Unchanged by this feature**

### TD-PRE-003: No linter or formatter configured

- **Location:** Project-wide
- **Description:** No ESLint, Prettier, or TypeScript. Static analysis is done manually.
- **Priority:** Low
- **Unchanged by this feature**

---

## 3. Previously Tracked Debt (from REQ-0024)

### TD-0024-001: deepMerge not wired into main pipeline

- **Status:** Still open (not in scope for REQ-0022)
- **Location:** `src/claude/hooks/lib/gate-requirements-injector.cjs`
- **Severity:** Medium

### TD-0024-002: atdd_validation not rendered in formatBlock

- **Status:** Still open (not in scope for REQ-0022)
- **Location:** `src/claude/hooks/lib/gate-requirements-injector.cjs`
- **Severity:** Medium

### TD-0024-003: PHASE_NAME_MAP incomplete

- **Status:** Still open (not in scope for REQ-0022)
- **Location:** `src/claude/hooks/lib/gate-requirements-injector.cjs`
- **Severity:** Low

---

## 4. Debt Summary

| Category | New (REQ-0022) | Pre-Existing | Carried (REQ-0024) | Resolved |
|----------|---------------|-------------|-------------------|----------|
| Missing feature | 0 | 0 | 2 (TD-0024-001, TD-0024-002) | 0 |
| Completeness | 0 | 0 | 1 (TD-0024-003) | 0 |
| Test maintenance | 0 | 1 (TD-PRE-001) | 0 | 0 |
| Tooling | 0 | 2 (TD-PRE-002, TD-PRE-003) | 0 | 0 |
| **Total** | **0** | **3** | **3** | **0** |

## 5. Assessment

This feature introduces zero new technical debt. The implementation fully satisfies the requirements specification with no design deviations or incomplete functionality. The pre-existing and carried-forward debt items remain unchanged and do not affect this feature's quality assessment. The net debt posture is stable.
