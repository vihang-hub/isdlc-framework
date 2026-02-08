# Test Strategy: PowerShell Scripts for Windows

**Feature**: REQ-0002-powershell-windows-scripts
**Phase**: 05 - Test Strategy
**Created**: 2026-02-08
**Status**: Approved
**Constitution Articles**: II (Test-First Development), VII (Artifact Traceability), IX (Quality Gate Integrity), XI (Integration Testing Integrity), XII (Cross-Platform Compatibility)

---

## 1. Testing Philosophy

### 1.1 Integration-First, Real Execution

Per Article XI (Integration Testing Integrity) and ADR-006, all tests execute the actual PowerShell scripts against real filesystems. There are no unit test frameworks (Pester) and no mocking. Tests verify behavior by inspecting the actual output of script execution -- files created, JSON content written, directories removed.

This approach ensures that:
- Tests catch real-world failures (path handling, encoding, file permissions)
- No test infrastructure needs to be installed beyond what ships with Windows
- Tests prove the scripts work, not that a mock was called correctly

### 1.2 Test Levels

| Level | Tool | Scope | Automation |
|-------|------|-------|------------|
| **CI Integration Tests** (Primary) | GitHub Actions + PowerShell assertions | Full install/uninstall/update lifecycle on windows-latest | Fully automated, runs on every PR |
| **Manual Verification Checklist** (Secondary) | Human tester on Windows machine | Interactive mode, monorepo flows, edge cases | One-time per release; documented checklist |

### 1.3 What Is Tested vs What Is NOT Tested

**Tested (CI)**:
- Fresh install with `-Force` (non-interactive)
- Installation file creation (settings.json, state.json, manifest, constitution.md)
- Forward-slash path normalization in all generated JSON
- UTF-8 LF encoding (no BOM) in generated files
- Uninstall dry-run (logic verification without destruction)
- Update dry-run (logic verification without modification)
- Framework directory cleanup after install
- PS 5.1 and PS 7+ compatibility (matrix)

**Tested (Manual checklist)**:
- Interactive mode prompts and input handling
- Monorepo detection and configuration
- Provider selection (all 6 options)
- Actual uninstall (non-dry-run)
- Actual update (non-dry-run, requires two framework versions)
- Tour display
- Claude Code detection messaging
- Backup and PurgeAll modes

**NOT Tested (by design)**:
- Pester unit tests -- ADR-006 explicitly rejects this; Article XI favors real execution
- Cross-platform manifest byte-comparison -- bash and PS run on different CI runners; verified in manual checklist
- Execution policy bypass -- security feature outside script control
- PowerShell Gallery publishing -- out of scope (CON-002)

---

## 2. Existing Test Infrastructure

### 2.1 Current State

The project has a comprehensive test suite (596 tests) using Node.js built-in `node:test`. These tests cover the Node.js CLI and hooks but are not relevant to PowerShell script testing.

| Component | Framework | Count | Relevance |
|-----------|-----------|-------|-----------|
| ESM lib tests | `node:test` | 312 | None -- different pathway |
| CJS hook tests | `node:test` | 284 | None -- different pathway |
| Bash install CI job | GitHub Actions | 1 job | **Pattern reference** for PS CI job |

### 2.2 Existing CI Pattern (bash-install)

The existing `bash-install` job in `.github/workflows/ci.yml` (lines 115-143) establishes the pattern:
1. Checkout repo
2. Create test project in temp directory
3. Initialize git repo + package.json
4. Clone framework into test project
5. Run install script
6. Verify output files exist

The PowerShell CI job follows this exact pattern with PowerShell commands.

### 2.3 Strategy: Extend, Do Not Replace

Per the pre-phase check rules:
- **Use existing CI framework**: GitHub Actions on windows-latest
- **Follow existing pattern**: Mirror bash-install job structure
- **Add new job**: `powershell-install` runs alongside `bash-install`
- **No changes to existing tests**: 596 Node.js tests remain untouched

---

## 3. Environment Matrix

### 3.1 CI Matrix

| Dimension | Values | Notes |
|-----------|--------|-------|
| Runner OS | `windows-latest` | Windows Server 2022 on GitHub Actions |
| Shell | `powershell`, `pwsh` | Windows PowerShell 5.1 and PowerShell 7.x |

Total CI configurations: 1 OS x 2 shells = **2 test runs**

### 3.2 Shell Details

| Shell | Runtime | .NET | Pre-installed | Key Behavioral Differences |
|-------|---------|------|---------------|---------------------------|
| `powershell` | Windows PowerShell 5.1 | .NET Framework 4.x | Yes (windows-latest) | Set-Content writes CRLF; ConvertFrom-Json returns PSCustomObject only; no -AsHashtable |
| `pwsh` | PowerShell 7.4+ | .NET 8 | Yes (windows-latest) | Set-Content writes UTF-8 LF by default; ConvertFrom-Json has -AsHashtable option |

