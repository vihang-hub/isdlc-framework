# Test Data Plan: REQ-0038 External Manifest Source Field

**Status**: Complete
**Phase**: 05 - Test Strategy
**Last Updated**: 2026-02-24

---

## 1. Fixture Factories

All test data is created using the existing `createTestProject()` fixture factory from `external-skill-management.test.cjs`. No new fixture factories are needed -- the existing one already accepts a `manifest` option for pre-populating manifest data.

### New Helper: createManifestWithSkills(skills)

A convenience wrapper for common test data patterns:

```javascript
function createManifestWithSkills(skills) {
    return { version: '1.0.0', skills: skills || [] };
}
```

### New Helper: createIncomingSkill(overrides)

```javascript
function createIncomingSkill(overrides = {}) {
    return {
        name: overrides.name || 'test-skill',
        file: overrides.file || 'test-skill.md',
        description: overrides.description || 'A test skill',
        sourcePhase: overrides.sourcePhase || 'D1',
        bindings: overrides.bindings || {
            phases: ['all'],
            agents: ['all'],
            injection_mode: 'always',
            delivery_type: 'context'
        },
        ...overrides
    };
}
```

---

## 2. Boundary Values

| Parameter | Boundary | Test Data | Expected Behavior |
|-----------|----------|-----------|-------------------|
| `manifest.skills` | 0 skills | `{ version: "1.0.0", skills: [] }` | Reconciliation adds incoming, nothing to update/remove |
| `manifest.skills` | 1 skill | Single discover-sourced skill | All reconciliation paths exercised on single entry |
| `manifest.skills` | 100 skills | Array of 100 skills (50 discover + 50 user) | Performance benchmark: reconciliation under 100ms |
| `incomingSkills` | 0 skills | `[]` | No adds or updates; removals depend on phasesExecuted |
| `incomingSkills` | 1 skill | Single incoming skill | Standard add/update path |
| `incomingSkills` | 50 skills | Array of 50 incoming skills | Batch add/update path |
| `phasesExecuted` | null | `null` | No removals (defensive default) |
| `phasesExecuted` | empty | `[]` | No removals (defensive default) |
| `phasesExecuted` | 1 phase | `["D1"]` | Only D1-mapped skills eligible for removal |
| `phasesExecuted` | all phases | `["D1", "D2", "D6"]` | All discover skills eligible for removal |
| `description` | empty string | `""` | Valid -- field is source-owned, empty is acceptable |
| `name` | minimum valid | `"ab"` | Valid per existing name validation |
| `source` | "discover" | `"discover"` | Valid source |
| `source` | "skills.sh" | `"skills.sh"` | Valid source |
| `source` | "user" | `"user"` | Rejected -- user source uses direct add/remove |

---

## 3. Invalid Inputs

| Input | Value | Expected Behavior |
|-------|-------|-------------------|
| `manifest` | `null` | Normalized to `{ version: "1.0.0", skills: [] }` |
| `manifest` | `undefined` | Normalized to `{ version: "1.0.0", skills: [] }` |
| `source` | `"user"` | Return unchanged manifest with `changed: false` |
| `source` | `""` | Return unchanged manifest with `changed: false` |
| `source` | `null` | Return unchanged manifest with `changed: false` |
| `incomingSkills` | `null` | Return unchanged manifest with `changed: false` |
| `incomingSkills` | `"not-array"` | Return unchanged manifest with `changed: false` |
| `incomingSkills` | `42` | Return unchanged manifest with `changed: false` |
| Incoming skill without `name` | `{ file: "f.md" }` | Skipped (not added to manifest) |
| Incoming skill without `file` | `{ name: "n" }` | Implementation-dependent (verify no crash) |

---

## 4. Maximum-Size Inputs

| Scenario | Data | Purpose |
|----------|------|---------|
| 100-skill manifest | 50 discover + 50 user skills | Performance benchmark (TC-27.01) |
| 50 incoming skills | All with unique names | Batch add performance |
| 50 incoming skills matching 50 existing | Same names, different descriptions | Batch update performance |
| Long description | 500-character description | Verify no truncation |
| Long skill name | 50-character hyphenated name | Verify no truncation |

---

## 5. Worked Example Data Sets

These correspond to the 6 worked examples from the interface specification.

### Example 1: First Discover Run

