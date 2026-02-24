# Interface Specification — REQ-0006: Inception Party

**Feature**: BMAD-inspired role-based party mode for `/discover --new`
**Version**: 1.0.0
**Created**: 2026-02-09
**Traces to**: architecture-overview.md, requirements-spec.md

---

## 1. Command Interface Changes (discover.md)

### 1.1 New CLI Flags

| Flag | Type | Default | Description | AC |
|------|------|---------|-------------|-----|
| `--party` | boolean | false | Skip mode selection menu, enter party mode directly | AC-2 |
| `--classic` | boolean | false | Skip mode selection menu, enter classic mode directly | AC-3 |

**Mutual exclusion**: `--party` and `--classic` cannot both be specified. If both are present, display error:
```
Error: --party and --classic are mutually exclusive. Use one or the other.
```

### 1.2 Options Table Addition

Add to the existing Options table in `discover.md`:

```markdown
| `--party` | Force party mode for new project setup (skip mode menu) |
| `--classic` | Force classic mode for new project setup (skip mode menu) |
```

### 1.3 Flag Pass-Through

The command file passes flags to the orchestrator via the Task prompt:
```
"Execute /discover command --new --party"
"Execute /discover command --new --classic"
"Execute /discover command --new"  (no flag = present menu)
```

**Scope**: `--party` and `--classic` flags are ONLY honored when the orchestrator enters the NEW PROJECT FLOW. They are silently ignored during EXISTING PROJECT FLOW and Chat/Explore mode.

---

## 2. Mode Selection Menu Interface

### 2.1 Menu Presentation (AC-1)

Inserted into discover-orchestrator.md's NEW PROJECT FLOW, BEFORE Step 1 (Display Welcome). This becomes the new "Step 0: Mode Selection".

**Trigger conditions:**
- Flow is NEW PROJECT FLOW
- Neither `--party` nor `--classic` flag is present

**Menu format (AskUserQuestion):**

```
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
```

**Menu handling:**

| Selection | Action |
|-----------|--------|
| [1] or "party" | Set `mode = "party"`, proceed to PARTY MODE FLOW |
| [2] or "classic" | Set `mode = "classic"`, proceed to existing Steps 1-10 (unchanged) |

### 2.2 Mode Resolution Algorithm

```
FUNCTION resolveMode(options):
  IF options.party == true:
    RETURN "party"
  IF options.classic == true:
    RETURN "classic"
  // No flag — present menu
  selection = AskUserQuestion(modeSelectionMenu)
  IF selection == 1:
    RETURN "party"
  IF selection == 2:
    RETURN "classic"
```

---

## 3. Orchestrator Party Mode Flow Interface

### 3.1 Team Lifecycle Interface

**TeamCreate invocation:**
```json
{
  "team_name": "inception-party",
  "description": "Multi-agent inception party for new project discovery"
}
```

**Team membership** (max 3 concurrent at any time):

| Party Phase | Agents Added | Agents Removed |
|-------------|-------------|----------------|
| Phase 1 start | nadia, oscar, tessa | — |
| Phase 1 end | — | oscar, tessa (nadia also shutdown) |
| Phase 2 start | liam, zara, felix | — |
| Phase 2 end | — | liam, zara, felix |
| Phase 3 start | arch-designer, data-modeler, test-strategist | — |
| Phase 3 end | — | arch-designer, data-modeler, test-strategist |
| Phase 4 | (no team members — D3, D4 via Task tool) | — |
| Phase 5 end | — | TeamDelete |

**TeamDelete invocation** (Phase 5 end):
```json
// No parameters needed — deletes current team
```

### 3.2 Task Progress Interface (AC-19)

Five tasks created, one per party phase:

| Task | Subject | ActiveForm |
|------|---------|------------|
| T1 | Vision Council — gathering multi-perspective project vision | Gathering project vision |
| T2 | Stack Debate — evaluating technology options | Evaluating technology options |
| T3 | Blueprint Assembly — producing design artifacts | Producing design artifacts |
| T4 | Constitution & Scaffold — generating governance artifacts | Generating governance |
| T5 | Walkthrough — interactive review and next steps | Running walkthrough |

