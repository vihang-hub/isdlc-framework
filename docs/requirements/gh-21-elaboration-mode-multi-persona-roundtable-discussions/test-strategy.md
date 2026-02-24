# Test Strategy: Elaboration Mode -- Multi-Persona Roundtable Discussions

**Feature**: REQ-0028 / GH-21 -- Elaboration Mode
**Phase**: 05-test-strategy
**Blast Radius**: LOW (2 files modified: roundtable-analyst.md, three-verb-utils.cjs)
**Risk Level**: LOW-MEDIUM

---

## 1. Existing Infrastructure (from test evaluation)

- **Framework**: Node.js built-in `node:test` + `node:assert/strict` (Node 18+)
- **Test Streams**: ESM (`lib/*.test.js`) and CJS (`src/claude/hooks/tests/*.test.cjs`)
- **Coverage Tool**: Built-in `node:test` coverage
- **Current Test Count**: 555+ tests baseline (184 in three-verb-utils main, 25 in steps extension)
- **Existing Patterns**: test-three-verb-utils.test.cjs, test-three-verb-utils-steps.test.cjs
- **Run Commands**:
  - Unit (CJS): `node --test src/claude/hooks/tests/test-three-verb-utils-elaboration.test.cjs`
  - Full hooks: `npm run test:hooks`
  - All: `npm run test:all`

## 2. Testing Scope Analysis

### 2.1 What IS Testable (Automated)

The only code change is in `src/claude/hooks/lib/three-verb-utils.cjs`:
- **readMetaJson()**: Adding defensive default for `elaborations` array field
- **writeMetaJson()**: Verifying `elaborations` array round-trips through write cycles

This follows the exact same pattern as the GH-20 (REQ-0027) extension that added `steps_completed` and `depth_overrides` defaults to readMetaJson(). The test file `test-three-verb-utils-steps.test.cjs` (25 tests) is the direct template for our test design.

### 2.2 What is NOT Testable (Agent Prompt Instructions)

The primary file (`src/claude/agents/roundtable-analyst.md`) is a markdown prompt file containing elaboration handler instructions. Agent prompt files are NOT code and cannot be unit-tested. FR-001 through FR-010 describe behavioral instructions that the agent follows at runtime. These are validated through:
- Manual validation protocol (Section 5)
- Acceptance testing during integration (Phase 07)

### 2.3 Proportionality

Given the LOW blast radius (2 files, 1 code change of ~5 lines, 1 prompt change of ~200 lines):
- Automated tests focus narrowly on the readMetaJson()/writeMetaJson() elaboration defaults
- Manual validation protocol covers the 10 FRs and 7 NFRs for the prompt-engineering component
- No new test infrastructure is needed -- extend existing patterns

---

## 3. Test Strategy by Type

### 3.1 Unit Tests (Automated)

**Target**: `src/claude/hooks/lib/three-verb-utils.cjs` -- readMetaJson() and writeMetaJson() elaboration defaults

**Test File**: `src/claude/hooks/tests/test-three-verb-utils-elaboration.test.cjs`

**Pattern**: Follow `test-three-verb-utils-steps.test.cjs` exactly (same structure, same helpers, same assertion patterns)

**Test Cases**: See Section 4 (Test Cases) for full specifications.

| Category | Count | Priority |
|----------|-------|----------|
| Defensive defaults (elaborations[]) | 6 | P1 |
| Defensive defaults (elaboration_config) | 4 | P1 |
| Existing field preservation | 2 | P1 |
| Write cycle round-trips | 4 | P1 |
| Regression (unchanged behaviors) | 3 | P2 |
| Integration chains | 2 | P2 |
| **Total** | **21** | |

**Coverage Target**: 100% of the new defensive default code paths in readMetaJson().

### 3.2 Regression Tests

The existing 184 tests in `test-three-verb-utils.test.cjs` and 25 tests in `test-three-verb-utils-steps.test.cjs` serve as the regression suite. After implementing the `elaborations` default:
- All 184 existing tests MUST pass
- All 25 steps extension tests MUST pass
- Zero test count decrease (per Article II constitution)

### 3.3 Manual Validation Protocol (Agent Behavior)

Since the primary file is a markdown agent prompt, behavioral requirements are validated through a structured manual test protocol. See Section 5 for the full protocol.

### 3.4 Integration Tests

No new integration tests needed. The elaboration feature is self-contained within the roundtable-analyst agent. The only integration point (readMetaJson/writeMetaJson) is covered by the automated unit tests.

### 3.5 E2E Tests

Not applicable. The elaboration feature operates within a single agent context during the analyze verb workflow. E2E testing would require simulating an entire analysis session, which is covered by the manual validation protocol.

### 3.6 Security Tests

