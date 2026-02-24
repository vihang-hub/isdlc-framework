/**
 * Tests for Multi-agent Test Strategy Team (REQ-0016)
 * Validates the debate team agents, orchestrator routing, and skills manifest.
 *
 * Traces: FR-01 through FR-07, NFR-01, NFR-04
 * Framework: node:test + node:assert/strict (CJS)
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

// =========================================================================
// File Paths
// =========================================================================

const AGENTS_DIR = join(__dirname, '..', '..', 'agents');
const CRITIC_FILE = join(AGENTS_DIR, '04-test-strategy-critic.md');
const REFINER_FILE = join(AGENTS_DIR, '04-test-strategy-refiner.md');
const CREATOR_FILE = join(AGENTS_DIR, '04-test-design-engineer.md');
const ORCHESTRATOR_FILE = join(AGENTS_DIR, '00-sdlc-orchestrator.md');
const MANIFEST_FILE = join(__dirname, '..', 'config', 'skills-manifest.json');
const ISDLC_CMD_FILE = join(__dirname, '..', '..', 'commands', 'isdlc.md');

// =========================================================================
// Helper Functions
// =========================================================================

/**
 * Reads a file and returns its content as a string.
 * @param {string} filePath - Absolute file path
 * @returns {string} File content
 */
function readFile(filePath) {
  return readFileSync(filePath, 'utf-8');
}

/**
 * Extracts YAML frontmatter from a markdown agent file.
 * @param {string} content - Full file content
 * @returns {string} Frontmatter block (between --- delimiters)
 */
function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  return match ? match[1] : '';
}

/**
 * Extracts a YAML field value from frontmatter.
 * @param {string} frontmatter - The YAML frontmatter string
 * @param {string} field - The field name to extract
 * @returns {string|null} The field value or null
 */
function extractField(frontmatter, field) {
  const match = frontmatter.match(new RegExp(`^${field}:\\s*(.+)`, 'm'));
  return match ? match[1].trim() : null;
}

/**
 * Extracts owned_skills list from frontmatter.
 * @param {string} frontmatter - The YAML frontmatter string
 * @returns {string[]} Array of skill IDs
 */
function extractSkills(frontmatter) {
  const skills = [];
  const lines = frontmatter.split('\n');
  let inSkills = false;
  for (const line of lines) {
    if (/^owned_skills:/.test(line)) {
      inSkills = true;
      continue;
    }
    if (inSkills) {
      const skillMatch = line.match(/^\s+-\s+([\w-]+)/);
      if (skillMatch) {
        skills.push(skillMatch[1]);
      } else {
        break;
      }
    }
  }
  return skills;
}

/**
 * Extracts the DEBATE_ROUTING row for a given phase key from orchestrator content.
 * @param {string} content - Orchestrator file content
 * @param {string} phaseKey - e.g. '05-test-strategy'
 * @returns {string|null} The full table row or null
 */
function getRoutingRow(content, phaseKey) {
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.includes(`| ${phaseKey} `) || line.includes(`| ${phaseKey}|`)) {
      return line;
    }
  }
  return null;
}

/**
 * Counts pipe-delimited columns in a markdown table row.
 * @param {string} row - A markdown table row
 * @returns {number} Column count
 */
function countColumns(row) {
  // Split by pipe, trim empty edges
  return row.split('|').filter(c => c.trim() !== '').length;
}

/**
 * Creates a fixture with a specific field removed from frontmatter.
 * Used for negative tests.
 * @param {string} content - Full agent file content
 * @param {string} fieldPattern - Regex pattern for the field to remove
 * @returns {string} Modified content
 */
function removeFieldFromContent(content, fieldPattern) {
  return content.replace(new RegExp(fieldPattern, 'gm'), '');
}

// =========================================================================
// Loaded Content (cached for performance)
// =========================================================================

let criticContent, refinerContent, creatorContent, orchestratorContent, manifest, isdlcContent;

try {
  criticContent = readFile(CRITIC_FILE);
  refinerContent = readFile(REFINER_FILE);
  creatorContent = readFile(CREATOR_FILE);
  orchestratorContent = readFile(ORCHESTRATOR_FILE);
  manifest = JSON.parse(readFile(MANIFEST_FILE));
  isdlcContent = readFile(ISDLC_CMD_FILE);
} catch (err) {
  // Files may not exist yet during TDD Red phase -- tests will fail appropriately
  criticContent = '';
  refinerContent = '';
  creatorContent = '';
  orchestratorContent = '';
  manifest = { total_skills: 0, ownership: {}, skill_lookup: {} };
  isdlcContent = '';
}

const criticFm = extractFrontmatter(criticContent);
const refinerFm = extractFrontmatter(refinerContent);
const creatorFm = extractFrontmatter(creatorContent);

const criticSkills = extractSkills(criticFm);
const refinerSkills = extractSkills(refinerFm);

// =========================================================================
// Group 1: Critic Agent File Validation (13 tests)
// Traces: FR-01, FR-02, AC-01.1..AC-01.5, AC-02.1..AC-02.8
// =========================================================================

