# Integration Test Cases: Multi-agent Test Strategy Team (REQ-0016)

**Total Integration Tests**: 17
**Framework**: `node:test` + `node:assert/strict` (CJS)
**File**: `src/claude/hooks/tests/test-strategy-debate-team.test.cjs`

---

## Group 7: Cross-Module Consistency (8 tests)

**Traces**: NFR-01, FR-01, FR-03, FR-04, FR-06
**Scope**: Cross-references between agent files, manifest, and orchestrator

| TC# | Test Name | AC/VR | Type | Assertion |
|-----|-----------|-------|------|-----------|
| TC-062 | critic agent name in file matches manifest key | FR-01, FR-06 | positive | `name: test-strategy-critic` in agent file matches manifest key `test-strategy-critic` |
| TC-063 | refiner agent name in file matches manifest key | FR-03, FR-06 | positive | `name: test-strategy-refiner` in agent file matches manifest key `test-strategy-refiner` |
| TC-064 | critic skills in agent file match manifest skills exactly | FR-01, FR-06 | positive | Parsing owned_skills from agent frontmatter equals manifest skills array |
| TC-065 | refiner skills in agent file match manifest skills exactly | FR-03, FR-06 | positive | Parsing owned_skills from agent frontmatter equals manifest skills array |
| TC-066 | orchestrator references critic filename that exists on disk | FR-04 | positive | Filename `04-test-strategy-critic.md` from DEBATE_ROUTING row exists at expected path |
| TC-067 | orchestrator references refiner filename that exists on disk | FR-04 | positive | Filename `04-test-strategy-refiner.md` from DEBATE_ROUTING row exists at expected path |
| TC-068 | orchestrator references creator filename that exists on disk | FR-04, FR-05 | positive | Filename `04-test-design-engineer.md` from DEBATE_ROUTING row exists at expected path |
| TC-069 | all skill IDs in new agents are registered in skill_owners map | FR-06, C-02 | positive | Each skill ID in critic and refiner entries exists in `skill_owners` section of manifest |

---

## Group 8: Pattern Compliance (5 tests)

**Traces**: NFR-01 (consistency with existing debate teams)
**Scope**: Comparing Phase 05 agents with existing Phase 01/03/04 debate team patterns

| TC# | Test Name | AC/VR | Type | Assertion |
|-----|-----------|-------|------|-----------|
| TC-070 | critic agent uses same file prefix (04-) as creator agent | NFR-01, C-01 | positive | Both files start with `04-` prefix |
| TC-071 | refiner agent uses same file prefix (04-) as creator agent | NFR-01, C-01 | positive | Both files start with `04-` prefix |
| TC-072 | critic follows same frontmatter fields as design-critic | NFR-01 | positive | Both have name, description, model, owned_skills in frontmatter |
| TC-073 | refiner follows same frontmatter fields as design-refiner | NFR-01 | positive | Both have name, description, model, owned_skills in frontmatter |
| TC-074 | debate routing row follows same column count as existing rows | NFR-01 | positive | Phase 05 row has same number of `\|` delimiters as Phase 01/03/04 rows |

---

## Group 9: Regression Guards (4 tests)

**Traces**: NFR-04 (zero regression), AC-07.6
**Scope**: Existing debate team entries remain intact after modification

| TC# | Test Name | AC/VR | Type | Assertion |
|-----|-----------|-------|------|-----------|
| TC-075 | existing 01-requirements debate routing entry unchanged | NFR-04 | positive | Line matching `\|\s*01-requirements\s*\|` contains original agent mappings |
| TC-076 | existing 03-architecture debate routing entry unchanged | NFR-04 | positive | Line matching `\|\s*03-architecture\s*\|` contains original agent mappings |
| TC-077 | existing 04-design debate routing entry unchanged | NFR-04 | positive | Line matching `\|\s*04-design\s*\|` contains original agent mappings |
| TC-078 | documentation update includes Phase 05 in debate list | FR-04 | positive | Orchestrator contains text indicating Phases 01/03/04/05 are in DEBATE_ROUTING |
