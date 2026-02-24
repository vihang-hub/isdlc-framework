# ADR-0007: Skills Manifest Registration Scope for Debate Team Agents

## Status

Accepted

## Context

The requirements (FR-06) explicitly require adding the Phase 05 test-strategy-critic and test-strategy-refiner to the skills-manifest.json agents section. However, the existing 6 critic/refiner agents from Phases 01, 03, and 04 are NOT currently registered in the manifest:

- `requirements-critic` (Phase 01) -- NOT in manifest
- `requirements-refiner` (Phase 01) -- NOT in manifest
- `architecture-critic` (Phase 03) -- NOT in manifest
- `architecture-refiner` (Phase 03) -- NOT in manifest
- `design-critic` (Phase 04) -- NOT in manifest
- `design-refiner` (Phase 04) -- NOT in manifest

Adding the Phase 05 critic/refiner while leaving the others unregistered creates a consistency divergence. The question is whether to register only the Phase 05 agents (per requirements) or retroactively register all 8 agents (6 existing + 2 new) for consistency.

**Requirement references**: FR-06 (AC-06.1, AC-06.2), NFR-01 (Consistency)

## Decision

**Add only the Phase 05 agents** (test-strategy-critic and test-strategy-refiner) per the requirements specification. Defer retroactive registration of existing critic/refiner agents to a separate backlog item.

## Rationale

1. **Specification Primacy (Article I)**: The requirements spec explicitly lists the Phase 05 agents and their skill assignments. It does not mention modifying entries for Phase 01, 03, or 04 agents. Implementing beyond what is specified would violate Article I.

2. **Scope control**: Retroactively registering 6 additional agents is a change that affects the skills-manifest.json structure, potentially impacts skill-validator tests, and should be analyzed for its own blast radius. Bundling it into REQ-0016 increases scope and risk.

3. **Forward-looking precedent**: By registering the Phase 05 agents, this establishes a precedent. Future debate team additions will also register their agents. The existing gap is technical debt, not a design flaw.

4. **Minimal blast radius (Article V)**: Adding 2 agent entries is a smaller, safer change than adding 8. The incremental approach reduces risk.

## Consequences

**Positive:**
- Strict adherence to requirements specification
- Minimal scope and risk
- Establishes forward-looking precedent for manifest registration
- Does not modify any existing manifest entries

**Negative:**
- Inconsistency: Phase 05 critic/refiner are registered, Phases 01/03/04 are not
- The skill-validator observability hook cannot track skill usage for unregistered agents
- Future maintainers may be confused by the selective registration

## Remediation Plan

Create a backlog item: "Register all existing debate team agents in skills-manifest.json (Phase 01, 03, 04 critic/refiner agents)" with LOW priority. This is a documentation/observability improvement, not a functional requirement.

## Alternatives Considered

1. **Register all 8 agents now**: Would achieve full consistency but expands scope beyond requirements. Adds 6 manifest entries that were not requested and have not been impact-analyzed.

2. **Skip Phase 05 registration entirely**: Would maintain consistency (no critic/refiner in manifest) but directly violates FR-06.

3. **Register all but mark existing as "backfill"**: Would achieve consistency with a metadata flag. Adds unnecessary complexity to the manifest schema.