**Task lifecycle:**
- Created at party mode start (all 5 tasks created upfront)
- Set to `in_progress` when phase begins
- Set to `completed` when phase ends

### 3.3 Agent Spawn Interface

Each agent is spawned as a team member using the Task tool with `team_name` and `name` parameters.

**Phase 1 spawn template:**
```json
{
  "subagent_type": "product-analyst",
  "team_name": "inception-party",
  "name": "nadia",
  "prompt": "{PERSONA_CONTEXT}\n{PHASE_1_INSTRUCTIONS}\n{PROJECT_DESCRIPTION}",
  "description": "Vision Council: Nadia (Product Analyst)"
}
```

```json
{
  "subagent_type": "domain-researcher",
  "team_name": "inception-party",
  "name": "oscar",
  "prompt": "{PERSONA_CONTEXT}\n{PHASE_1_INSTRUCTIONS}\n{PROJECT_DESCRIPTION}",
  "description": "Vision Council: Oscar (Domain Researcher)"
}
```

```json
{
  "subagent_type": "technical-scout",
  "team_name": "inception-party",
  "name": "tessa",
  "prompt": "{PERSONA_CONTEXT}\n{PHASE_1_INSTRUCTIONS}\n{PROJECT_DESCRIPTION}",
  "description": "Vision Council: Tessa (Technical Scout)"
}
```

**Phase 2 spawn template:**
```json
{
  "subagent_type": "solution-architect-party",
  "team_name": "inception-party",
  "name": "liam",
  "prompt": "{PERSONA_CONTEXT}\n{PHASE_2_INSTRUCTIONS}\n{PROJECT_BRIEF}",
  "description": "Stack Debate: Liam (Solution Architect)"
}
```

```json
{
  "subagent_type": "security-advisor",
  "team_name": "inception-party",
  "name": "zara",
  "prompt": "{PERSONA_CONTEXT}\n{PHASE_2_INSTRUCTIONS}\n{PROJECT_BRIEF}",
  "description": "Stack Debate: Zara (Security Advisor)"
}
```

```json
{
  "subagent_type": "devops-pragmatist",
  "team_name": "inception-party",
  "name": "felix",
  "prompt": "{PERSONA_CONTEXT}\n{PHASE_2_INSTRUCTIONS}\n{PROJECT_BRIEF}",
  "description": "Stack Debate: Felix (DevOps Pragmatist)"
}
```

**Phase 3 spawn template:**
```json
{
  "subagent_type": "architecture-designer",
  "team_name": "inception-party",
  "name": "arch-designer",
  "prompt": "{PHASE_3_INSTRUCTIONS}\n{PROJECT_BRIEF}\n{TECH_STACK}\n{ARCHITECTURE_PATTERNS}",
  "description": "Blueprint Assembly: Architecture Designer"
}
```

```json
{
  "subagent_type": "data-model-designer",
  "team_name": "inception-party",
  "name": "data-modeler",
  "prompt": "{PHASE_3_INSTRUCTIONS}\n{PROJECT_BRIEF}\n{TECH_STACK}\n{ARCHITECTURE_PATTERNS}",
  "description": "Blueprint Assembly: Data Model Designer"
}
```

```json
{
  "subagent_type": "test-strategist",
  "team_name": "inception-party",
  "name": "test-strategist",
  "prompt": "{PHASE_3_INSTRUCTIONS}\n{PROJECT_BRIEF}\n{TECH_STACK}\n{ARCHITECTURE_PATTERNS}",
  "description": "Blueprint Assembly: Test Strategist"
}
```

### 3.4 Agent Shutdown Interface

**Per-phase shutdown (Phases 1-3):**
```json
{
  "type": "shutdown_request",
  "recipient": "{agent_name}",
  "content": "Phase {N} complete. Thank you for your contribution."
}
```

