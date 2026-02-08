# Test Cases: uninstall.ps1

**Feature**: REQ-0002-powershell-windows-scripts
**Script**: uninstall.ps1
**Phase**: 05 - Test Strategy
**Created**: 2026-02-08

---

## TC-U-001: Standard uninstall (only manifest files removed)

**Requirement**: REQ-002, AC-003-01
**Priority**: Must Have
**Environment**: Both
**Automation**: Manual (destructive)

**Preconditions**:
- Project with completed installation (install.ps1 -Force)
- `.isdlc/installed-files.json` exists with 200+ files

**Steps**:
1. Capture file list before uninstall: `Get-ChildItem -Recurse -File | Select FullName`
2. Run `.isdlc\scripts\uninstall.ps1 -Force`
3. Capture file list after uninstall

**Expected Results**:
- Only files listed in `installed-files.json` are removed
- State.json survives
- Constitution.md survives
- Exit code is 0
- Summary shows removed count matching manifest

**Verification Command** (PowerShell):
```powershell
# After uninstall
$remaining = Get-ChildItem -Recurse -File -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty FullName
# state.json should survive
if (-not (Test-Path ".isdlc/state.json")) { throw "state.json was deleted!" }
if (-not (Test-Path "docs/isdlc/constitution.md")) { throw "constitution.md was deleted!" }
Write-Host "TC-U-001 PASSED" -ForegroundColor Green
```

---

## TC-U-002: Custom agents preserved

**Requirement**: REQ-002, AC-003-02
**Priority**: Must Have
**Environment**: Both
**Automation**: Manual

**Preconditions**:
- Completed installation
- Custom agent added: `.claude/agents/my-custom-agent.md`
- Custom agent NOT in the installation manifest

**Steps**:
1. Create `.claude/agents/my-custom-agent.md` with content "# Custom Agent"
2. Verify it is NOT in `.isdlc/installed-files.json`
3. Run `.isdlc\scripts\uninstall.ps1 -Force`

**Expected Results**:
- `.claude/agents/my-custom-agent.md` still exists with original content
- Framework agents are removed
- Custom agent survives because it is not in the manifest

**Verification Command** (PowerShell):
```powershell
if (-not (Test-Path ".claude/agents/my-custom-agent.md")) {
    throw "Custom agent was deleted during uninstall!"
}
$content = Get-Content ".claude/agents/my-custom-agent.md" -Raw
if ($content -notmatch "Custom Agent") {
    throw "Custom agent content was modified!"
}
Write-Host "TC-U-002 PASSED" -ForegroundColor Green
```

---

## TC-U-003: -DryRun mode (nothing actually deleted)

**Requirement**: REQ-002, AC-003-04
**Priority**: Must Have
**Environment**: Both

**Preconditions**:
- Completed installation

**Steps**:
1. Record file count before: `$before = (Get-ChildItem -Recurse -File).Count`
2. Run `.isdlc\scripts\uninstall.ps1 -DryRun -Force`
3. Record file count after

**Expected Results**:
- File count before and after are identical
- Output shows "[dry-run]" prefixed messages
- `.claude/settings.json` still exists
- `.isdlc/state.json` still exists
- `.isdlc/installed-files.json` still exists
- Exit code is 0

**Verification Command** (PowerShell):
```powershell
if (-not (Test-Path ".claude/settings.json")) { throw "DryRun removed settings.json!" }
if (-not (Test-Path ".isdlc/state.json")) { throw "DryRun removed state.json!" }
if (-not (Test-Path ".isdlc/installed-files.json")) { throw "DryRun removed manifest!" }
# Verify agent files still exist
if (-not (Test-Path ".claude/agents")) { throw "DryRun removed agents!" }
Write-Host "TC-U-003 PASSED" -ForegroundColor Green
```

---

## TC-U-004: -Backup mode (archive created)

**Requirement**: REQ-002, AC-003-03
**Priority**: Must Have
**Environment**: Both
**Automation**: Manual

**Preconditions**:
- Completed installation

**Steps**:
1. Run `.isdlc\scripts\uninstall.ps1 -Backup -Force`
2. Check for timestamped backup directory

**Expected Results**:
- Directory matching `isdlc-backup-*` exists
- Backup contains `.claude/` and `.isdlc/` subdirectories
- Backup contains copies of all framework files
- Framework files are then removed from the project

**Verification Command** (PowerShell):
```powershell
$backups = Get-ChildItem -Directory -Filter "isdlc-backup-*"
if ($backups.Count -eq 0) { throw "No backup directory created" }
$backup = $backups[0].FullName
if (-not (Test-Path (Join-Path $backup ".claude"))) { throw "Backup missing .claude/" }
if (-not (Test-Path (Join-Path $backup ".isdlc"))) { throw "Backup missing .isdlc/" }
Write-Host "TC-U-004 PASSED: Backup at $($backups[0].Name)" -ForegroundColor Green
```

---

## TC-U-005: -PurgeAll mode (user artifacts also removed)

**Requirement**: REQ-002
**Priority**: Must Have
**Environment**: Both
**Automation**: Manual (destructive)

**Preconditions**:
- Completed installation

**Steps**:
1. Run `.isdlc\scripts\uninstall.ps1 -PurgeAll -Force`

**Expected Results**:
- `.isdlc/` directory completely removed (including state.json)
- `.claude/` agents, skills, hooks removed
- This is the "nuclear" option -- nothing framework-related survives

**Verification Command** (PowerShell):
```powershell
if (Test-Path ".isdlc") { throw ".isdlc/ should be completely removed with -PurgeAll" }
Write-Host "TC-U-005 PASSED" -ForegroundColor Green
```

