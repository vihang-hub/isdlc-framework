# ADR-0002: Task Refinement as Orchestrator Step vs New Workflow Phase

## Status

Accepted

## Context

FR-04 requires a task refinement step that converts high-level design artifacts into file-level implementation tasks. This step must run after the design phase (GATE-04) and before implementation (Phase 06). Two approaches were evaluated:

**Option A: Orchestrator Step (Section 3c)** -- Add a new orchestrator action between GATE-04 and Phase 06 delegation, similar to how plan generation (Section 3b) runs after GATE-01.

**Option B: New Workflow Phase** -- Add a `04b-refinement` phase to workflows.json between design and test-strategy.

**Option C: Agent Modifier on Phase 06** -- Use `agent_modifiers["06-implementation"]` to trigger refinement at the start of the software-developer agent's work.

### Evaluation Criteria

| Criterion | Option A (Orch Step) | Option B (New Phase) | Option C (Agent Modifier) |
|-----------|---------------------|---------------------|--------------------------|
| Constraint C-01 compliance | YES -- no new phase | VIOLATES -- adds phase | YES -- no new phase |
| Consistency with existing patterns | HIGH -- matches 3b pattern | LOW -- changes workflow structure | MEDIUM -- overloads agent start |
| Separation of concerns | HIGH -- orchestrator manages plan, agents execute | LOW -- needs a new agent or reuses existing one | LOW -- implementation agent does refinement |
| Gate integration | CLEAN -- runs between gates naturally | REQUIRES new GATE-04b | AWKWARD -- refinement inside Phase 06 |
| Workflow impact | NONE -- phase array unchanged | ALL feature/fix workflows change | NONE -- modifier addition only |

## Decision

Use **Option A: Orchestrator Step (Section 3c)**. Add a refinement step to the orchestrator that runs after GATE-04 passes, before the next phase delegation. This mirrors the existing plan-generation pattern (Section 3b).

### Trigger Mechanism

The phase-loop controller (isdlc.md STEP 3e) already increments phase index and sets the next phase. The refinement step inserts between 3e (POST-PHASE STATE UPDATE for design) and 3d (DIRECT PHASE DELEGATION for the next phase):

```
GATE-04 passes
  -> 3e: Mark design completed, advance phase index
  -> 3c-refine: If design phase just completed AND workflow has implementation phase:
       Read design artifacts -> Update tasks.md with file-level tasks
       Write task-refinement-log.md
  -> 3d: Delegate to next phase agent
```

The refinement step is SKIPPED for:
- Workflows without an implementation phase (e.g., test-generate)
- Workflows without a design phase (fix workflow skips to implementation directly -- tasks remain high-level)

### Implementation Location

1. **Orchestrator (00-sdlc-orchestrator.md)**: Add Section 3c with refinement logic
2. **Phase-loop controller (isdlc.md)**: Add refinement trigger detection between 3e and 3d

## Consequences

**Positive:**
- No changes to workflows.json (satisfies C-01)
- Consistent with plan-generation pattern (3b)
- Clean separation: orchestrator refines plan, agents execute plan
- Fix workflows naturally skip refinement (no design phase to refine from)

**Negative:**
- Orchestrator grows in complexity (one more section)
- Phase-loop controller must detect "design just completed" condition
- Refinement runs within orchestrator context, not as a delegated agent -- limits to what orchestrator can see

## Traces

- FR-04 (Task Refinement Step), AC-04a through AC-04g
- C-01 (No New Workflow Phases)
- NFR-01 (Performance -- refinement within 60s)
