---
name: solution-brainstorming
description: Explore and compare solution approaches for new projects
skill_id: DISC-702
owner: product-analyst
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: When evaluating different technical or product approaches for a new project
dependencies: [DISC-701]
---

# Solution Brainstorming

## Purpose
Analyze the project vision and constraints to generate multiple viable solution approaches. Present each approach with its trade-offs so the user can make an informed decision about the direction before detailed requirements are written.

## When to Use
- After vision elicitation when the user needs to choose a solution direction
- When there are multiple valid ways to solve the stated problem
- When the user wants to understand trade-offs before committing to an approach

## Prerequisites
- Vision data from vision-elicitation (DISC-701) including problem, users, and constraints
- User is available to review and select from presented options

## Process

### Step 1: Analyze Problem and Constraints
Review the captured vision data to understand the core problem, target users, scale requirements, timeline constraints, and any technical preferences. Identify the key decision dimensions that will differentiate solution approaches — such as build vs buy, monolith vs distributed, real-time vs batch.

### Step 2: Generate Solution Approaches
Develop 2-3 distinct solution approaches, each representing a meaningfully different direction. For each approach, describe the high-level technical strategy, the core components involved, the primary advantages, the notable trade-offs or risks, and the relative complexity and timeline implications.

### Step 3: Present Options and Capture Decision
Present all approaches to the user in a structured comparison format. Highlight which approach best fits their stated constraints. Facilitate discussion and answer questions. Capture the user's selected approach along with their rationale for choosing it.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| vision_data | object | Yes | Structured vision from DISC-701 |
| tech_preferences | object | No | Any technology preferences or constraints from the user |
| market_research | object | No | Competitive or market context if available |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| approaches | array | 2-3 solution approaches with pros, cons, and complexity |
| selected_approach | object | The user's chosen approach with rationale |
| decision_rationale | string | Why this approach was selected over alternatives |

## Integration Points
- **vision-elicitation**: Provides the vision data that drives approach generation
- **prd-generation**: Uses the selected approach to shape functional requirements
- **architecture-pattern-selection**: Selected approach informs architecture decisions

## Validation
- At least 2 meaningfully different approaches are presented
- Each approach includes concrete advantages and trade-offs
- The selected approach and rationale are clearly documented
