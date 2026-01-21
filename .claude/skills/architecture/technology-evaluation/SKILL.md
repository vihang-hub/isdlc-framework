---
name: technology-evaluation
description: Assess and compare technology options for the stack
skill_id: ARCH-002
owner: solution-architect
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Tech stack selection, library choices, tool evaluation
dependencies: [ARCH-001]
---

# Technology Evaluation

## Purpose
Systematically evaluate and compare technology options (frameworks, languages, databases, tools) to make informed decisions that balance functionality, team capability, and long-term sustainability.

## When to Use
- Initial tech stack selection
- Adding new components
- Replacing existing technology
- Evaluating new libraries

## Prerequisites
- Requirements understood
- Constraints identified
- Team skills inventory
- Budget constraints known

## Process

### Step 1: Define Evaluation Criteria
```
Common criteria:
- Functionality fit (does it solve the problem?)
- Performance (meets NFRs?)
- Team familiarity (learning curve)
- Community/support (ecosystem health)
- Cost (licensing, infrastructure)
- Security (known vulnerabilities)
- Longevity (active maintenance)
- Integration (works with other choices)
```

### Step 2: Identify Candidates
```
For each component:
- Research leading options
- Include open-source and commercial
- Check minimum 3 alternatives
- Include "build custom" option if relevant
```

### Step 3: Create Comparison Matrix
```
| Criteria | Weight | Option A | Option B | Option C |
|----------|--------|----------|----------|----------|
| Feature fit | 25% | 4/5 | 5/5 | 3/5 |
| Performance | 20% | 4/5 | 4/5 | 5/5 |
| Team skill | 20% | 5/5 | 3/5 | 2/5 |
| Community | 15% | 5/5 | 4/5 | 3/5 |
| Cost | 10% | 5/5 | 3/5 | 4/5 |
| Security | 10% | 4/5 | 4/5 | 4/5 |
| WEIGHTED | 100% | 4.35 | 3.85 | 3.25 |
```

### Step 4: Perform POC (if needed)
```
For close decisions:
- Build minimal proof of concept
- Test critical functionality
- Measure performance
- Evaluate developer experience
```

### Step 5: Document Decision
```
Create ADR including:
- Options evaluated
- Evaluation criteria and weights
- Scores and analysis
- Decision and rationale
- Risks and mitigations
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| requirements | Markdown | Yes | Feature requirements |
| nfr_matrix | Markdown | Yes | Performance needs |
| team_skills | JSON | Optional | Team capabilities |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| tech_evaluation.md | Markdown | Comparison analysis |
| tech_stack_decision.md | Markdown | Final decisions |
| ADR-xxx | Markdown | Decision records |

## Project-Specific Considerations
- OAuth2 library selection critical for security
- ORM that handles PostgreSQL well
- Frontend framework with good form handling
- File upload library for documents
- Consider i18n support for multi-language

## Integration Points
- **Developer Agent**: Team skill input
- **Security Agent**: Security evaluation
- **DevOps Agent**: Deployment compatibility

## Examples
```
Tech Stack Evaluation - SDLC Framework

BACKEND FRAMEWORK:
| Criteria | Express | NestJS | FastAPI |
|----------|---------|--------|---------|
| Team skill | 5 | 4 | 3 |
| TypeScript | 4 | 5 | 3 |
| Performance | 4 | 4 | 5 |
| Structure | 3 | 5 | 4 |
| Ecosystem | 5 | 4 | 4 |

Decision: NestJS
Rationale: Better structure for larger app,
           TypeScript-first, good for team growth

DATABASE:
| Criteria | PostgreSQL | MySQL | MongoDB |
|----------|------------|-------|---------|
| ACID | 5 | 5 | 3 |
| JSON support | 5 | 4 | 5 |
| Team skill | 4 | 5 | 3 |
| Hosting options | 5 | 5 | 4 |

Decision: PostgreSQL
Rationale: ACID compliance, JSON support,
           excellent hosting options

Final Tech Stack:
- Frontend: React + TypeScript
- Backend: NestJS (Node.js)
- Database: PostgreSQL
- ORM: Prisma
- Auth: Passport.js with OAuth2
- Cache: Redis
- File Storage: AWS S3
- Search: PostgreSQL full-text (initially)
```

## Validation
- All major components evaluated
- Criteria weights agreed with team
- No conflicting technology choices
- ADRs created for major decisions
- POCs completed for risky choices