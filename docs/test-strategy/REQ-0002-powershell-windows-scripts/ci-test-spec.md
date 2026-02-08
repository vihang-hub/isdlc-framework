# CI Test Implementation Spec: PowerShell Install Job

**Feature**: REQ-0002-powershell-windows-scripts
**Phase**: 05 - Test Strategy
**Created**: 2026-02-08
**Status**: Approved
**ADR Reference**: ADR-006 (CI/CD Testing Approach)
**Placement**: `.github/workflows/ci.yml` -- new job after `bash-install` (line 143)

---

## 1. Job YAML Definition

```yaml
  powershell-install:
    name: Test PowerShell Installer (${{ matrix.shell }})
    runs-on: windows-latest
    strategy:
      fail-fast: false
      matrix:
        shell: [pwsh, powershell]
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      # ─── Step 1: Create test project ─────────────────────────────
      - name: Create test project
        shell: ${{ matrix.shell }}
        run: |
          $testDir = Join-Path $env:RUNNER_TEMP "ps-test"
          New-Item $testDir -ItemType Directory -Force | Out-Null
          Set-Location $testDir
          git init
          git config user.email "ci@test.com"
          git config user.name "CI"
          '{"name": "ps-test"}' | Set-Content package.json
          git add package.json
          git commit -m "init" --quiet

      # ─── Step 2: Copy framework into test project ────────────────
      - name: Copy framework into test project
        shell: ${{ matrix.shell }}
        run: |
          $testDir = Join-Path $env:RUNNER_TEMP "ps-test"
          $fwDir = Join-Path $testDir "isdlc-framework"
          # Copy entire repo excluding .git
          Copy-Item $env:GITHUB_WORKSPACE $fwDir -Recurse -Exclude ".git"

      # ─── Step 3: Run install.ps1 -Force ──────────────────────────
      - name: Run install.ps1 -Force
        shell: ${{ matrix.shell }}
        run: |
          $testDir = Join-Path $env:RUNNER_TEMP "ps-test"
          Set-Location $testDir
          & (Join-Path "isdlc-framework" "install.ps1") -Force

      # ─── Step 4: Verify installation (TC-I-001, TC-I-003) ───────
      - name: Verify core files exist
        shell: ${{ matrix.shell }}
        run: |
          $testDir = Join-Path $env:RUNNER_TEMP "ps-test"
          Set-Location $testDir

          # TC-I-001: Core directories and files exist
          $required = @(
            ".claude/agents",
            ".claude/skills",
            ".claude/commands",
            ".claude/hooks",
            ".claude/settings.json",
            ".isdlc/state.json",
            ".isdlc/installed-files.json",
            "docs/isdlc/constitution.md"
          )
          foreach ($path in $required) {
            if (-not (Test-Path $path)) {
              throw "FAIL [TC-I-001]: Missing required path: $path"
            }
          }
          Write-Host "PASS [TC-I-001]: All core files exist" -ForegroundColor Green

      # ─── Step 5: Verify manifest (TC-I-007, TC-I-009) ───────────
      - name: Verify manifest completeness and paths
        shell: ${{ matrix.shell }}
        run: |
          $testDir = Join-Path $env:RUNNER_TEMP "ps-test"
          Set-Location $testDir

          $manifest = Get-Content ".isdlc/installed-files.json" -Raw | ConvertFrom-Json

          # TC-I-009: Manifest has reasonable file count
          if ($manifest.files.Count -lt 50) {
            throw "FAIL [TC-I-009]: Manifest too small: $($manifest.files.Count) files (expected 50+)"
          }
          Write-Host "PASS [TC-I-009]: Manifest has $($manifest.files.Count) files" -ForegroundColor Green

          # TC-I-007: All paths use forward slashes
          foreach ($f in $manifest.files) {
            if ($f -match '\\') {
              throw "FAIL [TC-I-007]: Backslash in manifest path: $f"
            }
          }
          Write-Host "PASS [TC-I-007]: All manifest paths use forward slashes" -ForegroundColor Green

          # Verify every manifest file exists on disk
          $missing = 0
          foreach ($f in $manifest.files) {
            $nativePath = $f -replace '/', '\'
            if (-not (Test-Path $nativePath)) {
              Write-Host "  Missing: $f" -ForegroundColor Red
              $missing++
            }
          }
          if ($missing -gt 0) {
            throw "FAIL [TC-I-009]: $missing manifest files missing from disk"
          }
          Write-Host "PASS [TC-I-009]: All manifest files verified on disk" -ForegroundColor Green

      # ─── Step 6: Verify state.json (TC-I-011) ───────────────────
      - name: Verify state.json structure
        shell: ${{ matrix.shell }}
        run: |
          $testDir = Join-Path $env:RUNNER_TEMP "ps-test"
          Set-Location $testDir

          $state = Get-Content ".isdlc/state.json" -Raw | ConvertFrom-Json

          # TC-I-011: Version correct
          if ($state.framework_version -ne "0.1.0-alpha") {
            throw "FAIL [TC-I-011]: Wrong framework_version: $($state.framework_version)"
          }

          # TC-I-011: Project name populated
          if ($null -eq $state.project.name -or $state.project.name -eq "") {
            throw "FAIL [TC-I-011]: Missing project name in state.json"
          }

          # TC-I-011: Boolean type check
          if ($state.project.is_new_project -isnot [bool]) {
            throw "FAIL [TC-I-011]: is_new_project is not boolean"
          }

          # TC-I-011: Constitution path uses forward slashes
          if ($state.constitution.path -ne "docs/isdlc/constitution.md") {
            throw "FAIL [TC-I-011]: Constitution path wrong: $($state.constitution.path)"
          }

          # TC-I-011: Phases exist
          $phaseCount = ($state.phases.PSObject.Properties).Count
          if ($phaseCount -lt 10) {
            throw "FAIL [TC-I-011]: Only $phaseCount phases (expected 10+)"
          }

          # TC-I-011: History has init entry
          if ($state.history.Count -lt 1) {
            throw "FAIL [TC-I-011]: No history entries"
          }

          Write-Host "PASS [TC-I-011]: state.json structure valid" -ForegroundColor Green

      # ─── Step 7: Verify encoding (TC-I-008) ─────────────────────
      - name: Verify UTF-8 LF no BOM
        shell: ${{ matrix.shell }}
        run: |
          $testDir = Join-Path $env:RUNNER_TEMP "ps-test"
          Set-Location $testDir

          $filesToCheck = @(
            ".isdlc/state.json",
            ".isdlc/installed-files.json",
            "docs/isdlc/constitution.md"
          )
          foreach ($f in $filesToCheck) {
            $path = $f -replace '/', '\'
            if (-not (Test-Path $path)) { continue }
            $bytes = [System.IO.File]::ReadAllBytes($path)
            if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
              throw "FAIL [TC-I-008]: BOM detected in $f"
            }
            $content = [System.IO.File]::ReadAllText($path)
            if ($content -match "`r`n") {
              throw "FAIL [TC-I-008]: CRLF detected in $f"
            }
          }
          Write-Host "PASS [TC-I-008]: All generated files are UTF-8 LF no BOM" -ForegroundColor Green

      # ─── Step 8: Verify ConvertTo-Json depth (TC-I-015) ─────────
      - name: Verify no truncated objects in state.json
        shell: ${{ matrix.shell }}
        run: |
          $testDir = Join-Path $env:RUNNER_TEMP "ps-test"
          Set-Location $testDir

          $raw = Get-Content ".isdlc/state.json" -Raw
          if ($raw -match '@\{') {
            throw "FAIL [TC-I-015]: Truncated PSCustomObject found in state.json"
          }
          Write-Host "PASS [TC-I-015]: No truncated objects" -ForegroundColor Green

      # ─── Step 9: Verify framework cleanup (TC-I-010) ────────────
      - name: Verify framework directory removed
        shell: ${{ matrix.shell }}
        run: |
          $testDir = Join-Path $env:RUNNER_TEMP "ps-test"
          Set-Location $testDir

          if (Test-Path "isdlc-framework") {
            throw "FAIL [TC-I-010]: Framework directory not cleaned up"
          }

          # TC-I-010: Scripts copied to .isdlc/scripts/
          if (-not (Test-Path ".isdlc/scripts/uninstall.ps1")) {
            throw "FAIL [TC-I-010]: uninstall.ps1 not copied to .isdlc/scripts/"
          }
          if (-not (Test-Path ".isdlc/scripts/update.ps1")) {
            throw "FAIL [TC-I-010]: update.ps1 not copied to .isdlc/scripts/"
          }
          Write-Host "PASS [TC-I-010]: Framework cleaned, scripts preserved" -ForegroundColor Green

      # ─── Step 10: Static analysis (TC-CC-001, TC-CC-006) ────────
      - name: Static analysis of installed scripts
        shell: ${{ matrix.shell }}
        run: |
          $testDir = Join-Path $env:RUNNER_TEMP "ps-test"
          Set-Location $testDir

          # Check scripts in .isdlc/scripts/ for PS 7-only syntax
          $scripts = Get-ChildItem ".isdlc/scripts/*.ps1" -ErrorAction SilentlyContinue
          foreach ($script in $scripts) {
            $content = Get-Content $script.FullName -Raw

            # TC-CC-006: No external module dependencies
            if ($content -match 'Import-Module|Install-Module|#Requires\s+-Module') {
              throw "FAIL [TC-CC-006]: External module dependency in $($script.Name)"
            }

            # TC-CC-001: No PS 7-only syntax
            if ($content -match '\?\?' -or $content -match '-AsHashtable') {
              throw "FAIL [TC-CC-001]: PS 7-only syntax in $($script.Name)"
            }

            # TC-CC-004: Error handling boilerplate
            if ($content -notmatch '\$ErrorActionPreference') {
              throw "FAIL [TC-CC-004]: Missing ErrorActionPreference in $($script.Name)"
            }
          }
          Write-Host "PASS [TC-CC-001, TC-CC-004, TC-CC-006]: Static analysis clean" -ForegroundColor Green

      # ─── Step 11: Uninstall dry-run (TC-U-003) ──────────────────
      - name: Run uninstall.ps1 -DryRun -Force
        shell: ${{ matrix.shell }}
        run: |
          $testDir = Join-Path $env:RUNNER_TEMP "ps-test"
          Set-Location $testDir
          & (Join-Path ".isdlc" (Join-Path "scripts" "uninstall.ps1")) -DryRun -Force

      # ─── Step 12: Verify dry-run preservation (TC-U-003) ────────
      - name: Verify uninstall dry-run preserved files
        shell: ${{ matrix.shell }}
        run: |
          $testDir = Join-Path $env:RUNNER_TEMP "ps-test"
          Set-Location $testDir

          if (-not (Test-Path ".claude/settings.json")) { throw "FAIL [TC-U-003]: DryRun removed settings.json" }
          if (-not (Test-Path ".isdlc/state.json")) { throw "FAIL [TC-U-003]: DryRun removed state.json" }
          if (-not (Test-Path ".isdlc/installed-files.json")) { throw "FAIL [TC-U-003]: DryRun removed manifest" }
          if (-not (Test-Path ".claude/agents")) { throw "FAIL [TC-U-003]: DryRun removed agents" }

          Write-Host "PASS [TC-U-003]: Dry-run preserved all files" -ForegroundColor Green

      # ─── Step 13: Update dry-run (TC-UP-004) ────────────────────
      - name: Copy framework for update test
        shell: ${{ matrix.shell }}
        run: |
          $testDir = Join-Path $env:RUNNER_TEMP "ps-test"
          $updateDir = Join-Path $testDir "isdlc-update"
          Copy-Item $env:GITHUB_WORKSPACE $updateDir -Recurse -Exclude ".git"

      - name: Run update.ps1 -DryRun -Force
        shell: ${{ matrix.shell }}
        run: |
          $testDir = Join-Path $env:RUNNER_TEMP "ps-test"
          Set-Location $testDir
          & (Join-Path "isdlc-update" "update.ps1") -DryRun -Force

      # ─── Step 14: Verify update dry-run (TC-UP-004) ─────────────
      - name: Verify update dry-run preserved state
        shell: ${{ matrix.shell }}
        run: |
          $testDir = Join-Path $env:RUNNER_TEMP "ps-test"
          Set-Location $testDir

          if (-not (Test-Path ".claude/settings.json")) { throw "FAIL [TC-UP-004]: DryRun removed settings.json" }
          if (-not (Test-Path ".isdlc/state.json")) { throw "FAIL [TC-UP-004]: DryRun removed state.json" }

          # Version should NOT have changed
          $state = Get-Content ".isdlc/state.json" -Raw | ConvertFrom-Json
          if ($state.framework_version -ne "0.1.0-alpha") {
            throw "FAIL [TC-UP-004]: DryRun changed version to: $($state.framework_version)"
          }

          Write-Host "PASS [TC-UP-004]: Update dry-run preserved state" -ForegroundColor Green

      # ─── Step 15: Summary ───────────────────────────────────────
      - name: Test summary
        shell: ${{ matrix.shell }}
        if: always()
        run: |
          Write-Host ""
          Write-Host "PowerShell Install Test Complete (${{ matrix.shell }})" -ForegroundColor Cyan
          Write-Host "Runner: windows-latest" -ForegroundColor Cyan
          Write-Host "Shell: ${{ matrix.shell }}" -ForegroundColor Cyan
```

