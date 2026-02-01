---
name: critical-path-analysis
description: Identify high-risk code paths lacking test coverage
skill_id: DISC-205
owner: test-evaluator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: During test evaluation to prioritize testing for high-risk areas
dependencies: [DISC-201, DISC-202]
---

# Critical Path Analysis

## Purpose
Identify code paths that handle sensitive or high-risk operations and assess whether they have adequate test coverage. This ensures that the most important functionality in the project is tested before less critical areas.

## When to Use
- After framework detection and coverage analysis provide baseline data
- When prioritizing which untested areas need attention first
- When assessing risk exposure from missing test coverage

## Prerequisites
- Test framework detection (DISC-201) has identified the testing stack
- Coverage analysis (DISC-202) has quantified module-level coverage
- Source code is accessible for pattern analysis

## Process

### Step 1: Identify Critical Code Patterns
Search source code for high-risk patterns: authentication and authorization logic (login, token validation, permission checks), payment processing (charge, refund, subscription), data mutations (database writes, bulk updates, deletions), PII handling (user data processing, encryption), and error/exception handlers that affect user experience.

### Step 2: Cross-Reference with Coverage Data
Map each identified critical path to its coverage data from the coverage analysis. Determine which critical files and functions have coverage below acceptable thresholds. Flag any critical paths with zero test coverage as highest priority.

### Step 3: Rank by Risk Level
Assign risk scores based on the combination of path criticality and coverage level. Authentication with no tests ranks highest. Payment processing with partial coverage ranks high. Utility error handlers with no tests rank medium. Produce a sorted list from highest to lowest risk with specific file paths and function names.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| source_code_paths | list | Yes | Directories containing source code |
| coverage_data | object | Yes | Output from coverage-analysis |
| feature_map | object | No | Known feature-to-file mappings if available |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| critical_paths | list | Identified critical code paths with risk ranking |
| uncovered_critical | list | Critical paths with zero or minimal coverage |
| risk_scores | list | Paths ranked by combined risk and coverage score |
| remediation_priority | list | Ordered list of what to test first |

## Integration Points
- **coverage-analysis**: Provides module-level coverage for cross-referencing
- **gap-identification**: Shares untested file data for overlap analysis
- **test-report-generation**: Critical path findings feed the final report
- **integration-point-mapping**: External integrations are often critical paths

## Validation
- At least authentication and data mutation patterns were searched for
- Risk scores use a consistent, documented scoring methodology
- Each critical path entry includes file path and function or line reference
- Remediation priority list is ordered by risk score descending
