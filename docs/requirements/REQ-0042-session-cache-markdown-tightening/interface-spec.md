# Interface Specification: REQ-0042 Session Cache Markdown Tightening

**Status**: Draft
**Confidence**: High
**Last Updated**: 2026-02-26
**Coverage**: All interfaces

---

## 1. tightenPersonaContent(rawContent)

### Signature

```javascript
function tightenPersonaContent(rawContent: string): string
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| rawContent | string | Yes | Full persona markdown file content including YAML frontmatter |

### Return Value

| Type | Description |
|------|-------------|
| string | Aggressively tightened persona content (sections 4,6,8,9,10 stripped, section 7 compacted, frontmatter stripped). On error, returns `rawContent` unchanged. |

### Validation Rules

- If `rawContent` is falsy or not a string: return empty string
- If no `---` frontmatter delimiters found: proceed without stripping frontmatter
- If no `## ` section headings found: return content with frontmatter stripped only

### Examples

**Input** (abbreviated):
```markdown
---
name: persona-business-analyst
description: "Maya Chen..."
---

# Maya Chen -- Business Analyst

## 1. Identity
- **Name**: Maya Chen
...

## 4. Analytical Approach
### 4.1 Problem Discovery
- What business problem does this solve?
...

## 6. Artifact Responsibilities
### 6.1 requirements-spec.md
...

## 10. Constraints
- No state.json writes
...
```

**Output** (abbreviated):
```markdown
# Maya Chen -- Business Analyst

## 1. Identity
- **Name**: Maya Chen
...
```
(Sections 4, 6, 8, 9, 10 removed. Frontmatter removed. Section 7 compacted.)

### Error Behavior

| Error Condition | Behavior |
|-----------------|----------|
| rawContent is null/undefined | Return empty string |
| rawContent is not a string | Return empty string |
| Section parsing fails | Return rawContent unchanged |
| Any unexpected error | Return rawContent unchanged (try/catch) |

---

## 2. tightenTopicContent(rawContent)

### Signature

```javascript
function tightenTopicContent(rawContent: string): string
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| rawContent | string | Yes | Full topic markdown file content including YAML frontmatter |

### Return Value

| Type | Description |
|------|-------------|
| string | Topic content with frontmatter stripped. On error, returns `rawContent` unchanged. |

### Validation Rules

- If `rawContent` is falsy or not a string: return empty string
- If no `---` frontmatter delimiters found: return rawContent unchanged

### Examples

**Input** (abbreviated):
```markdown
---
topic_id: "problem-discovery"
topic_name: "Problem Discovery"
primary_persona: "business-analyst"
coverage_criteria:
  - "Business problem articulated"
depth_guidance:
  brief: "Accept surface-level answers."
source_step_files:
  - "00-01"
---

## Analytical Knowledge
...

## Validation Criteria
...
```

**Output**:
```markdown
## Analytical Knowledge
...

## Validation Criteria
...
```
(YAML frontmatter removed entirely.)

### Error Behavior

| Error Condition | Behavior |
|-----------------|----------|
| rawContent is null/undefined | Return empty string |
| rawContent is not a string | Return empty string |
| No frontmatter found | Return rawContent unchanged |
| Any unexpected error | Return rawContent unchanged (try/catch) |

---

## 3. condenseDiscoveryContent(rawContent)

### Signature

```javascript
function condenseDiscoveryContent(rawContent: string): string
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| rawContent | string | Yes | Full discovery report markdown content |

### Return Value

| Type | Description |
|------|-------------|
| string | Structured-only content (headings, tables, lists preserved; all prose stripped). On error, returns `rawContent` unchanged. |

### Validation Rules

- If `rawContent` is falsy or not a string: return empty string
- Headings (lines starting with `#`) are always preserved
- Table rows (lines starting with `|`) are always preserved
- List items (lines starting with `- `, `* `, or numbered `N. `) are always preserved
- Blank lines are preserved (but consecutive blanks collapsed to one)
- All other lines (prose) are stripped