Not applicable. The elaboration feature:
- Does not handle user credentials or secrets (Article III)
- Does not make network requests
- Does not execute code -- all logic is prompt instructions
- Only writes to meta.json (existing validated path)
- Does not modify state.json (CON-003)

### 3.7 Performance Tests

Not applicable for automated testing. NFR-001 (entry responsiveness < 3s) and NFR-006 (turn limit enforcement) are behavioral constraints enforced by prompt instructions and validated manually.

---

## 4. Test Cases

### 4.1 Unit Test Cases: readMetaJson() Elaboration Defaults

All tests use the `test-three-verb-utils-steps.test.cjs` pattern: create temp dir, write meta.json, call readMetaJson(), assert defaults.

#### Suite A: Defensive Defaults -- elaborations[]

| TC ID | Description | Input | Expected | Traces |
|-------|-------------|-------|----------|--------|
| TC-E01 | readMetaJson defaults elaborations to [] when field absent | Legacy meta (no elaborations field) | `meta.elaborations === []` | FR-009 AC-009-02, NFR-005 |
| TC-E02 | readMetaJson preserves existing elaborations array | Meta with `elaborations: [{step_id: "01-03", ...}]` | Array preserved intact | FR-009 AC-009-04 |
| TC-E03 | readMetaJson corrects elaborations when it is null | `elaborations: null` | `meta.elaborations === []` | FR-009 AC-009-02 |
| TC-E04 | readMetaJson corrects elaborations when it is a string | `elaborations: "01-03"` | `meta.elaborations === []` | FR-009 AC-009-02 |
| TC-E05 | readMetaJson corrects elaborations when it is a number | `elaborations: 42` | `meta.elaborations === []` | FR-009 AC-009-02 |
| TC-E06 | readMetaJson corrects elaborations when it is an object | `elaborations: {}` | `meta.elaborations === []` | FR-009 AC-009-02 |

#### Suite B: Defensive Defaults -- elaboration_config

| TC ID | Description | Input | Expected | Traces |
|-------|-------------|-------|----------|--------|
| TC-E07 | readMetaJson defaults elaboration_config to {} when absent | Legacy meta (no elaboration_config) | `meta.elaboration_config === {}` | FR-007 AC-007-03 |
| TC-E08 | readMetaJson preserves existing elaboration_config | Meta with `elaboration_config: {max_turns: 15}` | Object preserved intact | FR-007 AC-007-03 |
| TC-E09 | readMetaJson corrects elaboration_config when it is null | `elaboration_config: null` | `meta.elaboration_config === {}` | FR-007 AC-007-03 |
| TC-E10 | readMetaJson corrects elaboration_config when it is an array | `elaboration_config: [10]` | `meta.elaboration_config === {}` | FR-007 AC-007-03 |

#### Suite C: Field Preservation

| TC ID | Description | Input | Expected | Traces |
|-------|-------------|-------|----------|--------|
| TC-E11 | readMetaJson preserves all existing fields alongside elaboration defaults | Full meta with steps_completed, depth_overrides, phases_completed + no elaboration fields | All original fields preserved + elaborations=[], elaboration_config={} added | NFR-005, NFR-007 |
| TC-E12 | readMetaJson preserves elaboration fields alongside steps_completed and depth_overrides | Meta with all three extension types | All three field sets preserved | NFR-005, NFR-007 |

#### Suite D: Write Cycle Round-Trips

| TC ID | Description | Input | Expected | Traces |
|-------|-------------|-------|----------|--------|
| TC-E13 | writeMetaJson preserves elaborations array through write cycle | Meta with elaborations array | Written file contains elaborations array | FR-009 AC-009-01 |
| TC-E14 | writeMetaJson preserves elaboration_config through write cycle | Meta with elaboration_config | Written file contains elaboration_config | FR-007 AC-007-03 |
| TC-E15 | writeMetaJson succeeds when elaborations is absent | Legacy meta (no elaborations) | File written successfully, no crash | NFR-007 |
| TC-E16 | writeMetaJson round-trip: write then read preserves elaboration record | Write meta with elaboration record, then readMetaJson | Record intact after round-trip | FR-009 AC-009-04 |

#### Suite E: Regression (Unchanged Behaviors)

| TC ID | Description | Input | Expected | Traces |
|-------|-------------|-------|----------|--------|
| TC-E17 | readMetaJson returns null for missing meta.json (unchanged) | Dir with no meta.json | `null` | NFR-007 |
| TC-E18 | readMetaJson returns null for corrupt JSON (unchanged) | Invalid JSON in meta.json | `null` | NFR-007 |
| TC-E19 | readMetaJson preserves legacy migration alongside elaboration defaults | Meta with phase_a_completed: true + no elaboration fields | analysis_status=analyzed, phases_completed=all, elaborations=[], elaboration_config={} | NFR-005, NFR-007 |

