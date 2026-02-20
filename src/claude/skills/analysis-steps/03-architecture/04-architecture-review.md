---
step_id: "03-04"
title: "Architecture Review & Approval"
persona: "solutions-architect"
depth: "brief"
outputs:
  - "architecture-overview.md"
depends_on: ["03-03"]
skip_if: ""
---

## Brief Mode

Alex Rivera: Architecture summary: {approach} with {N} integration points. Risk level: {level}. Key decision: {ADR summary}. Ready to proceed to design?

## Standard Mode

Alex Rivera: Let me present the architecture summary for your review.

1. Here's the complete architecture: selected approach, technology decisions, integration points, and component interactions.
2. Are you comfortable with this architecture, or do you want to revisit any decisions?
3. Any concerns about the approach before we hand off to the design phase?

I'll finalize the architecture documentation based on your feedback.

## Deep Mode

Alex Rivera: Let's do a thorough architecture review before we proceed.

1. I'll present each architectural decision with its rationale.
2. Are there any decisions you disagree with? What would you change?
3. Are there any cross-cutting concerns we haven't addressed? (Logging, monitoring, error handling, security)
4. Is the architecture testable? Can we write meaningful tests for each component?
5. Is the architecture flexible enough for future evolution? Where might requirements change?
6. Who else should review this architecture before we proceed?

This is the last chance to adjust the architecture before we move to detailed design.

## Validation

- The user has reviewed the complete architecture
- All concerns are addressed or documented as known trade-offs
- The architecture is consistent with the requirements
- Edge case: if the user wants major changes, loop back to architecture options

## Artifacts

- Update `architecture-overview.md` in the artifact folder:
  - Section: "5. Architecture Summary"
  - Content: Executive summary of architecture decisions
  - Include: Key decisions, trade-offs acknowledged, go-forward plan
