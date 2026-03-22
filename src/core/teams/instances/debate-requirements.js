/**
 * Team instance config: debate_requirements
 *
 * Debate pattern (Creator->Critic->Refiner) for Requirements phase.
 * Pure data, no runtime logic. Provider-neutral instance config.
 *
 * Requirements: REQ-0098 FR-001 (AC-001-01), FR-002 (AC-002-01),
 *               FR-003 (AC-003-01..02), FR-005 (AC-005-01)
 * @module src/core/teams/instances/debate-requirements
 */

export const debateRequirementsInstance = Object.freeze({
  instance_id: 'debate_requirements',
  team_type: 'debate',
  phase: '01-requirements',
  members: Object.freeze([
    Object.freeze({ role: 'creator', agent: 'requirements-analyst' }),
    Object.freeze({ role: 'critic', agent: 'requirements-critic' }),
    Object.freeze({ role: 'refiner', agent: 'requirements-refiner' })
  ]),
  output_artifact: 'requirements-spec.md',
  input_dependency: null,
  max_rounds: 3
});
