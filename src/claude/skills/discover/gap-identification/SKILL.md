---
name: gap-identification
description: Identify missing test coverage and testing infrastructure gaps
skill_id: DISC-203
owner: test-evaluator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: During test evaluation to find areas needing additional testing
dependencies: [DISC-201, DISC-202]
---

# Gap Identification

## Purpose
Compare the existing test coverage against the source codebase to identify modules, features, and test types that are missing or inadequately covered. This produces an actionable list of testing gaps prioritized by severity.

## When to Use
- After test framework detection and coverage analysis have completed
- When building a prioritized list of testing improvements
- When assessing test completeness for the discovery report

## Prerequisites
- Test framework detection (DISC-201) has cataloged available test types
- Coverage analysis (DISC-202) has quantified current coverage levels
- Source file listing is available from directory scan results

## Process

### Step 1: Compare Source Files Against Test Files
Map each source file to its expected test file using naming conventions (`foo.ts` -> `foo.test.ts`, `bar.py` -> `test_bar.py`, `main.go` -> `main_test.go`). Identify source files with no corresponding test file. Calculate the ratio of tested to untested source files.

### Step 2: Identify Missing Test Types
Check which categories of tests exist in the project. Flag if unit tests exist but integration tests are missing. Flag if no end-to-end tests are present for a web application. Flag if API endpoint tests are absent for a backend service. Check for missing performance tests, security tests, and accessibility tests.

### Step 3: Classify and Prioritize Gaps
Assign severity to each identified gap: critical (core business logic untested, auth flows uncovered), warning (utility modules untested, missing integration tests), info (style/formatting tests absent, optional test types missing). Sort gaps by severity and provide remediation suggestions for each.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| source_files | list | Yes | All source code file paths |
| test_files | list | Yes | All test file paths |
| coverage_data | object | Yes | Output from coverage-analysis |
| framework_results | object | Yes | Output from test-framework-detection |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| gap_list | list | Identified gaps with severity and remediation |
| untested_files | list | Source files with no corresponding test file |
| missing_test_types | list | Test categories absent from the project |
| coverage_ratio | number | Percentage of source files with test coverage |

## Integration Points
- **coverage-analysis**: Provides quantitative coverage data for comparison
- **test-framework-detection**: Identifies what test types are possible with current tools
- **critical-path-analysis**: Shares data on untested high-risk paths
- **test-report-generation**: Gap list feeds the test evaluation report

## Validation
- Every source file was checked for a corresponding test file
- Gap severities are consistently assigned (critical/warning/info)
- Missing test types are relevant to the project type (no e2e flag for CLI tools)
- Remediation suggestions are specific and actionable
