---
step_id: "00-03"
title: "File Count Estimation"
persona: "business-analyst"
depth: "brief"
outputs:
  - "quick-scan.md"
depends_on: ["00-02"]
skip_if: ""
---

## Brief Mode

Maya Chen: Based on the keyword search, I estimate this change affects approximately {N} files: {X} new, {Y} modified, {Z} test files. Confidence: {low/medium/high}. Final scope: {small/medium/large}. Does this match your expectations?

## Standard Mode

Maya Chen: Let me refine the file count using our keyword search results.

1. Based on the search hits, how many files need to be created vs modified?
2. How many test files will be needed? (Typically 1 test file per new module.)
3. Are there any configuration files, documentation, or migration files to account for?

I'll produce a final file count breakdown and scope classification.

## Deep Mode

Maya Chen: Let's produce a precise file inventory.

1. For each search hit, classify the file: new, modify, test, config, docs, or migration.
2. Are there any files that appear in search results but should NOT be changed?
3. What is the dependency chain -- if file A changes, do files B and C also need updates?
4. Are there any generated files or build artifacts that will change as a side effect?
5. What is your confidence level in this estimate: high (well-understood), medium (some unknowns), or low (significant uncertainty)?
6. Based on all this, what is the final scope: small (1-5 files), medium (6-15 files), or large (16+ files)?

## Validation

- A file count has been produced with new/modify/test breakdown
- A confidence level has been assigned
- The scope classification is consistent with the file count
- Edge case: if file count disagrees with initial scope estimate, reconcile

## Artifacts

- Update `quick-scan.md` in the artifact folder:
  - Section: "3. File Count"
  - Content: File count breakdown table (new, modify, test, config, docs)
  - Include: Total file count, confidence level
  - Section: "4. Final Scope"
  - Content: Final scope classification with summary rationale
