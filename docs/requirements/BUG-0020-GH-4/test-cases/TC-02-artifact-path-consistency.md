# Test Cases: Artifact Path Consistency Validation

**Requirement**: FR-01, FR-02, FR-05, AC-01, AC-02, AC-09
**File**: `src/claude/hooks/tests/artifact-path-consistency.test.cjs` (NEW)
**Section**: `describe('Artifact path consistency')`

These tests validate that artifact-paths.json and iteration-requirements.json remain synchronized. They serve as a permanent drift-detection mechanism.

---

## TC-APC-01: artifact-paths.json exists and is valid JSON

**Priority**: P0
**Traces**: FR-01, AC-01

**Given** the iSDLC framework is installed
**When** I read `src/claude/hooks/config/artifact-paths.json`
**Then** the file exists
**And** it parses as valid JSON
**And** it contains a top-level `phases` object

---

## TC-APC-02: artifact-paths.json covers all phases with artifact_validation

**Priority**: P0
**Traces**: FR-01, FR-05, AC-01

**Given** `artifact-paths.json` is loaded
**And** `iteration-requirements.json` is loaded
**When** I extract all phase keys that have `artifact_validation.enabled: true` from iteration-requirements.json
**Then** every such phase key exists in `artifact-paths.json.phases`
**And** each entry has a non-empty `paths` array

---

## TC-APC-03: artifact-paths.json paths match iteration-requirements.json paths

**Priority**: P0
**Traces**: FR-02, FR-05, AC-02, AC-09

**Given** both `artifact-paths.json` and `iteration-requirements.json` are loaded
**When** I compare the `paths` array for each phase in artifact-paths.json with the corresponding `artifact_validation.paths` in iteration-requirements.json
**Then** every path in iteration-requirements.json has a matching entry in artifact-paths.json (or vice versa)
**And** the path templates are identical (including `{artifact_folder}` placeholders)

---

## TC-APC-04: artifact-paths.json paths contain {artifact_folder} template variable

**Priority**: P1
**Traces**: FR-01, AC-01

**Given** `artifact-paths.json` is loaded
**When** I inspect each path in each phase entry
**Then** every path contains the `{artifact_folder}` template variable

---

## TC-APC-05: artifact-paths.json schema validation

**Priority**: P1
**Traces**: FR-01, FR-05

**Given** `artifact-paths.json` is loaded
**When** I validate its schema
**Then** the top-level key `phases` is an object
**And** each phase entry has a `paths` key that is a non-empty array of strings
**And** each phase key matches the pattern `NN-<name>` (e.g., `01-requirements`, `03-architecture`)

---

## TC-APC-06: Phase 01 paths are aligned (docs/requirements/)

**Priority**: P1
**Traces**: FR-02, AC-01

**Given** both config files are loaded
**When** I check phase `01-requirements`
**Then** artifact-paths.json and iteration-requirements.json both have `docs/requirements/{artifact_folder}/requirements-spec.md`

---

## TC-APC-07: Phase 03 paths are aligned (docs/requirements/)

**Priority**: P1
**Traces**: FR-02, AC-05

**Given** both config files are loaded
**When** I check phase `03-architecture`
**Then** artifact-paths.json has `docs/requirements/{artifact_folder}/database-design.md`
**And** iteration-requirements.json artifact_validation.paths matches

---

## TC-APC-08: Phase 04 paths are aligned (docs/requirements/)

**Priority**: P1
**Traces**: FR-02, AC-06

**Given** both config files are loaded
**When** I check phase `04-design`
**Then** artifact-paths.json has `docs/requirements/{artifact_folder}/module-design.md`
**And** iteration-requirements.json artifact_validation.paths matches

---

## TC-APC-09: Phase 05 paths are aligned (docs/requirements/)

**Priority**: P1
**Traces**: FR-02, AC-07

**Given** both config files are loaded
**When** I check phase `05-test-strategy`
**Then** artifact-paths.json has `docs/requirements/{artifact_folder}/test-strategy.md`
**And** iteration-requirements.json artifact_validation.paths matches

---

## TC-APC-10: Phase 08 paths are aligned (docs/requirements/)

**Priority**: P1
**Traces**: FR-02, AC-08

**Given** both config files are loaded
**When** I check phase `08-code-review`
**Then** artifact-paths.json has `docs/requirements/{artifact_folder}/code-review-report.md`
**And** iteration-requirements.json artifact_validation.paths matches

---

## TC-APC-11: Mismatch detection -- changing iteration-requirements.json causes test failure

**Priority**: P0
**Traces**: FR-05, AC-09

**Given** artifact-paths.json and iteration-requirements.json are currently aligned
**When** I create a temporary modified iteration-requirements.json where phase 03 has `docs/architecture/{artifact_folder}/architecture-overview.md` (the old broken path)
**And** I run the consistency check against artifact-paths.json
**Then** the check detects the mismatch
**And** the error message identifies phase `03-architecture` and the mismatched path

---

## TC-APC-12: No orphan phases in artifact-paths.json

**Priority**: P2
**Traces**: FR-05

**Given** both config files are loaded
**When** I check artifact-paths.json phase keys
**Then** every phase key in artifact-paths.json also exists in iteration-requirements.json phase_requirements
**And** has `artifact_validation.enabled: true`

---

## Implementation Notes

This test file reads the REAL config files from `src/claude/hooks/config/` (not the test temp directory). It validates the actual production config for consistency. Tests TC-APC-11 uses a modified copy in a temp directory to validate mismatch detection.

```javascript
// File structure:
// src/claude/hooks/tests/artifact-path-consistency.test.cjs

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const CONFIG_DIR = path.resolve(__dirname, '..', 'config');
const artifactPathsFile = path.join(CONFIG_DIR, 'artifact-paths.json');
const iterReqsFile = path.join(CONFIG_DIR, 'iteration-requirements.json');
```
