# Bug Report: BUG-0011 — Subagent Phase State Overwrite

**ID**: BUG-0011
**Type**: Bug Fix
**Severity**: High
**Component**: state-write-validator.cjs (PostToolUse hook)
**Related Components**: phase-sequence-guard.cjs, common.cjs, post-write-edit-dispatcher.cjs
**Created**: 2026-02-13
**Status**: Open

---

## Summary

Subagents (delegated via the Task tool) overwrite `active_workflow.current_phase`, `current_phase_index`, and `phase_status` fields in state.json, undoing the Phase-Loop Controller's STEP 3c-prime pre-delegation state write. This causes `phase-sequence-guard` to block the next phase delegation with "OUT-OF-ORDER PHASE DELEGATION" errors.

---

## Reproduction Steps

1. Start a multi-phase workflow (e.g., `/isdlc feature "something"`)
2. Phase-Loop Controller completes Phase 01 and advances state via STEP 3c-prime:
   - Sets `current_phase` to `02-impact-analysis`
   - Sets `current_phase_index` to `2`
   - Sets `phase_status["02-impact-analysis"]` to `"in_progress"`
3. Phase-Loop Controller delegates to the Phase 02 agent via Task tool
4. The Phase 02 subagent reads state.json at the start of its task (sees the correct advanced state)
5. The subagent does its work and writes state.json back — but its write includes `active_workflow.current_phase = "02-impact-analysis"`, `current_phase_index = 2`, etc. (the values it read)
6. Meanwhile, Phase-Loop Controller's STEP 3e advances state again after the subagent completes:
   - Sets `current_phase` to `03-architecture`
   - Sets `current_phase_index` to `3`
   - Sets `phase_status["03-architecture"]` to `"in_progress"`
7. **BUT**: If the subagent's state write (step 5) happens AFTER step 6, it overwrites the Phase-Loop Controller's advancement, regressing `current_phase` back to `02-impact-analysis` and `current_phase_index` back to `2`
8. Next delegation to Phase 03 agent is blocked by `phase-sequence-guard` because state says current phase is `02-impact-analysis`, not `03-architecture`

## Expected Behavior

- Subagents MUST NOT be able to overwrite `active_workflow.current_phase`, `current_phase_index`, or `phase_status` fields
- Only the Phase-Loop Controller (main conversation) should manage these orchestration-critical fields
- The `state-write-validator` hook should detect and block writes that regress these fields

## Actual Behavior

- Subagents freely overwrite these fields because `state-write-validator` has no rule protecting them
- The V7 optimistic locking (BUG-0009) prevents writes with stale `state_version`, but does NOT prevent writes with current `state_version` that contain regressed phase orchestration fields
- This is a semantic-level protection gap — V7 handles version staleness, but not field-level semantic regression

---

## Root Cause Analysis

The `state-write-validator.cjs` hook (PostToolUse[Write,Edit]) validates state.json writes for structural integrity but does not distinguish between:
1. The **Phase-Loop Controller** (main conversation) which is the legitimate owner of orchestration fields
2. **Subagents** (Task tool delegates) which should only write phase-specific data (e.g., `phases["06-implementation"].iteration_requirements`)

The V7 version check (BUG-0009) only prevents writes with a `state_version` lower than disk. It does NOT prevent a subagent that reads the current version, does work, and writes back with the same or incremented version — but with regressed orchestration field values.

---

## Proposed Fix

### New Rule: V8 — Phase Orchestration Field Protection

Add a rule to `state-write-validator.cjs` that runs on Write events to state.json (similar to V7). The rule:

1. Parses the incoming content to extract `active_workflow.current_phase`, `current_phase_index`, and `phase_status`
2. Reads the current disk state to get the same fields
3. **BLOCKS** the write if any of these conditions are true:
   - `current_phase_index` in incoming is LESS THAN disk value (regression)
   - `current_phase` in incoming differs from disk AND `current_phase_index` is less (phase regression)
   - Any entry in `phase_status` is being changed from `"in_progress"` or `"completed"` to `"pending"` (status regression)

### Why V8 and not a separate hook

- The state-write-validator already intercepts state.json writes and has the V7 precedent for pre-write blocking
- Adding V8 to the same hook keeps the enforcement co-located and avoids additional hook process overhead
- The check runs alongside V7 (before the write lands on disk for Write events)

