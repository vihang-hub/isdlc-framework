---
name: skill-installation
description: Install selected skills into project's .claude/skills/external/ directory
skill_id: DISC-403
owner: skills-researcher
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: When downloading and installing user-selected skills from the skills.sh registry
dependencies: [DISC-402]
---

# Skill Installation

## Purpose
Download selected skill definitions from the skills.sh registry and install them into the project's `.claude/skills/external/` directory. Updates the skill index and verifies each installation for integrity.

## When to Use
- After the user has selected skills from the evaluated recommendations
- When installing skills as part of the initial project discovery flow
- When adding new skills to an existing project configuration

## Prerequisites
- User has selected skills from the ranked recommendations
- The `.claude/skills/external/` directory exists or can be created
- Network access to skills.sh registry for downloading skill files

## Process

### Step 1: Prepare Installation Directory
Ensure the `.claude/skills/external/` directory exists within the project. Create subdirectories for each skill being installed, named by the skill's identifier (e.g., `.claude/skills/external/react-testing/`).

### Step 2: Download Skill Definitions
Fetch the full skill definition files from skills.sh for each selected skill. Download the SKILL.md file and any associated configuration or template files included in the skill package.

### Step 3: Write Skill Files
Write downloaded skill files to the appropriate subdirectories under `.claude/skills/external/`. Preserve the original file structure from the skill package. Set appropriate file permissions for readability.

### Step 4: Update Skill Index
Update the project's skill index to register the newly installed skills. Record each skill's name, version, source (skills.sh), installation date, and file path. Ensure the index is consistent with the files on disk.

### Step 5: Verify Installation
Read back each installed skill file to verify it was written correctly. Check that all expected files exist, file contents are non-empty, and the skill index entries match the installed files. Report any verification failures.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| selected_skills | array | Yes | List of skills chosen by user for installation |
| project_root | string | Yes | Path to the project root directory |
| skill_versions | object | No | Specific versions to install (defaults to latest) |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| installed_files | array | Paths to all installed skill files |
| installation_report | object | Success/failure status for each skill |
| skill_index | object | Updated skill index with new entries |

## Integration Points
- **skill-evaluation**: Receives the selected skills from ranked recommendations
- **web-research-fallback**: May receive generated skills for installation alongside registry skills
- **skills-researcher**: Reports installation results to orchestrating agent

## Validation
- All selected skills have corresponding files in .claude/skills/external/
- Installed skill files are non-empty and properly formatted
- Skill index entries match installed files exactly
- Installation report shows success for all selected skills
