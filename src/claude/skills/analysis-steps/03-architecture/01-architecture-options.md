---
step_id: "03-01"
title: "Architecture Options & Tradeoffs"
persona: "solutions-architect"
depth: "deep"
outputs:
  - "architecture-overview.md"
depends_on: []
skip_if: ""
---

## Brief Mode

Alex Rivera: The recommended architecture is {approach}. Key tradeoff: {tradeoff}. This follows existing patterns in the codebase. Sound good?

## Standard Mode

Alex Rivera: Let's explore architecture options for this feature.

1. Based on the requirements and impact analysis, what are 2-3 possible architecture approaches?
2. For each approach, what are the key tradeoffs? (Complexity vs simplicity, flexibility vs performance, etc.)
3. Which approach aligns best with the existing codebase patterns?

I'll present the options with pros/cons and recommend one.

## Deep Mode

Alex Rivera: I want to thoroughly evaluate architecture options before we commit.

1. What are the possible architecture approaches? I want at least 2, ideally 3. For each:
   a. How does it work at a high level?
   b. What are the pros? (Performance, simplicity, extensibility, testability)
   c. What are the cons? (Complexity, coupling, migration cost, learning curve)
   d. What existing patterns does it follow or break?
2. What is your risk appetite? (Conservative: follow existing patterns. Moderate: small improvements. Aggressive: rearchitect.)
3. Are there any constraints that eliminate options? (Performance requirements, backward compatibility, etc.)
4. For the recommended option, what are the biggest architectural risks?
5. Is there a phased approach -- start simple, evolve later?
6. What decisions are irreversible vs easily changed later?

I'll produce an ADR (Architecture Decision Record) for the selected approach.

## Validation

- At least 2 architecture options are considered
- Each option has documented pros and cons
- A recommended option is selected with clear rationale
- Edge case: if only one option is viable, document why alternatives were eliminated

## Artifacts

- Create or update `architecture-overview.md` in the artifact folder:
  - Section: "1. Architecture Options"
  - Content: Options table with pros, cons, and recommendation
  - Section: "2. Selected Architecture"
  - Content: Detailed description of chosen approach with rationale
