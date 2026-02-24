# Requirements Specification: BUG-0020-GH-4

**Title**: Artifact path mismatch between agents and gate-blocker
**Type**: Bug Fix
**Severity**: High
**Bug ID**: BUG-0020
**External**: [GitHub #4](https://github.com/vihangshah/isdlc/issues/4)

---

## Bug Summary

Agent OUTPUT STRUCTURE sections define artifact output paths independently from `iteration-requirements.json` artifact_validation.paths. After refactoring agents to consolidate work-item artifacts under `docs/requirements/{artifact_folder}/`, the gate-blocker config was not updated, causing 4 of 5 phases with artifact validation to fail at gate check.

---

## Fix Requirements

### FR-01: Create shared artifact-paths.json config
Create `src/claude/hooks/config/artifact-paths.json` as the single source of truth for all phase artifact output locations. The file must define, for each phase with artifact validation, the canonical path template(s) where artifacts are written.

### FR-02: Update iteration-requirements.json to reference artifact-paths.json
Update `iteration-requirements.json` artifact_validation.paths for phases 01, 03, 04, 05, and 08 to match the canonical paths defined in `artifact-paths.json`. The paths must use `{artifact_folder}` as the template variable.

### FR-03: Update gate-blocker-ext.cjs to read artifact-paths.json
Modify `gate-blocker-ext.cjs` to load artifact paths from `artifact-paths.json` (with fallback to inline `iteration-requirements.json` paths for backward compatibility). The hook must resolve `{artifact_folder}` from `state.json -> active_workflow.artifact_folder`.

### FR-04: Align agent OUTPUT STRUCTURE documentation
Update agent OUTPUT STRUCTURE sections in `01-requirements-analyst.md`, `02-solution-architect.md`, `03-system-designer.md`, `04-test-design-engineer.md`, and `07-qa-engineer.md` to reference `artifact-paths.json` as the authority for output paths. Include a note that the canonical path is defined in `artifact-paths.json`.

### FR-05: Add validation test for path consistency
Create `src/claude/hooks/tests/artifact-path-consistency.test.cjs` that validates:
- All paths in `artifact-paths.json` exist as entries in `iteration-requirements.json`
- All `iteration-requirements.json` artifact_validation.paths match `artifact-paths.json`
- `artifact-paths.json` schema is valid (phase key, paths array, template variables)

---

## Non-Functional Requirements

### NFR-01: Backward compatibility
The fix must not break existing workflows or require migration of existing artifact folders. Gate-blocker must fall back gracefully if `artifact-paths.json` is missing.

### NFR-02: Zero regression
All existing tests (ESM + CJS) must continue to pass. No decrease in test count below baseline.

### NFR-03: Performance
Loading `artifact-paths.json` must add <5ms to gate-blocker execution time (file is small, cached by Node require).

---

## Acceptance Criteria

### AC-01: artifact-paths.json exists and is valid
**Given** the iSDLC framework is installed
**When** I check `src/claude/hooks/config/artifact-paths.json`
**Then** it contains path templates for phases 01, 03, 04, 05, and 08
**And** each entry has a phase key and at least one path template with `{artifact_folder}`

### AC-02: iteration-requirements.json paths match artifact-paths.json
**Given** `artifact-paths.json` defines canonical paths
**When** I compare artifact_validation.paths in `iteration-requirements.json`
**Then** every path in iteration-requirements.json matches the corresponding entry in artifact-paths.json

### AC-03: Gate-blocker reads from artifact-paths.json
**Given** a workflow is active with `artifact_folder` set
**When** gate-blocker validates artifacts for a phase
**Then** it reads the expected paths from `artifact-paths.json`
**And** resolves `{artifact_folder}` with the active workflow value

### AC-04: Gate-blocker falls back gracefully
**Given** `artifact-paths.json` does not exist (e.g., older installation)
**When** gate-blocker validates artifacts
**Then** it falls back to `iteration-requirements.json` artifact_validation.paths
**And** does not crash or block the workflow

### AC-05: Phase 03 paths aligned
**Given** a feature workflow at Phase 03 (architecture)
**When** the solution-architect writes artifacts
**Then** the output path matches what gate-blocker expects from artifact-paths.json

### AC-06: Phase 04 paths aligned
**Given** a feature workflow at Phase 04 (design)
**When** the system-designer writes artifacts
**Then** the output path matches what gate-blocker expects from artifact-paths.json

### AC-07: Phase 05 paths aligned
**Given** a workflow at Phase 05 (test-strategy)
**When** the test-design-engineer writes artifacts
**Then** the output path matches what gate-blocker expects from artifact-paths.json

### AC-08: Phase 08 paths aligned
**Given** a workflow at Phase 08 (code-review)
**When** the qa-engineer writes artifacts
**Then** the output path matches what gate-blocker expects from artifact-paths.json

### AC-09: Validation test catches mismatches
**Given** `artifact-path-consistency.test.cjs` is run
**When** all paths are aligned
**Then** all tests pass
**When** a path is changed in iteration-requirements.json but not artifact-paths.json
**Then** the test fails with a clear message identifying the mismatch

### AC-10: Agent docs reference artifact-paths.json
**Given** I read any agent with artifact output (01, 02, 03, 04, 07)
**When** I check the OUTPUT STRUCTURE section
**Then** it references `artifact-paths.json` as the canonical source for output paths

### AC-11: No regression in existing tests
**Given** the fix is applied
**When** `npm run test:all` is executed
**Then** all existing tests pass with zero regressions

---

## Affected Files

### Config (modify)
- `src/claude/hooks/config/iteration-requirements.json` -- update artifact_validation.paths
- `src/claude/hooks/config/artifact-paths.json` -- NEW: single source of truth

### Hooks (modify)
- `src/claude/hooks/gate-blocker-ext.cjs` -- read artifact-paths.json

### Agents (modify)
- `src/claude/agents/01-requirements-analyst.md` -- reference artifact-paths.json
- `src/claude/agents/02-solution-architect.md` -- reference artifact-paths.json
- `src/claude/agents/03-system-designer.md` -- reference artifact-paths.json
- `src/claude/agents/04-test-design-engineer.md` -- reference artifact-paths.json
- `src/claude/agents/07-qa-engineer.md` -- reference artifact-paths.json

### Tests (new)
- `src/claude/hooks/tests/artifact-path-consistency.test.cjs` -- NEW: drift detection test

---

## Linked Artifacts
- Bug Report: `docs/requirements/BUG-0020-GH-4/bug-report.md`
- External: [GitHub #4](https://github.com/vihangshah/isdlc/issues/4)
