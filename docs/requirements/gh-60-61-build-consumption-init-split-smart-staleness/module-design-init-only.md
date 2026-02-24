# Module Design: MODE init-only and Phase-Loop Controller Changes (GH-60)

**Feature**: GH-60 (Split Build STEP 1)
**Artifact Folder**: gh-60-61-build-consumption-init-split-smart-staleness
**Phase**: 04-design
**Status**: Draft
**Created**: 2026-02-20

**Traces**: FR-001, FR-002, FR-003, FR-007, NFR-001, NFR-005

---

## 1. Module Overview

GH-60 decouples workflow initialization from first-phase execution by:
1. Adding `MODE: init-only` to the orchestrator agent (`00-sdlc-orchestrator.md`)
2. Switching `isdlc.md` STEP 1 from `init-and-phase-01` to `init-only`
3. Removing the Phase 01 pre-mark logic from STEP 2
4. Making the Phase-Loop Controller (STEP 3) handle ALL phases from index 0
5. Resolving the plan generation timing question (deferred from architecture)

Three files are modified. No new files are created.

---

## 2. File-by-File Change Specification

### 2.1 `src/claude/agents/00-sdlc-orchestrator.md`

#### 2.1.1 Mode Table Update (Section 3c)

**Current** (line ~629-634):
```markdown
| Mode | Scope | Returns |
|------|-------|---------|
| `init-and-phase-01` | Initialize workflow + create branch + run first phase ... | Structured result |
| `single-phase` | Run one phase ... | Structured result |
| `finalize` | Human Review ... | Structured result |
| _(none)_ | Full workflow ... | Original behavior |
```

**After**:
```markdown
| Mode | Scope | Returns |
|------|-------|---------|
| `init-only` | Initialize workflow + create branch. No phase execution. | `{ status: "init_complete", phases[], artifact_folder, workflow_type, next_phase_index: 0 }` |
| `init-and-phase-01` **(deprecated)** | Initialize workflow + create branch + run first phase + gate + plan | Structured result (existing) |
| `single-phase` | Run one phase + validate gate + update state | Structured result (existing) |
| `finalize` | Human Review + merge + cleanup | Structured result (existing) |
| _(none)_ | Full workflow (backward compatible) | Original behavior |
```

**Traces**: FR-001 (AC-001-04), FR-003 (AC-003-02), FR-007 (AC-007-01)

#### 2.1.2 MODE ENFORCEMENT Section Update (Lines ~22-40)

Add `init-only` to the MODE ENFORCEMENT block at the top of the file. Insert BEFORE the `init-and-phase-01` entry:

```markdown
- **MODE: init-only**: Run ONLY initialization (state.json setup, branch creation, counter increment,
  meta.json update, supervised mode flag). Do NOT delegate to any phase agent. Do NOT validate any gate.
  Do NOT generate a plan. Return the structured JSON result and terminate.
```

Add deprecation note to the existing `init-and-phase-01` entry:

```markdown
- **MODE: init-and-phase-01** *(deprecated -- use init-only)*: Run ONLY initialization + the first phase
  + its gate + plan generation. [rest of existing text unchanged]
```

**Traces**: FR-001 (AC-001-05), FR-003 (AC-003-02)

#### 2.1.3 New init-only Handler (Section 3c Mode Behavior)

Add as item 0 in the Mode Behavior numbered list (before `init-and-phase-01`):

```markdown
0. **init-only**: Run initialization (Section 3, including START_PHASE handling in 2b if provided),
   create branch (3a if requires_branch: true), parse --supervised flag. Return JSON immediately.
   OMIT: phase agent delegation, gate validation, plan generation (ORCH-012).

   Deprecation notice: Emit to stderr when init-and-phase-01 is received:
   "DEPRECATED: MODE init-and-phase-01. Use MODE init-only with Phase-Loop Controller."
```

**Traces**: FR-001 (AC-001-01 through AC-001-06), FR-003 (AC-003-04)

#### 2.1.4 init-only Return Format (Section 3c Return Format)

Add to the Return Format subsection:

```markdown
- `init-only`: `{ status: "init_complete", phases[], artifact_folder, workflow_type, next_phase_index: 0 }`
```

