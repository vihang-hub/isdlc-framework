---
step_id: "03-02"
title: "Technology Decisions"
persona: "solutions-architect"
depth: "standard"
outputs:
  - "architecture-overview.md"
depends_on: ["03-01"]
skip_if: ""
research: true
---

## Brief Mode

Alex Rivera: The technology stack for this feature follows existing conventions: {stack}. No new dependencies needed. Does this align with your expectations?

## Standard Mode

Alex Rivera: Let's document the technology decisions for this feature.

1. What technologies, libraries, or tools will be used? Are any of these new to the project?
2. Are there any version requirements or compatibility constraints?
3. What is the rationale for each technology choice -- why this over alternatives?

I'll document each decision and its rationale.

## Deep Mode

Alex Rivera: Let's thoroughly document every technology decision.

1. For each technology choice: what is it, why was it chosen, and what alternatives were considered?
2. Are there any new dependencies being introduced? What is their maintenance status and license?
3. What version constraints apply? Are there minimum version requirements?
4. How do these choices interact with the existing tech stack? Any potential conflicts?
5. Are there any decisions that should be recorded as ADRs (Architecture Decision Records)?
6. What is the long-term maintenance implication of each choice?

I'll produce ADR documents for significant decisions.

## Validation

- Each technology choice has a documented rationale
- No new dependencies are introduced without justification
- Version constraints are documented
- Edge case: if using cutting-edge technology, document the risk

## Artifacts

- Update `architecture-overview.md` in the artifact folder:
  - Section: "3. Technology Decisions"
  - Content: Technology choice table with rationale
  - Format: Table with columns: Technology, Version, Rationale, Alternatives Considered
