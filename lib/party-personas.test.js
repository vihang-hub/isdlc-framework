/**
 * party-personas.test.js -- Schema validation for party-personas.json
 *
 * REQ-0006-inception-party-discover / REQ-0007-deep-discovery: Validates
 * persona config structure, phase definitions, agent type references, and
 * constraint compliance. File preserved per C-003 (no rename).
 *
 * Test cases TC-001 through TC-018.
 *
 * @module party-personas.test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const PERSONAS_PATH = join(__dirname, '..', 'src', 'claude', 'agents', 'discover', 'party-personas.json');

describe('party-personas.json schema validation (REQ-0006)', () => {
  // Load the file once for all tests
  let config;

  // TC-001: party-personas.json is valid JSON (parseable)
  it('TC-001: file exists and is valid JSON', () => {
    assert.ok(existsSync(PERSONAS_PATH), `File not found: ${PERSONAS_PATH}`);
    const raw = readFileSync(PERSONAS_PATH, 'utf-8');
    config = JSON.parse(raw); // will throw if invalid JSON
    assert.ok(config, 'Parsed config should be truthy');
  });

  // TC-002: version field matches semver pattern
  it('TC-002: version field matches semver pattern', () => {
    if (!config) config = JSON.parse(readFileSync(PERSONAS_PATH, 'utf-8'));
    assert.ok(config.version, 'Missing version field');
    assert.match(config.version, /^\d+\.\d+\.\d+$/, `Version "${config.version}" does not match semver`);
  });

  // TC-003: personas object has exactly 9 entries
  it('TC-003: personas object has exactly 9 entries', () => {
    if (!config) config = JSON.parse(readFileSync(PERSONAS_PATH, 'utf-8'));
    const count = Object.keys(config.personas).length;
    assert.equal(count, 9, `Expected 9 personas, got ${count}`);
  });

  // TC-004: each persona has all required fields
  it('TC-004: each persona has required fields', () => {
    if (!config) config = JSON.parse(readFileSync(PERSONAS_PATH, 'utf-8'));
    const required = ['name', 'title', 'agent_type', 'agent_id', 'phase',
                      'is_existing_agent', 'communication_style', 'expertise',
                      'question_domains', 'debate_focus'];
    for (const [key, persona] of Object.entries(config.personas)) {
      for (const field of required) {
        assert.ok(
          field in persona,
          `Persona "${key}" missing required field "${field}"`
        );
      }
    }
  });

  // TC-005: persona.phase is 1, 2, or 3 for all personas
  it('TC-005: persona.phase is 1, 2, or 3', () => {
    if (!config) config = JSON.parse(readFileSync(PERSONAS_PATH, 'utf-8'));
    for (const [key, persona] of Object.entries(config.personas)) {
      assert.ok(
        [1, 2, 3].includes(persona.phase),
        `Persona "${key}" has invalid phase: ${persona.phase}`
      );
    }
  });

  // TC-006: persona.agent_id matches D{N} pattern
  it('TC-006: persona.agent_id matches D{N} pattern', () => {
    if (!config) config = JSON.parse(readFileSync(PERSONAS_PATH, 'utf-8'));
    for (const [key, persona] of Object.entries(config.personas)) {
      assert.match(
        persona.agent_id,
        /^D\d+$/,
        `Persona "${key}" agent_id "${persona.agent_id}" does not match D{N}`
      );
    }
  });

  // TC-007: persona.question_domains is array (empty for Phase 2/3)
  it('TC-007: persona.question_domains is array', () => {
    if (!config) config = JSON.parse(readFileSync(PERSONAS_PATH, 'utf-8'));
    for (const [key, persona] of Object.entries(config.personas)) {
      assert.ok(
        Array.isArray(persona.question_domains),
        `Persona "${key}" question_domains is not an array`
      );
    }
  });

  // TC-008: Phase 1 personas have non-empty question_domains
  it('TC-008: Phase 1 personas have non-empty question_domains', () => {
    if (!config) config = JSON.parse(readFileSync(PERSONAS_PATH, 'utf-8'));
    const phase1 = Object.entries(config.personas)
      .filter(([, p]) => p.phase === 1);
    assert.ok(phase1.length > 0, 'No Phase 1 personas found');
    for (const [key, persona] of phase1) {
      assert.ok(
        persona.question_domains.length > 0,
        `Phase 1 persona "${key}" has empty question_domains`
      );
    }
  });

  // TC-009: phases object has exactly 5 entries
  it('TC-009: phases object has exactly 5 entries', () => {
    if (!config) config = JSON.parse(readFileSync(PERSONAS_PATH, 'utf-8'));
    const count = Object.keys(config.phases).length;
    assert.equal(count, 5, `Expected 5 phases, got ${count}`);
  });

  // TC-010: each phase has required fields
  it('TC-010: each phase has required fields', () => {
    if (!config) config = JSON.parse(readFileSync(PERSONAS_PATH, 'utf-8'));
    const required = ['name', 'type', 'personas', 'max_messages', 'interaction', 'output'];
    for (const [key, phase] of Object.entries(config.phases)) {
      for (const field of required) {
        assert.ok(
          field in phase,
          `Phase "${key}" missing required field "${field}"`
        );
      }
    }
  });

  // TC-011: Phases 1-3 are parallel, phases 4-5 are sequential
  it('TC-011: phases 1-3 parallel, 4-5 sequential', () => {
    if (!config) config = JSON.parse(readFileSync(PERSONAS_PATH, 'utf-8'));
    assert.equal(config.phases['1'].type, 'parallel');
    assert.equal(config.phases['2'].type, 'parallel');
    assert.equal(config.phases['3'].type, 'parallel');
    assert.equal(config.phases['4'].type, 'sequential');
    assert.equal(config.phases['5'].type, 'sequential');
  });

  // TC-012: each parallel phase has exactly 3 personas
  it('TC-012: parallel phases have exactly 3 personas each', () => {
    if (!config) config = JSON.parse(readFileSync(PERSONAS_PATH, 'utf-8'));
    for (const phaseNum of ['1', '2', '3']) {
      const count = config.phases[phaseNum].personas.length;
      assert.equal(
        count, 3,
        `Phase ${phaseNum} has ${count} personas, expected 3`
      );
    }
  });

  // TC-013: sequential phases have empty personas arrays
  it('TC-013: sequential phases have empty personas arrays', () => {
    if (!config) config = JSON.parse(readFileSync(PERSONAS_PATH, 'utf-8'));
    assert.equal(config.phases['4'].personas.length, 0, 'Phase 4 should have 0 personas');
    assert.equal(config.phases['5'].personas.length, 0, 'Phase 5 should have 0 personas');
  });

  // TC-014: max_messages is 10 for parallel, 0 for sequential
  it('TC-014: max_messages correct per phase type', () => {
    if (!config) config = JSON.parse(readFileSync(PERSONAS_PATH, 'utf-8'));
    assert.equal(config.phases['1'].max_messages, 10);
    assert.equal(config.phases['2'].max_messages, 10);
    assert.equal(config.phases['3'].max_messages, 10);
    assert.equal(config.phases['4'].max_messages, 0);
    assert.equal(config.phases['5'].max_messages, 0);
  });

  // TC-015: all persona keys in phases.personas exist in personas object
  it('TC-015: phase persona keys reference valid personas', () => {
    if (!config) config = JSON.parse(readFileSync(PERSONAS_PATH, 'utf-8'));
    for (const [phaseNum, phase] of Object.entries(config.phases)) {
      for (const personaKey of phase.personas) {
        assert.ok(
          personaKey in config.personas,
          `Phase ${phaseNum} references unknown persona "${personaKey}"`
        );
      }
    }
  });

  // TC-016: persona.agent_type values are valid agent filenames
  it('TC-016: agent_type values match expected agent types', () => {
    if (!config) config = JSON.parse(readFileSync(PERSONAS_PATH, 'utf-8'));
    const validTypes = [
      'product-analyst', 'domain-researcher', 'technical-scout',
      'solution-architect-party', 'security-advisor', 'devops-pragmatist',
      'architecture-designer', 'data-model-designer', 'test-strategist'
    ];
    for (const [key, persona] of Object.entries(config.personas)) {
      assert.ok(
        validTypes.includes(persona.agent_type),
        `Persona "${key}" has invalid agent_type: "${persona.agent_type}"`
      );
    }
  });

  // TC-017: is_existing_agent correct for D7 and D8 (true), others (false)
  it('TC-017: is_existing_agent correct for D7/D8 vs new agents', () => {
    if (!config) config = JSON.parse(readFileSync(PERSONAS_PATH, 'utf-8'));
    for (const [key, persona] of Object.entries(config.personas)) {
      if (persona.agent_id === 'D7' || persona.agent_id === 'D8') {
        assert.equal(
          persona.is_existing_agent, true,
          `${key} (${persona.agent_id}) should be is_existing_agent: true`
        );
      } else {
        assert.equal(
          persona.is_existing_agent, false,
          `${key} (${persona.agent_id}) should be is_existing_agent: false`
        );
      }
    }
  });

  // TC-018: no duplicate agent_id values
  it('TC-018: no duplicate agent_id values across personas', () => {
    if (!config) config = JSON.parse(readFileSync(PERSONAS_PATH, 'utf-8'));
    const ids = Object.values(config.personas).map(p => p.agent_id);
    const unique = new Set(ids);
    assert.equal(ids.length, unique.size, `Duplicate agent_ids found: ${ids}`);
  });
});
