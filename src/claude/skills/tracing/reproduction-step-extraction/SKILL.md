---
name: reproduction-step-extraction
description: Extract and validate reproduction steps from bug reports
skill_id: TRACE-103
owner: symptom-analyzer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: During T1 symptom analysis
dependencies: []
---

# Reproduction Step Extraction

## Purpose

Extract, structure, and validate reproduction steps from bug reports to ensure the bug can be consistently reproduced.

## When to Use

- During T1 symptom analysis
- When bug reports include steps to reproduce

## Process

1. Parse reproduction steps from report
2. Structure into discrete actions
3. Identify preconditions/setup
4. Determine expected vs actual behavior
5. Assess reproducibility confidence

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| bug_report | String | Yes | Full bug report text |
| user_context | JSON | No | User environment info |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| steps | Array | Ordered reproduction steps |
| preconditions | Array | Required setup/state |
| expected_behavior | String | What should happen |
| actual_behavior | String | What actually happens |
| reproducibility | String | always/sometimes/rarely/unknown |

## Step Structure

```json
{
  "number": 1,
  "action": "Navigate to /settings page",
  "input": null,
  "expected_state": "Settings page loads"
}
```

## Validation

- Steps are actionable
- Expected vs actual clearly defined
- Preconditions identifiable
