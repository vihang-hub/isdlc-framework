# ADR-0013: meta.json Schema Migration (Read-Time Conversion)

## Status
Accepted

## Context
The existing `meta.json` schema uses a boolean `phase_a_completed` field to track whether Phase A preparation is done. The three-verb model (REQ-0023) replaces this with a more granular tracking system:

- `analysis_status`: enum ("raw", "partial", "analyzed") -- the overall analysis state
- `phases_completed`: array of phase key strings -- which specific phases are done

There are 3 existing meta.json files in the project (REQ-0020, REQ-0021, REQ-0022), all with `phase_a_completed: true`.

Three migration approaches were considered:
1. **Batch migration**: Script rewrites all existing files to new schema
2. **Read-time migration**: Convert in-memory when reading, never rewrite files
3. **Dual-write**: Write both old and new fields during transition period

## Decision
Use **read-time migration**. When reading a meta.json file, detect the legacy schema (`phase_a_completed` exists, `analysis_status` does not) and convert in-memory. Never rewrite existing files.

Migration rules:
- `phase_a_completed: true` maps to `analysis_status: "analyzed"`, `phases_completed: [all 5 phases]`
- `phase_a_completed: false` or missing maps to `analysis_status: "raw"`, `phases_completed: []`

New meta.json files created by the `add` verb use the v2 schema exclusively. The `phase_a_completed` field is never written by new code.

## Consequences

**Positive:**
- Zero-risk migration: no existing files are modified
- No migration script to write, test, or maintain
- Backward compatible: old code ignores unknown fields, new code converts old fields
- Works immediately for the 3 existing files without any batch operation
- Supports resumable analysis (NFR-003): phases_completed tracks granular progress

**Negative:**
- Legacy files remain in v1 format on disk indefinitely
- Read-time conversion adds minimal overhead (~1ms per read, negligible)
- If phases_completed is empty for a migrated "analyzed" file, and the user asks to re-analyze, all 5 phases are populated (which is correct behavior -- Phase A did run all phases)

## Alternatives Considered
- **Batch migration**: Risk of corrupting existing files. Requires a migration script. Over-engineering for 3 files. Rejected per Article V.
- **Dual-write**: Complexity of maintaining two schemas. Confusing for developers. Rejected per Article V.
- **Schema version field**: Adding `"schema_version": 2` would require checking every meta.json reader. The `phase_a_completed` presence check is simpler and sufficient.

## Traces
- FR-009 (meta.json schema update)
- AC-009-01 through AC-009-05
- NFR-001 (Backward compatibility)
- Article V (Simplicity First), Article XIV (State Management Integrity)
