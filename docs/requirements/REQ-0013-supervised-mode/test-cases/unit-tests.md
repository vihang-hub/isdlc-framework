# Unit Test Cases: REQ-0013 Supervised Mode

**File Under Test**: `src/claude/hooks/lib/common.cjs` (4 new functions)
**Test File**: `src/claude/hooks/tests/test-supervised-mode.test.cjs`
**Stream**: CJS (CommonJS)
**Total Tests**: 74

---

## 1. readSupervisedModeConfig (20 tests)

### 1.1 Valid Configurations

| ID | Test Name | Given | When | Then | AC |
|----|-----------|-------|------|------|----|
| T01 | returns defaults when supervised_mode block is missing | State has no `supervised_mode` key | `readSupervisedModeConfig(state)` is called | Returns `{ enabled: false, review_phases: 'all', parallel_summary: true, auto_advance_timeout: null }` | AC-01c |
| T02 | returns enabled=true with valid full config | State has `{ supervised_mode: { enabled: true, review_phases: 'all', parallel_summary: true } }` | Called | Returns `{ enabled: true, review_phases: 'all', parallel_summary: true, auto_advance_timeout: null }` | AC-01a |
| T03 | returns enabled=false with disabled config | State has `{ supervised_mode: { enabled: false } }` | Called | Returns `{ enabled: false, review_phases: 'all', parallel_summary: true, auto_advance_timeout: null }` | AC-01b |
| T04 | normalizes review_phases array with valid entries | State has `{ supervised_mode: { enabled: true, review_phases: ['03', '04', '06'] } }` | Called | Returns `{ enabled: true, review_phases: ['03', '04', '06'], ... }` | AC-01e |

### 1.2 Missing/Null State Guards

| ID | Test Name | Given | When | Then | AC | Error Code |
|----|-----------|-------|------|------|----|------------|
| T05 | returns defaults when state is null | `state = null` | Called | Returns defaults with `enabled: false` | AC-01c | ERR-SM-100 |
| T06 | returns defaults when state is undefined | `state = undefined` | Called | Returns defaults with `enabled: false` | AC-01c | ERR-SM-100 |
| T07 | returns defaults when state is not an object | `state = 'string'` | Called | Returns defaults with `enabled: false` | AC-01c | ERR-SM-100 |

### 1.3 Invalid supervised_mode Block

| ID | Test Name | Given | When | Then | AC | Error Code |
|----|-----------|-------|------|------|----|------------|
| T08 | returns defaults when supervised_mode is null | `state = { supervised_mode: null }` | Called | Returns defaults with `enabled: false` | NFR-02 | ERR-SM-101 |
| T09 | returns defaults when supervised_mode is an array | `state = { supervised_mode: [1, 2, 3] }` | Called | Returns defaults with `enabled: false` | NFR-02 | ERR-SM-101 |
| T10 | returns defaults when supervised_mode is a string | `state = { supervised_mode: 'true' }` | Called | Returns defaults with `enabled: false` | NFR-02 | ERR-SM-101 |

### 1.4 Invalid enabled Field

| ID | Test Name | Given | When | Then | AC | Error Code |
|----|-----------|-------|------|------|----|------------|
| T11 | treats string 'true' as false | `supervised_mode.enabled = 'true'` | Called | `enabled: false` (strict boolean check) | NFR-02 | ERR-SM-102 |
| T12 | treats number 1 as false | `supervised_mode.enabled = 1` | Called | `enabled: false` | NFR-02 | ERR-SM-102 |
| T13 | treats null as false | `supervised_mode.enabled = null` | Called | `enabled: false` | NFR-02 | ERR-SM-102 |

### 1.5 Invalid review_phases Field

