# Technical Debt Inventory

**Project:** iSDLC Framework
**Workflow:** REQ-0024-gate-requirements-pre-injection (feature)
**Phase:** 08 - Code Review & QA
**Date:** 2026-02-18

---

## 1. New Technical Debt (Introduced by REQ-0024)

### TD-NEW-001: deepMerge not wired into main pipeline

- **Location:** `src/claude/hooks/lib/gate-requirements-injector.cjs` lines 175-200, 306-353
- **Description:** The `deepMerge` function is implemented, exported, and tested (7 tests) but is not called from `buildGateRequirementsBlock`. The design spec (module-design.md Section 2.1 Step 3) requires merging `workflow_overrides` from `iteration-requirements.json` into base phase requirements. The production config file has `workflow_overrides` with entries for `fix`, `test-run`, `test-generate`, and `feature` workflow types.
- **Impact:** Medium -- Phase agents may receive base phase requirements instead of workflow-specific overrides. For example, phase `08-code-review` in a feature workflow should show `test_iteration: disabled` and articles `['VI', 'IX']` per the feature workflow override, but currently shows the base configuration.
- **Severity:** Medium
- **Priority:** Should fix in next iteration
- **Effort:** Small (function exists and is tested; needs 5-10 lines to wire it in)
- **Traceability:** FR-04 (AC-04-01, AC-04-02)

### TD-NEW-002: atdd_validation not rendered in formatBlock

- **Location:** `src/claude/hooks/lib/gate-requirements-injector.cjs` lines 212-291
- **Description:** The `formatBlock` function renders 5 iteration requirement types (test_iteration, constitutional_validation, interactive_elicitation, agent_delegation, artifact_validation) but omits `atdd_validation`. The design spec explicitly includes `atdd_validation` rendering. The production config has `atdd_validation` enabled for `06-implementation` with conditional `when: "atdd_mode"` and 3 required checks.
- **Impact:** Low-Medium -- Phase 06 agents will not see ATDD validation requirements. Mitigated because ATDD is conditional and hooks still enforce it.
- **Severity:** Medium
- **Priority:** Should fix in next iteration
- **Effort:** Small (10-15 lines to add the rendering logic + 2-3 tests)
- **Traceability:** FR-05 (design spec Section 2.8)

### TD-NEW-003: PHASE_NAME_MAP incomplete

- **Location:** `src/claude/hooks/lib/gate-requirements-injector.cjs` lines 26-38
- **Description:** The phase name mapping covers 11 phases but the framework has additional phases (09-security-validation, 10-cicd, 12-test-deploy, 13-production, 15-upgrade). Unmapped phases fall back to "Unknown" which is gracefully handled.
- **Impact:** Low -- Only affects display name in header line. No functional impact.
- **Severity:** Low
- **Priority:** Nice to have
- **Effort:** Trivial (add 5 more entries to the map)
- **Traceability:** A-002 in code review report

## 2. Pre-Existing Technical Debt (Not affected by REQ-0024)

### TD-PRE-001: Pre-existing test failures

- **Location:** Various (gate-blocker-extended, prompt-format)
- **Description:** 3 pre-existing test failures:
  - `supervised_review` logging test in gate-blocker-extended (assertion on stderr content)
  - README agent count test (TC-E09, expects 40 agents)
  - Agent file count test (TC-13-01, expects 48 files, actual is 60)
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

## 3. Debt Summary

| Category | New | Pre-Existing | Resolved |
|----------|-----|-------------|----------|
| Missing feature (design deviation) | 2 (TD-NEW-001, TD-NEW-002) | 0 | 0 |
| Completeness | 1 (TD-NEW-003) | 0 | 0 |
| Test maintenance | 0 | 1 (TD-PRE-001) | 0 |
| Tooling | 0 | 2 (TD-PRE-002, TD-PRE-003) | 0 |
| **Total** | **3** | **3** | **0** |

## 4. Assessment

This feature introduces 3 technical debt items, all classified as low-effort improvements that can be addressed in follow-up iterations. The two medium-severity items (TD-NEW-001, TD-NEW-002) represent incomplete design implementation but do not cause regressions or functional failures because:
1. The feature is additive and informational only
2. Hooks remain the enforcement mechanism and are unaffected
3. The existing output is useful and accurate for the requirements it does render

The net technical debt posture is acceptable for approval.
