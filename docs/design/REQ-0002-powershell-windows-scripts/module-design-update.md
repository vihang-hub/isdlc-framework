# Module Design: update.ps1

**Feature**: REQ-0002-powershell-windows-scripts
**Phase**: 04 - Design
**Created**: 2026-02-08
**Status**: Draft
**Bash Reference**: update.sh (609 lines)
**Estimated Lines**: 350-450

---

## 1. Parameter Declaration

```powershell
[CmdletBinding()]
param(
    [switch]$Force,
    [switch]$DryRun,
    [switch]$Backup,
    [switch]$Help
)
```

| Parameter | Type | Bash Equivalent | Purpose |
|-----------|------|-----------------|---------|
| `-Force` | switch | `--force` | Skip confirmation + version check |
| `-DryRun` | switch | `--dry-run` | Show changes without executing |
| `-Backup` | switch | `--backup` | Create backup before updating |
| `-Help` | switch | `--help` | Display usage and exit |

---

## 2. Script-Level Variables

```powershell
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$FrameworkDir = Join-Path $ScriptDir "src"
$ProjectRoot = Get-Location | Select-Object -ExpandProperty Path
$FrameworkClaude = Join-Path $FrameworkDir "claude"
$FrameworkIsdlc = Join-Path $FrameworkDir "isdlc"
$Timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
```

**Path derivation**: Update.sh derives `$PROJECT_ROOT` from `$(pwd)` (the user runs it from their project root). The PowerShell version does the same.

**Key difference from install.ps1**: install.ps1 derives `$ProjectRoot = Split-Path -Parent $ScriptDir` (framework is cloned inside the project). update.ps1 uses `Get-Location` because the user runs it from their project root pointing to an external framework directory.

---

## 3. Execution Flow (10 Steps)

### Step 1/10: Verify Existing Installation

```
Display "iSDLC Framework - In-Place Update" banner
Show $ProjectRoot and $ScriptDir

IF NOT (Test-Path .isdlc/) OR NOT (Test-Path .claude/):
    Write-Err "No iSDLC installation found."
    Write-Err "Run install.ps1 first to set up the framework."
    exit 1

IF NOT (Test-Path .isdlc/state.json):
    Write-Err ".isdlc/state.json not found -- installation may be corrupted."
    exit 1

Write-Success "Installation detected"
```

**Bash mapping**: Lines 112-127

---

### Step 2/10: Read and Compare Versions

```
# Read installed version from state.json
$state = Read-JsonFile (Join-Path (Join-Path $ProjectRoot ".isdlc") "state.json")
$InstalledVersion = "0.0.0"
IF $state AND $state.framework_version:
    $InstalledVersion = $state.framework_version

# Read new version from framework package.json
$packageJsonPath = Join-Path $ScriptDir "package.json"
IF NOT (Test-Path $packageJsonPath):
    Write-Err "package.json not found at $packageJsonPath"
    exit 1

$packageJson = Read-JsonFile $packageJsonPath
$NewVersion = "0.0.0"
IF $packageJson AND $packageJson.version:
    $NewVersion = $packageJson.version

Write-Host "  Installed: " -ForegroundColor Blue -NoNewline
Write-Host $InstalledVersion
Write-Host "  Available: " -ForegroundColor Blue -NoNewline
Write-Host $NewVersion

IF $InstalledVersion -eq $NewVersion AND NOT -Force:
    Write-Host ""
    Write-Success "Already up to date!"
    Write-Warn "Use -Force to reinstall the current version."
    exit 0
```

**Bash mapping**: Lines 129-163

**No jq fallback needed**: PowerShell has built-in `ConvertFrom-Json`. The bash version needs grep/sed fallbacks when jq is absent.

---

### Step 3/10: Confirm

```
IF NOT -Force:
    Display update plan:
        "This will update framework files:"
        - .claude/agents/, skills/, commands/, hooks/
        - .claude/settings.json (deep-merged)
        - .isdlc/config/, templates/, scripts/, checklists/

        "User artifacts will NOT be changed:"
        - .isdlc/state.json, providers.yaml, monorepo.json
        - docs/isdlc/constitution.md, CLAUDE.md
        - .claude/settings.local.json

    Prompt: "Update $InstalledVersion -> $NewVersion? [Y/n]"
    IF not Y: exit 0

IF -DryRun:
    Display "(--dry-run mode: no changes will be made)"
```

**Bash mapping**: Lines 165-193

---

### Step 4/10: Backup (Conditional)

