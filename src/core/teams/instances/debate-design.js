/**
 * Team instance config: debate_design
 *
 * Debate pattern (Creator->Critic->Refiner) for Design phase.
 * Pure data, no runtime logic. Provider-neutral instance config.
 *
 * Requirements: REQ-0098 FR-001 (AC-001-03), FR-002 (AC-002-01),
 *               FR-003 (AC-003-01..02), FR-005 (AC-005-01)
 * @module src/core/teams/instances/debate-design
 */

export const debateDesignInstance = Object.freeze({
  instance_id: 'debate_design',
  team_type: 'debate',
  phase: '04-design',
  members: Object.freeze([
    Object.freeze({ role: 'creator', agent: 'system-designer' }),
    Object.freeze({ role: 'critic', agent: 'design-critic' }),
    Object.freeze({ role: 'refiner', agent: 'design-refiner' })
  ]),
  output_artifact: 'module-design.md',
  input_dependency: '03-architecture',
  max_rounds: 3
});
