# Test Cases: update.ps1

**Feature**: REQ-0002-powershell-windows-scripts
**Script**: update.ps1
**Phase**: 05 - Test Strategy
**Created**: 2026-02-08

---

## TC-UP-001: Standard update (files updated, version bumped)

**Requirement**: REQ-003, AC-004-01
**Priority**: Must Have
**Environment**: Both
**Automation**: Manual (requires two framework versions)

**Preconditions**:
- Project with completed installation (version "0.0.1" in state.json)
- New framework source cloned to `isdlc-update/` (version "0.1.0-alpha")

**Steps**:
1. Modify `.isdlc/state.json` to set `framework_version` to "0.0.1"
2. Clone new framework to `isdlc-update/`
3. Run `.\isdlc-update\update.ps1 -Force`

**Expected Results**:
- Framework files updated in `.claude/` and `.isdlc/`
- `.isdlc/state.json` shows `framework_version: "0.1.0-alpha"`
- History entry appended: "Framework updated from 0.0.1 to 0.1.0-alpha"
- `.isdlc/installed-files.json` regenerated
- Exit code is 0

**Verification Command** (PowerShell):
```powershell
$state = Get-Content ".isdlc/state.json" -Raw | ConvertFrom-Json
if ($state.framework_version -ne "0.1.0-alpha") {
    throw "Version not updated: $($state.framework_version)"
}
$lastHistory = $state.history[$state.history.Count - 1]
if ($lastHistory.action -notmatch "updated") {
    throw "History entry missing update record"
}
if ($lastHistory.agent -ne "update-script") {
    throw "History agent should be update-script"
}
Write-Host "TC-UP-001 PASSED" -ForegroundColor Green
```

---

## TC-UP-002: Settings.json deep merge (user keys preserved)

**Requirement**: REQ-003, AC-004-02
**Priority**: Must Have
**Environment**: Both
**Automation**: Manual

**Preconditions**:
- Completed installation
- `.claude/settings.json` modified to include custom user keys

**Steps**:
1. Add `"customUserKey": "important-value"` to `.claude/settings.json`
2. Add `"hooks": { "myHook": "custom-config" }` to settings.json
3. Run update.ps1 -Force

**Expected Results**:
- `customUserKey` preserved with value "important-value"
- Framework hooks present (may overwrite framework hook entries)
- User-added hook keys NOT overwritten
- No data loss from user settings
- File is valid JSON

**Verification Command** (PowerShell):
```powershell
$settings = Get-Content ".claude/settings.json" -Raw | ConvertFrom-Json
if ($settings.customUserKey -ne "important-value") {
    throw "User key lost during update merge"
}
if ($null -eq $settings.hooks) {
    throw "Hooks section missing after merge"
}
Write-Host "TC-UP-002 PASSED" -ForegroundColor Green
```

---

## TC-UP-003: Obsolete file cleanup (old manifest - new manifest)

**Requirement**: REQ-003, AC-004-03
**Priority**: Must Have
**Environment**: Both
**Automation**: Manual

**Preconditions**:
- Completed installation with manifest
- Old manifest contains a file that new framework does not have

**Steps**:
1. Install framework
2. Create a dummy file `.claude/agents/obsolete-agent.md`
3. Add its path to `.isdlc/installed-files.json` files array
4. Run update.ps1 -Force (new framework does not have this file)

**Expected Results**:
- `obsolete-agent.md` is removed (in old manifest, not in new)
- All files from new framework are present
- New manifest does not include the obsolete file

**Verification Command** (PowerShell):
```powershell
if (Test-Path ".claude/agents/obsolete-agent.md") {
    throw "Obsolete file should have been removed"
}
$manifest = Get-Content ".isdlc/installed-files.json" -Raw | ConvertFrom-Json
$hasObsolete = $manifest.files | Where-Object { $_ -match "obsolete-agent" }
if ($hasObsolete) {
    throw "Obsolete file should not be in new manifest"
}
Write-Host "TC-UP-003 PASSED" -ForegroundColor Green
```

---

## TC-UP-004: -DryRun mode (no files modified)

**Requirement**: REQ-003, AC-004-04
**Priority**: Must Have
**Environment**: Both

**Preconditions**:
- Completed installation
- New framework source available

**Steps**:
1. Record state.json content hash before
2. Run update.ps1 -DryRun -Force
3. Compare state.json content after

**Expected Results**:
- state.json content unchanged
- Framework files unchanged
- Output shows "[dry-run]" prefixed messages
- Exit code is 0
- Version in state.json unchanged

**Verification Command** (PowerShell):
```powershell
$state = Get-Content ".isdlc/state.json" -Raw | ConvertFrom-Json
if ($state.framework_version -ne "0.1.0-alpha") {
    throw "DryRun changed version: $($state.framework_version)"
}
if (-not (Test-Path ".claude/settings.json")) { throw "DryRun removed settings.json!" }
if (-not (Test-Path ".isdlc/installed-files.json")) { throw "DryRun removed manifest!" }
Write-Host "TC-UP-004 PASSED" -ForegroundColor Green
```

---

