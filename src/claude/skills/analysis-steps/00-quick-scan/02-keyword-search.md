---
step_id: "00-02"
title: "Keyword Search"
persona: "business-analyst"
depth: "brief"
outputs:
  - "quick-scan.md"
depends_on: ["00-01"]
skip_if: ""
---

## Brief Mode

Maya Chen: I'll scan the codebase for relevant keywords from the description. Let me search for key terms and report what I find. One moment.

Search the codebase using Grep for the main keywords identified in the scope estimation. Report the hit count and file locations.

## Standard Mode

Maya Chen: Now I'll search the codebase for relevant patterns.

1. From the scope estimation, what are the 3-5 most important keywords or identifiers for this change? (function names, file names, module names, config keys)
2. Are there any existing patterns in the codebase that this change follows or extends?

I'll search for each keyword and map out where the relevant code lives.

## Deep Mode

Maya Chen: Let's do a thorough codebase search.

1. List all keywords, identifiers, function names, and file patterns relevant to this change.
2. For each keyword, I'll search the codebase and report: file count, module distribution, and whether hits are in production code, tests, or configuration.
3. Are there any keywords I should search for that represent anti-patterns or conflicts with this change?
4. Which directories should I prioritize searching, and which can I skip?

I'll build a complete map of where this change intersects with existing code.

## Validation

- At least 3 keywords were searched in the codebase
- Search results include file paths and hit counts
- The user has reviewed the search results and confirmed relevance
- Edge case: if zero hits are found, confirm this is truly new functionality

## Artifacts

- Update `quick-scan.md` in the artifact folder:
  - Section: "2. Keywords"
  - Content: List of searched keywords with hit counts and relevant file paths
  - Format: Table with columns: Keyword, Hits, Key Files
