---
name: test-quality-assessment
description: Assess test suite quality including flaky tests and test smells
skill_id: DISC-206
owner: test-evaluator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: During test evaluation to gauge the reliability of existing tests
dependencies: [DISC-201]
---

# Test Quality Assessment

## Purpose
Evaluate the quality and reliability of the existing test suite by detecting common test anti-patterns, flaky test indicators, and test smells. This ensures that existing tests are trustworthy before relying on them for development confidence.

## When to Use
- After test framework detection identifies where test files are located
- When assessing whether the existing test suite can be trusted
- When looking for test maintenance issues that reduce developer confidence

## Prerequisites
- Test framework detection (DISC-201) has located test files and frameworks
- Test source files are readable for pattern analysis
- Familiarity with common test anti-patterns for the detected language

## Process

### Step 1: Check Assertion Density
Analyze test files for assertion-to-test ratio. Flag test cases with zero assertions (tests that run but verify nothing). Check for test cases that only assert truthiness without meaningful validation. Calculate average assertions per test across the suite.

### Step 2: Detect Test Smells
Scan test files for common anti-patterns: hardcoded `sleep()` or `setTimeout()` calls indicating timing-dependent tests, shared mutable state between test cases, tests that depend on execution order, overly broad assertions (`toBeTruthy()` instead of specific value checks), tests that hit real external services without mocking.

### Step 3: Identify Flaky Test Indicators
Search for patterns associated with flaky tests: date/time dependent logic without mocking, race conditions from async operations without proper awaiting, file system operations without cleanup, port binding without availability checks, random data generation without seeding. Check CI/CD logs for retry configurations that suggest known flakiness.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| test_files | list | Yes | Paths to all test source files |
| framework_results | object | Yes | Output from test-framework-detection |
| cicd_config | object | No | CI/CD configuration for retry detection |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| quality_score | number | Overall test quality score from 0 to 100 |
| flaky_test_list | list | Tests identified as likely flaky with reasons |
| test_smell_catalog | list | Detected anti-patterns with file locations |
| assertion_metrics | object | Assertion density and distribution statistics |

## Integration Points
- **test-framework-detection**: Provides test file locations and framework context
- **test-report-generation**: Quality assessment feeds the final test report
- **gap-identification**: Low-quality tests may be functionally equivalent to gaps
- **deployment-topology-detection**: CI/CD config may reveal flaky test handling

## Validation
- Quality score uses a documented, repeatable scoring formula
- Each test smell entry includes the file path and line number
- Flaky test indicators are supported by specific code pattern evidence
- Assertion metrics distinguish between test files and test cases
