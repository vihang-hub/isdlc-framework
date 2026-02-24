# Test Cases: BUG-0011 -- V8 Phase Field Protection

**Bug**: BUG-0011 -- Subagent Phase State Overwrite
**Phase**: 05-test-strategy
**Created**: 2026-02-13
**Total Test Cases**: 34 (T32-T65)
**Traces to**: FR-01 thru FR-05, AC-01a thru AC-05c, NFR-01, NFR-02

---

## Conventions

All tests follow the existing pattern in `state-write-validator.test.cjs`:

- **Disk state**: Written to `{tmpDir}/.isdlc/state.json` via `writeStateFile()`
- **Incoming state**: Passed as `tool_input.content` in the Write stdin payload via `makeWriteStdinWithContent()`
- **BLOCK assertion**: `stdout` contains `"continue":false` or `"continue": false`
- **ALLOW assertion**: `stdout` is empty string `''`
- **Log assertion**: `stderr` contains expected log message
- **Tool**: `spawnSync('node', [HOOK_PATH], { input, cwd: tmpDir })`

### Phase Status Ordinal Map

```
"pending"     = 0  (lowest)
"in_progress" = 1
"completed"   = 2  (highest)
```

A regression is any transition where new ordinal < old ordinal.

---

## FR-01: Block Phase Index Regression (AC-01a thru AC-01f)

### T32: Block write when incoming current_phase_index < disk (AC-01a)

**Purpose**: Core regression detection -- subagent writes stale phase index.

**Disk state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "03-architecture",
    "current_phase_index": 3,
    "phase_status": {
      "01-requirements": "completed",
      "02-impact-analysis": "completed",
      "03-architecture": "in_progress"
    }
  }
}
```

**Incoming state** (subagent write):
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "02-impact-analysis",
    "current_phase_index": 2,
    "phase_status": {
      "01-requirements": "completed",
      "02-impact-analysis": "in_progress"
    }
  }
}
```

**Expected**: BLOCK. stdout contains `"continue":false`. stderr contains log about phase index regression (incoming 2 < disk 3).

**Traces**: AC-01a

---

### T33: Allow write when incoming current_phase_index == disk (AC-01b)

**Purpose**: Same-phase writes from the current subagent are valid.

**Disk state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 5,
    "phase_status": {
      "06-implementation": "in_progress"
    }
  }
}
```

**Incoming state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 5,
    "phase_status": {
      "06-implementation": "in_progress"
    }
  }
}
```

**Expected**: ALLOW. stdout is empty.

**Traces**: AC-01b

---

### T34: Allow write when incoming current_phase_index > disk (AC-01b)

**Purpose**: Forward progress by Phase-Loop Controller is valid.

**Disk state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "05-test-strategy",
    "current_phase_index": 2,
    "phase_status": {
      "05-test-strategy": "in_progress"
    }
  }
}
```

**Incoming state**:
```json
{
  "state_version": 11,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 3,
    "phase_status": {
      "05-test-strategy": "completed",
      "06-implementation": "in_progress"
    }
  }
}
```

**Expected**: ALLOW. stdout is empty.

**Traces**: AC-01b

---

### T35: Allow write when incoming has no active_workflow (AC-01c)

**Purpose**: Writes that do not touch active_workflow are not subject to V8.

**Disk state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 5,
    "phase_status": {}
  }
}
```

**Incoming state**:
```json
{
  "state_version": 10,
  "phases": {
    "06-implementation": { "status": "in_progress" }
  }
}
```

**Expected**: ALLOW. stdout is empty. (No `active_workflow` in incoming = nothing to check.)

**Traces**: AC-01c

---

### T36: Allow write when disk has no active_workflow (AC-01d)

**Purpose**: Workflow initialization -- disk has no workflow yet, incoming creates one.

**Disk state**:
```json
{
  "state_version": 5,
  "phases": {}
}
```

**Incoming state**:
```json
{
  "state_version": 6,
  "active_workflow": {
    "current_phase": "01-requirements",
    "current_phase_index": 0,
    "phase_status": {
      "01-requirements": "in_progress"
    }
  }
}
```

**Expected**: ALLOW. stdout is empty. (Disk has no active_workflow = allow.)

