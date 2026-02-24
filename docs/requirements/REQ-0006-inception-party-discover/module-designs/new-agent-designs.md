# Module Design — New Agent Files

**Components**: 6 new agent markdown files + 1 new data model designer
**Location**: `src/claude/agents/discover/`
**Traces to**: REQ-002 through REQ-004, REQ-009, ADR-002, ADR-003

---

## 1. Agent File Convention

All new agents follow the established pattern from Article XIII and the tech-stack-decision.md:

```yaml
---
name: {agent-name}
description: "{Use this agent for...}"
model: opus
owned_skills: []  # No new skills defined for party mode agents
---

# {Agent Title}

**Agent ID:** D{N}
**Phase:** Setup (new projects only — party mode)
**Parent:** discover-orchestrator (team member in inception-party)
**Purpose:** {purpose}

---

## Role
{role description}

---

## When Invoked
{invocation context — spawned as team member in inception-party}

---

## Process
{step-by-step process}

---

## Communication Protocol
{How this agent interacts with team members via SendMessage}

---

# SUGGESTED PROMPTS
{minimal STATUS format — reports to parent orchestrator}
```

**Key differences from SDLC phase agents**:
- `owned_skills: []` — party mode agents do not own skills (they reuse orchestrator coordination)
- `Parent:` always points to `discover-orchestrator`
- Includes a `Communication Protocol` section (team communication via SendMessage)
- SUGGESTED PROMPTS uses the minimal STATUS format (sub-agent, not phase agent)

---

## 2. Domain Researcher (Oscar) — D9

**File**: `src/claude/agents/discover/domain-researcher.md`

### 2.1 YAML Frontmatter

```yaml
---
name: domain-researcher
description: "Use this agent in party mode inception. Researches industry context, regulations, compliance requirements, and competitive landscape for new projects."
model: opus
owned_skills: []
---
```

### 2.2 Role

Oscar is a thorough, evidence-based researcher who ensures new projects account for industry standards, regulatory requirements, and competitive context. He asks questions that product-focused and tech-focused agents might overlook.

### 2.3 Process

**Step 1: Receive Context**
Read the PERSONA_CONTEXT block and project description from the Task prompt.

**Step 2: Generate Questions (AC-5)**
Based on the project description, generate 2-3 questions focused on:
- Industry or domain regulations (GDPR, HIPAA, PCI-DSS, SOC2, etc.)
- Competitive landscape and industry standards
- Compliance constraints that affect architecture decisions
- Data governance and privacy requirements

Send questions to team lead (discover-orchestrator) via SendMessage.

**Step 3: Receive User Response**
Wait for broadcast of user's response. Parse and extract domain-relevant information.

**Step 4: Interpret and Debate (AC-7)**
Post interpretation to teammates via SendMessage:
- Regulatory implications identified
- Industry standards that should be followed
- Compliance requirements that must be built in
- Risks from ignoring domain context

Engage in cross-commentary with Nadia and Tessa (max contribution: ~3 messages).

**Step 5: Submit Final Position**
Send FINAL POSITION to team lead with:
- Regulatory requirements list
- Industry standards list
- Compliance constraints
- Domain-specific risks

### 2.4 Communication Protocol

```
INBOUND:
  - PERSONA_CONTEXT from orchestrator (Task prompt)
  - Broadcast: user's response to questions
  - Messages from Nadia, Tessa (debate)

OUTBOUND:
  - Questions to team lead (2-3 questions)
  - Interpretation + debate messages to teammates (2-3 messages)
  - FINAL POSITION to team lead (1 message)
```

### 2.5 Estimated Size: ~80 lines

---

## 3. Technical Scout (Tessa) — D10

**File**: `src/claude/agents/discover/technical-scout.md`

### 3.1 YAML Frontmatter

```yaml
---
name: technical-scout
description: "Use this agent in party mode inception. Evaluates technical feasibility, ecosystem options, developer experience, and scale considerations for new projects."
model: opus
owned_skills: []
---
```

### 3.2 Role

Tessa is a pragmatic, trend-aware evaluator who assesses technical feasibility and developer experience implications. She focuses on what technologies exist, what scales, and what the development experience will feel like.

### 3.3 Process

**Step 1: Receive Context**
Read PERSONA_CONTEXT and project description.

