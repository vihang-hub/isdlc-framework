'use strict';

/**
 * Tests for detectSource() options enhancement (REQ-0032)
 *
 * Tests the new optional `options` parameter for preference-based routing
 * of bare number inputs to the configured issue tracker.
 *
 * Traces: FR-005 (AC-005-01 through AC-005-06)
 *
 * Test IDs: TC-IT-013 through TC-IT-028
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { detectSource } = require('../lib/three-verb-utils.cjs');

// ---------------------------------------------------------------------------
// TC-IT-013: Bare number with jira preference and project key routes to jira
// ---------------------------------------------------------------------------

describe('detectSource options: bare number with jira preference', () => {
  // TC-IT-013
  it('routes bare number to jira when issueTracker=jira and jiraProjectKey set', () => {
    const result = detectSource('1234', { issueTracker: 'jira', jiraProjectKey: 'PROJ' });
    assert.deepStrictEqual(result, {
      source: 'jira',
      source_id: 'PROJ-1234',
      description: 'PROJ-1234'
    });
  });
});

// ---------------------------------------------------------------------------
// TC-IT-014: Bare number with github preference routes to github
// ---------------------------------------------------------------------------

describe('detectSource options: bare number with github preference', () => {
  // TC-IT-014
  it('routes bare number to github when issueTracker=github', () => {
    const result = detectSource('42', { issueTracker: 'github' });
    assert.deepStrictEqual(result, {
      source: 'github',
      source_id: 'GH-42',
      description: '#42'
    });
  });
});

// ---------------------------------------------------------------------------
// TC-IT-015: Bare number with manual preference routes to manual
// ---------------------------------------------------------------------------

describe('detectSource options: bare number with manual preference', () => {
  // TC-IT-015
  it('routes bare number to manual when issueTracker=manual', () => {
    const result = detectSource('42', { issueTracker: 'manual' });
    assert.deepStrictEqual(result, {
      source: 'manual',
      source_id: null,
      description: '42'
    });
  });
});

// ---------------------------------------------------------------------------
// TC-IT-016: Explicit GitHub pattern wins over jira preference
// ---------------------------------------------------------------------------

describe('detectSource options: explicit patterns win over options', () => {
  // TC-IT-016
  it('explicit #N pattern wins over jira preference', () => {
    const result = detectSource('#42', { issueTracker: 'jira', jiraProjectKey: 'PROJ' });
    assert.deepStrictEqual(result, {
      source: 'github',
      source_id: 'GH-42',
      description: '#42'
    });
  });

  // TC-IT-017
  it('explicit PROJECT-N pattern wins over github preference', () => {
    const result = detectSource('PROJ-123', { issueTracker: 'github' });
    assert.deepStrictEqual(result, {
      source: 'jira',
      source_id: 'PROJ-123',
      description: 'PROJ-123'
    });
  });
});

// ---------------------------------------------------------------------------
// TC-IT-018: No options provided -- backward compatible
// ---------------------------------------------------------------------------

describe('detectSource options: backward compatibility', () => {
  // TC-IT-018
  it('bare number without options routes to manual (backward compatible)', () => {
    const result = detectSource('1234');
    assert.deepStrictEqual(result, {
      source: 'manual',
      source_id: null,
      description: '1234'
    });
  });

  // TC-IT-019
  it('empty options object routes bare number to manual', () => {
    const result = detectSource('1234', {});
    assert.deepStrictEqual(result, {
      source: 'manual',
      source_id: null,
      description: '1234'
    });
  });
});

// ---------------------------------------------------------------------------
// TC-IT-020: Jira preference without jiraProjectKey falls through to manual
// ---------------------------------------------------------------------------

describe('detectSource options: missing jiraProjectKey', () => {
  // TC-IT-020
  it('jira preference without jiraProjectKey falls through to manual', () => {
    const result = detectSource('1234', { issueTracker: 'jira' });
    assert.deepStrictEqual(result, {
      source: 'manual',
      source_id: null,
      description: '1234'
    });
  });

  // TC-IT-021
  it('jira preference with empty jiraProjectKey falls through to manual', () => {
    const result = detectSource('1234', { issueTracker: 'jira', jiraProjectKey: '' });
    assert.deepStrictEqual(result, {
      source: 'manual',
      source_id: null,
      description: '1234'
    });
  });
});

// ---------------------------------------------------------------------------
// TC-IT-022: Non-numeric input with options routes to manual
// ---------------------------------------------------------------------------

describe('detectSource options: non-numeric input', () => {
  // TC-IT-022
  it('non-numeric input with jira options routes to manual', () => {
    const result = detectSource('fix login bug', { issueTracker: 'jira', jiraProjectKey: 'PROJ' });
    assert.deepStrictEqual(result, {
      source: 'manual',
      source_id: null,
      description: 'fix login bug'
    });
  });
});

// ---------------------------------------------------------------------------
// TC-IT-023: Invalid issueTracker value silently ignored
// ---------------------------------------------------------------------------

describe('detectSource options: invalid issueTracker value', () => {
  // TC-IT-023
  it('unknown tracker value treated as absent', () => {
    const result = detectSource('42', { issueTracker: 'linear' });
    assert.deepStrictEqual(result, {
      source: 'manual',
      source_id: null,
      description: '42'
    });
  });
});

// ---------------------------------------------------------------------------
// TC-IT-024: Null and undefined inputs with options -- fail-safe
// ---------------------------------------------------------------------------

describe('detectSource options: null/undefined inputs', () => {
  // TC-IT-024
  it('null input with options returns fail-safe manual', () => {
    const result = detectSource(null, { issueTracker: 'jira', jiraProjectKey: 'PROJ' });
    assert.deepStrictEqual(result, {
      source: 'manual',
      source_id: null,
      description: ''
    });
  });

  it('undefined input with options returns fail-safe manual', () => {
    const result = detectSource(undefined, { issueTracker: 'github' });
    assert.deepStrictEqual(result, {
      source: 'manual',
      source_id: null,
      description: ''
    });
  });
});

// ---------------------------------------------------------------------------
// Adversarial / Boundary Tests (Article XI)
// ---------------------------------------------------------------------------

describe('detectSource options: adversarial/boundary tests', () => {
  // TC-IT-025
  it('bare number zero routes correctly with jira', () => {
    const result = detectSource('0', { issueTracker: 'jira', jiraProjectKey: 'PROJ' });
    assert.deepStrictEqual(result, {
      source: 'jira',
      source_id: 'PROJ-0',
      description: 'PROJ-0'
    });
  });

  // TC-IT-026
  it('very large bare number routes correctly with github', () => {
    const result = detectSource('999999999', { issueTracker: 'github' });
    assert.deepStrictEqual(result, {
      source: 'github',
      source_id: 'GH-999999999',
      description: '#999999999'
    });
  });

  // TC-IT-027
  it('leading-zero bare number routes correctly with jira', () => {
    const result = detectSource('00042', { issueTracker: 'jira', jiraProjectKey: 'PROJ' });
    assert.deepStrictEqual(result, {
      source: 'jira',
      source_id: 'PROJ-00042',
      description: 'PROJ-00042'
    });
  });

  // TC-IT-028
  it('input with special regex characters not misinterpreted', () => {
    const result = detectSource('$42', { issueTracker: 'github' });
    assert.deepStrictEqual(result, {
      source: 'manual',
      source_id: null,
      description: '$42'
    });
  });
});
