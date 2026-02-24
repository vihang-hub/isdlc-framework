# Test Cases: BUG-0016 -- Orchestrator Scope Overrun

**Phase**: 05-test-strategy
**Bug ID**: BUG-0016
**Generated**: 2026-02-14
**Test File**: `lib/orchestrator-scope-overrun.test.js`
**Total Test Cases**: 20 (T01-T20)
**Coverage**: 17/17 ACs + 3/3 NFRs = 100%

---

## Test File Architecture

The test file reads `src/claude/agents/00-sdlc-orchestrator.md` as a string and validates structural properties of the prompt. It uses `node:test` + `node:assert/strict` (matching project conventions).

### Helpers Required

- `extractSection(content, marker, level)` -- Extract markdown section by heading text
- `extractSectionByPattern(content, headingPattern, level)` -- Extract section by regex heading match
- `extractModeEnforcementBlock(content)` -- Find the top-level MODE enforcement block (before Section 1)
- `extractSection4a(content)` -- Extract Section 4a (Automatic Phase Transitions)
- `extractSection4(content)` -- Extract Section 4 (Workflow Phase Advancement)
- `extractSection3c(content)` -- Extract Section 3c (Execution Modes)
- `extractModeBehavior(content)` -- Extract the Mode Behavior subsection

---

## Group 1: MODE Enforcement Instruction at Top (FR-02)

### T01: MODE enforcement block exists before Section 1

**Traces**: AC-02.1
**Type**: Structural validation
**Priority**: P0

**Description**: Verify that a MODE enforcement instruction block exists at the top of the orchestrator, BEFORE the first major section header ("CORE MISSION" or "Section 0" or "Section 1").

**Assertions**:
1. The orchestrator content contains a heading referencing "MODE ENFORCEMENT" or "MODE BOUNDARY"
2. The position of this heading is BEFORE the position of "# CORE MISSION" or "## SECTION 0" or "## 1."

---

### T02: MODE enforcement uses CRITICAL-level language

**Traces**: AC-02.2
**Type**: Structural validation
**Priority**: P0

**Description**: Verify the MODE enforcement block uses imperative CRITICAL-level language that matches or exceeds Section 4a's strength.

**Assertions**:
1. The MODE enforcement block contains "CRITICAL" (bold or capitalized)
2. The block contains imperative stop language: at least one of "STOP", "DO NOT", "MUST NOT", "IMMEDIATELY"
3. The block contains explicit mode-specific boundaries (init-and-phase-01 mentioned)

---

### T03: MODE enforcement references JSON return format

**Traces**: AC-02.3
**Type**: Structural validation
**Priority**: P1

**Description**: Verify the MODE enforcement block explicitly mentions returning structured JSON.

**Assertions**:
1. The block contains "JSON" or "structured result" or "return" in the context of mode completion
2. The block mentions "terminate" or "return" or "stop" after the mode scope completes

---

### T04: MODE enforcement says DO NOT delegate to Phase 02

**Traces**: AC-02.4
**Type**: Structural validation
**Priority**: P0

**Description**: Verify the MODE enforcement block explicitly forbids delegation to Phase 02 or subsequent agents when in init-and-phase-01 mode.

**Assertions**:
1. The block contains "DO NOT delegate" or "DO NOT advance" or "DO NOT proceed" in the context of init-and-phase-01
2. The block references "Phase 02" or "subsequent phase" or "next phase" as the forbidden target

---

## Group 2: MODE Parameter Enforcement -- init-and-phase-01 (FR-01)

### T05: init-and-phase-01 scope limited to Phase 01

**Traces**: AC-01.1
**Type**: Structural validation
**Priority**: P0

**Description**: Verify the orchestrator defines init-and-phase-01 as limited to Phase 01 only.

**Assertions**:
1. Section 3c or MODE enforcement block defines init-and-phase-01 scope as: initialization + Phase 01 + GATE-01 + plan generation
2. No language suggesting Phase 02 is included in init-and-phase-01 scope

---

### T06: init-and-phase-01 returns structured JSON after GATE-01

**Traces**: AC-01.2
**Type**: Structural validation
**Priority**: P1

**Description**: Verify the orchestrator documents that init-and-phase-01 returns a structured JSON result after GATE-01 passes.

**Assertions**:
1. Section 3c Return Format documents init-and-phase-01 returns `{ status, phases[], artifact_folder, workflow_type, next_phase_index }`
2. This return format is still present and unchanged

