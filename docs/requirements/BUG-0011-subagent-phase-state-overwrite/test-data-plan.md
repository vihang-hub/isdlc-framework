# Test Data Plan: BUG-0011 -- V8 Phase Field Protection

**Bug**: BUG-0011 -- Subagent Phase State Overwrite
**Phase**: 05-test-strategy
**Created**: 2026-02-13

---

## Overview

All test data is constructed inline within each test case using the existing `writeStateFile()` and `makeWriteStdinWithContent()` helpers. No external fixture files or generators are needed. Each test constructs two JSON objects:

1. **Disk state**: Written to `{tmpDir}/.isdlc/state.json` before running the hook
2. **Incoming state**: Passed as `tool_input.content` in the Write event's stdin payload

---

## Data Categories

### Category 1: Disk State Fixtures

All disk states share a common base structure with variations per test:

```json
{
  "state_version": <number>,
  "active_workflow": {
    "current_phase": "<phase-key>",
    "current_phase_index": <number>,
    "phase_status": {
      "<phase-key>": "<pending|in_progress|completed>"
    }
  }
}
```

**Variations**:

| Variant | Description | Used By |
|---------|-------------|---------|
| `disk-mid-workflow` | Index 5, phase "06-implementation", 3 completed phases | T32-T34, T39-T45, T48, T50-T54, T56-T57, T60-T61 |
| `disk-early-workflow` | Index 1, phase "02-impact-analysis" | T58 |
| `disk-late-workflow` | Index 7, phase "08-code-review", 5 completed phases | T37-T38, T62 |
| `disk-no-workflow` | No `active_workflow` key | T36, T49 |
| `disk-no-phase-status` | Has `active_workflow` but no `phase_status` | T50 |
| `disk-corrupted` | `active_workflow` is a string, not object | T52 |
| `disk-unknown-status` | `phase_status` entries with non-standard values | T59 |
| `disk-no-index` | `active_workflow` without `current_phase_index` | T61 |
| `disk-monorepo` | State at `.isdlc/projects/my-api/state.json` | T63 |
| `disk-missing-file` | No state.json file on disk at all | T47 |

### Category 2: Incoming State Fixtures

Incoming states are constructed with intentional regressions or valid progressions:

| Variant | Description | Used By |
|---------|-------------|---------|
| `incoming-regressed-index` | `current_phase_index` < disk value | T32, T37-T38, T54, T58, T62, T63 |
| `incoming-same-index` | `current_phase_index` == disk value | T33, T39-T41, T45, T50 |
| `incoming-forward-index` | `current_phase_index` > disk value | T34, T43-T44 |
| `incoming-no-workflow` | No `active_workflow` key | T35, T48 |
| `incoming-new-workflow` | First workflow creation (disk has none) | T36, T49 |
| `incoming-status-regression` | One or more `phase_status` entries regressed | T39-T41, T45, T62 |
| `incoming-status-forward` | `phase_status` entries progressing forward | T42-T44 |
| `incoming-no-phase-status` | Has `active_workflow` without `phase_status` | T51 |
| `incoming-no-index` | Has `active_workflow` without `current_phase_index` | T60 |
| `incoming-bad-json` | Not valid JSON string | T46 |
| `incoming-unknown-status` | Non-standard status values | T59 |
| `incoming-stale-version` | `state_version` < disk (triggers V7 before V8) | T55, T64 |

### Category 3: Tool Event Types

| Type | Helper Function | Used By |
|------|----------------|---------|
| Write (with content) | `makeWriteStdinWithContent(filePath, state)` | T32-T52, T54-T67 |
| Edit (no content) | `makeEditStdin(filePath)` | T53 |

---

## Phase Status Ordinal Map

Used for regression detection in FR-02 tests:

```
const STATUS_ORDINAL = {
  'pending': 0,
  'in_progress': 1,
  'completed': 2
};
```

A write is blocked if `STATUS_ORDINAL[incoming] < STATUS_ORDINAL[disk]` for any phase entry.

Unknown values (not in the map) should result in a fail-open (allow).

---

## State Version Conventions

- Disk version is typically `10` (large enough to test regressions)
- Incoming version matches disk (`10`) for pure V8 tests (isolate from V7)
- Incoming version < disk (`3` vs `10`) for V7 short-circuit tests
- Incoming version > disk (`11` vs `10`) for forward-progress tests

---

## Test Data Generation Approach

All test data is **hardcoded inline** within each test case. This is the established pattern in the existing V7 test suite (T16-T31). No factory functions, random generators, or external fixture files are needed because:

1. The data shapes are small (5-10 fields each)
2. Each test needs specific, deterministic values to verify exact behavior
3. The existing codebase uses inline construction exclusively
4. The number of tests (36) is manageable without abstraction

---

## Data Cleanup

Each test uses `beforeEach`/`afterEach` hooks (already in the test file) to:

1. Create a fresh temporary directory (`fs.mkdtempSync`)
2. Create `.isdlc/` subdirectory
3. Clean up with `fs.rmSync(tmpDir, { recursive: true, force: true })`

No persistent test data or shared state between tests.
