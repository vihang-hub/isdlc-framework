# Test Cases: tasks.md Format Validation (TC-FV-001 through TC-FV-042)

**Component**: tasks.md v2.0 format validation rules
**Test File**: `src/claude/hooks/tests/tasks-format-validation.test.cjs`
**Traces**: FR-01, FR-02, FR-03, FR-05, FR-06, NFR-02
**Method**: CJS tests that validate sample tasks.md content against validation-rules.json regex patterns and structural rules

---

## Test File Structure

```
describe('tasks.md format validation', () => {
  describe('Header format (VR-FMT-001, VR-FMT-002)', () => { ... });
  describe('Task line format (VR-FMT-003, VR-FMT-004, VR-FMT-005)', () => { ... });
  describe('Sub-line format (VR-FMT-006 through VR-FMT-009)', () => { ... });
  describe('Section presence (VR-FMT-010 through VR-FMT-012)', () => { ... });
  describe('Dependency graph (VR-DEP-001 through VR-DEP-004)', () => { ... });
  describe('Traceability (VR-TRACE-001 through VR-TRACE-003)', () => { ... });
  describe('Mechanical mode (VR-MECH-001 through VR-MECH-004)', () => { ... });
  describe('Backward compatibility (VR-COMPAT-001 through VR-COMPAT-004)', () => { ... });
});
```

---

## Group 1: Header Format (VR-FMT-001, VR-FMT-002)

### TC-FV-001: v2.0 header present and detected

**Rule**: VR-FMT-001
**Traces**: FR-06, AC-06a
**Input**: `"Format: v2.0"` line in header block
**Expected**: Format detected as v2.0
**Assertion**: `/^Format:\s*v2\.0/m.test(content)` returns `true`

### TC-FV-002: v2.0 header missing -- treated as v1.0

**Rule**: VR-FMT-001
**Traces**: FR-06, AC-06a, NFR-02
**Input**: Header block without `Format:` line
**Expected**: Format detected as v1.0 (legacy), no validation errors
**Assertion**: `/^Format:\s*v2\.0/m.test(content)` returns `false`

### TC-FV-003: ISO-8601 timestamp valid

**Rule**: VR-FMT-002
**Traces**: FR-06
**Input**: `"Generated: 2026-02-11T10:00:00Z"`
**Expected**: Timestamp matches pattern
**Assertion**: `/^Generated:\s*\d{4}-\d{2}-\d{2}T/m.test(content)` returns `true`

### TC-FV-004: ISO-8601 timestamp invalid format

**Rule**: VR-FMT-002
**Traces**: FR-06
**Input**: `"Generated: Feb 11, 2026"`
**Expected**: Timestamp does NOT match required pattern
**Assertion**: Regex returns `false`

---

## Group 2: Task Line Format (VR-FMT-003, VR-FMT-004, VR-FMT-005)

### TC-FV-005: Checkbox [ ] (pending)

**Rule**: VR-FMT-003
**Traces**: FR-06, AC-06a
**Input**: `"- [ ] T0001 Do something"`
**Expected**: Matches checkbox pattern
**Assertion**: `/^- \[([ X]|BLOCKED)\]/.test(line)` returns `true`

### TC-FV-006: Checkbox [X] (completed)

**Rule**: VR-FMT-003
**Traces**: FR-06, AC-06a
**Input**: `"- [X] T0001 Do something"`
**Expected**: Matches checkbox pattern
**Assertion**: Regex returns `true`

### TC-FV-007: Checkbox [BLOCKED]

**Rule**: VR-FMT-003
**Traces**: FR-06, AC-06a
**Input**: `"- [BLOCKED] T0001 Do something"`
**Expected**: Matches checkbox pattern
**Assertion**: Regex returns `true`

### TC-FV-008: Task ID follows checkbox

**Rule**: VR-FMT-004
**Traces**: FR-06
**Input**: `"- [ ] T0042 Implement feature"`
**Expected**: Task ID `T0042` follows checkbox
**Assertion**: `/^- \[.+\] T\d{4}/.test(line)` returns `true`

### TC-FV-009: Task ID missing -- invalid

**Rule**: VR-FMT-004
**Traces**: FR-06
**Input**: `"- [ ] Implement feature"`
**Expected**: No task ID -- fails validation
**Assertion**: Regex returns `false`

### TC-FV-010: Traces annotation present and valid

