# Test Cases: TC-03 - Sub-Agent Format Compliance

**Validation Rules:** VR-003
**Priority:** Critical
**Traced Requirements:** REQ-004, ADR-005

---

## TC-03-01: Sub-agents have STATUS pattern in prompt section

**Description:** Every sub-agent's SUGGESTED PROMPTS section contains `STATUS:`.

**Preconditions:** Feature implementation complete.

**Steps:**
1. For each of the 17 sub-agent files:
   - Extract `# SUGGESTED PROMPTS` section content
   - Search for `STATUS:` string

**Expected Result:** Found in all 17 sub-agent files.

---

## TC-03-02: Sub-agents do NOT have [1], [2], [3] numbered items

**Description:** Sub-agents emit a status line, not a multi-option menu. They should NOT contain numbered items.

**Steps:**
1. For each of the 17 sub-agent files:
   - Extract `# SUGGESTED PROMPTS` section content
   - Search for `[1]`, `[2]`, `[3]` strings within the section

**Expected Result:** None of the 17 files contain `[1]`, `[2]`, or `[3]` within their SUGGESTED PROMPTS section.

**Rationale:** This enforces the distinction between sub-agents (STATUS format) and phase agents (navigation format).

---

## TC-03-03: Sub-agents do NOT have SUGGESTED NEXT STEPS

**Description:** The `SUGGESTED NEXT STEPS:` header is reserved for phase agents and sub-orchestrators.

**Steps:**
1. For each of the 17 sub-agent files:
   - Extract `# SUGGESTED PROMPTS` section content
   - Search for `SUGGESTED NEXT STEPS:` string

**Expected Result:** String NOT found in any of the 17 files.

---

## TC-03-04: Sub-agents reference their parent orchestrator

**Description:** Each sub-agent's STATUS line includes a reference to its parent orchestrator.

**Steps:**
1. For each of the 17 sub-agent files:
   - Extract `# SUGGESTED PROMPTS` section content
   - Search for `Returning results to` string

**Expected Result:** Found in all 17 files.

**Verification Data:**
- 11 discover sub-agents reference "discover orchestrator"
- 3 impact-analysis sub-agents reference "impact analysis orchestrator"
- 3 tracing sub-agents reference "tracing orchestrator"
