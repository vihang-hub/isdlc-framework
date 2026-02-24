# Requirements Specification — REQ-0006: Inception Party

**Feature**: BMAD-inspired role-based party mode for `/discover --new`
**Version**: 1.0.0
**Status**: Approved
**Created**: 2026-02-09
**Workflow**: feature

---

## 1. Problem Statement

The current `/discover --new` flow runs 8 phases sequentially using single agents (D7, D3, D8, D4). Each phase waits for the previous one to complete. This means:
- Vision elicitation is single-perspective (one product analyst asks questions)
- Tech stack selection is orchestrator-driven (no debate or trade-off analysis)
- Architecture design is single-agent (no cross-review between data model, API, and security)
- Total wall-clock time is the sum of all phases

## 2. Proposed Solution

Add an **Inception Party** mode to `/discover --new` that uses Claude Code agent teams (TeamCreate, SendMessage, TaskCreate/TaskUpdate) for real parallel multi-agent collaboration, inspired by BMAD Method's named-persona approach but with actual concurrent execution instead of simulated persona-switching.

---

## 3. Functional Requirements

| ID | Requirement | Priority |
|----|------------|----------|
| REQ-001 | When `/discover --new` is invoked, present a mode selection: `[1] Party Mode (Recommended)` / `[2] Classic Mode (sequential)` | P0 |
| REQ-002 | Party Mode Phase 1 (Vision Council): Launch 3 parallel agents — Product Analyst, Domain Researcher, Technical Scout — each asking questions from their expertise angle. User responds once, all 3 agents receive the answer via broadcast. Agents synthesize a unified Project Brief via SendMessage debate. | P0 |
| REQ-003 | Party Mode Phase 2 (Stack & Architecture Debate): Launch 3 parallel agents — Solution Architect, Security Advisor, DevOps Pragmatist — who propose and critique tech stack choices via SendMessage. The lead presents a consensus recommendation to the user for approval. | P0 |
| REQ-004 | Party Mode Phase 3 (Blueprint Assembly): Launch 3 parallel agents — Architecture Designer, Data Model Designer, Test Strategist — producing architecture overview, data model, and test strategy artifacts. Agents cross-review each other's output via SendMessage before finalization. | P0 |
| REQ-005 | Party Mode Phase 4 (Constitution & Scaffold): Run sequentially — constitution generator creates constitution from all prior artifacts, then skills researcher installs relevant skills. Interactive constitution review with user. | P0 |
| REQ-006 | Party Mode Phase 5 (Walkthrough): Team lead synthesizes all artifacts and presents a structured walkthrough to the user, following the existing walkthrough protocol (constitution review mandatory, architecture review, permission audit, test gaps, iteration config, smart next steps). | P0 |
| REQ-007 | Classic Mode must remain fully functional as the existing sequential 8-phase `/discover --new` flow. No changes to classic mode behavior. | P0 |
| REQ-008 | Discovery context envelope written to `state.json` at completion must be structurally identical between party mode and classic mode — same schema, same fields, compatible with existing SDLC orchestrator handoff. | P0 |
| REQ-009 | Each party mode persona must have a defined name, role title, communication style, and expertise area — stored in a configuration structure (not hardcoded in prose). | P1 |
| REQ-010 | Party mode must use TeamCreate for team lifecycle, SendMessage for inter-agent communication, and TaskCreate/TaskUpdate for progress tracking. | P0 |
| REQ-011 | The party mode must gracefully handle agent failures — if one agent in a parallel phase fails, the team lead should report the failure and either retry or degrade to the remaining agents' output. | P1 |
| REQ-012 | The `--party` flag should explicitly select party mode; `--classic` should explicitly select classic mode. No flag defaults to the mode selection menu. | P1 |

---

## 4. Persona Definitions (REQ-009)

| Persona | Title | Phase(s) | Communication Style | Expertise |
|---------|-------|----------|-------------------|-----------|
| **Nadia** | Product Analyst | 1 | Empathetic, user-focused, asks "why" and "for whom" | User needs, market fit, MVP scope |
| **Oscar** | Domain Researcher | 1 | Thorough, evidence-based, cites industry standards | Compliance, regulations, best practices |
| **Tessa** | Technical Scout | 1 | Pragmatic, trend-aware, evaluates feasibility | Emerging tech, tooling ecosystem, DX |
| **Liam** | Solution Architect | 2 | Structured, trade-off focused, systems thinker | Architecture patterns, scalability, integration |
| **Zara** | Security Advisor | 2 | Risk-aware, principle-driven, challenges assumptions | Threat modeling, auth, data protection |
| **Felix** | DevOps Pragmatist | 2 | Opinionated, build-deploy focused, cost-conscious | CI/CD, infrastructure, observability |
| Architecture Designer | (existing D8) | 3 | — | Component architecture, API design |
| Data Model Designer | (new or adapted D5) | 3 | — | Entity design, schema, relationships |
| Test Strategist | (new) | 3 | — | Test pyramid, coverage strategy, tooling |