The return format fields:

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `status` | `string` | Always `"init_complete"` | Literal |
| `phases` | `string[]` | Full or sliced phase array from workflows.json | `active_workflow.phases` after setup |
| `artifact_folder` | `string` | The requirement folder name (e.g., `"REQ-0001-feature-name"`) | From counter + slug or ARTIFACT_FOLDER param |
| `workflow_type` | `string` | One of `"feature"`, `"fix"`, `"test-run"`, etc. | From ACTION param |
| `next_phase_index` | `number` | Always `0` -- no phases executed | Literal |

When `START_PHASE` is provided:
- `phases` is sliced from START_PHASE onward (same slicing logic as init-and-phase-01)
- `next_phase_index` is still `0` (relative to the sliced array)
- No counter increment occurs when `ARTIFACT_FOLDER` is provided alongside START_PHASE

**Traces**: FR-007 (AC-007-01, AC-007-02, AC-007-03), FR-001 (AC-001-02, AC-001-04)

#### 2.1.5 init-only Initialization Steps (Exact Sequence)

The init-only handler performs this ordered sequence (a strict subset of init-and-phase-01):

```
STEP I-1: Validate prerequisites
  - Constitution exists at docs/isdlc/constitution.md
  - No active_workflow in state.json (or handle resume)

STEP I-2: Determine workflow definition
  - Read workflows.json for the ACTION type (feature, fix, etc.)
  - Get base phases array

STEP I-3: Handle START_PHASE and ARTIFACT_FOLDER (if present)
  - If START_PHASE provided: slice phases array from START_PHASE onward
  - If ARTIFACT_FOLDER provided: use as artifact_folder (skip counter increment)
  - If neither: increment counter (next_req_id or next_bug_id), generate artifact_folder

STEP I-4: Write active_workflow to state.json
  - Set type, description, phases, current_phase, current_phase_index = 0
  - Set all phase statuses to "pending"
  - Set the first phase status to "pending" (NOT "in_progress" -- Phase-Loop will set that)

STEP I-5: Update top-level current_phase in state.json
  - current_phase = phases[0]

STEP I-6: Parse --supervised flag
  - If present: set supervised_mode.enabled = true in state.json

STEP I-7: Create branch (if requires_branch: true)
  - Execute Section 3a branch creation logic
  - Branch name: feature/{artifact_folder} or bugfix/{artifact_folder}

STEP I-8: Update meta.json with build tracking
  - Set build_workflow_id, build_started_at (REQ-0026 tracking)

STEP I-9: Return JSON
  - { status: "init_complete", phases, artifact_folder, workflow_type, next_phase_index: 0 }
```

**Key difference from init-and-phase-01**: Steps I-4 sets the first phase status to `"pending"` rather than `"in_progress"`. The Phase-Loop Controller's STEP 3a will set it to `"in_progress"` when it begins Phase 01. This ensures the state correctly reflects that no phase has started yet.

**Traces**: FR-001 (AC-001-01 through AC-001-06)

#### 2.1.6 Deprecation Notice Emission

When the orchestrator receives `MODE: init-and-phase-01`:

1. Execute the FULL existing behavior unchanged (no regression per AC-003-01)
2. Before returning the result, emit to stderr: `"DEPRECATED: MODE init-and-phase-01 will be removed in v0.3.0. Use MODE init-only with Phase-Loop Controller."`
3. The notice is non-blocking -- it does not affect execution or return values

**Traces**: FR-003 (AC-003-04)

---

### 2.2 `src/claude/commands/isdlc.md`

#### 2.2.1 STEP 1 Change (Line ~1338-1365)

**Current** (lines ~1338-1365):
```markdown
#### STEP 1: INIT -- Launch orchestrator for init + first phase

Use Task tool -> sdlc-orchestrator with:
  MODE: init-and-phase-01
  ...

The orchestrator initializes the workflow, creates the branch, runs Phase 01
(or the START_PHASE if provided), validates the corresponding gate, generates
the plan, and returns a structured result:
{
  "status": "phase_complete",
  "phases": [...],
  "artifact_folder": "REQ-0001-feature-name",
  "workflow_type": "feature",
  "next_phase_index": 1
}
```

