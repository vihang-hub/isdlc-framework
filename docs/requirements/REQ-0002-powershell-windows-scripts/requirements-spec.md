# Requirements Specification: PowerShell Scripts for Windows

**ID**: REQ-0002-powershell-windows-scripts
**Type**: Feature
**Created**: 2026-02-08
**Status**: Approved
**Priority**: Must Have
**Constitution**: Articles I, IV, V, VII, IX, XII applicable

---

## 1. Project Overview

### Problem Statement

Windows users who clone the iSDLC framework have no native way to run the installation scripts. The existing `install.sh` (1403 lines), `uninstall.sh` (867 lines), and `update.sh` (609 lines) are bash-only. While a cross-platform Node.js CLI (`npx isdlc init`) is planned, it is not yet published to npm. PowerShell scripts serve as the interim Windows pathway.

### Business Drivers

- Constitution Article XII (Cross-Platform Compatibility) mandates macOS, Linux, AND Windows support
- npm/npx publishing is not yet ready (blocked on npm registry setup)
- Windows developers are currently blocked from using the framework via the git-clone workflow

### Success Criteria

1. Windows users can `git clone` + run `install.ps1` to install the framework
2. All three scripts achieve functional parity with their bash equivalents
3. No regressions on macOS/Linux bash scripts
4. Scripts work on PowerShell 5.1+ (Windows PowerShell) and PowerShell 7+ (pwsh)

### Scope

- **In Scope**: install.ps1, uninstall.ps1, update.ps1 with full functional parity
- **Out of Scope**: MSI/EXE installer, Windows service registration, PowerShell Gallery publishing, modifications to Node.js CLI path

---

## 2. Stakeholders and Personas

### Persona 1: Windows Developer

- **Role**: Developer using Windows as primary OS
- **Goals**: Install and use iSDLC framework without bash/WSL
- **Pain Points**: Cannot run install.sh natively; WSL adds friction
- **Technical Proficiency**: Intermediate (familiar with PowerShell basics)
- **Key Tasks**: Fresh install, update to new version, clean uninstall

### Persona 2: CI/CD Pipeline (Windows Runner)

- **Role**: Automated build system (GitHub Actions windows-latest)
- **Goals**: Unattended framework installation in CI
- **Pain Points**: Interactive prompts block automation
- **Technical Proficiency**: N/A (script-driven)
- **Key Tasks**: Non-interactive install with `-Force`

---

## 3. Functional Requirements

### REQ-001: PowerShell Installation Script (install.ps1)

**Priority**: Must Have
**Description**: Create `install.ps1` with functional parity to `install.sh` (1403 lines).

**Features**:
1. Remove framework development files (.git, .gitignore, CHANGELOG.md, .DS_Store)
2. Display installation banner with colored output (Write-Host -ForegroundColor)
3. Confirmation prompt (skippable with `-Force`)
4. Detect project name from directory
5. Detect existing project (package.json, requirements.txt, src/, etc.)
6. Detect monorepo (pnpm-workspace.yaml, lerna.json, turbo.json, nx.json, rush.json, directory structure)
7. Prompt user to confirm/reject monorepo detection
8. Manual project entry for monorepo if auto-detection rejected
9. Claude Code CLI detection with install guidance if missing
10. Agent model configuration (6 options: claude-code, quality, free, budget, local, hybrid)
11. Step 1/6: Set up .claude/ folder (copy agents, commands, skills, merge settings)
12. Step 1b/6: Set up skill enforcement hooks (copy hooks, merge settings.json)
13. Step 2/6: Create docs/ folder structure
14. Step 3/6: Create .isdlc/ folder with state.json, config, checklists, templates, scripts
15. Step 3b/6: Monorepo setup (monorepo.json, per-project state.json, external skills manifests)
16. Step 4/6: Generate constitution (starter template)
17. Step 5/6: Generate installation manifest (installed-files.json)
18. Step 6/6: Copy uninstall.ps1/update.ps1 to .isdlc/scripts/, then cleanup framework folder
19. Optional tour (light intro / full tour / skip)
20. Display next steps summary

**Windows-Specific Adaptations**:
- `Write-Host -ForegroundColor` instead of ANSI escape codes
- `Get-ChildItem -Recurse` instead of `find`
- `ConvertFrom-Json`/`ConvertTo-Json` instead of `jq`
- `Join-Path` for path construction
- `$ErrorActionPreference = 'Stop'` instead of `set -e`
- PowerShell parameter syntax: `-Force` instead of `--force`
- No `chmod` needed (Windows does not use Unix permissions)
- `Remove-Item -Recurse -Force` instead of `rm -rf`

**JSON Deep Merge** (settings.json):
- Read both files with `ConvertFrom-Json`
- Merge properties recursively (existing user keys preserved)
- Write with `ConvertTo-Json -Depth 10`

**Skills Manifest Conversion** (YAML to JSON):
- Check for pre-built JSON first (preferred)
- Fallback: Check if `yq` is on PATH
- Fallback: Check if `python3` + PyYAML available
- Last resort: Warn user manifest may need manual conversion

**Linked Personas**: Windows Developer, CI/CD Pipeline
**Linked NFRs**: NFR-001, NFR-002, NFR-003, NFR-006, NFR-007

---

### REQ-002: PowerShell Uninstall Script (uninstall.ps1)

**Priority**: Must Have
**Description**: Create `uninstall.ps1` with functional parity to `uninstall.sh` (867 lines).