---

### T07: single-phase mode limits to one phase

**Traces**: AC-01.3
**Type**: Structural validation
**Priority**: P1

**Description**: Verify the orchestrator defines single-phase mode as limited to one specified phase.

**Assertions**:
1. Section 3c or MODE enforcement block defines single-phase as running only the PHASE parameter
2. Contains "STOP" or "return" language for single-phase completion

---

### T08: finalize mode runs only merge logic

**Traces**: AC-01.4
**Type**: Structural validation
**Priority**: P1

**Description**: Verify the orchestrator defines finalize mode as limited to merge/completion logic.

**Assertions**:
1. Section 3c or MODE enforcement block defines finalize as merge/completion only
2. Contains "no phase transitions" or "no phases" or "merge only" language

---

### T09: No-MODE backward compatibility

**Traces**: AC-01.5, NFR-01
**Type**: Regression guard
**Priority**: P0

**Description**: Verify that when no MODE parameter is present, the orchestrator still runs full workflow autonomously (backward compatible).

**Assertions**:
1. Section 3c or MODE enforcement block mentions "no MODE" or "none" or "full-workflow mode"
2. Backward compatibility is explicitly stated (e.g., "original behavior", "backward compatible", "full workflow")
3. The Section 4a automatic transitions are NOT disabled by default (only when MODE is set)

---

## Group 3: Mode-Aware Guard in Section 4a (FR-03)

### T10: Section 4a contains a mode-aware guard

**Traces**: AC-03.1
**Type**: Structural validation
**Priority**: P0

**Description**: Verify Section 4a (Automatic Phase Transitions) now contains a check for the MODE parameter before advancing.

**Assertions**:
1. Section 4a contains "MODE" or "mode" in the context of checking/guarding
2. The guard appears BEFORE or alongside the automatic transition instruction

---

### T11: Mode guard blocks transition after Phase 01 in init-and-phase-01

**Traces**: AC-03.2
**Type**: Structural validation
**Priority**: P0

**Description**: Verify the mode guard specifically blocks transitions after Phase 01 when MODE is init-and-phase-01.

**Assertions**:
1. Section 4a or its guard contains "init-and-phase-01" with "STOP" or "block" or "do not" language
2. References Phase 01 or GATE-01 as the boundary

---

### T12: Mode guard blocks transition in single-phase mode

**Traces**: AC-03.3
**Type**: Structural validation
**Priority**: P1

**Description**: Verify the mode guard blocks transitions after the specified phase in single-phase mode.

**Assertions**:
1. Section 4a or its guard contains "single-phase" with stop/block language
2. References "specified phase" or "PHASE parameter" as the boundary

---

### T13: Mode guard prevents transitions in finalize mode

**Traces**: AC-03.4
**Type**: Structural validation
**Priority**: P1

**Description**: Verify the mode guard prevents phase transitions in finalize mode.

**Assertions**:
1. Section 4a or its guard contains "finalize" with "no transitions" or "merge only" language

---

## Group 4: Section 4 Advancement Algorithm Mode Check (FR-03)

### T14: Section 4 advancement algorithm contains a mode check

**Traces**: AC-03.1
**Type**: Structural validation
**Priority**: P1

