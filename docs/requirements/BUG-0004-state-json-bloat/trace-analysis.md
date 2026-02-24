# Trace Analysis: BUG-0004 — state.json Bloat

## Summary

`state.json` is currently 1624 lines / 64,646 bytes. Three fields account for 86% of the file:

| Field | Size | % of Total | Entries |
|-------|------|------------|---------|
| `skill_usage_log` | 21,333 bytes | 33.0% | 64 entries |
| `history` | 17,371 bytes | 26.9% | 33 entries |
| `phases` | 16,877 bytes | 26.1% | 13 phase objects |
| `workflow_history` | 2,303 bytes | 3.6% | 4 entries |
| **Everything else** | **6,762 bytes** | **10.4%** | — |

---

## 1. Complete Map of state.json Readers and Writers

### 1.1 WRITERS (code that mutates state.json)

| Writer | File | Mechanism | Fields Written |
|--------|------|-----------|----------------|
| **log-skill-usage.cjs** | `src/claude/hooks/log-skill-usage.cjs` | `appendSkillLog()` (read-modify-write) | `skill_usage_log[]` — appends one entry per Task tool call |
| **test-watcher.cjs** | `src/claude/hooks/test-watcher.cjs` | `writeState()` after modifying `phases[].iteration_requirements.test_iteration` | `phases[phase].iteration_requirements.test_iteration` — creates/updates iteration state, appends to `history[]` sub-array |
| **menu-tracker.cjs** | `src/claude/hooks/menu-tracker.cjs` | `writeState()` after modifying `phases[].iteration_requirements.interactive_elicitation` | `phases['01-requirements'].iteration_requirements.interactive_elicitation` — tracks A/R/C menu interactions |
| **gate-blocker.cjs** | `src/claude/hooks/gate-blocker.cjs` | `writeState()` for gate validation, `writePendingEscalation()` | `phases[phase].gate_validation`, `pending_escalations[]`, `pending_triggers[]` |
| **constitution-validator.cjs** | `src/claude/hooks/constitution-validator.cjs` | `writeState()` to init constitutional validation, `writePendingEscalation()` | `phases[phase].constitutional_validation`, `pending_escalations[]` |
| **iteration-corridor.cjs** | `src/claude/hooks/iteration-corridor.cjs` | `writePendingEscalation()` only | `pending_escalations[]` |
| **skill-delegation-enforcer.cjs** | `src/claude/hooks/skill-delegation-enforcer.cjs` | `writePendingDelegation()` | `pending_delegation` |
| **delegation-gate.cjs** | `src/claude/hooks/delegation-gate.cjs` | `clearPendingDelegation()` | `pending_delegation` (sets to null) |
| **common.cjs** (`logHookEvent`) | `src/claude/hooks/lib/common.cjs` | `fs.appendFileSync()` to hook-activity.log | `.isdlc/hook-activity.log` (NOT state.json — separate log file) |
| **SDLC Orchestrator (Agent 00)** | `src/claude/agents/00-sdlc-orchestrator.md` | Agent writes via Write/Edit tools | `active_workflow`, `workflow_history[]`, `current_phase`, `phases[].status`, `counters`, `constitution`, `history[]`, `active_agent`, `phases[].constitutional_validation`, `phases[].artifacts` |
| **Phase Agents (01-14)** | `src/claude/agents/*.md` | Agents write via Write/Edit tools | `phases[phase].status`, `phases[phase].artifacts`, `phases[phase].constitutional_validation`, `phases[phase].iteration_requirements` |
| **Discover Orchestrator** | `src/claude/agents/discover-orchestrator.md` | Agent writes via Write/Edit tools | `project.*`, `discovery_context`, `discovery_context.walkthrough_completed` |
| **isdlc.md (Phase-Loop Controller)** | `src/claude/commands/isdlc.md` | Reads state.json to check `pending_escalations[]`, does not write directly (delegates to orchestrator) | (reader only in practice) |
| **installer.js** | `lib/installer.js` | `writeJson()` — creates initial state.json | All fields (initial template) |
| **updater.js** | `lib/updater.js` | Deep-merge of `state.json` during updates | `framework_version`, `history[]` |

### 1.2 READERS (code that reads state.json)

