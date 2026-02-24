# Test Strategy: REQ-0007 Deep Discovery

**Feature**: Unify /discover under --deep flag with debate rounds
**Test Design Engineer**: Phase 05
**Date**: 2026-02-10
**Status**: Draft

---

## 1. Test Philosophy

This feature is primarily **markdown agent definitions and JSON configuration**. There is minimal JavaScript code to unit test. The test strategy therefore emphasizes:

1. **JSON schema validation** (automated) -- the only new runtime-parseable artifact
2. **Agent structural validation** (automated) -- YAML frontmatter, required sections, pattern compliance
3. **Flag/command text validation** (automated) -- deprecated flag error messages, option table correctness
4. **Regression protection** (automated) -- all 945 existing tests must continue to pass
5. **Integration cross-checks** (semi-automated) -- cross-file consistency between config, agents, orchestrator, and command

The testing pyramid for this feature is inverted from normal code features: most tests are structural/schema rather than unit/integration, because the "code" is declarative markdown processed by the LLM at runtime.

---

## 2. Test Categories

| Category | Type | Count | Framework | File |
|----------|------|-------|-----------|------|
| A. deep-discovery-config.json schema | Automated ESM | 22 | node:test | `lib/deep-discovery-config.test.js` |
| B. New agent structural validation | Automated ESM | 16 | node:test | `lib/deep-discovery-agents.test.js` |
| C. party-personas.test.js updates | Automated ESM | 18 (existing, modified) | node:test | `lib/party-personas.test.js` |
| D. Command/flag text validation | Automated ESM | 8 | node:test | `lib/discover-flags.test.js` |
| E. Cross-file consistency | Automated ESM | 10 | node:test | `lib/deep-discovery-consistency.test.js` |
| F. Regression suite | Automated | 945 (existing) | node:test | All existing test files |
| **Total new tests** | | **56** | | 4 new files |
| **Total modified tests** | | **18** | | 1 modified file |
| **Total after implementation** | | **983+** | | |

---

## 3. Category A: deep-discovery-config.json Schema Validation (22 tests)

**File**: `lib/deep-discovery-config.test.js`
**Pattern**: Follows `lib/party-personas.test.js` (TC-001 through TC-018)

### Test Cases

| TC | Description | Validates AC |
|----|-------------|-------------|
| TC-A01 | File exists and is valid JSON | Config exists |
| TC-A02 | version field matches semver pattern | Schema |
| TC-A03 | depth_levels has exactly 2 keys: standard, full | REQ-001 |
| TC-A04 | depth_levels.standard.agents is non-empty array of strings | AC-17 |
| TC-A05 | depth_levels.full.agents is non-empty array of strings | AC-24 |
| TC-A06 | standard.agents is a subset of full.agents | Depth hierarchy |
| TC-A07 | standard.debate_rounds equals 3 | AC-25 |
| TC-A08 | full.debate_rounds equals 5 | AC-30, AC-33 |
| TC-A09 | standard.agents contains D1, D2, D5, D6, D16, D17 | AC-17 |
| TC-A10 | full.agents contains D1, D2, D5, D6, D16, D17, D18, D19 | AC-24 |
| TC-A11 | agents object has exactly 4 entries (D16, D17, D18, D19) | REQ-003, REQ-004 |
| TC-A12 | each agent has required fields: title, agent_type, depth_level, output_artifact, scan_domains | Schema |
| TC-A13 | agent.output_artifact ends in .md | Schema |
| TC-A14 | agent.scan_domains is non-empty string array | Schema |
| TC-A15 | D16.depth_level is "standard", D17.depth_level is "standard" | AC-11, AC-14 |
| TC-A16 | D18.depth_level is "full", D19.depth_level is "full" | AC-18, AC-21 |
| TC-A17 | debate_rounds is array sorted by round ascending | Schema |
| TC-A18 | debate_rounds has exactly 5 entries | AC-33 |
| TC-A19 | rounds 1-3 have non-null participants_standard | AC-25, AC-26, AC-27 |
| TC-A20 | rounds 4-5 have null participants_standard | Full-only rounds |
| TC-A21 | rounds 4-5 have participants_full == "all" | AC-30, AC-31 |
| TC-A22 | all agent IDs in debate_rounds participants reference valid agents (config.agents or D1/D2/D5/D6) | Referential integrity |

