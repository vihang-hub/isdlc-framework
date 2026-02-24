# Test Cases: BUG-0022-GH-1

**Bug ID:** BUG-0022-GH-1
**Title:** Build Integrity Check Missing from test-generate Workflow
**Phase:** 05-test-strategy
**Date:** 2026-02-17
**Test File:** `src/claude/hooks/tests/test-build-integrity.test.cjs`

---

## Section 1: workflows.json -- test-generate Phase Update

### TC-01: test-generate includes 16-quality-loop
- **Requirement:** FR-01 (AC-01)
- **Test Type:** positive
- **Precondition:** Read `src/isdlc/config/workflows.json`
- **Input:** `workflows.test-generate.phases`
- **Expected:** Array includes `"16-quality-loop"`
- **Priority:** P0

### TC-02: test-generate does NOT include 11-local-testing
- **Requirement:** FR-01 (AC-01)
- **Test Type:** negative
- **Precondition:** Read `src/isdlc/config/workflows.json`
- **Input:** `workflows.test-generate.phases`
- **Expected:** Array does NOT include `"11-local-testing"`
- **Priority:** P0

### TC-03: test-generate does NOT include 07-testing
- **Requirement:** FR-01 (AC-01)
- **Test Type:** negative
- **Precondition:** Read `src/isdlc/config/workflows.json`
- **Input:** `workflows.test-generate.phases`
- **Expected:** Array does NOT include `"07-testing"`
- **Priority:** P0

### TC-04: test-generate has correct phase count
- **Requirement:** FR-01 (AC-01)
- **Test Type:** positive
- **Precondition:** Read `src/isdlc/config/workflows.json`
- **Input:** `workflows.test-generate.phases.length`
- **Expected:** Equals 4 (05-test-strategy, 06-implementation, 16-quality-loop, 08-code-review)
- **Priority:** P1

### TC-05: test-generate phases in correct order
- **Requirement:** FR-01 (AC-01)
- **Test Type:** positive
- **Precondition:** Read `src/isdlc/config/workflows.json`
- **Input:** `workflows.test-generate.phases`
- **Expected:** `["05-test-strategy", "06-implementation", "16-quality-loop", "08-code-review"]`
- **Priority:** P0

### TC-06: test-generate 16-quality-loop is after 06-implementation
- **Requirement:** FR-01 (AC-01)
- **Test Type:** positive
- **Precondition:** Read `src/isdlc/config/workflows.json`
- **Input:** Index of `16-quality-loop` vs index of `06-implementation`
- **Expected:** `16-quality-loop` index is exactly `06-implementation` index + 1
- **Priority:** P1

### TC-07: test-generate gate_mode remains strict
- **Requirement:** FR-04 (AC-05)
- **Test Type:** positive
- **Precondition:** Read `src/isdlc/config/workflows.json`
- **Input:** `workflows.test-generate.gate_mode`
- **Expected:** `"strict"`
- **Priority:** P1

### TC-08: test-generate agent_modifiers updated for 16-quality-loop
- **Requirement:** FR-01 (AC-01)
- **Test Type:** positive
- **Precondition:** Read `src/isdlc/config/workflows.json`
- **Input:** `workflows.test-generate.agent_modifiers`
- **Expected:** Does NOT contain `11-local-testing` modifier
- **Priority:** P1

---

## Section 2: isdlc.md -- Command Documentation Update

### TC-09: isdlc.md test generate phase list updated
- **Requirement:** FR-01 (AC-01)
- **Test Type:** positive
- **Precondition:** Read `src/claude/commands/isdlc.md`
- **Input:** Content around `test-generate` phase definition
- **Expected:** Contains `16-quality-loop` in the test-generate phase list
- **Priority:** P0

### TC-10: isdlc.md test generate does NOT reference legacy phases
- **Requirement:** FR-01 (AC-01)
- **Test Type:** negative
- **Precondition:** Read `src/claude/commands/isdlc.md`
- **Input:** The test-generate phase initialization line
- **Expected:** Does NOT contain `"11-local-testing"` or `"07-testing"` in the test-generate phases array
- **Priority:** P0

