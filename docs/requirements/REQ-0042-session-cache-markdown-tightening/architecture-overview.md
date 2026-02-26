# Architecture Overview: REQ-0042 Session Cache Markdown Tightening

**Status**: Draft
**Confidence**: High
**Last Updated**: 2026-02-26
**Coverage**: Architecture Options, Selected Architecture, Technology Decisions, Integration Architecture, Summary

---

## 1. Architecture Options

### Decision 1: Where to place tightening logic

| Option | Summary | Pros | Cons | Pattern Alignment | Verdict |
|--------|---------|------|------|-------------------|---------|
| A: Inline in `rebuildSessionCache()` | Add tightening functions as private helpers in `common.cjs`, called within each `buildSection()` callback | Follows existing pattern; no new modules; all cache logic in one place | `common.cjs` is already large (4400+ lines) | Aligns with current architecture | **Selected** |
| B: Extract to `tighten-markdown.cjs` module | Create a new CJS module with tightening functions, required by `common.cjs` | Better separation of concerns; easier to test in isolation | Adds a new file; breaks the "all cache assembly in common.cjs" pattern; mirrors the TOON encoder extraction (REQ-0041) but markdown tightening is simpler | Partially aligns -- REQ-0041 extracted TOON encoder | Eliminated |

### Decision 2: SKILL_INDEX format change approach

| Option | Summary | Pros | Cons | Pattern Alignment | Verdict |
|--------|---------|------|------|-------------------|---------|
| A: Modify `formatSkillIndexBlock()` directly | Change the existing function to emit single-line format with one banner | Single point of change; all consumers get new format automatically | Consumers may expect 2-line format | Modifies existing function | **Selected** |
| B: Add `formatSkillIndexBlockCompact()` and switch | Create a new function, keep old one, switch in `rebuildSessionCache()` | Backward compatible; old function available for other callers | No other callers exist; unnecessary indirection | Over-engineered | Eliminated |

### Decision 3: Persona tightening strategy

| Option | Summary | Pros | Cons | Pattern Alignment | Verdict |
|--------|---------|------|------|-------------------|---------|
| A: Section-heading-based stripping | Parse persona content by `## N.` headings, keep/strip by section number | Precise; easy to understand which sections are kept | Brittle if heading format changes | N/A (new logic) | **Selected** |
| B: Regex-based content removal | Use regex patterns to find and remove specific section blocks | More flexible pattern matching | Harder to maintain; regex on markdown is fragile | N/A | Eliminated |

### Decision 4: Discovery condensation strategy

| Option | Summary | Pros | Cons | Pattern Alignment | Verdict |
|--------|---------|------|------|-------------------|---------|
| A: Table-preserving prose stripper | Identify markdown tables (lines starting with `|`), preserve them and their headers, condense surrounding prose | Preserves highest-value content (tables); rules are clear | May miss non-table structured content | N/A (new logic) | **Selected** |
| B: Section-level inclusion/exclusion | Keep specific sections, drop others entirely | Simpler logic | Risks dropping sections that have mixed high/low value content | N/A | Eliminated |

## 2. Selected Architecture

### ADR-001: Inline Tightening Functions in common.cjs

- **Status**: Accepted
- **Context**: REQ-0042 requires markdown tightening during cache assembly. The assembly function `rebuildSessionCache()` lives in `common.cjs`. We need to decide where to place the tightening logic.
- **Decision**: Add tightening functions as private helpers in `common.cjs`, called within each `buildSection()` callback. Do not extract to a separate module.
- **Rationale**: The tightening logic is tightly coupled to the cache assembly process. It does not have independent consumers. Extracting to a separate module (like `toon-encoder.cjs` for REQ-0041) would add unnecessary indirection for what are essentially string transformation functions. The TOON encoder was extracted because it has its own encoding format and independent test surface; markdown tightening is simpler.
- **Consequences**: `common.cjs` grows by approximately 100-150 lines. The tightening functions are testable via the existing `test-session-cache-builder.test.cjs` test file. If common.cjs size becomes a concern in the future, tightening functions can be extracted then.

### ADR-002: Modify formatSkillIndexBlock() In-Place

- **Status**: Accepted
- **Context**: The current `formatSkillIndexBlock()` emits a 2-line format per skill with a per-call banner header. The SKILL_INDEX section calls it once per agent, producing repeated banners.
- **Decision**: Modify `formatSkillIndexBlock()` to emit single-line skill entries without the banner. Move the banner to a single header emitted by the SKILL_INDEX section builder in `rebuildSessionCache()`.
- **Rationale**: `formatSkillIndexBlock()` is only called from `rebuildSessionCache()` (confirmed via codebase search). No other consumers exist. Changing it in place avoids creating a parallel function.
- **Consequences**: The skill entry format changes from 2 lines to 1 line. Any test assertions on the old format need updating. The banner is emitted once at the section level rather than per-agent.

### ADR-003: Section-Heading-Based Persona Stripping