---

## Functional Requirements

### FR-01: Block phase orchestration field regression in state.json writes

The `state-write-validator` hook MUST detect and block writes to state.json that would regress `active_workflow.current_phase_index` to a value lower than the current disk value.

**Acceptance Criteria**:
- AC-01a: Write with `current_phase_index` < disk `current_phase_index` is BLOCKED
- AC-01b: Write with `current_phase_index` >= disk `current_phase_index` is ALLOWED
- AC-01c: Write with no `active_workflow` is ALLOWED (no-op)
- AC-01d: Write where disk has no `active_workflow` is ALLOWED (workflow init)
- AC-01e: Block message includes the incoming vs disk values for debugging
- AC-01f: Rule is logged to hook-activity.log via `logHookEvent()`

### FR-02: Block phase_status regression in state.json writes

The `state-write-validator` hook MUST detect and block writes that regress `phase_status` entries from a more-advanced state to a less-advanced state.

**Acceptance Criteria**:
- AC-02a: Changing phase_status from `"completed"` to `"pending"` is BLOCKED
- AC-02b: Changing phase_status from `"completed"` to `"in_progress"` is BLOCKED
- AC-02c: Changing phase_status from `"in_progress"` to `"pending"` is BLOCKED
- AC-02d: Changing phase_status from `"pending"` to `"in_progress"` is ALLOWED (forward progress)
- AC-02e: Changing phase_status from `"in_progress"` to `"completed"` is ALLOWED (forward progress)
- AC-02f: Adding NEW phase_status entries not on disk is ALLOWED
- AC-02g: Rule applies per-phase — one valid change + one regression = BLOCK

### FR-03: Fail-open on errors and edge cases

The V8 rule MUST follow the hook system's fail-open principle.

**Acceptance Criteria**:
- AC-03a: If incoming content cannot be parsed as JSON, ALLOW
- AC-03b: If disk state cannot be read, ALLOW
- AC-03c: If either incoming or disk has no `active_workflow`, ALLOW
- AC-03d: If either incoming or disk has no `phase_status`, ALLOW for that sub-check
- AC-03e: Any exception in V8 logic results in ALLOW (fail-open)

### FR-04: V8 runs only on Write events (not Edit)

The V8 rule MUST only apply to Write tool events, not Edit events.

**Acceptance Criteria**:
- AC-04a: V8 is skipped for Edit events (Edit modifies in-place, handled by writeState)
- AC-04b: V8 runs for Write events to state.json paths matching STATE_JSON_PATTERN

### FR-05: V8 runs before V1-V3 content validation

V8 MUST run alongside V7 (before disk write) in the check flow.

**Acceptance Criteria**:
- AC-05a: V8 runs after V7 (version check) but before V1-V3 (content validation)
- AC-05b: If V7 blocks, V8 does not run (short-circuit)
- AC-05c: If V8 blocks, V1-V3 do not run

---

## Non-Functional Requirements

### NFR-01: Performance
- V8 check MUST complete within 10ms (parsing two JSON objects + comparison)
- Total state-write-validator budget remains < 100ms

### NFR-02: Backward Compatibility
- V8 MUST be backward-compatible: missing fields in incoming or disk state result in ALLOW
- V8 MUST NOT affect writes to state.json that do not touch `active_workflow`

### NFR-03: Constitutional Compliance
- Article IX: Quality gate integrity — V8 prevents gate/phase state corruption
- Article X: Fail-safe defaults — V8 fails open on all errors
- Article XIV: State management integrity — V8 protects orchestration-critical state fields

---

## Files to Modify

1. **`src/claude/hooks/state-write-validator.cjs`** — Add V8 rule (checkPhaseFieldProtection function)
2. **`src/claude/hooks/tests/state-write-validator.test.cjs`** — Add V8 test cases
3. **`.claude/hooks/state-write-validator.cjs`** — Sync runtime copy

---

## Test Plan

- Unit tests for `checkPhaseFieldProtection()` covering all AC items
- Integration test with post-write-edit-dispatcher to verify V8 runs correctly in the dispatch chain
- Regression test: V1-V7 rules continue to work unchanged
