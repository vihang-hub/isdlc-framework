# Technical Debt Inventory

**Project:** iSDLC Framework
**Workflow:** REQ-0027-gh-20-roundtable-analysis-agent-with-named-personas (feature)
**Phase:** 08 - Code Review & QA
**Date:** 2026-02-20

---

## 1. New Technical Debt Introduced

### TD-001: Elaboration Mode Stub (Intentional)

- **Category:** Incomplete feature
- **Severity:** Low
- **Description:** The [E] Elaboration Mode menu option is wired but delegates to a stub that says "Elaboration mode is coming in a future update (#21)." The stub switches to deep mode as a workaround.
- **Rationale:** This is explicitly out of scope per requirements (Section 7: "Elaboration mode (#21): The [E] menu option is wired but stubs to a message."). The feature is tracked as GH-21.
- **Remediation:** Implement GH-21 (Elaboration mode with multi-persona roundtable discussions).
- **Tracking:** GitHub Issue #21

### TD-002: Step File Validator Not Shared (Acceptable)

- **Category:** Code organization
- **Severity:** Very Low (Informational)
- **Description:** The step file frontmatter parser logic (~270 lines) is defined inside `test-step-file-validator.test.cjs` rather than extracted to a shared utility module.
- **Rationale:** The roundtable agent is an LLM agent that parses YAML natively -- it does not execute JavaScript parsing code. The test parser exists solely to validate step file content against the schema. There is no runtime consumer that would share this code. If a future hook needs programmatic step file validation, the parser can be extracted at that point.
- **Remediation:** Extract to shared module only if a second consumer emerges.
- **Tracking:** None (no action needed currently)

---

## 2. Pre-Existing Technical Debt (Unchanged)

| ID | Description | Status |
|----|-------------|--------|
| Pre-TD-001 | TC-E09 expects 48 agents in README, actual count is 60 | Open (agent inventory drift) |
| Pre-TD-002 | TC-07 STEP 4 task cleanup instructions mismatch | Open (plan format drift) |
| Pre-TD-003 | gate-blocker-extended supervised_review timing-sensitive test | Open |

---

## 3. Technical Debt Summary

| Category | New | Pre-Existing | Total |
|----------|-----|-------------|-------|
| Intentional (deferred feature) | 1 (TD-001) | 0 | 1 |
| Code organization | 1 (TD-002, informational) | 0 | 1 |
| Test maintenance | 0 | 3 | 3 |
| **Total** | **2** | **3** | **5** |

No actionable technical debt was introduced by this feature. TD-001 is an intentional deferral tracked by GH-21. TD-002 is informational and requires no action.
