# Integration Test Cases: BUG-0019-GH-1

## Overview

Integration tests validate the complete blast-radius block handling flow -- from detecting a blast-radius-validator block through re-delegation prompt construction. These tests verify that the individual components (block message parsing, task matching, deferral validation, retry counting) work together correctly.

**Test File**: `src/claude/hooks/tests/test-blast-radius-step3f.test.cjs`
**Framework**: `node:test` + `node:assert/strict`

---

## 1. Full Flow Integration Tests

### TC-INT-01: Complete block handling flow -- parse, match, build prompt

**Requirement**: FR-01, FR-02, FR-05 (AC-01.1, AC-01.4, AC-02.2, AC-02.3, AC-05.1, AC-05.2, AC-05.3, AC-05.4)
**Priority**: P0

**Setup**:
- Block message from `formatBlockMessage()` with 2 unaddressed files: `src/hooks/a.cjs` (MODIFY), `src/agents/b.md` (CREATE)
- tasks.md content with T0004a -> `src/hooks/a.cjs`, T0004b -> `src/agents/b.md`
- state.json with feature workflow at Phase 06

**Steps**:
1. Call `buildBlastRadiusRedelegationContext(blockMessage, tasksMdContent, requirementsSpecContent, state)`
2. Verify the returned context object contains:
   - `unaddressedFiles`: 2 entries with correct paths and change types
   - `matchedTasks`: 2 entries with task IDs T0004a and T0004b
   - `retryIteration`: 1 (first retry)
   - `prohibitions`: array including "DO NOT modify impact-analysis.md"

**Expected Result**: Complete context object ready for re-delegation prompt construction.

---

### TC-INT-02: Re-delegation prompt includes unaddressed file paths

**Requirement**: FR-01, AC-01.4
**Priority**: P0

**Setup**: Context from TC-INT-01.

**Steps**:
1. Call `formatRedelegationPrompt(context)` with the built context
2. Verify the output string contains each unaddressed file path
3. Verify each file path is accompanied by its expected change type

**Expected Result**: Prompt string contains `src/hooks/a.cjs (MODIFY)` and `src/agents/b.md (CREATE)`.

---

### TC-INT-03: Re-delegation prompt includes matched tasks

**Requirement**: FR-02, AC-02.3
**Priority**: P0

**Setup**: Context from TC-INT-01.

**Steps**:
1. Call `formatRedelegationPrompt(context)` with the built context
2. Verify the output string contains task IDs (T0004a, T0004b)
3. Verify task descriptions are included

**Expected Result**: Prompt includes "T0004a" and "T0004b" with their descriptions.

---

### TC-INT-04: Re-delegation prompt includes modification prohibition

**Requirement**: FR-01, AC-01.2, AC-01.3
**Priority**: P0

**Setup**: Context from TC-INT-01.

**Steps**:
1. Call `formatRedelegationPrompt(context)` with the built context
2. Verify the output contains a prohibition against modifying impact-analysis.md
3. Verify the output contains a prohibition against auto-generating deferrals

**Expected Result**: Prompt contains "MUST NOT modify impact-analysis.md" and "MUST NOT add deferral entries".

---

### TC-INT-05: Retry counter incremented and logged in state.json

**Requirement**: FR-03, AC-03.4, NFR-03
**Priority**: P0

**Setup**: state.json with `blast_radius_retries: 0`.

**Steps**:
1. Build context via `buildBlastRadiusRedelegationContext()`
2. Verify `state.blast_radius_retries` is now 1
3. Verify `state.blast_radius_retry_log` contains an entry with iteration=1, unaddressed file count, and timestamp

**Expected Result**: State correctly tracks retry iteration.

---

### TC-INT-06: Escalation triggered after 3 retries

**Requirement**: FR-03, AC-03.2, AC-03.3
**Priority**: P0

**Setup**: state.json with `blast_radius_retries: 3`.

**Steps**:
1. Call `buildBlastRadiusRedelegationContext()` with retry count at limit
2. Verify returns an escalation result instead of a re-delegation context
3. Verify escalation includes summary of remaining unaddressed files

**Expected Result**: Returns `{ escalate: true, reason: 'Blast radius retry limit (3) exceeded', remainingFiles: [...] }`.

---

## 2. Flow with Deferrals

### TC-INT-07: Deferral accepted from requirements-spec.md reduces unaddressed count

**Requirement**: FR-04, AC-04.1, AC-04.2
**Priority**: P1

**Setup**:
- Block message with 3 unaddressed files
- requirements-spec.md with `## Deferred Files` section listing 1 of the 3 files
- tasks.md content

**Steps**:
1. Call `buildBlastRadiusRedelegationContext(blockMessage, tasksMd, requirementsSpec, state)`
2. Verify only 2 files remain in `unaddressedFiles` (the deferred one is excluded)
3. Verify the deferred file is tracked separately in `validDeferrals`

**Expected Result**: Context has 2 unaddressed files and 1 valid deferral.

---

### TC-INT-08: Auto-generated deferral rejected

**Requirement**: FR-04, AC-04.3
**Priority**: P1

**Setup**:
- Block message with 2 unaddressed files
- blast-radius-coverage.md has deferral entries (auto-generated), but requirements-spec.md has no `## Deferred Files` section
- tasks.md content

**Steps**:
1. Call `buildBlastRadiusRedelegationContext(blockMessage, tasksMd, requirementsSpec, state)`
2. Verify both files remain in `unaddressedFiles` (auto-deferrals not honored)

**Expected Result**: Context has 2 unaddressed files; blast-radius-coverage.md deferrals are not treated as valid.

---

## 3. Edge Cases

### TC-INT-09: Block from non-blast-radius hook does not trigger specialized handling

**Requirement**: NFR-02, AC-05.1
**Priority**: P0

**Setup**: Block message from gate-blocker or another hook (does not contain "BLAST RADIUS COVERAGE INCOMPLETE").

**Steps**:
1. Call `isBlastRadiusBlock(blockMessage)` with a gate-blocker message
2. Verify returns `false`
3. Verify the generic Retry/Skip/Cancel path would be used

**Expected Result**: Returns `false`, confirming non-blast-radius blocks are not intercepted.

---

### TC-INT-10: All unaddressed files have valid deferrals (no re-delegation needed)

**Requirement**: FR-04, AC-04.2
**Priority**: P1

**Setup**:
- Block message with 2 unaddressed files
- requirements-spec.md lists both files in `## Deferred Files` with justification

**Steps**:
1. Call `buildBlastRadiusRedelegationContext(blockMessage, tasksMd, requirementsSpec, state)`
2. Verify `unaddressedFiles` is empty
3. Verify the result indicates no re-delegation needed

**Expected Result**: Returns context with `unaddressedFiles: []` and `reDelegationNeeded: false`.

---

### TC-INT-11: tasks.md not found during cross-reference

**Requirement**: FR-02, AC-02.1
**Priority**: P1

**Setup**: tasks.md does not exist (null content), but block message has unaddressed files.

**Steps**:
1. Call `buildBlastRadiusRedelegationContext(blockMessage, null, requirementsSpec, state)`
2. Verify unaddressed files are still included in context
3. Verify `matchedTasks` is empty (no crash)
4. Verify re-delegation still proceeds with file list only

**Expected Result**: Context has unaddressed files with `matchedTasks: []`. Re-delegation proceeds using file paths alone.
