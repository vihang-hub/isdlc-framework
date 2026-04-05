# Requirements Specification: ATDD Default Mode Across All Shared Build/Test Workflows (Codex)

**Slug**: REQ-GH-216-atdd-default-codex
**Source**: GitHub Issue #216
**Type**: Enhancement
**Version**: 1.0.0

---

## Functional Requirements

- **FR-001: Remove workflow-level ATDD opt-in**
  - `--atdd` is removed as a user-selectable workflow option anywhere shared implementation/testing workflow definitions are used.
  - `_when_atdd_mode` workflow modifier branches are removed from workflow definitions and their behavior becomes unconditional.
  - `atdd_mode` is no longer required in `active_workflow.options` or sibling workflow state to activate ATDD behavior.

- **FR-002: Make Phase 05 ATDD generation unconditional**
  - Phase 05 always derives acceptance-test scaffolds from acceptance criteria before implementation begins.
  - Phase 05 always assigns P0-P3 priorities to acceptance-driven tests and generates `docs/isdlc/atdd-checklist.json`.
  - Phase 05 prompt guidance no longer describes ATDD as an optional alternate mode.

- **FR-003: Make Phase 06 ATDD execution unconditional**
  - Phase 06 always follows RED to GREEN execution against the ATDD checklist in strict P0 to P3 order.
  - Phase 06 no longer branches between “standard mode” and “ATDD mode” for acceptance-test execution behavior.
  - Phase 06 parallel-test guidance must explicitly exclude acceptance-priority execution because priority ordering is now the default contract.

- **FR-004: Make Phase 07 and hook-level ATDD validation unconditional**
  - ATDD validation requirements in `iteration-requirements.json` are always enabled for shared implementation/testing phases and no longer gated by `when: "atdd_mode"`.
  - Post-bash validation and test-watcher behavior always evaluate ATDD completeness for active workflows that use the shared Phase 05/06/07 pipeline.
  - ATDD completion checks continue to fail open observationally where already designed that way, but must always run.

- **FR-005: Preserve discover-time ATDD bridge as separate behavior**
  - `/discover --atdd-ready` remains a discover/orchestration feature and is not removed by this change.
  - Discover documentation and agents must distinguish reverse-engineering preparation from workflow execution defaults.

- **FR-006: Align user-facing and agent-facing documentation**
  - Claude command docs, workflow docs, and agent specs must describe ATDD as the default execution contract rather than an optional mode.
  - References that imply `/isdlc ... --atdd` as the normal invocation path must be updated or removed.
  - Documentation must make clear that all shared Phase 05/06 workflow paths now inherit ATDD behavior, including `test-generate`.

## Assumptions and Inferences

- The repo’s shared implementation pipeline currently covers `build` and `test-generate`, and the user explicitly clarified that GH-216 should apply “for all” such paths rather than only feature/fix wording from the issue text.
- The issue text says “feature and fix workflows,” but the implementation is phase-centric rather than workflow-name-centric. I infer the correct design boundary is every workflow that passes through shared Phase 05/06/07 logic.
- I infer Phase `07-testing` in `iteration-requirements.json` remains in scope because unconditional ATDD validation there is required to keep the always-on model coherent, even though the issue body emphasized Phases 05 and 06.
- I infer backward compatibility for stale `state.json` fields is desirable at runtime during transition, but the canonical configuration and docs should stop depending on `atdd_mode`.
- I infer `/discover --atdd-ready` should stay separate because its references describe reverse-engineering preparation, not opt-in execution mode, and the user did not ask to remove it.

## Non-Functional Requirements

- **Consistency**: Shared config, hooks, prompts, and docs must express one ATDD execution model with no contradictory optional-mode branches.
- **Provider parity**: Claude-oriented prompt docs and Codex/provider-neutral routing logic must converge on the same default behavior.
- **Migration safety**: Transitional code paths may tolerate stale `atdd_mode` values during rollout, but new behavior must not require them.
- **Traceability**: Acceptance criteria to test mapping and checklist tracking remain explicit artifacts, not implicit behavior.

## Out of Scope

- Redesigning `/discover --atdd-ready` or removing ATDD bridge artifacts from reverse-engineering flows.
- Changing acceptance-test priority semantics beyond making them the default.
- Introducing a new workflow family or reordering build phases.
- Solving unrelated stale requirement documents that still mention historical `atdd_mode` patterns.

## Prioritization

- **P0**
  - Remove config and hook gating on `atdd_mode`.
  - Make Phase 05/06/07 ATDD requirements unconditional.
  - Update core workflow and agent documentation so the default behavior is unambiguous.

- **P1**
  - Clean up transitional runtime checks to prefer always-on execution while remaining tolerant of stale state.
  - Update tests that currently assert optional ATDD activation.

- **P2**
  - Update secondary docs and requirement artifacts that still cite `/isdlc ... --atdd` as the recommended path.
