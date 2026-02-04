---
name: impact-consolidation
description: Consolidate results from parallel sub-agents into unified impact analysis report
skill_id: IA-002
owner: impact-analysis-orchestrator
collaborators: []
project: isdlc
version: 1.0.0
when_to_use: After sub-agents complete to merge results into final report
dependencies: [IA-001]
---

# Impact Consolidation

## Purpose
Collect and merge results from all three sub-agents (M1, M2, M3) into a comprehensive impact analysis report that provides unified insights for architecture planning.

## When to Use
- After all sub-agents have completed
- Merging parallel analysis results
- Creating unified impact-analysis.md
- Preparing Phase 03 inputs

## Prerequisites
- All sub-agents (M1, M2, M3) completed
- JSON responses received from each agent
- Requirements context available

## Process

### Step 1: Collect Results
```
1. Wait for all sub-agents to complete
2. Parse JSON response from each:
   - M1: Impact summary with blast radius
   - M2: Entry points with implementation order
   - M3: Risk assessment with recommendations
3. Handle any failed agents (retry or note gap)
```

### Step 2: Validate Responses
```
For each response:
1. Verify status is "success"
2. Verify report_section exists
3. Verify structured data matches schema
4. Log any validation errors
```

### Step 3: Merge Results
```
1. Create executive summary synthesizing all findings
2. Determine overall blast radius (from M1)
3. Determine overall risk level (from M3)
4. Merge entry points (from M2) with risk data (M3)
5. Combine implementation recommendations
```

### Step 4: Generate Report
```
Create impact-analysis.md with:
1. Scope comparison (Phase 00 vs Phase 01)
2. Executive summary
3. M1 Impact Analysis section
4. M2 Entry Points section
5. M3 Risk Assessment section
6. Consolidated recommendations
7. Metadata JSON block
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| m1_response | Object | Yes | Impact Analyzer results |
| m2_response | Object | Yes | Entry Point Finder results |
| m3_response | Object | Yes | Risk Assessor results |
| requirements_context | Object | Yes | Original requirements context |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| impact_analysis_md | String | Generated report content |
| consolidated_summary | Object | Merged summary data |
| state_update | Object | State.json updates |

## Validation
- All sub-agent results processed
- Report sections merged correctly
- Executive summary synthesizes all findings
- Recommendations consolidated and prioritized
