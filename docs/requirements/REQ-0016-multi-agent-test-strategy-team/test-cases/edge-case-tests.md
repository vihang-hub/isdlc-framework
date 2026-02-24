# Edge Case / Boundary Test Cases: Multi-agent Test Strategy Team (REQ-0016)

**Total Edge Case Tests**: 10
**Framework**: `node:test` + `node:assert/strict` (CJS)
**File**: `src/claude/hooks/tests/test-strategy-debate-team.test.cjs`

---

## Group 10: Negative and Boundary Tests (10 tests)

**Traces**: NFR-02, NFR-04, FR-07, AC-07.1 through AC-07.5
**Scope**: Error handling, missing data, boundary conditions

### 10a: Missing File Handling (3 tests)

| TC# | Test Name | AC/VR | Type | Assertion |
|-----|-----------|-------|------|-----------|
| TC-079 | critic frontmatter without model field is detectable | AC-01.1 | negative | Simulated content without `model:` fails pattern match |
| TC-080 | refiner frontmatter without owned_skills is detectable | AC-03.1 | negative | Simulated content without `owned_skills:` fails pattern match |
| TC-081 | orchestrator without 05-test-strategy row is detectable | AC-04.1 | negative | Simulated content without the Phase 05 row fails row-presence assertion |

### 10b: Content Completeness (4 tests)

| TC# | Test Name | AC/VR | Type | Assertion |
|-----|-----------|-------|------|-----------|
| TC-082 | critic missing any one TC check (TC-01..TC-08) is detectable | VR-CRITIC-001 | negative | Content with TC-03 removed fails "all 8 checks present" assertion |
| TC-083 | refiner missing NEEDS CLARIFICATION is detectable | VR-REFINER-003 | negative | Content without `[NEEDS CLARIFICATION]` fails escalation assertion |
| TC-084 | manifest missing critic agent entry is detectable | VR-MANIFEST-001 | negative | JSON without `test-strategy-critic` key fails presence assertion |
| TC-085 | manifest skill_count mismatch with skills array is detectable | VR-MANIFEST-004 | negative | Agent entry with `skill_count: 3` but 2-element skills array fails match |

### 10c: Severity Classification Boundaries (3 tests)

| TC# | Test Name | AC/VR | Type | Assertion |
|-----|-----------|-------|------|-----------|
| TC-086 | TC-01 must be BLOCKING, not WARNING | VR-CRITIC-002 | boundary | Verify TC-01 is not near WARNING keyword (only near BLOCKING) |
| TC-087 | TC-08 must be WARNING, not BLOCKING | VR-CRITIC-003 | boundary | Verify TC-08 is not near BLOCKING keyword (only near WARNING) |
| TC-088 | all TC-NN IDs exist exactly once in severity classification | VR-CRITIC-001 | boundary | Each TC-01..TC-08 appears with exactly one severity classification |

---

## Implementation Notes for Edge Cases

Edge case tests use a two-pronged approach:

1. **Pattern-absence tests**: Create fixture strings (simulated content) with specific fields removed and verify the validation regex fails to match. This validates that the tests correctly detect missing content.

2. **Real-file positive counterparts**: Each negative test has a corresponding positive test in Groups 1-6 that validates the real file passes. The negative tests confirm the assertions are meaningful (not always-true).

### Fixture Helper Functions

```javascript
function createCriticWithoutModel() {
    return `---
name: test-strategy-critic
description: "Review agent"
owned_skills:
  - TEST-002
---
# Content`;
}

function createCriticMissingTC(removedTC) {
    // Returns simulated critic content with one TC-NN removed
    const allTCs = ['TC-01','TC-02','TC-03','TC-04','TC-05','TC-06','TC-07','TC-08'];
    const remaining = allTCs.filter(tc => tc !== removedTC);
    return remaining.map(tc => `### ${tc}: Check description`).join('\n');
}

function createManifestWithoutCritic(realManifest) {
    const copy = JSON.parse(JSON.stringify(realManifest));
    delete copy.ownership['test-strategy-critic'];
    return copy;
}

function createManifestSkillCountMismatch(realManifest) {
    const copy = JSON.parse(JSON.stringify(realManifest));
    copy.ownership['test-strategy-critic'].skill_count = 5; // actual: 3
    return copy;
}
```
