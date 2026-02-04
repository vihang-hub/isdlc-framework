---
name: complexity-scoring
description: Score complexity of changes based on code metrics
skill_id: MAP-301
owner: risk-assessor
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: During M3 risk assessment
dependencies: [MAP-104]
---

# Complexity Scoring

## Purpose

Analyze code complexity metrics to score the overall difficulty and risk of proposed changes.

## When to Use

- During M3 risk assessment
- When estimating implementation difficulty

## Process

1. Analyze cyclomatic complexity of affected areas
2. Check nesting depth and code paths
3. Evaluate cognitive complexity
4. Consider integration complexity
5. Generate composite complexity score

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| affected_files | Array | Yes | Files from impact analysis |
| propagation_levels | JSON | Yes | Change propagation data |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| complexity_score | Number | 1-10 composite score |
| complexity_breakdown | JSON | Scores by category |
| high_complexity_areas | Array | Files needing attention |

## Scoring Guide

- 1-3: Low complexity (straightforward changes)
- 4-6: Medium complexity (some refactoring needed)
- 7-10: High complexity (significant restructuring)

## Validation

- Score correlates with file count
- High-risk areas identified
