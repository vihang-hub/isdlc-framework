---
name: adr-writing
description: Document architecture decisions using ADR format
skill_id: ARCH-010
owner: solution-architect
collaborators: [developer, security]
project: sdlc-framework
version: 1.0.0
when_to_use: Major architecture decisions, technology choices, pattern selections
dependencies: []
---

# ADR Writing

## Purpose
Document significant architecture decisions in a consistent format that captures context, decision rationale, and consequences for future reference.

## When to Use
- Technology selection decisions
- Pattern choices
- Major trade-off decisions
- Breaking changes
- Deprecation decisions

## Prerequisites
- Decision context understood
- Options evaluated
- Stakeholder input gathered
- Consequences analyzed

## Process

### Step 1: Determine if ADR Needed
```
Write ADR when:
- Decision affects structure significantly
- Multiple valid alternatives exist
- Decision is hard to reverse
- Team disagreed on approach
- Decision involves trade-offs
```

### Step 2: Gather Context
```
Document:
- What prompted the decision
- Business/technical drivers
- Constraints that apply
- Prior decisions affecting this
```

### Step 3: Document Options
```
For each alternative:
- Description
- Pros and cons
- Why considered
- Why rejected (if not chosen)
```

### Step 4: Write ADR
```
ADR sections:
- Title and status
- Context
- Decision
- Consequences
- Alternatives considered
```

### Step 5: Review and Store
```
Process:
- Peer review for accuracy
- Stakeholder review if needed
- Store in docs/architecture/adrs/
- Number sequentially
- Update status as needed
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| decision_context | String | Yes | What's being decided |
| options | JSON | Yes | Alternatives considered |
| evaluation | Markdown | Yes | Analysis results |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| ADR-XXX.md | Markdown | Decision record |

## Project-Specific Considerations
- Reference GDPR compliance implications
- Note external API dependency impacts
- Consider multi-region implications

## Integration Points
- **All Agents**: Reference ADRs for context
- **Documentation Agent**: ADR maintenance

## Examples
```
# ADR-003: Use PostgreSQL for Primary Database

## Status
Accepted

## Date
2024-01-10

## Context
SDLC Framework needs a primary database for storing user data,
applications, and program information. We need ACID compliance
for transactional data, support for complex queries, and good
JSON capabilities for flexible program attributes.

## Decision
We will use PostgreSQL as our primary database.

## Consequences

### Positive
- Strong ACID compliance for financial/application data
- Excellent JSON/JSONB support for flexible schemas
- Mature ecosystem with good tooling
- Team has strong PostgreSQL experience
- Good managed options (RDS, Cloud SQL)
- Built-in full-text search for program search

### Negative
- Horizontal scaling more complex than NoSQL
- May need to add search engine later for advanced search
- Connection management requires pooling

### Risks
- Large table performance may need partitioning
- Read scaling requires replica management

## Alternatives Considered

### MySQL
- Similar relational capability
- Slightly less JSON support
- Team has less experience
- Rejected: PostgreSQL better fit for JSON needs

### MongoDB
- Native JSON document storage
- Easy horizontal scaling
- Less ACID guarantee
- Rejected: Need strong ACID for applications

### DynamoDB
- Serverless, auto-scaling
- Limited query flexibility
- Rejected: Query patterns too rigid

## Related
- Requires: None
- Enables: ADR-004 (ORM Selection)
- Related: REQ-003 (University search needs)
```

## Validation
- Context clearly explains the need
- Decision is unambiguous
- Consequences are realistic
- Alternatives were genuinely considered
- Format is consistent with other ADRs