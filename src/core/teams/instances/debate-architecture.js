/**
 * Team instance config: debate_architecture
 *
 * Debate pattern (Creator->Critic->Refiner) for Architecture phase.
 * Pure data, no runtime logic. Provider-neutral instance config.
 *
 * Requirements: REQ-0098 FR-001 (AC-001-02), FR-002 (AC-002-01),
 *               FR-003 (AC-003-01..02), FR-005 (AC-005-01)
 * @module src/core/teams/instances/debate-architecture
 */

export const debateArchitectureInstance = Object.freeze({
  instance_id: 'debate_architecture',
  team_type: 'debate',
  phase: '03-architecture',
  members: Object.freeze([
    Object.freeze({ role: 'creator', agent: 'solution-architect' }),
    Object.freeze({ role: 'critic', agent: 'architecture-critic' }),
    Object.freeze({ role: 'refiner', agent: 'architecture-refiner' })
  ]),
  output_artifact: 'architecture-overview.md',
  input_dependency: '01-requirements',
  max_rounds: 3
});
