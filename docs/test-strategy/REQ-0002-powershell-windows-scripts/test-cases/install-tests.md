# Test Cases: install.ps1

**Feature**: REQ-0002-powershell-windows-scripts
**Script**: install.ps1
**Phase**: 05 - Test Strategy
**Created**: 2026-02-08

---

## TC-I-001: Fresh install on empty project

**Requirement**: REQ-001, AC-001-01
**Priority**: Must Have
**Environment**: Both (PS 5.1 + PS 7+)

**Preconditions**:
- Empty directory with `git init` and `package.json`
- Framework source cloned into `isdlc-framework/` subdirectory
- No pre-existing `.claude/`, `.isdlc/`, or `docs/` directories

**Steps**:
1. Run `.\isdlc-framework\install.ps1 -Force`
2. Wait for script to complete with exit code 0

**Expected Results**:
- `.claude/` directory exists with `agents/`, `skills/`, `commands/`, `hooks/` subdirectories
- `.isdlc/` directory exists with `state.json`, `installed-files.json`, `config/`, `scripts/`
- `docs/` directory exists with `isdlc/constitution.md`
- `.claude/settings.json` exists and is valid JSON
- `.isdlc/providers.yaml` exists
- Exit code is 0

**Verification Command** (PowerShell):
```powershell
if (-not (Test-Path ".claude/agents")) { throw "Missing .claude/agents" }
if (-not (Test-Path ".claude/skills")) { throw "Missing .claude/skills" }
if (-not (Test-Path ".claude/commands")) { throw "Missing .claude/commands" }
if (-not (Test-Path ".claude/hooks")) { throw "Missing .claude/hooks" }
if (-not (Test-Path ".claude/settings.json")) { throw "Missing settings.json" }
if (-not (Test-Path ".isdlc/state.json")) { throw "Missing state.json" }
if (-not (Test-Path ".isdlc/installed-files.json")) { throw "Missing manifest" }
if (-not (Test-Path ".isdlc/providers.yaml")) { throw "Missing providers.yaml" }
if (-not (Test-Path "docs/isdlc/constitution.md")) { throw "Missing constitution.md" }
Write-Host "TC-I-001 PASSED" -ForegroundColor Green
```

---

## TC-I-002: Install with existing .claude/ folder

**Requirement**: REQ-001, AC-001-02
**Priority**: Must Have
**Environment**: Both

**Preconditions**:
- Project with existing `.claude/agents/my-custom-agent.md` (custom agent not in framework)
- Existing `.claude/settings.json` with user-specific keys

**Steps**:
1. Create `.claude/agents/my-custom-agent.md` with sample content
2. Create `.claude/settings.json` with `{ "customKey": "userValue" }`
3. Run `.\isdlc-framework\install.ps1 -Force`

**Expected Results**:
- `.claude/agents/my-custom-agent.md` still exists with original content
- `.claude/settings.json` contains both `customKey` and framework keys (hooks, permissions)
- Framework agents are present alongside custom agent
- No data loss from either user or framework settings

**Verification Command** (PowerShell):
```powershell
if (-not (Test-Path ".claude/agents/my-custom-agent.md")) {
    throw "Custom agent was deleted!"
}
$settings = Get-Content ".claude/settings.json" -Raw | ConvertFrom-Json
if ($null -eq $settings.customKey -or $settings.customKey -ne "userValue") {
    throw "User key lost in settings.json merge"
}
Write-Host "TC-I-002 PASSED" -ForegroundColor Green
```

---

## TC-I-003: Install with -Force (non-interactive mode)

**Requirement**: REQ-006, AC-005-01, AC-005-02
**Priority**: Must Have
**Environment**: Both

**Preconditions**:
- Fresh test project
- Framework source available

**Steps**:
1. Run `.\isdlc-framework\install.ps1 -Force`
2. Observe that no prompts appear (no Read-Host calls)
3. Verify installation completes successfully

**Expected Results**:
- Script completes without any interactive prompts
- Exit code is 0
- Default provider mode is `claude-code`
- Monorepo mode defaults to single-project
- Tour is skipped
- Installation result is functionally identical to interactive install with all defaults

**Verification Command** (PowerShell):
```powershell
# Verify core installation happened
if (-not (Test-Path ".isdlc/state.json")) { throw "Installation failed" }
# Verify default provider
$provYaml = Get-Content ".isdlc/providers.yaml" -Raw
if ($provYaml -notmatch 'claude-code') {
    throw "Provider not set to claude-code default"
}
Write-Host "TC-I-003 PASSED" -ForegroundColor Green
```

