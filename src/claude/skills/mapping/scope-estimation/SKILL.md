---
name: scope-estimation
description: Estimate overall scope from mapping analysis results
skill_id: MAP-003
owner: mapping-orchestrator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: After consolidation to provide scope summary
dependencies: [MAP-002]
---

# Scope Estimation

## Purpose

Estimate the overall scope of the feature based on mapping analysis, providing metrics for planning.

## When to Use

- After impact consolidation
- To provide scope summary before advancing to Phase 01

## Prerequisites

- Impact analysis consolidated
- All sub-agent metrics available

## Process

1. Aggregate file and module counts from M1
2. Count entry points from M2 (existing and new)
3. Factor in risk scores from M3
4. Calculate overall scope estimate
5. Classify as small/medium/large

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| impact_summary | JSON | Yes | From M1 response |
| entry_points | JSON | Yes | From M2 response |
| risk_assessment | JSON | Yes | From M3 response |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| scope_estimate | String | small/medium/large |
| metrics | JSON | Aggregated scope metrics |

## Scope Classification

| Files | Entry Points | Risk | Scope |
|-------|--------------|------|-------|
| 1-5 | 1-2 | Low | Small |
| 6-15 | 2-4 | Medium | Medium |
| 16+ | 4+ | High | Large |

## Integration Points

- **mapping-orchestrator**: Uses for summary display
- **01-requirements-analyst**: May reference for effort estimation

## Validation

- Scope classification matches metrics
- All input metrics considered
