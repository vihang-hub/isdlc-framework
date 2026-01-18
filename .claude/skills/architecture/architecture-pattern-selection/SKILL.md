---
name: architecture-pattern-selection
description: Choose appropriate architectural patterns for the system
skill_id: ARCH-001
owner: solution-architect
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: System design, major feature additions, scalability decisions
dependencies: []
---

# Architecture Pattern Selection

## Purpose
Select appropriate architectural patterns (monolith, microservices, event-driven, etc.) based on requirements, constraints, and trade-offs to create a sustainable system design.

## When to Use
- New project architecture design
- Major system evolution
- Scalability challenges
- Technology modernization

## Prerequisites
- Requirements understood
- NFRs quantified
- Constraints identified
- Team capabilities known

## Process

### Step 1: Analyze Requirements
```
Key questions:
- What are the scalability needs?
- How complex is the domain?
- What are the deployment constraints?
- What is the team's experience?
- What are the performance requirements?
```

### Step 2: Evaluate Pattern Options
```
Common patterns:
- Monolithic: Simple, single deployment
- Layered: Separation of concerns
- Microservices: Independent scaling
- Event-Driven: Async, loose coupling
- Serverless: Pay-per-use, managed
- CQRS: Read/write optimization
```

### Step 3: Apply Selection Criteria
```
Selection matrix:
| Criteria | Monolith | Microservices | Serverless |
|----------|----------|---------------|------------|
| Complexity | Low | High | Medium |
| Scalability | Limited | High | High |
| Team size | Small | Large | Any |
| Time to market | Fast | Slow | Fast |
| Operational cost | Low | High | Variable |
```

### Step 4: Document Decision
```
Create ADR with:
- Context and requirements
- Options considered
- Decision and rationale
- Trade-offs accepted
- Consequences
```

### Step 5: Define Pattern Implementation
```
For chosen pattern:
- Component boundaries
- Communication patterns
- Data management approach
- Deployment strategy
- Evolution path
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| requirements_spec | Markdown | Yes | System requirements |
| nfr_matrix | Markdown | Yes | Performance/scale needs |
| constraints | Markdown | Yes | Technical constraints |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| architecture_pattern.md | Markdown | Pattern decision |
| ADR-001 | Markdown | Architecture decision record |
| component_diagram | Mermaid | High-level components |

## Project-Specific Considerations
- Modular monolith recommended for MVP (team size, time to market)
- Event-driven for external API integrations
- Consider serverless for document processing
- Plan for future microservices extraction

## Integration Points
- **Requirements Agent**: NFRs input
- **Security Agent**: Security architecture patterns
- **DevOps Agent**: Deployment patterns

## Examples
```
Architecture Pattern Decision - SDLC Framework

Context:
- MVP timeline: 6 months
- Team size: Small (2-3 developers)
- Scale: 10K concurrent users (peak)
- Domain: Moderately complex

Options Evaluated:
1. Monolithic - Fast development, limited scale
2. Modular Monolith - Balanced approach
3. Microservices - Overkill for MVP

Decision: Modular Monolith

Rationale:
- Faster time to market
- Sufficient for initial scale
- Clear module boundaries for future extraction
- Team can manage single deployment

Modules Identified:
├── User Module (auth, profile)
├── University Module (search, details)
├── Application Module (forms, documents)
├── Notification Module (email, alerts)
└── Integration Module (external APIs)

Evolution Path:
- Phase 1: Modular monolith (MVP)
- Phase 2: Extract Integration Module (if API scaling needed)
- Phase 3: Consider microservices for high-traffic modules
```

## Validation
- Pattern aligns with requirements
- Team can implement pattern
- Scalability needs addressed
- ADR documented
- Evolution path defined