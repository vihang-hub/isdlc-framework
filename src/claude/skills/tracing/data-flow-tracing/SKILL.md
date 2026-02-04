---
name: data-flow-tracing
description: Trace data flow through the execution path
skill_id: TRACE-202
owner: execution-path-tracer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: During T2 execution path tracing
dependencies: [TRACE-201]
---

# Data Flow Tracing

## Purpose

Trace how data flows through the execution path, identifying transformations, validations, and potential corruption points.

## When to Use

- During T2 execution path tracing
- When bug may involve data issues

## Process

1. Identify data inputs
2. Trace transformations along call chain
3. Find validation points
4. Identify mutation locations
5. Map data to failure point

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| call_chain | Array | Yes | From call chain reconstruction |
| suspect_data | JSON | No | Data suspected in bug |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| data_flow | Array | Data transformation steps |
| mutation_points | Array | Where data is modified |
| validation_points | Array | Where data is checked |
| corruption_candidates | Array | Potential corruption spots |

## Data Flow Entry Format

```json
{
  "step": 1,
  "location": "src/api/handler.ts:23",
  "data_in": "request.body",
  "transformation": "JSON.parse",
  "data_out": "parsedBody",
  "validation": false
}
```

## Validation

- Data traced from input to failure
- Transformations documented
- Mutation points identified
