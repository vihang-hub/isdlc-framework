# Task Plan: REQ_GH_216_CODEX req-gh-216-atdd-default-codex

**Source**: github GH-216
**Generated after**: Codex manual analysis
**FRs**: 6 | **ADRs**: 4 | **Estimated LOC**: ~250
**Format**: v3.0

---

## Phase 05: Test Strategy -- PENDING

- [ ] T001 Define acceptance-test coverage cases for unconditional ATDD generation and checklist artifacts | traces: FR-002, FR-004, AC-implicit
  files: docs/requirements/REQ-GH-216-atdd-default-codex/test-strategy.md (CREATE)
  blocked_by: []
  blocks: [T003, T004, T005]

## Phase 06: Implementation -- PENDING

### Setup

- [ ] T002 Remove workflow-level `--atdd` option and conditional modifier structure from shared workflow configs | traces: FR-001, FR-006
  files: src/isdlc/config/workflows.json (MODIFY), .isdlc/config/workflows.json (MODIFY)
  blocked_by: []
  blocks: [T003, T004, T005, T006]

### Core Implementation

- [ ] T003 Make Phase 05/06/07 ATDD validation requirements unconditional in iteration requirements | traces: FR-002, FR-003, FR-004
  files: src/isdlc/config/iteration-requirements.json (MODIFY)
  blocked_by: [T001, T002]
  blocks: [T004, T005, T007]

- [ ] T004 Remove ATDD option-gating from dispatcher and completeness validator activation | traces: FR-004
  files: src/claude/hooks/dispatchers/post-bash-dispatcher.cjs (MODIFY), src/claude/hooks/atdd-completeness-validator.cjs (MODIFY), src/core/validators/checkpoint-router.js (MODIFY)
  blocked_by: [T002, T003]
  blocks: [T005, T007]

- [ ] T005 Normalize test-watcher and phase-agent behavior so ATDD execution/validation is the default contract | traces: FR-002, FR-003, FR-004, FR-006
  files: src/claude/hooks/test-watcher.cjs (MODIFY), src/claude/agents/04-test-design-engineer.md (MODIFY), src/claude/agents/05-software-developer.md (MODIFY), src/claude/agents/06-integration-tester.md (MODIFY)
  blocked_by: [T002, T003, T004]
  blocks: [T006, T007]

### Wiring Codex

- [ ] T006 Update workflow/user docs so execution no longer references `/isdlc ... --atdd`, while preserving `/discover --atdd-ready` as a separate bridge | traces: FR-005, FR-006
  files: CLAUDE.md (MODIFY), docs/AGENTS.md (MODIFY), src/claude/commands/discover.md (MODIFY), src/claude/agents/discover/atdd-bridge.md (MODIFY)
  blocked_by: [T002, T005]
  blocks: [T007]

### Cleanup

- [ ] T007 Update hook and validator tests that currently assume optional `atdd_mode` activation | traces: FR-004, FR-006
  files: src/claude/hooks/tests/test-post-bash-dispatcher.test.cjs (MODIFY), src/claude/hooks/tests/atdd-completeness-validator.test.cjs (MODIFY), tests/core/validators/checkpoint-router.test.js (MODIFY)
  blocked_by: [T003, T004, T005, T006]
  blocks: [T008, T009]

## Phase 16: Quality Loop -- PENDING

- [ ] T008 Verify unconditional ATDD validation runs for shared workflows without `atdd_mode` in state | traces: FR-004
  files: src/claude/hooks/tests/test-post-bash-dispatcher.test.cjs (VERIFY), src/claude/hooks/tests/atdd-completeness-validator.test.cjs (VERIFY), tests/core/validators/checkpoint-router.test.js (VERIFY)
  blocked_by: [T007]
  blocks: [T010]

- [ ] T009 Verify documentation still preserves discover-side `--atdd-ready` while removing execution-side `--atdd` guidance | traces: FR-005, FR-006
  files: src/claude/commands/discover.md (VERIFY), src/claude/agents/discover/atdd-bridge.md (VERIFY), CLAUDE.md (VERIFY), docs/AGENTS.md (VERIFY)
  blocked_by: [T007]
  blocks: [T010]

## Phase 08: Code Review -- PENDING

- [ ] T010 Review cross-cutting parity: config, hooks, prompts, and docs all describe one default ATDD workflow | traces: FR-001, FR-002, FR-003, FR-004, FR-005, FR-006
  files: docs/requirements/REQ-GH-216-atdd-default-codex/code-review-report.md (CREATE)
  blocked_by: [T008, T009]
  blocks: []

## Progress Summary

- Phase 05: 1 total, 0 complete
- Phase 06: 6 total, 0 complete
- Phase 16: 2 total, 0 complete
- Phase 08: 1 total, 0 complete
- Overall: 10 total, 0 complete

## Dependency Graph

- `T001 -> T003`
- `T002 -> T003, T004, T005, T006`
- `T003 -> T004, T005, T007`
- `T004 -> T005, T007`
- `T005 -> T006, T007`
- `T006 -> T007`
- `T007 -> T008, T009`
- `T008 -> T010`
- `T009 -> T010`

## Traceability Matrix

| FR | Tasks |
|---|---|
| FR-001 | T002, T010 |
| FR-002 | T001, T003, T005, T010 |
| FR-003 | T003, T005, T010 |
| FR-004 | T001, T003, T004, T005, T007, T008, T010 |
| FR-005 | T006, T009, T010 |
| FR-006 | T002, T005, T006, T007, T009, T010 |

## Assumptions and Inferences

- `test-generate` is intentionally included because the user clarified GH-216 should apply to all shared Phase 05/06 workflow paths.
- The task categories above map the template’s required categories loosely to this repo’s current work shape; `wiring_codex` here means cross-surface documentation and command-path alignment, not Codex-provider runtime code changes.
- I am assuming secondary historical requirement docs are not part of the first implementation pass unless they are surfaced by failing tests or obvious user-facing contradictions.
