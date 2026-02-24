# Test Cases: FR-01 -- Pre-Delegation State Write

**Requirement**: FR-01 (Pre-delegation state write)
**Test File**: `src/claude/hooks/tests/isdlc-step3-ordering.test.cjs`
**Type**: Prompt Content Verification (Layer 1)

---

## TC-01-EXIST: STEP 3a-prime exists in isdlc.md

**Traces to**: FR-01 (overall), AC-01g
**Priority**: P0 (Critical)

**Description**: Verify that a pre-delegation state write step exists in `isdlc.md` between the escalation handling (STEP 3c) and the Task delegation (STEP 3d).

**Method**: Read `src/claude/commands/isdlc.md`, search for a step labeled with "PRE-DELEGATION STATE" or equivalent. Verify its position occurs after text matching STEP 3c and before text matching STEP 3d.

**Expected**: The pre-delegation step exists and is positioned between 3c and 3d.

---

## TC-01a: STEP 3a-prime sets phases[key].status to "in_progress"

**Traces to**: AC-01a
**Priority**: P0 (Critical)

**Description**: Verify that the pre-delegation write instructions include setting `phases[phase_key].status` to `"in_progress"`.

**Method**: Read the STEP 3a-prime section text. Search for a line/instruction that sets `phases[phase_key].status` = `"in_progress"` (or equivalent instruction text).

**Expected**: The instruction is present in the STEP 3a-prime section.

---

## TC-01b: STEP 3a-prime sets phases[key].started timestamp

**Traces to**: AC-01b
**Priority**: P1 (High)

**Description**: Verify that the pre-delegation write instructions include setting `phases[phase_key].started` to a timestamp, with the "if null" / "preserve on retry" condition.

**Method**: Read the STEP 3a-prime section text. Search for an instruction that sets `phases[phase_key].started` with a conditional (only if null/not already set).

**Expected**: The instruction is present with the conditional guard.

---

## TC-01c: STEP 3a-prime sets active_workflow.current_phase

**Traces to**: AC-01c
**Priority**: P0 (Critical)

**Description**: Verify that the pre-delegation write instructions include setting `active_workflow.current_phase` to the phase key.

**Method**: Search the STEP 3a-prime section for `active_workflow.current_phase` assignment to the phase key.

**Expected**: The instruction is present.

---

## TC-01d: STEP 3a-prime sets active_workflow.phase_status[key]

**Traces to**: AC-01d
**Priority**: P0 (Critical)

**Description**: Verify that the pre-delegation write instructions include setting `active_workflow.phase_status[phase_key]` to `"in_progress"`.

**Method**: Search the STEP 3a-prime section for `phase_status` assignment.

**Expected**: The instruction is present with value `"in_progress"`.

---

## TC-01e: STEP 3a-prime sets top-level current_phase

**Traces to**: AC-01e
**Priority**: P1 (High)

**Description**: Verify that the pre-delegation write instructions include setting the top-level `current_phase` field.

**Method**: Search the STEP 3a-prime section for top-level `current_phase` assignment.

**Expected**: The instruction is present, setting it to the phase key.

---

## TC-01f: STEP 3a-prime sets top-level active_agent

**Traces to**: AC-01f
**Priority**: P1 (High)

**Description**: Verify that the pre-delegation write instructions include setting the top-level `active_agent` field from PHASE_AGENT_MAP.

**Method**: Search the STEP 3a-prime section for `active_agent` assignment referencing the agent map.

**Expected**: The instruction is present, setting it to the agent name resolved from the map.

---

## TC-01g: STEP 3a-prime writes state.json before Task delegation

**Traces to**: AC-01g
**Priority**: P0 (Critical)

**Description**: Verify that the STEP 3a-prime section includes an explicit "Write .isdlc/state.json" instruction, and that this write occurs BEFORE STEP 3d's Task tool call.

**Method**:
1. Find the "Write" instruction in STEP 3a-prime
2. Find the "Task tool" / delegation instruction in STEP 3d
3. Verify the write instruction's position (character offset or line) is before the delegation

**Expected**: The write instruction appears before the Task delegation.
