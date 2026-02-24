# Test Strategy: BUG-0003-fix-plan-tracking

**Bug ID:** BUG-0003
**Artifact Folder:** BUG-0003-fix-plan-tracking
**Created:** 2026-02-09
**Test Engineer:** Test Design Engineer (Phase 05)
**Status:** Complete

---

## 1. Test Philosophy

This bug fix addresses instruction-level defects in markdown files that define behavior for AI agents (the Phase-Loop Controller in `isdlc.md` and the orchestrator in `00-sdlc-orchestrator.md`). Since these are not executable code, the test strategy uses **structural validation** -- parsing the markdown files and verifying that:

1. Phase keys match the canonical source of truth (`workflows.json`)
2. Required instruction elements are present (strikethrough, cleanup, mapping)
3. Examples use correct phase counts and keys
4. Cross-file consistency is maintained

This approach mirrors the existing `lib/prompt-format.test.js` pattern (REQ-0003), which structurally validates markdown agent files.

---

## 2. Test Architecture

### Test Type: Structural / Cross-Reference Validation (ESM)

**Framework:** Node.js built-in `node:test` + `node:assert/strict` (Node 18+)
**Location:** `lib/plan-tracking.test.js`
**Runner:** `npm test` (auto-discovered by existing glob `lib/*.test.js`)

### Source of Truth

`src/isdlc/config/workflows.json` is the **single source of truth** for phase keys. All lookup tables in `isdlc.md` and `00-sdlc-orchestrator.md` must match the phase keys defined in this file.

### Files Under Test

| File | Sections Validated |
|------|-------------------|
| `src/isdlc/config/workflows.json` | `feature.phases`, `fix.phases`, `test-run.phases`, `test-generate.phases`, `full-lifecycle.phases`, `upgrade.phases` |
| `src/claude/commands/isdlc.md` | STEP 2 lookup table, STEP 2 strikethrough instructions, STEP 3e strikethrough instructions, STEP 4 cleanup instructions, fix phases inline (line 244) |
| `src/claude/agents/00-sdlc-orchestrator.md` | Task Definitions table, Fix Workflow example, Feature Workflow example, Task Lifecycle section |

---

## 3. Test Cases Overview

| TC ID | Test Case | Category | FIX | AC |
|-------|-----------|----------|-----|-----|
| TC-01 | Phase key alignment: isdlc.md STEP 2 table | Cross-reference | FIX-001 | AC-1 |
| TC-02 | Phase key alignment: orchestrator table | Cross-reference | FIX-001 | AC-1 |
| TC-03 | Fix workflow inline phases match workflows.json | Cross-reference | FIX-001 | AC-1 |
| TC-04 | STEP 2 strikethrough instructions present | Structural | FIX-002 | AC-2 |
| TC-05 | STEP 3e strikethrough instructions present | Structural | FIX-002 | AC-3 |
| TC-06 | STEP 2 task-ID mapping instructions present | Structural | FIX-002 | AC-2, AC-3 |
| TC-07 | STEP 4 cleanup instructions present | Structural | FIX-003 | AC-4, AC-5 |
| TC-08 | Fix workflow example correct phase count | Example validation | FIX-001 | AC-1 |
| TC-09 | Feature workflow example correct phase count | Example validation | FIX-001 | AC-1 |
| TC-10 | Sequential numbering instructions present | Structural | FIX-001 | AC-1 |
| TC-11 | All workflows.json phases have table entries | Completeness | FIX-001 | AC-1 |
| TC-12 | No stale/orphaned phase keys in tables | Hygiene | FIX-001 | AC-1 |

---

## 4. Test Pyramid

```
    /\
   /  \  Structural Validation (12 test cases)
  /    \  - Cross-file key matching
 /      \ - Instruction presence checking
/--------\ - Example consistency
```

All tests are **structural** -- they read files and verify content. No runtime execution, no mocking, no network. This matches the precedent set by `prompt-format.test.js`.

---

## 5. Validation Approach

