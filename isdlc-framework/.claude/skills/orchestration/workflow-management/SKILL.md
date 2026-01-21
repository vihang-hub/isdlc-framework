---
name: workflow-management
description: Manage SDLC workflow phases, transitions, and agent coordination
skill_id: ORCH-001
owner: sdlc-orchestrator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Starting new features, phase transitions, daily standups, blocking issues
dependencies: []
---

# Workflow Management

## Purpose
Coordinate the complete SDLC workflow across all 10 agents for SDLC Framework, managing phase transitions, enforcing gate validations, and ensuring smooth project progression from requirements to production.

## When to Use
- Starting a new feature or project
- Transitioning between SDLC phases
- Daily standup coordination
- When agents report completion or blocking issues
- Gate validation checkpoints
- Escalation decisions

## Prerequisites
- Project initialized with CLAUDE.md
- .sdlc/workflow-state.json exists
- All agent definitions loaded
- 12 Factors configuration available

## Process

### Step 1: Initialize Workflow State
```
1. Check if .sdlc/workflow-state.json exists
2. If new project, create initial state:
   {
     "project": "sdlc-framework",
     "current_phase": "requirements",
     "phases_completed": [],
     "gates_passed": [],
     "active_tasks": [],
     "blockers": []
   }
3. Load 12 Factors enforcement rules
4. Initialize agent communication channels
```

### Step 2: Determine Current Phase
```
1. Read workflow-state.json
2. Identify current phase from:
   - requirements → architecture → design → test_design
   - implementation → testing → validation → deployment → operations
3. List pending gate requirements
4. Identify assigned agents for current phase
```

### Step 3: Coordinate Agent Activities
```
1. For current phase, activate relevant agents:
   - Requirements: requirements-agent
   - Architecture: architecture-agent, security-agent
   - Design: design-agent
   - Test Design: test-manager-agent
   - Implementation: developer-agent, test-manager-agent
   - Testing: test-manager-agent, security-agent
   - Deployment: devops-agent
   - Operations: operations-agent
2. Distribute tasks based on agent capabilities
3. Monitor progress and collect outputs
```

### Step 4: Validate Phase Gate
```
1. Collect all artifacts from current phase
2. Run gate checklist validation
3. Check all required approvals
4. Document validation results
5. If passed: transition to next phase
6. If failed: report blockers, assign remediation
```

### Step 5: Handle Phase Transition
```
1. Update workflow-state.json:
   - Move current phase to phases_completed
   - Add gate to gates_passed
   - Set new current_phase
2. Notify all agents of transition
3. Archive phase artifacts
4. Initialize next phase requirements
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| workflow-state.json | JSON | Yes | Current workflow state |
| project_brief | String | For new projects | Feature/project description |
| gate_id | String | For validation | Gate to validate (GATE-1 to GATE-8) |
| agent_report | JSON | For updates | Status report from agent |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| workflow-state.json | JSON | Updated workflow state |
| phase_report.md | Markdown | Summary of phase completion |
| gate_validation.json | JSON | Gate validation results |
| agent_assignments.json | JSON | Current task assignments |

## Project-Specific Considerations
- User journey stages (discovery→application→preparation→abroad→return) map to feature groupings
- External API integrations require architecture review gate
- GDPR compliance checkpoint at design gate
- OAuth2/SSO implementation requires security sign-off

## Integration Points
- **Spec Kit**: /speckit.specify, /speckit.plan, /speckit.implement commands
- **BMAD**: Orchestrator and Scrum Master agent coordination
- **Ralph Wiggum**: /ralph-loop for autonomous task iteration until completion
- **Superpowers**: /superpowers:execute-plan for implementation
- **12 Factors**: Enforcement rules checked at each gate

## Examples
```
# Start new feature
/orchestrate start "Implement university search with filtering"

# Check status
/orchestrate status
> Current Phase: design
> Gate 2 (Architecture): PASSED
> Gate 3 (Design): 3/5 items complete
> Blockers: None
> Active Agents: design-agent

# Validate gate
/orchestrate validate GATE-3
> Checking Design Gate...
> ✓ OpenAPI spec complete
> ✓ Module designs documented
> ✗ Wireframes pending approval
> ✗ Error taxonomy incomplete
> Gate GATE-3: NOT PASSED (2 items remaining)
```

## Validation
- All phase artifacts exist in expected locations
- Gate checklist 100% complete
- No unresolved blockers
- Agent acknowledgment of phase transition
- Audit log updated with transition record