**Description**: Verify the 8-step advancement algorithm in Section 4 now includes a mode-awareness check before step 8 (delegate to next phase's agent).

**Assertions**:
1. Section 4 contains a step (e.g., 7.5 or a guard before step 8) that references MODE
2. The step says to STOP/return if MODE boundary has been reached
3. The step appears BEFORE the "delegate to the next phase's agent" instruction

---

## Group 5: Return Format Compliance (FR-04)

### T15: init-and-phase-01 return format documented

**Traces**: AC-04.1
**Type**: Structural validation
**Priority**: P1

**Description**: Verify the return format for init-and-phase-01 is documented with the required fields.

**Assertions**:
1. Return Format subsection contains init-and-phase-01 return: `status`, `phases`, `artifact_folder`, `workflow_type`, `next_phase_index`

---

### T16: single-phase return format documented

**Traces**: AC-04.2
**Type**: Structural validation
**Priority**: P2

**Description**: Verify the return format for single-phase is documented with the required fields.

**Assertions**:
1. Return Format subsection contains single-phase return: `status`, `phase_completed`, `gate_result`, `blockers`

---

### T17: finalize return format documented

**Traces**: AC-04.3
**Type**: Structural validation
**Priority**: P2

**Description**: Verify the return format for finalize is documented with the required fields.

**Assertions**:
1. Return Format subsection contains finalize return: `status`, `merged`, `pr_url`, `workflow_id`, `metrics`

---

## Group 6: Non-Functional Requirements (NFR-01, NFR-02, NFR-03)

### T18: Full-workflow mode regression guard

**Traces**: NFR-01
**Type**: Regression guard
**Priority**: P0

**Description**: Verify that Section 4a still contains the automatic transition instruction for full-workflow mode (when no MODE is set).

**Assertions**:
1. Section 4a still contains "AUTOMATIC" or "automatic" phase transitions
2. Section 4a still contains the "FORBIDDEN" interaction patterns (asking for permission)
3. Section 4a still contains the exception for Human Review Checkpoint
4. Section 4a still contains the exception for Human Escalation

---

### T19: MODE enforcement positioned before phase delegation logic

**Traces**: NFR-02
**Type**: Structural validation (positioning)
**Priority**: P0

**Description**: Verify the MODE enforcement instructions are positioned at the TOP of the orchestrator, BEFORE Section 3c and Section 4.

**Assertions**:
1. The MODE enforcement block's position index is LESS THAN the position of "## 3c." or "## 3c. Execution Modes"
2. The MODE enforcement block's position index is LESS THAN the position of "## 4." or "## 4. Workflow Phase Advancement"
3. The MODE enforcement block's position index is LESS THAN the position of "## 4a." or "## 4a. Automatic Phase Transitions"

---

### T20: Stop conditions use imperative language

**Traces**: NFR-03
**Type**: Structural validation
**Priority**: P1

**Description**: Verify the stop conditions in the MODE enforcement block use imperative language with no room for interpretation.

**Assertions**:
1. The block contains at least 2 of: "STOP", "DO NOT PROCEED", "RETURN IMMEDIATELY", "MUST NOT", "DO NOT delegate", "TERMINATE"
2. The block uses bold formatting or CAPS for emphasis
3. The block explicitly says these boundaries OVERRIDE Section 4a (or automatic transitions)

---

## Test Case Summary

| Test ID | AC/NFR Traced | Group | Priority | Assertion Count |
|---------|---------------|-------|----------|-----------------|
| T01 | AC-02.1 | 1 (Top Stop) | P0 | 2 |
| T02 | AC-02.2 | 1 (Top Stop) | P0 | 3 |
| T03 | AC-02.3 | 1 (Top Stop) | P1 | 2 |
| T04 | AC-02.4 | 1 (Top Stop) | P0 | 2 |
| T05 | AC-01.1 | 2 (MODE param) | P0 | 2 |
| T06 | AC-01.2 | 2 (MODE param) | P1 | 2 |
| T07 | AC-01.3 | 2 (MODE param) | P1 | 2 |
| T08 | AC-01.4 | 2 (MODE param) | P1 | 2 |
| T09 | AC-01.5, NFR-01 | 2 (MODE param) | P0 | 3 |
| T10 | AC-03.1 | 3 (Sec 4a guard) | P0 | 2 |
| T11 | AC-03.2 | 3 (Sec 4a guard) | P0 | 2 |
| T12 | AC-03.3 | 3 (Sec 4a guard) | P1 | 2 |
| T13 | AC-03.4 | 3 (Sec 4a guard) | P1 | 1 |
| T14 | AC-03.1 | 4 (Sec 4 algo) | P1 | 3 |
| T15 | AC-04.1 | 5 (Return fmt) | P1 | 1 |
| T16 | AC-04.2 | 5 (Return fmt) | P2 | 1 |
| T17 | AC-04.3 | 5 (Return fmt) | P2 | 1 |
| T18 | NFR-01 | 6 (Regression) | P0 | 4 |
| T19 | NFR-02 | 6 (Position) | P0 | 3 |
| T20 | NFR-03 | 6 (Language) | P1 | 3 |
| **TOTAL** | **17 ACs + 3 NFRs** | **6 groups** | - | **42** |

### Priority Distribution

| Priority | Count | Tests |
|----------|-------|-------|
| P0 (Critical) | 8 | T01, T02, T04, T05, T09, T10, T11, T18, T19 |
| P1 (High) | 9 | T03, T06, T07, T08, T12, T14, T15, T20 |
| P2 (Medium) | 2 | T16, T17 |
| **Total** | **20** | |
