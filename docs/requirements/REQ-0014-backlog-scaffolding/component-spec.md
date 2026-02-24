# Component Specification: BACKLOG.md Scaffolding

**REQ ID**: REQ-0014
**Phase**: 04-design
**Created**: 2026-02-14
**Status**: Approved

---

## 1. Component Inventory

This feature introduces no new reusable components. It adds two small code elements to an existing module. For completeness, this document specifies each element's contract so developers can implement without ambiguity.

---

## 2. Component: generateBacklogMd()

### Type
Module-private pure function in `lib/installer.js`

### Pattern
Follows the existing `generateDocsReadme()` (line 713) and `generateConstitution()` (line 747) pattern -- zero-parameter functions returning template strings.

### Contract

| Property | Value |
|----------|-------|
| Parameters | None |
| Returns | `string` -- BACKLOG.md markdown content |
| Side effects | None |
| Throws | Never |
| Pure | Yes |
| Exported | No (module-private) |
| Testable via | Direct function call (if exported for testing) or integration test via `isdlc init` |

### Content Contract (exact output)

```markdown
# Project Backlog

> Backlog and completed items are tracked here.
> This file is NOT loaded into every conversation -- reference it explicitly when needed.

## Open

## Completed
```

### Structural Assertions (for test implementation)

1. Contains `# Project Backlog` as first line
2. Contains at least one blockquote line (starts with `>`)
3. Contains `## Open` as a standalone line
4. Contains `## Completed` as a standalone line
5. `## Open` appears before `## Completed`
6. Does NOT contain any list item lines (starting with `- `)
7. Ends with a trailing newline character

---

## 3. Component: BACKLOG.md Creation Block

### Type
Code block within `install()` function in `lib/installer.js`

### Pattern
Replicates the CLAUDE.md creation block (lines 557-569):

| Aspect | CLAUDE.md Pattern | BACKLOG.md Pattern |
|--------|------------------|-------------------|
| Path construction | `path.join(projectRoot, 'CLAUDE.md')` | `path.join(projectRoot, 'BACKLOG.md')` |
| Existence check | `if (!(await exists(claudeMdPath)))` | `if (!(await exists(backlogPath)))` |
| Dry-run guard | `if (!dryRun)` | `if (!dryRun)` |
| Content source | Template file read | `generateBacklogMd()` call |
| Success log | `logger.warning(...)` | `logger.success('Created BACKLOG.md')` |
| Skip log | (not present) | `logger.info('BACKLOG.md already exists -- skipping')` |
| Else branch | (not present) | Present -- logs skip message |

### Behavioral Differences from CLAUDE.md Pattern

1. **Content source**: CLAUDE.md reads from a template file; BACKLOG.md calls a pure function. This is simpler because BACKLOG.md has no project-specific substitution.
2. **Log level on creation**: CLAUDE.md uses `logger.warning()` (because a missing CLAUDE.md is unexpected for existing installs); BACKLOG.md uses `logger.success()` (because creating it is the expected happy path for new installs).
3. **Else branch**: CLAUDE.md has no else branch (it only logs on creation). BACKLOG.md adds an else branch with `logger.info()` to inform the user when the file is skipped. This is a usability improvement that could optionally be backported to the CLAUDE.md block in a future change.

### Placement Contract

The block MUST be inserted:
- AFTER the CLAUDE.md creation block (after `logger.warning('CLAUDE.md was missing...')`)
- BEFORE the `// Done!` comment and `logger.header('Installation Complete!')` call
- This matches NFR-02 (placement consistency)

---

## 4. Reuse Opportunities

### Future Scaffolding Files

If future features need to scaffold additional project-root files during installation (e.g., CHANGELOG.md, CONTRIBUTING.md), they should follow the same pattern:

1. Create a `generate{FileName}()` pure function returning the template
2. Add a creation block with exists-check + dry-run guard + logger
3. Place the block in the same section (after CLAUDE.md, before Done!)
4. Do NOT add the file to the installation manifest (it becomes user data)
5. Do NOT reference the file in the uninstaller

---

## 5. Traceability

| Component | Requirements Satisfied |
|-----------|----------------------|
| `generateBacklogMd()` | AC-02, AC-03, AC-04, AC-05, NFR-01 |
| BACKLOG.md creation block | AC-01, AC-06, AC-07, AC-08, AC-09, NFR-02 |
| Uninstaller (no change) | AC-10, AC-11, AC-12 |