---

## 2. Step-by-Step Test Execution Flow

| Step | CI Step Name | Test Cases Covered | What It Verifies |
|------|-------------|-------------------|------------------|
| 1-2 | Create test project + Copy framework | (Setup) | Test fixture created |
| 3 | Run install.ps1 -Force | TC-I-003 | Non-interactive install completes |
| 4 | Verify core files exist | TC-I-001 | All directories and files created |
| 5 | Verify manifest | TC-I-007, TC-I-009 | Manifest complete, forward-slash paths |
| 6 | Verify state.json | TC-I-011 | Correct structure, types, values |
| 7 | Verify encoding | TC-I-008 | UTF-8 LF no BOM |
| 8 | Verify depth | TC-I-015 | No truncated objects |
| 9 | Verify cleanup | TC-I-010 | Framework dir removed, scripts copied |
| 10 | Static analysis | TC-CC-001, TC-CC-004, TC-CC-006 | PS 5.1 compat, error handling, no modules |
| 11-12 | Uninstall dry-run | TC-U-003 | No files removed in dry-run |
| 13-14 | Update dry-run | TC-UP-004 | No files changed in dry-run |

**Total automated CI assertions**: 30+ individual checks across 14 verification steps

---

## 3. Matrix Strategy Details

```yaml
strategy:
  fail-fast: false
  matrix:
    shell: [pwsh, powershell]
```

