# Code Review Report: REQ-0002-powershell-windows-scripts

**Phase**: 08 - Code Review & QA
**Reviewer**: QA Engineer (qa-engineer)
**Date**: 2026-02-08
**Branch**: feature/REQ-0002-powershell-windows-scripts

---

## Summary

| Metric | Value |
|--------|-------|
| Files reviewed | 6 (install.ps1, uninstall.ps1, update.ps1, ci.yml, lib/installer.js, README.md) |
| Total new lines | 3505 (PowerShell) + ~128 (CI) + 1 (installer.js) + ~18 (README) |
| Issues found | 0 Critical, 0 Major, 2 Minor, 1 Cosmetic |
| Issues fixed | 0 (none required fixing) |
| Overall status | **APPROVED** |

---

## 1. install.ps1 (1725 lines)

### 1.1 Logic Correctness

- All 20 features from REQ-001 implemented and verified against install.sh
- Step numbering matches bash: 0 (prereqs) -> 0b (banner) -> 0c (detect project) -> 0d (detect monorepo) -> 0e (confirm monorepo) -> 0f (Claude Code detection) -> 0g (provider config) -> 1/6 -> 1b/6 -> 2/6 -> 3/6 -> 3b/6 -> 4/6 -> 5/6 -> 6/6 -> tour -> next steps
- state.json template matches bash output exactly (all 20+ fields present)
- Provider options match: claude-code, quality, free, budget, local, hybrid (6 options)
- Claude Code detection with soft-gate (warn, offer continue, not block)

### 1.2 Edge Cases

- Empty project directory: Handled via Test-ProjectExists returning $false
- Special characters in paths: Join-Path handles natively; ConvertTo-ForwardSlashPath only replaces backslashes
- Missing framework source: Checked with Test-Path before copy operations
- -Force mode: All Read-Host prompts guarded by `if (-not $Force)`
- Monorepo with no detected projects: Falls back to manual entry, then to single-project mode

### 1.3 Variable Scoping

- All script variables are script-scoped (no function-scope leaks)
- Set-StrictMode -Version 2.0 catches undefined variable references
- $ScriptDir, $ProjectRoot, $FrameworkDir properly derived from $MyInvocation

### 1.4 String Handling

- No Invoke-Expression or iex usage (no injection vectors)
- String interpolation uses PowerShell native "$variable" syntax (safe)
- Here-string (@'...'@) used for multi-line templates (constitution, docs README)
- Python fallback for YAML conversion properly escapes backslashes

### 1.5 Error Handling

- $ErrorActionPreference = 'Stop' ensures terminating errors on all cmdlets
- try/catch blocks around external commands (claude --version, yq, python)
- -ErrorAction SilentlyContinue on non-critical operations (Get-ChildItem, Remove-Item cleanup)
- Exit codes: 0 for success/cancel, 1 for fatal errors

### 1.6 Console Output

- Write-Banner uses Unicode box-drawing characters (identical to bash)
- Colors: Cyan (banner), Blue (steps), Green (success), Yellow (warnings), Red (errors)
- Step numbering consistent: [1/6], [1b/6], [2/6] etc.
- Tour sections properly formatted with conditional output

### 1.7 Template Accuracy

- state.json: All fields match bash output including skill_enforcement.mode = "observe"
- providers.yaml: Template substitution uses regex replace (same as sed in bash)
- constitution.md: Starter template with CONSTITUTION_STATUS marker, identical content
- Installation manifest: Same JSON structure (version, created, framework_version, files)

### 1.8 Manifest Generation

- New-ManifestJson function scans .claude/{agents,skills,commands,hooks} + settings.json
- Get-RelativePath produces forward-slash paths via ConvertTo-ForwardSlashPath
- Verified: No backslash paths leak into manifest (CI assertion confirms this)

### VERDICT: PASS

---

## 2. uninstall.ps1 (1018 lines)

### 2.1 Safety

- Manifest-based removal: ONLY files in installed-files.json are deleted
- Legacy mode (no manifest): Uses pattern matching with conservative framework patterns
- User-created files explicitly tracked and reported as "PRESERVED"
- $PurgeAll and $PurgeDocs are separate flags (user must opt-in to destructive behavior)

### 2.2 Preservation

All preserved items verified:
- .isdlc/state.json: Preserved in normal mode, only deleted with -PurgeAll
- .isdlc/providers.yaml: Inside .isdlc/, protected by general .isdlc/ preservation logic
- docs/isdlc/constitution.md: Listed in preserveChecks array (line 788)
- CLAUDE.md: Never touched (not in any removal list)
- .claude/settings.local.json: Explicitly checked when deciding whether to remove .claude/
- Per-project states (.isdlc/projects/): Listed in preservation display

### 2.3 Settings Cleanup

