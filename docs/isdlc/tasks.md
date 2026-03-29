# Task Plan: REQ-GH-214 REQ-GH-214-pretooluse-enforcement-route-agents-higher-fidelity-mcp

**Version**: 2.0
**Generated**: 2026-03-29
**Workflow**: feature
**Artifact Folder**: REQ-GH-214-pretooluse-enforcement-route-agents-higher-fidelity-mcp

---

## Progress Summary

| Phase | Tasks | Completed | Status |
|-------|-------|-----------|--------|
| 05 — Test Strategy | 3 | 0 | PENDING |
| 06 — Implementation | 17 | 0 | PENDING |
| 16 — Quality Loop | 3 | 0 | PENDING |
| 08 — Code Review | 2 | 0 | PENDING |
| **Total** | **25** | **0** | **0%** |

---

## Phase 05: Test Strategy -- PENDING

### test_case_design

- [ ] T0001 Design test strategy for tool-router hook — unit tests for each function, integration tests for end-to-end hook flow | traces: FR-001, FR-008
- [ ] T0002 Define test cases for exemption mechanism — pattern regex matching, context condition evaluation, exemption precedence | traces: FR-006, AC-006-01, AC-006-02, AC-006-03
- [ ] T0003 Define test cases for three-source rule merge — priority ordering, conflict resolution, missing sources | traces: FR-003, AC-003-01, AC-003-02

---

## Phase 06: Implementation -- PENDING

### setup

- [ ] T0004 Create tool-routing.json with framework default rules search-semantic find-files file-summary, inference probes, and empty user_overrides | traces: FR-002, AC-002-01
  files: src/claude/hooks/config/tool-routing.json (CREATE)
  blocks: [T0006, T0015]

- [ ] T0005 Add tool_preferences field to external-skills-manifest schema and document the field | traces: FR-005, AC-005-01
  files: docs/isdlc/external-skills-manifest.json (MODIFY)

### core_implementation

- [ ] T0006 Implement tool-router.cjs — stdin parsing via readStdin, main loop, fail-open shell exit 0 on any error | traces: FR-001, FR-008, NFR-001, AC-001-03, AC-008-01
  files: src/claude/hooks/tool-router.cjs (CREATE)
  blocked_by: [T0004]
  blocks: [T0007, T0008, T0009, T0010, T0011, T0012, T0014]

- [ ] T0007 Implement loadRoutingRules — read framework config, read skill manifest tool_preferences, run inferEnvironmentRules, read user_overrides, merge by priority | traces: FR-003, AC-003-01, AC-003-02
  files: src/claude/hooks/tool-router.cjs (MODIFY)
  blocked_by: [T0006]

- [ ] T0008 Implement inferEnvironmentRules — probe MCP tool availability via filesystem heuristics, check for embeddings directory, generate inferred rules at warn level | traces: FR-004, FR-009, AC-004-01, AC-004-02, AC-009-01, AC-009-02
  files: src/claude/hooks/tool-router.cjs (MODIFY)
  blocked_by: [T0006]

- [ ] T0009 Implement evaluateRule and checkExemptions — pattern regex matching, context condition evaluation edit_prep targeted_file exact_filename, first-match-wins | traces: FR-006, AC-006-01, AC-006-02, AC-006-03
  files: src/claude/hooks/tool-router.cjs (MODIFY)
  blocked_by: [T0006]

- [ ] T0010 Implement formatBlockMessage and formatWarnMessage — block message with preferred tool name, warn message with config path for promotion | traces: FR-007, AC-007-01, AC-001-01, AC-001-02
  files: src/claude/hooks/tool-router.cjs (MODIFY)
  blocked_by: [T0006]

- [ ] T0011 Implement appendAuditEntry — JSONL append to .isdlc/tool-routing-audit.jsonl, create file if missing, non-blocking on failure | traces: FR-011, AC-011-01, AC-011-02, AC-011-03
  files: src/claude/hooks/tool-router.cjs (MODIFY)
  blocked_by: [T0006]

### unit_tests

- [ ] T0012 Write unit tests for tool-router.cjs — test each function in isolation loadRoutingRules inferEnvironmentRules evaluateRule checkExemptions formatBlockMessage formatWarnMessage appendAuditEntry | traces: FR-001, FR-003, FR-006, FR-008
  files: tests/hooks/tool-router.test.cjs (CREATE)
  blocked_by: [T0006]

- [ ] T0013 Write unit tests for config loading — missing config, malformed JSON, valid config, user overrides, skill preferences merge | traces: FR-002, FR-003, AC-008-01, AC-008-03
  files: tests/hooks/tool-router.test.cjs (MODIFY)
  blocked_by: [T0012]

- [ ] T0014 Write unit tests for exemption evaluation — pattern exemptions with regex, context exemptions edit_prep targeted_file exact_filename, invalid regex handling | traces: FR-006, AC-006-01, AC-006-02, AC-006-03
  files: tests/hooks/tool-router.test.cjs (MODIFY)
  blocked_by: [T0012]

