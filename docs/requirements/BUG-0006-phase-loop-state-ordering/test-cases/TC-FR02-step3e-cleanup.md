# Test Cases: FR-02 -- Eliminate Redundant Writes in STEP 3e

**Requirement**: FR-02 (Eliminate redundant writes in STEP 3e)
**Test File**: `src/claude/hooks/tests/isdlc-step3-ordering.test.cjs`
**Type**: Prompt Content Verification (Layer 1)

---

## TC-02a: STEP 3e step 6 does NOT set phases[new_phase].status

**Traces to**: AC-02a
**Priority**: P0 (Critical)

**Description**: Verify that STEP 3e step 6 (the "if more phases remain" block) no longer contains an instruction to set `phases[new_phase].status = "in_progress"`.

**Method**: Extract the STEP 3e section from isdlc.md. Within the "if more phases remain" sub-section (step 6), search for `phases[new_phase].status` or `phases[new.*].status.*in_progress`. Confirm it is absent.

**Expected**: No instruction to set the next phase's status to "in_progress" exists in STEP 3e step 6.

---

## TC-02b: STEP 3e step 6 does NOT set active_workflow.phase_status[new_phase]

**Traces to**: AC-02b
**Priority**: P0 (Critical)

**Description**: Verify that STEP 3e step 6 no longer contains an instruction to set `active_workflow.phase_status[new_phase]` to `"in_progress"`.

**Method**: Extract the STEP 3e step 6 section. Search for `phase_status[new_phase]` or `phase_status.*new.*in_progress`. Confirm absent.

**Expected**: No instruction to set `phase_status[new_phase]` to "in_progress" in STEP 3e step 6.

---

## TC-02c: STEP 3e step 6 does NOT set active_workflow.current_phase to new phase

**Traces to**: AC-02c
**Priority**: P1 (High)

**Description**: Verify that STEP 3e step 6 no longer sets `active_workflow.current_phase` to the new phase key.

**Method**: Extract STEP 3e step 6. Search for `current_phase` = new phase assignment. Confirm absent.

**Expected**: No instruction to set `active_workflow.current_phase` to the next phase in STEP 3e step 6.

---

## TC-02d: STEP 3e step 6 does NOT set top-level current_phase or active_agent

**Traces to**: AC-02d
**Priority**: P1 (High)

**Description**: Verify that STEP 3e step 6 no longer sets the top-level `current_phase` or `active_agent` fields to new-phase values.

**Method**: Extract STEP 3e step 6. Search for top-level `current_phase` or `active_agent` assignments. Confirm absent.

**Expected**: No instruction to set top-level `current_phase` or `active_agent` to the new phase in STEP 3e step 6.

---

## TC-02e: STEP 3e STILL increments current_phase_index

**Traces to**: AC-02e
**Priority**: P0 (Critical)

**Description**: Verify that STEP 3e still contains the instruction to increment `active_workflow.current_phase_index` (this is essential for loop progression and must NOT be removed).

**Method**: Search the full STEP 3e section for `current_phase_index` += 1 or equivalent increment instruction. Confirm present.

**Expected**: The index increment instruction is present in STEP 3e.

---

## TC-02f: STEP 3e steps 1-5 and 7-8 remain unchanged

**Traces to**: AC-02f
**Priority**: P1 (High)

**Description**: Verify that STEP 3e still contains instructions for:
- Step 1: Read state.json
- Step 2: Set phases[key].status = "completed"
- Step 3: Set phases[key].summary
- Step 4: Increment current_phase_index (same as TC-02e)
- Step 5: Set phase_status[key] = "completed"
- Step 7: Write state.json
- Step 8: Update tasks.md

**Method**: Search STEP 3e for each of these instructions. All must be present.

**Expected**: All non-step-6 instructions remain in STEP 3e.