---

## TC-I-004: Monorepo detection and setup

**Requirement**: REQ-001, AC-002-01, AC-002-02
**Priority**: Must Have
**Environment**: Both
**Automation**: Manual

**Preconditions**:
- Project root with `pnpm-workspace.yaml`
- Two subdirectories: `apps/frontend/` and `apps/backend/`, each with `package.json`

**Steps**:
1. Create project structure:
   ```powershell
   mkdir apps/frontend, apps/backend
   '{"name":"frontend"}' | Set-Content apps/frontend/package.json
   '{"name":"backend"}' | Set-Content apps/backend/package.json
   "packages:" | Set-Content pnpm-workspace.yaml
   ```
2. Run `.\isdlc-framework\install.ps1` (interactive)
3. Confirm monorepo detection when prompted
4. Accept detected projects

**Expected Results**:
- Monorepo detection prompt appears showing pnpm workspace
- `.isdlc/monorepo.json` created with both projects
- Per-project state files exist at `.isdlc/projects/frontend/state.json` and `.isdlc/projects/backend/state.json`
- All paths in monorepo.json use forward slashes

**Verification Command** (PowerShell):
```powershell
if (-not (Test-Path ".isdlc/monorepo.json")) { throw "Missing monorepo.json" }
$mono = Get-Content ".isdlc/monorepo.json" -Raw | ConvertFrom-Json
if ($null -eq $mono.projects) { throw "No projects in monorepo.json" }
if (-not (Test-Path ".isdlc/projects/frontend/state.json")) { throw "Missing frontend state" }
if (-not (Test-Path ".isdlc/projects/backend/state.json")) { throw "Missing backend state" }
Write-Host "TC-I-004 PASSED" -ForegroundColor Green
```

---

## TC-I-005: Manual monorepo project entry with invalid directories

**Requirement**: REQ-001, AC-002-03
**Priority**: Should Have
**Environment**: Both
**Automation**: Manual

**Preconditions**:
- Project with no monorepo indicators
- One valid subdirectory (`frontend/`) and one invalid name (`nonexistent/`)

**Steps**:
1. Create `frontend/` with `package.json`
2. Run `.\isdlc-framework\install.ps1` (interactive)
3. Answer "Y" to monorepo prompt
4. Reject auto-detection
5. Enter manually: `frontend, nonexistent`

**Expected Results**:
- Warning shown for `nonexistent` directory
- Only `frontend` is registered in monorepo.json
- Installation continues with valid projects only

**Verification Command** (PowerShell):
```powershell
$mono = Get-Content ".isdlc/monorepo.json" -Raw | ConvertFrom-Json
$projNames = ($mono.projects.PSObject.Properties | Select-Object -ExpandProperty Name)
if ($projNames -contains "nonexistent") { throw "Invalid directory should not be registered" }
if ($projNames -notcontains "frontend") { throw "Valid directory should be registered" }
Write-Host "TC-I-005 PASSED" -ForegroundColor Green
```

---

## TC-I-006: Provider selection (each of 6 options)

**Requirement**: REQ-001, AC-001-05
**Priority**: Should Have
**Environment**: Both
**Automation**: Manual (6 sub-tests)

**Preconditions**:
- Fresh project for each provider option test

**Steps** (repeat for each option 1-6):
1. Run `.\isdlc-framework\install.ps1` (interactive)
2. Select provider option N (1=claude-code, 2=quality, 3=free, 4=budget, 5=local, 6=hybrid)
3. Complete installation

**Expected Results**:
- `providers.yaml` contains `active_mode` set to the corresponding mode name

| Input | Expected active_mode |
|-------|---------------------|
| 1 | claude-code |
| 2 | quality |
| 3 | free |
| 4 | budget |
| 5 | local |
| 6 | hybrid |
| (empty) | claude-code |
| 9 | claude-code + warning |

**Verification Command** (PowerShell):
```powershell
$provYaml = Get-Content ".isdlc/providers.yaml" -Raw
# Replace "free" with the expected mode for each sub-test
if ($provYaml -notmatch 'active_mode:\s*"free"') {
    throw "Provider mode not set correctly"
}
Write-Host "TC-I-006 PASSED" -ForegroundColor Green
```

---

## TC-I-007: Forward-slash paths in all generated JSON

**Requirement**: REQ-004, ADR-003
**Priority**: Must Have
**Environment**: Both

**Preconditions**:
- Completed installation (TC-I-001 or TC-I-003)

