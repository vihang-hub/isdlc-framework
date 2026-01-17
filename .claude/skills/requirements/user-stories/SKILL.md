---
name: user-story-writing
description: Create user stories with clear acceptance criteria
skill_id: REQ-002
owner: requirements
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Converting requirements to actionable stories, sprint planning input
dependencies: [REQ-001]
---

# User Story Writing

## Purpose
Transform elicited requirements into well-structured user stories following the standard format with clear acceptance criteria that can be implemented and tested.

## When to Use
- After requirements elicitation
- Converting features to backlog items
- Preparing for sprint planning
- Breaking down epics

## Prerequisites
- Requirements elicited and documented
- User personas defined
- Domain glossary available
- Acceptance criteria patterns known

## Process

### Step 1: Identify Story Scope
```
Determine story boundaries:
- One user goal per story
- INVEST criteria: Independent, Negotiable, 
  Valuable, Estimable, Small, Testable
- Can be completed in one sprint
```

### Step 2: Write Story Statement
```
Format:
As a [persona]
I want to [goal/action]
So that [benefit/value]

Example:
As a prospective study abroad student
I want to search universities by country and program
So that I can find programs matching my interests
```

### Step 3: Define Acceptance Criteria
```
Use Given-When-Then format:
Given [precondition/context]
When [action performed]
Then [expected outcome]

Include:
- Happy path scenarios
- Edge cases
- Error conditions
- Validation rules
```

### Step 4: Add Story Metadata
```
Complete story record:
- Story ID (e.g., US-001)
- Title (short description)
- Persona
- Priority (MoSCoW)
- Story points (effort)
- Dependencies
- Related requirements (REQ-xxx)
```

### Step 5: Review and Refine
```
Quality checklist:
- [ ] Persona is valid and defined
- [ ] Goal is clear and single-focused
- [ ] Benefit explains the "why"
- [ ] Acceptance criteria are testable
- [ ] No implementation details in story
- [ ] Size is appropriate (not epic)
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| requirements | Markdown | Yes | Elicited requirements |
| personas | Markdown | Yes | User persona definitions |
| priority_guidance | String | Optional | Stakeholder priorities |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| user_stories.json | JSON | Structured stories |
| user_stories.md | Markdown | Human-readable format |
| story_map.md | Markdown | Stories organized by journey |

## Project-Specific Considerations
- Map stories to user journey stages
- Include persona: student, advisor, admin
- Tag stories with external API dependencies
- Flag GDPR-relevant stories (user data)

## Integration Points
- **Spec Kit**: Story generation during /speckit.specify
- **Test Manager**: Stories become test case basis
- **BMAD PM**: Story refinement
- **Ralph Wiggum**: /ralph-loop for iterative story refinement until testable

## Examples
```
US-012: University Search

As a prospective study abroad student
I want to search universities by country, program type, and language
So that I can find programs that match my academic goals and preferences

Acceptance Criteria:

AC1: Search by country
Given I am on the university search page
When I select "France" from the country filter
Then I see only universities in France
And the result count updates to show French universities

AC2: Multiple filters
Given I am on the university search page
When I select country "Germany" AND program "Computer Science"
Then I see only German universities offering Computer Science

AC3: No results handling
Given I am on the university search page
When my filter combination returns no results
Then I see a "No programs found" message
And I see suggestions to broaden my search

AC4: Search performance
Given I am on the university search page
When I apply any filter combination
Then results load within 2 seconds

Metadata:
- ID: US-012
- Priority: Must Have
- Story Points: 5
- Journey Stage: Discovery
- External API: University Database API
- Related: REQ-007, REQ-008
```

## Validation
- All requirements have at least one story
- Every story has 3+ acceptance criteria
- All criteria are testable (Given-When-Then)
- No duplicate stories
- Stories traced to requirements