---
name: domain-research
description: Research competitors, industry patterns, and best practices via web search to inform requirements
skill_id: REQ-011
owner: requirements-analyst
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Before proposing ANY changes to the system (backend or UI), when exploring a new domain, to provide informed suggestions
dependencies: []
---

# Domain Research

## Purpose
Conduct web-based research to understand the domain, analyze competitors, identify industry patterns, and gather best practices. This enables the Requirements Analyst to make informed suggestions rather than asking open-ended questions.

## When to Use

**CRITICAL**: Use this skill **before proposing ANY changes** to the system, whether backend or UI.

- Before proposing new features or functionality
- Before suggesting UI/UX patterns or designs
- Before recommending backend architecture or API designs
- At the start of a new project to understand the landscape
- Before proposing user journeys or workflows
- When the user mentions competitors or similar products
- To validate assumptions about industry standards
- To find UX patterns and anti-patterns in the domain

## Prerequisites
- Project brief or initial description from user
- Access to web search capability

## Process

### Step 1: Identify Research Targets
```
Based on project description, identify:
- Direct competitors (similar products)
- Adjacent products (related but different)
- Industry/domain keywords
- Target user segments
```

### Step 2: Competitor Analysis
```
For each competitor, research:
- Core features and functionality
- User experience patterns
- Pricing models (if relevant)
- Strengths and weaknesses (from reviews)
- What users love/hate about them
```

### Step 3: Industry Patterns
```
Search for:
- "[domain] best practices"
- "[domain] UX patterns"
- "[product type] common features"
- "[industry] software requirements"
- "[domain] user expectations"
```

### Step 4: UX Research
```
Look for:
- Common user journeys in this domain
- Onboarding patterns that work
- Navigation and information architecture
- Error handling approaches
- Accessibility considerations
```

### Step 5: Technical Standards
```
Research:
- Industry compliance requirements (GDPR, HIPAA, PCI, etc.)
- Performance benchmarks for this type of application
- Security standards and expectations
- Integration patterns (common APIs, services)
```

### Step 6: Synthesize Findings
```
Compile into actionable insights:
- "Competitors X, Y, Z all have [feature]"
- "Industry standard for [metric] is [value]"
- "Users commonly expect [pattern]"
- "Common pitfall to avoid: [anti-pattern]"
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| project_description | String | Yes | What the user wants to build |
| domain | String | Optional | Industry or domain (e.g., "fintech", "healthcare") |
| known_competitors | List | Optional | Competitors the user has mentioned |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| competitor_analysis | Markdown | Summary of competitor features and patterns |
| industry_standards | Markdown | Relevant compliance, performance, security standards |
| ux_patterns | Markdown | Common UX patterns in this domain |
| suggested_features | List | Features to consider based on research |
| anti_patterns | List | Common mistakes to avoid |

## Research Query Templates

### Competitor Discovery
- "[product type] alternatives"
- "best [product type] software [year]"
- "[product type] comparison"

### Feature Research
- "[competitor name] features"
- "what does [competitor] do"
- "[product type] must-have features"

### UX Patterns
- "[product type] user experience"
- "[domain] app design patterns"
- "[action] UX best practices" (e.g., "checkout UX best practices")

### Technical Standards
- "[domain] compliance requirements"
- "[product type] security best practices"
- "[domain] API standards"

### User Expectations
- "[competitor] reviews"
- "why users love [competitor]"
- "[product type] user complaints"

## Example Usage

**Project**: "Build a task management app for remote teams"

**Research conducted**:
1. Competitors: Asana, Trello, Monday.com, Notion, Linear
2. Features: task boards, assignments, due dates, comments, integrations
3. UX patterns: drag-and-drop, keyboard shortcuts, real-time sync
4. Standards: SOC2 for enterprise, GDPR for EU users
5. User pain points: too complex (Asana), too simple (Trello)

**Synthesized insight**:
"Based on research, remote team task managers typically include:
- Kanban boards with drag-and-drop (all competitors)
- Real-time collaboration (user expectation)
- Slack/Calendar integrations (common request)
- Linear is gaining popularity for its speed and simplicity

Users often complain about feature bloat. Linear's success suggests
a focused, fast experience resonates with technical teams."

## Integration Points
- **WebSearch tool**: Primary research mechanism
- **WebFetch tool**: For detailed page analysis when needed
- **Requirements Elicitation**: Research informs elicitation
- **User Story Writing**: Research provides context for stories

## Validation
- Research findings are cited when presenting drafts
- User can ask for more research on specific topics
- Findings are captured in `research-notes.md` artifact