- Removes "hooks" and "permissions" keys from settings.json (line 669-674)
- If settings.json becomes empty after removal, deletes the file entirely
- Writes cleaned settings.json via Write-JsonFile (UTF-8 NoBOM)

### 2.4 Dry-Run Compliance

- 22 $DryRun references throughout the script
- Every Remove-Item, Write-JsonFile, and Move-Item guarded by DryRun check
- Dry-run output prefixed with "[dry-run]"
- No file system mutations in DryRun mode (verified by CI assertion)

### 2.5 Empty Directory Cleanup

- After file removal, iterates directories deepest-first (Sort-Object by path length descending)
- Only removes directories with zero children
- Hooks subdirectories (lib, config, tests) cleaned separately

### VERDICT: PASS

---

## 3. update.ps1 (762 lines)

### 3.1 Version Comparison

- Reads installed version from state.json framework_version field
- Reads new version from package.json in framework source
- String equality check: if same version and no -Force, exits early
- Note: This is string comparison, not semantic versioning. However, this matches the bash behavior exactly (bash also uses string equality). For the current single-version track this is sufficient.

### 3.2 Deep Merge

- Merge-JsonDeep: Identical implementation to install.ps1 (verified by byte-comparison)
- Applied to both settings.json and settings.local.json
- Semantics: object+object=recursive merge, scalar+scalar=override wins, new keys=added
- Matches jq -s '.[0] * .[1]' semantics

### 3.3 Obsolete File Cleanup

- Loads old manifest, builds new file list from current .claude/ contents
- Compares old vs new: files in old but not in new are removed
- Only removes files that still exist on disk (Test-Path check)
- DryRun guard on all Remove-Item calls

### 3.4 State.json Update

- Only modifies: framework_version (line 649) and history array (lines 651-665)
- History entry: timestamp, agent="update-script", action description
- Array handling: converts to ArrayList, appends, converts back to array
- All other state.json fields left untouched

### 3.5 Monorepo Handling

