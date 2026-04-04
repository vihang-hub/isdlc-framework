# Task Plan: REQ-GH-224 embedding-pipeline-activation

## Progress Summary

| Phase | Tasks | Complete | Status |
|-------|-------|----------|--------|
| 05 | 8 | 0 | PENDING |
| 06 | 12 | 0 | PENDING |
| 16 | 2 | 0 | PENDING |
| 08 | 2 | 0 | PENDING |
| **Total** | **24** | **0** | **0%** |

## Phase 05: Test Strategy -- PENDING

- [ ] T001 Design test cases for http-server endpoints (all 7 endpoints, source tagging, error paths) | traces: FR-001, FR-007, FR-008, FR-010, AC-001-01, AC-007-01, AC-008-01, AC-010-01
  files: tests/embedding/server/http-server.test.js (CREATE)
- [ ] T002 Design test cases for lifecycle (spawn, stop, status, PID+lock management) | traces: FR-002, FR-016, AC-002-01, AC-002-02, AC-002-03, AC-016-01, AC-016-03
  files: tests/embedding/server/lifecycle.test.js (CREATE)
- [ ] T003 Design test cases for port-discovery (config read, health check, retry) | traces: FR-003, FR-004, AC-003-01, AC-004-01
  files: tests/embedding/server/port-discovery.test.js (CREATE)
- [ ] T004 Design test cases for refresh-client and finalize step (delta POST, fail-open) | traces: FR-005, FR-015, AC-005-01, AC-005-02, AC-015-01
  files: tests/embedding/server/refresh-client.test.js (CREATE), tests/core/finalize/refresh-embeddings.test.js (CREATE)
- [ ] T005 Design test cases for SessionStart hook (reachable/unreachable/prompt/fail-open) | traces: FR-004, FR-015, AC-004-01, AC-004-02, AC-004-03, AC-015-01, AC-015-02
  files: tests/core/hooks/embedding-session-check.test.cjs (CREATE)
- [ ] T006 Design test cases for CLI server subcommands (start/stop/status/restart/reload) | traces: FR-002, FR-013, AC-002-01, AC-002-02, AC-002-03, AC-013-01
  files: tests/bin/isdlc-embedding-server-cli.test.js (CREATE)
- [ ] T007 Design test cases for multi-session lock coordination (concurrent starts, stale locks) | traces: FR-016, AC-016-01, AC-016-02, AC-016-03
  files: tests/embedding/server/multi-session.test.js (CREATE)
- [ ] T008 Design test cases for discover incremental integration (first gen + incremental + VCS diff) | traces: FR-006, AC-006-01, AC-006-02, AC-006-03
  files: tests/embedding/discover-incremental.test.js (CREATE)

## Phase 06: Implementation -- PENDING

- [ ] T009 Create http-server.js with all 7 HTTP endpoints wrapping MCP server | traces: FR-001, FR-007, FR-008, FR-010, AC-001-01, AC-007-01, AC-008-01, AC-010-01
  files: lib/embedding/server/http-server.js (CREATE)
  blocks: [T010, T012, T013, T020]
- [ ] T010 Create bin/isdlc-embedding-server.js runner entry point | traces: FR-001, FR-011, AC-001-01, AC-011-01, AC-011-02
  files: bin/isdlc-embedding-server.js (CREATE)
  blocked_by: [T009]
  blocks: [T011]
- [ ] T011 Create lifecycle.js (spawn detached, PID/lock/log files, stop/status) | traces: FR-002, FR-016, AC-002-01, AC-002-02, AC-002-03, AC-016-01, AC-016-03
  files: lib/embedding/server/lifecycle.js (CREATE)
  blocked_by: [T010]
  blocks: [T016, T019]
- [ ] T012 Create port-discovery.js (client config + health check + retry) | traces: FR-003, FR-004, AC-003-01, AC-004-01
  files: lib/embedding/server/port-discovery.js (CREATE)
  blocked_by: [T009]
  blocks: [T014]
- [ ] T013 Create refresh-client.js (POST /refresh and /add-content helpers) | traces: FR-005, FR-008, AC-005-01, AC-008-01
  files: lib/embedding/server/refresh-client.js (CREATE)
  blocked_by: [T009]
  blocks: [T015]
- [ ] T014 Create SessionStart hook + register in Claude/Codex/Antigravity | traces: FR-004, FR-015, AC-004-01, AC-004-02, AC-004-03, AC-015-01, AC-015-02
  files: src/core/hooks/embedding-session-check.cjs (CREATE), src/claude/settings.json (MODIFY)
  blocked_by: [T012]
