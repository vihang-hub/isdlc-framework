# Test Strategy: REQ-GH-252 Smooth Embeddings UX

**Requirement**: REQ-GH-252
**Phase**: 05 - Test Strategy & Design
**Created**: 2026-04-12
**Traces**: FR-001, FR-002, FR-003 (12 ACs total)
**Constitutional**: Article II (test-first), Article VII (traceability), Article X (fail-open), Article XI (integration), Article XV (tool preferences)

---

## 1. Existing Infrastructure (from test evaluation)

- **Framework**: `node --test` (Node.js built-in test runner)
- **Assertion**: `node:assert/strict`
- **Coverage Tool**: None (no c8/istanbul -- aspirational thresholds)
- **Current Coverage**: ~85% estimated (1,600 tests, 365 test files)
- **Existing Patterns**: CJS tests use `require('node:test')` + `require('node:assert/strict')`; ESM tests use `import` from `'node:test'`. Hook tests live in `src/claude/hooks/tests/*.test.cjs`. Embedding tests live co-located (e.g., `lib/embedding/server/lifecycle.test.js`). CLI tests live in `tests/bin/*.test.js`.

## 2. Strategy for This Requirement

- **Approach**: Extend existing test suite (NOT replace)
- **New Test Types Needed**: Unit tests for 2 new modules, unit tests for tool-router extensions, unit tests for CLI preflight, integration tests for fail-open cross-cutting behavior
- **Coverage Target**: 80% unit (standard tier), 70% integration per Article II
- **Total New Tests**: ~40 test scenarios across 5 test files

## Test Pyramid

| Level | Count | Modules | Runner |
|-------|-------|---------|--------|
| Unit | ~28 | query-classifier, health-probe, tool-router semantic routing, CLI preflight | `node --test` |
| Integration | ~8 | Fail-open scenarios (cross-module), tool-router end-to-end routing | `node --test` |
| E2E | ~4 | CLI exit code contract (spawn + verify) | `node --test` via `spawnSync` |

## 3. Test Commands (use existing)

| Scope | Command | Notes |
|-------|---------|-------|
| query-classifier | `node --test src/core/embedding/query-classifier.test.cjs` | New file, CJS co-located |
| health-probe | `node --test lib/embedding/server/health-probe.test.cjs` | New file, CJS co-located |
| tool-router semantic | `node --test src/claude/hooks/tests/test-tool-router-semantic.test.cjs` | New file, follows existing pattern |
| CLI preflight | `node --test tests/bin/isdlc-embedding-preflight.test.js` | New file, ESM in tests/bin/ |
| fail-open integration | `node --test tests/integration/embedding-fail-open.test.js` | New file, ESM |
| All new tests | `node --test src/core/embedding/query-classifier.test.cjs lib/embedding/server/health-probe.test.cjs src/claude/hooks/tests/test-tool-router-semantic.test.cjs tests/bin/isdlc-embedding-preflight.test.js tests/integration/embedding-fail-open.test.js` | Combined |

## 4. Test File Mapping

| Task | File Under Test | Test File | Traces | Scenarios |
|------|----------------|-----------|--------|-----------|
| T003 / T010 | `src/core/embedding/query-classifier.cjs` | `src/core/embedding/query-classifier.test.cjs` | FR-002, AC-002-01, AC-002-02 | 10 classification rules + edge cases |
| T004 / T011 | `lib/embedding/server/health-probe.cjs` | `lib/embedding/server/health-probe.test.cjs` | FR-002, AC-002-03, AC-002-05 | 5 status outcomes + timeout |
| T007-T009 / T012 | `src/claude/hooks/tool-router.cjs` | `src/claude/hooks/tests/test-tool-router-semantic.test.cjs` | FR-002, AC-002-01 to AC-002-04 | 8 routing scenarios |
| T005-T006 / T013 | `bin/isdlc-embedding.js` | `tests/bin/isdlc-embedding-preflight.test.js` | FR-001, AC-001-01 to AC-001-03 | 7 preflight + verify scenarios |
| T016 | Cross-module | `tests/integration/embedding-fail-open.test.js` | FR-003, AC-003-01 to AC-003-03 | 5 fail-open integration |

