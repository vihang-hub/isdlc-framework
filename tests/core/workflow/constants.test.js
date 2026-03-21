/**
 * Tests for src/core/workflow/constants.js
 * REQ-0082: Extract WorkflowRegistry
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  KNOWN_PHASE_KEYS,
  PHASE_KEY_ALIASES,
  ANALYSIS_PHASES,
  IMPLEMENTATION_PHASES,
  PHASE_NAME_MAP,
  normalizePhaseKey
} from '../../../src/core/workflow/constants.js';

describe('KNOWN_PHASE_KEYS', () => {
  it('is a frozen array', () => {
    assert.ok(Object.isFrozen(KNOWN_PHASE_KEYS));
    assert.ok(Array.isArray(KNOWN_PHASE_KEYS));
  });

  it('includes standard phases', () => {
    assert.ok(KNOWN_PHASE_KEYS.includes('06-implementation'));
    assert.ok(KNOWN_PHASE_KEYS.includes('01-requirements'));
    assert.ok(KNOWN_PHASE_KEYS.includes('16-quality-loop'));
  });
});

describe('PHASE_KEY_ALIASES', () => {
  it('maps legacy keys to canonical keys', () => {
    assert.strictEqual(PHASE_KEY_ALIASES['13-test-deploy'], '12-test-deploy');
    assert.strictEqual(PHASE_KEY_ALIASES['14-production'], '13-production');
  });
});

describe('ANALYSIS_PHASES', () => {
  it('contains 5 analysis phases in order', () => {
    assert.strictEqual(ANALYSIS_PHASES.length, 5);
    assert.strictEqual(ANALYSIS_PHASES[0], '00-quick-scan');
    assert.strictEqual(ANALYSIS_PHASES[4], '04-design');
  });
});

describe('IMPLEMENTATION_PHASES', () => {
  it('contains implementation phases', () => {
    assert.ok(IMPLEMENTATION_PHASES.includes('06-implementation'));
    assert.ok(IMPLEMENTATION_PHASES.includes('08-code-review'));
  });
});

describe('normalizePhaseKey', () => {
  it('normalizes aliased keys', () => {
    assert.strictEqual(normalizePhaseKey('13-test-deploy'), '12-test-deploy');
    assert.strictEqual(normalizePhaseKey('14-production'), '13-production');
  });

  it('returns canonical keys unchanged', () => {
    assert.strictEqual(normalizePhaseKey('06-implementation'), '06-implementation');
    assert.strictEqual(normalizePhaseKey('01-requirements'), '01-requirements');
  });

  it('handles null/undefined input', () => {
    assert.strictEqual(normalizePhaseKey(null), null);
    assert.strictEqual(normalizePhaseKey(undefined), undefined);
  });

  it('handles non-string input', () => {
    assert.strictEqual(normalizePhaseKey(42), 42);
  });
});

describe('PHASE_NAME_MAP', () => {
  it('maps phase keys to display names', () => {
    assert.strictEqual(PHASE_NAME_MAP['06-implementation'], 'Implementation');
    assert.strictEqual(PHASE_NAME_MAP['01-requirements'], 'Requirements');
  });
});
