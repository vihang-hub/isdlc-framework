# Implementation Notes: BUG-0029-GH-18

## Summary

Rewrote all multiline Bash/sh code blocks in 10 affected agent and command markdown files to single-line equivalents. Added the Single-Line Bash Convention documentation to both CLAUDE.md and CLAUDE.md.template.

## Changes Made

### FR-001: Multiline Bash Block Rewrites (10 files)

| File | Blocks Fixed | Rewrite Strategy |
|------|-------------|-----------------|
| `src/claude/agents/05-software-developer.md` | 3 | Comment-interleaved examples converted to inline prose; CPU detection commands merged into single sentence |
| `src/claude/agents/06-integration-tester.md` | 5 | Piped discovery commands moved to numbered list with inline code; scan commands to bullet list; acceptance test commands to prose |
| `src/claude/commands/discover.md` | 1 | Multiline slash-command examples converted to table format |
| `src/claude/commands/provider.md` | 10 | Setup steps converted to numbered lists; troubleshooting commands to inline prose; model pull commands to bullet list |
| `src/claude/commands/isdlc.md` | 1 | Quick start examples merged into inline prose |
| `src/claude/agents/discover/data-model-analyzer.md` | 6 | Comment-only descriptive blocks replaced with a single lookup table |
| `src/claude/agents/discover/skills-researcher.md` | 2 | API search and skill install commands merged into inline prose |
| `src/claude/agents/discover/test-evaluator.md` | 1 | Multi-command test counting block split into individual bullet items with inline code |
| `src/claude/agents/discover/architecture-analyzer.md` | 1 | 10-line backslash-continuation `find` command joined into single line; comment moved to markdown prose |
| `src/claude/agents/quick-scan/quick-scan-agent.md` | 1 | 6-line multi-command block (glob + grep) split into 4 separate single-line code blocks; comments moved to markdown prose |

### FR-002: CLAUDE.md Convention Section

Added `### Single-Line Bash Convention` section under `## Agent Framework Context` with:
- Rule statement (all bash blocks must be single-line)
- Explanation (glob `*` does not match newlines)
- Transformation pattern table (5 patterns)
- Escape hatch documentation (extract to `bin/` scripts)
- Reference format for agent files

### FR-004: CLAUDE.md.template Convention Section

Added identical `### Single-Line Bash Convention` section to `src/claude/CLAUDE.md.template` after the CONSTITUTIONAL PRINCIPLES Preamble section.

### FR-003: Script Extraction

No multiline blocks required extraction to `bin/` script files. All blocks were successfully converted to single-line equivalents or inline prose.

## Test Results

- **Test file**: `src/claude/hooks/tests/multiline-bash-validation.test.cjs`
- **Total tests**: 38
- **Pass**: 38
- **Fail**: 0
- **Categories**: FR-001 validation (10 files), FR-002 CLAUDE.md checks (6), FR-004 template checks (4), negative detection tests (8), regression tests (8), codebase-wide sweep (2)

## Decisions

1. **Comment-only bash blocks** (data-model-analyzer.md): Replaced with markdown tables since they contained only descriptive comments, not executable commands
2. **Slash command examples** (discover.md, isdlc.md): Converted to tables or inline prose since these are not actual shell commands
3. **Provider setup guides** (provider.md): Converted multi-step instructions to numbered lists with inline code, preserving readability
4. **Detection regex**: Used `filter(l => l.trim().length > 0)` to ignore blank lines within bash blocks, avoiding false positives from padding

## Traceability

- BUG-0029-GH-18 -> FR-001, FR-002, FR-003, FR-004
- Test file traces to all FRs via test suite names
