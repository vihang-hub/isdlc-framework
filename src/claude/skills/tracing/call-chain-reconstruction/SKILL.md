---
name: call-chain-reconstruction
description: Reconstruct the call chain leading to the bug
skill_id: TRACE-201
owner: execution-path-tracer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: At start of T2 execution path tracing
dependencies: []
---

# Call Chain Reconstruction

## Purpose

Reconstruct the complete call chain from entry point to failure point, identifying all functions and methods involved.

## When to Use

- At the start of T2 execution path tracing
- When tracing how execution reached the failure

## Process

1. Start from failure point
2. Work backwards through callers
3. Identify entry point
4. Map intermediate functions
5. Document call chain

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| failure_point | JSON | Yes | From symptom analysis |
| entry_points | Array | No | Suspected entry points |
| codebase_index | JSON | No | Function/method index |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| call_chain | Array | Ordered function calls |
| entry_point | JSON | Where execution started |
| key_transitions | Array | Critical decision points |
| async_boundaries | Array | Async hops in chain |

## Call Chain Entry Format

```json
{
  "function": "processOrder",
  "file": "src/orders/processor.ts",
  "line": 45,
  "calls": "validateOrder",
  "parameters": ["order", "user"]
}
```

## Validation

- Chain connects entry to failure
- All functions exist in codebase
- Async boundaries marked
