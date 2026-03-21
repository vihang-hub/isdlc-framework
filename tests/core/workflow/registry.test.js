/**
 * Tests for src/core/workflow/registry.js
 * REQ-0082: Extract WorkflowRegistry
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveExtension,
  validatePhaseOrdering,
  validateWorkflow,
  loadPhaseOrdering,
  buildShippedEntry,
  buildCustomEntry,
  loadWorkflows
} from '../../../src/core/workflow/registry.js';

describe('resolveExtension', () => {
  const basePhases = ['01-requirements', '02-tracing', '03-architecture', '06-implementation'];

  it('removes phases', () => {
    const result = resolveExtension(basePhases, { remove_phases: ['02-tracing'] });
    assert.deepStrictEqual(result.phases, ['01-requirements', '03-architecture', '06-implementation']);
  });

  it('adds phases after a target', () => {
    const result = resolveExtension(basePhases, {
      add_phases: [{ phase: '05-test-strategy', after: '03-architecture' }]
    });
    assert.ok(result.phases.indexOf('05-test-strategy') === result.phases.indexOf('03-architecture') + 1);
  });

  it('adds phases before a target', () => {
    const result = resolveExtension(basePhases, {
      add_phases: [{ phase: '04-design', before: '06-implementation' }]
    });
    assert.ok(result.phases.indexOf('04-design') === result.phases.indexOf('06-implementation') - 1);
  });

  it('throws on removing non-existent phase', () => {
    assert.throws(() => resolveExtension(basePhases, { remove_phases: ['nonexistent'] }), /not found/);
  });

  it('throws when result is empty', () => {
    assert.throws(() => resolveExtension(['a'], { remove_phases: ['a'] }), /empty phase list/);
  });

  it('records agent mappings for custom phases', () => {
    const result = resolveExtension(basePhases, {
      add_phases: [{ phase: 'custom-phase', after: '06-implementation', agent: 'custom-agent.md' }]
    });
    assert.strictEqual(result.phase_agents['custom-phase'], 'custom-agent.md');
  });

  it('handles reorder operations', () => {
    const result = resolveExtension(basePhases, {
      reorder: [{ move: '06-implementation', after: '01-requirements' }]
    });
    assert.ok(result.phases.indexOf('06-implementation') === result.phases.indexOf('01-requirements') + 1);
  });

  it('appends phases with no insertion point', () => {
    const result = resolveExtension(basePhases, {
      add_phases: ['new-phase']
    });
    assert.strictEqual(result.phases[result.phases.length - 1], 'new-phase');
  });

  it('does not mutate input array', () => {
    const original = [...basePhases];
    resolveExtension(basePhases, { remove_phases: ['02-tracing'] });
    assert.deepStrictEqual(basePhases, original);
  });
});

describe('validatePhaseOrdering', () => {
  it('returns no warnings for correct ordering', () => {
    const order = { '01-requirements': 1, '03-architecture': 3, '06-implementation': 6 };
    const warnings = validatePhaseOrdering(['01-requirements', '03-architecture', '06-implementation'], order);
    assert.strictEqual(warnings.length, 0);
  });

  it('detects out-of-order phases', () => {
    const order = { '01-requirements': 1, '03-architecture': 3, '06-implementation': 6 };
    const warnings = validatePhaseOrdering(['06-implementation', '01-requirements'], order);
    assert.ok(warnings.length > 0);
    assert.ok(warnings[0].includes('Phase ordering warning'));
  });

  it('skips custom phases (not in canonical order)', () => {
    const order = { '01-requirements': 1 };
    const warnings = validatePhaseOrdering(['01-requirements', 'custom-phase'], order);
    assert.strictEqual(warnings.length, 0);
  });
});

describe('validateWorkflow', () => {
  it('fails when name is missing', () => {
    const result = validateWorkflow({}, 'test.yaml', {}, '/tmp');
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('name')));
  });

  it('fails when name collides with shipped', () => {
    const shipped = { feature: { phases: [] } };
    const result = validateWorkflow({ name: 'feature' }, 'test.yaml', shipped, '/tmp');
    assert.strictEqual(result.valid, false);
  });

  it('fails when no phases or extends', () => {
    const result = validateWorkflow({ name: 'my-workflow' }, 'test.yaml', {}, '/tmp');
    assert.strictEqual(result.valid, false);
  });

  it('fails when extends target not found', () => {
    const result = validateWorkflow({ name: 'my-workflow', extends: 'nonexistent' }, 'test.yaml', {}, '/tmp');
    assert.strictEqual(result.valid, false);
  });

  it('warns on empty intent field', () => {
    const result = validateWorkflow(
      { name: 'my-workflow', phases: ['01-requirements'], intent: '' },
      'test.yaml', {}, '/tmp'
    );
    assert.ok(result.warnings.length > 0);
  });
});

describe('loadPhaseOrdering', () => {
  it('returns an object (may be empty if config not found)', () => {
    const result = loadPhaseOrdering();
    assert.strictEqual(typeof result, 'object');
  });
});

describe('buildShippedEntry', () => {
  it('creates a registry entry with defaults', () => {
    const entry = buildShippedEntry('feature', { label: 'Feature', phases: ['01-requirements'] });
    assert.strictEqual(entry.name, 'Feature');
    assert.strictEqual(entry.source, 'shipped');
    assert.deepStrictEqual(entry.phases, ['01-requirements']);
    assert.strictEqual(entry.gate_mode, 'strict');
  });

  it('uses name as fallback when label is missing', () => {
    const entry = buildShippedEntry('fix', {});
    assert.strictEqual(entry.name, 'fix');
  });
});

describe('buildCustomEntry', () => {
  it('builds entry from standalone workflow', () => {
    const workflow = { name: 'my-wf', phases: ['01-requirements', '06-implementation'] };
    const entry = buildCustomEntry(workflow, 'test.yaml', {});
    assert.strictEqual(entry.source, 'custom');
    assert.deepStrictEqual(entry.phases, ['01-requirements', '06-implementation']);
  });

  it('builds entry from extending workflow', () => {
    const shipped = { feature: { phases: ['01-requirements', '06-implementation'] } };
    const workflow = { name: 'my-wf', extends: 'feature', remove_phases: ['01-requirements'] };
    const entry = buildCustomEntry(workflow, 'test.yaml', shipped);
    assert.deepStrictEqual(entry.phases, ['06-implementation']);
    assert.strictEqual(entry.extends, 'feature');
  });
});

describe('loadWorkflows', () => {
  it('loads shipped workflows from config', () => {
    const result = loadWorkflows('/tmp/nonexistent');
    // Should have shipped workflows (or errors if config not found)
    assert.ok(typeof result.shipped === 'object');
    assert.ok(typeof result.merged === 'object');
    assert.ok(Array.isArray(result.warnings));
    assert.ok(Array.isArray(result.errors));
  });
});
