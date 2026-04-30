# Task Plan: REQ-GH-258

## Progress Summary

| Phase | Total | Done | Remaining |
|-------|-------|------|-----------|
| 05-test-strategy | 1 | 1 | 0 |
| 06-implementation | 7 | 0 | 7 |
| 16-quality-loop | 1 | 0 | 1 |
| 08-code-review | 1 | 0 | 1 |
| **Total** | **10** | **0** | **10** |

## Phase 05: Test Strategy -- COMPLETE

- [X] T001 Design test strategy for expanded server API and dashboard HTML | traces: FR-006, FR-010, NFR-003

## Phase 06: Implementation -- PENDING

- [ ] T002 Add getAgentSkills() to server — read skills manifest + external-skills-manifest.json, return combined built-in and external skill lists in /api/state response | traces: FR-004, FR-006
  files: src/dashboard/server.js (MODIFY)
- [ ] T003 Add scanHookLog() to server — tail last 50 lines of .isdlc/hook-activity.log, filter by current phase, return hook events in /api/state response | traces: FR-005, FR-006
  files: src/dashboard/server.js (MODIFY)
- [ ] T004 Add readActiveMeta() to server — resolve active analysis slug from analysis-index.json, read that slug's meta.json, return as active_meta in /api/state response | traces: FR-002, FR-006
  files: src/dashboard/server.js (MODIFY)
- [ ] T005 Add scanPersonas() to server — glob persona-*.md files at startup, regex-extract role_type from frontmatter, cache results, serve persona list in /api/state response | traces: FR-010, FR-006
  files: src/dashboard/server.js (MODIFY)
- [ ] T006 Update server HTML path resolution — serve .isdlc/dashboard.html as primary, fall back to src/dashboard/index.html if missing | traces: FR-008
  files: src/dashboard/server.js (MODIFY)
  blocked_by: [T002, T003, T004, T005]
- [ ] T007 Create dashboard HTML — two-panel layout (Analysis left, Build right) with personas (core/contributing/promoted nodes), confirmation progress bar, phase dots, phase DAG, active agent badge, task progress bar, skills section (built-in grey + external purple), hooks bar (color-coded dots with tooltips), adaptive poll interval (2s/10s), all CSS/animations from docs/index.html dark theme, no Play/Next controls | traces: FR-001, FR-002, FR-003, FR-004, FR-005, FR-007, NFR-001, NFR-002, NFR-003
  files: src/dashboard/dashboard.html (CREATE)
  blocked_by: [T006]
- [ ] T008 Add dashboard.html copy step to init-project.sh installer script — copies src/dashboard/dashboard.html to .isdlc/dashboard.html during framework installation | traces: FR-008
  files: init-project.sh (MODIFY)
  blocked_by: [T007]

## Phase 16: Quality Loop -- PENDING

- [ ] T009 Write tests for expanded server API — verify active_meta, hook_events, agent_skills, personas fields in /api/state response, test fail-open on missing files, test persona caching, test hook log filtering | traces: FR-006, FR-010, NFR-003
  files: tests/core/dashboard/server.test.js (MODIFY)
  blocked_by: [T002, T003, T004, T005]

## Phase 08: Code Review -- PENDING

- [ ] T010 Code review all changes for REQ-GH-258 — server API expansion, dashboard HTML, installer update, test coverage | traces: FR-001 through FR-010, NFR-001 through NFR-003
  blocked_by: [T009]

## Dependency Graph

```
T002 ──┐
T003 ──┼── T006 ── T007 ── T008
T004 ──┤
T005 ──┘
T002 + T003 + T004 + T005 ── T009 ── T010
```

Critical path: T002-T005 (parallel) → T006 → T007 → T008 → T009 → T010