| Property | Value | Rationale |
|----------|-------|-----------|
| `fail-fast: false` | Both shells run even if one fails | Need to know which shell has issues |
| `shell: [pwsh, powershell]` | PS 7 and PS 5.1 | CON-001 requires both |
| Total runs | 2 (1 OS x 2 shells) | Covers both runtimes |

### Shell Mapping

| Matrix Value | GitHub Runner Shell | Runtime Version |
|-------------|--------------------|-----------------|
| `pwsh` | pwsh.exe (PowerShell 7.4+) | .NET 8 |
| `powershell` | powershell.exe (Windows PowerShell 5.1) | .NET Framework 4.x |

Both are pre-installed on `windows-latest`. No setup step required.

---

## 4. Failure Handling and Reporting

### 4.1 Error Naming Convention

All assertion failures use a consistent format:
```
throw "FAIL [TC-XXX-NNN]: Description of what failed"
```

This makes it easy to search CI logs for specific test case failures.

### 4.2 Step-Level Failure

Each verification step is a separate GitHub Actions step. If one step fails:
- The remaining steps in that job are skipped (default GitHub Actions behavior)
- The `Test summary` step runs regardless (`if: always()`)
- The job is marked as failed in the PR check

### 4.3 Matrix-Level Failure

If one shell (e.g., `powershell`) fails but the other (`pwsh`) succeeds:
- Both jobs complete (fail-fast: false)
- The overall check shows which shell has issues
- PR reviewers can see exactly which shell failed and on which assertion

