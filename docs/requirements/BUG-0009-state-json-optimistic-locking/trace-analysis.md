# Trace Analysis: State.json Optimistic Locking

**Generated**: 2026-02-12T16:00:00Z
**Bug**: Subagents overwrite state.json with stale data during iSDLC workflows
**External ID**: BUG-0009
**Workflow**: fix
**Phase**: 02-tracing

---

## Executive Summary

The root cause is a complete absence of version control on state.json writes. The `writeState()` function in `common.cjs` (line 645) performs a blind `fs.writeFileSync()` with no conflict detection, and the `state-write-validator` hook (which fires on every Write/Edit to state.json) only validates structural integrity -- it never checks whether the writer's data is based on a current read. This creates a classic last-writer-wins race condition: when a subagent receives state.json content in its prompt context and later writes back updates based on that stale snapshot, it silently overwrites any changes the parent orchestrator made in the interim.

**Root Cause Confidence**: HIGH
**Severity**: CRITICAL
**Estimated Complexity**: LOW (targeted changes to 2 files + tests)

---

## Symptom Analysis

### Error Messages and Manifestations

No programmatic errors are thrown. The bug is silent -- writes succeed with exit code 0 and no warnings. The symptoms manifest as state corruption observable only by subsequent hook enforcement failures:

1. **active_workflow reversion**: After the orchestrator sets `active_workflow` to BUG-0008, a subagent writes back its stale snapshot containing REQ-0010, reverting the workflow identity
2. **branch-guard blocks**: The `branch-guard` hook reads `active_workflow.git_branch.name` and finds a stale feature branch reference, blocking commits to `main`
3. **Phase status rollback**: `current_phase`, `active_agent`, `phase_status` all revert to values from the subagent's launch-time snapshot
4. **Manual intervention**: User must manually edit state.json 3+ times per workflow session to recover

### Triggering Conditions

The bug is triggered by this specific sequence:

1. Parent orchestrator updates state.json (e.g., sets `active_workflow` to a new workflow)
2. Subagent (launched earlier) still holds a stale copy of state.json from its prompt context
3. Subagent writes/edits state.json using its stale data
4. The parent's changes are silently overwritten

This is NOT intermittent -- it happens deterministically whenever a parent and subagent have overlapping write windows to state.json.

### Affected Components

| Component | Impact |
|-----------|--------|
| `active_workflow` | Reverted to previous workflow |
| `active_workflow.git_branch` | Stale branch reference causes branch-guard blocks |
| `current_phase` | Reverts to stale phase |
| `active_agent` | Reverts to stale agent |
| `phases.*` | Phase status data overwritten |
| `skill_usage_log` | May lose recent entries |
| `history` | May lose recent entries |

---

## Execution Path

### Entry Points: All State.json Write Paths

There are **18 call sites** across the codebase that invoke `writeState()`. These fall into three categories:

#### Category 1: Dispatcher-Mediated Writes (Hooks)

The dispatchers read state once, pass it to multiple hooks via `ctx.state`, then write once at the end if any hook set `stateModified: true`.

| Dispatcher | File | Line | Hooks That Modify State |
|-----------|------|------|------------------------|
| `post-task-dispatcher` | `dispatchers/post-task-dispatcher.cjs` | 111 | `log-skill-usage` (appends to skill_usage_log), `menu-tracker` (writes menu state) |
| `post-bash-dispatcher` | `dispatchers/post-bash-dispatcher.cjs` | 100 | `test-watcher` (writes iteration tracking) |
| `pre-task-dispatcher` | `dispatchers/pre-task-dispatcher.cjs` | 143, 161 | `delegation-gate` (writes pending_delegation), `skill-delegation-enforcer` (escalation) |
| `pre-skill-dispatcher` | `dispatchers/pre-skill-dispatcher.cjs` | 90, 108 | Various pre-skill hooks |

#### Category 2: Self-Managed Writes (Hooks that bypass dispatcher state)

| Hook | File | Line | Write Pattern |
|------|------|------|--------------|
| `workflow-completion-enforcer` | `workflow-completion-enforcer.cjs` | 170 | Reads fresh from disk, writes independently (ignores ctx.state) |
| `delegation-gate` | `delegation-gate.cjs` | 69, 167, 179 | Reads/writes state directly in standalone mode |