**Final cleanup (Phase 5 end):**
Send `shutdown_request` to any remaining active agents, then `TeamDelete`.

### 3.5 Inter-Agent Message Protocols

#### Protocol A: Question-Broadcast-Debate (Phase 1)

**Step 1 — Agent question submission:**
Each Phase 1 agent sends questions to the orchestrator:
```json
{
  "type": "message",
  "recipient": "discover-orchestrator",
  "content": "QUESTIONS:\n1. {question_1}\n2. {question_2}\n3. {question_3}",
  "summary": "{persona_name} has questions for the user"
}
```

**Step 2 — Orchestrator merges and presents:**
The orchestrator collects all 3 agents' questions, deduplicates overlapping themes, groups by topic, and presents to the user via AskUserQuestion:

```
+==============================================================+
|  VISION COUNCIL — Questions from your team                   |
+==============================================================+

Your team of specialists wants to understand your project:

FROM NADIA (Product Analyst):
  1. {question}
  2. {question}

FROM OSCAR (Domain Researcher):
  3. {question}
  4. {question}

FROM TESSA (Technical Scout):
  5. {question}
  6. {question}

Please answer these questions. You can respond to all at once —
the team will receive your full response.
```

**Step 3 — Broadcast user response (AC-6):**
```json
{
  "type": "broadcast",
  "content": "USER RESPONSE:\n{full_user_response}",
  "summary": "User's project vision response"
}
```

**Step 4 — Agent interpretation and debate:**
Each agent processes the response and posts their interpretation:
```json
{
  "type": "message",
  "recipient": "{other_agent_name}",
  "content": "MY INTERPRETATION:\n{vision_summary}\n\nKEY POINTS:\n- {point_1}\n- {point_2}\n\nQUESTION FOR YOU: {cross_question}",
  "summary": "{persona_name}'s vision interpretation"
}
```

**Debate bounds** (NFR-002): Max 10 SendMessage calls total across all agents in Phase 1. The orchestrator tracks message count and sends a cutoff message if needed:
```json
{
  "type": "broadcast",
  "content": "DEBATE CONCLUDED — message limit reached. Please submit your final position.",
  "summary": "Debate concluded, final positions needed"
}
```

**Step 5 — Final position submission:**
Each agent sends their final synthesis:
```json
{
  "type": "message",
  "recipient": "discover-orchestrator",
  "content": "FINAL POSITION:\n\nProject Vision: {summary}\nTarget Users: {users}\nCore Features: {features}\nConstraints: {constraints}\nSuccess Metrics: {metrics}",
  "summary": "{persona_name}'s final vision"
}
```

#### Protocol B: Propose-Critique-Converge (Phase 2)

**Step 1 — Liam proposes:**
```json
{
  "type": "broadcast",
  "content": "PROPOSAL:\n\nArchitecture Pattern: {pattern}\nLanguage: {lang} — {rationale}\nFramework: {fw} — {rationale}\nDatabase: {db} — {rationale}\nAdditional: {services}",
  "summary": "Liam's tech stack proposal"
}
```

**Step 2 — Zara critiques security:**
```json
{
  "type": "message",
  "recipient": "liam",
  "content": "SECURITY CRITIQUE:\n\n{concern_1}: {detail}\n{concern_2}: {detail}\n\nRECOMMENDATION: {suggestion}",
  "summary": "Zara's security critique"
}
```

**Step 3 — Felix critiques ops:**
```json
{
  "type": "message",
  "recipient": "liam",
  "content": "OPS CRITIQUE:\n\nDeployment: {concern}\nCost: {concern}\nDX: {concern}\n\nRECOMMENDATION: {suggestion}",
  "summary": "Felix's ops critique"
}
```

**Step 4 — Liam revises (or defends):**
```json
{
  "type": "broadcast",
  "content": "REVISED PROPOSAL:\n\n{updated_stack}\n\nADDRESSED:\n- Security: {how_addressed}\n- Ops: {how_addressed}\n\nUNCHANGED: {what_kept_and_why}",
  "summary": "Liam's revised tech stack"
}
```

