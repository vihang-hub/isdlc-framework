---
name: call-chain-tracing
description: Trace function call chains to understand execution flow
skill_id: TRACE-202
owner: execution-path-tracer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: During T2 execution path tracing
dependencies: [TRACE-201]
---

# Call Chain Tracing

## Purpose

Trace function call chains from entry point to failure point, mapping the complete execution path through the codebase.

## When to Use

- During T2 execution path tracing
- When understanding how code reached a failure point
- When mapping dependencies between functions

## Process

1. Identify entry point function
2. Build static call graph
3. Trace dynamic call path
4. Map parameter passing
5. Identify branching decisions

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| entry_function | String | Yes | Starting function |
| target_function | String | No | End point to trace to |
| call_logs | Array | No | Runtime call logs |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| call_chain | Array | Ordered list of function calls |
| call_graph | JSON | Static call relationships |
| parameters | Array | Parameters at each call site |
| branch_points | Array | Conditional branch decisions |

## Analysis Focus

- **Direct calls**: Function-to-function invocations
- **Indirect calls**: Callbacks, event handlers, virtual dispatch
- **Recursion**: Self-referential call patterns
- **Cross-module calls**: Inter-file dependencies

## Validation

- Call chain connects entry to target
- All intermediate calls identified
- Branch decisions documented
