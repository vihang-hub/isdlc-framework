# Integration Test Cases: REQ-0013 Supervised Mode

**Stream**: CJS (CommonJS) for gate-blocker tests; Manual for isdlc.md tests
**Total Tests**: 21 (8 automated + 13 manual)

---

## 1. Gate-Blocker Supervised Mode Awareness (8 tests)

**Test File**: `src/claude/hooks/tests/test-gate-blocker-extended.test.cjs` (EXTEND)
**Section**: `describe('Gate-Blocker: Supervised Mode Awareness')`
**Method**: `prepareHook()` + `runHook()` (subprocess testing via hook-test-utils.cjs)

| ID | Test Name | Given | When | Then | AC | Error Code |
|----|-----------|-------|------|------|----|------------|
| T75 | gate allows advancement with supervised_mode enabled and all requirements met | State has `supervised_mode: { enabled: true }`, all gate requirements satisfied (test_iteration complete, constitutional complete, delegation complete) | Gate-blocker receives gate advancement input | Returns `{ decision: 'allow' }` | AC-06a | -- |
| T76 | gate blocks when requirements fail regardless of supervised_mode | State has `supervised_mode: { enabled: true }`, test_iteration NOT complete | Gate-blocker receives gate advancement input | Returns `{ decision: 'block', stopReason: '...' }` with test iteration reason | AC-06b | -- |
| T77 | gate allows with corrupt supervised_mode config (fail-open) | State has `supervised_mode: 'invalid-string'` | Gate-blocker receives gate advancement input with all requirements met | Returns `{ decision: 'allow' }` -- corrupt config does not affect gate | AC-06c | ERR-SM-600 |
| T78 | gate allows with supervised_mode missing entirely | State has no `supervised_mode` key | Gate-blocker receives gate advancement input with all requirements met | Returns `{ decision: 'allow' }` -- behaves as autonomous mode | AC-06b | -- |
| T79 | info log appears when supervised_review.status is reviewing | State has `active_workflow.supervised_review: { status: 'reviewing', phase: '03-architecture' }`, all requirements met | Gate-blocker receives gate advancement input | Returns `{ decision: 'allow' }`; stderr contains supervised review info log | AC-06a | ERR-SM-601 |
| T80 | gate functions normally with supervised_review present but completed | State has `supervised_review: { status: 'completed' }` | Gate advancement input | Returns `{ decision: 'allow' }` -- completed review does not affect gate | AC-06a | -- |
| T81 | gate functions normally with review_history populated | State has `active_workflow.review_history: [{ phase: '03', action: 'continue' }]` | Gate advancement input | Returns `{ decision: 'allow' }` -- history presence does not affect gate | AC-06b | -- |
| T82 | gate allows with supervised_mode as array (corrupt) | State has `supervised_mode: [1, 2, 3]` (array, not object) | Gate advancement input with all requirements met | Returns `{ decision: 'allow' }` -- corrupt config handled gracefully | AC-06c | ERR-SM-600 |

---

## 2. Schema Validation Tests (6 tests)

**Test File**: `src/claude/hooks/tests/test-supervised-mode.test.cjs`
**Section**: `describe('Schema Validation')`

| ID | Test Name | Given | When | Then | AC |
|----|-----------|-------|------|------|----|
| T83 | valid supervised_mode config matches schema | Full valid config object | Validate against schema from validation-rules.json | All fields present and valid types | AC-01a |
| T84 | valid supervised_review state matches schema | Full supervised_review transient state | Validate against schema | All required fields present, status enum valid | AC-04b |
| T85 | valid review_history continue entry matches schema | `{ phase, action: 'continue', timestamp }` | Validate | All required fields present | AC-08a |
| T86 | valid review_history review entry matches schema | `{ phase, action: 'review', timestamp, paused_at, resumed_at }` | Validate | All fields valid | AC-08a |
| T87 | valid review_history redo entry matches schema | `{ phase, action: 'redo', timestamp, redo_count, guidance }` | Validate | All fields valid | AC-08a |
| T88 | invalid supervised_review status rejects unknown enum | `{ status: 'unknown_status' }` | Validate | Not in valid enum set | AC-04b |

---

## 3. STEP 3e-review Flow (Manual Integration, 8 tests)

**Verification Method**: Manual execution during Phase 16 quality loop
**Prerequisite**: Run a feature workflow with `--supervised` flag

