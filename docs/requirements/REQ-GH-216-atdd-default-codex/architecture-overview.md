# Architecture Overview: ATDD Default Mode Across All Shared Build/Test Workflows (Codex)

**Slug**: REQ-GH-216-atdd-default-codex
**Version**: 1.0.0

---

## Architecture Options

- **Option A: Unconditional ATDD contract in shared workflow/config/hook layers**
  - Remove workflow option gating, promote ATDD modifiers to the base config, and run validators/watchers unconditionally for workflows using shared implementation/testing phases.
  - Pros: matches user intent, removes split-brain behavior, smallest conceptual model.
  - Cons: touches config, prompts, hooks, and tests at once.
  - Verdict: **Selected**.

- **Option B: Keep `atdd_mode` in state but force it true everywhere**
  - Preserve the flag mechanically while setting it by default for all eligible workflows.
  - Pros: smaller code diff in some places.
  - Cons: keeps dead branching and optional-mode language alive, undermining the point of GH-216.
  - Verdict: Rejected.

- **Option C: Apply unconditional ATDD only to `build`**
  - Remove the option from feature/fix build only, leave shared Phase 05/06 logic conditional elsewhere.
  - Pros: narrower change.
  - Cons: inconsistent shared phase behavior; contradicts user clarification that scope is “for all.”
  - Verdict: Rejected.

## Selected Architecture

- **ADR-001: Phase-centric default beats workflow-name-centric default**
  - Shared Phase 05/06/07 behavior becomes the authority boundary.
  - Any workflow using that shared path inherits unconditional ATDD generation, execution, and validation.

- **ADR-002: Configuration expresses only one ATDD path**
  - `workflows.json` and `.isdlc/config/workflows.json` stop expressing `_when_atdd_mode` branches for shared build/test phases.
  - Iteration requirements stop expressing ATDD as a conditional requirement.

- **ADR-003: Hooks observe default ATDD behavior directly**
  - `post-bash-dispatcher`, `atdd-completeness-validator`, and `test-watcher` stop depending on `active_workflow.options.atdd_mode` as the activation switch.
  - Validation remains fail-open where already observational, but is no longer selectively skipped.

- **ADR-004: Discover bridge remains a separate integration surface**
  - `/discover --atdd-ready` continues to prepare reverse-engineered artifacts for the now-default workflow behavior.
  - Discover-time bridge docs are updated only enough to avoid implying execution ATDD is still optional.

## Technology Decisions

- **Workflow config as source of truth**
  - Primary files: `src/isdlc/config/workflows.json`, `.isdlc/config/workflows.json`.
  - Rationale: the optional-mode split is encoded here first.

- **Iteration requirements as gate authority**
  - Primary file: `src/isdlc/config/iteration-requirements.json`.
  - Rationale: always-on ATDD must be reflected in gate policy, not only prompt prose.

- **Hook dispatch and validators as runtime enforcement**
  - Primary files: `src/claude/hooks/dispatchers/post-bash-dispatcher.cjs`, `src/claude/hooks/atdd-completeness-validator.cjs`, `src/claude/hooks/test-watcher.cjs`, `src/core/validators/checkpoint-router.js`.
  - Rationale: they currently encode optional ATDD activation assumptions.

- **Prompt docs as execution contract**
  - Primary files: `src/claude/agents/04-test-design-engineer.md`, `src/claude/agents/05-software-developer.md`, `src/claude/agents/06-integration-tester.md`, plus top-level command/docs references.
  - Rationale: user experience remains contradictory unless prompts stop describing ATDD as a separate mode.

## Integration Architecture

- **INT-001: Workflow definition to runtime state**
  - Current: workflow config may inject ATDD modifiers only when `atdd_mode` is present.
  - Target: workflow config always injects ATDD behavior for shared build/test phases.

- **INT-002: Iteration requirements to runtime gate behavior**
  - Current: `atdd_validation` blocks are guarded by `when: "atdd_mode"`.
  - Target: `atdd_validation` is always active for affected phases.

- **INT-003: Post-bash dispatcher to ATDD validator**
  - Current: dispatcher activates ATDD validator only when `active_workflow.options.atdd_mode` is true.
  - Target: dispatcher activates validator for any active shared implementation/testing workflow.

- **INT-004: Test watcher to iteration tracking**
  - Current: watcher has a dedicated `isATDDMode(state)` path.
  - Target: ATDD-aware skip/priority handling becomes part of normal shared workflow tracking.

- **INT-005: Discover bridge to default execution workflow**
  - Current: discover bridge produces artifacts compatible with `/isdlc feature --atdd`.
  - Target: discover bridge produces artifacts compatible with the default workflow path, without changing bridge existence.

## Assumptions and Inferences

- The mirrored `.isdlc/config/workflows.json` should stay aligned with `src/isdlc/config/workflows.json`; changing only one would produce immediate dogfood drift.
- `test-generate` is in scope because it uses the same Phase 05/06 implementation path and otherwise would retain a partially optional ATDD runtime.
- A small amount of backward-compatible tolerance for stale `atdd_mode` reads may remain in transitional code, but the selected architecture assumes new writes and docs stop relying on it.
- Historical requirement docs that mention `_when_atdd_mode` are architectural residue, not blockers for adopting the new default.