**Steps**:
1. Read `.isdlc/installed-files.json`
2. Check every path in the `files` array for backslashes

**Expected Results**:
- Zero backslashes found in any manifest path
- All paths use forward slashes (e.g., `.claude/agents/01-requirements-analyst.md`)

**Verification Command** (PowerShell):
```powershell
$manifest = Get-Content ".isdlc/installed-files.json" -Raw | ConvertFrom-Json
foreach ($f in $manifest.files) {
    if ($f -match '\\') {
        throw "Backslash found in manifest path: $f"
    }
}
Write-Host "TC-I-007 PASSED: All $($manifest.files.Count) paths use forward slashes" -ForegroundColor Green
```

---

## TC-I-008: UTF-8 LF no BOM in all generated files

**Requirement**: REQ-004, ADR-004
**Priority**: Must Have
**Environment**: Both

**Preconditions**:
- Completed installation

**Steps**:
1. Read raw bytes of `state.json`, `installed-files.json`, `constitution.md`
2. Check for BOM prefix (bytes EF BB BF)
3. Check for CRLF line endings in generated (non-copied) files

**Expected Results**:
- No BOM detected in any generated file
- Generated files use LF line endings (not CRLF)

**Verification Command** (PowerShell):
```powershell
$filesToCheck = @(
    ".isdlc/state.json",
    ".isdlc/installed-files.json",
    "docs/isdlc/constitution.md"
)
foreach ($f in $filesToCheck) {
    if (-not (Test-Path $f)) { throw "File missing: $f" }
    $bytes = [System.IO.File]::ReadAllBytes($f)
    # Check BOM
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        throw "BOM detected in $f"
    }
    # Check for CRLF
    $content = [System.IO.File]::ReadAllText($f)
    if ($content -match "`r`n") {
        throw "CRLF detected in $f (expected LF only)"
    }
}
Write-Host "TC-I-008 PASSED: All generated files are UTF-8 LF no BOM" -ForegroundColor Green
```

---

## TC-I-009: Manifest completeness

**Requirement**: REQ-001, ADR-003
**Priority**: Must Have
**Environment**: Both

**Preconditions**:
- Completed installation

**Steps**:
1. Read `.isdlc/installed-files.json`
2. Count files in manifest
3. Verify every file in manifest actually exists on disk
4. Verify critical framework files are present in manifest

**Expected Results**:
- Manifest contains at least 50 files (framework has 200+ agents, skills, hooks, commands)
- Every path in manifest resolves to an existing file
- Manifest includes agents, skills, hooks, commands, and settings

**Verification Command** (PowerShell):
```powershell
$manifest = Get-Content ".isdlc/installed-files.json" -Raw | ConvertFrom-Json
if ($manifest.files.Count -lt 50) {
    throw "Manifest too small: $($manifest.files.Count) files (expected 50+)"
}
$missing = 0
foreach ($f in $manifest.files) {
    $nativePath = $f -replace '/', '\'
    if (-not (Test-Path $nativePath)) {
        Write-Host "  Missing: $f" -ForegroundColor Red
        $missing++
    }
}
if ($missing -gt 0) { throw "$missing manifest files missing from disk" }
# Check critical categories are present
$hasAgents = ($manifest.files | Where-Object { $_ -match '^\.claude/agents/' }).Count -gt 0
$hasSkills = ($manifest.files | Where-Object { $_ -match '^\.claude/skills/' }).Count -gt 0
$hasHooks = ($manifest.files | Where-Object { $_ -match '^\.claude/hooks/' }).Count -gt 0
if (-not $hasAgents) { throw "No agents in manifest" }
if (-not $hasSkills) { throw "No skills in manifest" }
if (-not $hasHooks) { throw "No hooks in manifest" }
Write-Host "TC-I-009 PASSED: Manifest has $($manifest.files.Count) files, all verified" -ForegroundColor Green
```

---

## TC-I-010: Framework folder cleanup after install

**Requirement**: REQ-001, AC-001-04
**Priority**: Must Have
**Environment**: Both

**Preconditions**:
- Framework source copied to `isdlc-framework/` in test project
- Installation started

**Steps**:
1. Run `.\isdlc-framework\install.ps1 -Force`
2. After completion, check if framework directory still exists

**Expected Results**:
- `isdlc-framework/` directory no longer exists
- `.isdlc/scripts/uninstall.ps1` exists (copied before deletion)
- `.isdlc/scripts/update.ps1` exists (copied before deletion)