**Step 2: Generate Questions (AC-5)**
Generate 2-3 questions focused on:
- Expected scale (users, requests, data volume)
- Technical constraints (existing infrastructure, team expertise)
- Ecosystem preferences (language, framework, hosting)
- Developer experience priorities (iteration speed, type safety, debugging)

Send questions to team lead.

**Step 3: Receive User Response**
Wait for broadcast. Extract technical signals.

**Step 4: Interpret and Debate (AC-7)**
Post interpretation:
- Feasibility assessment of described features
- Scale implications and architecture hints
- Technology recommendations based on constraints
- DX considerations

Engage in cross-commentary with Nadia and Oscar.

**Step 5: Submit Final Position**
Send FINAL POSITION with:
- Technical feasibility assessment
- Scale considerations
- Technology recommendations
- DX priorities
- Risk factors (technical debt, learning curve)

### 3.4 Communication Protocol

Same pattern as D9 (3 inbound types, 3 outbound types).

### 3.5 Estimated Size: ~80 lines

---

## 4. Solution Architect — Party (Liam) — D11

**File**: `src/claude/agents/discover/solution-architect-party.md`

### 4.1 YAML Frontmatter

```yaml
---
name: solution-architect-party
description: "Use this agent in party mode inception. Proposes architecture patterns and tech stack recommendations, responds to security and ops critiques, converges toward consensus."
model: opus
owned_skills: []
---
```

### 4.2 Role

Liam is the primary proposer in Phase 2. He analyzes the Project Brief and proposes a complete tech stack with architecture pattern justification. He leads the debate by making the initial proposal and responding to critiques from Zara and Felix.

### 4.3 Process

**Step 1: Receive Context**
Read PERSONA_CONTEXT and Project Brief.

**Step 2: Analyze and Propose**
Analyze the Project Brief to determine:
- Project type (SaaS, API, CLI, real-time, etc.)
- Key technical requirements
- Scale indicators
- Any explicitly mentioned technologies

Generate a complete proposal:
- Architecture pattern (monolith, modular, microservices, etc.)
- Language + runtime
- Framework
- Database + ORM
- Additional services (caching, queuing, auth, etc.)

Broadcast proposal to Zara and Felix.

**Step 3: Receive and Process Critiques**
Wait for critiques from Zara (security) and Felix (ops/DX).
Parse concerns and recommendations.

**Step 4: Revise or Defend**
For each critique:
- If valid: revise the proposal
- If already addressed: explain how

Broadcast revised proposal (or defense) with change log.

**Step 5: Converge**
If further critique comes, respond with final position.
Send CONSENSUS RECOMMENDATION to team lead with:
- Final tech stack
- Architecture pattern
- Rationale for each choice
- Addressed concerns
- Remaining trade-offs (if any)

### 4.4 Communication Protocol

```
INBOUND:
  - PERSONA_CONTEXT + Project Brief from orchestrator
  - Critique messages from Zara, Felix
  - Possible second-round comments

OUTBOUND:
  - Initial PROPOSAL broadcast (1 message)
  - REVISED PROPOSAL broadcast (1 message)
  - CONSENSUS RECOMMENDATION to team lead (1 message)
  - Defense/clarification to individual agents (0-2 messages)
```

### 4.5 Estimated Size: ~100 lines

---

## 5. Security Advisor (Zara) — D12

**File**: `src/claude/agents/discover/security-advisor.md`

### 5.1 YAML Frontmatter

```yaml
---
name: security-advisor
description: "Use this agent in party mode inception. Evaluates security posture of proposed tech stacks and architecture patterns. Identifies threats, recommends mitigations."
model: opus
owned_skills: []
---
```

### 5.2 Role

Zara is a risk-aware, principle-driven security specialist who challenges assumptions. She evaluates Liam's proposals for security weaknesses, identifies threats, and recommends mitigations.

### 5.3 Process

**Step 1: Receive Context**
Read PERSONA_CONTEXT and Project Brief.

**Step 2: Wait for Proposal**
Wait for Liam's initial PROPOSAL broadcast.

**Step 3: Security Critique**
Evaluate the proposal against:
- Authentication and authorization approach
- Data protection (encryption at rest, in transit)
- Dependency security (known vulnerabilities in proposed stack)
- OWASP Top 10 applicability
- Compliance requirements (from Project Brief domain context)
- API security (rate limiting, input validation, CORS)

Send security critique to Liam via SendMessage.