---

## TC-U-006: Preserved files check (standard uninstall)

**Requirement**: REQ-002, AC-003-05
**Priority**: Must Have
**Environment**: Both
**Automation**: Manual

**Preconditions**:
- Completed installation
- No -PurgeAll or -PurgeDocs flags

**Steps**:
1. Create hash of each preserved file before uninstall
2. Run `.isdlc\scripts\uninstall.ps1 -Force`
3. Verify each preserved file still exists with same hash

**Expected Results**:
- `.isdlc/state.json` exists and unchanged
- `docs/isdlc/constitution.md` exists and unchanged
- `CLAUDE.md` exists and unchanged (if it existed before)
- `.claude/settings.local.json` exists and unchanged (if it existed before)
- `.isdlc/providers.yaml` exists and unchanged

**Verification Command** (PowerShell):
```powershell
$preserved = @(
    ".isdlc/state.json",
    "docs/isdlc/constitution.md"
)
foreach ($f in $preserved) {
    $path = $f -replace '/', '\'
    if (-not (Test-Path $path)) {
        throw "Preserved file missing after uninstall: $f"
    }
}
Write-Host "TC-U-006 PASSED: All preserved files intact" -ForegroundColor Green
```

---

## TC-U-007: Empty directory cleanup

**Requirement**: REQ-002
**Priority**: Should Have
**Environment**: Both
**Automation**: Manual

**Preconditions**:
- Completed installation
- No custom files in `.claude/agents/` or `.claude/skills/`

**Steps**:
1. Run `.isdlc\scripts\uninstall.ps1 -Force`
2. Check that empty directories under `.claude/` are removed

**Expected Results**:
- `.claude/agents/` removed if empty after file deletion
- `.claude/skills/` removed if empty after file deletion
- `.claude/commands/` removed if empty
- `.claude/hooks/` subdirectories removed if empty
- Parent directories removed only if completely empty

**Verification Command** (PowerShell):
```powershell
# After uninstall with no custom files, these should be gone
$emptyDirs = @(".claude/agents", ".claude/skills", ".claude/commands")
foreach ($d in $emptyDirs) {
    $path = $d -replace '/', '\'
    if (Test-Path $path) {
        $files = Get-ChildItem $path -Recurse -File
        if ($files.Count -eq 0) {
            throw "Empty directory not cleaned: $d"
        }
    }
}
Write-Host "TC-U-007 PASSED" -ForegroundColor Green
```

---

## TC-U-008: Settings.json hook/permission key stripping

**Requirement**: REQ-002
**Priority**: Must Have
**Environment**: Both
**Automation**: Manual

**Preconditions**:
- Completed installation
- `.claude/settings.json` has hooks, permissions, and custom user keys

**Steps**:
1. Add `"userKey": "preserved"` to `.claude/settings.json`
2. Run `.isdlc\scripts\uninstall.ps1 -Force`
3. Read the cleaned settings.json

**Expected Results**:
- `hooks` key removed from settings.json
- `permissions` key removed from settings.json
- `userKey` still present with value "preserved"
- File is valid JSON

**Verification Command** (PowerShell):
```powershell
$settingsPath = ".claude/settings.json" -replace '/', '\'
if (Test-Path $settingsPath) {
    $settings = Get-Content $settingsPath -Raw | ConvertFrom-Json
    if ($settings.PSObject.Properties["hooks"]) {
        throw "hooks key should have been stripped"
    }
    if ($settings.PSObject.Properties["permissions"]) {
        throw "permissions key should have been stripped"
    }
    if ($settings.userKey -ne "preserved") {
        throw "User key lost during settings cleanup"
    }
    Write-Host "TC-U-008 PASSED" -ForegroundColor Green
}
```

---

## TC-U-009: No installation detected (fatal error)

**Requirement**: REQ-002
**Priority**: Must Have
**Environment**: Both

**Preconditions**:
- Empty directory (no .isdlc/ or .claude/)

**Steps**:
1. Run `.\uninstall.ps1 -Force` in an empty directory

**Expected Results**:
- Script outputs error: "No iSDLC framework installation detected."
- Script exits with non-zero exit code
- No files are created or modified

**Verification Command** (PowerShell):
```powershell
$result = & .\uninstall.ps1 -Force 2>&1
if ($LASTEXITCODE -eq 0) {
    throw "Should have failed with non-zero exit code"
}
Write-Host "TC-U-009 PASSED: Correct error on missing installation" -ForegroundColor Green
```

---

## TC-U-010: Monorepo state preservation during uninstall

**Requirement**: REQ-002
**Priority**: Should Have
**Environment**: Both
**Automation**: Manual

**Preconditions**:
- Monorepo installation with per-project state files

**Steps**:
1. Install with monorepo setup
2. Run `.isdlc\scripts\uninstall.ps1 -Force` (without -PurgeAll)
3. Check per-project state files

**Expected Results**:
- `.isdlc/projects/*/state.json` files preserved
- `.isdlc/projects/*/skills/external/` directories preserved
- Framework config directories removed

**Verification Command** (PowerShell):
```powershell
$projectDirs = Get-ChildItem ".isdlc/projects" -Directory -ErrorAction SilentlyContinue
foreach ($d in $projectDirs) {
    $statePath = Join-Path $d.FullName "state.json"
    if (-not (Test-Path $statePath)) {
        throw "Per-project state.json deleted: $($d.Name)"
    }
}
Write-Host "TC-U-010 PASSED" -ForegroundColor Green
```
