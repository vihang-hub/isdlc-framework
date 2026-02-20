---
step_id: "01-08"
title: "MoSCoW Prioritization"
persona: "business-analyst"
depth: "brief"
outputs:
  - "requirements-spec.md"
  - "traceability-matrix.csv"
depends_on: ["01-06"]
skip_if: ""
---

## Brief Mode

Maya Chen: Here's my suggested MoSCoW prioritization based on our discussion. Must Have: {list}. Should Have: {list}. Could Have: {list}. Won't Have: {list}. Does this feel right, or would you reprioritize anything?

## Standard Mode

Maya Chen: Let's prioritize the requirements using MoSCoW.

1. Which requirements are Must Have -- the feature is useless without them?
2. Which are Should Have -- important but the feature works without them?
3. Which are Could Have -- nice to have, defer if time is tight?

I'll also build the traceability matrix mapping FRs to user stories and acceptance criteria.

## Deep Mode

Maya Chen: Let's do a rigorous prioritization exercise.

1. For each FR, assign a MoSCoW priority. Justify each "Must Have" -- what breaks if it's deferred?
2. Challenge: are any "Must Have" items actually "Should Have" in disguise? What happens if we ship without them?
3. Is there a minimum viable slice -- a subset of Must Haves that delivers standalone value?
4. Do any priorities conflict? (e.g., FR-003 is Must Have but depends on FR-005 which is Should Have)
5. Are there any requirements where the priority depends on external factors (timeline, dependencies)?
6. What is the recommended implementation order considering dependencies and priority?

I'll produce a prioritized list and identify any priority conflicts.

## Validation

- Every FR has a MoSCoW priority assigned
- Must Haves represent a coherent, deliverable set (not everything is Must Have)
- If all requirements are Must Have, challenge the prioritization
- Edge case: if user assigns everything as Must Have, ask "what would you cut if forced?"

## Artifacts

- Update `requirements-spec.md` in the artifact folder:
  - Section: "8. MoSCoW Prioritization"
  - Content: Prioritized requirement table (FR code, title, priority)
- Create or update `traceability-matrix.csv` in the artifact folder:
  - Content: Matrix mapping FR codes to user stories, ACs, and priority
  - Format: CSV with columns: FR_ID, Title, AC_Count, Priority, User_Stories
