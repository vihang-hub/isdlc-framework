# Architecture Overview — REQ-0006: Inception Party

**Feature**: BMAD-inspired role-based party mode for `/discover --new`
**Version**: 1.0.0
**Created**: 2026-02-09

---

## 1. Architecture Pattern: Conditional Branch with Shared Exit

The Inception Party feature follows a **conditional branch** pattern: the orchestrator forks into two independent execution paths (party mode vs classic mode) that converge on a shared exit — the same `discovery_context` envelope, the same walkthrough protocol, and the same state.json finalization.

```
/discover --new
      |
      v
  +---------+
  | Command |  discover.md reads --party / --classic / (none)
  +---------+
      |
      v
  +-------------------+
  | Orchestrator      |  discover-orchestrator.md
  | Mode Resolution   |  Determines execution path
  +-------------------+
      |
  +---+---+---+
  |       |       |
  v       v       v
--party  (menu)  --classic
  |       |       |
  v       v       v
PARTY   [1][2]  CLASSIC
MODE     |  |   MODE
FLOW     |  |   FLOW
  |      |  +--->(existing Steps 1-10)
  |      |
  |      v
  |    PARTY or CLASSIC
  |    based on selection
  |
  v
+=======================+
| PARTY MODE FLOW       |  NEW — 5 phases with TeamCreate
|                       |
| Phase 1: Vision       |  3 agents parallel (TeamCreate)
| Phase 2: Stack Debate |  3 agents parallel (same team)
| Phase 3: Blueprint    |  3 agents parallel (same team)
| Phase 4: Constitution |  sequential (D3, D4)
| Phase 5: Walkthrough  |  sequential (team lead)
+=======================+
         |
         v
+========================+
| SHARED EXIT            |  Both modes converge here
|                        |
| Write discovery_context|  Same schema (AC-16)
| Write project state    |  Same fields
| Display completion     |  Same format
+========================+
```

---

## 2. Component Architecture

### 2.1 File Layout

```
src/claude/
  commands/
    discover.md                           # MODIFIED: add --party, --classic flags
  agents/
    discover-orchestrator.md              # MODIFIED: add PARTY MODE FLOW section
    discover/
      party-personas.json                 # NEW: declarative persona config
      domain-researcher.md                # NEW: Oscar (Phase 1)
      technical-scout.md                  # NEW: Tessa (Phase 1)
      solution-architect-party.md         # NEW: Liam (Phase 2)
      security-advisor.md                 # NEW: Zara (Phase 2)
      devops-pragmatist.md                # NEW: Felix (Phase 2)
      test-strategist.md                  # NEW: Test strategy (Phase 3)
      data-model-designer.md              # NEW: Data model design (Phase 3)
      product-analyst.md                  # UNCHANGED: reused as Nadia (Phase 1)
      architecture-designer.md            # UNCHANGED: reused (Phase 3)
      constitution-generator.md           # UNCHANGED: reused (Phase 4)
      skills-researcher.md                # UNCHANGED: reused (Phase 4)
```

### 2.2 Agent Classification

| Agent | ID | Type | Phase | Lifecycle |
|-------|----|------|-------|-----------|
| Discover Orchestrator | D0 | Team Lead | All | Owns the team. Creates, coordinates, shuts down. |
| Product Analyst (Nadia) | D7 | Team Member | 1 | Spawned at Phase 1 start. Reused from classic mode via persona context injection. |
| Domain Researcher (Oscar) | D9 | Team Member | 1 | NEW. Spawned at Phase 1 start. Shutdown after Phase 1. |
| Technical Scout (Tessa) | D10 | Team Member | 1 | NEW. Spawned at Phase 1 start. Shutdown after Phase 1. |
| Solution Architect (Liam) | D11 | Team Member | 2 | NEW. Spawned at Phase 2 start. Shutdown after Phase 2. |
| Security Advisor (Zara) | D12 | Team Member | 2 | NEW. Spawned at Phase 2 start. Shutdown after Phase 2. |
| DevOps Pragmatist (Felix) | D13 | Team Member | 2 | NEW. Spawned at Phase 2 start. Shutdown after Phase 2. |
| Architecture Designer | D8 | Team Member | 3 | Reused from classic mode. Spawned at Phase 3 start. |
| Data Model Designer | D14 | Team Member | 3 | NEW. Spawned at Phase 3 start. |
| Test Strategist | D15 | Team Member | 3 | NEW. Spawned at Phase 3 start. |
| Constitution Generator | D3 | Sub-agent (Task) | 4 | NOT a team member. Invoked via Task tool (same as classic mode). |
| Skills Researcher | D4 | Sub-agent (Task) | 4 | NOT a team member. Invoked via Task tool (same as classic mode). |