### 3.3 Manual Testing Matrix

| Environment | PS Version | Source |
|-------------|-----------|--------|
| Windows 10 | PS 5.1 | Built-in |
| Windows 11 | PS 5.1 | Built-in |
| Windows 11 | PS 7.x | Separate install |

---

## 4. Test Data Strategy

### 4.1 Test Project Setup (CI)

Each CI run creates a disposable test project:

```powershell
$testDir = Join-Path $env:RUNNER_TEMP "ps-test"
New-Item $testDir -ItemType Directory -Force
Set-Location $testDir
git init
'{"name": "ps-test"}' | Set-Content package.json
```

This creates a minimal project with:
- A git repository (required for some detection logic)
- A package.json (triggers "existing project" detection)
- No pre-existing .claude/ or .isdlc/ directories

### 4.2 Framework Source

The framework source is the checked-out repository itself, copied into the test project:

```powershell
Copy-Item $env:GITHUB_WORKSPACE $fwDir -Recurse -Exclude ".git"
```

### 4.3 Test Fixtures for Manual Testing

| Fixture | Purpose | Setup |
|---------|---------|-------|
| Empty project | Fresh install (no existing project markers) | Empty directory with `git init` |
| Existing project | Install with pre-existing files | Directory with package.json, src/ |
| Monorepo project | Monorepo detection and setup | Directory with pnpm-workspace.yaml + apps/{a,b}/ |
| Pre-installed project | Uninstall and update testing | Run install.ps1 first, then test |
| Custom agents project | Uninstall preservation testing | Install, then add custom .claude/agents/my-agent.md |
| Modified settings project | Update merge testing | Install, then add custom keys to settings.json |

### 4.4 Two-Version Test (Update)

To test update.ps1 with actual version changes:
1. Install version A (modify package.json version to "0.0.1")
2. Copy framework as version B (original "0.1.0-alpha")
3. Run update.ps1
4. Verify state.json shows version B
5. Verify history entry shows "updated from 0.0.1 to 0.1.0-alpha"

This is a manual test scenario (not automated in CI v1).

---

## 5. Success Criteria Mapping to NFRs

| NFR | Success Criteria | Verification Method |
|-----|-----------------|---------------------|
| NFR-001 (Compatibility) | Scripts run without error on both PS 5.1 and PS 7+ | CI matrix: `[powershell, pwsh]` |
| NFR-002 (Functional Parity) | Generated files match bash output structure and values | CI: JSON structure checks; Manual: side-by-side comparison |
| NFR-003 (Performance) | Installation completes within 2x of bash time | Manual: stopwatch comparison |
| NFR-004 (Safety) | Uninstall removes only manifest files, preserves user files | CI: dry-run logic check; Manual: file tree diff |
| NFR-005 (Preservation) | Update preserves state.json, constitution.md, CLAUDE.md, settings.local.json, providers.yaml | CI: dry-run version check; Manual: hash comparison before/after |
| NFR-006 (Error Handling) | Clear error messages on all failure modes; no partial installations | CI: exit code checks; Manual: error injection testing |
| NFR-007 (Dependencies) | No Import-Module or Install-Module in any script | Static analysis: `Select-String` for forbidden patterns |

---

## 6. Test Coverage Targets

### 6.1 Requirement Coverage

| Metric | Target | Measurement |
|--------|--------|-------------|
| Functional requirements (REQ-001 to REQ-006) | 100% | Each REQ has at least one test case |
| Acceptance criteria (21 total) | 100% | Each AC has at least one test case |
| NFRs (NFR-001 to NFR-007) | 100% | Each NFR has a verification approach |
| ADRs (ADR-001 to ADR-007) | 100% | Each ADR verified by at least one test |
| Error taxonomy entries | 80%+ | Critical errors tested; ignorable errors verified by pattern |

### 6.2 Test Type Distribution

| Test Type | Count (est.) | Automation |
|-----------|-------------|------------|
| CI integration tests | 15-20 assertions | Fully automated |
| Manual verification items | 20-25 checklist items | Manual, documented |
| Static analysis checks | 3-5 pattern scans | Semi-automated |

---

## 7. Risk-Based Test Prioritization

### 7.1 High Risk (Must test in CI)

| Area | Risk | Test Approach |
|------|------|--------------|
| JSON deep merge (Merge-JsonDeep) | Data loss from incorrect merge | Verify settings.json has expected structure after install |
| Forward-slash path normalization | Backslashes in manifest break agents | Check every manifest path for backslash absence |
| UTF-8 LF no BOM encoding | BOM breaks JSON parsers on other platforms | File encoding verification |
| State.json structure | Missing/wrong fields break agents and hooks | Validate specific fields after install |
| Framework cleanup | Leftover framework folder wastes disk, confuses users | Verify framework directory is removed |
| PS 5.1 compatibility | PS 7-only syntax causes failures on 70%+ of Windows machines | CI matrix runs both shells |

