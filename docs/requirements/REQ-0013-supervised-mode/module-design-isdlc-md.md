# Module Design: isdlc.md STEP 3e-review (Phase-Loop Controller)

**Version**: 1.0.0
**Phase**: 04-design
**Traces to**: FR-03 (AC-03a through AC-03g), FR-04 (AC-04a through AC-04e), FR-05 (AC-05a through AC-05f), FR-07 (AC-07a through AC-07d), NFR-013-04, NFR-013-05
**ADRs**: ADR-0001, ADR-0004, ADR-0005

---

## 1. Module Overview

**File**: `src/claude/commands/isdlc.md`
**Change Type**: MODIFY (additive insertion)
**Estimated Lines Added**: ~100 (STEP 3e-review block + SCENARIO 4 enhancement)

The phase-loop controller receives a new conditional step (STEP 3e-review) inserted between the existing STEP 3e (post-phase state update) and STEP 3e-sizing (sizing decision point). Additionally, SCENARIO 4 (workflow in progress) receives a small enhancement for supervised review session recovery.

This is a markdown-based agent instruction file (not executable code). The "design" here specifies the exact prose instructions and control flow that the phase-loop controller agent must follow.

---

## 2. Insertion Point

### 2.1 Current Flow (unchanged steps)

```
3d.   DIRECT PHASE DELEGATION
3e.   POST-PHASE STATE UPDATE
3e-sizing.  SIZING DECISION POINT (conditional, Phase 02 only)
3e-refine.  TASK REFINEMENT (conditional, Phase 04 only)
3f.   Check result status
```

### 2.2 New Flow

```
3d.   DIRECT PHASE DELEGATION
3e.   POST-PHASE STATE UPDATE
3e-review.  SUPERVISED REVIEW GATE (conditional)        <-- NEW
3e-sizing.  SIZING DECISION POINT (conditional)
3e-refine.  TASK REFINEMENT (conditional)
3f.   Check result status
```

### 2.3 Exact Insertion Location

The new block is inserted AFTER the STEP 3e section (ending at the tasks.md update) and BEFORE the `**3e-sizing.**` heading. The section begins with:

```markdown
**3e-review.** SUPERVISED REVIEW GATE (conditional) -- After the post-phase
state update, check if a supervised review gate should fire.
```

---

## 3. STEP 3e-review Specification

### 3.1 Full Step Text (to be inserted into isdlc.md)

```markdown
**3e-review.** SUPERVISED REVIEW GATE (conditional) -- After the post-phase
state update, check if a supervised review gate should fire.

**Gate trigger check**:
1. Read `supervised_mode` from state.json (already loaded in 3e)
2. Call `readSupervisedModeConfig(state)` (from common.cjs via inline logic)
   - If `config.enabled` is `false`: skip to 3e-sizing (no review gate)
3. Call `shouldReviewPhase(config, phase_key)`
   - If `false`: skip to 3e-sizing (this phase not in review_phases)
4. Call `generatePhaseSummary(state, phase_key, projectRoot, { minimal: !config.parallel_summary })`
   - Store the returned `summaryPath`
   - If `null` (generation failed): log warning, skip to 3e-sizing (fail-open)
5. Initialize `supervised_review` in state (if not already set for this phase):
   ```json
   {
     "phase": "{phase_key}",
     "status": "gate_presented",
     "paused_at": null,
     "resumed_at": null,
     "redo_count": 0,
     "redo_guidance_history": []
   }
   ```
   Write to `active_workflow.supervised_review` in state.json.

**REVIEW_LOOP**:
6. Determine menu options:
   a. Read `supervised_review.redo_count` from state
   b. If `redo_count >= 3`:
      - options = `[C] Continue`, `[R] Review`
   c. Else:
      - options = `[C] Continue`, `[R] Review`, `[D] Redo`

7. Present review gate banner and wait for user response:
   ```
   --------------------------------------------
   PHASE {NN} COMPLETE: {Phase Name}

   Summary: {summaryPath}
   Artifacts: {artifact_count} files created/modified
   Duration: {duration}

   [C] Continue -- advance to next phase
   [R] Review -- pause for manual review/edits, resume when ready
   [D] Redo -- re-run this phase with additional guidance

   Your choice: _
   --------------------------------------------
   ```

   Use `AskUserQuestion` to collect the user's response.

8. Handle user response:

   **CASE [C] Continue**:
   a. Call `recordReviewAction(state, phase_key, 'continue', { timestamp: now })`
   b. Delete `active_workflow.supervised_review` from state
   c. Write state.json
   d. PROCEED to 3e-sizing

   **CASE [R] Review**:
   a. Display the summary content inline (read the summary file and display it)
   b. Display instructions:
      "Review the artifacts listed above. Edit any files as needed.
       When ready, say 'continue' to advance to the next phase."
   c. Set `active_workflow.supervised_review.status` = `"reviewing"`
   d. Set `active_workflow.supervised_review.paused_at` = current timestamp
   e. Write state.json
   f. WAIT for user input (use `AskUserQuestion` with freeform text prompt)
   g. On user response (any confirmation like "continue", "done", "yes", "ok"):
      i.   Set `supervised_review.status` = `"completed"`
      ii.  Set `supervised_review.resumed_at` = current timestamp
      iii. Call `recordReviewAction(state, phase_key, 'review',
            { paused_at: supervised_review.paused_at, resumed_at: supervised_review.resumed_at })`
      iv.  Delete `active_workflow.supervised_review` from state
      v.   Write state.json
      vi.  PROCEED to 3e-sizing

   **CASE [D] Redo**:
   a. Prompt: "What additional guidance should this phase consider?"
   b. Capture guidance text from user (use `AskUserQuestion`)
   c. Read current `supervised_review.redo_count` from state
   d. Increment `supervised_review.redo_count` by 1
   e. Append guidance to `supervised_review.redo_guidance_history`
   f. Set `supervised_review.status` = `"redo_pending"`
   g. Write state.json
   h. Reset phase state for re-delegation:
      i.  Set `phases[phase_key].status` = `"in_progress"`
      ii. Set `active_workflow.phase_status[phase_key]` = `"in_progress"`
      iii. Write state.json
   i. Re-delegate to the same phase agent (same pattern as STEP 3d):
      - Use the PHASE-AGENT table from STEP 3d
      - Append to the original delegation prompt:
        `"\nREDO GUIDANCE: {guidance text}"`
   j. On return, re-execute STEP 3e logic:
      - Set `phases[phase_key].status` = `"completed"`
      - Set `phases[phase_key].summary` = (extract from agent result)
      - Set `active_workflow.phase_status[phase_key]` = `"completed"`
      - Write state.json
   k. Call `recordReviewAction(state, phase_key, 'redo',
        { redo_count: supervised_review.redo_count, guidance: guidance_text, timestamp: now })`
   l. Re-generate summary:
      - Call `generatePhaseSummary(state, phase_key, projectRoot, { minimal: !config.parallel_summary })`
      - Update summaryPath
   m. GOTO REVIEW_LOOP (step 6)
```

