# Module Design: ATDD Default Mode Across All Shared Build/Test Workflows (Codex)

**Slug**: REQ-GH-216-atdd-default-codex
**Version**: 1.0.0

---

## Module Overview

- **Workflow configuration**
  - Files: `src/isdlc/config/workflows.json`, `.isdlc/config/workflows.json`
  - Change: remove `--atdd` option plumbing and inline ATDD behavior as the default shared phase modifier set.

- **Iteration gate configuration**
  - File: `src/isdlc/config/iteration-requirements.json`
  - Change: remove `when: "atdd_mode"` from Phase 05/06/07 ATDD validation blocks.

- **Runtime hook path**
  - Files: `src/claude/hooks/dispatchers/post-bash-dispatcher.cjs`, `src/claude/hooks/atdd-completeness-validator.cjs`, `src/claude/hooks/test-watcher.cjs`, `src/core/validators/checkpoint-router.js`
  - Change: run ATDD observation/validation as part of the default active workflow path rather than a gated side path.

- **Phase agent contracts**
  - Files: `src/claude/agents/04-test-design-engineer.md`, `src/claude/agents/05-software-developer.md`, `src/claude/agents/06-integration-tester.md`
  - Change: collapse “ATDD mode” sections into default behavior or default constraints.

- **User-facing docs and command references**
  - Files likely include `CLAUDE.md`, `docs/AGENTS.md`, `src/claude/commands/discover.md`, `src/claude/agents/discover/atdd-bridge.md`, skill docs that point users toward `/isdlc ... --atdd`
  - Change: preserve discover bridge, remove optional execution wording.

## Module Design

- **Design D1: workflow config simplification**
  - Delete the `atdd_mode` option object from shared workflow definitions.
  - Promote `_when_atdd_mode` contents under `agent_modifiers` into unconditional modifier content for the same phases.
  - Update any workflow help text that still implies ATDD is optional.

- **Design D2: gate requirement normalization**
  - For Phase 05, keep checklist generation and AC coverage requirements but drop the conditional guard.
  - For Phase 06, keep priority ordering, no orphan skips, and red/green transition requirements but drop the conditional guard.
  - For Phase 07, keep checklist sync and full-priority completion checks but drop the conditional guard.

- **Design D3: dispatcher and validator activation**
  - `post-bash-dispatcher` should activate `atdd-completeness-validator` based on active workflow presence and relevant phase path, not an option flag.
  - `atdd-completeness-validator` should treat active shared workflows as ATDD-active by default, while tolerating stale state without crashing.
  - `checkpoint-router` metadata should stop describing the validator as filtered by `atdd_mode`.

- **Design D4: test watcher normalization**
  - Replace `isATDDMode(state)` style branching with logic that treats shared implementation/testing workflows as inherently ATDD-governed.
  - Keep acceptance-skip detection and priority-related guidance as part of standard iteration enforcement.

- **Design D5: agent contract rewrite**
  - Phase 04 test strategy prompt: acceptance-test scaffolding, priority assignment, fixtures, and checklist generation become default steps.
  - Phase 05 developer prompt: RED/GREEN, checklist sync, and P0-P3 ordering become default acceptance-test execution behavior rather than alternate mode instructions.
  - Phase 06 integration tester prompt: orphan-skip scans, checklist cross-check, and full-priority validation become default gate checks.

- **Design D6: discover bridge wording cleanup**
  - Keep `--atdd-ready` on discover paths.
  - Update bridge language that currently says “compatible with `/isdlc feature --atdd`” to say compatible with the default ATDD workflow path.

## Changes To Existing

- `src/isdlc/config/workflows.json`
  - Remove ATDD option entry if present in applicable workflows.
  - Replace conditional ATDD modifier branches with unconditional modifier content.

- `.isdlc/config/workflows.json`
  - Mirror the same change immediately to avoid dogfood drift.

- `src/isdlc/config/iteration-requirements.json`
  - Remove the `when` guards from all shared-phase `atdd_validation` blocks.

- `src/claude/hooks/dispatchers/post-bash-dispatcher.cjs`
  - Change hook activation so ATDD validator is no longer skipped when `atdd_mode` is absent.

- `src/claude/hooks/atdd-completeness-validator.cjs`
  - Remove optional-mode early exit and rename/debug text if it still speaks in opt-in terms.

- `src/claude/hooks/test-watcher.cjs`
  - Fold ATDD-specific detection into default handling for shared workflows.

- `src/core/validators/checkpoint-router.js`
  - Remove `optionsFilter: 'atdd_mode'` from validator registration metadata.

- `src/claude/agents/04-test-design-engineer.md`
  - Rewrite the ATDD section into default test-strategy behavior.

- `src/claude/agents/05-software-developer.md`
  - Rewrite acceptance-test execution guidance so it no longer depends on `active_workflow.atdd_mode = true`.

- `src/claude/agents/06-integration-tester.md`
  - Rewrite ATDD validation section into default gate-validation behavior.

- Docs and tests
  - Update stale `--atdd` references where they describe workflow execution, leaving discover bridge references intact.

## Wiring Summary

- Workflow invocation enters a shared implementation/testing path without an ATDD toggle.
- Phase 05 always emits acceptance scaffolds and checklist artifacts.
- Phase 06 always consumes them in priority order.
- Phase 07 and post-bash hooks always validate completion/sync/orphan-skip constraints.
- Discover bridge remains a feeder path for reverse-engineered work, not a toggle for runtime behavior.

## Assumptions and Inferences

- The issue’s “feature and fix workflows” wording is narrower than the repo wiring, so this design intentionally normalizes around shared build/test phases instead of trying to special-case names.
- Some tests and legacy docs will fail or drift until they are updated because they currently encode `atdd_mode` as a required switch; that is expected fallout, not evidence against the design.
- I infer the desired user experience is “ATDD is just how iSDLC works,” not “ATDD is enabled but still explained as a special mode everywhere.”
