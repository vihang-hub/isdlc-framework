---
name: test-report-generation
description: Generate comprehensive test evaluation report
skill_id: DISC-204
owner: test-evaluator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: After all test evaluation sub-skills complete to compile the report
dependencies: [DISC-201, DISC-202, DISC-203]
---

# Test Report Generation

## Purpose
Compile the results from test framework detection, coverage analysis, and gap identification into a unified, human-readable test evaluation report section. This report becomes part of the overall discovery output.

## When to Use
- After all test evaluation sub-skills have completed their analysis
- When generating the test section of the discovery report
- When presenting test infrastructure findings to the user

## Prerequisites
- Test framework detection (DISC-201) results are available
- Coverage analysis (DISC-202) results are available
- Gap identification (DISC-203) results are available
- Critical path analysis and quality assessment results are available if applicable

## Process

### Step 1: Compile Framework Summary
Create a summary table of all detected test frameworks, their versions, configuration paths, and the test types they support. Note any missing framework categories (e.g., no e2e framework installed) and highlight the primary testing stack.

### Step 2: Build Coverage Overview
Synthesize coverage metrics into a clear overview showing overall coverage, per-type breakdown, and the highest and lowest covered modules. Include trend indicators if historical coverage data is available. Present metrics in both percentage and visual format.

### Step 3: Generate Recommendations
Based on gap identification, critical path analysis, and quality assessment, produce a prioritized list of recommendations. Group by urgency: immediate action (critical gaps), short-term (warning-level gaps), and long-term (infrastructure improvements). Include effort estimates where possible.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| framework_results | object | Yes | Output from test-framework-detection |
| coverage_results | object | Yes | Output from coverage-analysis |
| gap_results | object | Yes | Output from gap-identification |
| critical_path_results | object | No | Output from critical-path-analysis |
| quality_results | object | No | Output from test-quality-assessment |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| report_section | string | Markdown-formatted test evaluation report |
| executive_summary | string | Brief one-paragraph test health summary |
| recommendations | list | Prioritized testing improvement recommendations |
| health_score | number | Overall test health score from 0 to 100 |

## Integration Points
- **test-framework-detection**: Provides the framework inventory
- **coverage-analysis**: Provides quantitative coverage metrics
- **gap-identification**: Provides the gap list and severities
- **discover-orchestrator**: Report section is included in final discovery output
- **state-initialization**: Health score is persisted in state.json

## Validation
- Report section contains framework summary, coverage overview, and recommendations
- Executive summary is concise and accurately reflects the detailed findings
- Recommendations are prioritized and grouped by urgency
- Health score calculation is documented with contributing factors
