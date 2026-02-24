# ADR-0001: Additive Installer Pattern for BACKLOG.md

## Status

Accepted

## Context

REQ-0014 requires creating a BACKLOG.md file at the project root during `isdlc init`. We need to decide how this file creation integrates into the existing installer flow.

The installer (`lib/installer.js`) already creates project-root files using a "check-exists, guard-dry-run, write-file" pattern:

```javascript
// CLAUDE.md creation (lines 557-569):
const claudeMdPath = path.join(projectRoot, 'CLAUDE.md');
if (!(await exists(claudeMdPath))) {
  if (!dryRun) {
    const templatePath = path.join(claudeTarget, 'CLAUDE.md.template');
    let content = '';
    if (await exists(templatePath)) {
      content = await readFile(templatePath, 'utf8');
    }
    await writeFile(claudeMdPath, content);
  }
  logger.warning('CLAUDE.md was missing - created from template in project root');
}
```

## Decision

Replicate the established CLAUDE.md creation pattern for BACKLOG.md:
1. Add a `generateBacklogMd()` helper function that returns the template content
2. Insert the creation block immediately after the CLAUDE.md creation block (line 569)
3. Use the same exists-check + dry-run guard + writeFile pattern
4. Log success on creation, info on skip

This approach was chosen over alternatives because:
- It follows an established, proven pattern in the same file
- It uses only already-imported utilities (no new dependencies)
- It is the simplest solution that satisfies all requirements (Article V)

## Consequences

**Positive:**
- Zero new dependencies
- Zero new imports
- Consistent behavior with CLAUDE.md creation (exists-check, dry-run, logging)
- Minimal code addition (~15 lines for creation block + ~15 lines for generator)
- Pattern is already tested and proven

**Negative:**
- The `install()` function grows by ~30 lines (637 -> ~667 lines)
- This increases an already-long function, but the step-based structure keeps it readable

## Alternatives Considered

1. **Separate module for project-root file creation**: Extract all project-root file creation (CLAUDE.md, BACKLOG.md, future files) into a separate module. Rejected because this would be premature abstraction for only 2 files (Article V: YAGNI).

2. **Template-driven approach**: Store BACKLOG.md content in a template file under `src/isdlc/templates/BACKLOG.md.template`. Rejected because the content is simple and static -- a function returning a string is simpler than file I/O to read a template.

3. **Create during updater instead of installer**: Add to `lib/updater.js` so existing installations also get BACKLOG.md. Rejected because the updater's purpose is to update framework files, not create new user-facing project files. This would violate the principle of least surprise.

## Traces

- FR-01 (AC-01 to AC-05): File creation with correct content
- FR-02 (AC-06, AC-07): Skip-if-exists behavior
- FR-03 (AC-08, AC-09): Dry-run respect
- NFR-02: Placement consistency with CLAUDE.md
