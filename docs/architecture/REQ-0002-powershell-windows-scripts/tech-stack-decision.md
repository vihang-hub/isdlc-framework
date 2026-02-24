# Tech Stack Decision: PowerShell Scripts for Windows

**Feature**: REQ-0002-powershell-windows-scripts
**Phase**: 03 - Architecture
**Created**: 2026-02-08

---

## Decision Summary

| Aspect | Choice | Rationale |
|--------|--------|-----------|
| Language | PowerShell | Windows-native scripting; ships with Windows 10/11 |
| Minimum Version | 5.1 (Windows PowerShell) | Ships with all supported Windows versions |
| Also Supports | 7+ (pwsh) | Cross-platform PowerShell; tested in CI |
| External Dependencies | None | Built-in cmdlets + .NET BCL only (CON-002) |
| JSON Handling | ConvertFrom-Json / ConvertTo-Json | Built-in since PS 3.0 |
| File I/O | [System.IO.File]::WriteAllText() | Explicit encoding control (UTF-8, LF, no BOM) |
| Path Handling | Join-Path + manual forward-slash conversion | OS-native construction, cross-platform output |
| Testing | GitHub Actions (windows-latest) | Real execution on both PS 5.1 and PS 7 |
| Test Framework | None (integration tests only) | Article XI: real execution over mocked tests |

## Alternatives Considered

### 1. Batch Script (.bat/.cmd)

**Rejected**: Batch scripting has no native JSON handling, no structured error handling, limited string manipulation, and is generally considered a legacy technology. PowerShell is Microsoft's recommended scripting language for Windows automation.

### 2. PowerShell with PSScriptAnalyzer

**Deferred**: PSScriptAnalyzer is a static analysis tool for PowerShell. It would be valuable but requires installation (`Install-Module`), which violates CON-002 (no external modules). Can be added later as an optional CI step.

### 3. PowerShell Module (.psm1)

**Rejected**: A proper PowerShell module would require `Import-Module` and either a module manifest or a known module path. This adds complexity and failure modes. Scripts are simpler for one-time execution tasks (install/uninstall/update).

### 4. Cross-Platform Node.js CLI Only

**Deferred**: The Node.js CLI (`npx isdlc init`) is the long-term solution. PowerShell scripts are the interim solution while npm publishing is not ready. Both pathways will coexist.

## Compatibility Notes

### PowerShell 5.1 vs 7+ Differences That Affect This Feature

| Area | PS 5.1 Behavior | PS 7+ Behavior | Our Approach |
|------|-----------------|----------------|-------------|
| ConvertFrom-Json output | PSCustomObject | PSCustomObject (or Hashtable with -AsHashtable) | Use PSCustomObject always |
| ConvertTo-Json -Depth | Default 2 | Default 2 | Always specify -Depth 10 |
| Set-Content encoding | System default (usually CRLF) | UTF-8 no BOM | Use [System.IO.File]::WriteAllText() |
| Join-Path segments | 2 only | 2+ with -AdditionalChildPath | Nested Join-Path calls |
| Null handling | $null | $null | Same |
| String interpolation | Supported | Supported | Same |
| [CmdletBinding()] | Supported | Supported | Same |
