# Test Strategy: REQ-0038 External Manifest Source Field

**Status**: Complete
**Phase**: 05 - Test Strategy
**Last Updated**: 2026-02-24
**Constitutional Articles**: II (Test-First), VII (Traceability), IX (Gate Integrity), XI (Integration Testing)

---

## 1. Existing Infrastructure

- **Framework**: node:test (built-in Node.js test runner)
- **Module System**: CJS for hook tests (hooks convention)
- **Existing Test File**: `src/claude/hooks/tests/external-skill-management.test.cjs` (18 test groups, ~90 tests for REQ-0022)
- **Test Baseline**: 555 tests (302 ESM lib + 253 CJS hook tests)
- **Existing Patterns**: `createTestProject()` fixture factory, `loadCommon()` module loader, temp directory isolation
- **Test Runner**: `node --test` (CJS hook tests run from temp directories outside the package)

## 2. Strategy for This Requirement

- **Approach**: Extend existing `external-skill-management.test.cjs` with new test groups (TC-19 through TC-25)
- **New Test Types Needed**: Unit tests for `reconcileSkillsBySource()`, backward compatibility tests for `loadExternalManifest()` source defaults
- **Coverage Target**: 100% of functional requirements (FR-001 through FR-008), all 26 acceptance criteria
- **No new test files**: All tests added to the existing test file to maintain consistency

## 3. Test Pyramid

| Level | Count | Description |
|-------|-------|-------------|
| **Unit** | 40 | `reconcileSkillsBySource()` pure function tests (add/update/remove/preserve), `loadExternalManifest()` source-default tests, field ownership, return shape, input validation, cross-source isolation |
| **Integration** | 4 | Full reconciliation pipeline (load -> reconcile -> write -> verify), idempotency, multi-source reconciliation |
| **E2E** | 0 | Not applicable -- reconciliation is a pure function called by agent markdown (not directly user-facing) |
| **Performance** | 2 | Reconciliation with 100-skill manifest under 100ms, idempotent reconciliation under 50ms |

**Total new tests**: 46

## 4. Flaky Test Mitigation

- **Timestamp handling**: Tests that verify `updated_at` or `added_at` will use pattern matching (ISO-8601 regex) rather than exact timestamp comparison to avoid timing flakiness
- **Temp directory isolation**: Each test group uses `createTestProject()` which creates unique temp dirs via `fs.mkdtempSync()` -- no shared state between tests
- **Module cache clearing**: `loadCommon()` already clears `require.cache` before each load -- no stale module state
- **No network calls**: All tests operate on local fixtures -- no network flakiness

## 5. Performance Test Plan

| Test | Threshold | Rationale |
|------|-----------|-----------|
| Reconciliation with 100 skills | < 100ms | Quality attribute from requirements: reconciliation completes in <100ms for manifests with <100 skills |
| Idempotent reconciliation (no changes) | < 50ms | Fast path should be faster than full reconciliation |

## 6. Test Commands (use existing)

- **Run all hook tests**: `node --test src/claude/hooks/tests/external-skill-management.test.cjs`
- **Run from project root**: Tests use `__dirname` relative paths, compatible with project root execution

## 7. Critical Paths

1. **Reconciliation core logic**: Add, update, remove, preserve decisions per entry (FR-002)
2. **Binding preservation**: User-owned fields survive reconciliation (FR-004)
3. **Phase-gated removal**: Only remove skills whose source phase ran (FR-002 AC-002-03, AC-002-04)
4. **Backward compatibility**: Legacy entries without `source` field treated as `"user"` (FR-001 AC-001-04)
5. **Idempotency**: Running same reconciliation twice yields identical result (FR-003 changed:false)
6. **Return shape accuracy**: `added`, `removed`, `updated` arrays accurately reflect changes (FR-003)

## 8. Test Data Strategy

See `test-data-plan.md` for detailed test data specifications. Key categories:

- **Valid manifests**: Empty, single skill, multi-source, legacy (no source field)
- **Valid incoming skills**: Minimal (name+file), full (all fields), with default bindings
- **Phase execution scenarios**: All phases ran, partial phases, no phases ran, null phasesExecuted
- **Edge cases**: Null manifest, empty incoming array, incoming skill missing name, source="user" (rejected)
- **Boundary values**: 0 skills, 1 skill, 100 skills; empty strings for description; null phasesExecuted vs empty array

## 9. Test Group Structure

New test groups added to `external-skill-management.test.cjs`:

| Group | Description | Traces |
|-------|-------------|--------|
| TC-19 | `reconcileSkillsBySource()` -- Add new skills | FR-002 AC-002-02, FR-003, FR-008 |
| TC-20 | `reconcileSkillsBySource()` -- Update existing skills | FR-002 AC-002-01, FR-004, FR-003 |
| TC-21 | `reconcileSkillsBySource()` -- Remove skills (phase-gated) | FR-002 AC-002-03, AC-002-04, AC-002-06 |
| TC-22 | `reconcileSkillsBySource()` -- Cross-source isolation | FR-002 AC-002-05, FR-001 |
| TC-23 | `reconcileSkillsBySource()` -- Return shape validation | FR-003 AC-003-01 through AC-003-05 |
| TC-24 | `reconcileSkillsBySource()` -- Input validation and edge cases | FR-002 (validation rules), FR-008 |
| TC-25 | `loadExternalManifest()` -- Source field defaults | FR-001 AC-001-04, FR-008 AC-008-04 |
| TC-26 | Integration -- Reconciliation pipeline | FR-002, FR-003, FR-005 |
| TC-27 | Performance -- Reconciliation benchmarks | NFR (performance quality attribute) |

## 10. Naming Conventions

Following existing patterns in `external-skill-management.test.cjs`:
- Test group IDs: `TC-NN` (continuing from TC-18)
- Individual test IDs: `TC-NN.MM` (e.g., TC-19.01)
- Test descriptions: `'TC-19.01: First discover run adds new skill to empty manifest'`
- Test file: Same file, appended at end

## 11. GATE-04 Checklist

- [x] Test strategy covers unit, integration, security, performance
- [x] Test cases exist for all requirements (FR-001 through FR-008, 26 ACs)
- [x] Traceability matrix complete (100% requirement coverage)
- [x] Coverage targets defined (100% AC coverage, 46 new tests)
- [x] Test data strategy documented
- [x] Critical paths identified
