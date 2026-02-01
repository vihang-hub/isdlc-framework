---
name: project-detection
description: Detect whether project is new or existing based on codebase indicators
skill_id: DISC-001
owner: discover-orchestrator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: At the start of discovery to determine which workflow path to follow
dependencies: []
---

# Project Detection

## Purpose
Determine whether the current project is a new (greenfield) project or an existing codebase by examining state configuration and filesystem indicators. This decision drives the entire discovery workflow path.

## When to Use
- At the very beginning of the `/discover` command execution
- When state.json needs validation against actual project contents
- When re-running discovery after project structure changes

## Prerequisites
- The iSDLC framework has been installed via `install.sh`
- `.isdlc/state.json` exists in the project root
- Read access to the project root directory

## Process

### Step 1: Read State Configuration
Read `.isdlc/state.json` and extract the `is_new_project` flag set during installation. This flag provides the initial determination made by the install script.

### Step 2: Verify Against Filesystem
Cross-check the flag against actual filesystem indicators. Look for `package.json`, `requirements.txt`, `go.mod`, `Cargo.toml`, `src/` directory, `app/` directory, `.git` history with prior commits, and other codebase markers that confirm or contradict the flag.

### Step 3: Determine Flow Path
If the flag and filesystem agree, set the flow type. If they conflict (e.g., flag says new but source files exist), prefer the filesystem evidence and log a warning. Return the final determination as `new_project` or `existing_project`.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| state_json_path | string | Yes | Path to `.isdlc/state.json` |
| project_root | string | Yes | Absolute path to the project root directory |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| flow_type | enum | Either `new_project` or `existing_project` |
| confidence | string | High/medium/low based on indicator agreement |
| indicators | object | Filesystem markers found during verification |

## Integration Points
- **discover-orchestrator**: Receives flow_type to decide which sub-agents to launch
- **workflow-coordination**: Uses flow_type to determine parallel execution plan
- **state-initialization**: Updates state.json if flow_type differs from original flag

## Validation
- flow_type is always one of the two valid enum values
- Filesystem verification ran and found at least one indicator
- Conflicts between flag and filesystem are logged with reasoning
