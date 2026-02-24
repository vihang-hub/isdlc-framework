# Implementation Notes: BUG-0011 -- V8 Phase Field Protection

**Phase**: 06-implementation
**Date**: 2026-02-13
**Author**: software-developer agent
**Bug**: BUG-0011 -- Subagent Phase State Overwrite

---

## Summary

Added V8 rule `checkPhaseFieldProtection()` to `state-write-validator.cjs` that blocks subagent writes to state.json that would regress phase orchestration fields. This prevents the root cause of false "OUT-OF-ORDER PHASE DELEGATION" blocks from `phase-sequence-guard`.

## Files Modified

### 1. `src/claude/hooks/state-write-validator.cjs` (source, version 1.1.0 -> 1.2.0)

**New function**: `checkPhaseFieldProtection(filePath, toolInput, toolName)`

- **Location**: Lines 207-323, inserted between V7 (`checkVersionLock`) and V1-V3 (`validatePhase`)
- **Two checks**:
  1. **Phase index regression** (FR-01): Blocks if incoming `current_phase_index < disk current_phase_index`
  2. **Phase status regression** (FR-02): Blocks if any `phase_status` entry regresses (e.g., `completed` -> `pending`, `completed` -> `in_progress`, `in_progress` -> `pending`)

**New constant**: `PHASE_STATUS_ORDINAL` (line 181-185)
- Maps status strings to ordinal values: `pending=0`, `in_progress=1`, `completed=2`
- Unknown statuses fail-open (ordinal is `undefined`)

**Wiring in `check()`**: Lines 361-364
- V8 runs after V7 block check, before V1-V3 content validation
- If V7 blocks, V8 does not run (short-circuit)
- If V8 blocks, V1-V3 do not run

### 2. `src/claude/hooks/tests/state-write-validator.test.cjs` (tests)

- Added 36 new test cases (T32-T67) in a new `describe('BUG-0011: Phase Field Protection (V8)')` block
- Test breakdown:
  - FR-01 (phase index regression): T32-T38 (7 tests)
  - FR-02 (phase status regression): T39-T45 (7 tests)
  - FR-03 (fail-open): T46-T52 (7 tests)
  - FR-04 (Write-only): T53-T54 (2 tests)
  - FR-05 (execution order): T55-T57 (3 tests)
  - Boundary/edge cases: T58-T63 (6 tests)
  - Regression tests: T64-T65 (2 tests)
  - Performance tests: T66-T67 (2 tests)

### 3. `.claude/hooks/state-write-validator.cjs` (runtime copy)

- Confirmed already in sync (symlinked to source)

## Design Decisions

### 1. Follows V7 Pattern Exactly

V8 uses the same structure as V7: parse incoming content, read disk state, compare, block or allow. This keeps the hook consistent and predictable.

### 2. Fail-Open on Everything

Per FR-03 and Article X (Fail-Safe Defaults), V8 allows writes on:
- Invalid JSON in incoming content
- Missing or unreadable disk state
- Missing `active_workflow` in either incoming or disk
- Missing `phase_status` in either incoming or disk
- Unknown status values (not in the ordinal map)
- Any uncaught exception

### 3. Write Events Only

V8 only runs on Write events (not Edit). This is because:
- Write events have `tool_input.content` with the full incoming state
- Edit events modify in-place and have no comparable incoming content
- V7 already follows this same pattern

### 4. Phase Index Check Before Status Check

The phase index check runs first because it is a broader indicator of regression (if the phase index regressed, statuses likely regressed too). This provides a faster exit path.

## Test Results

- **Total tests**: 67 (31 existing + 36 new)
- **All passing**: 67/67
- **Regressions**: 0
- **Full CJS hook suite**: 1112/1112 passing
- **Full ESM suite**: 489/490 passing (1 pre-existing failure: TC-E09 unrelated to this change)

## Traceability

| Requirement | Implementation |
|-------------|---------------|
| FR-01 (phase index regression) | `checkPhaseFieldProtection()` lines 253-276 |
| FR-02 (phase status regression) | `checkPhaseFieldProtection()` lines 278-313 |
| FR-03 (fail-open) | try/catch at lines 213, 221-226, 236-244, 248-251, 289-291, 297-299, 318-322 |
| FR-04 (Write events only) | Guard at line 209 |
| FR-05 (V8 after V7, before V1-V3) | Wiring at check() lines 361-364 |
