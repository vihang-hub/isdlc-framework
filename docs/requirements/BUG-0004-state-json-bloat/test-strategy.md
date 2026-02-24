# Test Strategy: BUG-0004 — state.json Bloat Pruning Functions

**Version**: 1.0.0
**Date**: 2026-02-09
**Workflow**: fix (BUG-0004-state-json-bloat)
**Test Framework**: node:test + node:assert/strict (CJS)

---

## 1. Scope

This test strategy covers 5 new functions to be added to `src/claude/hooks/lib/common.cjs` and exported via `module.exports`:

| Function | Purpose | Fix Ref |
|----------|---------|---------|
| `pruneSkillUsageLog(state, maxEntries)` | Keep only the last N entries in `skill_usage_log` | FIX-001 |
| `pruneCompletedPhases(state)` | Strip verbose sub-objects from completed/gated phases | FIX-002 |
| `pruneHistory(state, maxEntries, maxCharLen)` | FIFO cap + action truncation on `history[]` | FIX-003 |
| `pruneWorkflowHistory(state, maxEntries, maxCharLen)` | FIFO cap + description truncation on `workflow_history[]` | FIX-003 |
| `resetPhasesForWorkflow(state, workflowPhases)` | Clear phases and initialize fresh entries for new workflow | FIX-004 |

---

## 2. Test Approach

### 2.1 Test Type

**Unit tests** — pure function testing. Each function takes a state object (plain JS object) and returns the mutated state. No file I/O, no subprocess spawning, no network calls.

### 2.2 Test File Location

Tests will be added as new `describe()` blocks at the bottom of the existing file:
`src/claude/hooks/tests/test-common.test.cjs`

This follows the established pattern where all `common.cjs` utility tests live in a single file.

### 2.3 Test Pattern

Each function gets its own `describe()` block. Tests follow the existing conventions:
- Use `node:test` `describe`/`it` pattern
- Use `node:assert/strict` for assertions
- Import `common.cjs` via the `installCommonCjs()` / `requireCommon()` pattern already used in the file
- No external dependencies
- Tests are deterministic (no time-dependent assertions, no random data)

### 2.4 Environment

Tests run within the existing `setupTestEnv()` / `cleanupTestEnv()` lifecycle already configured in the `before()` / `after()` hooks of the parent `describe('common.js')` block.

---

## 3. Test Cases by Function

### 3.1 pruneSkillUsageLog(state, maxEntries=20)

| # | Test Case | Input | Expected | AC |
|---|-----------|-------|----------|-----|
| 1 | Empty array stays empty | `{ skill_usage_log: [] }` | Returns state with `[]`, no crash | AC-3 |
| 2 | Missing field is safe | `{}` (no skill_usage_log) | Returns state unchanged, no crash | AC-3 |
| 3 | Under limit unchanged | 10 entries, maxEntries=20 | All 10 entries preserved | AC-3 |
| 4 | At limit unchanged | 20 entries, maxEntries=20 | All 20 entries preserved | AC-3 |
| 5 | Over limit prunes oldest | 30 entries (ids 1-30), maxEntries=20 | Last 20 (ids 11-30) kept | AC-1, AC-2 |
| 6 | Preserves entry structure | Entries with full fields (timestamp, agent, etc.) | Retained entries have identical structure | AC-1 |
| 7 | Custom maxEntries | 10 entries, maxEntries=5 | Last 5 entries kept | AC-1 |
| 8 | Returns pruned count | 30 entries, maxEntries=20 | Return value includes pruned count of 10 | AC-1 |

### 3.2 pruneCompletedPhases(state)

