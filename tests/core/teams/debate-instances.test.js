/**
 * Unit tests for src/core/teams/instances/debate-*.js -- Debate Team Instance Configs
 *
 * Tests frozen instance configs for 4 debate instances:
 * debate_requirements, debate_architecture, debate_design, debate_test_strategy.
 *
 * Requirements: REQ-0098 FR-001 (AC-001-01..04), FR-002 (AC-002-01),
 *               FR-003 (AC-003-01..02), FR-005 (AC-005-01)
 *
 * Test ID prefix: DI- (Debate Instance)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { debateRequirementsInstance } from '../../../src/core/teams/instances/debate-requirements.js';
import { debateArchitectureInstance } from '../../../src/core/teams/instances/debate-architecture.js';
import { debateDesignInstance } from '../../../src/core/teams/instances/debate-design.js';
import { debateTestStrategyInstance } from '../../../src/core/teams/instances/debate-test-strategy.js';

// ===========================================================================
// REQ-0098: Debate Requirements Instance
// ===========================================================================

describe('REQ-0098 FR-001: debate_requirements Instance Config', () => {
  // DI-01: instance_id is 'debate_requirements'
  it('DI-01: instance_id is debate_requirements (AC-001-01)', () => {
    assert.equal(debateRequirementsInstance.instance_id, 'debate_requirements');
  });

  // DI-05: team_type is 'debate'
  it('DI-05: team_type is debate (AC-002-01)', () => {
    assert.equal(debateRequirementsInstance.team_type, 'debate');
  });

  // DI-09: members has creator, critic, refiner with correct agents
  it('DI-09: members has creator=requirements-analyst, critic=requirements-critic, refiner=requirements-refiner (AC-001-01)', () => {
    const members = debateRequirementsInstance.members;
    assert.equal(members.length, 3);
    assert.equal(members[0].role, 'creator');
    assert.equal(members[0].agent, 'requirements-analyst');
    assert.equal(members[1].role, 'critic');
    assert.equal(members[1].agent, 'requirements-critic');
    assert.equal(members[2].role, 'refiner');
    assert.equal(members[2].agent, 'requirements-refiner');
  });

  // DI-13: output_artifact, input_dependency, max_rounds, phase
  it('DI-13: output_artifact=requirements-spec.md, input_dependency=null, max_rounds=3, phase=01-requirements (AC-003-01..02)', () => {
    assert.equal(debateRequirementsInstance.output_artifact, 'requirements-spec.md');
    assert.equal(debateRequirementsInstance.input_dependency, null);
    assert.equal(debateRequirementsInstance.max_rounds, 3);
    assert.equal(debateRequirementsInstance.phase, '01-requirements');
  });

  // DI-17: frozen
  it('DI-17: instance is frozen (AC-005-01)', () => {
    assert.ok(Object.isFrozen(debateRequirementsInstance));
  });
});

// ===========================================================================
// REQ-0098: Debate Architecture Instance
// ===========================================================================

describe('REQ-0098 FR-001: debate_architecture Instance Config', () => {
  // DI-02: instance_id is 'debate_architecture'
  it('DI-02: instance_id is debate_architecture (AC-001-02)', () => {
    assert.equal(debateArchitectureInstance.instance_id, 'debate_architecture');
  });

  // DI-06: team_type is 'debate'
  it('DI-06: team_type is debate (AC-002-01)', () => {
    assert.equal(debateArchitectureInstance.team_type, 'debate');
  });

  // DI-10: members has creator, critic, refiner with correct agents
  it('DI-10: members has creator=solution-architect, critic=architecture-critic, refiner=architecture-refiner (AC-001-02)', () => {
    const members = debateArchitectureInstance.members;
    assert.equal(members.length, 3);
    assert.equal(members[0].role, 'creator');
    assert.equal(members[0].agent, 'solution-architect');
    assert.equal(members[1].role, 'critic');
    assert.equal(members[1].agent, 'architecture-critic');
    assert.equal(members[2].role, 'refiner');
    assert.equal(members[2].agent, 'architecture-refiner');
  });

  // DI-14: output_artifact, input_dependency, max_rounds, phase
  it('DI-14: output_artifact=architecture-overview.md, input_dependency=01-requirements, max_rounds=3, phase=03-architecture (AC-003-01..02)', () => {
    assert.equal(debateArchitectureInstance.output_artifact, 'architecture-overview.md');
    assert.equal(debateArchitectureInstance.input_dependency, '01-requirements');
    assert.equal(debateArchitectureInstance.max_rounds, 3);
    assert.equal(debateArchitectureInstance.phase, '03-architecture');
  });

  // DI-18: frozen
  it('DI-18: instance is frozen (AC-005-01)', () => {
    assert.ok(Object.isFrozen(debateArchitectureInstance));
  });
});

// ===========================================================================
// REQ-0098: Debate Design Instance
// ===========================================================================

describe('REQ-0098 FR-001: debate_design Instance Config', () => {
  // DI-03: instance_id is 'debate_design'
  it('DI-03: instance_id is debate_design (AC-001-03)', () => {
    assert.equal(debateDesignInstance.instance_id, 'debate_design');
  });

  // DI-07: team_type is 'debate'
  it('DI-07: team_type is debate (AC-002-01)', () => {
    assert.equal(debateDesignInstance.team_type, 'debate');
  });

  // DI-11: members has creator, critic, refiner with correct agents
  it('DI-11: members has creator=system-designer, critic=design-critic, refiner=design-refiner (AC-001-03)', () => {
    const members = debateDesignInstance.members;
    assert.equal(members.length, 3);
    assert.equal(members[0].role, 'creator');
    assert.equal(members[0].agent, 'system-designer');
    assert.equal(members[1].role, 'critic');
    assert.equal(members[1].agent, 'design-critic');
    assert.equal(members[2].role, 'refiner');
    assert.equal(members[2].agent, 'design-refiner');
  });

  // DI-15: output_artifact, input_dependency, max_rounds, phase
  it('DI-15: output_artifact=module-design.md, input_dependency=03-architecture, max_rounds=3, phase=04-design (AC-003-01..02)', () => {
    assert.equal(debateDesignInstance.output_artifact, 'module-design.md');
    assert.equal(debateDesignInstance.input_dependency, '03-architecture');
    assert.equal(debateDesignInstance.max_rounds, 3);
    assert.equal(debateDesignInstance.phase, '04-design');
  });

  // DI-19: frozen
  it('DI-19: instance is frozen (AC-005-01)', () => {
    assert.ok(Object.isFrozen(debateDesignInstance));
  });
});

// ===========================================================================
// REQ-0098: Debate Test Strategy Instance
// ===========================================================================

describe('REQ-0098 FR-001: debate_test_strategy Instance Config', () => {
  // DI-04: instance_id is 'debate_test_strategy'
  it('DI-04: instance_id is debate_test_strategy (AC-001-04)', () => {
    assert.equal(debateTestStrategyInstance.instance_id, 'debate_test_strategy');
  });

  // DI-08: team_type is 'debate'
  it('DI-08: team_type is debate (AC-002-01)', () => {
    assert.equal(debateTestStrategyInstance.team_type, 'debate');
  });

  // DI-12: members has creator, critic, refiner with correct agents
  it('DI-12: members has creator=test-design-engineer, critic=test-strategy-critic, refiner=test-strategy-refiner (AC-001-04)', () => {
    const members = debateTestStrategyInstance.members;
    assert.equal(members.length, 3);
    assert.equal(members[0].role, 'creator');
    assert.equal(members[0].agent, 'test-design-engineer');
    assert.equal(members[1].role, 'critic');
    assert.equal(members[1].agent, 'test-strategy-critic');
    assert.equal(members[2].role, 'refiner');
    assert.equal(members[2].agent, 'test-strategy-refiner');
  });

  // DI-16: output_artifact, input_dependency, max_rounds, phase
  it('DI-16: output_artifact=test-strategy.md, input_dependency=04-design, max_rounds=3, phase=05-test-strategy (AC-003-01..02)', () => {
    assert.equal(debateTestStrategyInstance.output_artifact, 'test-strategy.md');
    assert.equal(debateTestStrategyInstance.input_dependency, '04-design');
    assert.equal(debateTestStrategyInstance.max_rounds, 3);
    assert.equal(debateTestStrategyInstance.phase, '05-test-strategy');
  });

  // DI-20: frozen
  it('DI-20: instance is frozen (AC-005-01)', () => {
    assert.ok(Object.isFrozen(debateTestStrategyInstance));
  });
});

// ===========================================================================
// Cross-Instance: Mutation Rejection (Negative)
// ===========================================================================

describe('REQ-0098 FR-005: Debate Instance Mutation Rejection', () => {
  // DI-21: Mutating a frozen property throws TypeError
  it('DI-21: mutation of frozen property throws TypeError (AC-005-01)', () => {
    assert.throws(
      () => { debateRequirementsInstance.instance_id = 'hacked'; },
      TypeError,
      'Should throw TypeError when mutating frozen property'
    );
  });
});