**Rule**: VR-FMT-005
**Traces**: FR-02, AC-02a
**Input**: `"- [ ] T0042 Implement feature | traces: FR-01, AC-01a, AC-01b"`
**Expected**: Traces annotation matches pattern
**Assertion**: `/\| traces:\s*[A-Z]+-\d+/.test(line)` returns `true`

---

## Group 3: Sub-line Format (VR-FMT-006 through VR-FMT-009)

### TC-FV-011: blocked_by sub-line valid format

**Rule**: VR-FMT-006
**Traces**: FR-03, AC-03a
**Input**: `"  blocked_by: [T0010, T0011]"`
**Expected**: Matches sub-line pattern
**Assertion**: `/^\s{2}blocked_by:\s*\[T\d{4}/.test(line)` returns `true`

### TC-FV-012: blocked_by sub-line with single task

**Rule**: VR-FMT-006
**Traces**: FR-03, AC-03a
**Input**: `"  blocked_by: [T0010]"`
**Expected**: Matches pattern
**Assertion**: Regex returns `true`

### TC-FV-013: blocks sub-line valid format

**Rule**: VR-FMT-007
**Traces**: FR-03, AC-03b
**Input**: `"  blocks: [T0012, T0013]"`
**Expected**: Matches sub-line pattern
**Assertion**: `/^\s{2}blocks:\s*\[T\d{4}/.test(line)` returns `true`

### TC-FV-014: files sub-line with MODIFY action

**Rule**: VR-FMT-008
**Traces**: FR-01, AC-01a, AC-01b
**Input**: `"  files: src/claude/hooks/plan-surfacer.cjs (MODIFY)"`
**Expected**: Matches file annotation pattern
**Assertion**: `/^\s{2}files:\s*.+\s*\((CREATE|MODIFY)\)/.test(line)` returns `true`

### TC-FV-015: files sub-line with CREATE action

**Rule**: VR-FMT-008
**Traces**: FR-01, AC-01a, AC-01b
**Input**: `"  files: src/claude/hooks/tests/tasks-format-validation.test.cjs (CREATE)"`
**Expected**: Matches with CREATE action
**Assertion**: Regex returns `true`

### TC-FV-016: files sub-line with multiple files

**Rule**: VR-FMT-008
**Traces**: FR-01, AC-01a
**Input**: `"  files: src/foo.js (MODIFY), src/bar.js (CREATE)"`
**Expected**: Matches (at least one file with action)
**Assertion**: Regex returns `true`

### TC-FV-017: files sub-line with invalid action

**Rule**: VR-FMT-008
**Traces**: FR-01, AC-01b
**Input**: `"  files: src/foo.js (DELETE)"`
**Expected**: Does NOT match (DELETE is not a valid action)
**Assertion**: Regex returns `false`

### TC-FV-018: reason sub-line present for BLOCKED task

**Rule**: VR-FMT-009
**Traces**: FR-05, AC-05e
**Input**: `"  reason: Dependency T0009 failed after retries"`
**Expected**: Matches reason pattern
**Assertion**: `/^\s{2}reason:\s*.+/.test(line)` returns `true`

---

## Group 4: Section Presence (VR-FMT-010, VR-FMT-011, VR-FMT-012)

### TC-FV-019: Dependency Graph section present when deps exist

**Rule**: VR-FMT-010
**Traces**: FR-03, AC-03d, AC-06e
**Input**: Full v2.0 tasks.md with `blocked_by` sub-lines AND `## Dependency Graph` section
**Expected**: Validation passes (section present, deps exist)
**Assertion**: Content includes both `blocked_by:` and `## Dependency Graph`

### TC-FV-020: Dependency Graph section missing when deps exist -- warning

**Rule**: VR-FMT-010
**Traces**: FR-03, AC-03d
**Input**: v2.0 tasks.md with `blocked_by` sub-lines but NO `## Dependency Graph` section
**Expected**: Warning about missing Dependency Graph section
**Assertion**: Warning generated

### TC-FV-021: Traceability Matrix section present when traces exist

**Rule**: VR-FMT-011
**Traces**: FR-02, AC-02b, AC-06f
**Input**: v2.0 tasks.md with `| traces:` annotations AND `## Traceability Matrix` section
**Expected**: Validation passes
**Assertion**: Content includes both `| traces:` and `## Traceability Matrix`

### TC-FV-022: Progress Summary section present with accurate counts

**Rule**: VR-FMT-012
**Traces**: FR-06
**Input**: v2.0 tasks.md with `## Progress Summary` section
**Expected**: Section exists and contains table with phase/task/complete counts
**Assertion**: Content includes `## Progress Summary` and a table row