## 5. Test Case Specifications

### 5.1 query-classifier Unit Tests (10 scenarios)

**File**: `src/core/embedding/query-classifier.test.cjs`
**Module**: CJS (co-located with source)
**Traces**: FR-002, AC-002-01, AC-002-02

| ID | Priority | Type | Given | When | Then |
|----|----------|------|-------|------|------|
| TC-QC-001 | P0 | positive | a natural language query "where is error handling" | classifyQuery() is called | returns `{ type: "semantic", reason: "natural_language" }` |
| TC-QC-002 | P0 | positive | a camelCase symbol `inferEnvironmentRules` | classifyQuery() is called | returns `{ type: "lexical", reason: "camelCase" }` |
| TC-QC-003 | P0 | positive | a PascalCase symbol `HealthResult` | classifyQuery() is called | returns `{ type: "lexical", reason: "PascalCase" }` |
| TC-QC-004 | P1 | positive | a regex pattern `log.*Error` | classifyQuery() is called | returns `{ type: "lexical", reason: "regex_metacharacters" }` |
| TC-QC-005 | P1 | positive | a dotted path `path.join` | classifyQuery() is called | returns `{ type: "lexical", reason: "dotted_path" }` |
| TC-QC-006 | P1 | positive | a snake_case pattern `tool_router` | classifyQuery() is called | returns `{ type: "lexical", reason: "snake_case" }` |
| TC-QC-007 | P1 | positive | a file extension pattern `.test.cjs` | classifyQuery() is called | returns `{ type: "lexical", reason: "file_extension" }` |
| TC-QC-008 | P2 | positive | a quoted string `"Invalid credentials"` | classifyQuery() is called | returns `{ type: "lexical", reason: "quoted_string" }` |
| TC-QC-009 | P0 | negative | an empty string `""` | classifyQuery() is called | returns `{ type: "lexical", reason: "empty_pattern" }` |
| TC-QC-010 | P0 | negative | null/undefined input | classifyQuery() is called | returns `{ type: "lexical", reason: "empty_pattern" }` |

### 5.2 health-probe Unit Tests (6 scenarios)

**File**: `lib/embedding/server/health-probe.test.cjs`
**Module**: CJS (co-located)
**Traces**: FR-002, AC-002-03, AC-002-05

| ID | Priority | Type | Given | When | Then |
|----|----------|------|-------|------|------|
| TC-HP-001 | P0 | negative | no PID file exists at `.isdlc/logs/embedding-server.pid` | probeEmbeddingHealth() is called | returns `{ status: "inactive", error: "no_pid_file" }` |
| TC-HP-002 | P0 | negative | PID file exists with non-numeric content | probeEmbeddingHealth() is called | returns `{ status: "inactive", error: "invalid_pid" }` |
| TC-HP-003 | P0 | positive | PID file exists and process is alive (current process PID) | probeEmbeddingHealth() is called | returns `{ status: "active", pid: N }` |
| TC-HP-004 | P0 | negative | PID file exists but process is dead (high invalid PID) | probeEmbeddingHealth() is called | returns `{ status: "inactive", error: "process_dead" }` |
| TC-HP-005 | P1 | negative | PID file directory does not exist | probeEmbeddingHealth() is called | returns `{ status: "inactive", error: "no_pid_file" }` |
| TC-HP-006 | P1 | negative | PID file exists but filesystem read throws (permissions) | probeEmbeddingHealth() is called | returns `{ status: "failed", error: <message> }` -- never throws |

### 5.3 tool-router Semantic Routing Unit Tests (8 scenarios)

**File**: `src/claude/hooks/tests/test-tool-router-semantic.test.cjs`
**Module**: CJS (follows existing hook test pattern)
**Traces**: FR-002, AC-002-01 to AC-002-04

