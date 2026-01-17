---
name: priority-management
description: Determine task urgency and optimal sequencing
skill_id: ORCH-006
owner: orchestrator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Sprint planning, resource allocation, urgent requests, scope changes
dependencies: [ORCH-002]
---

# Priority Management

## Purpose
Determine the optimal sequence and priority of tasks based on dependencies, business value, risk, and resource availability to maximize project progress and value delivery.

## When to Use
- Sprint planning
- New urgent request arrives
- Resource constraints change
- Scope changes
- Blocker impacts schedule
- Stakeholder priority changes

## Prerequisites
- Task breakdown available
- Dependencies mapped
- Business value understood
- Resource availability known

## Process

### Step 1: Assess Task Attributes
```
For each task, evaluate:
- Business value (High/Medium/Low)
- Urgency (Critical/High/Normal/Low)
- Dependencies (blocking others?)
- Risk (technical uncertainty)
- Effort (S/M/L/XL)
- Required skills (which agent)
```

### Step 2: Apply Prioritization Matrix
```
Priority Score = (Value × 3) + (Urgency × 2) + (Blocking × 2) - (Risk × 1)

Where:
- Value: High=3, Medium=2, Low=1
- Urgency: Critical=4, High=3, Normal=2, Low=1
- Blocking: Blocks 3+=3, Blocks 1-2=2, Blocks 0=1
- Risk: High=3, Medium=2, Low=1
```

### Step 3: Consider Dependencies
```
Dependency rules:
1. Blocked tasks cannot be prioritized until blocker resolves
2. Tasks blocking many others get priority boost
3. External dependencies flagged for early start
4. Critical path tasks get highest attention
```

### Step 4: Balance Agent Workload
```
Distribution rules:
1. No agent > 3 concurrent tasks
2. Mix task sizes (not all XL)
3. Consider skill match
4. Allow slack for interrupts
```

### Step 5: Create Priority Queue
```
Output priority-sorted task list:
1. P0 - Critical: Do immediately
2. P1 - High: Do this sprint
3. P2 - Normal: Do when P0/P1 clear
4. P3 - Low: Backlog
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| task_breakdown.json | JSON | Yes | All tasks |
| dependency_graph.json | JSON | Yes | Task dependencies |
| agent_availability | JSON | Yes | Agent capacity |
| business_priorities | JSON | Optional | Stakeholder input |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| priority_queue.json | JSON | Sorted task list |
| sprint_backlog.md | Markdown | Sprint plan |
| agent_assignments.json | JSON | Task distribution |

## Project-Specific Considerations
- Authentication tasks are P0 (blocks most features)
- GDPR compliance tasks are high priority (legal risk)
- User journey: Application flow > Discovery flow (core value)
- External API tasks: start early (dependency risk)

## Integration Points
- **BMAD Scrum Master**: Sprint planning coordination
- **Ralph Wiggum**: /ralph-loop for autonomous task execution
- **All Agents**: Receive prioritized task assignments
- **Test Manager**: Test priority aligned with implementation

## Examples
```
Priority Queue - Sprint 3

P0 - Critical (Do Now):
├─ TASK-004-01: OAuth2 implementation [Blocks: 12 tasks]
└─ TASK-010-03: Fix login security vulnerability

P1 - High (This Sprint):
├─ TASK-005-01: User profile API [Blocks: 4 tasks]
├─ TASK-005-03: Profile database migration
├─ TASK-006-01: University search API
└─ TASK-012-01: GDPR consent mechanism

P2 - Normal (If Capacity):
├─ TASK-007-02: Email notification service
├─ TASK-008-01: Application status dashboard
└─ TASK-009-01: Document upload feature

P3 - Backlog:
├─ TASK-015-01: Dark mode UI
└─ TASK-016-01: Analytics integration
```

## Validation
- All tasks have priority assigned
- No circular priority dependencies
- Critical path tasks are P0/P1
- Agent workload balanced
- Sprint capacity not exceeded