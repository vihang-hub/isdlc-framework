---
name: hypothesis-generation
description: Generate hypotheses for the root cause
skill_id: TRACE-301
owner: root-cause-identifier
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: At start of T3 root cause identification
dependencies: []
---

# Hypothesis Generation

## Purpose

Generate a ranked list of hypotheses for the root cause based on symptom analysis and execution path findings.

## When to Use

- At the start of T3 root cause identification
- Using inputs from T1 and T2

## Process

1. Review symptom patterns
2. Analyze execution path anomalies
3. Generate candidate hypotheses
4. Rank by likelihood
5. Identify evidence needed

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| symptom_report | JSON | Yes | From T1 symptom analyzer |
| execution_trace | JSON | Yes | From T2 path tracer |
| similar_bugs | Array | No | Past bugs with similar symptoms |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| hypotheses | Array | Ranked root cause hypotheses |
| evidence_needed | Array | What to check for each |
| investigation_order | Array | Order to investigate |

## Hypothesis Format

```json
{
  "id": "H1",
  "description": "Race condition in order processing",
  "likelihood": 0.7,
  "supporting_evidence": ["async timing", "intermittent"],
  "contradicting_evidence": [],
  "evidence_needed": ["Check for locks", "Review async flow"]
}
```

## Hypothesis Categories

- **Data issues**: Invalid input, corruption
- **Logic errors**: Wrong condition, missing case
- **Timing issues**: Race conditions, deadlocks
- **Resource issues**: Memory, connections
- **Configuration**: Wrong settings, environment

## Validation

- Multiple hypotheses generated
- Likelihood justified
- Evidence requirements clear