| # | Test Case | Input | Expected | AC |
|---|-----------|-------|----------|-----|
| 9 | No phases key | `{}` | Returns state unchanged | AC-6 |
| 10 | Empty phases object | `{ phases: {} }` | Returns state with `{}` | AC-6 |
| 11 | Phase without strip-target fields | Phase has only `status`, `started`, `completed`, `gate_passed`, `artifacts` | All fields preserved, nothing removed | AC-6 |
| 12 | Completed phase gets stripped | Phase with `status:"completed"` + `iteration_requirements`, `constitutional_validation`, `testing_environment`, `gate_validation` | Strip fields removed, keep `status`, `started`, `completed`, `gate_passed`, `artifacts` | AC-4, AC-5 |
| 13 | Gate-passed phase gets stripped | Phase with `gate_passed:true` (but status not "completed") + verbose sub-objects | Strip fields removed | AC-4, AC-5 |
| 14 | In-progress phase NOT stripped | Phase with `status:"in_progress"` + all sub-objects | All sub-objects preserved | AC-6 |
| 15 | Pending phase NOT stripped | Phase with `status:"pending"` + sub-objects | All sub-objects preserved | AC-6 |
| 16 | Mixed phases: selective stripping | 3 phases: one completed, one in_progress, one pending | Only completed has fields stripped | AC-4, AC-5, AC-6 |
| 17 | Strips all 6 target fields | Phase with all 6 fields: `iteration_requirements`, `constitutional_validation`, `gate_validation`, `testing_environment`, `verification_summary`, `atdd_validation` | All 6 removed | AC-5 |
| 18 | Preserves non-strip fields | Completed phase with `status`, `started`, `completed`, `gate_passed`, `artifacts`, `custom_field` | `custom_field` preserved (only listed fields stripped) | AC-4 |

### 3.3 pruneHistory(state, maxEntries=50, maxCharLen=200)

| # | Test Case | Input | Expected | AC |
|---|-----------|-------|----------|-----|
| 19 | Empty history | `{ history: [] }` | Returns state with `[]` | - |
| 20 | Missing history key | `{}` | Returns state unchanged, no crash | - |
| 21 | Under limit, short actions | 10 entries, actions < 200 chars | All entries preserved unchanged | - |
| 22 | Over limit FIFO | 60 entries, maxEntries=50 | Last 50 entries kept (oldest 10 removed) | AC-8 |
| 23 | Long action truncated | Entry with 500-char action string | Truncated to 200 chars + "..." suffix (203 total) | AC-7, AC-9 |
| 24 | Action exactly at limit | Entry with exactly 200-char action | NOT truncated (no "..." added) | AC-7 |
| 25 | Action at 201 chars | Entry with 201-char action | Truncated to 200 + "..." | AC-7 |
| 26 | Preserves other entry fields | Entry with `timestamp`, `agent`, `phase`, `action` | Only `action` touched; `timestamp`, `agent`, `phase` preserved | AC-9 |
| 27 | Both truncation and FIFO together | 60 entries with long actions | Oldest 10 removed AND remaining actions truncated | AC-7, AC-8, AC-9 |
| 28 | Custom limits | maxEntries=5, maxCharLen=50 | Respects custom values | AC-7, AC-8 |
| 29 | Entry without action field | Entry missing `action` key | No crash, entry preserved | - |

### 3.4 pruneWorkflowHistory(state, maxEntries=50, maxCharLen=200)

| # | Test Case | Input | Expected | AC |
|---|-----------|-------|----------|-----|
| 30 | Empty workflow_history | `{ workflow_history: [] }` | Returns state with `[]` | - |
| 31 | Missing workflow_history key | `{}` | Returns state unchanged | - |
| 32 | Under limit unchanged | 10 entries, short descriptions | All entries preserved | - |
| 33 | Over limit FIFO | 60 entries, maxEntries=50 | Last 50 entries kept | AC-8 |
| 34 | Long description truncated | Entry with 500-char description | Truncated to 200 + "..." | AC-7 |
| 35 | Description exactly at 200 | 200-char description | NOT truncated | AC-7 |
| 36 | Preserves required fields | Entry with `type`, `status`, `cancelled_at_phase`, `cancellation_reason`, `description` | All fields preserved (description may be truncated) | AC-9 |
| 37 | git_branch compacted | Entry with full `git_branch: { name, status, created_at, merged_at }` | Reduced to `{ name }` only | AC-9 |
| 38 | git_branch already minimal | Entry with `git_branch: { name: "..." }` | Unchanged | - |
| 39 | Entry without git_branch | Entry has no `git_branch` key | No crash, entry preserved | - |
| 40 | Entry without description | Entry missing `description` key | No crash, entry preserved | - |
| 41 | Custom limits | maxEntries=3, maxCharLen=50 | Respects custom values | AC-7, AC-8 |