### TC-11: isdlc.md summary table updated
- **Requirement:** FR-01 (AC-01)
- **Test Type:** positive
- **Precondition:** Read `src/claude/commands/isdlc.md`
- **Input:** Command summary table row for test-generate
- **Expected:** Shows phases including `16(QL)` instead of `11 -> 07`
- **Priority:** P1

### TC-12: isdlc.md and workflows.json phase lists are consistent
- **Requirement:** FR-01 (AC-01)
- **Test Type:** positive
- **Precondition:** Read both `src/isdlc/config/workflows.json` and `src/claude/commands/isdlc.md`
- **Input:** Phase arrays from both files for test-generate
- **Expected:** Both reference the same phase set (05, 06, 16, 08)
- **Priority:** P0

### TC-13: isdlc.md test generate step descriptions updated
- **Requirement:** FR-01 (AC-01)
- **Test Type:** positive
- **Precondition:** Read `src/claude/commands/isdlc.md`
- **Input:** Numbered step list for test generate action
- **Expected:** Contains reference to build verification or quality loop (not just "run tests to verify")
- **Priority:** P2

---

## Section 3: 16-quality-loop-engineer.md -- Build Integrity and Auto-Fix

### TC-14: Agent includes build integrity check section
- **Requirement:** FR-01 (AC-01, AC-02)
- **Test Type:** positive
- **Precondition:** Read `src/claude/agents/16-quality-loop-engineer.md`
- **Input:** File content
- **Expected:** Contains "build integrity" or "build verification" section header or instruction
- **Priority:** P0

### TC-15: Agent includes language-aware build command detection table
- **Requirement:** FR-01 (AC-02)
- **Test Type:** positive
- **Precondition:** Read `src/claude/agents/16-quality-loop-engineer.md`
- **Input:** File content
- **Expected:** Contains a table or list mapping build files to build commands, including at least:
  - `pom.xml` -> Maven
  - `package.json` -> npm/tsc
  - `Cargo.toml` -> Rust
  - `go.mod` -> Go
- **Priority:** P0

### TC-16: Agent includes pom.xml detection
- **Requirement:** FR-01 (AC-02)
- **Test Type:** positive
- **Precondition:** Read `src/claude/agents/16-quality-loop-engineer.md`
- **Input:** File content
- **Expected:** Contains `pom.xml` and a Maven build command (e.g., `mvn compile`)
- **Priority:** P0

### TC-17: Agent includes package.json detection
- **Requirement:** FR-01 (AC-02)
- **Test Type:** positive
- **Precondition:** Read `src/claude/agents/16-quality-loop-engineer.md`
- **Input:** File content
- **Expected:** Contains `package.json` and an npm/tsc build command
- **Priority:** P0

### TC-18: Agent includes Cargo.toml detection
- **Requirement:** FR-01 (AC-02)
- **Test Type:** positive
- **Precondition:** Read `src/claude/agents/16-quality-loop-engineer.md`
- **Input:** File content
- **Expected:** Contains `Cargo.toml` and a Rust build command (e.g., `cargo check`)
- **Priority:** P1

### TC-19: Agent includes go.mod detection
- **Requirement:** FR-01 (AC-02)
- **Test Type:** positive
- **Precondition:** Read `src/claude/agents/16-quality-loop-engineer.md`
- **Input:** File content
- **Expected:** Contains `go.mod` and a Go build command (e.g., `go build`)
- **Priority:** P1

### TC-20: Agent includes auto-fix loop with max 3 iterations
- **Requirement:** FR-02 (AC-03)
- **Test Type:** positive
- **Precondition:** Read `src/claude/agents/16-quality-loop-engineer.md`
- **Input:** File content
- **Expected:** Contains auto-fix loop instruction with maximum of 3 iterations
- **Priority:** P0

