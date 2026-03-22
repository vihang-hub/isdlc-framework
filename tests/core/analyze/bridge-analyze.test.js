/**
 * Unit tests for src/core/bridge/analyze.cjs — CJS Bridge for Analyze
 *
 * Per Article XIII (Module System Consistency), CJS bridge tests verify
 * parity between CJS bridge and ESM exports.
 *
 * Requirements: REQ-0108..0113 (CJS bridge)
 *
 * Test ID prefix: AB- (Analyze Bridge)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Bridge Exports
// ---------------------------------------------------------------------------

describe('CJS Bridge: analyze.cjs exports', () => {
  it('AB-01: exports loadAnalyze function', () => {
    const bridge = require('../../../src/core/bridge/analyze.cjs');
    assert.equal(typeof bridge.loadAnalyze, 'function');
  });
});

// ---------------------------------------------------------------------------
// Bridge-ESM Parity
// ---------------------------------------------------------------------------

describe('CJS Bridge: parity with ESM', () => {
  it('AB-02: loadAnalyze returns module with getEntryRoutingModel', async () => {
    const bridge = require('../../../src/core/bridge/analyze.cjs');
    const mod = await bridge.loadAnalyze();
    assert.equal(typeof mod.getEntryRoutingModel, 'function');
  });

  it('AB-03: loadAnalyze returns module with getStateMachine', async () => {
    const bridge = require('../../../src/core/bridge/analyze.cjs');
    const mod = await bridge.loadAnalyze();
    assert.equal(typeof mod.getStateMachine, 'function');
  });

  it('AB-04: loadAnalyze returns module with getArtifactReadiness', async () => {
    const bridge = require('../../../src/core/bridge/analyze.cjs');
    const mod = await bridge.loadAnalyze();
    assert.equal(typeof mod.getArtifactReadiness, 'function');
  });

  it('AB-05: loadAnalyze returns module with getMemoryLayerSchema', async () => {
    const bridge = require('../../../src/core/bridge/analyze.cjs');
    const mod = await bridge.loadAnalyze();
    assert.equal(typeof mod.getMemoryLayerSchema, 'function');
  });

  it('AB-06: loadAnalyze returns module with getFinalizationChain', async () => {
    const bridge = require('../../../src/core/bridge/analyze.cjs');
    const mod = await bridge.loadAnalyze();
    assert.equal(typeof mod.getFinalizationChain, 'function');
  });

  it('AB-07: loadAnalyze returns module with getConfidenceLevels', async () => {
    const bridge = require('../../../src/core/bridge/analyze.cjs');
    const mod = await bridge.loadAnalyze();
    assert.equal(typeof mod.getConfidenceLevels, 'function');
  });

  it('AB-08: getEntryRoutingModel returns same data via bridge', async () => {
    const bridge = require('../../../src/core/bridge/analyze.cjs');
    const { getEntryRoutingModel } = await import('../../../src/core/analyze/index.js');

    const mod = await bridge.loadAnalyze();
    const bridgeResult = mod.getEntryRoutingModel();
    const esmResult = getEntryRoutingModel();
    assert.deepEqual(bridgeResult, esmResult);
  });

  it('AB-09: getFinalizationChain returns same data via bridge', async () => {
    const bridge = require('../../../src/core/bridge/analyze.cjs');
    const { getFinalizationChain } = await import('../../../src/core/analyze/index.js');

    const mod = await bridge.loadAnalyze();
    const bridgeResult = mod.getFinalizationChain();
    const esmResult = getFinalizationChain();
    assert.deepEqual(bridgeResult, esmResult);
  });

  it('AB-10: getStateMachine returns same data via bridge', async () => {
    const bridge = require('../../../src/core/bridge/analyze.cjs');
    const { getStateMachine } = await import('../../../src/core/analyze/index.js');

    const mod = await bridge.loadAnalyze();
    const bridgeResult = mod.getStateMachine();
    const esmResult = getStateMachine();
    assert.deepEqual(bridgeResult, esmResult);
  });
});