| ID | Test Name | Given | When | Then | AC | Error Code |
|----|-----------|-------|------|------|----|------------|
| T14 | treats number as 'all' | `supervised_mode.review_phases = 42` | Called | `review_phases: 'all'` | NFR-02 | ERR-SM-103 |
| T15 | filters invalid entries from array | `review_phases = ['03', 'invalid', '06', '999']` | Called | `review_phases: ['03', '06']` (only valid 2-digit strings) | AC-01f | ERR-SM-104 |
| T16 | treats all-invalid array as 'all' | `review_phases = ['invalid', 'abc', '1']` | Called | `review_phases: 'all'` (empty after filtering) | AC-01f | ERR-SM-104 |
| T17 | preserves valid entries alongside invalid | `review_phases = ['03', null, 04, '16']` | Called | `review_phases: ['03', '16']` (null and number filtered) | AC-01f | ERR-SM-104 |

### 1.6 Invalid parallel_summary Field

| ID | Test Name | Given | When | Then | AC | Error Code |
|----|-----------|-------|------|------|----|------------|
| T18 | treats string 'false' as true (default) | `parallel_summary = 'false'` | Called | `parallel_summary: true` | NFR-02 | ERR-SM-105 |
| T19 | treats number 0 as true (default) | `parallel_summary = 0` | Called | `parallel_summary: true` | NFR-02 | ERR-SM-105 |

### 1.7 auto_advance_timeout Field

| ID | Test Name | Given | When | Then | AC | Error Code |
|----|-----------|-------|------|------|----|------------|
| T20 | always returns null regardless of input | `auto_advance_timeout = 300` | Called | `auto_advance_timeout: null` | CON-013-05 | ERR-SM-106 |

---

## 2. shouldReviewPhase (16 tests)

### 2.1 Disabled/Invalid Config

| ID | Test Name | Given | When | Then | AC |
|----|-----------|-------|------|------|----|
| T21 | returns false when config is null | `config = null` | `shouldReviewPhase(config, '03-architecture')` | Returns `false` | AC-03f |
| T22 | returns false when enabled is false | `config = { enabled: false, review_phases: 'all' }` | Called | Returns `false` | AC-03f |
| T23 | returns false when config is undefined | `config = undefined` | Called | Returns `false` | AC-03f |

### 2.2 review_phases = "all"

| ID | Test Name | Given | When | Then | AC |
|----|-----------|-------|------|------|----|
| T24 | returns true for any phase when review_phases is "all" | `config = { enabled: true, review_phases: 'all' }` | Called with `'03-architecture'` | Returns `true` | AC-01d |
| T25 | returns true for implementation phase with "all" | Same config | Called with `'06-implementation'` | Returns `true` | AC-01d |
| T26 | returns true for quality-loop phase with "all" | Same config | Called with `'16-quality-loop'` | Returns `true` | AC-01d |

### 2.3 review_phases = Array

| ID | Test Name | Given | When | Then | AC |
|----|-----------|-------|------|------|----|
| T27 | returns true when phase prefix matches array entry | `config = { enabled: true, review_phases: ['03', '04', '06'] }` | Called with `'03-architecture'` | Returns `true` | AC-01e |
| T28 | returns false when phase prefix not in array | Same config | Called with `'05-test-strategy'` | Returns `false` | AC-01e |
| T29 | returns true for last matching entry | Same config | Called with `'06-implementation'` | Returns `true` | AC-01e |
| T30 | returns false for 16-quality-loop with ['03'] | `review_phases: ['03']` | Called with `'16-quality-loop'` | Returns `false` | AC-01e |
| T31 | extracts 2-digit prefix correctly from phase key | `review_phases: ['16']` | Called with `'16-quality-loop'` | Returns `true` (extracts '16') | AC-01e |

### 2.4 Invalid Phase Key Inputs

| ID | Test Name | Given | When | Then | AC |
|----|-----------|-------|------|------|----|
| T32 | returns false for null phaseKey | Valid enabled config | Called with `null` | Returns `false` | -- |
| T33 | returns false for empty string phaseKey | Valid enabled config | Called with `''` | Returns `false` | -- |
| T34 | returns false for non-string phaseKey | Valid enabled config | Called with `42` | Returns `false` | -- |

### 2.5 Boundary Cases

