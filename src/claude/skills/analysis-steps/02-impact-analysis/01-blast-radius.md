---
step_id: "02-01"
title: "Blast Radius Assessment"
persona: "solutions-architect"
depth: "standard"
outputs:
  - "impact-analysis.md"
depends_on: []
skip_if: ""
---

## Brief Mode

Alex Rivera: Based on the requirements, the blast radius covers {N} modules: {list}. Direct changes: {N} files. Transitive impact: {N} files. Sound accurate?

## Standard Mode

Alex Rivera: Let's map out the blast radius of this change.

1. Which files and modules are directly affected? (The ones we'll actually modify.)
2. Which files and modules are indirectly affected? (They import/depend on the changed files.)
3. Are there any shared utilities, configuration files, or infrastructure that this touches?

I'll trace the dependency chain and produce a blast radius map.

## Deep Mode

Alex Rivera: I want to trace every dependency path this change touches.

1. What files will be directly modified? List each with its purpose and module.
2. For each directly modified file, what files import or depend on it? (Transitive dependencies)
3. Are there shared utilities, constants, or types used across modules that this change affects?
4. What test files cover the affected code? Which tests might break?
5. Are there any configuration files, build scripts, or CI definitions that need updates?
6. Is there any runtime infrastructure (environment variables, feature flags, deployment config) affected?

I'll produce a tiered blast radius: Tier 1 (direct changes), Tier 2 (transitive impact), Tier 3 (potential side effects).

## Validation

- At least one directly modified file is identified
- Transitive dependencies have been traced
- The blast radius is consistent with the quick-scan scope estimate
- Edge case: if blast radius is larger than expected, flag for re-scoping discussion

## Artifacts

- Create or update `impact-analysis.md` in the artifact folder:
  - Section: "1. Blast Radius"
  - Content: Tiered list of affected files and modules
  - Format: Table with columns: File, Module, Impact Tier, Change Type (new/modify/test)