| Reader | File | Fields Read | Purpose |
|--------|------|-------------|---------|
| **skill-validator.cjs** | PreToolUse hook | `skill_enforcement.{enabled,mode,fail_behavior}`, `current_phase` | Check enforcement mode |
| **log-skill-usage.cjs** | PostToolUse hook | `skill_enforcement.{enabled,mode}`, `current_phase`, `skill_usage_log` (full array to append) | Log delegation |
| **gate-blocker.cjs** | PreToolUse hook | `iteration_enforcement.enabled`, `active_workflow.{current_phase,type,current_phase_index}`, `phases[phase].{iteration_requirements,constitutional_validation,gate_validation}`, `skill_usage_log` (for agent delegation check), `cloud_configuration.provider` | Gate validation |
| **iteration-corridor.cjs** | PreToolUse hook | `iteration_enforcement.enabled`, `active_workflow.current_phase`, `current_phase`, `phases[phase].iteration_requirements.test_iteration`, `phases[phase].constitutional_validation`, `iteration_config` | Corridor enforcement |
| **constitution-validator.cjs** | PreToolUse hook | `iteration_enforcement.enabled`, `current_phase`, `phases[phase].constitutional_validation` | Block until constitutional validation done |
| **test-watcher.cjs** | PostToolUse hook | `iteration_enforcement.enabled`, `active_workflow`, `current_phase`, `phases[phase].iteration_requirements.test_iteration`, `iteration_config`, `active_workflow.atdd_mode` | Track test iterations |
| **menu-tracker.cjs** | PostToolUse hook | `active_workflow`, `current_phase`, `iteration_enforcement.enabled`, `phases['01-requirements'].iteration_requirements.interactive_elicitation` | Track menu interactions |
| **model-provider-router.cjs** | PreToolUse hook | `current_phase` | Phase-based provider routing |
| **review-reminder.cjs** | PostToolUse hook | `code_review.{enabled,team_size}` | Warn if review disabled |
| **state-write-validator.cjs** | PostToolUse hook | `phases[*].constitutional_validation`, `phases[*].iteration_requirements.interactive_elicitation`, `phases[*].iteration_requirements.test_iteration` | Detect fabricated state writes |
| **plan-surfacer.cjs** | PreToolUse hook | `active_workflow.current_phase` | Check if task plan exists |
| **phase-loop-controller.cjs** | PreToolUse hook | `active_workflow.current_phase`, `phases[phase].status` | Ensure phase task marked in_progress |
| **phase-sequence-guard.cjs** | PreToolUse hook | `active_workflow.current_phase` | Block out-of-order delegation |
| **branch-guard.cjs** | PreToolUse hook | `active_workflow.git_branch.{name,status}` | Block commits to main |
| **walkthrough-tracker.cjs** | PostToolUse hook | `discovery_context.walkthrough_completed` | Warn if walkthrough skipped |
| **test-adequacy-blocker.cjs** | PreToolUse hook | `active_workflow.current_phase`, `discovery_context.coverage_summary` | Block upgrade without tests |
| **constitutional-iteration-validator.cjs** | PreToolUse hook | `active_workflow.current_phase`, `phases[phase].constitutional_validation.{completed,iterations_used,status,articles_checked}` | Validate constitutional iteration |
| **explore-readonly-enforcer.cjs** | PreToolUse hook | `chat_explore_active` | Block writes in explore mode |
| **atdd-completeness-validator.cjs** | PostToolUse hook | `active_workflow.{current_phase,options.atdd_mode,atdd_mode}` | Check ATDD priority ordering |
| **phase-transition-enforcer.cjs** | PostToolUse hook | `active_workflow.current_phase` | Detect permission-asking patterns |
| **delegation-gate.cjs** | Stop hook | `pending_delegation`, `skill_usage_log` (scans for delegation after timestamp) | Verify orchestrator delegation |
| **SDLC Orchestrator** | Agent | `active_workflow.*`, `workflow_history[]`, `constitution.*`, `current_phase`, `phases.*`, `counters.*`, `cloud_configuration.*`, `code_review.*`, `discovery_context.*`, `project.*` | Workflow coordination |
| **isdlc.md** | Command | `pending_escalations[]`, `active_workflow`, `current_phase`, `project.is_new_project`, `workflow_history[]` | Phase loop, menus, backlog picker |
| **doctor.js** | CLI | `framework_version`, `skill_enforcement.*`, `iteration_enforcement.*` | Health check |

---

## 2. Field-by-Field Analysis

### 2.1 Fields Needed at Runtime