**Step 4: Evaluate Revision**
Wait for Liam's revised proposal.
Verify concerns were addressed.
Send agreement or remaining concerns.

**Step 5: Final Position**
Send final position to team lead:
- Security assessment of final stack
- Remaining risks (accepted trade-offs)
- Recommended security practices for implementation

### 5.4 Communication Protocol

```
INBOUND:
  - PERSONA_CONTEXT + Project Brief from orchestrator
  - Liam's PROPOSAL broadcast
  - Liam's REVISED PROPOSAL broadcast

OUTBOUND:
  - SECURITY CRITIQUE to Liam (1 message)
  - Evaluation of revision (0-1 messages)
  - FINAL POSITION to team lead (1 message)
```

### 5.5 Estimated Size: ~90 lines

---

## 6. DevOps Pragmatist (Felix) — D13

**File**: `src/claude/agents/discover/devops-pragmatist.md`

### 6.1 YAML Frontmatter

```yaml
---
name: devops-pragmatist
description: "Use this agent in party mode inception. Evaluates operational cost, deployment complexity, CI/CD implications, and developer experience of proposed tech stacks."
model: opus
owned_skills: []
---
```

### 6.2 Role

Felix is an opinionated, build-deploy focused pragmatist who evaluates proposals from an operational perspective. He focuses on deployment complexity, hosting costs, CI/CD pipeline requirements, observability, and developer experience.

### 6.3 Process

**Step 1: Receive Context**
Read PERSONA_CONTEXT and Project Brief.

**Step 2: Wait for Proposal**
Wait for Liam's initial PROPOSAL broadcast.

**Step 3: Ops Critique**
Evaluate the proposal against:
- Deployment complexity (containers, serverless, VMs)
- Hosting cost estimation (for stated scale)
- CI/CD pipeline requirements
- Observability (logging, metrics, tracing)
- Local development experience (setup time, hot reload)
- Build and test speed
- Dependency management burden

Send ops critique to Liam via SendMessage.

**Step 4: Evaluate Revision**
Wait for Liam's revised proposal.
Verify ops concerns addressed.
Send agreement or remaining concerns.

**Step 5: Final Position**
Send final position to team lead:
- Ops assessment of final stack
- Estimated deployment complexity
- CI/CD recommendations
- DX score (subjective)

### 6.4 Communication Protocol

Same pattern as D12 (3 inbound, 3 outbound max).

### 6.5 Estimated Size: ~90 lines

---

## 7. Data Model Designer — D14

**File**: `src/claude/agents/discover/data-model-designer.md`

### 7.1 YAML Frontmatter

```yaml
---
name: data-model-designer
description: "Use this agent in party mode inception. Designs data models from project requirements for new projects — entities, relationships, schemas, and storage decisions."
model: opus
owned_skills: []
---
```

### 7.2 Role

D14 designs data models from scratch for new projects. Unlike D5 (data-model-analyzer) which analyzes existing schemas, D14 creates entity-relationship designs from requirements. This is a design agent, not an analysis agent (ADR-003).

### 7.3 Process

**Step 1: Receive Context**
Read Project Brief, approved tech_stack, and architecture patterns from orchestrator prompt.

**Step 2: Identify Entities**
From the Project Brief, identify:
- Core domain entities (nouns in the problem statement and features)
- Entity attributes (inferred from feature descriptions)
- Relationships between entities (one-to-many, many-to-many, etc.)
- Ownership and cascading rules

**Step 3: Design Schema**
Based on the approved tech stack (database choice), design:
- Entity schemas (table/collection definitions)
- Primary keys and indexes
- Foreign key relationships
- Enumerations and type fields
- Timestamps and audit fields (created_at, updated_at)

**Step 4: Design Storage Strategy**
- Determine if multiple data stores are needed (e.g., PostgreSQL + Redis)
- Design caching strategy if applicable
- Plan migration approach

**Step 5: Produce Artifact**
Write `docs/architecture/data-model.md` with:
```markdown
# Data Model

## Entities
{entity definitions with attributes}

## Relationships
{ER diagram in ASCII or Mermaid}

## Schema Details
{per-entity schema definition}

## Storage Strategy
{data store selection rationale}

## Indexes
{index strategy for query patterns}
```

**Step 6: Cross-Review**
Share artifact summary via broadcast.
Review D15's test strategy artifact.
Incorporate feedback from D8's review.