### 4.4 Expected Failure Scenarios

| Scenario | Effect | Resolution |
|----------|--------|-----------|
| PS 7-only syntax used | `powershell` job fails at install step | Fix script to use PS 5.1 syntax |
| Backslash in manifest | Both jobs fail at TC-I-007 | Fix ConvertTo-ForwardSlashPath usage |
| BOM in generated file | Both jobs fail at TC-I-008 | Fix Write-Utf8NoBom function |
| Truncated JSON | Both jobs fail at TC-I-015 | Add -Depth 10 to ConvertTo-Json |
| Install script error | Both jobs fail at install step | Fix script logic |

---

## 5. Integration with Existing CI

### 5.1 Job Independence

The `powershell-install` job has no `needs` dependency. It runs in parallel with:
- `lint` -- ESLint
- `test` -- Node.js unit/integration tests (3 OS x 3 Node versions)
- `integration` -- Node.js CLI integration tests
- `bash-install` -- Bash installer tests (Ubuntu + macOS)

### 5.2 Resource Usage

| Resource | Impact |
|----------|--------|
| Runners | 2 additional `windows-latest` runners |
| Duration | Estimated 2-3 minutes per shell (mostly file copy time) |
| Storage | Minimal (test project is temporary) |
| Cost | Within GitHub Actions free tier for public repos |