| ID | Priority | Type | Given | When | Then |
|----|----------|------|-------|------|------|
| TC-TR-001 | P0 | positive | `isdlc-embedding` MCP registered in settings.json | inferEnvironmentRules() is called | returns a rule with `id: 'inferred-semantic-search'`, `intercept_tool: 'Grep'` |
| TC-TR-002 | P0 | positive | semantic search rule active, server healthy, natural-language query | evaluateRule() processes a Grep call | decision is `'route'` (not exempt) |
| TC-TR-003 | P0 | positive | semantic search rule active, server healthy, camelCase query | evaluateRule() processes a Grep call | decision is `'exempt'` via `literal_pattern` |
| TC-TR-004 | P0 | positive | semantic search rule active, server not running | evaluateRule() processes a Grep call | decision is `'exempt'` via `server_unavailable` |
| TC-TR-005 | P1 | positive | routing to semantic search | formatWarnMessage() is called | message contains `[Semantic search]` |
| TC-TR-006 | P1 | positive | lexical fallback due to camelCase pattern | formatWarnMessage() is called | message contains `[Lexical fallback: camelCase]` |
| TC-TR-007 | P1 | positive | lexical fallback due to server unavailable | formatWarnMessage() is called | message contains `[Lexical fallback: server unavailable]` |
| TC-TR-008 | P0 | negative | `isdlc-embedding` MCP NOT registered | inferEnvironmentRules() is called | no semantic search rule emitted |

### 5.4 CLI Preflight & Post-Verification Tests (7 scenarios)

**File**: `tests/bin/isdlc-embedding-preflight.test.js`
**Module**: ESM (follows existing tests/bin/ pattern, uses `spawnSync`)
**Traces**: FR-001, AC-001-01 to AC-001-03

| ID | Priority | Type | Given | When | Then |
|----|----------|------|-------|------|------|
| TC-PF-001 | P0 | positive | all dependencies present, generation succeeds | `isdlc-embedding generate .` runs | exit code 0, verified `.emb` output |
| TC-PF-002 | P0 | negative | `@huggingface/transformers` not installed | preflight() runs | exit code 2, stderr contains missing dep message |
| TC-PF-003 | P1 | negative | insufficient disk space (< 100MB) | preflight() runs | exit code 3, stderr contains disk space message |
| TC-PF-004 | P0 | positive | generation runs but output is empty (0 chunks) | post-verify runs | exit code 1, stderr contains empty output message |
| TC-PF-005 | P1 | negative | model not available/downloadable | preflight() runs | exit code 2, stderr contains model message |
| TC-PF-006 | P2 | positive | embeddings opted-out in config | Step 7.9 runs | generation skipped, banner shows `⊘` |
| TC-PF-007 | P2 | negative | generation throws OOM during processing | generate runs | exit code 1, stderr contains failure reason |

### 5.5 Fail-Open Integration Tests (5 scenarios)

**File**: `tests/integration/embedding-fail-open.test.js`
**Module**: ESM
**Traces**: FR-003, AC-003-01 to AC-003-03

| ID | Priority | Type | Given | When | Then |
|----|----------|------|-------|------|------|
| TC-FO-001 | P0 | positive | embedding generation fails during discover | Step 7.9 completes | discover continues to finalize -- never blocks |
| TC-FO-002 | P0 | positive | health probe times out (>200ms simulation) | tool-router evaluates | falls back to lexical, returns within total budget |
| TC-FO-003 | P0 | positive | health probe throws an unexpected error | tool-router evaluates | falls back to lexical, no crash |
| TC-FO-004 | P0 | positive | `isdlc-embedding` MCP registered but server down | semantic search MCP call fails | agent falls back to Grep, no infinite retry |
| TC-FO-005 | P1 | negative | query-classifier receives undefined as pattern | tool-router evaluates | fails gracefully, falls back to lexical |

## 6. Flaky Test Mitigation

