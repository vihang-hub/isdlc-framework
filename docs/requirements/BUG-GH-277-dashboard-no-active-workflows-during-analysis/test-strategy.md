# Test Strategy: BUG-GH-277

**Bug**: Dashboard shows no active workflows during analysis
**Phase**: 05-test-strategy
**Traces**: FR-007, FR-008

---

## Existing Infrastructure

- **Test runner**: Node.js built-in test runner (`node --test`)
- **Assertion library**: `node:assert/strict`
- **Test command**: `npm run test:core` (`node --test tests/core/**/*.test.js`)
- **Existing test files**:
  - `tests/core/backlog/item-state.test.js` -- unit tests for readMetaJson, writeMetaJson, deriveAnalysisStatus, deriveBacklogMarker
  - `tests/core/dashboard/server.test.js` -- integration tests for dashboard HTTP server (DS-01 through DS-08)
- **Conventions**: ES module imports, `mkdtempSync` for temp directories, `beforeEach`/`afterEach` cleanup, Test ID prefixes (DS-NN for dashboard)
- **Pattern**: Tests create isolated temp directories, write fixture JSON, import source modules directly, assert with `node:assert/strict`

## Strategy

Extend existing test suites with new test files and test cases. All new tests follow established conventions (node:test runner, assert/strict, temp directory isolation). No new frameworks or tools introduced.

### Test Pyramid

| Level | Scope | Files | Estimated Cases |
|-------|-------|-------|-----------------|
| Unit | analysis-index.js CRUD operations | `tests/core/backlog/analysis-index.test.js` (CREATE) | 22 |
| Integration | writeMetaJson -> updateAnalysisIndex propagation | `tests/core/backlog/item-state.test.js` (EXTEND) | 4 |
| Integration | Dashboard /api/state with analysis data | `tests/core/dashboard/server.test.js` (EXTEND) | 8 |
| **Total** | | | **34** |

### Coverage Targets

- Unit test coverage for analysis-index.js: >= 95% (new module, no legacy paths)
- Integration test coverage for writeMetaJson propagation: 100% of the new code path
- Dashboard API coverage: all new response fields tested (analysis_items, active_analysis)
- Error path coverage: corrupt JSON, missing file, empty items, concurrent write safety

---

## Test Plan by Module

### 1. Unit Tests: analysis-index.js

**File**: `tests/core/backlog/analysis-index.test.js` (CREATE)
**Test ID prefix**: AI-
**Traces**: FR-001, FR-007

Tests the three exported functions: `updateAnalysisIndex()`, `rebuildAnalysisIndex()`, `readAnalysisIndex()`.

#### AI-01: readAnalysisIndex -- file does not exist

- **Given** no `.isdlc/analysis-index.json` exists
- **When** `readAnalysisIndex(projectRoot)` is called
- **Then** returns `{ version: '1.0.0', updated_at: null, items: [] }`
- **Type**: positive
- **Priority**: P0
- **Traces**: FR-001, AC-1.1

#### AI-02: readAnalysisIndex -- valid file

- **Given** a valid `analysis-index.json` with 2 items
- **When** `readAnalysisIndex(projectRoot)` is called
- **Then** returns parsed JSON with correct items array
- **Type**: positive
- **Priority**: P0
- **Traces**: FR-001, AC-1.2

#### AI-03: readAnalysisIndex -- corrupt JSON

- **Given** `analysis-index.json` contains invalid JSON
- **When** `readAnalysisIndex(projectRoot)` is called
- **Then** returns empty default structure (fail-open per Article X)
- **Type**: negative
- **Priority**: P0
- **Traces**: FR-001, AC-1.3

#### AI-04: readAnalysisIndex -- empty file

- **Given** `analysis-index.json` is a zero-byte file
- **When** `readAnalysisIndex(projectRoot)` is called
- **Then** returns empty default structure
- **Type**: negative
- **Priority**: P1
- **Traces**: FR-001

#### AI-05: updateAnalysisIndex -- creates file when absent

- **Given** no `analysis-index.json` exists
- **When** `updateAnalysisIndex(projectRoot, slug, metaData)` is called
- **Then** creates file with a single item matching the slug and metaData fields
- **Type**: positive
- **Priority**: P0
- **Traces**: FR-001, AC-1.4

