# TC-10: Sequential Numbering Instructions Present

**Test ID:** TC-10
**Category:** Structural validation
**Fix Requirement:** FIX-001
**Acceptance Criteria:** AC-1

---

## Objective

Verify that STEP 2 in `isdlc.md` contains explicit instructions for sequential `[N]` numbering starting from 1.

## Preconditions

- `src/claude/commands/isdlc.md` exists

## Test Steps

1. Read `isdlc.md` and locate the STEP 2 section
2. Search for sequential numbering instructions
3. Verify the format `[N]` is described with starting value of 1

## Expected Results

- STEP 2 mentions `sequential` numbering
- STEP 2 mentions `[N]` format
- STEP 2 specifies starting from 1
- The subject format includes `[N] {base subject}`

## Key Patterns to Verify

- `sequential` keyword in STEP 2
- `[N]` format reference
- `starting at 1` or `incrementing by 1` instruction
- `[N] {base subject}` or similar format specification
