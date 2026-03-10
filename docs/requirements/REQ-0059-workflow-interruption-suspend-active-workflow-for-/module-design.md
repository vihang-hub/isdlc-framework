# REQ-0059: Module Design — Workflow Interruption

## 1. Module: workflow-init.cjs (Suspend Path)

### Responsibility
Handle `--interrupt` flag: suspend active workflow before initializing a fix workflow.

### Interface Changes

```javascript
// parseArgs() — add interrupt flag
function parseArgs() {
    // ... existing args ...
    // NEW:
    if (args[i] === '--interrupt') result.interrupt = true;
    return result;  // { type, description, slug, light, supervised, startPhase, interrupt }
}
```

### Logic Change (main function, after `readState()`)

Current behavior (lines 91-98): If `active_workflow` exists → BLOCKED.

New behavior:

```
if (state.active_workflow) {
    if (args.interrupt && args.type === 'fix') {
        // FR-005: Check depth limit
        if (state.suspended_workflow) {
            → ERROR: "Cannot suspend: already a suspended workflow"
            → Include both workflow descriptions in message
            → exit(1)
        }
        // FR-002: Suspend active workflow
        state.suspended_workflow = { ...state.active_workflow }
        delete state.active_workflow
        // Continue to normal init flow (creates new fix workflow)
    } else {
        → BLOCKED (existing behavior, unchanged)
    }
}
```

### Preconditions
- `--interrupt` requires `--type fix` (other types blocked)
- `--interrupt` requires an active workflow to exist (no-op if no active workflow)
- No existing `suspended_workflow` (depth limit = 1)

### Postconditions
- `state.suspended_workflow` contains the former `active_workflow` (all fields preserved)
- `state.active_workflow` is the new fix workflow
- `state.state_version` incremented

### Output (new fields in INITIALIZED response)
```json
{
    "result": "INITIALIZED",
    "interrupted": true,
    "suspended_workflow": { "type": "feature", "slug": "REQ-0042-dark-mode", "phase": "06-implementation" }
}
```

---

## 2. Module: workflow-finalize.cjs (Resume Path)

### Responsibility
After clearing the completed fix workflow, restore `suspended_workflow` to `active_workflow` with phase iteration reset.

### Logic Change (after line 153: `delete state.active_workflow`)

```
// FR-004: Check for suspended workflow to restore
if (state.suspended_workflow) {
    // Restore suspended workflow
    state.active_workflow = state.suspended_workflow
    delete state.suspended_workflow

    // FR-008: Phase iteration reset (reuse workflow-retry logic)
    const currentPhase = state.active_workflow.current_phase
    const phaseData = state.phases && state.phases[currentPhase]
    if (phaseData) {
        // Clear test_iteration
        delete phaseData.iteration_requirements?.test_iteration
        delete phaseData.test_iteration
        // Clear constitutional_validation
        delete phaseData.constitutional_validation
        // Clear interactive_elicitation
        delete phaseData.iteration_requirements?.interactive_elicitation
        delete phaseData.interactive_elicitation
    }

    // Set recovery_action flag
    state.active_workflow.recovery_action = {
        type: 'resumed_from_suspension',
        phase: currentPhase,
        timestamp: new Date().toISOString()
    }
}
```

### Postconditions
- `state.active_workflow` = restored workflow with all original fields
- `state.suspended_workflow` deleted (absent, not null)
- Phase iteration state for `current_phase` cleared
- Artifacts on disk from before suspension preserved (no disk changes)
- `state.state_version` incremented (already happens on line 154)

### Output (new fields in FINALIZED response)
```json
{
    "result": "FINALIZED",
    "resumed_workflow": { "type": "feature", "slug": "REQ-0042-dark-mode", "phase": "06-implementation" }
}
```

### Cancel handling (FR-006)

The existing `workflow-finalize.cjs` only handles completed workflows. Cancellation is handled by `workflow-rollback.cjs`. The resume logic must also be added there. However, `workflow-rollback.cjs` already clears `active_workflow` — the same `suspended_workflow` check applies.

**Decision**: Add the same `suspended_workflow` restoration block to `workflow-rollback.cjs` after it clears `active_workflow`. This is a small duplication (~15 lines) but keeps both exit paths correct.

---

## 3. Module: validate-state.cjs (Schema Validation)

### Responsibility
Validate `suspended_workflow` has the same schema as `active_workflow` when present.

### Logic Change (after line 107)

