# TC-07: STEP 4 Cleanup Instructions Present

**Test ID:** TC-07
**Category:** Structural validation
**Fix Requirement:** FIX-003
**Acceptance Criteria:** AC-4, AC-5
**Root Cause:** RC5 (STEP 4 had zero task cleanup instructions), RC6 (Cancellation assumed tasks vanish)

---

## Objective

Verify that STEP 4 (FINALIZE) in `isdlc.md` contains explicit instructions to clean up the task list after workflow completion.

## Preconditions

- `src/claude/commands/isdlc.md` exists

## Test Steps

1. Read `isdlc.md` and locate the STEP 4 section
2. Search for cleanup-related instructions
3. Verify the instructions tell the agent to handle remaining tasks after finalize

## Expected Results

- STEP 4 contains instructions to handle tasks after the orchestrator returns from finalize
- Instructions include using `TaskList` to find remaining tasks
- Instructions include marking remaining tasks as `completed` with strikethrough
- The word "clean" or "cleanup" or "strikethrough" appears in STEP 4

## Key Patterns to Verify

- `TaskList` mentioned in STEP 4
- `completed` mentioned in the cleanup context
- `strikethrough` mentioned in STEP 4
- Instructions apply to tasks still showing as `pending` or `in_progress`
