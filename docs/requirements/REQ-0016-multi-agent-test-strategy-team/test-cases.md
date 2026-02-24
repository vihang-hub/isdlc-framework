# Test Cases: Multi-agent Test Strategy Team (REQ-0016)

**Version**: 1.0
**Created**: 2026-02-15
**Total Test Cases**: 88
**Framework**: `node:test` + `node:assert/strict` (CJS)
**Target File**: `src/claude/hooks/tests/test-strategy-debate-team.test.cjs`
**Traces**: FR-01 through FR-07, NFR-01 through NFR-04

---

## Test Summary

| Group | Name | Tests | Traces |
|-------|------|-------|--------|
| 1 | Critic Agent File Validation | 13 | FR-01, FR-02, AC-01.1..AC-01.5, AC-02.1..AC-02.8 |
| 2 | Refiner Agent File Validation | 12 | FR-03, AC-03.1..AC-03.5 |
| 3 | DEBATE_ROUTING Table Validation | 10 | FR-04, AC-04.1..AC-04.4 |
| 4 | Creator Awareness Validation | 8 | FR-05, AC-05.1..AC-05.4 |
| 5 | Skills Manifest Agent Entries | 10 | FR-06, AC-06.1..AC-06.4 |
| 6 | Manifest Invariants and Constraints | 8 | FR-06, AC-06.3, AC-06.4, C-02 |
| 7 | Cross-Module Consistency | 8 | NFR-01, FR-01, FR-03, FR-04, FR-06 |
| 8 | Pattern Compliance | 5 | NFR-01, C-01 |
| 9 | Regression Guards | 4 | NFR-04, AC-07.6 |
| 10 | Negative and Boundary Tests | 10 | NFR-02, NFR-04, FR-07 |
| **Total** | | **88** | |

---

## Group 1: Critic Agent File Validation (13 tests)

```
describe('Critic Agent Validation (FR-01, FR-02)')
```

| TC# | describe/it Path | Assertion | Type |
|-----|-----------------|-----------|------|
| TC-001 | `it('critic agent file exists and is readable')` | `readFileSync(CRITIC_FILE)` succeeds | positive |
| TC-002 | `it('critic has valid YAML frontmatter delimiters')` | Matches `/^---\n[\s\S]*?\n---/` | positive |
| TC-003 | `it('critic frontmatter has name: test-strategy-critic')` | Matches `/name:\s*test-strategy-critic/` | positive |
| TC-004 | `it('critic frontmatter has model: opus')` | Matches `/model:\s*opus/` | positive |
| TC-005 | `it('critic frontmatter owned_skills reference only TEST-* IDs')` | All owned_skills match `/TEST-\d{3}/` | positive |
| TC-006 | `it('critic owned_skills includes TEST-002, TEST-004, TEST-005')` | All three IDs present | positive |
| TC-007 | `it('critic documents all 8 mandatory checks TC-01 through TC-08')` | Each TC-01..TC-08 found | positive |
| TC-008 | `it('critic references all 4 Phase 05 input artifacts')` | All 4 artifact names found | positive |
| TC-009 | `it('critic output follows round-{N}-critique.md naming')` | Pattern found in content | positive |
| TC-010 | `it('critic documents BLOCKING/WARNING finding IDs (B-NNN, W-NNN)')` | Both patterns found | positive |
| TC-011 | `it('critic classifies TC-01 through TC-07 as BLOCKING')` | Each TC near BLOCKING | positive |
| TC-012 | `it('critic classifies TC-08 as WARNING')` | TC-08 near WARNING | positive |
| TC-013 | `it('critic description mentions orchestrator-only invocation')` | String found | positive |

---

## Group 2: Refiner Agent File Validation (12 tests)

```
describe('Refiner Agent Validation (FR-03)')
```

| TC# | describe/it Path | Assertion | Type |
|-----|-----------------|-----------|------|
| TC-014 | `it('refiner agent file exists and is readable')` | `readFileSync(REFINER_FILE)` succeeds | positive |
| TC-015 | `it('refiner has valid YAML frontmatter delimiters')` | Matches frontmatter regex | positive |
| TC-016 | `it('refiner frontmatter has name: test-strategy-refiner')` | Name matches | positive |
| TC-017 | `it('refiner frontmatter has model: opus')` | Model matches | positive |
| TC-018 | `it('refiner owned_skills includes TEST-001 through TEST-005')` | All 5 IDs present | positive |
| TC-019 | `it('refiner documents fix strategies for all 8 TC-NN categories')` | TC-01..TC-08 with fix language | positive |
| TC-020 | `it('refiner documents change log format with required columns')` | Change log format found | positive |
| TC-021 | `it('refiner documents [NEEDS CLARIFICATION] escalation')` | String found | positive |
| TC-022 | `it('refiner documents in-place artifact updates for all 4 artifacts')` | All 4 artifact names in update context | positive |
| TC-023 | `it('refiner description mentions orchestrator-only invocation')` | String found | positive |
| TC-024 | `it('refiner has broader skill set than critic (5 vs 3)')` | Count comparison | positive |
| TC-025 | `it('refiner documents additive-only modification rule')` | NEVER remove language found | positive |

