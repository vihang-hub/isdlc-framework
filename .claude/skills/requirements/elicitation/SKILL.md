---
name: requirements-elicitation
description: Extract requirements from stakeholders and project descriptions
skill_id: REQ-001
owner: requirements
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Project start, new feature requests, clarifying ambiguous needs
dependencies: []
---

# Requirements Elicitation

## Purpose
Systematically extract, clarify, and document requirements from stakeholders, project briefs, and domain analysis to establish a complete understanding of what the system must do.

## When to Use
- Project initiation
- New feature requests
- Stakeholder interviews
- Analyzing competitor products
- Domain exploration

## Prerequisites
- Access to stakeholders or project brief
- Understanding of project domain
- Elicitation techniques knowledge

## Process

### Step 1: Gather Initial Input
```
Collect from available sources:
- Project brief/description
- Stakeholder requests
- Existing documentation
- Competitor analysis
- Domain research
```

### Step 2: Apply Elicitation Techniques
```
Techniques to use:
1. Questioning: Who, What, When, Where, Why, How
2. Scenarios: Walk through user journeys
3. Personas: Define user types and goals
4. Constraints: Identify limitations
5. Edge cases: What if X happens?
```

### Step 3: Generate Clarifying Questions
```
For each vague or incomplete requirement:
- What is the expected behavior?
- Who is the primary user?
- What triggers this action?
- What is the success criteria?
- What happens in error cases?
- Are there constraints (time, data, access)?
```

### Step 4: Document Raw Requirements
```
For each requirement capture:
- Source (who requested)
- Description (what is needed)
- Rationale (why it's needed)
- Priority indication
- Related requirements
- Open questions
```

### Step 5: Validate Understanding
```
Confirm requirements by:
- Restating in different words
- Providing examples
- Identifying edge cases
- Checking against constraints
- Getting stakeholder confirmation
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| project_brief | String | Yes | Initial project description |
| stakeholder_input | String | Optional | Direct stakeholder requests |
| domain_context | String | Optional | Industry/domain information |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| raw_requirements.md | Markdown | Unstructured requirements |
| clarifying_questions.md | Markdown | Questions needing answers |
| personas.md | Markdown | User personas identified |
| domain_glossary.md | Markdown | Domain terms defined |

## Project-Specific Considerations
- User types: Prospective student, Current student, Advisor, Admin
- Journey stages: Discovery, Application, Preparation, Abroad, Return
- External integrations: Universities, visa services, housing
- Compliance: GDPR for EU students, FERPA for academic records
- Peak usage: Application deadlines, enrollment periods

## Integration Points
- **Orchestrator**: Receives project brief
- **Spec Kit**: /speckit.specify command integration
- **BMAD Analyst**: Elicitation patterns
- **Ralph Wiggum**: /ralph-loop for iterative elicitation until requirements complete

## Examples
```
Project Brief: "Build a study abroad application platform"

Elicitation Questions Generated:

Users:
- Q1: Who are the primary users? (Students, advisors, admins?)
- Q2: What student types? (Undergrad, grad, exchange?)
- Q3: Do advisors manage multiple students?

Features:
- Q4: What does "application" include? (Forms, documents, payments?)
- Q5: Is there a matching/recommendation system?
- Q6: How do students discover programs?

Integrations:
- Q7: Which university databases to integrate?
- Q8: Is visa status tracking needed?
- Q9: Housing search integration needed?

Constraints:
- Q10: What regions/countries supported?
- Q11: Mobile app or web only?
- Q12: Offline functionality needed?

Compliance:
- Q13: GDPR compliance required?
- Q14: Document retention policies?
- Q15: Data residency requirements?
```

## Validation
- All ambiguous terms clarified
- No TBD items in final requirements
- Stakeholder sign-off on understanding
- Domain terms defined in glossary
- User personas documented