### 3.5 resetPhasesForWorkflow(state, workflowPhases)

| # | Test Case | Input | Expected | AC |
|---|-----------|-------|----------|-----|
| 42 | Clears existing phases | state has 5 phases from prior workflow; new workflow has 3 phases | `phases` has exactly 3 entries (old 5 gone) | AC-10, AC-12 |
| 43 | Creates fresh skeleton | New phase array `["01-requirements", "05-implementation"]` | Each phase has `status:"pending"`, `started:null`, `completed:null`, `gate_passed:null`, `artifacts:[]` | AC-11 |
| 44 | Empty workflow phases | `workflowPhases = []` | `phases = {}` (empty object) | AC-10 |
| 45 | Previous phases removed | state had `{ phases: { "old-phase": {big_data} } }`, new workflow has `["01-requirements"]` | `old-phase` key does not exist | AC-12 |
| 46 | Preserves other state fields | state has `current_phase`, `active_workflow`, `history` etc. + old phases | Only `phases` is reset; all other fields unchanged | AC-10 |
| 47 | Handles missing phases key | state has no `phases` key | Creates `phases` with fresh entries | AC-10, AC-11 |

---

## 4. Acceptance Criteria Traceability

| AC | Test Cases | Status |
|----|------------|--------|
| AC-1 (skill_usage_log cleared on completion) | 5, 6, 7, 8 | Covered |
| AC-2 (skill_usage_log cleared on cancellation) | 5 (same logic) | Covered |
| AC-3 (no change during active workflow) | 1, 2, 3, 4 | Covered |
| AC-4 (phases retain only summary fields) | 12, 13, 16, 18 | Covered |
| AC-5 (verbose sub-objects removed) | 12, 13, 17 | Covered |
| AC-6 (no change during active workflow) | 9, 10, 11, 14, 15, 16 | Covered |
| AC-7 (action capped at 200 chars) | 23, 24, 25, 28, 34, 35, 41 | Covered |
| AC-8 (history capped at 50 entries) | 22, 27, 28, 33, 41 | Covered |
| AC-9 (existing overlong entries trimmed) | 23, 26, 27, 36, 37 | Covered |
| AC-10 (phases rebuilt for new workflow) | 42, 44, 46, 47 | Covered |
| AC-11 (fresh skeleton with pending status) | 43, 47 | Covered |
| AC-12 (previous workflow phases removed) | 42, 45 | Covered |

**Coverage**: 12/12 acceptance criteria covered (100%).

---

## 5. Edge Cases and Boundary Conditions

| Category | Cases |
|----------|-------|
| Null/undefined input fields | Tests 2, 10, 20, 31, 40, 47 |
| Empty arrays/objects | Tests 1, 9, 19, 30, 44 |
| Exact boundary (at limit) | Tests 4, 24, 35 |
| One over boundary | Tests 5, 25 |
| Preserve non-target fields | Tests 6, 18, 26, 36, 46 |
| Custom parameter values | Tests 7, 28, 41 |
| Combined effects | Tests 16, 27 |

---

## 6. What is NOT Tested

- File I/O (read/write state.json) — already covered by existing `readState()`/`writeState()` tests
- Hook integration (calling pruning from hooks) — pruning is called by the orchestrator agent, not hooks
- Orchestrator behavior (agent instructions) — untestable via unit tests; validated via gate checks
- Performance benchmarks — out of scope for unit tests