#### AI-06: updateAnalysisIndex -- adds new item

- **Given** `analysis-index.json` exists with 1 item (slug-a)
- **When** `updateAnalysisIndex(projectRoot, 'slug-b', metaB)` is called
- **Then** file now has 2 items; slug-a unchanged, slug-b appended
- **Type**: positive
- **Priority**: P0
- **Traces**: FR-001, AC-1.5

#### AI-07: updateAnalysisIndex -- updates existing item

- **Given** `analysis-index.json` has item with slug `GH-277`
- **When** `updateAnalysisIndex(projectRoot, 'GH-277', updatedMeta)` is called with new phases_completed
- **Then** item is updated in-place; `last_activity_at` is refreshed; no duplicate entry
- **Type**: positive
- **Priority**: P0
- **Traces**: FR-001, AC-1.6

#### AI-08: updateAnalysisIndex -- preserves schema fields

- **Given** a call to updateAnalysisIndex with full meta data
- **When** the file is read back
- **Then** contains version, updated_at, and item with slug, source_id, item_type, analysis_status, phases_completed, created_at, last_activity_at
- **Type**: positive
- **Priority**: P1
- **Traces**: FR-001

#### AI-09: updateAnalysisIndex -- updates version and updated_at

- **Given** any valid call to updateAnalysisIndex
- **When** the file is written
- **Then** `version` is `'1.0.0'` and `updated_at` is a valid ISO-8601 timestamp
- **Type**: positive
- **Priority**: P1
- **Traces**: FR-001

#### AI-10: updateAnalysisIndex -- handles corrupt existing file

- **Given** `analysis-index.json` contains invalid JSON
- **When** `updateAnalysisIndex(projectRoot, slug, meta)` is called
- **Then** overwrites with fresh index containing just the new item (fail-open recovery)
- **Type**: negative
- **Priority**: P0
- **Traces**: FR-001, AC-1.7

#### AI-11: updateAnalysisIndex -- analysis_status derived from phases_completed

- **Given** meta with `phases_completed: ['00-quick-scan', '01-requirements']`
- **When** `updateAnalysisIndex` is called
- **Then** the item in the index has `analysis_status: 'partial'`
- **Type**: positive
- **Priority**: P1
- **Traces**: FR-001

#### AI-12: updateAnalysisIndex -- analysis_status 'analyzed' for complete phases

- **Given** meta with all 5 analysis phases completed
- **When** `updateAnalysisIndex` is called
- **Then** the item in the index has `analysis_status: 'analyzed'`
- **Type**: positive
- **Priority**: P1
- **Traces**: FR-001

#### AI-13: updateAnalysisIndex -- analysis_status 'raw' for empty phases

- **Given** meta with `phases_completed: []`
- **When** `updateAnalysisIndex` is called
- **Then** the item in the index has `analysis_status: 'raw'`
- **Type**: positive
- **Priority**: P2
- **Traces**: FR-001

#### AI-14: rebuildAnalysisIndex -- rebuilds from meta.json files

- **Given** 3 slug directories under `docs/requirements/` each with a `meta.json`
- **When** `rebuildAnalysisIndex(projectRoot)` is called
- **Then** `analysis-index.json` contains all 3 items with correct fields extracted from each meta.json
- **Type**: positive
- **Priority**: P0
- **Traces**: FR-001, AC-1.8

#### AI-15: rebuildAnalysisIndex -- skips directories without meta.json

- **Given** 2 slug dirs with meta.json and 1 directory without
- **When** `rebuildAnalysisIndex(projectRoot)` is called
- **Then** index contains only the 2 items; no error thrown
- **Type**: negative
- **Priority**: P1
- **Traces**: FR-001

#### AI-16: rebuildAnalysisIndex -- handles empty requirements directory

- **Given** `docs/requirements/` exists but is empty
- **When** `rebuildAnalysisIndex(projectRoot)` is called
- **Then** writes index with `items: []`
- **Type**: negative
- **Priority**: P1
- **Traces**: FR-001

#### AI-17: rebuildAnalysisIndex -- handles missing requirements directory

- **Given** `docs/requirements/` does not exist
- **When** `rebuildAnalysisIndex(projectRoot)` is called
- **Then** writes index with `items: []` (no throw)
- **Type**: negative
- **Priority**: P1
- **Traces**: FR-001

