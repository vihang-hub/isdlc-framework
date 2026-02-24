# Bug Report: BUG-0004 — state.json Bloat and Stale Data

**Reported**: 2026-02-09
**Severity**: Medium
**Priority**: High
**Workflow**: fix
**Artifact Folder**: BUG-0004-state-json-bloat

---

## Summary

`state.json` grows unbounded with every workflow, accumulating hundreds of `skill_usage_log` entries, verbose phase history from completed workflows, and detailed action history. This wastes agent context window space and slows down reads.

---

## Expected Behavior

- `state.json` should be small (under ~200 lines / ~10 KB), containing only essential runtime state
- Historical data (skill usage logs, completed workflow phase details, action history) should be pruned after workflow completion or moved to separate archive files
- Agents should be able to read state.json quickly without filling their context with hundreds of lines of irrelevant historical data
- After a workflow completes, `phases` should be cleaned to remove detailed iteration tracking, constitutional validation history, and test iteration history from completed phases

## Actual Behavior

- `state.json` is 1587 lines / ~64 KB after just 4 workflows
- `skill_usage_log`: 695 lines (20.5 KB) -- never pruned, grows with every agent/explore invocation
- `phases`: 543 lines (16.5 KB) -- retains verbose `iteration_requirements`, `constitutional_validation`, `verification_summary`, and `testing_environment` from all completed phases across ALL workflows (not just the active one)
- `history`: 157 lines (16.5 KB) -- multi-paragraph action descriptions that duplicate workflow_history
- Essential runtime state is only ~134 lines / ~5 KB (~16% of file)
- ~84% of the file content is historical data that is never queried during active work

## Reproduction Steps

1. Run `/sdlc feature "any feature"` and complete the full workflow
2. Run `/sdlc fix "any bug"` and complete the full workflow
3. Open `.isdlc/state.json` and observe:
   - `skill_usage_log` contains every agent invocation from both workflows
   - `phases` contains detailed iteration tracking from both workflows (phases from workflow 1 are still present during workflow 2)
   - `history` contains multi-paragraph descriptions of every phase transition

## Root Cause Analysis

1. **`skill_usage_log`**: No pruning or rotation mechanism. Every skill invocation appends to the array indefinitely.
2. **`phases`**: Phase entries persist across workflows. When workflow 1 completes, its detailed phase data (iteration_requirements, constitutional_validation, testing_environment, verification_summary) is NOT cleaned up before workflow 2 starts. Additionally, within a single workflow, verbose sub-objects accumulate.
3. **`history`**: Every phase transition and gate passage appends a multi-paragraph entry. No max length or rotation.
4. **Workflow completion**: The orchestrator moves the workflow to `workflow_history` and sets `active_workflow` to null, but does NOT prune `phases`, `skill_usage_log`, or `history`.

## Impact

- **Context waste**: Every agent that reads state.json consumes ~1500 tokens on historical data it will never use
- **Latency**: Larger files take longer for agents to read and parse
- **Error-prone**: With so much data in the file, agents may misread or modify the wrong section
- **Compounding**: The problem gets worse with every workflow -- after 10 workflows, state.json could be 10,000+ lines

---

## Affected Files

| File | Role |
|------|------|
| `.isdlc/state.json` | Primary state file (the file being fixed) |
| `src/claude/agents/00-sdlc-orchestrator.md` | Writes state.json at workflow init/completion |
| `src/claude/commands/sdlc.md` | Phase-loop controller, reads/writes state.json |
| `src/claude/hooks/common.cjs` | Hook library that reads/writes state.json |
| `src/claude/hooks/log-skill-usage.cjs` | Appends to skill_usage_log |
| `src/claude/hooks/gate-blocker.cjs` | Reads phases and iteration state |

---

## Sufficiency Check

- [x] Expected behavior described
- [x] Actual behavior described with measurements
- [x] Reproduction steps provided
- [x] Root cause hypothesis provided
