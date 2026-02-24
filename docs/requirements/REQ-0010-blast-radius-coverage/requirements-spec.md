# Requirements Specification: REQ-0010

## Blast Radius Coverage Validation

**Version**: 1.0.0
**Date**: 2026-02-12
**Status**: Approved
**Workflow**: feature
**Artifact Folder**: REQ-0010-blast-radius-coverage

---

## 1. Problem Statement

Impact Analysis (Phase 02) produces a detailed `impact-analysis.md` artifact listing all affected files with change types, risk scores, and entry points. However, this artifact is purely informational -- no downstream agent, gate, or hook validates that the implementation (Phase 06) actually touched those files. A developer can skip affected files entirely and still pass all gates as long as test coverage thresholds are met. This creates a gap where the blast radius analysis is performed but never enforced, undermining the value of Phase 02.

## 2. Business Context

- **Why Now**: Three consecutive bug fix workflows (BUG-0005, BUG-0006, BUG-0007) exposed this enforcement gap. Impact analysis identified affected files but nothing verified implementation coverage.
- **Success Metric**: 100% of impact-analysis affected files are either modified in the implementation branch or explicitly deferred with documented rationale in every feature workflow.
- **Competitive Advantage**: Closes the loop between analysis and enforcement, making the iSDLC framework's multi-phase pipeline genuinely end-to-end rather than advisory.

## 3. Scope

### In Scope

- New CJS hook file for blast radius validation at GATE-06
- Auto-generation of `blast-radius-coverage.md` checklist artifact
- Software-developer agent (Phase 06) integration with impact-analysis.md
- GATE-06 validation update requiring blast radius coverage
- Backward compatibility when impact-analysis.md does not exist

### Out of Scope

- Modifying the impact-analysis.md format itself (consumer-only)
- Retroactive validation of past workflows
- Blast radius validation for bug-fix workflows (fix workflows use trace-analysis.md, not impact-analysis.md)
- UI/dashboard for blast radius coverage visualization

---

## 4. Personas

### P-01: Framework Developer

A developer using the iSDLC framework via `/isdlc feature` to implement features. They run through the full phase pipeline (requirements -> impact analysis -> architecture -> design -> test strategy -> implementation -> quality -> review). They expect the framework to catch incomplete implementations before code review.

---

## 5. Functional Requirements

### REQ-001: Blast Radius Validator Hook

The framework SHALL provide a new CJS hook (`blast-radius-validator.cjs`) that validates implementation coverage against the impact analysis affected files list.

**Acceptance Criteria**:
- AC-001-01: The hook parses `impact-analysis.md` from the active workflow's artifact folder (`docs/requirements/{artifact_folder}/impact-analysis.md`) and extracts all file paths listed in "Affected Files" tables.
- AC-001-02: The hook executes `git diff --name-only main...HEAD` (or the appropriate base branch) to determine which files were modified in the implementation branch.
- AC-001-03: For each affected file from impact-analysis.md, the hook determines coverage status: `covered` (file appears in git diff), `deferred` (file has explicit deferral rationale in blast-radius-coverage.md), or `unaddressed` (neither covered nor deferred).
- AC-001-04: The hook returns a blocking result (`decision: "block"`) when any affected file has `unaddressed` status.
- AC-001-05: The hook returns an allowing result (`decision: "allow"`) when all affected files are either `covered` or `deferred`.
- AC-001-06: The hook activates ONLY during Phase 06 (implementation) gate advancement attempts -- it does not run during other phases.

### REQ-002: Graceful Degradation When No Impact Analysis Exists

The hook SHALL skip validation gracefully when impact-analysis.md does not exist for the current workflow.

**Acceptance Criteria**:
- AC-002-01: When `impact-analysis.md` does not exist in the artifact folder, the hook returns `decision: "allow"` with a debug log message indicating the file was not found.
- AC-002-02: When `impact-analysis.md` exists but contains no parseable affected files tables, the hook returns `decision: "allow"` with a warning message.
- AC-002-03: When `state.json` has no `active_workflow` or no `artifact_folder`, the hook returns `decision: "allow"` silently (no active workflow context).
- AC-002-04: When `impact-analysis.md` exists but is malformed (parse error), the hook returns `decision: "allow"` (fail-open per Article X of the constitution) and logs the parse error to stderr.