### Implementation Sketch

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const CONFIG_PATH = join(__dirname, '..', 'src', 'claude', 'agents', 'discover', 'deep-discovery-config.json');
const EXISTING_AGENTS = ['D1', 'D2', 'D5', 'D6'];

describe('deep-discovery-config.json schema validation (REQ-0007)', () => {
  let config;

  it('TC-A01: file exists and is valid JSON', () => {
    assert.ok(existsSync(CONFIG_PATH), `File not found: ${CONFIG_PATH}`);
    config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    assert.ok(config, 'Parsed config should be truthy');
  });

  it('TC-A02: version field matches semver pattern', () => {
    if (!config) config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    assert.match(config.version, /^\d+\.\d+\.\d+$/);
  });

  it('TC-A03: depth_levels has exactly standard and full keys', () => {
    if (!config) config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    const keys = Object.keys(config.depth_levels).sort();
    assert.deepEqual(keys, ['full', 'standard']);
  });

  // ... (TC-A04 through TC-A22 follow same pattern)

  it('TC-A06: standard.agents is a subset of full.agents', () => {
    if (!config) config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    const stdAgents = config.depth_levels.standard.agents;
    const fullAgents = config.depth_levels.full.agents;
    for (const agent of stdAgents) {
      assert.ok(fullAgents.includes(agent),
        `Standard agent ${agent} not in full agents list`);
    }
  });

  it('TC-A22: debate round participants reference valid agents', () => {
    if (!config) config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    const allValid = [...EXISTING_AGENTS, ...Object.keys(config.agents)];
    for (const round of config.debate_rounds) {
      for (const key of ['participants_standard', 'participants_full']) {
        const p = round[key];
        if (p === null || p === 'all') continue;
        if (Array.isArray(p)) {
          for (const id of p) {
            assert.ok(allValid.includes(id),
              `Round ${round.round} ${key} references unknown agent: ${id}`);
          }
        }
      }
    }
  });
});
```

---

## 4. Category B: New Agent Structural Validation (16 tests)

**File**: `lib/deep-discovery-agents.test.js`
**Pattern**: Similar to `lib/prompt-format.test.js` structural checks

### Test Cases

| TC | Description | Validates AC |
|----|-------------|-------------|
| TC-B01 | security-auditor.md exists in src/claude/agents/discover/ | AC-11 |
| TC-B02 | technical-debt-auditor.md exists in src/claude/agents/discover/ | AC-14 |
| TC-B03 | performance-analyst.md exists in src/claude/agents/discover/ | AC-18 |
| TC-B04 | ops-readiness-reviewer.md exists in src/claude/agents/discover/ | AC-21 |
| TC-B05 | Each new agent has valid YAML frontmatter (--- delimiters) | C-001 |
| TC-B06 | Each agent frontmatter has name, description, model, owned_skills | Pattern compliance |
| TC-B07 | Each agent has "Agent ID: D{N}" line with correct ID (D16-D19) | Agent registration |
| TC-B08 | Each agent has "Parent: discover-orchestrator" line | Sub-agent pattern |
| TC-B09 | Each agent has "## Role" section | Pattern compliance |
| TC-B10 | Each agent has "## When Invoked" section | Pattern compliance |
| TC-B11 | Each agent has "## Process" section with numbered steps | Pattern compliance |
| TC-B12 | Each agent has "## Output Contract" section | Interface spec |
| TC-B13 | Each agent has "## Debate Round Participation" section | REQ-005, REQ-006 |
| TC-B14 | D16 owned_skills start with DISC-16 prefix | Skill ID convention |
| TC-B15 | D17 owned_skills start with DISC-17 prefix | Skill ID convention |
| TC-B16 | No agent references "party mode" or "classic mode" (AC-38, AC-40, AC-49-53) | REQ-008, REQ-011 |

### Implementation Sketch

```javascript
const NEW_AGENTS = [
  { file: 'security-auditor.md', id: 'D16', prefix: 'DISC-16' },
  { file: 'technical-debt-auditor.md', id: 'D17', prefix: 'DISC-17' },
  { file: 'performance-analyst.md', id: 'D18', prefix: 'DISC-18' },
  { file: 'ops-readiness-reviewer.md', id: 'D19', prefix: 'DISC-19' },
];

