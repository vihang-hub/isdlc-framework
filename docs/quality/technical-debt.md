# Technical Debt Inventory: REQ-0009-enhanced-plan-to-tasks

**Date**: 2026-02-12
**Phase**: 08-code-review

---

## New Technical Debt Introduced

### TD-REQ0009-001: Kahn's Algorithm Duplication in Test File (LOW)

- **Location**: `src/claude/hooks/tests/tasks-format-validation.test.cjs` (lines 580-634)
- **Description**: The `detectCycleInContent()` helper duplicates the Kahn's algorithm from `plan-surfacer.cjs`'s `detectCyclesInDependencyGraph()`. The duplication exists because `plan-surfacer.cjs` only exports `{ check }` and the internal functions are not exposed.
- **Impact**: LOW -- If the algorithm is updated in the hook, the test helper must also be updated
- **Recommendation**: Acceptable per test isolation pattern. If the algorithm changes, update both locations. An alternative would be to export the function for testing, but this would expand the public API unnecessarily (violates Article V).

### TD-REQ0009-002: check() Function Length (LOW)

- **Location**: `src/claude/hooks/plan-surfacer.cjs` (check function, ~85 lines of logic)
- **Description**: The check() function handles multiple responsibilities: input validation, phase checking, plan existence checking, and format validation dispatch. While each concern is clearly separated with comments and early returns, the function exceeds the 50-line guideline.
- **Impact**: LOW -- The function is well-structured with clear guard clauses and is within the performance budget
- **Recommendation**: No immediate action. Consider refactoring into smaller helper functions if additional validation checks are added in the future.

### TD-REQ0009-003: Format Validation Only at Phase 06 (INFORMATIONAL)

- **Location**: `src/claude/hooks/plan-surfacer.cjs` (line 268: `if (currentPhase === '06-implementation')`)
- **Description**: Format validation only runs during the `06-implementation` phase. This is by design (to avoid unnecessary overhead and because file-level annotations are only relevant for implementation), but it means format issues in tasks.md are not detected during later phases (testing, code review, etc.).
- **Impact**: VERY LOW -- Later phases do not depend on file-level annotations
- **Recommendation**: Acceptable trade-off. If future phases need format validation, the condition can be expanded.

---

## Pre-Existing Technical Debt (Carried Forward)

### TD-001: Pre-existing TC-E09 Test Failure (LOW)

- **Location**: `lib/deep-discovery-consistency.test.js:115`
- **Description**: Test expects README.md to reference "40 agents" but the actual agent count has changed
- **Impact**: LOW -- single cosmetic test failure
- **Recommendation**: Update README agent count or test expectation in a future fix workflow

### TD-002: Node 20 EOL Approaching (INFORMATIONAL)

- **Description**: Node 20 reaches end-of-life on April 30, 2026 (~2.5 months away)
- **Impact**: LOW -- proactive awareness
- **Recommendation**: Schedule REQ for Node 22 minimum in March 2026

### TD-004: Template Phase Key Mismatch (LOW)

- **Location**: `src/isdlc/templates/workflow-tasks-template.md`
- **Description**: Template uses `### 02-architecture` but the feature workflow in `workflows.json` has `02-impact-analysis` and `03-architecture` as separate phases. The template section `02-architecture` maps to the combined architecture tasks but the key does not match either workflow phase key.
- **Impact**: LOW -- The generate-plan skill uses task descriptions (not phase keys) from the template, so the mismatch does not cause functional issues
- **Recommendation**: Update template phase keys to match workflows.json in a future cleanup pass
- **Note**: Pre-existing, NOT introduced by REQ-0009

---

## Debt Summary

| Category | New (REQ-0009) | Pre-Existing | Total |
|----------|---------------|--------------|-------|
| LOW | 2 | 3 | 5 |
| INFORMATIONAL | 1 | 0 | 1 |
| **Total** | **3** | **3** | **6** |

No HIGH or CRITICAL technical debt.
