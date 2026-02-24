# Module Design: Shared Helper Functions

**Feature**: REQ-0002-powershell-windows-scripts
**Phase**: 04 - Design
**Created**: 2026-02-08
**Status**: Draft
**ADR References**: ADR-001 (Inline Helpers), ADR-002 (JSON Deep Merge), ADR-003 (Path Normalization), ADR-004 (Line Endings), ADR-005 (Error Handling), ADR-007 (PS 5.1 Compat)

---

## 1. Overview

Per ADR-001, helper functions are inlined at the top of each script (no shared module file). This document defines the exact signatures, behavior, and test contracts for each helper. All three scripts (install.ps1, uninstall.ps1, update.ps1) include identical copies of these functions.

---

## 2. Script Boilerplate (All Scripts)

Every script starts with:

```powershell
<#
.SYNOPSIS
    iSDLC Framework - [Install/Uninstall/Update] Script for Windows
.DESCRIPTION
    [Purpose description]
.NOTES
    Requires: PowerShell 5.1+ (Windows PowerShell) or PowerShell 7+ (pwsh)
    No external modules required.

    Execution Policy: If blocked, run one of:
      Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
      powershell -ExecutionPolicy Bypass -File .\[script].ps1
#>

[CmdletBinding()]
param(
    # Script-specific parameters declared here
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
```

---

## 3. Helper Function Specifications

### 3.1 Write-Banner

**Purpose**: Display a colored banner box (matches bash CYAN box output).

```powershell
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
```

**Bash equivalent**: `echo -e "${CYAN}+====...====+${NC}"`

**Behavioral contract**:
- Outputs 3 lines (top border, text, bottom border) plus blank lines
- Text is left-padded to fill the box width
- Uses Unicode box-drawing characters for visual consistency
- Color: Cyan foreground

---

### 3.2 Write-Step

**Purpose**: Display a step progress indicator (e.g., "[1/6] Setting up...").

```powershell
function Write-Step {
    param(
        [Parameter(Mandatory)] [string]$Number,
        [Parameter(Mandatory)] [string]$Total,
        [Parameter(Mandatory)] [string]$Message
    )
    Write-Host "[$Number/$Total] " -ForegroundColor Blue -NoNewline
    Write-Host $Message
}
```

**Bash equivalent**: `echo -e "${BLUE}[1/6]${NC} Setting up..."`

---

### 3.3 Write-Success

**Purpose**: Display a success message with green checkmark.

```powershell
function Write-Success {
    param(
        [Parameter(Mandatory)] [string]$Message
    )
    Write-Host "  [OK] $Message" -ForegroundColor Green
}
```

**Bash equivalent**: `echo -e "${GREEN}  + $Message${NC}"`

**Note**: Uses `[OK]` instead of Unicode checkmark to ensure compatibility across all Windows terminal configurations. Some older Windows consoles do not render Unicode checkmarks correctly.

---

### 3.4 Write-Warn

**Purpose**: Display a warning message in yellow.

```powershell
function Write-Warn {
    param(
        [Parameter(Mandatory)] [string]$Message
    )
    Write-Host "  $Message" -ForegroundColor Yellow
}
```

**Bash equivalent**: `echo -e "${YELLOW}  $Message${NC}"`

---

### 3.5 Write-Err

**Purpose**: Display an error message in red.

```powershell
function Write-Err {
    param(
        [Parameter(Mandatory)] [string]$Message
    )
    Write-Host "  $Message" -ForegroundColor Red
}
```

**Bash equivalent**: `echo -e "${RED}  $Message${NC}"`

---

### 3.6 ConvertTo-ForwardSlashPath

**Purpose**: Convert Windows backslash paths to forward slashes for JSON output.

```powershell
function ConvertTo-ForwardSlashPath {
    param(
        [Parameter(Mandatory)] [string]$Path
    )
    return $Path -replace '\\', '/'
}
```

**Bash equivalent**: N/A (bash natively uses forward slashes)

**Application rules** (from ADR-003):
1. Apply ONLY when inserting paths into JSON structures
2. Internal PowerShell operations use native `Join-Path` paths
3. Call at the JSON boundary, not before file operations

**Examples**:
```
Input:  ".claude\agents\01-requirements-analyst.md"
Output: ".claude/agents/01-requirements-analyst.md"

Input:  ".isdlc\projects\frontend\state.json"
Output: ".isdlc/projects/frontend/state.json"
```

---

### 3.7 Write-Utf8NoBom

**Purpose**: Write text to a file using UTF-8 encoding without BOM, with LF line endings.

