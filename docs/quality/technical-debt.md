# Technical Debt Assessment -- BUG-0018-GH-2 Backlog Picker Pattern Mismatch

**Date**: 2026-02-16
**Phase**: 08-code-review
**Workflow**: Fix (BUG-0018-GH-2)

---

## 1. Technical Debt Addressed by This Fix

| Item | Description | Resolution |
|------|-------------|------------|
| Pattern mismatch | Orchestrator picker did not handle `-> [requirements](...)` suffix | Added suffix-stripping instructions to both feature and fix modes |
| Missing documentation | `start` action reuse mechanism undocumented | Design note added to isdlc.md |
| Zero test coverage | No tests existed for backlog picker content | 26 new content-verification tests created |

---

## 2. New Technical Debt Introduced

**None.** The fix adds clear, minimal instructions to markdown agent files and a well-structured test file. No deferred work, no workarounds, no shortcuts.

---

## 3. Pre-Existing Technical Debt Observations

### TD-001: Pre-existing test failures (4 across 2 suites)

**Type**: Test debt
**Impact**: Low (not caused by BUG-0018)
**Details**:
- TC-E09: README.md expects "40 agents" but project now has 59
- T43: Template Workflow-First section 70% content match vs 80% threshold
- TC-13-01: Agent file count expects 48, project has 59
- supervised_review gate-blocker test: AssertionError in gate-blocker-extended.test.cjs
**Recommendation**: Track as maintenance backlog items. The first three relate to agent count growth since baseline.

### TD-002: No ESLint configuration

**Type**: Tooling debt
**Impact**: Low
**Details**: No automated linting. Manual review substitutes.
**Recommendation**: Add ESLint in a future workflow (BACKLOG item).

### TD-003: No coverage tooling

**Type**: Tooling debt
**Impact**: Medium
**Details**: No c8/istanbul/nyc configured. Coverage is assessed by AC mapping, not line/branch metrics.
**Recommendation**: Add coverage tooling in a future workflow.

### TD-004: Backlog picker relies on markdown instructions, not executable code

**Type**: Architectural observation
**Impact**: Low
**Details**: The backlog picker pattern matching is defined in natural-language instructions in `00-sdlc-orchestrator.md`, not in executable code. This means the "tests" are content-verification checks (regex over markdown) rather than unit tests of parsing logic. This is a fundamental design choice of the iSDLC agent architecture -- agent behavior is defined in markdown, not in code modules.
**Recommendation**: No action needed. The content-verification approach is appropriate for the current architecture. If the picker grows more complex, consider extracting parsing logic into a testable utility function.

### TD-005: Phase A writes index format that previously had no consumer awareness

**Type**: Integration risk
**Impact**: Medium (now mitigated by this fix)
**Details**: Phase A in `isdlc.md` (line 257) writes BACKLOG.md entries with `-> [requirements](...)` suffix. The consumer (backlog picker in orchestrator) was not updated when Phase A was introduced (REQ-0019). This pattern of producer/consumer disconnect could recur if BACKLOG.md format changes again.
**Recommendation**: The cross-reference test (TC-CROSS-01) now guards against this specific disconnect. Consider adding a general BACKLOG.md format contract test that validates producer and consumer agree on the format.

---

## 4. Technical Debt Summary

| Category | Resolved | New | Pre-Existing | Total Remaining |
|----------|----------|-----|-------------|----------------|
| Pattern mismatch | 1 | 0 | 0 | 0 |
| Documentation | 1 | 0 | 0 | 0 |
| Test coverage | 1 | 0 | 1 (pre-existing failures) | 1 |
| Tooling | 0 | 0 | 2 (ESLint, coverage) | 2 |
| Architecture | 0 | 0 | 1 (markdown-based picker) | 1 |
| Integration | 0 | 0 | 1 (format disconnect risk, now mitigated) | 0 |
| **Total** | **3** | **0** | **5** | **4** |

**Net debt change**: -3 resolved, +0 introduced = **net reduction of 3 items**.