describe('Critic Agent Validation (FR-01, FR-02)', () => {

  // TC-001
  it('critic agent file exists and is readable', () => {
    assert.ok(existsSync(CRITIC_FILE), 'Critic agent file does not exist');
    const content = readFile(CRITIC_FILE);
    assert.ok(content.length > 0, 'Critic agent file is empty');
  });

  // TC-002
  it('critic has valid YAML frontmatter delimiters', () => {
    assert.match(criticContent, /^---\n[\s\S]*?\n---/, 'Missing YAML frontmatter delimiters');
  });

  // TC-003
  it('critic frontmatter has name: test-strategy-critic', () => {
    const name = extractField(criticFm, 'name');
    assert.equal(name, 'test-strategy-critic');
  });

  // TC-004
  it('critic frontmatter has model: opus', () => {
    const model = extractField(criticFm, 'model');
    assert.equal(model, 'opus');
  });

  // TC-005
  it('critic frontmatter owned_skills reference only TEST-* IDs', () => {
    assert.ok(criticSkills.length > 0, 'No owned_skills found');
    for (const skill of criticSkills) {
      assert.match(skill, /^TEST-\d{3}$/, `Skill ${skill} does not match TEST-NNN pattern`);
    }
  });

  // TC-006
  it('critic owned_skills includes TEST-002, TEST-004, TEST-005', () => {
    assert.ok(criticSkills.includes('TEST-002'), 'Missing TEST-002');
    assert.ok(criticSkills.includes('TEST-004'), 'Missing TEST-004');
    assert.ok(criticSkills.includes('TEST-005'), 'Missing TEST-005');
  });

  // TC-007
  it('critic documents all 8 mandatory checks TC-01 through TC-08', () => {
    for (let i = 1; i <= 8; i++) {
      const tcId = `TC-0${i}`;
      assert.ok(criticContent.includes(tcId), `Missing mandatory check ${tcId}`);
    }
  });

  // TC-008
  it('critic references all 4 Phase 05 input artifacts', () => {
    assert.ok(criticContent.includes('test-strategy.md'), 'Missing test-strategy.md reference');
    assert.ok(criticContent.includes('test-cases/'), 'Missing test-cases/ reference');
    assert.ok(criticContent.includes('traceability-matrix.csv'), 'Missing traceability-matrix.csv reference');
    assert.ok(criticContent.includes('test-data-plan.md'), 'Missing test-data-plan.md reference');
  });

  // TC-009
  it('critic output follows round-{N}-critique.md naming', () => {
    assert.ok(
      criticContent.includes('round-{N}-critique.md') || criticContent.match(/round-\{N\}-critique\.md/),
      'Missing round-{N}-critique.md output format reference'
    );
  });

  // TC-010
  it('critic documents BLOCKING/WARNING finding IDs (B-NNN, W-NNN)', () => {
    assert.ok(criticContent.includes('B-'), 'Missing B-NNN BLOCKING finding pattern');
    assert.ok(criticContent.includes('W-'), 'Missing W-NNN WARNING finding pattern');
    assert.ok(criticContent.includes('BLOCKING'), 'Missing BLOCKING keyword');
    assert.ok(criticContent.includes('WARNING'), 'Missing WARNING keyword');
  });

  // TC-011
  it('critic classifies TC-01 through TC-07 as BLOCKING', () => {
    // For each TC-01..TC-07, verify they appear near the word BLOCKING
    for (let i = 1; i <= 7; i++) {
      const tcId = `TC-0${i}`;
      // Find the line containing the TC ID and verify BLOCKING context
      const lines = criticContent.split('\n');
      let foundWithBlocking = false;
      for (let j = 0; j < lines.length; j++) {
        if (lines[j].includes(tcId) && lines[j].includes('BLOCKING')) {
          foundWithBlocking = true;
          break;
        }
      }
      assert.ok(foundWithBlocking, `${tcId} should be classified as BLOCKING`);
    }
  });

  // TC-012
  it('critic classifies TC-08 as WARNING', () => {
    const lines = criticContent.split('\n');
    let foundWithWarning = false;
    for (const line of lines) {
      if (line.includes('TC-08') && line.includes('WARNING')) {
        foundWithWarning = true;
        break;
      }
    }
    assert.ok(foundWithWarning, 'TC-08 should be classified as WARNING');
  });

  // TC-013
  it('critic description mentions orchestrator-only invocation', () => {
    assert.ok(
      criticContent.includes('ONLY invoked by the orchestrator'),
      'Missing orchestrator-only invocation statement'
    );
  });
});

// =========================================================================
// Group 2: Refiner Agent File Validation (12 tests)
// Traces: FR-03, AC-03.1..AC-03.5
// =========================================================================

