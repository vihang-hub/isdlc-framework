---
name: architecture-pattern-selection
description: Select appropriate architecture pattern based on project requirements
skill_id: DISC-801
owner: architecture-designer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: When choosing the foundational architecture pattern for a new project
dependencies: []
---

# Architecture Pattern Selection

## Purpose
Evaluate project requirements, non-functional constraints, and team context to select the most appropriate architecture pattern. Documents the decision as an Architecture Decision Record with clear rationale for why the chosen pattern fits.

## When to Use
- At the start of architecture design for a new project
- When NFRs and scale indicators are known and an architecture pattern must be chosen
- When re-evaluating architecture after significant changes in requirements or scale

## Prerequisites
- PRD available with non-functional requirements and scale indicators
- Tech stack selected or at least constrained to viable options
- MVP scope defined to understand initial complexity

## Process

### Step 1: Analyze Non-Functional Requirements
Extract the key NFRs that drive architecture decisions — expected concurrent users, data volume, latency requirements, availability targets, team size, and deployment constraints. Identify which NFRs are the primary drivers versus secondary concerns.

### Step 2: Evaluate Architecture Patterns
Assess candidate patterns against the NFR drivers. Consider monolith (simplest, fastest to deliver, suitable for small teams and moderate scale), modular monolith (structured boundaries with monolith deployment simplicity), microservices (independent scaling and deployment, higher operational complexity), and serverless (event-driven, minimal ops, cold start trade-offs). Score each pattern against the primary NFR drivers.

### Step 3: Select and Document Decision
Choose the simplest pattern that satisfies all primary NFR drivers. Document the decision in ADR format including the context, the options considered, the decision made, and the consequences. Prefer simpler patterns when requirements do not demand distributed complexity.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| prd | object | Yes | PRD with NFRs, scale indicators, and functional scope |
| tech_stack | object | Yes | Selected or constrained technology choices |
| team_context | object | No | Team size, experience, and operational maturity |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| selected_pattern | string | The chosen architecture pattern name |
| adr_document | file | Architecture Decision Record with full rationale |
| pattern_rationale | string | Summary of why this pattern was selected |

## Integration Points
- **prd-generation**: Provides NFRs and scale indicators that drive pattern selection
- **data-model-design**: Pattern choice influences data storage and access strategies
- **api-design**: Pattern choice shapes API structure and communication style
- **directory-scaffolding**: Pattern determines the top-level directory organization

## Validation
- At least 3 architecture patterns were evaluated against NFR drivers
- The selected pattern satisfies all primary non-functional requirements
- The decision is documented in ADR format with context, options, and consequences
- Simpler patterns were preferred when multiple patterns satisfied requirements
