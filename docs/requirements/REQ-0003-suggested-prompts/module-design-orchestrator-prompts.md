# Module Design: Orchestrator Prompt Emission Protocol

**Artifact ID:** REQ-0003-suggested-prompts
**Phase:** 04 - Design
**Component:** SDLC Orchestrator (Agent 00)
**File:** `src/claude/agents/00-sdlc-orchestrator.md`
**Created:** 2026-02-08
**Status:** Final

---

## 1. Overview

The SDLC Orchestrator emits suggested prompt blocks at 5 lifecycle points per ADR-006. This module design specifies the exact content, placement, and dynamic resolution logic for each emission point.

The orchestrator's prompt emission is a new `# PROMPT EMISSION PROTOCOL` section added to `00-sdlc-orchestrator.md`. This section instructs the orchestrator LLM when and how to emit prompt blocks.

---

## 2. Section Placement

The `# PROMPT EMISSION PROTOCOL` section is inserted into the orchestrator file at this location:

```
# CONSTITUTIONAL GOVERNANCE                     <-- existing section (near end)
...

# PROMPT EMISSION PROTOCOL                      <-- NEW SECTION

# PROGRESS TRACKING (TASK LIST)                 <-- existing section
...

# QUALITY STANDARDS                             <-- existing section
...
```

**Rationale:** The prompt emission protocol is placed after constitutional governance (it is operational behavior, not governance) and before the task list protocol (prompts are emitted during the same lifecycle points where tasks are tracked).

---

## 3. Emission Point Designs

### 3.1 Emission Point 1: Workflow Initialization

**Trigger:** After `active_workflow` is written to state.json and phase tasks are created, before delegating to the first phase agent.

**Template:**

```
---
SUGGESTED NEXT STEPS:
  [1] Describe your {workflow_noun} to begin {first_phase_name}
  [2] Show workflow phases
  [3] Show workflow status
---
```

**Dynamic Resolution:**

| Placeholder | Source | Example |
|-------------|--------|---------|
| `{workflow_noun}` | `active_workflow.type` mapped to noun | feature -> "feature", fix -> "bug", upgrade -> "upgrade target" |
| `{first_phase_name}` | `resolve_display_name(active_workflow.phases[0])` | "Phase 01 - Requirements" |

**Workflow Noun Mapping:**

| Workflow Type | Noun |
|---------------|------|
| feature | feature |
| fix | bug |
| full-lifecycle | project |
| test-run | (not emitted -- auto-starts) |
| test-generate | (not emitted -- auto-starts) |
| upgrade | upgrade target |

**Edge Case:** For test-run and test-generate workflows, skip emission point 1. These workflows auto-start without user description input.

---

### 3.2 Emission Point 2: Gate Passage

**Trigger:** After GATE-NN PASSED announcement, before delegating to the next phase agent. This is the most frequent emission point.

**Template (not last phase):**

```
---
SUGGESTED NEXT STEPS:
  [1] Continue to {next_phase_name}
  [2] Review {current_phase_noun} artifacts
  [3] Show workflow status
---
```

**Template (last phase -- gate of final phase passes):**

```
---
SUGGESTED NEXT STEPS:
  [1] Complete workflow and merge to main
  [2] Review all workflow artifacts
  [3] Show workflow status
---
```

**Dynamic Resolution:**

| Placeholder | Source |
|-------------|--------|
| `{next_phase_name}` | `resolve_display_name(active_workflow.phases[current_phase_index + 1])` |
| `{current_phase_noun}` | Derived from current phase key -- see phase noun table below |

**Phase Noun Table (for "Review X artifacts"):**

| Phase Key | Noun |
|-----------|------|
| 00-quick-scan | quick scan |
| 01-requirements | requirements |
| 02-impact-analysis | impact analysis |
| 02-tracing | trace analysis |
| 03-architecture | architecture |
| 04-design | design |
| 05-test-strategy | test strategy |
| 06-implementation | implementation |
| 07-testing | integration test |
| 08-code-review | code review |
| 09-validation | security validation |
| 10-cicd | CI/CD pipeline |
| 11-local-testing | local testing |
| 12-remote-build | remote build |
| 13-test-deploy | staging deployment |
| 14-production | release |
| 15-operations | operations |
| 16-upgrade-plan | upgrade plan |
| 16-upgrade-execute | upgrade execution |

**Important:** The orchestrator emits this prompt ONLY when it handles transitions itself (between phases in the workflow). Phase agents also emit their own prompts at phase completion. The orchestrator prompt appears after the gate announcement; the phase agent prompt appears at the end of the agent's response. These are temporally separated and do not conflict.

---

### 3.3 Emission Point 3: Gate Failure

**Trigger:** After GATE-NN FAILED announcement (gate validation found issues).

**Template:**

```
---
SUGGESTED NEXT STEPS:
  [1] Review gate failure details
  [2] Retry gate check
  [3] Escalate to human
---
```

**No dynamic resolution needed.** Gate failure prompts are static because the failure details are in the gate validation output above the prompt block.

