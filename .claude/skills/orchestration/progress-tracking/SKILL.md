---
name: progress-tracking
description: Monitor task completion, blockers, and overall project health
skill_id: ORCH-003
owner: orchestrator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Daily standups, status checks, reporting, identifying delays
dependencies: [ORCH-001, ORCH-002]
---

# Progress Tracking

## Purpose
Monitor the completion status of all tasks across agents, identify blockers early, track project velocity, and provide visibility into overall project health.

## When to Use
- Daily standup coordination
- Status check requests
- Sprint reviews
- When delays are suspected
- Stakeholder reporting
- Resource reallocation decisions

## Prerequisites
- Task breakdown exists (task_breakdown.json)
- Agents actively working on tasks
- Workflow state initialized

## Process

### Step 1: Collect Agent Status
```
Poll each active agent for:
1. Tasks in progress
2. Tasks completed since last check
3. Blockers encountered
4. Estimated completion for current task
5. Questions/clarifications needed
```

### Step 2: Update Task Status
```
For each task, track:
- Status: not_started | in_progress | blocked | review | complete
- Progress percentage (0-100)
- Time spent vs estimate
- Blocker details (if any)
- Output artifacts produced
```

### Step 3: Calculate Metrics
```
Project metrics:
- Tasks complete / total tasks
- Story points complete / total points
- Blockers count (active)
- Average task completion time
- Velocity (tasks/day)
- Phase progress percentage
```

### Step 4: Identify Issues
```
Flag issues when:
- Task exceeds 150% of estimate
- Blocker unresolved > 24 hours
- Dependencies not met for scheduled task
- Agent idle with pending tasks
- Critical path task delayed
```

### Step 5: Generate Status Report
```
Daily status report includes:
- Overall progress summary
- Completed since last report
- In progress with ETA
- Blockers requiring attention
- Upcoming milestones
- Risk indicators
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| task_breakdown.json | JSON | Yes | Task list with assignments |
| agent_status_reports | JSON | Yes | Status from each agent |
| previous_report | JSON | Optional | Last status for comparison |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| progress_report.md | Markdown | Human-readable status |
| metrics.json | JSON | Quantitative metrics |
| blockers.json | JSON | Active blockers list |
| burndown_data.json | JSON | Data for burndown chart |

## Project-Specific Considerations
- Track progress against user journey coverage
- Monitor external API integration status separately
- Flag GDPR-related tasks if delayed (compliance risk)
- Track OAuth2 implementation as critical path

## Integration Points
- **All Agents**: Submit status reports
- **BMAD Scrum Master**: Sprint tracking integration
- **Ralph Wiggum**: Autonomous progress checks via /ralph-loop
- **Documentation Agent**: Archive progress reports

## Examples
```
# Daily Status Report - SDLC Framework
Date: 2024-01-15

## Summary
Phase: Implementation
Progress: 45% complete (27/60 tasks)
Velocity: 4.2 tasks/day
On Track: ⚠️ Minor delays

## Completed Today
- TASK-003-02: User registration API ✓
- TASK-003-04: Registration unit tests ✓
- TASK-007-01: Database migration script ✓

## In Progress
- TASK-003-05: Registration UI (75%, ETA: tomorrow)
- TASK-004-01: OAuth2 integration (30%, ETA: 2 days)

## Blockers
🔴 TASK-005-03: Waiting for university API credentials
   Owner: developer-agent
   Blocked: 2 days
   Action: Escalate to human

## Upcoming Milestones
- Gate 5 (Implementation): Jan 20
- User Auth Complete: Jan 18
```

## Validation
- All active tasks have recent status update
- No tasks stuck in same status > 3 days without note
- Blockers have assigned owners
- Metrics calculate correctly
- Report generated successfully