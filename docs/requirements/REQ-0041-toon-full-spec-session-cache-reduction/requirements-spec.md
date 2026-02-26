# Requirements Specification: REQ-0041 TOON Full Spec Session Cache Reduction

| Field | Value |
|-------|-------|
| **Status** | Complete |
| **Confidence** | High |
| **Last Updated** | 2026-02-26 |
| **Coverage** | Business Context, Stakeholders, User Journeys, Technical Context, Quality Attributes, Functional Requirements, Out of Scope, MoSCoW |

---

## 1. Business Context

### Problem Statement

The iSDLC session cache consumes ~44% of the LLM context window at session start (~44,400 tokens after `/clear`). Every token consumed by framework context is a token unavailable for the developer's actual conversation. Longer analysis sessions, complex implementations, and multi-phase workflows all suffer from this context pressure.

REQ-0040 introduced a TOON encoder to address this, but the encoder only implements tabular array encoding (`isUniformArray()` guard). Since all four JSON sections in the cache are nested objects (not uniform arrays), the encoder never activates -- achieving 0% reduction.

The full TOON specification supports nested objects via indentation, key-value pairs without quotes, inline primitive arrays, and mixed array list forms. These features map directly to the data structures in the cache's JSON sections.

### Success Criteria

- All four JSON sections in the session cache are TOON-encoded when the cache is rebuilt
- Combined reduction of at least 25% across JSON sections (conservative target; analysis estimates 33%)
- Zero behavioral change for any agent, hook, or CLI operation consuming the original source files
- Fail-open safety: any encoding failure falls back to JSON for that section

### Cost of Inaction

The session cache remains at 44% context consumption. As the framework grows (more skills, more phases, more configuration), this percentage will increase, progressively limiting conversation depth. The TOON encoder from REQ-0040 remains dead code that never activates.

## 2. Stakeholders and Personas

### Primary User: Framework Developer

A developer using iSDLC to manage their development workflow. They interact with the framework through natural conversation. They never see the session cache directly but experience its impact through context window limits -- shorter conversations, earlier context truncation, and degraded quality in long sessions.

**Pain point**: Context window fills up during multi-phase workflows, forcing `/clear` or losing earlier conversation context.

### Secondary User: Framework Maintainer

A developer maintaining the iSDLC framework itself. They modify configuration files (`skills-manifest.json`, `workflows.json`, `iteration-requirements.json`) and need the cache to reflect those changes accurately.

**Pain point**: Adding new skills, phases, or configuration options increases cache size with no optimization layer.

### Automated Consumer: LLM Context Window

The Claude model reads the session cache as injected context. It must extract the same information from TOON-encoded content as from JSON -- skill lookups, phase requirements, workflow definitions, artifact paths.

**Constraint**: Behavioral equivalence. The LLM must make identical decisions regardless of encoding format.

## 3. User Journeys

### Journey 1: Developer Starts a Session

1. Developer opens Claude Code in their project
2. `inject-session-cache.cjs` hook fires, reads `.isdlc/session-cache.md`, pipes to context
3. LLM receives cache content in TOON format for JSON sections, markdown for other sections
4. Developer begins conversation; ~35% of context consumed (down from ~44%) leaving more room

**Happy path**: Cache loads, TOON sections are parsed correctly by LLM, all framework features work.

**Error path**: TOON encoding failed during cache rebuild; JSON fallback was used. Developer sees no difference -- cache is slightly larger but fully functional.

### Journey 2: Maintainer Adds Configuration

1. Maintainer edits `iteration-requirements.json` to add a new phase
2. Cache is rebuilt (manually via `bin/rebuild-cache.js` or triggered by hooks)
3. `rebuildSessionCache()` encodes the updated JSON through `encodeValue()`
4. New phase configuration appears in TOON format in the cache
5. All agents consuming that configuration at runtime still read the original JSON file directly

**Happy path**: New configuration is TOON-encoded, cache size increase is minimized.

**Error path**: New configuration structure is unexpected; `encodeValue()` falls back to JSON for that section. Maintainer can investigate via `--verbose` flag.

## 4. Technical Context

### Current Architecture