**Traces**: AC-01d

---

### T37: Block message includes incoming and disk phase index values (AC-01e)

**Purpose**: Debug information in the block message.

**Disk state**:
```json
{
  "state_version": 8,
  "active_workflow": {
    "current_phase": "16-quality-loop",
    "current_phase_index": 7,
    "phase_status": {
      "16-quality-loop": "in_progress"
    }
  }
}
```

**Incoming state**:
```json
{
  "state_version": 8,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 4,
    "phase_status": {
      "06-implementation": "in_progress"
    }
  }
}
```

**Expected**: BLOCK. stdout includes both `4` (incoming index) and `7` (disk index) in the message.

**Traces**: AC-01e

---

### T38: V8 block is logged to stderr (AC-01f)

**Purpose**: V8 block events are logged for observability.

**Disk state**: Same as T37 disk state.
**Incoming state**: Same as T37 incoming state.

**Expected**: BLOCK. stderr contains `V8` or `phase` and logging information (e.g., `[state-write-validator]`).

**Traces**: AC-01f

---

## FR-02: Block phase_status Regression (AC-02a thru AC-02g)

### T39: Block phase_status change from completed to pending (AC-02a)

**Purpose**: Most severe regression -- completed phase reverts to pending.

**Disk state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 5,
    "phase_status": {
      "01-requirements": "completed",
      "02-impact-analysis": "completed",
      "06-implementation": "in_progress"
    }
  }
}
```

**Incoming state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 5,
    "phase_status": {
      "01-requirements": "pending",
      "02-impact-analysis": "completed",
      "06-implementation": "in_progress"
    }
  }
}
```

**Expected**: BLOCK. Phase `01-requirements` regressed from completed (2) to pending (0).

**Traces**: AC-02a

---

### T40: Block phase_status change from completed to in_progress (AC-02b)

**Purpose**: Completed phase reverts to in_progress.

**Disk state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 5,
    "phase_status": {
      "01-requirements": "completed",
      "06-implementation": "in_progress"
    }
  }
}
```

**Incoming state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 5,
    "phase_status": {
      "01-requirements": "in_progress",
      "06-implementation": "in_progress"
    }
  }
}
```

**Expected**: BLOCK. Phase `01-requirements` regressed from completed (2) to in_progress (1).

**Traces**: AC-02b

---

### T41: Block phase_status change from in_progress to pending (AC-02c)

**Purpose**: Active phase reverts to pending.

**Disk state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 5,
    "phase_status": {
      "06-implementation": "in_progress"
    }
  }
}
```

**Incoming state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 5,
    "phase_status": {
      "06-implementation": "pending"
    }
  }
}
```

**Expected**: BLOCK. Phase `06-implementation` regressed from in_progress (1) to pending (0).

**Traces**: AC-02c

---

### T42: Allow phase_status change from pending to in_progress (AC-02d)

**Purpose**: Forward progress -- phase activation.

**Disk state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 5,
    "phase_status": {
      "06-implementation": "pending"
    }
  }
}
```

**Incoming state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 5,
    "phase_status": {
      "06-implementation": "in_progress"
    }
  }
}
```

**Expected**: ALLOW. Forward progress from pending to in_progress.

**Traces**: AC-02d

---

### T43: Allow phase_status change from in_progress to completed (AC-02e)

**Purpose**: Forward progress -- phase completion.

**Disk state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 5,
    "phase_status": {
      "06-implementation": "in_progress"
    }
  }
}
```

**Incoming state**:
```json
{
  "state_version": 11,
  "active_workflow": {
    "current_phase": "16-quality-loop",
    "current_phase_index": 6,
    "phase_status": {
      "06-implementation": "completed",
      "16-quality-loop": "in_progress"
    }
  }
}
```

**Expected**: ALLOW. Forward progress from in_progress to completed.

**Traces**: AC-02e

---

### T44: Allow adding new phase_status entries not on disk (AC-02f)

**Purpose**: Phase-Loop Controller adds new phase entries during phase advancement.

**Disk state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "01-requirements",
    "current_phase_index": 0,
    "phase_status": {
      "01-requirements": "in_progress"
    }
  }
}
```

