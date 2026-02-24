# Requirements Specification: REQ-0038 External Manifest Source Field

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-02-24
**Coverage**: Sections 1-8 complete

---

## 1. Business Context

### Problem Statement

The external skills manifest (`external-skills-manifest.json`) currently has no way to distinguish who registered a skill -- whether it was the user manually, the discover workflow's distillation step, or the skills-researcher fetching from skills.sh. This creates two problems:

1. **Unsafe overwrites**: When discover runs twice, it uses name-based removal to clean up before re-adding. If a discover-sourced skill shares a name with a user-added skill, the user's skill gets silently deleted.
2. **No idempotent update**: There is no way to selectively replace only the skills belonging to a particular source without risking damage to skills from other sources.

### Success Metrics

- Zero user-added skills lost during discover re-runs
- Discover re-runs are idempotent: running twice produces the same result as running once
- User binding customizations on discover-sourced skills survive re-runs

### Driving Factors

- REQ-0037 (project skills distillation) introduced discover-sourced skills, making the source distinction operationally necessary
- Dependency on #86 (manifest cleanup) is complete -- clean baseline exists

---

## 2. Stakeholders and Personas

### P1: Framework User (Primary)

- **Role**: Developer using iSDLC on their project
- **Goals**: Add custom skills, run discover, and trust that their manual customizations are preserved
- **Pain Points**: Risk of losing manually added skills or custom bindings when running discover
- **Proficiency**: Intermediate -- uses `/isdlc skill add` and `/discover` commands

### P2: Discover Orchestrator (Automated Consumer)

- **Role**: Automated agent that distills project skills from codebase analysis
- **Goals**: Write discover-sourced skills to the manifest idempotently without disrupting other sources
- **Tasks**: Distill skills, reconcile manifest, trigger cache rebuild only when needed

### P3: Skills Researcher (Automated Consumer)

- **Role**: Sub-agent that fetches skills from skills.sh
- **Goals**: Register skills.sh-sourced skills without disrupting discover or user skills
- **Tasks**: Search skills.sh, install skills, reconcile manifest entries

---

## 3. User Journeys

### UJ-1: User adds a skill, then runs discover

1. User runs `/isdlc skill add ./my-patterns.md` -- entry created with `source: "user"`
2. User runs `/discover` -- discover distills project skills with `source: "discover"`
3. Reconciliation preserves the user's skill entry untouched
4. User verifies with `/isdlc skill list` -- both skills present

### UJ-2: User customizes bindings on a discover-sourced skill, then re-runs discover

1. Discover creates `project-architecture` with `source: "discover"` and default bindings
2. User runs `/isdlc skill wire project-architecture` and restricts to `06-implementation` phase
3. User re-runs `/discover`
4. Reconciliation updates the skill file content but preserves the user's custom bindings
5. User verifies bindings are unchanged

### UJ-3: Discover drops a skill on re-run (source phase ran but produced nothing)

1. First discover run distills PROJ-004 (test-landscape) from D2 output
2. User deletes all tests from the codebase
3. Second discover run: D2 runs but produces no meaningful output
4. Reconciliation removes PROJ-004 from manifest and deletes the file
5. User is not surprised -- the skill is no longer relevant

### UJ-4: Incremental discover (source phase didn't run)

1. First discover run distills all four project skills
2. Incremental discover runs only D1 (architecture) -- D2, D6 did not run
3. Reconciliation updates only PROJ-001 and PROJ-002 (mapped to D1)
4. PROJ-003 (mapped to D6) and PROJ-004 (mapped to D2) are untouched -- their phases didn't run

### UJ-5: Backward compatibility with legacy manifest

1. User has an existing manifest with entries that have no `source` field
2. User upgrades to the version with source field support
3. Legacy entries are treated as `source: "user"` -- never overwritten by discover
4. Next user interaction or discover run proceeds normally

---

## 4. Technical Context

### Existing Patterns

