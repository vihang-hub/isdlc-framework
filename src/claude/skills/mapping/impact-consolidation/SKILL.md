---
name: impact-consolidation
description: Consolidate sub-agent reports into unified impact-analysis.md
skill_id: MAP-002
owner: mapping-orchestrator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: After all mapping sub-agents complete
dependencies: [MAP-001]
---

# Impact Consolidation

## Purpose

Consolidate the report_section outputs from M1, M2, and M3 into a unified impact-analysis.md document.

## When to Use

- After all three mapping sub-agents have completed
- Before advancing to Phase 01 Requirements

## Prerequisites

- M1 (Impact Analyzer) completed with report_section
- M2 (Entry Point Finder) completed with report_section
- M3 (Risk Assessor) completed with report_section

## Process

1. Collect JSON responses from all three sub-agents
2. Extract report_section from each response
3. Extract summary metrics (blast_radius, risk_level, files_estimated)
4. Compose executive summary synthesizing all findings
5. Assemble full impact-analysis.md document
6. Write to docs/requirements/{artifact-folder}/impact-analysis.md

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| m1_response | JSON | Yes | Impact Analyzer response |
| m2_response | JSON | Yes | Entry Point Finder response |
| m3_response | JSON | Yes | Risk Assessor response |
| artifact_folder | String | Yes | Folder name for requirements artifacts |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| impact_analysis_path | String | Path to generated impact-analysis.md |
| blast_radius | String | low/medium/high classification |
| risk_level | String | low/medium/high classification |

## Integration Points

- **mapping-orchestrator**: Invokes this skill after sub-agents complete
- **01-requirements-analyst**: Reads the generated impact-analysis.md

## Validation

- Document contains all three report sections
- Executive summary accurately reflects findings
- Blast radius and risk level classified
- Metadata section complete
