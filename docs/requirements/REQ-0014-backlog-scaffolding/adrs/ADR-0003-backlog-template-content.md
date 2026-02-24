# ADR-0003: BACKLOG.md Template Content Design

## Status

Accepted

## Context

REQ-0014 requires creating BACKLOG.md with specific section headers (## Open, ## Completed) and a preamble. NFR-01 requires the format to match the convention defined in `CLAUDE.md.template` (Backlog Management > BACKLOG.md Format Convention).

We need to decide what content the `generateBacklogMd()` function returns.

## Decision

The generated BACKLOG.md will contain:

1. **Title**: `# {Project Name} - Backlog` -- NOTE: Because `generateBacklogMd()` is called without parameters (following the pattern of `generateDocsReadme()` which also takes no project name), use a generic title: `# Project Backlog`
2. **Preamble**: A brief description block explaining the file's purpose and the item format convention, matching the style of the existing iSDLC project's BACKLOG.md
3. **## Open section**: Header plus a placeholder comment indicating no items yet
4. **## Completed section**: Header plus a placeholder comment

The template content:

```markdown
# Project Backlog

> Track open and completed work items for this project.
> Format: `- {N.N} [{status}] {Title} -- {Description}`
> Status: `[ ]` open, `[x]` done, `[~]` in progress

## Open

(No items yet.)

## Completed

(No completed items yet.)
```

Key design choices:
- **Generic title** (not project-name-specific): Keeps `generateBacklogMd()` a zero-parameter pure function, consistent with `generateDocsReadme()`
- **Format hint in preamble**: Helps users understand the expected item format without needing to reference CLAUDE.md.template
- **Placeholder comments**: Make empty sections visually clear and prevent confusion about whether the file is incomplete

## Consequences

**Positive:**
- Users immediately understand the file's purpose and expected format
- Format is consistent with CLAUDE.md.template convention (NFR-01)
- Zero-parameter function is simpler to call and test
- Placeholder text prevents empty-file confusion

**Negative:**
- Generic title means each project's BACKLOG.md does not include the project name. Users can easily rename it. This tradeoff was made for simplicity.

## Alternatives Considered

1. **Project-name-specific title**: Pass `projectName` to `generateBacklogMd(projectName)`. Rejected because `generateDocsReadme()` does not do this, and the consistency benefit is marginal.

2. **Minimal template (headers only)**: Just `## Open\n\n## Completed`. Rejected because it fails AC-04 (preamble explaining purpose) and would be confusing for users unfamiliar with the format convention.

3. **Full format example with sample items**: Include example items like `- 1.1 [ ] Example item -- Description`. Rejected because it creates items the user would need to delete, adding friction.

## Traces

- FR-01 (AC-02, AC-03, AC-04, AC-05): Content structure with headers and preamble
- NFR-01: Format matches CLAUDE.md.template convention
