# ADR-0004: Clarify no_phase_skipping Rule Semantics

## Status
Accepted

## Context

The `workflows.json` configuration file contains:
```json
{
  "rules": {
    "no_phase_skipping": true
  }
}
```

This rule was designed to prevent agents from skipping phases at runtime -- ensuring the full workflow is executed in order. However, adaptive workflow sizing (REQ-0011) intentionally removes phases from the workflow array (Phase 03 and Phase 04 for light intensity).

This creates an apparent contradiction: the rule says "no phase skipping" but the feature removes phases. Several resolution strategies were considered:
1. Remove the rule entirely
2. Add an exception for sizing
3. Rename the rule to clarify its semantic scope
4. Add a new rule alongside the existing one

## Decision

Rename `no_phase_skipping` to `no_agent_phase_skipping` in workflows.json and add a comment clarifying the semantic distinction:

```json
{
  "rules": {
    "no_agent_phase_skipping": true,
    "_comment_phase_skipping": "Agents cannot skip phases at runtime. Framework-level sizing modifications to the phase array (REQ-0011) are permitted before phases are encountered."
  }
}
```

The semantic distinction is:
- **Agent-level skipping** (forbidden): An agent attempting to advance past a phase without completing it. Enforced by `gate-blocker.cjs` and `phase-sequence-guard.cjs`.
- **Framework-level array modification** (permitted): The Phase-Loop Controller modifying `active_workflow.phases` based on sizing logic, before any agent encounters the removed phases. From the perspective of agents and hooks, the removed phases never existed.

## Consequences

**Positive:**
- The rule's intent is preserved (agents cannot skip phases)
- The new name is unambiguous
- The comment provides context for future developers
- Hooks that reference this rule (`gate-blocker.cjs`) already validate against `active_workflow.phases` (the modified array), so no hook logic changes are needed for this rename
- The distinction is meaningful: agents are LLM-interpreted, framework steps are controller-logic

**Negative:**
- Renaming a configuration key is a breaking change if any code references it by exact name
- The JSON comment field (`_comment_phase_skipping`) adds non-standard metadata

**Mitigations:**
- Grep confirms only `gate-blocker.cjs` reads the rules block, and it checks `rules.no_phase_skipping` as a boolean. Updating this single reference is trivial.
- The `_comment` prefix is an established convention in the codebase (workflows.json uses `_when_atdd_mode`)

## Alternatives Considered

**Remove the rule entirely**
- Rejected: the rule serves an important purpose (preventing agents from bypassing quality gates). Removing it would weaken the enforcement model.

**Add an exception mechanism**
- Rejected: over-engineering. Adding `"exceptions": ["sizing"]` or similar would require exception-parsing logic in hooks. The rename is simpler and clearer.

**Keep the old name with a comment**
- Rejected: the name "no_phase_skipping" is actively misleading after REQ-0011 adds phase removal. The rename removes the ambiguity at the source.

## Traces To
FR-05 (AC-15), NFR-02 (Backward Compatibility), Article IX (Quality Gate Integrity)
