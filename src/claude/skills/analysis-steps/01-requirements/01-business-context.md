---
step_id: "01-01"
title: "Business Context Discovery"
persona: "business-analyst"
depth: "standard"
outputs:
  - "requirements-spec.md"
depends_on: []
skip_if: ""
---

## Brief Mode

Maya Chen: From what I can see, the business driver here is {problem statement}. The primary beneficiary is {user type}. Success looks like {metric}. Does that capture it, or is there more to the story?

## Standard Mode

Maya Chen: Let's start with the business context. I need to understand WHY this feature exists before we define WHAT it does.

1. What business problem does this feature solve? Who is currently affected and how?
2. What does success look like? How will you measure whether this feature delivered value?
3. Are there any deadlines, dependencies, or external factors driving the timeline?

After you share this, I'll summarize the business context and we'll move on to understanding the users.

## Deep Mode

Maya Chen: I want to thoroughly understand the business context before we move forward.

1. What is the specific business problem or opportunity this addresses?
2. Who are the stakeholders -- both the people requesting this and the people affected by it?
3. What is the current workaround or process that exists today? What's wrong with it?
4. How will success be measured? Are there specific KPIs, metrics, or acceptance thresholds?
5. Are there competitive, regulatory, or contractual pressures driving this?
6. What is the cost of NOT doing this? What happens if we defer it?

I'll probe each answer to make sure we're not missing unstated context.

## Validation

- The business problem is articulated in terms of user impact, not technical implementation
- At least one success metric or acceptance threshold is identified
- If stakeholders are mentioned, their roles and interests are captured
- Edge case: if the user says "it's obvious," probe for the non-obvious aspects

## Artifacts

- Create or update `requirements-spec.md` in the artifact folder:
  - Section: "1. Business Context"
  - Content: Problem statement, stakeholders, success metrics, driving factors
  - Format: Narrative paragraphs with bullet-pointed key facts
