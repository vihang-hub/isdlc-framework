# Test Cases: TC-11 - State Schema Integrity

**Validation Rules:** VR-011
**Priority:** High
**Traced Requirements:** NFR-006, Article XIV

---

## TC-11-01: No agent file writes prompt data to state.json

**Description:** The implementation must NOT add any new fields to state.json for prompt storage. Prompts are ephemeral text output only (NFR-006).

**Preconditions:** Feature implementation complete.

**Steps:**
1. For each of the 36 agent files:
   - Read full file content
   - Within the `# SUGGESTED PROMPTS` (or `# PROMPT EMISSION PROTOCOL`) section:
   - Search for patterns suggesting state.json writes for prompts:
     - `"suggested_prompts"` (potential new field name)
     - `"prompts"` as a state.json key (in context of writing, not reading)
     - `"prompt_history"` or similar
   - Check that the section does NOT contain instructions to write prompt data to state.json
   - Verify the section contains "No writes" or "read-only" or "ephemeral" language (positive assertion)

**Expected Result:** No state.json write patterns found for prompt storage in any of the 36 files.

**Additional verification (manual):**
- After implementation, diff state.json schema before and after
- Assert no new top-level keys
- Assert no new keys within `active_workflow`
- Assert no new keys within `phases`

**Rationale:** Per NFR-006 and Article XIV (State Management Integrity), prompts are ephemeral output. The agent reads `active_workflow` from state.json (which already exists) but never writes prompt-related data back.
