---
name: root-cause-confirmation
description: Confirm the most likely root cause
skill_id: TRACE-303
owner: root-cause-identifier
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: During T3 root cause identification
dependencies: [TRACE-301, TRACE-302]
---

# Root Cause Confirmation

## Purpose

Confirm the most likely root cause from validated hypotheses through additional verification and analysis.

## When to Use

- During T3 root cause identification
- After evidence correlation

## Process

1. Select top hypothesis
2. Perform targeted code analysis
3. Check for confirming patterns
4. Rule out false positives
5. Declare root cause

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| validated_hypotheses | Array | Yes | From evidence correlation |
| confidence_scores | JSON | Yes | Hypothesis confidence |
| codebase_access | Boolean | Yes | Can read source code |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| root_cause | JSON | Confirmed root cause |
| confidence | String | low/medium/high |
| verification_steps | Array | How it was confirmed |
| alternative_causes | Array | Other possible causes |

## Root Cause Format

```json
{
  "summary": "Missing null check before accessing user.preferences",
  "location": "src/user/profile.ts:156",
  "code_snippet": "const theme = user.preferences.theme",
  "explanation": "When user has no preferences, accessing .theme throws TypeError",
  "confidence": "high",
  "verified_by": ["Stack trace points here", "Missing defensive check"]
}
```

## Confidence Levels

- **High**: Multiple confirming evidence, reproducible
- **Medium**: Some evidence, plausible mechanism
- **Low**: Hypothesis fits but unconfirmed

## Validation

- Root cause explains all symptoms
- Location identified in code
- Mechanism understood
