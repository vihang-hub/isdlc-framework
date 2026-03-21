/**
 * Tests for src/core/validators/gate-logic.js
 * REQ-0081: Extract ValidatorEngine
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  mergeRequirements,
  isGateAdvancementAttempt,
  checkTestIterationRequirement,
  checkConstitutionalRequirement,
  checkElicitationRequirement,
  checkAgentDelegationRequirement,
  checkArtifactPresenceRequirement,
  resolveArtifactPaths,
  check
} from '../../../src/core/validators/gate-logic.js';

describe('mergeRequirements', () => {
  it('returns overrides when base is null', () => {
    assert.deepStrictEqual(mergeRequirements(null, { a: 1 }), { a: 1 });
  });

  it('returns base when overrides is null', () => {
    assert.deepStrictEqual(mergeRequirements({ a: 1 }, null), { a: 1 });
  });

  it('deep merges nested objects', () => {
    const base = { a: { b: 1, c: 2 } };
    const overrides = { a: { c: 3, d: 4 } };
    const result = mergeRequirements(base, overrides);
    assert.deepStrictEqual(result, { a: { b: 1, c: 3, d: 4 } });
  });

  it('replaces arrays (does not merge them)', () => {
    const base = { a: [1, 2] };
    const overrides = { a: [3, 4] };
    assert.deepStrictEqual(mergeRequirements(base, overrides), { a: [3, 4] });
  });

  it('does not mutate original objects', () => {
    const base = { a: { b: 1 } };
    const overrides = { a: { c: 2 } };
    mergeRequirements(base, overrides);
    assert.deepStrictEqual(base, { a: { b: 1 } });
  });
});

describe('isGateAdvancementAttempt', () => {
  it('returns false for non-Task/Skill tools', () => {
    assert.strictEqual(isGateAdvancementAttempt({ tool_name: 'Bash' }), false);
  });

  it('returns false for Task with setup keywords', () => {
    assert.strictEqual(isGateAdvancementAttempt({
      tool_name: 'Task',
      tool_input: { prompt: 'discover the project', subagent_type: 'orchestrator' }
    }), false);
  });

  it('returns true for Task with gate advancement keywords', () => {
    assert.strictEqual(isGateAdvancementAttempt({
      tool_name: 'Task',
      tool_input: { prompt: 'advance to next phase', subagent_type: 'sdlc-orchestrator' }
    }), true);
  });

  it('returns false for Skill with exempt action', () => {
    assert.strictEqual(isGateAdvancementAttempt({
      tool_name: 'Skill',
      tool_input: { skill: 'isdlc', args: 'analyze "something"' }
    }), false);
  });

  it('returns true for Skill with gate advancement', () => {
    assert.strictEqual(isGateAdvancementAttempt({
      tool_name: 'Skill',
      tool_input: { skill: 'isdlc', args: 'advance gate' }
    }), true);
  });

  it('returns false for Skill with setup keyword', () => {
    assert.strictEqual(isGateAdvancementAttempt({
      tool_name: 'Skill',
      tool_input: { skill: 'isdlc', args: 'discover' }
    }), false);
  });
});

describe('checkTestIterationRequirement', () => {
  it('returns satisfied when not required', () => {
    const result = checkTestIterationRequirement({}, {});
    assert.strictEqual(result.satisfied, true);
  });

  it('returns not satisfied when not started', () => {
    const result = checkTestIterationRequirement({}, { test_iteration: { enabled: true } });
    assert.strictEqual(result.satisfied, false);
    assert.strictEqual(result.action_required, 'RUN_TESTS');
  });

  it('returns not satisfied when incomplete with failure', () => {
    const phaseState = {
      iteration_requirements: {
        test_iteration: { completed: false, last_test_result: 'failed', current_iteration: 2, max_iterations: 10 }
      }
    };
    const result = checkTestIterationRequirement(phaseState, { test_iteration: { enabled: true } });
    assert.strictEqual(result.satisfied, false);
    assert.strictEqual(result.action_required, 'CONTINUE_ITERATION');
  });

  it('returns satisfied when escalation approved', () => {
    const phaseState = {
      iteration_requirements: {
        test_iteration: { completed: true, status: 'escalated', escalation_approved: true }
      }
    };
    const result = checkTestIterationRequirement(phaseState, { test_iteration: { enabled: true } });
    assert.strictEqual(result.satisfied, true);
  });

  it('returns satisfied when tests passing', () => {
    const phaseState = {
      iteration_requirements: {
        test_iteration: { completed: true, status: 'passing' }
      }
    };
    const result = checkTestIterationRequirement(phaseState, { test_iteration: { enabled: true } });
    assert.strictEqual(result.satisfied, true);
  });
});

describe('checkConstitutionalRequirement', () => {
  it('returns satisfied when not required', () => {
    assert.strictEqual(checkConstitutionalRequirement({}, {}).satisfied, true);
  });

  it('returns not satisfied when not started', () => {
    const result = checkConstitutionalRequirement({}, { constitutional_validation: { enabled: true } });
    assert.strictEqual(result.satisfied, false);
  });

  it('returns not satisfied when non-compliant', () => {
    const result = checkConstitutionalRequirement(
      { constitutional_validation: { completed: true, status: 'non_compliant' } },
      { constitutional_validation: { enabled: true } }
    );
    assert.strictEqual(result.satisfied, false);
    assert.strictEqual(result.action_required, 'FIX_VIOLATIONS');
  });

  it('returns satisfied when compliant', () => {
    const result = checkConstitutionalRequirement(
      { constitutional_validation: { completed: true, status: 'compliant' } },
      { constitutional_validation: { enabled: true } }
    );
    assert.strictEqual(result.satisfied, true);
  });
});

describe('checkElicitationRequirement', () => {
  it('returns satisfied when not required', () => {
    assert.strictEqual(checkElicitationRequirement({}, {}).satisfied, true);
  });

  it('returns not satisfied when not started', () => {
    const result = checkElicitationRequirement({}, { interactive_elicitation: { enabled: true } });
    assert.strictEqual(result.satisfied, false);
  });

  it('returns satisfied when complete', () => {
    const phaseState = {
      iteration_requirements: {
        interactive_elicitation: { completed: true }
      }
    };
    const result = checkElicitationRequirement(phaseState, { interactive_elicitation: { enabled: true } });
    assert.strictEqual(result.satisfied, true);
  });
});

describe('checkAgentDelegationRequirement', () => {
  it('returns satisfied when not required', () => {
    assert.strictEqual(checkAgentDelegationRequirement({}, {}, {}, '06-implementation').satisfied, true);
  });

  it('returns satisfied when no manifest', () => {
    const result = checkAgentDelegationRequirement(
      {}, { agent_delegation_validation: { enabled: true } }, {}, '06-implementation'
    );
    assert.strictEqual(result.satisfied, true);
  });

  it('detects missing agent delegation', () => {
    const manifest = { ownership: { 'dev-agent': { phase: '06-implementation' } } };
    const result = checkAgentDelegationRequirement(
      {}, { agent_delegation_validation: { enabled: true } },
      { skill_usage_log: [] }, '06-implementation', manifest
    );
    assert.strictEqual(result.satisfied, false);
    assert.strictEqual(result.expected_agent, 'dev-agent');
  });
});

describe('resolveArtifactPaths', () => {
  it('replaces artifact_folder placeholder', () => {
    const result = resolveArtifactPaths(
      ['docs/requirements/{artifact_folder}/spec.md'],
      { active_workflow: { artifact_folder: 'REQ-0081' } }
    );
    assert.deepStrictEqual(result, ['docs/requirements/REQ-0081/spec.md']);
  });

  it('replaces with empty string when artifact_folder is undefined', () => {
    const result = resolveArtifactPaths(
      ['docs/requirements/{artifact_folder}/spec.md'],
      {}
    );
    // When artifact_folder is undefined, placeholder is replaced with empty string
    assert.deepStrictEqual(result, ['docs/requirements//spec.md']);
  });
});

describe('check (main gate check)', () => {
  it('allows when no input', () => {
    assert.strictEqual(check({}).decision, 'allow');
  });

  it('allows when enforcement disabled', () => {
    const result = check({
      input: { tool_name: 'Bash' },
      state: { iteration_enforcement: { enabled: false } }
    });
    assert.strictEqual(result.decision, 'allow');
  });

  it('allows when not a gate advancement attempt', () => {
    const result = check({
      input: { tool_name: 'Bash', tool_input: {} },
      state: { current_phase: '06-implementation' }
    });
    assert.strictEqual(result.decision, 'allow');
  });
});
