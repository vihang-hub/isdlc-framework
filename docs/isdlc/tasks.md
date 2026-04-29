# Task Plan: REQ-GH-261 constitutional-quality-enforcement

## Progress Summary

| Phase | Total | Done | Remaining |
|---|---|---|---|
| 05 | 1 | 1 | 0 |
| 06 | 12 | 12 | 0 |
| 16 | 1 | 1 | 0 |
| 08 | 1 | 0 | 1 |
| **Total** | **15** | **14** | **1** |

## Phase 05: Test Strategy -- COMPLETE

- [X] T001 Define test strategy — unit tests per hook (patterns, exemptions, block messages), integration tests for 3f corrective loop, regression for existing hooks | traces: FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007

## Phase 06: Implementation -- COMPLETE

- [X] T002 Constitution updates — strengthen Articles I, II, III, IV, VI with verifiable quality criteria | traces: FR-001
  files: docs/isdlc/constitution.md (MODIFY)

- [X] T003 Deferral detector hook — PreToolUse on Write/Edit, regex patterns, exemption list, block message with line numbers | traces: FR-002
  files: src/claude/hooks/deferral-detector.cjs (CREATE)
  blocked_by: [T002]

- [X] T004 Deferral detector tests — pattern matching, exemptions (test files, ADRs, markers), false positive prevention | traces: FR-002
  files: src/claude/hooks/tests/deferral-detector.test.cjs (CREATE)
  blocked_by: [T003]

- [X] T005 Test quality validator hook — AC extraction, test trace scanning, assertion counting, error path detection, block message | traces: FR-003
  files: src/claude/hooks/test-quality-validator.cjs (CREATE), src/claude/hooks/lib/common.cjs (MODIFY)
  blocked_by: [T002]

- [X] T006 Test quality validator tests — AC coverage detection, zero-assertion flagging, error path flagging, exemptions | traces: FR-003
  files: src/claude/hooks/tests/test-quality-validator.test.cjs (CREATE), src/claude/hooks/tests/common-quality-utilities.test.cjs (CREATE)
  blocked_by: [T005]

- [X] T007 Spec trace validator hook — git diff parsing, tasks.md mapping, untraced file detection, unimplemented AC detection, block message | traces: FR-004
  files: src/claude/hooks/spec-trace-validator.cjs (CREATE)
  blocked_by: [T002]

- [X] T008 Spec trace validator tests — untraced files, unimplemented ACs, exemptions for config/test/docs | traces: FR-004
  files: src/claude/hooks/tests/spec-trace-validator.test.cjs (CREATE)
  blocked_by: [T007]

- [X] T009 Security depth validator hook — external input detection, validation proximity, generic claim flagging, block message | traces: FR-005
  files: src/claude/hooks/security-depth-validator.cjs (CREATE)
  blocked_by: [T002]

- [X] T010 Security depth validator tests — input patterns, validation proximity, generic claims | traces: FR-005
  files: src/claude/hooks/tests/security-depth-validator.test.cjs (CREATE)
  blocked_by: [T009]

- [X] T011 Review depth validator hook — file reference counting, generic approval detection, finding density, block message | traces: FR-006
  files: src/claude/hooks/review-depth-validator.cjs (CREATE)
  blocked_by: [T002]

- [X] T012 Review depth validator tests — file reference parsing, generic approval flagging, density thresholds | traces: FR-006
  files: src/claude/hooks/tests/review-depth-validator.test.cjs (CREATE)
  blocked_by: [T011]

- [X] T013 Phase-Loop Controller integration — 5 block signals in 3f dispatch, max 5 retries, re-delegation templates, iteration-requirements.json | traces: FR-007
  files: src/claude/commands/isdlc.md (MODIFY), src/isdlc/config/iteration-requirements.json (MODIFY)
  blocked_by: [T003, T005, T007, T009, T011]

## Phase 16: Quality Loop -- COMPLETE

- [X] T014 Integration tests — trigger each hook with mock state, verify block messages, verify 3f loop, verify max 5 retries escalation, regression for existing hooks | traces: FR-002, FR-003, FR-004, FR-005, FR-006, FR-007

## Phase 08: Code Review -- COMPLETE

- [X] T015 Code review — regex precision, exemption completeness, block message specificity, fail-open, performance (<50ms deferral, <500ms gate), no impact on existing hooks | traces: FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007

## Dependency Graph

Critical path: T002 → T003/T005/T007/T009/T011 → T013 → T014 → T015

Tier 0: T002 (constitution)
Tier 1: T003, T005, T007, T009, T011 (5 hooks, independent)
Tier 2: T004, T006, T008, T010, T012 (tests per hook)
Tier 3: T013 (Phase-Loop integration)
Tier 4: T014 (integration tests)
Tier 5: T015 (code review)

## Traceability Matrix

| FR | Requirement | Design / Blast Radius | Related Tasks |
|---|---|---|---|
| FR-001 | Constitutional article strengthening | docs/isdlc/constitution.md (MODIFY) | T002 |
| FR-002 | Deferral detector (inline) | deferral-detector.cjs (CREATE) | T003, T004 |
| FR-003 | Test quality validator (gate) | test-quality-validator.cjs (CREATE), common.cjs (MODIFY) | T005, T006 |
| FR-004 | Spec trace validator (gate) | spec-trace-validator.cjs (CREATE) | T007, T008 |
| FR-005 | Security depth validator (gate) | security-depth-validator.cjs (CREATE) | T009, T010 |
| FR-006 | Review depth validator (gate) | review-depth-validator.cjs (CREATE) | T011, T012 |
| FR-007 | Phase-Loop Controller integration | isdlc.md (MODIFY), iteration-requirements.json (MODIFY) | T013 |

## Assumptions and Inferences

- **Assumption**: AC format standardised as AC-NNN-NN — High confidence (template enforces)
- **Assumption**: Test traces follow pattern traces: AC-NNN-NN or AC-NNN-NN in test descriptions — Medium confidence
- **Inference**: Assertion patterns (assert., expect(, .should) cover 95%+ of tests — High confidence (project uses node:test + node:assert/strict)
- **Inference**: External input patterns (req.body, process.argv, JSON.parse) cover primary vectors — High confidence
- **Assumption**: PreToolUse hooks receive Write/Edit content in input payload — needs verification
