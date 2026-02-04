---
name: data-flow-analysis
description: Analyze how data flows through code to identify corruption or unexpected transformations
skill_id: TRACE-203
owner: execution-path-tracer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: During T2 execution path tracing for data-related bugs
dependencies: [TRACE-201]
---

# Data Flow Analysis

## Purpose

Analyze how data flows through the codebase, tracking transformations, mutations, and potential corruption points.

## When to Use

- During T2 execution path tracing
- When bugs involve incorrect data values
- When tracking where data gets corrupted

## Process

1. Identify data origin (source)
2. Track all assignments and mutations
3. Map transformations applied
4. Identify sink (where data is used)
5. Detect corruption points

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| variable_name | String | Yes | Data to track |
| source_location | String | Yes | Where data originates |
| sink_location | String | No | Where data is consumed |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| data_path | Array | Sequence of data locations |
| transformations | Array | Operations applied to data |
| mutation_points | Array | Where data was modified |
| corruption_point | JSON | Where data became invalid |

## Analysis Focus

- **Sources**: User input, API responses, database reads
- **Transformations**: Parsing, mapping, filtering
- **Mutations**: Direct modifications, side effects
- **Sinks**: Output, storage, API calls

## Validation

- Complete data path from source to sink
- All transformations documented
- Corruption point identified if applicable