---

## 3. Architecture Decision Records (ADRs)

### ADR-001: Single Team, Phase-Scoped Members

**Decision**: Use ONE TeamCreate instance for the entire party mode flow. Spawn and shutdown agents per phase rather than keeping all 9 agents alive simultaneously.

**Rationale**:
- Reduces concurrent resource usage (max 3 agents active at any time)
- Clear lifecycle boundaries — each phase has defined inputs and outputs
- Simpler error handling — only 3 agents to clean up on failure per phase
- Team context (shared task list, message history) persists across phases

**Alternatives Rejected**:
- Multiple teams per phase: Overhead of TeamCreate/TeamDelete per phase. Loses cross-phase message context.
- All agents alive all phases: Wasteful. Phase 1 agents have no role in Phase 3.

### ADR-002: Persona Context Injection (Not Agent Duplication)

**Decision**: Reuse existing agents (D7, D8) by injecting persona context via the Task prompt rather than creating persona-specific copies. New agents are only created where no existing agent serves the role.

**Rationale**:
- Constraint #3 (existing agent reuse) mandates maximizing reuse
- D7 (product-analyst) already does vision elicitation — Nadia just adds persona framing
- D8 (architecture-designer) already designs architecture — no persona needed for Phase 3
- Only truly new roles (domain research, tech scouting, security advising, devops evaluation, test strategy, data model design) get new agent files

**Implementation**: The orchestrator passes a `PERSONA_CONTEXT` block in the Task prompt:
```
PERSONA_CONTEXT:
  Name: Nadia
  Title: Product Analyst
  Style: Empathetic, user-focused, asks "why" and "for whom"
  Expertise: User needs, market fit, MVP scope
  Phase: Vision Council
  Team Role: Focus on user problems and success metrics

You are participating in an Inception Party with two other specialists.
Ask your questions from YOUR expertise angle. Do not duplicate their domains.
```

Agents that do NOT need persona context (D3, D4, D8 in Phase 3) receive standard prompts identical to classic mode.

### ADR-003: New Data Model Designer Agent (Not D5 Adaptation)

**Decision**: Create a new `data-model-designer.md` agent (D14) for party mode Phase 3 rather than adapting D5 (data-model-analyzer).

**Rationale**:
- D5 is analysis-oriented: it scans existing schemas, reads migration files, detects data stores. Its entire process assumes code exists.
- Party mode Phase 3 needs a designer that creates data models from requirements (no existing code).
- Adding a `mode: "design"` parameter to D5 would require rewriting most of its process steps, violating Article V (simplicity).
- A new agent with clean design-focused instructions is simpler and more maintainable.
- D8 already has DISC-802 (data-model-design) skill but its scope is component-level design, not dedicated data model artifact generation with cross-review.

**Trade-off**: +1 agent file, but cleaner separation of concerns.

### ADR-004: Phase 4 Uses Task Tool (Not Team Members)

**Decision**: Phase 4 (Constitution & Scaffold) invokes D3 and D4 via the standard Task tool, NOT as team members. The team is paused during Phase 4.

