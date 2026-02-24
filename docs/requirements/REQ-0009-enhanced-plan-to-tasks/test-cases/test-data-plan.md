# Test Data Plan: REQ-0009 Enhanced Plan-to-Tasks Pipeline

**Version**: 1.0.0
**Date**: 2026-02-11
**Author**: Test Design Engineer (Agent 04)
**Phase**: 05-test-strategy

---

## 1. Test Data Generation Approach

All test data is generated programmatically within test `beforeEach()` blocks using the existing pattern from `plan-surfacer.test.cjs`. No persistent fixture files are stored on disk. This matches the established project convention where each test creates a fresh temp directory, writes fixture files, runs the test, and cleans up in `afterEach()`.

### Why Programmatic Fixtures

1. **Isolation**: Each test run gets fresh data; no cross-test contamination
2. **Consistency with existing pattern**: plan-surfacer.test.cjs already uses `setupTestEnv()` + `createTasksPlan()` + `writeState()` inline
3. **Maintainability**: Fixture content is visible next to the assertions that verify it
4. **No file system pollution**: Temp directories are cleaned up after each test

---

## 2. Fixture Categories

### 2.1 tasks.md Fixtures

| Fixture ID | Format | Content | Used By |
|------------|--------|---------|---------|
| FIX-V1-MINIMAL | v1.0 | Header + 2 phases + checkboxes (no annotations) | TC-PS-14, TC-BC-001, TC-BC-002 |
| FIX-V1-EMPTY | v1.0 | Empty file (0 bytes) | TC-BC-007 |
| FIX-V1-HEADER-ONLY | v1.0 | Header block only, no phase sections | TC-BC-008 |
| FIX-V2-COMPLETE | v2.0 | Header + Format: v2.0 + Phase 06 with files + traces + deps + all sections | TC-PS-11, TC-FV-019, TC-FV-021 |
| FIX-V2-NO-FILES | v2.0 | Same as COMPLETE but without `files:` sub-lines | TC-PS-12, TC-FV-034 |
| FIX-V2-NO-TRACES | v2.0 | Same as COMPLETE but without `\| traces:` annotations | TC-PS-13 |
| FIX-V2-CYCLE | v2.0 | Two tasks with circular blocked_by references | TC-PS-15, TC-FV-024, TC-FV-025 |
| FIX-V2-SELF-CYCLE | v2.0 | Single task that blocked_by itself | TC-FV-026 |
| FIX-V2-BLOCKED | v2.0 | Tasks with [BLOCKED] checkbox and reason sub-lines | TC-FV-018, TC-FV-038 |
| FIX-V2-BLOCKED-NO-REASON | v2.0 | Tasks with [BLOCKED] but no reason sub-line | TC-FV-039 |
| FIX-V2-INVALID-REF | v2.0 | blocked_by referencing non-existent task ID | TC-FV-027 |
| FIX-V2-MALFORMED | v2.0 | Format: v2.0 header but garbage content below | TC-PS-17 |
| FIX-V2-LINEAR-DEPS | v2.0 | Linear dependency chain T0010 -> T0011 -> T0012 | TC-FV-023 |
| FIX-V2-MULTI-FILES | v2.0 | Task with multiple files on one files: line | TC-FV-016 |
| FIX-V2-ORPHAN | v2.0 | Task without traces annotation among traced tasks | TC-FV-031 |
| FIX-V2-UNCOVERED-FR | v2.0 | Tasks that cover FR-01 but not FR-08 | TC-FV-030 |

### 2.2 state.json Fixtures

| Fixture ID | Content | Used By |
|------------|---------|---------|
| STATE-IMPL | `{ active_workflow: { current_phase: '06-implementation' } }` | TC-PS-11 through TC-PS-15, TC-PS-17 |
| STATE-TEST | `{ active_workflow: { current_phase: '05-test-strategy' } }` | TC-PS-16 |
| STATE-MECHANICAL | `{ active_workflow: { current_phase: '06-implementation', mechanical_mode: true } }` | MV-03 tests |
| STATE-EMPTY | `{}` | TC-PS-06 (existing) |
| STATE-NONE | (file not written) | TC-PS-07 (existing) |

---

## 3. Fixture Generator Functions

### 3.1 createV2TasksPlan(tmpDir, options)

Creates a v2.0 tasks.md file with configurable content.

```javascript
/**
 * @param {string} tmpDir - Temp directory root
 * @param {object} options
 * @param {boolean} options.includeFiles - Include files: sub-lines (default: true)
 * @param {boolean} options.includeTraces - Include | traces: annotations (default: true)
 * @param {boolean} options.includeDeps - Include blocked_by/blocks sub-lines (default: true)
 * @param {boolean} options.withCycle - Create circular dependency (default: false)
 * @param {boolean} options.withSelfCycle - Create self-referencing dependency (default: false)
 * @param {boolean} options.withBlocked - Include BLOCKED tasks (default: false)
 * @param {boolean} options.withBlockedNoReason - BLOCKED task without reason (default: false)
 * @param {boolean} options.withInvalidRef - Reference non-existent task in blocked_by (default: false)
 * @param {boolean} options.withOrphanTask - Include task without traces (default: false)
 * @param {boolean} options.withMultipleFiles - Multiple files on one line (default: false)
 * @param {number} options.taskCount - Number of Phase 06 tasks (default: 2)
 * @param {string} options.depChain - "linear"|"none"|"cycle" (default: "none")
 */
function createV2TasksPlan(tmpDir, options = {}) { ... }
```

