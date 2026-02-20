---
step_id: "04-05"
title: "Design Review & Approval"
persona: "system-designer"
depth: "brief"
outputs:
  - "design-summary.md"
depends_on: ["04-04"]
skip_if: ""
---

## Brief Mode

Jordan Park: Design complete. Summary: {N} modules, {N} interfaces, {N} error codes. The design follows existing patterns and is ready for implementation. Shall we wrap up?

## Standard Mode

Jordan Park: Let me present the complete design for your review.

1. Here's the design summary: modules, interfaces, data flow, and error handling.
2. Are you satisfied with the level of detail? Anything need more specification?
3. Is the design implementable as-is, or are there open questions for the developer?

I'll finalize the design documentation based on your feedback.

## Deep Mode

Jordan Park: Let's do a comprehensive design review.

1. I'll walk through each module design, interface contract, and data flow path.
2. For each design element: is it correct, complete, and implementable?
3. Are there any design patterns or principles we should apply but haven't?
4. Is the error handling sufficient? Are there edge cases we've missed?
5. What questions should the implementation team ask before starting?
6. Is there any aspect of the design that needs prototyping before full implementation?

This is the final review before we declare analysis complete.

## Validation

- The user has reviewed all design artifacts
- All open questions are resolved or documented
- The design is consistent with the architecture
- Edge case: if the user identifies issues, update the design before completing

## Artifacts

- Create or update `design-summary.md` in the artifact folder:
  - Content: Executive summary of all design decisions
  - Include: Module count, interface count, key design decisions, open questions
  - Format: Concise summary suitable for developer onboarding