const DISCOVER_DIR = join(__dirname, '..', 'src', 'claude', 'agents', 'discover');

describe('new agent structural validation (REQ-0007)', () => {
  for (const agent of NEW_AGENTS) {
    const filePath = join(DISCOVER_DIR, agent.file);

    it(`TC-B0{N}: ${agent.file} exists`, () => {
      assert.ok(existsSync(filePath));
    });
  }

  it('TC-B05: each new agent has valid YAML frontmatter', () => {
    for (const agent of NEW_AGENTS) {
      const content = readFileSync(join(DISCOVER_DIR, agent.file), 'utf-8');
      assert.ok(content.startsWith('---\n'), `${agent.file} missing frontmatter start`);
      const secondDash = content.indexOf('---', 4);
      assert.ok(secondDash > 0, `${agent.file} missing frontmatter end`);
    }
  });

  it('TC-B16: no agent references party mode or classic mode', () => {
    for (const agent of NEW_AGENTS) {
      const content = readFileSync(join(DISCOVER_DIR, agent.file), 'utf-8').toLowerCase();
      assert.ok(!content.includes('party mode'), `${agent.file} contains "party mode"`);
      assert.ok(!content.includes('classic mode'), `${agent.file} contains "classic mode"`);
    }
  });
});
```

---

## 5. Category C: party-personas.test.js Updates (18 existing tests)

**File**: `lib/party-personas.test.js` (MODIFY, not replace)

### Changes Required

| TC | Current | Change |
|----|---------|--------|
| TC-001-018 | All pass against existing party-personas.json | **NO CHANGES to assertions** |

**Key insight**: party-personas.json itself does NOT change (C-003). The existing 18 tests continue to validate the same file with the same schema. The only change is updating the file's JSDoc header comment to reference the deep discovery context:

```javascript
// BEFORE:
/**
 * party-personas.test.js -- Schema validation for party-personas.json
 *
 * REQ-0006-inception-party-discover: Validates persona config structure...
 */

// AFTER:
/**
 * party-personas.test.js -- Schema validation for party-personas.json
 *
 * REQ-0006-inception-party-discover / REQ-0007-deep-discovery:
 * Validates persona config structure for new project deep discovery.
 * party-personas.json is preserved as-is (C-003).
 */
