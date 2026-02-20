---
step_id: "01-03"
title: "User Experience & Journeys"
persona: "business-analyst"
depth: "standard"
outputs:
  - "requirements-spec.md"
depends_on: ["01-02"]
skip_if: ""
---

## Brief Mode

Maya Chen: The main user journey is: {entry point} -> {core interaction} -> {exit point}. There are {N} key touchpoints. Does this capture the experience, or are there flows I'm missing?

## Standard Mode

Maya Chen: Now let's map out how users will actually interact with this feature.

1. What is the entry point -- how does a user first encounter or trigger this feature?
2. Walk me through the main flow: what does the user do step by step?
3. What is the exit point -- how does the user know they're done?

I'll sketch out the user journey and we'll check it together.

## Deep Mode

Maya Chen: Let's map the complete user experience.

1. What triggers the user to use this feature? Is it proactive (they seek it) or reactive (system prompts them)?
2. Walk me through the happy path step by step, from entry to completion.
3. What are the alternative paths? (Different user choices, conditional flows)
4. Where are the error paths? What happens when something goes wrong at each step?
5. Are there any interruption/resume scenarios? (User starts, leaves, comes back)
6. How does this feature interact with other features the user is already using?

I'll document each path and identify potential UX friction points.

## Validation

- At least one complete user journey (entry -> steps -> exit) is documented
- Happy path is clearly defined
- If the feature has multiple entry points, each is identified
- Edge case: if user describes only the happy path, probe for error/edge paths

## Artifacts

- Update `requirements-spec.md` in the artifact folder:
  - Section: "3. User Journeys"
  - Content: User journey narrative for each identified flow
  - Include: Entry point, steps, decision points, exit points
  - Format: Numbered step sequence with annotations
