---
name: cloud-configuration
description: Configure cloud provider settings during discovery
skill_id: DISC-004
owner: discover-orchestrator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: During discovery when cloud infrastructure preferences need to be established
dependencies: [DISC-001]
---

# Cloud Configuration

## Purpose
Gather and configure cloud provider preferences from the user during the discovery phase. This ensures downstream phases like architecture design and deployment planning have the correct cloud context.

## When to Use
- During discovery when no cloud provider is configured in state.json
- When existing cloud configuration files are detected and need cataloging
- When the user wants to change or establish cloud infrastructure preferences

## Prerequisites
- Project detection (DISC-001) has completed
- User is available for interactive input
- `.isdlc/state.json` is writable

## Process

### Step 1: Detect Existing Cloud Configuration
Search for existing cloud provider indicators: AWS (`.aws/`, `serverless.yml`, `sam-template.yaml`), GCP (`app.yaml`, `.gcloudignore`), Azure (`azure-pipelines.yml`, `host.json`), or multi-cloud setups. Check environment variables and config files for provider SDKs.

### Step 2: Collect User Preferences
If no existing configuration is found, present the user with cloud provider options. Ask for primary provider, region preferences, and target services (compute, storage, database). For existing projects, confirm detected provider and ask about any planned migrations.

### Step 3: Validate and Persist Configuration
Validate that the selected provider and region are consistent. Check for any required credentials or CLI tools. Write the cloud configuration block to state.json including provider, region, target services, and any detected infrastructure-as-code paths.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| user_preferences | object | No | Pre-supplied cloud preferences to skip interactive prompts |
| project_root | string | Yes | Project root to scan for cloud config files |
| current_state | object | Yes | Current state.json contents |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| cloud_config | object | Provider, region, services, and IaC details |
| detected_files | list | Cloud configuration files found in the project |
| state_update | object | Cloud config block ready to merge into state.json |

## Integration Points
- **state-initialization**: Cloud config is merged into state.json
- **deployment-topology-detection**: Shares detected infrastructure files
- **architecture-analyzer**: Cloud provider influences architecture recommendations

## Validation
- Cloud provider is a recognized value (aws, gcp, azure, other)
- Region is valid for the selected provider
- Detected cloud files are confirmed as accessible
- Configuration is persisted in state.json cloud_config block