**After**:
```markdown
#### STEP 1: INIT -- Launch orchestrator for workflow initialization

Use Task tool -> sdlc-orchestrator with:
  MODE: init-only
  ACTION: {feature|fix|test-run|test-generate|start|upgrade}
  DESCRIPTION: "{user description}"
  (include MONOREPO CONTEXT if applicable)

  // REQ-0026: Build auto-detection parameters (only for build/feature):
  // Include these ONLY when the build handler (steps 4a-4e) determined them:
  START_PHASE: "{startPhase}"       // Only if startPhase is not null
  ARTIFACT_FOLDER: "{item.slug}"    // Only if item was resolved from existing directory

The orchestrator initializes the workflow and creates the branch but does NOT
execute any phase. It returns:
{
  "status": "init_complete",
  "phases": ["01-requirements", "02-impact-analysis", ...],
  "artifact_folder": "REQ-0001-feature-name",
  "workflow_type": "feature",
  "next_phase_index": 0
}

If initialization fails, stop here.
```

**Traces**: FR-002 (AC-002-05), FR-003 (AC-003-03)

#### 2.2.2 STEP 1 in Build Handler (Line ~857-865)

The build handler (step 7) also references `MODE: init-and-phase-01`. This line must also be updated:

**Current** (line ~859):
```
MODE: init-and-phase-01, ACTION: feature (or fix), DESCRIPTION: "{item description}", FLAGS: {parsed flags}
```

**After**:
```
MODE: init-only, ACTION: feature (or fix), DESCRIPTION: "{item description}", FLAGS: {parsed flags}
```

**Traces**: FR-002 (AC-002-05)

#### 2.2.3 STEP 2 Change: Remove Phase 01 Pre-Mark (Line ~1396)

**Current** (line ~1396):
```markdown
**Mark Phase 01's task as completed with strikethrough** immediately (it already
passed in Step 1). Update both `status` to `completed` AND `subject` to
`~~[1] {base subject}~~` (markdown strikethrough).
```

**After**: DELETE this entire paragraph. Replace with:
```markdown
All tasks start as `pending`. No task is pre-marked as completed -- the Phase-Loop
Controller will mark each task as `in_progress` and then `completed` as it
executes each phase.
```

**Traces**: FR-002 (AC-002-04), NFR-005 (AC-NFR-005-01)

#### 2.2.4 STEP 3 Change: Loop From Index 0

**Current** (line ~1400-1402):
```markdown
#### STEP 3: PHASE LOOP -- Execute remaining phases one at a time

For each phase from `next_phase_index` through the end of `phases[]`:
```

**After**:
```markdown
#### STEP 3: PHASE LOOP -- Execute all phases one at a time

For each phase from `next_phase_index` (0) through the end of `phases[]`:
```

This is a documentation-only clarification. The loop already uses `next_phase_index` from the init result. Since init-only returns `next_phase_index: 0`, the loop naturally starts at Phase 01 (or START_PHASE). No code-logic change is needed in the loop itself -- the existing 3a-3f protocol handles all phases uniformly.

**Traces**: FR-002 (AC-002-01, AC-002-02, AC-002-03)

#### 2.2.5 Plan Generation After Phase 01 (STEP 3e Addition)

**Decision**: Option A from architecture (delegate to orchestrator). Add plan generation as a post-Phase-01 hook in STEP 3e.

After the existing STEP 3e post-phase state update logic, add:

```markdown
**3e-plan.** PLAN GENERATION (after Phase 01 only):
If the phase just completed is `01-requirements` AND `docs/isdlc/tasks.md` does
NOT exist (or exists but is a stale template):
  - Delegate to orchestrator: `MODE: single-phase PHASE: plan-generation`
    OR invoke ORCH-012 (generate-plan) skill inline.
  - The plan is informational and non-blocking. If plan generation fails,
    log a warning and continue to the next phase.
```

**Rationale**: Plan generation was previously embedded in `init-and-phase-01`. With `init-only`, the plan must be generated after Phase 01 completes. This is a one-time conditional check that fires only when the completed phase is `01-requirements`. The Phase-Loop Controller remains uniform for all other phases.

**Alternative considered**: Inline plan generation in STEP 3e. Rejected because the orchestrator already owns the ORCH-012 skill and the plan template logic. Re-implementing it inline would duplicate code.