### 5.3 Placement in ci.yml

Insert after line 143 (end of `bash-install` job):

```yaml
  # --- Existing bash-install job ends above ---

  powershell-install:
    name: Test PowerShell Installer (${{ matrix.shell }})
    # ... (full definition from Section 1)
```

---

## 6. Test Cases Covered by CI vs Manual

### 6.1 CI Coverage (Automated)

| Test Case | Assertion Type |
|-----------|---------------|
| TC-I-001 | File existence checks |
| TC-I-003 | Non-interactive completion |
| TC-I-007 | Path pattern matching |
| TC-I-008 | Byte-level encoding check |
| TC-I-009 | File count + existence |
| TC-I-010 | Directory existence |
| TC-I-011 | JSON field validation |
| TC-I-013 | Static pattern scan |
| TC-I-015 | String pattern check |
| TC-U-003 | Post-dry-run file existence |
| TC-UP-004 | Post-dry-run state check |
| TC-CC-001 | Static pattern scan |
| TC-CC-004 | Static pattern scan |
| TC-CC-005 | Implicit (all steps use -Force) |
| TC-CC-006 | Static pattern scan |
| TC-CC-008 | Implicit (CmdletBinding required for scripts to run) |
| TC-CC-012 | Implicit (CI fails on non-zero exit) |

### 6.2 Manual Coverage (Not Automated)

| Test Case | Reason Not Automated |
|-----------|---------------------|
| TC-I-002 | Requires pre-placed custom files |
| TC-I-004, TC-I-005 | Monorepo fixture complexity |
| TC-I-006 | Interactive mode (6 sub-tests) |
| TC-I-012 | Requires pre-existing settings merge |
| TC-I-016 | Requires missing Claude Code |
| TC-I-017 | Interactive tour prompts |
| TC-U-001, TC-U-002 | Destructive (actual uninstall) |
| TC-U-004, TC-U-005 | Backup and purge modes |
| TC-U-006, TC-U-007, TC-U-008 | Post-uninstall state inspection |
| TC-UP-001, TC-UP-002, TC-UP-003 | Actual update with version change |
| TC-UP-005, TC-UP-006, TC-UP-007 | Force mode and preservation testing |
| TC-CC-007 | Helper function diff |
| TC-CC-009 | Cross-platform manifest comparison |

---

## 7. Traceability

| CI Step | Test Cases | Requirements | NFRs | ADRs |
|---------|-----------|-------------|------|------|
| Verify core files | TC-I-001, TC-I-003 | REQ-001, REQ-006 | NFR-002 | ADR-006 |
| Verify manifest | TC-I-007, TC-I-009 | REQ-004, REQ-001 | NFR-002 | ADR-003 |
| Verify state.json | TC-I-011 | REQ-001 | NFR-002 | ADR-002 |
| Verify encoding | TC-I-008 | REQ-004 | NFR-002 | ADR-004 |
| Verify depth | TC-I-015 | REQ-001 | NFR-002 | ADR-002 |
| Verify cleanup | TC-I-010 | REQ-001 | NFR-002 | - |
| Static analysis | TC-CC-001, TC-CC-004, TC-CC-006 | CON-001, CON-002 | NFR-001, NFR-006, NFR-007 | ADR-005, ADR-007 |
| Uninstall dry-run | TC-U-003 | REQ-002 | NFR-004 | - |
| Update dry-run | TC-UP-004 | REQ-003 | NFR-005 | - |
| PS 5.1 matrix | TC-CC-001 | CON-001 | NFR-001 | ADR-007 |
| PS 7 matrix | TC-CC-001 | CON-001 | NFR-001 | ADR-007 |
