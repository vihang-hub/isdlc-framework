# Test Strategy: REQ-0009 Enhanced Plan-to-Tasks Pipeline

**Version**: 1.0.0
**Date**: 2026-02-11
**Author**: Test Design Engineer (Agent 04)
**Phase**: 05-test-strategy
**Workflow**: feature
**Artifact Folder**: REQ-0009-enhanced-plan-to-tasks
**Requirements Coverage**: 8 FRs, 38 ACs, 4 NFRs, 4 Constraints

---

## 1. Existing Infrastructure (from test evaluation)

- **Framework**: Node.js built-in `node:test` + `node:assert/strict` (Node 18+)
- **Two test streams**: ESM (`lib/*.test.js`) and CJS (`src/claude/hooks/tests/*.test.cjs`)
- **Run commands**: `npm test` (ESM), `npm run test:hooks` (CJS), `npm run test:all` (both)
- **Coverage Tool**: None (no istanbul/c8 configured; coverage tracked by test count)
- **Current Test Baseline**: 555+ tests (302 ESM + 253 CJS) per Article II
- **Existing plan-surfacer tests**: 10 tests in `src/claude/hooks/tests/plan-surfacer.test.cjs`
- **Hook test patterns**: `setupTestEnv()` creates temp dir, `writeState()` writes state.json, `runHook()` spawns hook process, `createTasksPlan()` writes minimal tasks.md
- **Naming convention**: `*.test.cjs` for hook tests, `*.test.js` for ESM tests

### Approach

**Extend existing test suite** -- do NOT replace. New tests follow existing conventions:
- Hook tests added to `src/claude/hooks/tests/plan-surfacer.test.cjs`
- New test file `src/claude/hooks/tests/tasks-format-validation.test.cjs` for format parsing tests
- All new tests use `node:test` + `node:assert/strict`
- Test isolation via temp directories matching existing `setupTestEnv()` pattern

---

## 2. Testability Analysis

### 2.1 What IS Testable (Automated Unit/Integration Tests)

| Component | File | Test Type | Why Testable |
|-----------|------|-----------|--------------|
| plan-surfacer.cjs format validation | `src/claude/hooks/plan-surfacer.cjs` | CJS unit test | New `validateTasksFormat()` and `detectCyclesInDependencyGraph()` functions are deterministic JavaScript code with clear inputs/outputs |
| tasks.md v2.0 format parsing | Fixture files | CJS validation test | Format rules from validation-rules.json can be verified against sample tasks.md files |
| Backward compatibility | Fixture files | CJS regression test | v1.0 tasks.md fixtures run through plan-surfacer.cjs must produce no warnings |
| Dependency cycle detection | Fixture files | CJS unit test | Kahn's algorithm implementation is deterministic |
| EBNF format compliance | Fixture files | CJS validation test | Regex patterns from validation-rules.json can be tested against sample task lines |
| Existing plan-surfacer behavior | `src/claude/hooks/plan-surfacer.cjs` | CJS regression test | All 10 existing tests must continue to pass (Article II baseline) |

### 2.2 What is NOT Testable via Unit Tests (Prompt-Level Changes)

These components are LLM instruction sets (markdown files), not executable code. They cannot be unit-tested but are validated through output format checks and manual review.

| Component | File(s) | Validation Approach |
|-----------|---------|---------------------|
| ORCH-012 SKILL.md enhancements | `src/claude/skills/orchestration/generate-plan/SKILL.md` | **Output format validation**: verify generated tasks.md matches v2.0 schema. Manual review of prompt instructions. |
| Task refinement step | `src/claude/commands/isdlc.md` (Section 3e-refine) | **Output artifact validation**: verify task-refinement-log.md is produced; verify tasks.md Phase 06 tasks have file-level annotations after refinement. Manual review. |
| Mechanical execution mode | `src/claude/agents/05-software-developer.md` | **Behavioral validation**: verify agent marks tasks [X]/[BLOCKED]; verify deviation flagging. Manual review of prompt instructions. |
| PLAN INTEGRATION PROTOCOL v2 | 14 agent files | **Consistency check**: verify all 14 files contain identical Annotation Preservation section. **Behavioral validation**: agents must preserve annotations when toggling checkboxes. Manual review. |
| Enhanced tasks.md template | `.isdlc/templates/workflow-tasks-template.md` | **Format validation**: verify template structure against schema. Manual review. |