- `common.cjs` exports manifest utilities: `loadExternalManifest()`, `writeExternalManifest()`, `removeSkillFromManifest()`
- Agent definition files (`.md`) describe behavior; runtime code (`.cjs`) implements it
- Session cache builder already reads `skill.source || 'unknown'` (line 4051 of common.cjs)
- `isdlc.md` skill add handler already writes `source: "user"` (line 1533)
- Discover orchestrator Step D.2 describes clean-slate removal by name -- this changes to reconciliation

### Constraints

- CJS module format (hooks convention)
- No new dependencies
- Must be backward compatible with manifests lacking the `source` field
- `rebuildSkillCache()` via `node bin/rebuild-cache.js` -- only called when manifest actually changes

### Integration Points

- Discover orchestrator calls reconciliation after distillation (Step 2a)
- Skills-researcher calls reconciliation after skills.sh installation
- `skill add` / `skill remove` commands in `isdlc.md` use direct add/remove (not reconciliation)
- Session cache builder reads manifest for injection -- no change needed

---

## 5. Quality Attributes and Risks

### Quality Attributes

| Attribute | Priority | Threshold |
|-----------|----------|-----------|
| Data Integrity | Critical | User-added skills and custom bindings are never lost during automated reconciliation |
| Idempotency | Critical | Running discover twice produces identical manifest state |
| Backward Compatibility | High | Manifests without `source` field work without migration |
| Performance | Medium | Reconciliation completes in <100ms for manifests with <100 skills |
| Testability | High | All reconciliation paths testable in isolation with mock manifests |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| R-001: Name collision between user and discover skill | Low | High | Source field ensures filtering never crosses source boundaries |
| R-002: Binding schema changes in future versions | Medium | Medium | Reconciliation treats `bindings` as opaque object -- preserves whatever is there |
| R-003: Partial reconciliation failure (crash mid-write) | Low | High | `writeExternalManifest()` already does atomic write + verify-by-re-read |
| R-004: Discover orchestrator forgets to pass phasesExecuted | Medium | Medium | Defensive: if phasesExecuted is empty/null, treat as "no phases ran" -- preserve everything |

---

## 6. Functional Requirements

### FR-001: Source Field in Manifest Entries

**Confidence**: High

Every skill entry in the external skills manifest MUST include a `source` field with one of three values: `"discover"`, `"skills.sh"`, or `"user"`.

- **AC-001-01**: When a user adds a skill via `/isdlc skill add`, the entry is created with `source: "user"`
- **AC-001-02**: When discover distills a project skill, the entry is created with `source: "discover"`
- **AC-001-03**: When skills-researcher installs a skill from skills.sh, the entry is created with `source: "skills.sh"`
- **AC-001-04**: Manifest entries without a `source` field are treated as `source: "user"` at read time

### FR-002: Reconciliation Function

**Confidence**: High

A `reconcileSkillsBySource(manifest, source, incomingSkills, phasesExecuted)` function MUST be exported from `common.cjs` that merges incoming skills into the manifest based on source ownership.

- **AC-002-01**: For each incoming skill that matches an existing entry (by `source` + `name`): update source-owned fields (`file`, `description`, `updated_at`) and preserve user-owned fields (`bindings`, `added_at`)
- **AC-002-02**: For each incoming skill with no existing match: add as new entry with default bindings, `added_at` set to current timestamp, `updated_at` set to current timestamp
- **AC-002-03**: For each existing entry matching the `source` whose mapped phase is in `phasesExecuted` but is NOT in the incoming set: remove from manifest
- **AC-002-04**: For each existing entry matching the `source` whose mapped phase is NOT in `phasesExecuted`: preserve untouched
- **AC-002-05**: Entries with a different `source` value are never modified
- **AC-002-06**: If `phasesExecuted` is null or empty, no existing entries are removed (defensive default)

### FR-003: Reconciliation Return Value

**Confidence**: High

The reconciliation function MUST return a detailed result object.

- **AC-003-01**: Return object includes `manifest` (the updated manifest object)
- **AC-003-02**: Return object includes `changed: boolean` indicating whether any modifications were made
- **AC-003-03**: Return object includes `added: string[]` with names of newly added skills
- **AC-003-04**: Return object includes `removed: string[]` with names of removed skills
- **AC-003-05**: Return object includes `updated: string[]` with names of skills whose content was refreshed

