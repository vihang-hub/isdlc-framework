---
name: evidence-correlation
description: Correlate evidence to validate or eliminate hypotheses
skill_id: TRACE-302
owner: root-cause-identifier
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: During T3 root cause identification
dependencies: [TRACE-301]
---

# Evidence Correlation

## Purpose

Correlate available evidence with generated hypotheses to validate or eliminate potential root causes.

## When to Use

- During T3 root cause identification
- After hypotheses are generated

## Process

1. Gather evidence from all sources
2. Map evidence to hypotheses
3. Score supporting vs contradicting
4. Eliminate low-confidence hypotheses
5. Strengthen remaining candidates

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| hypotheses | Array | Yes | From hypothesis generation |
| symptom_evidence | JSON | Yes | From T1 |
| execution_evidence | JSON | Yes | From T2 |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| validated_hypotheses | Array | Hypotheses with strong support |
| eliminated_hypotheses | Array | Ruled out hypotheses |
| confidence_scores | JSON | Score per hypothesis |
| missing_evidence | Array | What would help confirm |

## Evidence Types

- **Direct**: Error message, stack trace
- **Circumstantial**: Timing, frequency
- **Historical**: Past similar bugs
- **Environmental**: Config, dependencies
- **Behavioral**: Reproduction patterns

## Correlation Matrix

| Hypothesis | Supporting | Contradicting | Confidence |
|------------|------------|---------------|------------|
| H1 | E1, E3 | E2 | 0.6 |
| H2 | E1, E2, E4 | - | 0.85 |

## Validation

- All evidence considered
- Contradictions addressed
- Confidence justified