### 2.3 Mixed Testability (Partial Automated + Manual)

| Component | Automated Portion | Manual Portion |
|-----------|-------------------|----------------|
| Traceability tag generation | Validate format of `\| traces:` annotations in sample output | Verify semantic correctness of REQ-to-task mappings |
| Dependency graph generation | Validate acyclicity, format of Dependency Graph section | Verify dependencies make logical sense |
| Refinement step trigger | Verify state conditions for trigger in plan-surfacer.cjs | Verify orchestrator correctly invokes refinement |
| Agent protocol updates | Verify file contents contain new sections (text match) | Verify agents actually preserve annotations at runtime |

---

## 3. Test Types and Strategy

### 3.1 CJS Hook Tests (plan-surfacer.cjs)

**Target**: `src/claude/hooks/tests/plan-surfacer.test.cjs`
**Method**: Extend existing test file with 7 new test cases (TC-PS-11 through TC-PS-17)
**Fixture approach**: Write tasks.md fixtures to temp directories, then run hook and verify output

New test cases (per module-design-plan-surfacer-validation.md Section 7):

| Test ID | AC Coverage | Input | Expected |
|---------|-------------|-------|----------|
| TC-PS-11 | AC-08b | v2.0 tasks.md with `files:` sub-lines, phase=06-implementation | allow, no stderr |
| TC-PS-12 | AC-08b, AC-08c | v2.0 tasks.md without `files:` sub-lines, phase=06-implementation | allow, stderr warning about missing file annotations |
| TC-PS-13 | AC-08b, AC-08c | v2.0 tasks.md without `\| traces:`, phase=06-implementation | allow, stderr warning about missing traceability |
| TC-PS-14 | AC-08a, NFR-02 | v1.0 tasks.md (no Format header), phase=06-implementation | allow, no stderr (validation skipped) |
| TC-PS-15 | AC-08c | v2.0 tasks.md with circular blocked_by references, phase=06-implementation | allow, stderr cycle warning |
| TC-PS-16 | AC-08b | v2.0 tasks.md, phase=05-test-strategy | allow, no stderr (phase check skips validation) |
| TC-PS-17 | AC-08c | v2.0 tasks.md with malformed content, phase=06-implementation | allow, no stderr (fail-open) |

### 3.2 CJS Format Validation Tests (NEW file)

**Target**: `src/claude/hooks/tests/tasks-format-validation.test.cjs`
**Method**: New test file for tasks.md format validation rules from validation-rules.json
**Purpose**: Validate the 23 rules against sample fixture files without requiring the hook process

Test groups:

| Group | Rules | Test Count | Focus |
|-------|-------|------------|-------|
| Header format | VR-FMT-001, VR-FMT-002 | 4 | v2.0 header detection, timestamp format |
| Task line format | VR-FMT-003, VR-FMT-004, VR-FMT-005 | 6 | Checkbox states, task IDs, traces annotations |
| Sub-line format | VR-FMT-006, VR-FMT-007, VR-FMT-008, VR-FMT-009 | 8 | blocked_by, blocks, files, reason sub-lines |
| Section presence | VR-FMT-010, VR-FMT-011, VR-FMT-012 | 4 | Dependency Graph, Traceability Matrix, Progress Summary |
| Dependency validation | VR-DEP-001 through VR-DEP-004 | 6 | Acyclicity, valid references, consistency, critical path |
| Traceability validation | VR-TRACE-001 through VR-TRACE-003 | 4 | FR coverage, orphan detection, valid references |
| Mechanical mode validation | VR-MECH-001 through VR-MECH-004 | 5 | File annotations, paths, actions, blocked reasons |
| Backward compatibility | VR-COMPAT-001 through VR-COMPAT-004 | 5 | v1.0 acceptance, checkbox patterns, phase headers, missing annotations |

**Estimated total**: ~42 test cases in this file

### 3.3 Manual/Prompt-Level Validation

For components that are markdown instruction sets (not executable code), we define verification checklists. These are validated during Phase 16 (Quality Loop) and Phase 08 (Code Review).