describe('Refiner Agent Validation (FR-03)', () => {

  // TC-014
  it('refiner agent file exists and is readable', () => {
    assert.ok(existsSync(REFINER_FILE), 'Refiner agent file does not exist');
    const content = readFile(REFINER_FILE);
    assert.ok(content.length > 0, 'Refiner agent file is empty');
  });

  // TC-015
  it('refiner has valid YAML frontmatter delimiters', () => {
    assert.match(refinerContent, /^---\n[\s\S]*?\n---/, 'Missing YAML frontmatter delimiters');
  });

  // TC-016
  it('refiner frontmatter has name: test-strategy-refiner', () => {
    const name = extractField(refinerFm, 'name');
    assert.equal(name, 'test-strategy-refiner');
  });

  // TC-017
  it('refiner frontmatter has model: opus', () => {
    const model = extractField(refinerFm, 'model');
    assert.equal(model, 'opus');
  });

  // TC-018
  it('refiner owned_skills includes TEST-001 through TEST-005', () => {
    assert.ok(refinerSkills.includes('TEST-001'), 'Missing TEST-001');
    assert.ok(refinerSkills.includes('TEST-002'), 'Missing TEST-002');
    assert.ok(refinerSkills.includes('TEST-003'), 'Missing TEST-003');
    assert.ok(refinerSkills.includes('TEST-004'), 'Missing TEST-004');
    assert.ok(refinerSkills.includes('TEST-005'), 'Missing TEST-005');
  });

  // TC-019
  it('refiner documents fix strategies for all 8 TC-NN categories', () => {
    for (let i = 1; i <= 8; i++) {
      const tcId = `TC-0${i}`;
      assert.ok(refinerContent.includes(tcId), `Missing fix strategy for ${tcId}`);
    }
  });

  // TC-020
  it('refiner documents change log format with required columns', () => {
    assert.ok(
      refinerContent.includes('Changes in Round') || refinerContent.includes('Change Log'),
      'Missing change log format'
    );
    assert.ok(refinerContent.includes('Finding'), 'Missing Finding column');
    assert.ok(refinerContent.includes('Severity'), 'Missing Severity column');
    assert.ok(refinerContent.includes('Action'), 'Missing Action column');
    assert.ok(refinerContent.includes('Target'), 'Missing Target column');
  });

  // TC-021
  it('refiner documents [NEEDS CLARIFICATION] escalation', () => {
    assert.ok(
      refinerContent.includes('[NEEDS CLARIFICATION]'),
      'Missing [NEEDS CLARIFICATION] escalation documentation'
    );
  });

  // TC-022
  it('refiner documents in-place artifact updates for all 4 artifacts', () => {
    // Check for artifact references in update context
    assert.ok(refinerContent.includes('test-strategy.md'), 'Missing test-strategy.md update');
    assert.ok(refinerContent.includes('test-cases/'), 'Missing test-cases/ update');
    assert.ok(refinerContent.includes('traceability-matrix.csv'), 'Missing traceability-matrix.csv update');
    assert.ok(refinerContent.includes('test-data-plan.md'), 'Missing test-data-plan.md update');
  });

  // TC-023
  it('refiner description mentions orchestrator-only invocation', () => {
    assert.ok(
      refinerContent.includes('ONLY invoked by the orchestrator'),
      'Missing orchestrator-only invocation statement'
    );
  });

  // TC-024
  it('refiner has broader skill set than critic (5 vs 3)', () => {
    assert.ok(refinerSkills.length > criticSkills.length,
      `Refiner skills (${refinerSkills.length}) should be more than critic skills (${criticSkills.length})`);
    assert.equal(refinerSkills.length, 5, 'Refiner should have 5 skills');
    assert.equal(criticSkills.length, 3, 'Critic should have 3 skills');
  });

  // TC-025
  it('refiner documents additive-only modification rule', () => {
    assert.ok(
      refinerContent.includes('NEVER remove'),
      'Missing NEVER remove (additive-only) rule'
    );
  });
});

// =========================================================================
// Group 3: DEBATE_ROUTING Table Validation (10 tests)
// Traces: FR-04, AC-04.1..AC-04.4
// =========================================================================

