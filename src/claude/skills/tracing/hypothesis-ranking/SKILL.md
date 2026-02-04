---
name: hypothesis-ranking
description: Rank root cause hypotheses by likelihood based on evidence
skill_id: TRACE-302
owner: root-cause-identifier
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: During T3 root cause identification
dependencies: [TRACE-301]
---

# Hypothesis Ranking

## Purpose

Rank root cause hypotheses by likelihood based on available evidence, code patterns, and historical data.

## When to Use

- During T3 root cause identification
- When multiple hypotheses exist
- When prioritizing investigation order

## Process

1. Gather all hypotheses
2. Collect supporting evidence
3. Score each hypothesis
4. Apply Bayesian reasoning
5. Produce ranked list

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| hypotheses | Array | Yes | List of potential causes |
| evidence | Array | Yes | Supporting/refuting evidence |
| code_patterns | JSON | No | Historical bug patterns |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| ranked_hypotheses | Array | Hypotheses sorted by likelihood |
| confidence_scores | JSON | Score for each hypothesis |
| evidence_mapping | JSON | Evidence supporting each |
| investigation_order | Array | Recommended investigation order |

## Scoring Factors

- **Evidence strength**: Direct vs circumstantial
- **Pattern match**: Similar past bugs
- **Code complexity**: Error-prone areas
- **Recent changes**: Recency of modifications

## Validation

- All hypotheses scored
- Evidence mapped to hypotheses
- Clear investigation priority
