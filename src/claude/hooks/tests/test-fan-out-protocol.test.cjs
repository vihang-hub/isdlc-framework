'use strict';

/**
 * Fan-Out Protocol Tests (test-fan-out-protocol.test.cjs)
 * ========================================================
 * Validates that agent markdown files contain all required fan-out protocol
 * sections, thresholds, and contract references.
 *
 * Traces: FR-001 through FR-006, NFR-001 through NFR-004
 * Test count: 18 (TC-P01 through TC-P18)
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

const SKILL_MD_PATH = path.join(SKILLS_DIR, 'quality-loop', 'fan-out-engine', 'SKILL.md');
const PHASE16_AGENT_PATH = path.join(AGENTS_DIR, '16-quality-loop-engineer.md');
const PHASE08_AGENT_PATH = path.join(AGENTS_DIR, '07-qa-engineer.md');

// ---------------------------------------------------------------------------
// Load files once
// ---------------------------------------------------------------------------
let skillMd, phase16Agent, phase08Agent;

before(() => {
  // These will fail if files don't exist (which is expected during TDD Red)
  if (fs.existsSync(SKILL_MD_PATH)) {
    skillMd = fs.readFileSync(SKILL_MD_PATH, 'utf8');
  }
  if (fs.existsSync(PHASE16_AGENT_PATH)) {
    phase16Agent = fs.readFileSync(PHASE16_AGENT_PATH, 'utf8');
  }
  if (fs.existsSync(PHASE08_AGENT_PATH)) {
    phase08Agent = fs.readFileSync(PHASE08_AGENT_PATH, 'utf8');
  }
});

// ---------------------------------------------------------------------------
// SKILL.md tests (TC-P01 through TC-P05, TC-P14, TC-P15, TC-P17)
// ---------------------------------------------------------------------------
describe('Fan-Out Protocol: SKILL.md content', () => {

  // TC-P01: SKILL.md file exists at expected path
  // Requirement: FR-001 (AC-001-04) | Priority: P0
  it('TC-P01: SKILL.md file exists at src/claude/skills/quality-loop/fan-out-engine/SKILL.md', () => {
    assert.ok(fs.existsSync(SKILL_MD_PATH), 'SKILL.md should exist at expected path');
  });

  // TC-P02: SKILL.md contains chunk splitter section
  // Requirement: FR-002 | Priority: P0
  it('TC-P02: SKILL.md contains Chunk Splitter section with strategy names', () => {
    assert.ok(skillMd, 'SKILL.md must be loaded');
    const lower = skillMd.toLowerCase();
    assert.ok(lower.includes('chunk splitter'), 'Should contain "Chunk Splitter" section');
    assert.ok(skillMd.includes('round-robin'), 'Should reference round-robin strategy');
    assert.ok(skillMd.includes('group-by-directory'), 'Should reference group-by-directory strategy');
  });

  // TC-P03: SKILL.md contains parallel spawner section
  // Requirement: FR-003 | Priority: P0
  it('TC-P03: SKILL.md contains Parallel Spawner section referencing Task tool', () => {
    assert.ok(skillMd, 'SKILL.md must be loaded');
    const lower = skillMd.toLowerCase();
    assert.ok(
      lower.includes('parallel spawner') || lower.includes('spawner'),
      'Should contain Parallel Spawner section'
    );
    assert.ok(skillMd.includes('Task'), 'Should reference Task tool calls');
  });

  // TC-P04: SKILL.md contains result merger section
  // Requirement: FR-004 | Priority: P0
  it('TC-P04: SKILL.md contains Result Merger section with deduplication', () => {
    assert.ok(skillMd, 'SKILL.md must be loaded');
    const lower = skillMd.toLowerCase();
    assert.ok(
      lower.includes('result merger') || lower.includes('merger'),
      'Should contain Result Merger section'
    );
    assert.ok(
      lower.includes('dedup') || lower.includes('deduplicate'),
      'Should reference deduplication'
    );
  });

  // TC-P05: SKILL.md references QL-012 skill ID
  // Requirement: FR-001 (AC-001-04) | Priority: P0
  it('TC-P05: SKILL.md references QL-012', () => {
    assert.ok(skillMd, 'SKILL.md must be loaded');
    assert.ok(skillMd.includes('QL-012'), 'Should reference QL-012 skill ID');
  });

  // TC-P14: SKILL.md documents partial failure handling
  // Requirement: NFR-002 | Priority: P0
  it('TC-P14: SKILL.md documents partial failure handling', () => {
    assert.ok(skillMd, 'SKILL.md must be loaded');
    const lower = skillMd.toLowerCase();
    assert.ok(
      lower.includes('partial failure') ||
      lower.includes('degraded') ||
      lower.includes('n-1 results') ||
      lower.includes('n-k'),
      'Should document partial failure recovery'
    );
  });

  // TC-P15: SKILL.md documents below-threshold skip behavior
  // Requirement: NFR-003 | Priority: P0
  it('TC-P15: SKILL.md documents below-threshold skip to single-agent', () => {
    assert.ok(skillMd, 'SKILL.md must be loaded');
    const lower = skillMd.toLowerCase();
    const hasThreshold = lower.includes('below') || lower.includes('threshold');
    const hasSingleAgent = lower.includes('single-agent') || lower.includes('single agent') || lower.includes('skip');
    assert.ok(hasThreshold && hasSingleAgent, 'Should document below-threshold fallback to single-agent');
  });

  // TC-P17: SKILL.md documents observability / skill usage logging
  // Requirement: NFR-004 | Priority: P1
  it('TC-P17: SKILL.md documents observability requirements', () => {
    assert.ok(skillMd, 'SKILL.md must be loaded');
    const lower = skillMd.toLowerCase();
    assert.ok(
      lower.includes('skill_usage_log') ||
      lower.includes('observability') ||
      lower.includes('fan_out_metadata'),
      'Should document observability requirements'
    );
  });

});

// ---------------------------------------------------------------------------
// Phase 16 agent tests (TC-P06 through TC-P09, TC-P16, TC-P18)
// ---------------------------------------------------------------------------
describe('Fan-Out Protocol: Phase 16 agent content', () => {

  // TC-P06: Phase 16 agent contains fan-out decision tree
  // Requirement: FR-005 (AC-005-01, AC-005-07) | Priority: P0
  it('TC-P06: Phase 16 agent contains fan-out decision tree with 250 threshold', () => {
    assert.ok(phase16Agent, '16-quality-loop-engineer.md must be loaded');
    const lower = phase16Agent.toLowerCase();
    assert.ok(
      lower.includes('fan-out') || lower.includes('fan out'),
      'Should contain fan-out section header'
    );
    assert.ok(phase16Agent.includes('250'), 'Should contain 250-test threshold');
  });

  // TC-P07: Phase 16 agent references Track A only
  // Requirement: FR-005 (AC-005-06) | Priority: P0
  it('TC-P07: Fan-out applies to Track A only; Track B is excluded', () => {
    assert.ok(phase16Agent, '16-quality-loop-engineer.md must be loaded');
    // Find the fan-out section and verify Track A focus
    const fanOutIdx = phase16Agent.toLowerCase().indexOf('fan-out protocol');
    assert.ok(fanOutIdx >= 0, 'Should have a Fan-Out Protocol section');
    const fanOutSection = phase16Agent.slice(fanOutIdx, fanOutIdx + 3000);
    assert.ok(fanOutSection.includes('Track A'), 'Fan-out section should reference Track A');
    // Track B should be excluded/unchanged
    const lower = fanOutSection.toLowerCase();
    assert.ok(
      lower.includes('track b') &&
      (lower.includes('unchanged') || lower.includes('not affected') || lower.includes('no fan-out') || lower.includes('no changes')),
      'Track B should be documented as excluded/unchanged in fan-out context'
    );
  });

  // TC-P08: Phase 16 agent specifies coverage aggregation as union
  // Requirement: FR-005 (AC-005-05) | Priority: P1
  it('TC-P08: Coverage aggregation uses union (not average)', () => {
    assert.ok(phase16Agent, '16-quality-loop-engineer.md must be loaded');
    const lower = phase16Agent.toLowerCase();
    assert.ok(lower.includes('union'), 'Should specify union for coverage aggregation');
  });

  // TC-P09: Phase 16 agent max agents is 8
  // Requirement: FR-005 (AC-005-01), FR-002 (AC-002-03) | Priority: P1
  it('TC-P09: Maximum 8 agents specified in fan-out section', () => {
    assert.ok(phase16Agent, '16-quality-loop-engineer.md must be loaded');
    // Find fan-out section and look for max 8
    const fanOutIdx = phase16Agent.toLowerCase().indexOf('fan-out');
    assert.ok(fanOutIdx >= 0, 'Should have fan-out section');
    const fanOutSection = phase16Agent.slice(fanOutIdx);
    const lower = fanOutSection.toLowerCase();
    assert.ok(
      (lower.includes('max') || lower.includes('maximum')) && fanOutSection.includes('8'),
      'Should specify max 8 agents in fan-out section'
    );
  });

  // TC-P16: Phase 16 agent chunk spawner includes read-only constraints
  // Requirement: FR-003 (AC-003-05), FR-005 | Priority: P1
  it('TC-P16: Chunk agent read-only sandbox constraints present', () => {
    assert.ok(phase16Agent, '16-quality-loop-engineer.md must be loaded');
    const lower = phase16Agent.toLowerCase();
    assert.ok(
      lower.includes('do not write to') ||
      lower.includes('read-only') ||
      lower.includes('do not write to .isdlc/state.json') ||
      lower.includes('do not run git'),
      'Should contain read-only constraints for chunk agents'
    );
  });

  // TC-P18: NFR-001 orchestration overhead limit documented
  // Requirement: NFR-001 | Priority: P2
  it('TC-P18: Orchestration overhead limit documented', () => {
    assert.ok(phase16Agent || skillMd, 'At least one file must be loaded');
    const combined = (phase16Agent || '') + (skillMd || '');
    const lower = combined.toLowerCase();
    assert.ok(
      lower.includes('5%') || lower.includes('overhead'),
      'Should document orchestration overhead limit'
    );
  });

});

// ---------------------------------------------------------------------------
// Phase 08 agent tests (TC-P10 through TC-P13)
// ---------------------------------------------------------------------------
describe('Fan-Out Protocol: Phase 08 agent content', () => {

  // TC-P10: Phase 08 agent contains fan-out decision tree
  // Requirement: FR-006 (AC-006-01, AC-006-06) | Priority: P0
  it('TC-P10: Phase 08 agent contains fan-out section with 5-file threshold', () => {
    assert.ok(phase08Agent, '07-qa-engineer.md must be loaded');
    const lower = phase08Agent.toLowerCase();
    assert.ok(
      lower.includes('fan-out') || lower.includes('fan out'),
      'Should contain fan-out section'
    );
    // Check for threshold of 5 in the fan-out context
    const fanOutIdx = lower.indexOf('fan-out');
    assert.ok(fanOutIdx >= 0, 'Should have fan-out section');
    const fanOutSection = phase08Agent.slice(fanOutIdx);
    assert.ok(
      fanOutSection.includes('5'),
      'Should contain 5-file threshold'
    );
  });

  // TC-P11: Phase 08 agent specifies group-by-directory strategy
  // Requirement: FR-006 (AC-006-01) | Priority: P0
  it('TC-P11: group-by-directory strategy specified for Phase 08', () => {
    assert.ok(phase08Agent, '07-qa-engineer.md must be loaded');
    assert.ok(
      phase08Agent.includes('group-by-directory'),
      'Should specify group-by-directory strategy'
    );
  });

  // TC-P12: Phase 08 agent specifies cross-cutting concerns section
  // Requirement: FR-006 (AC-006-07) | Priority: P1
  it('TC-P12: Cross-cutting concerns handling documented', () => {
    assert.ok(phase08Agent, '07-qa-engineer.md must be loaded');
    const lower = phase08Agent.toLowerCase();
    assert.ok(
      lower.includes('cross-cutting') || lower.includes('cross cutting'),
      'Should document cross-cutting concerns handling'
    );
  });

  // TC-P13: Phase 08 agent specifies deduplication for findings
  // Requirement: FR-006 (AC-006-05), FR-004 (AC-004-03) | Priority: P1
  it('TC-P13: Finding deduplication documented in Phase 08', () => {
    assert.ok(phase08Agent, '07-qa-engineer.md must be loaded');
    const lower = phase08Agent.toLowerCase();
    assert.ok(
      lower.includes('dedup') || lower.includes('deduplicate') || lower.includes('deduplication'),
      'Should document finding deduplication'
    );
  });

});
