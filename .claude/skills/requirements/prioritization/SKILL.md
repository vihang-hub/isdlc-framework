---
name: requirements-prioritization
description: Apply MoSCoW or other prioritization frameworks
skill_id: REQ-005
owner: requirements
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Scope definition, MVP planning, resource allocation decisions
dependencies: [REQ-001, REQ-003]
---

# Requirements Prioritization

## Purpose
Prioritize requirements using MoSCoW (Must/Should/Could/Won't) or other frameworks to define MVP scope, guide implementation order, and make resource allocation decisions.

## When to Use
- Defining MVP scope
- Sprint planning
- Scope negotiation
- Resource constraints
- Timeline pressure

## Prerequisites
- Requirements complete and classified
- Stakeholder input available
- Business value understood
- Dependencies mapped

## Process

### Step 1: Apply MoSCoW Framework
```
Categories:
MUST HAVE: Core functionality, MVP-critical
- Without these, system doesn't work
- Regulatory/compliance requirements
- Core user journey enablers

SHOULD HAVE: Important but not critical
- Significant value but workarounds exist
- Important for user experience
- Expected by most users

COULD HAVE: Nice to have
- Enhances experience
- Not critical for launch
- Can be deferred

WON'T HAVE (this release): Out of scope
- Future consideration
- Low value/high effort
- Not aligned with current goals
```

### Step 2: Gather Prioritization Inputs
```
Consider factors:
- Business value (revenue, users)
- User impact (how many affected)
- Technical risk (complexity)
- Dependencies (enables other features)
- Compliance (legal requirements)
- Competitive advantage
- Stakeholder requests
```

### Step 3: Score Each Requirement
```
Scoring matrix:
- Business Value: 1-5
- User Impact: 1-5
- Implementation Risk: 1-5 (inverted - lower is better)
- Dependency Score: +2 if enables others

Priority Score = (Value × 2) + (Impact × 2) - Risk + Dependency
```

### Step 4: Assign MoSCoW Category
```
Based on scores:
- Score > 15: MUST
- Score 10-15: SHOULD
- Score 5-10: COULD
- Score < 5: WON'T
```

### Step 5: Validate and Adjust
```
Validation checks:
- MUST items fit in MVP timeline
- Dependencies respected
- Stakeholder agreement
- Technical feasibility
- No must have > 40% of scope
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| requirements_spec | Markdown | Yes | All requirements |
| stakeholder_priorities | JSON | Optional | Business priorities |
| technical_assessment | JSON | Optional | Feasibility input |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| prioritized_requirements.md | Markdown | MoSCoW sorted list |
| mvp_scope.md | Markdown | Must-have items |
| priority_matrix.json | JSON | Detailed scoring |

## Project-Specific Considerations
- Authentication is always MUST (blocks other features)
- GDPR compliance is MUST (legal requirement)
- University search is MUST (core value prop)
- Advanced analytics is COULD/WON'T for MVP
- Dark mode is WON'T for initial release

## Integration Points
- **Orchestrator**: Priority queue input
- **BMAD PM**: Priority discussions
- **Ralph Wiggum**: Autonomous priority re-evaluation loops
- **Architecture Agent**: Dependency impact

## Examples
```
Prioritized Requirements - SDLC Framework

MUST HAVE (MVP Critical):
├─ REQ-001: User registration/authentication
├─ REQ-002: User profile management
├─ REQ-003: University search
├─ REQ-004: Application submission
├─ REQ-005: Document upload
├─ REQ-006: Application tracking
├─ REQ-010: GDPR consent management
├─ REQ-011: Data export (GDPR)
└─ REQ-012: Account deletion (GDPR)

SHOULD HAVE (High Value):
├─ REQ-007: University recommendations
├─ REQ-008: Application deadline reminders
├─ REQ-009: Email notifications
├─ REQ-015: Advisor portal
└─ REQ-016: Application analytics

COULD HAVE (Nice to Have):
├─ REQ-020: Social sharing
├─ REQ-021: Student testimonials
├─ REQ-022: Chat with advisors
└─ REQ-023: Mobile app push notifications

WON'T HAVE (Future):
├─ REQ-030: AI program matching
├─ REQ-031: Visa application tracking
├─ REQ-032: Housing marketplace
└─ REQ-033: Currency converter
```

## Validation
- All requirements prioritized
- MoSCoW categories balanced
- Dependencies don't conflict with priorities
- Stakeholder sign-off obtained
- MVP scope is achievable