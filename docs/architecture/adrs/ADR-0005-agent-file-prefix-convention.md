# ADR-0005: Agent File Prefix Convention for Phase 05 Debate Team

## Status

Accepted

## Context

The iSDLC framework uses a numeric prefix convention for agent filenames: `{NN}-{role}.md`. The existing debate teams follow a pattern where Critic and Refiner agents share the same numeric prefix as their Creator agent:

| Phase Key | Creator File | Critic File | Refiner File | File Prefix |
|-----------|-------------|-------------|--------------|-------------|
| 01-requirements | 01-requirements-analyst.md | 01-requirements-critic.md | 01-requirements-refiner.md | `01-` |
| 03-architecture | 02-solution-architect.md | 02-architecture-critic.md | 02-architecture-refiner.md | `02-` |
| 04-design | 03-system-designer.md | 03-design-critic.md | 03-design-refiner.md | `03-` |

The existing test-design-engineer uses the `04-` prefix (`04-test-design-engineer.md`). The question is what prefix the new Critic and Refiner agents should use for Phase 05 (test-strategy).

**Requirement references**: FR-01 (AC-01.1), FR-03 (AC-03.1), C-01, NFR-01

## Decision

Use the **`04-` prefix** for both new agents:

- `04-test-strategy-critic.md`
- `04-test-strategy-refiner.md`

This matches the Creator agent's prefix (`04-test-design-engineer.md`).

## Rationale

1. **Consistency (NFR-01)**: All existing debate teams use the same prefix for Creator/Critic/Refiner. Breaking this pattern for Phase 05 would create an inconsistency.

2. **Convention primacy (C-01)**: The constraint explicitly states: "New agent files MUST follow the `{NN}-{role}.md` convention where `{NN}` is the phase number prefix (`04` for test strategy phase agents)."

3. **Phase-to-prefix mapping is NOT 1:1**: The prefix does not equal the phase number. The mapping is:
   - Prefix `00-` = orchestrator (all phases)
   - Prefix `01-` = Phase 01 (requirements)
   - Prefix `02-` = Phase 03 (architecture)
   - Prefix `03-` = Phase 04 (design)
   - Prefix `04-` = Phase 05 (test strategy)
   - Prefix `05-` = Phase 06 (implementation)

   This offset exists because the orchestrator occupies prefix `00-` and subsequent prefixes track agent order, not phase order. The new agents follow this existing convention.

4. **Simplicity (Article V)**: Introducing a `05-` prefix for "Phase 05" would seem more intuitive but would break the established convention and conflict with the Phase 06 implementation agents already at `05-`.

## Consequences

**Positive:**
- Consistent with all 3 existing debate teams
- No ambiguity -- the prefix matches the Creator
- Easy for developers to locate related agents by prefix

**Negative:**
- The prefix `04-` does not directly correspond to Phase `05-test-strategy` (non-obvious mapping)
- New contributors may need to reference the prefix-to-phase mapping table

## Alternatives Considered

1. **`05-` prefix**: Would align prefix with phase number but conflicts with existing `05-software-developer.md`, `05-implementation-reviewer.md`, and `05-implementation-updater.md`. Would break the "debate team shares Creator prefix" convention.

2. **`04b-` or `04.1-` prefix**: Would disambiguate but introduces a non-standard prefix format. No existing agents use sub-prefixes. Violates KISS.
