# Requirements Specification: REQ-0013 Supervised Mode

**Feature**: Supervised Mode -- Configurable per-phase review gates with parallel change summaries
**Version**: 1.0.0
**Created**: 2026-02-14
**Status**: Draft
**Artifact Folder**: REQ-0013-supervised-mode
**Workflow Type**: feature

---

## 1. Project Overview

### 1.1 Problem Statement

The iSDLC framework currently operates in a binary mode: either fully autonomous (all phases flow without pause) or broken (escalation on failure). There is no structured way for users to review phase output before the next phase consumes it. The only review checkpoint is the end-of-workflow Human Review Checkpoint (before merge), at which point it is too late to correct upstream decisions -- for example, a Phase 03 architecture decision that Phase 06 already built upon.

This gap is critical for:
- **Existing project discovery**: The user knows the codebase better than the agent and needs to validate architecture/design assumptions
- **Greenfield projects**: Requirements validation before design begins
- **Any workflow**: Where user domain knowledge exceeds agent knowledge

### 1.2 Proposed Solution

A lightweight gate enhancement (not a new phase) with three components:

1. **Phase summary generation**: After each phase completes, generate a structured summary (file diffs, artifact list, key decisions, links to changed/created files) written to `.isdlc/reviews/phase-NN-summary.md`
2. **Review gate at phase boundary**: Instead of auto-advancing, present the summary and a Continue/Review/Redo menu
3. **Resume after review**: Framework picks up from where it paused, consuming any user-edited files

### 1.3 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Phase review capability | Users can pause between any two phases | Manual verification |
| Artifact edit consumption | User-edited artifacts consumed correctly by next phase | Integration test |
| Backward compatibility | supervised_mode.enabled=false behaves identically to current | Regression test suite |
| Configuration granularity | Users can select specific phases for review | Config validation test |

### 1.4 Scope

**In Scope:**
- `supervised_mode` configuration block in state.json
- Phase summary generation (`.isdlc/reviews/phase-NN-summary.md`)
- Continue/Review/Redo menu at phase boundaries
- Resume-after-review (consuming user-edited artifacts)
- Gate-blocker modification for supervised mode checks
- Phase-loop-controller (isdlc.md) modification for review gate insertion
- Redo with additional user guidance

**Out of Scope:**
- New agents or phases
- UI/dashboard for review (CLI-only)
- Parallel/concurrent phase execution
- Auto-advance timeout (deferred -- config key reserved but not implemented in v1)
- Remote/collaborative review (multi-user)

---

## 2. Stakeholders and Personas

### 2.1 Persona: Solo Developer (Primary)

| Attribute | Description |
|-----------|-------------|
| Role | Individual developer using iSDLC on their own project |
| Goals | Validate agent decisions at critical phases, maintain creative control, catch mistakes before propagation |
| Pain Points | End-of-workflow review too late; framework feels opaque between phases; redo requires full restart |
| Technical Proficiency | High -- comfortable editing markdown, reading diffs, providing architectural guidance |
| Key Tasks | Enable supervised mode, review summaries, edit artifacts, provide redo guidance |

### 2.2 Persona: Domain Expert on Existing Project (Secondary)

| Attribute | Description |
|-----------|-------------|
| Role | Developer onboarding iSDLC onto an established codebase they know intimately |
| Goals | Ensure agent's codebase understanding matches reality, correct architecture/design assumptions early |
| Pain Points | Agent assumptions about unfamiliar codebases; wrong architecture propagates through all phases |
| Technical Proficiency | High in their domain; moderate iSDLC knowledge |
| Key Tasks | Review architecture/design outputs, selectively enable review on phases 02-04 |

---

## 3. Functional Requirements

### REQ-013-FR-01: Supervised Mode Configuration

The framework MUST support a `supervised_mode` configuration block in `.isdlc/state.json` with the following structure:

```json
{
  "supervised_mode": {
    "enabled": false,
    "review_phases": "all",
    "parallel_summary": true,
    "auto_advance_timeout": null
  }
}
```

**Acceptance Criteria:**

