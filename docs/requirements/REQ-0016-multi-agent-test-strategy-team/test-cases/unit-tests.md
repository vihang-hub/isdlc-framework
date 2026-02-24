# Unit Test Cases: Multi-agent Test Strategy Team (REQ-0016)

**Total Unit Tests**: 61
**Framework**: `node:test` + `node:assert/strict` (CJS)
**File**: `src/claude/hooks/tests/test-strategy-debate-team.test.cjs`

---

## Group 1: Critic Agent File Validation (13 tests)

**Traces**: FR-01, FR-02, AC-01.1 through AC-01.5, AC-02.1 through AC-02.8
**Target**: `src/claude/agents/04-test-strategy-critic.md`

| TC# | Test Name | AC/VR | Type | Assertion |
|-----|-----------|-------|------|-----------|
| TC-001 | critic agent file exists and is readable | AC-01.1, VR-AGENT-001 | positive | `readFileSync(CRITIC_FILE)` does not throw |
| TC-002 | critic has valid YAML frontmatter delimiters | AC-01.1, VR-AGENT-001 | positive | Content matches `/^---\n[\s\S]*?\n---/` |
| TC-003 | critic frontmatter has name: test-strategy-critic | AC-01.1, VR-AGENT-002 | positive | Content matches `/name:\s*test-strategy-critic/` |
| TC-004 | critic frontmatter has model: opus | AC-01.1, VR-AGENT-003 | positive | Content matches `/model:\s*opus/` |
| TC-005 | critic frontmatter owned_skills references only TEST-* IDs | AC-01.1, VR-AGENT-004 | positive | `owned_skills` section contains only `TEST-NNN` entries |
| TC-006 | critic owned_skills includes TEST-002, TEST-004, TEST-005 | AC-06.1, VR-AGENT-005 | positive | All three skill IDs present in owned_skills |
| TC-007 | critic documents all 8 mandatory checks TC-01 through TC-08 | AC-01.3, VR-CRITIC-001 | positive | Content contains each of `TC-01`, `TC-02`, ..., `TC-08` |
| TC-008 | critic references all 4 Phase 05 input artifacts | AC-01.2, VR-CRITIC-004 | positive | Content contains `test-strategy.md`, `test-cases/`, `traceability-matrix.csv`, `test-data-plan.md` |
| TC-009 | critic output follows round-{N}-critique.md naming pattern | AC-01.5, VR-CRITIC-005 | positive | Content matches `/round-\{?N\}?-critique\.md/` or similar pattern |
| TC-010 | critic documents BLOCKING/WARNING finding classification | AC-01.4, VR-CRITIC-006 | positive | Content contains `B-NNN` or `B-{NNN}` and `W-NNN` or `W-{NNN}` patterns |
| TC-011 | critic classifies TC-01 through TC-07 as BLOCKING | AC-02.1..AC-02.7, VR-CRITIC-002 | positive | Each TC-01..TC-07 appears near or with `BLOCKING` keyword |
| TC-012 | critic classifies TC-08 as WARNING (not BLOCKING) | AC-02.8, VR-CRITIC-003 | positive | TC-08 appears near or with `WARNING` keyword |
| TC-013 | critic description mentions orchestrator-only invocation | C-03, VR-AGENT-010 | positive | Content contains `ONLY invoked by the orchestrator` |

### Test Implementation Notes

- Frontmatter is extracted with regex (no YAML parser in CJS hooks per convention)
- TC-011 checks proximity of TC-NN and BLOCKING within same section/paragraph
- TC-012 specifically verifies TC-08 is WARNING, not BLOCKING

---

## Group 2: Refiner Agent File Validation (12 tests)

**Traces**: FR-03, AC-03.1 through AC-03.5
**Target**: `src/claude/agents/04-test-strategy-refiner.md`

