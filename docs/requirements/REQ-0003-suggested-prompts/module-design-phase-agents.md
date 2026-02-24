# Module Design: Phase Agent Prompt Sections

**Artifact ID:** REQ-0003-suggested-prompts
**Phase:** 04 - Design
**Components:** 15 Phase Agent Markdown Files + Quick Scan Agent
**Created:** 2026-02-08
**Status:** Final

---

## 1. Overview

Each phase agent receives a `# SUGGESTED PROMPTS` section appended to its markdown file. This section instructs the agent to emit a structured prompt block at the end of its phase work. All 15 phase agents and the quick scan agent use the same structural template, with only the phase-specific alternative prompt varying per agent.

---

## 2. Universal Phase Agent Template

Every phase agent's `# SUGGESTED PROMPTS` section follows this exact template:

```markdown
# SUGGESTED PROMPTS

At the end of your phase work (after all artifacts are saved and self-validation is complete),
emit a suggested next steps block.

## Resolution Logic

1. Read `active_workflow` from `.isdlc/state.json`
2. If `active_workflow` is null or missing: emit fallback prompts (see Fallback below)
3. Read `active_workflow.phases[]` and `active_workflow.current_phase_index`
4. Let next_index = current_phase_index + 1
5. If next_index < phases.length:
   - next_phase_key = phases[next_index]
   - Resolve display name: split key on first hyphen, title-case the remainder
   - Example: "03-architecture" -> "Phase 03 - Architecture"
   - primary_prompt = "Continue to {display_name}"
6. If next_index >= phases.length:
   - primary_prompt = "Complete workflow and merge to main"

## Output Format

```
---
SUGGESTED NEXT STEPS:
  [1] {primary_prompt}
  [2] {phase_specific_alternative}
  [3] Show workflow status
---
```

## Fallback (No Active Workflow)

If `active_workflow` is null or cannot be read:

```
---
SUGGESTED NEXT STEPS:
  [1] Show project status
  [2] Start a new workflow
---
```

## Phase-Specific Alternative

[2] {alternative_prompt_text}
```

---

## 3. Per-Agent Customization

The only variation between agents is the `{phase_specific_alternative}` prompt at position `[2]`. Each agent's alternative prompt directs the user to review the artifacts that agent just produced.

### 3.1 Phase Agent Alternative Prompts

| Agent File | Phase Key | Alternative Prompt `[2]` |
|------------|-----------|--------------------------|
| `00-sdlc-orchestrator.md` | (orchestrator) | (Uses emission protocol -- see module-design-orchestrator-prompts.md) |
| `quick-scan/quick-scan-agent.md` | `00-quick-scan` | Review scope estimate |
| `01-requirements-analyst.md` | `01-requirements` | Review requirements documents |
| `02-solution-architect.md` | `03-architecture` | Review architecture and ADRs |
| `03-system-designer.md` | `04-design` | Review design specifications |
| `04-test-design-engineer.md` | `05-test-strategy` | Review test strategy and test cases |
| `05-software-developer.md` | `06-implementation` | Review implementation and test results |
| `06-integration-tester.md` | `07-testing` | Review integration test report |
| `07-qa-engineer.md` | `08-code-review` | Review code review report |
| `08-security-compliance-auditor.md` | `09-validation` | Review security scan results |
| `09-cicd-engineer.md` | `10-cicd` | Review pipeline configuration |
| `10-dev-environment-engineer.md` | `11-local-testing` | Review build and health check results |
| `11-deployment-engineer-staging.md` | `13-test-deploy` | Review staging deployment logs |
| `12-release-manager.md` | `14-production` | Review release notes |
| `13-site-reliability-engineer.md` | `15-operations` | Review monitoring configuration |
| `14-upgrade-engineer.md` | `16-upgrade-plan` / `16-upgrade-execute` | Review upgrade analysis |

### 3.2 Special Case: Upgrade Engineer (Agent 14)