| ID | Given | When | Then |
|----|-------|------|------|
| AC-01a | `supervised_mode` block exists in state.json | `enabled` is `true` | Review gates activate for phases specified in `review_phases` |
| AC-01b | `supervised_mode` block exists in state.json | `enabled` is `false` | Framework behaves identically to current autonomous mode (no review gates) |
| AC-01c | `supervised_mode` block is missing from state.json | A workflow runs | Framework behaves identically to current autonomous mode (fail-open, no review gates) |
| AC-01d | `review_phases` is set to `"all"` | `enabled` is `true` | Review gates activate after every phase |
| AC-01e | `review_phases` is set to an array (e.g., `["03", "04", "06"]`) | `enabled` is `true` | Review gates activate only after the specified phase numbers |
| AC-01f | `review_phases` contains an invalid phase number | Config is read | Invalid entries are silently ignored; valid entries still activate |
| AC-01g | `parallel_summary` is `true` | A reviewed phase completes | Phase summary is generated |
| AC-01h | `parallel_summary` is `false` | A reviewed phase completes | Review gate still fires but with a minimal summary (phase name + status only, no diff) |

**Priority:** Must Have

---

### REQ-013-FR-02: Phase Summary Generation

After a phase completes and before the review gate menu is presented, the framework MUST generate a structured phase summary written to `.isdlc/reviews/phase-{NN}-summary.md`.

**Summary Contents:**
- Phase name and completion status
- Duration (from `phases[key].started` to `phases[key].completed`)
- List of artifacts created/modified (from `phases[key].artifacts`)
- Key decisions made (extracted from phase agent output, max 5 bullet points)
- File diffs: list of files changed since the previous phase boundary (via `git diff --name-status` against the commit at phase start)
- Links to all created/changed files (relative paths)

**Acceptance Criteria:**

| ID | Given | When | Then |
|----|-------|------|------|
| AC-02a | A phase completes with `supervised_mode.enabled=true` and the phase is in `review_phases` | Summary generation runs | `.isdlc/reviews/phase-{NN}-summary.md` is created with all required sections |
| AC-02b | A phase produces no file changes (documentation-only or skipped) | Summary generation runs | Summary is created with "No file changes" noted; artifact list still populated from phase state |
| AC-02c | The `.isdlc/reviews/` directory does not exist | Summary generation runs | Directory is created automatically |
| AC-02d | A previous summary exists for the same phase (e.g., after redo) | Summary generation runs | Previous summary is overwritten with the new one |
| AC-02e | `parallel_summary` is `false` | Summary generation runs | A minimal summary is created (phase name, status, artifact list only -- no diffs, no decision extraction) |

**Priority:** Must Have

---

### REQ-013-FR-03: Review Gate Menu

After phase summary generation, the phase-loop controller MUST present a review gate menu and STOP execution until the user responds.

**Menu Format:**
```
--------------------------------------------
PHASE {NN} COMPLETE: {Phase Name}

Summary: .isdlc/reviews/phase-{NN}-summary.md
Artifacts: {count} files created/modified
Duration: {minutes}m

[C] Continue -- advance to next phase
[R] Review -- pause for manual review/edits, resume when ready
[D] Redo -- re-run this phase with additional guidance

Your choice: _
--------------------------------------------
```

**Acceptance Criteria:**

| ID | Given | When | Then |
|----|-------|------|------|
| AC-03a | `supervised_mode.enabled=true` and phase is in `review_phases` | Phase completes and summary is generated | The Continue/Review/Redo menu is presented |
| AC-03b | User selects `[C]` Continue | Menu is presented | Next phase begins immediately (normal flow) |
| AC-03c | User selects `[R]` Review | Menu is presented | Framework pauses and displays instructions for resuming (see REQ-013-FR-04) |
| AC-03d | User selects `[D]` Redo | Menu is presented | Framework prompts for additional guidance and re-runs the phase (see REQ-013-FR-05) |
| AC-03e | `supervised_mode.enabled=true` but phase is NOT in `review_phases` | Phase completes | No review gate; auto-advance to next phase (current behavior) |
| AC-03f | `supervised_mode.enabled=false` or missing | Phase completes | No review gate; auto-advance to next phase (current behavior) |
| AC-03g | The completed phase is the final phase in the workflow | Phase completes | Review gate fires before proceeding to finalize/merge (if phase is in review_phases) |

**Priority:** Must Have

---

### REQ-013-FR-04: Review Pause and Resume

When the user selects `[R]` Review, the framework MUST pause execution and allow the user to review and edit artifacts, then resume when the user indicates readiness.

**Pause Behavior:**
1. Display the phase summary content inline (or reference the summary file path)
2. Display instructions: "Review the artifacts listed above. Edit any files as needed. When ready, say 'continue' to advance to the next phase."
3. Record review state in `active_workflow`: `supervised_review: { phase: "{NN}", status: "reviewing", paused_at: "{timestamp}" }`
4. STOP and wait for user input