- Checks for monorepo.json existence
- Iterates .isdlc/projects/* directories
- Updates each per-project state.json: framework_version + history entry
- Identical logic structure to root state.json update

### 3.6 Framework Source Cleanup

- After update, offers to remove framework source directory
- Guarded by -Force (auto-skip in Force mode to avoid deleting source in CI)
- Not performed in DryRun mode

### VERDICT: PASS

---

## 4. Cross-Script Consistency

### 4.1 Helper Functions

11 shared helper functions verified IDENTICAL across all 3 scripts (byte-for-byte match):
1. Write-Banner
2. Write-Step
3. Write-Success
4. Write-Warn
5. Write-Err
6. ConvertTo-ForwardSlashPath
7. Write-Utf8NoBom
8. Merge-JsonDeep
9. Read-JsonFile
10. Write-JsonFile
11. Get-RelativePath

### 4.2 Parameter Naming

- -Force: All 3 scripts (consistent)
- -DryRun: uninstall.ps1, update.ps1 (install.ps1 does not have DryRun - matches bash)
- -Backup: uninstall.ps1, update.ps1 (consistent)
- -Help: All 3 scripts (consistent)
- -PurgeAll, -PurgeDocs: uninstall.ps1 only (correct)

### 4.3 Error Message Format

- All scripts use Write-Err for errors, Write-Warn for warnings
- Error exit codes: 0 for user cancellation, 1 for fatal errors
- Consistent "Error:" prefix on fatal error messages

### 4.4 Console Colors

- Cyan: Banners and info headers
- Blue: Steps, labels, informational
- Green: Success messages
- Yellow: Warnings
- Red: Errors
- Consistent across all 3 scripts

### VERDICT: PASS

---

## 5. CI Workflow (.github/workflows/ci.yml)

### 5.1 Job Structure

- Job name: "powershell-install"
- Matrix: pwsh (PS 7) and powershell (PS 5.1 on Windows)
- Runs on: windows-latest
- 8 steps: checkout, create project, copy framework, install, verify, uninstall dry-run, verify dry-run, update dry-run

### 5.2 Assertions

Comprehensive assertions verified:
- Core files exist (settings.json, state.json, installed-files.json)
- Manifest has reasonable file count (>50)
- All manifest paths use forward slashes (REQ-004)
- state.json has correct framework_version
- state.json has non-empty project name
- Constitution template exists
- Framework directory cleaned up after install
- Dry-run preserves all files
- Update dry-run does not change version

### 5.3 Matrix Coverage

- pwsh (PS 7): Cross-platform PowerShell
- powershell (PS 5.1): Windows PowerShell (ships with Windows 10/11)
- Both shells cover the PS 5.1 compatibility requirement (ADR-007)

### 5.4 Timing/Ordering

- Steps are sequential (each depends on prior step)
- Framework copy uses -Exclude ".git" (avoids copying git history)
- No race conditions (single runner per matrix entry)

### VERDICT: PASS

---

## 6. lib/installer.js

### 6.1 Change

Single line modified: Added `'uninstall.ps1', 'update.ps1'` to the script copy loop.

### 6.2 Correctness

- Loop iterates `['uninstall.sh', 'update.sh', 'uninstall.ps1', 'update.ps1']`
- Each file guarded by `if (await exists(scriptSource))` (graceful if .ps1 files missing)
- Copy destination: `.isdlc/scripts/{filename}` (correct)
- No disruption to existing .sh file copying

### VERDICT: PASS

---

## 7. README.md

### 7.1 Windows Section

- "Option 3b: Git clone on Windows (PowerShell)" section added
- Correct commands: `.\isdlc-framework\install.ps1`
- Execution policy bypass documented: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`
- Non-interactive mode documented: `.\isdlc-framework\install.ps1 -Force`
- Prerequisites updated: "macOS, Linux, or Windows" noted

### VERDICT: PASS

---

## 8. Architecture Compliance (ADR Verification)

| ADR | Requirement | Status |
|-----|-------------|--------|
| ADR-001 | Inline helpers, no external module | PASS - All 11 helpers inline in each script |
| ADR-002 | Merge-JsonDeep on PSCustomObject | PASS - Recursive merge with PSObject.Copy() |
| ADR-003 | Forward-slash paths at JSON boundary | PASS - ConvertTo-ForwardSlashPath in Get-RelativePath |
| ADR-004 | Write-Utf8NoBom for all generated files | PASS - No Set-Content/Out-File for generated files |
| ADR-005 | ErrorActionPreference Stop + try/catch | PASS - All 3 scripts have both |
| ADR-006 | CI matrix pwsh + powershell | PASS - ci.yml powershell-install job |
| ADR-007 | PS 5.1 compatible (no forbidden syntax) | PASS - No ternary, null-coalescing, pipeline chain, -AsHashtable |

---

## 9. Requirements Traceability

| Requirement | Description | Status |
|-------------|-------------|--------|
| REQ-001 | install.ps1 full parity with install.sh | PASS - All 20 features implemented |
| REQ-002 | uninstall.ps1 manifest-based safe removal | PASS - Only manifest files removed |
| REQ-003 | update.ps1 in-place update with preservation | PASS - Version update, deep merge, cleanup |
| REQ-004 | Forward-slash paths in all JSON | PASS - ConvertTo-ForwardSlashPath at all boundaries |
| REQ-005 | Execution policy documentation | PASS - In .NOTES, README, and Help output |
| REQ-006 | Non-interactive -Force mode | PASS - All prompts guarded by -Force |

---

## 10. Issues Found

### Minor Issues

**MINOR-001**: uninstall.ps1 line 495 checks for `.isdlc/constitution.md` which does not exist (constitution lives at `docs/isdlc/constitution.md`). This is a cosmetic display check that never matches -- it does not affect any deletion logic. The actual preservation of the constitution is correctly handled at line 788. This is parity-correct with the bash script (uninstall.sh line 449 has the same check).

**Severity**: Minor (cosmetic display, no functional impact)
**Action**: Note for future cleanup. Does not block approval.

**MINOR-002**: update.ps1 version comparison is string equality (`$InstalledVersion -eq $NewVersion`), not semantic version comparison. For example, "0.1.0-alpha" vs "0.1.0-beta" would correctly detect a difference, but "0.2.0" vs "0.10.0" would also be correctly handled by string comparison in this case. This matches the bash script behavior exactly and is sufficient for the current single-version track.

**Severity**: Minor (matches bash behavior, no functional impact currently)
**Action**: Note for future improvement when version comparisons become more complex.

### Cosmetic Issues

**COSMETIC-001**: The "1b/6" step numbering (e.g., "Step 1b/6") is an unconventional pattern. It faithfully ports the bash script's numbering but could be clearer as "Step 2/7" style. This is a parity decision, not a defect.

**Severity**: Cosmetic
**Action**: No action needed. Parity with bash is the design intent.

---

## 11. Security Review

| Check | Status |
|-------|--------|
| No Invoke-Expression / iex | PASS |
| No Start-Process with user input | PASS |
| No network calls | PASS |
| No elevation/admin requirement | PASS |
| No secrets in code | PASS |
| No environment variable injection | PASS |
| Path traversal protection (Join-Path) | PASS |
| String interpolation safe (no eval) | PASS |

---

## Recommendation

**APPROVED** -- The implementation is a faithful, high-quality port of the bash scripts to PowerShell. All 6 requirements are satisfied, all 7 ADRs are correctly implemented, all acceptance criteria are traced, and no critical or major issues were found. The 2 minor issues are parity-correct with the bash originals and do not affect functionality. The code is well-structured, properly error-handled, and PS 5.1 compatible.