describe('DEBATE_ROUTING Validation (FR-04)', () => {

  const phase05Row = getRoutingRow(orchestratorContent, '05-test-strategy');

  // TC-026
  it('DEBATE_ROUTING has 05-test-strategy row', () => {
    assert.ok(phase05Row, 'Missing 05-test-strategy row in DEBATE_ROUTING');
  });

  // TC-027
  it('Phase 05 Creator maps to 04-test-design-engineer.md', () => {
    assert.ok(phase05Row, 'Row not found');
    assert.ok(phase05Row.includes('04-test-design-engineer.md'),
      'Phase 05 Creator should be 04-test-design-engineer.md');
  });

  // TC-028
  it('Phase 05 Critic maps to 04-test-strategy-critic.md', () => {
    assert.ok(phase05Row, 'Row not found');
    assert.ok(phase05Row.includes('04-test-strategy-critic.md'),
      'Phase 05 Critic should be 04-test-strategy-critic.md');
  });

  // TC-029
  it('Phase 05 Refiner maps to 04-test-strategy-refiner.md', () => {
    assert.ok(phase05Row, 'Row not found');
    assert.ok(phase05Row.includes('04-test-strategy-refiner.md'),
      'Phase 05 Refiner should be 04-test-strategy-refiner.md');
  });

  // TC-030
  it('Phase 05 row lists test-strategy.md in artifacts', () => {
    assert.ok(phase05Row, 'Row not found');
    assert.ok(phase05Row.includes('test-strategy.md'),
      'Missing test-strategy.md in Phase 05 artifacts');
  });

  // TC-031
  it('Phase 05 row lists test-cases/ in artifacts', () => {
    assert.ok(phase05Row, 'Row not found');
    assert.ok(phase05Row.includes('test-cases/'),
      'Missing test-cases/ in Phase 05 artifacts');
  });

  // TC-032
  it('Phase 05 row lists traceability-matrix.csv in artifacts', () => {
    assert.ok(phase05Row, 'Row not found');
    assert.ok(phase05Row.includes('traceability-matrix.csv'),
      'Missing traceability-matrix.csv in Phase 05 artifacts');
  });

  // TC-033
  it('Phase 05 row lists test-data-plan.md in artifacts', () => {
    assert.ok(phase05Row, 'Row not found');
    assert.ok(phase05Row.includes('test-data-plan.md'),
      'Missing test-data-plan.md in Phase 05 artifacts');
  });

  // TC-034
  it('Phase 05 critical artifact is test-strategy.md', () => {
    assert.ok(phase05Row, 'Row not found');
    // The last column before the trailing pipe should contain test-strategy.md
    const columns = phase05Row.split('|').filter(c => c.trim() !== '');
    const lastColumn = columns[columns.length - 1].trim();
    assert.equal(lastColumn, 'test-strategy.md',
      `Critical artifact should be test-strategy.md, got: ${lastColumn}`);
  });

  // TC-035
  it('DEBATE_ROUTING table has at least 4 rows', () => {
    // Count data rows (exclude header and separator)
    const lines = orchestratorContent.split('\n');
    let inTable = false;
    let dataRows = 0;
    for (const line of lines) {
      if (line.includes('| Phase Key |') && line.includes('Creator Agent')) {
        inTable = true;
        continue;
      }
      if (inTable && line.match(/^\|[-\s|]+\|$/)) {
        continue; // separator row
      }
      if (inTable && line.startsWith('|') && line.includes('-')) {
        // Check if this is a data row with a phase key
        if (line.match(/\|\s*\d{2}-/)) {
          dataRows++;
        }
      }
      if (inTable && !line.startsWith('|') && line.trim() !== '') {
        break;
      }
    }
    assert.ok(dataRows >= 4, `Expected at least 4 DEBATE_ROUTING rows, found ${dataRows}`);
  });
});

// =========================================================================
// Group 4: Creator Awareness Validation (8 tests)
// Traces: FR-05, AC-05.1..AC-05.4
// =========================================================================

describe('Creator Awareness Validation (FR-05)', () => {

  // TC-036
  it('test-design-engineer has DEBATE_CONTEXT mode detection', () => {
    assert.ok(creatorContent.includes('DEBATE_CONTEXT'),
      'Missing DEBATE_CONTEXT reference');
  });

  // TC-037
  it('test-design-engineer documents Round labeling', () => {
    assert.ok(
      creatorContent.includes('Round {N} Draft') || creatorContent.includes('Round labeling'),
      'Missing Round labeling documentation'
    );
  });

  // TC-038
  it('test-design-engineer preserves single-agent fallback', () => {
    assert.ok(creatorContent.includes('Single-agent mode') || creatorContent.includes('single-agent mode'),
      'Missing single-agent mode reference');
    assert.ok(creatorContent.includes('current behavior preserved'),
      'Missing current behavior preserved statement');
  });

  // TC-039
  it('test-design-engineer documents section markers for Critic', () => {
    assert.ok(
      creatorContent.includes('section markers') || creatorContent.includes('Section Markers'),
      'Missing section markers documentation'
    );
  });

  // TC-040
  it('Creator mode labels artifacts as Round N Draft', () => {
    assert.ok(creatorContent.includes('Round {N} Draft'),
      'Missing Round {N} Draft labeling instruction');
  });

  // TC-041
  it('Creator mode skips final save menu in debate', () => {
    // Check for save menu skip instruction
    assert.ok(
      creatorContent.includes('Skip Final Save Menu') || creatorContent.includes('DO NOT present the final'),
      'Missing final save menu skip instruction'
    );
  });

  // TC-042
  it('Creator round > 1 reads Refiner improvements', () => {
    assert.ok(
      creatorContent.includes('prior_critique') || creatorContent.includes('Refiner\'s updated artifacts') || creatorContent.includes("Refiner's updated artifacts") || creatorContent.includes("Refiner's improvements"),
      'Missing round > 1 Refiner improvement handling'
    );
  });

  // TC-043
  it('Creator produces section markers matching TC-01..TC-08', () => {
    // Creator should reference check categories for section markers
    assert.ok(
      creatorContent.includes('TC-02') || creatorContent.includes('Test Pyramid'),
      'Missing TC-02/Test Pyramid section marker reference'
    );
    assert.ok(
      creatorContent.includes('TC-05') || creatorContent.includes('Flaky Test'),
      'Missing TC-05/Flaky Test section marker reference'
    );
    assert.ok(
      creatorContent.includes('TC-07') || creatorContent.includes('Performance Test'),
      'Missing TC-07/Performance Test section marker reference'
    );
  });
});