### TC-21: Agent classifies errors as mechanical vs logical
- **Requirement:** FR-02, FR-03 (AC-03, AC-04)
- **Test Type:** positive
- **Precondition:** Read `src/claude/agents/16-quality-loop-engineer.md`
- **Input:** File content
- **Expected:** Contains classification of errors into "mechanical" and "logical" categories
- **Priority:** P0

### TC-22: Agent defines mechanical error categories
- **Requirement:** FR-02 (AC-03)
- **Test Type:** positive
- **Precondition:** Read `src/claude/agents/16-quality-loop-engineer.md`
- **Input:** File content
- **Expected:** Lists mechanical errors including at least: imports, paths/dependencies, package names
- **Priority:** P0

### TC-23: Agent defines logical error categories
- **Requirement:** FR-03 (AC-04)
- **Test Type:** positive
- **Precondition:** Read `src/claude/agents/16-quality-loop-engineer.md`
- **Input:** File content
- **Expected:** Lists logical errors including at least: type mismatches, missing signatures, incorrect API usage
- **Priority:** P0

### TC-24: Agent specifies honest failure reporting
- **Requirement:** FR-03 (AC-04)
- **Test Type:** positive
- **Precondition:** Read `src/claude/agents/16-quality-loop-engineer.md`
- **Input:** File content
- **Expected:** Contains instruction to NOT declare QA APPROVED when build fails with logical errors
- **Priority:** P0

### TC-25: Agent specifies failure report content
- **Requirement:** FR-03 (AC-04)
- **Test Type:** positive
- **Precondition:** Read `src/claude/agents/16-quality-loop-engineer.md`
- **Input:** File content
- **Expected:** Failure report must include: specific compilation errors, file paths, error classification, suggestion for `/isdlc fix`
- **Priority:** P0

### TC-26: Agent specifies workflow status FAILED on logical errors
- **Requirement:** FR-03 (AC-04)
- **Test Type:** positive
- **Precondition:** Read `src/claude/agents/16-quality-loop-engineer.md`
- **Input:** File content
- **Expected:** Contains instruction to set workflow status to FAILED (not COMPLETED)
- **Priority:** P1

### TC-27: Agent specifies graceful degradation for unknown build systems
- **Requirement:** NFR-03 (AC-06)
- **Test Type:** positive
- **Precondition:** Read `src/claude/agents/16-quality-loop-engineer.md`
- **Input:** File content
- **Expected:** Contains instruction to skip build check with WARNING when no build system detected
- **Priority:** P1

### TC-28: Agent does not declare QA APPROVED on broken build (negative)
- **Requirement:** FR-04 (AC-05)
- **Test Type:** negative
- **Precondition:** Read `src/claude/agents/16-quality-loop-engineer.md`
- **Input:** File content
- **Expected:** Contains explicit prohibition against QA APPROVED when build is broken
- **Priority:** P0

---

## Section 4: SKILL.md (QL-007) -- Build Verification Skill Enhancement

### TC-29: SKILL.md includes language-aware build detection
- **Requirement:** FR-01 (AC-02)
- **Test Type:** positive
- **Precondition:** Read `src/claude/skills/quality-loop/build-verification/SKILL.md`
- **Input:** File content
- **Expected:** Contains language-aware build detection description or table
- **Priority:** P1

### TC-30: SKILL.md includes mechanical error auto-fix
- **Requirement:** FR-02 (AC-03)
- **Test Type:** positive
- **Precondition:** Read `src/claude/skills/quality-loop/build-verification/SKILL.md`
- **Input:** File content
- **Expected:** Contains description of mechanical error auto-fix capability
- **Priority:** P1

### TC-31: SKILL.md includes error classification
- **Requirement:** FR-02, FR-03 (AC-03, AC-04)
- **Test Type:** positive
- **Precondition:** Read `src/claude/skills/quality-loop/build-verification/SKILL.md`
- **Input:** File content
- **Expected:** Contains reference to mechanical vs logical error classification
- **Priority:** P1

