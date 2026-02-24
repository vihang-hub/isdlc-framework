# Trace Analysis: Redundant State Tracking Causes Stale Fields and Hook Blocks

**Generated**: 2026-02-12T11:00:00Z
**Bug**: BUG-0005-state-tracking-stale
**External ID**: MAN (internal dogfooding discovery)
**Workflow**: fix
**Phase**: 02-tracing

---

## Executive Summary

The iSDLC framework tracks phase status in three redundant locations within `state.json`: `active_workflow.phase_status`, top-level `current_phase`/`active_agent`, and top-level `phases{}`. The phase-loop controller (isdlc.md STEP 3e) only updates a subset of these fields on phase transitions -- specifically, it writes to `phases[key].status`, `active_workflow.current_phase`, and top-level `current_phase`, but does NOT write to `active_workflow.phase_status[*]` or top-level `active_agent`. Six hooks read from top-level fields with wrong priority (or exclusively), causing them to see stale data after transitions. Additionally, `tasks.md` is generated once by ORCH-012 but never updated when phases complete, leaving all tasks showing `[ ]` permanently.

**Root Cause Confidence**: HIGH
**Severity**: HIGH
**Estimated Complexity**: MEDIUM (6 hook files + 1 command file + tasks.md update logic)

---

## Symptom Analysis

### Symptom 1: Hooks read stale top-level `current_phase`

Six hooks read `state.current_phase` (the top-level field) either exclusively or with inverted priority, instead of preferring `state.active_workflow.current_phase`:

| Hook | File | Line | Current Code | Problem |
|------|------|------|-------------|---------|
| constitution-validator | `src/claude/hooks/constitution-validator.cjs` | 245 | `state.current_phase` | ONLY reads top-level; no active_workflow fallback |
| delegation-gate | `src/claude/hooks/delegation-gate.cjs` | 133 | `state.current_phase \|\| (state.active_workflow && state.active_workflow.current_phase)` | Inverted priority: top-level takes precedence over active_workflow |
| log-skill-usage | `src/claude/hooks/log-skill-usage.cjs` | 87 | `state.current_phase \|\| '01-requirements'` | ONLY reads top-level; defaults to 01-requirements if missing |
| skill-validator | `src/claude/hooks/skill-validator.cjs` | 95 | `state.current_phase \|\| '01-requirements'` | ONLY reads top-level; defaults to 01-requirements if missing |
| gate-blocker (else branch) | `src/claude/hooks/gate-blocker.cjs` | 578 | `state.current_phase` | Only in the non-workflow else branch; ONLY reads top-level |
| provider-utils | `src/claude/hooks/lib/provider-utils.cjs` | 323 | `state?.current_phase \|\| 'unknown'` | ONLY reads top-level; defaults to 'unknown' |

**Impact**: When STEP 3e advances to the next phase but the top-level `current_phase` is stale (which CAN happen if the field was not written, or was written inconsistently), these hooks operate on the wrong phase. Even though STEP 3e currently DOES update top-level `current_phase`, the code pattern is fragile -- any write failure or race condition leaves these hooks seeing stale data.

### Symptom 2: `active_workflow.phase_status` is never updated after init

The orchestrator initializes `active_workflow.phase_status` with all phases as `"pending"` and sets the first phase to `"in_progress"`. However, STEP 3e never updates this map on phase transitions:
- Completed phases remain `"in_progress"` in `active_workflow.phase_status`
- Newly activated phases remain `"pending"` in `active_workflow.phase_status`

**Evidence**: Reading state.json after Phase 01 completes shows `active_workflow.phase_status["01-requirements"]` still as `"in_progress"`.

### Symptom 3: Top-level `active_agent` stays stale

The orchestrator sets `active_agent` at workflow initialization (e.g., `"requirements-analyst"`). STEP 3e never updates this field when advancing to the next phase. After Phase 01 completes, `active_agent` still says `"requirements-analyst"` even though the workflow is on Phase 02 with a different agent.

### Symptom 4: `tasks.md` tasks never marked as complete

All tasks in `docs/isdlc/tasks.md` remain `[ ]` (unchecked) even after their corresponding phases complete. The Progress Summary table shows stale completion counts. Only Phase 01 was manually marked `[X]` in the initial plan generation; subsequent phases are never updated.

### Correctly-behaving hooks (for reference)

These hooks already read `active_workflow.current_phase` with correct priority:
- `phase-sequence-guard.cjs` (line 58)
- `plan-surfacer.cjs` (line 232)
- `constitutional-iteration-validator.cjs`
- `phase-transition-enforcer.cjs`
- `iteration-corridor.cjs` (line 248)
- `menu-tracker.cjs` (line 146)
- `test-watcher.cjs` (line 441)
- `gate-blocker.cjs` (line 549, the `if (activeWorkflow)` branch) -- correctly uses `activeWorkflow.current_phase || state.current_phase`

---

## Execution Path

### Path 1: Phase-Loop Controller STEP 3e (phase transition)

**Entry point**: `src/claude/commands/isdlc.md`, line 813