| Risk | Mitigation |
|------|-----------|
| PID file race conditions | Use `mkdtempSync` temp dirs per test; write PID of current process for "alive" tests |
| File system timing | No `setTimeout` in tests; all assertions are synchronous or awaited |
| Port conflicts in integration | No network calls in unit tests; health-probe tests use PID-only checks |
| Process spawn timing (CLI tests) | Use `spawnSync` (blocking) with explicit timeouts |
| Test isolation | Each test creates its own temp directory; `afterEach` cleans up with `rmSync` |

## 7. Performance Test Plan

| Module | Budget | Validation Method |
|--------|--------|------------------|
| `classifyQuery()` | <1ms per call | Benchmark 1000 calls, assert mean < 1ms |
| `probeEmbeddingHealth()` | <50ms per call | Timed assertion in unit test |
| `inferEnvironmentRules()` | <10ms | Timed assertion in unit test |
| `tool-router` total (with probe) | <100ms | Existing performance budget test extended |

## 8. Test Data Strategy

### Boundary Values

| Module | Boundary | Test Value |
|--------|----------|------------|
| query-classifier | Empty string | `""` |
| query-classifier | Null/undefined | `null`, `undefined` |
| query-classifier | Very long pattern (1000 chars) | `"a".repeat(1000)` |
| query-classifier | Single character | `"x"` (semantic), `"*"` (lexical) |
| health-probe | PID = 0 | Edge case for kill(0) semantics |
| health-probe | PID = very large number | Process guaranteed dead |
| health-probe | PID file empty | 0 bytes |
| CLI preflight | Disk space exactly 100MB | Boundary pass |
| CLI preflight | Disk space 99MB | Boundary fail |

### Invalid Inputs

| Module | Invalid Input | Expected Behavior |
|--------|--------------|-------------------|
| query-classifier | `null` | Returns `{ type: "lexical", reason: "empty_pattern" }` |
| query-classifier | `undefined` | Returns `{ type: "lexical", reason: "empty_pattern" }` |
| query-classifier | `123` (number) | Returns `{ type: "lexical", reason: "empty_pattern" }` |
| health-probe | Empty string projectRoot | Returns `{ status: "inactive", error: "no_pid_file" }` |
| health-probe | Non-existent path | Returns `{ status: "inactive", error: "no_pid_file" }` |
| health-probe | `null` projectRoot | Returns `{ status: "failed", error: <message> }` |

### Maximum-Size Inputs

| Module | Max Input | Purpose |
|--------|-----------|---------|
| query-classifier | 10,000-char pattern | Ensure no regex catastrophic backtracking |
| health-probe | PID file with 1MB content | Ensure graceful handling of corrupted PID file |

## 9. Traceability Summary

| FR | ACs | Test Count | Test File(s) |
|----|-----|------------|-------------|
| FR-001 | AC-001-01 to AC-001-04 | 7 | `tests/bin/isdlc-embedding-preflight.test.js` |
| FR-002 | AC-002-01 to AC-002-05 | 24 | `query-classifier.test.cjs`, `health-probe.test.cjs`, `test-tool-router-semantic.test.cjs` |
| FR-003 | AC-003-01 to AC-003-03 | 5 | `tests/integration/embedding-fail-open.test.js` |
| **Total** | **12 ACs** | **36** | **5 files** |

## 10. GATE-04 Validation Checklist

- [x] Test strategy covers unit, integration, E2E (sections 2, 5)
- [x] Test strategy covers security considerations (fail-open = Article X)
- [x] Test strategy covers performance (section 7)
- [x] Test cases exist for all 12 acceptance criteria (section 5)
- [x] Traceability matrix complete -- 100% AC coverage (section 9)
- [x] Coverage targets defined -- 80% unit, 70% integration (section 2)
- [x] Test data strategy documented (section 8)
- [x] Critical paths identified -- query classification, health probe, fail-open (sections 5.1-5.5)
- [x] All AC in Given-When-Then format (ATDD requirement)
- [x] All tests tagged with P0-P3 priorities (ATDD requirement)
- [x] ATDD checklist generated
- [x] Test fixtures created for valid/invalid/boundary cases
- [x] Flaky test mitigation documented (section 6)