---

## 5. Party Mode Phase Flow

### Phase 1: Vision Council (Parallel)

```
TeamCreate: "inception-party"

Spawn 3 agents:
  - Nadia (Product Analyst) — asks about users, pain points, success metrics
  - Oscar (Domain Researcher) — asks about regulations, industry context, competitors
  - Tessa (Technical Scout) — asks about scale, technical constraints, ecosystem preferences

All 3 ask questions → User responds once → Broadcast response
Agents debate via SendMessage → Produce unified Project Brief
Team lead collects and merges into docs/project-brief.md
```

### Phase 2: Stack & Architecture Debate (Parallel)

```
Spawn 3 agents (same team):
  - Liam (Solution Architect) — proposes architecture patterns and framework choices
  - Zara (Security Advisor) — evaluates security posture of each proposal
  - Felix (DevOps Pragmatist) — evaluates build/deploy/cost implications

Agents propose → critique via SendMessage → converge on recommendation
Team lead presents consensus to user → User approves or adjusts
```

### Phase 3: Blueprint Assembly (Parallel)

```
Spawn 3 agents (same team):
  - Architecture Designer (existing D8) — produces architecture-overview.md
  - Data Model Designer (adapted D5) — produces data-model.md
  - Test Strategist (new) — produces test-strategy-outline.md

Agents cross-review via SendMessage → finalize artifacts
```

### Phase 4: Constitution & Scaffold (Sequential)

```
Constitution Generator (D3) — creates constitution from all prior artifacts
  → Interactive article review with user
Skills Researcher (D4) — installs tech stack skills
Project structure scaffolding
```

### Phase 5: Walkthrough (Sequential)

```
Team lead synthesizes results:
  - Constitution review (mandatory)
  - Architecture review
  - Permission audit
  - Test coverage gaps
  - Iteration configuration
  - Smart next steps

Shutdown team: SendMessage type: "shutdown_request" to all agents
TeamDelete
```

---

## 6. Non-Functional Requirements

| ID | Requirement | Target |
|----|------------|--------|
| NFR-001 | Party mode total wall-clock time should be less than classic mode for equivalent projects | <80% of classic mode duration |
| NFR-002 | Inter-agent message volume per phase should be bounded | Max 10 SendMessage calls per parallel phase |
| NFR-003 | Persona definitions must be declarative and extensible | JSON/YAML config, not hardcoded |
| NFR-004 | All party mode artifacts must pass the same quality gates as classic mode artifacts | Same GATE validation |

---

## 7. User Stories

**US-001**: As a developer starting a new project, I want multiple specialist perspectives during discovery so that I get a more thoroughly considered project plan than a single-agent sequential process would produce.

**Acceptance Criteria:**
- AC-4: Phase 1 launches exactly 3 agents in parallel using TeamCreate
- AC-5: Phase 1 agents each ask at least 1 unique question from their expertise angle
- AC-6: User's response is broadcast to all Phase 1 agents via SendMessage
- AC-7: Phase 1 agents produce a unified Project Brief via inter-agent debate
- AC-8: Phase 2 launches exactly 3 agents in parallel using the same team
- AC-9: Phase 2 agents debate tech stack choices via SendMessage with at least 1 round of critique
- AC-10: Phase 2 presents a consensus tech stack recommendation to user for approval
- AC-11: Phase 3 launches 3 agents in parallel producing architecture, data model, and test strategy artifacts
- AC-12: Phase 3 agents cross-review at least 1 other agent's artifact before finalization
- AC-13: Phase 4 runs constitution generation and skills installation sequentially
- AC-14: Phase 5 presents a structured walkthrough to the user
- AC-18: If an agent fails in a parallel phase, the team lead reports the error and continues with remaining agents
- AC-20: Team is shut down gracefully after Phase 5 completes

**US-002**: As a developer who prefers speed over collaboration, I want to select classic mode so that I get the familiar sequential discovery flow without the overhead of multi-agent coordination.

**Acceptance Criteria:**
- AC-1: `/discover --new` without flags presents mode selection menu with Party and Classic options
- AC-2: `--party` flag skips menu and enters party mode directly
- AC-3: `--classic` flag skips menu and enters classic mode directly
- AC-15: Classic mode produces identical output to the current sequential flow

**US-003**: As a developer in the inception party, I want to see which personas are currently active and what they are discussing so that I understand what the team is doing on my behalf.

