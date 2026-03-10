# REQ-0059: Workflow Interruption — Suspend/Resume for Framework Bugs

## 1. Business Context

When a hook or framework component has a bug that blocks an active workflow, the developer is currently forced to either cancel the workflow (losing context) or fix the framework code inline without process (losing traceability and gate enforcement). This violates Article VII (Artifact Traceability) and Article IX (Quality Gate Integrity).

**Success metric**: Framework bugs discovered mid-workflow are fixed through a proper fix workflow with full traceability, and the original workflow resumes automatically with no manual intervention.

**Stakeholders**:
- Developer using iSDLC whose workflow is blocked by a broken hook
- Framework maintainer who needs to fix the harness issue

## 2. Stakeholders and Personas

| User Type | Role | Pain Point |
|-----------|------|------------|
| Developer | Running a feature/fix/upgrade workflow | Workflow blocked by framework bug; forced to choose between losing context or losing traceability |
| AI Agent (Claude) | Executing phase work | Auto-recovery fails on broken hooks; no clean mechanism to fix framework code through proper process |

## 3. User Journeys

**Entry**: Developer is mid-workflow. A hook blocks an operation. The AI attempts auto-recovery per the Hook Block Auto-Recovery Protocol. Recovery fails — same hook re-blocks.

**Flow**:
1. Framework detects auto-recovery failure (harness bug signal)
2. Framework informs user: "This is a framework issue, not your code"
3. User consents to fixing the framework issue
4. Current workflow is suspended (state preserved, phase iteration reset planned for resume)
5. Fix workflow starts with its own branch and artifact folder
6. Fix workflow completes (phases, gates, traceability)
7. Original workflow is restored automatically
8. Current phase restarts cleanly (iteration state reset, artifacts preserved)

**Exit**: Developer is back in their original workflow, at the same phase, with the framework bug fixed.

**Error path**: If a second harness bug is hit during the fix workflow, escalate to user rather than nesting suspensions.

## 4. Technical Context

**Constraints**:
- `single_active_workflow_per_project` rule enforced in `workflow-init.cjs`
- `state.json` has a single `active_workflow` field; all hooks read from it
- `workflow-finalize.cjs` clears `active_workflow` and archives to `workflow_history`
- `workflow-retry.cjs` already implements phase iteration reset logic

**Conventions**:
- Fix branches use `bugfix/BUG-NNNN-*` prefix, feature branches use `feature/REQ-NNNN-*` — no git conflict
- Hooks only read `active_workflow` for current phase/type — adding `suspended_workflow` won't affect them
- All state writes must be atomic (Article XIV)

## 5. Quality Attributes and Risks

| Attribute | Priority | Threshold |
|-----------|----------|-----------|
| Reliability | Critical | Suspended workflow MUST be restored exactly as it was (phase, phase_status, flags, slug) |
| Simplicity | High | No nested suspensions; depth limit of 1 |
| Fail-safety | High | If fix workflow crashes or is cancelled, suspended workflow is still restorable |

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| AI loses context after fix workflow fills conversation | High | Medium | Phase reset on resume (FR-008) — restart phase cleanly, artifacts preserved |
| False detection — hook is correct, AI auto-recovery was wrong | Medium | Low | User consent required before suspension; user can decline |
| Git merge conflict between fix branch and suspended workflow branch | Low | Medium | Different branch prefixes; framework files rarely conflict with feature code |
| `suspended_workflow` corruption in state.json | Low | High | validate-state.cjs validates `suspended_workflow` schema (FR-006) |

## 6. Functional Requirements

### FR-001: Harness Bug Detection
**Confidence**: High

When the Hook Block Auto-Recovery Protocol fails (same hook re-blocks after the AI retries with the suggested approach), the framework MUST identify this as a harness/framework issue.

- **AC-001-01**: Given a hook blocks an operation and the AI retries with the recovery approach, when the same hook blocks the retry, then the framework identifies this as a harness bug
- **AC-001-02**: Given a hook blocks and the AI successfully recovers on retry, then no harness bug is identified (normal operation)

### FR-002: Workflow Suspension
**Confidence**: High

When the user consents to fixing a framework issue, the framework MUST suspend the active workflow by moving `active_workflow` to `suspended_workflow` in state.json.

- **AC-002-01**: Given an active workflow at phase N, when suspension occurs, then `active_workflow` is moved to `suspended_workflow` with all fields preserved (phases, phase_status, flags, slug, artifact_folder, current_phase, current_phase_index)
- **AC-002-02**: Given no active workflow, when suspension is attempted, then it fails with an error

