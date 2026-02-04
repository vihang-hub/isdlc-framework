---
name: mapping-delegation
description: Delegate mapping tasks to parallel sub-agents (M1, M2, M3)
skill_id: MAP-001
owner: mapping-orchestrator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: At start of Phase 00 Mapping to launch parallel analysis
dependencies: []
---

# Mapping Delegation

## Purpose

Launch parallel sub-agents (Impact Analyzer, Entry Point Finder, Risk Assessor) with appropriate context for mapping analysis.

## When to Use

- At the start of Phase 00 Mapping in feature workflows
- After parsing the feature description and loading discovery context

## Prerequisites

- Feature description parsed into feature_context
- Discovery report available at docs/project-discovery-report.md
- Monorepo context resolved (if applicable)

## Process

1. Prepare delegation prompts for each sub-agent
2. Include feature_context JSON in each prompt
3. Include path to discovery report
4. Include monorepo context if applicable
5. Launch all three agents in parallel using Task tool
6. Wait for all agents to complete

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| feature_context | JSON | Yes | Parsed feature description with keywords |
| discovery_report_path | String | Yes | Path to project discovery report |
| monorepo_context | JSON | No | Project context for monorepo mode |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| agent_tasks | Array | Task IDs for the three launched agents |

## Integration Points

- **mapping-orchestrator**: Invokes this skill to launch sub-agents
- **impact-analyzer (M1)**: Receives delegation prompt
- **entry-point-finder (M2)**: Receives delegation prompt
- **risk-assessor (M3)**: Receives delegation prompt

## Validation

- All three Task tool calls made in single message (parallel)
- Each prompt includes feature_context and discovery path
- Monorepo context included when applicable
