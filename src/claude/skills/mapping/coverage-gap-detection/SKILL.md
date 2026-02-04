---
name: coverage-gap-detection
description: Detect test coverage gaps in affected areas
skill_id: MAP-302
owner: risk-assessor
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: During M3 risk assessment
dependencies: []
---

# Coverage Gap Detection

## Purpose

Identify areas where test coverage is insufficient, creating risk for the proposed changes.

## When to Use

- During M3 risk assessment
- When evaluating testing risk

## Process

1. Analyze existing test files
2. Map tests to affected code
3. Identify untested paths
4. Check integration test coverage
5. Flag critical uncovered areas

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| affected_files | Array | Yes | Files from impact analysis |
| test_files | Array | Yes | Existing test files |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| coverage_gaps | Array | Files with insufficient tests |
| gap_severity | String | low/medium/high/critical |
| recommended_tests | Array | Tests to add before changes |

## Gap Categories

- **Unit gaps**: Missing unit tests for functions
- **Integration gaps**: Missing integration tests
- **Edge case gaps**: Untested boundary conditions
- **Error handling gaps**: Untested error paths

## Validation

- All affected files analyzed
- Gap severity matches risk level
