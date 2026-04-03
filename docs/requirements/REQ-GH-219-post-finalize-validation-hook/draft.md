# Post-finalize validation hook -- verify all finalization steps completed

**Source**: GitHub Issue #219
**Type**: Feature (REQ)

## Problem

When the orchestrator agent returns early during STEP 4 (FINALIZE) of the Phase-Loop Controller, some finalization steps may not execute:
- `active_workflow` not moved to `workflow_history`
- `state.json` not cleaned up (current_phase, active_agent, phases not reset)
- Session cache not rebuilt (`node bin/rebuild-cache.js`)
- Contracts not regenerated (`node bin/generate-contracts.js`)
- Code index not refreshed
- Memory embeddings not rebuilt

There is no validation that finalization actually completed. The workflow is considered done even if half the cleanup was skipped.

## Proposed Change

Add a post-finalize validation hook that runs after STEP 4 and checks:
1. `active_workflow` is null in state.json
2. `workflow_history` contains the just-completed workflow entry
3. `current_phase` and `active_agent` are null
4. Feature branch has been deleted (if applicable)
5. Session cache rebuild was attempted
6. Contract regeneration was attempted

If any check fails, emit a warning with the specific missing steps and offer to re-run them.

## Context

Discovered during GH-218 build when the orchestrator agent returned early during finalization. The visible steps (git merge, GitHub close, BACKLOG.md) were handled manually but the internal bookkeeping (state.json cleanup, index refresh) was missed.

The hook should be lightweight -- it reads state.json and checks conditions, it doesn't re-run the steps itself. It just catches the gap and reports it.