```
// Validate suspended_workflow if present (same schema as active_workflow)
if (state.suspended_workflow) {
    const sw = state.suspended_workflow;
    // Same checks as active_workflow (lines 78-106)
    if (sw.current_phase_index !== undefined && typeof sw.current_phase_index !== 'number') {
        errors.push('suspended_workflow.current_phase_index should be a number');
    }
    if (sw.phases && !Array.isArray(sw.phases)) {
        errors.push('suspended_workflow.phases should be an array');
    }
    if (sw.current_phase && sw.phases && Array.isArray(sw.phases)) {
        if (!sw.phases.includes(sw.current_phase)) {
            errors.push(`suspended_workflow.current_phase '${sw.current_phase}' is not in phases array`);
        }
    }
    if (sw.phase_status && typeof sw.phase_status === 'object') {
        const validStatuses = ['pending', 'in_progress', 'completed', 'skipped'];
        for (const [phase, status] of Object.entries(sw.phase_status)) {
            if (!validStatuses.includes(status)) {
                errors.push(`suspended_workflow.phase_status['${phase}'] has invalid status: '${status}'`);
            }
        }
    }
}
```

**Refactoring opportunity**: Extract the workflow validation into a helper `validateWorkflowShape(obj, prefix)` to avoid duplicating the 4 checks. Both `active_workflow` and `suspended_workflow` call it.

---

## 4. Module: CLAUDE.md (Hook Block Auto-Recovery Protocol Update)

### Responsibility
Document the harness bug detection flow so the AI knows when and how to trigger `--interrupt`.

### Location
`CLAUDE.md` → "Hook Block Auto-Recovery Protocol" section.

### Addition (after "Escalate to user ONLY when:")

```
**Harness Bug Detection (FR-001)**:
If the same hook blocks the same operation after you have already retried with the recovery approach:
1. This is a harness/framework bug, not the user's code
2. Inform the user: "This is a framework issue — [hook name] is broken. It's not your code."
3. Ask user consent to fix the framework issue
4. If user consents:
   node src/antigravity/workflow-init.cjs --type fix --interrupt --description "Fix [hook name]: [brief description]"
5. Run the fix workflow normally through all phases
6. On finalize, the original workflow resumes automatically
```

---

## 5. Data Flow

```
Hook blocks operation → AI retries (auto-recovery) → Same hook blocks again
  ↓
AI identifies harness bug (FR-001)
  ↓
AI informs user: "framework issue, not your code" (FR-007)
  ↓
User consents
  ↓
workflow-init.cjs --type fix --interrupt --description "..."
  ├── state.active_workflow → state.suspended_workflow (FR-002)
  ├── new fix workflow → state.active_workflow (FR-003)
  └── state.state_version++
  ↓
[Fix workflow runs: requirements → tracing → test-strategy → implementation → quality-loop → code-review]
  ↓
workflow-finalize.cjs
  ├── fix workflow → workflow_history
  ├── delete state.active_workflow
  ├── state.suspended_workflow → state.active_workflow (FR-004)
  ├── phase iteration reset on current_phase (FR-008)
  ├── delete state.suspended_workflow
  └── state.state_version++
  ↓
AI reports: "Resumed [workflow description] at [phase]" (FR-007)
```

---

## 6. Error Taxonomy

| Code | Trigger | Severity | Recovery |
|------|---------|----------|----------|
| `INTERRUPT_NO_ACTIVE` | `--interrupt` with no active workflow | Warning | Proceed with normal init (no-op suspend) |
| `INTERRUPT_NOT_FIX` | `--interrupt` with non-fix type | Error | Block. Only fix workflows can interrupt. |
| `SUSPEND_DEPTH_EXCEEDED` | `--interrupt` when `suspended_workflow` exists | Error | Block. Escalate to user — cannot nest. |
| `RESUME_PHASE_MISSING` | Restored workflow's `current_phase` not in `phases` array | Error | Validation catches this — state corruption. |

---

## 7. Files Modified Summary

| File | Change Type | Lines Added (est.) | FR Coverage |
|------|-------------|-------------------|-------------|
| `src/antigravity/workflow-init.cjs` | Modify | ~25 | FR-002, FR-003, FR-004, FR-005 |
| `src/antigravity/workflow-finalize.cjs` | Modify | ~25 | FR-004, FR-006, FR-008 |
| `src/antigravity/workflow-rollback.cjs` | Modify | ~20 | FR-006 |
| `src/antigravity/validate-state.cjs` | Modify | ~25 (or less with helper extraction) | FR-006 |
| `CLAUDE.md` | Modify | ~15 | FR-001, FR-007 |

## Pending Sections

None — all sections complete.
