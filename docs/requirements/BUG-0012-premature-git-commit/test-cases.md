# Test Cases: BUG-0012 -- Premature Git Commit During Implementation

**Bug ID**: BUG-0012
**Phase**: 05-test-strategy
**Created**: 2026-02-13
**Total Test Cases**: 17 new (T15-T31) extending 14 existing (T1-T14)
**Test File**: `src/claude/hooks/tests/branch-guard.test.cjs`

---

## Section A: Phase-Aware Commit Blocking (Hook Unit Tests)

### T15: Block commit on feature branch during phase 06-implementation

**Traces to**: AC-07, AC-09
**Priority**: P0 (core fix)

**Preconditions**:
- Git repo initialized on branch `feature/REQ-test`
- state.json contains:
  - `active_workflow.current_phase`: `"06-implementation"`
  - `active_workflow.phases`: `["01-requirements", "02-tracing", "05-test-strategy", "06-implementation", "16-quality-loop", "08-code-review"]`
  - `active_workflow.git_branch`: `{ "name": "feature/REQ-test", "status": "active" }`

**Input**: `{ "tool_name": "Bash", "tool_input": { "command": "git commit -m \"feat: implement fix\"" } }`

**Expected Output**:
- Exit code: 0
- stdout: JSON object with `"continue": false`
- stdout.stopReason: Contains text indicating commit is blocked during implementation phase

**Assertions**:
1. `result.exitCode === 0`
2. `JSON.parse(result.stdout).continue === false`
3. `parsed.stopReason` includes reference to current phase

---

### T16: Block commit on bugfix branch during phase 16-quality-loop

**Traces to**: AC-07, AC-09
**Priority**: P0 (core fix)

**Preconditions**:
- Git repo initialized on branch `bugfix/BUG-0012-test`
- state.json contains:
  - `active_workflow.current_phase`: `"16-quality-loop"`
  - `active_workflow.phases`: `["01-requirements", "02-tracing", "05-test-strategy", "06-implementation", "16-quality-loop", "08-code-review"]`
  - `active_workflow.git_branch`: `{ "name": "bugfix/BUG-0012-test", "status": "active" }`

**Input**: `{ "tool_name": "Bash", "tool_input": { "command": "git commit -m \"fix: quality improvements\"" } }`

**Expected Output**:
- stdout: JSON with `"continue": false`
- Commit blocked because quality-loop is not the last phase

**Assertions**:
1. `result.exitCode === 0`
2. `JSON.parse(result.stdout).continue === false`

---

### T17: Block commit on feature branch during phase 05-test-strategy

**Traces to**: AC-07, AC-09
**Priority**: P0 (core fix)

**Preconditions**:
- Git repo initialized on branch `feature/REQ-test`
- state.json contains:
  - `active_workflow.current_phase`: `"05-test-strategy"`
  - `active_workflow.phases`: `["01-requirements", "02-tracing", "05-test-strategy", "06-implementation", "16-quality-loop", "08-code-review"]`
  - `active_workflow.git_branch`: `{ "name": "feature/REQ-test", "status": "active" }`

**Input**: `{ "tool_name": "Bash", "tool_input": { "command": "git commit -m \"test: add test strategy\"" } }`

**Expected Output**:
- stdout: JSON with `"continue": false`

**Assertions**:
1. `result.exitCode === 0`
2. `JSON.parse(result.stdout).continue === false`

---

### T18: Allow commit during final phase 08-code-review

**Traces to**: AC-08, AC-10, AC-15, AC-16
**Priority**: P0 (boundary: last phase = allowed)

**Preconditions**:
- Git repo initialized on branch `feature/REQ-test`
- state.json contains:
  - `active_workflow.current_phase`: `"08-code-review"`
  - `active_workflow.phases`: `["01-requirements", "02-tracing", "05-test-strategy", "06-implementation", "16-quality-loop", "08-code-review"]`
  - `active_workflow.git_branch`: `{ "name": "feature/REQ-test", "status": "active" }`

**Input**: `{ "tool_name": "Bash", "tool_input": { "command": "git commit -m \"chore: review artifacts\"" } }`

**Expected Output**:
- Exit code: 0
- stdout: empty (no block)

**Assertions**:
1. `result.exitCode === 0`
2. `result.stdout === ''`

---

### T19: Allow commit when no active_workflow (fail-open)

**Traces to**: AC-11
**Priority**: P1 (fail-open boundary)

**Preconditions**:
- Git repo initialized on branch `feature/REQ-test`
- state.json contains: `{}` (no active_workflow)

**Input**: `{ "tool_name": "Bash", "tool_input": { "command": "git commit -m \"msg\"" } }`