---

## 4. SCENARIO 4 Enhancement (Session Recovery)

### 4.1 Current SCENARIO 4

SCENARIO 4 detects "Constitution IS configured + Workflow IN PROGRESS" and presents Continue/GateCheck/Status/Escalate/Cancel options.

### 4.2 Enhancement

After the existing SCENARIO 4 detection but before presenting the standard menu, add a supervised review recovery check:

```markdown
**Supervised review recovery check** (before presenting SCENARIO 4 menu):

1. Read `active_workflow.supervised_review` from state.json
2. If `supervised_review` exists AND `supervised_review.status` is `"reviewing"` or `"gate_presented"`:
   a. Display recovery banner:
      ```
      A review was in progress for Phase {NN} ({Phase Name}).
      Summary: .isdlc/reviews/phase-{NN}-summary.md

      [C] Continue to next phase
      [R] Show summary and review again
      ```
   b. Handle user response:
      - **[C] Continue**: Clear `supervised_review`, advance to next phase (proceed with standard SCENARIO 4 [1] Continue)
      - **[R] Review**: Display summary file content, then present "When ready, say 'continue'" and wait
3. If `supervised_review` exists AND `supervised_review.status` is `"redo_pending"`:
   a. Display: "A redo was in progress for Phase {NN}. The phase will be re-run."
   b. Proceed as if user selected [1] Continue (the phase-loop will re-run from the current phase)
4. If `supervised_review` does not exist: proceed to standard SCENARIO 4 menu (no change)
```

### 4.3 Traces

| Scenario | Requirement | AC |
|----------|------------|-----|
| Review in progress at session end | NFR-013-04 | AC-04b, AC-04e |
| Redo pending at session end | NFR-013-04 | AC-05e, AC-05f |

---

## 5. State Transitions

### 5.1 supervised_review Lifecycle

```
                    +--> gate_presented
                    |        |
                    |        v
                    |   [C] Continue -----> (deleted from state)
                    |        |
                    |   [R] Review -------> reviewing
                    |                         |
                    |                     "continue"
                    |                         |
                    |                         v
                    |                     completed --> (deleted from state)
                    |
                    |   [D] Redo ---------> redo_pending
                    |                         |
                    |                     (re-delegation)
                    |                         |
                    |                         v
                    +--- (re-enter loop) <-- gate_presented
```

### 5.2 Phase State During Redo

```
phases[key].status:  completed -> in_progress -> completed
phase_status[key]:   completed -> in_progress -> completed
```

### 5.3 Circuit Breaker

| Condition | Menu Options | Traces |
|-----------|-------------|--------|
| `redo_count < 3` | [C] Continue, [R] Review, [D] Redo | AC-05d |
| `redo_count >= 3` | [C] Continue, [R] Review | AC-05d |
| `redo_count > 3` (corrupt) | [C] Continue, [R] Review (same as >= 3) | NFR-013-05 |

---

## 6. Menu Format Details

### 6.1 Review Gate Banner

