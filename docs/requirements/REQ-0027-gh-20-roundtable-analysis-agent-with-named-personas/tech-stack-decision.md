# Technology Stack Decision: Roundtable Analysis Agent

**Feature ID**: REQ-ROUNDTABLE-ANALYST (GH-20)
**Phase**: 03-architecture
**Date**: 2026-02-19

---

## Summary

This feature introduces zero new dependencies and zero new technology choices. All components use existing iSDLC patterns and technologies. This document records the explicit decision to extend existing patterns rather than introduce new ones.

---

## 1. Agent Definition Format

**Choice**: Markdown agent file with YAML frontmatter

**Rationale**:
- All 28 existing agents use this format
- Claude Code natively parses this format for agent discovery
- No tooling changes needed
- Frontmatter supports `name`, `description`, `model`, `owned_skills` fields

**Alternatives Considered**:
- JSON agent definitions: Would require a new parser, breaks convention
- TypeScript/JavaScript agent definitions: Would require a build step, breaks the markdown-native pattern

---

## 2. Step File Format

**Choice**: Markdown files with YAML frontmatter, organized in directory hierarchy

**Rationale**:
- Consistent with agent file format (markdown + YAML frontmatter)
- Self-contained: each step file includes metadata and content in one file
- Human-readable: maintainers can edit step files without special tooling
- Directory-based discovery: the roundtable agent lists files in a directory and sorts by prefix
- No compilation or registration step needed (NFR-004: drop a file, it gets discovered)

**Alternatives Considered**:
- JSON step definitions: Less readable for prompt content, harder to author
- Skill manifest registration: Would require updating skills-manifest.json for each step (requirements Section 7 explicitly ruled this out)
- YAML-only files: Would lose the rich markdown body for prompts and instructions
- Database/structured store: Violates the framework's filesystem-only design

**Schema** (YAML frontmatter fields):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `step_id` | string | Yes | Globally unique ID (e.g., "01-03") |
| `title` | string | Yes | Display name shown in step headers |
| `persona` | string | Yes | One of: "business-analyst", "solutions-architect", "system-designer" |
| `depth` | string | Yes | Default depth: "brief", "standard", or "deep" |
| `outputs` | string[] | Yes | Artifact keys this step produces/updates |
| `depends_on` | string[] | No | Step IDs that must complete first |
| `skip_if` | string | No | Condition expression for skipping (e.g., "scope === 'small'") |

---

## 3. State Persistence

**Choice**: Extend existing meta.json schema with optional fields

**Rationale**:
- meta.json is already the persistence mechanism for analysis progress
- `readMetaJson()` and `writeMetaJson()` already handle defensive defaults
- Adding optional fields with defaults is backward-compatible by design
- No migration needed: absent fields default to `[]` and `{}`

**Alternatives Considered**:
- Separate steps-state.json file: Would split state across two files, complicating resumption logic
- state.json extensions: Explicitly prohibited by CON-003 (analyze verb must not write state.json)
- SQLite or other database: Violates the framework's JSON-on-filesystem design

**New fields**:
- `steps_completed`: `string[]`, default `[]`
- `depth_overrides`: `object`, default `{}`

---

## 4. Step Discovery Mechanism

**Choice**: Directory listing with numeric prefix sorting

**Rationale**:
- Simple: `ls` the directory, filter `.md` files, sort by filename
- Deterministic: numeric prefixes (`01-`, `02-`, etc.) ensure consistent ordering across file systems (addresses risk R6 from impact analysis)
- Extensible: new steps are discovered automatically (NFR-004)

**Alternatives Considered**:
- Manifest file listing step order: Would require updating a manifest when adding steps, reducing extensibility
- `step_id` ordering: Would require parsing every file to determine order, slower than filename sort
- Configuration in the agent file: Would couple step definitions to the agent, violating separation of concerns

---

## 5. Persona Implementation

**Choice**: Inline definitions within the agent markdown file

**Rationale**:
- CON-001 mandates a single agent file
- Three personas are a fixed, small set -- inline definitions are appropriate
- The persona definitions are part of the agent's system prompt, not data
- No runtime loading or parsing overhead

**Alternatives Considered**:
- Separate persona files (e.g., `personas/maya-chen.md`): Prohibited by CON-001
- JSON persona definitions: Would separate data from behavior, adding indirection
- Persona registry/manifest: Over-engineering for 3 fixed personas

---

## 6. Delegation Protocol

**Choice**: Task tool delegation from isdlc.md to roundtable-analyst

**Rationale**:
- Identical pattern to existing phase agent delegation
- Task tool provides isolated execution context (important for persona isolation)
- isdlc.md already has the delegation infrastructure in step 7
- No new delegation mechanism needed

**Alternatives Considered**:
- Direct inline execution (no Task tool): Would not provide context isolation between personas
- Skill tool invocation: Skills are for atomic operations, not multi-step interactive sessions
- Sub-agent spawning: Not a pattern in the framework; Task tool is the standard

---

## 7. Menu System Implementation

**Choice**: Text-based menu presented as markdown output, parsed from user input

**Rationale**:
- Consistent with existing iSDLC menu patterns (A/R/C in requirements analyst, Y/n at phase boundaries)
- No UI framework needed -- plain text works in terminal
- User can also type naturally (FR-007 AC-007-04)

**Menu format**:
```
[E] Elaboration Mode -- bring all perspectives to discuss this topic
[C] Continue -- move to the next step
[S] Skip remaining steps in this phase
```

Or type naturally to provide feedback.

---

## 8. Testing Approach

**Choice**: CJS test file extending existing test patterns

**Rationale**:
- `three-verb-utils.cjs` is CommonJS, tested with CJS test files
- New test file `test-three-verb-utils-steps.test.cjs` follows existing naming convention
- Uses `node:test` and `node:assert/strict` (existing framework)
- Agent behavior (persona switching, step execution) cannot be unit-tested -- it is validated through integration testing (manual or future automated)

**Test scope**:
- `readMetaJson()` defaulting new fields
- `writeMetaJson()` preserving new fields
- Backward compatibility: existing tests continue to pass

---

## Dependencies Summary

| Category | Technology | Status | Change |
|----------|-----------|--------|--------|
| Runtime | Node.js 18+ | Existing | None |
| Agent format | Markdown + YAML | Existing | None |
| State format | JSON (meta.json) | Existing | 2 optional fields added |
| Delegation | Task tool | Existing | None |
| Testing | node:test + node:assert | Existing | 1 new test file |
| File I/O | fs module (CJS) | Existing | None |
| Build system | None | N/A | N/A |
| New npm packages | None | N/A | N/A |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-19 | Solution Architect (Phase 03) | Initial technology decisions |
