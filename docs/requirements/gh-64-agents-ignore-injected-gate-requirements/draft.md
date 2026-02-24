# GH-64: Agents Ignore Injected Gate Requirements

## Problem

Gate requirements pre-injection (REQ-0024, `gate-requirements-injector.cjs`) tells agents what hooks will enforce (e.g., "do not commit during intermediate phases"). But agents sometimes ignore these constraints and attempt the blocked action anyway. The hook safety net catches it, but the iteration is wasted and the agent has to recover.

## Observed Behavior

During BUG-0029 Phase 06, the software-developer agent ran `git commit` despite:
1. The Git Commit Prohibition in CLAUDE.md
2. The injected gate requirements block in the delegation prompt
3. The branch-guard hook's enforcement

The `branch-guard` hook blocked the commit correctly, but the commit still partially executed (the commit message appeared in output). The agent then had to recover from the blocked action, wasting an iteration.

## Root Causes to Investigate

1. **Context dilution**: Gate requirements text gets buried in long agent prompts (8th of 11 sections, 26+ lines after core task instruction)
2. **Competing instructions**: Agent's constitutional articles mention "commit messages" (VI) and "commits" (VII) for traceability, potentially conflicting with the prohibition
3. **Constraint salience**: Plain text block with no special formatting; shares formatting with other verbose blocks
4. **No feedback loop**: When a hook blocks, the agent sees only error text with no link back to the injected gate requirements
5. **Fail-open injection**: If gate requirements injection fails silently, agent never knows constraints exist

## Potential Solutions

- Strengthen injection format (CRITICAL CONSTRAINT prefix, shorter text, repeated at end)
- Audit agent files for competing instructions
- Add constraint acknowledgment step
- Post-hook feedback loop linking blocks to gate requirements
- Move critical prohibitions inline into agent files

## Impact

Wasted iterations degrade performance budgets (REQ-0025). Each blocked-then-retried action costs ~1-2 min.

## Related

- REQ-0024 (gate requirements pre-injection)
- REQ-0025 (performance budget)
- Git Commit Prohibition in CLAUDE.md
- #65 (gate-blocker blocks analyze/add during active workflows)