**Current update sequence** (lines 813-819):
```
3e. POST-PHASE STATE UPDATE -- After the phase agent returns successfully:
1. Read .isdlc/state.json
2. Set phases[phase_key].status = "completed"
3. Set phases[phase_key].summary = (extract from agent result, max 150 chars)
4. Set active_workflow.current_phase_index += 1
5. If more phases remain: set active_workflow.current_phase = phases[new_index],
   set phases[new_phase].status = "in_progress",
   set top-level current_phase = new phase key
6. Write .isdlc/state.json
```

**Fields updated**:
- `phases[completed_phase].status` = `"completed"` (line 815)
- `phases[completed_phase].summary` = extracted summary (line 816)
- `active_workflow.current_phase_index` += 1 (line 817)
- `active_workflow.current_phase` = next phase key (line 818)
- `phases[new_phase].status` = `"in_progress"` (line 818)
- `current_phase` (top-level) = new phase key (line 818)

**Fields NOT updated (the gap)**:
- `active_workflow.phase_status[completed_phase]` -- remains `"in_progress"` forever
- `active_workflow.phase_status[next_phase]` -- remains `"pending"` forever
- `active_agent` (top-level) -- remains as whatever was set at init
- `docs/isdlc/tasks.md` -- no checkbox updates, no Progress Summary table updates

### Path 2: Hook execution reading phase data

When any hook fires (e.g., on a Task or Bash tool call), it reads `state.json` and needs to know the current phase. The read patterns diverge:

**BUGGY pattern (6 hooks)**:
```javascript
// constitution-validator.cjs:245
let currentPhase = state.current_phase;

// delegation-gate.cjs:133
const currentPhase = state.current_phase || (state.active_workflow && state.active_workflow.current_phase);

// log-skill-usage.cjs:87
const currentPhase = state.current_phase || '01-requirements';

// skill-validator.cjs:95
const currentPhase = state.current_phase || '01-requirements';

// gate-blocker.cjs:578 (else branch)
currentPhase = state.current_phase;

// provider-utils.cjs:323
const currentPhase = state?.current_phase || 'unknown';
```

**CORRECT pattern (7 hooks)**:
```javascript
// gate-blocker.cjs:549 (if branch)
currentPhase = activeWorkflow.current_phase || state.current_phase;

// iteration-corridor.cjs:248
const currentPhase = state.active_workflow?.current_phase || state.current_phase;
```

### Path 3: tasks.md lifecycle

1. **Generation**: ORCH-012 `generate-plan` skill creates `docs/isdlc/tasks.md` with all phases and tasks as `[ ]`, except Phase 01 which is marked `[X]` during generation
2. **Read by plan-surfacer**: The `plan-surfacer.cjs` hook reads tasks.md to verify it exists before allowing implementation+ phases. It also validates format (v2.0 checks). It NEVER writes to tasks.md.
3. **Read by STEP 3e-refine**: The task refinement step reads tasks.md to refine Phase 06 tasks after Phase 04 (design) completes. It WRITES new refined tasks but does NOT update checkbox status.
4. **Read by agents**: Phase agents may read tasks.md to understand what tasks they should execute. They do NOT write back completion status.
5. **Update**: NOBODY updates task checkboxes or the Progress Summary table after phase transitions. This is the missing lifecycle step.

---

## Root Cause Analysis

### Hypothesis 1 (PRIMARY): STEP 3e missing writes -- Confidence: HIGH

**Root Cause**: The phase-loop controller STEP 3e (isdlc.md lines 813-819) was designed to update only the minimum fields needed for phase advancement. It was never extended to also update `active_workflow.phase_status`, `active_agent`, or `tasks.md`.

**Evidence**:
- Direct code inspection of lines 813-819 confirms only 6 field updates are specified
- `active_workflow.phase_status` is initialized by the orchestrator but never touched by STEP 3e
- `active_agent` is set once at init and never updated
- No mention of `tasks.md` in STEP 3e at all

**Fix**: Add 3 additional updates to STEP 3e:
1. `active_workflow.phase_status[completed_phase]` = `"completed"`
2. `active_workflow.phase_status[next_phase]` = `"in_progress"`
3. Top-level `active_agent` = agent name for next phase (using PHASE_AGENT_MAP or similar lookup)
4. Update `tasks.md`: mark completed phase tasks as `[X]`, update Progress Summary table

### Hypothesis 2 (SECONDARY): Hook read-priority inversion -- Confidence: HIGH

**Root Cause**: 6 hooks read `state.current_phase` (top-level) either exclusively or with inverted priority. This pattern pre-dates the `active_workflow` structure -- hooks were written when `state.current_phase` was the ONLY source of truth. When `active_workflow` was introduced, only some hooks were updated to prefer it.

**Evidence**:
- Direct code inspection of all 6 hooks shows the pattern
- 7 other hooks that were updated more recently correctly prefer `active_workflow`
- The `gate-blocker.cjs` even has BOTH patterns in the same file: the `if (activeWorkflow)` branch on line 549 is correct, but the `else` branch on line 578 only reads top-level

