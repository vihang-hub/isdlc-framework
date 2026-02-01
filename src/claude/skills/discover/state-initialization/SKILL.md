---
name: state-initialization
description: Initialize and update state.json with discovery results
skill_id: DISC-003
owner: discover-orchestrator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: After all discovery sub-agents complete to persist findings
dependencies: [DISC-001, DISC-002]
---

# State Initialization

## Purpose
Persist discovery findings into `.isdlc/state.json` so that subsequent SDLC phases can reference the discovered project context. This skill merges new findings with existing state without overwriting user-configured values.

## When to Use
- After workflow coordination has aggregated all sub-agent results
- When discovery results need to be persisted for downstream phases
- When re-running discovery to update stale project state

## Prerequisites
- Workflow coordination (DISC-002) has completed with aggregated results
- `.isdlc/state.json` exists and is readable/writable
- Discovery results include tech_stack, architecture, and test evaluation data

## Process

### Step 1: Read Current State
Load the existing `.isdlc/state.json` file. Preserve user-configured fields such as `project_name`, `constitution`, and any manual overrides. Create a backup of current state before modification.

### Step 2: Merge Discovery Findings
Update the `tech_stack` field with detected languages, frameworks, and runtimes. Set `discovery_completed` to `true`. Record `discovered_at` with the current ISO 8601 timestamp. Merge architecture patterns, deployment topology, and test coverage data into their respective state fields.

### Step 3: Write Updated State
Validate the merged state object against the expected schema. Write the updated state back to `.isdlc/state.json` with proper JSON formatting. Log a summary of fields that were added or changed.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| discovery_results | object | Yes | Aggregated results from workflow coordination |
| state_json_path | string | Yes | Path to `.isdlc/state.json` |
| preserve_fields | list | No | Fields to never overwrite during merge |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| updated_state | object | The complete updated state.json contents |
| changes_summary | list | Fields that were added or modified |
| backup_path | string | Path to the pre-update state backup |

## Integration Points
- **workflow-coordination**: Provides the aggregated discovery results to persist
- **discover-orchestrator**: Triggers state write as the final discovery step
- **sdlc command**: Reads persisted state to determine current phase and context

## Validation
- state.json is valid JSON after write
- discovery_completed is set to true
- discovered_at contains a valid ISO 8601 timestamp
- tech_stack contains at least one detected language or framework
- No user-configured fields were accidentally overwritten
