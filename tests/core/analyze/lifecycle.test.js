/**
 * Unit tests for src/core/analyze/lifecycle.js — Analyze Lifecycle
 *
 * Tests entry routing model, prefetch graph, and bug classification signals.
 * Requirements: REQ-0108 FR-001..004
 *
 * Test ID prefix: LC- (Lifecycle)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getEntryRoutingModel,
  getPrefetchGraph,
  getBugClassificationSignals
} from '../../../src/core/analyze/lifecycle.js';

// ---------------------------------------------------------------------------
// FR-001: Entry Routing Model (AC-001-01..04)
// ---------------------------------------------------------------------------

describe('FR-001: Entry Routing Model', () => {
  it('LC-01: flags.recognized contains expected flags (AC-001-01)', () => {
    const model = getEntryRoutingModel();
    assert.deepEqual(model.flags.recognized, [
      '--folder', '--interrupt', '--resume', '--provider'
    ]);
  });

  it('LC-02: flags.types maps flags to correct types (AC-001-01)', () => {
    const model = getEntryRoutingModel();
    assert.equal(model.flags.types['--folder'], 'string');
    assert.equal(model.flags.types['--interrupt'], 'boolean');
    assert.equal(model.flags.types['--resume'], 'boolean');
    assert.equal(model.flags.types['--provider'], 'string');
  });

  it('LC-03: flags.defaults has correct defaults (AC-001-01)', () => {
    const model = getEntryRoutingModel();
    assert.equal(model.flags.defaults['--interrupt'], false);
    assert.equal(model.flags.defaults['--resume'], false);
  });

  it('LC-04: classification_gate is bug_vs_feature (AC-001-03)', () => {
    const model = getEntryRoutingModel();
    assert.equal(model.classification_gate, 'bug_vs_feature');
  });

  it('LC-05: routing maps to correct handlers (AC-001-04)', () => {
    const model = getEntryRoutingModel();
    assert.equal(model.routing.bug, 'fix_handler');
    assert.equal(model.routing.feature, 'analyze_handler');
    assert.equal(model.routing.ambiguous, 'prompt_user');
  });

  it('LC-06: staleness_check config is present (AC-001-01)', () => {
    const model = getEntryRoutingModel();
    assert.equal(model.staleness_check.enabled, true);
    assert.equal(model.staleness_check.threshold_field, 'codebase_hash');
    assert.equal(model.staleness_check.action_on_stale, 'warn_and_continue');
  });

  it('LC-07: sizing_precheck config is present (AC-001-01)', () => {
    const model = getEntryRoutingModel();
    assert.equal(model.sizing_precheck.enabled, true);
    assert.equal(model.sizing_precheck.trivial_threshold, 'trivial');
    assert.deepEqual(model.sizing_precheck.tiers, ['trivial', 'light', 'standard']);
  });
});

// ---------------------------------------------------------------------------
// FR-002: Prefetch Dependency Graph (AC-002-01..03)
// ---------------------------------------------------------------------------

describe('FR-002: Prefetch Dependency Graph', () => {
  it('LC-08: graph has exactly 6 groups (AC-002-01)', () => {
    const graph = getPrefetchGraph();
    assert.equal(graph.length, 6);
  });

  it('LC-09: groups have correct IDs in order (AC-002-01)', () => {
    const graph = getPrefetchGraph();
    const ids = graph.map(g => g.id);
    assert.deepEqual(ids, [
      'issue_tracker', 'requirements_folder', 'memory',
      'personas', 'topics', 'discovery'
    ]);
  });

  it('LC-10: each group has required fields (AC-002-02)', () => {
    const graph = getPrefetchGraph();
    for (const group of graph) {
      assert.equal(typeof group.id, 'string', `group missing id`);
      assert.equal(typeof group.source, 'string', `${group.id} missing source`);
      assert.ok('fallback' in group, `${group.id} missing fallback`);
      assert.equal(typeof group.fail_open, 'boolean', `${group.id} missing fail_open`);
      assert.equal(typeof group.parallel, 'boolean', `${group.id} missing parallel`);
    }
  });

  it('LC-11: all groups are parallelizable (AC-002-03)', () => {
    const graph = getPrefetchGraph();
    for (const group of graph) {
      assert.equal(group.parallel, true, `${group.id} should be parallel`);
    }
  });
});

// ---------------------------------------------------------------------------
// FR-003: Bug Classification Signals (AC-003-01..03)
// ---------------------------------------------------------------------------

describe('FR-003: Bug Classification Signals', () => {
  it('LC-12: bug_signals contains expected keywords (AC-003-01)', () => {
    const signals = getBugClassificationSignals();
    const expected = ['broken', 'fix', 'bug', 'crash', 'error', 'wrong', 'failing', 'not working', '500'];
    assert.deepEqual(signals.bug_signals, expected);
  });

  it('LC-13: feature_signals contains expected keywords (AC-003-02)', () => {
    const signals = getBugClassificationSignals();
    const expected = ['add', 'build', 'create', 'implement', 'design', 'refactor', 'upgrade', 'migrate'];
    assert.deepEqual(signals.feature_signals, expected);
  });

  it('LC-14: signals are all lowercase for case-insensitive matching (AC-003-03)', () => {
    const signals = getBugClassificationSignals();
    for (const s of signals.bug_signals) {
      assert.equal(s, s.toLowerCase(), `bug signal "${s}" should be lowercase`);
    }
    for (const s of signals.feature_signals) {
      assert.equal(s, s.toLowerCase(), `feature signal "${s}" should be lowercase`);
    }
  });
});

// ---------------------------------------------------------------------------
// Immutability
// ---------------------------------------------------------------------------

describe('Lifecycle Immutability', () => {
  it('LC-15: routing model is frozen', () => {
    const model = getEntryRoutingModel();
    assert.ok(Object.isFrozen(model));
  });

  it('LC-16: prefetch graph is frozen', () => {
    const graph = getPrefetchGraph();
    assert.ok(Object.isFrozen(graph));
    for (const group of graph) {
      assert.ok(Object.isFrozen(group), `group ${group.id} should be frozen`);
    }
  });

  it('LC-17: classification signals are frozen', () => {
    const signals = getBugClassificationSignals();
    assert.ok(Object.isFrozen(signals));
    assert.ok(Object.isFrozen(signals.bug_signals));
    assert.ok(Object.isFrozen(signals.feature_signals));
  });
});
