# Test Data Plan: Multi-agent Test Strategy Team (REQ-0016)

**Version**: 1.0
**Created**: 2026-02-15
**Phase**: 05-test-strategy
**Traces**: FR-01 through FR-07

---

## 1. Test Data Categories

This test suite validates markdown agent files and JSON configuration. The test data falls into two categories:

### Category A: Real Source Files (Read-Only)

The primary test data is the actual source files being validated. These are read from the repository at test time and are NOT modified by tests.

| File | Purpose | Tests |
|------|---------|-------|
| `src/claude/agents/04-test-strategy-critic.md` | Critic agent definition | TC-001..TC-013 |
| `src/claude/agents/04-test-strategy-refiner.md` | Refiner agent definition | TC-014..TC-025 |
| `src/claude/agents/04-test-design-engineer.md` | Creator agent (modified) | TC-036..TC-043 |
| `src/claude/agents/00-sdlc-orchestrator.md` | DEBATE_ROUTING table | TC-026..TC-035, TC-075..TC-078 |
| `src/claude/hooks/config/skills-manifest.json` | Agent registrations | TC-044..TC-061 |
| `src/claude/agents/03-design-critic.md` | Pattern reference | TC-072 |
| `src/claude/agents/03-design-refiner.md` | Pattern reference | TC-073 |

### Category B: Synthetic Fixtures (In-Memory)

Negative and boundary tests use in-memory fixture strings to validate that assertions correctly detect missing/malformed content.

---

## 2. Boundary Values

### Agent File Frontmatter Fields

| Field | Valid | Boundary | Invalid |
|-------|-------|----------|---------|
| name | `test-strategy-critic` | Empty string `name: ` | Missing entirely |
| model | `opus` | `sonnet` (valid but wrong) | Missing entirely |
| owned_skills | `[TEST-002, TEST-004, TEST-005]` | Empty array `[]` | Missing section |
| description | Multi-line string | Empty description `""` | Missing entirely |

### Skills Manifest Fields

| Field | Valid | Boundary | Invalid |
|-------|-------|----------|---------|
| agent_id | `"04"` | `"4"` (1 char, should be 2) | Missing |
| phase | `"05-test-strategy"` | `"05-test"` (partial) | Empty string |
| skill_count | `3` (critic), `5` (refiner) | `0` | Negative number |
| skills | Array of TEST-NNN IDs | Empty array `[]` | Null |

### DEBATE_ROUTING Row Columns

| Column | Valid | Boundary | Invalid |
|--------|-------|----------|---------|
| Phase Key | `05-test-strategy` | With extra whitespace | Empty |
| Creator Agent | `04-test-design-engineer.md` | Without `.md` extension | Wrong filename |
| Phase Artifacts | 4 comma-separated names | Missing one artifact | Empty |
| Critical Artifact | `test-strategy.md` | Different from Phase Artifacts | Empty |

---

## 3. Invalid Inputs

### Simulated Malformed Agent Content

```javascript
// Missing model field
function createCriticWithoutModel() {
    return `---
name: test-strategy-critic
description: "Review agent"
owned_skills:
  - TEST-002
  - TEST-004
  - TEST-005
---
# Content without model field`;
}

// Missing owned_skills
function createRefinerWithoutSkills() {
    return `---
name: test-strategy-refiner
description: "Refiner agent"
model: opus
---
# Content without owned_skills`;
}

// Missing TC check
function createCriticMissingTC(removedTC) {
    const allTCs = ['TC-01','TC-02','TC-03','TC-04','TC-05','TC-06','TC-07','TC-08'];
    return allTCs
        .filter(tc => tc !== removedTC)
        .map(tc => `### ${tc}: UNTESTED_ACCEPTANCE_CRITERION\n**Severity**: BLOCKING`)
        .join('\n\n');
}