**Resume Behavior:**
1. User says "continue" (or any confirmation phrase)
2. Clear `supervised_review` from `active_workflow` (or set status to "completed")
3. Record `supervised_review.resumed_at` timestamp
4. Advance to next phase -- the next phase agent reads artifacts from disk (which may have been edited by the user)

**Acceptance Criteria:**

| ID | Given | When | Then |
|----|-------|------|------|
| AC-04a | User selects `[R]` Review | Framework pauses | Summary content is displayed and instructions are shown |
| AC-04b | User selects `[R]` Review | Framework pauses | `active_workflow.supervised_review` is written to state.json with `status: "reviewing"` |
| AC-04c | Framework is paused for review | User says "continue" | Framework advances to the next phase |
| AC-04d | Framework is paused for review | User edits an artifact file on disk | Next phase reads the edited file (no special handling needed -- phases read from disk) |
| AC-04e | Framework is paused for review | User says "continue" | `supervised_review` is updated with `status: "completed"` and `resumed_at` timestamp |

**Priority:** Must Have

---

### REQ-013-FR-05: Redo Phase with Additional Guidance

When the user selects `[D]` Redo, the framework MUST prompt for additional guidance and re-run the completed phase.

**Redo Behavior:**
1. Prompt: "What additional guidance should this phase consider? (Describe what to change or focus on)"
2. User provides guidance text
3. Re-delegate to the same phase agent with the original prompt PLUS the additional guidance appended as a `REDO GUIDANCE: {user text}` block
4. After re-run completes, generate a new summary (overwriting the previous one)
5. Present the Continue/Review/Redo menu again (the user may redo multiple times)

**Redo Constraints:**
- Maximum 3 redo attempts per phase (circuit breaker). After 3 redos, only Continue and Review options are available.
- Phase state is reset to `in_progress` during redo, then back to `completed` after.
- The redo counter is tracked in `active_workflow.supervised_review.redo_count`.

**Acceptance Criteria:**

| ID | Given | When | Then |
|----|-------|------|------|
| AC-05a | User selects `[D]` Redo | Framework prompts for guidance | User is asked for additional guidance text |
| AC-05b | User provides redo guidance | Phase is re-delegated | Phase agent receives original prompt + `REDO GUIDANCE: {text}` |
| AC-05c | Phase re-run completes | Summary is regenerated | New summary overwrites previous; Continue/Review/Redo menu is presented again |
| AC-05d | User has already done 3 redos for this phase | Continue/Review/Redo menu is presented | Redo option `[D]` is removed from the menu; only Continue and Review remain |
| AC-05e | Phase is re-run via redo | Phase state is managed | Phase status transitions: completed -> in_progress (redo start) -> completed (redo finish) |
| AC-05f | Phase is re-run via redo | Post-redo state update | `redo_count` is incremented in `active_workflow.supervised_review` |

**Priority:** Must Have

---

### REQ-013-FR-06: Gate-Blocker Integration

The existing gate-blocker hook MUST be updated to recognize supervised mode review gates. When supervised mode is enabled and a review phase boundary is reached, the gate-blocker MUST NOT auto-advance past the review gate.

**Acceptance Criteria:**

| ID | Given | When | Then |
|----|-------|------|------|
| AC-06a | `supervised_mode.enabled=true` and phase is in `review_phases` | Gate-blocker evaluates phase transition | Gate-blocker allows the phase to complete but does not auto-advance (defers to review gate) |
| AC-06b | `supervised_mode.enabled=false` | Gate-blocker evaluates phase transition | Gate-blocker behaves identically to current (auto-advance) |
| AC-06c | `supervised_mode` config is corrupt or malformed | Gate-blocker reads config | Gate-blocker falls back to autonomous mode (fail-open per Article X) |

**Priority:** Must Have

---

### REQ-013-FR-07: Phase-Loop Controller Integration

The phase-loop controller in `isdlc.md` MUST be modified to insert the review gate between STEP 3e (post-phase state update) and the next iteration's STEP 3c-prime (next phase activation).

**New Step:** STEP 3e-review (inserted after STEP 3e, before loop continues)

```
3e-review. SUPERVISED REVIEW GATE (conditional)
1. Read supervised_mode config from state.json
2. If enabled=false or missing: skip to next iteration
3. If review_phases="all" OR completed phase number is in review_phases array:
   a. Generate phase summary (.isdlc/reviews/phase-NN-summary.md)
   b. Present Continue/Review/Redo menu
   c. STOP and wait for user response
   d. On [C]: continue to next iteration
   e. On [R]: pause, wait for "continue", then advance
   f. On [D]: prompt for guidance, re-run phase, regenerate summary, re-present menu
4. Otherwise: skip to next iteration
```

