---
step_id: "02-03"
title: "Risk Zone Analysis"
persona: "solutions-architect"
depth: "deep"
outputs:
  - "impact-analysis.md"
depends_on: ["02-01"]
skip_if: ""
---

## Brief Mode

Alex Rivera: The highest-risk areas are: {risk 1}, {risk 2}. Mitigation: {strategy}. Risk level overall: {low/medium/high}. Does this match your assessment?

## Standard Mode

Alex Rivera: Let's identify the high-risk areas in this change.

1. Which parts of the affected code have the lowest test coverage or are most fragile?
2. Are there any shared components or critical paths that, if broken, would cause widespread failure?
3. What is the rollback strategy if something goes wrong during implementation?

I'll produce a risk matrix and recommend mitigation strategies.

## Deep Mode

Alex Rivera: I want to identify every risk zone and design mitigations.

1. Which affected files are in critical paths (used by many other modules)?
2. Which affected areas have low test coverage? How confident are we in the existing tests?
3. Are there any race conditions, concurrency issues, or ordering dependencies?
4. What are the data integrity risks? Can this change corrupt existing data?
5. Are there backward compatibility risks? Will this break existing users or workflows?
6. For each identified risk: what is the likelihood (low/medium/high), impact (low/medium/high), and proposed mitigation?

I'll produce a comprehensive risk matrix and flag any risks that need architectural mitigation before implementation begins.

## Validation

- At least one risk zone is identified
- Each risk has a likelihood and impact assessment
- Mitigation strategies are proposed for medium and high risks
- Edge case: if user says "no risks," verify by checking the blast radius against test coverage

## Artifacts

- Update `impact-analysis.md` in the artifact folder:
  - Section: "4. Risk Zones"
  - Content: Risk matrix table
  - Format: Table with columns: Risk, Area, Likelihood, Impact, Mitigation