### 5.1 Phase Key Cross-Reference (TC-01, TC-02, TC-03, TC-11, TC-12)

**Method:** Parse `workflows.json` to extract the canonical phase key arrays for each workflow type. Then parse the lookup tables in `isdlc.md` (STEP 2) and `00-sdlc-orchestrator.md` (Task Definitions) to extract the phase keys they list. Compare:

1. Every phase key in `workflows.json` must have a matching entry in both lookup tables
2. Every phase key in the lookup tables must exist in at least one workflow in `workflows.json`
3. The inline fix phases in `isdlc.md` line 244 must exactly match `workflows.json.fix.phases`

### 5.2 Instruction Presence (TC-04, TC-05, TC-06, TC-07, TC-10)

**Method:** Read the markdown files and search for required instruction patterns:

- **Strikethrough** (TC-04, TC-05): Search for `~~[N]` or `~~[1]` patterns in STEP 2 and STEP 3e sections
- **Task-ID mapping** (TC-06): Search for `phase_key` + `task_id` or `mapping` keywords in STEP 2
- **Cleanup** (TC-07): Search for `TaskList`, `completed`, `strikethrough` keywords in STEP 4
- **Sequential numbering** (TC-10): Search for `[N]` and `sequential` or `starting at 1` keywords in STEP 2

### 5.3 Example Consistency (TC-08, TC-09)

**Method:** Extract the TaskCreate examples from the orchestrator and count the number of tasks. Compare against the phase count in the corresponding workflow definition in `workflows.json`.

---

## 6. Test Data Strategy

All test data is derived from production files -- no fixtures, no mocks. Tests read the actual source files:

| Data Source | Usage |
|-------------|-------|
| `src/isdlc/config/workflows.json` | Canonical phase keys for each workflow |
| `src/claude/commands/isdlc.md` | Phase-Loop Controller instructions |
| `src/claude/agents/00-sdlc-orchestrator.md` | Orchestrator task management |

---

## 7. Execution Plan

### Pre-implementation (Current Phase)
- Define test cases (this document)
- Create test case files (see `test-cases/` directory)

### Implementation Phase
- Create `lib/plan-tracking.test.js` with all 12 test cases
- Tests are written BEFORE the fix (TDD: tests should FAIL on the pre-fix code and PASS on the post-fix code)
- Since the fix is already applied (commit 362d483), tests should PASS against current code

### Integration Phase
- Tests auto-discovered by `npm test` glob (`lib/*.test.js`)
- No CI changes needed
- Expected total tests: 650 baseline + new tests from this file

---

## 8. NFR Coverage

| NFR | Coverage |
|-----|----------|
| Correctness | TC-01 through TC-12 validate all 6 root causes |
| Consistency | TC-01, TC-02, TC-03, TC-11, TC-12 validate cross-file alignment |
| Completeness | TC-11 ensures every workflow phase has a table entry |
| No regressions | No changes to existing test files or test infrastructure |

---

## 9. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Markdown parsing fragility | Use simple string matching, not complex regex. Test against known patterns. |
| File structure changes | Tests read from well-known paths relative to project root |
| Table format changes | Extract table rows with flexible regex that handles spacing variations |
| New workflows added | TC-11 iterates over ALL workflows.json entries, auto-covering future additions |

---

## 10. Traceability Matrix

| Fix Requirement | Acceptance Criteria | Test Cases | Root Cause Addressed |
|----------------|---------------------|------------|---------------------|
| FIX-001 | AC-1 | TC-01, TC-02, TC-03, TC-08, TC-09, TC-10, TC-11, TC-12 | RC1, RC2, RC3 |
| FIX-002 | AC-2, AC-3 | TC-04, TC-05, TC-06 | RC4 |
| FIX-003 | AC-4, AC-5 | TC-07 | RC5, RC6 |

**Coverage Summary:**
- 3/3 fix requirements covered (100%)
- 5/5 acceptance criteria covered (100%)
- 6/6 root causes addressed (100%)
- 0 new dependencies added
- 0 CI changes needed
