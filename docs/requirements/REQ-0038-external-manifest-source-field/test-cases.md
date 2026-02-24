# Test Cases: REQ-0038 External Manifest Source Field

**Status**: Complete
**Phase**: 05 - Test Strategy
**Last Updated**: 2026-02-24
**Total Test Cases**: 41
**Target File**: `src/claude/hooks/tests/external-skill-management.test.cjs`

---

## TC-19: reconcileSkillsBySource() -- Add New Skills

**Traces**: FR-002 AC-002-02, FR-003 AC-003-01/03, FR-008 AC-008-01/02/03

### TC-19.01: First discover run adds new skill to empty manifest

- **Type**: positive
- **Requirement**: FR-002 AC-002-02
- **Given**: Manifest with no discover-sourced skills (only a user skill)
- **When**: `reconcileSkillsBySource(manifest, "discover", [incomingSkill], ["D1", "D2", "D6"])`
- **Then**: New entry added with `source: "discover"`, `added_at` set, `updated_at` set, default bindings from incoming skill
- **And**: Return `changed: true`, `added: ["project-architecture"]`, `removed: []`, `updated: []`
- **Data**: Interface-spec Example 1

### TC-19.02: Add multiple new skills in single reconciliation

- **Type**: positive
- **Requirement**: FR-002 AC-002-02
- **Given**: Empty manifest (skills: [])
- **When**: Reconcile with 3 incoming skills from different source phases
- **Then**: All 3 added, `added` array contains all 3 names
- **And**: `changed: true`

### TC-19.03: New skill gets added_at and updated_at timestamps

- **Type**: positive
- **Requirement**: FR-008 AC-008-02, AC-008-03
- **Given**: Empty manifest
- **When**: Reconcile with 1 incoming skill
- **Then**: Entry has `added_at` matching ISO-8601 format, `updated_at` matching ISO-8601 format
- **And**: `added_at` equals `updated_at` on first creation

### TC-19.04: New skill uses incoming bindings as defaults

- **Type**: positive
- **Requirement**: FR-002 AC-002-02
- **Given**: Empty manifest
- **When**: Reconcile with incoming skill that includes `bindings: { phases: ["all"], agents: ["all"], injection_mode: "always", delivery_type: "context" }`
- **Then**: Created entry has those exact bindings

### TC-19.05: New skill without incoming bindings gets null/undefined bindings

- **Type**: positive
- **Requirement**: FR-002 AC-002-02
- **Given**: Empty manifest
- **When**: Reconcile with incoming skill that has no `bindings` property
- **Then**: Created entry bindings come from incoming (undefined/null if not provided)

### TC-19.06: New skill gets source field set to provided source

- **Type**: positive
- **Requirement**: FR-001 AC-001-02, FR-008 AC-008-01
- **Given**: Empty manifest
- **When**: Reconcile with `source: "discover"`
- **Then**: Created entry has `source: "discover"`

### TC-19.07: New skill with source "skills.sh"

- **Type**: positive
- **Requirement**: FR-001 AC-001-03, FR-008 AC-008-01
- **Given**: Empty manifest
- **When**: Reconcile with `source: "skills.sh"`
- **Then**: Created entry has `source: "skills.sh"`

---

## TC-20: reconcileSkillsBySource() -- Update Existing Skills

**Traces**: FR-002 AC-002-01, FR-004, FR-003 AC-003-05

### TC-20.01: Update description on existing discover skill (preserve bindings)

- **Type**: positive
- **Requirement**: FR-002 AC-002-01, FR-004 AC-004-04, AC-004-07
- **Given**: Manifest with discover skill having user-modified bindings (`phases: ["06-implementation"]`)
- **When**: Reconcile with same skill name, different description
- **Then**: `description` updated, `bindings` preserved (still `["06-implementation"]`)
- **And**: Return `updated: ["project-architecture"]`
- **Data**: Interface-spec Example 2

### TC-20.02: Update file path on existing skill

- **Type**: positive
- **Requirement**: FR-004 AC-004-02
- **Given**: Manifest with discover skill `file: "old-path.md"`
- **When**: Reconcile with same skill name, `file: "new-path.md"`
- **Then**: `file` updated to `"new-path.md"`

### TC-20.03: Preserve added_at on update

- **Type**: positive
- **Requirement**: FR-004 AC-004-05
- **Given**: Manifest with discover skill `added_at: "2026-02-20T10:00:00.000Z"`
- **When**: Reconcile with same skill name
- **Then**: `added_at` unchanged, still `"2026-02-20T10:00:00.000Z"`