Agent 14 is invoked twice in the upgrade workflow: once for `16-upgrade-plan` and once for `16-upgrade-execute`. The alternative prompt changes based on scope:

- **Scope: analysis** (upgrade-plan): `[2] Review upgrade analysis and migration plan`
- **Scope: execution** (upgrade-execute): `[2] Review upgrade execution log`

The agent determines its scope from the `agent_modifiers` passed in delegation or from the phase key in `active_workflow.current_phase`.

### 3.3 Special Case: Environment Builder (Agent 10)

Agent 10 is also invoked twice in full-lifecycle: once for `11-local-testing` and once for `12-remote-build`. The alternative prompt changes based on scope:

- **Scope: local**: `[2] Review build and health check results`
- **Scope: remote**: `[2] Review remote deployment status`

---

## 4. Insertion Point Per Agent

Each agent file has the section inserted after `# SELF-VALIDATION` and before the closing motivational line.

### 4.1 Insertion Map

| Agent File | Insert After (Line Content) | Insert Before (Line Content) |
|------------|----------------------------|------------------------------|
| `quick-scan-agent.md` | `# SELF-VALIDATION` section (lines 311-317) | "You provide just enough context..." (line 318) |
| `01-requirements-analyst.md` | `# REMEMBER` section block (lines 1723-1727) | "You are the foundation of the SDLC..." (line 1729) |
| `02-solution-architect.md` | `# SELF-VALIDATION` checklist (lines 654-665) | "You are the technical foundation..." (line 667) |
| `03-system-designer.md` | `# SELF-VALIDATION` checklist (lines 333-340) | "You translate architecture into..." (line 342) |
| `04-test-design-engineer.md` | `# SELF-VALIDATION` checklist (lines 560-567) | "You ensure quality is designed in..." (line 569) |
| `05-software-developer.md` | `# SELF-VALIDATION` checklist (lines 652-659) | "You bring designs to life..." (line 661) |
| `06-integration-tester.md` | Output artifact tree (lines 770-784) | "You validate that the system works..." (line 786) |
| `07-qa-engineer.md` | `# SELF-VALIDATION` checklist (lines 197-204) | "You are the quality gatekeeper..." (line 206) |
| `08-security-compliance-auditor.md` | `# SELF-VALIDATION` checklist (lines 226-233) | "You are the last line of defense..." (line 235) |
| `09-cicd-engineer.md` | `# SELF-VALIDATION` checklist (lines 205-212) | "You enable continuous delivery..." (line 214) |
| `10-dev-environment-engineer.md` | `# SELF-VALIDATION` checklist (lines 294-300) | "You build and launch reliable environments..." (line 302) |
| `11-deployment-engineer-staging.md` | `# SELF-VALIDATION` checklist (lines 188-195) | "You validate deployment procedures..." (line 197) |
| `12-release-manager.md` | `# SELF-VALIDATION` checklist (lines 214-221) | "You orchestrate production releases..." (line 223) |
| `13-site-reliability-engineer.md` | `# SELF-VALIDATION` checklist (lines 302-308) | "You are the guardian of production..." (line 311) |
| `14-upgrade-engineer.md` | `# SELF-VALIDATION` checklist (lines 631-644) | (end of file -- no closing line) |

### 4.2 Insertion Convention

For all agents **except** 14-upgrade-engineer:
```
...self-validation content...

# SUGGESTED PROMPTS

...prompt section content (~25-35 lines)...

{closing motivational line}
```

For 14-upgrade-engineer (no closing line):
```
...self-validation content...

# SUGGESTED PROMPTS

...prompt section content (~25-35 lines)...
```

---

## 5. Requirements Analyst Special Behavior (Agent 01)

### 5.1 Interactive Pause Points

Agent 01 has an interactive A/R/C menu flow. Per architecture edge case 7.5:

- **DO NOT** emit SUGGESTED NEXT STEPS during interactive pause points (A/R/C menus)
- **DO** emit SUGGESTED NEXT STEPS only at final phase completion (after `[S] Save` and all artifacts written)

### 5.2 Agent 01 Section Addition

The Agent 01 prompt section includes an extra instruction:

```markdown
## Important: Interactive Phases

Do NOT emit SUGGESTED NEXT STEPS during interactive menu pauses (A/R/C steps).
The interactive menu IS the suggested action during those steps.
Emit SUGGESTED NEXT STEPS only once, at the very end of the phase, after all artifacts
are saved and the gate summary is provided.
```

---

## 6. Example: Complete Section for Agent 05 (Software Developer)

```markdown
# SUGGESTED PROMPTS

At the end of your phase work (after all artifacts are saved and self-validation is complete),
emit a suggested next steps block.

## Resolution Logic

1. Read `active_workflow` from `.isdlc/state.json`
2. If `active_workflow` is null or missing: emit fallback prompts (see Fallback below)
3. Read `active_workflow.phases[]` and `active_workflow.current_phase_index`
4. Let next_index = current_phase_index + 1
5. If next_index < phases.length:
   - next_phase_key = phases[next_index]
   - Resolve display name: split key on first hyphen, title-case the remainder
   - Example: "03-architecture" -> "Phase 03 - Architecture"
   - primary_prompt = "Continue to {display_name}"
6. If next_index >= phases.length:
   - primary_prompt = "Complete workflow and merge to main"

## Output Format

Emit this block as the last thing in your response:

---
SUGGESTED NEXT STEPS:
  [1] {primary_prompt}
  [2] Review implementation and test results
  [3] Show workflow status
---

## Fallback (No Active Workflow)

If `active_workflow` is null or cannot be read:

---
SUGGESTED NEXT STEPS:
  [1] Show project status
  [2] Start a new workflow
---
```

---

## 7. Estimated Line Impact

| Agent | Current Lines | Added Lines | New Total |
|-------|---------------|-------------|-----------|
| quick-scan-agent.md | 318 | ~28 | ~346 |
| 01-requirements-analyst.md | 1729 | ~35 | ~1764 |
| 02-solution-architect.md | 667 | ~28 | ~695 |
| 03-system-designer.md | 342 | ~28 | ~370 |
| 04-test-design-engineer.md | 569 | ~28 | ~597 |
| 05-software-developer.md | 661 | ~28 | ~689 |
| 06-integration-tester.md | 786 | ~28 | ~814 |
| 07-qa-engineer.md | 206 | ~28 | ~234 |
| 08-security-compliance-auditor.md | 235 | ~28 | ~263 |
| 09-cicd-engineer.md | 214 | ~28 | ~242 |
| 10-dev-environment-engineer.md | 302 | ~28 | ~330 |
| 11-deployment-engineer-staging.md | 197 | ~28 | ~225 |
| 12-release-manager.md | 223 | ~28 | ~251 |
| 13-site-reliability-engineer.md | 311 | ~28 | ~339 |
| 14-upgrade-engineer.md | 644 | ~32 | ~676 |
| **Total** | | **~451** | |

---

## 8. Traceability

| Design Element | Requirements | ADRs | AC |
|----------------|-------------|------|-----|
| Universal template | REQ-001, REQ-003, REQ-005 | ADR-001, ADR-003, ADR-004 | AC-001-01, AC-003-01 |
| Dynamic resolution logic | REQ-002, REQ-006 | ADR-002, ADR-007 | AC-001-02, AC-001-03, AC-002-01 |
| Per-agent alternative prompts | REQ-003 | ADR-001 | AC-005-01 |
| Agent 01 interactive exception | REQ-007 | - | AC-005-02 |
| Fallback behavior | - | ADR-001 (fail-safe) | AC-005-03 |
| Last-phase detection | REQ-002 | ADR-002 | AC-002-03 |
| Insertion point convention | REQ-003 | ADR-001 | AC-005-01 |