---

## Group 5: Dependency Graph Validation (VR-DEP-001 through VR-DEP-004)

### TC-FV-023: Acyclic dependency graph (DAG) -- valid

**Rule**: VR-DEP-001
**Traces**: FR-03, AC-03c
**Input**: Tasks with linear dependencies: T0010 -> T0011 -> T0012 (no cycles)
**Expected**: Cycle detection returns null (no cycle)
**Assertion**: `detectCyclesInDependencyGraph(content)` returns `null`

### TC-FV-024: Cyclic dependency graph -- detected

**Rule**: VR-DEP-001
**Traces**: FR-03, AC-03c
**Input**: Tasks with cycle: T0010 blocked_by T0012, T0011 blocked_by T0010, T0012 blocked_by T0011
**Expected**: Cycle detection returns warning string mentioning the involved tasks
**Assertion**: Return value is a string containing "cycle" and task IDs

### TC-FV-025: Two-node cycle -- detected

**Rule**: VR-DEP-001
**Traces**: FR-03, AC-03c
**Input**: T0010 blocked_by T0011, T0011 blocked_by T0010
**Expected**: Cycle detected
**Assertion**: Return value is non-null string

### TC-FV-026: Self-referencing task -- detected as cycle

**Rule**: VR-DEP-001
**Traces**: FR-03, AC-03c
**Input**: T0010 blocked_by T0010
**Expected**: Cycle detected (task depends on itself)
**Assertion**: Return value mentions T0010

### TC-FV-027: Invalid task ID in blocked_by -- ignored

**Rule**: VR-DEP-002
**Traces**: FR-03, AC-03a
**Input**: T0010 blocked_by [T9999] where T9999 does not exist
**Expected**: Invalid reference ignored, no cycle warning, no error
**Assertion**: No warning produced (fail-open on invalid references)

### TC-FV-028: Consistency check: blocked_by matches blocks

**Rule**: VR-DEP-003
**Traces**: FR-03
**Input**: T0010 blocked_by [T0009] AND T0009 blocks [T0010]
**Expected**: Consistent -- no warning
**Assertion**: Both directions present

---

## Group 6: Traceability Validation (VR-TRACE-001 through VR-TRACE-003)

### TC-FV-029: All FRs have task coverage

**Rule**: VR-TRACE-001
**Traces**: FR-02, AC-02e
**Input**: v2.0 tasks.md where every FR-NN appears in at least one `| traces:` annotation
**Expected**: 100% FR coverage, no warnings
**Assertion**: Every FR extracted from requirements has at least one task

### TC-FV-030: FR without task coverage -- gap detected

**Rule**: VR-TRACE-001
**Traces**: FR-02, AC-02e
**Input**: v2.0 tasks.md where FR-08 has zero tasks with `traces: FR-08`
**Expected**: Gap warning for FR-08
**Assertion**: Uncovered requirements list includes FR-08

### TC-FV-031: Orphan task without traces -- detected

**Rule**: VR-TRACE-002
**Traces**: FR-02, AC-02d
**Input**: v2.0 tasks.md with a task line that has no `| traces:` annotation
**Expected**: Orphan warning for that task
**Assertion**: Orphan tasks list includes the task ID

### TC-FV-032: Valid traces reference identifiers

**Rule**: VR-TRACE-003
**Traces**: FR-02
**Input**: `| traces: FR-01, AC-01a` -- both are valid identifiers
**Expected**: No warning (valid references)
**Assertion**: Identifiers match `[A-Z]+-\d+[a-z]?` pattern

---

## Group 7: Mechanical Mode Validation (VR-MECH-001 through VR-MECH-004)

### TC-FV-033: Phase 06 tasks with files sub-lines -- mechanical mode feasible

**Rule**: VR-MECH-001
**Traces**: FR-05, AC-05g
**Input**: Phase 06 section with tasks having `files:` sub-lines
**Expected**: Mechanical mode feasibility check passes
**Assertion**: At least one task in Phase 06 has `files:` sub-line

### TC-FV-034: Phase 06 tasks without files sub-lines -- fallback to standard

**Rule**: VR-MECH-001
**Traces**: FR-05, AC-05g
**Input**: Phase 06 section with tasks but no `files:` sub-lines
**Expected**: Mechanical mode feasibility check fails, fallback triggered
**Assertion**: No `files:` sub-line found in Phase 06 section

### TC-FV-035: File paths are project-relative

