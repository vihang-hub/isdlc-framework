# Test Cases: Gate-Blocker Integration with artifact-paths.json

**Requirement**: FR-03, NFR-01, AC-03, AC-04
**File**: `src/claude/hooks/tests/test-gate-blocker-extended.test.cjs`
**Section**: `describe('BUG-0020: artifact-paths.json integration')`

These tests validate that gate-blocker reads from artifact-paths.json with proper fallback behavior.

---

## TC-BUG20-INT01: Gate-blocker reads paths from artifact-paths.json

**Priority**: P0
**Traces**: FR-03, AC-03

**Given** a feature workflow is active at phase `03-architecture` with `artifact_folder` = `REQ-TEST`
**And** `artifact-paths.json` exists in the test env with phase `03-architecture` paths = `["docs/requirements/{artifact_folder}/database-design.md"]`
**And** `iteration-requirements.json` still has the OLD path `docs/architecture/{artifact_folder}/architecture-overview.md`
**And** the artifact file exists at `docs/requirements/REQ-TEST/database-design.md`
**When** gate-blocker validates artifact presence
**Then** the gate PASSES because gate-blocker reads from artifact-paths.json (which has the correct path)
**And** does NOT block on the old iteration-requirements.json path

---

## TC-BUG20-INT02: Gate-blocker falls back to iteration-requirements.json when artifact-paths.json is missing

**Priority**: P0
**Traces**: FR-03, NFR-01, AC-04

**Given** a workflow is active at phase `01-requirements` with `artifact_folder` = `REQ-TEST`
**And** `artifact-paths.json` does NOT exist in the test env
**And** `iteration-requirements.json` has `artifact_validation.paths` = `["docs/requirements/{artifact_folder}/requirements-spec.md"]`
**And** the artifact file exists at `docs/requirements/REQ-TEST/requirements-spec.md`
**When** gate-blocker validates artifact presence
**Then** the gate PASSES using the fallback iteration-requirements.json paths
**And** no crash or error occurs

---

## TC-BUG20-INT03: Gate-blocker falls back gracefully when artifact-paths.json is malformed

**Priority**: P1
**Traces**: NFR-01, AC-04

**Given** a workflow is active at phase `01-requirements` with `artifact_folder` = `REQ-TEST`
**And** `artifact-paths.json` exists but contains invalid JSON (`{invalid`)
**And** `iteration-requirements.json` has valid paths for phase 01
**And** the artifact file exists at the correct path
**When** gate-blocker validates artifact presence
**Then** the gate PASSES using the fallback iteration-requirements.json paths
**And** no crash occurs
**And** a warning may appear on stderr

---

## TC-BUG20-INT04: Gate-blocker blocks when artifact is missing even with artifact-paths.json

**Priority**: P1
**Traces**: FR-03, AC-03

**Given** a workflow is active at phase `08-code-review` with `artifact_folder` = `REQ-TEST`
**And** `artifact-paths.json` exists with phase `08-code-review` paths = `["docs/requirements/{artifact_folder}/code-review-report.md"]`
**And** the artifact file does NOT exist on disk
**When** gate-blocker validates artifact presence
**Then** the gate BLOCKS with a message mentioning `code-review-report.md`
**And** the blocked artifact path is the one from artifact-paths.json (not the old iteration-requirements.json path)

---

## TC-BUG20-INT05: artifact_folder template resolution works with artifact-paths.json

**Priority**: P1
**Traces**: FR-03, AC-03

**Given** a workflow is active at phase `05-test-strategy` with `artifact_folder` = `BUG-0020-GH-4`
**And** `artifact-paths.json` has paths for phase 05 = `["docs/requirements/{artifact_folder}/test-strategy.md"]`
**And** the artifact exists at `docs/requirements/BUG-0020-GH-4/test-strategy.md`
**When** gate-blocker validates artifact presence
**Then** the gate PASSES
**And** `{artifact_folder}` was correctly resolved to `BUG-0020-GH-4`

---

## TC-BUG20-INT06: Gate-blocker handles artifact-paths.json with missing phase entry

**Priority**: P2
**Traces**: NFR-01, AC-04

**Given** a workflow is active at phase `04-design` with `artifact_folder` = `REQ-TEST`
**And** `artifact-paths.json` exists but does NOT have a phase `04-design` entry
**And** `iteration-requirements.json` has valid artifact_validation.paths for phase 04
**And** the artifact file exists at the iteration-requirements.json path
**When** gate-blocker validates artifact presence
**Then** the gate PASSES using the fallback iteration-requirements.json paths for that phase

---

## Implementation Notes

Each integration test:
1. Calls `setupTestEnv()` with appropriate active_workflow state
2. Writes `artifact-paths.json` to the test env config directory using `writeConfig('artifact-paths.json', {...})`
3. Writes `iteration-requirements.json` with specific paths
4. Creates (or omits) artifact files on disk in the temp directory
5. Runs gate-blocker via `runHook()` with a gate advancement input
6. Disables all non-artifact gate requirements (test_iteration, constitutional, elicitation, delegation) to isolate artifact validation
7. Asserts the result based on expected pass/block behavior

The key pattern is:
- artifact-paths.json has CORRECT paths (new consolidated `docs/requirements/` paths)
- iteration-requirements.json may have OLD paths (for testing override behavior)
- The agent artifact is placed at the CORRECT path
- Gate-blocker should use artifact-paths.json and pass