#### AI-18: rebuildAnalysisIndex -- skips corrupt meta.json

- **Given** 2 valid meta.json files and 1 with invalid JSON
- **When** `rebuildAnalysisIndex(projectRoot)` is called
- **Then** index contains only the 2 valid items
- **Type**: negative
- **Priority**: P1
- **Traces**: FR-001

#### AI-19: updateAnalysisIndex -- creates .isdlc directory if missing

- **Given** project root exists but `.isdlc/` subdirectory does not
- **When** `updateAnalysisIndex(projectRoot, slug, meta)` is called
- **Then** creates `.isdlc/` directory and writes the index file
- **Type**: positive
- **Priority**: P1
- **Traces**: FR-001

#### AI-20: updateAnalysisIndex -- fail-open on write error

- **Given** the `.isdlc/` directory is read-only (or write fails)
- **When** `updateAnalysisIndex(projectRoot, slug, meta)` is called
- **Then** does not throw (fail-open per Article X); returns without crash
- **Type**: negative
- **Priority**: P0
- **Traces**: FR-001, Article X

#### AI-21: readAnalysisIndex -- items array always returned

- **Given** a valid file that is missing the `items` key
- **When** `readAnalysisIndex(projectRoot)` is called
- **Then** returns `items: []` as a default
- **Type**: negative
- **Priority**: P2
- **Traces**: FR-001

#### AI-22: updateAnalysisIndex -- item_type field preserved

- **Given** meta with `item_type: 'BUG'`
- **When** `updateAnalysisIndex` is called
- **Then** the item in the index has `item_type: 'BUG'`
- **Type**: positive
- **Priority**: P2
- **Traces**: FR-001

---

### 2. Integration Tests: writeMetaJson -> updateAnalysisIndex propagation

**File**: `tests/core/backlog/item-state.test.js` (EXTEND -- new describe block)
**Test ID prefix**: WM-AI-
**Traces**: FR-002, FR-007

These tests verify that `writeMetaJson()` calls `updateAnalysisIndex()` as a side effect after writing meta.json.

#### WM-AI-01: writeMetaJson triggers index update

- **Given** a temp project root with `.isdlc/` directory and a slug directory with meta.json
- **When** `writeMetaJson(slugDir, meta)` is called
- **Then** `analysis-index.json` is created/updated with an entry matching the slug
- **Type**: positive
- **Priority**: P0
- **Traces**: FR-002, AC-2.1

#### WM-AI-02: writeMetaJson index update reflects analysis_status change

- **Given** meta with `phases_completed: ['00-quick-scan']` written first, then updated to include `'01-requirements'`
- **When** `writeMetaJson` is called twice
- **Then** the index entry's `analysis_status` changes from `'partial'` to `'partial'` (still partial), and `phases_completed` reflects the update
- **Type**: positive
- **Priority**: P1
- **Traces**: FR-002

#### WM-AI-03: writeMetaJson succeeds even if index update fails

- **Given** `.isdlc/` is read-only (index write will fail)
- **When** `writeMetaJson(slugDir, meta)` is called
- **Then** meta.json is still written successfully (index failure is non-fatal)
- **Type**: negative
- **Priority**: P0
- **Traces**: FR-002, Article X

#### WM-AI-04: writeMetaJson index update extracts correct slug from path

- **Given** slugDir is `/tmp/test/docs/requirements/BUG-GH-277-dashboard-fix`
- **When** `writeMetaJson(slugDir, meta)` is called
- **Then** the index entry has `slug: 'BUG-GH-277-dashboard-fix'`
- **Type**: positive
- **Priority**: P1
- **Traces**: FR-002

---

### 3. Dashboard Server Tests: /api/state with analysis data

**File**: `tests/core/dashboard/server.test.js` (EXTEND -- new describe blocks)
**Test ID prefix**: DS-AI-
**Traces**: FR-004, FR-008

These tests extend the existing dashboard server test suite to verify that analysis data is included in the `/api/state` response.

#### DS-AI-01: /api/state includes analysis_items when analysis-index.json exists