### wiring_claude

- [ ] T0015 Register hook in src/claude/settings.json — add PreToolUse matchers for Grep Glob Read pointing to tool-router.cjs | traces: FR-001
  files: src/claude/settings.json (MODIFY)
  blocked_by: [T0006]
  blocks: [T0020]

- [ ] T0016 Add Article XV Tool Preference Enforcement to docs/isdlc/constitution.md — principle statement, validation references, amendment log entry | traces: FR-010, AC-010-01
  files: docs/isdlc/constitution.md (MODIFY)

### wiring_codex

- [ ] T0017 Confirm Codex provider is not affected — tool routing is Claude-provider-specific as Codex does not use PreToolUse hooks. Document in architecture-overview.md. | traces: FR-001
  files: docs/requirements/REQ-GH-214-pretooluse-enforcement-route-agents-higher-fidelity-mcp/architecture-overview.md (MODIFY)

### cleanup

- [ ] T0018 Copy tool-router.cjs to .claude/hooks/tool-router.cjs for dogfooding dual-file | traces: FR-001
  files: .claude/hooks/tool-router.cjs (CREATE)
  blocked_by: [T0006]

- [ ] T0019 Copy tool-routing.json to .claude/hooks/config/tool-routing.json for dogfooding dual-file | traces: FR-002
  files: .claude/hooks/config/tool-routing.json (CREATE)
  blocked_by: [T0004]

- [ ] T0020 Update .claude/settings.json with new PreToolUse matchers for Grep Glob Read | traces: FR-001
  files: .claude/settings.json (MODIFY)
  blocked_by: [T0015]

---

## Phase 16: Quality Loop -- PENDING

### test_execution

- [ ] T0021 Run full test suite ESM lib plus CJS hooks — ensure no regressions from new hook registration | traces: NFR-001
- [ ] T0022 Verify fail-open behavior end-to-end — config missing, MCP unavailable, malformed stdin, audit write failure | traces: FR-008, AC-008-01, AC-008-02, AC-008-03

### parity_verification

- [ ] T0023 Verify src/claude/ and .claude/ copies are identical — diff tool-router.cjs, tool-routing.json, settings.json entries | traces: FR-001, FR-002

---

## Phase 08: Code Review -- PENDING

### constitutional_review

- [ ] T0024 Constitutional review — verify Article XV is correct, hook enforces Article X fail-open, Article XIII CJS module system | traces: FR-010, FR-008

### dual_file_check

- [ ] T0025 Dual-file check — confirm src/ and .claude/ are in sync for all new and modified files | traces: FR-001, FR-002

---

## Dependency Graph

```
T0004 ──┬──→ T0006 ──┬──→ T0007 (parallel with T0008-T0011)
        │            ├──→ T0008
        │            ├──→ T0009
        │            ├──→ T0010
        │            ├──→ T0011
        │            ├──→ T0012 ──→ T0013 ──→ T0014
        │            ├──→ T0015 ──→ T0020
        │            ├──→ T0018
        │            └──→ (T0017 independent)
        └──→ T0019
T0005 (independent)
T0016 (independent)
T0021 ──→ T0022 ──→ T0023
T0024 ──→ T0025
```

**Critical Path**: T0004 → T0006 → T0012 → T0013 → T0014 → T0021 → T0022 → T0023 → T0024 → T0025 (10 tasks)

---

## Traceability Matrix

| Task | FR | AC |
|------|----|----|
| T0001 | FR-001, FR-008 | — |
| T0002 | FR-006 | AC-006-01, AC-006-02, AC-006-03 |
| T0003 | FR-003 | AC-003-01, AC-003-02 |
| T0004 | FR-002 | AC-002-01 |
| T0005 | FR-005 | AC-005-01 |
| T0006 | FR-001, FR-008 | AC-001-03, AC-008-01 |
| T0007 | FR-003 | AC-003-01, AC-003-02 |
| T0008 | FR-004, FR-009 | AC-004-01, AC-004-02, AC-009-01, AC-009-02 |
| T0009 | FR-006 | AC-006-01, AC-006-02, AC-006-03 |
| T0010 | FR-007 | AC-007-01, AC-001-01, AC-001-02 |
| T0011 | FR-011 | AC-011-01, AC-011-02, AC-011-03 |
| T0012 | FR-001, FR-003, FR-006, FR-008 | — |
| T0013 | FR-002, FR-003 | AC-008-01, AC-008-03 |
| T0014 | FR-006 | AC-006-01, AC-006-02, AC-006-03 |
| T0015 | FR-001 | — |
| T0016 | FR-010 | AC-010-01 |
| T0017 | FR-001 | — |
| T0018 | FR-001 | — |
| T0019 | FR-002 | — |
| T0020 | FR-001 | — |
| T0021 | NFR-001 | — |
| T0022 | FR-008 | AC-008-01, AC-008-02, AC-008-03 |
| T0023 | FR-001, FR-002 | — |
| T0024 | FR-010, FR-008 | — |
| T0025 | FR-001, FR-002 | — |
