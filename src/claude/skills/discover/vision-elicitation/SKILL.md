---
name: vision-elicitation
description: Guide users through interactive project vision definition
skill_id: DISC-701
owner: product-analyst
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: When starting a new project and the user needs to articulate their vision
dependencies: []
---

# Vision Elicitation

## Purpose
Guide the user through a structured, interactive conversation to define the project vision. Captures the core problem, target users, key features, constraints, and success criteria in a format that feeds into downstream product and architecture decisions.

## When to Use
- At the very start of a new project before any requirements or design work
- When a user has a project idea but has not yet formalized their vision
- When restarting discovery after a significant pivot in project direction

## Prerequisites
- User is available for interactive conversation
- Project has been identified as a new project (not an existing codebase)

## Process

### Step 1: Open-Ended Problem Exploration
Ask the user a broad opening question about what they want to build and why. Let them describe the problem in their own words without constraining the format. Listen for the core pain point, the intended audience, and the desired outcome.

### Step 2: Probe for Missing Dimensions
Systematically probe for dimensions the user did not mention in their initial description. Cover target user personas and their needs, expected scale and performance constraints, key differentiators from existing solutions, business model or monetization approach, timeline and resource constraints, and measurable success criteria.

### Step 3: Confirm Understanding with Summary
Present a structured summary of the captured vision back to the user. Include the problem statement, target users, core features, constraints, and success criteria. Ask the user to confirm accuracy or suggest corrections before proceeding.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| user_responses | interactive | Yes | Answers provided through conversational interaction |
| existing_context | object | No | Any prior context about the project from state or documents |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| vision_data | object | Structured vision with problem, users, features, constraints |
| problem_statement | string | Concise articulation of the core problem being solved |
| success_criteria | array | Measurable criteria for project success |

## Integration Points
- **solution-brainstorming**: Consumes vision data to generate solution approaches
- **prd-generation**: Uses vision data as the foundation for requirements
- **state-initialization**: Vision data is persisted to project state

## Validation
- Problem statement is clear, specific, and articulates the pain point
- At least one target user persona is identified with their needs
- Constraints and success criteria are captured in measurable terms
