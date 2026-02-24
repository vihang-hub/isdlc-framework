# Error Taxonomy: REQ-0013 Supervised Mode

**Version**: 1.0.0
**Phase**: 04-design
**Traces to**: NFR-013-01, NFR-013-02, NFR-013-04, NFR-013-05, Articles III, X

---

## 1. Error Classification

All errors in the supervised mode feature follow the iSDLC fail-open principle (Article X). No error should prevent the user from using Claude Code or advancing through the workflow.

### 1.1 Error Severity Levels

| Level | Behavior | User Impact |
|-------|----------|-------------|
| **SILENT** | Return safe default, no user-visible output | None |
| **WARN** | Write to stderr, continue with safe default | Debug log only |
| **DEGRADE** | Skip optional feature, inform user, continue | Minor feature loss |

There is no ERROR or FATAL level. Supervised mode never blocks the workflow.

---

## 2. Error Catalog

### 2.1 Configuration Errors (ERR-SM-1xx)

| Code | Error | Trigger | Severity | Behavior | Traces |
|------|-------|---------|----------|----------|--------|
| ERR-SM-100 | `supervised_mode` block missing | State.json has no `supervised_mode` key | SILENT | Return `{ enabled: false }`. Autonomous mode. | AC-01c, NFR-02 |
| ERR-SM-101 | `supervised_mode` is not an object | Block is null, array, string, number | SILENT | Return `{ enabled: false }`. Autonomous mode. | NFR-02 |
| ERR-SM-102 | `enabled` is not a boolean | Value is string, number, null, or undefined | SILENT | Treat as `false`. Autonomous mode. | NFR-02 |
| ERR-SM-103 | `review_phases` is invalid type | Not `"all"` and not an array | SILENT | Treat as `"all"`. | NFR-02 |
| ERR-SM-104 | `review_phases` array contains invalid entries | Array entries are not 2-digit strings | SILENT | Filter out invalid entries. If all invalid, treat as `"all"`. | AC-01f |
| ERR-SM-105 | `parallel_summary` is not boolean | Value is string, number, null | SILENT | Treat as `true` (default). | NFR-02 |
| ERR-SM-106 | `auto_advance_timeout` has a value | Value is not null (reserved for future) | SILENT | Ignore. Always return `null`. | CON-013-05 |

### 2.2 Summary Generation Errors (ERR-SM-2xx)

| Code | Error | Trigger | Severity | Behavior | Traces |
|------|-------|---------|----------|----------|--------|
| ERR-SM-200 | State data incomplete | `phases[phaseKey]` missing or empty | WARN | Generate summary with "N/A" placeholders for missing fields | AC-02b |
| ERR-SM-201 | Git diff command fails | `git` not available, repo not initialized, timeout | WARN | Skip "File Changes" section, include "Git diff unavailable" | ASM-013-03 |
| ERR-SM-202 | Reviews directory creation fails | Permission denied, disk full | DEGRADE | Return null. Review gate falls back to no summary. | AC-02c |
| ERR-SM-203 | Summary file write fails | Permission denied, disk full | DEGRADE | Return null. Review gate falls back to no summary. | AC-02a |
| ERR-SM-204 | Summary generation throws unexpectedly | Unhandled exception in any part of generation | DEGRADE | Catch-all try/catch returns null. Stderr log. | NFR-02 |
| ERR-SM-205 | Duration calculation overflow | Invalid timestamps (NaN, missing) | WARN | Display "N/A" for duration. | AC-02a |

### 2.3 Review Gate Errors (ERR-SM-3xx)

| Code | Error | Trigger | Severity | Behavior | Traces |
|------|-------|---------|----------|----------|--------|
| ERR-SM-300 | Summary path is null | `generatePhaseSummary()` returned null | DEGRADE | Log warning. Skip review gate. Auto-advance. | NFR-02 |
| ERR-SM-301 | Summary file cannot be read for display | File deleted between generation and [R] Review | DEGRADE | Display "Summary file not available. Review artifacts directly." | -- |
| ERR-SM-302 | State write fails during review gate | State.json write error (disk, corruption) | WARN | Continue with in-memory state. Log to stderr. | Article X |
| ERR-SM-303 | Invalid user menu selection | User enters text not matching C/R/D | SILENT | Re-prompt (standard AskUserQuestion behavior) | -- |
| ERR-SM-304 | `supervised_review` already exists for different phase | State corruption, stale data | WARN | Overwrite with current phase's review data. Log warning. | -- |

