# Test Cases: TDD Failing Test (Mismatch Reproduction)

**Requirement**: FR-02, FR-03, AC-05 through AC-08
**File**: `src/claude/hooks/tests/test-gate-blocker-extended.test.cjs`
**Section**: `describe('BUG-0020: Artifact path mismatch reproduction')`

These tests MUST FAIL before the fix is applied and PASS after.

---

## TC-BUG20-RED01: Phase 03 architecture path mismatch blocks gate

**Priority**: P0 (reproduces the core bug)
**Traces**: FR-02, FR-03, AC-05

**Given** a feature workflow is active at phase `03-architecture` with `artifact_folder` = `REQ-TEST`
**And** iteration-requirements.json has `artifact_validation.paths` = `["docs/architecture/{artifact_folder}/architecture-overview.md"]`
**And** the agent writes its artifact to `docs/requirements/REQ-TEST/database-design.md` (the actual agent output path)
**When** gate-blocker validates artifact presence
**Then** the gate blocks because it looks for `docs/architecture/REQ-TEST/architecture-overview.md` which does not exist
**And** the error message includes `architecture-overview.md`

**Post-fix expected behavior**: Gate passes because artifact-paths.json points to `docs/requirements/{artifact_folder}/database-design.md` which matches what the agent wrote.

---

## TC-BUG20-RED02: Phase 04 design path mismatch blocks gate

**Priority**: P0 (reproduces the core bug)
**Traces**: FR-02, FR-03, AC-06

**Given** a feature workflow is active at phase `04-design` with `artifact_folder` = `REQ-TEST`
**And** iteration-requirements.json has `artifact_validation.paths` = `["docs/design/{artifact_folder}/interface-spec.yaml", "docs/design/{artifact_folder}/interface-spec.md"]`
**And** the agent writes its artifact to `docs/requirements/REQ-TEST/module-design.md`
**When** gate-blocker validates artifact presence
**Then** the gate blocks because neither `docs/design/REQ-TEST/interface-spec.yaml` nor `docs/design/REQ-TEST/interface-spec.md` exist
**And** the error message includes `interface-spec`

**Post-fix expected behavior**: Gate passes because artifact-paths.json points to `docs/requirements/{artifact_folder}/module-design.md`.

---

## TC-BUG20-RED03: Phase 05 test-strategy path mismatch blocks gate

**Priority**: P0 (reproduces the core bug)
**Traces**: FR-02, FR-03, AC-07

**Given** a workflow is active at phase `05-test-strategy` with `artifact_folder` = `BUG-0020-GH-4`
**And** iteration-requirements.json has `artifact_validation.paths` = `["docs/testing/{artifact_folder}/test-strategy.md"]`
**And** the agent writes its artifact to `docs/requirements/BUG-0020-GH-4/test-strategy.md`
**When** gate-blocker validates artifact presence
**Then** the gate blocks because `docs/testing/BUG-0020-GH-4/test-strategy.md` does not exist
**And** the error message includes `test-strategy.md`

**Post-fix expected behavior**: Gate passes because artifact-paths.json points to `docs/requirements/{artifact_folder}/test-strategy.md`.

---

## TC-BUG20-RED04: Phase 08 code-review path mismatch blocks gate

**Priority**: P0 (reproduces the core bug)
**Traces**: FR-02, FR-03, AC-08

**Given** a workflow is active at phase `08-code-review` with `artifact_folder` = `REQ-0020-t6-hook-io-optimization`
**And** iteration-requirements.json has `artifact_validation.paths` = `["docs/reviews/{artifact_folder}/review-summary.md"]`
**And** the agent writes its artifact to `docs/requirements/REQ-0020-t6-hook-io-optimization/code-review-report.md`
**When** gate-blocker validates artifact presence
**Then** the gate blocks because `docs/reviews/REQ-0020-t6-hook-io-optimization/review-summary.md` does not exist
**And** the error message includes `review-summary.md`

**Post-fix expected behavior**: Gate passes because artifact-paths.json points to `docs/requirements/{artifact_folder}/code-review-report.md`.

---

## TC-BUG20-RED05: Phase 01 requirements path is already correct (baseline)

**Priority**: P1 (confirms the one working path stays working)
**Traces**: FR-02, AC-01

**Given** a workflow is active at phase `01-requirements` with `artifact_folder` = `REQ-TEST`
**And** iteration-requirements.json has `artifact_validation.paths` = `["docs/requirements/{artifact_folder}/requirements-spec.md"]`
**And** the agent writes its artifact to `docs/requirements/REQ-TEST/requirements-spec.md`
**When** gate-blocker validates artifact presence
**Then** the gate passes because the file exists at the expected path

**Post-fix expected behavior**: No change -- this test passes both before and after the fix.

---

## Implementation Notes

Each test:
1. Calls `setupTestEnv()` with appropriate state (active_workflow, current_phase, artifact_folder)
2. Writes iteration-requirements.json with the CURRENT (broken) paths using `writeIterationRequirements()`
3. Creates the artifact file at the path where the agent ACTUALLY writes (using `fs.mkdirSync` + `fs.writeFileSync`)
4. Runs gate-blocker hook via `runHook()` with a gate advancement input
5. Asserts the result:
   - Before fix: stdout contains JSON with `continue: false` and `stopReason` mentioning `artifact_presence`
   - After fix: stdout is empty (gate allows)
