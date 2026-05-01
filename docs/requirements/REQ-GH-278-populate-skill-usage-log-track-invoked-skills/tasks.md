# Task Plan: REQ-GH-278

## Progress Summary

| Phase | Total | Done | Remaining |
|-------|-------|------|-----------|
| 05-test-strategy | 1 | 1 | 0 |
| 06-implementation | 9 | 0 | 9 |
| 16-quality-loop | 1 | 0 | 1 |
| 08-code-review | 1 | 0 | 1 |
| **Total** | **12** | **1** | **11** |

## Phase 05: Test Strategy -- COMPLETE

- [X] T001 Design test strategy for post-skill-dispatcher, inference logic, analysis index updates, auto-launch, and dashboard skill states | traces: FR-001 through FR-007, NFR-001 through NFR-003

## Phase 06: Implementation -- PENDING

- [ ] T002 Create post-skill-dispatcher.cjs — read Skill tool input, extract skill name from tool_input.skill, append { skill_name, agent, phase, timestamp, source: "tool_call" } to skill_usage_log in state.json, write state. Follow post-task-dispatcher.cjs pattern. ~60 lines. | traces: FR-001, NFR-001
  files: src/claude/hooks/dispatchers/post-skill-dispatcher.cjs (CREATE)
- [ ] T003 Wire PostToolUse[Skill] in settings.json — add matcher "Skill" with hook command pointing to post-skill-dispatcher.cjs, timeout 5000ms | traces: FR-001
  files: .claude/settings.json (MODIFY)
  blocked_by: [T002]
- [ ] T004 Add skill usage signal instruction to SKILL INJECTION STEP C in isdlc.md — append one line after skill block assembly: "When you apply guidance from a skill listed above, call Skill('skill-name') to signal usage." | traces: FR-002
  files: src/claude/commands/isdlc.md (MODIFY)
- [ ] T005 Add inference logic to phase-loop STEP 3f in isdlc.md — after agent returns, call getAgentSkillIndex for active agent, scan output for skill name matches (case-insensitive, >4 chars), deduplicate against existing tool_call entries, append inferred entries to skill_usage_log | traces: FR-003
  files: src/claude/commands/isdlc.md (MODIFY)
- [ ] T006 Call updateAnalysisIndex after writeMetaJson in add handler — ensure new items appear in dashboard immediately. Also wire in analyze auto-add path. | traces: FR-004
  files: src/claude/commands/isdlc.md (MODIFY), src/core/backlog/item-state.js (MODIFY)
- [ ] T007 Add roundtable heartbeat — call updateAnalysisIndex at each user exchange resume point in step 7b to refresh last_activity_at per turn | traces: FR-005
  files: src/claude/commands/isdlc.md (MODIFY)
- [ ] T008 Add skill_usage_log to /api/state response in server.js — read from state.json, include in buildStateResponse | traces: FR-006
  files: src/dashboard/server.js (MODIFY)
- [ ] T009 Update dashboard.html skills section — cross-reference skill_usage_log against agent_skills, render confirmed (green solid), likely (green dashed), loaded (grey) with tooltips | traces: FR-006
  files: src/dashboard/dashboard.html (MODIFY)
  blocked_by: [T008]
- [ ] T010 Add dashboard auto-launch probe to analyze and build entry points in isdlc.md — HTTP probe localhost:3456, spawn server if down, detached + unref, fail-open | traces: FR-007, NFR-003
  files: src/claude/commands/isdlc.md (MODIFY)

## Phase 16: Quality Loop -- PENDING

- [ ] T011 Write tests — post-skill-dispatcher tests (skill name extraction, missing input, state write, fail-open) and dashboard server tests (skill_usage_log in API response) | traces: FR-001, FR-006, NFR-001
  files: tests/core/hooks/post-skill-dispatcher.test.cjs (CREATE), tests/core/dashboard/server.test.js (MODIFY)
  blocked_by: [T002, T008]

## Phase 08: Code Review -- PENDING

- [ ] T012 Code review all changes for REQ-GH-278 | traces: FR-001 through FR-007, NFR-001 through NFR-003
  blocked_by: [T011]

## Dependency Graph

```
T002 ── T003
T002 + T008 ── T011 ── T012
T008 ── T009
T004, T005, T006, T007, T010 (independent)
```

Critical path: T002 → T003 → T008 → T009 → T011 → T012