| TC# | Test Name | AC/VR | Type | Assertion |
|-----|-----------|-------|------|-----------|
| TC-014 | refiner agent file exists and is readable | AC-03.1, VR-AGENT-006 | positive | `readFileSync(REFINER_FILE)` does not throw |
| TC-015 | refiner has valid YAML frontmatter delimiters | AC-03.1, VR-AGENT-006 | positive | Content matches `/^---\n[\s\S]*?\n---/` |
| TC-016 | refiner frontmatter has name: test-strategy-refiner | AC-03.1, VR-AGENT-007 | positive | Content matches `/name:\s*test-strategy-refiner/` |
| TC-017 | refiner frontmatter has model: opus | AC-03.1, VR-AGENT-008 | positive | Content matches `/model:\s*opus/` |
| TC-018 | refiner owned_skills includes TEST-001 through TEST-005 | AC-06.2, VR-AGENT-009 | positive | All five skill IDs present |
| TC-019 | refiner documents fix strategies for all 8 TC-NN categories | AC-03.2, VR-REFINER-001 | positive | Content references TC-01 through TC-08 with fix strategy language |
| TC-020 | refiner documents change log format | AC-03.4, VR-REFINER-002 | positive | Content contains `Changes in Round` or `Change Log` and columns: Finding, Severity, Action, Target, Description |
| TC-021 | refiner documents [NEEDS CLARIFICATION] escalation | AC-03.5, VR-REFINER-003 | positive | Content contains `[NEEDS CLARIFICATION]` |
| TC-022 | refiner documents in-place artifact updates | AC-03.3, VR-REFINER-004 | positive | Content references all 4 Phase 05 artifacts as update targets |
| TC-023 | refiner description mentions orchestrator-only invocation | C-03, VR-AGENT-010 | positive | Content contains `ONLY invoked by the orchestrator` |
| TC-024 | refiner has broader skill set than critic (5 vs 3) | AC-06.1, AC-06.2 | positive | Refiner owned_skills count (5) > critic owned_skills count (3) |
| TC-025 | refiner documents NEVER remove existing test cases rule | AC-03.2 | positive | Content contains `NEVER remove` or additive-only semantics |

---

## Group 3: DEBATE_ROUTING Table Validation (10 tests)

**Traces**: FR-04, AC-04.1 through AC-04.4
**Target**: `src/claude/agents/00-sdlc-orchestrator.md`

| TC# | Test Name | AC/VR | Type | Assertion |
|-----|-----------|-------|------|-----------|
| TC-026 | DEBATE_ROUTING table contains 05-test-strategy row | AC-04.1, VR-ROUTING-001 | positive | Line matching `\|\s*05-test-strategy\s*\|` exists |
| TC-027 | Phase 05 Creator maps to 04-test-design-engineer.md | AC-04.1, VR-ROUTING-002 | positive | Same row contains `04-test-design-engineer.md` |
| TC-028 | Phase 05 Critic maps to 04-test-strategy-critic.md | AC-04.1, VR-ROUTING-003 | positive | Same row contains `04-test-strategy-critic.md` |
| TC-029 | Phase 05 Refiner maps to 04-test-strategy-refiner.md | AC-04.1, VR-ROUTING-004 | positive | Same row contains `04-test-strategy-refiner.md` |
| TC-030 | Phase 05 row lists test-strategy.md in Phase Artifacts | AC-04.2, VR-ROUTING-005 | positive | Row contains `test-strategy.md` |
| TC-031 | Phase 05 row lists test-cases/ in Phase Artifacts | AC-04.2, VR-ROUTING-005 | positive | Row contains `test-cases/` |
| TC-032 | Phase 05 row lists traceability-matrix.csv in Phase Artifacts | AC-04.2, VR-ROUTING-005 | positive | Row contains `traceability-matrix.csv` |
| TC-033 | Phase 05 row lists test-data-plan.md in Phase Artifacts | AC-04.2, VR-ROUTING-005 | positive | Row contains `test-data-plan.md` |
| TC-034 | Phase 05 Critical Artifact is test-strategy.md | AC-04.3, VR-ROUTING-006 | positive | Last column of the Phase 05 row is `test-strategy.md` |
| TC-035 | DEBATE_ROUTING table has at least 4 rows after addition | AC-04.4 | positive | Count of `\|` rows under DEBATE_ROUTING header >= 4 |

### Test Implementation Notes

- Extract the `05-test-strategy` row as a single string for column validation
- TC-034 splits the row by `|` and checks the last non-empty column

---

## Group 4: Creator Awareness Validation (8 tests)

**Traces**: FR-05, AC-05.1 through AC-05.4
**Target**: `src/claude/agents/04-test-design-engineer.md`

