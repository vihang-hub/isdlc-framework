---
name: coverage-analysis
description: Analyze test coverage metrics by test type
skill_id: DISC-202
owner: test-evaluator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: During test evaluation to quantify existing test coverage
dependencies: [DISC-201]
---

# Coverage Analysis

## Purpose
Analyze existing test coverage data to produce quantitative metrics broken down by test type and module. This provides a clear picture of how well the codebase is tested and where coverage gaps exist.

## When to Use
- After test framework detection identifies available coverage tools
- When coverage reports exist from previous test runs
- When quantitative coverage data is needed for the discovery report

## Prerequisites
- Test framework detection (DISC-201) has identified coverage tools
- Coverage reports exist in the project (from prior test runs)
- Coverage report formats are parseable (lcov, cobertura, istanbul, coverage.py)

## Process

### Step 1: Locate Coverage Reports
Search for coverage output directories and files: `coverage/`, `htmlcov/`, `.coverage`, `lcov.info`, `coverage.xml`, `cobertura.xml`, `coverage/clover.xml`. Check CI/CD artifacts directories. Identify the format of each report found.

### Step 2: Parse Coverage Data
Read and parse each coverage report according to its format. Extract file-level coverage data including line coverage, branch coverage, and function coverage percentages. Handle LCOV, Cobertura XML, Istanbul JSON, and coverage.py formats.

### Step 3: Calculate Per-Type Breakdown
Categorize covered files by test type based on test file naming conventions and directory locations. Separate unit test coverage (`*.test.*`, `*.spec.*`, `test_*`), integration test coverage (`*.integration.*`, `__tests__/integration/`), and e2e test coverage (`e2e/`, `cypress/`). Compute aggregate metrics for each type and identify the lowest-coverage modules.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| coverage_report_paths | list | No | Known paths to coverage reports |
| project_root | string | Yes | Project root for searching coverage outputs |
| framework_results | object | Yes | Output from test-framework-detection |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| overall_coverage | number | Aggregate line coverage percentage |
| coverage_by_type | object | Coverage percentages for unit, integration, e2e |
| module_breakdown | list | Per-module coverage with file paths |
| low_coverage_modules | list | Modules below acceptable coverage thresholds |

## Integration Points
- **test-framework-detection**: Provides coverage tool information and paths
- **gap-identification**: Uses coverage data to identify untested areas
- **critical-path-analysis**: Coverage data highlights untested high-risk paths
- **test-report-generation**: Coverage metrics feed the test evaluation report

## Validation
- Coverage percentages are between 0 and 100
- At least one coverage report was found and parsed, or absence is documented
- Module breakdown covers all source files in the coverage report
- Low-coverage modules are identified with specific percentage values
