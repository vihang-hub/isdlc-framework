---
name: branch-point-identification
description: Identify decision branches in execution path
skill_id: TRACE-204
owner: execution-path-tracer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Final step of T2 execution path tracing
dependencies: [TRACE-201, TRACE-202, TRACE-203]
---

# Branch Point Identification

## Purpose

Identify critical decision points (branches) in the execution path where the bug's path diverged from the expected path.

## When to Use

- Final step of T2 execution path tracing
- To pinpoint where behavior diverged

## Process

1. Find conditionals along call chain
2. Identify switch/case statements
3. Map error handling branches
4. Find polymorphic dispatches
5. Mark critical divergence points

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| call_chain | Array | Yes | From call chain reconstruction |
| data_flow | Array | Yes | From data flow tracing |
| expected_path | Array | No | What path should have been |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| branch_points | Array | All decision points |
| critical_branches | Array | Key divergence points |
| wrong_branch_taken | JSON | Where path went wrong |
| branch_conditions | Array | Condition that caused branch |

## Branch Point Format

```json
{
  "location": "src/orders/validator.ts:78",
  "type": "if-else",
  "condition": "order.status === 'pending'",
  "branch_taken": "else",
  "expected_branch": "if",
  "reason": "status was 'processing' not 'pending'"
}
```

## Branch Types

- **Conditional**: if/else, ternary
- **Switch**: switch/case statements
- **Error handling**: try/catch branches
- **Polymorphic**: Method dispatch based on type
- **Guard clauses**: Early returns

## Validation

- All branches along path identified
- Critical divergence point found
- Condition causing wrong path documented
