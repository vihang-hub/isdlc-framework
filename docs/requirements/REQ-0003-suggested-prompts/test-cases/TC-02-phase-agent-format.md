# Test Cases: TC-02 - Phase Agent Format Compliance

**Validation Rules:** VR-002, VR-014
**Priority:** Critical
**Traced Requirements:** REQ-005, AC-003-01, AC-001-01

---

## TC-02-01: Phase agents have Resolution Logic subsection

**Description:** Every phase agent's SUGGESTED PROMPTS section contains a `## Resolution Logic` subsection.

**Preconditions:** Feature implementation complete.

**Steps:**
1. For each of the 16 phase agent files:
   - Extract text from `# SUGGESTED PROMPTS` heading to end of file (or next `#` heading)
   - Search for `## Resolution Logic` within that section

**Expected Result:** Subsection found in all 16 phase agents.

---

## TC-02-02: Phase agents have Output Format subsection

**Description:** Every phase agent's SUGGESTED PROMPTS section contains a `## Output Format` subsection.

**Steps:**
1. For each of the 16 phase agent files:
   - Extract SUGGESTED PROMPTS section
   - Search for `## Output Format`

**Expected Result:** Subsection found in all 16.

---

## TC-02-03: Phase agents have Fallback subsection

**Description:** Every phase agent's SUGGESTED PROMPTS section contains a `## Fallback` subsection.

**Steps:**
1. For each of the 16 phase agent files:
   - Extract SUGGESTED PROMPTS section
   - Search for `## Fallback` (may be `## Fallback (No Active Workflow)` or similar variant)

**Expected Result:** Subsection found in all 16. Match is case-insensitive on "Fallback".

---

## TC-02-04: Phase agents have SUGGESTED NEXT STEPS in output template

**Description:** The Output Format subsection contains the `SUGGESTED NEXT STEPS:` string.

**Steps:**
1. For each of the 16 phase agent files:
   - Extract SUGGESTED PROMPTS section
   - Search for `SUGGESTED NEXT STEPS:` string

**Expected Result:** String found in all 16 files.

---

## TC-02-05: Phase agents have [1], [2], [3] item references

**Description:** The Output Format subsection references at least three numbered items.

**Steps:**
1. For each of the 16 phase agent files:
   - Extract SUGGESTED PROMPTS section
   - Search for `[1]`, `[2]`, and `[3]` strings

**Expected Result:** All three found in each of the 16 files.

---

## TC-02-06: SUGGESTED PROMPTS appears after SELF-VALIDATION

**Description:** In files that have both sections, the SUGGESTED PROMPTS section appears after the SELF-VALIDATION section (VR-014).

**Steps:**
1. For each phase agent file:
   - Find line number of `# SELF-VALIDATION` (if present)
   - Find line number of `# SUGGESTED PROMPTS`
   - Assert: SELF-VALIDATION line < SUGGESTED PROMPTS line

**Expected Result:** Correct ordering in all files that have both sections.

**Exception:** Files without `# SELF-VALIDATION` are skipped (ordering rule does not apply).