**Rationale**:
- D3 (constitution-generator) has its own internal sub-agent coordination (4 parallel research agents). Nesting a team member inside another team's coordination creates complexity.
- D4 (skills-researcher) is interactive — it may prompt the user for skill selection. Team member messaging adds no value here.
- Classic mode uses Task tool for D3 and D4 — reusing the same invocation pattern ensures AC-15 (classic mode compatibility) and AC-16 (discovery_context compatibility).
- Phase 4 is sequential by design (REQ-005), so parallelism features of TeamCreate are not needed.

### ADR-005: Orchestrator as Team Lead (Not a Separate Coordinator)

**Decision**: The discover-orchestrator (D0) itself acts as the team lead. No separate coordinator agent is spawned.

**Rationale**:
- The orchestrator already coordinates the classic mode flow — it is the natural leader.
- Creating a separate party-coordinator agent would add indirection and require the orchestrator to delegate to a coordinator who delegates to team members.
- TeamCreate assigns the creating agent as team lead automatically.
- The orchestrator can use SendMessage to broadcast, collect, and synthesize without a proxy.

### ADR-006: Broadcast Pattern for User Responses

**Decision**: When the user responds to Phase 1 questions, the orchestrator broadcasts the response to all Phase 1 agents via `SendMessage type: "broadcast"`.

**Rationale**:
- AC-6 explicitly requires broadcast: "User's response is broadcast to all Phase 1 agents via SendMessage"
- Alternative (orchestrator sends 3 individual messages) is functionally equivalent but more verbose and loses the semantic intent of "everyone should see this"
- The broadcast is appropriate here because all 3 agents need the same information simultaneously — this is one of the valid use cases documented in the SendMessage tool

### ADR-007: Structured Artifact Handover Between Phases

**Decision**: Inter-phase data is passed via the orchestrator, not directly between agents. Each phase produces structured artifacts that the orchestrator collects and passes to the next phase.

**Rationale**:
- Agents in Phase 1 are shut down before Phase 2 starts (ADR-001)
- The orchestrator needs to see all artifacts to: track progress (AC-19), validate completeness, and pass correct context to next phase
- This mirrors the classic mode pattern where the orchestrator captures each sub-agent's return value and passes it forward
- Prevents agents from developing hidden dependencies on each other's internal state

**Artifact Flow**:
```
Phase 1 agents → orchestrator collects → project_brief + vision_notes
                                            |
Phase 2 agents → orchestrator collects → tech_stack + architecture_patterns
                                            |
Phase 3 agents → orchestrator collects → architecture_overview + data_model + test_strategy
                                            |
Phase 4 (D3, D4 via Task) → orchestrator collects → constitution + skills
                                            |
Phase 5 walkthrough → orchestrator runs inline → discovery_context envelope
```

### ADR-008: JSON for Persona Config (Not YAML)

**Decision**: Use JSON for `party-personas.json`, not YAML.

**Rationale**:
- All existing config files in `.isdlc/` are JSON (state.json, workflows.json, settings.json, skills-manifest.json)
- The only YAML file is `providers.yaml` which predates the JSON convention
- Article XIII (Module System Consistency) requires following established patterns
- JSON is natively readable by the framework's Node.js tooling without additional parsers

---

## 4. Orchestrator Flow Design

### 4.1 Mode Resolution (Pre-Flow)

The orchestrator resolves the execution mode at the top of the NEW PROJECT FLOW, BEFORE any agent work begins.

```
NEW PROJECT FLOW entry
  |
  v
Check options for --party / --classic flags
  |
  +-- --party present  → set mode = "party", skip menu
  +-- --classic present → set mode = "classic", skip menu
  +-- neither present  → present MODE SELECTION MENU
                           [1] Party Mode (Recommended)
                           [2] Classic Mode (sequential)
                           → set mode from selection
  |
  v
IF mode == "classic":
    Execute existing Steps 1-10 (no changes)
    RETURN

IF mode == "party":
    Execute PARTY MODE FLOW (below)
    RETURN
```