**Acceptance Criteria:**

| ID | Given | When | Then |
|----|-------|------|------|
| AC-07a | Phase-loop controller completes STEP 3e | `supervised_mode.enabled=true` | STEP 3e-review executes before the next phase starts |
| AC-07b | Phase-loop controller completes STEP 3e | `supervised_mode.enabled=false` | STEP 3e-review is skipped; next iteration begins immediately |
| AC-07c | STEP 3e-review is executing | Phase is NOT in `review_phases` | Review gate is skipped for this phase; next iteration begins |
| AC-07d | STEP 3e-review is executing | This is the final phase | Review gate fires, then proceeds to finalize (not another phase iteration) |

**Priority:** Must Have

---

### REQ-013-FR-08: Review History in Workflow State

All review gate interactions MUST be recorded in the workflow state for auditability and debugging.

**State Structure:**
```json
{
  "active_workflow": {
    "review_history": [
      {
        "phase": "03-architecture",
        "action": "continue",
        "timestamp": "2026-02-14T10:30:00Z"
      },
      {
        "phase": "04-design",
        "action": "review",
        "paused_at": "2026-02-14T10:45:00Z",
        "resumed_at": "2026-02-14T11:00:00Z"
      },
      {
        "phase": "06-implementation",
        "action": "redo",
        "redo_count": 1,
        "guidance": "Focus on error handling in the hook integration",
        "timestamp": "2026-02-14T11:30:00Z"
      }
    ]
  }
}
```

**Acceptance Criteria:**

| ID | Given | When | Then |
|----|-------|------|------|
| AC-08a | User selects any review gate option | Action is taken | An entry is appended to `active_workflow.review_history` |
| AC-08b | Workflow completes | Review history exists | `review_history` is preserved in `workflow_history` entry |
| AC-08c | `supervised_mode.enabled=false` | Workflow completes | No `review_history` field exists (or is an empty array) |

**Priority:** Should Have

---

## 4. Non-Functional Requirements

### NFR-013-01: Backward Compatibility

| Attribute | Value |
|-----------|-------|
| Category | Compatibility |
| Requirement | When `supervised_mode.enabled` is `false` or the `supervised_mode` block is absent, the framework MUST behave identically to the current autonomous mode. No review gates, no summary generation, no menu pauses. |
| Metric | 100% of existing test suite passes without modification when supervised mode is disabled |
| Measurement | Run full test suite (CJS + ESM) with no `supervised_mode` config |
| Priority | Must Have |

### NFR-013-02: Fail-Open on Configuration Errors

| Attribute | Value |
|-----------|-------|
| Category | Reliability |
| Requirement | If `supervised_mode` config is malformed, corrupt, or contains invalid values, the framework MUST fall back to autonomous mode (no review gates). No errors should be thrown. |
| Metric | Framework never crashes or blocks due to supervised_mode config issues |
| Measurement | Fuzz testing with invalid config values |
| Priority | Must Have |

### NFR-013-03: Summary Generation Performance

| Attribute | Value |
|-----------|-------|
| Category | Performance |
| Requirement | Phase summary generation MUST complete within 10 seconds for phases that produce up to 50 file changes |
| Metric | Summary generation time < 10s for typical phases |
| Measurement | Timing instrumentation during integration tests |
| Priority | Should Have |

### NFR-013-04: State Integrity During Review Pause

| Attribute | Value |
|-----------|-------|
| Category | Reliability |
| Requirement | During a review pause, the framework state (state.json) MUST remain consistent. If the user's Claude Code session ends during a review pause, the next session MUST be able to detect the paused state and either resume or cancel gracefully. |
| Metric | State.json always reflects current review status; no orphaned review states |
| Measurement | Test: kill session during review, restart, verify state recovery |
| Priority | Must Have |

### NFR-013-05: Redo Circuit Breaker

| Attribute | Value |
|-----------|-------|
| Category | Reliability |
| Requirement | No more than 3 redo attempts per phase per workflow run. After 3 redos, the Redo option MUST be removed from the menu. |
| Metric | Redo count never exceeds 3 per phase |
| Measurement | Unit test with redo counter validation |
| Priority | Must Have |

### NFR-013-06: No New Dependencies

| Attribute | Value |
|-----------|-------|
| Category | Maintainability |
| Requirement | This feature MUST NOT introduce any new npm dependencies or new agent/skill definitions. It modifies existing infrastructure only. |
| Metric | `package.json` dependencies unchanged; no new files in `agents/` or `skills/` |
| Measurement | Diff comparison |
| Priority | Must Have |