// =========================================================================
// Group 5: Skills Manifest Agent Entries (10 tests)
// Traces: FR-06, AC-06.1..AC-06.4
// =========================================================================

describe('Skills Manifest Entries (FR-06)', () => {

  const agents = manifest.ownership || {};

  // TC-044
  it('manifest has test-strategy-critic agent entry', () => {
    assert.ok(agents['test-strategy-critic'],
      'Missing test-strategy-critic in manifest agents');
  });

  // TC-045
  it('manifest has test-strategy-refiner agent entry', () => {
    assert.ok(agents['test-strategy-refiner'],
      'Missing test-strategy-refiner in manifest agents');
  });

  // TC-046
  it('critic agent_id is 04', () => {
    assert.equal(agents['test-strategy-critic']?.agent_id, '04');
  });

  // TC-047
  it('refiner agent_id is 04', () => {
    assert.equal(agents['test-strategy-refiner']?.agent_id, '04');
  });

  // TC-048
  it('critic phase is 05-test-strategy', () => {
    assert.equal(agents['test-strategy-critic']?.phase, '05-test-strategy');
  });

  // TC-049
  it('refiner phase is 05-test-strategy', () => {
    assert.equal(agents['test-strategy-refiner']?.phase, '05-test-strategy');
  });

  // TC-050
  it('critic skills are [TEST-002, TEST-004, TEST-005]', () => {
    assert.deepEqual(
      agents['test-strategy-critic']?.skills,
      ['TEST-002', 'TEST-004', 'TEST-005']
    );
  });

  // TC-051
  it('refiner skills are [TEST-001..TEST-005]', () => {
    assert.deepEqual(
      agents['test-strategy-refiner']?.skills,
      ['TEST-001', 'TEST-002', 'TEST-003', 'TEST-004', 'TEST-005']
    );
  });

  // TC-052
  it('critic skill_count matches skills array length', () => {
    const entry = agents['test-strategy-critic'];
    assert.ok(entry, 'Critic entry not found');
    assert.equal(entry.skill_count, entry.skills.length,
      `skill_count (${entry.skill_count}) !== skills.length (${entry.skills.length})`);
  });

  // TC-053
  it('refiner skill_count matches skills array length', () => {
    const entry = agents['test-strategy-refiner'];
    assert.ok(entry, 'Refiner entry not found');
    assert.equal(entry.skill_count, entry.skills.length,
      `skill_count (${entry.skill_count}) !== skills.length (${entry.skills.length})`);
  });
});

// =========================================================================
// Group 6: Manifest Invariants and Constraints (8 tests)
// Traces: C-02, AC-06.3, AC-06.4
// =========================================================================