### TC-32: SKILL.md references graceful degradation
- **Requirement:** NFR-03 (AC-06)
- **Test Type:** positive
- **Precondition:** Read `src/claude/skills/quality-loop/build-verification/SKILL.md`
- **Input:** File content
- **Expected:** Contains skip or warning behavior when no build system detected
- **Priority:** P2

---

## Section 5: 07-qa-engineer.md -- GATE-08 Safety Net

### TC-33: QA engineer includes build integrity in GATE-08
- **Requirement:** FR-04 (AC-05)
- **Test Type:** positive
- **Precondition:** Read `src/claude/agents/07-qa-engineer.md`
- **Input:** File content
- **Expected:** GATE-08 checklist or prerequisites include build integrity check
- **Priority:** P0

### TC-34: QA engineer blocks QA APPROVED on broken build
- **Requirement:** FR-04 (AC-05)
- **Test Type:** positive
- **Precondition:** Read `src/claude/agents/07-qa-engineer.md`
- **Input:** File content
- **Expected:** Contains instruction that QA APPROVED cannot be granted if build is broken
- **Priority:** P0

### TC-35: QA engineer build check is a safety net (not primary)
- **Requirement:** FR-04 (AC-05)
- **Test Type:** positive
- **Precondition:** Read `src/claude/agents/07-qa-engineer.md`
- **Input:** File content
- **Expected:** Indicates build integrity is a safety net or prerequisite (defense-in-depth), not the primary build check location
- **Priority:** P2

### TC-36: QA engineer references build command detection
- **Requirement:** FR-01 (AC-02)
- **Test Type:** positive
- **Precondition:** Read `src/claude/agents/07-qa-engineer.md`
- **Input:** File content
- **Expected:** References language-aware build command or delegates to QL-007 for build detection
- **Priority:** P2

---

## Section 6: Cross-File Consistency

### TC-37: feature workflow still uses 16-quality-loop (no regression)
- **Requirement:** (regression check)
- **Test Type:** positive
- **Precondition:** Read `src/isdlc/config/workflows.json`
- **Input:** `workflows.feature.phases`
- **Expected:** Still includes `"16-quality-loop"` and does NOT include `"11-local-testing"` or `"07-testing"`
- **Priority:** P1

### TC-38: fix workflow still uses 16-quality-loop (no regression)
- **Requirement:** (regression check)
- **Test Type:** positive
- **Precondition:** Read `src/isdlc/config/workflows.json`
- **Input:** `workflows.fix.phases`
- **Expected:** Still includes `"16-quality-loop"` and does NOT include `"11-local-testing"` or `"07-testing"`
- **Priority:** P1

### TC-39: AC-07 -- no false negatives when build is healthy
- **Requirement:** FR-01 (AC-07)
- **Test Type:** positive
- **Precondition:** Read `src/claude/agents/16-quality-loop-engineer.md`
- **Input:** File content
- **Expected:** Contains instruction that when build passes, workflow proceeds normally with QA APPROVED
- **Priority:** P1

---

## Test Case Summary

| Section | Test Cases | P0 | P1 | P2 |
|---------|-----------|------|------|------|
| 1: workflows.json | TC-01 to TC-08 | 3 | 4 | 0 |
| 2: isdlc.md | TC-09 to TC-13 | 3 | 1 | 1 |
| 3: quality-loop-engineer.md | TC-14 to TC-28 | 9 | 3 | 0 |
| 4: SKILL.md (QL-007) | TC-29 to TC-32 | 0 | 3 | 1 |
| 5: qa-engineer.md | TC-33 to TC-36 | 2 | 0 | 2 |
| 6: Cross-file consistency | TC-37 to TC-39 | 0 | 3 | 0 |
| **Total** | **39** | **17** | **14** | **4** |
