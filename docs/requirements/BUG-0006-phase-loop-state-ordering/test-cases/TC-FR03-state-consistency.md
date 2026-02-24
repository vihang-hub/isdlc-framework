# Test Cases: FR-03 -- State Consistency Between Pre-Delegation and Post-Phase

**Requirement**: FR-03 (State consistency between pre-delegation and post-phase)
**Test File**: `src/claude/hooks/tests/isdlc-step3-ordering.test.cjs`
**Type**: Prompt Content Verification (Layer 1) + Hook Behavior Verification (Layer 2)

---

## TC-03a: Pre-delegation write activates the phase (prompt verification)

**Traces to**: AC-03a
**Priority**: P0 (Critical)

**Description**: Verify that the STEP 3a-prime instructions, when followed, produce a state.json where:
- `phases[key].status == "in_progress"`
- `active_workflow.phase_status[key] == "in_progress"`
- `active_workflow.current_phase == key`

**Method**: Verify that all three fields are mentioned in the STEP 3a-prime section with their expected values. Cross-reference with TC-01a, TC-01c, TC-01d.

**Expected**: All three fields are set in STEP 3a-prime with `"in_progress"` or phase key values.

---

## TC-03b: Post-phase write deactivates the phase (prompt verification)

**Traces to**: AC-03b
**Priority**: P0 (Critical)

**Description**: Verify that the STEP 3e instructions, when followed, produce a state.json where:
- `phases[key].status == "completed"`
- `active_workflow.phase_status[key] == "completed"`
- `active_workflow.current_phase_index` incremented by 1

**Method**: Verify that STEP 3e sets status to "completed", phase_status to "completed", and increments the index. Cross-reference with TC-02e and TC-02f.

**Expected**: STEP 3e sets completed status and increments index.

---

## TC-03c: No field written in both pre-delegation and post-phase for SAME key

**Traces to**: AC-03c
**Priority**: P1 (High)

**Description**: Verify that no state field is written by BOTH STEP 3a-prime AND STEP 3e for the same phase key. The pre-delegation write activates; the post-phase write deactivates. There should be no overlap that causes double-writes.

**Method**:
1. Extract the list of fields set in STEP 3a-prime (for current phase key)
2. Extract the list of fields set in STEP 3e (for current phase key, not next phase)
3. Verify no field appears in both lists with the same phase key

**Expected**: Pre-delegation sets `phases[key].status = "in_progress"` and `phase_status[key] = "in_progress"`. Post-phase sets `phases[key].status = "completed"` and `phase_status[key] = "completed"`. These are for the SAME key but with DIFFERENT values (in_progress vs completed), which is valid state progression, not a double-write conflict.

**Note**: The key check is that STEP 3e step 6 no longer writes next-phase activation (verified by TC-02a through TC-02d), eliminating the conflict where pre-delegation would also write next-phase activation.

---

## TC-03d: phase-loop-controller.cjs allows after pre-delegation write (hook verification)

**Traces to**: AC-03d
**Priority**: P0 (Critical)

**Description**: Verify that the `phase-loop-controller.cjs` hook allows delegation when `phases[key].status == "in_progress"` and `active_workflow.current_phase` matches the phase key.

**Method**: This is verified by existing test T3 in `phase-loop-controller.test.cjs`:
```javascript
it('allows when phase status is in_progress', () => {
    writeState(tmpDir, {
        active_workflow: { current_phase: '06-implementation' },
        phases: { '06-implementation': { status: 'in_progress' } }
    });
    const result = runHook(tmpDir, makeDelegationStdin());
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '');
});
```

**Expected**: Existing test T3 passes (hook allows when status is "in_progress"). No new test needed.

**Cross-Reference**: `phase-loop-controller.test.cjs` T3 (existing, no modifications)
