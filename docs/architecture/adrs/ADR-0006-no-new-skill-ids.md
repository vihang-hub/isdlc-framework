# ADR-0006: No New Skill IDs for Phase 05 Debate Team

## Status

Accepted

## Context

The skills-manifest.json tracks agent-to-skill mappings for observability. The test-design-engineer (Creator for Phase 05) owns 9 skills:

- TEST-001 (test-strategy)
- TEST-002 (test-case-design)
- TEST-003 (test-data)
- TEST-004 (traceability-management)
- TEST-005 (prioritization)
- TEST-014 (atdd-scenario-mapping)
- TEST-015 (atdd-fixture-generation)
- TEST-016 (atdd-checklist)
- TEST-017 (atdd-priority-tagging)

The new Critic and Refiner agents need skill assignments for the skill-validator observability hook. The question is whether to create new skill IDs (e.g., TS-401, TS-402) or share existing TEST-* skills.

**Requirement references**: FR-06 (AC-06.1 through AC-06.4), C-02, NFR-01

## Decision

**No new skill IDs.** The Critic and Refiner agents share subsets of the Creator's existing TEST-* skills:

- **Critic** shares: TEST-002 (test-case-design), TEST-004 (traceability-management), TEST-005 (prioritization)
- **Refiner** shares: TEST-001 (test-strategy), TEST-002 (test-case-design), TEST-003 (test-data), TEST-004 (traceability-management), TEST-005 (prioritization)

The `primary_owner` in the `skill_owners` map remains `test-design-engineer` for all TEST-* skills. The `total_skills` count in the manifest remains unchanged.

## Rationale

1. **Constraint (C-02)**: "The Critic and Refiner agents share existing TEST-* skill IDs from the test-design-engineer. No new skill IDs should be created."

2. **Established pattern**: The design-critic shares DES-002, DES-006, DES-009 from the system-designer. The design-refiner shares DES-002, DES-001, DES-006, DES-009, DES-005. The architecture-critic shares ARCH-006, ARCH-003, ARCH-009. All critic/refiner agents share Creator skills without creating new IDs.

3. **Observability is sufficient**: The skill-validator hook logs which agent used which skill. Since the agent name is logged, it is clear whether the Creator, Critic, or Refiner invoked a TEST-* skill. New IDs would add no observability value.

4. **Simplicity (Article V)**: Fewer skill IDs means simpler manifest, simpler validation, simpler documentation.

## Consequences

**Positive:**
- total_skills count unchanged (no manifest audit needed)
- skill_owners map unchanged (no primary_owner conflicts)
- Consistent with all existing debate teams

**Negative:**
- Cannot distinguish Critic-specific vs. Refiner-specific skill usage from the skill ID alone (must check agent name in log)
- If a future Critic needs a truly unique capability (not shared with Creator), a new skill ID would be needed then

## Alternatives Considered

1. **TS-401, TS-402 (new Critic skills)**: Would create unique IDs for Critic-specific analysis capabilities. Rejected because C-02 explicitly prohibits new IDs, and the pattern from other debate teams shares existing skills.

2. **TC-* prefix (Test Critic skills)**: Would mirror the TC-01..TC-08 check IDs. Rejected because check IDs (TC-01..TC-08) are domain-level categories, not skills-manifest entries. Conflating them would be confusing.
