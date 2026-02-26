# Module Design: REQ-0042 Session Cache Markdown Tightening

**Status**: Draft
**Confidence**: High
**Last Updated**: 2026-02-26
**Coverage**: All modules

---

## Module: Markdown Tightening Functions (inline in common.cjs)

### Responsibility

Transform verbose markdown content from source files into tightened representations during session cache assembly. Each function is a pure string-in, string-out transformer with fail-open error handling.

### Public Interface

All functions are private to `common.cjs` (not exported). They are called within `rebuildSessionCache()` section builders.

#### `tightenPersonaContent(rawContent)`

Strips redundant sections from a single persona file's content and compacts remaining sections.

```javascript
/**
 * @param {string} rawContent - Full persona markdown file content
 * @returns {string} Tightened persona content with sections 6, 8, 9, 10 stripped,
 *                   section 4 trimmed, section 7 compacted, YAML frontmatter removed
 */
function tightenPersonaContent(rawContent) { ... }
```

**Algorithm**:
1. Strip YAML frontmatter (content between first `---` and second `---` at start of file)
2. Split content by `## ` heading markers into sections
3. For each section, check the section number:
   - Sections 1, 2, 3, 5: Keep verbatim
   - Section 4 (Analytical Approach): Keep heading and subsection headings; trim bullet lists to first 3-4 items per subsection
   - Section 7 (Self-Validation Protocol): Merge "Before writing" and "Before finalization" checklists into single list
   - Sections 6, 8, 9, 10: Strip entirely
4. Rejoin kept sections
5. On any error: return `rawContent` unchanged (fail-open)

#### `tightenTopicContent(rawContent)`

Strips YAML frontmatter and metadata fields from a single topic file's content.

```javascript
/**
 * @param {string} rawContent - Full topic markdown file content
 * @returns {string} Tightened topic content with frontmatter and metadata stripped
 */
function tightenTopicContent(rawContent) { ... }
```

**Algorithm**:
1. Strip YAML frontmatter (content between first `---` and second `---` at start of file)
2. Return remaining content (Analytical Knowledge, Validation Criteria, Artifact Instructions sections)
3. On any error: return `rawContent` unchanged (fail-open)

#### `condenseDiscoveryContent(rawContent)`

Condenses verbose prose in the discovery report while preserving all tables.

```javascript
/**
 * @param {string} rawContent - Full discovery report markdown content
 * @returns {string} Condensed content with tables preserved and prose trimmed
 */
function condenseDiscoveryContent(rawContent) { ... }
```

**Algorithm**:
1. Split content into blocks separated by blank lines
2. For each block:
   - If block contains table rows (lines starting with `|`): keep verbatim (include header row and separator)
   - If block is a heading (starts with `#`): keep verbatim
   - If block is a prose paragraph: check if it restates information present in an adjacent table. If so, remove. If it adds unique information, condense to first sentence.
3. Rejoin kept blocks
4. On any error: return `rawContent` unchanged (fail-open)

#### Modified: `formatSkillIndexBlock(skillIndex)`

Changes the existing function to emit single-line skill entries without the banner header.

```javascript
/**
 * @param {Array<{id: string, name: string, description: string, path: string}>} skillIndex
 * @returns {string} Formatted skill entries, one per line, no banner
 *
 * New format per line: "  {id}: {name} | {description} | {path}"
 * Banner is emitted at section level in rebuildSessionCache(), not here.
 */
function formatSkillIndexBlock(skillIndex) { ... }
```

### Data Structures

No new data structures. All functions operate on strings and return strings.

### Dependencies

- No external dependencies
- Internal: uses standard string operations (split, join, startsWith, includes, trim)

### Estimated Size

- `tightenPersonaContent()`: ~40-50 lines
- `tightenTopicContent()`: ~10-15 lines
- `condenseDiscoveryContent()`: ~30-40 lines
- `formatSkillIndexBlock()` modification: ~5 lines changed
- Verbose reporting additions: ~15-20 lines
- **Total**: ~100-130 lines added/modified in `common.cjs`

### Testability

Each function can be tested with:
- Input: known verbose content string
- Output: expected tightened content string
- Assertions: character count reduction, presence of kept content, absence of stripped content
- Error case: invalid input returns original content (fail-open)

All tests run within the existing `test-session-cache-builder.test.cjs` framework using `node:test`.