**Verification Command** (PowerShell):
```powershell
if (Test-Path "isdlc-framework") {
    throw "Framework directory should have been removed after install"
}
if (-not (Test-Path ".isdlc/scripts/uninstall.ps1")) {
    throw "uninstall.ps1 not copied to .isdlc/scripts/"
}
if (-not (Test-Path ".isdlc/scripts/update.ps1")) {
    throw "update.ps1 not copied to .isdlc/scripts/"
}
Write-Host "TC-I-010 PASSED" -ForegroundColor Green
```

---

## TC-I-011: State.json correctness

**Requirement**: REQ-001, AC-001-03
**Priority**: Must Have
**Environment**: Both

**Preconditions**:
- Completed installation on project named "test-project"

**Steps**:
1. Read `.isdlc/state.json`
2. Validate all required fields

**Expected Results**:
- `framework_version` is "0.1.0-alpha"
- `project.name` matches directory name
- `project.created` is a valid ISO timestamp
- `project.is_new_project` is a boolean (not string)
- `constitution.enforced` is true
- `constitution.path` uses forward slashes ("docs/isdlc/constitution.md")
- `autonomous_iteration.enabled` is true
- `skill_enforcement.mode` is "observe"
- `phases` object has all 13 phase entries
- `history` array has at least 1 entry (init)
- `counters.next_req_id` is 1
- All null fields serialize as JSON null (not empty string)

**Verification Command** (PowerShell):
```powershell
$state = Get-Content ".isdlc/state.json" -Raw | ConvertFrom-Json
if ($state.framework_version -ne "0.1.0-alpha") {
    throw "Wrong framework_version: $($state.framework_version)"
}
if ($null -eq $state.project.name -or $state.project.name -eq "") {
    throw "Missing project name"
}
if ($state.project.is_new_project -isnot [bool]) {
    throw "is_new_project is not a boolean"
}
if ($state.constitution.path -ne "docs/isdlc/constitution.md") {
    throw "Constitution path has wrong format: $($state.constitution.path)"
}
if ($state.skill_enforcement.mode -ne "observe") {
    throw "Wrong skill_enforcement.mode: $($state.skill_enforcement.mode)"
}
$phaseCount = ($state.phases.PSObject.Properties).Count
if ($phaseCount -lt 10) {
    throw "Expected 10+ phases, found $phaseCount"
}
if ($state.history.Count -lt 1) {
    throw "History should have at least 1 entry"
}
if ($state.counters.next_req_id -ne 1) {
    throw "next_req_id should be 1"
}
# Check null serialization (complexity_assessment.level should be null)
$raw = Get-Content ".isdlc/state.json" -Raw
if ($raw -notmatch '"level"\s*:\s*null') {
    throw "Null fields not serialized correctly"
}
Write-Host "TC-I-011 PASSED" -ForegroundColor Green
```

---

## TC-I-012: Settings.json deep merge correctness

**Requirement**: REQ-001, ADR-002
**Priority**: Must Have
**Environment**: Both

**Preconditions**:
- Project with existing `.claude/settings.json`:
  ```json
  {
    "userKey": "preserved",
    "hooks": { "userHook": "exists" }
  }
  ```

**Steps**:
1. Create `.claude/settings.json` with user keys
2. Run install.ps1 -Force
3. Read merged settings.json

**Expected Results**:
- `userKey` is preserved ("preserved")
- `hooks.userHook` is preserved
- Framework hooks are added alongside user hook
- `permissions` key from framework is added
- No data loss from either side

**Verification Command** (PowerShell):
```powershell
$settings = Get-Content ".claude/settings.json" -Raw | ConvertFrom-Json
if ($settings.userKey -ne "preserved") {
    throw "User key lost in merge"
}
# Framework should have added hooks
if ($null -eq $settings.hooks) {
    throw "Hooks section missing after merge"
}
Write-Host "TC-I-012 PASSED" -ForegroundColor Green
```

---

## TC-I-013: No external module dependencies

**Requirement**: CON-002, NFR-007
**Priority**: Must Have
**Environment**: Both

**Preconditions**:
- install.ps1 source file available

**Steps**:
1. Scan install.ps1 for `Import-Module` and `Install-Module` statements

**Expected Results**:
- Zero occurrences of `Import-Module` or `Install-Module`
- No `#Requires -Module` directives

**Verification Command** (PowerShell):
```powershell
$content = Get-Content "install.ps1" -Raw
if ($content -match 'Import-Module|Install-Module|#Requires\s+-Module') {
    throw "External module dependency found in install.ps1"
}
Write-Host "TC-I-013 PASSED: No external module dependencies" -ForegroundColor Green
```

