# Requirements Specification: BUG-0036-MAN

**Bug ID:** BUG-0036
**Artifact Folder:** BUG-0036-roundtable-sequential-writes
**External ID:** MAN
**Date:** 2026-02-24
**Scope:** Documentation fix (agent instructions)

---

## Context

The roundtable-analyst agent (`src/claude/agents/roundtable-analyst.md`) writes 11 artifacts during finalization. Section 5.5 Turn 2 instructs the agent to write all artifacts in parallel, but the original 2-line instruction was too weak to override the agent's default sequential behavior. This caused finalization to take ~5.5 minutes instead of ~30 seconds.

## Fix Requirement

**FR-001:** Strengthen Section 5.5 Turn 2 of `src/claude/agents/roundtable-analyst.md` to enforce parallel artifact writing during finalization.

The strengthened instructions must include:

1. An explicit anti-pattern prohibition (forbid sequential one-artifact-per-turn writing)
2. A memory-first generation requirement (all content generated before any Write calls)
3. A parallel write mandate (all Write calls in a single response)
4. A batching fallback (owner-based 2-batch maximum if tool-call capacity is exceeded)

## Acceptance Criteria

### AC-001-01: Anti-pattern prohibition is documented

- **Given** a developer reads Section 5.5 Turn 2 of roundtable-analyst.md
- **When** they look for guidance on artifact writing behavior
- **Then** they find an explicit prohibition against writing one artifact per turn (the sequential generate-write-generate-write loop)

### AC-001-02: Memory-first generation is required

- **Given** the roundtable-analyst agent enters Turn 2 of finalization
- **When** it processes the Turn 2 instructions
- **Then** the instructions require generating ALL artifact content in memory before issuing any Write tool calls

### AC-001-03: Parallel write is mandated

- **Given** the roundtable-analyst agent has generated all artifact content in memory
- **When** it proceeds to write artifacts
- **Then** the instructions mandate issuing ALL Write tool calls in a SINGLE response (up to 11 parallel calls)

### AC-001-04: Batching fallback is specified

- **Given** the agent cannot issue all 11 Write calls in a single response
- **When** it needs a fallback strategy
- **Then** the instructions specify owner-based batching with a maximum of 2 responses:
  - Batch A: quick-scan.md, requirements-spec.md, user-stories.json, traceability-matrix.csv, impact-analysis.md, architecture-overview.md
  - Batch B: module-design.md, interface-spec.md, error-taxonomy.md, data-flow.md, design-summary.md

### AC-001-05: Fix is contained to documented scope

- **Given** the fix has been applied
- **When** reviewing the changed file
- **Then** only `src/claude/agents/roundtable-analyst.md` Section 5.5 Turn 2 (lines 467-476) has been modified, and no other files or sections are affected

## Out of Scope

- Runtime enforcement of parallel writes (no hook or code validation)
- Changes to other agent files or finalization sequences
- Performance benchmarking of the fix (improvement is estimated, not measured)

## Constraints

- **CON-001:** This is a documentation-only change. No code, hooks, or runtime logic are modified.
- **CON-002:** The fix must not alter the content or format of the 11 artifacts — only the write sequencing behavior.
