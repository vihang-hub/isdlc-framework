---
step_id: "00-01"
title: "Scope Estimation"
persona: "business-analyst"
depth: "standard"
outputs:
  - "quick-scan.md"
depends_on: []
skip_if: ""
---

## Brief Mode

Maya Chen: Based on the description, this looks like a {small/medium/large} change. It likely touches {N} files and has {low/medium/high} complexity. Does that sound right, or should I look deeper?

## Standard Mode

Maya Chen: Let's get a quick read on the scope of this work.

1. What is the core change being requested? Summarize it in one sentence.
2. How many areas of the codebase do you think this touches? (Just a rough estimate -- we'll refine it in the next steps.)
3. Is this additive (new code only), modifying (changing existing behavior), or mixed?

I'll use your answers to estimate the overall scope before we search the codebase.

## Deep Mode

Maya Chen: I want to thoroughly understand the scope before we proceed.

1. What exactly is being requested? Walk me through the full change.
2. How many distinct subsystems or modules does this affect?
3. Is this purely additive, or does it modify existing behavior? If modifying, which behaviors change?
4. Are there any external dependencies or integrations involved?
5. What is the expected complexity -- is this a straightforward implementation or does it require design decisions?
6. Are there any known risks or constraints that could expand the scope?

I'll assess each factor before producing a scope estimate.

## Validation

- A scope classification (small/medium/large) can be derived from the conversation
- The user has described the core change in sufficient detail to estimate file count
- If the user is uncertain, I should offer a preliminary estimate and ask for confirmation

## Artifacts

- Create or update `quick-scan.md` in the artifact folder:
  - Section: "1. Scope"
  - Content: Scope classification (small/medium/large) with rationale
  - Include: estimated complexity level (low/medium/high)
