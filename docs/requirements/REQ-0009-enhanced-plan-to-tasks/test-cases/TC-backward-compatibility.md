# Test Cases: Backward Compatibility (TC-BC-001 through TC-BC-012)

**Components**: plan-surfacer.cjs, tasks.md format, PLAN INTEGRATION PROTOCOL
**Test File**: `src/claude/hooks/tests/tasks-format-validation.test.cjs` (Group 8) and `plan-surfacer.test.cjs` (TC-PS-14)
**Traces**: NFR-02, FR-06 (AC-06a, AC-06g), FR-07 (AC-07a)
**Priority**: P0 -- backward compatibility is the highest-risk area

---

## Rationale

This is the most critical test category. The enhanced tasks.md format adds pipe-delimited annotations and sub-lines that existing agents and the plan-surfacer hook do not know about. If these additions break existing parsing patterns, the entire framework breaks.

The design ensures backward compatibility through two principles:
1. **Additive only**: New content appears AFTER existing patterns on the same line (pipe annotations) or on new indented lines (sub-lines)
2. **Legacy detection**: `Format: v2.0` header presence determines whether enhanced validation runs

---

## Automated Tests (in tasks-format-validation.test.cjs)

### TC-BC-001: v1.0 tasks.md produces zero validation warnings

**Traces**: NFR-02, AC-06g
**Priority**: P0
**Input**: Minimal tasks.md with only standard checkbox lines, no `Format:` header
```markdown
# Task Plan: feature test

Generated: 2026-02-11T10:00:00Z
Workflow: feature
Phases: 2

---

## Phase 01: Requirements -- COMPLETE
- [X] T0001 Capture requirements
- [X] T0002 Write user stories

## Phase 06: Implementation -- PENDING
- [ ] T0010 Write tests
- [ ] T0011 Implement code
```
**Expected**: `validateTasksFormat()` returns empty array (validation skipped for v1.0)
**Assertion**: `warnings.length === 0`

### TC-BC-002: Checkbox regex matches v1.0 format

**Traces**: NFR-02, AC-06a
**Priority**: P0
**Input**: `"- [ ] T0001 Write tests"`
**Expected**: Standard checkbox regex `^- \[[ X]\] T\d{4}` matches
**Assertion**: Regex matches (existing PLAN INTEGRATION PROTOCOL pattern works)

### TC-BC-003: Checkbox regex matches v2.0 format (with pipe annotation)

**Traces**: NFR-02, AC-06a, AC-06g
**Priority**: P0
**Input**: `"- [ ] T0001 Write tests | traces: FR-01, AC-01a"`
**Expected**: Standard checkbox regex `^- \[[ X]\] T\d{4}` STILL matches (pipe annotation is after the matched portion)
**Assertion**: Regex matches -- existing agents that only match up to the task ID are unaffected

### TC-BC-004: Phase header regex matches v2.0 format

**Traces**: NFR-02
**Priority**: P0
**Input**: `"## Phase 06: Implementation -- PENDING"`
**Expected**: Standard phase header regex `^## Phase \d+:` matches
**Assertion**: Regex matches -- phase header format is unchanged

### TC-BC-005: Sub-lines do not match task line regex

**Traces**: NFR-02, AC-06g
**Priority**: P0
**Input**: `"  blocked_by: [T0010]"` (indented sub-line)
**Expected**: Standard task regex `^- \[[ X]\] T\d{4}` does NOT match this line
**Assertion**: Regex does NOT match -- sub-lines are invisible to agents that only scan for task lines

### TC-BC-006: Pipe character in description does not break parsing

**Traces**: NFR-02, AC-06g
**Priority**: P1
**Input**: Various lines with `|` character:
- `"- [ ] T0001 Write tests | traces: FR-01"` -- pipe is annotation separator
- Task ID extraction should work regardless of pipe content
**Expected**: Task ID (`T0001`) is correctly extracted from the line
**Assertion**: `line.match(/^- \[[ X]\] (T\d{4})/)[1] === 'T0001'`

