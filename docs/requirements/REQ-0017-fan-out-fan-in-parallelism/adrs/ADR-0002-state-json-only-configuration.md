# ADR-0002: Use state.json Exclusively for Fan-Out Configuration (No workflows.json)

## Status

Accepted

## Context

FR-007 specifies that fan-out parameters should be configurable, and AC-007-02 states "Per-workflow overrides can be specified in workflows.json agent_modifiers for Phase 16 and Phase 08."

However, the impact analysis (M3) discovered that **workflows.json does not exist on disk**. The `loadWorkflowDefinitions()` function in `common.cjs` checks two paths for `workflows.json` and returns `null` from both. The `agent_modifiers` mechanism described in `isdlc.md` (STEP 3d) reads from `workflows.json`, but since the file does not exist, agent modifiers are never applied in practice.

We need to decide: create `workflows.json` to satisfy AC-007-02 literally, or use state.json exclusively for all fan-out configuration.

### Options Considered

1. **Create workflows.json** with fan-out agent modifiers for feature and fix workflows.
2. **Use state.json exclusively** with a `fan_out` section and `phase_overrides`, plus the `--no-fan-out` CLI flag stored in `active_workflow.flags`.

## Decision

We will use **Option 2: state.json exclusively** for all fan-out configuration.

The `fan_out` section in state.json provides:
- `fan_out.enabled`: Global enable/disable
- `fan_out.defaults`: Default max_agents, timeout
- `fan_out.phase_overrides[phase_key]`: Per-phase thresholds, strategy, enable/disable

The `--no-fan-out` CLI flag is stored in `active_workflow.flags.no_fan_out`.

AC-007-02 is satisfied through the `phase_overrides` mechanism in state.json, which provides the same per-workflow-type configurability without requiring a new file.

## Consequences

### Positive

- **No new configuration file**: Does not introduce workflows.json, which would need discovery logic, documentation, and hook support.
- **Single source of truth**: All runtime configuration lives in state.json. No ambiguity about which file takes precedence.
- **Simpler**: One file to read, one schema to validate (Article V: Simplicity First).
- **Backward compatible**: Existing state.json files without `fan_out` section get all defaults.
- **Existing hook support**: All hooks already read state.json. No new file loading logic needed.

### Negative

- **Deviates from AC-007-02 literal text**: AC-007-02 mentions "workflows.json agent_modifiers". The spirit of the requirement (per-workflow configuration) is satisfied through phase_overrides, but the letter references a file that does not exist.
- **No per-workflow-type differentiation**: The `phase_overrides` keyed by phase_key apply to all workflow types equally. If different fan-out thresholds are needed for "feature" vs "fix" workflows for the same phase, this would require additional schema (e.g., `phase_overrides["16-quality-loop"]["feature"]`). This is not currently required (no requirement specifies different thresholds per workflow type).

### Mitigation for AC-007-02

The requirements-spec.md AC-007-02 states: "Per-workflow overrides can be specified in workflows.json agent_modifiers."

This ADR proposes a clarification: The `phase_overrides` mechanism in state.json provides equivalent functionality. If per-workflow-type differentiation is needed in the future, `phase_overrides` can be extended with workflow-type keys. This is documented as a `[FUTURE EXTENSION]` rather than a current requirement.

## Alternatives Rejected

### Option 1: Create workflows.json

Rejected because:
- workflows.json has never existed; creating it introduces a new configuration surface
- All hooks that call `loadWorkflowDefinitions()` currently handle the null case gracefully (return null)
- Introducing a real workflows.json could cause unexpected behavior in other hooks that check for it
- The benefit (per-workflow-type overrides) is not required by any current acceptance criterion beyond the literal mention in AC-007-02
- Adding a new file violates Article V (Simplicity First) when state.json suffices

## Traces

- FR-007 (Configuration & Overrides)
- AC-007-01 (state.json fan_out section)
- AC-007-02 (Per-workflow overrides -- satisfied via phase_overrides)
- AC-007-03 (--no-fan-out flag)
- Impact Analysis M3: "workflows.json does not exist on disk"
- Article V (Simplicity First)
