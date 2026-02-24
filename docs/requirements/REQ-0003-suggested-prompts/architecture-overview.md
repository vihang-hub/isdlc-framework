# Architecture Overview: REQ-0003 - Framework-Controlled Suggested Prompts

**Artifact ID:** REQ-0003-suggested-prompts
**Phase:** 03 - Architecture
**Created:** 2026-02-08
**Status:** Final

---

## 1. Executive Summary

This feature adds a structured prompt emission system to the iSDLC framework. Agents emit contextual "suggested next steps" at phase boundaries, replacing Claude Code's generic auto-generated suggestions with workflow-aware guidance.

The architecture is deliberately minimal: suggested prompts are **text templates embedded in agent markdown files** that agents interpolate at runtime using existing `active_workflow` state. There is no runtime engine, no configuration registry, no new hooks, no new dependencies, and no state schema changes.

### Architecture Principles Applied

| Principle | Application |
|-----------|-------------|
| Article V (Simplicity First) | Text templates in markdown -- no prompt engine, no config registry |
| Article VIII (Documentation Currency) | Prompt definitions live inside agent files -- self-documenting |
| Article X (Fail-Safe Defaults) | Missing SUGGESTED PROMPTS section = no prompts emitted (backward compatible) |
| Article XIV (State Management Integrity) | No new state.json fields -- prompts are ephemeral output only |

---

## 2. System Context

### 2.1 Current State (Before)

```
User runs /sdlc feature "..."
  --> Orchestrator delegates to Agent 01
    --> Agent 01 completes work, emits final response
      --> Claude Code auto-generates generic suggestions:
           "Continue working"
           "Show me the code"
           "What else needs to be done?"
```

### 2.2 Target State (After)

```
User runs /sdlc feature "..."
  --> Orchestrator delegates to Agent 01
    --> Agent 01 completes work, reads active_workflow from state.json
    --> Agent 01 determines next phase from phases[] array
    --> Agent 01 appends SUGGESTED NEXT STEPS block to final response:
           ---
           SUGGESTED NEXT STEPS:
             [1] Continue to Phase 02 - Impact Analysis
             [2] Review requirements documents
             [3] Show workflow status
           ---
      --> Claude Code displays agent output including prompt block
      --> User sees contextual, workflow-aware suggestions
```

### 2.3 Data Flow

```
                     +------------------+
                     |   state.json     |
                     | active_workflow: |
                     |   type, phases,  |
                     |   current_phase, |
                     |   phase_status   |
                     +--------+---------+
                              |
                     (read at phase completion)
                              |
                              v
+-------------------+    +--------------------+    +--------------------+
| Agent .md file    |--->| Agent Runtime      |--->| Agent Text Output  |
| SUGGESTED PROMPTS |    | Interpolates       |    | Final response     |
| section defines   |    | templates with     |    | includes formatted |
| prompt templates  |    | workflow state     |    | SUGGESTED NEXT     |
+-------------------+    +--------------------+    | STEPS block        |
                                                   +--------------------+
                                                            |
                                                            v
                                                   +--------------------+
                                                   | Claude Code UI     |
                                                   | Displays output    |
                                                   | to user            |
                                                   +--------------------+
```

No new data flows are introduced. Agents already read `active_workflow` from state.json for phase awareness. The only addition is formatting this information into a structured text block at the end of agent output.

---

## 3. Architecture Decision Records (ADRs)

### ADR-001: Template-In-Markdown Over Centralized Prompt Registry

**Context:** Prompts need to be defined somewhere and retrieved at agent execution time. Two approaches were considered: (a) a centralized prompt registry file (e.g., `prompts.json` or `prompts.yaml`) that maps agent+workflow+phase to prompt text, or (b) embedding prompt templates directly in each agent's markdown file.

**Decision:** Embed prompt templates directly in each agent's markdown file as a `# SUGGESTED PROMPTS` section.

**Rationale:**
1. **Simplicity (Article V):** No new file to maintain, no new parsing logic, no cross-file dependency.
2. **Colocation:** Prompt definitions live next to the agent behavior they describe. When agent behavior changes, prompts are right there to update (Article VIII).
3. **Fail-safe (Article X):** If the section is missing, the agent simply does not emit prompts. No error, no degraded behavior.
4. **No runtime code:** Claude Code already reads agent markdown files as instructions. The agent follows its instructions, including the prompt template. No new runtime infrastructure needed.
5. **Consistency with existing patterns:** Other agent sections (SKILL OBSERVABILITY, SELF-VALIDATION, CONSTITUTIONAL COMPLIANCE) follow the same embedded-in-markdown pattern.