### TC-BC-007: Empty tasks.md handled gracefully

**Traces**: NFR-02
**Priority**: P1
**Input**: Empty file (0 bytes) named `tasks.md`
**Expected**: No crash, no validation errors
**Assertion**: Function returns without error (empty array or null)

### TC-BC-008: tasks.md with only header block (no tasks)

**Traces**: NFR-02
**Priority**: P1
**Input**: tasks.md with header but no phase sections or tasks
**Expected**: No crash, no validation errors
**Assertion**: Graceful handling, empty results

---

## Automated Tests (in plan-surfacer.test.cjs)

### TC-BC-009: Existing plan-surfacer blocking behavior preserved (TC-PS-01 equivalent)

**Traces**: AC-08a, NFR-02
**Priority**: P0
**Input**: Implementation phase, no tasks.md file
**Expected**: Hook BLOCKS (same as before enhancement)
**Assertion**: Output includes `stopReason` with "TASK PLAN NOT GENERATED"

This is covered by existing TC-PS-01 (T1 in the test file). The test MUST NOT be modified. Its continued passage proves backward compatibility.

### TC-BC-010: v1.0 tasks.md passes without warnings in implementation phase

**Traces**: AC-08a, NFR-02
**Priority**: P0
**Input**: Implementation phase, v1.0 tasks.md (no Format header) exists
**Expected**: Hook ALLOWS, no stderr warnings
**Assertion**: `exitCode === 0`, `stdout === ''`, no stderr

This is TC-PS-14. It is the single most important backward compatibility test for the hook.

---

## Manual Verification Tests (during Phase 16)

### TC-BC-011: Fix workflow completes end-to-end with v1.0 tasks.md

**Traces**: NFR-02, AC-06g
**Priority**: P0
**Method**: Run a fix workflow (no design phase, no refinement step). Verify:
1. tasks.md is generated in v1.0 format (or v2.0 format if generate-plan detects no requirements-spec.md)
2. All agents complete their phases without errors
3. plan-surfacer hook allows all phases
4. No "format validation" warnings appear
**Pass criteria**: Workflow completes. Zero errors related to enhanced format.

### TC-BC-012: PLAN INTEGRATION PROTOCOL v1 behavior unchanged for checkbox toggling

**Traces**: NFR-02, AC-07a
**Priority**: P0
**Method**: Agent toggles `- [ ]` to `- [X]` on a v1.0 tasks.md file (no annotations). Verify:
1. No errors from the v2 annotation preservation rules (nothing to preserve in v1.0)
2. Checkbox toggle succeeds
3. No new content added by the protocol rules
**Pass criteria**: Identical behavior to pre-enhancement protocol.

---

## Regression Validation

These tests serve as a regression suite. If ANY of these fail after implementation, the backward compatibility guarantee (NFR-02) is violated and the change must be rolled back.

| Test | Automated | Critical | Description |
|------|-----------|----------|-------------|
| TC-BC-001 | Yes | P0 | v1.0 zero warnings |
| TC-BC-002 | Yes | P0 | Checkbox regex v1.0 |
| TC-BC-003 | Yes | P0 | Checkbox regex v2.0 |
| TC-BC-004 | Yes | P0 | Phase header regex |
| TC-BC-005 | Yes | P0 | Sub-lines invisible |
| TC-BC-006 | Yes | P1 | Pipe character safe |
| TC-BC-007 | Yes | P1 | Empty file handled |
| TC-BC-008 | Yes | P1 | Header-only handled |
| TC-BC-009 | Yes (existing) | P0 | Blocking preserved |
| TC-BC-010 | Yes (TC-PS-14) | P0 | v1.0 allows without warnings |
| TC-BC-011 | Manual | P0 | Fix workflow e2e |
| TC-BC-012 | Manual | P0 | Protocol v1 behavior |

**Total**: 12 backward compatibility test cases
**Automated**: 10 (8 new + 2 existing)
**Manual**: 2
