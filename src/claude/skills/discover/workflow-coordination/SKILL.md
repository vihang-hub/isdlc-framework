---
name: workflow-coordination
description: Coordinate parallel sub-agent execution during discovery
skill_id: DISC-002
owner: discover-orchestrator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: After project detection to orchestrate sub-agent discovery tasks
dependencies: [DISC-001]
---

# Workflow Coordination

## Purpose
Manage the parallel execution of discovery sub-agents, collecting and aggregating their results into a unified discovery output. This skill ensures all sub-agents complete successfully and handles partial failures gracefully.

## When to Use
- After project detection has determined the workflow path
- When launching architecture-analyzer and test-evaluator in parallel
- When a sub-agent fails and results need to be recovered or retried

## Prerequisites
- Project detection (DISC-001) has completed with a valid flow_type
- Sub-agent definitions are available in `.claude/agents/`
- Task tool is available for parallel execution

## Process

### Step 1: Determine Sub-Agent Plan
Based on the flow_type, build the execution plan. For existing projects, launch architecture-analyzer and test-evaluator in parallel. For new projects, launch only the agents relevant to greenfield setup (tech stack selection, scaffolding).

### Step 2: Execute Parallel Task Calls
Invoke each sub-agent using the Task tool with appropriate context. Pass the project root, flow_type, and any previously gathered state. Monitor execution and capture results from each agent independently.

### Step 3: Collect and Aggregate Results
Gather results from all sub-agents. Merge architecture findings, test evaluation data, and any other discovery outputs into a single aggregated result object. Handle partial failures by including available results and flagging missing sections.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| flow_type | enum | Yes | Result from project detection (new_project or existing_project) |
| project_context | object | Yes | Project root path and current state |
| agent_definitions | list | No | Override list of sub-agents to execute |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| aggregated_results | object | Combined results from all sub-agents |
| agent_statuses | list | Success/failure status for each sub-agent |
| partial_failures | list | Any agents that failed with error details |

## Integration Points
- **architecture-analyzer**: Launched as parallel Task for codebase analysis
- **test-evaluator**: Launched as parallel Task for test infrastructure analysis
- **state-initialization**: Receives aggregated results for state.json update
- **project-detection**: Depends on flow_type output

## Validation
- All planned sub-agents were invoked
- Aggregated results contain sections from each successful sub-agent
- Partial failures are documented with actionable error messages
- Total execution completes within reasonable time bounds