// Missing NEEDS CLARIFICATION
function createRefinerWithoutEscalation() {
    return `---
name: test-strategy-refiner
model: opus
owned_skills:
  - TEST-001
---
# REFINER
## Fix strategies
No escalation protocol documented.`;
}
```

### Simulated Malformed Manifest

```javascript
// Missing critic entry
function createManifestWithoutCritic(realManifest) {
    const copy = JSON.parse(JSON.stringify(realManifest));
    delete copy.ownership['test-strategy-critic'];
    return copy;
}

// Skill count mismatch
function createManifestSkillCountMismatch(realManifest) {
    const copy = JSON.parse(JSON.stringify(realManifest));
    if (copy.ownership['test-strategy-critic']) {
        copy.ownership['test-strategy-critic'].skill_count = 5; // actual has 3 skills
    }
    return copy;
}
```

### Simulated Missing Routing Row

```javascript
// Orchestrator content without Phase 05 row
function createOrchestratorWithoutPhase05(realContent) {
    return realContent.split('\n')
        .filter(line => !line.includes('05-test-strategy'))
        .join('\n');
}
```

---

## 4. Maximum-Size Inputs

Not applicable. The test data consists of:
- Agent markdown files: typically 200-400 lines (well within file-read limits)
- Skills manifest JSON: ~900 lines (parsed entirely, no size concern)
- Orchestrator markdown: ~1300 lines (search for specific patterns, no full parse)

All files are small enough to be read entirely with `readFileSync` without memory concerns.

---

## 5. Test Data Generation Strategy

### No External Generation Needed

Unlike hook tests that require a temp directory with synthetic `state.json`, this test suite reads real source files. Test data generation is limited to:

1. **Fixture functions** for negative tests (defined inline in the test file)
2. **Regex patterns** extracted from `validation-rules.json` (defined as constants)
3. **Expected values** hardcoded from requirements (skill IDs, agent names, phase keys)

### Pattern Constants

```javascript
const PATTERNS = {
    frontmatter: /^---\n([\s\S]*?)\n---/,
    name: /name:\s*(\S+)/,
    model: /model:\s*(\S+)/,
    ownedSkills: /owned_skills:\n((?:\s+-\s+\S+\n?)+)/,
    skillId: /TEST-\d{3}/g,
    debateRouting: /\|\s*05-test-strategy\s*\|/,
    debateContext: /DEBATE_CONTEXT/,
    roundDraft: /Round.*Draft/,
    singleAgent: /single-agent mode/,
    blocking: /BLOCKING/,
    warning: /WARNING/,
    needsClarification: /\[NEEDS CLARIFICATION\]/,
    roundCritique: /round-.*critique\.md/,
    findingId: /[BW]-\d{3}/
};
```

### Expected Constants

```javascript
const EXPECTED = {
    criticName: 'test-strategy-critic',
    refinerName: 'test-strategy-refiner',
    criticModel: 'opus',
    refinerModel: 'opus',
    criticSkills: ['TEST-002', 'TEST-004', 'TEST-005'],
    refinerSkills: ['TEST-001', 'TEST-002', 'TEST-003', 'TEST-004', 'TEST-005'],
    criticAgentId: '04',
    refinerAgentId: '04',
    phase: '05-test-strategy',
    totalSkills: 242,
    mandatoryChecks: ['TC-01','TC-02','TC-03','TC-04','TC-05','TC-06','TC-07','TC-08'],
    phaseArtifacts: ['test-strategy.md', 'test-cases/', 'traceability-matrix.csv', 'test-data-plan.md'],
    criticalArtifact: 'test-strategy.md',
    filePrefix: '04-'
};
```

---

## 6. Test Isolation

| Concern | Approach |
|---------|----------|
| File system | Read-only access to source files; no writes |
| Temp directories | Not needed (no hook execution) |
| Global state | No shared state between tests |
| Order independence | Each test reads its own file independently |
| Cleanup | Nothing to clean up (no temp files created) |