---

## Group 3: DEBATE_ROUTING Table Validation (10 tests)

```
describe('DEBATE_ROUTING Validation (FR-04)')
```

| TC# | describe/it Path | Assertion | Type |
|-----|-----------------|-----------|------|
| TC-026 | `it('DEBATE_ROUTING has 05-test-strategy row')` | Row regex matches | positive |
| TC-027 | `it('Phase 05 Creator maps to 04-test-design-engineer.md')` | In same row | positive |
| TC-028 | `it('Phase 05 Critic maps to 04-test-strategy-critic.md')` | In same row | positive |
| TC-029 | `it('Phase 05 Refiner maps to 04-test-strategy-refiner.md')` | In same row | positive |
| TC-030 | `it('Phase 05 row lists test-strategy.md in artifacts')` | In same row | positive |
| TC-031 | `it('Phase 05 row lists test-cases/ in artifacts')` | In same row | positive |
| TC-032 | `it('Phase 05 row lists traceability-matrix.csv in artifacts')` | In same row | positive |
| TC-033 | `it('Phase 05 row lists test-data-plan.md in artifacts')` | In same row | positive |
| TC-034 | `it('Phase 05 critical artifact is test-strategy.md')` | Last column check | positive |
| TC-035 | `it('DEBATE_ROUTING table has at least 4 rows')` | Row count >= 4 | positive |

---

## Group 4: Creator Awareness Validation (8 tests)

```
describe('Creator Awareness Validation (FR-05)')
```

| TC# | describe/it Path | Assertion | Type |
|-----|-----------------|-----------|------|
| TC-036 | `it('test-design-engineer has DEBATE_CONTEXT mode detection')` | String found | positive |
| TC-037 | `it('test-design-engineer documents Round labeling')` | Pattern found | positive |
| TC-038 | `it('test-design-engineer preserves single-agent fallback')` | Both phrases found | positive |
| TC-039 | `it('test-design-engineer documents section markers for Critic')` | Pattern found | positive |
| TC-040 | `it('Creator mode labels artifacts as Round N Draft')` | Labeling instruction found | positive |
| TC-041 | `it('Creator mode skips final save menu in debate')` | Skip instruction found | positive |
| TC-042 | `it('Creator round > 1 reads Refiner improvements')` | Prior_critique reference found | positive |
| TC-043 | `it('Creator produces section markers matching TC-01..TC-08')` | Section header references found | positive |

---

## Group 5: Skills Manifest Agent Entries (10 tests)

```
describe('Skills Manifest Entries (FR-06)')
```

| TC# | describe/it Path | Assertion | Type |
|-----|-----------------|-----------|------|
| TC-044 | `it('manifest has test-strategy-critic agent entry')` | Key exists in ownership | positive |
| TC-045 | `it('manifest has test-strategy-refiner agent entry')` | Key exists in ownership | positive |
| TC-046 | `it('critic agent_id is 04')` | `agent_id === '04'` | positive |
| TC-047 | `it('refiner agent_id is 04')` | `agent_id === '04'` | positive |
| TC-048 | `it('critic phase is 05-test-strategy')` | Phase matches | positive |
| TC-049 | `it('refiner phase is 05-test-strategy')` | Phase matches | positive |
| TC-050 | `it('critic skills are [TEST-002, TEST-004, TEST-005]')` | Array deepEqual | positive |
| TC-051 | `it('refiner skills are [TEST-001..TEST-005]')` | Array deepEqual | positive |
| TC-052 | `it('critic skill_count matches skills array length')` | Count === length | positive |
| TC-053 | `it('refiner skill_count matches skills array length')` | Count === length | positive |

---

## Group 6: Manifest Invariants and Constraints (8 tests)

```
describe('Manifest Invariants (C-02, AC-06.3, AC-06.4)')
```

| TC# | describe/it Path | Assertion | Type |
|-----|-----------------|-----------|------|
| TC-054 | `it('total_skills count remains 242')` | `total_skills === 242` | positive |
| TC-055 | `it('no new skill IDs created in manifest')` | All new agent skills exist in skill_owners | negative |
| TC-056 | `it('skill_owners for TEST-001..005 unchanged')` | Primary owner is test-design-engineer | positive |
| TC-057 | `it('critic skills are subset of test-design-engineer skills')` | Subset check | positive |
| TC-058 | `it('refiner skills are subset of test-design-engineer skills')` | Subset check | positive |
| TC-059 | `it('no duplicate skill IDs in critic entry')` | Set size === array length | negative |
| TC-060 | `it('no duplicate skill IDs in refiner entry')` | Set size === array length | negative |
| TC-061 | `it('manifest JSON is valid and parseable')` | JSON.parse succeeds | positive |

---

## Group 7: Cross-Module Consistency (8 tests)