| Field | Size | Needed By | Runtime Essential? | Can Prune on Completion? |
|-------|------|-----------|--------------------|-------------------------|
| `framework_version` | 13 B | updater, doctor | YES | NO |
| `project` | 702 B | orchestrator, discover, hooks | YES | NO |
| `complexity_assessment` | 281 B | orchestrator | YES | NO |
| `workflow` | 141 B | orchestrator | YES | NO |
| `constitution` | 296 B | orchestrator, hooks | YES | NO |
| `autonomous_iteration` | 117 B | orchestrator | YES | NO |
| `skill_enforcement` | 101 B | skill-validator, log-skill-usage | YES | NO |
| `cloud_configuration` | 265 B | gate-blocker, orchestrator | YES | NO |
| `iteration_enforcement` | 21 B | all iteration hooks | YES | NO |
| `code_review` | ~50 B | review-reminder, orchestrator | YES | NO |
| `counters` | 42 B | orchestrator | YES | NO |
| `current_phase` | 17 B | 12+ hooks, orchestrator | YES | NO |
| `active_workflow` | 1,144 B | 15+ hooks, orchestrator, isdlc.md | YES (during workflow) | YES — null when no workflow |
| `active_agent` | 22 B | orchestrator | YES | NO |
| `blockers` | 2 B | orchestrator | YES | NO |
| `pending_delegation` | ~0 B | delegation hooks | YES (transient) | Auto-clears |
| `pending_escalations` | ~0 B | phase-loop controller | YES (transient) | Auto-clears |
| `pending_triggers` | ~0 B | gate-blocker | YES (transient) | Auto-clears |
| **`skill_usage_log`** | **21,333 B** | **gate-blocker** (delegation check), **delegation-gate** (scan for delegation) | **PARTIAL** — only last ~5 entries needed for delegation check | **YES — prune to last 20** |
| **`history`** | **17,371 B** | **orchestrator** (append-only), **updater** (append) | **NO at runtime** — purely historical | **YES — cap at 50, truncate entries** |
| **`phases`** | **16,877 B** | **All iteration hooks, gate-blocker, orchestrator** | **PARTIAL** — only current workflow phases need detail | **YES — strip completed phase internals** |
| **`workflow_history`** | **2,303 B** | **Backlog picker** (cancelled workflows), **orchestrator** (log) | **PARTIAL** — only `description`, `status`, `type`, `cancelled_at_phase` needed | **YES — truncate descriptions, cap entries** |

### 2.2 Bloat Sources (Ranked)

**Source 1: `skill_usage_log` (33% of file, 21,333 bytes)**

- Every `Task` tool call appends one ~330 byte entry via `log-skill-usage.cjs`
- Unbounded growth — never pruned
- A single workflow can generate 15-30 entries (one per phase agent delegation + sub-delegations)
- After 4 workflows: 64 entries and growing
- **Runtime need**: `gate-blocker.cjs` line 373 scans the FULL array to check if expected agent was delegated. `delegation-gate.cjs` line 40-56 scans for delegation after a timestamp.
- **Fix**: Both consumers only need recent entries. Gate-blocker only checks current phase. Delegation-gate only checks entries after `pending_delegation.invoked_at`.

**Source 2: `history` (27% of file, 17,371 bytes)**

- Orchestrator and agents append entries with unbounded `action` strings (up to 1,093 bytes each)
- Never pruned, never capped
- Contains verbose descriptions of gate passage, phase completion, etc.
- **Runtime need**: NONE. No hook or command reads `history[]` at runtime. Only the updater appends to it.
- **Fix**: Cap at 50 entries with FIFO. Truncate `action` field to 200 chars.

**Source 3: `phases` (26% of file, 16,877 bytes)**

- Each phase accumulates `iteration_requirements.test_iteration` with a full `history[]` sub-array of every test run command, result, error, and timestamp
- Each phase accumulates `constitutional_validation` with `history[]`, `articles_checked[]`, `articles_required[]`
- Each phase accumulates `artifacts[]` with full file paths
- Phases from PREVIOUS workflows persist and are never cleaned up
- **Runtime need**: Hooks need `phases[CURRENT_PHASE].iteration_requirements` and `phases[CURRENT_PHASE].constitutional_validation` during active iteration. After gate passes, only `status`, `started`, `completed`, `gate_passed`, and `artifacts` are referenced.
- **Fix**: On workflow completion, strip `iteration_requirements`, `constitutional_validation`, `gate_validation`, `testing_environment`, `verification_summary`, `atdd_validation` from completed phases. On workflow initialization, reset `phases` to only include the new workflow's phases.

**Source 4: `workflow_history` (4% of file, 2,303 bytes)**