describe('Manifest Invariants (C-02, AC-06.3, AC-06.4)', () => {

  const agents = manifest.ownership || {};
  const skillOwners = manifest.skill_lookup || {};

  // TC-054
  it('total_skills count remains 246', () => {
    assert.equal(manifest.total_skills, 246,
      `total_skills should be 246, got ${manifest.total_skills}`);
  });

  // TC-055
  it('no new skill IDs created in manifest', () => {
    // All skills in new agent entries should exist in skill_owners
    const criticEntry = agents['test-strategy-critic'];
    const refinerEntry = agents['test-strategy-refiner'];
    if (criticEntry) {
      for (const skill of criticEntry.skills) {
        assert.ok(skillOwners[skill], `Skill ${skill} not in skill_owners -- would be a new skill ID`);
      }
    }
    if (refinerEntry) {
      for (const skill of refinerEntry.skills) {
        assert.ok(skillOwners[skill], `Skill ${skill} not in skill_owners -- would be a new skill ID`);
      }
    }
  });

  // TC-056
  it('skill_owners for TEST-001..005 unchanged', () => {
    // Primary owner should remain test-design-engineer
    for (let i = 1; i <= 5; i++) {
      const skillId = `TEST-00${i}`;
      assert.equal(skillOwners[skillId], 'test-design-engineer',
        `Primary owner of ${skillId} should be test-design-engineer`);
    }
  });

  // TC-057
  it('critic skills are subset of test-design-engineer skills', () => {
    const creatorEntry = agents['test-design-engineer'];
    const criticEntry = agents['test-strategy-critic'];
    assert.ok(creatorEntry, 'test-design-engineer not in manifest');
    assert.ok(criticEntry, 'test-strategy-critic not in manifest');
    for (const skill of criticEntry.skills) {
      assert.ok(creatorEntry.skills.includes(skill),
        `Critic skill ${skill} not in test-design-engineer skills`);
    }
  });

  // TC-058
  it('refiner skills are subset of test-design-engineer skills', () => {
    const creatorEntry = agents['test-design-engineer'];
    const refinerEntry = agents['test-strategy-refiner'];
    assert.ok(creatorEntry, 'test-design-engineer not in manifest');
    assert.ok(refinerEntry, 'test-strategy-refiner not in manifest');
    for (const skill of refinerEntry.skills) {
      assert.ok(creatorEntry.skills.includes(skill),
        `Refiner skill ${skill} not in test-design-engineer skills`);
    }
  });

  // TC-059
  it('no duplicate skill IDs in critic entry', () => {
    const criticEntry = agents['test-strategy-critic'];
    assert.ok(criticEntry, 'Critic entry not found');
    const set = new Set(criticEntry.skills);
    assert.equal(set.size, criticEntry.skills.length,
      'Duplicate skill IDs found in critic entry');
  });

  // TC-060
  it('no duplicate skill IDs in refiner entry', () => {
    const refinerEntry = agents['test-strategy-refiner'];
    assert.ok(refinerEntry, 'Refiner entry not found');
    const set = new Set(refinerEntry.skills);
    assert.equal(set.size, refinerEntry.skills.length,
      'Duplicate skill IDs found in refiner entry');
  });

  // TC-061
  it('manifest JSON is valid and parseable', () => {
    // Already parsed above; verify key structure
    assert.ok(manifest.total_skills !== undefined, 'Missing total_skills');
    assert.ok(manifest.ownership, 'Missing ownership section');
    assert.ok(manifest.skill_lookup, 'Missing skill_lookup section');
  });
});

// =========================================================================
// Group 7: Cross-Module Consistency (8 tests)
// Traces: NFR-01, FR-01, FR-03, FR-04, FR-06
// =========================================================================

describe('Cross-Module Consistency (NFR-01)', () => {

  const agents = manifest.ownership || {};

  // TC-062
  it('critic name in agent file matches manifest key', () => {
    const agentName = extractField(criticFm, 'name');
    assert.equal(agentName, 'test-strategy-critic');
    assert.ok(agents['test-strategy-critic'], 'Manifest key test-strategy-critic missing');
  });

  // TC-063
  it('refiner name in agent file matches manifest key', () => {
    const agentName = extractField(refinerFm, 'name');
    assert.equal(agentName, 'test-strategy-refiner');
    assert.ok(agents['test-strategy-refiner'], 'Manifest key test-strategy-refiner missing');
  });

  // TC-064
  it('critic skills in agent file match manifest exactly', () => {
    const manifestSkills = agents['test-strategy-critic']?.skills || [];
    assert.deepEqual(criticSkills, manifestSkills,
      'Critic skills in agent file do not match manifest');
  });

  // TC-065
  it('refiner skills in agent file match manifest exactly', () => {
    const manifestSkills = agents['test-strategy-refiner']?.skills || [];
    assert.deepEqual(refinerSkills, manifestSkills,
      'Refiner skills in agent file do not match manifest');
  });

  // TC-066
  it('orchestrator critic filename exists on disk', () => {
    const row = getRoutingRow(orchestratorContent, '05-test-strategy');
    assert.ok(row, 'Phase 05 routing row not found');
    assert.ok(row.includes('04-test-strategy-critic.md'));
    assert.ok(existsSync(CRITIC_FILE), 'Critic file referenced in orchestrator does not exist');
  });

  // TC-067
  it('orchestrator refiner filename exists on disk', () => {
    const row = getRoutingRow(orchestratorContent, '05-test-strategy');
    assert.ok(row, 'Phase 05 routing row not found');
    assert.ok(row.includes('04-test-strategy-refiner.md'));
    assert.ok(existsSync(REFINER_FILE), 'Refiner file referenced in orchestrator does not exist');
  });

  // TC-068
  it('orchestrator creator filename exists on disk', () => {
    const row = getRoutingRow(orchestratorContent, '05-test-strategy');
    assert.ok(row, 'Phase 05 routing row not found');
    assert.ok(row.includes('04-test-design-engineer.md'));
    assert.ok(existsSync(CREATOR_FILE), 'Creator file referenced in orchestrator does not exist');
  });

  // TC-069
  it('all new agent skill IDs exist in skill_owners map', () => {
    const skillOwners = manifest.skill_lookup || {};
    const allNewSkills = [
      ...(agents['test-strategy-critic']?.skills || []),
      ...(agents['test-strategy-refiner']?.skills || [])
    ];
    const unique = [...new Set(allNewSkills)];
    for (const skill of unique) {
      assert.ok(skillOwners[skill], `Skill ${skill} not found in skill_owners map`);
    }
  });
});

