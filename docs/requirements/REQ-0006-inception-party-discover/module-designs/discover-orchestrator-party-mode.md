# Module Design — Discover Orchestrator: Party Mode Section

**Component**: discover-orchestrator.md (MODIFIED)
**Location**: `src/claude/agents/discover-orchestrator.md`
**Change Type**: Addition (~400-500 lines inserted)
**Traces to**: REQ-001 through REQ-012, ADR-001 through ADR-008

---

## 1. Insertion Point

The PARTY MODE FLOW section is inserted into the discover-orchestrator.md file at the following location:

```
...existing content...

## NEW PROJECT FLOW (is_new_project: true)        <-- existing section header

### Step 0: Mode Selection (NEW)                  <-- INSERT HERE

### Step 1: Display Welcome and Present Plan      <-- existing (now under "classic mode" branch)
...
### Step 10: Display Completion                   <-- existing

## PARTY MODE FLOW (NEW)                          <-- NEW SECTION

...existing content (EXISTING PROJECT FLOW)...
```

**Structural approach**: The NEW PROJECT FLOW section gets a new Step 0 (Mode Selection) that branches to either the existing Steps 1-10 (classic mode) or the new PARTY MODE FLOW section.

---

## 2. Step 0: Mode Selection

```markdown
### Step 0: Mode Selection

Before proceeding with the new project setup, determine the execution mode.

**Resolution order:**
1. If `--party` flag present → set mode = "party"
2. If `--classic` flag present → set mode = "classic"
3. If neither flag → present Mode Selection Menu

**Mode Selection Menu:**

Use AskUserQuestion to present:

+==============================================================+
|  INCEPTION MODE                                              |
+==============================================================+

How would you like to set up your new project?

[1] Party Mode (Recommended)
    Launch an Inception Party — 3 specialist agents collaborate
    in parallel at each stage for richer, multi-perspective output

[2] Classic Mode
    Sequential single-agent flow (8 phases, one at a time)

Enter selection (1-2):

**After resolution:**
- If mode == "classic": proceed to Step 1 (existing flow, no changes)
- If mode == "party": jump to PARTY MODE FLOW section
```

---

## 3. PARTY MODE FLOW Section

### 3.1 Section Header

```markdown
## PARTY MODE FLOW

For new projects using party mode, launch an Inception Party with multi-agent
collaboration. This flow replaces Steps 1-10 with 5 parallel/sequential phases
that produce the same output artifacts as classic mode.

PREREQUISITES:
- Mode resolved to "party" from Step 0
- state.json accessible with project.is_new_project == true
- No active SDLC workflow (active_workflow is null)
```

### 3.2 Party Phase 1: Vision Council