| ID | Test Name | Given | When | Then | AC |
|----|-----------|-------|------|------|----|
| T35 | returns false with unexpected review_phases type | `config = { enabled: true, review_phases: { '03': true } }` | Called with `'03-architecture'` | Returns `false` (fail-open) | -- |
| T36 | handles single-entry array | `review_phases: ['06']` | Called with `'06-implementation'` | Returns `true` | AC-01e |

---

## 3. generatePhaseSummary (22 tests)

### 3.1 Full Summary Generation

| ID | Test Name | Given | When | Then | AC |
|----|-----------|-------|------|------|----|
| T37 | generates full summary with all sections | Valid state with phase data, `options = {}` | `generatePhaseSummary(state, '03-architecture', projectRoot)` | Returns path to `.isdlc/reviews/phase-03-summary.md`; file contains Status, Duration, Key Decisions, Artifacts, File Changes, Links sections | AC-02a |
| T38 | includes phase number in heading | Same | Same | File starts with `# Phase 03 Summary: Architecture` | AC-02a |
| T39 | calculates duration from timestamps | Phase has `started: '2026-02-14T10:00:00Z', completed: '2026-02-14T10:30:00Z'` | Called | Duration shows `30m` | AC-02a |
| T40 | includes artifact list in table | Phase has `artifacts: ['arch.md', 'adrs/']` | Called | Artifacts table has 2 rows | AC-02a |

### 3.2 Minimal Summary

| ID | Test Name | Given | When | Then | AC |
|----|-----------|-------|------|------|----|
| T41 | generates minimal summary without diffs or decisions | Valid state, `options = { minimal: true }` | Called | File does NOT contain "Key Decisions" or "File Changes" sections | AC-02e |
| T42 | minimal summary still includes artifacts | Same | Same | File contains "Artifacts Created/Modified" section | AC-02e |
| T43 | minimal summary includes phase name and status | Same | Same | File contains phase name and "Completed" status | AC-02e |

### 3.3 Edge Cases -- Missing Data

| ID | Test Name | Given | When | Then | AC | Error Code |
|----|-----------|-------|------|------|----|------------|
| T44 | handles missing phase data | `phases[phaseKey]` is undefined | Called | Summary generated with "N/A" placeholders, returns valid path | AC-02b | ERR-SM-200 |
| T45 | handles empty artifacts array | `artifacts: []` | Called | Summary says "No file changes recorded in phase state." | AC-02b | ERR-SM-200 |
| T46 | handles invalid timestamps | `started: 'not-a-date'` | Called | Duration shows "N/A" | AC-02a | ERR-SM-205 |
| T47 | handles missing summary text | No `summary` field in phase data | Called | Key decisions uses fallback text | AC-02b | ERR-SM-200 |
| T48 | handles null state gracefully | `state = null` | Called | Returns `null` (catch-all) | NFR-02 | ERR-SM-204 |

### 3.4 Directory and File Operations

| ID | Test Name | Given | When | Then | AC |
|----|-----------|-------|------|------|----|
| T49 | creates reviews directory if missing | `.isdlc/reviews/` does not exist | Called | Directory created; file written; path returned | AC-02c |
| T50 | overwrites existing summary file (redo) | `.isdlc/reviews/phase-03-summary.md` already exists with old content | Called | File overwritten with new content | AC-02d |

### 3.5 Git Diff Handling

| ID | Test Name | Given | When | Then | AC | Error Code |
|----|-----------|-------|------|------|----|------------|
| T51 | includes git diff output when available | Git repo with uncommitted changes | Called with `minimal: false` | "File Changes" section contains diff output | AC-02a | -- |
| T52 | handles git not available | Non-git directory or git command fails | Called with `minimal: false` | "Git diff unavailable." shown | AC-02a | ERR-SM-201 |
| T53 | handles empty git diff | No uncommitted changes | Called with `minimal: false` | "No uncommitted file changes detected." shown | AC-02a | -- |

### 3.6 Error Handling / Fail-Safe