**Key constraint**: The mode selection menu is presented ONLY when `/discover --new` is invoked (or option [1] from the FIRST-TIME MENU). It is NOT shown for `--existing`, `--atdd-ready`, or other flows.

### 4.2 Party Mode Flow (5 Phases)

#### Party Phase 1: Vision Council

```
1. TeamCreate: "inception-party"
   Team lead: discover-orchestrator (D0)

2. TaskCreate: "Vision Council — gathering multi-perspective project vision"

3. Spawn 3 agents as team members:
   a. Nadia (D7 with persona context) — product-analyst
   b. Oscar (D9) — domain-researcher
   c. Tessa (D10) — technical-scout

4. Each agent asks 2-3 questions from their expertise:
   - Nadia: user needs, pain points, success metrics
   - Oscar: industry context, regulations, compliance, competitors
   - Tessa: scale expectations, tech preferences, ecosystem constraints

5. Orchestrator collects questions from all 3 agents.
   Presents merged question set to user (deduplicated, grouped by theme).

6. User responds once.

7. Orchestrator broadcasts response to all 3 agents.

8. Agents synthesize individually, then debate via SendMessage:
   - Each agent posts their interpretation of the vision
   - At least 1 round of cross-commentary (AC-9 pattern)
   - Max 10 messages total (NFR-002)

9. Orchestrator collects final positions from all agents.
   Merges into unified Project Brief (docs/project-brief.md).

10. Shutdown Phase 1 agents:
    SendMessage type: "shutdown_request" to Oscar, Tessa
    (Nadia/D7 is also shutdown — will be re-invoked if needed)

11. TaskUpdate: mark Vision Council complete
```

#### Party Phase 2: Stack & Architecture Debate

```
1. TaskCreate: "Stack Debate — evaluating technology options"

2. Spawn 3 agents as team members:
   a. Liam (D11) — solution-architect-party
   b. Zara (D12) — security-advisor
   c. Felix (D13) — devops-pragmatist

3. Pass to all 3: Project Brief from Phase 1

4. Debate protocol (max 10 messages, NFR-002):
   a. Liam proposes 1-2 architecture patterns + framework recommendations
   b. Zara critiques security posture of each proposal
   c. Felix evaluates build/deploy/cost implications
   d. At least 1 round of critique (AC-9)
   e. Agents converge toward consensus or present trade-offs

5. Orchestrator collects consensus recommendation.
   Presents to user:
   [Y] Yes, proceed with this stack
   [C] I have changes (user adjusts)

6. If [C]: orchestrator adjusts based on user input, re-presents.

7. Shutdown Phase 2 agents.

8. TaskUpdate: mark Stack Debate complete

9. Artifacts collected: tech_stack, architecture_patterns, security_notes
```

#### Party Phase 3: Blueprint Assembly

```
1. TaskCreate: "Blueprint Assembly — producing design artifacts"

2. Spawn 3 agents as team members:
   a. Architecture Designer (D8) — architecture-designer
   b. Data Model Designer (D14) — data-model-designer
   c. Test Strategist (D15) — test-strategist

3. Pass to all 3: Project Brief + tech_stack + architecture_patterns

4. Each agent produces their artifact independently.

5. Cross-review protocol (AC-12):
   a. Each agent shares their artifact summary via SendMessage
   b. Each agent reviews at least 1 other agent's artifact
   c. Agents post review comments and suggestions
   d. Agents finalize their artifacts incorporating feedback

6. Orchestrator collects final artifacts:
   - docs/architecture/architecture-overview.md (from D8)
   - docs/architecture/data-model.md (from D14)
   - docs/architecture/test-strategy-outline.md (from D15)

7. Shutdown Phase 3 agents.

8. TaskUpdate: mark Blueprint Assembly complete
```

#### Party Phase 4: Constitution & Scaffold (Sequential, No Team)

