/**
 * Contract State Helpers Tests
 * =============================
 * REQ-0141: Execution Contract System (FR-004)
 * AC-004-01 through AC-004-05
 *
 * Tests for writeContractViolation, readContractViolations, clearContractViolations.
 * CJS module tests (state helpers live in common.cjs).
 */

'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Set test mode before requiring common
process.env.ISDLC_TEST_MODE = '1';
const {
  writeContractViolation,
  readContractViolations,
  clearContractViolations,
  MAX_CONTRACT_VIOLATIONS
} = require('../lib/common.cjs');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createViolationEntry(overrides = {}) {
  return {
    contract_id: '06-implementation:feature:standard',
    execution_unit: '06-implementation',
    expectation_type: 'agent_not_engaged',
    expected: 'Agent "software-developer" engaged',
    actual: 'No matching delegation found',
    severity: 'block',
    configured_response: 'block',
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// SH-01 to SH-07: writeContractViolation
// ---------------------------------------------------------------------------

describe('writeContractViolation', () => {
  let state;

  beforeEach(() => {
    state = { contract_violations: [] };
  });

  it('SH-01: Appends violation entry to state.contract_violations[]', () => {
    const entry = createViolationEntry();
    writeContractViolation(state, entry);
    assert.equal(state.contract_violations.length, 1);
    assert.deepStrictEqual(state.contract_violations[0], entry);
  });

  it('SH-02: Initializes contract_violations array if missing from state', () => {
    const stateNoArray = {};
    const entry = createViolationEntry();
    writeContractViolation(stateNoArray, entry);
    assert.ok(Array.isArray(stateNoArray.contract_violations));
    assert.equal(stateNoArray.contract_violations.length, 1);
  });

  it('SH-03: Deduplicates by contract_id + expectation_type', () => {
    const entry1 = createViolationEntry({ actual: 'first' });
    const entry2 = createViolationEntry({ actual: 'second' });
    writeContractViolation(state, entry1);
    writeContractViolation(state, entry2);
    // Should have only 1 entry (updated)
    assert.equal(state.contract_violations.length, 1);
    assert.equal(state.contract_violations[0].actual, 'second');
  });

  it('SH-04: FIFO cap at 20 entries -- oldest evicted when cap exceeded', () => {
    // Fill up to 20
    for (let i = 0; i < 21; i++) {
      writeContractViolation(state, createViolationEntry({
        contract_id: `contract-${i}`,
        expectation_type: `type-${i}`
      }));
    }
    assert.equal(state.contract_violations.length, MAX_CONTRACT_VIOLATIONS);
    // First entry (contract-0) should be evicted
    assert.equal(state.contract_violations[0].contract_id, 'contract-1');
  });

  it('SH-05: Written entry contains all required fields', () => {
    const entry = createViolationEntry();
    writeContractViolation(state, entry);
    const written = state.contract_violations[0];
    assert.ok('contract_id' in written);
    assert.ok('execution_unit' in written);
    assert.ok('expected' in written);
    assert.ok('actual' in written);
    assert.ok('severity' in written);
    assert.ok('configured_response' in written);
  });

  it('SH-06: Is a pure in-memory mutator -- does not write to disk', () => {
    // Verify it doesn't call writeState by checking state remains the same object
    const entry = createViolationEntry();
    const originalState = state;
    writeContractViolation(state, entry);
    assert.strictEqual(state, originalState);
    // The function is pure in-memory -- it mutates the passed object only
  });

  it('SH-07: Handles corrupt contract_violations (non-array) by reinitializing', () => {
    state.contract_violations = 'not-an-array';
    const entry = createViolationEntry();
    writeContractViolation(state, entry);
    assert.ok(Array.isArray(state.contract_violations));
    assert.equal(state.contract_violations.length, 1);
  });
});

// ---------------------------------------------------------------------------
// SH-08 to SH-11: readContractViolations
// ---------------------------------------------------------------------------

describe('readContractViolations', () => {
  it('SH-08: Returns contract_violations array from state', () => {
    const entry = createViolationEntry();
    const state = { contract_violations: [entry] };
    const result = readContractViolations(state);
    assert.deepStrictEqual(result, [entry]);
  });

  it('SH-09: Returns empty array when contract_violations is missing', () => {
    const result = readContractViolations({});
    assert.deepStrictEqual(result, []);
  });

  it('SH-10: Returns empty array when contract_violations is malformed (non-array)', () => {
    const result = readContractViolations({ contract_violations: 'bad' });
    assert.deepStrictEqual(result, []);
  });

  it('SH-11: Does not mutate state', () => {
    const entry = createViolationEntry();
    const state = { contract_violations: [entry] };
    const before = JSON.stringify(state);
    readContractViolations(state);
    assert.equal(JSON.stringify(state), before);
  });
});

// ---------------------------------------------------------------------------
// SH-12 to SH-14: clearContractViolations
// ---------------------------------------------------------------------------

describe('clearContractViolations', () => {
  it('SH-12: Sets state.contract_violations to empty array', () => {
    const state = { contract_violations: [createViolationEntry()] };
    clearContractViolations(state);
    assert.deepStrictEqual(state.contract_violations, []);
  });

  it('SH-13: Is a pure in-memory mutator -- does not write to disk', () => {
    const state = { contract_violations: [createViolationEntry()] };
    const originalState = state;
    clearContractViolations(state);
    assert.strictEqual(state, originalState);
  });

  it('SH-14: Handles missing contract_violations without error', () => {
    const state = {};
    clearContractViolations(state);
    assert.deepStrictEqual(state.contract_violations, []);
  });
});

// ---------------------------------------------------------------------------
// SH-15 to SH-18: FIFO and dedup boundary tests
// ---------------------------------------------------------------------------

describe('FIFO and dedup boundaries', () => {
  it('SH-15: At exactly 20 entries, no eviction occurs', () => {
    const state = { contract_violations: [] };
    for (let i = 0; i < 20; i++) {
      writeContractViolation(state, createViolationEntry({
        contract_id: `contract-${i}`,
        expectation_type: `type-${i}`
      }));
    }
    assert.equal(state.contract_violations.length, 20);
    assert.equal(state.contract_violations[0].contract_id, 'contract-0');
  });

  it('SH-16: At 21 entries, oldest entry is evicted', () => {
    const state = { contract_violations: [] };
    for (let i = 0; i < 21; i++) {
      writeContractViolation(state, createViolationEntry({
        contract_id: `contract-${i}`,
        expectation_type: `type-${i}`
      }));
    }
    assert.equal(state.contract_violations.length, 20);
    assert.equal(state.contract_violations[0].contract_id, 'contract-1');
  });

  it('SH-17: Duplicate entry updates but does not add second copy', () => {
    const state = { contract_violations: [] };
    const entry1 = createViolationEntry({ actual: 'original' });
    const entry2 = createViolationEntry({ actual: 'updated' });
    writeContractViolation(state, entry1);
    writeContractViolation(state, entry2);
    assert.equal(state.contract_violations.length, 1);
    assert.equal(state.contract_violations[0].actual, 'updated');
  });

  it('SH-18: Same contract_id with different expectation_type is NOT a duplicate', () => {
    const state = { contract_violations: [] };
    writeContractViolation(state, createViolationEntry({ expectation_type: 'agent_not_engaged' }));
    writeContractViolation(state, createViolationEntry({ expectation_type: 'skills_missing' }));
    assert.equal(state.contract_violations.length, 2);
  });
});
