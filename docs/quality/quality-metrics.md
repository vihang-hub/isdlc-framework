# Quality Metrics: REQ-0002-powershell-windows-scripts

**Date**: 2026-02-08
**Phase**: 08 - Code Review & QA

---

## Code Volume

| File | Total Lines | Code Lines | Blank | Comment | Functions |
|------|-------------|------------|-------|---------|-----------|
| install.ps1 | 1725 | 1395 | 204 | 126 | 14 |
| uninstall.ps1 | 1018 | 832 | 109 | 77 | 11 |
| update.ps1 | 762 | 604 | 93 | 65 | 12 |
| **Total** | **3505** | **2831** | **406** | **268** | **37** |

Comment/blank ratio: 20% (acceptable for script code)

## Complexity

| File | if | elseif | else | switch | foreach | for | Rough Cyclomatic |
|------|-----|--------|------|--------|---------|-----|------------------|
| install.ps1 | 116 | 4 | 29 | 2 | 29 | 1 | 153 |
| uninstall.ps1 | 109 | 2 | 30 | 1 | 24 | 0 | 137 |
| update.ps1 | 69 | 2 | 24 | 0 | 11 | 0 | 83 |

Note: High cyclomatic complexity is expected for installer scripts that handle many edge cases. The complexity is distributed across many independent step blocks (not concentrated in single functions).

## Function Size

Longest functions (all well within acceptable limits):

| Function | File | Lines |
|----------|------|-------|
| Test-MonorepoIndicators | install.ps1 | 55 |
| New-ManifestJson | install.ps1/update.ps1 | 30 |
| Merge-JsonDeep | all | 27 |
| Test-ProjectExists | install.ps1 | 21 |
| Write-Banner | all | 15 |

No function exceeds 55 lines. No "god functions" detected.

## Static Analysis

| Check | install.ps1 | uninstall.ps1 | update.ps1 |
|-------|-------------|---------------|------------|
| CmdletBinding | YES | YES | YES |
| Set-StrictMode 2.0 | YES | YES | YES |
| ErrorActionPreference Stop | YES | YES | YES |
| PS 7-only syntax | NONE | NONE | NONE |
| Injection vectors | NONE | NONE | NONE |
| Raw file writes (non-UTF8) | NONE | NONE | NONE |
| Missing -ErrorAction | NONE | NONE | NONE |

## Helper Function Consistency

11 shared helper functions verified IDENTICAL across all 3 scripts (byte-for-byte match).

## DryRun Coverage

| File | $DryRun references | Remove-Item calls | Copy-Item -Recurse | Write-JsonFile |
|------|--------------------|--------------------|---------------------|----------------|
| install.ps1 | 0 (no DryRun param) | 9 | 7 | 7 |
| uninstall.ps1 | 22 | 15 | 1 | 2 |
| update.ps1 | 20 | 2 | 4 | 5 |

## Test Suite Status

- ESM tests: 312/312 passing
- CJS hook tests: 284/284 passing
- Total: 596/596 passing (0 failures)
- CI PowerShell job: Configured for pwsh + powershell matrix on windows-latest
