# Requirements Specification: REQ-0094 — Provider-Neutral Team Spec Model

## 1. Business Context

The iSDLC framework uses multiple team orchestration patterns (sequential loops, parallel fan-outs, dual-track execution, debate rounds) that are currently encoded entirely in Claude-specific agent markdown files. Codex (and future providers) need to know team shapes — member roles, parallelism model, merge/retry policies — without reading Claude agent markdown. This item creates a pure-data spec catalog that any provider can consume.

**Stakeholders**: Framework developers, Codex adapter consumers, Claude adapter (unchanged)
**Success metric**: All 4 team types have spec objects loadable via `getTeamSpec(type)`, with 0 changes to existing `ImplementationLoop`.
**Driving factor**: Codex integration Phase 4 — team ports (REQ-0095/0096/0097) depend on this spec model.

## 2. Stakeholders and Personas

### Framework Developer
- **Role**: Builds and extends iSDLC core
- **Goal**: Add team specs without breaking existing Claude behavior
- **Pain point**: Team shapes are embedded in agent markdown, not queryable by code

### Provider Adapter Author
- **Role**: Writes Codex/future provider adapters
- **Goal**: Read team specs to know what roles to fill for each phase
- **Pain point**: No programmatic way to discover team composition

## 3. User Journeys

### Provider adapter reads team spec
- **Entry**: Adapter receives phase delegation with `team_type` field
- **Flow**: Calls `getTeamSpec(teamType)` → receives frozen spec object → reads `members`, `parallelism`, `merge_policy` → configures provider-specific execution
- **Exit**: Adapter knows the team shape and can orchestrate accordingly

## 4. Technical Context

- **Existing code**: `src/core/teams/implementation-loop.js` (ImplementationLoop class with narrow TeamSpec typedef), `src/core/teams/contracts/` (3 JSON schema files), `src/core/bridge/teams.cjs` (CJS bridge)
- **Module system**: ESM for core, CJS bridge for hooks (Article XIII)
- **Convention**: Bridge-first-with-fallback pattern established in Phase 2/3 extractions
- **Dependencies satisfied**: REQ-0082 (WorkflowRegistry), REQ-0081 (ValidatorEngine) — both completed

## 5. Quality Attributes and Risks

| Attribute | Priority | Threshold |
|-----------|----------|-----------|
| Backward compatibility | Critical | 0 changes to existing ImplementationLoop, contracts, or bridge |
| Simplicity | High | Pure data objects, no runtime logic beyond registry lookup |
| Testability | High | Each spec independently testable, registry has full coverage |

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Spec fields don't capture all patterns | Low | Medium | Fields derived from design doc + codebase scan of all 4 patterns |
| Registry import breaks ESM/CJS boundary | Low | High | Use proven bridge-first-with-fallback pattern from Phase 2/3 |

## 6. Functional Requirements

### FR-001: Team Spec Definitions
**Confidence**: High

Define frozen spec objects for 4 team types:

- AC-001-01: `implementation_review_loop` spec with members `['writer', 'reviewer', 'updater']`, parallelism `sequential`, merge_policy `last_wins`, retry_policy `per_member`, max_iterations `3`, state_owner `orchestrator`
- AC-001-02: `fan_out` spec with members `['orchestrator', 'sub_agent']`, parallelism `full`, merge_policy `consolidate`, retry_policy `fail_open`, max_iterations `1`, state_owner `orchestrator`
- AC-001-03: `dual_track` spec with members `['track_a', 'track_b']`, parallelism `full`, merge_policy `consolidate`, retry_policy `per_track`, max_iterations `10`, state_owner `orchestrator`
- AC-001-04: `debate` spec with members `['creator', 'critic', 'refiner']`, parallelism `sequential`, merge_policy `last_wins`, retry_policy `per_round`, max_iterations `3`, state_owner `orchestrator`

### FR-002: Team Spec Registry
**Confidence**: High

- AC-002-01: `getTeamSpec(teamType)` returns the frozen spec object for a known team type
- AC-002-02: `getTeamSpec(unknownType)` throws `Error` with message containing available types
- AC-002-03: `listTeamTypes()` returns `['implementation_review_loop', 'fan_out', 'dual_track', 'debate']`

### FR-003: Spec Field Schema
**Confidence**: High

- AC-003-01: Every spec object has exactly these fields: `team_type`, `members`, `parallelism`, `merge_policy`, `retry_policy`, `max_iterations`, `state_owner`
- AC-003-02: `members` is an array of strings (role names, not agent names)
- AC-003-03: `parallelism` is one of: `'sequential'`, `'full'`, `'dual_track'`
- AC-003-04: All spec objects are frozen (`Object.isFrozen()` returns `true`)

### FR-004: Backward Compatibility
**Confidence**: High

- AC-004-01: `src/core/teams/implementation-loop.js` has 0 modifications
- AC-004-02: `src/core/teams/contracts/*.json` have 0 modifications
- AC-004-03: `src/core/bridge/teams.cjs` has 0 modifications
- AC-004-04: All existing tests pass without changes

### FR-005: Pure Data Objects
**Confidence**: High

- AC-005-01: Spec files export only frozen object literals — no classes, no functions, no side effects
- AC-005-02: Registry has no dynamic registration — catalog is fixed at module load

### FR-006: CJS Bridge
**Confidence**: High

- AC-006-01: `src/core/bridge/team-specs.cjs` exports `getTeamSpec()` and `listTeamTypes()`
- AC-006-02: Bridge uses bridge-first-with-fallback pattern
- AC-006-03: Bridge returns same values as ESM registry

## 7. Out of Scope

| Item | Reason |
|------|--------|
| Runtime orchestration engines for fan-out/dual-track/debate | Stay in agent markdown — REQ-0095/0096/0097 |
| Provider-specific packaging | Phase 5 (REQ-0099) |
| Skill injection planning | REQ-0126 (separate item) |
| Modifying ImplementationLoop class | User directive: keep as-is |
| Dynamic team registration | YAGNI — catalog is fixed |

## 8. MoSCoW Prioritization

| FR | Title | Priority | Rationale |
|----|-------|----------|-----------|
| FR-001 | Team Spec Definitions | Must Have | Core deliverable |
| FR-002 | Team Spec Registry | Must Have | Lookup mechanism for consumers |
| FR-003 | Spec Field Schema | Must Have | Contract consistency |
| FR-004 | Backward Compatibility | Must Have | Zero regression |
| FR-005 | Pure Data Objects | Must Have | Simplicity principle |
| FR-006 | CJS Bridge | Should Have | Hook consumer access |