**Acceptance Criteria:**
- AC-17: All persona names, titles, and communication styles are defined in a config structure, not hardcoded in agent markdown
- AC-19: TaskCreate tasks are created for each party phase showing progress to the user

**US-004**: As the iSDLC framework, I want the discovery context envelope from party mode to be identical in schema to classic mode so that downstream `/isdlc feature` and `/isdlc fix` workflows work without modification.

**Acceptance Criteria:**
- AC-16: discovery_context envelope schema is identical between party and classic modes

---

## 8. Acceptance Criteria Summary

| AC | Description | Story |
|----|------------|-------|
| AC-1 | `/discover --new` without flags presents mode selection menu with Party and Classic options | US-002 |
| AC-2 | `--party` flag skips menu and enters party mode directly | US-002 |
| AC-3 | `--classic` flag skips menu and enters classic mode directly | US-002 |
| AC-4 | Phase 1 launches exactly 3 agents in parallel using TeamCreate | US-001 |
| AC-5 | Phase 1 agents each ask at least 1 unique question from their expertise angle | US-001 |
| AC-6 | User's response is broadcast to all Phase 1 agents via SendMessage | US-001 |
| AC-7 | Phase 1 agents produce a unified Project Brief via inter-agent debate | US-001 |
| AC-8 | Phase 2 launches exactly 3 agents in parallel using the same team | US-001 |
| AC-9 | Phase 2 agents debate tech stack choices via SendMessage with at least 1 round of critique | US-001 |
| AC-10 | Phase 2 presents a consensus tech stack recommendation to user for approval | US-001 |
| AC-11 | Phase 3 launches 3 agents in parallel producing architecture, data model, and test strategy artifacts | US-001 |
| AC-12 | Phase 3 agents cross-review at least 1 other agent's artifact before finalization | US-001 |
| AC-13 | Phase 4 runs constitution generation and skills installation sequentially | US-001 |
| AC-14 | Phase 5 presents a structured walkthrough to the user | US-001 |
| AC-15 | Classic mode produces identical output to the current sequential flow | US-002 |
| AC-16 | discovery_context envelope schema is identical between party and classic modes | US-004 |
| AC-17 | All persona names, titles, and communication styles are defined in a config structure, not hardcoded in agent markdown | US-003 |
| AC-18 | If an agent fails in a parallel phase, the team lead reports the error and continues with remaining agents | US-001 |
| AC-19 | TaskCreate tasks are created for each party phase showing progress to the user | US-003 |
| AC-20 | Team is shut down gracefully after Phase 5 completes | US-001 |

---

## 9. Constraints

1. **No new npm dependencies** — uses only Claude Code built-in team features (TeamCreate, SendMessage, Task tools)
2. **Backward compatible** — classic mode is unchanged, discovery_context envelope schema is unchanged
3. **Existing agent reuse** — Phase 3 should reuse existing D8 (architecture-designer) and adapt D5 (data-model-analyzer) where possible rather than creating entirely new agents
4. **Constitution Article XIII compliance** — new agent markdown files use the correct module system conventions; any new hook files use .cjs extension

---

## 10. Scope Boundaries

### In Scope

- Party mode for `/discover --new` only
- Named personas with defined communication styles
- TeamCreate/SendMessage/TaskCreate coordination
- Mode selection menu and --party/--classic flags
- Persona configuration structure
- Graceful failure handling

### Out of Scope

- Party mode for `/discover --existing` (future enhancement)
- Party mode for SDLC workflow phases (feature, fix, etc.)
- Persistent persona memory across sessions
- User-customizable persona definitions (initial version uses framework defaults)
- Voice/tone enforcement in agent output (personas have style guidance but no strict enforcement)

---

## 11. Traceability

| Requirement | User Story | Acceptance Criteria | Phase |
|------------|-----------|-------------------|-------|
| REQ-001 | US-002 | AC-1, AC-2, AC-3 | Mode Selection |
| REQ-002 | US-001 | AC-4, AC-5, AC-6, AC-7 | Party Phase 1 |
| REQ-003 | US-001 | AC-8, AC-9, AC-10 | Party Phase 2 |
| REQ-004 | US-001 | AC-11, AC-12 | Party Phase 3 |
| REQ-005 | US-001 | AC-13 | Party Phase 4 |
| REQ-006 | US-001 | AC-14 | Party Phase 5 |
| REQ-007 | US-002 | AC-15 | Classic Mode |
| REQ-008 | US-004 | AC-16 | Handoff |
| REQ-009 | US-003 | AC-17 | Configuration |
| REQ-010 | US-001 | AC-4, AC-8, AC-19, AC-20 | Coordination |
| REQ-011 | US-001 | AC-18 | Error Handling |
| REQ-012 | US-002 | AC-2, AC-3 | CLI Flags |
