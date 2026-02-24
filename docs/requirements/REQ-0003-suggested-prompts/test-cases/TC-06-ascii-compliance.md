# Test Cases: TC-06 - ASCII Compliance

**Validation Rules:** VR-006
**Priority:** Medium
**Traced Requirements:** NFR-005, ADR-004

---

## TC-06-01: No non-ASCII characters in SUGGESTED PROMPTS sections

**Description:** All prompt text in SUGGESTED PROMPTS sections (and PROMPT EMISSION PROTOCOL) uses only ASCII characters.

**Preconditions:** Feature implementation complete.

**Steps:**
1. For each of the 36 agent files:
   - Extract the `# SUGGESTED PROMPTS` (or `# PROMPT EMISSION PROTOCOL`) section content
   - Iterate over every character in the section
   - Check that each character code is in the range 0x00-0x7F

**Expected Result:** All characters are ASCII.

**Specifically reject:**
- Emoji (U+1F600-U+1F9FF range)
- Box-drawing characters (U+2500-U+257F)
- Smart quotes (U+2018-U+201D)
- Em-dashes (U+2014)
- En-dashes (U+2013)
- Non-breaking spaces (U+00A0)

---

## TC-06-02: No emoji in prompt sections

**Description:** Double-check that no emoji appears in any prompt section (a more targeted subset of TC-06-01).

**Steps:**
1. For each of the 36 agent files:
   - Extract prompt section content
   - Apply regex pattern for common emoji ranges: `/[\u{1F600}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}]/u`

**Expected Result:** No matches in any file.

**Rationale:** NFR-005 requires cross-platform compatibility. Emoji rendering varies across terminals (Windows cmd.exe may display garbled text).
