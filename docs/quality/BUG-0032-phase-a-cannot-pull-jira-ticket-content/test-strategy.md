# Test Strategy: BUG-0032 Phase A Cannot Pull Jira Ticket Content

**Bug ID:** BUG-0032-GH-7
**Phase:** 05-test-strategy
**Created:** 2026-02-23
**Workflow Type:** fix

---

## Existing Infrastructure (from test evaluation)

- **Framework**: Node.js built-in `node:test` + `node:assert/strict` (Node 18+)
- **CJS Test Pattern**: `src/claude/hooks/tests/*.test.cjs` (run via `node --test`)
- **Existing Test Files**: `test-three-verb-utils.test.cjs` (detectSource, generateSlug, resolveItem coverage)
- **Test Helpers**: Inline `createTestDir()` / `cleanupTestDir()` pattern in each test file
- **Current Coverage**: detectSource() has 5 existing tests including Jira pattern matching

## Nature of the Fix

This is a **specification-only fix**. The primary change is to `src/claude/commands/isdlc.md` -- a markdown file that provides agent instructions. There is no programmatic code being added or modified. The MCP tool calls (`getJiraIssue`, `getAccessibleAtlassianResources`) are invoked by the Claude agent at runtime based on the specification text, not by executable JavaScript.

### Testing Implications

Because the fix is a specification change:
- **Unit tests of runtime functions** are limited to regression coverage of `detectSource()` and `generateSlug()` (unchanged functions)
- **Specification validation tests** verify that `isdlc.md` contains the correct MCP tool patterns, conditional branches, and error handling instructions after the fix
- **No integration tests against live MCP** are feasible in CI (MCP requires active Claude session)

## Test Pyramid

### Level 1: Specification Validation Tests (Primary)
Programmatic tests that read `isdlc.md` and assert the presence of required specification patterns. These tests verify that the fix was applied correctly at the specification level.

| Test ID | Description | What It Validates |
|---------|-------------|-------------------|
| SV-01 | Add handler step 3b contains `getJiraIssue` MCP call | FR-001 AC-001-01 |
| SV-02 | Add handler step 3b contains `getAccessibleAtlassianResources` for cloudId | FR-003 AC-003-01 |
| SV-03 | Add handler step 3b maps `issuetype.name === "Bug"` to `item_type = "BUG"` | FR-001 AC-001-02, AC-001-03 |
| SV-04 | Add handler step 3b specifies error fallback for failed fetch | FR-001 AC-001-05 |
| SV-05 | Add handler step 3b specifies fetched summary used for slug | FR-001 AC-001-04 |
| SV-06 | Analyze handler Group 1 contains conditional Jira fetch | FR-002 AC-002-01 |
| SV-07 | Analyze handler Group 1 specifies fail-fast on Jira fetch error | FR-002 AC-002-03 |
| SV-08 | Analyze handler passes fetched data as `issueData` to add handler | FR-002 AC-002-02 |
| SV-09 | Specification includes Jira URL parsing for `--link` flag | FR-004 AC-004-01 |
| SV-10 | Specification includes MCP unavailability graceful degradation | FR-003 AC-003-03 |
| SV-11 | Analyze handler specifies draft includes Jira title, description, AC | FR-002 AC-002-04 |
| SV-12 | CloudId resolution handles multiple cloud instances | FR-003 AC-003-02 |
| SV-13 | Non-Jira URLs preserve existing behavior (`--link` guard) | FR-004 AC-004-03 |

### Level 2: Regression Tests (Secondary)
Tests that confirm existing `detectSource()` behavior is preserved after the fix. These extend the existing test suite in `test-three-verb-utils.test.cjs`.

| Test ID | Description | What It Validates |
|---------|-------------|-------------------|
| RT-01 | `detectSource("PROJ-123")` returns `{ source: "jira", source_id: "PROJ-123" }` | CON-003 (backward compat) |
| RT-02 | `detectSource("MYAPP-1")` returns jira source | CON-003 |
| RT-03 | `detectSource("#42")` still returns `{ source: "github", source_id: "GH-42" }` | CON-003 |
| RT-04 | `detectSource("fix login bug")` still returns manual | CON-003 |
| RT-05 | `detectSource("123", { issueTracker: "jira", jiraProjectKey: "PROJ" })` returns jira/PROJ-123 | CON-003 |
| RT-06 | `detectSource("123", { issueTracker: "github" })` returns github/GH-123 | CON-003 |
| RT-07 | `generateSlug("PROJ-123")` produces `"proj-123"` (raw input without fetch) | Baseline behavior |
| RT-08 | `generateSlug("Add login page")` produces `"add-login-page"` (slug from title) | Baseline behavior |

### Level 3: Specification Structure Tests (Tertiary)
Tests that verify the specification maintains structural consistency -- both GitHub and Jira paths are present in parallel, and the Jira path mirrors the GitHub pattern.

| Test ID | Description | What It Validates |
|---------|-------------|-------------------|
| SS-01 | Add handler has both step 3a (GitHub) and step 3b (Jira) branches | Structural parity |
| SS-02 | Analyze handler Group 1 has both GitHub and Jira conditional fetches | Structural parity |
| SS-03 | Error handling pattern matches between GitHub and Jira paths | Behavioral parity |
| SS-04 | `gh issue view` call still present (no accidental removal) | Regression guard |

## Flaky Test Mitigation

All tests in this strategy are deterministic:
- **Specification validation tests** read a static file (`isdlc.md`) and check for string/regex patterns. No network, no timing, no randomness.
- **Regression tests** call pure functions (`detectSource`, `generateSlug`) with fixed inputs. No I/O.
- **No mocking required**: The tests do not call MCP tools or external services.

Flaky test risk: **NONE** (all tests are pure or file-read-only).

## Performance Test Plan

Performance testing is **not applicable** for this bug fix because:
1. The fix adds specification text to a markdown file -- there is no runtime code path to benchmark.
2. `detectSource()` and `generateSlug()` are O(1) string operations already tested for correctness.
3. MCP tool call latency is controlled by the Atlassian MCP provider, not by iSDLC code.

## Coverage Targets

| Test Type | Count | Coverage Target |
|-----------|-------|-----------------|
| Specification Validation (SV) | 13 | 100% of requirements (FR-001 through FR-004) |
| Regression Tests (RT) | 8 | 100% of detectSource and generateSlug current behavior |
| Specification Structure (SS) | 4 | Structural parity between GitHub and Jira paths |
| **Total** | **25** | **100% requirement coverage** |

## Test Commands (existing infrastructure)

- **Run all CJS tests**: `node --test src/claude/hooks/tests/test-three-verb-utils.test.cjs`
- **Run BUG-0032 spec tests**: `node --test src/claude/hooks/tests/test-bug-0032-jira-spec.test.cjs`
- **Run all hook tests**: `npm run test:hooks`

## Critical Paths

1. **Add handler Jira fetch path**: User provides `PROJ-123` -> detectSource identifies Jira -> spec instructs agent to call getAccessibleAtlassianResources -> call getJiraIssue -> extract type, summary -> set item_type, generate slug from title
2. **Analyze handler Jira fetch path**: User provides `PROJ-123` to analyze -> optimized path Group 1 fires Jira fetch in parallel -> Group 2 uses fetched data for auto-add and draft creation
3. **Graceful degradation path**: MCP unavailable -> log warning -> fall through to manual entry (no crash, no block)
4. **URL parsing path**: `--link https://company.atlassian.net/browse/PROJ-123` -> extract PROJ-123 -> follow Jira fetch path
