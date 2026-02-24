'use strict';

/**
 * Fan-Out Configuration Tests (test-fan-out-config.test.cjs)
 * ===========================================================
 * Validates state.json fan_out configuration and --no-fan-out flag behavior.
 *
 * Traces: FR-007, NFR-003
 * Test count: 10 (TC-C01 through TC-C10)
 */

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestEnv, cleanupTestEnv, readState } = require('./hook-test-utils.cjs');

// ---------------------------------------------------------------------------
// TC-C01 through TC-C10
// ---------------------------------------------------------------------------
describe('Fan-Out Configuration', () => {

  afterEach(() => {
    cleanupTestEnv();
  });

  // ---------------------------------------------------------------------------
  // TC-C01: Default config when fan_out section absent
  // Requirement: FR-007 (AC-007-01) | Priority: P0
  // ---------------------------------------------------------------------------
  it('TC-C01: missing fan_out section is valid -- defaults apply', () => {
    setupTestEnv({
      active_workflow: {
        type: 'feature',
        current_phase: '16-quality-loop',
        flags: {}
      }
    });
    const state = readState();
    assert.equal(state.fan_out, undefined, 'fan_out should be absent when not configured');
    // Absence means defaults apply (per VR-CFG-001 through VR-CFG-010)
    assert.ok(!state.fan_out, 'Missing fan_out should be treated as defaults');
  });

  // ---------------------------------------------------------------------------
  // TC-C02: Complete fan_out config is valid JSON
  // Requirement: FR-007 (AC-007-01) | Priority: P0
  // ---------------------------------------------------------------------------
  it('TC-C02: complete fan_out config has correct types', () => {
    setupTestEnv({
      fan_out: {
        enabled: true,
        defaults: {
          max_agents: 4,
          timeout_per_chunk_ms: 300000
        },
        phase_overrides: {
          '16-quality-loop': {
            enabled: true,
            strategy: 'round-robin',
            tests_per_agent: 250,
            min_tests_threshold: 250,
            max_agents: 6
          },
          '08-code-review': {
            enabled: true,
            strategy: 'group-by-directory',
            files_per_agent: 7,
            min_files_threshold: 5,
            max_agents: 4
          }
        }
      }
    });
    const state = readState();
    assert.equal(typeof state.fan_out.enabled, 'boolean');
    assert.equal(typeof state.fan_out.defaults.max_agents, 'number');
    assert.equal(typeof state.fan_out.defaults.timeout_per_chunk_ms, 'number');
    assert.equal(typeof state.fan_out.phase_overrides, 'object');
    assert.equal(state.fan_out.phase_overrides['16-quality-loop'].strategy, 'round-robin');
    assert.equal(state.fan_out.phase_overrides['08-code-review'].strategy, 'group-by-directory');
  });

  // ---------------------------------------------------------------------------
  // TC-C03: no_fan_out flag set in active_workflow.flags
  // Requirement: FR-007 (AC-007-03) | Priority: P0
  // ---------------------------------------------------------------------------
  it('TC-C03: no_fan_out flag persists as boolean true', () => {
    setupTestEnv({
      active_workflow: {
        type: 'feature',
        current_phase: '16-quality-loop',
        flags: { no_fan_out: true }
      }
    });
    const state = readState();
    assert.equal(state.active_workflow.flags.no_fan_out, true);
  });

  // ---------------------------------------------------------------------------
  // TC-C04: no_fan_out flag absent means fan-out enabled
  // Requirement: FR-007 (AC-007-03), NFR-003 | Priority: P0
  // ---------------------------------------------------------------------------
  it('TC-C04: absent no_fan_out flag means fan-out not disabled', () => {
    setupTestEnv({
      active_workflow: {
        type: 'feature',
        current_phase: '16-quality-loop',
        flags: {}
      }
    });
    const state = readState();
    assert.equal(state.active_workflow.flags.no_fan_out, undefined);
  });

  // ---------------------------------------------------------------------------
  // TC-C05: max_agents value 1 (minimum boundary)
  // Requirement: FR-007 (AC-007-01) | Priority: P1
  // ---------------------------------------------------------------------------
  it('TC-C05: max_agents = 1 is valid (minimum boundary)', () => {
    setupTestEnv({
      fan_out: {
        enabled: true,
        defaults: { max_agents: 1, timeout_per_chunk_ms: 600000 }
      }
    });
    const state = readState();
    assert.equal(state.fan_out.defaults.max_agents, 1);
  });

  // ---------------------------------------------------------------------------
  // TC-C06: max_agents value 8 (maximum boundary)
  // Requirement: FR-007 (AC-007-01) | Priority: P1
  // ---------------------------------------------------------------------------
  it('TC-C06: max_agents = 8 is valid (maximum boundary)', () => {
    setupTestEnv({
      fan_out: {
        enabled: true,
        defaults: { max_agents: 8, timeout_per_chunk_ms: 600000 }
      }
    });
    const state = readState();
    assert.equal(state.fan_out.defaults.max_agents, 8);
  });

  // ---------------------------------------------------------------------------
  // TC-C07: Phase 16 override config structure
  // Requirement: FR-007 (AC-007-01, AC-007-02) | Priority: P1
  // ---------------------------------------------------------------------------
  it('TC-C07: Phase 16 override has all expected fields', () => {
    setupTestEnv({
      fan_out: {
        enabled: true,
        defaults: { max_agents: 8, timeout_per_chunk_ms: 600000 },
        phase_overrides: {
          '16-quality-loop': {
            enabled: true,
            strategy: 'round-robin',
            tests_per_agent: 500,
            min_tests_threshold: 300,
            max_agents: 6
          }
        }
      }
    });
    const state = readState();
    const p16 = state.fan_out.phase_overrides['16-quality-loop'];
    assert.equal(typeof p16.enabled, 'boolean');
    assert.equal(p16.strategy, 'round-robin');
    assert.equal(typeof p16.tests_per_agent, 'number');
    assert.equal(typeof p16.min_tests_threshold, 'number');
    assert.equal(typeof p16.max_agents, 'number');
  });

  // ---------------------------------------------------------------------------
  // TC-C08: Phase 08 override config structure
  // Requirement: FR-007 (AC-007-01, AC-007-02) | Priority: P1
  // ---------------------------------------------------------------------------
  it('TC-C08: Phase 08 override has all expected fields', () => {
    setupTestEnv({
      fan_out: {
        enabled: true,
        defaults: { max_agents: 8, timeout_per_chunk_ms: 600000 },
        phase_overrides: {
          '08-code-review': {
            enabled: true,
            strategy: 'group-by-directory',
            files_per_agent: 10,
            min_files_threshold: 8,
            max_agents: 4
          }
        }
      }
    });
    const state = readState();
    const p08 = state.fan_out.phase_overrides['08-code-review'];
    assert.equal(typeof p08.enabled, 'boolean');
    assert.equal(p08.strategy, 'group-by-directory');
    assert.equal(typeof p08.files_per_agent, 'number');
    assert.equal(typeof p08.min_files_threshold, 'number');
    assert.equal(typeof p08.max_agents, 'number');
  });

  // ---------------------------------------------------------------------------
  // TC-C09: fan_out.enabled = false disables fan-out globally
  // Requirement: FR-007 (AC-007-01) | Priority: P0
  // ---------------------------------------------------------------------------
  it('TC-C09: fan_out.enabled = false persists correctly', () => {
    setupTestEnv({
      fan_out: {
        enabled: false,
        defaults: { max_agents: 8, timeout_per_chunk_ms: 600000 }
      }
    });
    const state = readState();
    assert.equal(state.fan_out.enabled, false);
  });

  // ---------------------------------------------------------------------------
  // TC-C10: Per-phase override can disable fan-out for one phase only
  // Requirement: FR-007 (AC-007-02) | Priority: P1
  // ---------------------------------------------------------------------------
  it('TC-C10: per-phase disable is independent of global enable', () => {
    setupTestEnv({
      fan_out: {
        enabled: true,
        defaults: { max_agents: 8, timeout_per_chunk_ms: 600000 },
        phase_overrides: {
          '08-code-review': { enabled: false }
        }
      }
    });
    const state = readState();
    assert.equal(state.fan_out.enabled, true, 'Global enable should be true');
    assert.equal(state.fan_out.phase_overrides['08-code-review'].enabled, false, 'Per-phase disable should be false');
  });

});