```markdown
### Party Phase 1: Vision Council

**Goal**: Gather multi-perspective understanding of the project from 3 specialists.
**Interaction**: question-broadcast-debate
**AC**: AC-4, AC-5, AC-6, AC-7

#### 1.1 Create Team and Progress Tasks

1. TeamCreate: "inception-party"
2. TaskCreate for each of the 5 party phases (T1-T5)
3. TaskUpdate: T1 → in_progress

#### 1.2 Read Persona Config

Read `src/claude/agents/discover/party-personas.json`.
Extract Phase 1 persona details for nadia, oscar, tessa.

#### 1.3 Spawn Phase 1 Agents

Launch 3 agents IN PARALLEL as team members:

Agent 1 (Nadia): Use Task tool with:
  - subagent_type: "product-analyst"
  - team_name: "inception-party"
  - name: "nadia"
  - prompt: PERSONA_CONTEXT block (from personas.json) + phase 1 instructions:
    "You are participating in a Vision Council with Oscar (Domain Researcher)
     and Tessa (Technical Scout). Ask 2-3 questions from your expertise angle
     (user needs, market fit, MVP scope). Send your questions to the team lead.
     Wait for the user's response broadcast. Then interpret and debate with
     your teammates. Max 10 messages total for the phase."

Agent 2 (Oscar): Use Task tool with:
  - subagent_type: "domain-researcher"
  - team_name: "inception-party"
  - name: "oscar"
  - prompt: PERSONA_CONTEXT block + phase 1 instructions:
    "You are participating in a Vision Council with Nadia (Product Analyst)
     and Tessa (Technical Scout). Ask 2-3 questions from your expertise angle
     (compliance, regulations, industry context, competitors). Send your
     questions to the team lead. Wait for the user's response broadcast.
     Then interpret and debate with your teammates."

Agent 3 (Tessa): Use Task tool with:
  - subagent_type: "technical-scout"
  - team_name: "inception-party"
  - name: "tessa"
  - prompt: PERSONA_CONTEXT block + phase 1 instructions:
    "You are participating in a Vision Council with Nadia (Product Analyst)
     and Oscar (Domain Researcher). Ask 2-3 questions from your expertise
     angle (scale, tech preferences, ecosystem, DX). Send your questions to
     the team lead. Wait for the user's response broadcast. Then interpret
     and debate with your teammates."

#### 1.4 Collect Questions

Wait for all 3 agents to send their questions via SendMessage.
Merge, deduplicate, and group by theme.

Present to user using AskUserQuestion with the merged question set.

#### 1.5 Broadcast User Response

Use SendMessage type: "broadcast" to send the user's full response to all 3 agents.

#### 1.6 Debate and Synthesis

Agents interpret the response and debate via SendMessage.
Orchestrator monitors message count (max 10 per NFR-002).
If count reaches 10, broadcast: "Debate concluded — submit final positions."

#### 1.7 Collect Final Positions

Wait for all 3 agents to send their FINAL POSITION message.
Merge into unified Project Brief (docs/project-brief.md).

#### 1.8 Shutdown Phase 1 Agents

SendMessage type: "shutdown_request" to nadia, oscar, tessa.
Wait for shutdown_response from each.

TaskUpdate: T1 → completed
```

### 3.3 Party Phase 2: Stack & Architecture Debate

```markdown
### Party Phase 2: Stack & Architecture Debate

**Goal**: Evaluate tech stack options through structured debate with 3 specialists.
**Interaction**: propose-critique-converge
**AC**: AC-8, AC-9, AC-10

#### 2.1 Spawn Phase 2 Agents

TaskUpdate: T2 → in_progress

Launch 3 agents IN PARALLEL:

Agent 1 (Liam): solution-architect-party
  - Pass: Project Brief content
  - Instructions: "You are the Solution Architect in a Stack Debate with
    Zara (Security Advisor) and Felix (DevOps Pragmatist). Propose 1-2
    architecture patterns and a complete tech stack recommendation. Share
    your proposal via broadcast. Respond to critiques. Converge toward
    consensus. Max 10 messages."

Agent 2 (Zara): security-advisor
  - Pass: Project Brief content
  - Instructions: "You are the Security Advisor in a Stack Debate with
    Liam (Solution Architect) and Felix (DevOps Pragmatist). Wait for
    Liam's proposal, then critique its security posture. Suggest
    improvements. Respond to revisions."

Agent 3 (Felix): devops-pragmatist
  - Pass: Project Brief content
  - Instructions: "You are the DevOps Pragmatist in a Stack Debate with
    Liam (Solution Architect) and Zara (Security Advisor). Wait for
    Liam's proposal, then evaluate build/deploy/cost implications.
    Suggest improvements. Respond to revisions."

#### 2.2 Monitor Debate

Track SendMessage count. Ensure at least 1 round of critique (AC-9).
If agents converge before 10 messages, proceed.
If 10 messages reached, broadcast cutoff.

#### 2.3 Collect Consensus

Collect final tech stack recommendation from all 3 agents.
Synthesize into consensus (or document trade-offs if dissent exists).

#### 2.4 Present to User

Display consensus recommendation using the RECOMMENDED STACK format.
Present [Y] / [C] menu for user approval.

If [C]: Adjust based on user input, re-present.
If [Y]: Capture approved tech_stack object.

#### 2.5 Shutdown Phase 2 Agents

SendMessage type: "shutdown_request" to liam, zara, felix.
TaskUpdate: T2 → completed
```