#### Category 3: Common Utility Convenience Functions

| Function | File | Lines | Callers |
|----------|------|-------|---------|
| `appendSkillLog()` | `common.cjs` | 679 | Standalone log-skill-usage |
| `writePendingEscalation()` | `common.cjs` | 933 | Standalone hooks |
| `clearPendingEscalations()` | `common.cjs` | 955 | Orchestrator cleanup |
| `writePendingDelegation()` | `common.cjs` | 980 | Standalone delegation-gate |
| `clearPendingDelegation()` | `common.cjs` | 990 | Orchestrator cleanup |

#### Category 4: Agent-Initiated Writes (The Primary Bug Vector)

Agents (subagents) write to state.json directly using the Write or Edit tool. These writes:
- Bypass the `writeState()` function entirely (they use Claude Code's Write/Edit tool, not the Node.js function)
- Are intercepted by the `post-write-edit-dispatcher` which calls `state-write-validator`
- The validator currently only checks structural integrity (V1, V2, V3 rules), NOT version conflicts

### The Critical Data Flow (Bug Reproduction)

```
Time T0: Parent orchestrator reads state.json
          state.active_workflow = { id: "REQ-0010", ... }

Time T1: Parent launches subagent via Task tool
          Subagent receives state.json SNAPSHOT in prompt context
          Snapshot contains: active_workflow = { id: "REQ-0010" }

Time T2: Parent updates state.json
          state.active_workflow = { id: "BUG-0008", ... }
          (writeState succeeds, file now has BUG-0008)

Time T3: Subagent finishes work, writes state.json using Write tool
          Subagent's data still contains: active_workflow = { id: "REQ-0010" }
          (Write succeeds! No version check exists.)

Time T4: state.json on disk now has active_workflow = REQ-0010
          Parent's BUG-0008 changes are LOST
```

### The Validation Gap

The `state-write-validator.cjs` hook fires at Time T3 (PostToolUse[Write]) but its `check()` function (line 97-159) only:

1. Checks if the file is a state.json (line 113)
2. Reads the just-written file from disk (line 121-127)
3. Validates structural integrity of phase data (V1, V2, V3 rules) (line 136-147)

It does NOT:
- Compare the written version against a previous version
- Check any version counter
- Detect stale data
- Block any writes (decision is always 'allow', per line 150/154)

---

## Root Cause Analysis

### Primary Hypothesis (Confidence: HIGH)

**No optimistic locking mechanism exists for state.json.** The `writeState()` function performs a blind overwrite, and the `state-write-validator` hook only validates structure, not freshness.

Evidence:
- `writeState()` at `common.cjs:645-660` has zero conflict detection logic
- `state-write-validator.cjs` always returns `{ decision: 'allow' }` -- it can never block
- No `state_version` field exists in the current state.json schema
- No compare-and-swap pattern anywhere in the codebase

### Secondary Hypothesis (Confidence: MEDIUM)

**Dispatchers that read state once and write once create amplified stale-write windows.** The `post-task-dispatcher` reads state at line 79, passes it through 6 hooks, then writes at line 111. If another process writes state.json between the read and write, those changes are lost.

Evidence:
- `post-task-dispatcher.cjs:79` reads state once
- `post-task-dispatcher.cjs:111` writes state after all hooks complete
- Same pattern in `post-bash-dispatcher.cjs:70` -> `post-bash-dispatcher.cjs:100`
- Time between read and write could be 10-50ms (hook execution time)

This is a lower-priority concern because dispatchers run synchronously within a single Claude Code tool call, so the window is very small. The primary vector (agent Write tool calls) has windows of minutes to hours.

### Tertiary Hypothesis (Confidence: LOW)

**The `workflow-completion-enforcer` already recognizes the staleness problem** -- it explicitly reads fresh state from disk (line 89) rather than using ctx.state. This is a workaround for the same underlying issue, confirming the pattern is known but not systematically addressed.

Evidence:
- Comment at `workflow-completion-enforcer.cjs:17-19`: "This hook MUST do its own readState() and writeState() internally"
- Comment at `workflow-completion-enforcer.cjs:57-59`: "It does NOT use ctx.state because the Write/Edit tool just modified state.json and ctx.state may be stale"

### Root Cause Chain

```
Root cause: writeState() has no version validation
  -> state-write-validator cannot detect stale writes (no version to compare)
  -> All writes succeed regardless of staleness
  -> Subagent prompt snapshots become weapons of state corruption
  -> Parent orchestrator changes silently overwritten
  -> Workflow state becomes inconsistent
  -> Downstream hooks (branch-guard) enforce stale constraints
  -> User forced to manually repair state.json
```

### Suggested Fix

The fix involves two coordinated changes:

**Change 1: Add version check to `state-write-validator.cjs`** (FR-02)

Before the structural validation (V1, V2, V3), add a version comparison:
1. Read current `state_version` from the on-disk state.json
2. Parse `state_version` from the incoming write content (from `tool_input.content` for Write, or from re-reading disk for Edit)
3. If incoming `state_version` < current `state_version`, return `{ decision: 'block', stopReason: '...' }`

This is the optimal interception point because:
- It fires on EVERY Write/Edit to state.json (both agent writes and hook writes)
- It runs as a PreToolUse or PostToolUse hook (already registered)
- It has access to both the incoming content and the current file
- It is the single validation gate for all state.json mutations

**CRITICAL NOTE**: Currently `state-write-validator` is a PostToolUse hook (fires AFTER the write). For the version check to BLOCK stale writes, it must either:
- (a) Be moved to a PreToolUse hook (fires BEFORE the write, can block), OR
- (b) Remain PostToolUse but detect-and-revert after the write

Option (a) is strongly preferred -- it prevents the stale write from ever hitting disk.

**Change 2: Add auto-increment to `writeState()` in `common.cjs`** (FR-03)

Modify `writeState()` to:
1. Read current `state_version` from the existing file on disk
2. Set `state.state_version = current_version + 1`
3. Write the updated state (with incremented version)

This ensures every write through the programmatic API gets a monotonically increasing version. Agent writes via the Write/Edit tool will also need to include the version they read, which the validator can then check.

**Estimated Complexity**: LOW
- 2 files changed (`state-write-validator.cjs`, `common.cjs`)
- ~30-50 lines of new logic
- Backward-compatible (legacy files without `state_version` handled gracefully)
- Fail-open on errors (consistent with hook system principles)

---

## Tracing Metadata

```json
{
  "tracing_completed_at": "2026-02-12T16:00:00Z",
  "sub_agents": ["T1-symptom-analyzer", "T2-execution-path-tracer", "T3-root-cause-identifier"],
  "discovery_report_used": "docs/project-discovery-report.md",
  "files_analyzed": [
    "src/claude/hooks/state-write-validator.cjs",
    "src/claude/hooks/lib/common.cjs",
    "src/claude/hooks/dispatchers/post-write-edit-dispatcher.cjs",
    "src/claude/hooks/dispatchers/post-task-dispatcher.cjs",
    "src/claude/hooks/dispatchers/post-bash-dispatcher.cjs",
    "src/claude/hooks/dispatchers/pre-task-dispatcher.cjs",
    "src/claude/hooks/dispatchers/pre-skill-dispatcher.cjs",
    "src/claude/hooks/workflow-completion-enforcer.cjs",
    "src/claude/hooks/test-watcher.cjs",
    "src/claude/hooks/log-skill-usage.cjs",
    "src/claude/hooks/delegation-gate.cjs"
  ],
  "writeState_call_sites": 18,
  "error_keywords": [
    "stale write",
    "state_version",
    "optimistic locking",
    "writeState",
    "state-write-validator",
    "active_workflow revert",
    "branch-guard block"
  ],
  "primary_hypothesis": "No optimistic locking mechanism exists for state.json",
  "confidence": "high",
  "fix_complexity": "low",
  "files_to_change": [
    "src/claude/hooks/state-write-validator.cjs",
    "src/claude/hooks/lib/common.cjs"
  ]
}
```
