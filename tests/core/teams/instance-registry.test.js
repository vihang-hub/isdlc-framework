/**
 * Unit tests for src/core/teams/instance-registry.js -- Team Instance Registry
 *
 * Tests getTeamInstance() lookup, listTeamInstances() enumeration,
 * and getTeamInstancesByPhase() filtering.
 * Requirements: REQ-0095, REQ-0096, REQ-0097, REQ-0098 (shared registry)
 *
 * Test ID prefix: IR- (Instance Registry)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getTeamInstance,
  listTeamInstances,
  getTeamInstancesByPhase
} from '../../../src/core/teams/instance-registry.js';

import { impactAnalysisInstance } from '../../../src/core/teams/instances/impact-analysis.js';
import { tracingInstance } from '../../../src/core/teams/instances/tracing.js';
import { qualityLoopInstance } from '../../../src/core/teams/instances/quality-loop.js';
import { debateRequirementsInstance } from '../../../src/core/teams/instances/debate-requirements.js';
import { debateArchitectureInstance } from '../../../src/core/teams/instances/debate-architecture.js';
import { debateDesignInstance } from '../../../src/core/teams/instances/debate-design.js';
import { debateTestStrategyInstance } from '../../../src/core/teams/instances/debate-test-strategy.js';

// ---------------------------------------------------------------------------
// getTeamInstance (Positive)
// ---------------------------------------------------------------------------

describe('Instance Registry: getTeamInstance()', () => {
  // IR-01: getTeamInstance('impact_analysis') returns correct frozen config
  it('IR-01: returns correct frozen config for impact_analysis (REQ-0095 FR-001)', () => {
    const instance = getTeamInstance('impact_analysis');
    assert.equal(instance.instance_id, 'impact_analysis');
    assert.equal(instance.team_type, 'fan_out');
    assert.ok(Object.isFrozen(instance));
  });

  // IR-02: getTeamInstance('tracing') returns correct frozen config
  it('IR-02: returns correct frozen config for tracing (REQ-0096 FR-001)', () => {
    const instance = getTeamInstance('tracing');
    assert.equal(instance.instance_id, 'tracing');
    assert.equal(instance.team_type, 'fan_out');
    assert.ok(Object.isFrozen(instance));
  });

  // IR-03: getTeamInstance('quality_loop') returns correct frozen config
  it('IR-03: returns correct frozen config for quality_loop (REQ-0097 FR-001)', () => {
    const instance = getTeamInstance('quality_loop');
    assert.equal(instance.instance_id, 'quality_loop');
    assert.equal(instance.team_type, 'dual_track');
    assert.ok(Object.isFrozen(instance));
  });
});

// ---------------------------------------------------------------------------
// getTeamInstance (Negative)
// ---------------------------------------------------------------------------

describe('Instance Registry: getTeamInstance() error handling', () => {
  // IR-04: Throws on unknown instance ID with available IDs in message
  it('IR-04: throws on unknown instance ID with available IDs in message (ERR-INSTANCE-001)', () => {
    assert.throws(
      () => getTeamInstance('nonexistent'),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('impact_analysis'), 'Should list available IDs');
        assert.ok(err.message.includes('tracing'), 'Should list available IDs');
        assert.ok(err.message.includes('quality_loop'), 'Should list available IDs');
        return true;
      }
    );
  });

  // IR-05: Throws on null/undefined input
  it('IR-05: throws on null/undefined input (ERR-INSTANCE-001)', () => {
    assert.throws(() => getTeamInstance(null), Error);
    assert.throws(() => getTeamInstance(undefined), Error);
  });

  // IR-06: Throws on empty string
  it('IR-06: throws on empty string (ERR-INSTANCE-001)', () => {
    assert.throws(
      () => getTeamInstance(''),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('impact_analysis'), 'Should list available IDs');
        return true;
      }
    );
  });
});

// ---------------------------------------------------------------------------
// listTeamInstances
// ---------------------------------------------------------------------------

describe('Instance Registry: listTeamInstances()', () => {
  // IR-07: Returns array of all 7 instance IDs (REQ-0098 FR-004 AC-004-02)
  it('IR-07: returns array of all 7 instance IDs', () => {
    const ids = listTeamInstances();
    assert.ok(Array.isArray(ids), 'Should return an array');
    assert.equal(ids.length, 7, 'Should have 7 instances');
    assert.ok(ids.includes('impact_analysis'));
    assert.ok(ids.includes('tracing'));
    assert.ok(ids.includes('quality_loop'));
    assert.ok(ids.includes('debate_requirements'));
    assert.ok(ids.includes('debate_architecture'));
    assert.ok(ids.includes('debate_design'));
    assert.ok(ids.includes('debate_test_strategy'));
  });
});

// ---------------------------------------------------------------------------
// getTeamInstancesByPhase
// ---------------------------------------------------------------------------

describe('Instance Registry: getTeamInstancesByPhase()', () => {
  // IR-08: Phase '01-requirements' returns impact_analysis, tracing, and debate_requirements (REQ-0098 FR-004 AC-004-03)
  it('IR-08: phase 01-requirements returns impact_analysis, tracing, and debate_requirements', () => {
    const instances = getTeamInstancesByPhase('01-requirements');
    assert.ok(Array.isArray(instances));
    const ids = instances.map(i => i.instance_id);
    assert.ok(ids.includes('impact_analysis'), 'Should include impact_analysis');
    assert.ok(ids.includes('tracing'), 'Should include tracing');
    assert.ok(ids.includes('debate_requirements'), 'Should include debate_requirements');
  });

  // IR-09: Phase '06-implementation' returns quality_loop instance
  it('IR-09: phase 06-implementation returns quality_loop', () => {
    const instances = getTeamInstancesByPhase('06-implementation');
    assert.ok(Array.isArray(instances));
    assert.equal(instances.length, 1);
    assert.equal(instances[0].instance_id, 'quality_loop');
  });

  // IR-10: Unknown phase returns empty array
  it('IR-10: unknown phase returns empty array', () => {
    const instances = getTeamInstancesByPhase('99-nonexistent');
    assert.ok(Array.isArray(instances));
    assert.equal(instances.length, 0);
  });
});

// ---------------------------------------------------------------------------
// REQ-0098: Debate Instance Lookups (Positive)
// ---------------------------------------------------------------------------

describe('Instance Registry: getTeamInstance() debate instances (REQ-0098 FR-004)', () => {
  // IR-12: getTeamInstance('debate_requirements') returns correct frozen config
  it('IR-12: returns correct frozen config for debate_requirements (AC-004-01)', () => {
    const instance = getTeamInstance('debate_requirements');
    assert.equal(instance.instance_id, 'debate_requirements');
    assert.equal(instance.team_type, 'debate');
    assert.ok(Object.isFrozen(instance));
  });

  // IR-13: getTeamInstance('debate_architecture') returns correct frozen config
  it('IR-13: returns correct frozen config for debate_architecture (AC-004-01)', () => {
    const instance = getTeamInstance('debate_architecture');
    assert.equal(instance.instance_id, 'debate_architecture');
    assert.equal(instance.team_type, 'debate');
    assert.ok(Object.isFrozen(instance));
  });

  // IR-14: getTeamInstance('debate_design') returns correct frozen config
  it('IR-14: returns correct frozen config for debate_design (AC-004-01)', () => {
    const instance = getTeamInstance('debate_design');
    assert.equal(instance.instance_id, 'debate_design');
    assert.equal(instance.team_type, 'debate');
    assert.ok(Object.isFrozen(instance));
  });

  // IR-15: getTeamInstance('debate_test_strategy') returns correct frozen config
  it('IR-15: returns correct frozen config for debate_test_strategy (AC-004-01)', () => {
    const instance = getTeamInstance('debate_test_strategy');
    assert.equal(instance.instance_id, 'debate_test_strategy');
    assert.equal(instance.team_type, 'debate');
    assert.ok(Object.isFrozen(instance));
  });
});

// ---------------------------------------------------------------------------
// REQ-0098: Phase Queries for Debate Instances
// ---------------------------------------------------------------------------

describe('Instance Registry: getTeamInstancesByPhase() debate phases (REQ-0098 FR-004)', () => {
  // IR-16: Phase '03-architecture' returns debate_architecture
  it('IR-16: phase 03-architecture returns debate_architecture (AC-004-03)', () => {
    const instances = getTeamInstancesByPhase('03-architecture');
    assert.ok(Array.isArray(instances));
    const ids = instances.map(i => i.instance_id);
    assert.ok(ids.includes('debate_architecture'), 'Should include debate_architecture');
  });

  // IR-17: Phase '04-design' returns debate_design
  it('IR-17: phase 04-design returns debate_design (AC-004-03)', () => {
    const instances = getTeamInstancesByPhase('04-design');
    assert.ok(Array.isArray(instances));
    const ids = instances.map(i => i.instance_id);
    assert.ok(ids.includes('debate_design'), 'Should include debate_design');
  });

  // IR-18: Phase '05-test-strategy' returns debate_test_strategy
  it('IR-18: phase 05-test-strategy returns debate_test_strategy (AC-004-03)', () => {
    const instances = getTeamInstancesByPhase('05-test-strategy');
    assert.ok(Array.isArray(instances));
    const ids = instances.map(i => i.instance_id);
    assert.ok(ids.includes('debate_test_strategy'), 'Should include debate_test_strategy');
  });
});

// ---------------------------------------------------------------------------
// Registry-to-Instance Roundtrip (Integration)
// ---------------------------------------------------------------------------

describe('INT-001: Registry-to-Instance roundtrip', () => {
  // IR-11: Registry returns same frozen object references as direct imports
  it('IR-11: registry returns same frozen objects as direct imports', () => {
    assert.equal(getTeamInstance('impact_analysis'), impactAnalysisInstance,
      'Should be the exact same object reference');
    assert.equal(getTeamInstance('tracing'), tracingInstance,
      'Should be the exact same object reference');
    assert.equal(getTeamInstance('quality_loop'), qualityLoopInstance,
      'Should be the exact same object reference');
  });

  // IR-19: Debate registry returns same frozen objects as direct imports
  it('IR-19: debate registry returns same frozen objects as direct imports (REQ-0098)', () => {
    assert.equal(getTeamInstance('debate_requirements'), debateRequirementsInstance,
      'Should be the exact same object reference');
    assert.equal(getTeamInstance('debate_architecture'), debateArchitectureInstance,
      'Should be the exact same object reference');
    assert.equal(getTeamInstance('debate_design'), debateDesignInstance,
      'Should be the exact same object reference');
    assert.equal(getTeamInstance('debate_test_strategy'), debateTestStrategyInstance,
      'Should be the exact same object reference');
  });
});
