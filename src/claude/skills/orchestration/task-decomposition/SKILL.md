---
name: task-decomposition
description: Break down requirements into agent-assignable tasks
skill_id: ORCH-002
owner: sdlc-orchestrator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: After requirements approved, sprint planning, feature breakdown
dependencies: [ORCH-001]
---

# Task Decomposition

## Purpose
Transform high-level requirements and user stories into discrete, actionable tasks that can be assigned to specific agents, with clear dependencies, acceptance criteria, and effort estimates.

## When to Use
- After requirements phase completes (GATE-1 passed)
- Sprint planning sessions
- When new features are added mid-cycle
- Breaking down complex user stories
- Creating implementation roadmaps

## Prerequisites
- Approved requirements specification
- User stories with acceptance criteria
- Architecture decisions finalized
- Agent capabilities understood

## Process

### Step 1: Analyze Requirements
```
1. Load requirements_spec.md
2. Identify all user stories
3. Extract acceptance criteria for each
4. Note NFR constraints (performance, security)
5. Map to user journey stages
```

### Step 2: Identify Task Categories
```
For each requirement, identify needed tasks:
- ARCH: Architecture/design tasks
- API: Backend API implementation
- UI: Frontend/UI implementation
- DB: Database schema/migration
- TEST: Test creation tasks
- SEC: Security implementation
- DOC: Documentation tasks
- OPS: DevOps/deployment tasks
```

### Step 3: Create Task Breakdown
```
For each user story:
1. Create parent task (TASK-XXX)
2. Break into subtasks:
   - Design subtask → design-agent
   - API subtask → developer-agent (backend)
   - UI subtask → developer-agent (frontend)
   - Test subtask → test-manager-agent
   - Doc subtask → documentation-agent
3. Estimate effort (S/M/L/XL)
4. Identify dependencies between tasks
```

### Step 4: Assign to Agents
```
Task assignment rules:
- Architecture tasks → architecture-agent
- API design → design-agent
- API implementation → developer-agent
- UI implementation → developer-agent
- Test design → test-manager-agent
- Test implementation → developer-agent + test-manager-agent
- Security review → security-agent
- Documentation → documentation-agent
- Deployment → devops-agent
```

### Step 5: Create Dependency Graph
```
1. Map task dependencies (blocks/blocked-by)
2. Identify critical path
3. Flag parallelizable tasks
4. Note external dependencies (APIs, approvals)
5. Generate dependency_graph.json
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| requirements_spec.md | Markdown | Yes | Approved requirements |
| user_stories.json | JSON | Yes | User stories with acceptance criteria |
| architecture.md | Markdown | Yes | Architecture decisions |
| team_capacity | JSON | Optional | Available agent capacity |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| task_breakdown.json | JSON | Complete task list with assignments |
| dependency_graph.json | JSON | Task dependencies |
| sprint_plan.md | Markdown | Organized sprint backlog |
| effort_estimate.md | Markdown | Time/effort estimates |

## Project-Specific Considerations
- Group tasks by user journey stage for logical sprints
- External API integration tasks need architecture review first
- GDPR-related tasks (consent, data deletion) are high priority
- OAuth2 tasks should be early in implementation (other features depend on auth)

## Integration Points
- **Spec Kit**: /speckit.tasks command generates initial breakdown
- **BMAD**: Scrum Master agent assists with sprint planning
- **Ralph Wiggum**: Use /ralph-loop for iterative task refinement
- **Requirements Agent**: Provides user stories as input
- **All Agents**: Receive task assignments

## Examples
```
# User Story: REQ-005 - User Profile Management
# Decomposed into:

TASK-005-01: Design user profile API endpoints
  Agent: design-agent
  Effort: M
  Output: openapi_spec.yaml (profile section)
  
TASK-005-02: Design profile database schema
  Agent: architecture-agent
  Effort: S
  Depends: TASK-005-01
  Output: profile_schema.sql
  
TASK-005-03: Implement profile API
  Agent: developer-agent
  Effort: L
  Depends: TASK-005-01, TASK-005-02
  Output: src/backend/user/profile.ts
  
TASK-005-04: Write profile API tests
  Agent: test-manager-agent
  Effort: M
  Depends: TASK-005-01
  Output: tests/api/profile.test.ts
  
TASK-005-05: Implement profile UI
  Agent: developer-agent
  Effort: L
  Depends: TASK-005-03
  Output: src/frontend/components/Profile/
```

## Validation
- Every requirement has at least one task
- Every task has exactly one assigned agent
- No circular dependencies in graph
- All dependencies reference valid tasks
- Effort estimates provided for all tasks
- Critical path identified