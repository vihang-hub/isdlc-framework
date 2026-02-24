# ADR-0003: Mechanical Execution Mode Activation Mechanism

## Status

Accepted

## Context

FR-05 requires the software-developer agent to support an opt-in mechanical execution mode where it follows tasks.md literally. The mode must be OFF by default (AC-05f) and activate through an explicit signal. Three mechanisms were evaluated:

**Option A: Workflow Option Flag** -- Add `--mechanical` flag to the feature workflow (like `--atdd`), stored in state.json `active_workflow.options.mechanical_mode: true`, read by agent from state.

**Option B: Agent Modifier in workflows.json** -- Add `mechanical_mode: true` to `agent_modifiers["06-implementation"]` in workflows.json under a `_when_mechanical_mode` conditional block (mirrors the `_when_atdd_mode` pattern).

**Option C: Runtime Detection** -- Agent 05 automatically enables mechanical mode when tasks.md contains file-level annotations. No explicit flag needed.

### Evaluation Criteria

| Criterion | Option A (Flag) | Option B (Modifier) | Option C (Auto-detect) |
|-----------|----------------|--------------------|-----------------------|
| Explicit user control | YES -- user opts in at workflow start | YES -- configurable per workflow | NO -- automatic, user cannot override |
| Consistency with ATDD | HIGH -- same pattern | HIGH -- same conditional block pattern | LOW -- different pattern |
| Backward compatibility | HIGH -- default off | HIGH -- default off | MEDIUM -- could trigger unexpectedly |
| Simplicity | HIGH -- one flag, one check | MEDIUM -- modifier wiring needed | LOW -- detection logic complex |
| Article IV compliance | HIGH -- explicit opt-in | HIGH -- explicit config | VIOLATES -- implicit behavior |

## Decision

Use **Option B: Agent Modifier in workflows.json** with the conditional block pattern, combined with **Option A: Workflow Option Flag** for user activation.

This mirrors the existing ATDD pattern exactly:

1. **User activates**: `isdlc feature "description" --mechanical` (or the orchestrator detects `options.mechanical_mode: true`)
2. **workflows.json stores**: Under `agent_modifiers["06-implementation"]._when_mechanical_mode: { ... }`
3. **State.json stores**: `active_workflow.mechanical_mode: true` (parallel to `atdd_mode`)
4. **Agent 05 reads**: Checks `active_workflow.mechanical_mode` at phase start

### Agent Behavior Matrix

| Condition | Mode | Behavior |
|-----------|------|----------|
| `mechanical_mode: false` (default) | Standard | Agent self-decomposes work per current behavior |
| `mechanical_mode: true` + file-level tasks exist | Mechanical | Agent follows tasks.md task-by-task in dependency order |
| `mechanical_mode: true` + NO file-level tasks | Fallback | Warning emitted, falls back to standard mode (AC-05g) |

## Consequences

**Positive:**
- Follows the proven ATDD activation pattern (consistency)
- User explicitly opts in (Article IV: explicit over implicit)
- Default off preserves existing behavior (zero risk for non-adopters)
- Fallback to standard mode when tasks lack detail (graceful degradation)

**Negative:**
- Adds another workflow option (slight config complexity)
- Two modes in Agent 05 increases code paths (testing overhead)

## Traces

- FR-05 (Mechanical Execution Mode), AC-05a through AC-05g
- Article IV (Explicit Over Implicit)
- Article V (Simplicity First)