```
describe('Cross-Module Consistency (NFR-01)')
```

| TC# | describe/it Path | Assertion | Type |
|-----|-----------------|-----------|------|
| TC-062 | `it('critic name in agent file matches manifest key')` | String comparison | positive |
| TC-063 | `it('refiner name in agent file matches manifest key')` | String comparison | positive |
| TC-064 | `it('critic skills in agent file match manifest exactly')` | Array comparison | positive |
| TC-065 | `it('refiner skills in agent file match manifest exactly')` | Array comparison | positive |
| TC-066 | `it('orchestrator critic filename exists on disk')` | `existsSync` check | positive |
| TC-067 | `it('orchestrator refiner filename exists on disk')` | `existsSync` check | positive |
| TC-068 | `it('orchestrator creator filename exists on disk')` | `existsSync` check | positive |
| TC-069 | `it('all new agent skill IDs exist in skill_owners map')` | Map lookup | positive |

---

## Group 8: Pattern Compliance (5 tests)

```
describe('Pattern Compliance (NFR-01, C-01)')
```

| TC# | describe/it Path | Assertion | Type |
|-----|-----------------|-----------|------|
| TC-070 | `it('critic uses same file prefix as creator (04-)')` | Filename prefix | positive |
| TC-071 | `it('refiner uses same file prefix as creator (04-)')` | Filename prefix | positive |
| TC-072 | `it('critic follows design-critic frontmatter fields')` | Same 4 fields present | positive |
| TC-073 | `it('refiner follows design-refiner frontmatter fields')` | Same 4 fields present | positive |
| TC-074 | `it('Phase 05 routing row has same column count as existing')` | Pipe delimiter count | positive |

---

## Group 9: Regression Guards (4 tests)

```
describe('Regression Guards (NFR-04)')
```

| TC# | describe/it Path | Assertion | Type |
|-----|-----------------|-----------|------|
| TC-075 | `it('01-requirements debate routing entry unchanged')` | Row content preserved | positive |
| TC-076 | `it('03-architecture debate routing entry unchanged')` | Row content preserved | positive |
| TC-077 | `it('04-design debate routing entry unchanged')` | Row content preserved | positive |
| TC-078 | `it('documentation lists Phases 01/03/04/05 in DEBATE_ROUTING')` | Text pattern found | positive |

---

## Group 10: Negative and Boundary Tests (10 tests)

```
describe('Edge Cases and Boundary Tests')
```

| TC# | describe/it Path | Assertion | Type |
|-----|-----------------|-----------|------|
| TC-079 | `it('detects critic without model field')` | Pattern-absence on fixture | negative |
| TC-080 | `it('detects refiner without owned_skills')` | Pattern-absence on fixture | negative |
| TC-081 | `it('detects missing 05-test-strategy routing row')` | Pattern-absence on fixture | negative |
| TC-082 | `it('detects critic missing a TC check')` | Fixture with TC-03 removed | negative |
| TC-083 | `it('detects refiner missing NEEDS CLARIFICATION')` | Pattern-absence on fixture | negative |
| TC-084 | `it('detects manifest missing critic entry')` | Key absence on modified JSON | negative |
| TC-085 | `it('detects manifest skill_count mismatch')` | Count !== length on modified JSON | negative |
| TC-086 | `it('TC-01 classified as BLOCKING not WARNING')` | TC-01 not near WARNING | boundary |
| TC-087 | `it('TC-08 classified as WARNING not BLOCKING')` | TC-08 not near BLOCKING | boundary |
| TC-088 | `it('each TC-NN has exactly one severity classification')` | Unique severity per TC | boundary |

---

## Test Coverage by Requirement

| Requirement | ACs | Test Cases | Coverage |
|-------------|-----|------------|----------|
| FR-01 | AC-01.1..AC-01.5 | TC-001..TC-013, TC-062, TC-064, TC-066, TC-070, TC-072 | 100% |
| FR-02 | AC-02.1..AC-02.8 | TC-007, TC-011, TC-012, TC-082, TC-086..TC-088 | 100% |
| FR-03 | AC-03.1..AC-03.5 | TC-014..TC-025, TC-063, TC-065, TC-067, TC-071, TC-073 | 100% |
| FR-04 | AC-04.1..AC-04.4 | TC-026..TC-035, TC-066..TC-068, TC-074..TC-078, TC-081 | 100% |
| FR-05 | AC-05.1..AC-05.4 | TC-036..TC-043 | 100% |
| FR-06 | AC-06.1..AC-06.4 | TC-044..TC-061, TC-069 | 100% |
| FR-07 | AC-07.1..AC-07.6 | All groups validate AC-07.x (TC-001..TC-088) | 100% |
| NFR-01 | - | TC-070..TC-074 | 100% |
| NFR-04 | - | TC-075..TC-078 | 100% |
| C-01 | - | TC-070, TC-071 | 100% |
| C-02 | - | TC-054..TC-060 | 100% |
| C-03 | - | TC-013, TC-023 | 100% |
