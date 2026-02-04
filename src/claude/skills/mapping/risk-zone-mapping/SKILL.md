---
name: risk-zone-mapping
description: Map high-risk zones requiring careful attention
skill_id: MAP-304
owner: risk-assessor
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Final step of M3 risk assessment
dependencies: [MAP-301, MAP-302, MAP-303]
---

# Risk Zone Mapping

## Purpose

Consolidate risk factors into a comprehensive risk map highlighting zones requiring careful attention during implementation.

## When to Use

- Final step of M3 risk assessment
- To summarize risk assessment findings

## Process

1. Combine complexity scores
2. Overlay coverage gaps
3. Add technical debt hotspots
4. Calculate composite risk per area
5. Generate risk zone map

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| complexity_breakdown | JSON | Yes | From complexity scoring |
| coverage_gaps | Array | Yes | From gap detection |
| debt_items | Array | Yes | From debt identification |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| risk_zones | Array | Areas with risk levels |
| overall_risk | String | low/medium/high/critical |
| mitigation_suggestions | Array | How to reduce risk |
| recommended_approach | String | Strategy recommendation |

## Risk Zone Classifications

- **Green Zone**: Low risk, proceed normally
- **Yellow Zone**: Medium risk, add tests first
- **Orange Zone**: High risk, refactor before changes
- **Red Zone**: Critical risk, needs architectural review

## Validation

- All risk factors considered
- Zones map to concrete file areas
