---
name: stack-trace-analysis
description: Analyze stack traces to identify failure points
skill_id: TRACE-102
owner: symptom-analyzer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: During T1 symptom analysis
dependencies: [TRACE-101]
---

# Stack Trace Analysis

## Purpose

Analyze stack traces to identify the failure point, call chain, and relevant code locations for investigation.

## When to Use

- During T1 symptom analysis
- When stack traces are available

## Process

1. Parse stack trace frames
2. Filter to project-relevant frames
3. Identify top-of-stack failure point
4. Extract call chain leading to error
5. Map to source code locations

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| stack_trace | String | Yes | Raw stack trace |
| project_paths | Array | No | Paths to filter for |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| failure_point | JSON | File, function, line of crash |
| call_chain | Array | Sequence of calls to failure |
| relevant_frames | Array | Project-specific frames |
| external_frames | Array | Library/framework frames |

## Analysis Focus

- **Failure point**: Where the error was thrown
- **Trigger point**: What initiated the problematic path
- **Boundary crossings**: Where project meets external code
- **Async boundaries**: Promise chains, callbacks, events

## Validation

- Failure point identified
- Call chain extracted
- Source files exist in codebase