### REQ-003: Blast Radius Coverage Checklist Generation

The implementation agent (Phase 06) SHALL generate a `blast-radius-coverage.md` artifact after implementation is complete, documenting the coverage status of every affected file.

**Acceptance Criteria**:
- AC-003-01: The checklist is written to `docs/requirements/{artifact_folder}/blast-radius-coverage.md`.
- AC-003-02: Each affected file from impact-analysis.md appears as a row with columns: File Path, Expected Change Type (from impact analysis), Coverage Status (covered/deferred/unaddressed), and Notes.
- AC-003-03: For files with status `covered`, the Notes column indicates the type of change made (e.g., "Modified in commit abc1234", "New file created").
- AC-003-04: For files with status `deferred`, the Notes column contains a mandatory rationale explaining why the file was not modified (e.g., "Change deferred to follow-up REQ-0011: not required for MVP", "File deleted upstream, no longer exists").
- AC-003-05: The checklist includes a summary header showing total affected files, count covered, count deferred, and coverage percentage.

### REQ-004: Software Developer Agent Impact Analysis Integration

The software-developer agent (Phase 06) SHALL read and acknowledge the impact analysis before beginning implementation.

**Acceptance Criteria**:
- AC-004-01: The software-developer agent instructions include a new pre-implementation step that reads `impact-analysis.md` from the artifact folder.
- AC-004-02: The agent extracts the list of affected files and their expected change types (MODIFY, CREATE, DELETE).
- AC-004-03: The agent includes a "Blast Radius Acknowledgement" section in its implementation plan that lists all affected files and the planned action for each.
- AC-004-04: After implementation is complete (before declaring GATE-06 passed), the agent generates the `blast-radius-coverage.md` checklist per REQ-003.

### REQ-005: GATE-06 Validation Update

GATE-06 (Implementation Gate) SHALL include blast radius coverage as a validation criterion.

**Acceptance Criteria**:
- AC-005-01: The gate-blocker hook or GATE-06 validation logic includes a check that `blast-radius-coverage.md` exists in the artifact folder (when `impact-analysis.md` also exists).
- AC-005-02: The gate validation confirms all affected files are either `covered` or `deferred` -- no `unaddressed` files are permitted.
- AC-005-03: The gate validation is skipped when `impact-analysis.md` does not exist (graceful degradation per REQ-002).
- AC-005-04: The gate failure message clearly states which files are unaddressed and instructs the developer to either modify the file or add a deferral rationale to `blast-radius-coverage.md`.

### REQ-006: Impact Analysis File Path Extraction

The hook SHALL reliably extract file paths from the impact-analysis.md markdown format used by the impact-analysis-orchestrator agent.

**Acceptance Criteria**:
- AC-006-01: The parser extracts file paths from markdown table rows where the first column contains a backtick-wrapped file path (e.g., `` `src/claude/hooks/gate-blocker.cjs` ``).
- AC-006-02: The parser handles multiple table sections (one per requirement, e.g., "FR-01: ...", "FR-02: ...") and deduplicates file paths that appear in multiple sections.
- AC-006-03: The parser extracts the Change Type column value (MODIFY, CREATE, DELETE, NO CHANGE) for each file.
- AC-006-04: Files with Change Type "NO CHANGE" are excluded from coverage validation (they are informational references, not expected modifications).
- AC-006-05: The parser handles both relative paths (e.g., `src/claude/hooks/foo.cjs`) and paths with leading backticks/formatting without breaking.

### REQ-007: Hook Integration with Dispatcher Architecture

The blast-radius-validator hook SHALL integrate with the existing hook dispatcher system.

**Acceptance Criteria**:
- AC-007-01: The hook exports a `check(ctx)` function following the standard hook contract: receives `{ input, state, projectRoot }`, returns `{ decision, stopReason?, stderr?, stdout?, stateModified? }`.
- AC-007-02: The hook includes a `shouldActivate(ctx)` guard that returns `true` only when: (a) an active workflow exists, (b) the current phase is `06-implementation`, and (c) the tool call is a gate advancement attempt.
- AC-007-03: The hook is registered in the appropriate dispatcher (pre-task-dispatcher or a new gate-check integration point).
- AC-007-04: The hook follows the fail-open pattern: any internal error (file read failure, parse error, git command failure) results in `decision: "allow"` with diagnostic output to stderr.

