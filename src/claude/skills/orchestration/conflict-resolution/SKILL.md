---
name: conflict-resolution
description: Handle conflicting outputs or recommendations from agents
skill_id: ORCH-005
owner: sdlc-orchestrator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Agent disagreements, contradictory outputs, decision deadlocks
dependencies: [ORCH-001]
---

# Conflict Resolution

## Purpose
Resolve conflicts when multiple agents produce contradictory outputs, have different recommendations, or when technical decisions require arbitration between competing approaches.

## When to Use
- Architecture vs Security agent disagreement
- Design conflicts between frontend/backend approaches
- Resource allocation disputes
- Technical approach disagreements
- Timeline vs quality tradeoffs
- Scope disagreements

## Prerequisites
- Conflicting positions documented
- Context for each position understood
- Decision criteria defined
- Escalation path available

## Process

### Step 1: Identify Conflict
```
Document the conflict:
1. Agents involved
2. Subject of disagreement
3. Each agent's position
4. Rationale for each position
5. Impact if each position is adopted
```

### Step 2: Gather Context
```
Collect supporting information:
- Requirements relevant to decision
- Constraints (technical, timeline, budget)
- Prior decisions (ADRs) affecting this
- Industry best practices
- Project priorities
```

### Step 3: Evaluate Options
```
For each position, assess:
- Alignment with requirements
- Technical feasibility
- Security implications
- Performance impact
- Maintenance burden
- Timeline impact
- Risk level
```

### Step 4: Apply Decision Framework
```
Decision hierarchy:
1. Security concerns override other factors
2. Requirements compliance is mandatory
3. Architecture decisions (ADRs) take precedence
4. Performance NFRs must be met
5. Prefer simpler solutions when equal
6. Consider future extensibility
```

### Step 5: Document Resolution
```
Create conflict resolution record:
- Conflict ID and description
- Positions considered
- Decision made
- Rationale
- Dissenting notes (if any)
- Action items
- Create ADR if architectural decision
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| conflict_report | JSON | Yes | Details of the conflict |
| agent_positions | JSON | Yes | Each agent's stance |
| project_context | JSON | Yes | Requirements, constraints |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| resolution_record.json | JSON | Decision documentation |
| adr_draft.md | Markdown | ADR if architectural decision |
| action_items.json | JSON | Tasks resulting from decision |

## Project-Specific Considerations
- Security Agent has veto on PII/GDPR issues
- External API design conflicts defer to architecture-agent
- Performance vs feature scope: consult requirements priority
- OAuth2 approach: security-agent leads decision

## Integration Points
- **All Agents**: May be party to conflicts
- **Architecture Agent**: Creates ADRs for decisions
- **Human**: Escalation for unresolvable conflicts

## Examples
```
Conflict: REST vs GraphQL for University Search API

Positions:
- Developer Agent: GraphQL for flexible queries
- Architecture Agent: REST for simplicity/caching
- Security Agent: REST easier to secure

Resolution Process:
1. Requirements check: Need filtering, sorting, pagination
2. Performance: REST caching benefits high-traffic endpoint
3. Security: REST has simpler attack surface
4. Team familiarity: More REST experience

Decision: REST API
Rationale: Security preference + caching needs + team skills
ADR: ADR-007-university-search-api-rest.md

Action Items:
- Design Agent: Create OpenAPI spec for REST endpoints
- Developer Agent: Implement REST with proper caching
- Test Manager: Design REST API test cases
```

## Validation
- Both/all positions fairly considered
- Decision aligns with project priorities
- Resolution documented with rationale
- Affected agents acknowledge decision
- ADR created if needed