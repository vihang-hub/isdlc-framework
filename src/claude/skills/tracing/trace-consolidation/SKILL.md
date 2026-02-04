---
name: trace-consolidation
description: Consolidate tracing results from sub-agents
skill_id: TRACE-002
owner: tracing-orchestrator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: After tracing sub-agents complete
dependencies: [TRACE-001]
---

# Trace Consolidation

## Purpose

Consolidate the outputs from T1 (Symptom Analyzer), T2 (Execution Path Tracer), and T3 (Root Cause Identifier) into a unified trace analysis document.

## When to Use

- After all tracing sub-agents complete
- To produce the trace-analysis.md artifact

## Process

1. Collect T1 symptom report section
2. Collect T2 execution trace section
3. Collect T3 root cause section
4. Merge into trace-analysis.md
5. Resolve conflicting hypotheses
6. Generate executive summary

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| t1_report | JSON | Yes | Symptom analysis output |
| t2_report | JSON | Yes | Execution trace output |
| t3_report | JSON | Yes | Root cause output |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| trace_analysis | Markdown | Complete trace-analysis.md |
| root_cause | String | Confirmed root cause |
| confidence | String | low/medium/high |
| fix_recommendations | Array | Suggested fixes |

## Output Document Structure

```markdown
# Trace Analysis: [Bug Title]

## Executive Summary
## Symptom Analysis (from T1)
## Execution Trace (from T2)
## Root Cause Analysis (from T3)
## Recommended Fix Approach
## Files to Modify
```

## Validation

- All sections present
- Root cause identified
- Fix recommendations provided