---

## 6. Non-Functional Requirements

### NFR-001: Performance

- The hook SHALL complete execution within 2 seconds under normal conditions (parsing impact-analysis.md + running git diff).
- The git diff command SHALL use `--name-only` to minimize output size.

### NFR-002: Reliability (Fail-Open)

- The hook SHALL never block the user's workflow due to its own internal errors (per Constitutional Article X: Fail-Safe Defaults).
- All file I/O and git command failures SHALL result in graceful degradation (`decision: "allow"`).

### NFR-003: Backward Compatibility

- Existing workflows without impact-analysis.md SHALL be completely unaffected.
- The hook SHALL not modify any existing hook behavior or gate validation logic for other phases.
- All existing tests in the test suite SHALL continue to pass without modification.

### NFR-004: Test Coverage

- The new hook SHALL have >= 80% unit test coverage (per Constitutional Article II).
- Test cases SHALL cover: successful validation, graceful degradation (missing file, malformed file, no workflow), file path extraction edge cases, and git diff integration.

### NFR-005: Cross-Platform Compatibility

- The hook SHALL use `path.join()` for all file path operations (per Constitutional Article XII).
- The git diff command SHALL work correctly on macOS, Linux, and Windows.

---

## 7. Constraints

### CON-001: CommonJS Module System

The hook file MUST use CommonJS syntax (`.cjs` extension, `require`/`module.exports`) per Constitutional Article XIII. Hooks run as standalone Node.js processes outside the ESM package scope.

### CON-002: No External Dependencies

The hook MUST NOT introduce new npm dependencies. It SHALL use only Node.js built-in modules (`fs`, `path`, `child_process`) and the existing `common.cjs` shared library.

### CON-003: State.json Schema Preservation

The hook MUST NOT add new top-level fields to `state.json`. Any state tracking SHALL use the existing `phases.06-implementation` object or the `active_workflow` object (per Constitutional Article XIV).

### CON-004: Additive-Only Agent Changes

Changes to the software-developer agent (05) MUST be additive -- a new section for blast radius acknowledgement. Existing TDD workflow, iteration enforcement, and test infrastructure sections MUST NOT be modified.

### CON-005: Feature Workflow Only

Blast radius validation SHALL activate ONLY for feature workflows (where `active_workflow.type === "feature"`). Bug-fix workflows use `trace-analysis.md` (not `impact-analysis.md`) and follow a different validation path.

---

## 8. Assumptions

- ASM-001: The impact-analysis.md format produced by the impact-analysis-orchestrator agent uses markdown tables with backtick-wrapped file paths in the first column and change type in the second column. This format has been consistent across REQ-0005 through REQ-0009.
- ASM-002: The `git diff --name-only main...HEAD` command reliably shows all files modified on the feature branch relative to main. The base branch is always `main` for feature workflows.
- ASM-003: The software-developer agent has read access to all artifacts in `docs/requirements/{artifact_folder}/` during Phase 06.
- ASM-004: The blast-radius-coverage.md artifact will be generated by the software-developer agent as part of its implementation workflow, not by the hook itself (the hook only validates, it does not generate).

---

## 9. Glossary

| Term | Definition |
|------|-----------|
| Blast Radius | The set of files identified by impact analysis as needing modification for a given feature |
| Covered | A file from the blast radius that appears in the git diff (was actually modified) |
| Deferred | A file from the blast radius that was intentionally not modified, with documented rationale |
| Unaddressed | A file from the blast radius that was neither modified nor deferred -- a gap |
| Impact Analysis | Phase 02 of the iSDLC feature workflow, producing impact-analysis.md |
| GATE-06 | The implementation quality gate that must pass before advancing to quality loop |
| Fail-Open | A design pattern where hook errors result in allowing the operation (not blocking) |

---

## 10. User Stories

### US-001: Validate Implementation Coverage at Gate

**As a** framework developer,
**I want** the framework to automatically validate that my implementation covers all files identified in the blast radius,
**so that** I cannot accidentally skip affected files and pass the implementation gate.

**Acceptance Criteria**:
- Given impact-analysis.md lists 10 affected files, when I modified 8 and deferred 2 with rationale, then GATE-06 passes.
- Given impact-analysis.md lists 10 affected files, when I modified 7 and left 3 unaddressed, then GATE-06 blocks with a message listing the 3 unaddressed files.
- Given no impact-analysis.md exists for this workflow, when I attempt to pass GATE-06, then the blast radius check is skipped (not blocking).