- **Given** state.json with `active_workflow: null` and a valid `analysis-index.json` alongside it
- **When** `GET /api/state` is called
- **Then** response includes `analysis_items` array with the items from the index
- **Type**: positive
- **Priority**: P0
- **Traces**: FR-004, AC-4.1

#### DS-AI-02: /api/state includes active_analysis for partial items

- **Given** `analysis-index.json` has an item with `analysis_status: 'partial'`
- **When** `GET /api/state` is called
- **Then** response includes `active_analysis` pointing to the most recently active partial item
- **Type**: positive
- **Priority**: P0
- **Traces**: FR-004, AC-4.2

#### DS-AI-03: /api/state active_analysis is null when no partial items

- **Given** `analysis-index.json` exists but all items have `analysis_status: 'analyzed'`
- **When** `GET /api/state` is called
- **Then** `active_analysis` is null
- **Type**: positive
- **Priority**: P1
- **Traces**: FR-004

#### DS-AI-04: /api/state analysis_items is empty array when no index file

- **Given** no `analysis-index.json` exists
- **When** `GET /api/state` is called
- **Then** `analysis_items` is `[]` and `active_analysis` is null
- **Type**: positive
- **Priority**: P0
- **Traces**: FR-004, AC-4.3

#### DS-AI-05: /api/state analysis data coexists with active_workflow

- **Given** state.json has an `active_workflow` AND `analysis-index.json` has items
- **When** `GET /api/state` is called
- **Then** response includes both `active_workflow` (non-null) and `analysis_items` (non-empty)
- **Type**: positive
- **Priority**: P1
- **Traces**: FR-004, AC-4.4

#### DS-AI-06: /api/state handles corrupt analysis-index.json

- **Given** `analysis-index.json` contains invalid JSON
- **When** `GET /api/state` is called
- **Then** `analysis_items` is `[]` and `active_analysis` is null (fail-open)
- **Type**: negative
- **Priority**: P0
- **Traces**: FR-004, Article X

#### DS-AI-07: /api/state analysis_items matches schema

- **Given** a valid `analysis-index.json` with 1 item
- **When** `GET /api/state` is called
- **Then** each item in `analysis_items` has: slug, source_id, item_type, analysis_status, phases_completed (array), created_at, last_activity_at
- **Type**: positive
- **Priority**: P1
- **Traces**: FR-004

#### DS-AI-08: /api/state existing fields unchanged

- **Given** state.json with an active workflow
- **When** `GET /api/state` is called
- **Then** existing fields (active_workflow, phases, topology, workflow_type, timestamp) are present and unchanged from current behavior
- **Type**: positive (regression guard)
- **Priority**: P0
- **Traces**: FR-004, AC-4.5

---

## Flaky Test Mitigation

- **Temp directory isolation**: Each test creates its own `mkdtempSync` directory and cleans up in `afterEach`. No shared state between tests.
- **Port allocation**: Dashboard tests use `port: 0` for OS-assigned ephemeral ports (existing convention from DS-01).
- **No real timers**: No setTimeout-dependent assertions. All assertions are synchronous or use awaited HTTP responses.
- **File system race conditions**: Each test operates on its own temp directory. No concurrent write tests needed at the unit level (analysis-index writes are synchronous via `writeFileSync`).
- **Server cleanup**: `afterEach` closes server instance (existing pattern in server.test.js).

## Performance Test Plan

Not applicable for this bug fix. The analysis-index.json is a single file read/write per meta.json update. Performance characteristics are O(N) for N analysis items in the index, where N is typically < 50 (number of backlog items). No load testing warranted.

If future requirements introduce high-frequency polling, the dashboard's `readState()` caching pattern (line 59-73 of server.js) already provides the template for index caching.

---

## Test Data Plan

### Test Fixtures

All fixtures are constructed inline using `JSON.stringify()` and `writeFileSync()`, matching the existing pattern in `item-state.test.js` and `server.test.js`.

#### Boundary Values

- Empty `items: []` array
- Single item array
- Index with 50 items (upper reasonable bound for backlog size)
- Item with all 5 analysis phases completed
- Item with 0 phases completed (raw)
- Item with 1-4 phases completed (partial)

#### Invalid Inputs

