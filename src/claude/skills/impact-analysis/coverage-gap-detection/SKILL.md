---
name: coverage-gap-detection
description: Detect test coverage gaps in areas affected by each acceptance criterion
skill_id: IA-302
owner: risk-assessor
collaborators: []
project: isdlc
version: 1.0.0
when_to_use: During M3 Risk Assessment to find untested code
dependencies: []
---

# Coverage Gap Detection

## Purpose
Detect test coverage gaps in code areas affected by the feature, per acceptance criterion, to identify risky areas that should be tested before modification.

## When to Use
- Identifying untested affected code
- Planning test-first changes
- Assessing modification risk
- Prioritizing test writing

## Prerequisites
- Affected files identified (from M1)
- Test coverage data available
- Discovery report coverage section

## Process

### Step 1: Load Coverage Data
```
From discovery report or coverage tools:
1. Per-file coverage percentages
2. Per-function coverage if available
3. Branch coverage data
4. Uncovered lines listing
```

### Step 2: Map to Acceptance Criteria
```
For each AC:
1. Identify affected files
2. Get coverage for each file
3. Calculate weighted coverage for AC
4. Flag low-coverage areas
```

### Step 3: Classify Coverage Risk
```
| Coverage | Risk Level | Action |
|----------|------------|--------|
| < 30% | Critical | Must add tests first |
| 30-50% | High | Should add tests |
| 50-80% | Medium | Add tests for new code |
| > 80% | Low | Normal development |
```

### Step 4: Identify Gaps
```
For each AC, identify:
- Completely untested files
- Low-coverage functions
- Missing edge case tests
- Integration test gaps
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| affected_files | Array | Yes | Files to analyze |
| coverage_data | Object | Yes | Test coverage metrics |
| acceptance_criteria | Array | Yes | ACs for mapping |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| coverage_by_file | Object | Per-file coverage |
| coverage_by_ac | Object | Coverage per AC |
| gaps | Array | Identified coverage gaps |
| risk_areas | Array | High-risk low-coverage areas |

## Validation
- All affected files checked
- Coverage mapped to ACs
- Risk levels assigned
- Gaps clearly identified