```
1. TaskCreate: "Constitution & Scaffold — generating governance artifacts"

2. Invoke D3 (constitution-generator) via Task tool:
   - Pass: Project Brief, tech_stack, architecture_overview, data_model, test_strategy
   - Same invocation as classic mode Step 7
   - Interactive constitution review with user

3. Invoke D4 (skills-researcher) via Task tool:
   - Same invocation as classic mode Step 8b
   - Search skills.sh, install recommendations

4. Create project structure (same as classic mode Step 8a):
   - src/ scaffolding from architecture blueprint
   - tests/ directories (unit, integration, e2e)

5. TaskUpdate: mark Constitution & Scaffold complete
```

#### Party Phase 5: Walkthrough & Finalize (Sequential)

```
1. TaskCreate: "Walkthrough — interactive review and next steps"

2. Execute walkthrough inline (same protocol as existing Step 7.5):
   - Step 1: Constitution review (MANDATORY)
   - Step 2: Architecture & tech stack review
   - Step 2.5: Permission audit
   - Step 3: Test coverage gaps
   - Step 3.5: Iteration configuration
   - Step 4: Smart next steps

3. Write discovery_context envelope (same schema as classic mode):
   {
     "completed_at": "...",
     "version": "1.0",
     "tech_stack": { ... },           // from Phase 2
     "coverage_summary": { ... },     // defaults to 0 (new project)
     "architecture_summary": "...",   // from Phase 3
     "constitution_path": "...",
     "discovery_report_path": "",
     "re_artifacts": { ... },         // defaults to 0 (new project)
     "permissions_reviewed": true/false,
     "walkthrough_completed": true,
     "user_next_action": "..."
   }

4. Update project state (same as classic mode Step 9).

5. Shutdown all remaining team members (if any).
6. TeamDelete.

7. Display completion summary.
8. TaskUpdate: mark Walkthrough complete
```

---

## 5. Error Handling Architecture

### 5.1 Agent Failure in Parallel Phase

When one agent fails in a parallel phase (AC-18):

```
IF agent fails during Phase 1/2/3:
  1. Orchestrator receives failure notification (agent goes idle with error)
  2. Log the failure: which agent, which phase, error details
  3. Attempt ONE retry (re-send the prompt to the same agent)
  4. IF retry fails:
     a. Report to user: "{PersonaName} encountered an issue. Proceeding with remaining agents."
     b. Continue with remaining agents' output
     c. Mark the failed agent's contribution as "unavailable" in the phase summary
  5. IF all agents in a phase fail:
     a. Escalate to user: "All agents in {phase_name} failed."
     b. Offer: [1] Retry phase  [2] Fall back to classic mode  [3] Cancel
```

### 5.2 Team Lifecycle Cleanup

The orchestrator MUST clean up the team on ANY exit path:

```
Party Mode Flow:
  TRY:
    TeamCreate(...)
    Phase 1...
    Phase 2...
    Phase 3...
    Phase 4...
    Phase 5...
    TeamDelete(...)
  ON ANY ERROR:
    Send shutdown_request to all known active agents
    Wait for shutdown_response (max 30s)
    TeamDelete(...)
    Report error to user
```

In markdown agent instructions, this is expressed as a defensive pattern:
"Before writing the completion summary, ALWAYS execute the team cleanup sequence regardless of whether all phases succeeded."

### 5.3 Classic Mode Fallback

If party mode encounters an unrecoverable error (e.g., TeamCreate fails, all agents fail in Phase 1):

```
Offer fallback:
  "Party mode encountered an issue. Would you like to continue with classic mode?"
  [1] Yes, switch to classic mode
  [2] No, cancel discovery

IF [1]: Execute classic mode Steps 1-10 from the beginning.
         Any artifacts already produced by party mode are discarded.
```

---

## 6. Persona Configuration Schema

### 6.1 party-personas.json

