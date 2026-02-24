# Module Design: Orchestrator START_PHASE Handling

**Phase**: 04-design
**Feature ID**: REQ-BUILD-AUTODETECT
**Module**: `src/claude/agents/00-sdlc-orchestrator.md`
**Change Type**: MODIFY (extend `init-and-phase-01` mode with optional parameters)
**Based On**: architecture.md (ADR-002), requirements-spec.md (FR-006, FR-007, FR-008)

---

## 1. Overview

This module design specifies the changes to the SDLC orchestrator's `init-and-phase-01` mode. The orchestrator receives two new optional parameters (`START_PHASE` and `ARTIFACT_FOLDER`) from the build verb handler. When present, these parameters modify the workflow initialization to start from a phase other than the first and to reuse an existing artifact directory.

**Key principle**: The orchestrator owns all workflow-definition logic. It reads `workflows.json`, validates the START_PHASE against the known phase array, slices the phases, and calls `resetPhasesForWorkflow` with the result. The build verb handler never constructs phase arrays.

**Traces**: FR-006, FR-007, FR-008

---

## 2. New Parameters

### 2.1 Parameter Specification

| Parameter | Type | Required | Default | Source | Description |
|-----------|------|----------|---------|--------|-------------|
| `START_PHASE` | `string` | No | `null` | Build verb handler (step 4a-4d) | Phase key to start workflow from (e.g., `"05-test-strategy"`, `"02-impact-analysis"`) |
| `ARTIFACT_FOLDER` | `string` | No | `null` | Build verb handler (step 7) | Existing artifact folder name to reuse (e.g., `"build-auto-detection-seamless-handoff"`, `"REQ-0022-performance-budget-guardrails"`) |

### 2.2 Parameter Passing Format

The build verb handler passes these parameters in the Task tool delegation prompt alongside existing parameters:

```
MODE: init-and-phase-01
ACTION: feature
DESCRIPTION: "payment-processing"
FLAGS: --supervised

START_PHASE: "05-test-strategy"
ARTIFACT_FOLDER: "payment-processing"
```

When `START_PHASE` is absent, the orchestrator uses its existing behavior (full workflow). This ensures complete backward compatibility (AC-006-05).

---

## 3. Modified init-and-phase-01 Logic

### 3.1 Current Flow (Before)

```
1. Validate constitution
2. Check no active workflow
3. Load workflow definition from workflows.json
4. Read counters.next_req_id, zero-pad to 4 digits
5. Call resetPhasesForWorkflow(state, workflow.phases)
6. Write active_workflow to state.json:
     { type, description, started_at, phases: workflow.phases,
       current_phase: workflow.phases[0], current_phase_index: 0,
       artifact_prefix: "REQ", artifact_folder: "REQ-NNNN-{slug}",
       counter_used: N }
7. Increment counters.next_req_id
8. Create branch: feature/{artifact_folder}
9. Delegate to Phase 01 agent
10. Validate GATE-01
11. Generate plan
12. Return structured result
```

### 3.2 Modified Flow (After)

```
1.  Validate constitution (UNCHANGED)
2.  Check no active workflow (UNCHANGED)
3.  Load workflow definition from workflows.json (UNCHANGED)

--- START_PHASE HANDLING (NEW) ---

4.  IF START_PHASE is present in the Task prompt:
      a. Validate START_PHASE
      b. Slice phases array
      c. Handle ARTIFACT_FOLDER
      d. Handle counter logic
    ELSE:
      a. Standard initialization (current behavior)

--- END START_PHASE HANDLING ---

5.  Call resetPhasesForWorkflow(state, phasesToUse) (MODIFIED: may use sliced phases)
6.  Write active_workflow to state.json (MODIFIED: uses computed values)
7.  Conditionally increment counter (MODIFIED: skip if ARTIFACT_FOLDER provided)
8.  Create branch (MODIFIED: uses ARTIFACT_FOLDER if provided)
9.  Update meta.json with build_started_at (NEW)
10. Delegate to first phase agent (MODIFIED: may not be Phase 01)
11. Validate gate for first phase (MODIFIED: may not be GATE-01)
12. Generate plan (UNCHANGED -- but plan covers only remaining phases)
13. Return structured result (MODIFIED: reflects actual phases)
```

