---
name: requirements-classification
description: Categorize requirements as functional, non-functional, or constraints
skill_id: REQ-003
owner: requirements-analyst
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Organizing requirements, separating concerns, architecture input
dependencies: [REQ-001]
---

# Requirements Classification

## Purpose
Categorize requirements into functional (what system does), non-functional (how system performs), and constraints (limitations) to ensure complete coverage and proper handling by different agents.

## When to Use
- After requirements elicitation
- Organizing requirement documents
- Preparing architecture input
- Identifying NFR gaps

## Prerequisites
- Raw requirements available
- Classification categories defined
- Domain understanding

## Process

### Step 1: Identify Functional Requirements
```
Functional requirements describe WHAT the system does:
- Features and capabilities
- User interactions
- Data processing
- Business rules
- Integrations

Pattern: "The system shall [do something]"
```

### Step 2: Identify Non-Functional Requirements
```
NFR categories:
- Performance: Response time, throughput
- Scalability: User capacity, data volume
- Security: Authentication, authorization, encryption
- Reliability: Uptime, fault tolerance
- Usability: Accessibility, ease of use
- Maintainability: Code quality, documentation
- Portability: Platform support

Pattern: "The system shall [do something] within [constraint]"
```

### Step 3: Identify Constraints
```
Constraint types:
- Technical: Technology stack, platforms
- Business: Budget, timeline, regulations
- Legal: Compliance (GDPR, FERPA)
- Operational: Hosting, support hours
- Integration: API limitations, data formats

Pattern: "The system must/must not [constraint]"
```

### Step 4: Tag and Organize
```
For each requirement:
1. Assign category: FR/NFR/CON
2. Assign subcategory
3. Link related requirements
4. Identify stakeholder/owner
5. Note dependencies
```

### Step 5: Validate Coverage
```
Check completeness:
- All FR have corresponding NFR (performance)
- Security NFR exist for sensitive FR
- Constraints don't contradict FR
- NFR are measurable (not vague)
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| raw_requirements | Markdown | Yes | Unclassified requirements |
| domain_context | String | Optional | Industry standards |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| functional_requirements.md | Markdown | FR list |
| nfr_matrix.md | Markdown | NFR with metrics |
| constraints.md | Markdown | System constraints |
| requirements_spec.md | Markdown | Complete organized spec |

## Project-Specific Considerations
- GDPR is a constraint affecting many FRs
- Performance NFRs critical during application deadlines
- External API limitations are constraints
- Accessibility (WCAG) is NFR requirement

## Integration Points
- **Architecture Agent**: NFRs drive architecture decisions
- **Security Agent**: Security NFRs coordination
- **Test Manager**: NFRs become test scenarios

## Examples
```
Classified Requirements:

FUNCTIONAL (FR):
- FR-001: User registration with email/OAuth2
- FR-002: University search with filters
- FR-003: Application form submission
- FR-004: Document upload and storage
- FR-005: Application status tracking

NON-FUNCTIONAL (NFR):
- NFR-001 [Performance]: Page load < 3 seconds
- NFR-002 [Performance]: Search results < 2 seconds
- NFR-003 [Scalability]: Support 10,000 concurrent users
- NFR-004 [Security]: All data encrypted at rest
- NFR-005 [Availability]: 99.5% uptime SLA
- NFR-006 [Accessibility]: WCAG 2.1 AA compliance

CONSTRAINTS (CON):
- CON-001 [Legal]: GDPR compliance required
- CON-002 [Technical]: Must use PostgreSQL database
- CON-003 [Integration]: University API rate limit: 100/min
- CON-004 [Timeline]: MVP by Q2 2024
- CON-005 [Platform]: Web-first, mobile responsive
```

## Validation
- All requirements classified
- NFRs have measurable metrics
- Constraints are specific
- No orphan requirements
- Categories don't overlap