## TC-UP-005: -Force mode (skip version check)

**Requirement**: REQ-003, REQ-006
**Priority**: Must Have
**Environment**: Both
**Automation**: Manual

**Preconditions**:
- Completed installation with version "0.1.0-alpha"
- Framework source also version "0.1.0-alpha" (same version)

**Steps**:
1. Run update.ps1 without -Force (should say "Already up to date!" and exit)
2. Run update.ps1 -Force (should proceed with reinstall)

**Expected Results**:
- Without -Force: script exits with "Already up to date!" message, exit code 0
- With -Force: script proceeds with full update, files refreshed
- History entry shows "Framework updated from 0.1.0-alpha to 0.1.0-alpha"

**Verification Command** (PowerShell):
```powershell
# After -Force update with same version
$state = Get-Content ".isdlc/state.json" -Raw | ConvertFrom-Json
$lastHistory = $state.history[$state.history.Count - 1]
if ($lastHistory.agent -ne "update-script") {
    throw "Force update should have added history entry"
}
Write-Host "TC-UP-005 PASSED" -ForegroundColor Green
```

---

## TC-UP-006: Monorepo per-project state update

**Requirement**: REQ-003, AC-004-05
**Priority**: Must Have
**Environment**: Both
**Automation**: Manual

**Preconditions**:
- Monorepo installation with 2+ projects
- Each project has its own state.json
- Current version is "0.0.1" in all state files

**Steps**:
1. Set all state.json files to version "0.0.1"
2. Run update.ps1 -Force

**Expected Results**:
- Root `.isdlc/state.json` updated to new version
- Each `.isdlc/projects/*/state.json` updated to new version
- Each per-project state has a history entry for the update

**Verification Command** (PowerShell):
```powershell
$rootState = Get-Content ".isdlc/state.json" -Raw | ConvertFrom-Json
$newVersion = $rootState.framework_version
$projectDirs = Get-ChildItem ".isdlc/projects" -Directory -ErrorAction SilentlyContinue
foreach ($d in $projectDirs) {
    $projStatePath = Join-Path $d.FullName "state.json"
    if (Test-Path $projStatePath) {
        $projState = Get-Content $projStatePath -Raw | ConvertFrom-Json
        if ($projState.framework_version -ne $newVersion) {
            throw "Per-project state not updated: $($d.Name) has $($projState.framework_version)"
        }
    }
}
Write-Host "TC-UP-006 PASSED" -ForegroundColor Green
```

---

## TC-UP-007: Preservation rules (constitution, CLAUDE.md, etc.)

**Requirement**: REQ-003, NFR-005
**Priority**: Must Have
**Environment**: Both
**Automation**: Manual

**Preconditions**:
- Completed installation
- Modified user artifacts:
  - `docs/isdlc/constitution.md` -- customized content
  - `CLAUDE.md` -- user-written content
  - `.claude/settings.local.json` -- user overrides
  - `.isdlc/providers.yaml` -- custom provider
  - `.isdlc/monorepo.json` -- if applicable

**Steps**:
1. Hash each user artifact before update
2. Run update.ps1 -Force
3. Hash each user artifact after update
4. Compare hashes

**Expected Results**:
- `docs/isdlc/constitution.md` hash unchanged
- `CLAUDE.md` hash unchanged
- `.isdlc/providers.yaml` hash unchanged
- `.isdlc/monorepo.json` hash unchanged
- `.claude/settings.local.json` may be deep-merged (user keys preserved)
- `.isdlc/state.json` only has framework_version and history updated

**Verification Command** (PowerShell):
```powershell
# Before running update, save hashes:
# $beforeHashes = @{
#     "constitution" = (Get-FileHash "docs/isdlc/constitution.md").Hash
#     "providers"    = (Get-FileHash ".isdlc/providers.yaml").Hash
# }
# After update:
$afterConst = (Get-FileHash "docs/isdlc/constitution.md" -ErrorAction SilentlyContinue).Hash
$afterProv = (Get-FileHash ".isdlc/providers.yaml" -ErrorAction SilentlyContinue).Hash
# Compare with saved hashes
# if ($afterConst -ne $beforeHashes.constitution) { throw "Constitution modified!" }
# if ($afterProv -ne $beforeHashes.providers) { throw "Providers.yaml modified!" }
Write-Host "TC-UP-007: Verify hashes manually" -ForegroundColor Yellow
```

---

## TC-UP-008: No existing installation (fatal error)

**Requirement**: REQ-003, NFR-006
**Priority**: Must Have
**Environment**: Both

**Preconditions**:
- Empty directory (no .isdlc/ or .claude/)

**Steps**:
1. Run `.\isdlc-update\update.ps1 -Force`

**Expected Results**:
- Error: "No iSDLC installation found."
- Script exits with non-zero exit code
- No files created

**Verification Command** (PowerShell):
```powershell
$result = & .\isdlc-update\update.ps1 -Force 2>&1
if ($LASTEXITCODE -eq 0) {
    throw "Should have failed with non-zero exit code"
}
Write-Host "TC-UP-008 PASSED: Correct error on missing installation" -ForegroundColor Green
```

