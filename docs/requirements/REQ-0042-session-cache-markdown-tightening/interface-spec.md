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
| string | Tightened persona content. On error, returns `rawContent` unchanged. |

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
(Sections 6, 8, 9, 10 removed. Frontmatter removed.)

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
| string | Condensed content with tables preserved and prose trimmed. On error, returns `rawContent` unchanged. |

### Validation Rules

- If `rawContent` is falsy or not a string: return empty string
- If no table rows found (no lines starting with `|`): return rawContent unchanged (nothing to preserve/trim)
- Headings (lines starting with `#`) are always preserved

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
```

**Output** (abbreviated):
```markdown
## 1. Executive Summary

## 2. Architecture Overview

| Layer | Components | Pattern | Notes |
|-------|------------|---------|-------|
| CLI Entry | bin/isdlc.js | ESM command router | 6 commands |
...
```
(Prose paragraph under Executive Summary removed as it restates table content.)

### Error Behavior

| Error Condition | Behavior |
|-----------------|----------|
| rawContent is null/undefined | Return empty string |
| rawContent is not a string | Return empty string |
| No tables found | Return rawContent unchanged |
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
| string | Skill entries in single-line format, one per line. No banner header. Empty string for empty array. |

### Output Format Change

**Before** (current):
```
AVAILABLE SKILLS (consult when relevant using Read tool):
  DEV-001: code-implementation — Description text
    → src/claude/skills/development/code-implementation/SKILL.md
```

**After** (new):
```
  DEV-001: code-implementation | Description text | src/claude/skills/development/code-implementation/SKILL.md
```

### Validation Rules (unchanged)

- If `skillIndex` is not an array or is empty: return empty string

### Error Behavior (unchanged)

- Returns empty string on any error

---

## 5. rebuildSessionCache() -- SKILL_INDEX Section Modification

### Current Behavior (line 4182)

```javascript
// Section 6: SKILL_INDEX (per-agent blocks)
parts.push(buildSection('SKILL_INDEX', () => {
    // ... builds per-agent blocks with formatSkillIndexBlock()
    blocks.push(`## Agent: ${agentName}\n${block}`);
    return blocks.join('\n\n');
}));
```

### New Behavior

```javascript
// Section 6: SKILL_INDEX (per-agent blocks, tightened)
parts.push(buildSection('SKILL_INDEX', () => {
    // Single banner at section level
    const header = 'AVAILABLE SKILLS (consult when relevant using Read tool):';
    // ... builds per-agent blocks (formatSkillIndexBlock no longer emits banner)
    blocks.push(`## Agent: ${agentName}\n${block}`);
    return header + '\n\n' + blocks.join('\n\n');
}));
```

---

## 6. Verbose Reduction Reporting Interface

### Output Format

Written to `process.stderr` when `verbose === true`:

```
TIGHTEN SKILL_INDEX: 39866 -> 25000 chars (37.3% reduction)
TIGHTEN ROUNDTABLE_CONTEXT: 47092 -> 36000 chars (23.5% reduction)
TIGHTEN DISCOVERY_CONTEXT: 22814 -> 17000 chars (25.5% reduction)
TIGHTEN total: 109772 -> 78000 chars (28.9% reduction across markdown sections)
```

### Integration

Follows the same pattern as the existing TOON reduction reporting (lines 4296-4298 in `common.cjs`).
