# ADR-0001: Pipeline Verification Pattern for M4

## Status

Accepted

## Context

The Impact Analysis phase (Phase 02) currently uses a fan-out/fan-in pattern: the orchestrator launches M1, M2, and M3 in parallel, collects their results, and consolidates them into a single report. No cross-referencing occurs between sub-agent outputs.

REQ-0015 introduces a Verifier agent (M4) that must cross-validate M1/M2/M3 outputs to detect inconsistencies. The architectural question is where and how M4 fits into the existing pipeline.

**Requirement references**: FR-01, FR-05, NFR-01, NFR-02, NFR-03, C-04

## Decision

Insert M4 as a **sequential post-verification step** between the fan-in (collect results) and consolidation stages. The pattern becomes:

```
Fan-out: M1, M2, M3 (parallel) --> Fan-in: Collect --> Verify: M4 (sequential) --> Consolidate
```

M4 runs as a single Task call after all three sub-agents complete but before the orchestrator assembles the final report.

## Rationale

1. **Simplicity (Article V)**: Adding one sequential step is the simplest change that satisfies all requirements. No restructuring of the parallel execution pattern is needed.

2. **Data dependency**: M4 requires all three agent outputs as input. It cannot run in parallel with M1/M2/M3.

3. **Fail-open (NFR-02, Article X)**: A sequential step is easy to wrap in error handling. If M4 fails, the orchestrator simply skips the verification section and proceeds to consolidation.

4. **Backward compatibility (NFR-03)**: The existing M1/M2/M3 agents are not modified. M4 is purely additive. If M4's agent file does not exist (older version), the orchestrator skips the step entirely.

5. **Performance (NFR-01)**: A single sequential Task call adds bounded overhead (~15-20% of total Phase 02 duration).

## Consequences

**Positive:**
- Minimal change to existing orchestrator (insert one step)
- Clear separation of concerns (M4 only verifies, does not modify)
- Easy to disable or remove M4 without affecting M1/M2/M3
- Fail-open design prevents M4 from becoming a bottleneck

**Negative:**
- M4 cannot improve M1/M2/M3 outputs (post-hoc only, as specified by Approach A)
- Adds ~10-30 seconds to Phase 02 execution time
- M4's verification quality depends on M1/M2/M3 output format consistency

## Alternatives Considered

1. **Cross-pollination during execution (Approach B)**: M1/M2/M3 would share findings during parallel execution. This would allow richer cross-referencing but requires modifying all three agents (violates NFR-03) and introduces coordination complexity. Deferred to future backlog.

2. **Verification within consolidation**: Embed cross-validation logic in the consolidation step rather than a separate agent. This would avoid an extra Task call but would make the consolidation step much more complex and harder to test/evolve independently.

3. **Parallel verification + consolidation**: Run M4 in parallel with consolidation, merging results at the end. This is not possible because M4's output needs to be included in the consolidated report and may influence the executive summary.
