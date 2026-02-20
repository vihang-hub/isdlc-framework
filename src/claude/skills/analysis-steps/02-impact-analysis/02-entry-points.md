---
step_id: "02-02"
title: "Entry Point Identification"
persona: "solutions-architect"
depth: "standard"
outputs:
  - "impact-analysis.md"
depends_on: ["02-01"]
skip_if: ""
---

## Brief Mode

Alex Rivera: The recommended entry point is {file/module}. Implementation order: {numbered list}. The critical path goes through {path}. Agreed?

## Standard Mode

Alex Rivera: Now let's identify where implementation should start and in what order.

1. Which file or module is the best starting point for implementation? (Usually the most foundational change.)
2. What is the recommended implementation order? (Consider dependencies -- what must exist before something else can be built.)
3. Is there a critical path -- a sequence of changes where each step unblocks the next?

I'll produce an ordered implementation plan based on the dependency chain.

## Deep Mode

Alex Rivera: Let's design the implementation sequence carefully.

1. What is the most foundational change -- the one everything else depends on?
2. Map the dependency chain: which changes must be completed before others can start?
3. Are there any changes that can be done in parallel (no mutual dependencies)?
4. Which changes have the highest risk? Should they be done first (fail fast) or last (stable foundation)?
5. Are there any integration points where two changes must be coordinated?
6. What is the minimum set of changes needed for a working proof-of-concept?

I'll produce a dependency-ordered implementation plan with parallel opportunities identified.

## Validation

- A recommended starting point is identified
- An ordered list of implementation steps is produced
- Dependencies between steps are documented
- Edge case: if there are circular dependencies, flag for architectural resolution

## Artifacts

- Update `impact-analysis.md` in the artifact folder:
  - Section: "2. Entry Points"
  - Content: Recommended implementation starting point and order
  - Section: "3. Implementation Order"
  - Content: Numbered sequence with dependency annotations
