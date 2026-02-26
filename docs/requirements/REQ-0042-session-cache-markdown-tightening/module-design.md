# Module Design: REQ-0042 Session Cache Markdown Tightening

**Status**: Draft
**Confidence**: High
**Last Updated**: 2026-02-26
**Coverage**: All modules

---

## Module: Markdown Tightening Functions (inline in common.cjs)

### Responsibility

Transform verbose markdown content from source files into aggressively tightened representations during session cache assembly. Each function is a pure string-in, string-out transformer with fail-open error handling. Target: 25-30% total cache reduction from REQ-0042 alone.

### Public Interface

All functions are private to `common.cjs` (not exported). They are called within `rebuildSessionCache()` section builders.

#### `tightenPersonaContent(rawContent)`

Aggressively strips redundant sections from a single persona file's content.

```javascript
/**
 * @param {string} rawContent - Full persona markdown file content
 * @returns {string} Tightened persona content with sections 4, 6, 8, 9, 10 stripped,
 *                   section 7 compacted, YAML frontmatter removed.
 *                   Retains: sections 1 (Identity), 2 (Principles), 3 (Voice Integrity),
 *                   5 (Interaction Style), 7 (Self-Validation, compacted)
 */
function tightenPersonaContent(rawContent) { ... }
```

**Algorithm**:
1. Strip YAML frontmatter (content between first `---` and second `---` at start of file)
2. Split content by `## ` heading markers into sections
3. For each section, check the section number:
   - Sections 1, 2, 3, 5: Keep verbatim
   - Section 7 (Self-Validation Protocol): Merge "Before writing" and "Before finalization" checklists into single list
   - Sections 4, 6, 8, 9, 10: Strip entirely
4. Rejoin kept sections
5. On any error: return `rawContent` unchanged (fail-open)

#### `tightenTopicContent(rawContent)`

Strips YAML frontmatter from a single topic file's content.

```javascript
/**
 * @param {string} rawContent - Full topic markdown file content
 * @returns {string} Tightened topic content with frontmatter stripped
 */
function tightenTopicContent(rawContent) { ... }
```

**Algorithm**:
1. Strip YAML frontmatter (content between first `---` and second `---` at start of file)
2. Return remaining content (Analytical Knowledge, Validation Criteria, Artifact Instructions sections)
3. On any error: return `rawContent` unchanged (fail-open)

#### `condenseDiscoveryContent(rawContent)`

Aggressively strips all prose paragraphs from the discovery report, preserving only structured content.

```javascript
/**
 * @param {string} rawContent - Full discovery report markdown content
 * @returns {string} Structured-only content: headings, tables, and list items preserved;
 *                   all prose paragraphs stripped
 */
function condenseDiscoveryContent(rawContent) { ... }
```

**Algorithm**:
1. Split content into lines
2. For each line:
   - If line starts with `#`: keep (heading)
   - If line starts with `|`: keep (table row)
   - If line starts with `- `, `* `, or matches numbered list pattern (`N. `): keep (list item)
   - If line is blank: keep (preserves section separation)
   - Otherwise: strip (prose paragraph line)
3. Collapse multiple consecutive blank lines into single blank line
4. Rejoin kept lines
5. On any error: return `rawContent` unchanged (fail-open)

#### Modified: `formatSkillIndexBlock(skillIndex)`

Changes the existing function to emit compact single-line skill entries with shortened paths and no banner header.

```javascript
/**
 * @param {Array<{id: string, name: string, description: string, path: string}>} skillIndex
 * @returns {string} Formatted skill entries, one per line, no banner, shortened paths
 *
 * New format per line: "  {id}: {name} | {description} | {category}/{skillName}"
 * Banner and base path emitted at section level in rebuildSessionCache(), not here.
 */
function formatSkillIndexBlock(skillIndex) { ... }
```

**Path shortening logic**: Extract the last two path segments before `/SKILL.md` to produce `{category}/{name}`. For example, `src/claude/skills/development/code-implementation/SKILL.md` becomes `development/code-implementation`.

### Data Structures

No new data structures. All functions operate on strings and return strings.

### Dependencies

- No external dependencies
- Internal: uses standard string operations (split, join, startsWith, includes, trim, match)

### Estimated Size

- `tightenPersonaContent()`: ~35-45 lines
- `tightenTopicContent()`: ~10-15 lines
- `condenseDiscoveryContent()`: ~25-35 lines
- `formatSkillIndexBlock()` modification: ~10 lines changed
- SKILL_INDEX section builder changes: ~5 lines
- Verbose reporting additions: ~15-20 lines
- **Total**: ~100-130 lines added/modified in `common.cjs`

### Testability

Each function can be tested with:
- Input: known verbose content string
- Output: expected tightened content string
- Assertions: character count reduction, presence of kept content, absence of stripped content, path reconstructability
- Error case: invalid input returns original content (fail-open)

All tests run within the existing `test-session-cache-builder.test.cjs` framework using `node:test`.
