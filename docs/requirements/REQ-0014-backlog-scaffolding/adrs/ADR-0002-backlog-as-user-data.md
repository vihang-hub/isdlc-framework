# ADR-0002: BACKLOG.md Treated as User Data (Not Framework File)

## Status

Accepted

## Context

REQ-0014 requires that the uninstaller must NOT remove BACKLOG.md (FR-04). We need to decide how BACKLOG.md is classified within the framework's file ownership model.

The iSDLC framework distinguishes between:
- **Framework files**: Tracked in `.isdlc/installed-files.json`, removed during uninstall (agents, skills, hooks, config)
- **User artifacts**: Not tracked in manifest, preserved during uninstall (state.json, constitution.md, settings.local.json, CLAUDE.md)

## Decision

Classify BACKLOG.md as **user data** from the moment of creation:

1. **Not tracked in manifest**: BACKLOG.md is NOT added to the `installedFiles` array or written to `.isdlc/installed-files.json`
2. **Not in uninstaller paths**: The uninstaller already has zero references to BACKLOG.md (verified via grep analysis)
3. **Survives all uninstall modes**: Standard uninstall, `--purge-all` (removes .isdlc/ only), and `--purge-docs` (removes docs/ only) all leave BACKLOG.md untouched at the project root

This mirrors how CLAUDE.md is treated: the installer creates it as scaffolding, but it immediately becomes user-owned and is never modified or removed by the framework.

## Consequences

**Positive:**
- Zero changes to the uninstaller
- Zero changes to the manifest generation
- BACKLOG.md is safe from any future uninstaller changes (not in any removal path pattern)
- Consistent with CLAUDE.md ownership model

**Negative:**
- If a user runs `isdlc init` in a directory with an existing BACKLOG.md (from a previous install or manual creation), the file is skipped -- the user never gets the "latest" template. This is acceptable because preserving user data is always preferred over overwriting it.

## Alternatives Considered

1. **Track in manifest but exclude from uninstall**: Add BACKLOG.md to the manifest with a `"preserve": true` flag. Rejected because this adds complexity to the manifest schema for no benefit. Not tracking is simpler and achieves the same result.

2. **Add explicit preservation logic to uninstaller**: Add `BACKLOG.md` to a "preserved files" list in the uninstaller. Rejected because the uninstaller already preserves anything not in its removal paths. Adding explicit logic is redundant.

## Traces

- FR-04 (AC-10, AC-11, AC-12): Uninstaller must not remove BACKLOG.md
- Article X (Fail-Safe Defaults): Preservation by default (deny removal, allow explicitly)
