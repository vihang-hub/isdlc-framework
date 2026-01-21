---
name: ambiguity-detection
description: Identify vague, incomplete, or conflicting requirements
skill_id: REQ-004
owner: requirements-analyst
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Requirements review, quality assurance, before sign-off
dependencies: [REQ-001, REQ-002]
---

# Ambiguity Detection

## Purpose
Identify vague, incomplete, contradictory, or untestable requirements before they cause downstream problems in design and implementation.

## When to Use
- Before requirements sign-off
- When reviewing new requirements
- During requirements quality review
- Before GATE-1 validation

## Prerequisites
- Requirements documented
- Ambiguity patterns known
- Domain glossary available

## Process

### Step 1: Check for Vague Terms
```
Flag these vague terms:
- "User-friendly"
- "Fast/Quick"
- "Easy to use"
- "Flexible"
- "Robust"
- "Scalable" (without numbers)
- "Secure" (without specifics)
- "Efficient"
- "Modern"
- "Intuitive"

Replace with measurable criteria.
```

### Step 2: Check for Incompleteness
```
Missing information flags:
- No error handling specified
- No boundary conditions
- No user role specified
- No data validation rules
- No success criteria
- "TBD" or "TODO" present
- Placeholder text
- Missing acceptance criteria
```

### Step 3: Check for Conflicts
```
Conflict types:
- Contradictory requirements
- Impossible combinations
- Conflicting priorities
- Inconsistent terminology
- Incompatible constraints
```

### Step 4: Check Testability
```
Testability issues:
- Can't verify if implemented
- No measurable outcome
- Subjective success criteria
- Missing Given-When-Then
```

### Step 5: Generate Ambiguity Report
```
For each issue found:
- Requirement ID
- Issue type (vague/incomplete/conflict/untestable)
- Specific problem
- Suggested resolution
- Clarifying question
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| requirements_spec | Markdown | Yes | All requirements |
| user_stories | JSON | Yes | User stories with AC |
| glossary | Markdown | Optional | Term definitions |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| ambiguity_report.md | Markdown | Issues found |
| clarifying_questions.md | Markdown | Questions for resolution |
| requirements_quality_score | Number | Quality percentage |

## Project-Specific Considerations
- "User" must specify which persona
- "Application" could mean platform or submission
- "Fast" must have specific latency targets
- GDPR terms must reference specific articles

## Integration Points
- **Spec Kit**: Quality check before proceeding
- **Orchestrator**: GATE-1 quality validation

## Examples
```
Ambiguity Report

ISSUE-001: Vague term
Requirement: REQ-012 "The system should be user-friendly"
Problem: "User-friendly" is subjective
Suggestion: Replace with specific usability criteria
Question: What specific usability metrics? (Task completion time, error rate, SUS score?)

ISSUE-002: Incomplete
Requirement: US-015 "User can upload documents"
Problem: Missing constraints
Questions:
- What file types allowed?
- What is max file size?
- What happens if upload fails?
- How many files per application?

ISSUE-003: Conflict
Requirements: REQ-020 and REQ-022
Conflict: REQ-020 says "email is optional"
         REQ-022 says "send email notifications"
Resolution: Clarify notification preferences

ISSUE-004: Untestable
Requirement: NFR-007 "System should be reliable"
Problem: No measurable criteria
Suggestion: Specify uptime SLA (e.g., 99.9%)

Quality Score: 78% (17 issues in 75 requirements)
```

## Validation
- All requirements scanned
- Issues have specific references
- Suggestions are actionable
- No false positives (valid requirements flagged)
- Quality score calculated