- Invalid JSON in analysis-index.json (`'not json'`, truncated JSON `'{"items":'`)
- Zero-byte file
- File missing `items` key (`'{"version":"1.0.0"}'`)
- File missing `version` key
- Item with missing required fields (slug absent, phases_completed not an array)

#### Maximum-Size Inputs

- 50 items in the index (realistic upper bound)
- Item with long slug name (255 characters)
- phases_completed array with duplicate entries

---

## Traceability Matrix

| Requirement | AC | Test Cases | Test Type | Priority |
|-------------|-----|------------|-----------|----------|
| FR-001 | AC-1.1 | AI-01 | positive | P0 |
| FR-001 | AC-1.2 | AI-02 | positive | P0 |
| FR-001 | AC-1.3 | AI-03 | negative | P0 |
| FR-001 | AC-1.4 | AI-05 | positive | P0 |
| FR-001 | AC-1.5 | AI-06 | positive | P0 |
| FR-001 | AC-1.6 | AI-07 | positive | P0 |
| FR-001 | AC-1.7 | AI-10 | negative | P0 |
| FR-001 | AC-1.8 | AI-14 | positive | P0 |
| FR-001 | -- | AI-04, AI-08, AI-09, AI-11, AI-12, AI-13, AI-15, AI-16, AI-17, AI-18, AI-19, AI-20, AI-21, AI-22 | mixed | P1-P2 |
| FR-002 | AC-2.1 | WM-AI-01 | positive | P0 |
| FR-002 | -- | WM-AI-02, WM-AI-03, WM-AI-04 | mixed | P0-P1 |
| FR-004 | AC-4.1 | DS-AI-01 | positive | P0 |
| FR-004 | AC-4.2 | DS-AI-02 | positive | P0 |
| FR-004 | AC-4.3 | DS-AI-04 | positive | P0 |
| FR-004 | AC-4.4 | DS-AI-05 | positive | P1 |
| FR-004 | AC-4.5 | DS-AI-08 | positive | P0 |
| FR-004 | -- | DS-AI-03, DS-AI-06, DS-AI-07 | mixed | P0-P1 |
| FR-007 | -- | AI-01 through AI-22 | unit | P0-P2 |
| FR-008 | -- | DS-AI-01 through DS-AI-08 | integration | P0-P1 |

### Coverage Summary

- **FR-001** (analysis-index CRUD): 22 test cases (14 positive, 8 negative)
- **FR-002** (writeMetaJson propagation): 4 test cases (3 positive, 1 negative)
- **FR-004** (dashboard API): 8 test cases (6 positive, 2 negative)
- **FR-007** (unit tests): covered by AI-01 through AI-22
- **FR-008** (dashboard tests): covered by DS-AI-01 through DS-AI-08
- **Total**: 34 test cases
- **Positive/Negative ratio**: 23 positive / 11 negative (32% negative -- exceeds Article XI error path requirements)

---

## Task-to-Test Traceability

| Task | File Under Test | Test File | Traces | Scenarios |
|------|----------------|-----------|--------|-----------|
| T002 | src/core/backlog/analysis-index.js | tests/core/backlog/analysis-index.test.js | FR-001 | AI-01 through AI-22 (CRUD, rebuild, edge cases) |
| T003 | src/core/backlog/item-state.js | tests/core/backlog/item-state.test.js | FR-002 | WM-AI-01 through WM-AI-04 (propagation) |
| T005 | src/dashboard/server.js | tests/core/dashboard/server.test.js | FR-004 | DS-AI-01 through DS-AI-08 (API response) |

---

## Constitutional Compliance

- **Article II (Test-First)**: This test strategy is designed in Phase 05 before implementation begins in Phase 06. All test cases are specified before code is written.
- **Article VII (Traceability)**: Every test case traces to at least one FR. Traceability matrix covers 100% of testable requirements (FR-001, FR-002, FR-004, FR-007, FR-008). FR-003, FR-005, FR-006 are not directly testable at this level (re-exports, UI, gitignore).
- **Article IX (Quality Gate)**: All GATE-04 artifacts produced -- test strategy, test cases, traceability matrix, test data plan.
- **Article XI (Test Quality)**: Error paths tested (11 negative cases, 32% ratio). Test names describe expected behavior. No mocks in integration tests -- dashboard tests use real HTTP server. Regression guard test (DS-AI-08) accompanies the bug fix.