### Examples

**Input** (abbreviated):
```markdown
## 1. Executive Summary

The iSDLC framework is a JavaScript/Node.js CLI tool that installs an AI-powered
software development lifecycle into any project via Claude Code integration. It
consists of 24 production JavaScript files (8,235 lines), 315 markdown definitions.

## 2. Architecture Overview

| Layer | Components | Pattern | Notes |
|-------|------------|---------|-------|
| CLI Entry | bin/isdlc.js | ESM command router | 6 commands |
...

## 3. Key Concerns

- Broken ESM test suite needs npm ci
- Hook runtime system is well-tested
```

**Output**:
```markdown
## 1. Executive Summary

## 2. Architecture Overview

| Layer | Components | Pattern | Notes |
|-------|------------|---------|-------|
| CLI Entry | bin/isdlc.js | ESM command router | 6 commands |
...

## 3. Key Concerns

- Broken ESM test suite needs npm ci
- Hook runtime system is well-tested
```
(Prose paragraph under Executive Summary stripped. Tables and list items preserved.)

### Error Behavior

| Error Condition | Behavior |
|-----------------|----------|
| rawContent is null/undefined | Return empty string |
| rawContent is not a string | Return empty string |
| Any unexpected error | Return rawContent unchanged (try/catch) |

---

## 4. formatSkillIndexBlock(skillIndex) -- Modified

### Signature (unchanged)

```javascript
function formatSkillIndexBlock(skillIndex: Array<{id, name, description, path}>): string
```

### Parameters (unchanged)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| skillIndex | Array | Yes | Array of skill entry objects |

### Return Value (changed)

| Type | Description |
|------|-------------|
| string | Skill entries in compact single-line format with shortened paths, one per line. No banner header. Empty string for empty array. |

### Output Format Change

**Before** (current):
```
AVAILABLE SKILLS (consult when relevant using Read tool):
  DEV-001: code-implementation -- Description text
    -> src/claude/skills/development/code-implementation/SKILL.md
```

**After** (new):
```
  DEV-001: code-implementation | Description text | development/code-implementation
```

### Path Shortening Logic

Extract the two path segments before `/SKILL.md`:
- Input: `src/claude/skills/development/code-implementation/SKILL.md`
- Output: `development/code-implementation`

### Validation Rules (unchanged)

- If `skillIndex` is not an array or is empty: return empty string

### Error Behavior (unchanged)

- Returns empty string on any error

---

## 5. rebuildSessionCache() -- SKILL_INDEX Section Modification

### New Behavior

```javascript
// Section 6: SKILL_INDEX (per-agent blocks, tightened)
parts.push(buildSection('SKILL_INDEX', () => {
    // Single banner + base path at section level
    const header = 'AVAILABLE SKILLS (consult when relevant using Read tool):\n' +
                   'Base path: src/claude/skills/{category}/{name}/SKILL.md';
    // ... builds per-agent blocks (formatSkillIndexBlock emits compact lines, no banner)
    blocks.push(`## Agent: ${agentName}\n${block}`);
    return header + '\n\n' + blocks.join('\n\n');
}));
```

---

## 6. Verbose Reduction Reporting Interface

### Output Format

Written to `process.stderr` when `verbose === true`:

```
TIGHTEN SKILL_INDEX: 39866 -> 19933 chars (50.0% reduction)
TIGHTEN ROUNDTABLE_CONTEXT: 47092 -> 27255 chars (42.1% reduction)
TIGHTEN DISCOVERY_CONTEXT: 22814 -> 13688 chars (40.0% reduction)
TIGHTEN total: 109772 -> 60876 chars (44.6% reduction across markdown sections)
```

### Integration

Follows the same pattern as the existing TOON reduction reporting (lines 4296-4298 in `common.cjs`).
