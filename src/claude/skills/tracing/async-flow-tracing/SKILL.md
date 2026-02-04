---
name: async-flow-tracing
description: Trace asynchronous execution flows across promises, callbacks, and events
skill_id: TRACE-205
owner: execution-path-tracer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: During T2 execution path tracing for async code
dependencies: [TRACE-201]
---

# Async Flow Tracing

## Purpose

Trace asynchronous execution flows including promises, callbacks, event emitters, and async/await patterns to understand timing and sequencing issues.

## When to Use

- During T2 execution path tracing
- When bugs involve async timing issues
- When promise chains or callbacks are involved

## Process

1. Identify async entry points
2. Map promise chains and continuations
3. Track event listener registrations
4. Trace callback execution order
5. Identify potential race conditions

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| code_path | String | Yes | Path to async code |
| entry_point | String | Yes | Starting async operation |
| runtime_logs | Array | No | Async execution logs |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| async_chain | Array | Sequence of async operations |
| timing_diagram | JSON | Execution timing visualization |
| race_conditions | Array | Potential race condition points |
| await_points | Array | Suspension and resumption points |

## Analysis Focus

- **Promise chains**: Resolution and rejection paths
- **Event loops**: Microtask vs macrotask ordering
- **Callbacks**: Registration and execution timing
- **Cancellation**: Cleanup and abort handling

## Validation

- Async chain fully traced
- All await points identified
- Race conditions flagged
