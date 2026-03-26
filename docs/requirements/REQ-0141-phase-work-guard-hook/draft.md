# Phase-work guard hook — warn when phase agent not engaged before code changes

**Source**: GitHub Issue #118
**Type**: Enhancement (Should Have)

## Problem

No hook enforces structured agent engagement during phase work. The AI can skip reading phase agent files and edit code directly. Gate validation catches missing artifacts but not missing process.

**Root cause discovered**: 2026-03-10 when #102 build session skipped orchestrator engagement entirely -- no formal stage updates visible, just code getting changed.

## Analysis

### What hooks enforce today (works)
- `phase-sequence-guard` (PreToolUse[Task]): If you delegate via Task, it must target the correct phase
- `delegation-gate` (Stop): After `/isdlc` skill loads, some delegation must follow
- `explore-readonly-enforcer` (PreToolUse[Write,Edit]): No file writes during explore/chat mode

### What is NOT enforced (the gap)
Nothing prevents the AI from skipping the phase agent entirely and just editing files directly. The AI can:
1. Run `workflow-init.cjs` (creates the workflow)
2. Skip reading the phase agent file entirely
3. Start editing source files directly via Edit/Write tools
4. Run `phase-advance.cjs` -- if artifacts happen to exist, it passes the gate

## Proposed Solution

Warning-only `PreToolUse[Edit,Write]` hook:
- **When**: `active_workflow` exists AND current phase is `in_progress`
- **Check**: At least ONE `skill_usage_log` entry exists for this phase
- **If not**: Emit a visible notification (not a block): "No phase agent engaged yet for {phase}. Follow the Build Protocol."
- **Custom-workflow-aware**: Read phase-to-agent mapping from custom workflow definitions (#102). Pass through for phases with no mapped agent.

## Dependencies

- Depends on #102 (custom workflow definitions) -- the hook must be aware of dynamic phase-to-agent mappings

## Priority

Should Have -- Low-medium complexity