```

All 18 test cases remain identical. The describe block name is updated:

```javascript
// BEFORE:
describe('party-personas.json schema validation (REQ-0006)', () => {
// AFTER:
describe('party-personas.json schema validation (REQ-0006, REQ-0007)', () => {
```

---

## 6. Category D: Command/Flag Text Validation (8 tests)

**File**: `lib/discover-flags.test.js`
**Purpose**: Validate that discover.md contains correct flag documentation

### Test Cases

| TC | Description | Validates AC |
|----|-------------|-------------|
| TC-D01 | discover.md does NOT contain `--party` in options table | AC-51 |
| TC-D02 | discover.md does NOT contain `--classic` in options table | AC-50 |
| TC-D03 | discover.md contains `--deep` in options table | AC-1 |
| TC-D04 | discover.md contains `--verbose` in options table | AC-42 |
| TC-D05 | discover.md contains deprecated --party error message text | AC-4 |
| TC-D06 | discover.md contains deprecated --classic error message text | AC-5 |
| TC-D07 | discover.md examples section contains `/discover --deep full` | AC-3 |
| TC-D08 | discover.md does NOT contain `/discover --party` or `/discover --classic` in examples | AC-50, AC-51 |

### Implementation Sketch

```javascript
const DISCOVER_CMD_PATH = join(__dirname, '..', 'src', 'claude', 'commands', 'discover.md');

describe('discover.md flag validation (REQ-0007)', () => {
  let content;

  it('TC-D01: options table does not contain --party as active option', () => {
    content = readFileSync(DISCOVER_CMD_PATH, 'utf-8');
    // Check the Options table section specifically
    const optionsSection = content.split('### Options')[1]?.split('###')[0] || '';
    // --party should NOT be in the options table (it may appear in deprecation error text)
    const optionLines = optionsSection.split('\n').filter(l => l.startsWith('|'));
    const partyOption = optionLines.find(l => l.includes('`--party`'));
    assert.equal(partyOption, undefined, 'Options table still contains --party as active option');
  });

  it('TC-D03: options table contains --deep', () => {
    if (!content) content = readFileSync(DISCOVER_CMD_PATH, 'utf-8');
    assert.ok(content.includes('`--deep'), 'discover.md missing --deep option');
  });

  it('TC-D05: contains deprecated --party error message', () => {
    if (!content) content = readFileSync(DISCOVER_CMD_PATH, 'utf-8');
    assert.ok(
      content.includes('--party flag has been replaced by --deep'),
      'Missing --party deprecation error message'
    );
  });
});
```

---

## 7. Category E: Cross-File Consistency (10 tests)

**File**: `lib/deep-discovery-consistency.test.js`
**Purpose**: Validate that changes across multiple files are consistent

### Test Cases

| TC | Description | Validates |
|----|-------------|-----------|
| TC-E01 | Agent count in deep-discovery-config.json matches number of new agent .md files | Config-agent sync |
| TC-E02 | agent_type values in config match actual .md filenames (minus .md extension) | Config-agent mapping |
| TC-E03 | D16-D19 in config have corresponding .md files in discover/ directory | Completeness |
| TC-E04 | discover-orchestrator.md does NOT contain "Step 0: Mode Selection" | AC-52 |
| TC-E05 | discover-orchestrator.md does NOT contain "PARTY MODE FLOW" as section header | AC-49, ADR-007 |
| TC-E06 | discover-orchestrator.md contains "DEEP DISCOVERY FLOW" section | ADR-007 |
| TC-E07 | 7 party agent files do NOT contain "party mode" (case-insensitive) | AC-49, AC-53 |
| TC-E08 | AGENTS.md contains D16, D17, D18, D19 entries | NFR-004 |
| TC-E09 | README.md contains updated agent count (40) | NFR-004 |
| TC-E10 | tour.md does NOT contain --party or --classic | Documentation currency |

### Implementation Sketch

```javascript
describe('deep discovery cross-file consistency (REQ-0007)', () => {
  it('TC-E02: config agent_types match actual .md filenames', () => {
    const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    for (const [id, agent] of Object.entries(config.agents)) {
      const expectedFile = join(DISCOVER_DIR, `${agent.agent_type}.md`);
      assert.ok(existsSync(expectedFile),
        `Config agent ${id} (${agent.agent_type}) has no matching .md file at ${expectedFile}`);
    }
  });

  it('TC-E04: orchestrator does not contain Step 0 Mode Selection', () => {
    const orch = readFileSync(ORCHESTRATOR_PATH, 'utf-8');
    assert.ok(!orch.includes('### Step 0: Mode Selection'),
      'Orchestrator still contains Step 0: Mode Selection');
  });

  it('TC-E07: party agent files do not contain "party mode"', () => {
    const PARTY_AGENT_FILES = [
      'domain-researcher.md', 'technical-scout.md', 'solution-architect-party.md',
      'security-advisor.md', 'devops-pragmatist.md', 'data-model-designer.md',
      'test-strategist.md'
    ];
    for (const file of PARTY_AGENT_FILES) {
      const content = readFileSync(join(DISCOVER_DIR, file), 'utf-8').toLowerCase();
      assert.ok(!content.includes('party mode'),
        `${file} still contains "party mode"`);
    }
  });
});
```

---

## 8. Category F: Regression Suite (945 existing tests)

### Regression Strategy

1. **Pre-implementation**: Run `npm run test:all` and record passing count (expected: 945)
2. **During implementation**: Run after each major file change
3. **Post-implementation**: Run `npm run test:all` and verify count >= 945

### Risk Areas for Regression

| File Changed | Test File(s) At Risk | Risk Level |
|-------------|---------------------|------------|
| party-personas.json | lib/party-personas.test.js (18 tests) | NONE (C-003: file unchanged) |
| discover-orchestrator.md | lib/prompt-format.test.js (structural checks) | LOW (SUGGESTED PROMPTS section preserved) |
| New agent .md files | lib/prompt-format.test.js (SUB_AGENTS list) | MEDIUM (list needs updating to include D16-D19) |
| discover.md | No direct tests | NONE |
| 7 party agent .md files | lib/prompt-format.test.js | LOW (text changes only, structure preserved) |

### prompt-format.test.js Update Required

The `SUB_AGENTS` array in `lib/prompt-format.test.js` must be extended to include the 4 new agent files:

```javascript
// Add to SUB_AGENTS array:
join('discover', 'security-auditor.md'),
join('discover', 'technical-debt-auditor.md'),
join('discover', 'performance-analyst.md'),
join('discover', 'ops-readiness-reviewer.md'),
```

This change increases the structural validation coverage from 36 agents to 40 agents without adding new test cases (the existing loop-based tests automatically cover the new entries).

---

## 9. Test Execution Plan

### 9.1 Pre-Implementation Baseline

```bash
npm run test:all
# Expected: 945 tests (390 ESM + 555 CJS), 0 failures
```

### 9.2 Implementation Checkpoints

| Checkpoint | Trigger | Run |
|------------|---------|-----|
| After new agent .md files created | 4 files created | `npm test` (ESM only -- validates prompt-format inclusion) |
| After deep-discovery-config.json created | 1 file created | `node --test lib/deep-discovery-config.test.js` |
| After discover.md modified | Flag changes | `node --test lib/discover-flags.test.js` |
| After discover-orchestrator.md modified | Major orchestrator changes | `npm test` (ESM full) |
| After party agent renames | 7 files modified | `node --test lib/deep-discovery-consistency.test.js` |
| After all changes | Full suite | `npm run test:all` |

### 9.3 Post-Implementation Verification

```bash
npm run test:all
# Expected: 983+ tests (446+ ESM + 555 CJS), 0 failures
#   390 original ESM
#   + 22 (config schema)
#   + 16 (agent structural)
#   + 8 (flag validation)
#   + 10 (consistency)
#   = 446 ESM
#   + 555 CJS (unchanged)
#   = 1001 total
```

---

## 10. Test Data Strategy

### 10.1 No Mock Data Needed

All tests read actual project files (JSON configs, markdown agents, command files). No synthetic test data or fixtures are required because:
- Schema tests validate the real config file
- Structural tests validate the real agent files
- Flag tests validate the real command file
- Consistency tests cross-check real files against each other

### 10.2 File Path Resolution

All test files use the same pattern for path resolution:

```javascript
const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const BASE_PATH = join(__dirname, '..');  // project root
```

---

## 11. AC Coverage Matrix

| AC | Test Case(s) | Category |
|----|-------------|----------|
| AC-1 | TC-D03, TC-D07 | D (flag text) |
| AC-2 | TC-D03 | D |
| AC-3 | TC-D07 | D |
| AC-4 | TC-D05 | D |
| AC-5 | TC-D06 | D |
| AC-6 | TC-D03 | D |
| AC-7 to AC-10 | TC-E04, TC-E06 | E (orchestrator sections) |
| AC-11 | TC-A09, TC-B01, TC-A15 | A, B |
| AC-12 | TC-A14 (scan_domains array check) | A |
| AC-13 | TC-A13 (output_artifact) | A |
| AC-14 | TC-A09, TC-B02, TC-A15 | A, B |
| AC-15 | TC-A14 | A |
| AC-16 | TC-A13 | A |
| AC-17 | TC-A04, TC-A09 | A |
| AC-18 | TC-A10, TC-B03, TC-A16 | A, B |
| AC-19 | TC-A14 | A |
| AC-20 | TC-A13 | A |
| AC-21 | TC-A10, TC-B04, TC-A16 | A, B |
| AC-22 | TC-A14 | A |
| AC-23 | TC-A13 | A |
| AC-24 | TC-A05, TC-A10 | A |
| AC-25 | TC-A07, TC-A19 | A |
| AC-26 | TC-A19 | A |
| AC-27 | TC-A19 | A |
| AC-28 | (Runtime behavior -- debate synthesis) | Manual verification |
| AC-29 | TC-A17 (sorted order implies sequential) | A |
| AC-30 | TC-A08, TC-A21 | A |
| AC-31 | TC-A21 | A |
| AC-32 | (Runtime behavior -- cross-review) | Manual verification |
| AC-33 | TC-A08, TC-A18 | A |
| AC-34 to AC-37 | TC-E05, TC-E06 (C-003 tests preserve party-personas.json) | E, C |
| AC-38 to AC-40 | TC-B16 | B |
| AC-41 to AC-44 | (Runtime behavior -- verbose toggle) | Manual verification |
| AC-45 to AC-48 | (Runtime behavior -- envelope write) | Manual verification |
| AC-49 | TC-E05, TC-E07 | E |
| AC-50 | TC-D02, TC-D08 | D |
| AC-51 | TC-D01, TC-D08 | D |
| AC-52 | TC-E04 | E |
| AC-53 | TC-E07 | E |
| AC-54 to AC-57 | (Menu behavior -- structural presence in orchestrator) | E (indirectly via E04, E06) |

### AC Coverage Summary

| Coverage | Count | Percentage |
|----------|-------|------------|
| Fully automated | 40 | 70% |
| Manual verification (runtime behavior) | 12 | 21% |
| Indirect (structural proxy) | 5 | 9% |
| **Total** | **57** | **100%** |

The 12 manually-verified AC (AC-28, AC-32, AC-41-44, AC-45-48) relate to runtime LLM agent behavior (debate synthesis quality, verbose toggle UX, envelope write values). These cannot be meaningfully unit-tested because they depend on LLM output. They will be verified during Phase 07 (Integration Testing) by executing actual discovery runs.

---

## 12. NFR Validation

| NFR | Test Approach |
|-----|--------------|
| NFR-001 (Performance) | Manual timing during integration test run. Record total discovery time for standard vs full depth. |
| NFR-002 (Backward Compatibility) | TC-C01-C18 (party-personas.json schema unchanged), TC-A06 (standard subset of full), envelope additive-only by design |
| NFR-003 (Test Regression) | Pre/post `npm run test:all` comparison. Total count must be >= 945. |
| NFR-004 (Constitutional Compliance) | TC-E08 (AGENTS.md updated), TC-E09 (README.md updated), TC-E10 (tour.md updated) |

---

## 13. Test File Summary

| File | Type | Tests | Status |
|------|------|-------|--------|
| `lib/deep-discovery-config.test.js` | NEW | 22 | To be created in Phase 06 |
| `lib/deep-discovery-agents.test.js` | NEW | 16 | To be created in Phase 06 |
| `lib/discover-flags.test.js` | NEW | 8 | To be created in Phase 06 |
| `lib/deep-discovery-consistency.test.js` | NEW | 10 | To be created in Phase 06 |
| `lib/party-personas.test.js` | MODIFY | 18 (unchanged assertions) | Header + describe name update only |
| `lib/prompt-format.test.js` | MODIFY | 39 (+ 4 agents in array) | SUB_AGENTS array extension only |

---

## 14. Test-First Implementation Order

Per Article II (Test-First Development), tests should be written BEFORE the corresponding implementation:

1. **Write `lib/deep-discovery-config.test.js`** (22 tests) -- will fail until config file exists
2. **Create `deep-discovery-config.json`** -- tests should pass
3. **Write `lib/deep-discovery-agents.test.js`** (16 tests) -- will fail until agent files exist
4. **Create 4 agent .md files** (D16-D19) -- tests should pass
5. **Write `lib/discover-flags.test.js`** (8 tests) -- will fail until discover.md modified
6. **Modify discover.md** -- tests should pass
7. **Write `lib/deep-discovery-consistency.test.js`** (10 tests) -- will fail until orchestrator/agent renames done
8. **Modify orchestrator, rename party agents, update docs** -- tests should pass
9. **Update `lib/prompt-format.test.js`** SUB_AGENTS array
10. **Update `lib/party-personas.test.js`** header comment and describe name
11. **Run full regression**: `npm run test:all`
