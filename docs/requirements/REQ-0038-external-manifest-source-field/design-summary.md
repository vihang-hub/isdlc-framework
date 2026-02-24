# Design Summary: REQ-0038 External Manifest Source Field

**Accepted**: 2026-02-24
**Domain**: Design
**Owner**: Jordan Park (System Designer)

---

## Module Responsibilities

- Single new function `reconcileSkillsBySource()` in common.cjs (~60-80 lines)
- Pure function: manifest object in, updated manifest object out, no disk I/O
- Callers responsible for load before and write after

## Field Ownership

| Field | Owner | Reconciliation Behavior |
|-------|-------|------------------------|
| name | source | Match key |
| file | source | Updated |
| source | source | Immutable after creation |
| description | source | Updated |
| added_at | user | Set once, never modified |
| updated_at | source | Updated on each reconciliation |
| sourcePhase | source | Set on creation, used for phase-gated removal |
| bindings | user | Preserved across reconciliation |

## Interface Contract

- Signature: `reconcileSkillsBySource(manifest, source, incomingSkills, phasesExecuted)`
- Return: `{ manifest, changed, added[], removed[], updated[] }`
- 6 worked examples covering all reconciliation paths
- 4 error conditions with safe defaults (never throws)

## Data Flow

- Discover: load -> reconcile("discover") -> conditional write -> conditional cache rebuild
- Skills-researcher: load -> reconcile("skills.sh") -> conditional write -> conditional cache rebuild
- User commands: unchanged (direct add/remove, always rebuild)

## Error Handling

- Fail-safe: invalid inputs return unchanged manifest
- Cache rebuild failures: log warning, continue
- Manifest load failures: normalize to empty
- Follows existing fail-open pattern from REQ-0037

## Detailed Artifacts

- module-design.md (module spec with internal logic pseudocode)
- interface-spec.md (full contract with 6 worked examples)
- data-flow.md (4 flow diagrams, state mutation points, persistence boundaries)
- error-taxonomy.md (6 error codes with severity and recovery)
