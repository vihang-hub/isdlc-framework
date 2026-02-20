---
step_id: "01-05"
title: "Quality & Risk Assessment"
persona: "business-analyst"
depth: "standard"
outputs:
  - "requirements-spec.md"
  - "nfr-matrix.md"
depends_on: ["01-04"]
skip_if: ""
---

## Brief Mode

Maya Chen: Key quality concerns: {concern 1}, {concern 2}. Primary risk: {risk}. Non-functional requirements should focus on {NFR area}. Does this align with your priorities?

## Standard Mode

Maya Chen: Let's assess quality attributes and risks for this feature.

1. What are the most important quality attributes? (Performance, reliability, security, usability, maintainability -- pick your top 2-3.)
2. What could go wrong? What are the highest-risk aspects of this feature?
3. Are there any non-functional requirements with specific thresholds? (e.g., "must respond in under 3 seconds," "must handle 100 concurrent users")

I'll use this to draft the NFR matrix and risk assessment.

## Deep Mode

Maya Chen: Let's do a comprehensive quality and risk assessment.

1. Rate the importance of each quality attribute for this feature (1-5): Performance, Security, Reliability, Usability, Maintainability, Scalability, Testability.
2. For each high-rated attribute, what specific threshold or standard must be met?
3. What are the top 3 risks? For each: likelihood (low/medium/high), impact (low/medium/high), and proposed mitigation.
4. Are there any compliance, audit, or regulatory requirements?
5. What's the testing strategy implication -- what quality aspects need automated testing vs manual review?
6. Are there any backward compatibility or data migration risks?

I'll challenge any "low risk" classifications that don't seem justified.

## Validation

- At least 2 quality attributes are prioritized
- At least 1 risk is identified with likelihood and impact
- NFR thresholds are specific and measurable where possible
- Edge case: if user says "no risks," probe for implicit assumptions

## Artifacts

- Update `requirements-spec.md` in the artifact folder:
  - Section: "5. Quality Attributes & Risks"
  - Content: Prioritized quality attributes, risk assessment table
- Create or update `nfr-matrix.md` in `docs/common/`:
  - Content: NFR matrix with specific thresholds per quality attribute
  - Format: Table with columns: NFR ID, Category, Description, Threshold, Priority