### TC-20.04: Refresh updated_at on update

- **Type**: positive
- **Requirement**: FR-004 AC-004-06
- **Given**: Manifest with discover skill `updated_at: "2026-02-20T10:00:00.000Z"`
- **When**: Reconcile with same skill name and changed content
- **Then**: `updated_at` is newer than `"2026-02-20T10:00:00.000Z"`

### TC-20.05: Source field immutable on update

- **Type**: positive
- **Requirement**: FR-004 AC-004-03
- **Given**: Manifest with skill `source: "discover"`
- **When**: Reconcile with `source: "discover"` and same skill name
- **Then**: `source` remains `"discover"` (unchanged)

### TC-20.06: Update with no actual changes still marks as updated (content-agnostic)

- **Type**: positive
- **Requirement**: FR-002 AC-002-01
- **Given**: Manifest with discover skill matching incoming skill exactly (same file, same description)
- **When**: Reconcile with identical incoming skill
- **Then**: Either `updated: []` (if implementation is change-aware) or `updated: [name]` (if always refreshes)
- **Note**: This test validates idempotency -- the key check is `changed` boolean accuracy

---

## TC-21: reconcileSkillsBySource() -- Remove Skills (Phase-Gated)

**Traces**: FR-002 AC-002-03, AC-002-04, AC-002-06

### TC-21.01: Phase ran but produced nothing -- skill removed

- **Type**: positive
- **Requirement**: FR-002 AC-002-03
- **Given**: Manifest with discover skill `sourcePhase: "D2"`
- **When**: Reconcile with empty incoming array, `phasesExecuted: ["D2"]`
- **Then**: Skill removed from manifest
- **And**: Return `removed: ["project-test-landscape"]`, `changed: true`
- **Data**: Interface-spec Example 4

### TC-21.02: Phase did NOT run -- skill preserved

- **Type**: positive
- **Requirement**: FR-002 AC-002-04
- **Given**: Manifest with 2 discover skills: one D1, one D6
- **When**: Reconcile with 1 incoming D1 skill, `phasesExecuted: ["D1"]` (D6 not in list)
- **Then**: D6 skill preserved untouched, D1 skill updated
- **Data**: Interface-spec Example 3

### TC-21.03: phasesExecuted null -- no removals (defensive)

- **Type**: positive
- **Requirement**: FR-002 AC-002-06
- **Given**: Manifest with discover skills
- **When**: Reconcile with empty incoming array, `phasesExecuted: null`
- **Then**: No skills removed, all preserved
- **And**: `removed: []`

### TC-21.04: phasesExecuted empty array -- no removals (defensive)

- **Type**: positive
- **Requirement**: FR-002 AC-002-06
- **Given**: Manifest with discover skills
- **When**: Reconcile with empty incoming array, `phasesExecuted: []`
- **Then**: No skills removed, all preserved

### TC-21.05: Multiple skills removed when their phases ran but produced nothing

- **Type**: positive
- **Requirement**: FR-002 AC-002-03
- **Given**: Manifest with 3 discover skills: D1, D2, D6
- **When**: Reconcile with empty incoming, `phasesExecuted: ["D1", "D2", "D6"]`
- **Then**: All 3 removed, `removed` has all 3 names

---

## TC-22: reconcileSkillsBySource() -- Cross-Source Isolation

**Traces**: FR-002 AC-002-05, FR-001

### TC-22.01: User skills untouched during discover reconciliation

- **Type**: positive
- **Requirement**: FR-002 AC-002-05
- **Given**: Manifest with user skill and discover skill
- **When**: Reconcile with `source: "discover"`, incoming skills only for discover
- **Then**: User skill unchanged in all fields
- **Data**: Interface-spec Example 1 (user skill "my-patterns" preserved)

### TC-22.02: skills.sh skills untouched during discover reconciliation

- **Type**: positive
- **Requirement**: FR-002 AC-002-05
- **Given**: Manifest with skills.sh-sourced skill and discover skill
- **When**: Reconcile with `source: "discover"`
- **Then**: skills.sh skill unchanged

### TC-22.03: Discover skills untouched during skills.sh reconciliation

- **Type**: positive
- **Requirement**: FR-002 AC-002-05
- **Given**: Manifest with discover and skills.sh skills
- **When**: Reconcile with `source: "skills.sh"`
- **Then**: Discover skills unchanged

### TC-22.04: Legacy entry (no source) treated as user, untouched by discover

