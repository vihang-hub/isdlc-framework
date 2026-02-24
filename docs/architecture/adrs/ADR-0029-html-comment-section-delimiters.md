# ADR-0029: HTML Comment Section Delimiters for Cache File

## Status

Accepted

## Context

The session cache file (`.isdlc/session-cache.md`) contains multiple sections of heterogeneous content: Markdown prose (constitution), JSON (workflows.json, iteration-requirements.json), and formatted text blocks (skill indices). Consumers need to extract individual sections by name.

We need a delimiter format that:
- Does not conflict with any content inside the source files
- Is parseable by simple regex or string search
- Is invisible when the Markdown is rendered
- Works for both LLM context consumption and programmatic extraction

## Decision

Use **HTML comment delimiters** with UPPER_SNAKE_CASE section names:

```markdown
<!-- SECTION: CONSTITUTION -->
{content}
<!-- /SECTION: CONSTITUTION -->
```

The cache header uses a single-line HTML comment:

```markdown
<!-- SESSION CACHE: Generated 2026-02-23T20:30:00Z | Sources: 263 | Hash: a1b2c3d4 -->
```

Section names: `CONSTITUTION`, `WORKFLOW_CONFIG`, `ITERATION_REQUIREMENTS`, `ARTIFACT_PATHS`, `SKILL_INDEX`, `EXTERNAL_SKILLS`, `ROUNDTABLE_CONTEXT`.

## Consequences

**Positive:**
- HTML comments are invisible in rendered Markdown (no visual noise)
- HTML comments do not appear in any of the source files (constitution, JSON configs, SKILL.md files) -- zero collision risk
- Simple regex extraction: `/<!-- SECTION: (\w+) -->([\s\S]*?)<!-- \/SECTION: \1 -->/`
- UPPER_SNAKE_CASE is unambiguous and distinct from Markdown headers in content
- The LLM can easily identify section boundaries in its context window

**Negative:**
- HTML comments are not standard Markdown metadata (no YAML frontmatter equivalent). This is acceptable because the file is machine-generated and consumed primarily by the LLM context, not by humans.
- Nested HTML comments are not valid HTML. If any source file contains `<!-- -->`, it could theoretically interfere. Checked: none of the current source files contain HTML comment delimiters matching the `SECTION:` pattern.

## Alternatives Considered

- **YAML frontmatter per section**: Would require a custom parser for multi-document YAML. Rejected for complexity.
- **Markdown header delimiters** (`# === SECTION: NAME ===`): Visible in rendered Markdown and could conflict with existing `#` headers in constitution.md. Rejected.
- **JSON envelope**: Wrap all content in a JSON structure with section keys. Rejected because JSON requires escaping all strings (doubling the size for Markdown content) and is less LLM-friendly.
- **Horizontal rules** (`---`): Already used in YAML frontmatter boundaries and within Markdown content. Ambiguous. Rejected.

## Traces

- **Requirements**: NFR-007 (Section Delimiters), FR-001 (AC-001-02)
- **Constitutional Articles**: Article IV (Explicit Over Implicit)