---

## 4. Detailed Step Designs

### 4.1 Step 4: START_PHASE Processing

#### 4.1a: Validate START_PHASE

```
LET fullPhases = workflow.phases
  // e.g., ["00-quick-scan", "01-requirements", ..., "08-code-review"]

LET startIndex = fullPhases.indexOf(START_PHASE)

IF startIndex === -1:
  // Invalid phase key -- not found in workflow definition
  LOG ERROR: "ERR-ORCH-INVALID-START-PHASE: '{START_PHASE}' is not a valid phase
              key in the {workflowType} workflow. Valid keys: {fullPhases.join(', ')}.
              Falling back to full workflow."
  LET phasesToUse = fullPhases
  LET startPhaseValid = false
  // Continue with full workflow (AC-006-03)
ELSE:
  LET startPhaseValid = true
```

**Traces**: FR-006 (AC-006-03)

#### 4.1b: Slice Phases Array

```
IF startPhaseValid:
  LET phasesToUse = fullPhases.slice(startIndex)
  // Example: START_PHASE="05-test-strategy", startIndex=5
  // phasesToUse = ["05-test-strategy", "06-implementation", "16-quality-loop", "08-code-review"]
ELSE:
  LET phasesToUse = fullPhases  // Full workflow (fallback)
```

**Traces**: FR-006 (AC-006-01, AC-006-02)

#### 4.1c: Handle ARTIFACT_FOLDER

```
IF ARTIFACT_FOLDER is present AND is a non-empty string:
  LET artifactFolder = ARTIFACT_FOLDER
  LET artifactPrefix = null  // Will be derived below
  LET counterUsed = null     // No counter needed

  // Derive prefix from folder name
  IF artifactFolder matches /^REQ-\d{4}-/:
    LET artifactPrefix = "REQ"
    // Extract counter from folder name for record-keeping
    LET counterUsed = parseInt(artifactFolder.match(/^REQ-(\d{4})-/)[1], 10)
  ELSE IF artifactFolder matches /^BUG-\d{4}-/:
    LET artifactPrefix = "BUG"
    LET counterUsed = parseInt(artifactFolder.match(/^BUG-(\d{4})-/)[1], 10)
  ELSE:
    // Slug-only folder (no REQ/BUG prefix) -- pre-analyzed item without a counter
    LET artifactPrefix = "REQ"  // Default for feature workflows
    // Will need counter assignment for branch naming and state tracking
    LET needsCounter = true

  LET skipCounterIncrement = !needsCounter
    // If folder already has a counter prefix, do not increment
    // If folder has no prefix, we need a counter for state tracking

ELSE:
  // No ARTIFACT_FOLDER -- standard initialization
  // Read counter, zero-pad, create folder, increment
  LET needsCounter = true
  LET skipCounterIncrement = false
```

**Handling slug-only folders (no REQ prefix)**:

When an item was analyzed via `/isdlc analyze` before a REQ number was assigned (analyze does not assign REQ numbers -- that happens during build), the folder name is the raw slug (e.g., `"build-auto-detection-seamless-handoff"`). In this case:

```
IF needsCounter AND ARTIFACT_FOLDER is present:
  // Item has a slug folder but no REQ prefix
  // Assign a counter now
  LET reqId = counters.next_req_id (zero-padded to 4 digits)
  LET artifactPrefix = "REQ"
  LET counterUsed = reqId
  LET artifactFolder = ARTIFACT_FOLDER  // Keep the existing folder name as-is
  // Note: Do NOT rename the folder to REQ-NNNN-slug. The folder keeps its
  // original name. The REQ-NNNN identifier is used only for branch naming
  // and state tracking (artifact_prefix + counter_used).
  // This avoids breaking references in analysis artifacts that use the
  // original folder path.
  INCREMENT counters.next_req_id
```

