/**
 * PHASE_AGENT_MAP Export Guard Tests
 * ====================================
 * REQ-0141: Execution Contract System (ADR-006)
 * AC-002-05
 *
 * Guards the PHASE_AGENT_MAP export from common.cjs.
 * Prevents accidental removal or renaming.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

process.env.ISDLC_TEST_MODE = '1';
const { PHASE_AGENT_MAP } = require('../lib/common.cjs');

// ---------------------------------------------------------------------------
// PM-01 to PM-05: PHASE_AGENT_MAP guard tests
// ---------------------------------------------------------------------------

describe('PHASE_AGENT_MAP export guard', () => {
  it('PM-01: PHASE_AGENT_MAP is exported from common.cjs', () => {
    assert.ok(PHASE_AGENT_MAP !== undefined, 'PHASE_AGENT_MAP should be exported');
    assert.ok(PHASE_AGENT_MAP !== null, 'PHASE_AGENT_MAP should not be null');
  });

  it('PM-02: PHASE_AGENT_MAP is a non-empty object', () => {
    assert.equal(typeof PHASE_AGENT_MAP, 'object');
    assert.ok(!Array.isArray(PHASE_AGENT_MAP));
    assert.ok(Object.keys(PHASE_AGENT_MAP).length > 0, 'PHASE_AGENT_MAP should not be empty');
  });

  it('PM-03: PHASE_AGENT_MAP contains all expected phase keys', () => {
    const expectedKeys = [
      '01-requirements',
      '03-architecture',
      '04-design',
      '05-test-strategy',
      '06-implementation',
      '07-testing',
      '08-code-review',
      '09-validation',
      '10-cicd',
      '11-local-testing',
      '16-quality-loop'
    ];
    for (const key of expectedKeys) {
      assert.ok(key in PHASE_AGENT_MAP, `PHASE_AGENT_MAP should contain key "${key}"`);
    }
  });

  it('PM-04: Each PHASE_AGENT_MAP value is a non-empty string (agent name)', () => {
    for (const [key, value] of Object.entries(PHASE_AGENT_MAP)) {
      assert.equal(typeof value, 'string', `PHASE_AGENT_MAP["${key}"] should be a string`);
      assert.ok(value.length > 0, `PHASE_AGENT_MAP["${key}"] should be non-empty`);
    }
  });

  it('PM-05: PHASE_AGENT_MAP contains at least 14 entries (guarding regression)', () => {
    const count = Object.keys(PHASE_AGENT_MAP).length;
    assert.ok(count >= 14, `PHASE_AGENT_MAP should have >= 14 entries, got ${count}`);
  });
});