**Parameters**:
- `-Force`: Skip all confirmation prompts
- `-Backup`: Archive framework files before removal
- `-PurgeAll`: Also remove user artifacts (.isdlc/state.json, constitution, etc.)
- `-PurgeDocs`: Also remove docs/ even if it contains user documents
- `-DryRun`: Show what would be removed without removing anything

**Features**:
1. Read installed-files.json manifest
2. Display removal plan (files to be removed vs preserved)
3. Confirmation prompt (skippable with `-Force`)
4. Remove ONLY files tracked in manifest
5. Clean framework keys from settings.json (hooks, permissions)
6. Preserve all user artifacts (custom agents/skills/hooks, state.json, constitution.md, CLAUDE.md, settings.local.json)
7. Remove empty directories after file removal
8. Display summary of removed/preserved files

**Safety Rules** (CRITICAL):
- NEVER delete files not in the manifest
- ALWAYS preserve: state.json, constitution.md, CLAUDE.md, settings.local.json, providers.yaml, monorepo.json
- In monorepo: preserve per-project state.json and external skills
- In docs/: preserve user documents (requirements, architecture, design)

**Linked Personas**: Windows Developer
**Linked NFRs**: NFR-002, NFR-004, NFR-006, NFR-007

---

### REQ-003: PowerShell Update Script (update.ps1)

**Priority**: Must Have
**Description**: Create `update.ps1` with functional parity to `update.sh` (609 lines).

**Parameters**:
- `-Force`: Skip confirmation prompts and version check
- `-DryRun`: Show what would change without making changes
- `-Backup`: Create timestamped backup before updating

**Features**:
1. Verify new framework source exists
2. Compare versions (current vs new) -- skip if same unless `-Force`
3. Confirmation prompt (skippable with `-Force`)
4. Optional backup (timestamped directory)
5. Load old and new installation manifests
6. Copy new framework files (overwrite)
7. Deep merge settings.json (preserve user keys)
8. Clean obsolete files (in old manifest but not in new)
9. Update state.json: framework_version field + history entry
10. Handle monorepo: update each per-project state.json version
11. Display update summary (added/updated/removed/preserved)

**Preservation Rules** (CRITICAL):
- state.json: Only update framework_version and append history entry
- constitution.md: NEVER touch
- CLAUDE.md: NEVER touch
- settings.local.json: NEVER touch
- providers.yaml: NEVER touch
- monorepo.json: NEVER touch
- User-created agents/skills/hooks: NEVER touch

**Linked Personas**: Windows Developer
**Linked NFRs**: NFR-002, NFR-005, NFR-006, NFR-007

---

### REQ-004: Windows Path Handling

**Priority**: Must Have
**Description**: All generated JSON and configuration files must use forward slashes (/) for cross-platform compatibility.

**Rules**:
1. Internal PowerShell operations use OS-native paths (`Join-Path` which produces `\` on Windows)
2. All paths written to JSON files (state.json, manifest, monorepo.json) must use forward slashes
3. Helper function: `$path -replace '\\', '/'` before writing to JSON
4. File existence checks use native paths (no conversion needed)

**Rationale**: The bash scripts produce JSON with forward-slash paths. Agents and hooks on macOS/Linux expect forward slashes. Windows PowerShell/Node.js can read forward-slash paths. Using forward slashes ensures cross-platform state.json portability.

---

### REQ-005: Execution Policy Documentation

**Priority**: Should Have
**Description**: README and script headers must include Windows execution policy instructions.

**Requirements**:
1. Each .ps1 file includes a comment header with bypass command
2. README.md includes a Windows installation section
3. Bypass command: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`
4. Alternative: `powershell -ExecutionPolicy Bypass -File .\install.ps1`

---

### REQ-006: Non-Interactive Mode

**Priority**: Must Have
**Description**: All three scripts support `-Force` flag for CI/CD usage.

**Behavior when `-Force` is set**:
- Skip all confirmation prompts
- Use default values (claude-code provider, single-project mode, skip tour)
- Proceed silently (still show progress output)
- Never wait for user input

---

## 4. Constraints

### CON-001: PowerShell Version

Scripts MUST work on PowerShell 5.1+ (ships with Windows 10/11) AND PowerShell 7+ (pwsh cross-platform). Do not use PowerShell 7-only features.

### CON-002: No External Modules

Scripts MUST NOT require PowerShell Gallery modules. Only built-in cmdlets and .NET classes.

### CON-003: Coexistence with Bash Scripts

PowerShell scripts live alongside bash scripts in the same repository. Both sets must be maintained in parallel. No modifications to existing bash scripts.

### CON-004: No Symlinks

The bash install.sh does not use symlinks. The PowerShell scripts must likewise copy files (not create symlinks), maintaining the same approach.

---

## 5. Assumptions

1. Windows users have PowerShell 5.1+ available (true for Windows 10/11)
2. Git is available on the Windows system (needed to clone the framework)
3. Node.js is available or will be installed separately (needed for hooks)
4. The framework folder structure (src/claude/, src/isdlc/) remains unchanged
5. JSON files use UTF-8 encoding without BOM

---

## 6. Glossary

| Term | Definition |
|------|-----------|
| install.sh | Existing bash installation script (1403 lines) |
| uninstall.sh | Existing bash uninstall script (867 lines) with manifest-based safety |
| update.sh | Existing bash update script (609 lines) with artifact preservation |
| Manifest | installed-files.json tracking all framework-installed files |
| Deep merge | Recursive JSON merge where existing user keys are preserved |
| PowerShell 5.1 | Windows PowerShell (ships with Windows 10/11) |
| pwsh | PowerShell 7+ (cross-platform, installed separately) |
| Constitution | docs/isdlc/constitution.md -- project governance document |
