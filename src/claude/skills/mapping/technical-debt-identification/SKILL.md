---
name: technical-debt-identification
description: Identify technical debt in affected areas
skill_id: MAP-303
owner: risk-assessor
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: During M3 risk assessment
dependencies: []
---

# Technical Debt Identification

## Purpose

Identify existing technical debt in affected areas that may complicate changes or should be addressed.

## When to Use

- During M3 risk assessment
- When planning change strategy

## Process

1. Scan for TODO/FIXME/HACK comments
2. Identify deprecated patterns
3. Check for code duplication
4. Find outdated dependencies
5. Assess debt severity

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| affected_files | Array | Yes | Files from impact analysis |
| codebase_patterns | JSON | Yes | From project discovery |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| debt_items | Array | Technical debt found |
| debt_severity | String | low/medium/high |
| pay_now | Array | Debt to address with changes |
| defer | Array | Debt to address later |

## Debt Categories

- **Code debt**: Poor patterns, duplication
- **Design debt**: Architectural issues
- **Documentation debt**: Missing/outdated docs
- **Test debt**: Missing or flaky tests
- **Dependency debt**: Outdated libraries

## Validation

- Debt items verified in code
- Severity justified by evidence