**Implementation note**: If the Phase-Loop Controller cannot easily delegate back to the orchestrator for plan generation (due to Task tool nesting limitations), the implementation team may inline the plan generation logic. This is an acceptable fallback per the architecture document's Option B.

**Traces**: FR-002 (AC-002-03), Architecture Section 9

---

### 2.3 Summary of isdlc.md Line-by-Line Changes

| Section | Current Line(s) | Change | FR Trace |
|---------|-----------------|--------|----------|
| Build handler step 7 | ~859 | `init-and-phase-01` -> `init-only` | FR-002 |
| STEP 1 heading | ~1338 | "init + first phase" -> "workflow initialization" | FR-002 |
| STEP 1 MODE | ~1342 | `init-and-phase-01` -> `init-only` | FR-002, FR-003 |
| STEP 1 return docs | ~1353-1361 | Update to show `init_complete` + `next_phase_index: 0` | FR-007 |
| STEP 1 explanation | ~1353 | Remove "runs Phase 01" language | FR-001 |
| STEP 2 Phase 01 pre-mark | ~1396 | DELETE paragraph, replace with "all tasks pending" note | FR-002 |
| STEP 3 heading | ~1400 | "remaining phases" -> "all phases" | FR-002 |
| STEP 3e (new) | after existing 3e | Add plan generation conditional | FR-002 |

---

## 3. State Machine Transition

### 3.1 Before (init-and-phase-01 flow)

```
isdlc.md STEP 1:
  -> orchestrator (init-and-phase-01)
     -> init workflow
     -> Phase 01 agent
     -> GATE-01
     -> plan generation
     -> return { next_phase_index: 1 }

isdlc.md STEP 2:
  -> create tasks for phases[0..N]
  -> mark phases[0] task as COMPLETED (pre-mark)

isdlc.md STEP 3:
  -> loop from index 1..N
     -> Phase 02, 03, ... agents
```

### 3.2 After (init-only flow)

```
isdlc.md STEP 1:
  -> orchestrator (init-only)
     -> init workflow
     -> create branch
     -> return { next_phase_index: 0 }

isdlc.md STEP 2:
  -> create tasks for phases[0..N]
  -> (all tasks start PENDING)

isdlc.md STEP 3:
  -> loop from index 0..N
     -> Phase 01 agent (first iteration)
        -> 3e-plan: generate plan after Phase 01
     -> Phase 02, 03, ... agents (subsequent iterations)
```

---

## 4. Backward Compatibility

### 4.1 init-and-phase-01 Preservation

The existing `init-and-phase-01` handler in the orchestrator is NOT removed. It continues to:
1. Perform all initialization steps
2. Delegate to the first phase agent
3. Validate the gate
4. Generate the plan
5. Return `{ status: "phase_complete", next_phase_index: 1 }`

The only addition is the deprecation notice emitted to stderr.

Any code or script that invokes `MODE: init-and-phase-01` directly will continue to work identically. The Phase-Loop Controller in isdlc.md no longer uses this mode, but external callers are unaffected.

**Traces**: FR-003 (AC-003-01), NFR-001 (AC-NFR-001-01 through AC-NFR-001-03), CON-001

### 4.2 Phase-Loop Controller Uniformity

The Phase-Loop Controller's STEP 3 protocol (3a through 3f) already handles any phase via `MODE: single-phase`. Phase 01 uses the same delegation pattern as all other phases. The only change is that the loop now starts at index 0 instead of index 1, which is driven by `next_phase_index` from the init result -- no special-case code.

**Traces**: NFR-005 (AC-NFR-005-01, AC-NFR-005-02), ASM-001

---

## 5. Test Strategy Hooks

### 5.1 What Needs Test Coverage

| Test Area | Type | Approach |
|-----------|------|----------|
| init-only return format | Manual verification | Invoke orchestrator with MODE: init-only, verify JSON fields match FR-007 |
| Phase-Loop starts at index 0 | Manual verification | Run a full feature workflow, verify Phase 01 task starts as pending, then transitions to in_progress |
| STEP 2 no pre-mark | Manual verification | After STEP 2 completes, verify all task statuses are pending |
| Deprecation notice emission | Manual verification | Invoke orchestrator with MODE: init-and-phase-01, check stderr for deprecation message |
| init-and-phase-01 backward compat | Manual regression | Run existing workflow via init-and-phase-01, verify identical behavior |
| Plan generation after Phase 01 | Manual verification | Run feature workflow, verify tasks.md is generated after Phase 01 completes |