**Step 5 — Consensus or trade-offs:**
Each agent sends agreement/disagreement to orchestrator. Orchestrator synthesizes and presents to user:

```
+==============================================================+
|  TECH STACK RECOMMENDATION                                   |
+==============================================================+

Your team has evaluated options and recommends:

  Language:    {language}
               {rationale}

  Framework:   {framework}
               {rationale}

  Database:    {database}
               {rationale}

  {additional services}

CONSENSUS: {unanimous / majority}
{Any trade-off notes from dissenting agent}

[Y] Yes, proceed with this stack
[C] I have changes

Enter selection:
```

#### Protocol C: Produce-Cross-Review-Finalize (Phase 3)

**Step 1 — Independent production:**
Each agent receives the full context (brief + stack + patterns) and produces their artifact independently. No inter-agent messaging during production.

**Step 2 — Share artifact summaries:**
Each agent shares a summary of their artifact:
```json
{
  "type": "broadcast",
  "content": "ARTIFACT SUMMARY — {artifact_type}:\n\n{2-3 paragraph summary}\n\nKEY DECISIONS:\n- {decision_1}\n- {decision_2}\n\nDEPENDENCIES ON OTHER ARTIFACTS:\n- {dependency_1}",
  "summary": "{agent_name}'s artifact ready for review"
}
```

**Step 3 — Cross-review assignments (AC-12):**

| Reviewer | Reviews |
|----------|---------|
| D8 (Architecture) | D14's data model (checks alignment with architecture) |
| D14 (Data Model) | D15's test strategy (checks data layer test coverage) |
| D15 (Test Strategy) | D8's architecture (checks testability of design) |

Each reviewer sends review feedback:
```json
{
  "type": "message",
  "recipient": "{reviewed_agent_name}",
  "content": "REVIEW FEEDBACK:\n\nStrengths:\n- {strength}\n\nSuggestions:\n- {suggestion_1}\n- {suggestion_2}\n\nAlignment Issues:\n- {issue} (if any)",
  "summary": "Review of {artifact_type}"
}
```

**Step 4 — Finalize:**
Each agent incorporates feedback and confirms completion:
```json
{
  "type": "message",
  "recipient": "discover-orchestrator",
  "content": "ARTIFACT FINALIZED:\n\nFile: {artifact_path}\nChanges from review: {changes_summary}\nReady for collection.",
  "summary": "{agent_name}'s artifact finalized"
}
```

---

## 4. Persona Context Injection Interface

### 4.1 PERSONA_CONTEXT Block Template

Injected into the Task prompt for agents that receive persona framing (Phase 1 & 2 agents). Phase 3 agents do NOT receive persona context (they use their standard instructions).

```
PERSONA_CONTEXT:
  Name: {persona.name}
  Title: {persona.title}
  Style: {persona.communication_style}
  Expertise: {persona.expertise}
  Phase: {phase.name}
  Team Role: {persona.debate_focus}

You are participating in an Inception Party with two other specialists.
Communicate in a style consistent with your persona: {persona.communication_style}.
Ask your questions from YOUR expertise angle. Do not duplicate their domains.
When debating, stay in character but prioritize substance over performance.
```

### 4.2 Field Source Mapping

All persona fields are read from `src/claude/agents/discover/party-personas.json`:

| Block Field | JSON Path |
|-------------|-----------|
| Name | `personas.{key}.name` |
| Title | `personas.{key}.title` |
| Style | `personas.{key}.communication_style` |
| Expertise | `personas.{key}.expertise` |
| Phase | `phases.{phase_number}.name` |
| Team Role | `personas.{key}.debate_focus` |

### 4.3 Persona Context for Existing Agents (D7, D8)

When reusing D7 (product-analyst) as Nadia in Phase 1:
- The PERSONA_CONTEXT block is **prepended** to the standard D7 prompt
- D7's existing process (probing questions, brainstorming) runs as normal
- The persona context channels D7's questioning toward user-focused dimensions

