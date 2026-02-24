# Module Design: Sub-Orchestrator Prompt Sections

**Artifact ID:** REQ-0003-suggested-prompts
**Phase:** 04 - Design
**Components:** 3 Sub-Orchestrator Agent Markdown Files
**Created:** 2026-02-08
**Status:** Final

---

## 1. Overview

Sub-orchestrators coordinate groups of sub-agents and report results to the SDLC orchestrator or directly to the user. Unlike sub-agents (which emit minimal STATUS lines), sub-orchestrators are user-facing agents that present consolidated analysis results. They receive full 3-tier prompt blocks.

### 1.1 Sub-Orchestrator Inventory

| Agent | File | Parent | Context |
|-------|------|--------|---------|
| Impact Analysis Orchestrator | `impact-analysis/impact-analysis-orchestrator.md` | SDLC Orchestrator | Feature workflow Phase 02 |
| Tracing Orchestrator | `tracing/tracing-orchestrator.md` | SDLC Orchestrator | Fix workflow Phase 02 |
| Discover Orchestrator | `discover-orchestrator.md` | Direct user invocation via `/discover` | Pre-workflow discovery |

---

## 2. Sub-Orchestrator Template

Sub-orchestrators use the same template structure as phase agents, with one key difference: their primary prompt returns control to the SDLC orchestrator rather than referencing the next phase directly.

```markdown
# SUGGESTED PROMPTS

At the end of your orchestration work (after all sub-agents have returned and the
consolidated report is saved), emit a suggested next steps block.

## Resolution Logic

1. Read `active_workflow` from `.isdlc/state.json`
2. If `active_workflow` is null or missing: emit fallback prompts (see Fallback below)
3. Read `active_workflow.phases[]` and `active_workflow.current_phase_index`
4. Let next_index = current_phase_index + 1
5. If next_index < phases.length:
   - next_phase_key = phases[next_index]
   - Resolve display name: split key on first hyphen, title-case the remainder
   - primary_prompt = "Continue to {display_name}"
6. If next_index >= phases.length:
   - primary_prompt = "Complete workflow and merge to main"

## Output Format

---
SUGGESTED NEXT STEPS:
  [1] {primary_prompt}
  [2] {sub_orchestrator_specific_alternative}
  [3] Show workflow status
---

## Fallback (No Active Workflow)

---
SUGGESTED NEXT STEPS:
  [1] Show project status
  [2] Start a new workflow
---
```

---

## 3. Per-Sub-Orchestrator Customization

### 3.1 Impact Analysis Orchestrator

**File:** `src/claude/agents/impact-analysis/impact-analysis-orchestrator.md`
**Phase context:** `02-impact-analysis` (feature workflow)
**Alternative prompt:** `Review impact analysis report`

**Insertion point:** After the "Upgrade Workflow Self-Validation" section (around line 800), at the end of the file. This agent does not have a closing motivational line -- the section is appended at the very end.

**Section content:**

```markdown
# SUGGESTED PROMPTS

At the end of your orchestration work (after all sub-agents have returned and
impact-analysis.md is saved), emit a suggested next steps block.

## Resolution Logic

1. Read `active_workflow` from `.isdlc/state.json`
2. If `active_workflow` is null or missing: emit fallback prompts (see Fallback below)
3. Read `active_workflow.phases[]` and `active_workflow.current_phase_index`
4. Let next_index = current_phase_index + 1
5. If next_index < phases.length:
   - next_phase_key = phases[next_index]
   - Resolve display name: split key on first hyphen, title-case the remainder
   - primary_prompt = "Continue to {display_name}"
6. If next_index >= phases.length:
   - primary_prompt = "Complete workflow and merge to main"

## Output Format

Emit this block as the last thing in your response:

---
SUGGESTED NEXT STEPS:
  [1] {primary_prompt}
  [2] Review impact analysis report
  [3] Show workflow status
---

## Fallback (No Active Workflow)

---
SUGGESTED NEXT STEPS:
  [1] Show project status
  [2] Start a new workflow
---
```

### 3.2 Tracing Orchestrator

**File:** `src/claude/agents/tracing/tracing-orchestrator.md`
**Phase context:** `02-tracing` (fix workflow)
**Alternative prompt:** `Review trace analysis report`

**Insertion point:** After the "SELF-VALIDATION" section (around line 419), at the end of the file. This agent does not have a closing motivational line.

**Section content:**

```markdown
# SUGGESTED PROMPTS

At the end of your orchestration work (after all sub-agents have returned and
trace-analysis.md is saved), emit a suggested next steps block.

## Resolution Logic

1. Read `active_workflow` from `.isdlc/state.json`
2. If `active_workflow` is null or missing: emit fallback prompts (see Fallback below)
3. Read `active_workflow.phases[]` and `active_workflow.current_phase_index`
4. Let next_index = current_phase_index + 1
5. If next_index < phases.length:
   - next_phase_key = phases[next_index]
   - Resolve display name: split key on first hyphen, title-case the remainder
   - primary_prompt = "Continue to {display_name}"
6. If next_index >= phases.length:
   - primary_prompt = "Complete workflow and merge to main"

## Output Format

Emit this block as the last thing in your response:

---
SUGGESTED NEXT STEPS:
  [1] {primary_prompt}
  [2] Review trace analysis report
  [3] Show workflow status
---

## Fallback (No Active Workflow)

---
SUGGESTED NEXT STEPS:
  [1] Show project status
  [2] Start a new workflow
---
```

### 3.3 Discover Orchestrator

**File:** `src/claude/agents/discover-orchestrator.md`
**Phase context:** Not part of any SDLC workflow -- invoked via `/discover` command
**Alternative prompt:** `Review discovery report`

**Insertion point:** After the "Related" section (around line 1870), at the end of the file.

**Special behavior:** The discover orchestrator does NOT run inside an `active_workflow`. It runs before any SDLC workflow. Therefore, its prompts are static (no dynamic phase resolution):

**Section content:**

```markdown
# SUGGESTED PROMPTS

At the end of discovery (after the walkthrough is complete and all reports are saved),
emit a suggested next steps block.

## Output Format

Emit this block as the last thing in your response:

---
SUGGESTED NEXT STEPS:
  [1] Start a new feature with /sdlc feature
  [2] Review discovery report
  [3] View project status
---

Note: The discover orchestrator runs outside SDLC workflows, so these prompts are static.
There is no active_workflow to read for dynamic resolution.
```

---

## 4. Estimated Line Impact

| Agent File | Current Lines | Added Lines | New Total |
|------------|---------------|-------------|-----------|
| impact-analysis-orchestrator.md | 801 | ~30 | ~831 |
| tracing-orchestrator.md | 419 | ~30 | ~449 |
| discover-orchestrator.md | 1870 | ~18 | ~1888 |
| **Total** | | **~78** | |

---

## 5. Traceability

| Design Element | Requirements | ADRs | AC |
|----------------|-------------|------|-----|
| Full 3-tier prompt blocks | REQ-001, REQ-005 | ADR-003, ADR-004 | AC-001-01, AC-003-01 |
| Dynamic phase resolution | REQ-002, REQ-006 | ADR-002, ADR-007 | AC-002-01 |
| User-facing classification | REQ-004 | ADR-005 | - |
| Discover static prompts | REQ-004 | ADR-005 | AC-004-01 |
| Per-orchestrator alternatives | REQ-003 | ADR-001 | AC-005-01 |