- **Type**: positive
- **Requirement**: FR-001 AC-001-04, FR-002 AC-002-05
- **Given**: Manifest with entry that has no `source` field
- **When**: Reconcile with `source: "discover"`
- **Then**: Legacy entry gets `source: "user"` (normalized) and is not modified
- **Data**: Interface-spec Example 5

---

## TC-23: reconcileSkillsBySource() -- Return Shape Validation

**Traces**: FR-003 AC-003-01 through AC-003-05

### TC-23.01: Return includes manifest object

- **Type**: positive
- **Requirement**: FR-003 AC-003-01
- **Given**: Any valid inputs
- **When**: Reconcile
- **Then**: Return has `manifest` property that is an object with `version` and `skills`

### TC-23.02: Return includes changed boolean

- **Type**: positive
- **Requirement**: FR-003 AC-003-02
- **Given**: Any valid inputs
- **When**: Reconcile
- **Then**: Return has `changed` property of type boolean

### TC-23.03: Return includes added array of strings

- **Type**: positive
- **Requirement**: FR-003 AC-003-03
- **Given**: Reconciliation that adds a skill
- **When**: Reconcile
- **Then**: Return `added` is an array of strings (skill names)

### TC-23.04: Return includes removed array of strings

- **Type**: positive
- **Requirement**: FR-003 AC-003-04
- **Given**: Reconciliation that removes a skill
- **When**: Reconcile
- **Then**: Return `removed` is an array of strings (skill names)

### TC-23.05: Return includes updated array of strings

- **Type**: positive
- **Requirement**: FR-003 AC-003-05
- **Given**: Reconciliation that updates a skill
- **When**: Reconcile
- **Then**: Return `updated` is an array of strings (skill names)

### TC-23.06: changed is false when no modifications made (idempotent)

- **Type**: positive
- **Requirement**: FR-003 AC-003-02
- **Given**: Manifest and incoming that produce no changes
- **When**: Reconcile
- **Then**: `changed: false`, `added: []`, `removed: []`, `updated: []`
- **Data**: Interface-spec Example 6

---

## TC-24: reconcileSkillsBySource() -- Input Validation and Edge Cases

**Traces**: FR-002 (validation rules), FR-008

### TC-24.01: Null manifest normalized to empty

- **Type**: negative
- **Requirement**: FR-002 (validation: manifest null)
- **Given**: `manifest = null`
- **When**: Reconcile with valid source and incoming
- **Then**: Creates entry, return manifest has `version: "1.0.0"` and `skills` array

### TC-24.02: Source "user" rejected -- returns unchanged

- **Type**: negative
- **Requirement**: FR-002 (validation: source must be "discover" or "skills.sh")
- **Given**: Valid manifest
- **When**: Reconcile with `source: "user"`
- **Then**: Return `{ manifest: (unchanged), changed: false, added: [], removed: [], updated: [] }`

### TC-24.03: incomingSkills not an array -- returns unchanged

- **Type**: negative
- **Requirement**: FR-002 (validation: incomingSkills must be array)
- **Given**: Valid manifest
- **When**: Reconcile with `incomingSkills: "not-an-array"`
- **Then**: Return `{ manifest: (unchanged), changed: false, added: [], removed: [], updated: [] }`

### TC-24.04: incomingSkills null -- returns unchanged

- **Type**: negative
- **Requirement**: FR-002 (validation: incomingSkills must be array)
- **Given**: Valid manifest
- **When**: Reconcile with `incomingSkills: null`
- **Then**: Return `{ manifest: (unchanged), changed: false }`

### TC-24.05: Incoming skill missing name -- skipped

- **Type**: negative
- **Requirement**: FR-002 (validation: incoming skill missing name)
- **Given**: Valid manifest
- **When**: Reconcile with incoming skill `{ file: "no-name.md" }` (no `name` property)
- **Then**: Skill not added, `added: []`

### TC-24.06: Incoming skill missing file -- still added (file optional? or skipped)

- **Type**: negative
- **Requirement**: FR-002 (incoming skill must have name and file at minimum)
- **Given**: Valid manifest
- **When**: Reconcile with incoming skill `{ name: "test" }` (no `file` property)
- **Then**: Behavior per implementation -- verify no crash

### TC-24.07: Empty incoming array with no phases -- no changes

- **Type**: positive
- **Requirement**: FR-002
- **Given**: Manifest with discover skills, `phasesExecuted: null`
- **When**: Reconcile with empty `incomingSkills: []`
- **Then**: `changed: false`, all skills preserved

---

## TC-25: loadExternalManifest() -- Source Field Defaults

**Traces**: FR-001 AC-001-04, FR-008 AC-008-04, AC-008-05

### TC-25.01: Legacy entry without source gets default "user"