When reusing D8 (architecture-designer) in Phase 3:
- **No PERSONA_CONTEXT** is injected
- D8 receives its standard prompt with additional context (brief + stack + patterns)
- D8 operates identically to classic mode

---

## 5. Party Mode Artifact Output Interface

### 5.1 Artifact Paths

| Artifact | Path | Producer | Phase |
|----------|------|----------|-------|
| Project Brief | `docs/project-brief.md` | Orchestrator (merged from 3 agents) | 1 |
| Architecture Overview | `docs/architecture/architecture-overview.md` | D8 | 3 |
| Data Model | `docs/architecture/data-model.md` | D14 | 3 |
| Test Strategy Outline | `docs/architecture/test-strategy-outline.md` | D15 | 3 |
| Constitution | `docs/isdlc/constitution.md` | D3 | 4 |
| Skill Report | `docs/isdlc/skill-customization-report.md` | D4 | 4 |

### 5.2 Project Brief Merge Format

The orchestrator merges 3 agents' final positions into a single Project Brief:

```markdown
# Project Brief

**Generated by**: Inception Party (3-agent Vision Council)
**Date**: {timestamp}

## 1. Problem Statement
{Merged from all 3 agents' interpretations, prioritizing Nadia's user-focused framing}

## 2. Target Users
{From Nadia's analysis, augmented by Oscar's regulatory user categories}

## 3. Core Features
{Merged feature list from all 3 agents, deduplicated}

## 4. Scale & Constraints
{From Tessa's technical assessment + Oscar's compliance constraints}

## 5. Success Metrics
{From Nadia's user metrics + Tessa's technical metrics}

## 6. Industry Context
{From Oscar's domain research}

## 7. Technical Considerations
{From Tessa's feasibility assessment}

## 8. Risk Factors
{Merged from all 3 agents}
```

### 5.3 Artifact Compatibility (AC-16)

The following artifacts maintain identical schema between party and classic modes:

| Artifact | Schema Source | Verification |
|----------|-------------|--------------|
| `discovery_context` envelope | Section 9.2 of architecture-overview.md | Field-by-field comparison |
| `docs/architecture/architecture-overview.md` | D8 output format (unchanged) | D8 produces same structure |
| `docs/isdlc/constitution.md` | D3 output format (unchanged) | D3 invoked identically |
| state.json `project` section | Step 9 of NEW PROJECT FLOW | Same fields written |

---

## 6. Error Handling Interface

### 6.1 Agent Failure Detection

The orchestrator detects agent failure when:
1. Agent goes idle without sending expected output message
2. Agent sends an error message via SendMessage
3. Agent's Task invocation returns with error status

### 6.2 Retry Interface

On first failure:
```json
{
  "type": "message",
  "recipient": "{failed_agent_name}",
  "content": "Your previous response was not received. Please try again: {original_prompt}",
  "summary": "Retry request for {agent_name}"
}
```

### 6.3 Degradation Notification

On second failure (retry failed):
```
NOTE: {PersonaName} ({Title}) encountered an issue and could not contribute
to this phase. Proceeding with {remaining_count} agent(s).
```

### 6.4 Total Phase Failure Menu

When all agents in a phase fail:
```
All agents in {phase_name} encountered errors.

[1] Retry phase — re-launch all agents
[2] Fall back to classic mode — restart with sequential flow
[3] Cancel — abort discovery

Enter selection (1-3):
```

### 6.5 Classic Mode Fallback

On fallback to classic mode:
1. Send `shutdown_request` to all active team members
2. `TeamDelete` to clean up team
3. Display: `"Switching to classic mode. Starting from Phase 1."`
4. Execute existing Steps 1-10 of NEW PROJECT FLOW (from the beginning)
5. Discard any party mode artifacts (do not attempt to merge partial results)

---

## 7. State Management Interface

### 7.1 Party Mode State Tracking

