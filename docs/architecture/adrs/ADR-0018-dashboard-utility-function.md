# ADR-0018: Dashboard Rendering via Utility Function

## Status
Accepted

## Context
FR-007 requires a completion dashboard displaying per-phase timings, budget consumption, degradation counts, and regression status. The dashboard could be:
- A: Rendered inline in `isdlc.md` as prose instructions for the LLM
- B: A utility function in `performance-budget.cjs` that produces formatted text

Since `isdlc.md` is a markdown command executed by the LLM (not a Node.js script), it cannot literally call `require().formatCompletionDashboard()`. The utility function serves as a reference implementation and is called by `workflow-completion-enforcer.cjs` (which IS a Node.js script).

## Decision
Create `formatCompletionDashboard()` in `performance-budget.cjs`. The function accepts structured data (phase timings, budget, regression check) and returns a multi-line formatted string. `isdlc.md` defines the exact format specification that the LLM renders, mirroring the utility function's output.

## Rationale
- The dashboard has 6 acceptance criteria (AC-007a through AC-007f) with conditional formatting logic
- Embedding this logic as natural-language instructions would produce inconsistent output across LLM invocations
- A utility function produces deterministic, testable output
- The function is callable by `workflow-completion-enforcer.cjs` for the `workflow_history` entry
- `isdlc.md` references the format by example, minimizing drift

## Consequences
**Positive:**
- Testable format specification (6 unit tests)
- Deterministic output in Node.js contexts
- Documented spec for LLM contexts
- Single source of truth for dashboard format

**Negative:**
- Slight duplication between utility function and isdlc.md prose specification
- Mitigation: isdlc.md references the format spec by example, not by reimplementation

## Traces
- FR-007, AC-007a through AC-007f
- Article IV (Explicit Over Implicit): Dashboard format is fully specified, not left to LLM interpretation
