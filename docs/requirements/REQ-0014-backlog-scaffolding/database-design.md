# Database Design: BACKLOG.md Scaffolding

**REQ ID**: REQ-0014
**Phase**: 03-architecture
**Created**: 2026-02-14

---

## Summary

Not applicable. The iSDLC framework has no database -- all state is managed via JSON files on the filesystem (see Constitution, Preamble: "It has no database").

## File System Artifacts

This feature creates one new file during installation:

| File | Location | Owner | Lifecycle |
|------|----------|-------|-----------|
| `BACKLOG.md` | `{projectRoot}/BACKLOG.md` | User (after creation) | Created once by installer; never modified or deleted by framework |

### BACKLOG.md Schema

The file follows the format convention defined in `src/claude/CLAUDE.md.template`:

```markdown
# {Project Name} - Backlog

> Track open and completed work items for this project.
> Format: `- {N.N} [{status}] {Title} -- {Description}`

## Open

(No items yet. Add items manually or import from Jira with `/isdlc`.)

## Completed

(No completed items yet.)
```

### Data Relationships

```
BACKLOG.md (project root)
  ^
  |-- referenced by CLAUDE.md.template (format convention)
  |-- created by lib/installer.js (one-time scaffolding)
  |-- NOT tracked in .isdlc/installed-files.json (user data)
  |-- NOT referenced by lib/uninstaller.js (preserved)
```

## Migration Strategy

Not applicable. This is a new file creation, not a schema change. Existing installations that upgrade the framework will not automatically get a BACKLOG.md -- it is only created during `isdlc init`. This is the correct behavior because:
1. The updater (`lib/updater.js`) does not create new project-root files
2. Existing projects may already have a BACKLOG.md
3. Creating files during update would be unexpected and potentially disruptive

## Backup Strategy

Not applicable at the framework level. BACKLOG.md is user data. Users manage their own backups.