### 5.2 Test Cases (for Phase 05 -- Test Strategy)

| TC ID | Description | Input | Expected | FR Trace |
|-------|-------------|-------|----------|----------|
| TC-IO-01 | init-only returns correct JSON for feature workflow | MODE: init-only ACTION: feature | `{ status: "init_complete", next_phase_index: 0 }` | FR-001, FR-007 |
| TC-IO-02 | init-only with START_PHASE slices phases | MODE: init-only START_PHASE: 05-test-strategy | `phases` starts at 05-test-strategy, `next_phase_index: 0` | FR-001 (AC-001-02) |
| TC-IO-03 | init-only creates branch when required | MODE: init-only ACTION: feature | Branch `feature/{folder}` exists | FR-001 (AC-001-03) |
| TC-IO-04 | init-only does NOT run Phase 01 | MODE: init-only | No phase agent delegation occurs | FR-001 (AC-001-05) |
| TC-IO-05 | init-only handles --supervised flag | MODE: init-only FLAGS: --supervised | `supervised_mode.enabled = true` in state.json | FR-001 (AC-001-06) |
| TC-IO-06 | Phase-Loop starts at index 0 | Full workflow via init-only | Phase 01 is first iteration of STEP 3 | FR-002 (AC-002-01) |
| TC-IO-07 | Phase-Loop with START_PHASE starts at correct phase | init-only with START_PHASE: 05-test-strategy | Phase 05 is first iteration | FR-002 (AC-002-02) |
| TC-IO-08 | Phase 01 uses same STEP 3 protocol as other phases | Phase-Loop runs Phase 01 | Phase 01 follows 3a-3f, no special handling | FR-002 (AC-002-03) |
| TC-IO-09 | STEP 2 does not pre-mark Phase 01 | After STEP 2 | All tasks have status pending | FR-002 (AC-002-04) |
| TC-IO-10 | init-and-phase-01 still works | MODE: init-and-phase-01 ACTION: feature | Identical to pre-change behavior | FR-003 (AC-003-01) |
| TC-IO-11 | Deprecation notice in stderr | MODE: init-and-phase-01 | stderr contains "DEPRECATED" | FR-003 (AC-003-04) |
| TC-IO-12 | Plan generated after Phase 01 | Feature workflow via init-only | tasks.md exists after Phase 01 | FR-002 |

---

## 6. Risk Mitigation

| Risk | Severity | Mitigation |
|------|----------|------------|
| STEP 2 still pre-marks Phase 01 (missed edit) | HIGH | TC-IO-09 explicitly validates all tasks start as pending |
| Plan generation skipped (timing change) | MEDIUM | TC-IO-12 validates plan exists after Phase 01. Plan is non-blocking. |
| init-only misses an initialization step | MEDIUM | init-only's step list is a documented strict subset of init-and-phase-01. Implementation should extract shared init logic. |
| Phase 01 fails in Phase-Loop (new execution path) | LOW | Phase 01 already uses MODE: single-phase -- same pattern as all other phases (ASM-001) |

---

## 7. Traceability

| Requirement | Design Section | Test Cases |
|-------------|---------------|------------|
| FR-001 | 2.1.3, 2.1.4, 2.1.5 | TC-IO-01..05 |
| FR-002 | 2.2.1, 2.2.3, 2.2.4, 2.2.5 | TC-IO-06..09, TC-IO-12 |
| FR-003 | 2.1.1, 2.1.2, 2.1.6, 2.2.1 | TC-IO-10, TC-IO-11 |
| FR-007 | 2.1.4 | TC-IO-01, TC-IO-02 |
| NFR-001 | 4.1 | TC-IO-10 |
| NFR-005 | 2.2.4, 4.2 | TC-IO-06, TC-IO-08 |
| CON-001 | 4.1 | TC-IO-10 |
