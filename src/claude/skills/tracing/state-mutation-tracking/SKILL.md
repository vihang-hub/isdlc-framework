---
name: state-mutation-tracking
description: Track state mutations during execution
skill_id: TRACE-203
owner: execution-path-tracer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: During T2 execution path tracing
dependencies: [TRACE-201]
---

# State Mutation Tracking

## Purpose

Track how application state is mutated during the execution path, identifying unexpected or problematic state changes.

## When to Use

- During T2 execution path tracing
- When bug may involve state management

## Process

1. Identify state containers
2. Find mutation operations along path
3. Track state before/after changes
4. Identify unexpected mutations
5. Check for race conditions

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| call_chain | Array | Yes | From call chain reconstruction |
| state_locations | Array | No | Known state containers |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| mutations | Array | State changes in order |
| unexpected_mutations | Array | Suspicious state changes |
| race_risks | Array | Potential race conditions |
| state_inconsistencies | Array | Inconsistent state found |

## State Types to Track

- **Global state**: Singletons, module-level vars
- **Component state**: React state, class properties
- **Store state**: Redux, Vuex, context
- **Session state**: User session, auth state
- **Cache state**: Memoization, caches

## Mutation Entry Format

```json
{
  "location": "src/store/user.ts:45",
  "state_path": "user.preferences",
  "operation": "assignment",
  "before": "{ theme: 'light' }",
  "after": "{ theme: undefined }"
}
```

## Validation

- All mutations tracked
- Unexpected changes flagged
- Race conditions identified