**Incoming state**:
```json
{
  "state_version": 11,
  "active_workflow": {
    "current_phase": "02-impact-analysis",
    "current_phase_index": 1,
    "phase_status": {
      "01-requirements": "completed",
      "02-impact-analysis": "in_progress"
    }
  }
}
```

**Expected**: ALLOW. `02-impact-analysis` is new (not on disk) so allowed. `01-requirements` moved from in_progress to completed (forward progress).

**Traces**: AC-02f

---

### T45: Block when one valid change plus one regression (AC-02g)

**Purpose**: Mixed valid and regressed changes -- any regression means block.

**Disk state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 5,
    "phase_status": {
      "01-requirements": "completed",
      "02-impact-analysis": "completed",
      "05-test-strategy": "completed",
      "06-implementation": "in_progress"
    }
  }
}
```

**Incoming state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 5,
    "phase_status": {
      "01-requirements": "completed",
      "02-impact-analysis": "in_progress",
      "05-test-strategy": "completed",
      "06-implementation": "in_progress"
    }
  }
}
```

**Expected**: BLOCK. `02-impact-analysis` regressed from completed to in_progress, even though all other entries are valid.

**Traces**: AC-02g

---

## FR-03: Fail-Open on Errors (AC-03a thru AC-03e)

### T46: Allow when incoming content is not valid JSON (AC-03a)

**Purpose**: Malformed content should not crash V8.

**Disk state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 5,
    "phase_status": {}
  }
}
```

**Incoming content**: `"this is {{ not valid json"`

**Expected**: ALLOW. V8 fails to parse incoming, fails open.

**Traces**: AC-03a

---

### T47: Allow when disk state cannot be read (AC-03b)

**Purpose**: Disk file missing or unreadable.

**Setup**: Do NOT create a disk state file. Use a path to a non-existent `.isdlc/state.json`.

**Incoming state**:
```json
{
  "state_version": 1,
  "active_workflow": {
    "current_phase": "01-requirements",
    "current_phase_index": 0,
    "phase_status": {
      "01-requirements": "in_progress"
    }
  }
}
```

**Expected**: ALLOW. Cannot read disk state, fail open.

**Traces**: AC-03b

---

### T48: Allow when incoming has no active_workflow (AC-03c)

**Purpose**: Incoming state has no active_workflow field at all.

**Disk state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 5,
    "phase_status": {}
  }
}
```

**Incoming state**:
```json
{
  "state_version": 10,
  "phases": {}
}
```

**Expected**: ALLOW. No active_workflow in incoming, nothing to compare.

**Traces**: AC-03c (same test as T35, duplicated for explicit AC-03c traceability)

---

### T49: Allow when disk has no active_workflow (AC-03c -- disk side)

**Purpose**: Disk state has no active_workflow.

**Disk state**:
```json
{
  "state_version": 5
}
```

**Incoming state**:
```json
{
  "state_version": 6,
  "active_workflow": {
    "current_phase": "01-requirements",
    "current_phase_index": 0,
    "phase_status": {}
  }
}
```

**Expected**: ALLOW. Disk has no active_workflow, nothing to compare against.

**Traces**: AC-03c (same test as T36, duplicated for explicit AC-03c traceability)

---

### T50: Allow when disk has no phase_status but incoming does (AC-03d)

**Purpose**: Disk active_workflow exists but has no phase_status.

**Disk state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 5
  }
}
```

**Incoming state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 5,
    "phase_status": {
      "06-implementation": "in_progress"
    }
  }
}
```

**Expected**: ALLOW. Disk has no phase_status to compare against for that sub-check.

**Traces**: AC-03d

---

### T51: Allow when incoming has no phase_status but disk does (AC-03d -- incoming side)

**Purpose**: Incoming active_workflow exists but has no phase_status.

**Disk state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 5,
    "phase_status": {
      "06-implementation": "in_progress"
    }
  }
}
```

**Incoming state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 5
  }
}
```

**Expected**: ALLOW. Incoming has no phase_status, skip phase_status regression check.

**Traces**: AC-03d

---

### T52: Allow when V8 logic throws an unexpected error (AC-03e)

