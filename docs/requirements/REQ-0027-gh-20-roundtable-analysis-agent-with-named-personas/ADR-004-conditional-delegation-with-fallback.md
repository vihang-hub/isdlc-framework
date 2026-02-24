# ADR-004: Conditional Delegation with Graceful Fallback

## Status

Accepted

## Context

The roundtable agent is introduced as an alternative delegation target for the analyze verb's phase execution (step 7 of the analyze handler). The design question is how to integrate it into the existing delegation flow without breaking the existing behavior.

Requirements context:
- FR-009 (analyze verb integration) specifies that the roundtable agent is used when present
- FR-009 AC-009-04 specifies graceful fallback when the roundtable agent is absent
- NFR-005 (backward compatibility) requires zero regression in existing analyze behavior
- CON-002 specifies the roundtable is analyze-only (build verb unaffected)
- `isdlc.md` is the most critical file in the framework (1717 lines, risk R10 from impact analysis)

## Decision

Use a **conditional existence check** at step 7 of the analyze verb handler. Before delegating to a phase agent, check whether `roundtable-analyst.md` exists. If it does, delegate to the roundtable agent. If not, delegate to the standard phase agent as before.

The check is a simple file existence test, not a feature flag or configuration setting.

```
Step 7 (modified):
  For each remaining phase:
    IF file exists: src/claude/agents/roundtable-analyst.md
      Delegate to roundtable-analyst via Task tool
    ELSE
      Delegate to standard phase agent via Task tool (existing behavior)
```

## Consequences

**Positive:**
- Zero regression risk: the else branch is exactly the current behavior
- Activation is automatic: installing the agent file activates the feature
- Deactivation is trivial: remove or rename the agent file
- Change is minimal: ~15-20 lines added to step 7 (if/else wrapper)
- No feature flag infrastructure needed
- Testable: manual verification by removing the file and confirming fallback

**Negative:**
- File existence check on every phase iteration (negligible overhead)
- No per-phase granularity: the roundtable agent handles all phases or none (cannot mix roundtable for Phase 01 and standard agent for Phase 02 in the same session)
- No user-facing toggle: the user cannot choose between roundtable and standard agents at runtime

**Mitigations:**
- Per-phase granularity is not needed: the roundtable agent is designed to handle all analysis phases. If a user wants standard behavior, they remove the agent file.
- A future enhancement could add a `--no-roundtable` flag if user-facing toggling becomes necessary.

## Implementation Approach

The modification targets lines 587-596 of isdlc.md (step 7 of the analyze handler). The change wraps the existing delegation call in a conditional:

**Before** (step 7b):
```
b. Delegate to the standard phase agent via Task tool (in ANALYSIS MODE)
```

**After** (step 7b):
```
b. Check if roundtable-analyst agent exists:
   - Read file: src/claude/agents/roundtable-analyst.md
   - IF exists: Delegate to roundtable-analyst via Task tool with:
     phase_key, meta.json content (steps_completed, depth_overrides),
     artifact_folder, quick-scan scope context.
     ANALYSIS MODE constraints apply.
   - ELSE: Delegate to standard phase agent via Task tool (existing behavior)
```

The delegation prompt for the roundtable agent includes additional context not sent to standard agents: `steps_completed`, `depth_overrides`, and `quick_scan_scope`. This enables the roundtable agent's adaptive depth and session resumption features.

## Alternatives Considered

### Feature Flag in state.json (Rejected)
- Add `"roundtable_enabled": true` to state.json
- **Rejected because**: CON-003 prohibits analyze verb writes to state.json; would require the user to manually set a flag; adds configuration surface area

### Configuration in constitution.md (Rejected)
- Add a roundtable configuration article to the constitution
- **Rejected because**: Constitutional articles are immutable governance principles, not feature flags; mixing configuration with governance violates separation of concerns

### Always Use Roundtable (No Fallback) (Rejected)
- Remove the conditional check; always delegate to roundtable-analyst
- **Rejected because**: NFR-005 AC-005-01 explicitly requires fallback when the agent is absent; makes the feature mandatory rather than opt-in via file presence

### Phase-Level Agent Override Table (Rejected)
- Create a mapping table where each phase can independently specify roundtable vs. standard agent
- **Rejected because**: Over-engineering for the initial release; no requirement for mixed-mode analysis; adds complexity to the delegation logic

## Traces

- FR-009 (analyze verb integration)
- FR-009 AC-009-04 (fallback when absent)
- NFR-005 (backward compatibility)
- CON-002 (analyze-only)
- Article V (Simplicity First)
- Article X (Fail-Safe Defaults)
