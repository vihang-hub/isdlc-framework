---
name: research-coordination
description: Coordinate parallel research agents for best practices discovery
skill_id: DISC-301
owner: constitution-generator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: When launching parallel research to gather best practices, compliance, performance, and testing standards
dependencies: [DISC-304]
---

# Research Coordination

## Purpose
Coordinate multiple parallel research agents to discover best practices across different quality dimensions. Aggregates findings from compliance, performance, testing, and general best practices research into a unified result set.

## When to Use
- After tech stack and domain detection are complete
- When gathering standards and best practices for constitution generation
- When research needs to span multiple quality dimensions simultaneously

## Prerequisites
- Tech stack detection has been completed
- Domain detection has identified applicable domains
- Project type and context are available

## Process

### Step 1: Initialize Research Agents
Launch four parallel research agents targeting distinct quality dimensions: best practices (coding standards, design patterns), compliance (regulatory and security requirements), performance (benchmarks, SLAs, optimization targets), and testing (coverage standards, testing strategies).

### Step 2: Collect and Merge Results
Wait for all research agents to return results. Apply a configurable timeout (default 30 seconds per agent). For any agent that times out, substitute cached default findings for the given tech stack and domain combination.

### Step 3: Deduplicate and Categorize
Merge results from all agents, remove duplicate findings, and categorize each finding by quality dimension. Resolve any conflicts between agents by preferring more specific findings over general ones.

### Step 4: Validate Coverage
Verify that findings cover all expected quality dimensions. Flag any gaps where no research findings were returned and no cached defaults are available.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| tech_stack | object | Yes | Detected technologies with versions |
| project_type | string | Yes | Type of project (web app, API, library, etc.) |
| domain_indicators | array | Yes | Detected business domain indicators |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| aggregated_findings | object | Research findings organized by quality dimension |
| coverage_report | object | Which dimensions have findings and which have gaps |
| agent_status | array | Status of each research agent (success, timeout, cached) |

## Integration Points
- **domain-detection**: Receives domain indicators to scope research appropriately
- **article-generation**: Passes aggregated findings for constitution article creation
- **constitution-generator**: Reports research status back to orchestrating agent

## Validation
- All four research dimensions have at least baseline findings
- No research agent failed without a cached fallback being applied
- Aggregated findings contain no duplicate entries
- Results are properly categorized by quality dimension
