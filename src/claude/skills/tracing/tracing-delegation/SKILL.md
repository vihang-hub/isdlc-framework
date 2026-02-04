---
name: tracing-delegation
description: Delegate bug tracing to parallel sub-agents
skill_id: TRACE-001
owner: tracing-orchestrator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: At start of Phase 00 Tracing
dependencies: []
---

# Tracing Delegation

## Purpose

Coordinate parallel execution of tracing sub-agents (T1, T2, T3) to analyze a bug report from multiple angles simultaneously.

## When to Use

- At the start of Phase 00 Tracing
- When a bug report/fix request is received

## Process

1. Parse bug report for symptoms and context
2. Extract reproduction steps if available
3. Launch T1 (Symptom Analyzer) in background
4. Launch T2 (Execution Path Tracer) in background
5. Launch T3 (Root Cause Identifier) in background
6. Wait for all three to complete

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| bug_report | String | Yes | Bug description or ticket |
| reproduction_steps | Array | No | Steps to reproduce |
| error_logs | String | No | Relevant error output |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| t1_task_id | String | Symptom Analyzer task ID |
| t2_task_id | String | Path Tracer task ID |
| t3_task_id | String | Root Cause task ID |
| delegation_status | String | started/complete |

## Sub-Agent Responsibilities

- **T1**: Symptom analysis, error parsing, pattern matching
- **T2**: Execution path tracing, data flow, state analysis
- **T3**: Root cause hypotheses, evidence correlation, fix suggestions

## Validation

- All three sub-agents launched
- Bug context properly distributed