---

### 3.4 Emission Point 4: Blocker/Escalation

**Trigger:** When the orchestrator escalates a blocker to human intervention.

**Template:**

```
---
SUGGESTED NEXT STEPS:
  [1] Resolve blocker and retry
  [2] Cancel workflow
  [3] Show workflow status
---
```

**No dynamic resolution needed.** The blocker description is in the escalation output above the prompt block.

---

### 3.5 Emission Point 5: Workflow Completion

**Trigger:** After the workflow completion summary (post-merge for branched workflows, post-summary for non-branched).

**Template:**

```
---
SUGGESTED NEXT STEPS:
  [1] Start a new feature
  [2] Run tests
  [3] View project status
---
```

**No dynamic resolution needed.** These are static post-completion actions.

**Cancellation variant:** When `/sdlc cancel` completes:

```
---
SUGGESTED NEXT STEPS:
  [1] Start a new feature
  [2] View project status
---
```

---

## 4. Orchestrator Section Content

The `# PROMPT EMISSION PROTOCOL` section in `00-sdlc-orchestrator.md` contains:

```markdown
# PROMPT EMISSION PROTOCOL

After completing a lifecycle action, emit a SUGGESTED NEXT STEPS block to guide the user.
The block uses `---` delimiters with numbered `[N]` items (see interface-spec.md for format).

## Emission Points

Emit a prompt block at exactly these 5 lifecycle moments:

### 1. Workflow Initialization (after writing active_workflow to state.json)

Read active_workflow.type to determine the workflow noun:
- feature -> "feature"
- fix -> "bug"
- full-lifecycle -> "project"
- upgrade -> "upgrade target"
- test-run, test-generate -> skip this emission point (auto-start)

Read active_workflow.phases[0] to determine first phase name.
Resolve display name: split on first hyphen, title-case remainder.

Emit:
  [1] Describe your {noun} to begin {first_phase_name}
  [2] Show workflow phases
  [3] Show workflow status

### 2. Gate Passage (after GATE-NN PASSED, before next delegation)

Read active_workflow.phases and current_phase_index.
If next phase exists: resolve next phase display name.
If at last phase: use "Complete workflow and merge to main".

Emit (not last phase):
  [1] Continue to {next_phase_name}
  [2] Review {current_phase_noun} artifacts
  [3] Show workflow status

Emit (last phase):
  [1] Complete workflow and merge to main
  [2] Review all workflow artifacts
  [3] Show workflow status

### 3. Gate Failure (after GATE-NN FAILED)

Emit:
  [1] Review gate failure details
  [2] Retry gate check
  [3] Escalate to human

### 4. Blocker/Escalation (when escalating to human)

Emit:
  [1] Resolve blocker and retry
  [2] Cancel workflow
  [3] Show workflow status

### 5. Workflow Completion (after completion summary or cancellation)

Emit (completion):
  [1] Start a new feature
  [2] Run tests
  [3] View project status

Emit (cancellation):
  [1] Start a new feature
  [2] View project status
```

---

## 5. Interactive Menu Prompt Integration

The orchestrator's no-argument interactive menus (Scenarios 1-4) already present numbered options. These are NOT changed to use the prompt format. The prompt emission protocol applies only to the 5 lifecycle points listed above.

**Rationale:** Interactive menus use their own established format (boxed headers with numbered options). Adding a separate prompt block after the menu would be redundant and confusing. The menu IS the suggested action.

---

## 6. Validation Checklist

| Check | Criterion | Traced To |
|-------|-----------|-----------|
| Format | Uses `---` delimiters, `SUGGESTED NEXT STEPS:` header, `[N]` items | REQ-005, ADR-004 |
| Tier order | [1] is always primary, last is always utility | ADR-003 |
| Dynamic resolution | Phase names derived from phase keys, not hardcoded | ADR-002, ADR-007 |
| Emission count | Exactly 5 emission points | ADR-006 |
| No state writes | No prompt data persisted to state.json | NFR-006 |
| ASCII only | No Unicode characters in prompt text | NFR-005 |
| No menu overlap | Interactive menus (Scenarios 1-4) do not get additional prompt blocks | Section 5 |
| Fail-safe | If active_workflow is null, no emission (silent skip) | ADR-001, Article X |

---

## 7. Traceability

| Design Element | Requirements | ADRs | NFRs | AC |
|----------------|-------------|------|------|-----|
| 5 emission points | REQ-004 | ADR-006 | - | AC-004-01, AC-004-02 |
| Dynamic phase names | REQ-002, REQ-006 | ADR-002, ADR-007 | NFR-007 | AC-001-02, AC-001-03, AC-002-01 |
| Canonical format | REQ-005 | ADR-004 | NFR-005 | AC-003-01 |
| Primary prompt position | REQ-001 | ADR-003 | - | AC-003-02 |
| No state writes | - | - | NFR-006 | - |
| Workflow completion prompts | REQ-004 | ADR-006 | - | AC-004-02 |
