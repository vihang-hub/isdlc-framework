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
| B: Extract to `tighten-markdown.cjs` module | Create a new CJS module with tightening functions, required by `common.cjs` | Better separation of concerns; easier to test in isolation | Adds a new file; breaks the "all cache assembly in common.cjs" pattern | Partially aligns -- REQ-0041 extracted TOON encoder | Eliminated |

### Decision 2: SKILL_INDEX format change approach

| Option | Summary | Pros | Cons | Pattern Alignment | Verdict |
|--------|---------|------|------|-------------------|---------|
| A: Modify `formatSkillIndexBlock()` with path shortening | Change function to emit single-line entries with shortened relative paths; add base path to section header | Maximum savings (~50% section reduction); single point of change | Agents must reconstruct full path from base + relative | Modifies existing function | **Selected** |
| B: Single-line format without path shortening | Collapse to one line but keep full paths | Simpler; no reconstruction needed | Only ~30% reduction; insufficient for 25-30% total target | Simpler but insufficient | Eliminated |

### Decision 3: Persona tightening strategy

| Option | Summary | Pros | Cons | Pattern Alignment | Verdict |
|--------|---------|------|------|-------------------|---------|
| A: Aggressive section stripping (strip sections 4, 6, 8, 9, 10) | Parse by `## N.` headings, keep 1, 2, 3, 5, 7 (compacted) | Maximum savings (~50% per persona); section 4 is redundant with topic files | Higher risk of voice degradation from removing Analytical Approach | N/A (new logic) | **Selected** |
| B: Conservative stripping (strip sections 6, 8, 9, 10 only, trim section 4) | Keep section 4 but trim bullet lists | Lower risk; retains some analytical guidance | Only ~35% per persona; insufficient for overall target | Safer but insufficient | Eliminated |

### Decision 4: Discovery condensation strategy

| Option | Summary | Pros | Cons | Pattern Alignment | Verdict |
|--------|---------|------|------|-------------------|---------|
| A: Aggressive prose stripping (keep headings, tables, lists only) | Strip all prose paragraphs; preserve all structured content | Maximum savings (~40%+ section reduction); every structured fact preserved | Loses narrative context between tables | N/A (new logic) | **Selected** |
| B: Moderate condensation (condense prose to first sentence) | Keep first sentence of each prose paragraph | Preserves some narrative flow | Only ~20-30% reduction; insufficient for target | Insufficient | Eliminated |

## 2. Selected Architecture

### ADR-001: Inline Tightening Functions in common.cjs

- **Status**: Accepted
- **Context**: REQ-0042 requires markdown tightening during cache assembly. The assembly function `rebuildSessionCache()` lives in `common.cjs`. We need to decide where to place the tightening logic.
- **Decision**: Add tightening functions as private helpers in `common.cjs`, called within each `buildSection()` callback. Do not extract to a separate module.
- **Rationale**: The tightening logic is tightly coupled to the cache assembly process. It does not have independent consumers.
- **Consequences**: `common.cjs` grows by approximately 100-150 lines. Tightening functions are testable via the existing test file.

### ADR-002: Compact Skill Format with Path Shortening

- **Status**: Accepted
- **Context**: The current `formatSkillIndexBlock()` emits a 2-line format per skill with a per-call banner header. The 25-30% total target requires aggressive SKILL_INDEX savings.
- **Decision**: Modify `formatSkillIndexBlock()` to emit single-line skill entries with shortened relative paths (category/name only). Move the banner and base path convention to a single header emitted by the section builder.
- **Rationale**: With ~240 skills, path shortening saves ~40 chars per skill (~9.6K total). Combined with banner deduplication and single-line format, this achieves 50%+ section reduction. Full path is reconstructable from base path + relative.
- **Consequences**: Agents that need the full SKILL.md path must reconstruct it from the base path convention in the header. This is documented clearly in the section header.

### ADR-003: Aggressive Persona Section Stripping

- **Status**: Accepted
- **Context**: Persona files have 10 sections. Sections 6, 8, 9, 10 are confirmed redundant with the roundtable lead's system prompt. Section 4 (Analytical Approach) overlaps with topic files that are also embedded in ROUNDTABLE_CONTEXT. The 25-30% target requires aggressive savings.
- **Decision**: Strip sections 4, 6, 8, 9, 10 entirely. Keep sections 1, 2, 3, 5. Compact section 7 into a single merged checklist. Strip YAML frontmatter.
- **Rationale**: Section 4 contains analytical questions that are duplicated by the topic files in the same ROUNDTABLE_CONTEXT section. Removing it eliminates ~3K-4K chars per persona without information loss because the topic files carry the same content. This achieves ~50% per-persona reduction.
- **Consequences**: If the roundtable lead's behavior degrades from missing section 4, the tightening function can be adjusted to restore it (fail-open allows per-function tuning).