**Fix**: Update all 6 hooks to use the pattern:
```javascript
const currentPhase = (state.active_workflow && state.active_workflow.current_phase) || state.current_phase;
```

### Hypothesis 3 (TERTIARY): No tasks.md update mechanism -- Confidence: HIGH

**Root Cause**: The tasks.md lifecycle has a generation step (ORCH-012) and multiple read steps (plan-surfacer, agents, STEP 3e-refine) but no update step. Nobody owns the responsibility of marking tasks as `[X]` when phases complete.

**Evidence**:
- Grep for `[X]` or `[x]` writes in all hooks and isdlc.md reveals no update logic
- plan-surfacer.cjs only reads tasks.md for validation, never writes
- STEP 3e-refine writes NEW tasks (refined Phase 06) but does not update checkboxes
- Current tasks.md shows Phase 01 as `[X]` only because it was marked during initial generation

**Fix**: Add tasks.md update logic to STEP 3e, after the state.json writes. This should:
1. Read `docs/isdlc/tasks.md` if it exists
2. Find the section for the completed phase
3. Change `- [ ] TNNNN ...` to `- [X] TNNNN ...` for all tasks in that section
4. Update the section header from `-- PENDING` to `-- COMPLETE`
5. Recalculate and update the Progress Summary table
6. Write the updated tasks.md back

### Rejected Hypotheses

- **Race condition between hooks**: Rejected. Hooks run sequentially within Claude Code's hook protocol; only one hook executes at a time. The staleness is from design gaps, not timing.
- **File write failure**: Rejected. STEP 3e successfully writes state.json (the fields it does update are correct); the issue is missing writes, not failed writes.
- **Monorepo mode interference**: Rejected. The `resolveTasksPath()` function in common.cjs correctly resolves paths in both single-project and monorepo modes. The issue is that nobody calls the write path at all.

---

## Suggested Fixes

### Fix 1: Update STEP 3e in isdlc.md (FR-01, FR-02, FR-04)

Add these steps after the existing step 5 in STEP 3e:

```
5a. Set active_workflow.phase_status[completed_phase] = "completed"
5b. If more phases remain:
    - Set active_workflow.phase_status[next_phase] = "in_progress"
    - Set top-level active_agent = agent for next phase (use PHASE_AGENT_MAP)
5c. If docs/isdlc/tasks.md exists:
    - Mark all tasks in completed phase section as [X]
    - Update section header to "-- COMPLETE"
    - Recalculate Progress Summary table
```

**Complexity**: LOW -- this is prompt text in isdlc.md, not executable code

### Fix 2: Update 6 hooks for correct read priority (FR-03)

For each hook, change to:
```javascript
const currentPhase = (state.active_workflow && state.active_workflow.current_phase) || state.current_phase || fallback;
```

Files and lines:
1. `src/claude/hooks/constitution-validator.cjs` line 245
2. `src/claude/hooks/delegation-gate.cjs` line 133
3. `src/claude/hooks/log-skill-usage.cjs` line 87
4. `src/claude/hooks/skill-validator.cjs` line 95
5. `src/claude/hooks/gate-blocker.cjs` line 578
6. `src/claude/hooks/lib/provider-utils.cjs` line 323

**Complexity**: LOW -- single-line changes per file

### Fix 3: Backward compatibility (FR-05, FR-06)

No additional work needed -- the fixes above:
- Continue writing top-level fields (STEP 3e already writes `current_phase` and `phases{}`)
- Add the missing top-level `active_agent` write
- Hooks that write to `state.phases[currentPhase]` will now resolve `currentPhase` correctly from `active_workflow` first

---

## Tracing Metadata

```json
{
  "tracing_completed_at": "2026-02-12T11:00:00Z",
  "sub_agents": ["T1-symptom-analyzer", "T2-execution-path-tracer", "T3-root-cause-identifier"],
  "discovery_report_used": "docs/project-discovery-report.md",
  "error_keywords": ["stale", "current_phase", "active_workflow", "phase_status", "active_agent", "tasks.md", "STEP 3e"],
  "files_examined": [
    "src/claude/commands/isdlc.md",
    "src/claude/hooks/lib/common.cjs",
    "src/claude/hooks/constitution-validator.cjs",
    "src/claude/hooks/delegation-gate.cjs",
    "src/claude/hooks/log-skill-usage.cjs",
    "src/claude/hooks/skill-validator.cjs",
    "src/claude/hooks/gate-blocker.cjs",
    "src/claude/hooks/lib/provider-utils.cjs",
    "src/claude/hooks/plan-surfacer.cjs",
    "docs/isdlc/tasks.md"
  ],
  "hypotheses_count": 3,
  "rejected_hypotheses_count": 3,
  "primary_root_cause": "STEP 3e missing writes to active_workflow.phase_status, active_agent, and tasks.md",
  "secondary_root_cause": "6 hooks read top-level state.current_phase with wrong priority or exclusively",
  "tertiary_root_cause": "No mechanism exists to update tasks.md checkbox status after plan generation"
}
```