- Grows with each completed/cancelled workflow
- Includes full `description`, `git_branch` object, phase details
- **Runtime need**: Backlog picker reads `description`, `status`, `type`, `cancelled_at_phase`, `cancellation_reason`
- **Fix**: Cap at 50 entries with FIFO. Truncate `description` to 200 chars. Strip `git_branch` detail (keep only `name`).

---

## 3. Code Path Analysis: What Causes Bloat

### 3.1 `skill_usage_log` Append Path

```
User invokes any Task tool
  → Claude Code fires PostToolUse hooks
    → log-skill-usage.cjs runs
      → readState() — reads ENTIRE state.json into memory
      → Creates 330-byte log entry
      → appendSkillLog(entry) → calls readState() AGAIN, pushes, writeState()
        → writeState() — writes ENTIRE state.json back
```

**Problem**: Every single Task delegation does a full read-modify-write cycle on the entire 64KB file. The `appendSkillLog()` function in `common.cjs` line 633-645 reads state, pushes to array, writes state. No pruning, no size check.

### 3.2 `test_iteration.history` Append Path

```
User runs test command (npm test, pytest, etc.)
  → Claude Code fires PostToolUse hooks
    → test-watcher.cjs runs
      → readState() — reads ENTIRE state.json
      → Creates history entry with command, result, error, timestamp
      → Pushes to phases[phase].iteration_requirements.test_iteration.history[]
      → writeState() — writes ENTIRE state.json back
```

**Problem**: Each test run appends a history entry to the phase's test iteration. A phase with 7 iterations (like `10-cicd`) accumulates 7 entries with full command strings. This data is NEVER pruned after the phase completes.

### 3.3 `history` Append Path

```
Orchestrator or Agent completes action
  → Agent writes state.json via Write/Edit tool
  → Appends to history[] with timestamp, agent, action (up to 1KB string)
```

**Problem**: `action` strings are often multi-sentence verbose descriptions of what was accomplished. No length cap. No entry cap. Old entries never removed.

### 3.4 `phases` Stale Data Path

```
Workflow 1 completes: phases = { '01-requirements': {...big}, '06-implementation': {...big}, ... }
Workflow 2 starts: phases still contains ALL data from Workflow 1
  → New phase data accumulates on top of old data
  → After 4 workflows: phases contains data from ALL 4 workflows
```

**Problem**: The orchestrator NEVER resets `phases` when starting a new workflow. It only sets the `status` of workflow phases to `in_progress`/`pending`. All iteration_requirements, constitutional_validation, artifacts, etc. from previous workflows persist forever.

---

## 4. Recommended Pruning Insertion Points

### FIX-001: Prune `skill_usage_log` on workflow completion

**Where**: `common.cjs` — add a new function `pruneSkillUsageLog(state, keepCount = 20)`

**When to call**: Two insertion points:
1. **Orchestrator workflow completion** — After moving workflow to `workflow_history` and setting `active_workflow` to null (Section 4 of orchestrator, "Workflow Completion" step 4-5)
2. **New `pruneStateOnCompletion()` helper in `common.cjs`** — called by the orchestrator or a new hook

**Implementation**:
```javascript
function pruneSkillUsageLog(state, keepCount = 20) {
    if (!Array.isArray(state.skill_usage_log)) return state;
    if (state.skill_usage_log.length <= keepCount) return state;
    state.skill_usage_log = state.skill_usage_log.slice(-keepCount);
    return state;
}
```

**Consumer impact**:
- `gate-blocker.cjs` line 373: Only checks for current phase agent — recent 20 entries more than sufficient
- `delegation-gate.cjs` line 40: Only checks entries after `pending_delegation.invoked_at` — recent entries only

### FIX-002: Prune verbose phase sub-objects on workflow completion

**Where**: `common.cjs` — add a new function `pruneCompletedPhases(state)`

**When to call**: Same as FIX-001 — on workflow completion, after moving to `workflow_history`

**Implementation**:
```javascript
function pruneCompletedPhases(state) {
    if (!state.phases) return state;

    // Fields to strip from completed phases
    const STRIP_FIELDS = [
        'iteration_requirements',
        'constitutional_validation',
        'gate_validation',
        'testing_environment',
        'verification_summary',
        'atdd_validation'
    ];

    for (const [phaseName, phaseData] of Object.entries(state.phases)) {
        // Only prune phases that are completed or have gate_passed
        if (phaseData.status === 'completed' || phaseData.gate_passed) {
            for (const field of STRIP_FIELDS) {
                delete phaseData[field];
            }
        }
    }
    return state;
}
```