```
IF -Backup:
    $BackupTimestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $BackupDir = Join-Path $ProjectRoot "isdlc-backup-$BackupTimestamp"

    IF -DryRun:
        Write-Warn "[dry-run] Would create backup: $BackupDir"
    ELSE:
        New-Item $BackupDir -ItemType Directory -Force
        foreach $dir in @(".claude",".isdlc"):
            $src = Join-Path $ProjectRoot $dir
            IF Test-Path $src:
                Copy-Item $src (Join-Path $BackupDir $dir) -Recurse
        Write-Success "Backup created: $BackupDir"
ELSE:
    Write-Step "4" "10" "Skipping backup (use -Backup to enable)"
```

**Bash mapping**: Lines 195-219

---

### Step 5/10: Load Old Manifest

```
$HasOldManifest = $false
$OldManifestFiles = @()

IF Test-Path $ManifestFile:
    $manifest = Read-JsonFile $ManifestFile
    IF $manifest AND $manifest.files:
        $OldManifestFiles = $manifest.files
        $HasOldManifest = $true
        Write-Success "Old manifest loaded ($($OldManifestFiles.Count) files tracked)"
    ELSE:
        Write-Warn "Failed to parse manifest -- cleanup will be skipped"
ELSE:
    Write-Warn "No installation manifest found (legacy install)"
    Write-Warn "Removed-files cleanup will be skipped"
```

**Bash mapping**: Lines 222-245

---

### Step 6/10: Copy .claude/ Framework Files

```
$FrameworkClaude = Join-Path $FrameworkDir "claude"
IF NOT (Test-Path $FrameworkClaude):
    Write-Err "Framework source not found at $FrameworkClaude"
    exit 1

# Copy agents, commands, skills
foreach ($dir in @("agents","commands","skills")):
    $src = Join-Path $FrameworkClaude $dir
    IF Test-Path $src:
        IF -DryRun: Write-Warn "[dry-run] Would update $dir/"
        ELSE:
            Copy-Item $src (Join-Path $ProjectRoot ".claude") -Recurse -Force
            Write-Success "Updated $dir/"

# Copy hooks
$hooksSrc = Join-Path $FrameworkClaude "hooks"
IF Test-Path $hooksSrc:
    IF -DryRun: Write-Warn "[dry-run] Would update hooks/"
    ELSE:
        $hooksDst = Join-Path (Join-Path $ProjectRoot ".claude") "hooks"
        New-Item $hooksDst -ItemType Directory -Force | Out-Null
        Copy-Item (Join-Path $hooksSrc "*") $hooksDst -Recurse -Force
        Write-Success "Updated hooks/"

# Merge settings.json
$fwSettings = Join-Path $FrameworkClaude "settings.json"
$projSettings = Join-Path (Join-Path $ProjectRoot ".claude") "settings.json"
IF Test-Path $fwSettings:
    IF Test-Path $projSettings:
        IF -DryRun: Write-Warn "[dry-run] Would merge settings.json"
        ELSE:
            $existing = Read-JsonFile $projSettings
            $framework = Read-JsonFile $fwSettings
            IF $existing AND $framework:
                $merged = Merge-JsonDeep -Base $existing -Override $framework
                Write-JsonFile $projSettings $merged
                Write-Success "Merged settings.json"
            ELSE:
                Copy-Item $fwSettings $projSettings -Force
                Write-Warn "Could not parse settings.json -- replaced"
    ELSE:
        IF NOT -DryRun:
            Copy-Item $fwSettings $projSettings
            Write-Success "Copied settings.json"

# Merge settings.local.json (same pattern)
$fwSettingsLocal = Join-Path $FrameworkClaude "settings.local.json"
$projSettingsLocal = Join-Path (Join-Path $ProjectRoot ".claude") "settings.local.json"
IF Test-Path $fwSettingsLocal:
    IF Test-Path $projSettingsLocal:
        IF NOT -DryRun:
            $existing = Read-JsonFile $projSettingsLocal
            $framework = Read-JsonFile $fwSettingsLocal
            IF $existing AND $framework:
                $merged = Merge-JsonDeep -Base $existing -Override $framework
                Write-JsonFile $projSettingsLocal $merged
                Write-Success "Merged settings.local.json"
    ELSE:
        IF NOT -DryRun:
            Copy-Item $fwSettingsLocal $projSettingsLocal
            Write-Success "Copied settings.local.json"
```

**Bash mapping**: Lines 248-357

**settings.json merge order**: Existing (base) + Framework (override) = Merged. This means framework hook definitions overwrite old ones, but user-added keys are preserved.

---

### Step 7/10: Copy .isdlc/ Framework Config

