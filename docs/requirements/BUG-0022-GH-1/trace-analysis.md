# Trace Analysis: Build Integrity Check Missing from test-generate Workflow

**Generated**: 2026-02-17T20:00:00Z
**Bug**: BUG-0022-GH-1
**External ID**: GH-1 (Gitea Issue #1)
**Workflow**: fix
**Phase**: 02-tracing

---

## Executive Summary

The `/isdlc test generate` workflow declares QA APPROVED and COMPLETED even when generated test files introduce compilation errors that break the project build. The root cause is an **architectural divergence** between the `test-generate` workflow and the `feature`/`fix` workflows: test-generate uses the older Phase 11 + Phase 07 pipeline (`11-local-testing -> 07-testing`) which lacks build verification, while feature and fix workflows use the consolidated Phase 16 quality-loop (`16-quality-loop`) which includes build verification (QL-007) as a mandatory Track A check. The test-generate workflow was never updated when the quality-loop consolidation happened, leaving a gap where no build integrity check exists anywhere in its pipeline.

**Root Cause Confidence**: HIGH
**Severity**: HIGH
**Estimated Complexity**: MEDIUM

---

## Symptom Analysis

### Error Description

After `/isdlc test generate` completes all 5 phases (05-test-strategy, 06-implementation, 11-local-testing, 07-testing, 08-code-review) with a reported 59/59 test pass rate and QA APPROVED status, running the project build command (`mvn compile`) reveals compilation errors in the generated test files.

### Error Source in Code

The false-positive QA APPROVED is issued by two agents in sequence:

1. **Integration Tester** (`src/claude/agents/06-integration-tester.md`, Phase 07): Validates individual test execution but has NO build verification step. The agent checks:
   - Integration test execution
   - E2E test execution
   - Contract testing
   - Mutation testing
   - Coverage analysis

   **Missing**: No `mvn compile`, `npm run build`, `gradle build`, or any whole-project build check.

2. **QA Engineer** (`src/claude/agents/07-qa-engineer.md`, Phase 08): Performs code review and quality metrics but has NO build verification step. The GATE-08 checklist validates:
   - Code review completed
   - Quality metrics analyzed
   - Static analysis passed
   - QA sign-off obtained

   **Missing**: No build integrity prerequisite for QA sign-off.

### Stack Trace (Conceptual Execution Path)

```
User invokes: /isdlc test generate
  -> Phase 05: test-design-engineer designs test cases (OK)
  -> Phase 06: software-developer writes test files (INTRODUCES COMPILATION ERRORS)
  -> Phase 11: environment-builder builds local env (scope: "local")
  -> Phase 07: integration-tester runs tests individually (PASSES -- tests run in isolation)
  -> Phase 08: qa-engineer reviews code quality (APPROVES -- no build check in gate)
  -> Output: "QA APPROVED, 5/5 phases PASSED, 59/59 tests passing"
  -> User runs: mvn compile
  -> COMPILATION FAILURE in generated test files
```

### Triggering Conditions

1. **Compiled languages only**: Java (Maven/Gradle), TypeScript, Go, Rust -- languages where individual test execution can succeed while the full project build fails
2. **Common compilation error patterns**:
   - Missing or incorrect import statements
   - Wrong package name declarations
   - References to non-existent dependencies
   - Incorrect type usage that the test runner resolves via classpath scanning but the compiler does not
3. **Individual test runners bypass compilation**: Tools like Maven Surefire can run individual test files even if other parts of the build are broken

### Reproduction Steps (Validated)

1. Run `/isdlc test generate` on a Java project with Maven build system
2. Workflow completes all 5 phases with QA APPROVED
3. Run `mvn compile` -- build fails with compilation errors in generated test files
4. Framework reported success when the project is broken

---

## Execution Path

### Entry Point

The test-generate workflow is initiated via `/isdlc test generate` and processed by the Phase-Loop Controller in `src/claude/commands/isdlc.md`.

### Workflow Definition

From `src/isdlc/config/workflows.json` (lines 194-223):

```json
"test-generate": {
    "phases": [
        "05-test-strategy",
        "06-implementation",
        "11-local-testing",
        "07-testing",
        "08-code-review"
    ],
    "gate_mode": "strict",
    "agent_modifiers": {
        "11-local-testing": {
            "scope": "local"
        }
    }
}
```

### Phase-to-Agent Mapping (from isdlc.md STEP 3d)

| Phase Key | Agent | Build Check? |
|-----------|-------|-------------|
| `05-test-strategy` | `test-design-engineer` | N/A (design only) |
| `06-implementation` | `software-developer` | NO |
| `11-local-testing` | `environment-builder` | Builds app for serving, NOT a compilation check |
| `07-testing` | `integration-tester` | NO |
| `08-code-review` | `qa-engineer` | NO |

### Critical Comparison: test-generate vs feature/fix

| Aspect | feature/fix Workflow | test-generate Workflow |
|--------|---------------------|----------------------|
| Quality phase | `16-quality-loop` | `11-local-testing` + `07-testing` |
| Build verification | YES (QL-007 in Track A, Group A1) | NO |
| Lint check | YES (QL-005 in Track A, Group A1) | NO |
| Type check | YES (QL-006 in Track A, Group A1) | NO |
| SAST scan | YES (QL-008 in Track B, Group B1) | NO |
| Dependency audit | YES (QL-009 in Track B, Group B1) | NO |
| Parallel execution | YES (Track A + Track B) | NO (sequential) |

### Data Flow Analysis

```
Test Design Engineer (Phase 05)
  -> Produces: test-strategy.md with test case definitions
  -> Passes to: Software Developer

Software Developer (Phase 06)
  -> Reads: test-strategy.md
  -> Writes: test files (*.test.ts, *Test.java, *_test.go, etc.)
  -> MAY introduce: incorrect imports, wrong package names, missing deps
  -> NO BUILD CHECK after writing files

Environment Builder (Phase 11, scope: "local")
  -> Reads: project config (package.json, pom.xml)
  -> Runs: build + start command for serving the application
  -> BUT: This builds the APPLICATION, not validates TEST compilation
  -> The scope is "launch a server for integration tests to hit"
  -> Does NOT run a full compile that would catch test file errors

Integration Tester (Phase 07)
  -> Reads: testing_environment URL
  -> Runs: individual test files against live endpoints
  -> Individual tests may PASS even with global compilation errors
  -> GATE-07 checks: all tests pass, coverage >= 70%, no critical defects
  -> GATE-07 does NOT check: full project build integrity

QA Engineer (Phase 08)
  -> Reads: source code + test results
  -> Reviews: code quality, traceability, documentation
  -> GATE-08 checks: code review complete, quality metrics met
  -> GATE-08 does NOT check: build integrity
  -> Issues: QA APPROVED even though build is broken
```

### Where the Build Check SHOULD Happen

The build integrity check should be inserted at one of these points:

**Option A (Recommended): Replace 11+07 with 16-quality-loop in test-generate workflow**

Align test-generate with feature/fix by using `16-quality-loop` instead of the split `11-local-testing` + `07-testing`. The quality-loop already has build verification (QL-007), lint (QL-005), type check (QL-006), and all other quality checks.

New phases: `["05-test-strategy", "06-implementation", "16-quality-loop", "08-code-review"]`

**Option B: Add build check to Phase 07 (integration-tester)**

Add a build verification step to `06-integration-tester.md` before running tests. This would catch the issue but only for workflows that use Phase 07.

**Option C: Add build check to Phase 08 (qa-engineer)**

Add a build integrity prerequisite to GATE-08. This would be a safety net for ALL workflows.

**Recommended approach**: Option A (primary) + Option C (safety net). Option A eliminates the architectural divergence. Option C adds defense-in-depth.

---

## Root Cause Analysis

### Hypothesis 1: test-generate workflow uses legacy phase pipeline (CONFIDENCE: HIGH)

**Evidence:**
- `workflows.json` defines test-generate with phases `[05, 06, 11, 07, 08]`
- Feature workflow uses `[..., 06, 16, 08]` with Phase 16 quality-loop
- Fix workflow uses `[..., 06, 16, 08]` with Phase 16 quality-loop
- Phase 16 quality-loop includes QL-007 (build-verification) as a mandatory Track A check
- Phase 07 (integration-tester) has NO build verification step
- Phase 11 (environment-builder) builds the app for serving, NOT for compilation validation
- The MEMORY.md states: "Phase 16-quality-loop replaces 11-local-testing + 07-testing + 10-cicd in feature/fix workflows"
- This replacement was NOT applied to test-generate

**Root Cause**: When Phase 16 was introduced to consolidate `11-local-testing` + `07-testing` + `10-cicd`, the `test-generate` workflow was not updated. It still uses the old split phases that lack build verification.

### Hypothesis 2: No gate-level build integrity enforcement exists (CONFIDENCE: HIGH)

**Evidence:**
- `gate-blocker.cjs` contains no references to "build" or "compile"
- GATE-07 checklist in `06-integration-tester.md` checks test execution but not build integrity
- GATE-08 checklist in `07-qa-engineer.md` checks code quality but not build integrity
- GATE-16 checklist in `16-quality-loop-engineer.md` DOES check "Clean build succeeds" -- but test-generate never reaches Phase 16
- No hook enforces build integrity before QA sign-off

**Root Cause**: Build integrity is only enforced within Phase 16's agent-level checklist. There is no framework-level (hook-level) enforcement, meaning any workflow that bypasses Phase 16 also bypasses build checks.

### Hypothesis 3: Individual test execution masks compilation errors (CONFIDENCE: MEDIUM)

**Evidence:**
- Java test runners (Maven Surefire/Failsafe) can execute individual test classes without requiring a full project compilation
- TypeScript test runners (Jest with ts-jest, Vitest) may transpile individual files without running `tsc --noEmit`
- The integration-tester validates test execution success, not compilation success
- 59/59 tests passing while `mvn compile` fails demonstrates this gap

**Root Cause**: The testing agents validate test EXECUTION (which uses test-runner-level compilation) but not project BUILD (which uses build-tool-level compilation). These are different levels of validation with different strictness.

### Hypothesis Ranking

| # | Hypothesis | Confidence | Impact | Fix Complexity |
|---|-----------|-----------|--------|----------------|
| 1 | Legacy phase pipeline in test-generate | HIGH | ROOT CAUSE | LOW -- update workflows.json |
| 2 | No gate-level build enforcement | HIGH | CONTRIBUTING | MEDIUM -- add hook or gate check |
| 3 | Test execution masks compilation | MEDIUM | SYMPTOM | N/A -- resolved by H1+H2 |

### Suggested Fixes

#### Fix 1: Update test-generate workflow to use Phase 16 (Addresses H1)

**File**: `src/isdlc/config/workflows.json`
**Change**: Replace phases `["05-test-strategy", "06-implementation", "11-local-testing", "07-testing", "08-code-review"]` with `["05-test-strategy", "06-implementation", "16-quality-loop", "08-code-review"]`

This aligns test-generate with feature/fix and brings in all quality-loop checks including build verification (QL-007).

#### Fix 2: Add build integrity check to quality-loop-engineer with auto-fix loop (Addresses FR-01, FR-02)

**File**: `src/claude/agents/16-quality-loop-engineer.md`
**Change**: Enhance the QL-007 build verification skill instructions to:
1. Detect build system (language-aware lookup table)
2. Run build command after test files are written
3. If build fails with MECHANICAL errors (imports, paths, packages): auto-fix loop (max 3 iterations)
4. If build fails with LOGICAL errors: report failure, block QA sign-off

#### Fix 3: Add honest failure reporting (Addresses FR-03)

**File**: `src/claude/agents/16-quality-loop-engineer.md`
**Change**: When build fails after auto-fix attempts, the quality report must:
- NOT declare QA APPROVED
- List specific compilation errors with file paths and line numbers
- Classify each error (mechanical vs logical)
- Suggest `/isdlc fix` workflow for remaining issues
- Set workflow status to FAILED

#### Fix 4: Add build integrity as gate prerequisite (Addresses FR-04, H2)

**Files**:
- `src/claude/agents/16-quality-loop-engineer.md` -- GATE-16 already has "Clean build succeeds" but needs enforcement for auto-fix vs fail distinction
- `src/claude/agents/07-qa-engineer.md` -- Add build integrity as GATE-08 prerequisite (safety net for any workflow)
- Consider adding `build-integrity-check` to `gate-blocker.cjs` for hook-level enforcement

#### Fix 5: Update isdlc.md command definition (Addresses H1)

**File**: `src/claude/commands/isdlc.md`
**Change**: Update the `test generate` action definition to reflect new phase sequence:
- Old: `["05-test-strategy", "06-implementation", "11-local-testing", "07-testing", "08-code-review"]`
- New: `["05-test-strategy", "06-implementation", "16-quality-loop", "08-code-review"]`

---

## Files Requiring Modification

| # | File Path | Change Type | Fix Requirement |
|---|-----------|-------------|-----------------|
| 1 | `src/isdlc/config/workflows.json` | MODIFY | FR-01, FR-04: Replace 11+07 with 16 in test-generate phases |
| 2 | `src/claude/commands/isdlc.md` | MODIFY | FR-01: Update test generate phase list and description |
| 3 | `src/claude/agents/16-quality-loop-engineer.md` | MODIFY | FR-01, FR-02, FR-03: Add build integrity check with auto-fix loop and honest failure reporting |
| 4 | `src/claude/skills/quality-loop/build-verification/SKILL.md` | MODIFY | FR-01: Enhance skill description with language-aware build detection and auto-fix |
| 5 | `src/claude/agents/07-qa-engineer.md` | MODIFY | FR-04: Add build integrity as GATE-08 safety net prerequisite |

---

## Tracing Metadata

```json
{
  "tracing_completed_at": "2026-02-17T20:00:00Z",
  "sub_agents": ["T1-symptom-analyzer", "T2-execution-path-tracer", "T3-root-cause-identifier"],
  "discovery_report_used": "docs/project-discovery-report.md",
  "bug_report_used": "docs/requirements/BUG-0022-GH-1/bug-report.md",
  "requirements_spec_used": "docs/requirements/BUG-0022-GH-1/requirements-spec.md",
  "error_keywords": ["QA APPROVED", "compilation error", "build integrity", "test-generate", "quality-loop"],
  "files_analyzed": [
    "src/isdlc/config/workflows.json",
    "src/claude/commands/isdlc.md",
    "src/claude/agents/16-quality-loop-engineer.md",
    "src/claude/agents/06-integration-tester.md",
    "src/claude/agents/07-qa-engineer.md",
    "src/claude/agents/05-software-developer.md",
    "src/claude/agents/10-dev-environment-engineer.md",
    "src/claude/skills/quality-loop/build-verification/SKILL.md",
    "src/claude/hooks/gate-blocker.cjs"
  ],
  "hypotheses_count": 3,
  "primary_hypothesis": "test-generate uses legacy 11+07 phase pipeline that lacks build verification (QL-007)",
  "root_cause_confidence": "high",
  "severity": "high",
  "estimated_complexity": "medium"
}
```