- **TOON encoder**: `src/claude/hooks/lib/toon-encoder.cjs` (304 lines, 47 tests)
  - Exports: `encode()`, `decode()`, `isUniformArray()`, `serializeValue()`, `deserializeValue()`, `splitRow()`
  - Only handles uniform arrays of objects (tabular format)
- **Cache builder**: `rebuildSessionCache()` in `src/claude/hooks/lib/common.cjs` (lines 4093-4290)
  - Assembles 8 sections from source files
  - TOON integration exists only for SKILLS_MANIFEST section (lines 4147-4172)
  - Falls through to JSON because `isUniformArray()` returns false for nested objects
- **Cache injector**: `src/claude/hooks/inject-session-cache.cjs` (26 lines)
  - Reads cache file, writes to stdout -- no parsing, no transformation
- **Cache file**: `.isdlc/session-cache.md` (177,704 chars, 4,531 lines)

### Data Structure Characteristics

| Section | Nesting Depth | Key Feature Opportunities |
|---------|--------------|--------------------------|
| SKILLS_MANIFEST | 6 | Nested objects (ownership), flat key-value map (skill_lookup, 243 entries), inline arrays (skills per agent) |
| ITERATION_REQUIREMENTS | 7 | Deeply nested objects (phase > section > config), inline arrays (articles, paths), _comment stripping |
| WORKFLOW_CONFIG | 6 | Nested objects (workflow > config), inline arrays (phases), nested sub-objects (options, sizing, budgets) |
| ARTIFACT_PATHS | 3 | Nested objects (phases > config), inline arrays (paths) |

### Consumer Analysis

The session cache file has exactly two code touchpoints:
1. **Writer**: `rebuildSessionCache()` -- assembles and writes the file
2. **Reader**: `inject-session-cache.cjs` -- reads raw and pipes to stdout

No code parses the cache file programmatically. The LLM is the sole semantic consumer. A TOON decoder is needed only for round-trip test verification, not for production use.

## 5. Quality Attributes and Risks

### QA-001: Behavioral Equivalence

The LLM must extract identical information from TOON-encoded sections as from JSON. This is validated by the TOON specification benchmarks (equal or better LLM accuracy at 39.6% fewer tokens) and by manual verification during implementation.

### QA-002: Fail-Open Safety

Any failure in TOON encoding must fall back to JSON for the affected section. The cache rebuild must never fail due to encoding errors. This continues the pattern established by REQ-0040 (ADR-0040-03).

### QA-003: Performance

Cache rebuild time must not regress significantly. The TOON encoding pass adds CPU work but operates on small data sets (max 20K chars per section). Target: < 100ms additional time.

### QA-004: Backward Compatibility

The existing `encode()` and `decode()` APIs must continue to work unchanged. New functionality is additive (`encodeValue()`, `decodeValue()`).

### Risk Register

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|-----------|--------|------------|
| R-001 | LLM misinterprets TOON format for certain data patterns | Low | High | Fail-open fallback; manual testing with representative cache sections |
| R-002 | Edge case in encoder causes cache rebuild failure | Low | Medium | Per-section try/catch with JSON fallback; comprehensive test suite |
| R-003 | Future JSON config changes introduce unsupported structures | Medium | Low | `encodeValue()` handles arbitrary JS values; truly exotic structures fall back to JSON.stringify |
| R-004 | TOON encoding of certain values produces ambiguous output | Low | Medium | Round-trip test suite validates encode-decode fidelity |

## 6. Functional Requirements

### FR-001: Nested Object Encoding

**Confidence**: High

The TOON encoder SHALL support encoding plain JavaScript objects into indentation-based TOON format, where each nesting level uses two-space indentation and key-value pairs are expressed as `key: value` without braces or key quoting.

**Acceptance Criteria**:

- **AC-001-01**: Given a plain object `{a: 1, b: "hello"}`, the encoder produces `a: 1\nb: hello` (no braces, no key quotes, no value quotes for simple strings).
- **AC-001-02**: Given a nested object `{a: {b: {c: 1}}}`, the encoder produces indentation-based nesting with two spaces per level.
- **AC-001-03**: Given an object with mixed value types (string, number, boolean, null), each value is serialized per the existing `serializeValue()` rules.
- **AC-001-04**: Given an object at the top level of a cache section, the encoder walks the full object graph recursively.