### 3.4 Party Phase 3: Blueprint Assembly

```markdown
### Party Phase 3: Blueprint Assembly

**Goal**: Produce design artifacts with cross-review between 3 specialists.
**Interaction**: produce-cross-review-finalize
**AC**: AC-11, AC-12

#### 3.1 Spawn Phase 3 Agents

TaskUpdate: T3 → in_progress

Launch 3 agents IN PARALLEL:

Agent 1 (D8): architecture-designer
  - NO persona context (uses standard D8 instructions)
  - Pass: Project Brief, approved tech_stack, architecture patterns
  - Instructions: "Design system architecture. Produce
    docs/architecture/architecture-overview.md. After production, share
    a summary via broadcast and review the data model designer's artifact."

Agent 2 (D14): data-model-designer
  - Pass: Project Brief, approved tech_stack, architecture patterns
  - Instructions: "Design the data model. Produce
    docs/architecture/data-model.md. After production, share a summary
    via broadcast and review the test strategist's artifact."

Agent 3 (D15): test-strategist
  - Pass: Project Brief, approved tech_stack, architecture patterns
  - Instructions: "Create test strategy outline. Produce
    docs/architecture/test-strategy-outline.md. After production, share
    a summary via broadcast and review the architecture designer's artifact."

#### 3.2 Cross-Review Round

After all 3 agents produce artifacts:
- D8 reviews D14's data model summary
- D14 reviews D15's test strategy summary
- D15 reviews D8's architecture summary

Each agent sends review feedback via SendMessage.
Each agent incorporates feedback and sends finalization confirmation.

#### 3.3 Collect Final Artifacts

Orchestrator confirms all 3 artifacts are written to their paths.
TaskUpdate: T3 → completed

#### 3.4 Shutdown Phase 3 Agents

SendMessage type: "shutdown_request" to arch-designer, data-modeler, test-strategist.
```

### 3.5 Party Phase 4: Constitution & Scaffold

```markdown
### Party Phase 4: Constitution & Scaffold

**Goal**: Generate constitution and install skills (same as classic mode).
**Interaction**: task-delegation (NOT team members)
**AC**: AC-13

#### 4.1 Constitution Generation

TaskUpdate: T4 → in_progress

Launch D3 (constitution-generator) via Task tool (NOT as team member):
  - Pass: Project Brief, tech_stack, architecture_overview, data_model,
    test_strategy, research findings from Phase 1 debate
  - Same invocation as classic mode Step 7
  - Interactive constitution review with user

#### 4.2 Skills Installation

Launch D4 (skills-researcher) via Task tool:
  - Same invocation as classic mode Step 8b
  - Pass detected tech stack
  - Search skills.sh, install recommendations

#### 4.3 Project Structure Scaffolding

Create directory structure from D8's architecture blueprint:
  - src/ scaffolding based on component structure
  - tests/ directories (unit, integration, e2e)

Same logic as classic mode Step 8a.

TaskUpdate: T4 → completed
```

### 3.6 Party Phase 5: Walkthrough & Finalize

