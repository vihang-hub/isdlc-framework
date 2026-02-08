<#
.SYNOPSIS
    iSDLC Framework - Safe Uninstall Script for Windows
.DESCRIPTION
    Safely removes the iSDLC framework from your project.

    SAFETY: Only removes framework-installed files tracked in the manifest.
    User-created agents, skills, commands, and hooks are PRESERVED.

    What gets removed (ONLY if tracked in manifest):
      - Framework-installed files in .claude/agents/, skills/, commands/, hooks/
      - Framework keys (hooks, permissions) from .claude/settings.json
      - Framework config in .isdlc/ (config/, templates/, scripts/, installed-files.json)
      - Empty docs/ scaffolding (only if no user content exists)

    What is ALWAYS preserved:
      - User-created agents, skills, commands, hooks (not in manifest)
      - .claude/settings.local.json (user customizations)
      - CLAUDE.md (user-owned)
      - .isdlc/state.json (project state, phase progress, iteration history)
      - docs/isdlc/constitution.md (project constitution)
      - All user documents in docs/
.NOTES
    Requires: PowerShell 5.1+ (Windows PowerShell) or PowerShell 7+ (pwsh)
    No external modules required.

    Execution Policy: If blocked, run one of:
      Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
      powershell -ExecutionPolicy Bypass -File .\uninstall.ps1
.PARAMETER Force
    Skip all confirmation prompts.
.PARAMETER Backup
    Create backup directory before removal.
.PARAMETER PurgeAll
    DANGER: Also remove user artifacts (state.json, etc.).
.PARAMETER PurgeDocs
    DANGER: Also remove docs/ directory.
.PARAMETER DryRun
    Show what would be removed without executing.
.PARAMETER Help
    Display usage text and exit.
.EXAMPLE
    .\uninstall.ps1
    Interactive uninstall with prompts.
.EXAMPLE
    .\uninstall.ps1 -Force
    Non-interactive uninstall.
.EXAMPLE
    .\uninstall.ps1 -DryRun
    Show what would be removed without making changes.
#>

