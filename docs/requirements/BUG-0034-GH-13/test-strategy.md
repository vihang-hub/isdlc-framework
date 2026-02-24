# Test Strategy: BUG-0034-GH-13

**Bug:** Jira updateStatus at Finalize Not Implemented -- Tickets Not Transitioned to Done
**Phase:** 05-test-strategy
**Created:** 2026-02-23

---

## Existing Infrastructure

- **Framework**: Node.js built-in `node:test` + `node:assert/strict` (Node 18+)
- **Test Style**: CJS (`*.test.cjs`) for hook/spec tests
- **Pattern**: Spec-validation via regex scanning of markdown agent files (established by BUG-0032, BUG-0033)
- **Test Directory**: `src/claude/hooks/tests/`
- **Run Command**: `node --test src/claude/hooks/tests/test-bug-0034-jira-finalize-spec.test.cjs`

## Strategy for This Fix

**Approach**: Extend existing spec-validation test pattern (same as BUG-0032 and BUG-0033).

This is a specification/agent bug -- the fix modifies markdown agent files (`00-sdlc-orchestrator.md`, `isdlc.md`), not JavaScript source. Tests scan the specification files with regex to verify they contain the correct executable instructions for Jira MCP tool calls at finalize.

### Why Spec-Validation Tests

1. The "code" being fixed is the markdown specification that Claude agents execute
2. Regex scanning validates the specification contains required keywords, tool names, and procedural structure
3. This pattern was proven effective by BUG-0032 (read-side Jira MCP) and BUG-0033 (BACKLOG.md finalize)
4. Tests are deterministic -- no MCP calls, no network, no mocking needed

## Test Pyramid

| Layer | Count | Description |
|-------|-------|-------------|
| Specification Validation (SV) | 14 | Scan agent files for concrete MCP instructions |
| Specification Structure (SS) | 5 | Validate structural organization and consistency |
| Regression Tests (RT) | 7 | Guard existing behaviors are not broken |
| **Total** | **26** | |

No integration or E2E tests needed -- this validates specification content, not runtime behavior.

## Test Categories

### 1. Specification Validation (SV-01 through SV-14)

Verify both `00-sdlc-orchestrator.md` and `isdlc.md` contain:
- Concrete MCP tool names (`getTransitionsForJiraIssue`, `transitionJiraIssue`)
- CloudId resolution via `getAccessibleAtlassianResources`
- Transition name matching logic (Done > Complete > Resolved > Closed)
- Non-blocking error handling pattern (try/catch, warning, continue)
- `jira_sync_status` recording (`"synced"`, `"failed"`, absent)
- Conditional execution based on source type (Jira only)
- Field name alignment (no reference to conceptual `updateStatus()` in executable instructions)

**TDD RED STATE**: These tests are expected to FAIL before Phase 06 implements the spec changes. The current files still use the conceptual `updateStatus()` method.

### 2. Specification Structure (SS-01 through SS-05)

Verify structural correctness:
- Finalize mode summary includes Jira sync in execution sequence
- Step ordering is preserved (merge -> Jira -> GitHub -> BACKLOG -> prune)
- Both spec files reference the same MCP procedure (consistency)
- `jira_ticket_id` population instructions exist for Jira-source workflows

### 3. Regression Tests (RT-01 through RT-07)

Guard existing behaviors:
- BACKLOG.md completion step still exists and is not disturbed
- GitHub sync still exists and is not disturbed
- Finalize still includes merge, prune, workflow_history, clear steps
- `detectSource()` still correctly identifies Jira sources
- Non-Jira workflows still skip Jira sync

## Flaky Test Mitigation

Flaky test risk is minimal for this test suite:
- Tests read local files only (no network, no MCP, no external services)
- Regex patterns are anchored to stable structural markers in the spec files
- No timing dependencies, no randomness, no concurrency
- File reads are cached per test suite run

## Performance Test Plan

Not applicable -- spec-validation tests execute in under 1 second. No performance targets needed.

## Coverage Target

- **Requirement Coverage**: 100% of 7 FRs and 19 ACs mapped to test cases
- **Test Type Coverage**: Positive (happy path) + Negative (error/skip paths) for each FR
- **File Coverage**: Both `00-sdlc-orchestrator.md` and `isdlc.md` validated independently

## Test File

- **Location**: `src/claude/hooks/tests/test-bug-0034-jira-finalize-spec.test.cjs`
- **Naming Convention**: Matches existing `test-bug-NNNN-*.test.cjs` pattern
- **Run**: `node --test src/claude/hooks/tests/test-bug-0034-jira-finalize-spec.test.cjs`

## TDD Contract

Tests are written in **red state** -- they define the expected specification content that does not yet exist. Phase 06 (Implementation) will modify the spec files to make these tests pass.

| State | Meaning |
|-------|---------|
| RED (current) | Tests fail -- spec files lack concrete MCP instructions |
| GREEN (after Phase 06) | Tests pass -- spec files contain executable MCP procedure |
