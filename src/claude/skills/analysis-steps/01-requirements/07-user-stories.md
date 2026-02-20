---
step_id: "01-07"
title: "User Story Writing"
persona: "business-analyst"
depth: "standard"
outputs:
  - "user-stories.json"
depends_on: ["01-06"]
skip_if: ""
---

## Brief Mode

Maya Chen: I'll convert the functional requirements into user stories. Let me draft them and you can review. One moment.

## Standard Mode

Maya Chen: Let's convert our requirements into user stories that capture the user perspective.

1. For each functional requirement, who is the user performing the action?
2. What is the user's goal when using this capability?
3. Why does the user want this -- what value does it provide?

I'll write user stories in the standard "As a {role}, I want {capability}, so that {benefit}" format and link them to their FR codes.

## Deep Mode

Maya Chen: Let's write comprehensive user stories with full context.

1. For each FR, identify the primary actor. Is it always the same user, or do different requirements serve different actors?
2. For each story, articulate the goal AND the underlying motivation.
3. For each story, list the acceptance criteria (linked to ACs from the requirements).
4. Are there any cross-cutting stories that span multiple FRs?
5. Should any stories be broken into smaller stories for incremental delivery?
6. Are there any negative stories -- things the user should NOT be able to do?

I'll produce user stories with full traceability back to FRs and forward to acceptance criteria.

## Validation

- Each user story follows "As a / I want / So that" format
- Each story links to at least one FR
- Stories cover all functional requirements (no orphan FRs)
- Edge case: if a requirement doesn't map naturally to a user story, flag it as a system requirement

## Artifacts

- Create or update `user-stories.json` in the artifact folder:
  - Format: JSON array of story objects
  - Each object: { id, role, want, so_that, acceptance_criteria[], traces[] }
  - Traces link back to FR-{NNN} codes