[CmdletBinding()]
param(
    [switch]$Force,
    [switch]$Backup,
    [switch]$PurgeAll,
    [switch]$PurgeDocs,
    [switch]$DryRun,
    [switch]$Help
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

# ── Helper Functions ─────────────────────────────────────────

function Write-Banner {
    param(
        [Parameter(Mandatory)] [string]$Text
    )
    $border = [string]::new([char]0x2550, 60)
    $top    = [char]0x2554 + $border + [char]0x2557
    $bottom = [char]0x255A + $border + [char]0x255D
    $side   = [char]0x2551
    $padded = $Text.PadRight(58)
    Write-Host ""
    Write-Host $top -ForegroundColor Cyan
    Write-Host "$side  $padded  $side" -ForegroundColor Cyan
    Write-Host $bottom -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step {
    param(
        [Parameter(Mandatory)] [string]$Number,
        [Parameter(Mandatory)] [string]$Total,
        [Parameter(Mandatory)] [string]$Message
    )
    Write-Host "[$Number/$Total] " -ForegroundColor Blue -NoNewline
    Write-Host $Message
}

function Write-Success {
    param(
        [Parameter(Mandatory)] [string]$Message
    )
    Write-Host "  [OK] $Message" -ForegroundColor Green
}

function Write-Warn {
    param(
        [Parameter(Mandatory)] [string]$Message
    )
    Write-Host "  $Message" -ForegroundColor Yellow
}

function Write-Err {
    param(
        [Parameter(Mandatory)] [string]$Message
    )
    Write-Host "  $Message" -ForegroundColor Red
}

function ConvertTo-ForwardSlashPath {
    param(
        [Parameter(Mandatory)] [string]$Path
    )
    return $Path -replace '\\', '/'
}

function Write-Utf8NoBom {
    param(
        [Parameter(Mandatory)] [string]$Path,
        [Parameter(Mandatory)] [string]$Content
    )
    $Content = $Content -replace "`r`n", "`n"
    $Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $Utf8NoBom)
}

function Merge-JsonDeep {
    param(
        [Parameter(Mandatory)] $Base,
        [Parameter(Mandatory)] $Override
    )
    if ($null -eq $Base) { return $Override }
    if ($null -eq $Override) { return $Base }

    $Result = $Base.PSObject.Copy()
    foreach ($prop in $Override.PSObject.Properties) {
        $name = $prop.Name
        $overrideVal = $prop.Value
        if ($Result.PSObject.Properties[$name]) {
            $baseVal = $Result.$name
            if ($baseVal -is [PSCustomObject] -and $overrideVal -is [PSCustomObject]) {
                $Result.$name = Merge-JsonDeep -Base $baseVal -Override $overrideVal
            }
            else {
                $Result.$name = $overrideVal
            }
        }
        else {
            $Result | Add-Member -NotePropertyName $name -NotePropertyValue $overrideVal
        }
    }
    return $Result
}

function Read-JsonFile {
    param(
        [Parameter(Mandatory)] [string]$Path
    )
    if (-not (Test-Path $Path)) { return $null }
    try {
        $content = Get-Content $Path -Raw -ErrorAction Stop
        return $content | ConvertFrom-Json
    }
    catch {
        Write-Warn "Failed to parse JSON: $Path"
        return $null
    }
}

function Write-JsonFile {
    param(
        [Parameter(Mandatory)] [string]$Path,
        [Parameter(Mandatory)] $Object,
        [int]$Depth = 10
    )
    $json = $Object | ConvertTo-Json -Depth $Depth
    Write-Utf8NoBom -Path $Path -Content $json
}

function Get-RelativePath {
    param(
        [Parameter(Mandatory)] [string]$FullPath,
        [Parameter(Mandatory)] [string]$BasePath
    )
    $normalizedBase = $BasePath.TrimEnd('\', '/')
    $rel = $FullPath.Substring($normalizedBase.Length)
    if ($rel.StartsWith('\') -or $rel.StartsWith('/')) {
        $rel = $rel.Substring(1)
    }
    return ConvertTo-ForwardSlashPath $rel
}

# ── Main Logic ───────────────────────────────────────────────

# Help
if ($Help) {
    Write-Host "iSDLC Framework - Safe Uninstall Script"
    Write-Host ""
    Write-Host "Usage: .\uninstall.ps1 [-Force] [-Backup] [-PurgeAll] [-PurgeDocs] [-DryRun] [-Help]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -Force           Skip all confirmation prompts"
    Write-Host "  -Backup          Create backup directory before removal"
    Write-Host "  -PurgeAll        DANGER: Also remove user artifacts (state, constitution, checklists)"
    Write-Host "  -PurgeDocs       DANGER: Also remove docs/ even if it contains user documents"
    Write-Host "  -DryRun          Show what would be removed without removing anything"
    Write-Host "  -Help            Show this help message"
    Write-Host ""
    Write-Host "SAFETY (default behavior):"
    Write-Host "  - Only removes framework files tracked in .isdlc/installed-files.json"
    Write-Host "  - Preserves user-created agents, skills, commands, hooks"
    Write-Host "  - Preserves user artifacts: state.json, constitution.md, checklists/, phases/"
    Write-Host "  - Preserves all documents in docs/"
    exit 0
}

$ProjectRoot = Get-Location | Select-Object -ExpandProperty Path
$ManifestFile = Join-Path (Join-Path $ProjectRoot ".isdlc") "installed-files.json"

# Tracking arrays for summary
$RemovedDirs = [System.Collections.ArrayList]::new()
$RemovedFiles = [System.Collections.ArrayList]::new()
$CleanedFiles = [System.Collections.ArrayList]::new()
$SkippedItems = [System.Collections.ArrayList]::new()
$PreservedUserFiles = [System.Collections.ArrayList]::new()

# ============================================================================
# Step 1: Detect framework installation
# ============================================================================

Write-Banner "iSDLC Framework - Safe Uninstall"
Write-Host "  Project Directory: $ProjectRoot" -ForegroundColor Blue
Write-Host ""

$HasIsdlc = Test-Path (Join-Path $ProjectRoot ".isdlc")
$HasClaudeAgents = Test-Path (Join-Path (Join-Path $ProjectRoot ".claude") "agents")
$HasManifest = Test-Path $ManifestFile
$IsMonorepo = Test-Path (Join-Path (Join-Path $ProjectRoot ".isdlc") "monorepo.json")

if (-not $HasIsdlc -and -not $HasClaudeAgents) {
    Write-Err "No iSDLC framework installation detected."
    Write-Host "  Expected .isdlc/ and/or .claude/agents/ to exist."
    exit 1
}

Write-Success "iSDLC framework detected."
if ($IsMonorepo) {
    Write-Host "  Monorepo installation" -ForegroundColor Blue
}

# ============================================================================
# Step 2: Load manifest
# ============================================================================

$ManifestFiles = @()

if ($HasManifest) {
    Write-Success "Installation manifest found - will only remove tracked files"

    $manifest = Read-JsonFile $ManifestFile
    if ($null -ne $manifest -and $null -ne $manifest.files) {
        $ManifestFiles = @($manifest.files)
        Write-Host "  Tracked files: $($ManifestFiles.Count)" -ForegroundColor Blue
    }
    else {
        Write-Warn "Warning: Failed to parse manifest."
        $HasManifest = $false
    }
}
else {
    Write-Host ""
    $warnBorder = [string]::new([char]0x2550, 60)
    $warnTop    = [char]0x2554 + $warnBorder + [char]0x2557
    $warnBottom = [char]0x255A + $warnBorder + [char]0x255D
    $warnSide   = [char]0x2551
    $warnText   = "WARNING".PadRight(58)
    Write-Host $warnTop -ForegroundColor Yellow
    Write-Host "$warnSide  $warnText  $warnSide" -ForegroundColor Yellow
    Write-Host $warnBottom -ForegroundColor Yellow
    Write-Host ""
    Write-Warn "No installation manifest found at .isdlc/installed-files.json"
    Write-Host ""
    Write-Warn "This installation was created before manifest tracking was added."
    Write-Warn "The uninstaller cannot distinguish between:"
    Write-Warn "  - Framework-installed files"
    Write-Warn "  - User-created files"
    Write-Host ""
    Write-Err "RISK: User-created agents, skills, commands, or hooks may be deleted."
    Write-Host ""

    if (-not $Force) {
        Write-Host "  Options:" -ForegroundColor Cyan
        Write-Host "    1) Continue anyway (will attempt safe removal)"
        Write-Host "    2) Abort and manually remove framework files"
        Write-Host "    3) Create manifest from current state first (recommended)"
        Write-Host ""
        $legacyChoice = Read-Host "  Choose [1/2/3]"

        switch ($legacyChoice) {
            "1" {
                Write-Warn "Continuing with legacy mode..."
            }
            "2" {
                Write-Err "Uninstall aborted."
                exit 0
            }
            "3" {
                Write-Host ""
                Write-Host "  Creating manifest from current state..." -ForegroundColor Blue

                $manifestTimestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
                $genFiles = [System.Collections.ArrayList]::new()

                foreach ($dir in @("agents","skills","commands","hooks")) {
                    $dirPath = Join-Path (Join-Path $ProjectRoot ".claude") $dir
                    if (Test-Path $dirPath) {
                        Get-ChildItem $dirPath -Recurse -File | ForEach-Object {
                            [void]$genFiles.Add((Get-RelativePath $_.FullName $ProjectRoot))
                        }
                    }
                }

                $settingsPath = Join-Path (Join-Path $ProjectRoot ".claude") "settings.json"
                if (Test-Path $settingsPath) {
                    [void]$genFiles.Add(".claude/settings.json")
                }

                $genManifest = [PSCustomObject]@{
                    version = "1.0.0"
                    created = $manifestTimestamp
                    files = $genFiles.ToArray()
                }
                Write-JsonFile $ManifestFile $genManifest
                Write-Success "Created manifest with $($genFiles.Count) files"
                Write-Host ""
                Write-Warn "Please review .isdlc/installed-files.json and remove any"
                Write-Warn "user-created files from the list before running uninstall again."
                exit 0
            }
            default {
                Write-Err "Invalid choice. Aborting."
                exit 1
            }
        }
    }
}

# ============================================================================
# Step 3: Identify files to remove vs preserve
# ============================================================================

Write-Host ""
Write-Host "  Analyzing files..." -ForegroundColor Blue

$FilesToRemove = [System.Collections.ArrayList]::new()
$UserFilesPreserved = [System.Collections.ArrayList]::new()

if ($HasManifest -and $ManifestFiles.Count -gt 0) {
    # SAFE MODE: Only remove files in the manifest
    foreach ($file in $ManifestFiles) {
        $nativePath = Join-Path $ProjectRoot ($file -replace '/', '\')
        if (Test-Path $nativePath -PathType Leaf) {
            [void]$FilesToRemove.Add($file)
        }
    }

    # Find user-created files (files in .claude/ NOT in manifest)
    foreach ($dir in @("agents","skills","commands","hooks")) {
        $dirPath = Join-Path (Join-Path $ProjectRoot ".claude") $dir
        if (Test-Path $dirPath) {
            Get-ChildItem $dirPath -Recurse -File | ForEach-Object {
                $relPath = Get-RelativePath $_.FullName $ProjectRoot
                $inManifest = $false
                foreach ($mf in $ManifestFiles) {
                    if ($relPath -eq $mf) { $inManifest = $true; break }
                }
                if (-not $inManifest) {
                    [void]$UserFilesPreserved.Add($relPath)
                }
            }
        }
    }
}
else {
    # LEGACY MODE: Remove known framework patterns only
    $frameworkPatterns = @(
        "00-sdlc-orchestrator.md",
        "01-requirements-analyst.md",
        "02-solution-architect.md",
        "03-tech-lead.md",
        "04-test-design-engineer.md",
        "05-software-developer.md",
        "06-integration-tester.md",
        "07-code-reviewer.md",
        "08-uat-coordinator.md",
        "09-devops-engineer.md",
        "10-release-manager.md",
        "11-deployment-specialist.md",
        "12-prod-support-engineer.md",
        "13-operations-analyst.md",
        "14-upgrade-engineer.md",
        "discover-orchestrator.md",
        "product-analyst.md",
        "architecture-analyzer.md",
        "architecture-designer.md",
        "skills-researcher.md",
        "gate-blocker.cjs",
        "test-watcher.cjs",
        "constitution-validator.cjs",
        "menu-tracker.cjs",
        "skill-validator.cjs",
        "log-skill-usage.cjs",
        "common.cjs"
    )

    foreach ($dir in @("agents","skills","commands","hooks")) {
        $dirPath = Join-Path (Join-Path $ProjectRoot ".claude") $dir
        if (Test-Path $dirPath) {
            Get-ChildItem $dirPath -Recurse -File | ForEach-Object {
                $relPath = Get-RelativePath $_.FullName $ProjectRoot
                $fileName = $_.Name
                $isFramework = $false

                foreach ($pattern in $frameworkPatterns) {
                    if ($fileName -like $pattern) { $isFramework = $true; break }
                }

                # For skills, check known framework skill directories
                if ($dir -eq "skills") {
                    if ($relPath -match '/sdlc/' -or $relPath -match '/discover/' -or
                        $relPath -match '/gates/' -or $relPath -match '/workflows/') {
                        $isFramework = $true
                    }
                }

                if ($isFramework) {
                    [void]$FilesToRemove.Add($relPath)
                }
                else {
                    [void]$UserFilesPreserved.Add($relPath)
                }
            }
        }
    }
}

# ============================================================================
# Step 4: Show removal plan + confirm
# ============================================================================

Write-Host ""
Write-Warn "The following will be removed:"
Write-Host ""

if ($FilesToRemove.Count -gt 0) {
    Write-Host "  Framework files ($($FilesToRemove.Count) files):" -ForegroundColor Blue
    $count = 0
    foreach ($file in $FilesToRemove) {
        if ($count -lt 10) {
            Write-Host "    $file"
        }
        $count++
    }
    if ($FilesToRemove.Count -gt 10) {
        Write-Host "    ... and $($FilesToRemove.Count - 10) more files"
    }
}

if ($UserFilesPreserved.Count -gt 0) {
    Write-Host ""
    Write-Host "  User files PRESERVED ($($UserFilesPreserved.Count) files):" -ForegroundColor Green
    foreach ($file in $UserFilesPreserved) {
        Write-Host "    $file"
    }
}

Write-Host ""
Write-Host "  User artifacts that will be PRESERVED (safe by default):" -ForegroundColor Green

$isdlcPath = Join-Path $ProjectRoot ".isdlc"
if (Test-Path $isdlcPath) {
    if ($PurgeAll) {
        Write-Err ".isdlc/: WILL BE DELETED (-PurgeAll)"
    }
    else {
        Write-Host "  .isdlc/ user artifacts:" -ForegroundColor Green
        if (Test-Path (Join-Path $isdlcPath "state.json")) {
            Write-Host "    - state.json (project state & history)" -ForegroundColor Green
        }
        if (Test-Path (Join-Path $isdlcPath "constitution.md")) {
            Write-Host "    - constitution.md (project constitution)" -ForegroundColor Green
        }
        $checklistsPath = Join-Path $isdlcPath "checklists"
        if (Test-Path $checklistsPath -PathType Container) {
            Write-Host "    - checklists/ (gate checklist responses)" -ForegroundColor Green
        }
        $phasesPath = Join-Path $isdlcPath "phases"
        if (Test-Path $phasesPath -PathType Container) {
            Write-Host "    - phases/ (phase artifacts)" -ForegroundColor Green
        }
        $projectsPath = Join-Path $isdlcPath "projects"
        if (Test-Path $projectsPath -PathType Container) {
            Write-Host "    - projects/ (monorepo project states)" -ForegroundColor Green
        }
    }
}

$docsPath = Join-Path $ProjectRoot "docs"
if (Test-Path $docsPath) {
    $docFileCount = @(Get-ChildItem $docsPath -Recurse -File -ErrorAction SilentlyContinue | Where-Object { -not $_.Name.StartsWith(".") }).Count
    if ($PurgeDocs) {
        Write-Err "docs/: WILL BE DELETED (-PurgeDocs) - $docFileCount files"
    }
    elseif ($docFileCount -gt 0) {
        Write-Host "  docs/ ($docFileCount user documents)" -ForegroundColor Green
    }
    else {
        Write-Warn "docs/: empty scaffolding (will be cleaned up)"
    }
}

Write-Host ""

if ($DryRun) {
    Write-Host "  (-DryRun mode: no changes will be made)" -ForegroundColor Cyan
    Write-Host ""
}

if (-not $Force) {
    $confirm = Read-Host "  Proceed with uninstall? [y/N]"
    if ([string]::IsNullOrEmpty($confirm)) { $confirm = "N" }
    if ($confirm -notmatch '^[Yy]$') {
        Write-Err "Uninstall cancelled."
        exit 0
    }
    Write-Host ""
}

# ============================================================================
# Step 5: Backup (if -Backup)
# ============================================================================

if ($Backup) {
    $BackupTimestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $BackupDir = Join-Path $ProjectRoot "isdlc-backup-$BackupTimestamp"

    Write-Host "  Creating backup..." -ForegroundColor Blue

    if ($DryRun) {
        Write-Warn "[dry-run] Would create backup: $BackupDir"
    }
    else {
        New-Item $BackupDir -ItemType Directory -Force | Out-Null

        foreach ($dir in @(".claude\agents",".claude\skills",".claude\commands",
                           ".claude\hooks",".isdlc","docs")) {
            $src = Join-Path $ProjectRoot $dir
            if (Test-Path $src) {
                $dst = Join-Path $BackupDir $dir
                $dstParent = Split-Path -Parent $dst
                New-Item $dstParent -ItemType Directory -Force -ErrorAction SilentlyContinue | Out-Null
                Copy-Item $src $dst -Recurse -Force
            }
        }

        $settingsFile = Join-Path (Join-Path $ProjectRoot ".claude") "settings.json"
        if (Test-Path $settingsFile) {
            $backupSettingsDir = Join-Path $BackupDir ".claude"
            New-Item $backupSettingsDir -ItemType Directory -Force -ErrorAction SilentlyContinue | Out-Null
            Copy-Item $settingsFile (Join-Path $backupSettingsDir "settings.json") -Force
        }

        Write-Success "Backup created: $BackupDir"
    }
    Write-Host ""
}

# ============================================================================
# Step 6: Remove framework files
# ============================================================================

Write-Host "  Removing framework files..." -ForegroundColor Blue

foreach ($file in $FilesToRemove) {
    $fullPath = Join-Path $ProjectRoot ($file -replace '/', '\')
    if (Test-Path $fullPath -PathType Leaf) {
        if ($DryRun) {
            Write-Warn "[dry-run] Would remove file: $file"
        }
        else {
            Remove-Item $fullPath -Force
        }
        [void]$RemovedFiles.Add($file)
    }
}

Write-Success "Removed $($FilesToRemove.Count) framework files"
Write-Host ""

# ============================================================================
# Step 7: Clean empty directories in .claude/
# ============================================================================

Write-Host "  Cleaning empty directories..." -ForegroundColor Blue

foreach ($dir in @("agents","skills","commands","hooks")) {
    $dirPath = Join-Path (Join-Path $ProjectRoot ".claude") $dir
    if (Test-Path $dirPath) {
        # Remove empty subdirectories (deepest first)
        $subDirs = Get-ChildItem $dirPath -Directory -Recurse -ErrorAction SilentlyContinue
        if ($subDirs) {
            $subDirs | Sort-Object { $_.FullName.Length } -Descending | ForEach-Object {
                $children = Get-ChildItem $_.FullName -Force -ErrorAction SilentlyContinue
                if ($null -eq $children -or @($children).Count -eq 0) {
                    if ($DryRun) {
                        Write-Warn "[dry-run] Would remove empty: $($_.FullName)"
                    }
                    else {
                        Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
                    }
                    [void]$RemovedDirs.Add((Get-RelativePath $_.FullName $ProjectRoot))
                }
            }
        }
        # Check if main directory is now empty
        $remaining = Get-ChildItem $dirPath -Force -ErrorAction SilentlyContinue
        if ($null -eq $remaining -or @($remaining).Count -eq 0) {
            if ($DryRun) {
                Write-Warn "[dry-run] Would remove empty: $dir/"
            }
            else {
                Remove-Item $dirPath -Force -ErrorAction SilentlyContinue
            }
            [void]$RemovedDirs.Add(".claude/$dir/")
        }
    }
}

# Clean hooks subdirectories
foreach ($sub in @("lib","config","tests")) {
    $subPath = Join-Path (Join-Path (Join-Path $ProjectRoot ".claude") "hooks") $sub
    if (Test-Path $subPath) {
        $children = Get-ChildItem $subPath -Force -ErrorAction SilentlyContinue
        if ($null -eq $children -or @($children).Count -eq 0) {
            if (-not $DryRun) {
                Remove-Item $subPath -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

Write-Host ""

# ============================================================================
# Step 8: Clean settings.json
# ============================================================================

$settingsPath = Join-Path (Join-Path $ProjectRoot ".claude") "settings.json"
if (Test-Path $settingsPath) {
    Write-Host "  Cleaning .claude/settings.json..." -ForegroundColor Blue

    $settings = Read-JsonFile $settingsPath
    if ($null -ne $settings) {
        $propsToRemove = @("hooks", "permissions")
        foreach ($prop in $propsToRemove) {
            if ($settings.PSObject.Properties[$prop]) {
                $settings.PSObject.Properties.Remove($prop)
            }
        }

        # Check if object is now empty
        if ($settings.PSObject.Properties.Count -eq 0) {
            if ($DryRun) {
                Write-Warn "[dry-run] Would remove .claude/settings.json (no remaining keys)"
            }
            else {
                Remove-Item $settingsPath -Force
            }
            Write-Success "Removed .claude/settings.json (no remaining keys)"
        }
        else {
            if ($DryRun) {
                Write-Warn "[dry-run] Would strip hooks and permissions from .claude/settings.json"
            }
            else {
                Write-JsonFile $settingsPath $settings
            }
            [void]$CleanedFiles.Add(".claude/settings.json")
            Write-Success "Stripped hooks and permissions from .claude/settings.json"
        }
    }
    else {
        Write-Warn "Warning: Could not parse .claude/settings.json"
        [void]$SkippedItems.Add(".claude/settings.json (parse error)")
    }
    Write-Host ""
}

# ============================================================================
# Step 9: Clean .isdlc/ (preserve user artifacts)
# ============================================================================

if (Test-Path $isdlcPath) {
    if ($PurgeAll) {
        Write-Err "Removing .isdlc/ completely (-PurgeAll)..."
        if ($DryRun) {
            Write-Warn "[dry-run] Would remove directory: .isdlc/"
        }
        else {
            Remove-Item $isdlcPath -Recurse -Force
        }
        [void]$RemovedDirs.Add(".isdlc/")
        Write-Err "Removed .isdlc/ (including user artifacts)"
    }
    else {
        Write-Host "  Cleaning .isdlc/ (preserving user artifacts)..." -ForegroundColor Blue

        # Framework-only directories
        foreach ($dir in @("config","templates","scripts")) {
            $fwDir = Join-Path $isdlcPath $dir
            if (Test-Path $fwDir) {
                if ($DryRun) {
                    Write-Warn "[dry-run] Would remove: .isdlc/$dir/"
                }
                else {
                    Remove-Item $fwDir -Recurse -Force
                }
                [void]$RemovedDirs.Add(".isdlc/$dir/")
                Write-Success "Removed .isdlc/$dir/ (framework config)"
            }
        }

        # Framework-only files
        foreach ($file in @("installed-files.json","monorepo.json")) {
            $fwFile = Join-Path $isdlcPath $file
            if (Test-Path $fwFile) {
                if ($DryRun) {
                    Write-Warn "[dry-run] Would remove: .isdlc/$file"
                }
                else {
                    Remove-Item $fwFile -Force
                }
                [void]$RemovedFiles.Add(".isdlc/$file")
                Write-Success "Removed .isdlc/$file (framework config)"
            }
        }

        Write-Host ""
        Write-Host "  Runtime state PRESERVED in .isdlc/:" -ForegroundColor Green

        $preservedItems = @()
        if (Test-Path (Join-Path $isdlcPath "state.json")) {
            $preservedItems += ".isdlc/state.json (project state & history)"
        }
        if (Test-Path (Join-Path $isdlcPath "projects")) {
            $preservedItems += ".isdlc/projects/ (monorepo runtime states)"
        }

        if ($preservedItems.Count -gt 0) {
            foreach ($item in $preservedItems) {
                Write-Host "    - $item" -ForegroundColor Green
                [void]$SkippedItems.Add("$item (runtime state)")
            }
        }
        else {
            Write-Warn "(no runtime state found)"
            # If no user artifacts, remove .isdlc/ if empty
            $isdlcChildren = Get-ChildItem $isdlcPath -Force -ErrorAction SilentlyContinue
            if ($null -eq $isdlcChildren -or @($isdlcChildren).Count -eq 0) {
                if (-not $DryRun) {
                    Remove-Item $isdlcPath -Force -ErrorAction SilentlyContinue
                }
            }
        }

        # Show preserved docs/isdlc/ documents
        $docsIsdlcPath = Join-Path (Join-Path $ProjectRoot "docs") "isdlc"
        if (Test-Path $docsIsdlcPath) {
            Write-Host ""
            Write-Host "  User documents PRESERVED in docs/isdlc/:" -ForegroundColor Green
            $docsPreserved = @()
            $preserveChecks = @(
                @{ Path = "constitution.md"; Type = "Leaf" },
                @{ Path = "constitution.draft.md"; Type = "Leaf" },
                @{ Path = "tasks.md"; Type = "Leaf" },
                @{ Path = "test-evaluation-report.md"; Type = "Leaf" },
                @{ Path = "atdd-checklist.json"; Type = "Leaf" },
                @{ Path = "skill-customization-report.md"; Type = "Leaf" },
                @{ Path = "external-skills-manifest.json"; Type = "Leaf" },
                @{ Path = "checklists"; Type = "Container" },
                @{ Path = "projects"; Type = "Container" }
            )
            foreach ($check in $preserveChecks) {
                $checkPath = Join-Path $docsIsdlcPath $check.Path
                if (Test-Path $checkPath) {
                    Write-Host "    - $($check.Path)" -ForegroundColor Green
                    [void]$SkippedItems.Add("docs/isdlc/$($check.Path) (user document)")
                }
            }
        }
    }
}
Write-Host ""

# ============================================================================
# Step 10: Remove fallback script
# ============================================================================

$fallbackScript = Join-Path (Join-Path $ProjectRoot "scripts") "convert-manifest.sh"
if (Test-Path $fallbackScript) {
    Write-Host "  Removing fallback script..." -ForegroundColor Blue
    if ($DryRun) {
        Write-Warn "[dry-run] Would remove: scripts/convert-manifest.sh"
    }
    else {
        Remove-Item $fallbackScript -Force
    }
    Write-Success "Removed scripts/convert-manifest.sh"
    # Remove scripts/ dir if empty
    $scriptsDir = Join-Path $ProjectRoot "scripts"
    $scriptsChildren = Get-ChildItem $scriptsDir -Force -ErrorAction SilentlyContinue
    if ($null -eq $scriptsChildren -or @($scriptsChildren).Count -eq 0) {
        if (-not $DryRun) {
            Remove-Item $scriptsDir -Force -ErrorAction SilentlyContinue
        }
    }
    Write-Host ""
}

# ============================================================================
# Step 11: CLAUDE.md backup restore
# ============================================================================

$backupPath = Join-Path $ProjectRoot "CLAUDE.md.backup"
if (Test-Path $backupPath) {
    Write-Host "  Found CLAUDE.md.backup" -ForegroundColor Blue

    if ($Force) {
        Write-Warn "Skipping restore (-Force). Backup remains at CLAUDE.md.backup"
        [void]$SkippedItems.Add("CLAUDE.md.backup restore (-Force)")
    }
    elseif ($DryRun) {
        Write-Warn "[dry-run] Would offer to restore CLAUDE.md from CLAUDE.md.backup"
    }
    else {
        $restoreConfirm = Read-Host "  Restore CLAUDE.md from pre-install backup? [y/N]"
        if ([string]::IsNullOrEmpty($restoreConfirm)) { $restoreConfirm = "N" }
        if ($restoreConfirm -match '^[Yy]$') {
            Move-Item $backupPath (Join-Path $ProjectRoot "CLAUDE.md") -Force
            Write-Success "Restored CLAUDE.md from backup"
        }
        else {
            Write-Warn "Backup left at CLAUDE.md.backup"
            [void]$SkippedItems.Add("CLAUDE.md.backup restore (declined)")
        }
    }
    Write-Host ""
}

# ============================================================================
# Step 12: Docs cleanup
# ============================================================================

if (Test-Path $docsPath) {
    if ($PurgeDocs) {
        Write-Err "Removing docs/ completely (-PurgeDocs)..."
        if ($DryRun) {
            Write-Warn "[dry-run] Would remove directory: docs/"
        }
        else {
            Remove-Item $docsPath -Recurse -Force
        }
        [void]$RemovedDirs.Add("docs/")
        Write-Err "Removed docs/ (including user documents)"
    }
    else {
        Write-Host "  Checking docs/ for user content..." -ForegroundColor Blue

        $docFiles = Get-ChildItem $docsPath -Recurse -File -ErrorAction SilentlyContinue | Where-Object { -not $_.Name.StartsWith(".") }
        $docFileCount = 0
        if ($null -ne $docFiles) { $docFileCount = @($docFiles).Count }

        if ($docFileCount -gt 0) {
            Write-Host "  docs/ contains $docFileCount user documents - PRESERVED" -ForegroundColor Green
            [void]$SkippedItems.Add("docs/ ($docFileCount user documents)")

            Write-Host "  User documents preserved:" -ForegroundColor Green
            foreach ($subDir in @("requirements","architecture","design","testing")) {
                $subDirPath = Join-Path $docsPath $subDir
                if (Test-Path $subDirPath -PathType Container) {
                    $subFiles = Get-ChildItem $subDirPath -Recurse -File -ErrorAction SilentlyContinue | Where-Object { -not $_.Name.StartsWith(".") }
                    $subCount = 0
                    if ($null -ne $subFiles) { $subCount = @($subFiles).Count }
                    if ($subCount -gt 0) {
                        Write-Host "    - docs/$subDir/ ($subCount files)" -ForegroundColor Green
                    }
                }
            }
        }
        else {
            Write-Warn "docs/ contains only empty scaffolding - cleaning up"
            foreach ($subDir in @("requirements","architecture","design","testing")) {
                $subDirPath = Join-Path $docsPath $subDir
                if (Test-Path $subDirPath) {
                    $children = Get-ChildItem $subDirPath -Force -ErrorAction SilentlyContinue
                    if ($null -eq $children -or @($children).Count -eq 0) {
                        if (-not $DryRun) {
                            Remove-Item $subDirPath -Force -ErrorAction SilentlyContinue
                        }
                    }
                }
            }
            # Remove docs/ if empty
            $docsChildren = Get-ChildItem $docsPath -Force -ErrorAction SilentlyContinue
            if ($null -eq $docsChildren -or @($docsChildren).Count -eq 0) {
                if (-not $DryRun) {
                    Remove-Item $docsPath -Force -ErrorAction SilentlyContinue
                }
            }
        }
    }
}
Write-Host ""

# ============================================================================
# Step 13: Clean empty .claude/ directory
# ============================================================================

$claudeDir = Join-Path $ProjectRoot ".claude"
if (Test-Path $claudeDir) {
    $remaining = Get-ChildItem $claudeDir -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -ne "settings.local.json" -and $_.Name -ne "CLAUDE.md.backup" }

    if ($null -eq $remaining -or @($remaining).Count -eq 0) {
        if (Test-Path (Join-Path $claudeDir "settings.local.json")) {
            Write-Warn ".claude/ contains only settings.local.json -- preserving"
            [void]$SkippedItems.Add(".claude/ (contains settings.local.json)")
        }
        else {
            $claudeChildren = Get-ChildItem $claudeDir -Force -ErrorAction SilentlyContinue
            if ($null -eq $claudeChildren -or @($claudeChildren).Count -eq 0) {
                if (-not $DryRun) {
                    Remove-Item $claudeDir -Force -ErrorAction SilentlyContinue
                }
            }
        }
    }
    else {
        Write-Host "  .claude/ preserved -- contains user files" -ForegroundColor Green
    }
}

# ============================================================================
# Summary
# ============================================================================

Write-Host ""
$summaryText = ""
if ($DryRun) { $summaryText = "Dry Run Complete" }
else { $summaryText = "Uninstall Complete" }

$sBorder = [string]::new([char]0x2550, 60)
$sTop    = [char]0x2554 + $sBorder + [char]0x2557
$sBottom = [char]0x255A + $sBorder + [char]0x255D
$sSide   = [char]0x2551
$sPadded = $summaryText.PadRight(58)

Write-Host $sTop -ForegroundColor Green
Write-Host "$sSide  $sPadded  $sSide" -ForegroundColor Green
Write-Host $sBottom -ForegroundColor Green
Write-Host ""

if ($RemovedFiles.Count -gt 0) {
    Write-Host "  Removed files: $($RemovedFiles.Count)" -ForegroundColor Blue
}

if ($RemovedDirs.Count -gt 0) {
    Write-Host "  Removed directories:" -ForegroundColor Blue
    foreach ($item in $RemovedDirs) {
        Write-Host "    - $item"
    }
    Write-Host ""
}

if ($CleanedFiles.Count -gt 0) {
    Write-Host "  Cleaned files:" -ForegroundColor Blue
    foreach ($item in $CleanedFiles) {
        Write-Host "    - $item"
    }
    Write-Host ""
}

if ($UserFilesPreserved.Count -gt 0) {
    Write-Host "  User files preserved: $($UserFilesPreserved.Count)" -ForegroundColor Green
    foreach ($item in $UserFilesPreserved) {
        Write-Host "    - $item"
    }
    Write-Host ""
}

if ($SkippedItems.Count -gt 0) {
    Write-Host "  Skipped:" -ForegroundColor Blue
    foreach ($item in $SkippedItems) {
        Write-Host "    - $item"
    }
    Write-Host ""
}

if ($DryRun) {
    Write-Host "  No changes were made. Run without -DryRun to uninstall." -ForegroundColor Cyan
}
Write-Host ""
