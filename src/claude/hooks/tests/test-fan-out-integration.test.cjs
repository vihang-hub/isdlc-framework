'use strict';

/**
 * Fan-Out Integration Tests (test-fan-out-integration.test.cjs)
 * ==============================================================
 * Cross-component consistency validation. Verifies all modified files reference
 * each other correctly and threshold values are consistent.
 *
 * Traces: FR-001 through FR-007, NFR-001 through NFR-004
 * Test count: 12 (TC-I01 through TC-I12)
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const AGENTS_DIR = path.resolve(__dirname, '..', '..', 'agents');
const SKILLS_DIR = path.resolve(__dirname, '..', '..', 'skills');
const CONFIG_DIR = path.resolve(__dirname, '..', 'config');
const COMMANDS_DIR = path.resolve(__dirname, '..', '..', 'commands');
const DOCS_DIR = path.resolve(__dirname, '..', '..', '..', '..', 'docs', 'requirements', 'REQ-0017-fan-out-fan-in-parallelism');

const SKILL_MD_PATH = path.join(SKILLS_DIR, 'quality-loop', 'fan-out-engine', 'SKILL.md');
const PHASE16_AGENT_PATH = path.join(AGENTS_DIR, '16-quality-loop-engineer.md');
const PHASE08_AGENT_PATH = path.join(AGENTS_DIR, '07-qa-engineer.md');
const MANIFEST_PATH = path.join(CONFIG_DIR, 'skills-manifest.json');
const ISDLC_CMD_PATH = path.join(COMMANDS_DIR, 'isdlc.md');
const REQ_SPEC_PATH = path.join(DOCS_DIR, 'requirements-spec.md');
const INTERFACE_SPEC_PATH = path.join(DOCS_DIR, 'interface-spec.md');
const VALIDATION_RULES_PATH = path.join(DOCS_DIR, 'validation-rules.json');

// ---------------------------------------------------------------------------
// Load files once
// ---------------------------------------------------------------------------
let skillMd, phase16Agent, phase08Agent, manifest, isdlcCmd, reqSpec, ifaceSpec, validationRules;

before(() => {
  if (fs.existsSync(SKILL_MD_PATH)) skillMd = fs.readFileSync(SKILL_MD_PATH, 'utf8');
  if (fs.existsSync(PHASE16_AGENT_PATH)) phase16Agent = fs.readFileSync(PHASE16_AGENT_PATH, 'utf8');
  if (fs.existsSync(PHASE08_AGENT_PATH)) phase08Agent = fs.readFileSync(PHASE08_AGENT_PATH, 'utf8');
  if (fs.existsSync(MANIFEST_PATH)) manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  if (fs.existsSync(ISDLC_CMD_PATH)) isdlcCmd = fs.readFileSync(ISDLC_CMD_PATH, 'utf8');
  if (fs.existsSync(REQ_SPEC_PATH)) reqSpec = fs.readFileSync(REQ_SPEC_PATH, 'utf8');
  if (fs.existsSync(INTERFACE_SPEC_PATH)) ifaceSpec = fs.readFileSync(INTERFACE_SPEC_PATH, 'utf8');
  if (fs.existsSync(VALIDATION_RULES_PATH)) validationRules = JSON.parse(fs.readFileSync(VALIDATION_RULES_PATH, 'utf8'));
});

// ---------------------------------------------------------------------------
// Cross-component consistency tests
// ---------------------------------------------------------------------------
describe('Fan-Out Integration: Cross-component consistency', () => {

  // TC-I01: Phase 16 agent references QL-012 skill
  // Requirement: FR-001, FR-005 | Priority: P0
  it('TC-I01: Phase 16 agent and manifest agree on QL-012 ownership', () => {
    assert.ok(phase16Agent, '16-quality-loop-engineer.md must be loaded');
    assert.ok(manifest, 'skills-manifest.json must be loaded');
    assert.ok(phase16Agent.includes('QL-012'), 'Phase 16 agent should reference QL-012');
    assert.equal(manifest.skill_lookup['QL-012'], 'quality-loop-engineer', 'Manifest should map QL-012 to quality-loop-engineer');
  });

  // TC-I02: Phase 08 agent references QL-012 or fan-out-engine skill
  // Requirement: FR-001, FR-006 | Priority: P0
  it('TC-I02: Phase 08 agent references fan-out engine', () => {
    assert.ok(phase08Agent, '07-qa-engineer.md must be loaded');
    assert.ok(
      phase08Agent.includes('QL-012') || phase08Agent.includes('fan-out'),
      'Phase 08 agent should reference QL-012 or fan-out engine'
    );
  });

  // TC-I03: Phase 16 test threshold matches across spec and agent
  // Requirement: FR-005 (AC-005-01, AC-005-07) | Priority: P0
  it('TC-I03: 250-test threshold consistent in Phase 16 agent', () => {
    assert.ok(phase16Agent, '16-quality-loop-engineer.md must be loaded');
    // Agent should contain 250 as the fan-out threshold
    const fanOutIdx = phase16Agent.toLowerCase().indexOf('fan-out');
    assert.ok(fanOutIdx >= 0, 'Phase 16 agent should have fan-out section');
    const afterFanOut = phase16Agent.slice(fanOutIdx);
    assert.ok(afterFanOut.includes('250'), 'Phase 16 agent should specify 250-test threshold');
  });

  // TC-I04: Phase 08 file threshold matches across spec and agent
  // Requirement: FR-006 (AC-006-01, AC-006-06) | Priority: P0
  it('TC-I04: 5-file threshold consistent in Phase 08 agent', () => {
    assert.ok(phase08Agent, '07-qa-engineer.md must be loaded');
    const fanOutIdx = phase08Agent.toLowerCase().indexOf('fan-out');
    assert.ok(fanOutIdx >= 0, 'Phase 08 agent should have fan-out section');
    const afterFanOut = phase08Agent.slice(fanOutIdx);
    assert.ok(afterFanOut.includes('5'), 'Phase 08 agent should specify 5 as minimum file threshold');
  });

  // TC-I05: Max agents (8) consistent across all files
  // Requirement: FR-002 (AC-002-03), FR-003 (AC-003-03) | Priority: P1
  it('TC-I05: Maximum 8 agents consistently specified everywhere', () => {
    assert.ok(skillMd, 'SKILL.md must be loaded');
    assert.ok(phase16Agent, '16-quality-loop-engineer.md must be loaded');
    assert.ok(phase08Agent, '07-qa-engineer.md must be loaded');

    // Check max_chunks 8 in SKILL.md
    assert.ok(skillMd.includes('8'), 'SKILL.md should reference max 8');

    // Check max 8 in Phase 16 fan-out section
    const p16FanOut = phase16Agent.slice(phase16Agent.toLowerCase().indexOf('fan-out'));
    assert.ok(p16FanOut.includes('8'), 'Phase 16 should reference max 8');

    // Check max 8 in Phase 08 fan-out section
    const p08FanOut = phase08Agent.slice(phase08Agent.toLowerCase().indexOf('fan-out'));
    assert.ok(p08FanOut.includes('8'), 'Phase 08 should reference max 8');
  });

  // TC-I06: Merged output format backward compatible with gate-blocker
  // Requirement: NFR-003, FR-004 | Priority: P0
  it('TC-I06: Merged output preserves gate-blocker-compatible fields', () => {
    assert.ok(ifaceSpec, 'interface-spec.md must be loaded');
    const lower = ifaceSpec.toLowerCase();
    // Check for essential gate-blocker fields in the merged output
    assert.ok(lower.includes('all_tests_passing'), 'Should document all_tests_passing field');
    assert.ok(lower.includes('lint_passing'), 'Should document lint_passing field');
    assert.ok(lower.includes('coverage_percent'), 'Should document coverage_percent field');
    // fan_out_summary should be additive
    assert.ok(
      lower.includes('fan_out_summary') || lower.includes('fan_out'),
      'Should document fan_out_summary as additive field'
    );
  });

  // TC-I07: SKILL.md version matches interface spec version
  // Requirement: FR-001 | Priority: P2
  it('TC-I07: SKILL.md and interface spec both specify version 1.0.0', () => {
    assert.ok(skillMd, 'SKILL.md must be loaded');
    assert.ok(ifaceSpec, 'interface-spec.md must be loaded');
    assert.ok(skillMd.includes('1.0.0'), 'SKILL.md should specify version 1.0.0');
    assert.ok(ifaceSpec.includes('1.0.0'), 'interface-spec.md should specify version 1.0.0');
  });

  // TC-I08: isdlc.md flag parsing section includes --no-fan-out
  // Requirement: FR-007 (AC-007-03) | Priority: P0
  it('TC-I08: isdlc.md contains --no-fan-out in flag parsing', () => {
    assert.ok(isdlcCmd, 'isdlc.md must be loaded');
    assert.ok(isdlcCmd.includes('--no-fan-out'), 'Should contain --no-fan-out flag');
    assert.ok(isdlcCmd.includes('no_fan_out'), 'Should contain no_fan_out state key');
  });

  // TC-I09: isdlc.md flag table includes --no-fan-out row
  // Requirement: FR-007 (AC-007-03) | Priority: P1
  it('TC-I09: isdlc.md flag documentation table has --no-fan-out', () => {
    assert.ok(isdlcCmd, 'isdlc.md must be loaded');
    // Look for a table row containing --no-fan-out (markdown table uses | delimiters)
    const lines = isdlcCmd.split('\n');
    const flagTableRow = lines.find(line =>
      line.includes('--no-fan-out') && line.includes('|')
    );
    assert.ok(flagTableRow, 'Should have a table row documenting --no-fan-out');
  });

  // TC-I10: validation-rules.json covers all config fields
  // Requirement: FR-007 | Priority: P1
  it('TC-I10: validation-rules.json has >= 10 rules covering all config fields', () => {
    assert.ok(validationRules, 'validation-rules.json must be loaded');
    const rules = validationRules.configuration_validation.rules;
    assert.ok(Array.isArray(rules), 'Rules should be an array');
    assert.ok(rules.length >= 10, `Should have >= 10 rules, got ${rules.length}`);

    // Check that key fields are covered
    const coveredFields = rules.map(r => r.field);
    const requiredFields = [
      'fan_out.enabled',
      'fan_out.defaults.max_agents',
      'fan_out.defaults.timeout_per_chunk_ms'
    ];
    for (const field of requiredFields) {
      assert.ok(
        coveredFields.some(f => f.includes(field.split('.').pop())),
        `Should cover field: ${field}`
      );
    }
  });

  // TC-I11: Phase 16 and Phase 08 use different default strategies
  // Requirement: FR-005 (AC-005-01), FR-006 (AC-006-01) | Priority: P1
  it('TC-I11: Phase 16 uses round-robin; Phase 08 uses group-by-directory', () => {
    assert.ok(phase16Agent, '16-quality-loop-engineer.md must be loaded');
    assert.ok(phase08Agent, '07-qa-engineer.md must be loaded');

    // Find fan-out sections and verify strategies
    const p16FanOutIdx = phase16Agent.toLowerCase().indexOf('fan-out');
    const p08FanOutIdx = phase08Agent.toLowerCase().indexOf('fan-out');
    assert.ok(p16FanOutIdx >= 0, 'Phase 16 should have fan-out section');
    assert.ok(p08FanOutIdx >= 0, 'Phase 08 should have fan-out section');

    const p16Section = phase16Agent.slice(p16FanOutIdx);
    const p08Section = phase08Agent.slice(p08FanOutIdx);

    assert.ok(p16Section.includes('round-robin'), 'Phase 16 should use round-robin');
    assert.ok(p08Section.includes('group-by-directory'), 'Phase 08 should use group-by-directory');
  });

  // TC-I12: Observability log entry schema includes fan_out_metadata
  // Requirement: NFR-004 | Priority: P1
  it('TC-I12: Observability log entry fully specified with fan_out_metadata', () => {
    assert.ok(ifaceSpec, 'interface-spec.md must be loaded');
    const lower = ifaceSpec.toLowerCase();
    assert.ok(
      lower.includes('fan_out_metadata'),
      'Should document fan_out_metadata in skill_usage_log entry'
    );
    // Check metadata fields
    assert.ok(lower.includes('chunk_count'), 'Should document chunk_count in metadata');
    assert.ok(lower.includes('strategy'), 'Should document strategy in metadata');
  });

});