| TC# | Test Name | AC/VR | Type | Assertion |
|-----|-----------|-------|------|-----------|
| TC-036 | test-design-engineer has DEBATE_CONTEXT mode detection | AC-05.1, VR-CREATOR-001 | positive | Content contains `DEBATE_CONTEXT` |
| TC-037 | test-design-engineer documents Round labeling | AC-05.1, VR-CREATOR-002 | positive | Content matches `Round.*Draft` or `Round labeling` |
| TC-038 | test-design-engineer preserves single-agent fallback | AC-05.3, VR-CREATOR-003 | positive | Content contains `single-agent mode` and `current behavior preserved` |
| TC-039 | test-design-engineer documents section markers for Critic | AC-05.4, VR-CREATOR-004 | positive | Content references section markers or TC-NN check categories |
| TC-040 | Creator mode labels artifacts as Round N Draft | AC-05.1 | positive | Content contains specific Round labeling instructions for test-strategy.md |
| TC-041 | Creator mode skips final save menu in debate | AC-05.1 | positive | Content contains instruction to skip save menu or end with "artifacts produced" |
| TC-042 | Creator round > 1 reads Refiner improvements as baseline | AC-05.2 | positive | Content references reading Refiner output or prior_critique for round > 1 |
| TC-043 | Creator mode produces section markers matching TC-01..TC-08 | AC-05.4 | positive | Content references Test Pyramid, Flaky Test Mitigation, Performance Test Plan sections |

---

## Group 5: Skills Manifest Validation (10 tests)

**Traces**: FR-06, AC-06.1 through AC-06.4, C-02
**Target**: `src/claude/hooks/config/skills-manifest.json`

| TC# | Test Name | AC/VR | Type | Assertion |
|-----|-----------|-------|------|-----------|
| TC-044 | manifest has test-strategy-critic agent entry | AC-06.1, VR-MANIFEST-001 | positive | `agents['test-strategy-critic']` exists |
| TC-045 | manifest has test-strategy-refiner agent entry | AC-06.2, VR-MANIFEST-002 | positive | `agents['test-strategy-refiner']` exists |
| TC-046 | critic agent_id is '04' | AC-06.1 | positive | Agent entry has `agent_id: '04'` |
| TC-047 | refiner agent_id is '04' | AC-06.2 | positive | Agent entry has `agent_id: '04'` |
| TC-048 | critic phase is '05-test-strategy' | AC-06.1 | positive | Agent entry has `phase: '05-test-strategy'` |
| TC-049 | refiner phase is '05-test-strategy' | AC-06.2 | positive | Agent entry has `phase: '05-test-strategy'` |
| TC-050 | critic skills are exactly [TEST-002, TEST-004, TEST-005] | AC-06.1, VR-AGENT-005 | positive | Agent skills array matches expected |
| TC-051 | refiner skills are exactly [TEST-001, TEST-002, TEST-003, TEST-004, TEST-005] | AC-06.2, VR-AGENT-009 | positive | Agent skills array matches expected |
| TC-052 | critic skill_count matches skills array length | AC-06.1 | positive | `skill_count === skills.length` |
| TC-053 | refiner skill_count matches skills array length | AC-06.2 | positive | `skill_count === skills.length` |

---

## Group 6: Manifest Invariants and Constraints (8 tests)

**Traces**: FR-06, AC-06.3, AC-06.4, C-02
**Target**: `src/claude/hooks/config/skills-manifest.json`

| TC# | Test Name | AC/VR | Type | Assertion |
|-----|-----------|-------|------|-----------|
| TC-054 | total_skills count remains 242 | AC-06.4, VR-MANIFEST-003, C-02 | positive | `manifest.total_skills === 242` |
| TC-055 | no new skill IDs created in manifest | AC-06.4, C-02 | negative | No skill IDs in new agents that are not already in skill_owners |
| TC-056 | skill_owners map is unchanged for TEST-001..005 | AC-06.3 | positive | Primary owner for TEST-001..005 remains `test-design-engineer` |
| TC-057 | critic skills are a subset of test-design-engineer skills | AC-06.1 | positive | Every critic skill exists in test-design-engineer skills |
| TC-058 | refiner skills are a subset of test-design-engineer skills | AC-06.2 | positive | Every refiner skill exists in test-design-engineer skills |
| TC-059 | no duplicate skill IDs within critic agent entry | VR-MANIFEST-004 | negative | All skill IDs in critic skills array are unique |
| TC-060 | no duplicate skill IDs within refiner agent entry | VR-MANIFEST-004 | negative | All skill IDs in refiner skills array are unique |
| TC-061 | manifest JSON is valid and parseable | VR-MANIFEST-001 | positive | `JSON.parse(readFileSync(MANIFEST_FILE))` does not throw |
