# Test Data Plan: BUG-0032 Phase A Cannot Pull Jira Ticket Content

**Bug ID:** BUG-0032-GH-7
**Phase:** 05-test-strategy
**Created:** 2026-02-23

---

## Overview

This bug fix modifies a markdown specification file (`isdlc.md`), not runtime code. Test data consists of:
1. **String patterns** checked against the specification file content
2. **Function inputs** for regression testing `detectSource()` and `generateSlug()`
3. **Specification structure patterns** for structural parity validation

No database fixtures, API mocks, or runtime test data are needed.

---

## Boundary Values

### detectSource() Input Boundaries

| Input | Expected Source | Boundary Type | Test |
|-------|----------------|---------------|------|
| `"PROJ-123"` | jira | Valid Jira pattern (standard) | RT-01 |
| `"MYAPP-1"` | jira | Valid Jira pattern (single digit) | RT-02 |
| `"A-1"` | jira | Minimum valid Jira pattern (1 char project) | Covered by existing tests |
| `"LONGPROJECTKEY-99999"` | jira | Maximum reasonable Jira pattern | Covered by existing tests |
| `"#42"` | github | Valid GitHub pattern | RT-03 |
| `"#0"` | github | Minimum GitHub issue number | Covered by existing tests |
| `"fix login bug"` | manual | Free text (no pattern match) | RT-04 |
| `""` | manual | Empty string | Covered by existing tests |
| `null` | manual | Null input | Covered by existing tests |
| `"123"` | jira (with options) | Bare number with jira preference | RT-05 |
| `"123"` | github (with options) | Bare number with github preference | RT-06 |

### generateSlug() Input Boundaries

| Input | Expected Output | Boundary Type | Test |
|-------|----------------|---------------|------|
| `"PROJ-123"` | `"proj-123"` | Raw Jira ref (pre-fix baseline) | RT-07 |
| `"Add login page"` | `"add-login-page"` | Descriptive title (post-fix expected) | RT-08 |
| `""` | `"untitled-item"` | Empty input | Covered by existing tests |
| `"x".repeat(100)` | 50 char max | Max length truncation | Covered by existing tests |

---

## Invalid Inputs

### Specification Validation Invalid Patterns

The specification validation tests (SV-*) check for the **absence** of required patterns before the fix is applied. These are "negative data" in the sense that the pre-fix specification is the invalid input:

| Pattern | Valid State (post-fix) | Invalid State (pre-fix) | Test |
|---------|----------------------|------------------------|------|
| `getJiraIssue` in add handler | Present | Absent | SV-01 |
| `getAccessibleAtlassianResources` | Present | Absent | SV-02 |
| Error fallback text | Present | Absent | SV-04 |
| Jira conditional in Group 1 | Present | Absent | SV-06 |
| Fail-fast for Jira in Group 1 | Present | Absent | SV-07 |
| MCP unavailable degradation | Present | Absent | SV-10 |

### detectSource() Invalid Inputs (Covered by Existing Tests)

| Input | Expected | Why Invalid |
|-------|----------|-------------|
| `null` | `{ source: 'manual', source_id: null }` | Null input |
| `undefined` | `{ source: 'manual', source_id: null }` | Undefined input |
| `123` (number) | `{ source: 'manual', source_id: null }` | Non-string type |
| `""` | `{ source: 'manual', source_id: null }` | Empty string |

---

## Maximum-Size Inputs

### Specification File Size

The `isdlc.md` file is approximately 2400+ lines. The test reads the entire file and performs regex matching. Performance is not a concern because:
- File is read once and cached (the `specContent` variable)
- Regex operations on 2400 lines complete in < 1ms
- No file write operations in any test

### detectSource() Maximum Inputs

| Input | Size | Expected Behavior | Test |
|-------|------|-------------------|------|
| `"VERYLONGPROJECTNAME-999999"` | 27 chars | Returns jira source | Covered by existing tests |
| `"x".repeat(1000)` | 1000 chars | Returns manual source | Covered by existing tests |
| `"#999999999"` | 11 chars | Returns github source | Covered by existing tests |

---

## Specification Pattern Data

These are the exact regex patterns used in the specification validation tests. They define what the implementation (Phase 06) must add to `isdlc.md`:

### Required Patterns (must be present after fix)

| Pattern ID | Regex | Where It Must Appear |
|-----------|-------|---------------------|
| PAT-01 | `/getJiraIssue/i` | Add handler step 3b section |
| PAT-02 | `/getAccessibleAtlassianResources/i` | Add handler step 3b, before getJiraIssue |
| PAT-03 | `/[Cc]ould not fetch [Jj]ira/i` | Add handler step 3b error handling |
| PAT-04 | `/getJiraIssue/i` within Group 1 section | Analyze handler Group 1 |
| PAT-05 | `/[Ff]ail fast/i` with `/[Jj]ira/i` in Group 1 | Analyze handler Group 1 error |
| PAT-06 | `/MCP.*not available/i` | CloudId resolution fallback |
| PAT-07 | `/first.*result/i` or `/first.*accessible/i` | CloudId multi-instance handling |
| PAT-08 | `/[Jj]ira.*draft/i` or `/summary.*description.*draft/i` | Draft content specification |

### Preserved Patterns (must remain after fix)

| Pattern ID | Regex | Purpose |
|-----------|-------|---------|
| PRES-01 | `/gh issue view/gi` (count >= 2) | GitHub fetch not accidentally removed |
| PRES-02 | `/fail fast/i` in Group 1 | Existing error handling preserved |
| PRES-03 | `/issueData/i` | Existing data passing pattern preserved |

---

## Test Data Generation Strategy

All test data is **static and inline** -- no generation or external fixtures required.

- **Specification patterns**: Hard-coded regex in the test file
- **detectSource inputs**: Literal strings in test assertions
- **generateSlug inputs**: Literal strings in test assertions

No database, API, or file system fixtures are needed because:
1. Specification tests read a static file and check for patterns
2. Regression tests call pure functions with literal inputs
3. No external service mocking is required