#### Suite F: Integration Chains

| TC ID | Description | Input | Expected | Traces |
|-------|-------------|-------|----------|--------|
| TC-E20 | Full elaboration lifecycle: read default -> add record -> write -> read back | Start with legacy meta, read (get defaults), add elaboration record, write, read back | Record persisted and readable | FR-009 AC-009-01..04 |
| TC-E21 | Multiple elaboration records per step: append not replace | Write meta with 1 record, add 2nd record for same step, write, read | Both records present in array | FR-009 AC-009-04 |

### 4.2 Manual Validation Protocol (Agent Behavior)

See Section 5 for the full manual validation protocol covering FR-001 through FR-010 and NFR-001 through NFR-007.

---

## 5. Manual Validation Protocol

This protocol validates the prompt-engineering component (roundtable-analyst.md elaboration handler) through structured manual testing sessions.

### MVT-001: Elaboration Entry at Step Boundary (FR-001)

**Steps**:
1. Run `/isdlc analyze "test feature"` to start an analysis session
2. Complete step 01-01 (Scope & Goals)
3. At the step boundary menu, select `[E]`
4. **Verify**: Introduction message displays with correct format:
   - Non-lead personas named (Alex and Jordan, since Maya leads Phase 01)
   - Topic matches the just-completed step title
   - Turn limit displayed
5. **Verify**: Lead persona (Maya) frames the discussion with focus question

**Pass Criteria**: AC-001-01, AC-001-03, AC-001-04 satisfied

### MVT-002: Multi-Persona Participation (FR-002)

**Steps**:
1. Enter elaboration mode (from MVT-001)
2. **Verify**: Each persona speaks with attribution prefix: `{Name} ({Role}):`
3. **Verify**: Each persona uses their defined communication style
4. **Verify**: All three personas contribute at least once

**Pass Criteria**: AC-002-01, AC-002-02, AC-002-04 satisfied

### MVT-003: Persona Addressing (FR-003)

**Steps**:
1. In elaboration mode, type: "Alex, how does this affect scalability?"
2. **Verify**: Alex responds first
3. Type: "What do you all think about caching?"
4. **Verify**: All three personas respond

**Pass Criteria**: AC-003-02, AC-003-03 satisfied

### MVT-004: Exit and Synthesis (FR-006, FR-008)

**Steps**:
1. In elaboration mode, type: "done"
2. **Verify**: System announces synthesis
3. **Verify**: Structured summary displayed (key insights, decisions, open questions)
4. **Verify**: Artifact update announcements shown
5. **Verify**: Step boundary menu re-presented at same position

**Pass Criteria**: AC-006-01, AC-006-03, AC-008-01, AC-008-04 satisfied

### MVT-005: Turn Limit (FR-007)

**Steps**:
1. Enter elaboration mode
2. Engage in discussion until turn 8 of 10
3. **Verify**: Lead persona warns "nearing end of discussion time"
4. Continue until turn 10
5. **Verify**: Auto-exit to synthesis triggered

**Pass Criteria**: AC-007-01, AC-007-02 satisfied

### MVT-006: Topic Focus Enforcement (FR-004)

**Steps**:
1. In elaboration mode (topic: User Experience & Journeys)
2. Type: "What about database schema design?"
3. **Verify**: Lead persona redirects to on-topic discussion

**Pass Criteria**: AC-004-02 satisfied

### MVT-007: Persona Voice Integrity (FR-010, NFR-002)

**Steps**:
1. Review 3 elaboration session transcripts
2. Cover all three personas' contributions (remove attribution prefix)
3. **Verify**: Each persona's voice is identifiable by style alone (>= 80% accuracy)
4. **Verify**: No generic "committee" responses

**Pass Criteria**: AC-010-04, NFR-002 satisfied

### MVT-008: Artifact Integrity After Synthesis (NFR-004)

**Steps**:
1. Save a copy of artifact file before elaboration
2. Run elaboration with synthesis
3. Diff artifact file before/after
4. **Verify**: Only additions (no deletions of pre-existing content)

**Pass Criteria**: NFR-004 satisfied

### MVT-009: Session Resume After Elaboration (NFR-005)

**Steps**:
1. Complete elaboration at step 01-03
2. Force interrupt the session
3. Resume the analysis session
4. **Verify**: Session resumes at correct position (step 01-03 boundary)
5. **Verify**: Elaboration record referenced in context recovery message

**Pass Criteria**: NFR-005 satisfied

### MVT-010: Backward Compatibility (NFR-007)

