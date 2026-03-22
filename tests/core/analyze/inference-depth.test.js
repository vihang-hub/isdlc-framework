/**
 * Unit tests for src/core/analyze/inference-depth.js — Inference Depth Sensing
 *
 * Tests confidence levels, depth guidance, coverage guardrails, adjustment signals.
 * Requirements: REQ-0113 FR-001..005
 *
 * Test ID prefix: ID- (Inference Depth)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getConfidenceLevels,
  getDepthGuidance,
  getCoverageGuardrails,
  getDepthAdjustmentSignals
} from '../../../src/core/analyze/inference-depth.js';

// ---------------------------------------------------------------------------
// FR-001: Confidence Levels (AC-001-01..02)
// ---------------------------------------------------------------------------

describe('FR-001: Confidence Levels', () => {
  it('ID-01: has 3 levels: HIGH, MEDIUM, LOW (AC-001-01)', () => {
    const conf = getConfidenceLevels();
    const keys = Object.keys(conf);
    assert.equal(keys.length, 3);
    assert.ok('HIGH' in conf);
    assert.ok('MEDIUM' in conf);
    assert.ok('LOW' in conf);
  });

  it('ID-02: each level has value, weight, description (AC-001-02)', () => {
    const conf = getConfidenceLevels();
    for (const key of ['HIGH', 'MEDIUM', 'LOW']) {
      assert.equal(typeof conf[key].value, 'string', `${key} missing value`);
      assert.equal(typeof conf[key].weight, 'number', `${key} missing weight`);
      assert.equal(typeof conf[key].description, 'string', `${key} missing description`);
    }
  });

  it('ID-03: weights are ordered HIGH > MEDIUM > LOW (AC-001-02)', () => {
    const conf = getConfidenceLevels();
    assert.ok(conf.HIGH.weight > conf.MEDIUM.weight);
    assert.ok(conf.MEDIUM.weight > conf.LOW.weight);
  });

  it('ID-04: HIGH weight is 1.0, MEDIUM is 0.6, LOW is 0.3', () => {
    const conf = getConfidenceLevels();
    assert.equal(conf.HIGH.weight, 1.0);
    assert.equal(conf.MEDIUM.weight, 0.6);
    assert.equal(conf.LOW.weight, 0.3);
  });
});

// ---------------------------------------------------------------------------
// FR-002: Depth Guidance (AC-002-01..03)
// ---------------------------------------------------------------------------

describe('FR-002: Depth Guidance', () => {
  it('ID-05: guidance exists for 4 topics (AC-002-01)', () => {
    const topics = ['problem-discovery', 'requirements-definition', 'architecture', 'specification'];
    for (const t of topics) {
      const guidance = getDepthGuidance(t);
      assert.ok(guidance !== null, `${t} should have guidance`);
    }
  });

  it('ID-06: each topic has brief, standard, deep (AC-002-02)', () => {
    const topics = ['problem-discovery', 'requirements-definition', 'architecture', 'specification'];
    for (const t of topics) {
      const guidance = getDepthGuidance(t);
      assert.ok('brief' in guidance, `${t} missing brief`);
      assert.ok('standard' in guidance, `${t} missing standard`);
      assert.ok('deep' in guidance, `${t} missing deep`);
    }
  });

  it('ID-07: each depth level has behavior, acceptance, inference_policy (AC-002-03)', () => {
    const topics = ['problem-discovery', 'requirements-definition', 'architecture', 'specification'];
    for (const t of topics) {
      const guidance = getDepthGuidance(t);
      for (const depth of ['brief', 'standard', 'deep']) {
        assert.equal(typeof guidance[depth].behavior, 'string', `${t}.${depth} missing behavior`);
        assert.equal(typeof guidance[depth].acceptance, 'string', `${t}.${depth} missing acceptance`);
        assert.equal(typeof guidance[depth].inference_policy, 'string', `${t}.${depth} missing inference_policy`);
      }
    }
  });

  it('ID-08: unknown topic returns null (AC-005-02)', () => {
    assert.equal(getDepthGuidance('nonexistent'), null);
  });

  it('ID-09: problem-discovery brief behavior is summarize', () => {
    const guidance = getDepthGuidance('problem-discovery');
    assert.equal(guidance.brief.behavior, 'summarize');
    assert.equal(guidance.standard.behavior, 'full');
    assert.equal(guidance.deep.behavior, 'extended');
  });
});

// ---------------------------------------------------------------------------
// FR-003: Coverage Guardrails (AC-003-01..02)
// ---------------------------------------------------------------------------

describe('FR-003: Coverage Guardrails', () => {
  it('ID-10: brief requires min 2 topics (AC-003-01)', () => {
    const guardrails = getCoverageGuardrails();
    assert.equal(guardrails.brief.min_topics, 2);
    assert.deepEqual(guardrails.brief.required, ['problem-discovery']);
  });

  it('ID-11: standard requires all 4 mandatory topics (AC-003-01)', () => {
    const guardrails = getCoverageGuardrails();
    assert.equal(guardrails.standard.min_topics, 4);
    assert.deepEqual(guardrails.standard.required, [
      'problem-discovery', 'requirements-definition', 'architecture', 'specification'
    ]);
  });

  it('ID-12: deep requires all 4 mandatory topics (AC-003-01)', () => {
    const guardrails = getCoverageGuardrails();
    assert.equal(guardrails.deep.min_topics, 4);
    assert.deepEqual(guardrails.deep.required, [
      'problem-discovery', 'requirements-definition', 'architecture', 'specification'
    ]);
  });

  it('ID-13: guardrails are frozen (AC-003-02)', () => {
    const guardrails = getCoverageGuardrails();
    assert.ok(Object.isFrozen(guardrails));
    for (const key of Object.keys(guardrails)) {
      assert.ok(Object.isFrozen(guardrails[key]), `${key} guardrail should be frozen`);
      assert.ok(Object.isFrozen(guardrails[key].required), `${key}.required should be frozen`);
    }
  });
});

// ---------------------------------------------------------------------------
// FR-004: Depth Adjustment Signals (AC-004-01..02)
// ---------------------------------------------------------------------------

describe('FR-004: Depth Adjustment Signals', () => {
  it('ID-14: signals list is non-empty (AC-004-01)', () => {
    const signals = getDepthAdjustmentSignals();
    assert.ok(signals.length > 0);
  });

  it('ID-15: each signal has signal and direction (AC-004-01)', () => {
    const signals = getDepthAdjustmentSignals();
    for (const s of signals) {
      assert.equal(typeof s.signal, 'string', 'missing signal');
      assert.ok(['shallower', 'deeper'].includes(s.direction), `invalid direction: ${s.direction}`);
    }
  });

  it('ID-16: contains both shallower and deeper signals (AC-004-02)', () => {
    const signals = getDepthAdjustmentSignals();
    const directions = new Set(signals.map(s => s.direction));
    assert.ok(directions.has('shallower'));
    assert.ok(directions.has('deeper'));
  });

  it('ID-17: known shallower signals are present', () => {
    const signals = getDepthAdjustmentSignals();
    const shallower = signals.filter(s => s.direction === 'shallower').map(s => s.signal);
    assert.ok(shallower.includes('keep it simple'));
    assert.ok(shallower.includes('just the basics'));
  });

  it('ID-18: known deeper signals are present', () => {
    const signals = getDepthAdjustmentSignals();
    const deeper = signals.filter(s => s.direction === 'deeper').map(s => s.signal);
    assert.ok(deeper.includes('tell me more'));
    assert.ok(deeper.includes('dig deeper'));
  });
});

// ---------------------------------------------------------------------------
// Immutability
// ---------------------------------------------------------------------------

describe('Inference Depth Immutability', () => {
  it('ID-19: confidence levels are frozen at all levels', () => {
    const conf = getConfidenceLevels();
    assert.ok(Object.isFrozen(conf));
    for (const key of Object.keys(conf)) {
      assert.ok(Object.isFrozen(conf[key]), `${key} should be frozen`);
    }
  });

  it('ID-20: depth guidance objects are frozen at all levels', () => {
    const topics = ['problem-discovery', 'requirements-definition', 'architecture', 'specification'];
    for (const t of topics) {
      const guidance = getDepthGuidance(t);
      assert.ok(Object.isFrozen(guidance), `${t} guidance should be frozen`);
      for (const depth of ['brief', 'standard', 'deep']) {
        assert.ok(Object.isFrozen(guidance[depth]), `${t}.${depth} should be frozen`);
      }
    }
  });

  it('ID-21: adjustment signals are frozen', () => {
    const signals = getDepthAdjustmentSignals();
    assert.ok(Object.isFrozen(signals));
    for (const s of signals) {
      assert.ok(Object.isFrozen(s), `signal "${s.signal}" should be frozen`);
    }
  });
});
