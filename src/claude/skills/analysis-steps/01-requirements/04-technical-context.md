---
step_id: "01-04"
title: "Technical Context"
persona: "business-analyst"
depth: "standard"
outputs:
  - "requirements-spec.md"
depends_on: ["01-01"]
skip_if: ""
research: true
---

## Brief Mode

Maya Chen: The technical context includes: runtime {runtime}, module system {module system}, existing patterns {patterns}. Key constraints: {constraints}. Does this match your understanding?

## Standard Mode

Maya Chen: Let's capture the technical landscape that shapes our requirements.

1. What existing technical patterns, conventions, or frameworks must this feature follow?
2. Are there any hard technical constraints (language version, backward compatibility, performance thresholds)?
3. What are the key integration points -- which existing modules, APIs, or systems does this feature touch?

I need this context to write requirements that are technically feasible and follow existing conventions.

## Deep Mode

Maya Chen: I want a complete picture of the technical context.

1. What language, runtime, and framework versions are in play?
2. What module system does the project use? Are there any hybrid patterns (e.g., ESM + CJS)?
3. What existing architectural patterns must this feature follow? (naming conventions, file structure, configuration approach)
4. What are the hard constraints? (backward compatibility, no breaking changes, performance targets)
5. What external dependencies or third-party libraries are relevant?
6. Are there any known technical debt items that could affect this work?

I'll document each constraint and cross-reference with the user journeys.

## Validation

- At least one technical constraint is identified
- Integration points with existing code are documented
- If backward compatibility is required, the scope of compatibility is defined
- Edge case: if user says "no constraints," verify by checking codebase conventions

## Artifacts

- Update `requirements-spec.md` in the artifact folder:
  - Section: "4. Technical Context"
  - Content: Technical constraints, integration points, conventions
  - Include: Runtime requirements, compatibility constraints, dependency notes