### FR-004: Field Ownership Rules

**Confidence**: High

Manifest entry fields MUST follow defined ownership rules during reconciliation.

- **AC-004-01**: `name` is the match key -- used for identifying existing entries
- **AC-004-02**: `file` is source-owned -- updated on reconciliation
- **AC-004-03**: `source` is immutable after creation
- **AC-004-04**: `description` is source-owned -- updated on reconciliation
- **AC-004-05**: `added_at` is set once on creation and never modified
- **AC-004-06**: `updated_at` is set on every reconciliation that touches the entry
- **AC-004-07**: `bindings` is user-owned -- preserved across reconciliation

### FR-005: Conditional Cache Rebuild

**Confidence**: High

The skill cache MUST only be rebuilt when the manifest actually changed.

- **AC-005-01**: After reconciliation, if `changed` is `true`, call `rebuildSkillCache()` (via `node bin/rebuild-cache.js`)
- **AC-005-02**: After reconciliation, if `changed` is `false`, skip cache rebuild
- **AC-005-03**: After `skill add`, `skill remove`, or `skill wire` commands, always rebuild cache (these always change the manifest)

### FR-006: Discover Orchestrator Integration

**Confidence**: High

The discover orchestrator MUST use `reconcileSkillsBySource()` instead of the current delete-by-name approach.

- **AC-006-01**: Discover passes `source: "discover"`, the distilled skills array, and the list of phases that executed
- **AC-006-02**: The distillation summary display uses the reconciliation return value (`added`, `removed`, `updated`) for its diff output
- **AC-006-03**: Cache rebuild is only triggered if `changed` is `true`

### FR-007: Skills Researcher Integration

**Confidence**: High

The skills-researcher MUST use `reconcileSkillsBySource()` for skills.sh-sourced skills.

- **AC-007-01**: Skills-researcher passes `source: "skills.sh"`, the installed skills array, and the phases that executed
- **AC-007-02**: Cache rebuild is only triggered if `changed` is `true`

### FR-008: Updated Manifest Schema

**Confidence**: High

The manifest entry schema MUST include `source`, `added_at`, and `updated_at` fields.

- **AC-008-01**: `source` field is a string enum: `"discover" | "skills.sh" | "user"`
- **AC-008-02**: `added_at` field is an ISO-8601 timestamp string set on creation
- **AC-008-03**: `updated_at` field is an ISO-8601 timestamp string, set on creation and updated on each reconciliation; null for legacy entries until first reconciliation
- **AC-008-04**: Existing entries without `source` default to `"user"` at read time
- **AC-008-05**: Existing entries without `updated_at` are treated as `updated_at: null`

---

## 7. Out of Scope

| Item | Reason | Dependency |
|------|--------|------------|
| Manifest migration tool | Backward compat handles legacy entries at read time -- no migration needed | None |
| UI for viewing skill sources | Can be added later via `skill list` enhancement | Future enhancement |
| Source field validation in hooks | Session cache builder already tolerates missing source -- no enforcement hook needed | None |
| Team/shared skill source type | Shared team skills fall under `"user"` source | User decision |
| Skill versioning | Orthogonal concern -- not related to source tracking | Future REQ |

---

## 8. MoSCoW Prioritization

| FR | Title | Priority | Rationale |
|----|-------|----------|-----------|
| FR-001 | Source Field in Manifest Entries | Must Have | Core feature -- enables all other requirements |
| FR-002 | Reconciliation Function | Must Have | Core logic -- replaces unsafe delete-and-recreate |
| FR-003 | Reconciliation Return Value | Must Have | Required for conditional cache rebuild and diff display |
| FR-004 | Field Ownership Rules | Must Have | Protects user customizations -- primary user value |
| FR-005 | Conditional Cache Rebuild | Should Have | Performance optimization -- avoids unnecessary work |
| FR-006 | Discover Orchestrator Integration | Must Have | Primary consumer of reconciliation |
| FR-007 | Skills Researcher Integration | Must Have | Secondary consumer of reconciliation |
| FR-008 | Updated Manifest Schema | Must Have | Schema foundation for all other requirements |
