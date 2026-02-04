---
name: condition-identification
description: Identify conditions that led to a specific execution path
skill_id: TRACE-204
owner: execution-path-tracer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: During T2 execution path tracing
dependencies: [TRACE-202]
---

# Condition Identification

## Purpose

Identify the conditions (if statements, switch cases, loop guards) that determined the specific execution path leading to a bug.

## When to Use

- During T2 execution path tracing
- When understanding why a specific path was taken
- When identifying triggering conditions for bugs

## Process

1. Extract branch points from call chain
2. Identify condition expressions
3. Determine evaluated values
4. Map condition to path selection
5. Document preconditions

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| call_chain | Array | Yes | Execution call chain |
| source_files | Array | Yes | Relevant source files |
| runtime_state | JSON | No | Variable values at runtime |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| conditions | Array | All branch conditions evaluated |
| trigger_condition | JSON | Key condition causing bug path |
| variable_values | JSON | Values that satisfied conditions |
| alternate_paths | Array | Paths not taken |

## Analysis Focus

- **Guard conditions**: Entry conditions for code blocks
- **Edge cases**: Boundary value conditions
- **Null checks**: Missing or failed null guards
- **Type checks**: Type coercion issues

## Validation

- All branch points have conditions documented
- Trigger condition clearly identified
- Variable values that satisfied condition known