| ID | Test Name | Given | When | Then | AC | Error Code |
|----|-----------|-------|------|------|----|------------|
| T54 | returns null when directory creation fails | Read-only filesystem or invalid path | Called | Returns `null`; writes to stderr | NFR-02 | ERR-SM-202 |
| T55 | returns null when file write fails | Permission denied on target file | Called | Returns `null`; writes to stderr | NFR-02 | ERR-SM-203 |
| T56 | catch-all returns null on unexpected error | State object causes TypeError in processing | Called | Returns `null`; stderr contains error message | NFR-02 | ERR-SM-204 |

### 3.7 Private Helper: _resolvePhaseDisplayName

| ID | Test Name | Given | When | Then | AC |
|----|-----------|-------|------|------|----|
| T57 | resolves known phase keys to display names | `phaseKey = '03-architecture'` | Summary generated | Heading contains "Architecture" | AC-02a |
| T58 | resolves unknown phase key via fallback | `phaseKey = '99-custom-phase'` | Summary generated | Heading contains "Custom Phase" | AC-02a |

---

## 4. recordReviewAction (16 tests)

### 4.1 Continue Action

| ID | Test Name | Given | When | Then | AC |
|----|-----------|-------|------|------|----|
| T59 | records continue action with correct shape | State with `active_workflow` | `recordReviewAction(state, '03-architecture', 'continue', { timestamp: '...' })` | Entry has `{ phase, action: 'continue', timestamp }` | AC-08a |
| T60 | auto-generates timestamp if not provided | State with `active_workflow`, no details.timestamp | Called with `{}` details | Entry has a generated ISO timestamp | AC-08a |
| T61 | appends to existing review_history | State has `review_history: [existing_entry]` | Called | Array length increases by 1, existing entry preserved | AC-08a |

### 4.2 Review Action

| ID | Test Name | Given | When | Then | AC |
|----|-----------|-------|------|------|----|
| T62 | records review action with paused_at and resumed_at | State with `active_workflow` | Called with `action = 'review'` and details `{ paused_at, resumed_at }` | Entry has all review fields | AC-08a |
| T63 | review action includes timestamp from details | Same | Details include `{ timestamp: '...' }` | Entry.timestamp matches provided value | AC-08a |
| T64 | review action spreads additional detail fields | Same | Details include custom fields | Entry contains spread details | AC-08a |

### 4.3 Redo Action

| ID | Test Name | Given | When | Then | AC |
|----|-----------|-------|------|------|----|
| T65 | records redo action with redo_count and guidance | State with `active_workflow` | Called with `action = 'redo'` and `{ redo_count: 1, guidance: 'text' }` | Entry has redo fields | AC-08a |
| T66 | records redo action with high redo_count | Same | `redo_count: 3` | Entry records count = 3 | AC-08a |
| T67 | records redo with empty guidance | Same | `guidance: ''` | Entry has `guidance: ''` | AC-08a |

### 4.4 Array Initialization

| ID | Test Name | Given | When | Then | AC | Error Code |
|----|-----------|-------|------|------|----|------------|
| T68 | initializes review_history when missing | State has `active_workflow` but no `review_history` | Called | `review_history` is created as array with 1 entry | AC-08a | ERR-SM-700 |
| T69 | re-initializes review_history when not an array | State has `active_workflow.review_history = 'not-array'` | Called | `review_history` is reset to array with new entry | AC-08a | ERR-SM-700 |

### 4.5 Guard Clauses

| ID | Test Name | Given | When | Then | AC | Error Code |
|----|-----------|-------|------|------|----|------------|
| T70 | returns false when state is null | `state = null` | Called | Returns `false` | AC-08a | ERR-SM-701 |
| T71 | returns false when active_workflow is missing | `state = {}` | Called | Returns `false` | AC-08a | ERR-SM-701 |
| T72 | returns true on successful recording | Valid state with active_workflow | Called | Returns `true` | AC-08a |

### 4.6 Append Behavior

| ID | Test Name | Given | When | Then | AC |
|----|-----------|-------|------|------|----|
| T73 | preserves order of entries | State with empty `review_history` | Called 3 times with different actions | Array has 3 entries in call order | AC-08a |
| T74 | does not mutate details object | `details = { timestamp: '...' }` | Called | Original details object unchanged | -- |
