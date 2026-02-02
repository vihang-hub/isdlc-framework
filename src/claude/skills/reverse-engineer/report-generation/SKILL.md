---
name: report-generation
description: Generate comprehensive reverse engineering summary report
skill_id: RE-203
owner: artifact-integration
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Creating final summary of reverse engineering process
dependencies: [RE-201, RE-202]
---

# Report Generation

## Purpose
Generate a comprehensive summary report of the reverse engineering process, including statistics, coverage metrics, and recommendations for next steps.

## When to Use
- After traceability matrix generation (RE-202)
- As final step of R3 phase
- When documenting reverse engineering results

## Prerequisites
- Traceability matrix from RE-202
- Link records from RE-201
- AC and test summaries

## Process

### Step 1: Gather Metrics
```
Collect from previous phases:
- R1: Targets analyzed, AC generated, confidence breakdown
- R2: Tests generated, fixtures created, golden files
- R3: Links created, coverage percentage
```

### Step 2: Calculate Coverage
```
Coverage metrics:
- Code coverage: % of features with AC
- AC coverage: % of AC with tests
- Priority coverage: % by P0/P1/P2/P3
- Domain coverage: breakdown by domain
```

### Step 3: Generate Report Structure
```markdown
# Reverse Engineering Report

## Executive Summary
- Project analyzed
- Total features discovered
- AC generated
- Test coverage achieved

## Detailed Metrics
### By Phase
### By Domain
### By Priority

## Gaps and Recommendations
### Missing Coverage
### Low Confidence AC
### Suggested Next Steps

## Artifacts Generated
### AC Files
### Test Files
### Traceability Matrix
```

### Step 4: Add Recommendations
```
Based on metrics, recommend:
- High-risk areas needing review
- Low confidence AC requiring human input
- Domains with poor test coverage
- Priority areas for ATDD migration
```

### Step 5: Write Report File
```
Output: .isdlc/reverse-engineer-report.md
Format: Markdown with tables
Include: Links to all generated artifacts
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| traceability_matrix | File | Yes | From RE-202 |
| phase_summaries | Object | Yes | R1, R2, R3 results |
| project_info | Object | Yes | Project metadata |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| report_file | File | reverse-engineer-report.md |
| summary_json | Object | Machine-readable summary |

## Project-Specific Considerations
- Report format should match project documentation standards
- Include links to project-specific tooling
- Consider audience (developers, managers, auditors)
- Large projects may need executive summary + detailed appendix

## Integration Points
- **Traceability Matrix (RE-202)**: Provides core metrics
- **AC Feature Linking (RE-201)**: Provides coverage data
- **ATDD Bridge (R4)**: Uses report for migration planning
- **Product Analyst (D7)**: May review for product insights

## Validation
- All sections complete
- Metrics accurate
- Links valid
- Recommendations actionable
