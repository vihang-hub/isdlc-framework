# Interface Specification: REQ-0038 External Manifest Source Field

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-02-24
**Coverage**: Full

---

## 1. reconcileSkillsBySource(manifest, source, incomingSkills, phasesExecuted)

### Signature

```javascript
/**
 * Reconcile incoming skills into the manifest for a given source.
 * Pure function -- operates on manifest in memory, does not write to disk.
 *
 * Traces: FR-002, FR-003, FR-004
 *
 * @param {object|null} manifest - Current manifest from loadExternalManifest()
 * @param {string} source - Source identifier: "discover" or "skills.sh"
 * @param {Array<{name: string, file: string, description: string, sourcePhase: string, bindings?: object}>} incomingSkills
 * @param {Array<string>|null} phasesExecuted - Source phases that ran (e.g., ["D1", "D2"])
 * @returns {{manifest: object, changed: boolean, added: string[], removed: string[], updated: string[]}}
 */
function reconcileSkillsBySource(manifest, source, incomingSkills, phasesExecuted) { ... }
```

### Preconditions

- `source` must be `"discover"` or `"skills.sh"` (not `"user"` -- user skills are managed via add/remove commands)
- `incomingSkills` must be an array (may be empty)
- Each incoming skill must have `name` and `file` at minimum

### Postconditions

- All entries with a different `source` are unchanged
- All entries matching `source` are reconciled per field ownership rules
- Return value accurately reflects all changes made
- `changed` is `false` if and only if `added`, `removed`, and `updated` are all empty arrays

### Validation Rules

| Input | Validation | On Invalid |
|-------|-----------|------------|
| `manifest` | If null/undefined, normalize to `{ version: "1.0.0", skills: [] }` | Auto-normalize |
| `source` | Must be `"discover"` or `"skills.sh"` | Return unchanged manifest with `changed: false` |
| `incomingSkills` | Must be array | Return unchanged manifest with `changed: false` |
| `phasesExecuted` | If null/undefined/empty, treat as "no phases ran" | No removals, only adds and updates |

### Examples

#### Example 1: First discover run (no existing discover skills)

**Input**:
```javascript
reconcileSkillsBySource(
  { version: "1.0.0", skills: [
    { name: "my-patterns", source: "user", file: "my-patterns.md", bindings: { phases: ["all"] } }
  ]},
  "discover",
  [
    { name: "project-architecture", file: "project-architecture.md", description: "Arch guide", sourcePhase: "D1", bindings: { phases: ["all"], agents: ["all"], injection_mode: "always", delivery_type: "context" } }
  ],
  ["D1", "D2", "D6"]
)
```

**Output**:
```javascript
{
  manifest: {
    version: "1.0.0",
    skills: [
      { name: "my-patterns", source: "user", file: "my-patterns.md", bindings: { phases: ["all"] } },
      { name: "project-architecture", file: "project-architecture.md", source: "discover", description: "Arch guide", sourcePhase: "D1", added_at: "2026-02-24T22:50:00.000Z", updated_at: "2026-02-24T22:50:00.000Z", bindings: { phases: ["all"], agents: ["all"], injection_mode: "always", delivery_type: "context" } }
    ]
  },
  changed: true,
  added: ["project-architecture"],
  removed: [],
  updated: []
}
```

#### Example 2: Re-run discover with user-modified bindings

**Input**:
```javascript
reconcileSkillsBySource(
  { version: "1.0.0", skills: [
    { name: "project-architecture", source: "discover", file: "project-architecture.md", description: "Old desc", sourcePhase: "D1", added_at: "2026-02-20T10:00:00.000Z", updated_at: "2026-02-20T10:00:00.000Z", bindings: { phases: ["06-implementation"], agents: ["all"], injection_mode: "always", delivery_type: "context" } }
  ]},
  "discover",
  [
    { name: "project-architecture", file: "project-architecture.md", description: "Updated desc", sourcePhase: "D1", bindings: { phases: ["all"], agents: ["all"], injection_mode: "always", delivery_type: "context" } }
  ],
  ["D1"]
)
```

**Output**:
```javascript
{
  manifest: {
    version: "1.0.0",
    skills: [
      { name: "project-architecture", source: "discover", file: "project-architecture.md", description: "Updated desc", sourcePhase: "D1", added_at: "2026-02-20T10:00:00.000Z", updated_at: "2026-02-24T22:50:00.000Z", bindings: { phases: ["06-implementation"], agents: ["all"], injection_mode: "always", delivery_type: "context" } }
    ]
  },
  changed: true,
  added: [],
  removed: [],
  updated: ["project-architecture"]
}
```

Note: `bindings` preserved the user's customization (`phases: ["06-implementation"]`), `description` updated, `added_at` preserved, `updated_at` refreshed.

#### Example 3: Phase didn't run -- skill preserved

