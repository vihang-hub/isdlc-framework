# Non-Functional Requirement Template

**ID**: NFR-{number}
**Title**: {brief descriptive title}

## Classification

| Attribute | Value |
|-----------|-------|
| Category | {Performance \| Security \| Scalability \| Availability \| Compliance \| Usability \| Maintainability} |
| Priority | {Must \| Should \| Could} |
| Source | {Stakeholder name or document} |

## Requirement

### Description
{Detailed description of the non-functional requirement}

### Metric
{Quantifiable target - be specific}

Examples:
- Response time < 200ms for 95th percentile
- System uptime >= 99.9%
- Support 10,000 concurrent users
- Page load time < 3 seconds on 3G

### Measurement Method
{How this requirement will be verified}

- Tool/method used
- Test conditions
- Frequency of measurement

## Rationale

### Business Justification
{Why this requirement matters to the business}

### Impact if Not Met
{Consequences of failing to meet this requirement}

## Constraints

### Technical Constraints
- {constraint 1}
- {constraint 2}

### Resource Constraints
- {constraint 1}
- {constraint 2}

## Dependencies

| Type | IDs |
|------|-----|
| Related Requirements | REQ-{id}, NFR-{id} |
| Architectural Decisions | ADR-{id} |
| Test Cases | TC-{id} |

## Acceptance Criteria

- [ ] {Specific, measurable criterion 1}
- [ ] {Specific, measurable criterion 2}
- [ ] {Specific, measurable criterion 3}

## Notes

{Additional context, assumptions, or considerations}