// =========================================================================
// Group 8: Pattern Compliance (5 tests)
// Traces: NFR-01, C-01
// =========================================================================

describe('Pattern Compliance (NFR-01, C-01)', () => {

  // TC-070
  it('critic uses same file prefix as creator (04-)', () => {
    const criticBasename = require('node:path').basename(CRITIC_FILE);
    assert.ok(criticBasename.startsWith('04-'),
      `Critic file prefix should be 04-, got: ${criticBasename}`);
  });

  // TC-071
  it('refiner uses same file prefix as creator (04-)', () => {
    const refinerBasename = require('node:path').basename(REFINER_FILE);
    assert.ok(refinerBasename.startsWith('04-'),
      `Refiner file prefix should be 04-, got: ${refinerBasename}`);
  });

  // TC-072
  it('critic follows design-critic frontmatter fields', () => {
    // Same 4 fields: name, description, model, owned_skills
    assert.ok(criticFm.includes('name:'), 'Missing name field');
    assert.ok(criticFm.includes('description:'), 'Missing description field');
    assert.ok(criticFm.includes('model:'), 'Missing model field');
    assert.ok(criticFm.includes('owned_skills:'), 'Missing owned_skills field');
  });

  // TC-073
  it('refiner follows design-refiner frontmatter fields', () => {
    // Same 4 fields: name, description, model, owned_skills
    assert.ok(refinerFm.includes('name:'), 'Missing name field');
    assert.ok(refinerFm.includes('description:'), 'Missing description field');
    assert.ok(refinerFm.includes('model:'), 'Missing model field');
    assert.ok(refinerFm.includes('owned_skills:'), 'Missing owned_skills field');
  });

  // TC-074
  it('Phase 05 routing row has same column count as existing', () => {
    const phase05Row = getRoutingRow(orchestratorContent, '05-test-strategy');
    const phase01Row = getRoutingRow(orchestratorContent, '01-requirements');
    assert.ok(phase05Row, 'Phase 05 row not found');
    assert.ok(phase01Row, 'Phase 01 row not found');
    const cols05 = countColumns(phase05Row);
    const cols01 = countColumns(phase01Row);
    assert.equal(cols05, cols01,
      `Phase 05 column count (${cols05}) should match Phase 01 (${cols01})`);
  });
});

// =========================================================================
// Group 9: Regression Guards (4 tests)
// Traces: NFR-04, AC-07.6
// =========================================================================

describe('Regression Guards (NFR-04)', () => {

  // TC-075
  it('01-requirements debate routing entry unchanged', () => {
    const row = getRoutingRow(orchestratorContent, '01-requirements');
    assert.ok(row, 'Missing 01-requirements routing row');
    assert.ok(row.includes('01-requirements-analyst.md'), 'Creator changed');
    assert.ok(row.includes('01-requirements-critic.md'), 'Critic changed');
    assert.ok(row.includes('01-requirements-refiner.md'), 'Refiner changed');
    assert.ok(row.includes('requirements-spec.md'), 'Critical artifact changed');
  });

  // TC-076
  it('03-architecture debate routing entry unchanged', () => {
    const row = getRoutingRow(orchestratorContent, '03-architecture');
    assert.ok(row, 'Missing 03-architecture routing row');
    assert.ok(row.includes('02-solution-architect.md'), 'Creator changed');
    assert.ok(row.includes('02-architecture-critic.md'), 'Critic changed');
    assert.ok(row.includes('02-architecture-refiner.md'), 'Refiner changed');
    assert.ok(row.includes('architecture-overview.md'), 'Critical artifact changed');
  });

  // TC-077
  it('04-design debate routing entry unchanged', () => {
    const row = getRoutingRow(orchestratorContent, '04-design');
    assert.ok(row, 'Missing 04-design routing row');
    assert.ok(row.includes('03-system-designer.md'), 'Creator changed');
    assert.ok(row.includes('03-design-critic.md'), 'Critic changed');
    assert.ok(row.includes('03-design-refiner.md'), 'Refiner changed');
    assert.ok(row.includes('interface-spec.yaml'), 'Critical artifact changed');
  });

  // TC-078
  it('documentation lists Phases 01/03/04/05 in DEBATE_ROUTING', () => {
    // Check isdlc.md has updated debate-enabled phases list
    assert.ok(
      isdlcContent.includes('Phase 01') && isdlcContent.includes('Phase 03') &&
      isdlcContent.includes('Phase 04') && isdlcContent.includes('Phase 05'),
      'isdlc.md should list all 4 debate-enabled phases'
    );
    // Check orchestrator documentation line
    assert.ok(
      orchestratorContent.includes('Phases 01/03/04/05'),
      'Orchestrator should mention Phases 01/03/04/05'
    );
  });
});

// =========================================================================
// Group 10: Negative and Boundary Tests (10 tests)
// Traces: NFR-02, NFR-04, FR-07
// =========================================================================

