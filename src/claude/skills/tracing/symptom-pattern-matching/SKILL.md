---
name: symptom-pattern-matching
description: Match symptoms against known bug patterns
skill_id: TRACE-104
owner: symptom-analyzer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Final step of T1 symptom analysis
dependencies: [TRACE-101, TRACE-102, TRACE-103]
---

# Symptom Pattern Matching

## Purpose

Match the observed symptoms against known bug patterns to accelerate root cause identification.

## When to Use

- Final step of T1 symptom analysis
- To narrow down potential causes

## Process

1. Compile symptom fingerprint
2. Match against common patterns
3. Check for similar past bugs
4. Score pattern match confidence
5. Generate likely causes list

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| error_type | String | Yes | From error parsing |
| failure_point | JSON | Yes | From stack analysis |
| symptoms | Array | Yes | Observed behaviors |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| matched_patterns | Array | Known patterns that match |
| likely_causes | Array | Ranked possible causes |
| pattern_confidence | Number | 0-100 match confidence |
| investigation_hints | Array | Where to look next |

## Common Patterns

- **Null reference**: Missing data, async timing
- **Race condition**: Concurrent access, state mutations
- **Memory leak**: Unbounded growth, missing cleanup
- **Timeout**: Slow operations, deadlocks
- **Data corruption**: Invalid state, encoding issues

## Validation

- Patterns backed by evidence
- Confidence justified
- Investigation hints actionable
