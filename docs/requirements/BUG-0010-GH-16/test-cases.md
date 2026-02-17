# Test Cases: BUG-0010-GH-16 Artifact-Paths Config Fix

**Phase**: 05-test-strategy
**Workflow**: fix
**Date**: 2026-02-17
**Artifact Folder**: BUG-0010-GH-16

---

## Test Approach

This is a config-only bug fix. Tests verify:
1. JSON validity of both config files after changes
2. Correct filenames in config entries
3. Correct workflow override presence/absence
4. Gate-blocker behavior with corrected config (integration)

All tests should PASS after the fix is applied (GREEN). Config validation tests (TC-01 through TC-07) read actual production config files. Integration tests (TC-08 through TC-12) invoke gate-blocker functions with crafted inputs.

**Test File**: `src/claude/hooks/tests/artifact-paths-config-fix.test.cjs`
**Module Under Test**: `src/claude/hooks/config/artifact-paths.json`, `src/claude/hooks/config/iteration-requirements.json`, `src/claude/hooks/gate-blocker.cjs` (behavior only, not modified)
**Run Command**: `npm run test:hooks`

---

## Bug 1: Phase 08 Filename Mismatch

### TC-01: artifact-paths.json is valid JSON [P0] (NFR-3)

- **Given**: The file `src/claude/hooks/config/artifact-paths.json` exists on disk
- **When**: The file contents are read and parsed with `JSON.parse()`
- **Then**: No exception is thrown
- **And**: The parsed result is a non-null object with a `phases` property

### TC-02: artifact-paths.json Phase 08 references code-review-report.md [P0] (AC-1)

- **Given**: `artifact-paths.json` is parsed successfully
- **When**: `phases["08-code-review"].paths` is accessed
- **Then**: The array contains exactly one entry: `"docs/requirements/{artifact_folder}/code-review-report.md"`
- **And**: The entry does NOT contain `review-summary.md`

### TC-03: iteration-requirements.json is valid JSON [P0] (NFR-3)

- **Given**: The file `src/claude/hooks/config/iteration-requirements.json` exists on disk
- **When**: The file contents are read and parsed with `JSON.parse()`
- **Then**: No exception is thrown
- **And**: The parsed result is a non-null object with `phase_requirements` and `workflow_overrides` properties

### TC-04: iteration-requirements.json Phase 08 artifact_validation references code-review-report.md [P0] (AC-2)

- **Given**: `iteration-requirements.json` is parsed successfully
- **When**: `phase_requirements["08-code-review"].artifact_validation.paths` is accessed
- **Then**: The array contains exactly one entry: `"docs/requirements/{artifact_folder}/code-review-report.md"`
- **And**: The entry does NOT contain `review-summary.md`

### TC-08: Gate-blocker allows Phase 08 when code-review-report.md exists [P0] (AC-3)

- **Given**: A temporary project directory containing:
  - `src/claude/hooks/config/artifact-paths.json` with Phase 08 referencing `code-review-report.md`
  - `docs/requirements/BUG-TEST/code-review-report.md` (file exists on disk)
  - State with `active_workflow.current_phase = "08-code-review"` and `artifact_folder = "BUG-TEST"`
- **When**: `checkArtifactPresenceRequirement()` is called with artifact_validation enabled and the corrected paths
- **Then**: Returns `{ satisfied: true }`

### TC-09: Gate-blocker blocks Phase 08 when code-review-report.md is missing [P1] (AC-3 negative)

- **Given**: A temporary project directory where `docs/requirements/BUG-TEST/code-review-report.md` does NOT exist
- **When**: `checkArtifactPresenceRequirement()` is called with artifact_validation enabled and paths referencing `code-review-report.md`
- **Then**: Returns `{ satisfied: false }`
- **And**: `missing_artifacts` includes a path ending with `code-review-report.md`

---

## Bug 2: Phase 01 Fix Workflow Override

### TC-05: Fix workflow override disables Phase 01 artifact validation [P0] (AC-4)

- **Given**: `iteration-requirements.json` is parsed successfully
- **When**: `workflow_overrides.fix["01-requirements"].artifact_validation` is accessed
- **Then**: The `enabled` property is `false`

### TC-06: Base config Phase 01 artifact validation remains enabled [P0] (AC-5)

- **Given**: `iteration-requirements.json` is parsed successfully
- **When**: `phase_requirements["01-requirements"].artifact_validation` is accessed
- **Then**: The `enabled` property is `true`
- **And**: The `paths` array contains `"docs/requirements/{artifact_folder}/requirements-spec.md"`

### TC-07: Feature workflow does NOT override Phase 01 artifact validation [P1] (AC-5, NFR-2)

- **Given**: `iteration-requirements.json` is parsed successfully
- **When**: `workflow_overrides.feature` is checked for a `"01-requirements"` key
- **Then**: Either there is no `"01-requirements"` key in the feature override
- **Or**: If the key exists, it does NOT set `artifact_validation.enabled` to `false`

### TC-10: Gate-blocker skips artifact check for Phase 01 in fix workflows [P0] (AC-6)

- **Given**: Requirements config with base `phase_requirements["01-requirements"].artifact_validation.enabled = true`
- **And**: Workflow override `fix["01-requirements"].artifact_validation.enabled = false`
- **When**: The override is deep-merged onto the base requirements (via `mergeRequirements()`)
- **And**: `checkArtifactPresenceRequirement()` is called with the merged result
- **Then**: Returns `{ satisfied: true, reason: 'not_required' }`
- **And**: No file existence check is performed (artifact validation is disabled)

### TC-11: Gate-blocker validates Phase 01 artifacts in feature workflows [P1] (AC-5, NFR-2)

- **Given**: Requirements config with base `phase_requirements["01-requirements"].artifact_validation.enabled = true`
- **And**: Feature workflow override for `"08-code-review"` (does NOT touch `"01-requirements"`)
- **When**: The feature override is merged onto the base Phase 01 requirements
- **And**: `checkArtifactPresenceRequirement()` is called
- **Then**: `artifact_validation.enabled` remains `true`
- **And**: File existence check IS performed

### TC-12: Gate-blocker validates Phase 01 artifacts with no workflow override [P1] (AC-5)

- **Given**: Requirements config with base `phase_requirements["01-requirements"].artifact_validation.enabled = true`
- **And**: No workflow override is applied
- **When**: `checkArtifactPresenceRequirement()` is called with the base requirements
- **Then**: `artifact_validation.enabled` is `true`
- **And**: File existence check IS performed

---

## NFR Verification

### TC-13: gate-blocker.cjs has zero behavioral changes [P1] (NFR-1)

- **Given**: The fix modifies only JSON config files
- **When**: `gate-blocker.cjs` source is read
- **Then**: It contains the expected key functions (`checkArtifactPresenceRequirement`, `getArtifactPathsForPhase`, `loadArtifactPaths`, `mergeRequirements`, `check`)
- **And**: The `checkArtifactPresenceRequirement` function signature and early-exit logic are unchanged
- **Note**: This confirms NFR-1 by structural verification. The actual "no changes" guarantee is enforced by git diff in Phase 16.
