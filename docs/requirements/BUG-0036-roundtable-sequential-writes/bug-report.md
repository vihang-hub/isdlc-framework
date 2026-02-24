# Bug Report: BUG-0036-MAN

**Bug ID:** BUG-0036
**External Link:** None
**External ID:** MAN (manual entry — identified through direct observation)
**Severity:** Medium
**Status:** Fix Applied
**Date Reported:** 2026-02-24
**Affected File:** `src/claude/agents/roundtable-analyst.md` (Section 5.5, lines 467-476)

---

## Summary

The roundtable-analyst agent writes all 11 artifacts sequentially (one per turn) during finalization, taking approximately 5.5 minutes. Section 5.5 of the agent file already stated that artifacts should be written in parallel, but the instructions were too weak — just 2 lines saying "write ALL artifacts in a SINGLE response." The agent's default behavior overrode these insufficient instructions.

## Expected Behavior

During finalization (Section 5.5, Turn 2), the roundtable-analyst agent should:

1. Generate all 11 artifact contents in memory first
2. Issue all Write tool calls in a single response (parallel writes)
3. Complete all artifact writes in approximately 30 seconds (1-2 turns maximum)

## Actual Behavior

The agent writes one artifact per turn in a sequential generate-write-generate-write loop:

1. Generate content for artifact 1 -> Write call -> wait for response
2. Generate content for artifact 2 -> Write call -> wait for response
3. ... repeated 11 times
4. Total time: approximately 5.5 minutes (11 turns instead of 1-2)

## Reproduction Steps

1. Run a roundtable analysis workflow through to completion (finalization phase)
2. Observe Turn 2 of the Section 5.5 finalization sequence
3. The agent generates and writes one artifact per turn, then proceeds to the next in a separate turn
4. Count the number of turns used for artifact writing — it will be 11 instead of 1-2

## Root Cause

The original Turn 2 instructions in Section 5.5 consisted of only 2 lines:

```
**Turn 2 — Parallel Write (all artifacts):**
1. Write ALL artifacts in a SINGLE response using parallel Write tool calls
2. After ALL writes complete, proceed to Turn 3.
```

This phrasing was insufficient to override the agent's default behavior of handling one artifact at a time. The instructions lacked:

- An explicit anti-pattern prohibition (telling the agent what NOT to do)
- A memory-first generation requirement (generate all content before any writes)
- A concrete batching fallback (what to do if 11 parallel calls exceed capacity)

## Fix Description

Section 5.5 Turn 2 was replaced with a stronger 8-line version that includes:

1. **Anti-pattern prohibition:** Explicitly marks sequential one-artifact-per-turn writing as FORBIDDEN
2. **Memory-first requirement:** Mandates generating ALL artifact content in memory before issuing any Write calls
3. **Parallel write mandate:** Requires ALL Write tool calls in a SINGLE response (up to 11 parallel calls)
4. **Owner-based batching fallback:** If 11 parallel writes exceed tool-call capacity, batch by owner in 2 responses max:
   - Batch A: quick-scan.md, requirements-spec.md, user-stories.json, traceability-matrix.csv, impact-analysis.md, architecture-overview.md
   - Batch B: module-design.md, interface-spec.md, error-taxonomy.md, data-flow.md, design-summary.md

## Environment

- Framework: iSDLC v0.1.0-alpha
- Runtime: Claude Code agent runtime
- Agent: `src/claude/agents/roundtable-analyst.md`

## Impact

- **Performance:** ~5.5 minute finalization reduced to ~30 seconds (estimated 10x improvement)
- **User experience:** Users no longer wait through 11 sequential write turns
- **Functional impact:** None — artifact content is identical; only write sequencing changes
- **Risk:** Low — documentation-only change to agent instructions, no code logic changes
