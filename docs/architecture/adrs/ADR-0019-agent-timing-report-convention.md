# ADR-0019: Agent Reporting via PHASE_TIMING_REPORT Convention

## Status
Accepted

## Context
FR-001e and FR-001f require recording debate rounds used and fan-out chunks per phase. Phase agents must communicate these counts back to the phase-loop controller. Three options were evaluated:

| Option | Mechanism | Pros | Cons |
|--------|-----------|------|------|
| A. Agent return value | Agent includes `PHASE_TIMING_REPORT: {...}` in Task result text | No state.json writes by agents; clean separation | Requires parsing unstructured text; agent must remember to include it |
| B. State.json writes by agents | Agent writes `phases[phase_key].timing.debate_rounds_used` directly | Simple; data immediately in state.json | Violates existing pattern where agents do NOT write timing fields; state-write-validator may block |
| C. Orchestrator inference | Orchestrator reads agent logs/output and infers counts | No agent changes needed | Fragile; counts not reliably inferable from text |

## Decision
Option A with safe defaults. The delegation prompt in STEP 3d instructs agents to include a `PHASE_TIMING_REPORT:` line. STEP 3e parses the return text. If not found, defaults to 0 for both counts.

This follows the existing pattern where agents produce structured output blocks (e.g., `SCOPE_ESTIMATE:`, `SIZING_METADATA:`) and the orchestrator parses them.

## Rationale
- No state-write-validator changes needed
- Agents are told what to report via the delegation prompt
- Fail-safe defaults when agents do not comply (under-report, never over-report)
- Consistent with established structured-output-block conventions

## Consequences
**Positive:**
- Clean separation of concerns (agents produce data, orchestrator persists it)
- No hook changes needed (state-write-validator unchanged)
- Fail-open: missing report defaults to 0

**Negative:**
- Text parsing is inherently fragile
- Mitigation: defaults of 0 are safe; data is observability-only, not enforcement

## Traces
- FR-001e, FR-001f, FR-004, FR-005
- ADR-0003 in architecture-overview.md (expanded here)
- Article X (Fail-Safe Defaults): Defaults to 0 when report is missing
