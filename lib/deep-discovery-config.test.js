/**
 * deep-discovery-config.test.js -- Schema validation for deep-discovery-config.json
 *
 * REQ-0007-deep-discovery: Validates config structure for existing project
 * deep discovery debate rounds, depth levels, and agent mappings.
 *
 * Test cases TC-A01 through TC-A22.
 *
 * @module deep-discovery-config.test
 */

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

  // TC-A01: file exists and is valid JSON
  it('TC-A01: file exists and is valid JSON', () => {
    assert.ok(existsSync(CONFIG_PATH), `File not found: ${CONFIG_PATH}`);
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    config = JSON.parse(raw);
    assert.ok(config, 'Parsed config should be truthy');
  });

  // TC-A02: version field matches semver pattern
  it('TC-A02: version field matches semver pattern', () => {
    if (!config) config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    assert.ok(config.version, 'Missing version field');
    assert.match(config.version, /^\d+\.\d+\.\d+$/);
  });

  // TC-A03: depth_levels has exactly standard and full keys
  it('TC-A03: depth_levels has exactly standard and full keys', () => {
    if (!config) config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    const keys = Object.keys(config.depth_levels).sort();
    assert.deepEqual(keys, ['full', 'standard']);
  });

  // TC-A04: depth_levels.standard.agents is non-empty array of strings
  it('TC-A04: depth_levels.standard.agents is non-empty array of strings', () => {
    if (!config) config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    const agents = config.depth_levels.standard.agents;
    assert.ok(Array.isArray(agents), 'standard.agents should be an array');
    assert.ok(agents.length > 0, 'standard.agents should be non-empty');
    for (const a of agents) {
      assert.equal(typeof a, 'string', `Agent ${a} should be a string`);
    }
  });

  // TC-A05: depth_levels.full.agents is non-empty array of strings
  it('TC-A05: depth_levels.full.agents is non-empty array of strings', () => {
    if (!config) config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    const agents = config.depth_levels.full.agents;
    assert.ok(Array.isArray(agents), 'full.agents should be an array');
    assert.ok(agents.length > 0, 'full.agents should be non-empty');
    for (const a of agents) {
      assert.equal(typeof a, 'string', `Agent ${a} should be a string`);
    }
  });

  // TC-A06: standard.agents is a subset of full.agents
  it('TC-A06: standard.agents is a subset of full.agents', () => {
    if (!config) config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    const stdAgents = config.depth_levels.standard.agents;
    const fullAgents = config.depth_levels.full.agents;
    for (const agent of stdAgents) {
      assert.ok(fullAgents.includes(agent),
        `Standard agent ${agent} not in full agents list`);
    }
  });

  // TC-A07: standard.debate_rounds equals 3
  it('TC-A07: standard.debate_rounds equals 3', () => {
    if (!config) config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    assert.equal(config.depth_levels.standard.debate_rounds, 3);
  });

  // TC-A08: full.debate_rounds equals 5
  it('TC-A08: full.debate_rounds equals 5', () => {
    if (!config) config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    assert.equal(config.depth_levels.full.debate_rounds, 5);
  });

  // TC-A09: standard.agents contains D1, D2, D5, D6, D16, D17
  it('TC-A09: standard.agents contains D1, D2, D5, D6, D16, D17', () => {
    if (!config) config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    const agents = config.depth_levels.standard.agents;
    for (const id of ['D1', 'D2', 'D5', 'D6', 'D16', 'D17']) {
      assert.ok(agents.includes(id), `Standard agents missing ${id}`);
    }
  });

  // TC-A10: full.agents contains D1, D2, D5, D6, D16, D17, D18, D19
  it('TC-A10: full.agents contains D1, D2, D5, D6, D16, D17, D18, D19', () => {
    if (!config) config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    const agents = config.depth_levels.full.agents;
    for (const id of ['D1', 'D2', 'D5', 'D6', 'D16', 'D17', 'D18', 'D19']) {
      assert.ok(agents.includes(id), `Full agents missing ${id}`);
    }
  });

  // TC-A11: agents object has exactly 4 entries (D16, D17, D18, D19)
  it('TC-A11: agents object has exactly 4 entries (D16, D17, D18, D19)', () => {
    if (!config) config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    const keys = Object.keys(config.agents).sort();
    assert.deepEqual(keys, ['D16', 'D17', 'D18', 'D19']);
  });

  // TC-A12: each agent has required fields
  it('TC-A12: each agent has required fields: title, agent_type, depth_level, output_artifact, scan_domains', () => {
    if (!config) config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    const required = ['title', 'agent_type', 'depth_level', 'output_artifact', 'scan_domains'];
    for (const [id, agent] of Object.entries(config.agents)) {
      for (const field of required) {
        assert.ok(field in agent, `Agent ${id} missing required field "${field}"`);
      }
    }
  });

  // TC-A13: agent.output_artifact ends in .md
  it('TC-A13: agent.output_artifact ends in .md', () => {
    if (!config) config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    for (const [id, agent] of Object.entries(config.agents)) {
      assert.ok(agent.output_artifact.endsWith('.md'),
        `Agent ${id} output_artifact "${agent.output_artifact}" does not end in .md`);
    }
  });

  // TC-A14: agent.scan_domains is non-empty string array
  it('TC-A14: agent.scan_domains is non-empty string array', () => {
    if (!config) config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    for (const [id, agent] of Object.entries(config.agents)) {
      assert.ok(Array.isArray(agent.scan_domains), `Agent ${id} scan_domains should be an array`);
      assert.ok(agent.scan_domains.length > 0, `Agent ${id} scan_domains should be non-empty`);
      for (const d of agent.scan_domains) {
        assert.equal(typeof d, 'string', `Agent ${id} scan_domain ${d} should be a string`);
      }
    }
  });

  // TC-A15: D16.depth_level is "standard", D17.depth_level is "standard"
  it('TC-A15: D16 and D17 depth_level is "standard"', () => {
    if (!config) config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    assert.equal(config.agents.D16.depth_level, 'standard', 'D16 should be standard');
    assert.equal(config.agents.D17.depth_level, 'standard', 'D17 should be standard');
  });

  // TC-A16: D18.depth_level is "full", D19.depth_level is "full"
  it('TC-A16: D18 and D19 depth_level is "full"', () => {
    if (!config) config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    assert.equal(config.agents.D18.depth_level, 'full', 'D18 should be full');
    assert.equal(config.agents.D19.depth_level, 'full', 'D19 should be full');
  });

  // TC-A17: debate_rounds is array sorted by round ascending
  it('TC-A17: debate_rounds is array sorted by round ascending', () => {
    if (!config) config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    assert.ok(Array.isArray(config.debate_rounds), 'debate_rounds should be an array');
    for (let i = 1; i < config.debate_rounds.length; i++) {
      assert.ok(
        config.debate_rounds[i].round > config.debate_rounds[i - 1].round,
        `debate_rounds not sorted: round ${config.debate_rounds[i].round} should be > ${config.debate_rounds[i - 1].round}`
      );
    }
  });

  // TC-A18: debate_rounds has exactly 5 entries
  it('TC-A18: debate_rounds has exactly 5 entries', () => {
    if (!config) config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    assert.equal(config.debate_rounds.length, 5, `Expected 5 debate rounds, got ${config.debate_rounds.length}`);
  });

  // TC-A19: rounds 1-3 have non-null participants_standard
  it('TC-A19: rounds 1-3 have non-null participants_standard', () => {
    if (!config) config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    for (const round of config.debate_rounds) {
      if (round.round <= 3) {
        assert.ok(round.participants_standard !== null,
          `Round ${round.round} participants_standard should be non-null`);
      }
    }
  });

  // TC-A20: rounds 4-5 have null participants_standard
  it('TC-A20: rounds 4-5 have null participants_standard', () => {
    if (!config) config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    for (const round of config.debate_rounds) {
      if (round.round > 3) {
        assert.equal(round.participants_standard, null,
          `Round ${round.round} participants_standard should be null`);
      }
    }
  });

  // TC-A21: rounds 4-5 have participants_full == "all"
  it('TC-A21: rounds 4-5 have participants_full == "all"', () => {
    if (!config) config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    for (const round of config.debate_rounds) {
      if (round.round > 3) {
        assert.equal(round.participants_full, 'all',
          `Round ${round.round} participants_full should be "all"`);
      }
    }
  });

  // TC-A22: all agent IDs in debate_rounds participants reference valid agents
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