```json
{
  "version": "1.0.0",
  "description": "Persona definitions for Inception Party mode",
  "personas": {
    "nadia": {
      "name": "Nadia",
      "title": "Product Analyst",
      "agent_type": "product-analyst",
      "agent_id": "D7",
      "phase": 1,
      "is_existing_agent": true,
      "communication_style": "Empathetic, user-focused, asks 'why' and 'for whom'",
      "expertise": "User needs, market fit, MVP scope",
      "question_domains": ["user problems", "pain points", "success metrics", "target audience"],
      "debate_focus": "Advocates for user value and simplicity"
    },
    "oscar": {
      "name": "Oscar",
      "title": "Domain Researcher",
      "agent_type": "domain-researcher",
      "agent_id": "D9",
      "phase": 1,
      "is_existing_agent": false,
      "communication_style": "Thorough, evidence-based, cites industry standards",
      "expertise": "Compliance, regulations, best practices",
      "question_domains": ["industry context", "regulations", "competitors", "standards"],
      "debate_focus": "Ensures regulatory and industry alignment"
    },
    "tessa": {
      "name": "Tessa",
      "title": "Technical Scout",
      "agent_type": "technical-scout",
      "agent_id": "D10",
      "phase": 1,
      "is_existing_agent": false,
      "communication_style": "Pragmatic, trend-aware, evaluates feasibility",
      "expertise": "Emerging tech, tooling ecosystem, DX",
      "question_domains": ["scale expectations", "tech preferences", "ecosystem constraints", "DX priorities"],
      "debate_focus": "Evaluates technical feasibility and developer experience"
    },
    "liam": {
      "name": "Liam",
      "title": "Solution Architect",
      "agent_type": "solution-architect-party",
      "agent_id": "D11",
      "phase": 2,
      "is_existing_agent": false,
      "communication_style": "Structured, trade-off focused, systems thinker",
      "expertise": "Architecture patterns, scalability, integration",
      "question_domains": [],
      "debate_focus": "Proposes architecture patterns and evaluates trade-offs"
    },
    "zara": {
      "name": "Zara",
      "title": "Security Advisor",
      "agent_type": "security-advisor",
      "agent_id": "D12",
      "phase": 2,
      "is_existing_agent": false,
      "communication_style": "Risk-aware, principle-driven, challenges assumptions",
      "expertise": "Threat modeling, auth, data protection",
      "question_domains": [],
      "debate_focus": "Challenges proposals on security and data protection grounds"
    },
    "felix": {
      "name": "Felix",
      "title": "DevOps Pragmatist",
      "agent_type": "devops-pragmatist",
      "agent_id": "D13",
      "phase": 2,
      "is_existing_agent": false,
      "communication_style": "Opinionated, build-deploy focused, cost-conscious",
      "expertise": "CI/CD, infrastructure, observability",
      "question_domains": [],
      "debate_focus": "Evaluates operational cost, deployment complexity, and DX"
    },
    "architect": {
      "name": "Architecture Designer",
      "title": "Architecture Designer",
      "agent_type": "architecture-designer",
      "agent_id": "D8",
      "phase": 3,
      "is_existing_agent": true,
      "communication_style": "Systematic, pattern-driven",
      "expertise": "Component architecture, API design",
      "question_domains": [],
      "debate_focus": "Produces architecture overview artifact"
    },
    "data_modeler": {
      "name": "Data Model Designer",
      "title": "Data Model Designer",
      "agent_type": "data-model-designer",
      "agent_id": "D14",
      "phase": 3,
      "is_existing_agent": false,
      "communication_style": "Precise, relationship-aware",
      "expertise": "Entity design, schema, relationships",
      "question_domains": [],
      "debate_focus": "Produces data model artifact"
    },
    "test_strategist": {
      "name": "Test Strategist",
      "title": "Test Strategist",
      "agent_type": "test-strategist",
      "agent_id": "D15",
      "phase": 3,
      "is_existing_agent": false,
      "communication_style": "Quality-focused, coverage-driven",
      "expertise": "Test pyramid, coverage strategy, tooling",
      "question_domains": [],
      "debate_focus": "Produces test strategy outline artifact"
    }
  },
  "phases": {
    "1": {
      "name": "Vision Council",
      "type": "parallel",
      "personas": ["nadia", "oscar", "tessa"],
      "max_messages": 10,
      "interaction": "question-broadcast-debate",
      "output": "project_brief"
    },
    "2": {
      "name": "Stack & Architecture Debate",
      "type": "parallel",
      "personas": ["liam", "zara", "felix"],
      "max_messages": 10,
      "interaction": "propose-critique-converge",
      "output": "tech_stack_recommendation"
    },
    "3": {
      "name": "Blueprint Assembly",
      "type": "parallel",
      "personas": ["architect", "data_modeler", "test_strategist"],
      "max_messages": 10,
      "interaction": "produce-cross-review-finalize",
      "output": "design_artifacts"
    },
    "4": {
      "name": "Constitution & Scaffold",
      "type": "sequential",
      "personas": [],
      "max_messages": 0,
      "interaction": "task-delegation",
      "output": "constitution_and_skills"
    },
    "5": {
      "name": "Walkthrough",
      "type": "sequential",
      "personas": [],
      "max_messages": 0,
      "interaction": "orchestrator-inline",
      "output": "discovery_context"
    }
  }
}
```