**Traces**: FR-007 (AC-007-01 through AC-007-03)

#### 4.1d: Handle Counter Logic

```
IF skipCounterIncrement:
  // Counter already assigned to this item (REQ-NNNN prefix exists)
  // Do NOT read or increment counters.next_req_id
ELSE IF needsCounter AND NOT ARTIFACT_FOLDER:
  // Standard new item -- existing behavior
  LET reqId = counters.next_req_id
  INCREMENT counters.next_req_id
  LET artifactFolder = "REQ-" + zeroPad(reqId, 4) + "-" + slugify(description)
  LET artifactPrefix = "REQ"
  LET counterUsed = reqId
```

### 4.2 Step 5: resetPhasesForWorkflow

```
Call resetPhasesForWorkflow(state, phasesToUse)
```

This replaces the previous call which always passed the full `workflow.phases` array. The function already supports arbitrary phase arrays (confirmed in architecture.md section 3.5), so no changes to `common.cjs` are needed.

**Traces**: FR-006 (AC-006-04)

### 4.3 Step 6: Write active_workflow

```
state.active_workflow = {
    type: workflowType,                       // "feature" or "fix"
    description: description,
    started_at: new Date().toISOString(),
    phases: phasesToUse,                       // MODIFIED: may be sliced
    current_phase: phasesToUse[0],             // MODIFIED: may not be "00-quick-scan"
    current_phase_index: 0,                    // Always 0 (first phase in sliced array)
    phase_status: {
        [phasesToUse[0]]: "in_progress",
        ...rest: "pending"
    },
    gate_mode: workflow.gate_mode,             // "strict"
    artifact_prefix: artifactPrefix,           // "REQ" or "BUG"
    artifact_folder: artifactFolder,           // Existing slug or new REQ-NNNN-slug
    counter_used: counterUsed                  // Counter value (may be null for slug-only)
};
```

### 4.4 Step 8: Branch Creation

```
IF workflow.requires_branch:
  LET branchName = "feature/" + artifactFolder
  // Examples:
  //   "feature/build-auto-detection-seamless-handoff" (slug-only)
  //   "feature/REQ-0022-performance-budget-guardrails" (REQ-prefixed)
  //
  // Pre-flight checks and branch creation proceed as normal
  // (git status, checkout main, create branch)
```

### 4.5 Step 9: Update meta.json (NEW)

After workflow initialization and branch creation, update the item's meta.json with build tracking fields (FR-008):

```
LET slugDir = path.join(docsRoot, 'requirements', artifactFolder)

IF fs.existsSync(path.join(slugDir, 'meta.json')):
  LET meta = readMetaJson(slugDir)
  meta.build_started_at = new Date().toISOString()
  meta.workflow_type = workflowType  // "feature" or "fix"
  writeMetaJson(slugDir, meta)
ELSE:
  // No meta.json exists (raw item or legacy)
  // Create minimal meta.json
  LET meta = {
    description: description,
    source: "manual",
    created_at: new Date().toISOString(),
    analysis_status: "raw",
    phases_completed: [],
    build_started_at: new Date().toISOString(),
    workflow_type: workflowType
  }
  writeMetaJson(slugDir, meta)
```

**Traces**: FR-008 (AC-008-01)

### 4.6 Step 10: Delegate to First Phase

The first phase in `phasesToUse` may not be Phase 01. The orchestrator resolves the correct agent:

```
LET firstPhase = phasesToUse[0]

// Resolve agent from the PHASE -> AGENT mapping (same as Phase-Loop Controller)
// Examples:
//   "05-test-strategy" -> test-design-engineer
//   "02-impact-analysis" -> impact-analysis-orchestrator
//   "00-quick-scan" -> quick-scan-agent

Delegate to the resolved agent with appropriate context:
  - Active workflow info
  - Artifact folder path
  - Agent modifiers from workflow definition (if any for this phase)
```

