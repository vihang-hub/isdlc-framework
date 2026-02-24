# ADR-0003: Fan-Out Replaces Existing A1/A2/A3 Grouping Strategy in Track A

## Status

Accepted

## Context

The Phase 16 Quality Loop agent (16-quality-loop-engineer.md) currently defines an internal grouping strategy for Track A:

| Group | Checks | When to Spawn |
|-------|--------|---------------|
| A1 | Build + Lint + Type check | Always |
| A2 | Test execution + Coverage | Always |
| A3 | Mutation testing | If configured |

This grouping is described with MAY/SHOULD language ("Track A MAY internally parallelize its work by spawning sub-agents for groups A1, A2, and A3"). It is **guidance**, not enforcement.

The new fan-out feature (FR-005) introduces a different parallelism model: split the test suite by count into N chunks, where each chunk runs the FULL Track A pipeline (build + lint + type-check + tests + coverage) for its subset of tests.

We need to decide how these two parallelism models coexist.

### Options Considered

1. **Fan-out replaces grouping**: When fan-out is active, the A1/A2/A3 grouping is superseded. Each chunk agent runs all Track A checks for its test subset. When fan-out is inactive (below threshold), the existing A1/A2/A3 grouping remains as guidance.

2. **Fan-out layers on top of grouping**: Each fan-out chunk internally uses A1/A2/A3 grouping. This would mean chunk 0 spawns A1-0, A2-0, A3-0 sub-agents, and chunk 1 spawns A1-1, A2-1, A3-1, etc.

3. **Remove grouping entirely**: Replace A1/A2/A3 with fan-out for all project sizes. Even below-threshold projects use the fan-out path.

## Decision

We will use **Option 1: Fan-out replaces grouping when active**.

When fan-out is active (test count >= threshold):
- The A1/A2/A3 grouping is NOT used
- Each chunk agent runs the full Track A pipeline for its test subset
- The rationale is: chunk agents need to run build/lint/type-check anyway to verify their test environment is correct, and running these fast checks per-chunk adds minimal overhead while simplifying the agent prompt significantly

When fan-out is inactive (test count < threshold):
- The existing A1/A2/A3 grouping guidance remains available
- No behavioral change from current behavior (NFR-003)

## Consequences

### Positive

- **Simplified agent prompt**: When fan-out is active, the Track A sub-agent follows one parallelism model (fan-out), not two nested models (fan-out + grouping).
- **Reduced nesting depth**: With fan-out replacing grouping, the nesting is: Phase Loop -> Track A/B -> Chunk Agents (3 levels). With fan-out layered on grouping: Phase Loop -> Track A/B -> Chunk Agents -> Group Sub-agents (4 levels). 3 levels is already the practical limit.
- **Deterministic**: Fan-out chunking is deterministic (same inputs produce same chunks). The A1/A2/A3 grouping was advisory (MAY/SHOULD language).
- **Each chunk is self-contained**: A chunk agent runs build, lint, type-check, and tests for its subset. If a chunk fails, the failure is fully attributable to that chunk's tests.

### Negative

- **Redundant build/lint/type-check**: Each chunk agent runs build, lint, and type-check. For N chunks, these fast checks run N times instead of once. The overhead is acceptable because build/lint/type-check are fast (typically < 10 seconds each) compared to test execution (minutes).
- **A1/A2/A3 grouping is legacy**: When fan-out is active, the grouping strategy section of the agent markdown is inactive. This creates a branch in the agent instructions (if fan-out: do X, else: do Y). The implementation phase should clearly delineate these two code paths.

### Quantified Overhead

For a project with N = 4 chunk agents:
- Build verification: 4 builds instead of 1. If build takes 5s, overhead is 15s additional.
- Lint check: 4 lint runs. If lint takes 3s, overhead is 9s additional.
- Type check: 4 type checks. If type check takes 5s, overhead is 15s additional.
- Total overhead: ~39s for a project where test execution takes 3+ minutes per chunk.
- Net benefit: Still positive because test execution parallelism saves minutes.

## Alternatives Rejected

### Option 2: Layer Fan-Out on Top of Grouping

Rejected because:
- Creates 4-level nesting (Phase Loop -> Track A/B -> Chunks -> Groups)
- Excessive context window usage per chunk agent
- The A1/A2/A3 grouping was designed for the single-agent case where parallelizing within Track A meant grouping checks, not splitting tests
- Mixing two parallelism models is confusing and hard to reason about

### Option 3: Remove Grouping Entirely

Rejected because:
- Below-threshold projects (< 250 tests) should retain existing behavior (NFR-003)
- The A1/A2/A3 grouping is harmless for small projects
- Removing it would change behavior for all projects, not just those above threshold

## Traces

- FR-005 (Phase 16 Fan-Out)
- AC-005-06 (Fan-out applied to Track A only)
- NFR-003 (Backward Compatibility: zero change for below-threshold workloads)
- Impact Analysis M3: "Fan-out replaces existing A1/A2/A3 grouping"
- Article V (Simplicity First)
