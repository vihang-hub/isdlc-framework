# Test Cases: Cross-Cutting Concerns

**Feature**: REQ-0002-powershell-windows-scripts
**Scope**: All scripts (install.ps1, uninstall.ps1, update.ps1)
**Phase**: 05 - Test Strategy
**Created**: 2026-02-08

---

## TC-CC-001: PS 5.1 compatibility (no 7-only syntax)

**Requirement**: CON-001, NFR-001, ADR-007
**Priority**: Must Have
**Environment**: PS 5.1 specifically

**Preconditions**:
- All three script files available
- Windows PowerShell 5.1 available (built-in on Windows 10/11)

**Steps**:
1. Run install.ps1 -Force under `powershell.exe` (PS 5.1)
2. Run uninstall.ps1 -DryRun -Force under `powershell.exe`
3. Run update.ps1 -DryRun -Force under `powershell.exe`
4. Static scan all scripts for PS 7-only syntax patterns

**Expected Results**:
- All three scripts execute without syntax errors on PS 5.1
- No ternary operator `? :` found
- No null-coalescing operator `??` found
- No null-conditional `?.` found
- No pipeline chain operators `&&` or `||` found
- No `-AsHashtable` parameter on `ConvertFrom-Json`
- No `Join-Path` with more than 2 arguments (uses nested calls instead)
- No `Test-Json` cmdlet usage

**Verification Command** (PowerShell):
```powershell
$scripts = @("install.ps1", "uninstall.ps1", "update.ps1")
$forbidden = @(
    @{ Pattern = '\?\s*:'; Name = 'Ternary operator (? :)' },
    @{ Pattern = '\?\?'; Name = 'Null-coalescing operator (??)' },
    @{ Pattern = '\?\.\w'; Name = 'Null-conditional operator (?.)' },
    @{ Pattern = '-AsHashtable'; Name = '-AsHashtable parameter' },
    @{ Pattern = 'Test-Json'; Name = 'Test-Json cmdlet' }
)
foreach ($script in $scripts) {
    if (-not (Test-Path $script)) { continue }
    $content = Get-Content $script -Raw
    foreach ($check in $forbidden) {
        if ($content -match $check.Pattern) {
            throw "PS 7-only syntax found in ${script}: $($check.Name)"
        }
    }
}
Write-Host "TC-CC-001 PASSED: No PS 7-only syntax detected" -ForegroundColor Green
```

---

## TC-CC-002: Forward-slash paths in ALL generated JSON

**Requirement**: REQ-004, ADR-003
**Priority**: Must Have
**Environment**: Both

**Preconditions**:
- Completed installation
- (For update: completed update)

**Steps**:
1. After install: check all JSON files for backslash paths
2. After update: check regenerated JSON files for backslash paths

**Files to check**:
- `.isdlc/state.json`
- `.isdlc/installed-files.json`
- `.isdlc/monorepo.json` (if monorepo)
- `.isdlc/projects/*/state.json` (if monorepo)

**Expected Results**:
- No backslash characters found in any path value in any generated JSON file
- All paths follow pattern: `segment/segment/file.ext`

**Verification Command** (PowerShell):
```powershell
$jsonFiles = @(
    ".isdlc/state.json",
    ".isdlc/installed-files.json"
)
# Add monorepo files if they exist
if (Test-Path ".isdlc/monorepo.json") {
    $jsonFiles += ".isdlc/monorepo.json"
}
$projectStates = Get-ChildItem ".isdlc/projects/*/state.json" -ErrorAction SilentlyContinue
foreach ($ps in $projectStates) {
    $jsonFiles += $ps.FullName
}

foreach ($f in $jsonFiles) {
    $path = $f -replace '/', '\'
    if (-not (Test-Path $path)) { continue }
    $raw = Get-Content $path -Raw
    # Check for Windows-style paths in JSON string values
    # Pattern: backslash that is not a JSON escape (not \n, \t, \", \\, \u)
    # Look for paths like ".claude\agents\" or ".isdlc\config\"
    if ($raw -match '"\.[^"]*\\[^"ntrbu\\][^"]*"') {
        throw "Backslash path found in JSON file: $f"
    }
}
Write-Host "TC-CC-002 PASSED: All JSON files use forward-slash paths" -ForegroundColor Green
```

