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
Download selected skill definitions from the skills.sh registry and install them into the project's external skills directory. Updates the skill index, registers skills in the external manifest, and verifies each installation for integrity.

**Target directory (monorepo-aware):**
- Single-project: `.claude/skills/external/`
- Monorepo: `.isdlc/projects/{project-id}/skills/external/`

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
Determine the target directory based on monorepo mode:
- If `.isdlc/monorepo.json` exists: use `.isdlc/projects/{project-id}/skills/external/`
- Otherwise: use `.claude/skills/external/`

Ensure the directory exists within the project. Create subdirectories for each skill being installed, named by the skill's identifier (e.g., `{external_skills_path}/react-testing/`).

### Step 2: Download Skill Definitions
Fetch the full skill definition files from skills.sh for each selected skill. Download the SKILL.md file and any associated configuration or template files included in the skill package.

### Step 3: Write Skill Files
Write downloaded skill files to the appropriate subdirectories under the external skills directory. Preserve the original file structure from the skill package. Set appropriate file permissions for readability.

### Step 4: Update Skill Index
Update the project's skill index to register the newly installed skills. Record each skill's name, version, source (skills.sh), installation date, and file path. Ensure the index is consistent with the files on disk.

### Step 5: Register in External Manifest
After installation, register each skill in the external skills manifest:
- Single-project: `.isdlc/external-skills-manifest.json`
- Monorepo: `.isdlc/projects/{project-id}/external-skills-manifest.json`

For each skill, record: name, source (`"skills.sh"`), version, path, `available_to: "all"`, and installation timestamp. Create the manifest if it doesn't exist; merge into existing if it does.

### Step 6: Verify Installation
Read back each installed skill file to verify it was written correctly. Check that all expected files exist, file contents are non-empty, the skill index entries match the installed files, and the external manifest entries are consistent. Report any verification failures.

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
- All selected skills have corresponding files in the external skills directory
- Installed skill files are non-empty and properly formatted
- Skill index entries match installed files exactly
- External manifest entries are present for all installed skills
- Installation report shows success for all selected skills
