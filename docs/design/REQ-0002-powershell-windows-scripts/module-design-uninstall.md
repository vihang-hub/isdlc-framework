# Module Design: uninstall.ps1

**Feature**: REQ-0002-powershell-windows-scripts
**Phase**: 04 - Design
**Created**: 2026-02-08
**Status**: Draft
**Bash Reference**: uninstall.sh (867 lines)
**Estimated Lines**: 500-600

---

## 1. Parameter Declaration

```powershell
[CmdletBinding()]
param(
    [switch]$Force,
    [switch]$Backup,
    [switch]$PurgeAll,
    [switch]$PurgeDocs,
    [switch]$DryRun,
    [switch]$Help
)
```

| Parameter | Type | Bash Equivalent | Purpose |
|-----------|------|-----------------|---------|
| `-Force` | switch | `--force` | Skip all confirmation prompts |
| `-Backup` | switch | `--backup` | Archive framework files before removal |
| `-PurgeAll` | switch | `--purge-all` | Also remove user artifacts |
| `-PurgeDocs` | switch | `--purge-docs` | Also remove docs/ |
| `-DryRun` | switch | `--dry-run` | Show plan without executing |
| `-Help` | switch | `--help` | Display usage and exit |

---

## 2. Script-Level Variables

```powershell
$ProjectRoot = Get-Location | Select-Object -ExpandProperty Path
$ManifestFile = Join-Path (Join-Path $ProjectRoot ".isdlc") "installed-files.json"

# Tracking arrays for summary
$RemovedDirs = [System.Collections.ArrayList]::new()
$RemovedFiles = [System.Collections.ArrayList]::new()
$CleanedFiles = [System.Collections.ArrayList]::new()
$SkippedItems = [System.Collections.ArrayList]::new()
$PreservedUserFiles = [System.Collections.ArrayList]::new()
```

**Key difference from bash**: Uses `ArrayList` instead of bash arrays for mutable lists.

---

## 3. Execution Flow

### Step 1: Detect Framework Installation

```
Display "iSDLC Framework - Safe Uninstall" banner
Show $ProjectRoot

$HasIsdlc = Test-Path (Join-Path $ProjectRoot ".isdlc")
$HasClaudeAgents = Test-Path (Join-Path $ProjectRoot ".claude\agents")
$HasManifest = Test-Path $ManifestFile
$IsMonorepo = Test-Path (Join-Path $ProjectRoot ".isdlc\monorepo.json")

IF NOT $HasIsdlc AND NOT $HasClaudeAgents:
    Write-Err "No iSDLC framework installation detected."
    exit 1
```

**Bash mapping**: Lines 150-191

---

### Step 2: Load Manifest

```
IF $HasManifest:
    $manifest = Read-JsonFile $ManifestFile
    IF $manifest AND $manifest.files:
        $ManifestFiles = $manifest.files
        Display: "Tracked files: $($ManifestFiles.Count)"
    ELSE:
        $HasManifest = $false
        Warn: "Failed to parse manifest"
ELSE:
    Display WARNING banner: "No installation manifest found"

    IF NOT -Force:
        Present 3 options:
            1) Continue with legacy mode
            2) Abort
            3) Create manifest from current state (recommended)

        IF option 3:
            Scan .claude/{agents,skills,commands,hooks} for all files
            Build manifest JSON with forward-slash paths
            Write to $ManifestFile
            Write-Success "Created manifest with N files"
            exit 0
```

**Bash mapping**: Lines 196-292

**Manifest generation** (option 3): Uses `Get-ChildItem -Recurse -File` + `Get-RelativePath` to build file list. Writes JSON via `Write-JsonFile`.

---

### Step 3: Identify Files to Remove vs Preserve

```
$FilesToRemove = [System.Collections.ArrayList]::new()
$UserFilesPreserved = [System.Collections.ArrayList]::new()

IF $HasManifest AND $ManifestFiles.Count -gt 0:
    # SAFE MODE: Only remove files in manifest
    foreach ($file in $ManifestFiles):
        $fullPath = Join-Path $ProjectRoot $file
        # Convert forward-slash path to native for Test-Path
        $nativePath = $fullPath -replace '/', '\'
        IF Test-Path $nativePath -PathType Leaf:
            [void]$FilesToRemove.Add($file)

    # Find user-created files (in .claude/ but NOT in manifest)
    foreach ($dir in @("agents","skills","commands","hooks")):
        $dirPath = Join-Path (Join-Path $ProjectRoot ".claude") $dir
        IF Test-Path $dirPath:
            Get-ChildItem $dirPath -Recurse -File | ForEach-Object {
                $relPath = Get-RelativePath $_.FullName $ProjectRoot
                IF $relPath NOT IN $ManifestFiles:
                    [void]$UserFilesPreserved.Add($relPath)
            }
ELSE:
    # LEGACY MODE: Pattern-based removal (less safe)
    Use $FrameworkPatterns list to identify framework files
    Everything not matching is preserved
```