---

## 7. Agent Interaction Patterns

### 7.1 Question-Broadcast-Debate (Phase 1)

```
         Orchestrator (Team Lead)
              |
    +---------+---------+
    |         |         |
    v         v         v
  Nadia     Oscar     Tessa
    |         |         |
    v         v         v
  Questions  Questions  Questions
    |         |         |
    +----+----+----+----+
         |
         v
    Orchestrator merges & presents to User
         |
         v
    User responds once
         |
         v
    Orchestrator broadcasts response
         |
    +----+----+----+
    |         |         |
    v         v         v
  Nadia     Oscar     Tessa
    |         |         |
    v         v         v
  Interpret  Interpret  Interpret
    |         |         |
    +--SendMessage-->---+
    |   cross-comment   |
    +---<--SendMessage--+
    |         |         |
    v         v         v
  Final pos  Final pos  Final pos
    |         |         |
    +----+----+----+----+
         |
         v
    Orchestrator merges → Project Brief
```

### 7.2 Propose-Critique-Converge (Phase 2)

```
    Orchestrator passes Project Brief
         |
    +----+----+----+
    |         |         |
    v         v         v
   Liam     Zara     Felix
    |         |         |
    v         v         v
  Propose    (wait)   (wait)
  arch+stack
    |
    +--SendMessage to Zara, Felix-->
    |
    v         v         v
  (wait)   Critique   Critique
           security   ops/cost
    |         |         |
    <--SendMessage------+
    |
    v
  Revise + respond
    |
    +--SendMessage (round 2 if needed)-->
    |         |         |
    v         v         v
  Consensus/trade-offs collected
    |
    v
  Orchestrator presents to User
```

### 7.3 Produce-Cross-Review-Finalize (Phase 3)

```
    Orchestrator passes Brief + Stack + Patterns
         |
    +----+----+----+
    |         |         |
    v         v         v
   D8       D14      D15
    |         |         |
    v         v         v
  Produce   Produce   Produce
  arch.md   data.md   test.md
    |         |         |
    v         v         v
  Share summary via SendMessage
    |         |         |
    +--review D14's model-->
    |    D14 reviews D8  |
    |    D15 reviews D14 |
    |         |         |
    v         v         v
  Finalize  Finalize  Finalize
  (with feedback incorporated)
    |         |         |
    +----+----+----+----+
         |
         v
    Orchestrator collects final artifacts
```

---

## 8. Output Artifacts (Party Mode vs Classic Mode)

