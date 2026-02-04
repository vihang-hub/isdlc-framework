---
name: fix-suggestion
description: Suggest potential fixes based on root cause analysis
skill_id: TRACE-304
owner: root-cause-identifier
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: During T3 root cause identification after cause is confirmed
dependencies: [TRACE-303]
---

# Fix Suggestion

## Purpose

Suggest potential fixes based on the confirmed root cause, providing actionable recommendations with trade-offs.

## When to Use

- During T3 root cause identification
- After root cause has been confirmed
- When providing remediation guidance

## Process

1. Analyze confirmed root cause
2. Identify fix patterns for cause type
3. Generate fix alternatives
4. Assess trade-offs and risks
5. Recommend primary fix

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| root_cause | JSON | Yes | Confirmed root cause |
| affected_code | Array | Yes | Code locations to fix |
| constraints | JSON | No | Project constraints |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| primary_fix | JSON | Recommended fix with rationale |
| alternatives | Array | Other viable fixes |
| trade_offs | JSON | Pros/cons of each approach |
| risk_assessment | JSON | Risks of each fix |

## Fix Categories

- **Code fix**: Direct code changes
- **Configuration fix**: Config/environment changes
- **Data fix**: Data migration or cleanup
- **Architecture fix**: Structural changes

## Validation

- Fix addresses confirmed root cause
- Trade-offs clearly documented
- Risk assessment provided
