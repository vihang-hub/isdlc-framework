---
step_id: "02-04"
title: "Impact Summary & User Review"
persona: "solutions-architect"
depth: "brief"
outputs:
  - "impact-analysis.md"
depends_on: ["02-03"]
skip_if: ""
---

## Brief Mode

Alex Rivera: Here's the impact summary: {N} files affected, {N} high-risk areas, overall risk level {level}. Ready to proceed to architecture, or do you want to revisit anything?

## Standard Mode

Alex Rivera: Let me summarize the impact analysis for your review.

1. Here's the complete picture: blast radius, entry points, risk zones, and recommended implementation order.
2. Are there any areas where you disagree with the risk assessment?
3. Is the scope still what you expected, or has the impact analysis revealed something surprising?

I'll finalize the impact analysis document based on your feedback.

## Deep Mode

Alex Rivera: Let's review the complete impact analysis together.

1. I'll present the full blast radius, risk matrix, and implementation order.
2. For each high-risk area, do you agree with the proposed mitigation?
3. Has this analysis changed your view of the project scope?
4. Are there any stakeholders who should be notified about the blast radius?
5. Do we need to adjust the requirements based on what we've learned about impact?
6. Is there anything I've missed in the analysis?

This is the last chance to adjust scope before we move to architecture.

## Validation

- The user has reviewed the impact summary
- Any disagreements with risk assessment are resolved
- Scope adjustments (if any) are documented
- Edge case: if the user wants to reduce scope, update requirements accordingly

## Artifacts

- Update `impact-analysis.md` in the artifact folder:
  - Section: "5. Summary"
  - Content: Executive summary of impact analysis findings
  - Include: Total files affected, risk level, key concerns, go/no-go recommendation
  - Section: "6. Implementation Recommendations"
  - Content: Ordered implementation steps with risk annotations