**Consumer impact**: No hook reads these sub-fields from completed phases. Hooks only check `phases[CURRENT_PHASE]`, which is always in `in_progress` status during the active workflow.

### FIX-003: Compact `history` entries with 200-char cap and 50-entry FIFO

**Where**: `common.cjs` — add a new function `pruneHistory(state, maxEntries = 50, maxActionLength = 200)`

**When to call**: Same as FIX-001 — on workflow completion

**Implementation**:
```javascript
function pruneHistory(state, maxEntries = 50, maxActionLength = 200) {
    if (!Array.isArray(state.history)) return state;

    // Truncate action field
    for (const entry of state.history) {
        if (entry.action && entry.action.length > maxActionLength) {
            entry.action = entry.action.substring(0, maxActionLength) + '...';
        }
    }

    // FIFO cap
    if (state.history.length > maxEntries) {
        state.history = state.history.slice(-maxEntries);
    }

    return state;
}
```

Also apply to `workflow_history`:
```javascript
function pruneWorkflowHistory(state, maxEntries = 50, maxDescLength = 200) {
    if (!Array.isArray(state.workflow_history)) return state;

    for (const entry of state.workflow_history) {
        if (entry.description && entry.description.length > maxDescLength) {
            entry.description = entry.description.substring(0, maxDescLength) + '...';
        }
        // Strip git_branch detail, keep only name
        if (entry.git_branch && typeof entry.git_branch === 'object') {
            entry.git_branch = { name: entry.git_branch.name };
        }
    }

    if (state.workflow_history.length > maxEntries) {
        state.workflow_history = state.workflow_history.slice(-maxEntries);
    }

    return state;
}
```

**Consumer impact**:
- `history[]` — no consumer reads this at runtime
- `workflow_history[]` — backlog picker reads `description` (truncated to 80 chars for display anyway), `status`, `type`, `cancelled_at_phase`, `cancellation_reason`

### FIX-004: Reset `phases` when initializing a new workflow

**Where**: Orchestrator agent — Section 3 "Workflow Selection & Initialization", step 3

**When to call**: Before writing `active_workflow` to state.json for a new workflow

**Implementation approach**: In the orchestrator's initialization logic, before writing the new workflow:
1. Clear all existing phase data: `state.phases = {}`
2. Initialize only the phases in the new workflow's phase array with clean skeleton objects:
   ```json
   { "status": "pending", "started": null, "completed": null, "gate_passed": null, "artifacts": [] }
   ```

**Also add to `common.cjs`**:
```javascript
function resetPhasesForWorkflow(state, workflowPhases) {
    state.phases = {};
    for (const phase of workflowPhases) {
        state.phases[phase] = {
            status: 'pending',
            started: null,
            completed: null,
            gate_passed: null,
            artifacts: []
        };
    }
    return state;
}
```

**Consumer impact**: This is the highest-impact fix. Stale phase data from previous workflows is the primary source of accumulated bloat. No hook needs phase data from previous workflows.

### Combined Pruning Function

Add a single entry-point in `common.cjs`:

```javascript
function pruneStateOnWorkflowCompletion(state) {
    pruneSkillUsageLog(state, 20);
    pruneCompletedPhases(state);
    pruneHistory(state, 50, 200);
    pruneWorkflowHistory(state, 50, 200);
    return state;
}
```

---

## 5. Data Flow Diagram

