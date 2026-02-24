# ADR-0003: Fail-Open Verification Design

## Status

Accepted

## Context

REQ-0015 NFR-02 requires that M4 failure must NOT block Phase 02 progression. This aligns with constitutional Article X (Fail-Safe Defaults) and the framework-wide principle that hooks and agents fail-open on errors.

The question is how to implement fail-open behavior for the M4 step in the orchestrator.

**Requirement references**: NFR-02, Article X, Article X item 6

## Decision

Implement **orchestrator-level fail-open handling** with three tiers:

### Tier 1: Agent Existence Check
Before invoking M4, the orchestrator checks if the cross-validation-verifier agent file exists. If not, skip the entire Step 3.5 silently (no warning, no error).

### Tier 2: Task Call Error Handling
If the M4 Task call fails (timeout, runtime error), the orchestrator:
1. Logs a WARNING message visible to the user
2. Sets `verification_status = "incomplete"`
3. Proceeds to consolidation without M4 output
4. Records M4 status as "skipped" in state.json

### Tier 3: Malformed Response Handling
If M4 returns a response that cannot be parsed (missing `verification_report`, wrong structure), the orchestrator:
1. Logs a WARNING message
2. Treats it the same as Tier 2 (incomplete)
3. Proceeds to consolidation

### Report Behavior by Tier

| Tier | Report Impact | State Impact |
|------|---------------|--------------|
| Tier 1 (not found) | No Cross-Validation section | No M4 entry in sub_agents |
| Tier 2 (call failed) | Note: "verification incomplete" | M4 status: "skipped" |
| Tier 3 (bad response) | Note: "verification incomplete" | M4 status: "skipped" |

## Rationale

1. **Three-tier design covers all failure modes**: Missing agent (framework version mismatch), runtime failure (LLM error), and output parsing failure (prompt quality issue).

2. **Orchestrator-level handling**: The orchestrator is the right place for error handling because it controls the pipeline flow. M4 itself should not handle its own failure -- if M4 crashes, it cannot log a graceful warning.

3. **Silent skip for missing agent (Tier 1)**: This ensures backward compatibility. An older framework version without the M4 agent file should work exactly as before, without warnings.

4. **Warning for runtime failures (Tier 2/3)**: Users should know when verification was skipped due to an actual error, so they can decide if they want to re-run.

## Consequences

**Positive:**
- Phase 02 always completes, regardless of M4 status
- Backward compatible with older framework versions
- Users are informed when verification is incomplete
- State.json accurately records what happened

**Negative:**
- No automatic retry (by design -- a single Task call failure is unlikely to succeed on immediate retry, and retrying would double the overhead)
- Users may miss the warning message in verbose output

## Alternatives Considered

1. **Retry once on failure**: Would add another 10-30 seconds of overhead. If the failure is due to a prompt issue or LLM error, retry is unlikely to help. If it is a transient network issue, the entire Claude Code session would likely be affected, not just M4.

2. **M4 self-healing**: M4 could catch its own errors and return a "no findings" report. This is fragile -- if M4 crashes, it cannot execute error handling.

3. **Blocking on CRITICAL findings**: If M4 finds CRITICAL inconsistencies, block Phase 02 and require human review. This violates NFR-02 (fail-open) and would make M4 a potential workflow bottleneck.
