# Technical Debt Inventory

**Project:** iSDLC Framework
**Workflow:** REQ-0028-gh-21-elaboration-mode-multi-persona-roundtable-discussions (feature)
**Phase:** 08 - Code Review & QA
**Date:** 2026-02-20

---

## 1. Technical Debt Resolved by This Feature

### TD-001 (RESOLVED): Elaboration Mode Stub

- **Previously:** The [E] Elaboration Mode menu option was a stub that fell back to single-persona deep mode. Tracked as GH-21.
- **Resolution:** Full elaboration handler implemented in Section 4.4 of roundtable-analyst.md with 9 sub-sections covering entry, discussion, exit, synthesis, and state tracking.
- **Status:** RESOLVED

---

## 2. New Technical Debt Introduced

### TD-003: Step File Validator Not Shared (Unchanged from REQ-0027)

- **Category:** Code organization
- **Severity:** Very Low (Informational)
- **Description:** The step file frontmatter parser logic remains inside `test-step-file-validator.test.cjs` rather than in a shared module. No change from REQ-0027 assessment.
- **Remediation:** Extract to shared module only if a second consumer emerges.
- **Tracking:** None (no action needed currently)

### TD-004: Elaboration Config Schema Not Formally Documented

- **Category:** Documentation
- **Severity:** Very Low (Informational)
- **Description:** The `elaboration_config` object in meta.json currently supports only `max_turns`. The schema is not formally documented beyond the requirements spec (FR-007 AC-007-03) and the agent file (Section 4.4.1). If additional config keys are added in the future, a formal schema document would be beneficial.
- **Remediation:** Document the full config schema when a second config key is added.
- **Tracking:** None (single-key schema does not warrant formal documentation)

---

## 3. Pre-Existing Technical Debt (Unchanged)

| ID | Description | Status |
|----|-------------|--------|
| Pre-TD-001 | TC-E09 expects 48 agents in README, actual count differs | Open (agent inventory drift) |
| Pre-TD-002 | TC-07 STEP 4 task cleanup instructions mismatch | Open (plan format drift) |
| Pre-TD-003 | gate-blocker-extended supervised_review timing-sensitive test | Open |
| Pre-TD-004 | TC-13-01 expects exactly 48 agent markdown files, actual count differs | Open (agent count drift) |

---

## 4. Technical Debt Summary

| Category | Resolved | New | Pre-Existing | Net Change |
|----------|----------|-----|-------------|------------|
| Intentional (deferred feature) | 1 (TD-001) | 0 | 0 | -1 |
| Code organization | 0 | 0 (TD-003 unchanged) | 0 | 0 |
| Documentation | 0 | 1 (TD-004, informational) | 0 | +1 |
| Test maintenance | 0 | 0 | 4 | 0 |
| **Total** | **1** | **1** | **4** | **0 net** |

This feature resolved more technical debt than it introduced. TD-001 (the elaboration stub) was an intentional deferral from REQ-0027, now fully resolved. The one new item (TD-004) is informational and requires no immediate action.
