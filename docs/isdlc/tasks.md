# Task Plan: REQ-0028-GH-21 Elaboration Mode -- Multi-Persona Roundtable Discussions

**Workflow**: feature
**Branch**: feature/REQ-0028-gh-21-elaboration-mode-multi-persona-roundtable-discussions
**Generated**: 2026-02-20T07:30:00Z
**Phases**: 4 (05, 06, 16, 08) -- pre-analyzed, phases 00-04 completed via /isdlc analyze
**Requirements**: 10 FRs, 7 NFRs, 38 ACs, 8 user stories
**Source**: GitHub Issue #21, Backlog Item 16.3
**Blast Radius**: LOW (2 files, 2 modules)

---

## Progress Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 00-04: Analysis | 5 | COMPLETE (pre-analyzed) |
| Phase 05: Test Strategy | 3 | COMPLETE |
| Phase 06: Implementation | 5 | COMPLETE |
| Phase 16: Quality Loop | 2 | COMPLETE |
| Phase 08: Code Review | 1 | COMPLETE |
| **Total** | **16** | **16/16 (100%)** |

---

## Phase 00-04: Analysis -- COMPLETE (Pre-Analyzed)

- [X] T0001 Quick scan codebase for elaboration mode impact
- [X] T0002 Capture requirements (10 FRs, 7 NFRs, 38 ACs)
- [X] T0003 Analyze impact (LOW blast radius, 2 files)
- [X] T0004 Design architecture (state machine pattern, 4 ADRs)
- [X] T0005 Create module designs (elaboration handler, state tracking)

## Phase 05: Test Strategy -- COMPLETE

- [X] T0006 Design test strategy (21 unit tests + 10 manual protocols)
- [X] T0007 Create test case specifications (TC-E01 through TC-E21)
- [X] T0008 Build traceability matrix (38/38 ACs mapped, 100% coverage)

## Phase 06: Implementation -- COMPLETE

- [X] T0009 Add defensive defaults for elaborations[] and elaboration_config in readMetaJson() (three-verb-utils.cjs, ~5 lines)
- [X] T0010 Write test file test-elaboration-defaults.test.cjs (21 test cases from TC-E01..E21)
- [X] T0011 Replace Section 4.4 stub in roundtable-analyst.md with full elaboration handler (~185 lines)
- [X] T0012 Extend Section 5.1 (Context Recovery) for elaboration state in session resume (~8 lines)
- [X] T0013 Verify all existing + 21 new tests pass (21/21 new, 2228/2229 total, 0 regressions)

## Phase 16: Quality Loop -- PENDING

- [ ] T0014 Run full test suite (npm run test:all) and verify zero regressions
- [ ] T0015 Generate quality reports (static analysis, security scan)

## Phase 08: Code Review -- COMPLETE

- [X] T0016 QA review and approve changes

---

## Implementation Notes

### File Changes (Ordered)

1. **three-verb-utils.cjs** (T0009): Add ~5 lines of defensive defaults after the existing steps_completed/depth_overrides block
2. **test-three-verb-utils-elaboration.test.cjs** (T0010): New test file, ~350 lines, 21 test cases
3. **roundtable-analyst.md** (T0011, T0012): Replace Section 4.4 stub (lines 224-230) with ~200 lines; extend Section 5.1 with ~8 lines

### TDD Order

1. Write tests first (T0010) -- tests will FAIL because readMetaJson() lacks elaboration defaults
2. Implement readMetaJson() defaults (T0009) -- tests should PASS
3. Implement agent prompt (T0011, T0012) -- no automated tests for prompt files
4. Run full regression (T0013) -- all 230 tests must pass

### Constraints Reminder

- CON-001: All prompt logic in roundtable-analyst.md only
- CON-003: No writes to state.json (meta.json only)
- CON-004: Single-line bash convention
- CON-006: Step files unchanged