Written to `state.json` under `discover.party_mode` during party mode execution:

```json
{
  "discover": {
    "status": "in_progress",
    "mode": "party",
    "started_at": "2026-02-09T10:00:00Z",
    "team_name": "inception-party",
    "current_party_phase": 2,
    "party_phases": {
      "1": {
        "status": "completed",
        "agents": ["nadia", "oscar", "tessa"],
        "messages": 7,
        "started_at": "2026-02-09T10:00:00Z",
        "completed_at": "2026-02-09T10:05:00Z"
      },
      "2": {
        "status": "in_progress",
        "agents": ["liam", "zara", "felix"],
        "messages": 3,
        "started_at": "2026-02-09T10:06:00Z",
        "completed_at": null
      },
      "3": { "status": "pending" },
      "4": { "status": "pending" },
      "5": { "status": "pending" }
    }
  }
}
```

### 7.2 State Cleanup on Completion

When party mode completes (Phase 5 done):
- Remove `discover.party_mode` from state.json (or set to null)
- The `discover` object retains: `status: "completed"`, `mode: "party"`
- Write `discovery_context` envelope (same schema as classic mode)

### 7.3 State Cleanup on Failure/Cancellation

When party mode fails or user cancels:
- Update `discover.party_mode.status = "failed"` or `"cancelled"`
- On classic fallback: reset `discover` to fresh state before classic mode runs

---

## 8. Persona Configuration File Interface

### 8.1 File Location

`src/claude/agents/discover/party-personas.json`

### 8.2 Schema

```json
{
  "version": "string (semver)",
  "description": "string",
  "personas": {
    "{key}": {
      "name": "string",
      "title": "string",
      "agent_type": "string (matches agent .md filename without extension)",
      "agent_id": "string (D{N})",
      "phase": "number (1|2|3)",
      "is_existing_agent": "boolean",
      "communication_style": "string",
      "expertise": "string",
      "question_domains": ["string"],
      "debate_focus": "string"
    }
  },
  "phases": {
    "{number}": {
      "name": "string",
      "type": "string (parallel|sequential)",
      "personas": ["string (persona keys)"],
      "max_messages": "number",
      "interaction": "string (question-broadcast-debate|propose-critique-converge|produce-cross-review-finalize|task-delegation|orchestrator-inline)",
      "output": "string"
    }
  }
}
```

### 8.3 Read Pattern

The orchestrator reads this file ONCE at party mode start and uses it to:
1. Look up persona details for PERSONA_CONTEXT injection
2. Determine which agents to spawn per phase
3. Enforce max_messages per phase (NFR-002)
4. Select the correct interaction protocol per phase

---

## 9. Traceability Matrix

| Interface | Requirements | Acceptance Criteria |
|-----------|-------------|-------------------|
| CLI flags (--party, --classic) | REQ-001, REQ-012 | AC-1, AC-2, AC-3 |
| Mode selection menu | REQ-001 | AC-1 |
| Team lifecycle | REQ-010 | AC-4, AC-8, AC-20 |
| Task progress tracking | REQ-010 | AC-19 |
| Agent spawn (Phase 1) | REQ-002 | AC-4, AC-5 |
| Broadcast protocol | REQ-002 | AC-6 |
| Debate protocol (Phase 1) | REQ-002 | AC-7 |
| Agent spawn (Phase 2) | REQ-003 | AC-8 |
| Critique protocol | REQ-003 | AC-9 |
| Tech stack presentation | REQ-003 | AC-10 |
| Agent spawn (Phase 3) | REQ-004 | AC-11 |
| Cross-review protocol | REQ-004 | AC-12 |
| Sequential D3/D4 | REQ-005 | AC-13 |
| Walkthrough | REQ-006 | AC-14 |
| Classic mode unchanged | REQ-007 | AC-15 |
| discovery_context schema | REQ-008 | AC-16 |
| Persona config JSON | REQ-009 | AC-17 |
| Error handling | REQ-011 | AC-18 |