| ID | Test Name | Given | When | Then | AC |
|----|-----------|-------|------|------|----|
| T-manual-01 | Review gate fires after enabled phase completes | Feature workflow with `--supervised`, phase 03-architecture completes | STEP 3e-review executes | Review gate menu displayed with [C], [R], [D] options; summary file created at `.isdlc/reviews/phase-03-summary.md` | AC-03a, AC-07a |
| T-manual-02 | Continue advances to next phase | Review gate displayed after phase 03 | User selects [C] Continue | Phase 04-design begins immediately; `review_history` gets continue entry | AC-03b |
| T-manual-03 | Review pauses and shows instructions | Review gate displayed | User selects [R] Review | Framework pauses; summary content displayed; instructions shown; `supervised_review.status = 'reviewing'` in state.json | AC-03c, AC-04a, AC-04b |
| T-manual-04 | Resume after review advances to next phase | Framework paused in review state | User says "continue" | Framework advances to next phase; `supervised_review.status = 'completed'`; `resumed_at` timestamp set | AC-04c, AC-04e |
| T-manual-05 | Redo prompts for guidance and re-runs phase | Review gate displayed | User selects [D] Redo and provides guidance text | Phase agent receives original prompt + "REDO GUIDANCE: {text}"; phase re-runs; new summary generated; menu re-presented | AC-03d, AC-05a, AC-05b, AC-05c |
| T-manual-06 | Circuit breaker removes [D] after 3 redos | User has already done 3 redos for current phase | Review gate menu is presented | Only [C] Continue and [R] Review shown; [D] Redo is absent | AC-05d |
| T-manual-07 | Non-reviewed phase auto-advances | `supervised_mode.review_phases = ['03', '04']`, phase 05-test-strategy completes | STEP 3e-review evaluates | No review gate; auto-advances to next phase | AC-03e, AC-07c |
| T-manual-08 | Final phase review gate fires before finalize | Last phase in workflow (08-code-review) completes, phase is in review_phases | STEP 3e-review evaluates | Review gate fires; after user response, proceeds to finalize/merge | AC-03g, AC-07d |

---

## 4. Orchestrator Integration (Manual, 3 tests)

**Verification Method**: Manual observation during workflow execution

| ID | Test Name | Given | When | Then | AC |
|----|-----------|-------|------|------|----|
| T-manual-09 | --supervised flag initializes config in state.json | User runs `/isdlc feature "description" --supervised` | Orchestrator init-and-phase-01 mode | `supervised_mode: { enabled: true, review_phases: 'all', parallel_summary: true, auto_advance_timeout: null }` written to state.json; confirmation displayed | AC-01a |
| T-manual-10 | No --supervised flag preserves autonomous mode | User runs `/isdlc feature "description"` (no flag) | Orchestrator init | No `supervised_mode` block created; workflow runs autonomously | AC-01b, AC-01c |
| T-manual-11 | Finalize preserves review_history in workflow_history | Supervised workflow completes all phases | Orchestrator finalize mode | `workflow_history` entry includes `review_history` array and `supervised_mode_enabled: true` | AC-08b |

---

## 5. Session Recovery (Manual, 2 tests)

**Verification Method**: Manual testing (session termination and restart)

| ID | Test Name | Given | When | Then | AC | Error Code |
|----|-----------|-------|------|------|----|------------|
| T-manual-12 | Session recovery detects paused review state | Session terminated while `supervised_review.status = 'reviewing'` | New Claude Code session starts, workflow in progress detected (SCENARIO 4) | Framework detects paused review; presents option to resume or cancel | NFR-04 | ERR-SM-500, ERR-SM-501 |
| T-manual-13 | Corrupt supervised_review cleared on recovery | `supervised_review.status = 'invalid_value'` in state.json | SCENARIO 4 evaluates | `supervised_review` cleared; standard resume proceeds | NFR-04 | ERR-SM-501 |

---

## 6. Backward Compatibility (5 tests)

**Verification Method**: Automated (existing test suite)

| ID | Test Name | Given | When | Then | AC |
|----|-----------|-------|------|------|----|
| T89 | Full CJS test suite passes without supervised_mode config | No `supervised_mode` in any test state | `npm run test:hooks` | All existing tests pass (0 regressions) | NFR-01 |
| T90 | Full ESM test suite passes without supervised_mode config | No `supervised_mode` in any test state | `npm test` | All existing tests pass (0 regressions) | NFR-01 |
| T91 | Existing gate-blocker tests pass unchanged | No modifications to existing gate-blocker tests | Run gate-blocker test file | All 26 existing tests pass | NFR-01 |
| T92 | Workflow without supervised_mode behaves identically | State has no `supervised_mode` block, active workflow | Phase completes | No review gate, no summary generated, auto-advance | NFR-01, AC-01c, AC-03f |
| T93 | supervised_mode disabled behaves identically | State has `supervised_mode: { enabled: false }` | Phase completes | No review gate, no summary generated, auto-advance | NFR-01, AC-01b, AC-03f |

---

## 7. Performance Test (1 test)

| ID | Test Name | Given | When | Then | AC |
|----|-----------|-------|------|------|----|
| T94 | generatePhaseSummary completes within 10 seconds | State with 50 artifact entries, git repo with changes | `generatePhaseSummary()` called, execution timed | Completes in < 10,000ms | NFR-03 |

---

## 8. No New Dependencies (1 test)

| ID | Test Name | Given | When | Then | AC |
|----|-----------|-------|------|------|----|
| T95 | package.json dependencies unchanged | Current package.json | Compare dependencies and devDependencies with baseline | No new entries added | NFR-06 |