### FR-002: Key-Value Pair Encoding

**Confidence**: High

The TOON encoder SHALL encode all object keys as bare unquoted identifiers followed by `: ` and the serialized value.

**Acceptance Criteria**:

- **AC-002-01**: Object keys are emitted without surrounding double quotes.
- **AC-002-02**: String values that contain no special characters (comma, double quote, newline, backslash) are emitted bare without quotes.
- **AC-002-03**: String values containing special characters are double-quoted and escaped per existing `serializeValue()` rules.

### FR-003: Inline Primitive Array Encoding

**Confidence**: High

The TOON encoder SHALL encode arrays containing only primitive values (strings, numbers, booleans) in inline format: `key[N]: v1,v2,...` where N is the array length.

**Acceptance Criteria**:

- **AC-003-01**: Given an array of strings `["a", "b", "c"]` as a value for key `tags`, the encoder produces `tags[3]: a,b,c`.
- **AC-003-02**: Given an array of numbers `[1, 2, 3]` as a value for key `ids`, the encoder produces `ids[3]: 1,2,3`.
- **AC-003-03**: Given an array of mixed primitives `["a", 1, true, null]`, the encoder produces inline format with appropriate serialization for each element.
- **AC-003-04**: Given an empty array, the encoder produces `key[0]:` (empty inline array).
- **AC-003-05**: Primitive values within inline arrays that contain commas are double-quoted and escaped.

### FR-004: Non-Uniform/Mixed Array Encoding

**Confidence**: High

The TOON encoder SHALL encode arrays containing objects or mixed complex types in list form using `- ` prefix with indented content beneath each item.

**Acceptance Criteria**:

- **AC-004-01**: Given an array of non-uniform objects, each element is encoded as a `- ` prefixed list item with nested content indented beneath.
- **AC-004-02**: Given an array of mixed types (objects and primitives), the encoder uses list form for all elements.
- **AC-004-03**: Nested objects within list items are indented relative to the `- ` prefix.

### FR-005: Uniform Array Tabular Delegation

**Confidence**: High

When `encodeValue()` encounters a uniform array of objects (as defined by the existing `isUniformArray()` function), it SHALL delegate to the existing `encode()` function to produce the tabular `[N]{fields}:` format.

**Acceptance Criteria**:

- **AC-005-01**: Given a uniform array of objects, `encodeValue()` produces identical output to `encode()`.
- **AC-005-02**: The `isUniformArray()` check is performed before falling back to list form.

### FR-006: Key Stripping

**Confidence**: High

The TOON encoder SHALL support an optional `stripKeys` parameter that omits specified keys from the output.

**Acceptance Criteria**:

- **AC-006-01**: Given `stripKeys: ['_comment']` and an object containing `_comment` keys at any nesting level, those keys and their values are omitted from the output.
- **AC-006-02**: Key stripping applies recursively to all nesting levels.
- **AC-006-03**: When `stripKeys` is not provided or empty, all keys are included.

### FR-007: Cache Builder Integration

**Confidence**: High

The `rebuildSessionCache()` function SHALL use `encodeValue()` for all four JSON sections (SKILLS_MANIFEST, ITERATION_REQUIREMENTS, WORKFLOW_CONFIG, ARTIFACT_PATHS) with fail-open JSON fallback per section.

**Acceptance Criteria**:

- **AC-007-01**: Each JSON section attempts TOON encoding via `encodeValue()`.
- **AC-007-02**: If TOON encoding succeeds, the section content is prefixed with `[TOON]` marker.
- **AC-007-03**: If TOON encoding throws or returns empty/invalid output, the section falls back to `JSON.stringify(data, null, 2)`.
- **AC-007-04**: The `--verbose` flag logs encoding statistics (JSON chars, TOON chars, reduction percentage) to stderr for each section.
- **AC-007-05**: The `_comment` keys are stripped from all JSON sections via `stripKeys: ['_comment']`.

### FR-008: Round-Trip Decoder

**Confidence**: Medium

The TOON encoder module SHALL export a `decodeValue()` function capable of parsing TOON-encoded output back to JavaScript values for test verification.

**Acceptance Criteria**:

- **AC-008-01**: `decodeValue()` correctly parses indentation-based nested objects.
- **AC-008-02**: `decodeValue()` correctly parses inline primitive arrays (`key[N]: v1,v2,...`).
- **AC-008-03**: `decodeValue()` correctly parses list-form arrays (`- ` prefix).
- **AC-008-04**: `decodeValue()` correctly parses bare and quoted key-value pairs.
- **AC-008-05**: Round-trip test: for representative cache data, `decodeValue(encodeValue(data))` deep-equals the original data (modulo stripped keys).

### FR-009: Backward Compatibility

**Confidence**: High

The existing `encode()`, `decode()`, `isUniformArray()`, `serializeValue()`, `deserializeValue()`, and `splitRow()` exports SHALL remain unchanged in signature and behavior.

**Acceptance Criteria**:

- **AC-009-01**: All 47 existing tests pass without modification.
- **AC-009-02**: The `module.exports` object includes all existing exports plus the new `encodeValue()` and `decodeValue()` functions.

### FR-010: Encoding Statistics

**Confidence**: Medium

The cache builder SHALL report per-section encoding statistics when run with `--verbose`.

**Acceptance Criteria**:

- **AC-010-01**: For each TOON-encoded section, stderr output includes: section name, JSON character count, TOON character count, and reduction percentage.
- **AC-010-02**: A summary line reports total reduction across all JSON sections.

## 7. Out of Scope

- **Markdown section optimization**: ROUNDTABLE_CONTEXT, SKILL_INDEX, DISCOVERY_CONTEXT, and CONSTITUTION sections are not modified by this REQ. A separate backlog item will address markdown tightening.
- **Source file modification**: No changes to `skills-manifest.json`, `workflows.json`, `iteration-requirements.json`, `artifact-paths.json`, persona files, topic files, or discovery reports.
- **Key folding**: The `a.b.c: 1` TOON feature is excluded from this REQ. Indentation-based nesting provides sufficient structure compression, and key folding reduces readability.
- **Inject hook changes**: `inject-session-cache.cjs` remains a dumb pipe. No changes.
- **Production decoder optimization**: `decodeValue()` is test-only. No performance optimization required.
- **Token counting**: This REQ measures in characters, not tokens. Token-level measurement is informational, not a gate.

## 8. MoSCoW Prioritization

### Must Have

| FR | Title | Rationale |
|----|-------|-----------|
| FR-001 | Nested Object Encoding | Core TOON feature; required for any JSON section encoding |
| FR-002 | Key-Value Pair Encoding | Core TOON feature; required for any JSON section encoding |
| FR-003 | Inline Primitive Array Encoding | High-frequency pattern in all JSON sections |
| FR-007 | Cache Builder Integration | Wires the encoder to the actual use case |
| FR-009 | Backward Compatibility | Must not break existing functionality |

### Should Have

| FR | Title | Rationale |
|----|-------|-----------|
| FR-004 | Non-Uniform/Mixed Array Encoding | Needed for completeness; some sections have mixed arrays |
| FR-005 | Uniform Array Tabular Delegation | Preserves REQ-0040 optimization for applicable data |
| FR-006 | Key Stripping | Reduces noise; `_comment` keys waste tokens |
| FR-008 | Round-Trip Decoder | Validates encoding correctness via tests |

### Could Have

| FR | Title | Rationale |
|----|-------|-----------|
| FR-010 | Encoding Statistics | Useful for monitoring but not functionally required |

### Won't Have

- Key folding (`a.b.c: 1`)
- Markdown section optimization
- Production-grade decoder performance

## 9. Dependency Map

```
FR-001 (Nested Objects) ──┐
FR-002 (Key-Value Pairs) ─┤
FR-003 (Inline Arrays) ───┼──> FR-007 (Cache Builder Integration)
FR-004 (Mixed Arrays) ────┤
FR-005 (Tabular Delegation)┘
FR-006 (Key Stripping) ────────> FR-007 (Cache Builder Integration)
FR-001..FR-004 ─────────────────> FR-008 (Round-Trip Decoder)
FR-009 (Backward Compat) ──────> independent (always enforced)
FR-007 ────────────────────────> FR-010 (Encoding Statistics)
```

## Pending Sections

None -- all sections complete.