| Artifact | Classic Mode | Party Mode | Compatibility |
|----------|-------------|------------|---------------|
| `docs/project-brief.md` | D7 alone | 3-agent synthesis | Identical schema |
| Tech Stack | Orchestrator recommends | 3-agent debate + user approval | Same result fields |
| `docs/requirements/prd.md` | D7 alone (Phase 4) | Skipped (PRD not generated in party mode*) | See note |
| `docs/architecture/architecture-overview.md` | D8 alone | D8 + cross-review | Same structure |
| `docs/architecture/data-model.md` | D8 (embedded) | D14 (dedicated) | Separate file, richer |
| `docs/architecture/test-strategy-outline.md` | Not produced | D15 | New artifact (additive) |
| `docs/isdlc/constitution.md` | D3 | D3 (identical) | Same |
| Skills installed | D4 | D4 (identical) | Same |
| `src/` scaffolding | D8 blueprint | D8 blueprint | Same |
| `tests/` scaffolding | Orchestrator | Orchestrator | Same |
| `discovery_context` envelope | Step 9 | Phase 5 | IDENTICAL schema (AC-16) |

*Note on PRD: Classic mode generates a separate PRD (docs/requirements/prd.md) in Step 5 via D7. Party mode's Phase 1 produces a richer Project Brief (with multi-perspective input) that serves the same purpose. The architecture phase in Party mode works from the Project Brief + tech stack consensus rather than a formal PRD. If downstream workflows require a PRD, the orchestrator can generate one from the Project Brief as a post-processing step — but this is not in the initial scope.

---

## 9. State Management

### 9.1 Party Mode Tracking in state.json

During party mode execution, the orchestrator tracks progress under `discover.party_mode`:

```json
{
  "discover": {
    "status": "in_progress",
    "mode": "party",
    "started_at": "...",
    "team_name": "inception-party",
    "current_party_phase": 2,
    "party_phases": {
      "1": { "status": "completed", "agents": ["nadia", "oscar", "tessa"], "messages": 7 },
      "2": { "status": "in_progress", "agents": ["liam", "zara", "felix"], "messages": 3 },
      "3": { "status": "pending" },
      "4": { "status": "pending" },
      "5": { "status": "pending" }
    }
  }
}
```

This tracking is for observability only. The `discovery_context` envelope (the output that matters to downstream workflows) is written at completion and is mode-agnostic.

### 9.2 No Changes to discovery_context Schema

The `discovery_context` envelope written by party mode is field-identical to classic mode (ADR-008 / AC-16):

```json
{
  "discovery_context": {
    "completed_at": "...",
    "version": "1.0",
    "tech_stack": { "primary_language": "...", "runtime": "...", "frameworks": [...], "test_runner": "...", "package_manager": "..." },
    "coverage_summary": { "unit_test_pct": 0, "integration_test_pct": 0, "critical_path_coverage": 0, "total_tests": 0, "meets_constitution": false, "high_priority_gaps": 0 },
    "architecture_summary": "...",
    "constitution_path": "docs/isdlc/constitution.md",
    "discovery_report_path": "",
    "re_artifacts": { "ac_count": 0, "domains": 0, "traceability_csv": "" },
    "permissions_reviewed": true,
    "walkthrough_completed": true,
    "user_next_action": "..."
  }
}
```

---

## 10. Constitutional Compliance

| Article | How This Architecture Complies |
|---------|-------------------------------|
| I (Spec as Source of Truth) | Architecture directly traces to REQ-001 through REQ-012. Each ADR cites the requirement it addresses. |
| V (Simplicity) | Reuses 4 existing agents (D3, D4, D7, D8). New agents only where no existing agent serves the role. Single team for entire flow. |
| VII (Traceability) | ADRs numbered and cross-referenced. Agent classification table maps to requirements. |
| VIII (Documentation Currency) | Architecture overview, persona config schema, and agent classification will be reflected in AGENTS.md updates. |
| IX (Gate Integrity) | discovery_context schema is identical (AC-16). Classic mode is completely untouched (AC-15). |
| XIII (Module System) | JSON config (ADR-008). YAML frontmatter for new agent .md files. No new .cjs files. |
| XIV (State Management) | Party mode tracking in state.json under `discover.party_mode`. No schema changes to discovery_context. |
