# CI Design: PowerShell Install Test Job

**Feature**: REQ-0002-powershell-windows-scripts
**Phase**: 04 - Design
**Created**: 2026-02-08
**Status**: Draft
**ADR Reference**: ADR-006 (CI/CD Testing Approach)

---

## 1. Overview

Add a `powershell-install` job to `.github/workflows/ci.yml` that tests install.ps1, uninstall.ps1, and update.ps1 on `windows-latest` using both PowerShell 5.1 and PowerShell 7.

This job parallels the existing `bash-install` job (lines 115-143 of ci.yml).

---

## 2. Job Definition

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

      - name: Create test project
        shell: ${{ matrix.shell }}
        run: |
          $testDir = Join-Path $env:RUNNER_TEMP "ps-test"
          New-Item $testDir -ItemType Directory -Force
          Set-Location $testDir
          git init
          '{"name": "ps-test"}' | Set-Content package.json

      - name: Copy framework into test project
        shell: ${{ matrix.shell }}
        run: |
          $testDir = Join-Path $env:RUNNER_TEMP "ps-test"
          $fwDir = Join-Path $testDir "isdlc-framework"
          Copy-Item $env:GITHUB_WORKSPACE $fwDir -Recurse -Exclude ".git"

      - name: Run install.ps1 -Force
        shell: ${{ matrix.shell }}
        run: |
          $testDir = Join-Path $env:RUNNER_TEMP "ps-test"
          Set-Location $testDir
          & (Join-Path "isdlc-framework" "install.ps1") -Force

      - name: Verify installation
        shell: ${{ matrix.shell }}
        run: |
          $testDir = Join-Path $env:RUNNER_TEMP "ps-test"
          Set-Location $testDir

          # Core files exist
          if (-not (Test-Path ".claude/settings.json")) { throw "Missing settings.json" }
          if (-not (Test-Path ".isdlc/state.json")) { throw "Missing state.json" }
          if (-not (Test-Path ".isdlc/installed-files.json")) { throw "Missing manifest" }

          # Manifest has reasonable file count
          $manifest = Get-Content ".isdlc/installed-files.json" -Raw | ConvertFrom-Json
          if ($manifest.files.Count -lt 50) {
            throw "Manifest too small: $($manifest.files.Count) files"
          }

          # All manifest paths use forward slashes (REQ-004)
          foreach ($f in $manifest.files) {
            if ($f -match '\\') {
              throw "Backslash in manifest path: $f"
            }
          }

          # state.json is valid JSON with expected structure
          $state = Get-Content ".isdlc/state.json" -Raw | ConvertFrom-Json
          if ($state.framework_version -ne "0.1.0-alpha") {
            throw "Wrong framework_version: $($state.framework_version)"
          }
          if ($null -eq $state.project.name -or $state.project.name -eq "") {
            throw "Missing project name in state.json"
          }

          # Constitution template created
          if (-not (Test-Path "docs/isdlc/constitution.md")) {
            throw "Missing constitution.md"
          }

          # Framework cleanup happened
          if (Test-Path "isdlc-framework") {
            throw "Framework directory should have been removed after install"
          }

          Write-Host "All installation checks passed" -ForegroundColor Green

      - name: Run uninstall.ps1 -DryRun -Force
        shell: ${{ matrix.shell }}
        run: |
          $testDir = Join-Path $env:RUNNER_TEMP "ps-test"
          Set-Location $testDir
          & (Join-Path ".isdlc" "scripts" "uninstall.ps1") -DryRun -Force

      - name: Verify dry-run preserved files
        shell: ${{ matrix.shell }}
        run: |
          $testDir = Join-Path $env:RUNNER_TEMP "ps-test"
          Set-Location $testDir

          # Dry-run should NOT have removed anything
          if (-not (Test-Path ".claude/settings.json")) { throw "DryRun removed settings.json!" }
          if (-not (Test-Path ".isdlc/state.json")) { throw "DryRun removed state.json!" }
          if (-not (Test-Path ".isdlc/installed-files.json")) { throw "DryRun removed manifest!" }

          Write-Host "Dry-run preservation verified" -ForegroundColor Green

      - name: Test update.ps1 -DryRun -Force
        shell: ${{ matrix.shell }}
        run: |
          $testDir = Join-Path $env:RUNNER_TEMP "ps-test"
          Set-Location $testDir

          # Copy framework source again for update
          $updateDir = Join-Path $testDir "isdlc-update"
          Copy-Item $env:GITHUB_WORKSPACE $updateDir -Recurse -Exclude ".git"

          & (Join-Path $updateDir "update.ps1") -DryRun -Force

      - name: Verify update dry-run
        shell: ${{ matrix.shell }}
        run: |
          $testDir = Join-Path $env:RUNNER_TEMP "ps-test"
          Set-Location $testDir

          # All files should still exist after dry-run
          if (-not (Test-Path ".claude/settings.json")) { throw "DryRun removed settings.json!" }
          if (-not (Test-Path ".isdlc/state.json")) { throw "DryRun removed state.json!" }

          # Version should NOT have changed (dry-run)
          $state = Get-Content ".isdlc/state.json" -Raw | ConvertFrom-Json
          if ($state.framework_version -ne "0.1.0-alpha") {
            throw "DryRun changed version: $($state.framework_version)"
          }

          Write-Host "Update dry-run verified" -ForegroundColor Green
```

---

## 3. Matrix Explanation

| Shell Value | Runtime | Notes |
|-------------|---------|-------|
| `powershell` | Windows PowerShell 5.1 | Built-in on Windows, uses .NET Framework |
| `pwsh` | PowerShell 7.x | Pre-installed on windows-latest, uses .NET 8 |

Both are pre-installed on `windows-latest` runner. No additional setup needed.

---

## 4. What Is NOT Tested in CI

| Scenario | Reason |
|----------|--------|
| Interactive mode | CI is non-interactive (always uses -Force) |
| Monorepo setup | Complex fixture; covered by manual testing |
| Actual uninstall (non-dry-run) | Would destroy test state; dry-run verifies logic |
| Actual update (non-dry-run) | Would need two framework versions; tested manually |
| Pester unit tests | No Pester dependency (Article XI: real execution) |
| Cross-platform manifest comparison | Bash and PS run on different runners; verified manually |

---

## 5. Placement in ci.yml

The new job is added AFTER the existing `bash-install` job (line 143) and BEFORE any deployment jobs. It runs independently (no `needs` dependency on other jobs).

---

## 6. Traceability

| Test Step | Requirements | NFRs |
|-----------|-------------|------|
| install.ps1 -Force | REQ-001, REQ-006 | NFR-001, NFR-002, NFR-003 |
| Manifest path check | REQ-004 | NFR-002 |
| state.json check | REQ-001 | NFR-002 |
| uninstall.ps1 -DryRun | REQ-002, REQ-006 | NFR-004 |
| update.ps1 -DryRun | REQ-003, REQ-006 | NFR-005 |
| PS 5.1 matrix | CON-001 | NFR-001 |
| PS 7 matrix | CON-001 | NFR-001 |
