# BUG-0009: State.json Optimistic Locking

**Type**: Bug Fix
**Priority**: Critical
**Reported**: 2026-02-12
**Affects**: All iSDLC workflows (feature, fix, upgrade)

---

## Bug Description

During iSDLC workflows, subagents (quality-loop-engineer, qa-engineer, software-developer) receive state.json content in their prompt context at launch time. When they write state updates, they use their stale snapshot instead of reading the current file first. This causes the parent orchestrator's state.json updates (e.g., switching from REQ-0010 to BUG-0008 workflow) to be overwritten with old data.

## Observed Symptoms

1. **active_workflow reverts**: After the orchestrator sets active_workflow to BUG-0008, a subagent writes back its stale snapshot containing REQ-0010, reverting the workflow
2. **branch-guard blocks commits**: The branch-guard hook sees stale feature branch data in active_workflow and blocks commits to main
3. **Phase status reverts**: current_phase, active_agent, phase_status all revert to stale values from the subagent's launch-time snapshot
4. **Manual intervention required**: User must manually fix state.json 3+ times per workflow to recover from stale writes

## Reproduction Steps

1. Start a fix workflow (e.g., `/isdlc fix "some bug"`)
2. Orchestrator initializes state.json with BUG-NNNN active_workflow
3. Orchestrator delegates to Phase 01 agent
4. Phase 01 agent writes its state updates using its launch-time snapshot of state.json
5. If the snapshot was taken before the orchestrator updated active_workflow, the write reverts active_workflow to its pre-initialization state (null or previous workflow)

## Root Cause Analysis

**No version control or conflict detection on state.json writes.** The `state-write-validator` hook (PostToolUse [Write, Edit]) currently validates structural integrity (e.g., constitutional_validation consistency) but does not check for write conflicts. Any Write/Edit to state.json succeeds regardless of whether the file has changed since the writer last read it.

The `writeState()` function in `common.cjs` performs a blind overwrite:
```javascript
function writeState(state, projectId) {
    const stateFile = resolveStatePath(projectId);
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}
```

There is no version check, no compare-and-swap, and no conflict detection.

## Expected Behavior

When a subagent attempts to write state.json with data based on a stale read, the write should be detected and either:
- **Blocked** with a warning message explaining the version mismatch
- **Rejected** with guidance to re-read state.json before writing

## Actual Behavior

All writes succeed unconditionally. The last writer wins, even if their data is based on a snapshot that is minutes or hours old.

---

## Functional Requirements

### FR-01: State Version Counter

A `state_version` integer field SHALL be added to the root of state.json. This counter SHALL be incremented on every valid write to state.json.

**Acceptance Criteria**:
- AC-01a: state.json contains a `state_version` field at the root level (integer, starting at 1)
- AC-01b: Every successful write to state.json increments `state_version` by exactly 1
- AC-01c: The `state_version` field is preserved across all read/write cycles
- AC-01d: If `state_version` is missing (legacy state files), it SHALL be initialized to 1 on next write

### FR-02: Optimistic Lock Validation in state-write-validator Hook

The `state-write-validator.cjs` hook SHALL compare the `state_version` in the incoming write against the current file's `state_version` before allowing the write.

**Acceptance Criteria**:
- AC-02a: When a Write/Edit targets state.json, the hook reads the current `state_version` from disk
- AC-02b: The hook extracts the `state_version` from the incoming write content
- AC-02c: If incoming `state_version` < current `state_version`, the write is BLOCKED with a descriptive error message
- AC-02d: If incoming `state_version` == current `state_version`, the write is ALLOWED (version match)
- AC-02e: The error message includes: expected version, actual version, and guidance to re-read state.json
- AC-02f: If the current file has no `state_version` (migration case), the check is SKIPPED (allow write)

### FR-03: Auto-Increment on Valid Writes

The `writeState()` function in `common.cjs` SHALL auto-increment `state_version` before writing to disk.

**Acceptance Criteria**:
- AC-03a: `writeState()` reads the current `state_version` from the existing file on disk (if it exists)
- AC-03b: `writeState()` sets the new state's `state_version` to `current_version + 1` before writing
- AC-03c: If no existing file or no `state_version`, `writeState()` sets `state_version` to 1
- AC-03d: The caller's in-memory state object is NOT mutated (version is set on write, not on read)

### FR-04: Backward Compatibility

The optimistic locking mechanism SHALL be backward-compatible with state files that do not yet have a `state_version` field.

**Acceptance Criteria**:
- AC-04a: State files without `state_version` are handled gracefully (no crashes, no blocks)
- AC-04b: First write to a legacy state file adds `state_version: 1`
- AC-04c: Existing tests continue to pass without modification (or with minimal adaptation)
- AC-04d: The hook remains observational for structural validation (V1, V2, V3 rules) -- only the version check blocks

### FR-05: Fail-Open Behavior

The version check SHALL fail-open on any unexpected error, consistent with the hook system's fail-open principle (Article X).

**Acceptance Criteria**:
- AC-05a: If the hook cannot read the current state.json from disk, it allows the write
- AC-05b: If the incoming content cannot be parsed as JSON, it allows the write
- AC-05c: Parse errors, file system errors, and other exceptions result in allow (not block)
- AC-05d: All failure paths log a warning to stderr (not stdout)

---

## Non-Functional Requirements

### NFR-01: Performance

The version check SHALL complete within the existing 100ms performance budget for the state-write-validator hook.

### NFR-02: No Agent Changes Required

The fix SHALL be implemented entirely in the hook layer and common.cjs. No changes to agent markdown files or orchestrator behavior are required. This is a "consumer-side" fix.

### NFR-03: Module System Compliance

All changes SHALL maintain the CommonJS module system for hooks (Article XIII). No ESM imports in hook files.

---

## Affected Components

| Component | File | Change Type |
|-----------|------|-------------|
| State Write Validator Hook | `src/claude/hooks/state-write-validator.cjs` | Enhance: add version check logic |
| Common Utilities | `src/claude/hooks/lib/common.cjs` | Enhance: add version auto-increment to writeState() |
| State.json | `.isdlc/state.json` | Schema: add `state_version` field |
| Hook Tests | `src/claude/hooks/tests/state-write-validator.test.cjs` | Add: version conflict tests |
| Common Tests | `src/claude/hooks/tests/common.test.cjs` | Add: writeState version increment tests |

---

## Traceability

| Requirement | Constitution Article | Justification |
|-------------|---------------------|---------------|
| FR-01 | XIV (State Management Integrity) | state_version supports reliable state management |
| FR-02 | IX (Quality Gate Integrity) | Prevents stale writes from corrupting workflow state |
| FR-03 | XIV (State Management Integrity) | Atomic version increment prevents data loss |
| FR-04 | X (Fail-Safe Defaults) | Backward compatibility ensures graceful migration |
| FR-05 | X (Fail-Safe Defaults) | Fail-open prevents hook errors from blocking users |
| NFR-03 | XIII (Module System Consistency) | Hooks must use CommonJS |
