# T7: Agent Prompt Boilerplate Extraction

**Source**: BACKLOG.md item 2.3 (Performance category)
**Backlog ID**: 2.3

## Description

ROOT RESOLUTION, MONOREPO, and ITERATION protocols are duplicated across 17 agents (~3,600 lines total). These shared sections should be extracted to CLAUDE.md so they are inherited automatically by all agents, eliminating duplication and reducing per-agent prompt size.

This is a follow-up to T2 (which moved some shared content to CLAUDE.md).

## Impact

- 2-3% speedup per agent delegation (smaller prompt = less token processing)
- Reduced maintenance burden (single source of truth for shared protocols)
- Lower risk of protocol drift between agents

## Complexity

Low — mechanical extraction. The shared sections are identical across agents and can be moved verbatim.

## Key Details

- **Duplicated sections**: ROOT RESOLUTION, MONOREPO, ITERATION protocols
- **Affected agents**: ~17 agent files in `src/claude/agents/`
- **Target location**: `CLAUDE.md` (project root) — already contains some shared protocols from T2
- **Line reduction**: ~3,600 lines removed from agent files total (~210 lines per agent)
