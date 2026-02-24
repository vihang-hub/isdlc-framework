# ADR-0014: BACKLOG.md Four-State Marker System

## Status
Accepted

## Context
BACKLOG.md currently uses two markers:
- `[ ]` for open/unchecked items
- `[x]` for completed items

The three-verb model (REQ-0023) introduces analysis as an explicit lifecycle stage between "added" and "building". Users need to see which items have been analyzed and are ready to build.

Four marker states are needed:
1. Raw (added, not analyzed)
2. Partially analyzed (some phases done)
3. Fully analyzed (all 5 phases done, ready to build)
4. Completed (workflow finished)

## Decision
Extend the existing BACKLOG.md marker format with two new characters:

| Marker | Character | Meaning |
|--------|-----------|---------|
| `[ ]` | space | Raw -- added but not analyzed |
| `[~]` | tilde | Partially analyzed (1-4 of 5 phases) |
| `[A]` | uppercase A | Fully analyzed (all 5 phases, ready to build) |
| `[x]` | lowercase x | Completed (workflow finished) |

The format remains a standard markdown checkbox pattern: `- N.N [M] description`

Parsing regex: `/^(\s*-\s+)(\d+\.\d+)\s+\[([ ~Ax])\]\s+(.+)$/`

## Consequences

**Positive:**
- Human-readable: developers see analysis status at a glance when reading BACKLOG.md
- Human-editable: markers can be changed manually if needed
- Backward compatible: existing `[ ]` and `[x]` items parse correctly without modification
- Simple regex: 4-character set in a bracket, no complex parsing needed
- Progressive: `[ ]` -> `[~]` -> `[A]` -> `[x]` shows natural progression

**Negative:**
- `[~]` and `[A]` are non-standard markdown checkbox markers -- they will not render as actual checkboxes in GitHub/VS Code markdown preview
- BACKLOG.md is a human-edited file; users might accidentally use wrong marker characters
- No automated enforcement that markers match meta.json analysis_status (consistency maintained by analyze verb)

## Alternatives Considered
- **Emoji markers**: `[ ]`, `[~]`, `[*]`, `[x]` -- asterisk is ambiguous. Tilde is more distinct.
- **Full-word markers**: `[raw]`, `[partial]`, `[analyzed]`, `[done]` -- too wide, breaks alignment
- **Separate status column**: `- N.N [ ] description | status: partial` -- breaks existing format, harder to parse
- **YAML/JSON backlog**: Machine-friendly but loses human readability -- violates Article V
- **Numbers**: `[0]`, `[1-4]`, `[5]`, `[x]` -- less intuitive than the chosen set

## Traces
- FR-007 (BACKLOG.md markers)
- AC-007-01 through AC-007-06
- NFR-001 (Backward compatibility)
- Article IV (Explicit Over Implicit), Article VIII (Documentation Currency)