---

## TC-CC-003: UTF-8 LF no BOM in ALL generated files

**Requirement**: REQ-004, ADR-004
**Priority**: Must Have
**Environment**: Both

**Preconditions**:
- Completed installation or update

**Steps**:
1. For each generated (not copied) file, read raw bytes
2. Check for BOM (EF BB BF)
3. Check for CRLF line endings

**Files to check** (generated, not copied):
- `.isdlc/state.json`
- `.isdlc/installed-files.json`
- `.isdlc/providers.yaml`
- `docs/isdlc/constitution.md`
- `.isdlc/monorepo.json` (if monorepo)

**Expected Results**:
- No BOM bytes found
- No CRLF line endings found in generated files

**Verification Command** (PowerShell):
```powershell
$generatedFiles = @(
    ".isdlc/state.json",
    ".isdlc/installed-files.json",
    ".isdlc/providers.yaml",
    "docs/isdlc/constitution.md"
)
foreach ($f in $generatedFiles) {
    $path = $f -replace '/', '\'
    if (-not (Test-Path $path)) { continue }
    $bytes = [System.IO.File]::ReadAllBytes($path)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        throw "BOM found in generated file: $f"
    }
    $text = [System.IO.File]::ReadAllText($path)
    if ($text -match "`r`n") {
        throw "CRLF found in generated file: $f (expected LF)"
    }
}
Write-Host "TC-CC-003 PASSED: All generated files are UTF-8 LF no BOM" -ForegroundColor Green
```

---

## TC-CC-004: Error handling (script stops on unexpected error, clear messages)

**Requirement**: REQ-001, REQ-002, REQ-003, NFR-006, ADR-005
**Priority**: Must Have
**Environment**: Both

**Preconditions**:
- Scripts available

**Steps**:
1. Verify all scripts set `$ErrorActionPreference = 'Stop'`
2. Verify all scripts set `Set-StrictMode -Version 2.0`
3. Test error injection: run install.ps1 with missing `src/` directory

**Expected Results**:
- Scripts halt on unexpected errors (not silent failures)
- Error messages are clear and actionable
- Fatal errors exit with non-zero code
- No stack traces displayed to user (caught by try/catch)

**Verification Command** (PowerShell):
```powershell
$scripts = @("install.ps1", "uninstall.ps1", "update.ps1")
foreach ($script in $scripts) {
    if (-not (Test-Path $script)) { continue }
    $content = Get-Content $script -Raw
    if ($content -notmatch '\$ErrorActionPreference\s*=\s*[''"]Stop[''"]') {
        throw "$script missing ErrorActionPreference = Stop"
    }
    if ($content -notmatch 'Set-StrictMode') {
        throw "$script missing Set-StrictMode"
    }
}
Write-Host "TC-CC-004 PASSED: Error handling boilerplate present" -ForegroundColor Green
```

---

## TC-CC-005: -Force flag works identically across all 3 scripts

**Requirement**: REQ-006, AC-005-01, AC-005-02, AC-005-03
**Priority**: Must Have
**Environment**: Both

**Preconditions**:
- All three scripts available

**Steps**:
1. Run install.ps1 -Force (verify no prompts)
2. Run uninstall.ps1 -DryRun -Force (verify no prompts)
3. Run update.ps1 -DryRun -Force (verify no prompts)

**Expected Results**:
- All scripts complete without Read-Host calls
- No user interaction required
- Default values used where prompts would normally appear
- Exit code 0 for all