**Linked Requirements**: REQ-001, REQ-002, REQ-005

**Priority**: Must Have

### US-002: Generate Blast Radius Coverage Checklist

**As a** framework developer,
**I want** the implementation agent to auto-generate a blast-radius-coverage.md checklist after I finish implementing,
**so that** I have a clear record of which affected files I covered and which I deferred.

**Acceptance Criteria**:
- Given impact-analysis.md exists, when the software-developer agent completes implementation, then blast-radius-coverage.md is generated with one row per affected file.
- Given a file was deferred, when I review blast-radius-coverage.md, then I see the deferral rationale in the Notes column.
- Given all files are covered, when I review the summary, then it shows 100% coverage.

**Linked Requirements**: REQ-003, REQ-004

**Priority**: Must Have

### US-003: Acknowledge Blast Radius Before Implementing

**As a** framework developer,
**I want** the implementation agent to read and acknowledge the blast radius before starting work,
**so that** I have visibility into which files are expected to be modified and can plan accordingly.

**Acceptance Criteria**:
- Given impact-analysis.md lists affected files, when the software-developer agent starts Phase 06, then it displays a "Blast Radius Acknowledgement" section in its implementation plan listing all affected files.
- Given impact-analysis.md does not exist, when the software-developer agent starts Phase 06, then it proceeds normally without a blast radius section.

**Linked Requirements**: REQ-004

**Priority**: Should Have

### US-004: Graceful Handling of Edge Cases

**As a** framework developer,
**I want** the blast radius validation to degrade gracefully when impact analysis artifacts are missing or malformed,
**so that** the hook never blocks my workflow due to its own errors.

**Acceptance Criteria**:
- Given impact-analysis.md is malformed (not valid markdown), when GATE-06 runs, then the blast radius check is skipped with a warning logged to stderr.
- Given state.json has no active_workflow, when the hook runs, then it exits silently without blocking.
- Given git diff fails (e.g., not a git repo), when GATE-06 runs, then the blast radius check is skipped with a warning.

**Linked Requirements**: REQ-002, REQ-007

**Priority**: Must Have

---

## 11. MoSCoW Prioritization

| Priority | Requirements | Rationale |
|----------|-------------|-----------|
| **Must Have** | REQ-001, REQ-002, REQ-003, REQ-005, REQ-006, REQ-007 | Core validation loop: hook + parser + gate check. Without these, the feature has no value. |
| **Should Have** | REQ-004 | Agent integration improves the developer experience but the hook alone enforces coverage. |
| **Could Have** | -- | No requirements deferred to future releases. |
| **Won't Have** | Retroactive validation, bug-fix workflow support, UI dashboard | Explicitly out of scope per Section 3. |

---

## 12. Traceability Matrix

| Requirement ID | User Story ID | Epic | Priority | Status |
|----------------|---------------|------|----------|--------|
| REQ-001 | US-001, US-004 | Blast Radius Validation | Must Have | Draft |
| REQ-002 | US-001, US-004 | Blast Radius Validation | Must Have | Draft |
| REQ-003 | US-002 | Blast Radius Validation | Must Have | Draft |
| REQ-004 | US-002, US-003 | Blast Radius Validation | Should Have | Draft |
| REQ-005 | US-001 | Blast Radius Validation | Must Have | Draft |
| REQ-006 | US-001 | Blast Radius Validation | Must Have | Draft |
| REQ-007 | US-001, US-004 | Blast Radius Validation | Must Have | Draft |
| NFR-001 | -- | Quality Attributes | Must Have | Draft |
| NFR-002 | US-004 | Quality Attributes | Must Have | Draft |
| NFR-003 | -- | Quality Attributes | Must Have | Draft |
| NFR-004 | -- | Quality Attributes | Must Have | Draft |
| NFR-005 | -- | Quality Attributes | Must Have | Draft |
| CON-001 | -- | Constraints | Must Have | Draft |
| CON-002 | -- | Constraints | Must Have | Draft |
| CON-003 | -- | Constraints | Must Have | Draft |
| CON-004 | -- | Constraints | Must Have | Draft |
| CON-005 | -- | Constraints | Must Have | Draft |