- [ ] T015 Create refresh-embeddings finalize step + add to default steps | traces: FR-005, FR-015, AC-005-01, AC-005-02, AC-015-03
  files: src/core/finalize/refresh-embeddings.js (CREATE), src/core/finalize/finalize-steps.default.md (MODIFY)
  blocked_by: [T013]
- [ ] T016 Extend bin/isdlc-embedding.js with server and regenerate subcommands | traces: FR-002, FR-012, FR-013, AC-002-01, AC-012-01, AC-013-01
  files: bin/isdlc-embedding.js (MODIFY)
  blocked_by: [T011]
- [ ] T017 Add configure CLI subcommand (interactive provider setup) | traces: FR-011, AC-011-01, AC-011-02, AC-011-03
  files: bin/isdlc-embedding.js (MODIFY)
  blocked_by: [T018]
- [ ] T018 Add embeddings section to config-defaults + migration in updater | traces: FR-003, FR-011, FR-014, AC-003-03, AC-011-01, AC-014-01, AC-014-02, AC-014-03
  files: src/core/config/config-defaults.js (MODIFY), lib/updater.js (MODIFY), .gitignore (MODIFY)
  blocks: [T017]
- [ ] T019 Wire discover integration: incremental + auto-start after /discover | traces: FR-006, AC-006-01, AC-006-02, AC-006-03
  files: lib/embedding/discover-integration.js (MODIFY), src/claude/agents/discover-orchestrator.md (MODIFY)
  blocked_by: [T011]
- [ ] T020 Register isdlc_embedding_add_content MCP tool in 3 providers | traces: FR-008, FR-009, AC-008-01, AC-009-01, AC-009-02, AC-009-03
  files: src/claude/settings.json (MODIFY)
  blocked_by: [T009]

## Phase 16: Quality Loop -- PENDING

- [ ] T021 Run full test suite, fix regressions from new modules and hook changes | traces: all
  blocked_by: [T009, T010, T011, T012, T013, T014, T015, T016, T017, T018, T019, T020]
- [ ] T022 Dogfood smoke test: start server on this project, verify semantic_search works | traces: FR-001, FR-004, FR-006, FR-007
  blocked_by: [T019]

## Phase 08: Code Review -- PENDING

- [ ] T023 Constitutional review: Articles X (fail-open), XIII (ESM/CJS), XIV (state), XV (tool routing) | traces: all
  blocked_by: [T021, T022]
- [ ] T024 Provider parity: Claude+Codex+Antigravity hooks, MCP tools, finalize steps | traces: FR-004, FR-005, FR-009, FR-015
  blocked_by: [T021, T022]

## Dependency Graph

```
T009 (http-server) ──┬──> T010 (runner) ──> T011 (lifecycle) ──┬──> T016 (CLI server cmd)
                     │                                          └──> T019 (discover integration)
                     ├──> T012 (port-discovery) ──> T014 (SessionStart hook)
                     ├──> T013 (refresh-client) ──> T015 (finalize step)
                     └──> T020 (MCP tool registration)

T018 (config + migration) ──> T017 (configure subcommand)

All T009-T020 ──> T021 (quality loop) ──> T023, T024 (code review)
T019 ──> T022 (smoke test) ──> T023, T024
```

**Critical path**: T009 → T010 → T011 → T016 → T021 → T023

## Traceability Matrix

| FR | ACs | Tasks |
|----|-----|-------|
| FR-001 | AC-001-01/02/03 | T001, T009, T010 |
| FR-002 | AC-002-01/02/03 | T002, T006, T011, T016 |
| FR-003 | AC-003-01/02/03 | T003, T012, T018 |
| FR-004 | AC-004-01/02/03 | T003, T005, T012, T014 |
| FR-005 | AC-005-01/02/03 | T004, T013, T015 |
| FR-006 | AC-006-01/02/03 | T008, T019 |
| FR-007 | AC-007-01/02 | T001, T009 |
| FR-008 | AC-008-01/02/03 | T001, T004, T009, T013, T020 |
| FR-009 | AC-009-01/02/03 | T020 |
| FR-010 | AC-010-01/02/03 | T001, T009 |
| FR-011 | AC-011-01/02/03 | T010, T017, T018 |
| FR-012 | AC-012-01/02/03 | T016 |
| FR-013 | AC-013-01/02 | T006, T016 |
| FR-014 | AC-014-01/02/03 | T018 |
| FR-015 | AC-015-01/02/03 | T004, T005, T014, T015 |
| FR-016 | AC-016-01/02/03 | T002, T007, T011 |