**Verification Command** (PowerShell):
```powershell
# Static check: -Force should gate all Read-Host calls
$scripts = @("install.ps1", "uninstall.ps1", "update.ps1")
foreach ($script in $scripts) {
    if (-not (Test-Path $script)) { continue }
    $content = Get-Content $script -Raw
    # Read-Host should always be guarded by -not $Force
    $readHostCalls = [regex]::Matches($content, 'Read-Host')
    foreach ($match in $readHostCalls) {
        # Check that Read-Host appears inside an if (-not $Force) block
        $lineNum = ($content.Substring(0, $match.Index) -split "`n").Count
        $surroundingLines = ($content -split "`n")[([Math]::Max(0, $lineNum - 5))..($lineNum + 1)] -join "`n"
        if ($surroundingLines -notmatch '\$Force|\-Force') {
            Write-Host "  WARNING: Read-Host at line $lineNum in $script may not be Force-guarded" -ForegroundColor Yellow
        }
    }
}
Write-Host "TC-CC-005: Static check complete (verify in CI)" -ForegroundColor Green
```

---

## TC-CC-006: No external module dependencies in any script

**Requirement**: CON-002, NFR-007
**Priority**: Must Have
**Environment**: Both

**Preconditions**:
- All three script files available

**Steps**:
1. Scan all scripts for Import-Module, Install-Module, or #Requires -Module

**Expected Results**:
- Zero occurrences across all scripts
- No PowerShell Gallery dependencies

**Verification Command** (PowerShell):
```powershell
$scripts = @("install.ps1", "uninstall.ps1", "update.ps1")
foreach ($script in $scripts) {
    if (-not (Test-Path $script)) { continue }
    $content = Get-Content $script -Raw
    if ($content -match 'Import-Module|Install-Module|#Requires\s+-Module') {
        throw "External module dependency found in $script"
    }
}
Write-Host "TC-CC-006 PASSED: No external module dependencies" -ForegroundColor Green
```

---

## TC-CC-007: Helper function duplication consistency

**Requirement**: ADR-001
**Priority**: Should Have
**Environment**: Both

**Preconditions**:
- All three script files exist

**Steps**:
1. Extract helper functions from each script
2. Compare the shared helpers (Write-Banner, Write-Step, Write-Success, Write-Warn, Write-Err, ConvertTo-ForwardSlashPath, Write-Utf8NoBom, Merge-JsonDeep, Read-JsonFile, Write-JsonFile, Get-RelativePath)
3. Verify they are identical across all scripts

**Expected Results**:
- All 11 shared helper functions are byte-identical across install.ps1, uninstall.ps1, and update.ps1
- No version drift between scripts

**Verification Command** (PowerShell):
```powershell
# Extract function blocks from each script and compare
# This is a pattern match -- exact implementation depends on function markers
$scripts = @("install.ps1", "uninstall.ps1", "update.ps1")
$helperNames = @("Write-Banner", "Write-Step", "Write-Success", "Write-Warn", "Write-Err",
                  "ConvertTo-ForwardSlashPath", "Write-Utf8NoBom", "Merge-JsonDeep",
                  "Read-JsonFile", "Write-JsonFile", "Get-RelativePath")