**Steps**:
1. At a step boundary menu, select `[C]` (Continue)
2. **Verify**: Works exactly as before elaboration implementation
3. At a step boundary menu, select `[S]` (Skip)
4. **Verify**: Works exactly as before
5. Type natural language input at step boundary
6. **Verify**: Handled exactly as before

**Pass Criteria**: NFR-007 satisfied

---

## 6. Traceability Matrix

| Requirement | Type | Test Case(s) | Test Type | Priority |
|-------------|------|-------------|-----------|----------|
| FR-001 (Entry) | Functional | MVT-001 | Manual | Must Have |
| FR-002 (Multi-Persona) | Functional | MVT-002 | Manual | Must Have |
| FR-003 (Addressing) | Functional | MVT-003 | Manual | Must Have |
| FR-004 (Topic Focus) | Functional | MVT-006 | Manual | Must Have |
| FR-005 (Cross-Talk) | Functional | MVT-002, MVT-003 | Manual | Should Have |
| FR-006 (Exit) | Functional | MVT-004 | Manual | Must Have |
| FR-007 (Turn Limits) | Functional | MVT-005, TC-E07..E10 | Manual + Unit | Should Have |
| FR-008 (Synthesis) | Functional | MVT-004, MVT-008 | Manual | Must Have |
| FR-009 (State Tracking) | Functional | TC-E01..E06, TC-E13..E16, TC-E20..E21 | Unit | Should Have |
| FR-010 (Voice Integrity) | Functional | MVT-007 | Manual | Must Have |
| NFR-001 (Responsiveness) | Non-Functional | MVT-001 (observe timing) | Manual | Should Have |
| NFR-002 (Voice Distinction) | Non-Functional | MVT-007 | Manual | Must Have |
| NFR-003 (Synthesis Complete) | Non-Functional | MVT-004 | Manual | Must Have |
| NFR-004 (Artifact Integrity) | Non-Functional | MVT-008 | Manual | Must Have |
| NFR-005 (Session Resume) | Non-Functional | MVT-009, TC-E11..E12, TC-E19 | Manual + Unit | Must Have |
| NFR-006 (Turn Limit) | Non-Functional | MVT-005 | Manual | Should Have |
| NFR-007 (Backward Compat) | Non-Functional | MVT-010, TC-E17..E18 | Manual + Unit | Must Have |
| CON-001 (Single Agent) | Constraint | Design review | N/A | Must Have |
| CON-002 (Analyze Only) | Constraint | Design review | N/A | Must Have |
| CON-003 (No state.json) | Constraint | TC-E01..E21 (only meta.json) | Unit | Must Have |
| CON-004 (Single-Line Bash) | Constraint | Code review | N/A | Must Have |
| CON-005 (Sequential) | Constraint | Design review | N/A | Must Have |
| CON-006 (Step Immutability) | Constraint | Design review | N/A | Must Have |

**Coverage Summary**:
- 10/10 FRs have at least one test case (100%)
- 7/7 NFRs have at least one validation method (100%)
- 6/6 Constraints have a verification method (100%)
- 35/35 ACs are traceable to tests or validation protocols (100%)

---

## 7. Test Execution Plan

### 7.1 Automated Tests (Phase 06)

1. **Pre-implementation**: Run `npm run test:hooks` to verify 209 tests pass (184 + 25)
2. **Implement** defensive defaults in `readMetaJson()` (~5 lines)
3. **Write** `test-three-verb-utils-elaboration.test.cjs` (21 test cases)
4. **Post-implementation**: Run all hook tests to verify 209 + 21 = 230 tests pass
5. **Regression**: Run `npm run test:all` to verify full suite passes

### 7.2 Manual Validation (Phase 07 / Acceptance)

After agent prompt implementation is complete:
1. Execute MVT-001 through MVT-010 in sequence
2. Document results with pass/fail for each step
3. Capture representative transcript excerpts for MVT-007 (voice integrity)
4. Run artifact diffs for MVT-008 (integrity check)

---

## 8. Risk-Based Testing Priorities

| Risk | Test Coverage | Mitigation |
|------|-------------|------------|
| RSK-001 (Off-topic drift) | MVT-006 | Lead persona redirect instructions |
| RSK-002 (Voice blending) | MVT-007 | Per-persona behavioral rules (Section 4.4.9) |
| RSK-003 (Artifact corruption) | MVT-008, TC-E13..E16 | Additive-only synthesis pattern |
| RSK-004 (Context overflow) | MVT-005 | Turn limit enforcement |
| RSK-005 (Meta.json breakage) | TC-E01..E21 (full suite) | Defensive defaults + write round-trips |
| RSK-006 (Menu regression) | MVT-010, TC-E17..E18 | Unchanged behavior verification |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-20 | Test Design Engineer (Phase 05) | Initial test strategy |