```javascript
const ex1_manifest = {
    version: '1.0.0',
    skills: [
        { name: 'my-patterns', source: 'user', file: 'my-patterns.md', bindings: { phases: ['all'] } }
    ]
};
const ex1_incoming = [
    { name: 'project-architecture', file: 'project-architecture.md', description: 'Arch guide', sourcePhase: 'D1',
      bindings: { phases: ['all'], agents: ['all'], injection_mode: 'always', delivery_type: 'context' } }
];
const ex1_phases = ['D1', 'D2', 'D6'];
// Expected: user skill untouched, discover skill added
```

### Example 2: Re-Run with User-Modified Bindings

```javascript
const ex2_manifest = {
    version: '1.0.0',
    skills: [
        { name: 'project-architecture', source: 'discover', file: 'project-architecture.md',
          description: 'Old desc', sourcePhase: 'D1',
          added_at: '2026-02-20T10:00:00.000Z', updated_at: '2026-02-20T10:00:00.000Z',
          bindings: { phases: ['06-implementation'], agents: ['all'], injection_mode: 'always', delivery_type: 'context' } }
    ]
};
const ex2_incoming = [
    { name: 'project-architecture', file: 'project-architecture.md', description: 'Updated desc', sourcePhase: 'D1',
      bindings: { phases: ['all'], agents: ['all'], injection_mode: 'always', delivery_type: 'context' } }
];
const ex2_phases = ['D1'];
// Expected: description updated, bindings PRESERVED (user's phases: ['06-implementation'])
```

### Example 3: Phase Didn't Run

```javascript
const ex3_manifest = {
    version: '1.0.0',
    skills: [
        { name: 'project-architecture', source: 'discover', sourcePhase: 'D1', file: 'project-architecture.md',
          added_at: '2026-02-20T10:00:00.000Z', updated_at: '2026-02-20T10:00:00.000Z', bindings: { phases: ['all'] } },
        { name: 'project-domain', source: 'discover', sourcePhase: 'D6', file: 'project-domain.md',
          added_at: '2026-02-20T10:00:00.000Z', updated_at: '2026-02-20T10:00:00.000Z', bindings: { phases: ['all'] } }
    ]
};
const ex3_incoming = [
    { name: 'project-architecture', file: 'project-architecture.md', description: 'Updated', sourcePhase: 'D1' }
];
const ex3_phases = ['D1']; // Only D1 ran
// Expected: project-architecture updated, project-domain preserved (D6 not in phasesExecuted)
```

### Example 4: Phase Ran but Produced Nothing

```javascript
const ex4_manifest = {
    version: '1.0.0',
    skills: [
        { name: 'project-test-landscape', source: 'discover', sourcePhase: 'D2', file: 'project-test-landscape.md',
          added_at: '2026-02-20T10:00:00.000Z', bindings: { phases: ['all'] } }
    ]
};
const ex4_incoming = []; // D2 ran but produced nothing
const ex4_phases = ['D2'];
// Expected: project-test-landscape removed
```

### Example 5: Legacy Manifest

```javascript
const ex5_manifest = {
    version: '1.0.0',
    skills: [
        { name: 'old-skill', file: 'old-skill.md', bindings: { phases: ['all'] } }
        // No source field -- legacy entry
    ]
};
const ex5_incoming = [
    { name: 'project-architecture', file: 'project-architecture.md', description: 'Arch', sourcePhase: 'D1' }
];
const ex5_phases = ['D1'];
// Expected: old-skill gets source:"user" (normalized), not touched; project-architecture added
```

### Example 6: Idempotent (No Changes)

```javascript
const ex6_manifest = { /* result of a previous reconciliation */ };
const ex6_incoming = [ /* same skills as previous reconciliation */ ];
const ex6_phases = [ /* same phases */ ];
// Expected: changed: false, added: [], removed: [], updated: []
```

---

## 6. Test Data Generation Strategy

All test data is static and deterministic -- no random generation needed. The data sets above cover:

1. **Happy path**: Examples 1, 2, 3 from interface spec
2. **Edge cases**: Examples 4, 5, 6 from interface spec
3. **Invalid inputs**: Null/undefined/wrong-type for each parameter
4. **Boundary values**: 0, 1, 100 skills; null/empty/full phases arrays
5. **Cross-source isolation**: Mixed manifests with user + discover + skills.sh entries
6. **Backward compatibility**: Legacy entries without source/updated_at fields

No external data sources, database fixtures, or API mocks are needed. All data is inline in the test file.