**Rejected Alternative:** Centralized `prompts.json` registry would require a lookup mechanism, create a coupling point between agent execution and a separate config file, and add complexity without proportional benefit.

**Consequences:**
- Each of 36 agent files grows by ~20-40 lines (marginal: files range 197-2158 lines)
- Prompt format consistency depends on adherence to the template specification, not schema validation
- Format drift risk mitigated by code review (Phase 08) and format validation test

---

### ADR-002: Dynamic Phase Resolution Over Hardcoded Phase Names

**Context:** Prompts need to reference "the next phase" in the workflow. This could be hardcoded per agent (e.g., "Agent 01 always says 'Continue to Phase 02'") or dynamically resolved from the workflow state at runtime.

**Decision:** All phase references in prompts MUST be dynamically resolved from `active_workflow.phases[]` at runtime. No hardcoded phase numbers or names in prompt templates.

**Rationale:**
1. **Workflow polymorphism:** The same agent (e.g., Agent 05 - Software Developer) appears in feature, fix, test-generate, and full-lifecycle workflows. The "next phase" after Agent 05 differs depending on the workflow type.
2. **Risk R-003 mitigation:** The impact analysis identified hardcoded phase references as the highest-risk item (MEDIUM severity). Dynamic resolution eliminates this risk entirely.
3. **Future-proofing:** If workflow phase sequences change in `workflows.json`, prompts automatically adapt without agent file updates.

**Implementation:**
- Prompt templates use placeholder syntax: `{next_phase}` where next_phase = `active_workflow.phases[current_phase_index + 1]`
- If `current_phase_index + 1 >= phases.length`, the agent is at the last phase and emits "Complete workflow" instead
- Phase name lookup: agents derive human-readable names from the phase key (e.g., `03-architecture` -> `Phase 03 - Architecture`)

**Consequences:**
- Agents must read `active_workflow` from state.json to resolve prompts (they already do this for other purposes)
- Prompt templates contain placeholders, not literal text -- slightly harder to read in the markdown source
- Eliminates all workflow-specific prompt branching in individual agent files

---

### ADR-003: Three-Tier Prompt Categorization

**Context:** Agents need to emit multiple suggested actions. These need a structure so that the most important action is always first and utility actions are always available.

**Decision:** Prompts are organized into three tiers:

| Tier | Name | Purpose | Count |
|------|------|---------|-------|
| 1 | **Primary** | The most likely next action -- advance the workflow | 1 |
| 2 | **Alternative** | Other valid actions relevant to current phase | 1-2 |
| 3 | **Utility** | Always-available actions (status, cancel) | 1 |

**Rationale:**
1. **Cognitive load:** Users scan top-down. The primary action being first means the "happy path" is always [1].
2. **Consistency (AC-003-02):** Every prompt block follows the same structure, regardless of agent.
3. **Bounded:** Maximum 4 prompts per block (1 primary + 2 alternative + 1 utility). Keeps output concise.

**Consequences:**
- Users can always select [1] to advance the workflow without reading other options
- Utility prompts (e.g., "Show workflow status") provide escape hatches
- Alternative prompts provide context-specific options (e.g., "Review architecture documents" after architecture phase)

---

### ADR-004: Distinct Prompt Format With --- Delimiters

**Context:** The prompt block must be visually distinct from existing output formats in the framework. The orchestrator already uses three banner styles:
- `====` for phase transitions and gate announcements
- `+---|` for agent delegation announcements
- `|` box for skill invocation announcements

**Decision:** Use `---` (horizontal rule) delimiters with a `SUGGESTED NEXT STEPS:` header and `[N]` numbered items.

**Format:**
```
---
SUGGESTED NEXT STEPS:
  [1] Primary action description
  [2] Alternative action description
  [3] Utility action description
---
```

**Rationale:**
1. **Visual distinction:** `---` is visually different from `====`, `+---|`, and `|` box formats already used
2. **Markdown valid:** `---` is valid markdown (horizontal rule) and renders cleanly in any markdown viewer
3. **ASCII-only (NFR-005):** No Unicode characters -- works on all terminals including Windows cmd.exe
4. **Human-readable:** Numbered items with `[N]` prefix are scannable
5. **Machine-parseable (REQ-005):** Structured format could be parsed by hooks or tools in the future if needed, without requiring it now (YAGNI)