**Purpose**: Any uncaught exception in V8 logic results in allow.

**Disk state**: Write a state file with `active_workflow` set to a non-object value (e.g., `"active_workflow": "corrupted"`).

```json
{
  "state_version": 10,
  "active_workflow": "this is not an object"
}
```

**Incoming state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "01-requirements",
    "current_phase_index": 0,
    "phase_status": {}
  }
}
```

**Expected**: ALLOW. V8 encounters a type error accessing `.current_phase_index` on a string, catches and allows.

**Traces**: AC-03e

---

## FR-04: Write Events Only (AC-04a, AC-04b)

### T53: V8 is skipped for Edit events (AC-04a)

**Purpose**: Edit events should not trigger V8 checks.

**Disk state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 5,
    "phase_status": {
      "01-requirements": "completed"
    }
  }
}
```

**Tool**: Use `makeEditStdin(statePath)` instead of `makeWriteStdinWithContent()`.

**Note**: Edit events have no `tool_input.content` for V8 to parse. Even if the disk file has a regressed state after an Edit, V8 should not run.

**Expected**: ALLOW. No block. V8 skips Edit events. (V1-V3 may still warn on content.)

**Traces**: AC-04a

---

### T54: V8 runs for Write events targeting state.json (AC-04b)

**Purpose**: Positive test that V8 does activate on Write events.

**Disk state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 5,
    "phase_status": {
      "06-implementation": "in_progress"
    }
  }
}
```

**Incoming state** (regression to trigger block):
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "01-requirements",
    "current_phase_index": 0,
    "phase_status": {
      "01-requirements": "in_progress"
    }
  }
}
```

**Expected**: BLOCK. Confirms V8 is active for Write events.

**Traces**: AC-04b

---

## FR-05: Execution Order (AC-05a thru AC-05c)

### T55: V7 blocks before V8 runs -- short circuit (AC-05a, AC-05b)

**Purpose**: If V7 (version check) blocks, V8 should not execute.

**Disk state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 5,
    "phase_status": {
      "06-implementation": "in_progress"
    }
  }
}
```

**Incoming state** (stale version AND regressed phase index):
```json
{
  "state_version": 3,
  "active_workflow": {
    "current_phase": "01-requirements",
    "current_phase_index": 0,
    "phase_status": {
      "01-requirements": "pending"
    }
  }
}
```

**Expected**: BLOCK by V7 (version mismatch). stdout includes `Version mismatch` or `version`. V8 block message is NOT present.

**Traces**: AC-05a, AC-05b

---

### T56: V8 blocks before V1-V3 content validation runs (AC-05a, AC-05c)

**Purpose**: If V8 blocks, V1-V3 content validation warnings should not appear.

**Disk state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 5,
    "phase_status": {
      "06-implementation": "in_progress"
    }
  },
  "phases": {
    "06-implementation": {
      "constitutional_validation": { "completed": true, "iterations_used": 0 }
    }
  }
}
```

**Incoming state** (regressed phase index + suspicious V1 data):
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "01-requirements",
    "current_phase_index": 0,
    "phase_status": {
      "01-requirements": "pending"
    }
  },
  "phases": {
    "06-implementation": {
      "constitutional_validation": { "completed": true, "iterations_used": 0 }
    }
  }
}
```

**Expected**: BLOCK by V8 (phase index regression). stdout includes V8-related block message. stderr should NOT contain V1 warnings about `constitutional_validation` (because V1-V3 did not run).

**Traces**: AC-05a, AC-05c

---

### T57: V8 allows, then V1-V3 runs and warns (AC-05a)

**Purpose**: When V8 passes, V1-V3 content validation runs normally.

**Disk state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 5,
    "phase_status": {
      "06-implementation": "in_progress"
    }
  }
}
```