### 7.2 Medium Risk (CI + Manual)

| Area | Risk | Test Approach |
|------|------|--------------|
| Manifest completeness | Missing files means incomplete install | Check manifest file count threshold |
| Uninstall safety (user files) | Deleting user work is catastrophic | Dry-run in CI; actual uninstall manual with pre-placed files |
| Update preservation | Losing state/constitution during update | Dry-run version check in CI; hash comparison manual |
| settings.json merge order | Wrong merge direction overwrites user or framework keys | Manual: verify both user and framework keys present |

### 7.3 Low Risk (Manual only)

| Area | Risk | Test Approach |
|------|------|--------------|
| Banner display | Visual-only, no functional impact | Manual visual check |
| Tour content | Informational text, no state changes | Manual visual check |
| Provider selection | Simple switch statement | Manual: test each option |
| Performance (NFR-003) | Script runs once, not performance-critical | Manual: timed comparison |

---

## 8. Test Execution Flow

### 8.1 CI Test Sequence

```
1. Checkout repository
2. Create test project directory (RUNNER_TEMP/ps-test)
3. Initialize git repo + package.json
4. Copy framework into test project
5. Run install.ps1 -Force
6. VERIFY: Core files exist (settings.json, state.json, manifest)
7. VERIFY: Manifest has 50+ files, all forward-slash paths
8. VERIFY: state.json has correct version, project name, structure
9. VERIFY: Constitution template exists
10. VERIFY: Framework directory removed
11. VERIFY: Generated files are UTF-8 LF no BOM
12. VERIFY: No Import-Module in scripts (static analysis)
13. Run uninstall.ps1 -DryRun -Force
14. VERIFY: No files removed (dry-run preservation)
15. Copy framework again for update source
16. Run update.ps1 -DryRun -Force
17. VERIFY: No files changed (dry-run preservation)
18. VERIFY: State.json version unchanged (dry-run)
```

### 8.2 Manual Test Sequence

1. Fresh install (interactive mode) -- verify prompts, banner, file creation
2. Install with existing .claude/ -- verify merge behavior
3. Monorepo detection -- verify detection and setup
4. Provider selection -- verify all 6 options
5. Actual uninstall -- verify only manifest files removed
6. Actual update -- verify version bump, history append, file updates
7. Backup mode -- verify backup directory created
8. Error injection -- verify graceful failure on corrupt JSON, missing dirs

---

## 9. Constraints and Dependencies

### 9.1 CI Runner Constraints

- `windows-latest` has both `powershell` (5.1) and `pwsh` (7.x) pre-installed
- No Node.js setup needed for PowerShell tests (scripts are standalone)
- No npm install needed (no dependencies)
- `RUNNER_TEMP` used for test directories (cleaned automatically)

### 9.2 Article XI Compliance

Per Article XI (Integration Testing Integrity), the test strategy:
- Uses real execution (no mocks, no stubs)
- Verifies actual filesystem output (not mock calls)
- Tests on real Windows runner (not emulated)
- Runs scripts as users would run them (with actual parameters)

### 9.3 Article II Compliance

Per Article II (Test-First Development):
- Test cases are designed here (Phase 05) before implementation (Phase 06)
- Coverage targets defined: 100% requirement coverage, 100% AC coverage
- Critical paths identified: JSON merge, path normalization, file encoding

---

## 10. Traceability

| Strategy Section | Requirements | NFRs | ADRs | Constitution Articles |
|-----------------|-------------|------|------|----------------------|
| Integration-First Philosophy | All | NFR-002 | ADR-006 | II, XI |
| PS 5.1 + PS 7 Matrix | CON-001 | NFR-001 | ADR-007 | XII |
| Forward-Slash Path Testing | REQ-004 | NFR-002 | ADR-003 | XII |
| UTF-8 LF No BOM Testing | REQ-004 | NFR-002 | ADR-004 | XII |
| JSON Deep Merge Testing | REQ-001, REQ-003 | NFR-002, NFR-005 | ADR-002 | I |
| Uninstall Safety Testing | REQ-002 | NFR-004 | - | III |
| Update Preservation Testing | REQ-003 | NFR-005 | - | - |
| Non-Interactive Mode Testing | REQ-006 | NFR-002 | - | - |
| No External Dependencies | CON-002 | NFR-007 | - | V |
| CI Job Design | All | NFR-001, NFR-002 | ADR-006 | IX |
