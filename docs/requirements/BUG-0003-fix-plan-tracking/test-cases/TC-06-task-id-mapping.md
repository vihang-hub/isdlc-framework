# TC-06: STEP 2 Task-ID Mapping Instructions Present

**Test ID:** TC-06
**Category:** Structural validation
**Fix Requirement:** FIX-002
**Acceptance Criteria:** AC-2, AC-3
**Root Cause:** RC4 (No explicit phase-key-to-taskId mapping)

---

## Objective

Verify that STEP 2 in `isdlc.md` contains explicit instructions to maintain a mapping between phase keys and task IDs, so that STEP 3 can update the correct task.

## Preconditions

- `src/claude/commands/isdlc.md` exists

## Test Steps

1. Read `isdlc.md` and locate the STEP 2 section
2. Search for mapping-related instructions (task_id, phase_key, mapping)
3. Verify the instructions tell the agent to maintain a lookup between phases and task IDs

## Expected Results

- STEP 2 contains instruction to maintain a mapping of `{phase_key -> task_id}`
- The mapping is explicitly mentioned so STEP 3 can reference it
- Either the word "mapping" or "task_id" appears in STEP 2

## Key Patterns to Verify

- `mapping` keyword in STEP 2
- `phase_key` and `task_id` (or similar) mentioned together
- Instruction to save the mapping for use in STEP 3
