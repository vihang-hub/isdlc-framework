# Test Cases: TC-09 - Fallback Presence

**Validation Rules:** VR-009
**Priority:** Medium
**Traced Requirements:** Architecture edge case 7.1, Article X, AC-005-03

---

## TC-09-01: Phase agents and dynamic sub-orchestrators have Fallback section

**Description:** Every phase agent and every sub-orchestrator with dynamic resolution has a Fallback section within SUGGESTED PROMPTS.

**Preconditions:** Feature implementation complete.

**Steps:**
1. For each of the 16 phase agent files:
   - Extract `# SUGGESTED PROMPTS` section
   - Search for `## Fallback` (or `## Fallback (No Active Workflow)`)
2. For `impact-analysis-orchestrator.md` and `tracing-orchestrator.md`:
   - Same check

**Expected Result:** Fallback subsection found in all 18 files (16 phase agents + 2 dynamic sub-orchestrators).

**Exception:** `discover-orchestrator.md` does NOT need a Fallback section (it uses static prompts and never reads `active_workflow`).

**Exception:** Sub-agents (17 files) do NOT need a Fallback section (they use STATUS format).

---

## TC-09-02: Fallback includes "Show project status"

**Description:** The fallback prompt block must include "Show project status" as an option.

**Steps:**
1. For each of the 18 files with a Fallback section:
   - Extract Fallback subsection content
   - Search for "Show project status" (case-sensitive)

**Expected Result:** Found in all 18 files.

---

## TC-09-03: Fallback includes "Start a new workflow"

**Description:** The fallback prompt block must include "Start a new workflow" as an option.

**Steps:**
1. For each of the 18 files with a Fallback section:
   - Extract Fallback subsection content
   - Search for "Start a new workflow" (case-sensitive)

**Expected Result:** Found in all 18 files.

**Rationale:** These two fallback prompts provide a safe, actionable path when no active workflow exists (Article X - Fail-Safe Defaults).
