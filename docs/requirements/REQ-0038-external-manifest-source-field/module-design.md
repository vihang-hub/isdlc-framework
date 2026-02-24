# Module Design: REQ-0038 External Manifest Source Field

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-02-24
**Coverage**: Full

---

## Module: Manifest Reconciliation (in common.cjs)

### Responsibility

Provide source-aware reconciliation of external skill manifest entries. Merges incoming skills from a specific source into the manifest while preserving user-owned fields and respecting phase execution boundaries.

### Public Interface

#### `reconcileSkillsBySource(manifest, source, incomingSkills, phasesExecuted)`

Reconciles incoming skills into the manifest for a given source. Pure function -- operates on the manifest object in memory, does not write to disk.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `manifest` | `object \| null` | Yes | The current manifest object (from `loadExternalManifest()`). If null, treated as `{ version: "1.0.0", skills: [] }` |
| `source` | `string` | Yes | The source identifier: `"discover"` or `"skills.sh"` |
| `incomingSkills` | `Array<IncomingSkill>` | Yes | Skills to reconcile into the manifest |
| `phasesExecuted` | `Array<string> \| null` | Yes | List of source phases that ran (e.g., `["D1", "D2"]`). If null or empty, no existing entries are removed. |

**IncomingSkill shape**:

```javascript
{
  name: string,           // Skill name (match key)
  file: string,           // Skill file name in .claude/skills/external/
  description: string,    // Skill description
  sourcePhase: string,    // Which source phase produced this skill (e.g., "D1", "D2", "D6")
  bindings: object | null // Default bindings for new entries (ignored for existing entries)
}
```

**Return value**:

```javascript
{
  manifest: object,       // The updated manifest object
  changed: boolean,       // Whether any modifications were made
  added: string[],        // Names of newly added skills
  removed: string[],      // Names of removed skills
  updated: string[]       // Names of skills whose content was refreshed
}
```

### Internal Logic

```
1. Normalize manifest (null -> empty)
2. Normalize source on all existing entries (missing source -> "user")
3. Partition existing skills:
   a. sameSource = entries where effective source matches input source
   b. otherSource = entries where effective source does NOT match
4. For each entry in sameSource:
   a. If matching incoming skill exists (by name):
      - Update source-owned fields: file, description, updated_at
      - Preserve user-owned fields: bindings, added_at
      - Add name to "updated" list
   b. If no matching incoming skill AND entry's sourcePhase is in phasesExecuted:
      - Mark for removal, add name to "removed" list
   c. If no matching incoming skill AND entry's sourcePhase is NOT in phasesExecuted:
      - Preserve untouched (phase didn't run, can't determine relevance)
5. For each incoming skill with no existing match:
   - Create new entry with all fields, added_at = now, updated_at = now
   - Add name to "added" list
6. Merge: otherSource + surviving sameSource + new entries
7. Return { manifest, changed, added, removed, updated }
```

### Data Structures

#### Manifest Entry Schema (post-change)

```javascript
{
  name: string,               // Skill identifier
  file: string,               // File name in .claude/skills/external/
  source: "discover" | "skills.sh" | "user",  // Who registered this skill
  description: string,        // Human-readable description
  added_at: string,           // ISO-8601 timestamp, set once on creation
  updated_at: string | null,  // ISO-8601 timestamp, updated on each reconciliation
  bindings: {                 // User-owned, preserved across reconciliation
    phases: string[],         // Which workflow phases this skill is active in
    agents: string[],         // Which agents receive this skill
    injection_mode: string,   // "always" | "manual"
    delivery_type: string     // "context" | "instruction" | "reference"
  }
}
```

#### Source-Phase Mapping (for discover source)

```javascript
const DISCOVER_SKILL_PHASE_MAP = {
  "project-architecture": "D1",
  "project-conventions": "D1",
  "project-domain": "D6",
  "project-test-landscape": "D2"
};
```

This mapping is used to determine which existing discover-sourced skills are eligible for removal based on `phasesExecuted`. The mapping could be:
- Stored as a constant in common.cjs (simple, but couples common.cjs to discover's skill names)
- Passed in via the `sourcePhase` field on each IncomingSkill (decoupled, recommended)

**Recommendation**: Use the `sourcePhase` field on IncomingSkill. Existing entries need a `sourcePhase` field too, set on creation. This keeps common.cjs decoupled from discover's naming conventions.

### Dependencies

| Dependency | Direction | Interface |
|------------|-----------|-----------|
| `loadExternalManifest()` | Upstream (caller loads, passes in) | Returns manifest object |
| `writeExternalManifest()` | Downstream (caller writes after reconciliation) | Accepts manifest object |
| `removeSkillFromManifest()` | Sibling (unchanged) | Used for user-driven removal by name |

### Estimated Size

- ~60-80 lines for `reconcileSkillsBySource()`
- ~10 lines for `sourcePhase` field handling in entry creation paths
- ~0 lines for schema change (JSON field, no code-level schema enforcement)
- **Total**: ~70-90 new lines in common.cjs