```powershell
function Write-Utf8NoBom {
    param(
        [Parameter(Mandatory)] [string]$Path,
        [Parameter(Mandatory)] [string]$Content
    )
    $Content = $Content -replace "`r`n", "`n"
    $Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $Utf8NoBom)
}
```

**Bash equivalent**: Standard file output (bash defaults to UTF-8 LF on Linux/macOS)

**Why not Set-Content**: In PS 5.1, `Set-Content` writes CRLF by default and `-Encoding utf8` adds a BOM. Both break cross-platform compatibility.

**Why not Out-File**: Same BOM issue in PS 5.1.

---

### 3.8 Merge-JsonDeep

**Purpose**: Recursively merge two PSCustomObject trees (JSON deep merge matching `jq -s '.[0] * .[1]'`).

```powershell
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
```

**Semantics** (identical to `jq -s '.[0] * .[1]'`):
- Object + Object: recursive merge
- Array + Array: override replaces base entirely
- Scalar + Scalar: override replaces base
- Missing key in base: added from override
- Null in base: override wins
- Null in override: null wins (override takes precedence)

**Edge cases**:
- Empty objects merge to empty object
- Deeply nested objects (5+ levels) recurse correctly
- Mixed types (base is string, override is object): override wins

---

### 3.9 Read-JsonFile

**Purpose**: Safely read and parse a JSON file, returning $null on failure.

```powershell
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
```

**Bash equivalent**: `jq '.' "$file" 2>/dev/null`

---

### 3.10 Write-JsonFile

**Purpose**: Serialize an object to JSON and write with UTF-8/LF encoding.

```powershell
function Write-JsonFile {
    param(
        [Parameter(Mandatory)] [string]$Path,
        [Parameter(Mandatory)] $Object,
        [int]$Depth = 10
    )
    $json = $Object | ConvertTo-Json -Depth $Depth
    Write-Utf8NoBom -Path $Path -Content $json
}
```

**Why -Depth 10**: ConvertTo-Json defaults to depth 2, which silently truncates nested objects as strings. state.json has nested objects 4-5 levels deep. Depth 10 provides safe headroom.

---

### 3.11 Get-RelativePath

**Purpose**: Get a file's path relative to the project root, with forward slashes.

```powershell
function Get-RelativePath {
    param(
        [Parameter(Mandatory)] [string]$FullPath,
        [Parameter(Mandatory)] [string]$BasePath
    )
    $rel = $FullPath.Substring($BasePath.Length)
    if ($rel.StartsWith('\') -or $rel.StartsWith('/')) {
        $rel = $rel.Substring(1)
    }
    return ConvertTo-ForwardSlashPath $rel
}
```

**Bash equivalent**: `"${file#$PROJECT_ROOT/}"`

---

## 4. Functions NOT Shared (Script-Specific)

These functions appear in only one script and are documented in that script's design:

| Function | Script | Purpose |
|----------|--------|---------|
| `Test-ProjectExists` | install.ps1 | Detect existing project indicators |
| `Test-MonorepoIndicators` | install.ps1 | Detect monorepo workspace files |
| `Get-MonorepoProjects` | install.ps1 | Auto-detect sub-projects |
| `New-StateJson` | install.ps1 | Generate state.json template |
| `New-ConstitutionMd` | install.ps1 | Generate constitution template |
| `New-ManifestJson` | install.ps1, update.ps1 | Build installation manifest |

---

## 5. Helper Function Duplication Strategy

All helper functions (3.1-3.11) are duplicated verbatim across all three scripts. To maintain consistency:

1. **Source of truth**: install.ps1 contains the canonical implementation
2. **Copy rule**: When modifying a helper, update all three scripts
3. **Verification**: CI test compares helper function blocks across scripts (byte-identical)
4. **Total duplicated lines**: ~120 lines per script (11 functions)

---

## 6. Traceability

| Helper | Requirements | ADRs | Constitutional Articles |
|--------|-------------|------|------------------------|
| Write-Banner | REQ-001, REQ-002, REQ-003 | ADR-001 | V (Simplicity) |
| Write-Step | REQ-001, REQ-003 | ADR-001 | V |
| Write-Success/Warn/Err | REQ-001, REQ-002, REQ-003 | ADR-001 | V |
| ConvertTo-ForwardSlashPath | REQ-004 | ADR-003 | XII (Cross-Platform) |
| Write-Utf8NoBom | REQ-004 | ADR-004 | XII |
| Merge-JsonDeep | REQ-001, REQ-003 | ADR-002 | I (Specification Primacy) |
| Read-JsonFile | REQ-001, REQ-002, REQ-003 | ADR-005 | X (Fail-Safe) |
| Write-JsonFile | REQ-001, REQ-003 | ADR-002, ADR-004 | I, XII |
| Get-RelativePath | REQ-004 | ADR-003 | XII |