### 4.7 Step 13: Return Structured Result

```json
{
    "status": "phase_complete",
    "phases": ["05-test-strategy", "06-implementation", "16-quality-loop", "08-code-review"],
    "artifact_folder": "build-auto-detection-seamless-handoff",
    "workflow_type": "feature",
    "next_phase_index": 1
}
```

The `phases` array reflects the sliced phases, not the full workflow. The Phase-Loop Controller uses this array for STEP 2 (task creation) and STEP 3 (phase iteration).

---

## 5. Backward Compatibility

When `START_PHASE` is absent from the Task prompt:

1. Step 4 takes the ELSE path (standard initialization)
2. `phasesToUse = fullPhases` (all phases)
3. Counter is read and incremented normally
4. New `REQ-NNNN-slug` folder is created
5. Branch uses the new folder name
6. Phase 01 agent is delegated to
7. Behavior is identical to current implementation

This satisfies AC-006-05: backward compatibility when parameter is absent.

**Traces**: FR-006 (AC-006-05), NFR-003

---

## 6. Finalize Mode Update (FR-008 Completion)

When the orchestrator runs in `finalize` mode and the workflow completes successfully, update meta.json with the completion timestamp:

```
// In finalize mode, after successful merge:
LET slugDir = path.join(docsRoot, 'requirements', active_workflow.artifact_folder)

IF fs.existsSync(path.join(slugDir, 'meta.json')):
  LET meta = readMetaJson(slugDir)
  meta.build_completed_at = new Date().toISOString()
  // Do NOT change analysis_status -- it reflects analysis completion, not build
  writeMetaJson(slugDir, meta)
```

**Traces**: FR-008 (AC-008-02)

---

## 7. Error Handling

| Error Condition | Error Code | Response | Recovery |
|----------------|------------|----------|----------|
| START_PHASE not in workflow phases | ERR-ORCH-INVALID-START-PHASE | Log error, fall back to full workflow | Full workflow executes |
| ARTIFACT_FOLDER directory does not exist | -- | Create it (same as standard behavior) | Directory created, workflow proceeds |
| meta.json write failure (step 9) | -- | Log warning, continue | Build proceeds without meta tracking |
| Counter read failure | -- | Existing error handling | Existing recovery path |

All errors degrade gracefully. The orchestrator never fails the workflow due to START_PHASE processing errors.

**Traces**: NFR-004

---

## 8. Phase-Loop Controller Impact

The Phase-Loop Controller (STEP 2 and STEP 3 in isdlc.md) requires NO changes. It operates on the `phases[]` array returned by the orchestrator. When the array is sliced (e.g., 4 phases instead of 9), the controller:

- STEP 2: Creates 4 TaskCreate entries instead of 9
- STEP 3: Iterates 3 remaining phases (after the first, which the orchestrator ran)

The controller is phase-array agnostic -- it works with any valid array of phase keys.

---

## 9. Traceability Matrix

| Design Section | FR Traces | NFR Traces | AC Coverage |
|---------------|-----------|------------|-------------|
| Parameter specification | FR-006 | -- | AC-006-01 through AC-006-05 |
| START_PHASE validation | FR-006 | NFR-004 | AC-006-03 |
| Phase array slicing | FR-006 | -- | AC-006-01, AC-006-02, AC-006-04 |
| ARTIFACT_FOLDER handling | FR-007 | -- | AC-007-01 through AC-007-03 |
| Counter logic | FR-007 | -- | AC-007-03 |
| Meta.json build tracking | FR-008 | -- | AC-008-01, AC-008-02 |
| Backward compatibility | FR-006 | NFR-003 | AC-006-05, AC-NFR-003-01 |
| resetPhasesForWorkflow call | FR-006 | -- | AC-006-04 |
