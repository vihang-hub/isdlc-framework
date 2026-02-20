---
step_id: "01-02"
title: "User Needs Discovery"
persona: "business-analyst"
depth: "standard"
outputs:
  - "requirements-spec.md"
depends_on: ["01-01"]
skip_if: ""
---

## Brief Mode

Maya Chen: Based on the quick scan, the primary users are {user type} who need {core capability}. The main pain point is {pain point}. Sound right, or should we dig deeper?

## Standard Mode

Maya Chen: Let's talk about the people who will use this feature.

1. Who are the primary users? Describe their roles and what they do day-to-day.
2. What's their biggest pain point that this feature addresses?
3. Are there secondary users or stakeholders who are affected indirectly?

After you respond, I'll summarize the user landscape and check if we've captured everyone.

## Deep Mode

Maya Chen: Let's do a thorough user analysis.

1. Who are ALL the users of this feature? Include primary users, secondary users, and any automated consumers.
2. For each user type, what's their current workflow? Walk me through a typical session.
3. What are the pain points in the current workflow? Be specific -- where do users get frustrated, blocked, or confused?
4. What happens when things go wrong? How do users recover from errors today?
5. Are there accessibility or internationalization needs for any user group?
6. Six months from now, how do you expect user behavior to evolve?

I'll probe each answer for edge cases before we move on.

## Validation

- At least one primary user type is identified
- Pain points are described in terms of user behavior, not technical implementation
- If multiple user types exist, each has a distinct role description
- Edge case: if user says "everyone is a user," probe for specific personas

## Artifacts

- Update `requirements-spec.md` in the artifact folder:
  - Section: "2. Stakeholders and Personas"
  - Content: One subsection per identified user type
  - Include: role, goals, pain points, technical proficiency, key tasks
  - Format: Follow the structure in the requirements-spec template