**Bash mapping**: Lines 294-407

**Path conversion note**: Manifest stores forward-slash paths. When checking with `Test-Path`, convert back to native paths on Windows.

---

### Step 4: Show Removal Plan + Confirm

```
Display removal plan:
    "Framework files (N files):" — show first 10
    "User files PRESERVED (N files):" — show all

Display preservation summary:
    IF -PurgeAll: show RED warning that .isdlc/ will be deleted
    ELSE: show GREEN preserved items
        - state.json
        - constitution.md
        - checklists/
        - monorepo project states

    IF -PurgeDocs: show RED warning that docs/ will be deleted
    ELSE: show GREEN "docs/ (N user documents)"

IF $DryRun: show "(--dry-run mode)"

IF NOT -Force:
    Prompt: "Proceed with uninstall? [y/N]"
    IF not Y: exit 0
```

**Bash mapping**: Lines 410-483

---

### Step 5: Backup (Conditional)

```
IF -Backup:
    $BackupTimestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $BackupDir = Join-Path $ProjectRoot "isdlc-backup-$BackupTimestamp"

    IF -DryRun:
        Write-Warn "[dry-run] Would create backup: $BackupDir"
    ELSE:
        New-Item $BackupDir -ItemType Directory -Force
        # Copy framework directories to backup
        foreach ($dir in @(".claude\agents",".claude\skills",".claude\commands",
                           ".claude\hooks",".isdlc","docs")):
            $src = Join-Path $ProjectRoot $dir
            IF Test-Path $src:
                $dst = Join-Path $BackupDir $dir
                Copy-Item $src $dst -Recurse -Force
        # Copy settings.json
        $settingsPath = Join-Path $ProjectRoot ".claude\settings.json"
        IF Test-Path $settingsPath:
            Copy-Item $settingsPath (Join-Path $BackupDir ".claude\settings.json")
        Write-Success "Backup created: $BackupDir"
```

**Bash vs PowerShell difference**: Bash uses `tar -czf` for backup. PowerShell uses directory copy because `Compress-Archive` has limitations (no `-C` equivalent for relative paths in PS 5.1). A directory backup is simpler and more portable.

**Bash mapping**: Lines 486-516

---

### Step 6: Remove Framework Files

```
foreach ($file in $FilesToRemove):
    $fullPath = Join-Path $ProjectRoot ($file -replace '/', '\')
    IF Test-Path $fullPath -PathType Leaf:
        IF -DryRun:
            Write-Warn "[dry-run] Would remove file: $file"
        ELSE:
            Remove-Item $fullPath -Force
        [void]$RemovedFiles.Add($file)

Write-Success "Removed $($FilesToRemove.Count) framework files"
```

**Bash mapping**: Lines 519-531

---

### Step 7: Clean Empty Directories in .claude/

```
foreach ($dir in @("agents","skills","commands","hooks")):
    $dirPath = Join-Path (Join-Path $ProjectRoot ".claude") $dir
    IF Test-Path $dirPath:
        # Remove empty subdirectories (deepest first)
        Get-ChildItem $dirPath -Directory -Recurse |
            Sort-Object { $_.FullName.Length } -Descending |
            Where-Object { (Get-ChildItem $_.FullName -Force).Count -eq 0 } |
            ForEach-Object {
                IF -DryRun: Write-Warn "[dry-run] Would remove empty: $($_.FullName)"
                ELSE: Remove-Item $_.FullName -Force
                [void]$RemovedDirs.Add((Get-RelativePath $_.FullName $ProjectRoot))
            }
        # Check if main directory is now empty
        IF (Get-ChildItem $dirPath -Force).Count -eq 0:
            Remove or log the directory

# Clean hooks subdirectories
foreach ($sub in @("lib","config","tests")):
    $subPath = Join-Path (Join-Path (Join-Path $ProjectRoot ".claude") "hooks") $sub
    IF Test-Path $subPath AND empty: remove
```

**Bash mapping**: Lines 534-553

---

### Step 8: Clean settings.json

```
$settingsPath = Join-Path (Join-Path $ProjectRoot ".claude") "settings.json"
IF Test-Path $settingsPath:
    $settings = Read-JsonFile $settingsPath
    IF $settings:
        # Remove hooks and permissions keys
        $propsToRemove = @("hooks", "permissions")
        foreach ($prop in $propsToRemove):
            IF $settings.PSObject.Properties[$prop]:
                $settings.PSObject.Properties.Remove($prop)

        # Check if object is now empty
        IF $settings.PSObject.Properties.Count -eq 0:
            IF -DryRun: log
            ELSE: Remove-Item $settingsPath
        ELSE:
            IF -DryRun: log
            ELSE: Write-JsonFile $settingsPath $settings
            [void]$CleanedFiles.Add(".claude/settings.json")
```

