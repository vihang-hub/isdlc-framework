---
name: diagnosis-summary
description: Generate diagnosis summary for fix phase
skill_id: TRACE-003
owner: tracing-orchestrator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Final step of Phase 00 Tracing
dependencies: [TRACE-002]
---

# Diagnosis Summary

## Purpose

Generate a concise diagnosis summary that feeds into the requirements and fix phases, ensuring the fix addresses the actual root cause.

## When to Use

- Final step of Phase 00 Tracing
- Before transitioning to Phase 01 Requirements

## Process

1. Extract key findings from trace analysis
2. Summarize root cause in plain language
3. List affected components
4. Define fix scope boundaries
5. Generate acceptance criteria for fix

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| trace_analysis | Markdown | Yes | Complete trace analysis |
| root_cause | String | Yes | Confirmed root cause |
| fix_recommendations | Array | Yes | Suggested approaches |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| diagnosis | JSON | Structured diagnosis |
| fix_scope | JSON | What to change and not change |
| acceptance_criteria | Array | When fix is complete |
| regression_risks | Array | What to test after fix |

## Diagnosis Structure

```json
{
  "root_cause": "Brief description",
  "affected_components": ["file1.ts", "file2.ts"],
  "fix_approach": "Recommended fix strategy",
  "scope_boundaries": {
    "in_scope": ["..."],
    "out_of_scope": ["..."]
  },
  "acceptance_criteria": ["..."],
  "regression_tests": ["..."]
}
```

## Validation

- Root cause clearly stated
- Fix scope defined
- Acceptance criteria measurable
