# BUG-0029: Multiline Bash Permission Bypass

**Source**: BACKLOG.md item 14.3 / GitHub #18
**Type**: Bug
**Created**: 2026-02-18

## Problem

Framework agents generate multiline Bash commands that bypass Claude Code's permission auto-allow rules. Affected patterns include:

- `for`/`do`/`done` shell loops
- `node -e "..."` with embedded multi-line JavaScript
- Here-documents and multi-line string constructions
- Complex piped commands split across lines

Claude Code's `*` glob pattern in `.claude/settings.json` permission rules does not match newline characters. This means multiline commands always prompt for user permission, even when the individual commands within them are auto-allowed.

## Impact

- **User experience degradation**: Users are repeatedly prompted to approve safe commands during automated workflows
- **Workflow interruption**: Phases that use multiline Bash (especially state updates, file operations) stall waiting for permission
- **Inconsistent behavior**: Single-line `git status` is auto-allowed, but a `for` loop containing `git status` is not

## Proposed Fix

Three-pronged approach:

1. **(A) Prefer single-line equivalents**: Replace `for` loops with `grep -r`, `find -exec`, `xargs`, or `&&` chaining where possible
2. **(B) Extract complex scripts to files**: Move multi-line logic to `bin/` scripts (e.g., `bin/update-phase-state.js`) that can be invoked as a single command
3. **(C) Add single-line Bash convention**: Add a shared protocol to agent instructions prohibiting multiline inline Bash and requiring single-line or file-based alternatives

## Affected Files

- Agent `.md` files (discover agents, impact analysis agents, any agent generating Bash)
- `src/claude/commands/isdlc.md` (state update scripts)
- `CLAUDE.md` or shared agent protocols
- Potentially: `src/claude/CLAUDE.md.template`