**Bash mapping**: Lines 556-592

**PowerShell advantage**: No need for jq -- native PSCustomObject property removal works on PS 5.1.

---

### Step 9: Clean .isdlc/ (Preserve User Artifacts)

```
IF $PurgeAll:
    DANGER MODE: Remove-Item .isdlc/ -Recurse -Force
    [void]$RemovedDirs.Add(".isdlc/")
ELSE:
    SAFE MODE:
    # Framework-only directories (safe to remove completely)
    foreach ($dir in @("config","templates","scripts")):
        Remove if exists

    # Framework-only files
    foreach ($file in @("installed-files.json","monorepo.json")):
        Remove if exists

    # PRESERVED (always):
    #   .isdlc/state.json
    #   .isdlc/projects/*/state.json
    #   .isdlc/projects/*/skills/external/

    Display preserved items list

    IF .isdlc/ is now empty (no state.json etc): remove directory
```

**Bash mapping**: Lines 595-698

---

### Step 10: Remove Fallback Script

```
$fallbackScript = Join-Path (Join-Path $ProjectRoot "scripts") "convert-manifest.sh"
IF Test-Path $fallbackScript:
    Remove-Item $fallbackScript
    # Remove scripts/ dir if empty
```

**Bash mapping**: Lines 700-710

---

### Step 11: CLAUDE.md Backup Restore

```
$backupPath = Join-Path $ProjectRoot "CLAUDE.md.backup"
IF Test-Path $backupPath:
    IF -Force:
        Write-Warn "Skipping restore (--force). Backup remains."
    ELIF -DryRun:
        Write-Warn "[dry-run] Would offer to restore CLAUDE.md"
    ELSE:
        Prompt: "Restore CLAUDE.md from pre-install backup? [y/N]"
        IF Y:
            Move-Item $backupPath (Join-Path $ProjectRoot "CLAUDE.md") -Force
```

**Bash mapping**: Lines 712-736

---

### Step 12: Docs Cleanup

```
IF Test-Path docs/:
    IF -PurgeDocs:
        DANGER: Remove-Item docs/ -Recurse -Force
    ELSE:
        Count files in docs/ (excluding hidden files)
        IF count > 0:
            "docs/ contains N user documents - PRESERVED"
            List subdirectory counts
        ELSE:
            "docs/ contains only empty scaffolding - cleaning up"
            Remove empty standard subdirectories
            Remove docs/ if empty
```

**Bash mapping**: Lines 738-793

---

### Step 13: Clean Empty .claude/ Directory

```
IF Test-Path .claude/:
    # Check if anything remains besides settings.local.json
    $remaining = Get-ChildItem (Join-Path $ProjectRoot ".claude") -Force |
        Where-Object { $_.Name -ne "settings.local.json" -and $_.Name -ne "CLAUDE.md.backup" }
    IF $remaining.Count -eq 0:
        IF settings.local.json exists: preserve .claude/
        ELSE: remove .claude/ if empty
    ELSE:
        ".claude/ preserved -- contains user files"
```

**Bash mapping**: Lines 798-813

---

### Summary Display

```
Display "Uninstall Complete" (or "Dry Run Complete") banner

Show counts:
    Removed files: N
    Removed directories: [list]
    Cleaned files: [list]
    User files preserved: N [list]
    Skipped: [list]

IF -DryRun:
    "No changes were made. Run without -DryRun to uninstall."
```

**Bash mapping**: Lines 815-867

---

## 4. Safety Invariants

These MUST hold true at the end of any uninstall run (non-purge):

1. **No user files deleted**: Files not in manifest are never touched
2. **state.json preserved**: `.isdlc/state.json` survives unless `-PurgeAll`
3. **Constitution preserved**: `docs/isdlc/constitution.md` survives unless `-PurgeDocs`
4. **CLAUDE.md untouched**: `CLAUDE.md` is never modified
5. **settings.local.json untouched**: `.claude/settings.local.json` is never modified
6. **User docs preserved**: `docs/requirements/`, `docs/architecture/`, etc. survive unless `-PurgeDocs`
7. **Monorepo state preserved**: `.isdlc/projects/*/state.json` survives unless `-PurgeAll`

---

## 5. Traceability

| Step | Requirements | NFRs |
|------|-------------|------|
| 1 (detect) | REQ-002 | NFR-004 |
| 2 (manifest) | REQ-002 | NFR-004 |
| 3 (identify) | REQ-002 | NFR-004 |
| 4 (confirm) | REQ-002, REQ-006 | NFR-004 |
| 5 (backup) | REQ-002 | - |
| 6 (remove) | REQ-002 | NFR-004 |
| 7-8 (clean) | REQ-002 | NFR-004 |
| 9 (.isdlc) | REQ-002 | NFR-004, NFR-005 |
| 12 (docs) | REQ-002 | NFR-004 |
