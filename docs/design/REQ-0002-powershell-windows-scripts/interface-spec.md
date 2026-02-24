# Interface Specification: PowerShell Scripts

**Feature**: REQ-0002-powershell-windows-scripts
**Phase**: 04 - Design
**Created**: 2026-02-08
**Status**: Draft

---

## 1. Script Parameter Interfaces

### 1.1 install.ps1

```
SYNOPSIS: Install iSDLC framework into a project
USAGE:    .\install.ps1 [-Force] [-Help]

PARAMETERS:
  -Force    Skip all interactive prompts, use default values
  -Help     Display help text and exit

EXIT CODES:
  0  Success (installation complete or user cancelled)
  1  Fatal error (missing framework source, directory failures)

STDIN:     Interactive prompts when -Force is not set
STDOUT:    Colored progress output (Write-Host)
STDERR:    None (errors go to stdout via Write-Err)

FILESYSTEM OUTPUT:
  Creates:  .claude/, .isdlc/, docs/
  Deletes:  Framework clone directory ($ScriptDir)
  Modifies: .claude/settings.json (if pre-existing, deep-merged)
```

### 1.2 uninstall.ps1

```
SYNOPSIS: Safely remove iSDLC framework from a project
USAGE:    .\uninstall.ps1 [-Force] [-Backup] [-PurgeAll] [-PurgeDocs] [-DryRun] [-Help]

PARAMETERS:
  -Force       Skip all confirmation prompts
  -Backup      Create backup directory before removal
  -PurgeAll    DANGER: Also remove user artifacts (state.json, etc.)
  -PurgeDocs   DANGER: Also remove docs/ directory
  -DryRun      Show what would be removed without executing
  -Help        Display help text and exit

EXIT CODES:
  0  Success (uninstall complete, dry-run complete, or user cancelled)
  1  Fatal error (no framework detected)

PREREQUISITE: Must run from project root (where .isdlc/ exists)
PREREQUISITE: .isdlc/installed-files.json should exist (safe mode)

FILESYSTEM OUTPUT:
  Deletes:  Framework files tracked in manifest
  Modifies: .claude/settings.json (strips hooks/permissions keys)
  Preserves: User artifacts (state.json, constitution.md, etc.)
```

### 1.3 update.ps1

```
SYNOPSIS: Update iSDLC framework in-place
USAGE:    .\update.ps1 [-Force] [-DryRun] [-Backup] [-Help]

PARAMETERS:
  -Force    Skip confirmation and version check
  -DryRun   Show what would change without executing
  -Backup   Create backup directory before updating
  -Help     Display help text and exit

EXIT CODES:
  0  Success (update complete, already up-to-date, or user cancelled)
  1  Fatal error (no installation, missing package.json, corrupt state)

PREREQUISITE: Must run from project root
PREREQUISITE: Framework source directory must contain src/ and package.json

FILESYSTEM OUTPUT:
  Overwrites: .claude/agents/, skills/, commands/, hooks/
  Overwrites: .isdlc/config/, templates/, scripts/, checklists/
  Merges:     .claude/settings.json, .claude/settings.local.json
  Updates:    .isdlc/state.json (framework_version + history)
  Regenerates: .isdlc/installed-files.json
  Preserves:  All user artifacts
```

---

## 2. File Format Contracts

### 2.1 installed-files.json

**Producer**: install.ps1 (Step 5/6), update.ps1 (Step 9/10)
**Consumer**: uninstall.ps1 (Step 2), update.ps1 (Step 5/10)

```json
{
  "version": "1.0.0",
  "created": "2026-02-08T12:00:00Z",
  "framework_version": "0.1.0-alpha",
  "files": [
    ".claude/agents/01-requirements-analyst.md",
    ".claude/agents/02-solution-architect.md",
    ".claude/hooks/gate-blocker.cjs",
    ".claude/hooks/lib/common.cjs",
    ".claude/settings.json"
  ]
}
```

**Contract rules**:
1. All paths use forward slashes (/)
2. Paths are relative to project root
3. `files` array contains only files (not directories)
4. `files` array is flat (no nesting)
5. `version` is always "1.0.0"
6. `framework_version` matches package.json version at install/update time

### 2.2 state.json (framework_version field)

**Producer**: install.ps1 (Step 3/6), update.ps1 (Step 10/10)
**Consumer**: update.ps1 (Step 2/10), all agents and hooks

```json
{
  "framework_version": "0.1.0-alpha",
  "history": [
    {
      "timestamp": "2026-02-08T12:00:00Z",
      "agent": "init-script",
      "action": "Project initialized with iSDLC framework"
    },
    {
      "timestamp": "2026-02-08T13:00:00Z",
      "agent": "update-script",
      "action": "Framework updated from 0.1.0-alpha to 0.2.0"
    }
  ]
}
```