**Expected Output**:
- Exit code: 0
- stdout: empty

**Assertions**:
1. `result.exitCode === 0`
2. `result.stdout === ''`

**Note**: This overlaps with existing T5 but uses a feature branch instead of main.

---

### T20: Allow commit on non-workflow branch

**Traces to**: AC-12
**Priority**: P1 (non-workflow branch handling)

**Preconditions**:
- Git repo initialized on branch `hotfix/urgent`
- state.json contains:
  - `active_workflow.current_phase`: `"06-implementation"`
  - `active_workflow.phases`: `["01-requirements", "06-implementation", "16-quality-loop", "08-code-review"]`
  - `active_workflow.git_branch`: `{ "name": "feature/REQ-test", "status": "active" }`

**Input**: `{ "tool_name": "Bash", "tool_input": { "command": "git commit -m \"hotfix: urgent\"" } }`

**Expected Output**:
- Exit code: 0
- stdout: empty (not on the workflow's feature branch, so phase check does not apply)

**Assertions**:
1. `result.exitCode === 0`
2. `result.stdout === ''`

**Rationale**: The phase-aware blocking only applies when the current git branch matches the workflow's feature/bugfix branch. If someone is on a different branch, the hook should not interfere.

---

### T21: Fail-open when current_phase is missing from state

**Traces to**: AC-14
**Priority**: P1 (fail-open robustness)

**Preconditions**:
- Git repo initialized on branch `feature/REQ-test`
- state.json contains:
  - `active_workflow.phases`: `["01-requirements", "06-implementation", "08-code-review"]`
  - `active_workflow.git_branch`: `{ "name": "feature/REQ-test", "status": "active" }`
  - NO `active_workflow.current_phase` field

**Input**: `{ "tool_name": "Bash", "tool_input": { "command": "git commit -m \"msg\"" } }`

**Expected Output**:
- Exit code: 0
- stdout: empty (fail-open)

**Assertions**:
1. `result.exitCode === 0`
2. `result.stdout === ''`

---

### T22: Fail-open when phases array is missing from state

**Traces to**: AC-14
**Priority**: P1 (fail-open robustness)

**Preconditions**:
- Git repo initialized on branch `feature/REQ-test`
- state.json contains:
  - `active_workflow.current_phase`: `"06-implementation"`
  - `active_workflow.git_branch`: `{ "name": "feature/REQ-test", "status": "active" }`
  - NO `active_workflow.phases` field

**Input**: `{ "tool_name": "Bash", "tool_input": { "command": "git commit -m \"msg\"" } }`

**Expected Output**:
- Exit code: 0
- stdout: empty (fail-open)

**Assertions**:
1. `result.exitCode === 0`
2. `result.stdout === ''`

---

### T23: Allow git add without git commit during blocked phases

**Traces to**: AC-18
**Priority**: P1 (staging is harmless)

**Preconditions**:
- Git repo initialized on branch `feature/REQ-test`
- state.json contains:
  - `active_workflow.current_phase`: `"06-implementation"`
  - `active_workflow.phases`: `["01-requirements", "06-implementation", "16-quality-loop", "08-code-review"]`
  - `active_workflow.git_branch`: `{ "name": "feature/REQ-test", "status": "active" }`

**Input**: `{ "tool_name": "Bash", "tool_input": { "command": "git add -A" } }`

**Expected Output**:
- Exit code: 0
- stdout: empty (git add is not intercepted)

**Assertions**:
1. `result.exitCode === 0`
2. `result.stdout === ''`

---

### T24: Block message includes phase name, stash suggestion, and orchestrator note

**Traces to**: AC-13, AC-19, AC-20
**Priority**: P1 (UX quality)

**Preconditions**:
- Git repo initialized on branch `bugfix/BUG-0012-test`
- state.json contains:
  - `active_workflow.current_phase`: `"06-implementation"`
  - `active_workflow.phases`: `["01-requirements", "06-implementation", "16-quality-loop", "08-code-review"]`
  - `active_workflow.git_branch`: `{ "name": "bugfix/BUG-0012-test", "status": "active" }`

**Input**: `{ "tool_name": "Bash", "tool_input": { "command": "git commit -m \"wip\"" } }`

**Expected Output**:
- stdout: JSON with `"continue": false`
- stopReason contains:
  - The current phase name (e.g., "06-implementation" or "implementation")
  - A mention of `git stash` as an alternative
  - A mention that the orchestrator handles commits

**Assertions**:
1. `parsed.stopReason` includes text about current phase
2. `parsed.stopReason` includes `stash` (case-insensitive)
3. `parsed.stopReason` includes `orchestrator` (case-insensitive)

---

### T25: Allow commit during last phase for non-standard workflow

**Traces to**: AC-15, AC-16
**Priority**: P2 (non-standard workflow edge case)

**Preconditions**:
- Git repo initialized on branch `feature/REQ-test`
- state.json contains a non-standard workflow:
  - `active_workflow.current_phase`: `"16-quality-loop"`
  - `active_workflow.phases`: `["01-requirements", "06-implementation", "16-quality-loop"]` (quality-loop IS the last phase here)
  - `active_workflow.git_branch`: `{ "name": "feature/REQ-test", "status": "active" }`

**Input**: `{ "tool_name": "Bash", "tool_input": { "command": "git commit -m \"msg\"" } }`

**Expected Output**:
- Exit code: 0
- stdout: empty (current phase is last phase, so commit is allowed)

**Assertions**:
1. `result.exitCode === 0`
2. `result.stdout === ''`

---

### T26: Regression -- still blocks commits to main with phase-aware logic present

**Traces to**: NFR-03
**Priority**: P0 (regression)

**Preconditions**:
- Git repo initialized on branch `main`
- state.json contains:
  - `active_workflow.current_phase`: `"06-implementation"`
  - `active_workflow.phases`: `["01-requirements", "06-implementation", "16-quality-loop", "08-code-review"]`
  - `active_workflow.git_branch`: `{ "name": "feature/REQ-test", "status": "active" }`

**Input**: `{ "tool_name": "Bash", "tool_input": { "command": "git commit -m \"msg\"" } }`

**Expected Output**:
- stdout: JSON with `"continue": false`
- stopReason: Contains "COMMIT TO MAIN BLOCKED" (existing behavior)

**Assertions**:
1. `JSON.parse(result.stdout).continue === false`
2. `parsed.stopReason.includes('COMMIT TO MAIN BLOCKED')`

**Note**: This confirms existing main-protection is not broken by the new phase-aware logic.

---

## Section B: Agent Content Validation Tests

### T27: software-developer agent contains no-commit instruction

**Traces to**: AC-01, AC-02
**Priority**: P0 (defense-in-depth)

**Preconditions**: None (file read test)

**Method**: Read `src/claude/agents/05-software-developer.md`, search for required content.

**Assertions**:
1. File contains text matching "Do NOT" and "git" and "commit" (case-insensitive pattern)
2. The instruction appears in the first 80 lines (prominent position, near mandatory enforcement section)

---

### T28: software-developer agent explains why commits are prohibited

**Traces to**: AC-03
**Priority**: P1

**Method**: Read `src/claude/agents/05-software-developer.md`.

**Assertions**:
1. File contains text referencing "quality" or "quality-loop" or "Phase 16"
2. File contains text referencing "code review" or "Phase 08"

---

### T29: software-developer agent mentions orchestrator manages git

**Traces to**: AC-04
**Priority**: P1

**Method**: Read `src/claude/agents/05-software-developer.md`.

**Assertions**:
1. File contains text referencing "orchestrator" in the context of git operations

---

### T30: quality-loop-engineer agent contains no-commit instruction

**Traces to**: AC-05
**Priority**: P1

**Method**: Read `src/claude/agents/16-quality-loop-engineer.md`.

**Assertions**:
1. File contains text matching "Do NOT" and "git" and "commit" (case-insensitive)

---

### T31: quality-loop-engineer agent explains code review not yet run

**Traces to**: AC-06
**Priority**: P1

**Method**: Read `src/claude/agents/16-quality-loop-engineer.md`.

**Assertions**:
1. File contains text referencing "code review" or "Phase 08" as not yet completed

---

## Coverage Summary

| Requirement | Test Cases | Coverage |
|-------------|-----------|----------|
| FR-01 (AC-01 to AC-04) | T27, T28, T29 | 100% |
| FR-02 (AC-05 to AC-06) | T30, T31 | 100% |
| FR-03 (AC-07 to AC-14) | T15, T16, T17, T18, T19, T20, T21, T22, T23, T24 | 100% |
| FR-04 (AC-15 to AC-18) | T18, T23, T25 | 100% |
| FR-05 (AC-19 to AC-20) | T24 | 100% |
| NFR-01 (Performance) | Covered implicitly (no new subprocess calls) | N/A |
| NFR-02 (Fail-open) | T19, T21, T22 | 100% |
| NFR-03 (Backward compat) | T26 + existing T1-T14 | 100% |

**Total ACs**: 20
**ACs with test coverage**: 20
**Coverage**: 100%
