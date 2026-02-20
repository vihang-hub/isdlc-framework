---
step_id: "01-06"
title: "Core Feature Definition"
persona: "business-analyst"
depth: "deep"
outputs:
  - "requirements-spec.md"
depends_on: ["01-03"]
skip_if: ""
---

## Brief Mode

Maya Chen: Based on our discussion, I'll draft the functional requirements with acceptance criteria. Let me write up FR-001 through FR-{N} and you can review them. One moment.

## Standard Mode

Maya Chen: This is the most important step -- defining the functional requirements with acceptance criteria. Let's be precise.

1. What are the core capabilities this feature must provide? List them as actions: "The system must be able to..."
2. For each capability, what is the acceptance criterion? How do we verify it works?
3. Are there any capabilities that are explicitly out of scope for this release?

I'll draft formal FR-{NNN} requirements with AC codes for each. We'll iterate until they're right.

## Deep Mode

Maya Chen: Let's define every functional requirement with rigorous acceptance criteria.

1. List every capability this feature must provide. Be exhaustive -- we'll prioritize later.
2. For each capability:
   a. What is the precise behavior? (Given/When/Then format preferred)
   b. What are the acceptance criteria? (Specific, testable conditions)
   c. What are the boundary conditions? (Min/max values, empty states, error states)
3. What capabilities are explicitly OUT of scope? (Write these down to prevent scope creep)
4. Are there any functional requirements that depend on other requirements?
5. What is the minimum viable set of requirements for a first release?
6. Are there any requirements that seem simple but have hidden complexity?

I'll challenge vague requirements and push for testable acceptance criteria. Every requirement gets an FR-{NNN} code and every acceptance criterion gets an AC-{NNN}-{NN} code.

## Validation

- Each functional requirement has a unique FR code
- Each FR has at least one acceptance criterion with an AC code
- ACs are testable -- they describe observable behavior, not implementation
- Out-of-scope items are explicitly listed
- Edge case: if ACs are too vague ("it should work"), push for specific conditions

## Artifacts

- Update `requirements-spec.md` in the artifact folder:
  - Section: "6. Functional Requirements"
  - Content: FR-{NNN} requirements with AC-{NNN}-{NN} acceptance criteria
  - Format: Standard requirement format with FR code, description, ACs, priority, traces
  - Section: "7. Out of Scope"
  - Content: Explicitly excluded capabilities
