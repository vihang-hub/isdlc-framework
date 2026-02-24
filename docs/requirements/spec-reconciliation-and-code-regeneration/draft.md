# Spec Reconciliation Phase and Selective Code Regeneration

> **Source**: manual
> **Added**: 2026-02-20

## Problem

In iSDLC, specifications are necessary but insufficient to regenerate code. Implementation discovers knowledge (integration quirks, performance optimizations, error handling edge cases) that lives in code but never flows back to specs. This makes code non-disposable — unlike Spec-Kit's model where specs are sufficient to regenerate code from scratch.

The gap: implementation decisions leak into code but never flow upstream to specifications.

## Proposed Capability

Close the spec-code knowledge gap so that code becomes regenerable from complete specifications:

1. **Spec reconciliation phase** — after implementation, an agent scans code for decisions not captured in specs and proposes spec updates. User approves. Now spec is sufficient to reproduce the code.

2. **Regeneration command** — `/isdlc regenerate REQ-NNNN` takes complete spec artifacts and regenerates implementation from scratch, then runs the quality loop.

3. **Regeneration confidence score** — based on spec completeness. High = safe to regenerate. Low = spec has gaps, regeneration risky.

4. **Selective disposability** — new features with complete specs are disposable. Legacy code that predates the framework is not. The system knows the difference.

## Key Insight

iSDLC's position would be stronger than Spec-Kit's: rather than assuming specs are sufficient *before* implementation, iSDLC would acknowledge you often can't know everything upfront, but you can close the loop *afterward* through post-implementation reconciliation.

## Context

Inspired by competitive analysis of iSDLC vs GitHub Spec-Kit (see `docs/requirements/isdlc-vs-spec-kit-analysis/competitive-analysis.md`). Spec-Kit treats code as disposable because specs are the generative source. iSDLC currently treats code as an asset because specs are governance documents, not generative ones.