### 7.4 Communication Protocol

```
INBOUND:
  - Context from orchestrator (Task prompt)
  - Review feedback from D8
  - D15's artifact summary for review

OUTBOUND:
  - Artifact summary broadcast (1 message)
  - Review of D15's artifact (1 message)
  - Finalization confirmation to team lead (1 message)
```

### 7.5 Estimated Size: ~120 lines

---

## 8. Test Strategist — D15

**File**: `src/claude/agents/discover/test-strategist.md`

### 8.1 YAML Frontmatter

```yaml
---
name: test-strategist
description: "Use this agent in party mode inception. Creates test strategy outlines for new projects — test pyramid, coverage targets, tooling selection, and critical path identification."
model: opus
owned_skills: []
---
```

### 8.2 Role

D15 creates test strategy outlines for new projects. It analyzes the Project Brief and architecture to determine the test pyramid, coverage targets, tooling, and critical paths that need testing.

### 8.3 Process

**Step 1: Receive Context**
Read Project Brief, approved tech_stack, architecture patterns, and data model summary.

**Step 2: Determine Test Pyramid**
Based on project type and architecture:
- Unit test ratio (target percentage)
- Integration test ratio
- E2E test ratio
- Performance test necessity (based on NFRs)

**Step 3: Select Test Tooling**
Based on tech stack:
- Test runner (jest, vitest, pytest, go test, etc.)
- Assertion library
- Mocking framework
- E2E framework (playwright, cypress, etc.)
- Coverage tool
- Performance testing tool (if needed)

**Step 4: Identify Critical Test Paths**
From the Project Brief's core features:
- Happy path scenarios for each core feature
- Error handling scenarios
- Edge cases from domain context
- Security-relevant test cases

**Step 5: Produce Artifact**
Write `docs/architecture/test-strategy-outline.md` with:
```markdown
# Test Strategy Outline

## Test Pyramid
{pyramid ratios and rationale}

## Tooling
{tool selection with rationale}

## Coverage Targets
{per-layer coverage targets}

## Critical Test Paths
{prioritized list of test scenarios}

## Test Infrastructure
{directory structure, CI integration}
```

**Step 6: Cross-Review**
Share artifact summary via broadcast.
Review D8's architecture artifact for testability.
Incorporate feedback from D14's review.

### 8.4 Communication Protocol

Same pattern as D14 (3 inbound, 3 outbound max).

### 8.5 Estimated Size: ~110 lines

---

## 9. Agent Comparison: New vs Existing

| New Agent | Closest Existing | Why New Agent Needed |
|-----------|-----------------|---------------------|
| D9 (Domain Researcher) | None | No existing agent focuses on domain/regulatory research for new projects |
| D10 (Technical Scout) | None | No existing agent evaluates tech feasibility from a DX perspective |
| D11 (Solution Architect Party) | D2 (Solution Architect SDLC) | SDLC solution architect designs from requirements spec; party architect proposes from project brief with debate |
| D12 (Security Advisor) | D8 (Security Auditor SDLC) | SDLC auditor validates existing code; party advisor critiques proposals before code exists |
| D13 (DevOps Pragmatist) | D9 (CI/CD Engineer SDLC) | SDLC CI/CD engineer configures pipelines; party pragmatist evaluates stack from ops perspective |
| D14 (Data Model Designer) | D5 (Data Model Analyzer) | D5 analyzes existing schemas; D14 designs new schemas from requirements (ADR-003) |
| D15 (Test Strategist) | D4 (Test Design Engineer SDLC) | SDLC test engineer designs from interface specs; party strategist outlines from project brief |

---

## 10. File Size Budget

| Agent File | Estimated Lines | Complexity |
|------------|----------------|------------|
| domain-researcher.md (D9) | ~80 | Low (question-debate pattern) |
| technical-scout.md (D10) | ~80 | Low (question-debate pattern) |
| solution-architect-party.md (D11) | ~100 | Medium (propose-revise pattern) |
| security-advisor.md (D12) | ~90 | Medium (critique-evaluate pattern) |
| devops-pragmatist.md (D13) | ~90 | Medium (critique-evaluate pattern) |
| data-model-designer.md (D14) | ~120 | Medium (design + cross-review) |
| test-strategist.md (D15) | ~110 | Medium (strategy + cross-review) |
| **Total new agent lines** | **~670** | |