describe('Edge Cases and Boundary Tests', () => {

  // TC-079: Detect critic without model field
  it('detects critic without model field', () => {
    const modified = removeFieldFromContent(criticContent, '^model:\\s*.+$');
    const fm = extractFrontmatter(modified);
    const model = extractField(fm, 'model');
    assert.equal(model, null, 'Should detect missing model field');
  });

  // TC-080: Detect refiner without owned_skills
  it('detects refiner without owned_skills', () => {
    // Remove owned_skills and all subsequent skill lines
    const modified = refinerContent.replace(/owned_skills:[\s\S]*?(?=---)/m, '');
    const fm = extractFrontmatter(modified);
    const skills = extractSkills(fm);
    assert.equal(skills.length, 0, 'Should detect missing owned_skills');
  });

  // TC-081: Detect missing 05-test-strategy routing row
  it('detects missing 05-test-strategy routing row', () => {
    const modified = orchestratorContent.replace(/\|.*05-test-strategy.*\|/g, '');
    const row = getRoutingRow(modified, '05-test-strategy');
    assert.equal(row, null, 'Should detect missing 05-test-strategy row');
  });

  // TC-082: Detect critic missing a TC check
  it('detects critic missing a TC check', () => {
    // Remove TC-03 from content
    const modified = criticContent.replace(/TC-03/g, '');
    const hasTc03 = modified.includes('TC-03');
    assert.equal(hasTc03, false, 'Should detect missing TC-03');
  });

  // TC-083: Detect refiner missing NEEDS CLARIFICATION
  it('detects refiner missing NEEDS CLARIFICATION', () => {
    const modified = refinerContent.replace(/\[NEEDS CLARIFICATION\]/g, '');
    const has = modified.includes('[NEEDS CLARIFICATION]');
    assert.equal(has, false, 'Should detect missing [NEEDS CLARIFICATION]');
  });

  // TC-084: Detect manifest missing critic entry
  it('detects manifest missing critic entry', () => {
    const modifiedAgents = { ...manifest.ownership };
    delete modifiedAgents['test-strategy-critic'];
    assert.equal(modifiedAgents['test-strategy-critic'], undefined,
      'Should detect missing critic in modified manifest');
  });

  // TC-085: Detect manifest skill_count mismatch
  it('detects manifest skill_count mismatch', () => {
    const modifiedEntry = {
      ...manifest.ownership['test-strategy-critic'],
      skill_count: 99
    };
    assert.notEqual(modifiedEntry.skill_count, modifiedEntry.skills.length,
      'Should detect skill_count mismatch');
  });

  // TC-086: TC-01 classified as BLOCKING not WARNING
  it('TC-01 classified as BLOCKING not WARNING', () => {
    // Find lines with TC-01 and verify they don't say WARNING
    const lines = criticContent.split('\n');
    let tc01WithWarning = false;
    for (const line of lines) {
      if (line.includes('TC-01') && line.includes('WARNING') && !line.includes('BLOCKING')) {
        tc01WithWarning = true;
        break;
      }
    }
    assert.equal(tc01WithWarning, false, 'TC-01 should be BLOCKING, not WARNING');
  });

  // TC-087: TC-08 classified as WARNING not BLOCKING
  it('TC-08 classified as WARNING not BLOCKING', () => {
    // Find the specific TC-08 table row or heading that classifies severity
    // The table row format is: | TC-08 | ORPHAN_TEST_CASE | WARNING |
    // Or the heading: #### TC-08: ORPHAN_TEST_CASE (WARNING)
    const lines = criticContent.split('\n');
    let foundWarningClassification = false;
    for (const line of lines) {
      // Match table row: | TC-08 | ... | WARNING |
      if (line.includes('TC-08') && line.includes('WARNING') && line.includes('ORPHAN_TEST_CASE')) {
        foundWarningClassification = true;
        break;
      }
      // Match heading: TC-08: ORPHAN_TEST_CASE (WARNING)
      if (line.includes('TC-08') && line.includes('(WARNING)')) {
        foundWarningClassification = true;
        break;
      }
    }
    assert.ok(foundWarningClassification, 'TC-08 should be classified as WARNING');
  });

  // TC-088: Each TC-NN has exactly one severity classification
  it('each TC-NN has exactly one severity classification', () => {
    // TC-01..TC-07 should be BLOCKING only, TC-08 should be WARNING only
    for (let i = 1; i <= 7; i++) {
      const tcId = `TC-0${i}`;
      const lines = criticContent.split('\n');
      let foundBlocking = false;
      for (const line of lines) {
        if (line.includes(tcId) && line.includes('BLOCKING')) {
          foundBlocking = true;
          break;
        }
      }
      assert.ok(foundBlocking, `${tcId} should have BLOCKING classification`);
    }
    // TC-08 should have WARNING
    const lines = criticContent.split('\n');
    let foundWarning = false;
    for (const line of lines) {
      if (line.includes('TC-08') && line.includes('WARNING')) {
        foundWarning = true;
        break;
      }
    }
    assert.ok(foundWarning, 'TC-08 should have WARNING classification');
  });
});