**Contract rules**:
1. `framework_version` is a semver string
2. `history` is an array of objects, each with `timestamp`, `agent`, `action`
3. History is append-only (never modify existing entries)
4. `agent` is `"init-script"` for install, `"update-script"` for update

### 2.3 monorepo.json

**Producer**: install.ps1 (Step 3b/6)
**Consumer**: All SDLC agents, update.ps1

```json
{
  "version": "1.0.0",
  "default_project": "frontend",
  "docs_location": "root",
  "projects": {
    "frontend": {
      "name": "frontend",
      "path": "frontend",
      "registered_at": "2026-02-08T12:00:00Z",
      "discovered": true
    }
  },
  "scan_paths": ["apps/", "packages/"]
}
```

**Contract rules**:
1. `path` values use forward slashes
2. `docs_location` is either `"root"` or `"project"`
3. `default_project` matches a key in `projects`

### 2.4 providers.yaml

**Producer**: install.ps1 (Step 3/6)
**Consumer**: model-provider-router hook

Generated from template with `active_mode` substituted. Written via `Write-Utf8NoBom` (string replacement, not YAML serialization -- PowerShell has no built-in YAML writer).

```yaml
active_mode: "claude-code"
```

**Contract**: Only the `active_mode` line is modified. Template structure preserved.

### 2.5 settings.json (Merge Contract)

**Producer**: install.ps1 (Step 1b/6), update.ps1 (Step 6/10)
**Consumer**: Claude Code runtime

**Merge semantics** (`Merge-JsonDeep`):
```
Base (existing user settings):
{
  "hooks": { "userHook": "..." },
  "customKey": "userValue"
}

Override (framework settings):
{
  "hooks": { "frameworkHook": "..." },
  "permissions": { ... }
}

Result:
{
  "hooks": { "userHook": "...", "frameworkHook": "..." },
  "customKey": "userValue",
  "permissions": { ... }
}
```

**Contract rules**:
1. User keys not in framework are preserved
2. Framework keys not in user are added
3. Nested objects are recursively merged
4. Arrays are replaced (not element-merged)
5. No data loss from either side

---

## 3. Cross-Script Compatibility Matrix

| Artifact | install.ps1 | uninstall.ps1 | update.ps1 | install.sh |
|----------|:-----------:|:-------------:|:----------:|:----------:|
| installed-files.json | Produces | Reads | Reads+Regenerates | Produces |
| state.json | Produces | Preserves | Updates version | Produces |
| monorepo.json | Produces | Removes (safe) | Preserves | Produces |
| settings.json | Produces/Merges | Strips keys | Merges | Produces/Merges |
| providers.yaml | Produces | Preserves | Preserves | Produces |
| constitution.md | Produces | Preserves | Preserves | Produces |

**Cross-platform compatibility**: An installation created by install.sh can be uninstalled by uninstall.ps1 and vice versa. The manifest format and state.json structure are identical.

---

## 4. Bash-to-PowerShell Command Mapping (Quick Reference)

| Bash | PowerShell | Notes |
|------|-----------|-------|
| `set -e` | `$ErrorActionPreference = 'Stop'` | + `Set-StrictMode -Version 2.0` |
| `echo -e "${GREEN}msg${NC}"` | `Write-Host "msg" -ForegroundColor Green` | |
| `read -p "Prompt: " VAR` | `$VAR = Read-Host "Prompt"` | |
| `find DIR -type f` | `Get-ChildItem DIR -Recurse -File` | |
| `jq -s '.[0] * .[1]'` | `Merge-JsonDeep -Base $a -Override $b` | Custom function |
| `jq -r '.field'` | `$obj.field` | Native property access |
| `jq 'del(.key)'` | `$obj.PSObject.Properties.Remove("key")` | |
| `rm -rf DIR` | `Remove-Item DIR -Recurse -Force` | |
| `mkdir -p DIR` | `New-Item DIR -ItemType Directory -Force` | |
| `cp -r SRC DST` | `Copy-Item SRC DST -Recurse -Force` | |
| `chmod +x FILE` | N/A | Not needed on Windows |
| `date -u +"%Y-%m-%dT%H:%M:%SZ"` | `(Get-Date).ToUniversalTime().ToString(...)` | |
| `basename "$PATH"` | `Split-Path -Leaf $Path` | |
| `dirname "$PATH"` | `Split-Path -Parent $Path` | |
| `pwd` | `Get-Location \| Select -Expand Path` | |
| `command -v tool` | `Get-Command tool -EA SilentlyContinue` | |
| `$VAR:-default` | `if ($null -eq $Var) { "default" } else { $Var }` | No null-coalescing in PS 5.1 |
| `[[ "$V" =~ ^[Yy]$ ]]` | `$V -match '^[Yy]$'` | |
| `cat > file << 'EOF'` | `$content = @"..."@; Write-Utf8NoBom` | Here-string + UTF-8 write |
| `wc -l` | `(Get-Content file).Count` or `.Count` | |
| `tar -czf` | Directory copy (no tar in PS 5.1) | See backup sections |
| `mktemp` | `[System.IO.Path]::GetTempFileName()` | |
| `sed -i 's/old/new/'` | `(Get-Content f) -replace 'old','new'` | Or string .Replace() |
| `2>/dev/null \|\| true` | `-ErrorAction SilentlyContinue` | |
| `$?` / `$PIPESTATUS` | `$LASTEXITCODE` / `$?` | PS $? is boolean |