- **Status**: Accepted
- **Context**: Persona files use numbered section headings (`## 1. Identity`, `## 2. Principles`, etc.). Some sections are redundant with the roundtable lead's system prompt.
- **Decision**: Parse persona content by `## N.` heading markers. Define a keep-list of section numbers: 1, 2, 3, 4 (trimmed), 5, 7 (compacted). Strip sections 6, 8, 9, 10. Also strip YAML frontmatter (content between `---` delimiters at the start of the file).
- **Rationale**: Section headings are stable -- they have not changed across versions. Heading-based parsing is more readable and maintainable than regex removal patterns.
- **Consequences**: If persona files add new sections or renumber, the keep-list must be updated. This is acceptable given the low change frequency of persona files.

### ADR-004: Table-Preserving Discovery Condensation

- **Status**: Accepted
- **Context**: The DISCOVERY_CONTEXT contains tables (high-value structured data) interspersed with prose (lower-value restatements). We need to condense without losing table data.
- **Decision**: Implement a condensation function that identifies markdown tables (sequences of lines starting with `|`), preserves them along with their preceding heading, and condenses surrounding prose paragraphs to a single summary sentence or removes them if they restate table content.
- **Rationale**: Tables contain the densest information per character. Prose paragraphs in the discovery report frequently restate what the tables show ("The iSDLC framework is a JavaScript/Node.js CLI tool that..." is covered by the tech stack table).
- **Consequences**: The condensed discovery context may read less smoothly as prose, but its consumers are LLM agents that extract facts, not humans reading for comprehension.

## 3. Technology Decisions

| Technology | Version | Rationale | Alternatives Considered |
|-----------|---------|-----------|------------------------|
| No new dependencies | N/A | All transformations are string manipulation; no external libraries needed | None -- standard string/regex operations sufficient |
| CJS module format | N/A | `common.cjs` is CJS; tightening functions follow the same convention | ESM -- rejected because hooks are CJS |

## 4. Integration Architecture

### Integration Points

| ID | Source | Target | Interface | Data Format | Error Handling |
|----|--------|--------|-----------|-------------|----------------|
| IP-001 | `rebuildSessionCache()` | `formatSkillIndexBlock()` | Function call (modified signature) | Array of skill objects -> formatted string | Fail-open: empty string on error |
| IP-002 | `rebuildSessionCache()` SKILL_INDEX builder | Banner header | String concatenation | Static string prepended to skill blocks | N/A (static content) |
| IP-003 | `rebuildSessionCache()` ROUNDTABLE_CONTEXT builder | `tightenPersonaContent()` (new) | Function call | Raw persona markdown -> tightened markdown | Fail-open: returns original content on error |
| IP-004 | `rebuildSessionCache()` ROUNDTABLE_CONTEXT builder | `tightenTopicContent()` (new) | Function call | Raw topic markdown -> tightened markdown | Fail-open: returns original content on error |
| IP-005 | `rebuildSessionCache()` DISCOVERY_CONTEXT builder | `condenseDiscoveryContent()` (new) | Function call | Raw discovery markdown -> condensed markdown | Fail-open: returns original content on error |
| IP-006 | `rebuildSessionCache()` verbose reporter | stderr | `process.stderr.write()` | Formatted reduction stats string | Silent on error |

### Data Flow

```
Source files (disk, unchanged)
  |
  v
rebuildSessionCache() reads each source
  |
  +-- SKILL_INDEX section:
  |     getAgentSkillIndex() -> formatSkillIndexBlock() [MODIFIED: single-line, no banner]
  |     Banner prepended once at section level
  |
  +-- ROUNDTABLE_CONTEXT section:
  |     Read persona files -> tightenPersonaContent() [NEW: strip sections 6,8,9,10; trim s4; compact s7]
  |     Read topic files -> tightenTopicContent() [NEW: strip frontmatter and metadata]
  |
  +-- DISCOVERY_CONTEXT section:
  |     Read discovery report -> condenseDiscoveryContent() [NEW: preserve tables, trim prose]
  |
  v
Assembled cache written to .isdlc/session-cache.md
  |
  v
inject-session-cache.cjs outputs to LLM context (unchanged)
```

### Synchronization Model

No concurrency considerations. Cache rebuild is a synchronous, single-threaded operation. The cache file is written atomically (single `fs.writeFileSync` call).

## 5. Summary

### Key Decisions

| Decision | Selected Option | Key Tradeoff |
|----------|----------------|--------------|
| Tightening location | Inline in common.cjs | Simplicity over separation of concerns |
| SKILL_INDEX format | Modify formatSkillIndexBlock() in place | Clean change vs backward compatibility (no other consumers) |
| Persona tightening | Section-heading-based stripping | Readability vs flexibility |
| Discovery condensation | Table-preserving prose stripper | Information density vs prose readability |

### Architecture Trade-offs

- **Simplicity over modularity**: Keeping tightening inline in `common.cjs` avoids adding files but increases its size. Acceptable given the low complexity of string transformations.
- **Convention over configuration**: The persona keep-list (sections 1,2,3,4,5,7) is hardcoded rather than configurable. This is intentional -- persona structure changes infrequently and configuration would add complexity without value.
- **Fail-open over fail-hard**: Consistent with the framework's safety philosophy. A broken tightener silently falls back to verbose content.