**Rule**: VR-MECH-002
**Traces**: FR-01, AC-01d
**Input**: `"  files: src/claude/hooks/plan-surfacer.cjs (MODIFY)"`
**Expected**: Path starts with alphabetic character (project-relative), not `/` (absolute)
**Assertion**: `/^[a-zA-Z]/.test(filePath)` returns `true`

### TC-FV-036: File paths with absolute path -- invalid

**Rule**: VR-MECH-002
**Traces**: FR-01, AC-01d
**Input**: `"  files: /Users/dev/src/foo.js (MODIFY)"`
**Expected**: Path starts with `/` -- NOT project-relative
**Assertion**: Path fails relative-path check

### TC-FV-037: File action CREATE valid

**Rule**: VR-MECH-003
**Traces**: FR-01, AC-01b
**Input**: `"  files: src/new-file.js (CREATE)"`
**Expected**: Action `CREATE` matches allowed set
**Assertion**: `/\((CREATE|MODIFY)\)/.test(line)` returns `true`

### TC-FV-038: BLOCKED task has reason sub-line

**Rule**: VR-MECH-004
**Traces**: FR-05, AC-05e
**Input**: Task with `[BLOCKED]` checkbox followed by `reason:` sub-line
**Expected**: BLOCKED + reason pair is valid
**Assertion**: Task has both `[BLOCKED]` checkbox and indented `reason:` sub-line

### TC-FV-039: BLOCKED task without reason -- warning

**Rule**: VR-MECH-004
**Traces**: FR-05, AC-05e
**Input**: Task with `[BLOCKED]` checkbox but NO `reason:` sub-line
**Expected**: Warning about missing reason for blocked task
**Assertion**: Validation detects missing reason

---

## Group 8: Backward Compatibility (VR-COMPAT-001 through VR-COMPAT-004)

### TC-FV-040: v1.0 tasks.md accepted without warnings

**Rule**: VR-COMPAT-001
**Traces**: NFR-02, AC-06g
**Input**: Legacy tasks.md with only `- [ ]`/`- [X]` checkboxes, no `Format:` header, no annotations
**Expected**: Zero validation warnings, zero errors
**Assertion**: Format validation returns empty warnings array (or skips entirely)

### TC-FV-041: Checkbox pattern works unchanged in v2.0

**Rule**: VR-COMPAT-002
**Traces**: NFR-02, AC-06a
**Input**: v2.0 tasks.md with `- [ ] T0001 Do thing | traces: FR-01`
**Expected**: Standard checkbox regex `^- \[[ X]\] T\d{4}` still matches the line (annotations do not break matching)
**Assertion**: Existing regex patterns from PLAN INTEGRATION PROTOCOL match v2.0 lines

### TC-FV-042: Phase header pattern works unchanged in v2.0

**Rule**: VR-COMPAT-003
**Traces**: NFR-02
**Input**: v2.0 tasks.md with `## Phase 06: Implementation -- PENDING`
**Expected**: Standard phase header regex `^## Phase \d+:` still matches
**Assertion**: `/^## Phase \d+:/.test(header)` returns `true`

---

## Summary

| Group | Test Count | Rules Covered | ACs Covered |
|-------|-----------|---------------|-------------|
| Header format | 4 | VR-FMT-001, VR-FMT-002 | AC-06a |
| Task line format | 6 | VR-FMT-003, VR-FMT-004, VR-FMT-005 | AC-02a, AC-06a |
| Sub-line format | 8 | VR-FMT-006, VR-FMT-007, VR-FMT-008, VR-FMT-009 | AC-01a, AC-01b, AC-03a, AC-03b, AC-05e |
| Section presence | 4 | VR-FMT-010, VR-FMT-011, VR-FMT-012 | AC-02b, AC-03d, AC-06e, AC-06f |
| Dependency graph | 6 | VR-DEP-001, VR-DEP-002, VR-DEP-003 | AC-03a, AC-03c |
| Traceability | 4 | VR-TRACE-001, VR-TRACE-002, VR-TRACE-003 | AC-02d, AC-02e |
| Mechanical mode | 7 | VR-MECH-001, VR-MECH-002, VR-MECH-003, VR-MECH-004 | AC-01b, AC-01d, AC-05e, AC-05g |
| Backward compat | 3 | VR-COMPAT-001, VR-COMPAT-002, VR-COMPAT-003 | AC-06a, AC-06g, NFR-02 |
| **TOTAL** | **42** | **23 rules** | **18 ACs** |