The banner is displayed after each phase completion when supervised mode is active for that phase. It uses a simple text box format consistent with existing isdlc.md banners (sizing, blocker, refinement).

```
--------------------------------------------
PHASE {NN} COMPLETE: {Phase Name}

Summary: .isdlc/reviews/phase-{NN}-summary.md
Artifacts: {N} files created/modified
Duration: {M}m

[C] Continue -- advance to next phase
[R] Review -- pause for manual review/edits, resume when ready
[D] Redo -- re-run this phase with additional guidance

Your choice: _
--------------------------------------------
```

**Field resolution**:
- `{NN}`: 2-digit phase number (e.g., `03`)
- `{Phase Name}`: From `_resolvePhaseDisplayName()` (e.g., `Architecture`)
- Summary path: fixed pattern `.isdlc/reviews/phase-{NN}-summary.md`
- `{N}`: `phases[phaseKey].artifacts.length` or `0`
- `{M}m`: Duration in minutes from `phases[phaseKey].started` to `phases[phaseKey].completed`

### 6.2 Redo Guidance Prompt

```
What additional guidance should this phase consider?
(Describe what to change or focus on)
> _
```

### 6.3 Review Pause Instructions

```
Review the artifacts listed above. Edit any files as needed.
When ready, say 'continue' to advance to the next phase.
```

---

## 7. Final Phase Handling

When the review gate fires for the LAST phase in the workflow (AC-03g, AC-07d):

1. The review gate fires normally after STEP 3e
2. If user selects [C] Continue: the loop ends naturally (no more phases), and the phase-loop controller proceeds to the finalize step
3. If user selects [R] Review or [D] Redo: handled identically to non-final phases
4. After the user eventually continues past the review gate, the loop iteration increments `current_phase_index` past `phases.length`, causing the loop to exit and proceed to finalize

No special handling is needed -- the existing loop termination condition handles this.

---

## 8. Interaction with Existing Steps

### 8.1 STEP 3e-sizing (Sizing Decision Point)

- Sizing fires after Phase 02 (impact analysis) only
- The review gate fires BEFORE sizing
- This means: user reviews Phase 02 output FIRST, then sees the sizing recommendation
- If user redoes Phase 02, the redo completes, review gate re-presents, and THEN sizing runs
- **Risk**: If sizing has already been set (from a previous non-redo run), the sizing step's guard (`sizing already set`) prevents double-sizing

### 8.2 STEP 3e-refine (Task Refinement)

- Refinement fires after Phase 04 (design) only
- The review gate fires BEFORE refinement
- This means: user reviews Phase 04 design output FIRST, then tasks are refined
- If user redoes Phase 04, the redo completes, review gate re-presents, and THEN refinement runs
- **Risk**: Refinement guard (`refinement_completed === true`) prevents double-refinement. If redo occurs, should refinement re-run? Architecture decision: NO -- refinement is based on the latest design artifacts, and the guard prevents re-running. If the user wants refinement to re-run after a redo, they should set `refinement_completed = false` manually or this can be enhanced in a future release.

### 8.3 STEP 3b (Escalation Check)

- Escalations are checked at the START of each loop iteration
- The review gate fires at the END (after 3e, before 3e-sizing)
- No interaction concern

---

## 9. Traceability Matrix

| Step | Requirements | ACs Covered |
|------|-------------|-------------|
| Gate trigger check (skip logic) | FR-03, FR-07 | AC-03e, AC-03f, AC-07b, AC-07c |
| Summary generation call | FR-02 | AC-02a (delegation to generatePhaseSummary) |
| Menu presentation | FR-03 | AC-03a |
| [C] Continue handling | FR-03 | AC-03b |
| [R] Review handling | FR-04 | AC-04a, AC-04b, AC-04c, AC-04d, AC-04e |
| [D] Redo handling | FR-05 | AC-05a, AC-05b, AC-05c, AC-05d, AC-05e, AC-05f |
| REVIEW_LOOP | FR-07 | AC-07a |
| Final phase handling | FR-03, FR-07 | AC-03g, AC-07d |
| Review history recording | FR-08 | AC-08a |
| SCENARIO 4 recovery | NFR-04 | (session recovery) |
| Circuit breaker (redo_count >= 3) | NFR-05 | AC-05d |

---

## 10. Error Handling

| Error Condition | Behavior | Traces |
|----------------|----------|--------|
| `readSupervisedModeConfig()` returns `{ enabled: false }` | Skip review gate entirely | NFR-02 |
| `generatePhaseSummary()` returns `null` | Log warning, skip review gate (fail-open) | NFR-02, ASM-013-03 |
| User enters invalid menu option | Re-prompt (standard AskUserQuestion behavior) | -- |
| State write fails during review | Log error, continue (fail-open) | Article X |
| Session ends during review (status = "reviewing") | Next session detects via SCENARIO 4 recovery | NFR-04 |
| `redo_count` somehow exceeds 3 (state corruption) | Treat as >= 3 (remove [D] option) | NFR-05 |