**Input**:
```javascript
reconcileSkillsBySource(
  { version: "1.0.0", skills: [
    { name: "project-architecture", source: "discover", sourcePhase: "D1", file: "project-architecture.md", added_at: "2026-02-20T10:00:00.000Z", updated_at: "2026-02-20T10:00:00.000Z", bindings: { phases: ["all"] } },
    { name: "project-domain", source: "discover", sourcePhase: "D6", file: "project-domain.md", added_at: "2026-02-20T10:00:00.000Z", updated_at: "2026-02-20T10:00:00.000Z", bindings: { phases: ["all"] } }
  ]},
  "discover",
  [
    { name: "project-architecture", file: "project-architecture.md", description: "Updated", sourcePhase: "D1" }
  ],
  ["D1"]  // Only D1 ran, D6 did not
)
```

**Output**:
```javascript
{
  manifest: {
    version: "1.0.0",
    skills: [
      { name: "project-architecture", source: "discover", sourcePhase: "D1", file: "project-architecture.md", description: "Updated", added_at: "2026-02-20T10:00:00.000Z", updated_at: "2026-02-24T22:50:00.000Z", bindings: { phases: ["all"] } },
      { name: "project-domain", source: "discover", sourcePhase: "D6", file: "project-domain.md", added_at: "2026-02-20T10:00:00.000Z", updated_at: "2026-02-20T10:00:00.000Z", bindings: { phases: ["all"] } }
    ]
  },
  changed: true,
  added: [],
  removed: [],
  updated: ["project-architecture"]
}
```

Note: `project-domain` (sourcePhase D6) preserved because D6 was not in phasesExecuted.

#### Example 4: Phase ran but produced nothing -- skill removed

**Input**:
```javascript
reconcileSkillsBySource(
  { version: "1.0.0", skills: [
    { name: "project-test-landscape", source: "discover", sourcePhase: "D2", file: "project-test-landscape.md", added_at: "2026-02-20T10:00:00.000Z", bindings: { phases: ["all"] } }
  ]},
  "discover",
  [],  // D2 ran but produced nothing
  ["D2"]
)
```

**Output**:
```javascript
{
  manifest: { version: "1.0.0", skills: [] },
  changed: true,
  added: [],
  removed: ["project-test-landscape"],
  updated: []
}
```

#### Example 5: Legacy manifest (no source field)

**Input**:
```javascript
reconcileSkillsBySource(
  { version: "1.0.0", skills: [
    { name: "old-skill", file: "old-skill.md", bindings: { phases: ["all"] } }
  ]},
  "discover",
  [
    { name: "project-architecture", file: "project-architecture.md", description: "Arch", sourcePhase: "D1" }
  ],
  ["D1"]
)
```

**Output**:
```javascript
{
  manifest: {
    version: "1.0.0",
    skills: [
      { name: "old-skill", file: "old-skill.md", source: "user", bindings: { phases: ["all"] } },
      { name: "project-architecture", source: "discover", file: "project-architecture.md", description: "Arch", sourcePhase: "D1", added_at: "2026-02-24T22:50:00.000Z", updated_at: "2026-02-24T22:50:00.000Z", bindings: { phases: ["all"], agents: ["all"], injection_mode: "always", delivery_type: "context" } }
    ]
  },
  changed: true,
  added: ["project-architecture"],
  removed: [],
  updated: []
}
```

Note: `old-skill` gets `source: "user"` applied (read-time default) and is never touched by discover reconciliation.

#### Example 6: No changes (idempotent)

**Input**: Same manifest and incoming skills as a previous reconciliation, with no field differences.

**Output**:
```javascript
{
  manifest: { /* identical to input */ },
  changed: false,
  added: [],
  removed: [],
  updated: []
}
```

### Error Outputs

| Condition | Behavior |
|-----------|----------|
| `source` is `"user"` | Return `{ manifest: (unchanged), changed: false, added: [], removed: [], updated: [] }` |
| `incomingSkills` is not array | Return `{ manifest: (unchanged), changed: false, added: [], removed: [], updated: [] }` |
| `manifest` is null | Normalize to empty, then proceed normally |
| Incoming skill missing `name` | Skip that entry (do not add) |

---

## 2. Updated loadExternalManifest(projectId)

### Change Summary

No signature change. At read time, apply defaults to entries missing the `source` field:

```javascript
// After parsing manifest, normalize entries:
for (const skill of manifest.skills) {
  if (!skill.source) {
    skill.source = 'user';
  }
}
```

This ensures all downstream consumers always see a `source` field.

---

## 3. Updated writeExternalManifest(manifest, projectId)

### Change Summary

No signature change. No behavioral change. The function writes whatever manifest object it receives. The `source`, `added_at`, `updated_at`, and `sourcePhase` fields are included naturally as part of the skill entries.

---

## 4. removeSkillFromManifest(skillName, manifest)

### Change Summary

No change. This function remains name-based for user-driven removal via `/isdlc skill remove`. It does not inspect the `source` field -- users can remove any skill by name regardless of source.