### 3.2 createMalformedTasksPlan(tmpDir)

Creates a tasks.md with `Format: v2.0` header but corrupted/malformed content below.

```javascript
function createMalformedTasksPlan(tmpDir) {
  const docsDir = path.join(tmpDir, 'docs', 'isdlc');
  fs.mkdirSync(docsDir, { recursive: true });
  const content = 'Format: v2.0\n\n' +
    '\x00\x01\x02 garbage binary content\n' +
    '## Phase ??? invalid\n' +
    '- [INVALID] not a real task\n';
  fs.writeFileSync(path.join(docsDir, 'tasks.md'), content);
}
```

### 3.3 Existing helpers (reused from plan-surfacer.test.cjs)

| Function | Purpose | Existing? |
|----------|---------|-----------|
| `setupTestEnv()` | Create temp dir with .isdlc/ | Yes |
| `writeState(tmpDir, state)` | Write state.json | Yes |
| `createTasksPlan(tmpDir)` | Create minimal v1.0 tasks.md | Yes |
| `runHook(tmpDir, stdinJson)` | Execute hook via child process | Yes |
| `makeTaskStdin(subagentType)` | Create Task tool stdin JSON | Yes |

---

## 4. Boundary Value Test Data

### 4.1 Task Line Boundaries

| Boundary | Input | Expected |
|----------|-------|----------|
| Minimum task ID | `T0001` | Valid |
| Maximum task ID | `T9999` | Valid |
| Task ID T0000 | `T0000` | Valid (regex matches 4 digits) |
| Task ID T10000 | `T10000` | Invalid (5 digits) |
| Empty description | `- [ ] T0001` | Valid but unusual |
| Very long description (500+ chars) | `- [ ] T0001 <500 chars> \| traces: FR-01` | Valid; pipe should still be found |
| Multiple pipes in line | `- [ ] T0001 Desc \| traces: FR-01 \| effort: 2h` | Valid; extensible format |

### 4.2 Dependency Graph Boundaries

| Boundary | Input | Expected |
|----------|-------|----------|
| Zero dependencies | No blocked_by lines | Valid; no graph needed |
| Single dependency | T0002 blocked_by [T0001] | Valid; linear |
| Diamond dependency | T0004 blocked_by [T0002, T0003]; T0002 blocked_by [T0001]; T0003 blocked_by [T0001] | Valid; DAG |
| 100+ tasks | Large fixture with 100 tasks and 200 edges | Performance test (< 5ms per design) |
| Disconnected graph | Two independent chains with no cross-edges | Valid; multiple roots |

### 4.3 Traceability Boundaries

| Boundary | Input | Expected |
|----------|-------|----------|
| Single FR traced | `\| traces: FR-01` | Valid |
| Multiple FRs + ACs | `\| traces: FR-01, AC-01a, AC-01b, FR-02, AC-02a` | Valid |
| FR only (no ACs) | `\| traces: FR-01` | Valid (FR-level minimum) |
| AC only (no FR) | `\| traces: AC-01a` | Valid but unusual |
| Empty traces value | `\| traces:` | Invalid syntax |
| Non-standard identifier | `\| traces: REQ-001` | Depends on regex; should match `[A-Z]+-\d+` |

---

## 5. Error Condition Test Data

Test data for error taxonomy conditions (from error-taxonomy.md):

| Error Code | Fixture | Expected Behavior |
|------------|---------|-------------------|
| E-HOOK-001 | FIX-V2-MALFORMED | validateTasksFormat catches error, returns [] |
| E-HOOK-002 | FIX-V2-MALFORMED (with corrupted dep section) | detectCyclesInDependencyGraph catches error, returns null |
| E-HOOK-003 | tasks.md with read permission removed | readFileSync fails, caught by outer try/catch |
| E-FMT-001 | FIX-V1-MINIMAL | No Format header; treated as v1.0 |
| E-FMT-002 | Task line with `\| traces FR-01` (missing colon) | Annotation not parsed; treated as description text |
| E-FMT-003 | FIX-V2-INVALID-REF | Invalid task ID in blocked_by; ignored gracefully |

---

## 6. Test Data Cleanup

All test data is created in OS temp directories (`os.tmpdir()`) and cleaned up in `afterEach()` blocks using `fs.rmSync(tmpDir, { recursive: true, force: true })`. This matches the existing pattern in plan-surfacer.test.cjs.

No persistent test data remains after test execution.