```
# Copy config directories (overwrite)
foreach ($dir in @("config","checklists","templates","scripts")):
    $src = Join-Path $FrameworkIsdlc $dir
    IF Test-Path $src:
        IF -DryRun: Write-Warn "[dry-run] Would update .isdlc/$dir/"
        ELSE:
            Copy-Item $src (Join-Path $ProjectRoot ".isdlc") -Recurse -Force
            Write-Success "Updated .isdlc/$dir/"

# Copy skills manifest to hooks config
$hooksConfigDir = Join-Path (Join-Path (Join-Path $ProjectRoot ".claude") "hooks") "config"
New-Item $hooksConfigDir -ItemType Directory -Force | Out-Null

# Manifest: prefer pre-built JSON
$yamlManifest = Join-Path (Join-Path $FrameworkIsdlc "config") "skills-manifest.yaml"
IF Test-Path $yamlManifest AND NOT -DryRun:
    Copy-Item $yamlManifest $hooksConfigDir -Force

$jsonManifest = $null
# Priority 1: hooks/config/ pre-built
$candidate1 = Join-Path (Join-Path $FrameworkClaude "hooks") (Join-Path "config" "skills-manifest.json")
# Priority 2: isdlc/config/ pre-built
$candidate2 = Join-Path (Join-Path $FrameworkIsdlc "config") "skills-manifest.json"

IF Test-Path $candidate1: $jsonManifest = $candidate1
ELSEIF Test-Path $candidate2: $jsonManifest = $candidate2

IF $jsonManifest AND NOT -DryRun:
    Copy-Item $jsonManifest $hooksConfigDir -Force
    Write-Success "Updated skills manifest in hooks/config/"
ELSE:
    Write-Warn "No pre-built JSON manifest found"

# Copy workflows.json to both locations
$workflowsSrc = Join-Path (Join-Path $FrameworkIsdlc "config") "workflows.json"
IF Test-Path $workflowsSrc AND NOT -DryRun:
    Copy-Item $workflowsSrc (Join-Path (Join-Path $ProjectRoot ".isdlc") "config") -Force
    Copy-Item $workflowsSrc $hooksConfigDir -Force
    Write-Success "Updated workflow definitions"
```

**Bash mapping**: Lines 359-418

---

### Step 8/10: Clean Removed Files (Old Manifest Diff)

```
IF $HasOldManifest AND $OldManifestFiles.Count -gt 0:
    $RemovedCount = 0

    # Build new file list from current .claude/ contents
    $NewFiles = [System.Collections.ArrayList]::new()
    foreach ($dir in @("agents","skills","commands","hooks")):
        $dirPath = Join-Path (Join-Path $ProjectRoot ".claude") $dir
        IF Test-Path $dirPath:
            Get-ChildItem $dirPath -Recurse -File | ForEach-Object {
                [void]$NewFiles.Add((Get-RelativePath $_.FullName $ProjectRoot))
            }
    $settingsPath = Join-Path (Join-Path $ProjectRoot ".claude") "settings.json"
    IF Test-Path $settingsPath:
        [void]$NewFiles.Add("$(ConvertTo-ForwardSlashPath '.claude/settings.json')")

    # Check each old file against new set
    foreach ($oldFile in $OldManifestFiles):
        IF $oldFile NOT IN $NewFiles:
            $fullPath = Join-Path $ProjectRoot ($oldFile -replace '/', '\')
            IF Test-Path $fullPath -PathType Leaf:
                IF -DryRun:
                    Write-Warn "[dry-run] Would remove obsolete: $oldFile"
                ELSE:
                    Remove-Item $fullPath -Force
                $RemovedCount++

    IF $RemovedCount -gt 0:
        Write-Success "Removed $RemovedCount obsolete files"
    ELSE:
        Write-Success "No obsolete files to remove"
ELSE:
    Write-Warn "Skipped (no old manifest)"
```

**Bash mapping**: Lines 420-468

**Key logic**: Files that existed in the old manifest but do NOT exist in the new framework are deleted. This handles file renames and removals between versions.

---

### Step 9/10: Regenerate Manifest

```
IF NOT -DryRun:
    $manifest = New-ManifestJson -ProjectRoot $ProjectRoot `
                                  -Timestamp $Timestamp `
                                  -FrameworkVersion $NewVersion
    $manifestPath = Join-Path (Join-Path $ProjectRoot ".isdlc") "installed-files.json"
    Write-JsonFile $manifestPath $manifest
    Write-Success "Manifest regenerated ($($manifest.files.Count) files tracked)"
ELSE:
    Write-Warn "[dry-run] Would regenerate manifest"
```

**Note**: Reuses `New-ManifestJson` function from install.ps1 (duplicated inline per ADR-001).

**Bash mapping**: Lines 472-515

---

### Step 10/10: Update state.json Version + History

