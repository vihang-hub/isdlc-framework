# Test Strategy: Post-Implementation Change Summary Generator

**Requirement ID:** REQ-0054
**Artifact Folder:** REQ-0054-post-implementation-change-summary-structured-diff
**Phase:** 05-test-strategy
**Created:** 2026-03-09
**Status:** Draft

---

## 1. Existing Infrastructure

- **Framework:** `node:test` (Node.js built-in test runner)
- **Module System:** CJS (`.cjs` extension) -- matches hooks test pattern
- **Test Runner Command:** `node --test <glob>`
- **Coverage Tool:** `node:test` built-in `--experimental-test-coverage`
- **Existing Patterns:**
  - Hook tests: `src/claude/hooks/tests/*.test.cjs` (CJS, temp dir isolation)
  - Lib tests: `lib/**/*.test.js` (ESM, co-located)
  - E2E tests: `tests/e2e/*.test.js` (ESM, subprocess execution)
- **Existing Utilities:** `src/claude/hooks/tests/hook-test-utils.cjs` (setupTestEnv, cleanupTestEnv, readState, writeState)
- **Script Under Test:** `src/antigravity/change-summary-generator.cjs` (CJS, subprocess pattern)

### Strategy Adaptation

The change-summary-generator.cjs follows the same CJS antigravity script pattern as workflow-retry.cjs and workflow-rollback.cjs. Tests will:

1. **USE** the existing `node:test` framework with `describe`/`it`/`beforeEach`/`afterEach`
2. **USE** the existing CJS test conventions (`.test.cjs` extension)
3. **FOLLOW** the hook test isolation pattern: temp directories with `fs.mkdtempSync`, environment-based project root
4. **EXTEND** by adding a `test:antigravity` script to `package.json` alongside existing `test:hooks`
5. **REUSE** patterns from `workflow-retry.test.cjs`: fixture factories, `spawnSync` execution, JSON stdout parsing

### Test File Location

```
src/claude/hooks/tests/change-summary-generator.test.cjs
```

This co-locates with existing CJS hook tests. The test command will be:
```
node --test src/claude/hooks/tests/change-summary-generator.test.cjs
```

---

## 2. Test Pyramid

```
         /\
        /  \       E2E Tests (4 tests, 5%)
       / E2E\      Full subprocess pipeline with real git repos
      /------\
     /        \    Integration Tests (20 tests, 26%)
    / Integr.  \   Multi-function pipelines, git interaction,
   /            \  file I/O, degradation scenarios
  /--------------\
 /                \ Unit Tests (53 tests, 69%)
/    Unit Tests    \ Individual function logic, pure transforms,
\__________________/ parsing, rendering, edge cases
```

**Totals: 77 test cases**

| Level | Count | Percentage | Scope |
|-------|-------|-----------|-------|
| Unit | 53 | 69% | Individual functions: parseArgs, classifyFiles, extractValidRequirements, traceRequirements, extractTestResults, buildSummaryData, renderMarkdown, renderJson, displayInlineBrief, parseDiffLine, filterByValidSet, containsNullBytes |
| Integration | 20 | 26% | Multi-function pipelines, real git operations, file system I/O, degradation chains |
| E2E | 4 | 5% | Full subprocess execution via `spawnSync`, end-to-end with real git repos |

### Test Pyramid Rationale

The unit-heavy pyramid (69%) is appropriate because:
- The generator is a 13-function linear pipeline with clear function boundaries
- Each function has independent input/output contracts specified in the module design
- Graceful degradation logic (FR-007) is best tested at the unit level per-function
- Integration tests focus on the multi-source tracing chain (FR-003) and git interaction (FR-001)
- E2E tests validate the full subprocess contract (stdout JSON, exit codes) matching the phase-loop integration pattern

---

## 3. Test Scope by Functional Requirement

### FR-001: Git Diff Collection (9 tests)