**Incoming state** (valid phase data + suspicious V1 content):
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 5,
    "phase_status": {
      "06-implementation": "in_progress"
    }
  },
  "phases": {
    "06-implementation": {
      "constitutional_validation": { "completed": true, "iterations_used": 0 }
    }
  }
}
```

**Expected**: ALLOW (V8 passes). stderr contains V1 warning about `constitutional_validation` (V1-V3 ran).

**Traces**: AC-05a

---

## Boundary and Edge Cases

### T58: Block on phase index regression from 1 to 0 (boundary -- smallest regression)

**Purpose**: Smallest possible regression (off by one).

**Disk state**:
```json
{
  "state_version": 5,
  "active_workflow": {
    "current_phase": "02-impact-analysis",
    "current_phase_index": 1,
    "phase_status": {
      "02-impact-analysis": "in_progress"
    }
  }
}
```

**Incoming state**:
```json
{
  "state_version": 5,
  "active_workflow": {
    "current_phase": "01-requirements",
    "current_phase_index": 0,
    "phase_status": {
      "01-requirements": "in_progress"
    }
  }
}
```

**Expected**: BLOCK. Phase index 0 < 1.

**Traces**: AC-01a (boundary)

---

### T59: Allow when phase_status has unknown status values

**Purpose**: Unexpected status strings should not crash V8.

**Disk state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 5,
    "phase_status": {
      "06-implementation": "unknown_status"
    }
  }
}
```

**Incoming state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 5,
    "phase_status": {
      "06-implementation": "another_unknown"
    }
  }
}
```

**Expected**: ALLOW. Unknown statuses have no defined ordinal, so fail-open.

**Traces**: AC-03e (edge case)

---

### T60: Allow when current_phase_index is missing in incoming

**Purpose**: Backward compatibility -- incoming may not have current_phase_index.

**Disk state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 5,
    "phase_status": {
      "06-implementation": "in_progress"
    }
  }
}
```

**Incoming state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "phase_status": {
      "06-implementation": "in_progress"
    }
  }
}
```

**Expected**: ALLOW. Missing current_phase_index in incoming = skip index check (NFR-02 backward compat).

**Traces**: NFR-02

---

### T61: Allow when current_phase_index is missing in disk state

**Purpose**: Backward compatibility -- disk may be legacy format without current_phase_index.

**Disk state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "phase_status": {
      "06-implementation": "in_progress"
    }
  }
}
```

**Incoming state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 5,
    "phase_status": {
      "06-implementation": "in_progress"
    }
  }
}
```

**Expected**: ALLOW. Missing current_phase_index on disk = skip index check (NFR-02 backward compat).

**Traces**: NFR-02

---

### T62: Block on phase_status regression across multiple phases simultaneously

**Purpose**: Multiple phases all regress at once (e.g., subagent writes completely stale state).

**Disk state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "08-code-review",
    "current_phase_index": 7,
    "phase_status": {
      "01-requirements": "completed",
      "02-impact-analysis": "completed",
      "05-test-strategy": "completed",
      "06-implementation": "completed",
      "16-quality-loop": "completed",
      "08-code-review": "in_progress"
    }
  }
}
```

**Incoming state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 3,
    "phase_status": {
      "01-requirements": "completed",
      "02-impact-analysis": "in_progress",
      "05-test-strategy": "pending",
      "06-implementation": "in_progress"
    }
  }
}
```

**Expected**: BLOCK. Both current_phase_index regression (3 < 7) and multiple phase_status regressions.

**Traces**: AC-01a, AC-02b, AC-02c, AC-02g

---

### T63: V8 works with monorepo state.json paths

**Purpose**: V8 correctly reads disk state from monorepo project paths.

**Setup**: Create `{tmpDir}/.isdlc/projects/my-api/state.json` with regressed incoming state.

**Disk state** (at monorepo path):
```json
{
  "state_version": 5,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 5,
    "phase_status": {
      "06-implementation": "in_progress"
    }
  }
}
```

**Incoming state**:
```json
{
  "state_version": 5,
  "active_workflow": {
    "current_phase": "01-requirements",
    "current_phase_index": 0,
    "phase_status": {
      "01-requirements": "pending"
    }
  }
}
```

**Expected**: BLOCK. V8 correctly reads disk state from monorepo path and detects regression.

**Traces**: AC-01a (monorepo variant)

---

## Regression Tests: V1-V7 Unaffected

### T64: V7 version block still works after V8 addition

**Purpose**: Regression test -- V7 continues to block stale versions.

**Disk state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 5,
    "phase_status": {}
  }
}
```