### 2.4 Redo Errors (ERR-SM-4xx)

| Code | Error | Trigger | Severity | Behavior | Traces |
|------|-------|---------|----------|----------|--------|
| ERR-SM-400 | Redo count exceeds circuit breaker | `redo_count >= 3` | SILENT | Remove [D] option from menu. User can only Continue or Review. | NFR-05, AC-05d |
| ERR-SM-401 | Redo count is corrupt (> 3, NaN, negative) | State corruption | SILENT | Treat as >= 3. Remove [D] option. | NFR-05 |
| ERR-SM-402 | Re-delegation fails | Phase agent throws or returns error | WARN | Phase remains in `in_progress`. Review gate re-presents menu without the failed redo's changes. | -- |
| ERR-SM-403 | Guidance text is empty | User provides empty string for redo guidance | SILENT | Accept empty guidance. Redo proceeds with no additional guidance appended. | AC-05a |
| ERR-SM-404 | `redo_guidance_history` is not an array | State corruption | SILENT | Re-initialize as empty array, then push. | -- |

### 2.5 Session Recovery Errors (ERR-SM-5xx)

| Code | Error | Trigger | Severity | Behavior | Traces |
|------|-------|---------|----------|----------|--------|
| ERR-SM-500 | `supervised_review` exists but phase key is invalid | Phase key not in workflow's phases array | WARN | Clear `supervised_review`. Proceed with standard SCENARIO 4. | NFR-04 |
| ERR-SM-501 | `supervised_review.status` has unexpected value | Not one of: gate_presented, reviewing, completed, redo_pending | WARN | Clear `supervised_review`. Proceed with standard SCENARIO 4. | NFR-04 |
| ERR-SM-502 | Summary file missing on recovery | `.isdlc/reviews/phase-NN-summary.md` deleted | DEGRADE | Display "Summary file not available. Choose to continue or cancel." | NFR-04 |

### 2.6 Gate-Blocker Interaction Errors (ERR-SM-6xx)

| Code | Error | Trigger | Severity | Behavior | Traces |
|------|-------|---------|----------|----------|--------|
| ERR-SM-600 | Gate-blocker reads corrupt supervised_mode | `readSupervisedModeConfig()` handles gracefully | SILENT | Returns `{ enabled: false }`. Gate-blocker unaffected. | AC-06c |
| ERR-SM-601 | Gate advancement during active review | Gate-blocker fires while `supervised_review.status === "reviewing"` | WARN | Gate-blocker evaluates requirements normally. Info log to stderr. | AC-06a |

### 2.7 History and Audit Errors (ERR-SM-7xx)

| Code | Error | Trigger | Severity | Behavior | Traces |
|------|-------|---------|----------|----------|--------|
| ERR-SM-700 | `review_history` is not an array | State corruption | SILENT | Re-initialize as `[]`, then append. | AC-08a |
| ERR-SM-701 | `recordReviewAction()` called without active_workflow | Race condition, state corruption | SILENT | Return false. No entry recorded. | AC-08a |
| ERR-SM-702 | review_history not preserved during finalize | Orchestrator does not copy field | WARN | Verify during implementation. Orchestrator should copy full `active_workflow`. | AC-08b |

---

## 3. Error Flow Summary

```
Configuration Error Path:
  readSupervisedModeConfig() -> { enabled: false } -> Review gate skipped -> Autonomous mode

Summary Error Path:
  generatePhaseSummary() -> null -> STEP 3e-review skips -> Auto-advance to 3e-sizing

Redo Error Path:
  redo_count >= 3 -> [D] removed from menu -> User must Continue or Review

Session Recovery Error Path:
  supervised_review corrupt -> Clear it -> Standard SCENARIO 4 resume
```

---

## 4. Monitoring and Debugging

### 4.1 Stderr Output Format

All supervised mode errors that produce stderr output use the prefix `[supervised-mode]`:

```
[supervised-mode] Summary generation failed: ENOENT: no such file or directory
[supervised-mode] Git diff unavailable, skipping file changes section
[supervised-mode] Corrupt supervised_review cleared for phase 03-architecture
```

### 4.2 State Inspection

Debugging supervised mode issues can be done by inspecting:

1. `state.json -> supervised_mode` -- Configuration
2. `state.json -> active_workflow.supervised_review` -- Active review state
3. `state.json -> active_workflow.review_history` -- Audit trail
4. `.isdlc/reviews/phase-NN-summary.md` -- Generated summaries
5. `.isdlc/hook-activity.log` -- Gate-blocker interaction logs