### ADR-004: Aggressive Discovery Prose Stripping

- **Status**: Accepted
- **Context**: The DISCOVERY_CONTEXT contains tables interspersed with prose that frequently restates table content. The 25-30% target requires aggressive savings from all three sections.
- **Decision**: Strip all prose paragraphs. Preserve headings, tables, and list items verbatim. The resulting section is structured content only.
- **Rationale**: LLM agents extract facts from structured content (tables, lists). Prose restatements consume tokens without adding information. With REQ-0041 savings unproven, REQ-0042 must be aggressive to hit the target independently.
- **Consequences**: The discovery context reads as a skeleton of headings and data. This is acceptable because consumers are LLM agents, not humans.

## 3. Technology Decisions

| Technology | Version | Rationale | Alternatives Considered |
|-----------|---------|-----------|------------------------|
| No new dependencies | N/A | All transformations are string manipulation; no external libraries needed | None -- standard string/regex operations sufficient |
| CJS module format | N/A | `common.cjs` is CJS; tightening functions follow the same convention | ESM -- rejected because hooks are CJS |

## 4. Integration Architecture

### Integration Points

| ID | Source | Target | Interface | Data Format | Error Handling |
|----|--------|--------|-----------|-------------|----------------|
| IP-001 | `rebuildSessionCache()` | `formatSkillIndexBlock()` | Function call (modified) | Array of skill objects -> formatted string (compact, no banner) | Fail-open: empty string on error |
| IP-002 | `rebuildSessionCache()` SKILL_INDEX builder | Banner + base path header | String concatenation | Static header prepended to skill blocks | N/A (static content) |
| IP-003 | `rebuildSessionCache()` ROUNDTABLE_CONTEXT builder | `tightenPersonaContent()` (new) | Function call | Raw persona markdown -> aggressively tightened markdown | Fail-open: returns original content on error |
| IP-004 | `rebuildSessionCache()` ROUNDTABLE_CONTEXT builder | `tightenTopicContent()` (new) | Function call | Raw topic markdown -> tightened markdown | Fail-open: returns original content on error |
| IP-005 | `rebuildSessionCache()` DISCOVERY_CONTEXT builder | `condenseDiscoveryContent()` (new) | Function call | Raw discovery markdown -> structured-only markdown | Fail-open: returns original content on error |
| IP-006 | `rebuildSessionCache()` verbose reporter | stderr | `process.stderr.write()` | Formatted reduction stats string | Silent on error |

### Data Flow

```
Source files (disk, unchanged)
  |
  v
rebuildSessionCache() reads each source
  |
  +-- SKILL_INDEX section:
  |     getAgentSkillIndex() -> formatSkillIndexBlock() [MODIFIED: compact single-line, shortened paths, no banner]
  |     Banner + base path prepended once at section level
  |
  +-- ROUNDTABLE_CONTEXT section:
  |     Read persona files -> tightenPersonaContent() [NEW: strip sections 4,6,8,9,10; compact s7; strip frontmatter]
  |     Read topic files -> tightenTopicContent() [NEW: strip frontmatter]
  |
  +-- DISCOVERY_CONTEXT section:
  |     Read discovery report -> condenseDiscoveryContent() [NEW: strip all prose, keep headings+tables+lists]
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
| SKILL_INDEX format | Compact single-line with path shortening | Maximum savings vs path reconstruction requirement |
| Persona tightening | Aggressive stripping (sections 4,6,8,9,10) | Maximum savings vs voice degradation risk (mitigated by fail-open) |
| Discovery condensation | Strip all prose, keep structured content only | Maximum savings vs narrative context loss (acceptable for LLM consumers) |

### Architecture Trade-offs

- **Aggressiveness over conservatism**: The updated target (25-30% from REQ-0042 alone) requires aggressive tightening across all three sections. Each decision selects the higher-savings option, relying on the fail-open pattern for rollback safety.
- **Simplicity over modularity**: Keeping tightening inline in `common.cjs` avoids adding files but increases its size. Acceptable given the low complexity of string transformations.
- **Convention over configuration**: The persona keep-list (sections 1,2,3,5,7) is hardcoded rather than configurable. Persona structure changes infrequently.
- **Fail-open over fail-hard**: Each tightening function independently falls back to verbose content. Individual functions can be "disabled" by forcing a fail-open without any code changes to other functions.
