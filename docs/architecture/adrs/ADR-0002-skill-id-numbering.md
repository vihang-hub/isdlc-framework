# ADR-0002: Skill ID Numbering for M4 (IA-4xx Series)

## Status

Accepted

## Context

The skills-manifest.json uses a hierarchical numbering scheme for Impact Analysis skills:

- Orchestrator (IA0): IA-001, IA-002, IA-003
- M1 Impact Analyzer (IA1): IA-101, IA-102, IA-103, IA-104
- M2 Entry Point Finder (IA2): IA-201, IA-202, IA-203, IA-204
- M3 Risk Assessor (IA3): IA-301, IA-302, IA-303, IA-304

The new M4 Cross-Validation Verifier agent needs skill IDs registered in the manifest.

**Requirement references**: FR-07 (AC-07.1, AC-07.3)

## Decision

Use the **IA-4xx** series for M4 skills, with agent_id **IA4**:

- IA-401: cross-validation-execution
- IA-402: finding-categorization

## Rationale

1. **Sequential convention**: M4 logically follows M3 (IA-3xx), so IA-4xx is the natural next range.
2. **Agent-ID consistency**: The agent_id follows IA0, IA1, IA2, IA3 -> IA4.
3. **Avoids conflicts**: IA-004 would fall in the orchestrator range (IA-0xx). IA-4xx is a clean namespace.
4. **Two skills sufficient**: M4 has two distinct capabilities: (a) executing cross-validation checks, (b) categorizing findings by severity. This matches the granularity of M1/M2/M3 skills (3-4 skills each).

## Consequences

**Positive:**
- Clean, predictable numbering
- Easy for skill-validator to map IA-4xx to cross-validation-verifier agent
- Room for expansion (IA-403, IA-404) if M4 gains capabilities

**Negative:**
- If a future M5 agent is added, it would use IA-5xx (still clean)
- The IA-0xx orchestrator range could be expanded to include IA-004 for a new orchestrator skill, but this is unlikely

## Alternatives Considered

1. **IA-004**: Would place M4 skills in the orchestrator range. Semantically incorrect since M4 is a sub-agent, not the orchestrator.
2. **IA-501+**: Skipping IA-4xx would break the M-number to hundreds-digit mapping convention.
3. **CV-001, CV-002**: New prefix. Would diverge from the IA- prefix used by all other impact analysis skills and complicate manifest parsing.
