# Implementation Notes: BUG-0019-GH-1

## Bug Fix Summary

Blast-radius-validator correctly identifies unaddressed files during feature implementation, but the phase-loop controller (isdlc.md STEP 3f) treated all hook blocks generically with Retry/Skip/Cancel. On retry, the implementation agent had no blast-radius-specific guidance, leading it to relax the blast radius by modifying impact-analysis.md or adding auto-generated deferrals.

## Changes Made

### 1. src/claude/hooks/lib/blast-radius-step3f-helpers.cjs (NEW)

Created a CJS helper module with 9 exported functions for blast-radius block handling:

- `isBlastRadiusBlock(blockMessage)` -- Detects blast-radius-validator blocks by header pattern
- `parseBlockMessageFiles(blockMessage)` -- Extracts unaddressed file paths and change types from block message
- `matchFilesToTasks(unaddressedFiles, tasksMdContent)` -- Cross-references files against tasks.md entries with discrepancy detection
- `isValidDeferral(filePath, requirementsSpecContent)` -- Validates deferrals from requirements-spec.md Deferred Files section
- `incrementBlastRadiusRetry(state)` -- Manages retry counter in state.json
- `isBlastRadiusRetryExceeded(state)` -- Checks if max 3 retries exceeded
- `logBlastRadiusRetry(state, entry)` -- Logs retry iteration with timestamp
- `buildBlastRadiusRedelegationContext(...)` -- Orchestrates full flow: parse, match, validate deferrals, manage retries
- `formatRedelegationPrompt(context)` -- Formats re-delegation prompt with file list, tasks, and prohibitions

### 2. src/claude/commands/isdlc.md (MODIFIED - STEP 3f)

Enhanced STEP 3f with a specialized blast-radius-validator branch (3f-blast-radius) that:

- Detects when the block is from blast-radius-validator (vs. generic hook)
- Parses unaddressed file paths from the block message
- Validates deferrals against requirements-spec.md (only explicit deferrals are valid)
- Cross-references unaddressed files against tasks.md
- Re-delegates to the implementation agent with specific file list, tasks, and prohibitions
- Enforces max 3 retry iterations before escalation
- Preserves existing generic Retry/Skip/Cancel for non-blast-radius hooks (backward compatible)
- Documents that impact-analysis.md is READ-ONLY after Phase 02

### 3. src/claude/agents/00-sdlc-orchestrator.md (MODIFIED - Section 8.1)

Added Section 8.1 "Blast Radius Integrity Guardrails" after Phase Gate Validation:

- impact-analysis.md is READ-ONLY after Phase 02 (immutable)
- No auto-generated deferrals (only requirements-spec.md Deferred Files are valid)
- Re-implementation over relaxation (the designed recovery path)
- No state.json blast radius metadata tampering
- Retry limit (3) and human escalation

### 4. src/claude/hooks/tests/test-blast-radius-step3f.test.cjs (NEW)

66 tests in 10 suites covering all 5 functional requirements (FR-01 through FR-05) and 3 non-functional requirements (NFR-01 through NFR-03):

- Category 1: Block Message Parsing (TC-PARSE-01 through TC-PARSE-05 + edge cases) -- 8 tests
- Category 2: Task Plan Cross-Reference (TC-TASK-01 through TC-TASK-06 + edge cases) -- 8 tests
- Category 3: Deferral Validation (TC-DEF-01 through TC-DEF-04 + edge cases) -- 7 tests
- Category 4: Retry Counter Management (TC-RETRY-01 through TC-RETRY-05 + edge cases) -- 10 tests
- Category 5: isBlastRadiusBlock Detection -- 6 tests
- Category 6: Integration Flow (TC-INT-01 through TC-INT-11) -- 7 tests
- Category 7: Re-delegation Prompt (TC-INT-02 through TC-INT-04 + extras) -- 6 tests
- Category 8: Markdown Validation isdlc.md (TC-MD-01 through TC-MD-09) -- 9 tests
- Category 9: Markdown Validation orchestrator (TC-MD-10, TC-MD-11) -- 2 tests
- Category 10: Regression Tests (TC-REG-01 through TC-REG-03) -- 3 tests

## Files NOT Changed (Confirmed Working)

- `src/claude/hooks/blast-radius-validator.cjs` -- No changes (NFR-01). Hook correctly identifies unaddressed files.
- `src/claude/hooks/dispatchers/pre-task-dispatcher.cjs` -- No changes needed.

## Test Results

- New tests: 66 pass, 0 fail
- Full hook suite: 1517 pass, 1 pre-existing fail (test-gate-blocker-extended.test.cjs:1321, unrelated)
- Zero regressions introduced

## Key Design Decisions

1. **Helper module in hooks/lib/**: Functions are in a separate CJS module for unit testability. The isdlc.md instructions reference these functions but the LLM can also implement the logic inline -- the helpers serve as a reference implementation and test target.

2. **Additive change to STEP 3f**: The blast-radius-specific handling is a new sub-step (3f-blast-radius) that branches off the existing blocked_by_hook handler. The generic path (Retry/Skip/Cancel) remains intact for all other hooks.

3. **Deferral validation from requirements-spec.md**: Only files listed in the `## Deferred Files` section of requirements-spec.md are accepted as valid deferrals. This prevents the auto-deferral pattern that was circumventing blast radius validation.

4. **Max 3 retries**: Prevents infinite re-implementation loops. After 3 attempts, the human decides (defer with justification, skip/override, or cancel).

## Requirement Traceability

| Requirement | Acceptance Criteria | Implementation | Tests |
|-------------|-------------------|----------------|-------|
| FR-01 | AC-01.1 through AC-01.4 | STEP 3f-blast-radius, helpers | TC-PARSE, TC-INT-01..04, TC-MD-07 |
| FR-02 | AC-02.1 through AC-02.4 | matchFilesToTasks(), STEP 3f | TC-TASK-01..06, TC-INT-01,03,11 |
| FR-03 | AC-03.1 through AC-03.4 | retry counter, logBlastRadiusRetry | TC-RETRY-01..05, TC-INT-05,06 |
| FR-04 | AC-04.1 through AC-04.4 | isValidDeferral(), STEP 3f | TC-DEF-01..04, TC-INT-07,08,10 |
| FR-05 | AC-05.1 through AC-05.5 | STEP 3f-blast-radius | TC-MD-01..09 |
| NFR-01 | No regression | blast-radius-validator.cjs unchanged | TC-REG-02, TC-REG-03 |
| NFR-02 | Backward compatible | Generic path preserved | TC-MD-09, TC-REG-01 |
| NFR-03 | Logging | logBlastRadiusRetry() | TC-RETRY-05, TC-INT-05 |
