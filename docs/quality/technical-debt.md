# Technical Debt Inventory

**Project:** iSDLC Framework
**Workflow:** REQ-0023-three-verb-backlog-model (feature)
**Phase:** 08 - Code Review & QA
**Date:** 2026-02-18

---

## 1. New Technical Debt (Introduced by REQ-0023)

### TD-001: Stale "backlog picker" references in isdlc.md

- **Location:** `src/claude/commands/isdlc.md` lines 312-317, 342-347, 892-895
- **Description:** The `feature` and `fix` no-description behavior sections still reference the "backlog picker" and point to "the BACKLOG PICKER section in the orchestrator agent". The BACKLOG PICKER section was correctly removed from the orchestrator, but these references were not updated.
- **Impact:** Low -- the orchestrator's SCENARIO 3 menu handles the no-description case correctly regardless of what isdlc.md says. The stale text is a documentation issue, not a behavioral issue.
- **Remediation:** Update isdlc.md feature/fix no-description sections to reference the SCENARIO 3 interactive menu.
- **Priority:** Low
- **Traces:** CR-006, CR-007

### TD-002: Residual Phase A/B reference in CLAUDE.md.template

- **Location:** `src/claude/CLAUDE.md.template` line 177
- **Description:** The "Backlog Operations" table row for "Let's work on PROJ-1234" still references `phase_a_completed` and "Phase B". This only affects new project installations (the template), not existing installations.
- **Impact:** Low -- new installations would see outdated terminology in their CLAUDE.md. The actual behavior is governed by isdlc.md handlers, not this table.
- **Remediation:** Update the table row to use the `build` verb and `analysis_status` field instead of "Phase B" and `phase_a_completed`.
- **Priority:** Low
- **Traces:** CR-008

### TD-003: Bidirectional slug matching in updateBacklogMarker

- **Location:** `src/claude/hooks/lib/three-verb-utils.cjs` lines 314-315
- **Description:** The matching logic uses bidirectional substring comparison which could false-positive on very short slugs. This is unlikely in practice because slugs are generated from descriptions (typically 3+ words).
- **Impact:** Very Low -- framework-generated slugs are always descriptive enough to avoid collisions.
- **Remediation:** Consider adding minimum match length threshold or word-boundary matching in a future refactor.
- **Priority:** Very Low
- **Traces:** CR-001

## 2. Pre-Existing Technical Debt (Not introduced by REQ-0023)

### TD-PRE-001: Pre-existing test failures

- **Location:** Various (gate-blocker-extended, prompt-format)
- **Description:** 3 pre-existing test failures unrelated to REQ-0023:
  - `supervised_review` logging test in gate-blocker-extended
  - README agent count test (expects 40, actual has grown)
  - Agent file count test (expects 48, actual is 60)
- **Remediation:** Update test expectations to match current counts.
- **Priority:** Medium

### TD-PRE-002: Non-atomic meta.json writes

- **Location:** `src/claude/hooks/lib/three-verb-utils.cjs` line 260
- **Description:** `writeMetaJson()` uses direct `writeFileSync()` rather than write-to-temp + rename pattern. For `state.json` this would violate Article XIV, but `meta.json` is a requirement artifact (not runtime state), so this is acceptable.
- **Remediation:** Consider adopting atomic write pattern if meta.json becomes critical state.
- **Priority:** Very Low

## 3. Debt Summary

| Category | New Items | Pre-Existing | Total |
|----------|-----------|-------------|-------|
| Documentation staleness | 2 (TD-001, TD-002) | 0 | 2 |
| Code quality | 1 (TD-003) | 1 (TD-PRE-002) | 2 |
| Test maintenance | 0 | 1 (TD-PRE-001) | 1 |
| **Total** | **3** | **2** | **5** |

**Assessment:** The new technical debt is minor (documentation references and an unlikely edge case). The feature does not introduce structural or architectural debt. The code is well-tested and well-documented.
