# Static Analysis Report: REQ-0002-powershell-windows-scripts

**Date**: 2026-02-08
**Phase**: 08 - Code Review & QA

---

## Analysis Performed

Since these are PowerShell scripts (not Node.js code), static analysis was performed via custom Python-based checkers targeting PowerShell-specific patterns.

## Checks Performed

### 1. PS 5.1 Compatibility (ADR-007)

Scanned all 3 scripts for PowerShell 7-only syntax:

| Pattern | Description | Found |
|---------|-------------|-------|
| `? :` | Ternary operator | 0 |
| `??` | Null-coalescing operator | 0 |
| `-AsHashtable` | ConvertFrom-Json -AsHashtable | 0 |
| `Join-String` | PS 6.2+ cmdlet | 0 |
| `ForEach-Object -Parallel` | PS 7 parallel | 0 |
| `-EscapeHandling` | PS 7.3+ parameter | 0 |

**Result**: PASS - All scripts are PS 5.1 compatible.

### 2. Error Handling (ADR-005)

| Check | install.ps1 | uninstall.ps1 | update.ps1 |
|-------|-------------|---------------|------------|
| Set-StrictMode -Version 2.0 | YES | YES | YES |
| $ErrorActionPreference = 'Stop' | YES | YES | YES |
| try/catch blocks | 4 | 1 | 1 |
| -ErrorAction SilentlyContinue on non-critical ops | YES | YES | YES |
| exit codes (0/1) | 4 | 6 | 7 |

**Result**: PASS

### 3. File Write Safety (ADR-004)

Scanned for raw file write operations (Set-Content, Out-File, Add-Content) that bypass Write-Utf8NoBom:

| File | Set-Content | Out-File | Add-Content |
|------|-------------|----------|-------------|
| install.ps1 | 0 | 0 | 0 |
| uninstall.ps1 | 0 | 0 | 0 |
| update.ps1 | 0 | 0 | 0 |

All file writes go through Write-Utf8NoBom or Write-JsonFile (which calls Write-Utf8NoBom).

**Result**: PASS

### 4. Path Normalization (ADR-003)

All paths written to JSON files pass through ConvertTo-ForwardSlashPath (via Get-RelativePath). CI assertion confirms no backslashes in manifest paths.

**Result**: PASS

### 5. Security Analysis

| Check | Result |
|-------|--------|
| Invoke-Expression / iex | NOT FOUND |
| Start-Process with user input | NOT FOUND |
| Network calls (Invoke-WebRequest etc.) | NOT FOUND |
| Elevation/admin requirement | NOT FOUND |
| Secrets/credentials in source | NOT FOUND |
| Environment variable injection | NOT FOUND |

**Result**: PASS

### 6. Parameter Handling

All scripts use [CmdletBinding()] and [switch] parameters. No positional parameters that could be accidentally triggered.

**Result**: PASS

## Overall Static Analysis Result

**PASS** - No errors, no warnings. All ADR compliance checks satisfied.