```markdown
### Party Phase 5: Walkthrough & Finalize

**Goal**: Present structured walkthrough and write discovery_context envelope.
**Interaction**: orchestrator-inline
**AC**: AC-14, AC-16, AC-20

#### 5.1 Walkthrough

TaskUpdate: T5 → in_progress

Execute walkthrough inline (same protocol as existing Step 7.5):
  - Step 1: Constitution review (MANDATORY)
  - Step 2: Architecture & tech stack review
  - Step 2.5: Permission audit
  - Step 3: Test coverage gaps
  - Step 3.5: Iteration configuration
  - Step 4: Smart next steps

#### 5.2 Write discovery_context Envelope

Write discovery_context to state.json with same schema as classic mode:
{
  "completed_at": "{timestamp}",
  "version": "1.0",
  "tech_stack": { from Phase 2 consensus },
  "coverage_summary": { all zeros for new project },
  "architecture_summary": "{from D8 output}",
  "constitution_path": "docs/isdlc/constitution.md",
  "discovery_report_path": "",
  "re_artifacts": { all zeros/empty },
  "permissions_reviewed": {from walkthrough},
  "walkthrough_completed": true,
  "user_next_action": "{from walkthrough}"
}

#### 5.3 Update Project State

Same as classic mode Step 9:
  - project.is_new_project = false
  - project.discovery_completed = true
  - project.tech_stack = approved stack
  - project.discovered_at = timestamp

#### 5.4 Team Cleanup

Send shutdown_request to any remaining active agents.
TeamDelete to clean up inception-party team.

TaskUpdate: T5 → completed

#### 5.5 Display Completion

Same format as classic mode Step 10, with party-specific detail:

INCEPTION PARTY COMPLETE

Phase 1: Vision Council              [Complete]
  3 perspectives merged into Project Brief

Phase 2: Stack Debate                [Complete]
  Consensus: {language} + {framework} + {database}

Phase 3: Blueprint Assembly          [Complete]
  Architecture, data model, test strategy with cross-review

Phase 4: Constitution & Scaffold     [Complete]
  {article_count} articles, {skill_count} skills installed

Phase 5: Walkthrough                 [Complete]
  Constitution reviewed, permissions audited

Created:
  docs/project-brief.md
  docs/architecture/architecture-overview.md
  docs/architecture/data-model.md
  docs/architecture/test-strategy-outline.md
  docs/isdlc/constitution.md
  src/ (project structure)
  tests/ (test infrastructure)

Next Steps:
  /isdlc feature — Build your first feature
```

---

## 4. Error Handling Integration

### 4.1 Agent Failure Within a Phase

Inserted as defensive checks within each phase:

```markdown
After spawning agents, monitor for failures:

IF any agent fails:
  1. Log: "Agent {name} failed in Phase {N}"
  2. Retry once: re-send the prompt
  3. IF retry fails:
     Display: "{PersonaName} encountered an issue. Proceeding with remaining agents."
     Continue phase with remaining agents' output
  4. IF ALL agents fail:
     Present fallback menu:
     [1] Retry phase
     [2] Fall back to classic mode
     [3] Cancel
```

### 4.2 Team Cleanup on Error

Defensive pattern at the top of PARTY MODE FLOW:

```markdown
PARTY MODE FLOW executes with defensive cleanup:

On ANY unrecoverable error during Phases 1-5:
  1. Send shutdown_request to all known active agents
  2. TeamDelete
  3. Present fallback menu or error report to user
```

---

## 5. Classic Mode Isolation

### 5.1 No Changes to Classic Mode

The existing Steps 1-10 of the NEW PROJECT FLOW are **completely unchanged**. The mode selection (Step 0) branches BEFORE any classic mode code executes. When mode == "classic", the flow proceeds exactly as today.

### 5.2 Shared Exit

Both modes converge on the same exit point:
- Write `discovery_context` envelope (same schema)
- Update `project` state in state.json (same fields)
- Display completion summary (format varies but same information)

---

## 6. Estimated Size

| Component | Lines Added |
|-----------|-------------|
| Step 0: Mode Selection | ~40 |
| Party Phase 1: Vision Council | ~100 |
| Party Phase 2: Stack Debate | ~80 |
| Party Phase 3: Blueprint Assembly | ~80 |
| Party Phase 4: Constitution & Scaffold | ~50 |
| Party Phase 5: Walkthrough & Finalize | ~80 |
| Error Handling | ~40 |
| **Total** | **~470** |