| Validation ID | Component | Verification Method |
|---------------|-----------|---------------------|
| MV-01 | ORCH-012 SKILL.md | Run generate-plan on a test project; verify output matches v2.0 schema |
| MV-02 | Task refinement step | Run feature workflow through design phase; verify refinement output |
| MV-03 | Mechanical mode | Set `--mechanical` flag; verify agent follows task-by-task execution |
| MV-04 | Protocol consistency | Diff all 14 agent files; verify identical Annotation Preservation section |
| MV-05 | Template format | Verify template has `### 06-implementation` heading and comment |
| MV-06 | Backward compat (agents) | Run workflow without v2.0 features; verify no breakage |

### 3.4 Regression Tests

All 10 existing plan-surfacer tests (TC-PS-01 through TC-PS-10) MUST pass unchanged. No existing test modifications are required or allowed.

Regression criteria (Article II):
- Total test count must not decrease below 555 baseline
- All modified hook files must have corresponding test updates
- Existing test behavior must be preserved

---

## 4. Test Data Strategy

### 4.1 Fixture Files

All fixtures are created programmatically in test `beforeEach()` blocks using the existing `setupTestEnv()` pattern. No persistent fixture files are needed.

| Fixture | Purpose | Created By |
|---------|---------|------------|
| v2.0 tasks.md (complete) | Happy path with all annotations, sub-lines, sections | `createV2TasksPlan(tmpDir, options)` helper |
| v2.0 tasks.md (no files) | Missing file-level annotations | `createV2TasksPlan(tmpDir, { includeFiles: false })` |
| v2.0 tasks.md (no traces) | Missing traceability annotations | `createV2TasksPlan(tmpDir, { includeTraces: false })` |
| v2.0 tasks.md (cycle) | Circular blocked_by references | `createV2TasksPlan(tmpDir, { withCycle: true })` |
| v1.0 tasks.md (legacy) | No Format header, no annotations | `createTasksPlan(tmpDir)` (existing) |
| v2.0 tasks.md (malformed) | Corrupted content | `createMalformedTasksPlan(tmpDir)` |
| v2.0 tasks.md (BLOCKED tasks) | Tasks with [BLOCKED] status and reason sub-lines | `createV2TasksPlan(tmpDir, { withBlocked: true })` |
| State with mechanical_mode | state.json with `mechanical_mode: true` | `writeState(tmpDir, { active_workflow: { mechanical_mode: true, ... } })` |

### 4.2 Fixture Generator Functions

New test helpers will be added to the plan-surfacer test file (not a separate helper file, to match the existing pattern where plan-surfacer.test.cjs has its own `setupTestEnv`/`writeState`/`createTasksPlan` inline).

```javascript
function createV2TasksPlan(tmpDir, options = {}) {
  const {
    includeFiles = true,
    includeTraces = true,
    withCycle = false,
    withBlocked = false
  } = options;

  const docsDir = path.join(tmpDir, 'docs', 'isdlc');
  fs.mkdirSync(docsDir, { recursive: true });

  let content = '# Task Plan: feature test\n\n';
  content += 'Generated: 2026-02-11T10:00:00Z\n';
  content += 'Workflow: feature\n';
  content += 'Format: v2.0\n';
  content += 'Phases: 2\n\n';
  content += '---\n\n';
  content += '## Phase 01: Requirements Capture -- COMPLETE\n';
  content += '- [X] T0001 Capture requirements\n\n';
  content += '## Phase 06: Implementation -- PENDING\n';

  const traces = includeTraces ? ' | traces: FR-01, AC-01a' : '';
  const files = includeFiles ? '\n  files: src/foo/bar.js (MODIFY)' : '';

  if (withCycle) {
    content += `- [ ] T0010 Task A${traces}${files}\n`;
    content += '  blocked_by: [T0011]\n';
    content += `- [ ] T0011 Task B${traces}${files}\n`;
    content += '  blocked_by: [T0010]\n';
  } else if (withBlocked) {
    content += `- [BLOCKED] T0010 Blocked task${traces}${files}\n`;
    content += '  reason: Dependency T0009 failed\n';
    content += `- [ ] T0011 Normal task${traces}${files}\n`;
  } else {
    content += `- [ ] T0010 Implement feature A${traces}${files}\n`;
    content += `- [ ] T0011 Implement feature B${traces}${files}\n`;
    if (includeFiles) {
      content += '  blocked_by: [T0010]\n';
    }
  }

  content += '\n## Dependency Graph\n\n';
  content += '### Critical Path\nT0010 -> T0011\n\n';
  content += '## Traceability Matrix\n\n';
  content += '| Requirement | Tasks | Coverage |\n';
  content += '|-------------|-------|----------|\n';
  content += '| FR-01 | T0010, T0011 | 100% |\n\n';
  content += '## Progress Summary\n\n';
  content += '| Phase | Tasks | Complete |\n';
  content += '|-------|-------|----------|\n';
  content += '| 01 | 1 | 1 |\n';
  content += '| 06 | 2 | 0 |\n';

  fs.writeFileSync(path.join(docsDir, 'tasks.md'), content);
}
```

