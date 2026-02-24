# Performance Budget and Guardrail System

**Source**: BACKLOG.md item 2.4
**Type**: Feature (REQ)

## Problem Statement

The framework has been optimised from ~4x to ~1.2-1.5x overhead (T1-T3 done). But upcoming backlog items add significant agent calls — Creator/Critic/Refiner debates across 4 creative phases could add 12+ extra agent runs (~20-40 min worst case), Phase 06 Writer/Reviewer/Updater adds 2N calls for N files, and fan-out spawns multiple parallel agents. Without a performance budget, these features will erode the gains incrementally and nobody will notice until the framework feels slow again.

## Proposed Design

### 1. Per-workflow Timing Instrumentation

Record wall-clock time per phase, per agent call, and per hook dispatcher invocation in `state.json` under `phases[phase].timing`. Already have `console.time()` in dispatchers — extend to full phase timing.

### 2. Performance Budget per Intensity

| Intensity | Target Overhead | Max Agent Calls | Max Debate Rounds |
|-----------|----------------|-----------------|-------------------|
| Light     | <=1.2x native  | No debates, no fan-out | 0 |
| Standard  | <=2x native    | Debates on creative phases, basic fan-out | 2 per phase |
| Epic      | <=3x native    | Full debates + fan-out + cross-validation | 3 per phase |

### 3. Budget Enforcement

At each phase boundary, the phase-loop-controller checks elapsed time against the budget. If over budget:
- Log warning with breakdown (which phase/agent consumed the most time)
- For debate phases: reduce remaining `max_rounds` to 1 (force convergence)
- For fan-out: reduce parallelism (fewer chunks)
- Never block — degrade gracefully, don't halt the workflow

### 4. Regression Tracking

At workflow completion, append timing summary to `workflow_history`. Compare against rolling average of last 5 workflows of same intensity. Flag if >20% slower with breakdown of where time went.

### 5. Dashboard at Completion

Show timing summary when workflow finishes:

```
Workflow completed in 47m 12s (standard budget: 60m)
  Phase 01 (Requirements):  8m 32s  [2 debate rounds]
  Phase 02 (Impact):        1m 04s
  Phase 03 (Architecture):  9m 18s  [2 debate rounds]
  Phase 04 (Design):        7m 45s  [1 debate round]
  Phase 05 (Test Strategy): 3m 12s
  Phase 06 (Implementation): 12m 41s [8 files, 3 review cycles]
  Phase 16 (Quality Loop):  2m 48s  [4-way fan-out]
  Phase 08 (Code Review):   1m 52s
```

## Builds On

- T1-T3 dispatcher timing (done)
- state.json workflow_history (REQ-0005, done)
- Sizing intensity system (REQ-0011, done)

## What It Protects

Every new backlog item (4.2B cross-pollination, 5.2 collaborative mode) must stay within the intensity budget. If a feature consistently blows the budget, it gets flagged for optimisation before the next release.

## Complexity

Medium — instrumentation is straightforward, budget enforcement needs careful degradation logic.