**Incoming state**:
```json
{
  "state_version": 3,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 5,
    "phase_status": {}
  }
}
```

**Expected**: BLOCK by V7. stdout contains `Version mismatch`.

**Traces**: Regression (V7 unaffected)

---

### T65: V1 content warning still fires after V8 addition

**Purpose**: Regression test -- V1-V3 warnings still fire when V8 allows.

**Disk state**:
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 5,
    "phase_status": {
      "06-implementation": "in_progress"
    }
  },
  "phases": {
    "01-requirements": {
      "constitutional_validation": { "completed": true, "iterations_used": 0 }
    }
  }
}
```

**Incoming state** (valid V8, suspicious V1):
```json
{
  "state_version": 10,
  "active_workflow": {
    "current_phase": "06-implementation",
    "current_phase_index": 5,
    "phase_status": {
      "06-implementation": "in_progress"
    }
  },
  "phases": {
    "01-requirements": {
      "constitutional_validation": { "completed": true, "iterations_used": 0 }
    }
  }
}
```

**Expected**: ALLOW (V8 passes). stderr contains V1 WARNING about `constitutional_validation`.

**Traces**: Regression (V1-V3 unaffected)

---

## Performance Tests

### T66: Hook completes within 100ms budget (NFR-01)

**Purpose**: Verify V8 does not push the hook beyond its 100ms performance budget.

**Method**: Run the hook 10 times with a valid V8 scenario (allow case), measure average execution time.

**Disk state**: Any valid state with `active_workflow`.
**Incoming state**: Matching phase index (allow case).

**Expected**: Average execution time < 100ms per invocation (measuring wall-clock time including node startup).

**Note**: Node process startup dominates. The V8 logic itself (two JSON parses + comparison) should add < 10ms. This test validates the total budget, not just V8.

**Traces**: NFR-01

---

### T67: V8 overhead measured by comparing allow with and without active_workflow

**Purpose**: Isolate V8's overhead from baseline.

**Method**:
1. Run hook 10 times with state that has NO active_workflow (V8 short-circuits immediately)
2. Run hook 10 times with state that HAS active_workflow with matching indexes (V8 does full comparison)
3. Compare average times. Difference should be < 10ms.

**Expected**: Delta between scenarios < 10ms.

**Traces**: NFR-01

---

## Test Summary

| FR | AC | Test IDs | Count |
|----|-----|----------|-------|
| FR-01 | AC-01a | T32, T58, T62, T63 | 4 |
| FR-01 | AC-01b | T33, T34 | 2 |
| FR-01 | AC-01c | T35 | 1 |
| FR-01 | AC-01d | T36 | 1 |
| FR-01 | AC-01e | T37 | 1 |
| FR-01 | AC-01f | T38 | 1 |
| FR-02 | AC-02a | T39 | 1 |
| FR-02 | AC-02b | T40, T62 | 2 |
| FR-02 | AC-02c | T41, T62 | 2 |
| FR-02 | AC-02d | T42 | 1 |
| FR-02 | AC-02e | T43 | 1 |
| FR-02 | AC-02f | T44 | 1 |
| FR-02 | AC-02g | T45, T62 | 2 |
| FR-03 | AC-03a | T46 | 1 |
| FR-03 | AC-03b | T47 | 1 |
| FR-03 | AC-03c | T48, T49 | 2 |
| FR-03 | AC-03d | T50, T51 | 2 |
| FR-03 | AC-03e | T52, T59 | 2 |
| FR-04 | AC-04a | T53 | 1 |
| FR-04 | AC-04b | T54 | 1 |
| FR-05 | AC-05a | T55, T56, T57 | 3 |
| FR-05 | AC-05b | T55 | 1 |
| FR-05 | AC-05c | T56 | 1 |
| NFR-01 | -- | T66, T67 | 2 |
| NFR-02 | -- | T60, T61 | 2 |
| Regression | -- | T64, T65 | 2 |
| **Total** | | **T32-T67** | **36** |

All 23 ACs (6 for FR-01 + 7 for FR-02 + 5 for FR-03 + 2 for FR-04 + 3 for FR-05) have at least one dedicated test case. Total new tests: 36.
