# Markdown Validation Test Cases: BUG-0019-GH-1

## Overview

The primary fix targets markdown agent instructions (`isdlc.md` STEP 3f, `00-sdlc-orchestrator.md`). These tests validate that after implementation, the markdown files contain the required instruction patterns for blast-radius-specific handling.

**Test File**: `src/claude/hooks/tests/test-blast-radius-step3f.test.cjs`
**Framework**: `node:test` + `node:assert/strict`

**Implementation Note**: These tests read the actual markdown files from the project tree and validate content patterns. They run as part of the CJS hook test suite.

---

## 1. STEP 3f Content Validation (isdlc.md)

### TC-MD-01: STEP 3f contains blast-radius-validator detection

**Requirement**: FR-05, AC-05.1
**Priority**: P0

**Steps**:
1. Read `src/claude/commands/isdlc.md`
2. Locate the STEP 3f section (between "3f." marker and next "STEP" or "####" marker)
3. Verify the section contains a reference to `blast-radius-validator` or `blast.radius` as a specific case
4. Verify it is treated differently from the generic hook block path

**Expected Result**: STEP 3f contains a conditional branch that detects blast-radius-validator blocks specifically.

---

### TC-MD-02: STEP 3f contains unaddressed file extraction instructions

**Requirement**: FR-01, FR-05 (AC-01.4, AC-05.2)
**Priority**: P0

**Steps**:
1. Read the blast-radius-specific branch in STEP 3f
2. Verify it contains instructions to extract/parse unaddressed file paths from the block message
3. Verify it references the `"  - path/to/file (expected: CHANGE_TYPE)"` format

**Expected Result**: STEP 3f instructs the controller to parse the block message for file paths and change types.

---

### TC-MD-03: STEP 3f contains tasks.md cross-reference instructions

**Requirement**: FR-02, FR-05 (AC-02.1, AC-02.2, AC-05.3)
**Priority**: P0

**Steps**:
1. Read the blast-radius-specific branch in STEP 3f
2. Verify it contains instructions to read `docs/isdlc/tasks.md`
3. Verify it contains instructions to match unaddressed files against task entries

**Expected Result**: STEP 3f instructs the controller to cross-reference unaddressed files against tasks.md.

---

### TC-MD-04: STEP 3f contains re-delegation instructions

**Requirement**: FR-01, FR-05 (AC-01.1, AC-05.4)
**Priority**: P0

**Steps**:
1. Read the blast-radius-specific branch in STEP 3f
2. Verify it contains instructions to re-delegate to the implementation agent (Phase 06 / software-developer)
3. Verify the re-delegation includes the file list and matched tasks

**Expected Result**: STEP 3f instructs re-delegation to implementation with specific file and task context.

---

### TC-MD-05: STEP 3f contains retry loop with max 3 iterations

**Requirement**: FR-03, FR-05 (AC-03.2, AC-05.5)
**Priority**: P0

**Steps**:
1. Read the blast-radius-specific branch in STEP 3f
2. Verify it contains a retry/loop mechanism
3. Verify the maximum iteration count is 3

**Expected Result**: STEP 3f specifies a maximum of 3 blast radius retry iterations.

---

### TC-MD-06: STEP 3f contains escalation on retry limit exceeded

**Requirement**: FR-03 (AC-03.3)
**Priority**: P1

**Steps**:
1. Read the blast-radius-specific branch in STEP 3f
2. Verify it contains escalation instructions for when the retry limit is exceeded
3. Verify escalation includes a summary of remaining unaddressed files

**Expected Result**: STEP 3f instructs escalation to human with unaddressed file summary after 3 retries.

---

### TC-MD-07: STEP 3f contains prohibition against modifying impact-analysis.md

**Requirement**: FR-01 (AC-01.2, AC-01.3)
**Priority**: P0

**Steps**:
1. Read the blast-radius-specific branch in STEP 3f
2. Verify it contains an explicit prohibition: the re-delegation prompt must include a statement that the implementation agent MUST NOT modify impact-analysis.md
3. Verify it also prohibits modifying state.json blast radius metadata

**Expected Result**: STEP 3f includes explicit prohibitions in the re-delegation instructions.

---

### TC-MD-08: STEP 3f contains deferral validation from requirements-spec.md

**Requirement**: FR-04 (AC-04.1, AC-04.4)
**Priority**: P1

**Steps**:
1. Read the blast-radius-specific branch in STEP 3f
2. Verify it contains instructions to check requirements-spec.md for a `## Deferred Files` section
3. Verify it states that only files listed there are valid deferrals

**Expected Result**: STEP 3f references requirements-spec.md as the sole authority for valid file deferrals.

---

### TC-MD-09: STEP 3f preserves existing non-blast-radius block handling

**Requirement**: NFR-02
**Priority**: P0

**Steps**:
1. Read the full STEP 3f section
2. Verify the existing generic block handling path (Retry/Skip/Cancel for non-blast-radius hooks) is still present
3. Verify the blast-radius branch is additive, not a replacement

**Expected Result**: Generic hook block handling (Retry/Skip/Cancel) remains intact for non-blast-radius hooks.

---

## 2. Orchestrator Content Validation (00-sdlc-orchestrator.md)

### TC-MD-10: Orchestrator contains blast radius relaxation prevention

**Requirement**: FR-01 (AC-01.2, AC-01.3)
**Priority**: P1

**Steps**:
1. Read `src/claude/agents/00-sdlc-orchestrator.md`
2. Verify it contains guidance about blast radius handling
3. Verify it explicitly states that relaxing blast radius by modifying impact analysis is prohibited

**Expected Result**: Orchestrator agent file contains blast radius integrity guidance.

---

### TC-MD-11: Orchestrator contains impact-analysis.md read-only constraint

**Requirement**: FR-01 (AC-01.2)
**Priority**: P1

**Steps**:
1. Read `src/claude/agents/00-sdlc-orchestrator.md`
2. Verify it states that impact-analysis.md is read-only after Phase 02 (tracing)
3. Verify it documents that deferrals must be requirements-justified

**Expected Result**: Orchestrator agent file documents impact-analysis.md immutability constraint.

---

## 3. Regression Validation

### TC-REG-01: Non-blast-radius hook blocks use generic handling

**Requirement**: NFR-02
**Priority**: P0

**Steps**:
1. Read the full STEP 3f section in isdlc.md
2. Verify the generic `blocked_by_hook` handling still references Retry/Skip/Cancel via AskUserQuestion
3. Verify no other hook names are given specialized branches (only blast-radius-validator)

**Expected Result**: Generic handling preserved for gate-blocker, phase-sequence-guard, and all other hooks.

---

### TC-REG-02: blast-radius-validator.cjs unchanged

**Requirement**: NFR-01
**Priority**: P0

**Steps**:
1. Compute checksum of `src/claude/hooks/blast-radius-validator.cjs` after implementation
2. Compare against pre-implementation checksum (or verify no git diff on this file)
3. Run existing blast-radius-validator test suite

**Expected Result**: File unchanged; all 75 existing tests pass.

---

### TC-REG-03: Existing blast-radius-validator tests pass

**Requirement**: NFR-01
**Priority**: P0

**Steps**:
1. Run `node --test src/claude/hooks/tests/test-blast-radius-validator.test.cjs`
2. Verify all tests pass with 0 failures

**Expected Result**: 75 tests pass, 0 fail.
