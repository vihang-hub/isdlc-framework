---
name: fix-recommendation
description: Recommend fixes based on confirmed root cause
skill_id: TRACE-304
owner: root-cause-identifier
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Final step of T3 root cause identification
dependencies: [TRACE-303]
---

# Fix Recommendation

## Purpose

Generate recommended fixes based on the confirmed root cause, considering multiple approaches and their trade-offs.

## When to Use

- Final step of T3 root cause identification
- After root cause is confirmed

## Process

1. Analyze root cause nature
2. Generate fix alternatives
3. Evaluate each approach
4. Recommend primary fix
5. Document trade-offs

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| root_cause | JSON | Yes | Confirmed root cause |
| affected_code | Array | Yes | Files/functions affected |
| constraints | JSON | No | Time, risk constraints |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| recommended_fix | JSON | Primary fix recommendation |
| alternatives | Array | Other fix approaches |
| files_to_modify | Array | Files that need changes |
| risk_assessment | String | Fix risk level |
| test_requirements | Array | Tests to add/update |

## Fix Recommendation Format

```json
{
  "approach": "Add null check with default value",
  "changes": [
    {
      "file": "src/user/profile.ts",
      "line": 156,
      "current": "const theme = user.preferences.theme",
      "proposed": "const theme = user.preferences?.theme ?? 'default'"
    }
  ],
  "rationale": "Defensive coding prevents null reference",
  "risk": "low",
  "side_effects": "None expected",
  "test_coverage": ["Add test for null preferences"]
}
```

## Fix Categories

- **Defensive**: Add guards, validation
- **Corrective**: Fix logic error
- **Refactoring**: Restructure for correctness
- **Configuration**: Environment/settings fix
- **Data**: Fix data or migration

## Validation

- Fix addresses root cause
- Side effects considered
- Tests identified