---

## 5. Coverage Targets

### 5.1 Automated Test Coverage

| Component | Target | Metric |
|-----------|--------|--------|
| plan-surfacer.cjs (existing behavior) | 100% | All 10 existing tests pass |
| plan-surfacer.cjs (new format validation) | 100% of new code paths | 7 new test cases covering all validation checks |
| tasks.md format validation rules | 100% of 23 rules | ~42 test cases covering all validation rules from validation-rules.json |
| Backward compatibility | 100% of VR-COMPAT rules | 5 test cases verifying v1.0 format acceptance |
| Dependency cycle detection | 100% of algorithm paths | Acyclic, single cycle, multi-node cycle, no dependencies |

### 5.2 Acceptance Criteria Coverage

| FR | AC Count | Automated Tests | Manual Validation | Coverage |
|----|----------|----------------|-------------------|----------|
| FR-01 (File-Level Granularity) | 5 (AC-01a through AC-01e) | VR-FMT-008, VR-MECH-002, VR-MECH-003 | MV-01, MV-02 | 100% |
| FR-02 (Traceability) | 5 (AC-02a through AC-02e) | VR-FMT-005, VR-TRACE-001/002/003 | MV-01 | 100% |
| FR-03 (Dependency Graph) | 5 (AC-03a through AC-03e) | VR-DEP-001/002/003/004, VR-FMT-006/007 | MV-02 | 100% |
| FR-04 (Refinement Step) | 7 (AC-04a through AC-04g) | State trigger conditions | MV-02 | 100% |
| FR-05 (Mechanical Mode) | 7 (AC-05a through AC-05g) | VR-MECH-001/002/003/004 | MV-03 | 100% |
| FR-06 (Enhanced Format) | 7 (AC-06a through AC-06g) | VR-FMT-001 through VR-FMT-012, VR-COMPAT-001/002 | MV-05 | 100% |
| FR-07 (Protocol Update) | 4 (AC-07a through AC-07d) | Protocol file consistency check | MV-04, MV-06 | 100% |
| FR-08 (Plan Surfacer Hook) | 3 (AC-08a through AC-08c) | TC-PS-11 through TC-PS-17 | -- | 100% |
| **TOTAL** | **38 AC** | **~49 tests** | **6 manual validations** | **100%** |

### 5.3 New Test Count Impact

| Category | Before | Added | After |
|----------|--------|-------|-------|
| plan-surfacer.test.cjs | 10 | 7 | 17 |
| tasks-format-validation.test.cjs (NEW) | 0 | 42 | 42 |
| **Total new tests** | | **49** | |
| **Project total** | 555+ | +49 | 604+ |

This exceeds the Article II baseline requirement (555) and maintains the "test count must not decrease" rule.

---

## 6. Critical Test Paths

### 6.1 Critical Path: Backward Compatibility

The highest-risk area is backward compatibility. If the enhanced format breaks existing agents that only check `- [ ]`/`- [X]` patterns, the entire framework breaks.

**Critical tests**:
1. TC-PS-14: v1.0 tasks.md passes without warnings
2. VR-COMPAT-001: v1.0 acceptance
3. VR-COMPAT-002: Checkbox pattern unchanged
4. VR-COMPAT-003: Phase header pattern unchanged
5. VR-COMPAT-004: Missing annotations cause no errors

### 6.2 Critical Path: Plan-Surfacer Hook Behavior Preservation

The plan-surfacer hook is a gatekeeper. Its blocking behavior must be preserved exactly.

**Critical tests**:
1. TC-PS-01 through TC-PS-10: All existing tests pass unchanged
2. TC-PS-17: Fail-open on malformed content
3. TC-PS-14: No validation on legacy format

### 6.3 Critical Path: Cycle Detection Correctness

