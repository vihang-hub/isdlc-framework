---
name: risk-zone-mapping
description: Map high-risk zones by combining complexity, coverage, and debt analysis
skill_id: IA-304
owner: risk-assessor
collaborators: []
project: isdlc
version: 1.0.0
when_to_use: During M3 Risk Assessment to identify areas needing extra attention
dependencies: [IA-301, IA-302, IA-303]
---

# Risk Zone Mapping

## Purpose
Combine complexity scores, coverage gaps, and technical debt data to create a unified risk map that identifies areas needing extra attention per acceptance criterion.

## When to Use
- Synthesizing risk analysis results
- Creating unified risk view
- Prioritizing risk mitigation
- Planning implementation approach

## Prerequisites
- Complexity scores available (IA-301)
- Coverage gaps identified (IA-302)
- Technical debt mapped (IA-303)

## Process

### Step 1: Calculate Combined Risk Score
```
For each affected file/module:
Risk Score = Complexity (0-3) + Coverage Risk (0-3) + Debt (0-3)

Scoring:
- Complexity: low=0, medium=1, high=2, critical=3
- Coverage: >80%=0, 50-80%=1, 30-50%=2, <30%=3
- Debt: 0=0, 1-2=1, 3-5=2, >5=3
```

### Step 2: Classify Risk Zones
```
| Score | Zone | Action |
|-------|------|--------|
| 0-2 | Low | Normal development |
| 3-4 | Medium | Extra testing recommended |
| 5-6 | High | Add tests before modifying |
| 7+ | Critical | Address risks first |
```

### Step 3: Map to Acceptance Criteria
```
For each AC:
1. Identify risk zones in affected areas
2. Calculate aggregate risk for AC
3. Flag blocking risks
4. Note areas needing attention
```

### Step 4: Generate Recommendations
```
Per AC, recommend:
1. Add tests (for high coverage risk)
2. Refactor first (for high complexity)
3. Address debt (for blocking debt)
4. Extra review (for critical zones)
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| complexity_scores | Object | Yes | From IA-301 |
| coverage_gaps | Object | Yes | From IA-302 |
| debt_data | Object | Yes | From IA-303 |
| acceptance_criteria | Array | Yes | ACs for mapping |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| risk_scores | Object | Per-file/module risk scores |
| risk_zones | Object | Classified risk zones |
| risk_by_ac | Object | Risk assessment per AC |
| recommendations | Array | Prioritized recommendations |
| overall_risk | String | low/medium/high/critical |

## Validation
- All factors combined correctly
- Risk zones clearly classified
- AC mapping complete
- Recommendations prioritized
- Overall risk determined
