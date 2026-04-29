# Task Plan: BUG-GH-277

## Progress Summary

| Phase | Total | Done | Remaining |
|-------|-------|------|-----------|
| 05-test-strategy | 1 | 1 | 0 |
| 06-implementation | 6 | 6 | 0 |
| 16-quality-loop | 1 | 0 | 1 |
| 08-code-review | 1 | 0 | 1 |
| **Total** | **9** | **7** | **2** |

## Phase 05: Test Strategy -- COMPLETE

- [X] T001 Design test strategy for analysis-index module and dashboard API changes | traces: FR-007, FR-008

## Phase 06: Implementation -- COMPLETE

- [X] T002 Create src/core/backlog/analysis-index.js with updateAnalysisIndex(), rebuildAnalysisIndex(), readAnalysisIndex() | traces: FR-001
  files: src/core/backlog/analysis-index.js (CREATE)
- [X] T003 Wire updateAnalysisIndex() into writeMetaJson() in item-state.js | traces: FR-002
  files: src/core/backlog/item-state.js (MODIFY)
  blocked_by: [T002]
- [X] T004 Add re-exports to src/core/backlog/index.js | traces: FR-003
  files: src/core/backlog/index.js (MODIFY)
  blocked_by: [T002]
- [X] T005 Add analysis data to dashboard server API response | traces: FR-004
  files: src/dashboard/server.js (MODIFY)
  blocked_by: [T002]
- [X] T006 Implement analysis UI view with radio toggle in dashboard | traces: FR-005
  files: src/dashboard/index.html (MODIFY)
  blocked_by: [T005]
- [X] T007 Add .isdlc/analysis-index.json to .gitignore | traces: FR-006
  files: .gitignore (MODIFY)

## Phase 16: Quality Loop -- PENDING

- [ ] T008 Write unit tests for analysis-index module and dashboard API | traces: FR-007, FR-008
  files: tests/core/backlog/analysis-index.test.js (CREATE), tests/core/dashboard/server.test.js (MODIFY)
  blocked_by: [T002, T005]

## Phase 08: Code Review -- PENDING

- [ ] T009 Code review all changes for BUG-GH-277 | traces: FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008
  blocked_by: [T008]

## Dependency Graph

```
T002 ──┬── T003
       ├── T004
       └── T005 ── T006
T007 (independent)
T002 + T005 ── T008 ── T009
```

Critical path: T002 → T005 → T006 → T008 → T009