Dependency cycles in tasks.md would cause mechanical execution to fail.

**Critical tests**:
1. TC-PS-15: Cycle detected and warning emitted
2. VR-DEP-001: DAG validation
3. VR-DEP-002: Invalid references handled gracefully

---

## 7. Test Execution Plan

### 7.1 Phase 06 (Implementation) -- TDD Red/Green

1. Write failing tests first (plan-surfacer.test.cjs new cases)
2. Implement `validateTasksFormat()` and `detectCyclesInDependencyGraph()` in plan-surfacer.cjs
3. Verify tests pass (green)
4. Write format validation tests (tasks-format-validation.test.cjs)
5. These validate the format rules that ORCH-012 output must satisfy

### 7.2 Phase 16 (Quality Loop)

1. Run `npm run test:hooks` -- all CJS tests pass
2. Run `npm run test:all` -- full suite passes
3. Run manual validations MV-01 through MV-06
4. Verify test count >= 604

### 7.3 Phase 08 (Code Review)

1. Review test coverage completeness
2. Verify traceability matrix accuracy
3. Confirm no orphan tests (tests without requirement traces)
4. Confirm no uncovered ACs (ACs without test cases)

---

## 8. Risk Mitigation

| Risk | Mitigation | Test Coverage |
|------|------------|---------------|
| Enhanced format breaks existing agents | Backward compatibility test suite (5 tests) | VR-COMPAT-001 through 004, TC-PS-14 |
| Cycle detection fails on edge cases | Comprehensive cycle detection tests (4 variations) | TC-PS-15, VR-DEP-001 |
| Format validation blocks when it should warn | All validation tests assert `decision: 'allow'` | TC-PS-11 through TC-PS-17 |
| Mechanical mode fallback fails silently | Explicit fallback test case | VR-MECH-001 |
| Test baseline decrease | Test count tracking (604+ > 555 baseline) | Article II compliance check |

---

## 9. Test Commands (Use Existing)

```bash
# Run hook tests (CJS) -- includes plan-surfacer and new format validation tests
npm run test:hooks

# Run all tests (ESM + CJS)
npm run test:all

# Run only plan-surfacer tests
node --test src/claude/hooks/tests/plan-surfacer.test.cjs

# Run only format validation tests (new file)
node --test src/claude/hooks/tests/tasks-format-validation.test.cjs
```

---

## 10. Traces

| Requirement | How Covered in Test Strategy |
|-------------|------------------------------|
| FR-01 | Format validation tests for file-level annotations (VR-FMT-008, VR-MECH-002/003) + manual validation MV-01/02 |
| FR-02 | Traceability validation tests (VR-TRACE-001/002/003, VR-FMT-005) + manual validation MV-01 |
| FR-03 | Dependency graph tests (VR-DEP-001/002/003/004, VR-FMT-006/007) + cycle detection (TC-PS-15) |
| FR-04 | Refinement trigger condition tests + manual validation MV-02 |
| FR-05 | Mechanical mode validation tests (VR-MECH-001/002/003/004) + manual validation MV-03 |
| FR-06 | Format validation tests (all VR-FMT rules) + backward compatibility (VR-COMPAT) |
| FR-07 | Protocol consistency tests + manual validation MV-04/06 |
| FR-08 | Plan-surfacer hook tests (TC-PS-11 through TC-PS-17) covering all 3 ACs |
| NFR-01 | Performance is implicit (existing hook < 100ms budget; new validation < 15ms per design) |
| NFR-02 | Backward compatibility tests (VR-COMPAT-001 through 004, TC-PS-14) |
| NFR-03 | Manual validation MV-05 (template documentation) |
| NFR-04 | Format extensibility verified by pipe-delimited annotation tests (VR-FMT-005) |
| C-01 | No new workflow phases; refinement is orchestrator step (verified by design, not test) |
| C-02 | Single file authority; all tests use single tasks.md fixture |
| C-03 | New test file uses .cjs extension; verified by file naming convention |
| C-04 | Regression: all 555+ existing tests pass; 49 new tests added |
| Article II | Test-first design complete; test cases exist for all 38 AC before implementation |
| Article VII | Traceability matrix provides 100% AC-to-test mapping |
| Article IX | GATE-04 checklist validated |
| Article XI | Integration tests validate hook interactions with format validation |