- **Type**: positive
- **Requirement**: FR-001 AC-001-04, FR-008 AC-008-04
- **Given**: Manifest on disk with entry `{ name: "old-skill", file: "old.md" }` (no `source`)
- **When**: `loadExternalManifest()`
- **Then**: Loaded entry has `source: "user"`

### TC-25.02: Entry with source "discover" preserved

- **Type**: positive
- **Requirement**: FR-008 AC-008-04
- **Given**: Manifest on disk with entry `{ name: "disc-skill", source: "discover" }`
- **When**: `loadExternalManifest()`
- **Then**: Loaded entry has `source: "discover"` (not overwritten)

### TC-25.03: Entry with source "skills.sh" preserved

- **Type**: positive
- **Requirement**: FR-008 AC-008-04
- **Given**: Manifest on disk with entry `{ name: "sh-skill", source: "skills.sh" }`
- **When**: `loadExternalManifest()`
- **Then**: Loaded entry has `source: "skills.sh"`

### TC-25.04: Multiple legacy entries all get "user" default

- **Type**: positive
- **Requirement**: FR-001 AC-001-04
- **Given**: Manifest with 3 entries, none with `source`
- **When**: `loadExternalManifest()`
- **Then**: All 3 entries have `source: "user"`

### TC-25.05: Entry without updated_at treated as null

- **Type**: positive
- **Requirement**: FR-008 AC-008-05
- **Given**: Manifest with entry that has no `updated_at`
- **When**: `loadExternalManifest()`
- **Then**: Entry `updated_at` is `undefined` or `null`

---

## TC-26: Integration -- Reconciliation Pipeline

**Traces**: FR-002, FR-003, FR-005

### TC-26.01: Full pipeline: load -> reconcile -> write -> re-load

- **Type**: positive (integration)
- **Requirement**: FR-002, FR-003, FR-005
- **Given**: Manifest on disk with user skill
- **When**: Load manifest, reconcile with discover skills, write result, re-load
- **Then**: Re-loaded manifest contains both user and discover skills with correct source fields

### TC-26.02: Idempotent pipeline: reconcile twice produces same result

- **Type**: positive (integration)
- **Requirement**: FR-003 AC-003-02
- **Given**: First reconciliation completed and written
- **When**: Re-load and reconcile again with same inputs
- **Then**: Second reconciliation returns `changed: false`

### TC-26.03: Reconcile then remove: user removes discover skill by name

- **Type**: positive (integration)
- **Requirement**: FR-002, removeSkillFromManifest (unchanged)
- **Given**: Manifest with discover skill after reconciliation
- **When**: `removeSkillFromManifest(skillName, manifest)`
- **Then**: Skill removed regardless of source (user can remove any skill)

### TC-26.04: Multi-source manifest: discover then skills.sh reconciliation

- **Type**: positive (integration)
- **Requirement**: FR-002 AC-002-05
- **Given**: Empty manifest
- **When**: Reconcile discover skills, then reconcile skills.sh skills
- **Then**: Manifest has both sources, each reconciliation only touched its own source

---

## TC-27: Performance -- Reconciliation Benchmarks

**Traces**: NFR (performance quality attribute)

### TC-27.01: Reconciliation with 100 skills under 100ms

- **Type**: positive (performance)
- **Requirement**: Quality attribute: <100ms for <100 skills
- **Given**: Manifest with 50 existing discover skills
- **When**: Reconcile with 50 new + 50 updated incoming skills
- **Then**: Elapsed time < 100ms

### TC-27.02: Idempotent reconciliation under 50ms

- **Type**: positive (performance)
- **Requirement**: Performance (fast path)
- **Given**: Manifest already reconciled
- **When**: Reconcile again with same inputs
- **Then**: Elapsed time < 50ms

---

## Summary

| Test Group | Tests | Positive | Negative |
|------------|-------|----------|----------|
| TC-19: Add new skills | 7 | 7 | 0 |
| TC-20: Update existing skills | 6 | 6 | 0 |
| TC-21: Remove skills (phase-gated) | 5 | 5 | 0 |
| TC-22: Cross-source isolation | 4 | 4 | 0 |
| TC-23: Return shape validation | 6 | 6 | 0 |
| TC-24: Input validation / edge cases | 7 | 1 | 6 |
| TC-25: loadExternalManifest defaults | 5 | 5 | 0 |
| TC-26: Integration pipeline | 4 | 4 | 0 |
| TC-27: Performance benchmarks | 2 | 2 | 0 |
| **Total** | **46** | **40** | **6** |
