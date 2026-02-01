---
name: prd-generation
description: Generate structured Product Requirements Document from project brief
skill_id: DISC-703
owner: product-analyst
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: When formalizing project requirements into a comprehensive PRD document
dependencies: [DISC-701, DISC-702]
---

# PRD Generation

## Purpose
Transform the project vision, selected solution approach, and research findings into a comprehensive Product Requirements Document. Produces a structured PRD with functional requirements, non-functional requirements, data requirements, and integration requirements.

## When to Use
- After vision elicitation and solution brainstorming to formalize requirements
- When the team needs a shared reference document for what will be built
- Before architecture design to ensure all requirements are captured and prioritized

## Prerequisites
- Vision data from vision-elicitation (DISC-701)
- Selected approach from solution-brainstorming (DISC-702)
- Tech stack selection completed if available

## Process

### Step 1: Expand Core Features into Functional Requirements
Take each core feature identified in the vision and decompose it into specific functional requirements. Each requirement gets a unique identifier, a clear description, and testable acceptance criteria. Group requirements by feature area or user story.

### Step 2: Generate Non-Functional Requirements
Derive NFRs from the project constraints, scale expectations, and research findings. Cover performance targets (response times, throughput), security requirements (authentication, authorization, data protection), reliability targets (uptime, recovery), and usability standards. Assign measurable thresholds where possible.

### Step 3: Define Data and Integration Requirements
Identify the data entities the system must manage, their lifecycle, and any data retention or compliance needs. Document required integrations with external systems, third-party APIs, and data sources. Specify integration protocols and data formats.

### Step 4: Compile PRD Document
Assemble all requirements into the standard PRD format at `docs/requirements/prd.md`. Include an executive summary, user personas, functional requirements grouped by feature, NFRs, data requirements, integration requirements, and a glossary of domain terms.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| vision_data | object | Yes | Structured vision from DISC-701 |
| selected_approach | object | Yes | Chosen solution approach from DISC-702 |
| tech_stack | object | No | Selected technology stack if available |
| research_findings | object | No | Market or technical research results |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| prd_document | file | docs/requirements/prd.md with complete PRD |
| functional_requirements | array | List of functional requirements with acceptance criteria |
| nfr_list | array | Non-functional requirements with measurable thresholds |

## Integration Points
- **vision-elicitation**: Provides the core vision and problem statement
- **solution-brainstorming**: Provides the selected approach that shapes requirements
- **mvp-scoping**: Consumes functional requirements to define MVP boundaries
- **architecture-pattern-selection**: Uses NFRs to drive architecture decisions

## Validation
- Every core feature from the vision has corresponding functional requirements
- Each functional requirement has at least one testable acceptance criterion
- NFRs include measurable thresholds rather than vague qualitative statements
- PRD document is written to docs/requirements/prd.md in the standard format
