# REQ-0059: Test Strategy — Workflow Interruption

## 1. Test Approach

All tests are CJS unit tests using Node's built-in `node:test` and `node:assert`. Tests run in isolated temp directories (per Article XIII) with mock state.json files. No external dependencies.

## 2. Test Files

| File | Type | Covers |
|------|------|--------|
| `test-workflow-init-interrupt.test.cjs` | Unit | FR-002, FR-003, FR-005 — suspend path in workflow-init.cjs |
| `test-workflow-finalize-resume.test.cjs` | Unit | FR-004, FR-006, FR-008 — resume path in workflow-finalize.cjs |
| `test-workflow-rollback-resume.test.cjs` | Unit | FR-006 — resume path in workflow-rollback.cjs (cancel handling) |
| `test-validate-state-suspended.test.cjs` | Unit | FR-006 — suspended_workflow schema validation |

## 3. Test Cases

### T01-T08: workflow-init.cjs — Suspend Path (`test-workflow-init-interrupt.test.cjs`)

| ID | Test | FR | AC |
|----|------|----|----|
| T01 | `--interrupt` flag parsed correctly | FR-002 | — |
| T02 | `--interrupt --type fix` with active workflow → suspends active, creates new fix workflow | FR-002 | AC-002-01 |
| T03 | After suspension, `suspended_workflow` has all original fields preserved (phases, phase_status, flags, slug, artifact_folder, current_phase, current_phase_index) | FR-002 | AC-002-01 |
| T04 | After suspension, `active_workflow` is the new fix workflow (not the old one) | FR-003 | AC-003-01 |
| T05 | `--interrupt` without `--type fix` (e.g., `--type feature`) → BLOCKED | FR-005 | — |
| T06 | `--interrupt --type fix` when `suspended_workflow` already exists → ERROR with both workflow descriptions | FR-005 | AC-005-01, AC-005-02 |
| T07 | `--interrupt --type fix` with no active workflow → normal init (no suspension) | FR-002 | AC-002-02 (inverted) |
| T08 | `state_version` incremented after suspension | — | — |

### T09-T16: workflow-finalize.cjs — Resume Path (`test-workflow-finalize-resume.test.cjs`)

| ID | Test | FR | AC |
|----|------|----|----|
| T09 | Finalize with `suspended_workflow` → restores it to `active_workflow` | FR-004 | AC-004-01 |
| T10 | Restored workflow has all original fields intact (phases, phase_status, flags, slug, artifact_folder) | FR-004 | AC-004-03 |
| T11 | `suspended_workflow` is deleted (absent) after restore | FR-004 | AC-004-01 |
| T12 | Phase iteration state reset on restore: `test_iteration`, `constitutional_validation`, `interactive_elicitation` cleared for current_phase | FR-008 | AC-008-01 |
| T13 | `recovery_action` set to `resumed_from_suspension` with correct phase and timestamp | FR-008 | — |
| T14 | Finalize without `suspended_workflow` → normal behavior (no restoration) | FR-004 | AC-004-02 |
| T15 | Output includes `resumed_workflow` field when restoration occurs | FR-004 | — |
| T16 | `state_version` incremented after restoration | — | — |

### T17-T19: workflow-rollback.cjs — Cancel Resume (`test-workflow-rollback-resume.test.cjs`)

| ID | Test | FR | AC |
|----|------|----|----|
| T17 | Rollback (cancel) with `suspended_workflow` → restores it to `active_workflow` | FR-006 | AC-006-01 |
| T18 | Restored workflow has all original fields intact after rollback-cancel | FR-006 | AC-006-01 |
| T19 | Phase iteration state reset on restore via rollback path | FR-008 | AC-008-01 |

### T20-T23: validate-state.cjs — Schema Validation (`test-validate-state-suspended.test.cjs`)

| ID | Test | FR | AC |
|----|------|----|----|
| T20 | Valid `suspended_workflow` passes validation | FR-006 | — |
| T21 | `suspended_workflow.current_phase` not in phases array → error | FR-006 | — |
| T22 | `suspended_workflow.phase_status` with invalid status → error | FR-006 | — |
| T23 | No `suspended_workflow` → validation passes (field is optional) | FR-006 | — |

## 4. Traceability Matrix

| FR | ACs | Test IDs |
|----|-----|----------|
| FR-002 | AC-002-01, AC-002-02 | T02, T03, T07 |
| FR-003 | AC-003-01 | T04 |
| FR-004 | AC-004-01, AC-004-02, AC-004-03 | T09, T10, T11, T14, T15 |
| FR-005 | AC-005-01, AC-005-02 | T05, T06 |
| FR-006 | AC-006-01 | T17, T18, T20-T23 |
| FR-008 | AC-008-01 | T12, T13, T19 |

**FR-001** (harness bug detection) and **FR-007** (user messaging) are AI behavior — enforced via CLAUDE.md instructions, not testable in unit tests.

## 5. Test Infrastructure

Each test file:
1. Creates a temp directory with `.isdlc/state.json` and mock `docs/isdlc/constitution.md`
2. Copies the target script to the temp directory (CJS module isolation)
3. Runs the script via `execSync` with appropriate args
4. Parses JSON output and asserts on state changes
5. Cleans up temp directory

Same pattern as existing `test-phase-advance-skip.test.cjs` and `test-workflow-retry.test.cjs`.

## Pending Sections

None — all sections complete.
