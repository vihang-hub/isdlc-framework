# Test Cases — party-personas.json Schema Validation

**File**: `lib/party-personas.test.js`
**Framework**: node:test + node:assert/strict
**Target**: `src/claude/agents/discover/party-personas.json`

---

## Test Implementation

```javascript
/**
 * party-personas.test.js — Schema validation for party-personas.json
 *
 * REQ-0006-inception-party-discover: Validates persona config structure,
 * phase definitions, agent type references, and constraint compliance.
 *
 * 18 test cases covering: JSON validity, persona fields, phase structure,
 * cross-references, and constraint enforcement.
 *
 * @module party-personas.test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const PERSONAS_PATH = join(
  __dirname, '..', 'src', 'claude', 'agents', 'discover', 'party-personas.json'
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadPersonas() {
  const raw = readFileSync(PERSONAS_PATH, 'utf-8');
  return JSON.parse(raw);
}

const REQUIRED_PERSONA_FIELDS = [
  'name', 'title', 'agent_type', 'agent_id', 'phase',
  'is_existing_agent', 'communication_style', 'expertise',
  'question_domains', 'debate_focus'
];

const REQUIRED_PHASE_FIELDS = [
  'name', 'type', 'personas', 'max_messages', 'interaction', 'output'
];

const EXPECTED_AGENT_TYPES = [
  'product-analyst', 'domain-researcher', 'technical-scout',
  'solution-architect-party', 'security-advisor', 'devops-pragmatist',
  'architecture-designer', 'data-model-designer', 'test-strategist'
];

// ---------------------------------------------------------------------------
// TC-001: JSON validity
// ---------------------------------------------------------------------------
describe('party-personas.json schema validation', () => {

  it('TC-001: file exists and is valid JSON', () => {
    assert.ok(existsSync(PERSONAS_PATH), `File not found: ${PERSONAS_PATH}`);
    assert.doesNotThrow(() => loadPersonas());
  });

  // TC-002: version field
  it('TC-002: has version field matching semver', () => {
    const config = loadPersonas();
    assert.ok(config.version, 'Missing version field');
    assert.match(config.version, /^\d+\.\d+\.\d+$/);
  });

  // TC-003: personas count
  it('TC-003: has personas object with exactly 9 entries', () => {
    const config = loadPersonas();
    assert.ok(config.personas, 'Missing personas object');
    assert.equal(Object.keys(config.personas).length, 9);
  });

  // TC-004: persona required fields
  it('TC-004: each persona has all required fields', () => {
    const config = loadPersonas();
    for (const [key, persona] of Object.entries(config.personas)) {
      for (const field of REQUIRED_PERSONA_FIELDS) {
        assert.ok(
          field in persona,
          `Persona "${key}" missing required field "${field}"`
        );
      }
    }
  });

  // TC-005: phase values
  it('TC-005: persona.phase is 1, 2, or 3 for all personas', () => {
    const config = loadPersonas();
    for (const [key, persona] of Object.entries(config.personas)) {
      assert.ok(
        [1, 2, 3].includes(persona.phase),
        `Persona "${key}" has invalid phase: ${persona.phase}`
      );
    }
  });

  // TC-006: agent_id pattern
  it('TC-006: persona.agent_id matches D{N} pattern', () => {
    const config = loadPersonas();
    for (const [key, persona] of Object.entries(config.personas)) {
      assert.match(
        persona.agent_id, /^D\d+$/,
        `Persona "${key}" has invalid agent_id: ${persona.agent_id}`
      );
    }
  });

  // TC-007: question_domains is array
  it('TC-007: persona.question_domains is array for all personas', () => {
    const config = loadPersonas();
    for (const [key, persona] of Object.entries(config.personas)) {
      assert.ok(
        Array.isArray(persona.question_domains),
        `Persona "${key}" question_domains is not an array`
      );
    }
  });

  // TC-008: Phase 1 personas have non-empty question_domains
  it('TC-008: Phase 1 personas have non-empty question_domains', () => {
    const config = loadPersonas();
    const phase1Personas = Object.entries(config.personas)
      .filter(([, p]) => p.phase === 1);
    assert.ok(phase1Personas.length > 0, 'No Phase 1 personas found');
    for (const [key, persona] of phase1Personas) {
      assert.ok(
        persona.question_domains.length > 0,
        `Phase 1 persona "${key}" has empty question_domains`
      );
    }
  });

  // TC-009: phases count
  it('TC-009: has phases object with exactly 5 entries', () => {
    const config = loadPersonas();
    assert.ok(config.phases, 'Missing phases object');
    assert.equal(Object.keys(config.phases).length, 5);
  });

  // TC-010: phase required fields
  it('TC-010: each phase has all required fields', () => {
    const config = loadPersonas();
    for (const [key, phase] of Object.entries(config.phases)) {
      for (const field of REQUIRED_PHASE_FIELDS) {
        assert.ok(
          field in phase,
          `Phase "${key}" missing required field "${field}"`
        );
      }
    }
  });

  // TC-011: parallel vs sequential types
  it('TC-011: phases 1-3 are parallel, 4-5 are sequential', () => {
    const config = loadPersonas();
    assert.equal(config.phases['1'].type, 'parallel');
    assert.equal(config.phases['2'].type, 'parallel');
    assert.equal(config.phases['3'].type, 'parallel');
    assert.equal(config.phases['4'].type, 'sequential');
    assert.equal(config.phases['5'].type, 'sequential');
  });

  // TC-012: parallel phases have exactly 3 personas
  it('TC-012: each parallel phase has exactly 3 personas', () => {
    const config = loadPersonas();
    for (const key of ['1', '2', '3']) {
      assert.equal(
        config.phases[key].personas.length, 3,
        `Phase ${key} should have 3 personas, has ${config.phases[key].personas.length}`
      );
    }
  });

  // TC-013: sequential phases have empty personas
  it('TC-013: sequential phases have empty personas arrays', () => {
    const config = loadPersonas();
    assert.equal(config.phases['4'].personas.length, 0);
    assert.equal(config.phases['5'].personas.length, 0);
  });

  // TC-014: max_messages enforcement
  it('TC-014: max_messages is 10 for parallel phases, 0 for sequential', () => {
    const config = loadPersonas();
    for (const key of ['1', '2', '3']) {
      assert.equal(config.phases[key].max_messages, 10,
        `Phase ${key} max_messages should be 10`);
    }
    assert.equal(config.phases['4'].max_messages, 0);
    assert.equal(config.phases['5'].max_messages, 0);
  });

  // TC-015: persona keys cross-reference
  it('TC-015: all persona keys in phases exist in personas object', () => {
    const config = loadPersonas();
    const personaKeys = Object.keys(config.personas);
    for (const [phaseKey, phase] of Object.entries(config.phases)) {
      for (const personaKey of phase.personas) {
        assert.ok(
          personaKeys.includes(personaKey),
          `Phase ${phaseKey} references unknown persona "${personaKey}"`
        );
      }
    }
  });

  // TC-016: agent_type values match expected
  it('TC-016: all agent_type values are from expected set', () => {
    const config = loadPersonas();
    for (const [key, persona] of Object.entries(config.personas)) {
      assert.ok(
        EXPECTED_AGENT_TYPES.includes(persona.agent_type),
        `Persona "${key}" has unexpected agent_type: ${persona.agent_type}`
      );
    }
  });

  // TC-017: is_existing_agent correct
  it('TC-017: is_existing_agent true for D7 and D8 only', () => {
    const config = loadPersonas();
    for (const [key, persona] of Object.entries(config.personas)) {
      if (['D7', 'D8'].includes(persona.agent_id)) {
        assert.equal(persona.is_existing_agent, true,
          `${key} (${persona.agent_id}) should be existing agent`);
      } else {
        assert.equal(persona.is_existing_agent, false,
          `${key} (${persona.agent_id}) should not be existing agent`);
      }
    }
  });

  // TC-018: no duplicate agent_ids
  it('TC-018: no duplicate agent_id values across personas', () => {
    const config = loadPersonas();
    const ids = Object.values(config.personas).map(p => p.agent_id);
    const unique = new Set(ids);
    assert.equal(ids.length, unique.size,
      `Duplicate agent_ids found: ${ids.filter((id, i) => ids.indexOf(id) !== i)}`);
  });
});
```

---

## Expected Results

All 18 tests pass when `party-personas.json` is correctly formed.
Run with: `node --test lib/party-personas.test.js`
