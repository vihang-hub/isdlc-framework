# Test Strategy: REQ-0039 -- Replace 24h Staleness Discovery Context Injection

**Feature**: Replace 24h staleness discovery context injection with project skills (#90)
**Phase**: 05-test-strategy
**Created**: 2026-02-25
**Workflow**: Light

---

## 1. Existing Infrastructure

| Aspect | Detail |
|--------|--------|
| **Framework** | Node.js built-in test runner (`node:test`) |
| **Test runner** | `node --test src/claude/hooks/tests/*.test.cjs` |
| **Coverage tool** | None (manual validation) |
| **Existing test count** | 555+ tests across 68 test files |
| **Existing patterns** | CJS test files, `spawnSync`-based hook testing, `assert/strict` |
| **Test directory** | `src/claude/hooks/tests/` |
| **Naming convention** | `*.test.cjs` |

---

## 2. Change Characteristics

This feature is **primarily markdown specification file edits**, not JavaScript code changes.

| Aspect | Detail |
|--------|--------|
| Files changed | ~11 (all `.md` spec files) |
| JavaScript changes | 0 (hooks `.cjs` files need NO code changes) |
| Behavioral changes | None -- removal of unused injection path |
| Risk level | LOW (removals and documentation clarifications only) |

Because the changes are to markdown agent/command definition files rather than executable code, the test strategy focuses on:

1. **Regression** -- existing tests must still pass (no hook behavior changed)
2. **Content verification** -- spec files contain expected content after edits
3. **Absence verification** -- removed content does not appear in any file
4. **Backward compatibility** -- existing hook behavior remains correct

---

## 3. Test Strategy

### 3.1 Regression Testing (Primary)

**Goal**: Verify all existing 555+ hook tests pass without modification after the spec file changes.

**Command**: `npm run test:hooks`

**Rationale**: Even though no `.cjs` hook files are being modified, the hook tests validate the behavior of hooks that *read* `discovery_context` from `state.json`. Confirming these tests pass after the spec changes ensures no unintended coupling exists between the markdown specs and hook behavior.

**Key test files to watch**:

| Test File | Why It Matters |
|-----------|---------------|
| `walkthrough-tracker.test.cjs` | Tests T1-T10 validate `discovery_context.walkthrough_completed` audit reads -- must still pass |
| `test-session-cache-builder.test.cjs` | TC-BUILD-16 validates cache does NOT contain `DISCOVERY_CONTEXT` section -- should still pass (becomes even more correct) |
| `isdlc-step3-ordering.test.cjs` | Validates STEP 3d ordering -- may reference discovery context positioning |
| `skill-injection.test.cjs` | Validates skill injection -- STEP C assembly reference changes from "after DISCOVERY CONTEXT" to "after WORKFLOW MODIFIERS" |

**Pass criteria**: All existing tests pass. Test count does not decrease. Zero new test failures.

### 3.2 Content Verification Testing

**Goal**: After implementation, verify the spec files contain the expected updated content and do NOT contain the removed content.

These are verification checks to run post-implementation, not automated tests. They can be executed as grep-based assertions.

#### V-001: isdlc.md -- Injection Block Removed (FR-001)

| Check | Command Pattern | Expected Result |
|-------|----------------|-----------------|
| V-001a | Search isdlc.md line ~1566 area for "discovery_context" injection | NOT FOUND (block removed) |
| V-001b | Search for `<!-- SECTION: DISCOVERY_CONTEXT -->` extraction | NOT FOUND (session cache extraction removed) |
| V-001c | Search STEP C comment for "after DISCOVERY CONTEXT" | NOT FOUND (updated to "after WORKFLOW MODIFIERS") |
| V-001d | Verify STEP C references "after WORKFLOW MODIFIERS" | FOUND |

#### V-002: isdlc.md -- Template Updated (FR-002)

| Check | Command Pattern | Expected Result |
|-------|----------------|-----------------|
| V-002a | Search for `{DISCOVERY CONTEXT:` in delegation template | NOT FOUND |
| V-002b | Search for `if phase 02 or 03` conditional in template | NOT FOUND |

#### V-003: discover-orchestrator.md -- Audit-Only Designation (FR-003)

| Check | Command Pattern | Expected Result |
|-------|----------------|-----------------|
| V-003a | Search for "audit-only" or "audit only" near discovery_context | FOUND (in envelope documentation) |
| V-003b | Search for "enables seamless handover" | NOT FOUND (removed) |
| V-003c | Search for "24h" or "24-hour" expiry/staleness | NOT FOUND |

#### V-004: Phase Agent Documentation Updated (FR-004)

| Check | Command Pattern | Expected Result |
|-------|----------------|-----------------|
| V-004a | Search 00-sdlc-orchestrator.md for "DISCOVERY CONTEXT INJECTION" section header | NOT FOUND (section rewritten) |
| V-004b | Search 00-sdlc-orchestrator.md for "24h" staleness reference | NOT FOUND |
| V-004c | Search 01-requirements-analyst.md for "DISCOVERY CONTEXT block" | NOT FOUND |
| V-004d | Search 02-solution-architect.md for "DISCOVERY CONTEXT block" | NOT FOUND |
| V-004e | Search 03-system-designer.md for "DISCOVERY CONTEXT block" | NOT FOUND |

#### V-005: Backward Compatibility (FR-005)

| Check | Verification | Expected Result |
|-------|-------------|-----------------|
| V-005a | walkthrough-tracker.test.cjs T4 ("silent when no discovery_context") | PASSES (fail-open on missing discovery_context) |
| V-005b | walkthrough-tracker.test.cjs T8 ("fail-open on missing state.json") | PASSES (fail-open on missing state) |

#### V-006: Hook Audit-Only Usage (FR-006)

| Check | Verification | Expected Result |
|-------|-------------|-----------------|
| V-006a | walkthrough-tracker.cjs reads `discovery_context.walkthrough_completed` for warnings only | Confirmed by existing T1-T7 tests (audit behavior) |
| V-006b | test-adequacy-blocker.cjs reads `discovery_context.coverage_summary` without staleness logic | Confirmed by code review (no 24h/staleness code in hook) |
| V-006c | walkthrough-tracker.test.cjs fixtures test audit/provenance only | Confirmed by test review (no staleness assertions) |

### 3.3 Absence Verification (Cross-Cutting)

After all implementation is complete, run a comprehensive grep across the entire `src/` directory to verify no staleness injection logic remains.

| Check | Pattern | Scope | Expected |
|-------|---------|-------|----------|
| A-001 | `24h` or `24-hour` + `staleness` in same context | `src/claude/commands/isdlc.md` STEP 3d area | NOT FOUND |
| A-002 | `DISCOVERY CONTEXT INJECTION` as section header | `src/claude/agents/` | NOT FOUND |
| A-003 | `{DISCOVERY CONTEXT:` as template placeholder | `src/claude/commands/isdlc.md` | NOT FOUND |
| A-004 | `if phase 02 or 03` conditional for discovery context | `src/claude/commands/isdlc.md` | NOT FOUND |

**Note**: The following patterns SHOULD still be found (they are expected to remain):
- `discovery_context` in `walkthrough-tracker.cjs` (audit reads)
- `discovery_context` in `test-adequacy-blocker.cjs` (coverage_summary read)
- `discovery_context` in `discover-orchestrator.md` (audit-only envelope documentation)
- `DISCOVERY_CONTEXT` in `isdlc.md` STEP 7a roundtable dispatch (OUT OF SCOPE)
- `discovery_context` in `tour.md` (reads audit metadata)
- `discovery_context` in `party-personas.json` (output target metadata)

---

## 4. Test Execution Plan

### Phase 1: Pre-Implementation Baseline

Run before any implementation changes to establish the baseline.

```
npm run test:hooks
```

Record: total test count, total pass count, any pre-existing failures.

### Phase 2: Post-Implementation Regression

Run after all spec file edits are complete.

```
npm run test:hooks
```

**Pass criteria**: Same pass count as baseline. Zero new failures. Test count >= baseline.

### Phase 3: Content Verification

Run grep-based checks V-001 through V-006 against the edited files.

**Pass criteria**: All "NOT FOUND" checks return no matches. All "FOUND" checks return matches.

### Phase 4: Absence Verification

Run checks A-001 through A-004 against the full `src/` directory.

**Pass criteria**: All removed patterns are absent from expected locations.

---

## 5. Test Cases

### TC-001: Full Hook Test Suite Regression (NFR-003)

| Field | Value |
|-------|-------|
| **Requirement** | NFR-003 (Test Regression) |
| **Type** | Regression |
| **Priority** | P0 (Critical) |
| **Test type** | Positive |
| **Command** | `npm run test:hooks` |
| **Expected** | All tests pass. Count >= 555. |
| **Failure action** | BLOCK -- do not proceed with implementation if regression found |

### TC-002: Walkthrough Tracker Audit Tests Pass (FR-006, AC-006-01, AC-006-03)

| Field | Value |
|-------|-------|
| **Requirement** | FR-006, AC-006-01, AC-006-03 |
| **Type** | Regression |
| **Priority** | P0 (Critical) |
| **Test type** | Positive |
| **Command** | `node --test src/claude/hooks/tests/walkthrough-tracker.test.cjs` |
| **Expected** | All 10 tests pass (T1-T10). Tests validate audit-only reads of `discovery_context`. |

### TC-003: Session Cache Builder TC-BUILD-16 Pass (FR-001, AC-001-02)

| Field | Value |
|-------|-------|
| **Requirement** | FR-001, AC-001-02 |
| **Type** | Regression |
| **Priority** | P1 (High) |
| **Test type** | Positive |
| **Command** | `node --test src/claude/hooks/tests/test-session-cache-builder.test.cjs` |
| **Expected** | TC-BUILD-16 passes -- cache does NOT contain DISCOVERY_CONTEXT section delimiters |

### TC-004: Injection Block Removed from isdlc.md (FR-001, AC-001-01, AC-001-02)

| Field | Value |
|-------|-------|
| **Requirement** | FR-001, AC-001-01, AC-001-02 |
| **Type** | Verification |
| **Priority** | P0 (Critical) |
| **Test type** | Negative (verify absence) |
| **Method** | Grep `src/claude/commands/isdlc.md` for discovery context injection block near STEP 3d |
| **Expected** | Line ~1566 no longer contains the paragraph about checking session context for `<!-- SECTION: DISCOVERY_CONTEXT -->` and falling back to `state.json` |

### TC-005: STEP C Assembly Reference Updated (FR-001, AC-001-03)

| Field | Value |
|-------|-------|
| **Requirement** | FR-001, AC-001-03 |
| **Type** | Verification |
| **Priority** | P1 (High) |
| **Test type** | Positive |
| **Method** | Grep `src/claude/commands/isdlc.md` STEP C for "after WORKFLOW MODIFIERS" |
| **Expected** | STEP C comment references "WORKFLOW MODIFIERS" not "DISCOVERY CONTEXT" |

### TC-006: Delegation Template Placeholder Removed (FR-002, AC-002-01)

| Field | Value |
|-------|-------|
| **Requirement** | FR-002, AC-002-01 |
| **Type** | Verification |
| **Priority** | P0 (Critical) |
| **Test type** | Negative (verify absence) |
| **Method** | Search isdlc.md delegation template for `{DISCOVERY CONTEXT:` |
| **Expected** | Not found |

### TC-007: Discover Orchestrator Audit-Only Designation (FR-003, AC-003-01, AC-003-03)

| Field | Value |
|-------|-------|
| **Requirement** | FR-003, AC-003-01, AC-003-03 |
| **Type** | Verification |
| **Priority** | P1 (High) |
| **Test type** | Positive |
| **Method** | Search discover-orchestrator.md for "audit-only" near envelope documentation |
| **Expected** | Found. No "enables seamless handover" language. No 24h expiry references. |

### TC-008: Phase Agent Docs Updated (FR-004, AC-004-01)

| Field | Value |
|-------|-------|
| **Requirement** | FR-004, AC-004-01 |
| **Type** | Verification |
| **Priority** | P1 (High) |
| **Test type** | Negative (verify absence) |
| **Method** | Search 00-sdlc-orchestrator.md, 01-requirements-analyst.md, 02-solution-architect.md, 03-system-designer.md for legacy references |
| **Expected** | No "DISCOVERY CONTEXT INJECTION" section header. No "DISCOVERY CONTEXT block in delegation prompt" references in phase agent PRE-PHASE CHECK sections. |

### TC-009: Fail-Open Backward Compatibility (FR-005, AC-005-01, AC-005-02)

| Field | Value |
|-------|-------|
| **Requirement** | FR-005, AC-005-01, AC-005-02 |
| **Type** | Compatibility |
| **Priority** | P0 (Critical) |
| **Test type** | Positive |
| **Method** | Run walkthrough-tracker tests T4 and T8 which validate fail-open behavior |
| **Expected** | T4 passes (silent when no discovery_context). T8 passes (fail-open on missing state.json). No phase delegation code references discovery_context as required input. |

### TC-010: Hook Code Has No Staleness Logic (FR-006, AC-006-01, AC-006-02)

| Field | Value |
|-------|-------|
| **Requirement** | FR-006, AC-006-01, AC-006-02 |
| **Type** | Verification |
| **Priority** | P1 (High) |
| **Test type** | Negative (verify absence) |
| **Method** | Grep walkthrough-tracker.cjs and test-adequacy-blocker.cjs for "24h", "stale", "fresh", "expir" |
| **Expected** | Not found -- hooks use discovery_context for audit/provenance only, no staleness decisions |

### TC-011: Roundtable Path Preserved (Out of Scope Validation)

| Field | Value |
|-------|-------|
| **Requirement** | N/A (out of scope boundary check) |
| **Type** | Boundary |
| **Priority** | P2 (Medium) |
| **Test type** | Positive |
| **Method** | Verify isdlc.md STEP 7a roundtable dispatch still contains DISCOVERY_CONTEXT extraction and injection |
| **Expected** | STEP 7a roundtable code is unchanged -- DISCOVERY_CONTEXT field still passed to roundtable-analyst |

---

## 6. Traceability Matrix

| Requirement | AC | Test Case | Test Type | Priority |
|-------------|-----|-----------|-----------|----------|
| NFR-003 | Test regression metric | TC-001 | positive (regression) | P0 |
| FR-006 | AC-006-01, AC-006-03 | TC-002 | positive (regression) | P0 |
| FR-001 | AC-001-02 | TC-003 | positive (regression) | P1 |
| FR-001 | AC-001-01, AC-001-02 | TC-004 | negative (absence) | P0 |
| FR-001 | AC-001-03 | TC-005 | positive (verification) | P1 |
| FR-002 | AC-002-01, AC-002-02 | TC-006 | negative (absence) | P0 |
| FR-003 | AC-003-01, AC-003-03 | TC-007 | positive (verification) | P1 |
| FR-004 | AC-004-01 | TC-008 | negative (absence) | P1 |
| FR-005 | AC-005-01, AC-005-02 | TC-009 | positive (compatibility) | P0 |
| FR-006 | AC-006-01, AC-006-02 | TC-010 | negative (absence) | P1 |
| N/A | Out of scope boundary | TC-011 | positive (boundary) | P2 |

### Coverage Summary

| Requirement | ACs Covered | Test Cases | Status |
|-------------|------------|------------|--------|
| FR-001 | AC-001-01, AC-001-02, AC-001-03 | TC-003, TC-004, TC-005 | 3/3 ACs covered |
| FR-002 | AC-002-01, AC-002-02 | TC-006 | 2/2 ACs covered |
| FR-003 | AC-003-01, AC-003-02, AC-003-03 | TC-007 | 3/3 ACs covered (AC-003-02 is write-side, verified by doc review) |
| FR-004 | AC-004-01 | TC-008 | 1/1 ACs covered |
| FR-005 | AC-005-01, AC-005-02 | TC-009 | 2/2 ACs covered |
| FR-006 | AC-006-01, AC-006-02, AC-006-03 | TC-002, TC-010 | 3/3 ACs covered |
| NFR-003 | Test regression metric | TC-001 | 1/1 covered |
| **Total** | **15 ACs** | **11 TCs** | **100% coverage** |

---

## 7. Test Data Plan

### 7.1 No New Test Data Required

Since no JavaScript code is being changed and all changes are to markdown spec files, no new test fixtures, factories, or test data is required. The existing test fixtures in `walkthrough-tracker.test.cjs` and `test-session-cache-builder.test.cjs` already cover the relevant `discovery_context` scenarios:

- `discovery_context: { walkthrough_completed: false }` -- audit read
- `discovery_context: { walkthrough_completed: true }` -- audit read
- `discovery_context: {}` -- empty envelope
- No `discovery_context` at all -- fail-open
- No `state.json` at all -- fail-open

### 7.2 Boundary Values

| Boundary | Current Coverage | New Coverage Needed |
|----------|-----------------|-------------------|
| Empty discovery_context | Covered by T2 | None |
| Missing discovery_context | Covered by T4 | None |
| Missing state.json | Covered by T8 | None |

### 7.3 Invalid Inputs

| Input | Current Coverage | New Coverage Needed |
|-------|-----------------|-------------------|
| Empty stdin | Covered by T9 | None |
| Invalid JSON | Covered by T10 | None |

### 7.4 Maximum-Size Inputs

Not applicable -- no new code paths handle variable-size inputs.

---

## 8. GATE-04 Validation

### Phase Gate Checklist

- [x] Test strategy covers regression testing (section 3.1)
- [x] Test strategy covers content verification (section 3.2)
- [x] Test strategy covers absence verification (section 3.3)
- [x] Test strategy covers backward compatibility (TC-009)
- [x] Test cases exist for all 6 functional requirements
- [x] Test cases exist for NFR-003 (test regression)
- [x] Traceability matrix complete (15 ACs mapped, 100% coverage)
- [x] Coverage targets defined (existing 555+ tests must pass, zero new failures)
- [x] Test data plan documented (no new data needed -- existing fixtures sufficient)
- [x] Critical paths identified (STEP 3d injection removal, backward compatibility)

### Constitutional Compliance

| Article | Status | Evidence |
|---------|--------|----------|
| Article II (Test-First) | Compliant | Test strategy designed before implementation; regression baseline established |
| Article VII (Traceability) | Compliant | All 15 ACs mapped to test cases; 100% requirement coverage |
| Article IX (Gate Integrity) | Compliant | All gate checklist items satisfied |
| Article XI (Integration Testing) | Compliant | Regression suite validates hook integration behavior |