```
                    INITIAL STATE (installer.js)
                    ~2,500 bytes, clean template
                            |
                            v
                +-----------------------+
                |    state.json         |
                |  (.isdlc/state.json)  |
                +-----------+-----------+
                            |
        +------- WRITES ----+---- READS --------+
        |                   |                    |
        v                   v                    v
  +-----------+     +-------------+     +-----------------+
  |   HOOKS   |     |   AGENTS    |     | HOOKS (read-only)|
  | (CJS)     |     |  (MD+Tools) |     |                 |
  +-----------+     +-------------+     +-----------------+
  |                 |                   |
  | log-skill-usage | Orchestrator      | skill-validator
  |   -> skill_     |   -> active_      | model-provider-router
  |      usage_log  |      workflow     | review-reminder
  |   (UNBOUNDED    |   -> workflow_    | plan-surfacer
  |    APPEND)      |      history      | phase-loop-controller
  |                 |   -> phases       | phase-sequence-guard
  | test-watcher    |   -> history      | branch-guard
  |   -> phases[]   |   -> counters     | walkthrough-tracker
  |      .iter_req  |   -> current_     | test-adequacy-blocker
  |      .test_iter |      phase        | const-iter-validator
  |   (UNBOUNDED    |                   | explore-readonly
  |    HISTORY)     | Phase Agents      | atdd-completeness
  |                 |   -> phases[]     | phase-transition
  | menu-tracker    |      .status      |
  |   -> phases[]   |      .artifacts   |
  |      .iter_req  |      .const_val   |
  |      .interact  |                   |
  |                 | Discover Orch     |
  | gate-blocker    |   -> project      |
  |   -> phases[]   |   -> discovery_   |
  |      .gate_val  |      context      |
  |   -> pending_   |                   |
  |      triggers   |                   |
  |                 |                   |
  | const-validator |                   |
  |   -> phases[]   |                   |
  |      .const_val |                   |
  |                 |                   |
  | skill-deleg-enf |                   |
  |   -> pending_   |                   |
  |      delegation |                   |
  |                 |                   |
  | delegation-gate |                   |
  |   -> pending_   |                   |
  |      delegation |                   |
  |   -> skill_     |                   |
  |      usage_log  |                   |
  +-----------+     +-------------+     +-----------------+
              |           |
              v           v
        +---------------------------+
        | BLOAT ACCUMULATES:        |
        | 1. skill_usage_log grows  |
        |    +330 bytes/Task call   |
        |    NEVER PRUNED           |
        |                           |
        | 2. phases[].iter_req      |
        |    history[] grows        |
        |    NEVER PRUNED           |
        |    STALE PHASES PERSIST   |
        |                           |
        | 3. history[] grows        |
        |    +500 bytes/action      |
        |    NEVER PRUNED           |
        |                           |
        | 4. workflow_history grows  |
        |    +500 bytes/workflow    |
        |    NEVER PRUNED           |
        +---------------------------+
```

---

## 6. Estimated Impact

### Current State (after 4 workflows)
- `state.json`: 64,646 bytes (1,624 lines)
- Fills agent context with ~16KB of irrelevant historical data per agent invocation

### After Fixes (projected)
| Fix | Bytes Saved | % Reduction |
|-----|-------------|-------------|
| FIX-001: Prune skill_usage_log to 20 | ~15,000 B | 23% |
| FIX-002: Strip completed phase internals | ~12,000 B | 19% |
| FIX-003: Cap history + truncate | ~14,000 B | 22% |
| FIX-004: Reset phases on new workflow | ~10,000 B | 15% |
| **Combined** | **~45,000 B** | **~70%** |

Projected steady-state size after fixes: ~15,000-20,000 bytes (375-500 lines)

### Growth Rate After Fixes
- Per workflow: ~3,000 bytes (active_workflow + current phase data)
- Per workflow completion: net zero (pruning removes what was added)
- Long-term steady state: bounded at ~20KB regardless of workflow count

---

## 7. Risk Assessment

| Fix | Risk | Mitigation |
|-----|------|------------|
| FIX-001 | Delegation-gate may miss old delegations | Only checks entries after `invoked_at` timestamp — 20 recent entries always sufficient |
| FIX-002 | Lost debugging info from completed phases | Phase data is only needed during active iteration; gate-blocker never checks completed phases |
| FIX-003 | Truncated history may lose context | History is never read programmatically at runtime; purely for human reference |
| FIX-004 | Loss of phase data from prior workflows | No hook or agent ever reads phase data from a prior workflow; stale data causes confusion |

All fixes are **safe** because:
1. No hook reads `history[]` at runtime
2. No hook reads `phases[X]` where X is not the current active phase
3. `skill_usage_log` consumers only need recent entries (within current workflow)
4. `workflow_history` consumers only need summary fields

---

## 8. Files to Modify

| File | Changes |
|------|---------|
| `src/claude/hooks/lib/common.cjs` | Add 4 pruning functions + `pruneStateOnWorkflowCompletion()` export |
| `src/claude/hooks/lib/common.cjs` | Add `resetPhasesForWorkflow()` export |
| `src/claude/agents/00-sdlc-orchestrator.md` | Call `pruneStateOnWorkflowCompletion()` on workflow completion (Section 4); call `resetPhasesForWorkflow()` on workflow init (Section 3) |
| `src/claude/hooks/tests/common.test.cjs` | Tests for all 4 pruning functions |

No changes needed to any other hook file — all hooks are read-only consumers of the fields being pruned, and they only read current-phase data.
