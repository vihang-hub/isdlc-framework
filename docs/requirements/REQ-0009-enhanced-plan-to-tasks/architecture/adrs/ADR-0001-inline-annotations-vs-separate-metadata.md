# ADR-0001: Inline Annotations vs Separate Metadata File

## Status

Accepted

## Context

The enhanced tasks.md format needs to carry additional metadata per task: traceability tags (REQ-NNN, AC-NNx), dependency annotations (blocked_by, blocks), and file-level details (target files, CREATE/MODIFY). Two approaches were evaluated:

**Option A: Inline Annotations** -- Embed metadata directly in tasks.md using sub-lines below each checkbox line and pipe-delimited annotations on the task line itself.

**Option B: Separate Metadata File** -- Keep tasks.md as a pure checkbox file and store metadata in a companion `tasks-metadata.json` keyed by TNNNN IDs.

### Evaluation Criteria

| Criterion | Option A (Inline) | Option B (Separate) |
|-----------|-------------------|---------------------|
| Backward compatibility | HIGH -- checkbox lines unchanged; metadata on sub-lines ignored by existing parsers | HIGH -- tasks.md unchanged; metadata in separate file |
| Single source of truth | HIGH -- one file to read/write | LOW -- two files must stay in sync |
| Human readability | HIGH -- context visible inline | LOW -- must cross-reference two files |
| Agent complexity | MEDIUM -- agents must not strip sub-lines | LOW -- agents only touch tasks.md |
| Failure mode | SAFE -- metadata loss means fallback to standard mode | RISKY -- desync between files means stale/incorrect metadata |
| Article XIV compliance | HIGH -- single file, no shadow state | VIOLATES -- separate metadata file creates shadow state |

## Decision

Use **inline annotations** (Option A). Metadata is embedded directly in tasks.md using:
- Pipe-delimited annotations on the task line: `- [ ] T0001 Description | traces: FR-01, AC-01a`
- Indented sub-lines for structured metadata: `  blocked_by: [T0002, T0003]` and `  files: src/foo/bar.js (MODIFY)`
- Dedicated sections at the end: `## Dependency Graph` and `## Traceability Matrix`

## Consequences

**Positive:**
- Single file authority preserved (Article XIV: no shadow state)
- Human-readable: developer can see traceability and dependencies at a glance
- Backward compatible: existing `[X]`/`[ ]` parsing only reads the checkbox line, sub-lines are ignored
- Extensible: pipe-delimited format allows adding future keys (`| effort: 2h | priority: P0`) without format changes

**Negative:**
- tasks.md grows larger (estimated 2-3x for file-level tasks)
- PLAN INTEGRATION PROTOCOL update must instruct agents to preserve sub-lines when toggling checkboxes
- The generate-plan skill (ORCH-012) becomes more complex with multi-line output generation

## Traces

- FR-06 (Enhanced Tasks.md Format), AC-06a through AC-06g
- NFR-04 (Extensibility)
- C-02 (Single File Authority)
- Article XIV (State Management Integrity)