```
IF NOT -DryRun:
    $statePath = Join-Path (Join-Path $ProjectRoot ".isdlc") "state.json"
    $state = Read-JsonFile $statePath

    IF $state:
        # Update framework_version
        $state.framework_version = $NewVersion

        # Append history entry
        $historyEntry = [PSCustomObject]@{
            timestamp = $Timestamp
            agent = "update-script"
            action = "Framework updated from $InstalledVersion to $NewVersion"
        }
        IF $state.history -is [array]:
            $newHistory = [System.Collections.ArrayList]::new()
            foreach ($item in $state.history) { [void]$newHistory.Add($item) }
            [void]$newHistory.Add($historyEntry)
            $state.history = $newHistory.ToArray()
        ELSE:
            $state.history = @($historyEntry)

        Write-JsonFile $statePath $state
        Write-Success "Updated state.json ($InstalledVersion -> $NewVersion)"

        # Update monorepo per-project states
        $monorepoPath = Join-Path (Join-Path $ProjectRoot ".isdlc") "monorepo.json"
        IF Test-Path $monorepoPath:
            $projectsDir = Join-Path (Join-Path $ProjectRoot ".isdlc") "projects"
            IF Test-Path $projectsDir:
                Get-ChildItem $projectsDir -Directory | ForEach-Object {
                    $projStatePath = Join-Path $_.FullName "state.json"
                    IF Test-Path $projStatePath:
                        $projState = Read-JsonFile $projStatePath
                        IF $projState:
                            $projState.framework_version = $NewVersion
                            $projHistoryEntry = [PSCustomObject]@{
                                timestamp = $Timestamp
                                agent = "update-script"
                                action = "Framework updated from $InstalledVersion to $NewVersion"
                            }
                            IF $projState.history -is [array]:
                                $newHist = [System.Collections.ArrayList]::new()
                                foreach ($h in $projState.history) { [void]$newHist.Add($h) }
                                [void]$newHist.Add($projHistoryEntry)
                                $projState.history = $newHist.ToArray()
                            Write-JsonFile $projStatePath $projState
                }
            Write-Success "Updated monorepo project states"
    ELSE:
        Write-Warn "Could not parse state.json -- version not updated"
ELSE:
    Write-Warn "[dry-run] Would update state.json ($InstalledVersion -> $NewVersion)"
```

**Bash mapping**: Lines 518-566

**Array append challenge in PS 5.1**: PowerShell arrays (`@()`) are immutable. To append, we convert to ArrayList, add, then convert back to array. This is the PS 5.1-compatible pattern (PS 7 has `+=` that works but copies the array each time).

---

### Summary + Cleanup Offer

```
Display "Update Complete!" (or "Dry Run Complete") banner

Show:
    Previous version: $InstalledVersion
    New version: $NewVersion
    [OK] Framework files updated
    [OK] User artifacts preserved

IF -DryRun:
    "No changes were made. Run without -DryRun to update."

IF NOT -DryRun AND NOT -Force:
    Prompt: "Remove framework source directory? [Y/n]"
    IF Y: Remove-Item $ScriptDir -Recurse -Force

"Run 'isdlc doctor' to verify installation health."
```

**Bash mapping**: Lines 568-609

---

## 4. Preservation Rules (CRITICAL)

These files are NEVER modified by update.ps1 (except where noted):

| File | Treatment | Exception |
|------|-----------|-----------|
| `.isdlc/state.json` | Preserved | `framework_version` field updated, history entry appended |
| `.isdlc/providers.yaml` | Never touched | None |
| `.isdlc/monorepo.json` | Never touched | None |
| `docs/isdlc/constitution.md` | Never touched | None |
| `docs/isdlc/constitution.draft.md` | Never touched | None |
| `CLAUDE.md` | Never touched | None |
| `.claude/settings.local.json` | Deep-merged | Framework defaults added, user overrides preserved |
| `.claude/settings.json` | Deep-merged | Framework hooks/permissions added, user keys preserved |
| `docs/requirements/**` | Never touched | None |
| `docs/architecture/**` | Never touched | None |
| `docs/design/**` | Never touched | None |
| User-created agents/skills/hooks | Never touched | Not in manifest, not overwritten |

---

## 5. Traceability

| Step | Requirements | NFRs |
|------|-------------|------|
| 1 (verify) | REQ-003 | NFR-006 |
| 2 (versions) | REQ-003 | NFR-002 |
| 3 (confirm) | REQ-003, REQ-006 | - |
| 4 (backup) | REQ-003 | - |
| 5 (old manifest) | REQ-003 | NFR-005 |
| 6 (.claude copy) | REQ-003 | NFR-002, NFR-005 |
| 7 (.isdlc copy) | REQ-003 | NFR-002 |
| 8 (clean removed) | REQ-003 | NFR-005 |
| 9 (new manifest) | REQ-003 | NFR-002 |
| 10 (state version) | REQ-003 | NFR-005 |