**Rejected Alternatives:**
- Markdown fenced code block: Would look like code, not navigation prompts
- Bullet list: Less scannable than numbered items when selecting an action
- Unicode box drawing: Fails NFR-005 (cross-platform ASCII requirement)

**Consequences:**
- Prompt blocks are visually distinct from all other framework output
- Can be searched for via `SUGGESTED NEXT STEPS:` string
- The `---` delimiter on its own line acts as a horizontal rule in rendered markdown

---

### ADR-005: Sub-Agent Minimal Status Prompts Over Full Navigation Prompts

**Context:** Sub-agents (discover/*, impact-analysis/*, tracing/*) operate within a parent orchestrator's delegation context. They report results back to their orchestrator, not directly to the user. Should they emit full navigation prompts?

**Decision:** Sub-agents emit a single-line status message, not a multi-option prompt block. Format:

```
---
STATUS: Analysis complete. Returning results to {parent_orchestrator}.
---
```

**Rationale:**
1. **REQ-004:** Sub-agents should NOT emit user-navigation prompts. They report to their orchestrator.
2. **No user confusion:** If a sub-agent emitted "Continue to Phase 03", the user might try to act on it, but the sub-agent context is controlled by its parent orchestrator.
3. **Simplicity:** Sub-agents are ephemeral workers. Their output is consumed by the parent orchestrator, not by the user.
4. **Scope containment:** Only the parent orchestrator and the SDLC orchestrator should suggest workflow navigation.

**Consequences:**
- 17 sub-agent files get a very minimal SUGGESTED PROMPTS section (~5 lines each)
- Parent orchestrators (impact-analysis-orchestrator, tracing-orchestrator, discover-orchestrator) get full prompt blocks since they DO interact with the user
- Clear separation: sub-agents report status, orchestrators suggest actions

---

### ADR-006: Orchestrator Emits Prompts at Five Lifecycle Points

**Context:** The SDLC orchestrator (Agent 00) manages the overall workflow lifecycle and needs to emit prompts at critical moments, not just at phase boundaries.

**Decision:** The orchestrator emits prompt blocks at exactly five lifecycle points:

| Point | Trigger | Prompt Content |
|-------|---------|----------------|
| 1. Workflow initialization | After `active_workflow` written to state.json | "Describe your feature/bug to begin Phase 01" |
| 2. Gate passage | After GATE-NN PASSED and before next phase delegation | "Continuing to Phase {next}" + review/status options |
| 3. Gate failure | After GATE-NN FAILED | "Review gate failure details" + "Retry gate check" |
| 4. Blocker/escalation | When escalating to human | "Resolve blocker: {description}" + "Cancel workflow" |
| 5. Workflow completion | After merge and completion summary | "Start new feature" + "Run tests" + "View status" |

**Rationale:**
1. **REQ-004 compliance:** All five emission points from the requirements are covered.
2. **No redundancy:** The orchestrator does NOT re-emit prompts that the phase agent already emitted. Phase agents handle their own completion prompts. The orchestrator handles transitions and lifecycle events.
3. **Separation of concerns:** Phase agents prompt about phase-specific work. The orchestrator prompts about workflow-level navigation.

**Consequences:**
- The orchestrator's prompt emission is triggered by state changes (gate pass, gate fail, workflow start/end), not by phase-specific work
- Phase agents and orchestrator can both emit prompts without conflict because they emit at different moments
- The 5-point model is complete: every workflow state transition has an associated prompt

---

### ADR-007: Phase Name Resolution Convention

**Context:** When generating dynamic prompts, agents need to convert phase keys (e.g., `03-architecture`, `02-impact-analysis`) into human-readable names for display.

**Decision:** Use a deterministic naming convention based on the phase key format:

| Phase Key Pattern | Display Name |
|-------------------|-------------|
| `NN-name` (e.g., `01-requirements`) | `Phase NN - {Title Case Name}` |
| `NN-compound-name` (e.g., `02-impact-analysis`) | `Phase NN - {Title Case Compound Name}` |
| `00-quick-scan` | `Phase 00 - Quick Scan` |
| `11-local-testing` | `Phase 11 - Local Testing` |
| `16-upgrade-plan` | `Phase 16 - Upgrade Plan` |

**Algorithm:**
1. Split on first `-` to get phase number and name parts
2. Phase number = first segment (zero-padded, 2 digits)
3. Phase name = remaining segments, joined with spaces, title-cased
4. Result = `Phase {number} - {name}`

**Rationale:**
1. **No lookup table needed:** The name is derived from the key itself, avoiding a separate mapping file.
2. **Consistent:** All phase keys in `workflows.json` follow the `NN-kebab-name` pattern, making the algorithm deterministic.
3. **Article V (Simplicity):** A simple string transformation vs. maintaining a parallel name mapping.

**Consequences:**
- Display names are automatically correct for any phase key, including future phases
- Names like `02-impact-analysis` become `Phase 02 - Impact Analysis` (clean)
- Edge case: `R1-behavior-extraction` would become `Phase R1 - Behavior Extraction` (acceptable for reverse-engineer workflow)

---

## 4. Component Architecture

### 4.1 Component Inventory (Changed Components Only)

This feature modifies **zero runtime components** (no hooks, no lib code, no configs). All changes are to **agent instruction markdown files**.

| Component | Type | Change | Files |
|-----------|------|--------|-------|
| Phase Agent Instructions | Markdown | Append `# SUGGESTED PROMPTS` section | 15 files |
| Sub-Orchestrator Instructions | Markdown | Append `# SUGGESTED PROMPTS` section | 3 files |
| SDLC Orchestrator Instructions | Markdown | Add `# PROMPT EMISSION PROTOCOL` + 5 emission points | 1 file |
| Sub-Agent Instructions | Markdown | Append minimal `# SUGGESTED PROMPTS` section | 17 files |
| **Total** | | | **36 files** |

### 4.2 Component Interaction Diagram

```
+----------------------------------------------------------------------+
|                        SDLC Orchestrator                              |
|  (emits prompts at workflow init, gate-pass, gate-fail,              |
|   blocker, workflow-complete)                                         |
|                                                                       |
|  Reads: active_workflow from state.json                               |
|  Emits: SUGGESTED NEXT STEPS block in its text output                |
+--------+---------------------------+---------------------------------+
         |                           |
    (delegates to)             (delegates to)
         |                           |
         v                           v
+------------------+    +---------------------------+
| Phase Agent      |    | Sub-Orchestrator          |
| (01-14, QS)      |    | (IA-Orch, T-Orch, D-Orch)|
|                  |    |                           |
| Reads:           |    | Reads: workflow context    |
|  active_workflow |    | Emits: full prompt block   |
|  from state.json |    |  (user-facing)             |
|                  |    +-------------+-------------+
| Emits: full      |                  |
|  prompt block    |             (delegates to)
|  (user-facing)   |                  |
+------------------+                  v
                       +---------------------------+
                       | Sub-Agent                  |
                       | (discover/*, IA/*, T/*)    |
                       |                           |
                       | Emits: minimal status      |
                       |  "Analysis complete.       |
                       |   Returning to {parent}."  |
                       +---------------------------+
```

### 4.3 Agent Classification for Prompt Behavior

| Classification | Agents | Prompt Behavior |
|----------------|--------|-----------------|
| **SDLC Orchestrator** | 00-sdlc-orchestrator | Emits at 5 lifecycle points. Dynamic prompts based on workflow state and lifecycle event type. |
| **Phase Agents** | 01, 02-arch, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, QS | Emit full 3-tier prompt block at phase completion. Primary prompt = next phase in workflow. |
| **Sub-Orchestrators** | IA-orchestrator, T-orchestrator, D-orchestrator | Emit full 3-tier prompt block at sub-workflow completion. Primary prompt = return control to SDLC orchestrator. |
| **Sub-Agents** | discover/*, impact-analysis/*, tracing/* | Emit single-line STATUS only. No navigation prompts. |

---

## 5. Prompt Template Specification

### 5.1 Phase Agent Template

Every phase agent's `# SUGGESTED PROMPTS` section follows this template:

```markdown
# SUGGESTED PROMPTS

At the end of your phase work, emit a suggested next steps block. Read `active_workflow`
from `.isdlc/state.json` to determine the next phase dynamically.

## Resolution Logic

1. Read `active_workflow.phases` array and `active_workflow.current_phase_index`
2. Let next_index = current_phase_index + 1
3. If next_index < phases.length:
   - next_phase_key = phases[next_index]
   - next_phase_name = derive display name from key (see ADR-007)
   - primary_prompt = "Continue to {next_phase_name}"
4. If next_index >= phases.length:
   - primary_prompt = "Complete workflow and merge to main"
5. Always include one phase-specific alternative and one utility prompt

## Output Format

```
---
SUGGESTED NEXT STEPS:
  [1] {primary_prompt}
  [2] {phase_specific_alternative}
  [3] Show workflow status
---
```

## Phase-Specific Alternatives

{Table of phase-specific alternative prompts -- defined per agent}
```

### 5.2 Sub-Agent Template

```markdown
# SUGGESTED PROMPTS

At the end of your work, emit a minimal status line.

## Output Format

```
---
STATUS: {task_description} complete. Returning results to {parent_orchestrator_name}.
---
```

Do NOT emit workflow navigation prompts. You report to your parent orchestrator.
```

### 5.3 Orchestrator Emission Points

The SDLC orchestrator adds a `# PROMPT EMISSION PROTOCOL` section that defines prompt blocks for each of the 5 lifecycle points. Each point has its own template.

---

## 6. Prompt Content Catalog

### 6.1 Phase Agent Prompts (Phase-Specific Alternatives)

| Phase | Agent | Alternative Prompt |
|-------|-------|--------------------|
| 00-quick-scan | Quick Scan Agent | Review scope estimate before requirements |
| 01-requirements | Requirements Analyst | Review requirements documents |
| 02-impact-analysis | Impact Analysis Orch. | Review impact analysis report |
| 02-tracing | Tracing Orchestrator | Review trace analysis report |
| 03-architecture | Solution Architect | Review architecture and ADRs |
| 04-design | System Designer | Review interface specifications |
| 05-test-strategy | Test Design Engineer | Review test strategy and test cases |
| 06-implementation | Software Developer | Review implementation and test results |
| 07-testing | Integration Tester | Review integration test report |
| 08-code-review | QA Engineer | Review code review report |
| 09-validation | Security Auditor | Review security scan results |
| 10-cicd | CI/CD Engineer | Review pipeline configuration |
| 11-local-testing | Environment Builder | Review build and health check results |
| 12-remote-build | Environment Builder | Review remote deployment status |
| 13-test-deploy | Deployment Engineer | Review staging deployment logs |
| 14-production | Release Manager | Review release notes |
| 15-operations | Site Reliability Engineer | Review monitoring configuration |
| 16-upgrade-plan | Upgrade Engineer | Review upgrade analysis and plan |
| 16-upgrade-execute | Upgrade Engineer | Review upgrade execution log |

### 6.2 Orchestrator Lifecycle Prompts

| Lifecycle Point | Prompt [1] | Prompt [2] | Prompt [3] |
|-----------------|------------|------------|------------|
| Workflow init | Describe your {feature/bug} to begin | Show workflow phases | Show workflow status |
| Gate pass | Continue to {next_phase_name} | Review {current_phase} artifacts | Show workflow status |
| Gate fail | Review gate failure: {failure_reason} | Retry gate check | Escalate to human |
| Blocker | Resolve: {blocker_description} | Cancel workflow | Show workflow status |
| Workflow complete | Start a new feature | Run tests | View project status |

### 6.3 Workflow Cancellation Prompts

| Prompt [1] | Prompt [2] |
|------------|------------|
| Start a new feature | View project status |

---

## 7. Edge Cases and Error Handling

### 7.1 Edge Case: No Active Workflow

If `active_workflow` is null or missing from state.json when an agent tries to resolve prompts:
- **Behavior:** Agent emits a generic fallback prompt block without phase references
- **Fallback prompts:** "Show project status", "Start a new workflow"
- **Rationale:** Article X (Fail-Safe Defaults) -- agent must not fail or produce broken output

### 7.2 Edge Case: Agent at Last Phase

If `current_phase_index + 1 >= phases.length`:
- **Primary prompt:** "Complete workflow and merge to main"
- **Alternative prompt:** "Review all workflow artifacts"
- **Rationale:** No next phase exists. The completion action is the primary prompt.

### 7.3 Edge Case: Agent Not in Active Workflow

If the agent's phase is not found in `active_workflow.phases`:
- **Behavior:** Agent emits a generic prompt block without dynamic resolution
- **Rationale:** This can happen during ad-hoc agent invocations outside a formal workflow. Fail-safe behavior applies.

### 7.4 Edge Case: Sub-Agent Invoked Directly by User

Sub-agents should not normally be invoked directly, but if they are:
- **Behavior:** Emit the standard STATUS line ("Analysis complete.")
- **Rationale:** Sub-agents always behave the same regardless of invocation path.

### 7.5 Edge Case: Interactive Pause Points (A/R/C Menus)

For agents with interactive menus (primarily Agent 01 - Requirements Analyst):
- **Do NOT emit SUGGESTED NEXT STEPS at pause points.** The A/R/C menu IS the suggested action.
- **Emit SUGGESTED NEXT STEPS only at final phase completion** (after all artifacts saved).
- **Rationale:** Overlapping navigation prompts with interactive menus would be confusing.

---

## 8. Compatibility Analysis

### 8.1 Workflow Compatibility Matrix

| Workflow | Phases | Prompt Behavior |
|----------|--------|-----------------|
| feature | 00, 01, 02-IA, 03, 04, 05, 06, 11, 07, 10, 08 | Each phase agent emits prompts referencing the next phase in this sequence |
| fix | 01, 02-T, 05, 06, 11, 07, 10, 08 | Phase 01 prompts reference Phase 02-Tracing (not Phase 02-IA) |
| test-run | 11, 07 | Phase 11 prompts reference Phase 07 |
| test-generate | 05, 06, 11, 07, 08 | Phase 05 prompts reference Phase 06 |
| full-lifecycle | 01, 03, 04, 05, 06, 11, 07, 08, 09, 10, 12, 13, 14, 15 | Full sequence |
| upgrade | 16-plan, 16-execute, 08 | Phase 16-plan prompts reference Phase 16-execute |

All workflow compatibility is ensured by ADR-002 (dynamic phase resolution). The same prompt template in Agent 05's file works correctly in feature, fix, test-generate, and full-lifecycle workflows because it reads the next phase from `active_workflow.phases[]`, not from a hardcoded value.

### 8.2 Backward Compatibility

| Scenario | Before | After | Compatible? |
|----------|--------|-------|-------------|
| Agent without SUGGESTED PROMPTS section | No prompts emitted | No prompts emitted | YES (CON-003) |
| No active workflow in state.json | Agent works normally | Agent emits fallback prompts or none | YES |
| Old state.json format | N/A | No new fields required | YES (NFR-006) |
| Existing test suite | All pass | All pass (no runtime changes) | YES (NFR-001) |

---

## 9. Security Considerations

### 9.1 No Security Impact

This feature has no security implications:

| Security Area | Assessment |
|---------------|------------|
| Input validation | No new inputs. Agents read existing `active_workflow` from state.json. |
| Output sanitization | Prompts are static text templates with dynamic phase names. No user input is echoed in prompts. |
| Secrets exposure | No secrets involved. Prompts contain phase names, not sensitive data. |
| Dependency risk | No new dependencies (NFR-003). |
| State integrity | No new state.json fields (NFR-006). |
| Hook behavior | No hook changes (CON-002). |

### 9.2 Article III Compliance

Article III (Security by Design) is satisfied: no new attack surface is introduced. The feature is purely additive markdown text in agent instruction files.

---

## 10. Testing Strategy Implications

### 10.1 Testable Properties

Since this feature modifies only markdown files (not runtime code), testing focuses on:

1. **Format consistency test:** Scan all agent `.md` files for `# SUGGESTED PROMPTS` section. Verify each section contains the `---` / `SUGGESTED NEXT STEPS:` / `[N]` format.
2. **Coverage test:** Verify all 36 agent files have a SUGGESTED PROMPTS section.
3. **Sub-agent format test:** Verify sub-agent files use `STATUS:` format, not full prompt blocks.
4. **No regression test:** `npm run test:all` passes before and after implementation (NFR-001).

### 10.2 Non-Testable Properties (By Design)

- **Dynamic resolution correctness:** Cannot be unit-tested because agents are LLM-driven markdown instructions, not executable code. Correctness depends on the agent following its instructions, which is validated by integration testing during workflow execution.
- **Prompt relevance:** Subjective quality -- validated during code review (Phase 08).

---

## 11. Implementation Guidance

### 11.1 Implementation Order

Per impact analysis recommendation and ADR-001 colocation principle:

1. **SDLC Orchestrator (00):** Define `# PROMPT EMISSION PROTOCOL` section first. This establishes the canonical format, resolution logic, and emission rules that all other agents reference.
2. **Phase Agents (01-14, QS):** Add `# SUGGESTED PROMPTS` section to each. Use the template from Section 5.1. Customize the phase-specific alternative prompt per the catalog in Section 6.1.
3. **Sub-Orchestrators (IA, T, D):** Add `# SUGGESTED PROMPTS` section with full prompt block (they are user-facing).
4. **Sub-Agents (discover/*, IA/*, T/*):** Add minimal `# SUGGESTED PROMPTS` section with STATUS format per Section 5.2.
5. **Documentation:** Update CLAUDE.md with completion note.

### 11.2 Insertion Point Convention

For each agent file, the `# SUGGESTED PROMPTS` section is inserted:
- **After** the `# SELF-VALIDATION` section (or the last major section)
- **Before** the final closing paragraph (e.g., "You are the foundation of the SDLC..." or "You bring designs to life...")

This positions the prompt instructions as the last operational section, with the agent's motivational closing line remaining at the very end of the file.

### 11.3 Estimated Line Impact

| Category | Files | Lines Added Per File | Total Lines |
|----------|-------|---------------------|-------------|
| Orchestrator (prompt emission protocol) | 1 | ~80-100 | ~90 |
| Phase agents (full prompt section) | 15 | ~25-35 | ~450 |
| Sub-orchestrators (full prompt section) | 3 | ~25-35 | ~90 |
| Sub-agents (minimal prompt section) | 17 | ~8-12 | ~170 |
| **Total** | **36** | | **~800** |

---

## 12. Traceability Matrix (Architecture -> Requirements)

| ADR | Traced Requirements | Traced NFRs | Traced Risks |
|-----|---------------------|-------------|--------------|
| ADR-001 (Template-in-Markdown) | REQ-003, REQ-006 | NFR-002, NFR-003, NFR-007 | R-002 |
| ADR-002 (Dynamic Phase Resolution) | REQ-002, REQ-006, REQ-007 | NFR-001 | R-003 |
| ADR-003 (Three-Tier Categorization) | REQ-001, REQ-003, REQ-005 | NFR-005 | R-002 |
| ADR-004 (Distinct --- Format) | REQ-005 | NFR-005 | R-005 |
| ADR-005 (Sub-Agent Minimal Prompts) | REQ-004 | NFR-002 | R-004 |
| ADR-006 (Orchestrator 5 Points) | REQ-004 | - | - |
| ADR-007 (Phase Name Convention) | REQ-002, REQ-006 | NFR-007 | R-003 |

All 7 functional requirements (REQ-001 through REQ-007) are covered by at least one ADR.
All 7 NFRs are either addressed by ADRs or are inherently satisfied (no runtime changes = no regression risk).
All 5 risks from the impact analysis are mitigated by specific ADRs.

---

## 13. Constitutional Compliance

| Article | Status | Evidence |
|---------|--------|----------|
| I (Specification Primacy) | COMPLIANT | Architecture implements REQ-001 through REQ-007 exactly as specified |
| III (Security by Design) | COMPLIANT | No new attack surface (Section 9) |
| IV (Explicit Over Implicit) | COMPLIANT | All decisions documented in ADRs with rationale |
| V (Simplicity First) | COMPLIANT | Text templates in markdown -- no runtime engine, no config registry (ADR-001) |
| VII (Artifact Traceability) | COMPLIANT | Full traceability matrix (Section 12) |
| VIII (Documentation Currency) | COMPLIANT | Prompt definitions are self-documenting inside agent files (ADR-001) |
| IX (Gate Integrity) | COMPLIANT | No gate changes; prompts emit after gate validation |
| X (Fail-Safe Defaults) | COMPLIANT | Missing section = no prompts = no error (ADR-001, Section 7) |
| XII (Cross-Platform) | COMPLIANT | ASCII-only format (ADR-004, NFR-005) |
| XIII (Module System) | COMPLIANT | No code changes -- only markdown files modified |
| XIV (State Management) | COMPLIANT | No state schema changes (NFR-006) |
