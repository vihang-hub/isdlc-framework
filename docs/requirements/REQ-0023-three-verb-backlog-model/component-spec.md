# Component Specifications: Three-Verb Backlog Model (REQ-0023)

**Phase**: 04-design
**Feature**: Three-verb backlog model (add/analyze/build)
**Version**: 1.0.0
**Created**: 2026-02-18

---

## 1. Reusable Components

This feature introduces 8 shared utility functions that are referenced by the three verb handlers. These utilities are defined inline in `isdlc.md` as pseudocode sections and implemented as inline logic within the command prompt (since isdlc.md is a markdown agent prompt, not executable code).

The hook changes are real JavaScript functions that run as executable code.

---

## 2. Component: readMetaJson

**Type**: Utility function (pseudocode in isdlc.md)
**Used by**: analyze handler, build handler
**Inputs**: `slugDir` -- path to the item's requirements directory
**Outputs**: Parsed meta.json object with v2 schema fields, or null

**Interface**:
```
readMetaJson(slugDir: string) -> MetaJson | null

MetaJson = {
  source: 'manual' | 'github' | 'jira' | 'backlog-migration',
  source_id: string | null,
  slug: string,
  created_at: string,
  updated_at: string | null,
  analysis_status: 'raw' | 'partial' | 'analyzed',
  phases_completed: string[],
  codebase_hash: string
}
```

**Error handling**:
- File not found: return null (ERR-META-001)
- Malformed JSON: return null, log ERR-META-002
- Legacy schema detected: apply migration in-memory (ERR-META-003)

**Validation rules applied**: VR-META-001 through VR-META-008, VR-MIGRATE-001 through VR-MIGRATE-004

---

## 3. Component: writeMetaJson

**Type**: Utility function (pseudocode in isdlc.md)
**Used by**: add handler, analyze handler
**Inputs**: `slugDir` -- path to directory, `meta` -- MetaJson object
**Outputs**: None (side effect: writes file)

**Interface**:
```
writeMetaJson(slugDir: string, meta: MetaJson) -> void
```

**Behavior**:
1. Delete `phase_a_completed` if present (never write legacy field)
2. Recompute `analysis_status` from `phases_completed` count for consistency
3. Write JSON with 2-space indentation

**Error handling**: ERR-META-004 on write failure

---

## 4. Component: generateSlug

**Type**: Utility function (pseudocode in isdlc.md)
**Used by**: add handler
**Inputs**: `description` -- user-provided text
**Outputs**: Sanitized slug string

**Interface**:
```
generateSlug(description: string) -> string
```

**Validation rules applied**: VR-SLUG-001 through VR-SLUG-003

---

## 5. Component: resolveItem

**Type**: Utility function (pseudocode in isdlc.md)
**Used by**: analyze handler, build handler
**Inputs**: `input` -- user-provided item reference
**Outputs**: Resolved item object or null

**Interface**:
```
resolveItem(input: string) -> ResolvedItem | null

ResolvedItem = {
  slug: string,
  dir: string,
  meta: MetaJson | null,
  backlogLine: string | null,
  itemNumber: string | null
}
```

**Resolution priority**: VR-RESOLVE-002 through VR-RESOLVE-006 (slug > number > external ref > fuzzy)

**Error handling**: ERR-RESOLVE-001 through ERR-RESOLVE-004

---

## 6. Component: updateBacklogMarker

**Type**: Utility function (pseudocode in isdlc.md)
**Used by**: analyze handler (after each phase)
**Inputs**: `slug` -- item slug, `newMarker` -- one of ' ', '~', 'A', 'x'
**Outputs**: None (side effect: modifies BACKLOG.md)

**Interface**:
```
updateBacklogMarker(slug: string, newMarker: MarkerChar) -> void
MarkerChar = ' ' | '~' | 'A' | 'x'
```

**Parsing**: Uses regex VR-MARKER-002
**Error handling**: ERR-BACKLOG-001 through ERR-BACKLOG-004

---

## 7. Component: appendToBacklog

**Type**: Utility function (pseudocode in isdlc.md)
**Used by**: add handler
**Inputs**: `itemNumber` -- N.N format, `description` -- item text, `marker` -- initial marker
**Outputs**: None (side effect: appends to BACKLOG.md)

**Interface**:
```
appendToBacklog(itemNumber: string, description: string, marker: MarkerChar) -> void
```

**Behavior**:
1. If BACKLOG.md missing: create with standard structure
2. Find `## Open` section
3. Insert new line before next `##` heading

---

## 8. Component: deriveAnalysisStatus

**Type**: Pure function (pseudocode in isdlc.md)
**Used by**: writeMetaJson, analyze handler
**Inputs**: `phasesCompleted` -- array of phase key strings
**Outputs**: Analysis status string

**Interface**:
```
deriveAnalysisStatus(phasesCompleted: string[]) -> 'raw' | 'partial' | 'analyzed'
```

**Logic**: VR-PHASE-003

---

## 9. Component: deriveBacklogMarker

**Type**: Pure function (pseudocode in isdlc.md)
**Used by**: analyze handler
**Inputs**: `analysisStatus` -- status string
**Outputs**: Marker character

**Interface**:
```
deriveBacklogMarker(analysisStatus: string) -> MarkerChar
```

**Mapping**: raw -> ' ', partial -> '~', analyzed -> 'A'

---

## 10. Component: EXEMPT_ACTIONS Set (Hook)

**Type**: JavaScript constant (executable code in .cjs hooks)
**Used by**: skill-delegation-enforcer.cjs, delegation-gate.cjs
**Value**: `new Set(['add', 'analyze'])`

**Interface**:
```javascript
const EXEMPT_ACTIONS = new Set(['add', 'analyze']);
// Usage: EXEMPT_ACTIONS.has(action.toLowerCase())
```

**Behavior**:
- In skill-delegation-enforcer: Skip writing pending_delegation marker and skip mandatory delegation message
- In delegation-gate: Auto-clear pending_delegation marker without blocking

**Critical invariant**: `build` is NOT in EXEMPT_ACTIONS. It must go through orchestrator delegation.

---

## 11. Component Dependency Graph

```
add handler
  |-- generateSlug
  |-- readMetaJson (collision check)
  |-- writeMetaJson (new meta)
  |-- appendToBacklog

analyze handler
  |-- resolveItem
  |     |-- readMetaJson (per-item check)
  |     |-- BACKLOG.md line scan
  |-- readMetaJson (target item)
  |-- writeMetaJson (after each phase)
  |-- deriveAnalysisStatus
  |-- deriveBacklogMarker
  |-- updateBacklogMarker

build handler
  |-- resolveItem
  |-- readMetaJson (informational)
  |-- (delegates to orchestrator for workflow init)

EXEMPT_ACTIONS (hook)
  |-- (standalone constant, no dependencies)
```

---

## 12. Cross-Cutting Concerns

### 12.1 Line Ending Handling (NFR-005)

All file read operations in utilities normalize line endings:
```
lines = content.split(/\r?\n/)  // Handles both LF and CRLF
```
Write operations use LF only (platform standard for JSON and markdown).

### 12.2 Path Handling (Article XII)

All file path construction uses `path.join()` or `path.resolve()`:
```
// In pseudocode, represented as path.join(base, relative)
// Implementation: literal path concatenation is forbidden
```

### 12.3 Monorepo Scoping (NFR-006)

In monorepo mode, all `docs/requirements/` references are scoped:
```
// Single project: docs/requirements/{slug}/
// Monorepo: docs/{project-id}/requirements/{slug}/
// Resolution: use project context from delegation prompt
```