---

## 5. Constraints

| ID | Constraint | Rationale |
|----|-----------|-----------|
| CON-013-01 | Must modify existing gate-blocker.cjs, not create a new hook | Minimize hook count; gate-blocker already handles phase transitions |
| CON-013-02 | Must modify existing phase-loop-controller (isdlc.md STEP 3), not create a new command | The review gate is a phase boundary behavior, not a separate workflow step |
| CON-013-03 | Summary files go to `.isdlc/reviews/`, not `docs/` | Review summaries are ephemeral runtime artifacts, not permanent documentation |
| CON-013-04 | Configuration follows the `code_review.enabled` pattern in state.json | Consistency with existing config-driven behavior patterns |
| CON-013-05 | `auto_advance_timeout` is reserved in config schema but NOT implemented in v1 | Keep initial scope manageable; timeout adds complexity around session management |
| CON-013-06 | Hook files remain CommonJS (.cjs); command/agent files remain Markdown | Per Article XIII: Module System Consistency |

---

## 6. Assumptions

| ID | Assumption | Impact if Wrong |
|----|-----------|-----------------|
| ASM-013-01 | Phase agents always read artifacts from disk at start (not cached from previous agent output) | If agents cache, user edits during review pause would be ignored -- would need explicit cache-bust mechanism |
| ASM-013-02 | The phase-loop controller (isdlc.md) can present interactive menus and wait for user input | If the controller cannot pause execution, the review gate pattern breaks -- would need a hook-based approach instead |
| ASM-013-03 | `git diff` is available during summary generation for file change detection | If git is unavailable, summary will lack diff information -- should degrade gracefully |
| ASM-013-04 | Single-user sessions only; no concurrent sessions editing the same project | If concurrent sessions exist, review state in state.json could conflict |

---

## 7. Glossary

| Term | Definition |
|------|-----------|
| Review Gate | A pause point between phases where the user can review, edit, or redo phase output |
| Phase Summary | A structured markdown document generated after phase completion, containing diffs, artifacts, and decisions |
| Supervised Mode | The configuration-driven feature that enables review gates at phase boundaries |
| Redo | Re-running a completed phase with additional user-provided guidance |
| Review Pause | The state where framework execution is halted waiting for user review completion |
| Phase Boundary | The point between one phase completing and the next phase starting |
| Circuit Breaker | A safety mechanism that limits redo attempts to prevent infinite loops |

---

## 8. Traceability Summary

| Requirement | User Stories | Priority | Persona |
|-------------|-------------|----------|---------|
| REQ-013-FR-01 | US-001, US-002 | Must Have | Solo Developer, Domain Expert |
| REQ-013-FR-02 | US-003 | Must Have | Solo Developer, Domain Expert |
| REQ-013-FR-03 | US-004, US-005 | Must Have | Solo Developer |
| REQ-013-FR-04 | US-006 | Must Have | Solo Developer, Domain Expert |
| REQ-013-FR-05 | US-007 | Must Have | Solo Developer |
| REQ-013-FR-06 | US-008 | Must Have | Solo Developer |
| REQ-013-FR-07 | US-008 | Must Have | Solo Developer |
| REQ-013-FR-08 | US-009 | Should Have | Solo Developer |
| NFR-013-01 | US-001 | Must Have | All |
| NFR-013-02 | US-001 | Must Have | All |
| NFR-013-03 | US-003 | Should Have | All |
| NFR-013-04 | US-006 | Must Have | All |
| NFR-013-05 | US-007 | Must Have | All |
| NFR-013-06 | -- | Must Have | All |

---

## 9. Prioritization (MoSCoW)

### Must Have (MVP)
- REQ-013-FR-01: Configuration block
- REQ-013-FR-02: Phase summary generation
- REQ-013-FR-03: Continue/Review/Redo menu
- REQ-013-FR-04: Review pause and resume
- REQ-013-FR-05: Redo with guidance
- REQ-013-FR-06: Gate-blocker integration
- REQ-013-FR-07: Phase-loop controller integration
- NFR-013-01: Backward compatibility
- NFR-013-02: Fail-open on config errors
- NFR-013-04: State integrity during pause
- NFR-013-05: Redo circuit breaker
- NFR-013-06: No new dependencies

### Should Have
- REQ-013-FR-08: Review history in workflow state
- NFR-013-03: Summary generation performance

### Won't Have (This Release)
- `auto_advance_timeout` implementation (config key reserved)
- Remote/collaborative review
- UI/dashboard for review
- Parallel/concurrent phase execution