---

## TC-UP-009: -Backup mode (backup created before update)

**Requirement**: REQ-003
**Priority**: Should Have
**Environment**: Both
**Automation**: Manual

**Preconditions**:
- Completed installation

**Steps**:
1. Run update.ps1 -Backup -Force

**Expected Results**:
- Backup directory `isdlc-backup-*` created
- Backup contains `.claude/` and `.isdlc/` contents from before update
- Update then proceeds normally
- Both backup and updated files exist

**Verification Command** (PowerShell):
```powershell
$backups = Get-ChildItem -Directory -Filter "isdlc-backup-*"
if ($backups.Count -eq 0) { throw "No backup directory created" }
$backup = $backups[0].FullName
if (-not (Test-Path (Join-Path $backup ".claude"))) { throw "Backup missing .claude/" }
if (-not (Test-Path (Join-Path $backup ".isdlc"))) { throw "Backup missing .isdlc/" }
# Also verify update happened
$state = Get-Content ".isdlc/state.json" -Raw | ConvertFrom-Json
$lastHistory = $state.history[$state.history.Count - 1]
if ($lastHistory.agent -ne "update-script") { throw "Update should have run after backup" }
Write-Host "TC-UP-009 PASSED" -ForegroundColor Green
```

---

## TC-UP-010: Manifest regeneration after update

**Requirement**: REQ-003
**Priority**: Must Have
**Environment**: Both
**Automation**: Manual

**Preconditions**:
- Completed installation
- Run actual update (not dry-run)

**Steps**:
1. Record old manifest file count
2. Run update.ps1 -Force
3. Read new manifest

**Expected Results**:
- New manifest reflects current file set (not old set)
- All paths in new manifest use forward slashes
- New manifest has `framework_version` matching the new version
- New manifest `created` timestamp is recent

**Verification Command** (PowerShell):
```powershell
$manifest = Get-Content ".isdlc/installed-files.json" -Raw | ConvertFrom-Json
if ($manifest.files.Count -lt 50) {
    throw "Regenerated manifest too small: $($manifest.files.Count)"
}
foreach ($f in $manifest.files) {
    if ($f -match '\\') { throw "Backslash in regenerated manifest: $f" }
}
Write-Host "TC-UP-010 PASSED: Manifest regenerated with $($manifest.files.Count) files" -ForegroundColor Green
```

---

## TC-UP-011: State.json history append (not replace)

**Requirement**: REQ-003
**Priority**: Must Have
**Environment**: Both
**Automation**: Manual

**Preconditions**:
- Completed installation (history has 1 entry: "init-script")
- Run update

**Steps**:
1. Read state.json history length before update (should be 1)
2. Run update.ps1 -Force
3. Read state.json history length after

**Expected Results**:
- History now has 2 entries
- First entry is still the init entry (unchanged)
- Second entry is the update entry
- No history entries were removed or modified

**Verification Command** (PowerShell):
```powershell
$state = Get-Content ".isdlc/state.json" -Raw | ConvertFrom-Json
if ($state.history.Count -lt 2) {
    throw "History should have at least 2 entries (init + update)"
}
if ($state.history[0].agent -ne "init-script") {
    throw "Original init entry was modified"
}
$lastEntry = $state.history[$state.history.Count - 1]
if ($lastEntry.agent -ne "update-script") {
    throw "Last entry should be update-script"
}
Write-Host "TC-UP-011 PASSED: History has $($state.history.Count) entries" -ForegroundColor Green
```

---

## TC-UP-012: Missing state.json (fatal error)

**Requirement**: REQ-003, NFR-006
**Priority**: Must Have
**Environment**: Both
**Automation**: Manual

**Preconditions**:
- Installation with `.isdlc/` directory present but `state.json` removed

**Steps**:
1. Remove `.isdlc/state.json`
2. Run update.ps1 -Force

**Expected Results**:
- Error: ".isdlc/state.json not found -- installation may be corrupted."
- Script exits with non-zero exit code
- No files modified

---

## TC-UP-013: Skills manifest update

**Requirement**: REQ-003
**Priority**: Should Have
**Environment**: Both
**Automation**: Manual

**Preconditions**:
- Completed installation
- New framework with updated skills-manifest.json

**Steps**:
1. Run update.ps1 -Force

**Expected Results**:
- `.claude/hooks/config/skills-manifest.json` updated to new version
- `.isdlc/config/skills-manifest.json` (or .yaml) updated
- Workflows.json updated in both locations

**Verification Command** (PowerShell):
```powershell
$hooksConfig = Join-Path ".claude" (Join-Path "hooks" (Join-Path "config" "skills-manifest.json"))
if (Test-Path $hooksConfig) {
    $content = Get-Content $hooksConfig -Raw | ConvertFrom-Json
    if ($null -eq $content) { throw "Skills manifest invalid after update" }
    Write-Host "TC-UP-013 PASSED" -ForegroundColor Green
} else {
    Write-Host "TC-UP-013 SKIPPED: No skills manifest in framework" -ForegroundColor Yellow
}
```