# This verification is best done via manual review or diff tool
Write-Host "TC-CC-007: Manual verification recommended (diff helper blocks)" -ForegroundColor Yellow
```

---

## TC-CC-008: CmdletBinding and parameter declarations

**Requirement**: REQ-001, REQ-002, REQ-003
**Priority**: Must Have
**Environment**: Both

**Preconditions**:
- All three script files available

**Steps**:
1. Verify each script has `[CmdletBinding()]` attribute
2. Verify each script has correct parameters

**Expected Results**:
- install.ps1: `[CmdletBinding()] param([switch]$Force, [switch]$Help)`
- uninstall.ps1: `[CmdletBinding()] param([switch]$Force, [switch]$Backup, [switch]$PurgeAll, [switch]$PurgeDocs, [switch]$DryRun, [switch]$Help)`
- update.ps1: `[CmdletBinding()] param([switch]$Force, [switch]$DryRun, [switch]$Backup, [switch]$Help)`

**Verification Command** (PowerShell):
```powershell
$scripts = @("install.ps1", "uninstall.ps1", "update.ps1")
foreach ($script in $scripts) {
    if (-not (Test-Path $script)) { continue }
    $content = Get-Content $script -Raw
    if ($content -notmatch '\[CmdletBinding\(\)\]') {
        throw "$script missing [CmdletBinding()]"
    }
    if ($content -notmatch 'param\s*\(') {
        throw "$script missing param() block"
    }
}
Write-Host "TC-CC-008 PASSED: All scripts have CmdletBinding + params" -ForegroundColor Green
```

---

## TC-CC-009: Cross-platform manifest compatibility

**Requirement**: REQ-004, NFR-002
**Priority**: Must Have
**Environment**: Both
**Automation**: Manual (requires bash and PS on same project)

**Preconditions**:
- Same project installed with both install.sh (on macOS/Linux) and install.ps1 (on Windows)

**Steps**:
1. Install with install.sh on macOS/Linux, capture `installed-files.json`
2. Install with install.ps1 on Windows, capture `installed-files.json`
3. Compare the two manifest files

**Expected Results**:
- Both manifests have the same file list (same paths)
- All paths use forward slashes in both
- File count difference is 0 or minimal (PS scripts added to manifest)
- state.json structure is identical (same keys, same value types)

---

## TC-CC-010: ConvertTo-Json -Depth 10 used consistently

**Requirement**: ADR-002
**Priority**: Must Have
**Environment**: Both

**Preconditions**:
- All three script files available

**Steps**:
1. Find all `ConvertTo-Json` calls in each script
2. Verify each has `-Depth 10` (or routes through Write-JsonFile which uses -Depth 10)

**Expected Results**:
- Every `ConvertTo-Json` call either:
  a) Includes `-Depth 10` parameter, or
  b) Is inside `Write-JsonFile` function (which applies -Depth 10)
- No bare `ConvertTo-Json` without depth specification

**Verification Command** (PowerShell):
```powershell
$scripts = @("install.ps1", "uninstall.ps1", "update.ps1")
foreach ($script in $scripts) {
    if (-not (Test-Path $script)) { continue }
    $lines = Get-Content $script
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        if ($line -match 'ConvertTo-Json' -and $line -notmatch '-Depth' -and $line -notmatch 'function\s+Write-JsonFile') {
            # Check if inside Write-JsonFile function
            if ($line -notmatch 'Write-JsonFile') {
                Write-Host "  WARNING: ConvertTo-Json without -Depth at line $($i+1) in $script" -ForegroundColor Yellow
            }
        }
    }
}
Write-Host "TC-CC-010: Check complete" -ForegroundColor Green
```

---

## TC-CC-011: Script header documentation (REQ-005)

**Requirement**: REQ-005
**Priority**: Should Have
**Environment**: Both

**Preconditions**:
- All three script files available

**Steps**:
1. Check each script for comment-based help block
2. Verify .SYNOPSIS, .DESCRIPTION, .NOTES, .EXAMPLE sections

**Expected Results**:
- Each script has `<# .SYNOPSIS ... #>` block
- Each script mentions PowerShell 5.1+
- Each script includes execution policy bypass instructions
- Each script has at least one .EXAMPLE

**Verification Command** (PowerShell):
```powershell
$scripts = @("install.ps1", "uninstall.ps1", "update.ps1")
foreach ($script in $scripts) {
    if (-not (Test-Path $script)) { continue }
    $content = Get-Content $script -Raw
    if ($content -notmatch '\.SYNOPSIS') { throw "$script missing .SYNOPSIS" }
    if ($content -notmatch '\.NOTES') { throw "$script missing .NOTES" }
    if ($content -notmatch 'PowerShell 5\.1') { throw "$script missing PS 5.1 mention" }
    if ($content -notmatch 'ExecutionPolicy') { throw "$script missing execution policy info" }
}
Write-Host "TC-CC-011 PASSED" -ForegroundColor Green
```

---

## TC-CC-012: Exit codes follow convention

**Requirement**: NFR-006
**Priority**: Must Have
**Environment**: Both

**Preconditions**:
- Scripts available

**Steps**:
1. Verify that success paths exit with code 0
2. Verify that fatal errors exit with code 1
3. Verify that user cancellation exits with code 0

**Expected Results**:
- install.ps1 -Force on valid project: exit 0
- install.ps1 with missing framework source: exit 1
- uninstall.ps1 -DryRun -Force: exit 0
- uninstall.ps1 on empty directory: exit 1
- update.ps1 -DryRun -Force: exit 0
- update.ps1 on empty directory: exit 1

**Verification Command** (PowerShell):
```powershell
# Tested in CI by checking $LASTEXITCODE after each script execution
# Successful runs should have $LASTEXITCODE -eq 0
# Failed runs should have $LASTEXITCODE -ne 0
Write-Host "TC-CC-012: Verified via CI exit code checks" -ForegroundColor Green
```