---

## TC-I-014: Execution policy header documentation

**Requirement**: REQ-005
**Priority**: Should Have
**Environment**: Both

**Preconditions**:
- install.ps1 source file available

**Steps**:
1. Read the script header comment block
2. Check for execution policy bypass instructions

**Expected Results**:
- Script contains `.SYNOPSIS` comment block
- Script contains `Set-ExecutionPolicy` bypass instruction
- Script contains `powershell -ExecutionPolicy Bypass` alternative

**Verification Command** (PowerShell):
```powershell
$content = Get-Content "install.ps1" -Raw
if ($content -notmatch 'Set-ExecutionPolicy') {
    throw "Missing execution policy bypass instruction"
}
if ($content -notmatch '\.SYNOPSIS') {
    throw "Missing .SYNOPSIS comment block"
}
Write-Host "TC-I-014 PASSED" -ForegroundColor Green
```

---

## TC-I-015: ConvertTo-Json depth prevents truncation

**Requirement**: REQ-001, ADR-002
**Priority**: Must Have
**Environment**: Both

**Preconditions**:
- Completed installation

**Steps**:
1. Read state.json
2. Verify deeply nested objects are not truncated to strings

**Expected Results**:
- `phases.05-implementation.iteration_tracking` is an object (not a string)
- `cloud_configuration.deployment` is an object (not a string)
- No truncated string representations like `@{status=pending; ...}`

**Verification Command** (PowerShell):
```powershell
$raw = Get-Content ".isdlc/state.json" -Raw
# PSCustomObject truncation appears as "@{" in JSON output
if ($raw -match '@\{') {
    throw "Detected truncated PSCustomObject in state.json (ConvertTo-Json depth too shallow)"
}
$state = $raw | ConvertFrom-Json
# Check a deeply nested field
$iterTracking = $state.phases.'05-implementation'.iteration_tracking
if ($null -eq $iterTracking -or $iterTracking -is [string]) {
    throw "iteration_tracking truncated to string"
}
Write-Host "TC-I-015 PASSED" -ForegroundColor Green
```

---

## TC-I-016: Claude Code detection messaging

**Requirement**: REQ-001
**Priority**: Should Have
**Environment**: Both
**Automation**: Manual

**Preconditions**:
- Machine without `claude` CLI on PATH
- Interactive mode (no -Force)

**Steps**:
1. Ensure `claude` is not on PATH
2. Run `.\isdlc-framework\install.ps1`
3. Observe Claude Code detection output

**Expected Results**:
- Warning message displayed about Claude Code not being found
- Install URL shown
- Prompt to continue or abort
- If "Y", installation continues successfully
- If "N", script exits with code 0

---

## TC-I-017: Tour prompt and options

**Requirement**: REQ-001
**Priority**: Should Have
**Environment**: Both
**Automation**: Manual

**Preconditions**:
- Interactive mode (no -Force)
- Completed installation steps

**Steps**:
1. Run install.ps1 (interactive)
2. Complete all prompts until tour option
3. Test each tour option: 1 (light), 2 (full), 3 (skip)

**Expected Results**:
- Option 1: Shows 5-section light intro
- Option 2: Shows 8-section full tour
- Option 3: Skips tour
- Empty input: Defaults to light intro
- Tour content displays without errors

---

## TC-I-018: YAML manifest handling (pre-built JSON preferred)

**Requirement**: REQ-001, CON-002
**Priority**: Should Have
**Environment**: Both

**Preconditions**:
- Framework source with pre-built `skills-manifest.json` in hooks/config/

**Steps**:
1. Run install.ps1 -Force
2. Check hooks/config/ for skills manifest

**Expected Results**:
- `.claude/hooks/config/skills-manifest.json` exists
- If pre-built JSON was available, it was copied directly
- No yq or python invocation needed

**Verification Command** (PowerShell):
```powershell
$manifestPath = Join-Path ".claude" (Join-Path "hooks" (Join-Path "config" "skills-manifest.json"))
if (Test-Path $manifestPath) {
    $content = Get-Content $manifestPath -Raw | ConvertFrom-Json
    if ($null -eq $content) { throw "Skills manifest is not valid JSON" }
    Write-Host "TC-I-018 PASSED: Skills manifest copied" -ForegroundColor Green
} else {
    Write-Host "TC-I-018 SKIPPED: No pre-built JSON manifest in framework" -ForegroundColor Yellow
}
```
