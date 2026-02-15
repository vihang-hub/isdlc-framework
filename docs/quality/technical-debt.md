# Technical Debt Assessment: REQ-0015-ia-cross-validation-verifier

**Date**: 2026-02-15
**Phase**: 08-code-review
**Workflow**: Feature (REQ-0015)

---

## 1. New Technical Debt Introduced

### TD-NEW-001: Two skill definitions in one SKILL.md file

**Type**: Convention debt
**Impact**: Low
**Files**: `src/claude/skills/impact-analysis/cross-validation/SKILL.md`
**Details**: IA-401 (cross-validation-execution) and IA-402 (finding-categorization) are bundled in a single SKILL.md file. All other skill directories in the project have one skill per SKILL.md. The second skill (IA-402) uses an inline YAML code block rather than standard frontmatter.
**Recommendation**: Split into two directories (`cross-validation-execution/SKILL.md` and `finding-categorization/SKILL.md`) in a future cleanup. Low priority since the manifest correctly maps both skill IDs.

---

## 2. Existing Technical Debt Observations

### TD-001: Pre-existing test failures (documentation drift)

**Type**: Test debt
**Impact**: Low (not caused by REQ-0015; 0 new failures introduced)
**Details**: 2 ESM test failures:
  - TC-E09: README.md references "40 agents" but the project has grown beyond that count
  - TC-13-01: prompt-format.test.js expects 48 agent files but finds 57 (sub-agents added in prior features)
**Recommendation**: Create a maintenance task to update README agent counts and prompt-format test expectations.

### TD-002: No ESLint configuration

**Type**: Tooling debt
**Impact**: Low
**Details**: The project has no `eslint.config.js`. Manual review substitutes for automated linting. Framework-wide concern, not specific to REQ-0015.
**Recommendation**: Consider adding ESLint in a future workflow.

### TD-003: No mutation testing framework

**Type**: Testing debt
**Impact**: Low
**Details**: Article XI (Integration Testing Integrity) requires mutation testing with >=80% score. No mutation testing framework is installed. This is a pre-existing gap.
**Recommendation**: Track as a backlog item for framework-wide mutation testing setup.

### TD-004: Orchestrator file growing large (889 lines)

**Type**: Maintainability debt
**Impact**: Low (currently well-structured)
**Details**: `impact-analysis-orchestrator.md` is now 889 lines after adding M4 integration. It handles both feature and upgrade workflows with full M1-M4 orchestration. Adding further sub-agents would push this past 1000 lines.
**Recommendation**: Monitor growth. Consider extracting upgrade workflow into a separate file if additional sub-agents are added.

---

## 3. Technical Debt Summary

| Category | New Items | Pre-Existing | Total |
|----------|-----------|-------------|-------|
| Convention | 1 (SKILL.md bundling) | 0 | 1 |
| Testing | 0 | 2 (failures, mutation) | 2 |
| Tooling | 0 | 1 (ESLint) | 1 |
| Maintainability | 0 | 1 (orchestrator size) | 1 |
| **Total** | **1** | **4** | **5** |

**New debt introduced by REQ-0015**: 1 item (low severity, convention-only)
**No functional, security, or performance debt introduced.**
