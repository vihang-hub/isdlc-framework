# Task Plan: REQ-0040-toon-format-integration

**Workflow**: feature
**Branch**: feature/REQ-0040-toon-format-integration
**Generated**: 2026-02-25T23:20:00Z
**Phases**: 9 (00, 01, 02, 03, 04, 05, 06, 16, 08)
**Requirements**: 5 FRs, 9 NFRs, 6 constraints
**Source**: Manual (Backlog #33)
**Blast Radius**: LOW (4 files, 2 modules)

---

## Progress Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 00: Quick Scan | 1 | COMPLETE |
| Phase 01: Requirements | 1 | COMPLETE |
| Phase 02: Impact Analysis | 1 | COMPLETE |
| Phase 03: Architecture | 1 | COMPLETE |
| Phase 04: Design | 1 | COMPLETE |
| Phase 05: Test Strategy | 1 | COMPLETE |
| Phase 06: Implementation | 4 | COMPLETE |
| Phase 16: Quality Loop | 1 | PENDING |
| Phase 08: Code Review | 1 | PENDING |
| **Total** | **12** | **7/12 (58%)** |

---

## Phase 00: Quick Scan -- COMPLETE

- [X] T0001 Quick scan codebase for TOON integration impact

## Phase 01: Requirements -- COMPLETE

- [X] T0002 Capture requirements (5 FRs, 9 NFRs, 6 constraints, 5 assumptions) | traces: FR-001..FR-005

## Phase 02: Impact Analysis -- COMPLETE

- [X] T0003 Analyze impact (LOW blast radius, 4 files, 2 modules) | traces: FR-001..FR-005

## Phase 03: Architecture -- COMPLETE

- [X] T0004 Design architecture (4 ADRs: native CJS encoder, SKILLS_MANIFEST only, per-section fallback, REQ-003 deferred) | traces: FR-001..FR-005

## Phase 04: Design -- COMPLETE

- [X] T0005 Create module design (toon-encoder.cjs, common.cjs mod, 38 new test cases) | traces: FR-001, FR-002, FR-004, FR-005

## Phase 05: Test Strategy -- COMPLETE

- [X] T0006 Design test strategy and traceability matrix | traces: FR-001..FR-005, NFR-001..NFR-009

## Phase 06: Implementation -- COMPLETE

- [X] T0007 Create toon-encoder.cjs (encode, decode, isUniformArray) | traces: FR-001, FR-004
    files: src/claude/hooks/lib/toon-encoder.cjs (CREATE)
    blocked_by: none
    blocks: T0008, T0009

- [X] T0008 Create toon-encoder.test.cjs (44 test cases) | traces: FR-001, FR-004
    files: src/claude/hooks/tests/toon-encoder.test.cjs (CREATE)
    blocked_by: T0007
    blocks: T0009

- [X] T0009 Modify common.cjs SKILLS_MANIFEST section for TOON encoding | traces: FR-002, FR-004, FR-005
    files: src/claude/hooks/lib/common.cjs (MODIFY)
    blocked_by: T0007
    blocks: T0010

- [X] T0010 Modify test-session-cache-builder.test.cjs (add 3 TOON integration tests) | traces: FR-002, FR-004
    files: src/claude/hooks/tests/test-session-cache-builder.test.cjs (MODIFY), src/claude/hooks/tests/hook-test-utils.cjs (MODIFY)
    blocked_by: T0009
    blocks: none

## Phase 16: Quality Loop -- PENDING

- [ ] T0011 Run full test suite and verify zero regressions (>=555 + 38 new) | traces: NFR-007

## Phase 08: Code Review -- PENDING

- [ ] T0012 QA review and approve all changes | traces: Article VI

---

## Dependency Graph

```
T0007 (toon-encoder.cjs) ──┬──> T0008 (toon-encoder.test.cjs)
                            │
                            └──> T0009 (common.cjs mod) ──> T0010 (session-cache test mod)
```

**Critical Path**: T0007 → T0009 → T0010 (3 tasks, ~195 lines production code + ~60 test lines)

---

## Traceability Matrix

| FR | AC | Task | File |
|----|-----|------|------|
| FR-001 | AC-001-01..04 | T0007, T0008 | toon-encoder.cjs, toon-encoder.test.cjs |
| FR-002 | AC-002-02 | T0009, T0010 | common.cjs, test-session-cache-builder.test.cjs |
| FR-004 | AC-004-01..04 | T0007, T0008, T0009, T0010 | All files |
| FR-005 | AC-005-01..03 | T0009, T0010 | common.cjs (rebuildSessionCache auto-inherits) |
| NFR-007 | >=555 baseline | T0011 | Full test suite |

---

## TDD Order

1. Create toon-encoder.cjs (T0007) -- production module
2. Create toon-encoder.test.cjs (T0008) -- 35 tests validating encode/decode/isUniformArray
3. Modify common.cjs Section 5 (T0009) -- TOON encoding in rebuildSessionCache
4. Modify test-session-cache-builder.test.cjs (T0010) -- fix TC-BUILD-08, add TC-BUILD-19..21
5. Run full regression (T0011) -- all tests must pass