---

## 5. ConvertTo-Json Depth Requirements

| File | Max Nesting | Required -Depth |
|------|------------|----------------|
| state.json | 5 (phases.05-implementation.iteration_tracking.history[].violations[]) | 10 |
| installed-files.json | 1 (files[]) | 2 (default OK, but use 10 for safety) |
| monorepo.json | 2 (projects.{name}.{field}) | 10 |
| settings.json | 3 (hooks.{type}[].{field}) | 10 |
| external-skills-manifest.json | 2 (skills.{id}.{field}) | 10 |

**Rule**: Always use `-Depth 10` to prevent silent truncation.

---

## 6. CI/CD Interface (GitHub Actions)

### 6.1 New Job: `powershell-install`

```yaml
powershell-install:
  name: "PowerShell Install (${{ matrix.shell }})"
  runs-on: windows-latest
  strategy:
    matrix:
      shell: [pwsh, powershell]
  defaults:
    run:
      shell: ${{ matrix.shell }}
```

**Matrix entries**:
- `powershell` = Windows PowerShell 5.1 (built-in on windows-latest)
- `pwsh` = PowerShell 7.x (pre-installed on windows-latest)

### 6.2 Test Sequence

```
1. Checkout repo
2. Create test project directory
3. Initialize git repo in test project
4. Copy framework into test project
5. Run install.ps1 -Force
6. Verify: settings.json exists, state.json exists, manifest exists, manifest.files.Count >= 50
7. Verify: all paths in manifest use forward slashes
8. Run uninstall.ps1 -DryRun -Force
9. Verify: no files removed (dry run)
10. Run update.ps1 -DryRun -Force
11. Verify: no files changed (dry run)
```

### 6.3 Verification Assertions

```powershell
# Existence checks
if (-not (Test-Path ".claude/settings.json")) { throw "Missing settings.json" }
if (-not (Test-Path ".isdlc/state.json")) { throw "Missing state.json" }
if (-not (Test-Path ".isdlc/installed-files.json")) { throw "Missing manifest" }

# Manifest size check
$manifest = Get-Content ".isdlc/installed-files.json" | ConvertFrom-Json
if ($manifest.files.Count -lt 50) { throw "Manifest too small: $($manifest.files.Count)" }

# Forward-slash path check
foreach ($f in $manifest.files) {
    if ($f -match '\\') { throw "Backslash found in manifest path: $f" }
}

# State.json validity
$state = Get-Content ".isdlc/state.json" | ConvertFrom-Json
if ($state.framework_version -ne "0.1.0-alpha") { throw "Wrong version" }
if ($state.project.name -ne "test-project") { throw "Wrong project name" }
```

---

## 7. Documentation Interface (REQ-005)

### 7.1 Script Header Comment

Each .ps1 file includes:
```powershell
<#
.SYNOPSIS
    iSDLC Framework - [Script Name]
.DESCRIPTION
    [Full description]
.NOTES
    Requires: PowerShell 5.1+ or PowerShell 7+
    No external modules required.

    If blocked by execution policy, run:
      Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
    Or:
      powershell -ExecutionPolicy Bypass -File .\[script].ps1
.EXAMPLE
    .\install.ps1
    Interactive installation with prompts.
.EXAMPLE
    .\install.ps1 -Force
    Non-interactive installation with all defaults.
#>
```

### 7.2 README.md Windows Section

```markdown
### Windows (PowerShell)

```powershell
git clone <repo> isdlc-framework
.\isdlc-framework\install.ps1
```

If blocked by execution policy:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\isdlc-framework\install.ps1
```

Non-interactive (CI/CD):
```powershell
.\isdlc-framework\install.ps1 -Force
```
```

---

## 8. Traceability Summary

| Design Document | Requirements Covered | NFRs Covered |
|----------------|---------------------|-------------|
| module-design-shared-helpers.md | REQ-001, REQ-002, REQ-003, REQ-004 | NFR-001, NFR-007 |
| module-design-install.md | REQ-001, REQ-004, REQ-005, REQ-006 | NFR-001, NFR-002, NFR-003, NFR-006, NFR-007 |
| module-design-uninstall.md | REQ-002, REQ-004, REQ-006 | NFR-001, NFR-002, NFR-004, NFR-006, NFR-007 |
| module-design-update.md | REQ-003, REQ-004, REQ-006 | NFR-001, NFR-002, NFR-005, NFR-006, NFR-007 |
| interface-spec.md (this file) | REQ-001 through REQ-006 | NFR-001 through NFR-007 |
