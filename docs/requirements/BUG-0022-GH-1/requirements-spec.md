# Requirements Specification: BUG-0022-GH-1

**Bug ID:** BUG-0022-GH-1
**External Link:** Gitea Issue #1
**External ID:** GH-1
**Workflow Type:** fix
**Date:** 2026-02-17
**Status:** Draft

---

## 1. Context

The `/isdlc test generate` workflow completes all phases and declares QA APPROVED even when generated test files introduce compilation errors that break the project build. The framework lacks a post-generation build integrity check, and has no mechanism to distinguish mechanical issues (auto-fixable) from logical issues (must report failure).

### Related Artifacts
- **Bug Report:** `docs/requirements/BUG-0022-GH-1/bug-report.md`
- **External Tracker:** Gitea Issue #1

---

## 2. Fix Requirements

### FR-01: Post-Generation Build Integrity Check

**Description:** After test generation phases complete (and before QA sign-off), run a full project build/compile check using the language-aware build command.

**Build Command Detection (language-aware):**

| Build File | Language | Build Command |
|-----------|----------|---------------|
| `pom.xml` | Java (Maven) | `mvn compile -q` |
| `build.gradle` / `build.gradle.kts` | Java/Kotlin (Gradle) | `gradle build` |
| `package.json` (with `build` script) | JS/TS (npm) | `npm run build` |
| `package.json` (with `tsc` dep) | TypeScript | `npx tsc --noEmit` |
| `Cargo.toml` | Rust | `cargo check` |
| `go.mod` | Go | `go build ./...` |
| `pyproject.toml` / `setup.py` | Python | `python -m py_compile` (or skip -- interpreted) |
| None detected | Any | Skip build check with warning |

**Priority:** Must Have

### FR-02: Mechanical Issue Auto-Fix Loop

**Description:** When the build check (FR-01) fails, classify errors as MECHANICAL or LOGICAL. For MECHANICAL errors, attempt auto-fix within a bounded iteration loop.

**Mechanical error categories (auto-fixable):**
- Missing or incorrect import statements
- Wrong dependency paths or module references
- Incorrect package names or namespace declarations
- Missing test dependencies in build configuration (pom.xml, package.json, etc.)
- Wrong file locations (test file in wrong directory)

**Auto-fix loop:**
- Maximum 3 auto-fix iterations
- Each iteration: analyze build errors, apply fixes, re-run build check
- If build passes after fix: continue workflow normally
- If still failing after 3 iterations: escalate (classify remaining errors)

**Priority:** Must Have

### FR-03: Honest Failure Reporting for Logical Issues

**Description:** When build fails due to LOGICAL code issues (not auto-fixable), the framework must stop and report failure honestly.

**Logical error categories (NOT auto-fixable):**
- Wrong types or type mismatches
- Missing method signatures or API changes
- Incorrect API usage or argument patterns
- Structural code errors that require understanding of business logic

**Failure report must include:**
- Clear statement that QA is NOT approved
- List of specific compilation errors with file paths and line numbers
- Classification of each error (mechanical vs logical)
- Suggestion to run `/isdlc fix` workflow for the remaining issues
- The workflow status must be set to FAILED (not COMPLETED)

**Priority:** Must Have

### FR-04: Gate Enforcement -- No QA APPROVED with Broken Build

**Description:** The quality gate validation must include build integrity as a mandatory check. QA APPROVED status cannot be granted if the project build is broken.

**Gate check integration:**
- Build integrity check is a prerequisite for QA sign-off
- If build fails (after auto-fix attempts): gate FAILS
- Gate failure message must explain WHY QA was not approved (build errors)
- This applies to `test-generate` workflow specifically, but the build check capability should be reusable by other workflows

**Priority:** Must Have

---

## 3. Non-Functional Requirements

### NFR-01: Build Check Performance
- Build check must complete within the project's normal build time
- No additional overhead beyond the build command itself
- Build command detection must complete in < 1 second

### NFR-02: Language Agnostic Design
- The build check mechanism must be extensible to new languages
- Build command detection should use a lookup table (not hardcoded if/else chains)
- New languages can be added by extending the lookup table

### NFR-03: Graceful Degradation
- If no build system is detected: skip build check with a WARNING (not an error)
- If the build command itself is not installed: skip with a WARNING
- Never block the workflow due to infrastructure issues (Article X: Fail-Safe Defaults)

---

## 4. Acceptance Criteria

### AC-01: Build Check Runs After Test Generation
- **Given** the test-generate workflow has completed its implementation phase
- **When** the quality validation phase begins
- **Then** a full project build/compile check is executed using the detected build command

### AC-02: Build Command Detection
- **Given** a project with a recognized build file (pom.xml, package.json with build script, Cargo.toml, go.mod, etc.)
- **When** the build integrity check is initiated
- **Then** the correct build command is detected and executed

### AC-03: Mechanical Issues Auto-Fixed
- **Given** the build check fails with mechanical errors (missing imports, wrong paths)
- **When** the auto-fix loop runs
- **Then** mechanical errors are corrected and the build passes within 3 iterations

### AC-04: Logical Issues Reported Honestly
- **Given** the build check fails with logical errors (wrong types, missing signatures)
- **When** auto-fix cannot resolve the errors
- **Then** the framework reports failure honestly with specific error details and does NOT declare QA APPROVED

### AC-05: Gate Blocks QA on Broken Build
- **Given** the project build is broken after test generation
- **When** the quality gate validation runs
- **Then** the gate FAILS and QA APPROVED status is NOT granted

### AC-06: Graceful Degradation on Unknown Build System
- **Given** a project with no recognized build system
- **When** the build integrity check is initiated
- **Then** the check is skipped with a WARNING and the workflow proceeds normally

### AC-07: No False Negatives
- **Given** the project build was healthy before test generation AND all generated tests compile correctly
- **When** the build integrity check runs
- **Then** the check passes and the workflow completes normally with QA APPROVED

---

## 5. Scope

### In Scope
- Build integrity check for the test-generate workflow
- Mechanical issue auto-fix loop (imports, paths, dependencies, packages)
- Honest failure reporting with error classification
- Gate enforcement for build integrity
- Language-aware build command detection

### Out of Scope
- Fixing logical code errors automatically (this requires a separate fix workflow)
- Adding build checks to ALL workflows (only test-generate for this fix; other workflows can adopt later)
- Modifying the test runner or test execution logic
- Adding new test generation capabilities

---

## 6. Affected Components (Preliminary)

Based on the framework architecture, the following components are likely affected:

1. **Quality Loop Engineer agent** (`16-quality-loop-engineer.md`) -- needs build check step
2. **Integration Tester agent** (`06-integration-tester.md`) -- needs build check step
3. **Test-generate workflow definition** (`workflows.json`) -- may need phase modifier
4. **Build command detection utility** -- NEW component to create
5. **Gate validation logic** -- needs build integrity as prerequisite

---

## 7. Traceability

| Requirement | Acceptance Criteria | Source |
|-------------|-------------------|--------|
| FR-01 | AC-01, AC-02, AC-06 | Gitea Issue #1 |
| FR-02 | AC-03, AC-07 | Gitea Issue #1 |
| FR-03 | AC-04 | Gitea Issue #1 |
| FR-04 | AC-05 | Gitea Issue #1 |
| NFR-01 | (verified during testing) | Gitea Issue #1 |
| NFR-02 | (verified during design review) | Gitea Issue #1 |
| NFR-03 | AC-06 | Gitea Issue #1 |
