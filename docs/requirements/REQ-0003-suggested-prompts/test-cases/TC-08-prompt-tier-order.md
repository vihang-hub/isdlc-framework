# Test Cases: TC-08 - Prompt Tier Order

**Validation Rules:** VR-008
**Priority:** High
**Traced Requirements:** REQ-001, REQ-003, ADR-003, AC-003-02

---

## TC-08-01: [1] is the primary action in all canonical blocks

**Description:** In every canonical prompt block template (phase agents and sub-orchestrators), `[1]` must be the primary action that advances the workflow.

**Preconditions:** Feature implementation complete.

**Steps:**
1. For each of the 16 phase agents and 3 sub-orchestrators (19 total):
   - Extract `## Output Format` subsection
   - Find the line containing `[1]`
   - Assert: line contains either:
     - A placeholder for the primary action (`{primary_prompt}`, `{display_name}`)
     - "Complete workflow" (for last-phase case)
     - "Start a new feature" (for discover-orchestrator post-workflow)

**Expected Result:** `[1]` is always the primary/advance action in all 19 files.

---

## TC-08-02: Last [N] is the utility action

**Description:** The last numbered item in each canonical prompt block must be the utility action (typically "Show workflow status" or "View project status").

**Steps:**
1. For each of the 16 phase agents and 3 sub-orchestrators:
   - Extract `## Output Format` subsection
   - Find all `[N]` lines
   - Get the last `[N]` line
   - Assert: contains "status" (case-insensitive) -- e.g., "Show workflow status", "View project status"

**Expected Result:** Last item in all 19 files contains "status".

**Exception:** Discover orchestrator's last item is "View project status" (still contains "status").

---

## TC-08-03: Items are sequential with no gaps

**Description:** Numbered items must be sequential starting from 1 with no gaps.

**Steps:**
1. For each of the 16 phase agents and 3 sub-orchestrators:
   - Extract `## Output Format` subsection
   - Find all `[N]` references
   - Extract the numbers
   - Assert: numbers form a contiguous sequence starting at 1 (e.g., [1,2,3] or [1,2,3,4])
   - Assert: total count is between 2 and 4 (inclusive)

**Expected Result:** Sequential numbering in all 19 files. No gaps (e.g., no [1], [3] without [2]).