### FR-003: Fix Workflow for Framework Bug
**Confidence**: High

After suspension, the framework MUST start a proper `fix` workflow for the harness bug with its own branch, artifact folder, and gates.

- **AC-003-01**: Given a suspended workflow, when the fix workflow is initialized, then it creates a `bugfix/BUG-NNNN-*` branch and artifact folder
- **AC-003-02**: The fix workflow follows the standard fix phases: `01-requirements → 02-tracing → 05-test-strategy → 06-implementation → 16-quality-loop → 08-code-review`

### FR-004: Automatic Resumption
**Confidence**: High

When a fix workflow that has a `suspended_workflow` completes (finalize), the framework MUST restore the suspended workflow.

- **AC-004-01**: Given a `suspended_workflow` exists, when `workflow-finalize.cjs` completes the fix workflow, then `suspended_workflow` is restored to `active_workflow`
- **AC-004-02**: Given no `suspended_workflow`, when finalization occurs, then behavior is unchanged
- **AC-004-03**: The restored workflow has all original fields intact (phases, phase_status, flags, slug, artifact_folder)

### FR-005: Suspension Depth Limit
**Confidence**: High

The framework MUST enforce a maximum suspension depth of 1.

- **AC-005-01**: Given a `suspended_workflow` already exists, when another suspension is attempted, then it is BLOCKED with an error naming both workflows
- **AC-005-02**: The error message includes the active workflow description and the suspended workflow description

### FR-006: Cancel Handling
**Confidence**: High

If the fix workflow is cancelled instead of finalized, the suspended workflow MUST be restored.

- **AC-006-01**: Given a `suspended_workflow`, when the active fix workflow is cancelled, then `suspended_workflow` is restored to `active_workflow`

### FR-007: User Messaging
**Confidence**: High

All suspension/resumption events MUST include clear messaging that distinguishes framework issues from user code issues.

- **AC-007-01**: The suspension message MUST include: the words "framework issue" or "harness issue", the hook name that is broken, the current workflow description, and the current phase
- **AC-007-02**: The resumption message MUST include: the restored workflow description and the phase it resumes at
- **AC-007-03**: The suspension message MUST explicitly state this is NOT the user's code

### FR-008: Phase Reset on Resume
**Confidence**: High

When a suspended workflow is restored, the framework MUST reset the current phase's iteration state so the phase restarts cleanly. Artifacts from before suspension MUST be preserved.

- **AC-008-01**: Given a suspended workflow restored at phase N, when resume occurs, then `test_iteration`, `constitutional_validation`, and `interactive_elicitation` counters for phase N are reset to their initial state
- **AC-008-02**: Artifacts on disk from before suspension remain and are available to the resumed phase

## 7. Out of Scope

| Item | Reason |
|------|--------|
| Automatic detection without auto-recovery failure | Too risky for false positives |
| Nested suspension beyond depth 1 | Escalate instead — keeps implementation simple |
| Non-fix workflows interrupting | Feature can't interrupt feature; only fix workflows can |
| Parallel workflow support (#30) | Separate architectural initiative |
| Context snapshot before suspension | Phase reset is simpler and more reliable |

## 8. MoSCoW Prioritization

| FR | Title | Priority | Rationale |
|----|-------|----------|-----------|
| FR-001 | Harness bug detection | Must Have | Core trigger mechanism |
| FR-002 | Workflow suspension | Must Have | Core state management |
| FR-003 | Fix workflow for framework bug | Must Have | Process integrity |
| FR-004 | Automatic resumption | Must Have | Seamless developer experience |
| FR-005 | Suspension depth limit | Must Have | Safety guardrail |
| FR-006 | Cancel handling | Should Have | Edge case but important for robustness |
| FR-007 | User messaging | Must Have | User must understand what's happening |
| FR-008 | Phase reset on resume | Must Have | Handles context loss reliably |

## Assumptions

1. Auto-recovery failure (same hook re-blocks after retry) is a reliable signal for harness bugs. Risk: AI could retry incorrectly, causing false diagnosis. Mitigated by user consent.
2. The AI can track which hook blocked and whether recovery was attempted. Currently hook blocks are text messages — may need structured tracking.
3. One suspension level is sufficient. If a second harness bug hits during the fix, we escalate.
4. The AI is capable of diagnosing and fixing hook bugs through the fix workflow phases.
5. Fix branch (`bugfix/*`) won't conflict with suspended workflow branch (`feature/*`).
6. Hook block messages are deterministic — same broken hook produces same block on retry.

## Pending Sections

None — all sections complete.
