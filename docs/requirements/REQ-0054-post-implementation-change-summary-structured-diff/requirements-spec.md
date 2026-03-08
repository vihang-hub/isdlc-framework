# Requirements Specification: Post-Implementation Change Summary

**Requirement ID:** REQ-0054
**Feature:** Post-implementation change summary -- structured diff report after phase 06
**Version:** 1.0
**Status:** Draft
**Created:** 2026-03-08
**Source:** GitHub Issue #103, Hackability Roadmap Tier 2 (Section 4.3.4)

---

## 1. Project Overview

### 1.1 Problem Statement

After the implementation phase (06) completes, developers have no structured summary of what changed and why. They see individual file edits during the phase but lack a holistic view: which requirements each change addresses, what new files were created and their purpose, and overall test results. This gap also blocks downstream tooling -- user-space hooks (Issue #101) cannot generate Jira updates or Slack notifications without a machine-readable change summary.

### 1.2 Solution

Automatically generate a structured change summary after phase 06 completes. The summary includes:
- Modified files with 1-2 line rationale per file
- New files with purpose description
- Requirement tracing -- which FR/AC each change addresses
- Test results summary -- pass/fail counts, coverage

Output is dual-format:
- `docs/requirements/{artifact_folder}/change-summary.md` (human-readable)
- `.isdlc/change-summary.json` (machine-readable, consumable by hooks)

### 1.3 Success Metrics

- Every completed phase 06 automatically produces change-summary.md and change-summary.json
- JSON schema is stable and documented (versioned at 1.0) for hook consumption
- Every modified file traces back to at least one FR/AC, or is explicitly flagged as "untraced"
- Generator never crashes or blocks the workflow under any condition

### 1.4 Business Drivers

- Part of the Hackability Roadmap (Tier 2, Section 4.3.4)
- Enables user-space hooks (Issue #101) by providing stable machine-readable data format
- Mental model: GitHub "Files changed" tab, augmented with requirement tracing

---

## 2. Stakeholders & Personas

### 2.1 Framework Developer (Primary)

- **Role:** Developer using iSDLC to build features
- **Goals:** Immediate clarity on what phase 06 produced; permanent artifact for PR review and later audits
- **Pain Points:** No consolidated view after implementation; no requirement-to-file mapping; must manually dig through git log
- **Key Tasks:** Reviews inline brief table after phase 06 completes; references change-summary.md in PR context or later audits

### 2.2 Hook Consumer (Secondary, Future)

- **Role:** Automated process (user-space hook script) consuming change-summary.json
- **Goals:** Parse structured change data for external integrations (Jira, Slack, CI/CD)
- **Pain Points:** No machine-readable change format currently exists
- **Key Tasks:** Reads .isdlc/change-summary.json, extracts file list, test results, tracing data
- **Note:** Not a v1 consumer -- JSON format needs to be stable for when Issue #101 lands

### 2.3 Downstream Agent (Tertiary, Optional)

- **Role:** Phase 16 (quality loop) or phase 08 (code review) agents
- **Goals:** Better context for quality validation and code review
- **Pain Points:** Currently relies on raw git diff
- **Key Tasks:** Optionally reads change-summary.md if present
- **Note:** No v1 code changes to make agents consume it -- purely opportunistic

---

## 3. Functional Requirements

### FR-001: Git Diff Collection

**Priority:** Must Have

Collect the list of all changed files (modified, added, deleted, renamed) by diffing the feature branch against its base branch using `git merge-base` to identify the common ancestor.

**Details:**
- Use `git merge-base HEAD <base-branch>` to find the branch point
- Use `git diff --name-status <merge-base>..HEAD` to get the file list with change types
- Capture change types: Modified (M), Added (A), Deleted (D), Renamed (R)

### FR-002: File Classification & Rationale

**Priority:** Must Have

Classify each changed file by its change type (modified, new, deleted, renamed) and generate a 1-2 line rationale for each change based on commit messages and code context.

**Details:**
- Change type derived from git diff --name-status output
- Rationale sourced from commit messages touching each file
- For new files: rationale describes purpose
- For modified files: rationale describes what changed and why

### FR-003: Requirement Tracing

**Priority:** Must Have

Map each changed file to FR-NNN and AC-NNN-NN identifiers. Uses a prioritized source chain with early exit:

**Tracing Priority Order:**
1. **tasks.md trace annotations** (primary) -- pipe-delimited `| traces: FR-001, FR-002` on task lines. If file is covered here, stop.
2. **Commit messages** (fallback) -- scan `git log` for commits touching the file for FR-NNN / AC-NNN-NN patterns
3. **Code comments** (last resort) -- scan file content for FR-NNN / AC-NNN-NN patterns in comments
4. **Untraced** -- if no source matches, flag file as "untraced"

**Details:**
- Parse requirements-spec.md to extract the valid set of FR-NNN and AC-NNN-NN identifiers
- Every file appears in the summary -- traced or explicitly flagged as untraced
- Transparency over cleanliness: untraced files shown with rationale "N/A" or "infrastructure change"

### FR-004: Test Results Summary

**Priority:** Should Have

Extract test pass/fail counts and coverage percentage from state.json phase 06 data (`phases["06-implementation"]`) and include in the summary.

**Details:**
- Read `phases["06-implementation"].iteration_requirements.test_iteration` for test data
- Extract: tests_passing (boolean), coverage_percent
- Read phase summary string for pass/fail counts if available
- If phase 06 data is missing, omit test results section with a warning

### FR-005: Human-Readable Output (change-summary.md)

**Priority:** Must Have

Generate a structured markdown file saved to `docs/requirements/{artifact_folder}/change-summary.md`.

**Format:**
- Metrics header: files modified count, new files count, FRs traced count, test pass/fail counts
- File table: path, change type, rationale, traced FR/AC IDs
- Untraced files clearly distinguished
- Test results section (if available)
- Warnings section (if any degradation occurred)

**Display:**
- Brief table displayed inline to the developer after phase 06 completes
- Full file persists as a permanent artifact in the requirements folder

### FR-006: Machine-Readable Output (change-summary.json)

**Priority:** Must Have

Generate a versioned JSON file saved to `.isdlc/change-summary.json`.

**Schema (v1.0):**
```json
{
  "schema_version": "1.0",
  "generated_at": "ISO-8601 timestamp",
  "workflow_slug": "REQ-NNNN-feature-name",
  "base_branch": "main",
  "base_commit": "sha",
  "head_commit": "sha",
  "summary": {
    "files_modified": 0,
    "files_added": 0,
    "files_deleted": 0,
    "files_renamed": 0,
    "total_files_changed": 0,
    "requirements_traced": 0,
    "requirements_untraced": 0,
    "tests_passing": true,
    "test_count": 0,
    "coverage_percent": 0
  },
  "files": [
    {
      "path": "relative/path/to/file.js",
      "change_type": "modified|added|deleted|renamed",
      "old_path": "only-for-renames",
      "rationale": "1-2 line description",
      "traced_requirements": ["FR-001", "AC-001-01"],
      "tracing_source": "tasks.md|commit|code-comment|untraced"
    }
  ],
  "test_results": {
    "total": 0,
    "passing": 0,
    "failing": 0,
    "coverage_percent": 0
  },
  "warnings": ["list of degradation warnings if any"]
}
```

### FR-007: Graceful Degradation

**Priority:** Must Have

If git is unavailable, tracing data is missing, or any unexpected error occurs, emit a partial summary with warnings instead of crashing. Never block the workflow.

**Degradation Scenarios:**
- Git unavailable: fall back to state.json artifact data, emit warning
- requirements-spec.md missing: mark all files as "untraced", emit warning
- tasks.md missing: fall back to commit messages and code comments for tracing
- state.json phase 06 data missing: omit test results section, emit warning
- Unexpected error: catch, log warning, exit cleanly

**Principle:** Partial data is better than no data. Aligns with Article X (Fail-Safe Defaults).

### FR-008: Phase-Loop Integration

**Priority:** Must Have

Wire the generator into the phase-loop controller to trigger automatically after phase 06 completes (step 3e in isdlc.md), with no user interaction required.

**Details:**
- Called by the orchestrator/phase-loop controller, not by the user
- No menus, no prompts, no confirmation needed
- Script located at `src/antigravity/change-summary-generator.cjs`
- Follows the existing finalize script pattern (analyze-finalize.cjs, workflow-finalize.cjs)
- Workflow continues to next phase without delay after generation

---

## 4. Non-Functional Requirements

| ID | Category | Requirement | Metric | Measurement Method | Priority |
|----|----------|-------------|--------|-------------------|----------|
| NFR-001 | Performance | Generation completes in reasonable time | < 5 seconds for < 50 changed files | Timed execution in test suite | Should Have |
| NFR-002 | Reliability | Generator never crashes | 0 uncaught exceptions under any input | Adversarial input testing (malformed JSON, missing files, empty diff) | Must Have |
| NFR-003 | Reliability | Generator never blocks workflow | Always exits cleanly (exit 0 or returns) | Integration test with phase-loop controller | Must Have |
| NFR-004 | Reliability | Partial output over no output | Emits available data when sources fail | Test with each source individually unavailable | Must Have |
| NFR-005 | Schema Stability | JSON includes schema_version | Field present with value "1.0" | JSON schema validation test | Must Have |
| NFR-006 | Schema Stability | Breaking changes require version bump | Removed/renamed fields increment major version | Code review policy | Must Have |
| NFR-007 | Compatibility | Cross-platform support | Works on macOS, Linux, Windows | CI matrix testing (Article XII) | Must Have |
| NFR-008 | Compatibility | CJS module system | No ESM imports in generator | Static analysis / linting (Article XIII) | Must Have |
| NFR-009 | Maintainability | Self-contained script | Single file + common.cjs utilities, zero new dependencies | Dependency audit | Should Have |
| NFR-010 | Data Integrity | Read-only state.json access | No writes to state.json from generator | Code review + test assertion | Must Have |
| NFR-011 | Data Integrity | Valid JSON output | change-summary.json parses without error under all conditions | JSON.parse validation in tests | Must Have |

---

## 5. Constraints

| ID | Constraint | Rationale |
|----|-----------|-----------|
| CON-001 | Generator must use CommonJS (CJS) syntax | Article XIII -- antigravity scripts run as standalone Node.js processes outside package scope |
| CON-002 | Generator must not add new npm dependencies | Keep the framework lightweight; use Node.js built-ins and git CLI |
| CON-003 | Generator must not mutate state.json | Article XIV -- read-only access to state; generator is observability, not state management |
| CON-004 | Generate once after phase 06 only | No regeneration after quality loop (phase 16) or other phases in v1 |
| CON-005 | No hook integration in v1 | Stable JSON format is the contract; actual hook consumption is Issue #101 |

---

## 6. Assumptions

| ID | Assumption | Impact if Wrong |
|----|-----------|-----------------|
| ASM-001 | The project uses git for version control | Generator falls back to state.json data; no file-level diff available |
| ASM-002 | Feature branches are created from a base branch (main/master) | git merge-base fails; generator emits warning and uses HEAD~N fallback or state.json |
| ASM-003 | requirements-spec.md exists in the artifact folder by the time phase 06 completes | Tracing is skipped; all files marked as "untraced" |
| ASM-004 | tasks.md trace annotations follow the pipe-delimited format | Tracing falls back to commit messages and code comments |
| ASM-005 | state.json contains phase 06 test results when implementation completes | Test results section omitted with warning |

---

## 7. Out of Scope

- Diff hunks or inline code changes in the summary
- Automatic consumption by downstream agents (phase 16, 08)
- Slack/Jira/CI hook integration (Issue #101)
- Code coverage HTML reports
- Semantic analysis of change rationale
- Regeneration after quality loop fixes
- Configuration or customization of summary format
- Interactive UI elements or prompts during generation

---

## 8. Glossary

| Term | Definition |
|------|-----------|
| FR | Functional Requirement (FR-NNN) |
| AC | Acceptance Criterion (AC-NNN-NN) |
| NFR | Non-Functional Requirement (NFR-NNN) |
| Phase 06 | Implementation phase in the iSDLC workflow |
| Phase 16 | Quality loop phase -- validates but does not regenerate summary |
| Phase-loop controller | Orchestrator component that sequences phase execution |
| change-summary.md | Human-readable markdown summary of implementation changes |
| change-summary.json | Machine-readable JSON summary for downstream hook consumption |
| git merge-base | Git command to find the common ancestor of two branches |
| tasks.md | Plan file with task definitions and trace annotations |
| Untraced | A changed file that cannot be mapped to any FR/AC identifier |
| User-space hooks | Custom hook scripts authored by users (Issue #101) |