| ID | Test Case | Type | Level | Priority |
|----|-----------|------|-------|----------|
| TC-001 | collectGitDiff returns DiffResult with merge-base SHA, head SHA, and entries for a valid feature branch | positive | unit | P0 |
| TC-002 | collectGitDiff parses M (modified), A (added), D (deleted) status correctly | positive | unit | P0 |
| TC-003 | collectGitDiff parses R (renamed) entries with oldPath populated | positive | unit | P0 |
| TC-004 | collectGitDiff returns null when git is unavailable (not a git repo) | negative | unit | P0 |
| TC-005 | collectGitDiff returns null when merge-base fails (no common ancestor) | negative | unit | P1 |
| TC-006 | collectGitDiff handles empty diff (no changes between merge-base and HEAD) | boundary | unit | P1 |
| TC-007 | collectGitDiff filters out unparseable lines (empty lines, malformed status) | negative | unit | P2 |
| TC-008 | collectGitDiff respects GIT_TIMEOUT_MS (5s timeout on hung git commands) | negative | integration | P1 |
| TC-009 | collectGitDiff handles R100-style rename status codes (R### prefix) | positive | unit | P2 |

### FR-002: File Classification & Rationale (8 tests)

| ID | Test Case | Type | Level | Priority |
|----|-----------|------|-------|----------|
| TC-010 | classifyFiles maps M -> 'modified', A -> 'added', D -> 'deleted', R -> 'renamed' | positive | unit | P0 |
| TC-011 | classifyFiles extracts rationale from first commit message touching each file | positive | integration | P0 |
| TC-012 | classifyFiles truncates rationale to 120 characters for long commit messages | boundary | unit | P1 |
| TC-013 | classifyFiles falls back to default rationale when git log returns empty | negative | unit | P0 |
| TC-014 | classifyFiles falls back to default rationale when git log fails for a file | negative | unit | P1 |
| TC-015 | classifyFiles uses "Renamed from <oldPath>" as default rationale for renames | positive | unit | P2 |
| TC-016 | classifyFiles handles mixed success/failure across multiple files | negative | integration | P1 |
| TC-017 | classifyFiles returns empty array for empty entries input | boundary | unit | P2 |

### FR-003: Requirement Tracing (14 tests)

| ID | Test Case | Type | Level | Priority |
|----|-----------|------|-------|----------|
| TC-018 | extractValidRequirements returns Set of FR-NNN and AC-NNN-NN from requirements-spec.md | positive | unit | P0 |
| TC-019 | extractValidRequirements returns empty Set when file is missing | negative | unit | P0 |
| TC-020 | extractValidRequirements returns empty Set when file is empty | boundary | unit | P2 |
| TC-021 | traceRequirements Level 1: traces files via tasks.md pipe-delimited annotations | positive | unit | P0 |
| TC-022 | traceRequirements Level 1: stops at tasks.md when match found (early exit) | positive | unit | P0 |
| TC-023 | traceRequirements Level 2: falls back to commit messages when tasks.md has no match | positive | integration | P0 |
| TC-024 | traceRequirements Level 3: falls back to code comments when commits have no FR refs | positive | integration | P1 |
| TC-025 | traceRequirements Level 4: marks file as 'untraced' when no source matches | positive | unit | P0 |
| TC-026 | traceRequirements skips deleted files during Level 3 code comment scanning | positive | unit | P1 |
| TC-027 | traceRequirements skips binary files (null bytes detected) during Level 3 | positive | unit | P1 |
| TC-028 | traceRequirements skips files larger than MAX_CODE_SCAN_SIZE (100KB) during Level 3 | boundary | unit | P1 |
| TC-029 | traceRequirements filters extracted IDs against valid requirements set | positive | unit | P1 |
| TC-030 | traceRequirements accepts all IDs when valid set is empty (requirements-spec.md missing) | negative | unit | P1 |
| TC-031 | traceRequirements full 4-level fallback chain end-to-end with mixed sources | positive | integration | P0 |

### FR-004: Test Results Summary (6 tests)

| ID | Test Case | Type | Level | Priority |
|----|-----------|------|-------|----------|
| TC-032 | extractTestResults extracts tests_passing, coverage_percent from state.json phase 06 | positive | unit | P0 |
| TC-033 | extractTestResults returns null when state is null | negative | unit | P0 |
| TC-034 | extractTestResults returns null when phase 06 data is missing from state | negative | unit | P0 |
| TC-035 | extractTestResults returns null when test_iteration is missing from phase 06 | negative | unit | P1 |
| TC-036 | extractTestResults parses pass/fail counts from phase summary string | positive | unit | P1 |
| TC-037 | extractTestResults handles corrupt state.json (unexpected schema) | negative | unit | P2 |

### FR-005: Human-Readable Output (7 tests)

| ID | Test Case | Type | Level | Priority |
|----|-----------|------|-------|----------|
| TC-038 | renderMarkdown produces valid markdown with metrics header, file table, and sections | positive | unit | P0 |
| TC-039 | renderMarkdown omits test results section when testResults is null | positive | unit | P0 |
| TC-040 | renderMarkdown omits warnings section when warnings array is empty | positive | unit | P1 |
| TC-041 | renderMarkdown includes warnings section with bullet list when warnings exist | positive | unit | P1 |
| TC-042 | renderMarkdown writes file to specified outputPath | positive | integration | P0 |
| TC-043 | renderMarkdown returns null when write fails (read-only directory) | negative | integration | P1 |
| TC-044 | renderMarkdown handles special characters in file paths and rationale (pipes, backticks) | boundary | unit | P2 |

### FR-006: Machine-Readable Output (8 tests)

| ID | Test Case | Type | Level | Priority |
|----|-----------|------|-------|----------|
| TC-045 | renderJson produces valid JSON with schema_version "1.0" | positive | unit | P0 |
| TC-046 | renderJson output conforms to the v1.0 schema (all required fields present) | positive | unit | P0 |
| TC-047 | renderJson uses snake_case field names (not camelCase) | positive | unit | P0 |
| TC-048 | renderJson sets test_results to null when unavailable | positive | unit | P1 |
| TC-049 | renderJson writes file to .isdlc/change-summary.json | positive | integration | P0 |
| TC-050 | renderJson returns null when write fails | negative | integration | P1 |
| TC-051 | renderJson output is parseable by JSON.parse under all conditions | positive | unit | P0 |
| TC-052 | renderJson includes warnings array (empty or populated) | positive | unit | P2 |

### FR-007: Graceful Degradation (11 tests)

| ID | Test Case | Type | Level | Priority |
|----|-----------|------|-------|----------|
| TC-053 | Pipeline produces partial output when git is unavailable (minimal md + json with warnings) | positive | integration | P0 |
| TC-054 | Pipeline produces partial output when requirements-spec.md is missing (unfiltered IDs) | positive | integration | P0 |
| TC-055 | Pipeline produces partial output when tasks.md is missing (fallback to commits) | positive | integration | P1 |
| TC-056 | Pipeline produces partial output when state.json is missing (test results omitted) | positive | integration | P0 |
| TC-057 | Pipeline produces partial output when phase 06 data is missing from state | positive | integration | P1 |
| TC-058 | Pipeline continues when one file fails during classification | positive | unit | P1 |
| TC-059 | Pipeline continues when one file fails during tracing | positive | unit | P1 |
| TC-060 | Pipeline writes JSON even when markdown write fails | positive | integration | P0 |
| TC-061 | Pipeline writes markdown even when JSON write fails | positive | integration | P0 |
| TC-062 | Pipeline never throws an uncaught exception (adversarial inputs) | negative | integration | P0 |
| TC-063 | Pipeline always exits with code 0 on degraded operation (not code 2) | positive | integration | P0 |

### FR-008: Phase-Loop Integration (5 tests)

| ID | Test Case | Type | Level | Priority |
|----|-----------|------|-------|----------|
| TC-064 | parseArgs extracts --folder argument value correctly | positive | unit | P0 |
| TC-065 | parseArgs returns { folder: null } when --folder is missing | negative | unit | P0 |
| TC-066 | main() outputs valid JSON to stdout with result "OK" on success | positive | E2E | P0 |
| TC-067 | main() outputs valid JSON to stdout with result "ERROR" on hard error | negative | E2E | P0 |
| TC-068 | main() exits with code 2 on missing --folder argument | negative | E2E | P0 |

### NFR Coverage (9 tests)

| ID | Test Case | NFR | Type | Level | Priority |
|----|-----------|-----|------|-------|----------|
| TC-069 | Generation completes in under 5 seconds for 50 changed files | NFR-001 | performance | integration | P1 |
| TC-070 | Generator never produces uncaught exceptions under adversarial input | NFR-002 | negative | integration | P0 |
| TC-071 | Generator always exits cleanly (exit 0 or exit 2, never crashes) | NFR-003 | negative | E2E | P0 |
| TC-072 | Generator emits partial data when sources fail (partial > nothing) | NFR-004 | positive | integration | P0 |
| TC-073 | JSON output always contains schema_version "1.0" | NFR-005 | positive | unit | P0 |
| TC-074 | Generator uses no ESM imports (CJS only, .cjs extension) | NFR-008 | positive | unit | P1 |
| TC-075 | Generator does not write to state.json (read-only access) | NFR-010 | negative | integration | P0 |
| TC-076 | JSON output is always valid (parseable by JSON.parse) | NFR-011 | positive | unit | P0 |
| TC-077 | Generator uses only Node.js built-ins and common.cjs (zero new deps) | NFR-009 | positive | unit | P1 |

---

## 4. Test Cases by Function

### 4.1 parseArgs() -- 2 tests

**TC-064** (FR-008, positive, unit, P0):
```
Given: process.argv = ['node', 'script.cjs', '--folder', 'docs/requirements/REQ-0054']
When: parseArgs() is called
Then: returns { folder: 'docs/requirements/REQ-0054' }
```

**TC-065** (FR-008, negative, unit, P0):
```
Given: process.argv = ['node', 'script.cjs']
When: parseArgs() is called
Then: returns { folder: null }
```

### 4.2 collectGitDiff() -- 9 tests

**TC-001** (FR-001, positive, unit, P0):
```
Given: a git repo with a feature branch that has 3 commits ahead of main
When: collectGitDiff(projectRoot, 'main') is called
Then: returns { mergeBase: <sha>, head: <sha>, entries: [3 DiffEntry objects] }
```

**TC-002** (FR-001, positive, unit, P0):
```
Given: git diff --name-status output lines "M\tsrc/a.js", "A\tsrc/b.js", "D\tsrc/c.js"
When: each line is parsed
Then: entries have status 'M', 'A', 'D' respectively with correct paths
```

**TC-003** (FR-001, positive, unit, P0):
```
Given: git diff --name-status output line "R100\tsrc/old.js\tsrc/new.js"
When: the line is parsed
Then: entry has status 'R', path 'src/new.js', oldPath 'src/old.js'
```

**TC-004** (FR-001, negative, unit, P0):
```
Given: current directory is not a git repository
When: collectGitDiff(projectRoot, 'main') is called
Then: returns null (not a thrown exception)
```

**TC-005** (FR-001, negative, unit, P1):
```
Given: a git repo with no common ancestor with the base branch
When: collectGitDiff(projectRoot, 'nonexistent-branch') is called
Then: returns null
```

**TC-006** (FR-001, boundary, unit, P1):
```
Given: a git repo where HEAD is identical to merge-base (no changes)
When: collectGitDiff(projectRoot, 'main') is called
Then: returns { mergeBase, head, entries: [] }
```

**TC-007** (FR-001, negative, unit, P2):
```
Given: git diff output with empty lines and malformed lines mixed in
When: the output is parsed
Then: only valid entries are returned; malformed lines are silently filtered
```

**TC-008** (FR-001, negative, integration, P1):
```
Given: a simulated slow git command (mock or deliberate delay)
When: collectGitDiff is called with GIT_TIMEOUT_MS timeout
Then: returns null after timeout rather than hanging indefinitely
```

**TC-009** (FR-001, positive, unit, P2):
```
Given: git diff output line "R075\tsrc/old.js\tsrc/new.js" (partial rename)
When: the line is parsed
Then: entry has status 'R', path 'src/new.js', oldPath 'src/old.js'
```

### 4.3 classifyFiles() -- 8 tests

**TC-010** (FR-002, positive, unit, P0):
```
Given: entries [{ status: 'M', path: 'a.js' }, { status: 'A', path: 'b.js' },
       { status: 'D', path: 'c.js' }, { status: 'R', path: 'd.js', oldPath: 'e.js' }]
When: classifyFiles(entries, projectRoot) is called
Then: returns ClassifiedFile[] with changeType 'modified', 'added', 'deleted', 'renamed'
```

**TC-011** (FR-002, positive, integration, P0):
```
Given: a real git repo with commits containing descriptive messages per file
When: classifyFiles(entries, projectRoot) is called
Then: rationale for each file is extracted from the first commit message touching it
```

**TC-012** (FR-002, boundary, unit, P1):
```
Given: a commit message of 200 characters for a file
When: classifyFiles processes that file
Then: rationale is truncated to 120 characters
```

**TC-013** (FR-002, negative, unit, P0):
```
Given: git log returns empty string for a file
When: classifyFiles processes that file
Then: falls back to default rationale based on change type ("New file", "Modified", etc.)
```

**TC-014** (FR-002, negative, unit, P1):
```
Given: git log command throws for a specific file
When: classifyFiles processes that file
Then: uses default rationale; does not throw; other files still processed
```

**TC-015** (FR-002, positive, unit, P2):
```
Given: a renamed file { status: 'R', path: 'new.js', oldPath: 'old.js' }
When: git log returns empty for this file
Then: default rationale is "Renamed from old.js"
```

**TC-016** (FR-002, negative, integration, P1):
```
Given: 5 entries where git log succeeds for 3 and fails for 2
When: classifyFiles processes all entries
Then: returns 5 ClassifiedFiles (3 with git rationale, 2 with default rationale)
```

**TC-017** (FR-002, boundary, unit, P2):
```
Given: entries = []
When: classifyFiles([], projectRoot) is called
Then: returns []
```

### 4.4 extractValidRequirements() -- 3 tests

**TC-018** (FR-003, positive, unit, P0):
```
Given: a requirements-spec.md file containing "FR-001", "FR-002", "AC-001-01", "AC-002-03"
When: extractValidRequirements(reqSpecPath) is called
Then: returns Set { 'FR-001', 'FR-002', 'AC-001-01', 'AC-002-03' }
```

**TC-019** (FR-003, negative, unit, P0):
```
Given: reqSpecPath points to a non-existent file
When: extractValidRequirements(reqSpecPath) is called
Then: returns empty Set (not a thrown error)
```

**TC-020** (FR-003, boundary, unit, P2):
```
Given: reqSpecPath points to an empty file
When: extractValidRequirements(reqSpecPath) is called
Then: returns empty Set
```

### 4.5 traceRequirements() -- 11 tests

**TC-021** (FR-003, positive, unit, P0):
```
Given: tasks.md with line "- [X] T0001 Implement parser | traces: FR-001, FR-002"
       and classifiedFile { path: 'src/parser.js' } referenced in T0001
When: traceRequirements is called
Then: file has tracedRequirements ['FR-001', 'FR-002'], tracingSource 'tasks.md'
```

**TC-022** (FR-003, positive, unit, P0):
```
Given: tasks.md matches file at Level 1
       and commit messages also contain FR refs for the same file
When: traceRequirements is called
Then: file uses tasks.md source (Level 1 early exit, not commit source)
```

**TC-023** (FR-003, positive, integration, P0):
```
Given: tasks.md does not reference file
       but commit messages for the file contain "FR-003"
When: traceRequirements is called
Then: file has tracedRequirements ['FR-003'], tracingSource 'commit'
```

**TC-024** (FR-003, positive, integration, P1):
```
Given: tasks.md and commits have no FR refs for file
       but file content contains "// Traces to: FR-004" in a comment
When: traceRequirements is called
Then: file has tracedRequirements ['FR-004'], tracingSource 'code-comment'
```

**TC-025** (FR-003, positive, unit, P0):
```
Given: no source (tasks.md, commits, code) matches the file
When: traceRequirements is called
Then: file has tracedRequirements [], tracingSource 'untraced'
```

**TC-026** (FR-003, positive, unit, P1):
```
Given: a deleted file (changeType 'deleted')
When: Level 3 code comment scanning runs
Then: deleted file is skipped (cannot read content of deleted file)
```

**TC-027** (FR-003, positive, unit, P1):
```
Given: a binary file (contains null bytes in first 8KB)
When: Level 3 code comment scanning runs
Then: binary file is skipped
```

**TC-028** (FR-003, boundary, unit, P1):
```
Given: a file larger than 100KB (MAX_CODE_SCAN_SIZE)
When: Level 3 code comment scanning runs
Then: file is skipped to prevent memory exhaustion
```

**TC-029** (FR-003, positive, unit, P1):
```
Given: code comment contains "FR-999" but valid set is { 'FR-001', 'FR-002' }
When: filterByValidSet is applied
Then: "FR-999" is filtered out; tracedRequirements is empty for this source
```

**TC-030** (FR-003, negative, unit, P1):
```
Given: requirements-spec.md is missing (valid set is empty)
       and code comment contains "FR-999"
When: filterByValidSet is applied
Then: "FR-999" is accepted (empty valid set means accept all)
```

**TC-031** (FR-003, positive, integration, P0):
```
Given: 4 files: file1 traced via tasks.md, file2 via commit, file3 via code comment, file4 untraced
When: traceRequirements processes all 4
Then: each file has correct tracingSource and tracedRequirements
```

### 4.6 extractTestResults() -- 6 tests

**TC-032** (FR-004, positive, unit, P0):
```
Given: state with phases["06-implementation"].iteration_requirements.test_iteration
       = { tests_passing: true, coverage_percent: 92.5 }
When: extractTestResults(state) is called
Then: returns { total: N, passing: N, failing: 0, coveragePercent: 92.5 }
```

**TC-033** (FR-004, negative, unit, P0):
```
Given: state = null
When: extractTestResults(null) is called
Then: returns null
```

**TC-034** (FR-004, negative, unit, P0):
```
Given: state with no phases["06-implementation"] key
When: extractTestResults(state) is called
Then: returns null
```

**TC-035** (FR-004, negative, unit, P1):
```
Given: state with phases["06-implementation"] but no test_iteration
When: extractTestResults(state) is called
Then: returns null
```

**TC-036** (FR-004, positive, unit, P1):
```
Given: state with phase summary string "150 tests passing, 2 failing"
When: extractTestResults(state) is called
Then: parses total=152, passing=150, failing=2
```

**TC-037** (FR-004, negative, unit, P2):
```
Given: state.phases["06-implementation"] = "not-an-object"
When: extractTestResults(state) is called
Then: returns null (does not throw)
```

### 4.7 buildSummaryData() -- 5 tests

**TC-038-BS** (FR-005/FR-006, positive, unit, P0):
```
Given: diffResult with 3 entries, tracedFiles with 2 traced and 1 untraced,
       testResults with 10 passing, context with workflowSlug
When: buildSummaryData is called
Then: returns SummaryData with correct counts (filesModified, filesAdded, etc.),
      requirementsTraced=2, requirementsUntraced=1, all fields populated
```

**TC-038-BS2** (FR-005/FR-006, boundary, unit, P1):
```
Given: diffResult = null, tracedFiles = [], testResults = null, empty warnings
When: buildSummaryData is called
Then: returns SummaryData with all zero counts, null commits, null test results
```

**TC-038-BS3** (FR-005/FR-006, positive, unit, P1):
```
Given: warnings array with 3 degradation warnings
When: buildSummaryData is called
Then: warnings are preserved in the returned SummaryData
```

**TC-038-BS4** (FR-005/FR-006, positive, unit, P2):
```
Given: tracedFiles with mixed changeTypes: 2 modified, 1 added, 1 deleted, 1 renamed
When: buildSummaryData is called
Then: summary counts are filesModified=2, filesAdded=1, filesDeleted=1, filesRenamed=1, total=5
```

**TC-038-BS5** (FR-005/FR-006, positive, unit, P1):
```
Given: valid context with generatedAt timestamp
When: buildSummaryData is called
Then: generatedAt is a valid ISO-8601 timestamp string
```

### 4.8 renderMarkdown() -- 5 tests

**TC-038** (FR-005, positive, unit, P0): (see Section 3)

**TC-039** (FR-005, positive, unit, P0): (see Section 3)

**TC-040** (FR-005, positive, unit, P1): (see Section 3)

**TC-041** (FR-005, positive, unit, P1): (see Section 3)

**TC-044** (FR-005, boundary, unit, P2): (see Section 3)

### 4.9 renderJson() -- 6 tests

**TC-045** through **TC-052** (FR-006): (see Section 3)

### 4.10 writeOutputs() -- 3 tests (covered by integration)

Tested implicitly through TC-042, TC-043, TC-049, TC-050, TC-060, TC-061.

### 4.11 displayInlineBrief() -- 1 test

**TC-DI-01** (FR-005/FR-008, positive, unit, P3):
```
Given: valid SummaryData
When: displayInlineBrief is called
Then: returns without error (no-op per design; does not write to stdout)
```

### 4.12 main() -- 4 E2E tests

**TC-066** (FR-008, positive, E2E, P0): (see Section 3)

**TC-067** (FR-008, negative, E2E, P0): (see Section 3)

**TC-068** (FR-008, negative, E2E, P0): (see Section 3)

**TC-071** (NFR-003, negative, E2E, P0): (see Section 3)

---

## 5. Flaky Test Mitigation

### Identified Flakiness Risks

| Risk | Source | Mitigation |
|------|--------|------------|
| Git timing | `execSync` with timeouts | Use isolated temp git repos with controlled state; set generous timeouts (5s) in tests |
| Temp directory cleanup | OS-level cleanup race | Use `afterEach` with `fs.rmSync({ recursive: true, force: true })`; unique prefixes per test |
| File system permissions | Platform differences | Skip permission-based tests on Windows CI (mark with `platform !== 'win32'` guard) |
| Process.exit interception | CJS module caching | Run full pipeline tests via `spawnSync` subprocess, not in-process |
| Git state leakage | Tests modifying same repo | Each test creates its own isolated temp git repo via `setupTestGitRepo()` |

### Test Isolation Strategy

1. **Temp directory per test**: Each test case creates `fs.mkdtempSync(os.tmpdir() + '/csg-test-')` with unique prefix
2. **Environment isolation**: Set `CLAUDE_PROJECT_DIR` per test to the temp directory
3. **Git repo isolation**: Each integration test creates its own `git init` repo with controlled commits
4. **Module cache clearing**: For in-process tests, clear `require.cache` entries for the generator module between tests
5. **No shared mutable state**: Test fixtures are factory functions that return fresh objects each time

---

## 6. Performance Test Plan

### NFR-001: < 5 seconds for < 50 changed files

**TC-069** (performance, integration, P1):
```
Given: a git repo with exactly 50 changed files (25 modified, 15 added, 5 deleted, 5 renamed)
       with valid tasks.md, requirements-spec.md, and state.json
When: the full generator pipeline runs via spawnSync
Then: total execution time is < 5000ms
Measurement: process.hrtime.bigint() before/after spawnSync call
```

### Performance Test Approach

- Create a controlled fixture repo with 50 files changed
- Each file has 1-2 commits with descriptive messages
- tasks.md has trace annotations for 30 of the 50 files
- requirements-spec.md has 8 FR-NNN and 24 AC-NNN-NN identifiers
- Run 3 iterations and assert p95 < 5000ms
- This test is marked with `{ timeout: 30000 }` to allow warm-up

### Performance Bottleneck Analysis

The primary bottleneck is `classifyFiles()` which runs `git log` once per file (O(n)). For 50 files at ~100ms per git log call, expected total is ~5s. The test validates this stays within budget.

---

## 7. Security Test Cases

### Input Validation

| ID | Test Case | Type | Priority |
|----|-----------|------|----------|
| TC-SEC-01 | --folder argument with path traversal (`../../etc/passwd`) is resolved safely by `path.resolve()` | negative | P1 |
| TC-SEC-02 | File paths with shell metacharacters in git output do not cause injection | negative | P1 |
| TC-SEC-03 | Malformed JSON in state.json does not cause crash (caught by try/catch) | negative | P0 |

### Output Safety

| ID | Test Case | Type | Priority |
|----|-----------|------|----------|
| TC-SEC-04 | Generator does not write to state.json (NFR-010 enforcement) | negative | P0 |
| TC-SEC-05 | Generator does not execute arbitrary code from file content during scanning | negative | P1 |

---

## 8. Coverage Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Line coverage | >= 90% | High target appropriate for a linear pipeline with clear boundaries |
| Branch coverage | >= 85% | Important for degradation path coverage (many if/catch branches) |
| Function coverage | >= 95% | All 13 functions must be exercised |
| Requirement coverage | 100% | Every FR and NFR must have at least one test case |
| AC coverage | 100% | Every acceptance criterion from requirements-spec.md traced to tests |

### Critical Paths Requiring 100% Coverage

1. **main() orchestration** -- every step in the pipeline must be covered
2. **Graceful degradation paths** -- every try/catch in main() must be exercised
3. **JSON output rendering** -- every field in the v1.0 schema must be verified
4. **parseArgs + exit codes** -- the CLI contract with the phase-loop controller

---

## 9. Test Data Plan

### 9.1 Fixture Factory Functions

All test data is produced by factory functions returning fresh objects, following the `workflow-retry.test.cjs` pattern.

```javascript
// Fixture factories (conceptual -- implemented in test file)

function baseDiffResult() { ... }       // Valid DiffResult with 3 entries (M, A, D)
function baseClassifiedFiles() { ... }  // 3 ClassifiedFile objects
function baseTracedFiles() { ... }      // 3 TracedFile objects (1 tasks.md, 1 commit, 1 untraced)
function baseTestResults() { ... }      // { total: 50, passing: 48, failing: 2, coveragePercent: 92.5 }
function baseSummaryData() { ... }      // Complete SummaryData from all above
function baseState() { ... }           // state.json with phase 06 test data
function baseContext() { ... }         // loadProjectContext output
```

### 9.2 Boundary Values

| Input | Boundary | Test Value | Expected Behavior |
|-------|----------|------------|-------------------|
| Changed file count | Zero | 0 files | Empty file table, zero counts |
| Changed file count | Lower bound | 1 file | Single-row table |
| Changed file count | Upper bound | 50 files | All files listed, performance within NFR-001 |
| Commit message length | At limit | 120 characters | Rationale matches full message |
| Commit message length | Over limit | 200 characters | Rationale truncated to 120 |
| File size for code scan | At limit | 102400 bytes (100KB) | File is scanned |
| File size for code scan | Over limit | 102401 bytes | File is skipped |
| FR identifiers | None in file | 0 matches | tracingSource = 'untraced' |
| FR identifiers | Multiple | 5 FR + 3 AC | All captured in tracedRequirements |
| Warnings array | Empty | [] | Warnings section omitted in markdown |
| Warnings array | Multiple | 3 warnings | All listed as bullet points |
| tasks.md trace annotations | Empty traces | `\| traces: ` | No IDs extracted, fallback to Level 2 |

### 9.3 Invalid Inputs

| Input | Invalid Value | Expected Behavior |
|-------|---------------|-------------------|
| --folder argument | Missing entirely | Exit code 2, JSON error output |
| --folder argument | Points to non-existent directory | Exit code 2, JSON error output |
| --folder argument | Path traversal `../../etc/passwd` | Resolves safely, folder check fails |
| state.json | Malformed JSON (`{invalid}`) | state = null, test results omitted with warning |
| state.json | Missing file | state = null, test results omitted with warning |
| state.json | Empty file | state = null, test results omitted with warning |
| requirements-spec.md | Binary file | extractValidRequirements returns empty Set |
| tasks.md | Binary content | Level 1 tracing returns no matches, fallback to Level 2 |
| git diff output | Empty string | entries = [], no files to classify |
| git diff output | Single tab character | Filtered out as unparseable |
| git diff output | Status without path | Filtered out as unparseable |

### 9.4 Maximum-Size Inputs

| Input | Maximum Size | Test Approach |
|-------|-------------|---------------|
| Changed files | 50 files | Performance test TC-069 |
| Single file path length | 256 characters | Verify path appears correctly in output |
| Commit message | 1000+ characters | Verify truncation to 120 |
| requirements-spec.md | 500+ FR/AC identifiers | Verify Set construction performance |
| tasks.md | 100+ task lines | Verify Level 1 scanning completes |
| Code file for scanning | 100KB | Verify scan completes at boundary |
| Code file for scanning | 200KB | Verify skip over boundary |

### 9.5 Degradation Scenario Test Data

Each degradation scenario from the module design Section 6.2 has a corresponding test fixture:

| Scenario | Fixture Setup | Expected Warnings |
|----------|---------------|-------------------|
| Git unavailable | No `.git` directory in temp dir | "git diff unavailable -- no file data collected" |
| No merge-base | `git init` without base branch | "git diff failed: ..." |
| tasks.md missing | No tasks.md in docs/isdlc/ | (silent fallback to Level 2) |
| requirements-spec.md missing | No requirements-spec.md in artifact folder | (empty valid set, accept all IDs) |
| state.json missing | No .isdlc/state.json | "test results unavailable from state.json" |
| Phase 06 missing | state.json with no phases["06-implementation"] | "test results unavailable from state.json" |
| MD write failure | Read-only output directory | "change-summary.md write failed" |
| JSON write failure | Read-only .isdlc directory | "change-summary.json write failed" |
| Single file error | One file path pointing to non-existent file | Other files still processed |
| All systems operational | Full fixture with all sources present | No warnings |
| Binary file in diff | File with null bytes | Skipped in Level 3, still in file list |

---

## 10. Test Execution Strategy

### Test Commands

```bash
# Run change-summary-generator tests only
node --test src/claude/hooks/tests/change-summary-generator.test.cjs

# Run with coverage
node --test --experimental-test-coverage src/claude/hooks/tests/change-summary-generator.test.cjs

# Run as part of hooks suite
npm run test:hooks
```

### Test Grouping in File

```
describe('change-summary-generator.cjs')
  describe('Unit: parseArgs')
    TC-064, TC-065
  describe('Unit: collectGitDiff / parseDiffLine')
    TC-001 through TC-009
  describe('Unit: classifyFiles')
    TC-010, TC-012 through TC-015, TC-017
  describe('Unit: extractValidRequirements')
    TC-018 through TC-020
  describe('Unit: traceRequirements')
    TC-021, TC-022, TC-025 through TC-030
  describe('Unit: extractTestResults')
    TC-032 through TC-037
  describe('Unit: buildSummaryData')
    TC-038-BS through TC-038-BS5
  describe('Unit: renderMarkdown')
    TC-038 through TC-044
  describe('Unit: renderJson')
    TC-045 through TC-052
  describe('Unit: displayInlineBrief')
    TC-DI-01
  describe('Unit: NFR compliance')
    TC-073 through TC-077
  describe('Integration: git operations')
    TC-008, TC-011, TC-016
  describe('Integration: tracing pipeline')
    TC-023, TC-024, TC-031
  describe('Integration: degradation scenarios')
    TC-053 through TC-063
  describe('Integration: file I/O')
    TC-042, TC-043, TC-049, TC-050, TC-069, TC-075
  describe('Integration: security')
    TC-SEC-01 through TC-SEC-05
  describe('E2E: subprocess execution')
    TC-066 through TC-068, TC-071
```

### Helper Functions Needed

```javascript
// Test utility functions to implement in the test file

function setupTestGitRepo(options) { ... }
// Creates a temp dir with git init, initial commit, feature branch,
// and N changed files. Returns { tmpDir, projectRoot, cleanup }

function createChangedFiles(projectRoot, count, types) { ... }
// Creates N files of specified change types in the git repo
// Commits them with FR-NNN references in commit messages

function createTasksMd(projectRoot, traceAnnotations) { ... }
// Writes a tasks.md file with pipe-delimited trace annotations

function createRequirementsSpec(projectRoot, frIds, acIds) { ... }
// Writes a requirements-spec.md containing the specified FR/AC identifiers

function createStateJson(projectRoot, phase06Data) { ... }
// Writes .isdlc/state.json with phase 06 test iteration data

function runGenerator(projectRoot, folder) { ... }
// Runs change-summary-generator.cjs via spawnSync, returns { stdout, stderr, status }
// Parses stdout as JSON for assertions
```

---

## 11. Traceability Matrix

| Requirement | Test Cases | Count | Coverage |
|-------------|-----------|-------|----------|
| FR-001 | TC-001 through TC-009 | 9 | 100% |
| FR-002 | TC-010 through TC-017 | 8 | 100% |
| FR-003 | TC-018 through TC-031 | 14 | 100% |
| FR-004 | TC-032 through TC-037 | 6 | 100% |
| FR-005 | TC-038 through TC-044, TC-038-BS* | 10 | 100% |
| FR-006 | TC-045 through TC-052, TC-038-BS* | 10 | 100% |
| FR-007 | TC-053 through TC-063 | 11 | 100% |
| FR-008 | TC-064 through TC-068 | 5 | 100% |
| NFR-001 | TC-069 | 1 | 100% |
| NFR-002 | TC-070, TC-062 | 2 | 100% |
| NFR-003 | TC-071, TC-063 | 2 | 100% |
| NFR-004 | TC-072, TC-053-TC-061 | 10 | 100% |
| NFR-005 | TC-073, TC-045 | 2 | 100% |
| NFR-006 | (Code review policy -- not automatable) | 0 | N/A |
| NFR-007 | TC-044, TC-SEC-01 (path handling); CI matrix for full cross-platform | 2 | 100% |
| NFR-008 | TC-074 | 1 | 100% |
| NFR-009 | TC-077 | 1 | 100% |
| NFR-010 | TC-075, TC-SEC-04 | 2 | 100% |
| NFR-011 | TC-076, TC-051 | 2 | 100% |
| **Total** | | **77 unique test cases** | **100%** |

---

## 12. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Git operations flaky in CI | Medium | Test failures | Isolated temp repos; generous timeouts; retry on CI |
| File permission tests platform-dependent | Low | False passes on some OS | Guard with `process.platform` checks |
| CJS module caching affects test isolation | Medium | State leakage | Use `spawnSync` for integration/E2E; clear require.cache for unit |
| Large file fixtures slow down test suite | Low | Slow CI | Lazy-create large fixtures; skip performance tests in quick runs |
| Path separator differences on Windows | Medium | Assertion failures | Use `path.join` in assertions; normalize slashes in comparisons |

---

## 13. GATE-04 Validation

### Checklist

- [x] Test strategy covers unit, integration, E2E, security, performance
- [x] Test cases exist for all 8 functional requirements (FR-001 through FR-008)
- [x] Test cases exist for all 11 non-functional requirements (NFR-001 through NFR-011)
- [x] Traceability matrix complete (100% requirement coverage, Section 11)
- [x] Coverage targets defined (90% line, 85% branch, 95% function, Section 8)
- [x] Test data strategy documented (fixtures, boundaries, invalid inputs, max-size, Section 9)
- [x] Critical paths identified (main orchestration, degradation, JSON output, CLI contract, Section 8)
- [x] Flaky test mitigation documented (Section 5)
- [x] Test pyramid balanced (69% unit, 26% integration, 5% E2E, Section 2)
- [x] Existing infrastructure leveraged (node:test, CJS patterns, hook-test-utils, Section 1)
- [x] Test execution commands documented (Section 10)
- [x] Security test cases included (Section 7)
- [x] Performance test plan included (Section 6)
- [x] 11 degradation scenarios covered (Section 9.5)

### Constitutional Compliance

- **Article II (Test-First Development)**: Test strategy designed before implementation; 77 test cases covering unit, integration, E2E, security, performance. Coverage targets: 90% line, 85% branch, 95% function.
- **Article VII (Artifact Traceability)**: Every test case traces to specific FR/NFR. Traceability matrix in Section 11 shows 100% coverage. No orphan tests.
- **Article IX (Quality Gate Integrity)**: All GATE-04 checklist items verified. Required artifacts (test-strategy.md) complete and validated.
- **Article XI (Integration Testing Integrity)**: 20 integration tests validate component interactions: git operations, tracing pipeline, degradation chains, file I/O. End-to-end subprocess tests validate the phase-loop integration contract.

**GATE-04 Result: PASS**
