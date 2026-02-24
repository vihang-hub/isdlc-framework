# Impact Analysis: REQ-0002 PowerShell Scripts for Windows

**Phase**: 02 - Impact Analysis
**Feature**: Create PowerShell scripts for Windows (install.ps1, uninstall.ps1, update.ps1)
**Analyzed**: 2026-02-08
**Blast Radius**: LOW-MEDIUM

---

## 1. Executive Summary

This feature creates **3 new PowerShell scripts** as Windows equivalents of existing bash scripts. The blast radius is LOW-MEDIUM because:
- The primary deliverables are **new files** (no modification to existing bash scripts)
- Documentation and CI/CD changes are **additive** (new sections/jobs, not replacements)
- No changes to the Node.js codebase (lib/, bin/, hooks/)
- Risk is isolated to the PowerShell scripts themselves and their generated output

---

## 2. New Files to Create

| File | Lines (est.) | Based On | Purpose |
|------|-------------|----------|---------|
| `install.ps1` | ~800-1000 | install.sh (1403 lines) | Windows installation |
| `uninstall.ps1` | ~500-600 | uninstall.sh (867 lines) | Safe Windows removal |
| `update.ps1` | ~350-450 | update.sh (609 lines) | In-place Windows update |

**Estimated total new code**: ~1650-2050 lines of PowerShell

**Why fewer lines than bash**: PowerShell has native JSON handling (ConvertFrom-Json/ConvertTo-Json replaces jq/sed/python fallbacks), native object manipulation (replaces bash string parsing), and more compact parameter handling ([CmdletBinding()] replaces manual getopts).

---

## 3. Existing Files Affected

### 3.1 Files Requiring Modification (DOCUMENTATION ONLY)

These files reference `install.sh` and should mention `install.ps1` as the Windows alternative:

| File | Lines Affected | Change Type | Risk |
|------|---------------|-------------|------|
| `README.md` | ~3-5 lines | Add Windows installation section | None |
| `framework-info.md` | ~3-5 lines | Add PowerShell script references | None |
| `docs/MONOREPO-GUIDE.md` | ~3-5 lines | Add Windows monorepo install instructions | None |
| `src/claude/agents/discover-orchestrator.md` | 1 line | Add `install.ps1` alternative | None |
| `src/claude/skills/discover/project-detection/SKILL.md` | 1 line | Add `install.ps1` reference | None |

### 3.2 Files Requiring Modification (CI/CD)

| File | Change Type | Risk |
|------|-------------|------|
| `.github/workflows/ci.yml` | Add `powershell-install` job (windows-latest) | Low |
| `package.json` | No changes needed (scripts are standalone) | None |

### 3.3 Files NOT Affected (NO CHANGES)

These files will NOT be modified -- confirming the isolated blast radius:

| Category | Files | Reason |
|----------|-------|--------|
| Bash scripts | install.sh, uninstall.sh, update.sh | Coexist unchanged |
| Node.js CLI | lib/installer.js, lib/updater.js, lib/uninstaller.js | Separate pathway |
| Hooks | src/claude/hooks/*.cjs | No changes |
| Agents | src/claude/agents/*.md (except discover-orchestrator) | No changes |
| Skills | src/claude/skills/**/*.md (except project-detection) | No changes |
| Tests | lib/*.test.js, src/claude/hooks/tests/*.test.cjs | No changes to existing tests |
| State | .isdlc/state.json | Runtime only (not code) |

---

## 4. Entry Points for Implementation

### 4.1 Primary Reference: install.sh

The install.sh script is the most complex (1403 lines) and should be ported first. It establishes patterns that uninstall.ps1 and update.ps1 will reuse:

**Shared patterns to extract into functions**:
1. `Write-Banner` -- colored banner output (replaces echo -e with ANSI codes)
2. `Write-Step` -- step progress indicator (e.g., "[1/6] Setting up...")
3. `Write-Success` / `Write-Warning` / `Write-Error` -- colored status messages
4. `Merge-JsonDeep` -- recursive JSON merge (replaces jq -s '.[0] * .[1]')
5. `ConvertTo-ForwardSlashPath` -- normalize paths for JSON output
6. `Test-ProjectExists` -- detect existing project indicators
7. `Test-MonorepoIndicators` -- detect monorepo workspace files

**Implementation order**:
1. Shared helper functions (used by all 3 scripts)
2. install.ps1 (establishes patterns, most complex)
3. uninstall.ps1 (reuses helper functions)
4. update.ps1 (reuses helper functions + manifest logic from uninstall)

### 4.2 Secondary Reference: lib/installer.js

The Node.js installer provides a cleaner reference for the logic flow (being a structured program rather than a shell script). Key sections map to install.ps1:

| installer.js Section | install.ps1 Equivalent |
|----------------------|------------------------|
| `detectProject()` | `Test-ProjectExists` function |
| `detectMonorepo()` | `Test-MonorepoIndicators` function |
| `copyFrameworkFiles()` | Step 1/6: Copy .claude/ |
| `setupHooks()` | Step 1b/6: Copy hooks |
| `setupDocs()` | Step 2/6: Create docs/ |
| `setupIsdlc()` | Step 3/6: Create .isdlc/ |
| `setupMonorepo()` | Step 3b/6: Monorepo config |
| `generateManifest()` | Step 5/6: Manifest generation |
| `cleanup()` | Step 6/6: Remove framework folder |

### 4.3 Key Windows Adaptations

| Bash Pattern | PowerShell Equivalent | Notes |
|-------------|----------------------|-------|
| `set -e` | `$ErrorActionPreference = 'Stop'` | + try/catch blocks |
| `echo -e "${GREEN}...${NC}"` | `Write-Host "..." -ForegroundColor Green` | Native color support |
| `find DIR -type f` | `Get-ChildItem DIR -Recurse -File` | Returns objects not strings |
| `read -p "Prompt: " VAR` | `$VAR = Read-Host "Prompt"` | Skipped when `-Force` |
| `jq -s '.[0] * .[1]'` | Custom `Merge-JsonDeep` function | See Section 5.3 |
| `sed -i 's/old/new/'` | `(Get-Content) -replace 'old','new'` | Or .Replace() |
| `rm -rf DIR` | `Remove-Item DIR -Recurse -Force` | |
| `mkdir -p DIR` | `New-Item -ItemType Directory -Force` | -Force = no error if exists |
| `cp -r SRC DST` | `Copy-Item SRC DST -Recurse -Force` | |
| `chmod +x FILE` | N/A | Not applicable on Windows |
| `$(date -u +"%Y-%m-%dT%H:%M:%SZ")` | `(Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")` | |
| `declare -a ARRAY=()` | `$Array = @()` | |
| `if [[ "$VAR" =~ ^[Yy]$ ]]` | `if ($Var -match '^[Yy]$')` | |
| Heredoc (`cat > file << EOF`) | Here-string (`@"..."@`) or `Set-Content` | |

---

## 5. Risk Assessment

### 5.1 Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| JSON deep merge produces different output than jq | Medium | High | Side-by-side comparison tests; use ConvertTo-Json -Depth 10 |
| Path separators in generated JSON (\ vs /) | Medium | High | ConvertTo-ForwardSlashPath helper; test all JSON writes |
| PowerShell 5.1 vs 7+ behavioral differences | Low | Medium | Test on both; avoid 7+-only features (ternary, null-coalescing) |
| Execution policy blocks script on user machines | Medium | Low | Document bypass; add header comments |
| Monorepo detection differs between bash/PS | Low | Medium | Port logic precisely; test same scenarios |
| settings.json merge loses user keys | Low | Critical | Deep merge function with unit tests; test roundtrip |
| Manifest file list differs from bash output | Low | High | Normalize paths before comparison; test against install.sh output |
| Generated state.json differs from bash output | Low | High | Compare JSON output field-by-field; use same templates |

### 5.2 High-Risk Areas

1. **JSON Deep Merge (`Merge-JsonDeep`)**: This is the highest-risk function. PowerShell's `ConvertFrom-Json` produces PSCustomObjects, not hashtables (in PS 5.1). Merging nested objects requires recursive traversal. Must handle:
   - Top-level key merge (new keys from both, existing keys from user take precedence)
   - Nested object merge (recurse into sub-objects)
   - Array handling (replace, don't merge arrays)
   - Null value handling

2. **Installation Manifest Generation**: The manifest must list file paths identically to what install.sh produces (using forward slashes). The `Get-ChildItem -Recurse` approach returns different path formats than `find`.

3. **Line Endings**: PowerShell's `Set-Content` writes CRLF by default on Windows. JSON and YAML files should use LF for cross-platform compatibility. Use `-NoNewline` with explicit `n` or `[System.IO.File]::WriteAllText()`.

### 5.3 Low-Risk Areas

- Banner/color output (Write-Host is straightforward)
- Directory creation (New-Item -ItemType Directory)
- File copying (Copy-Item -Recurse)
- Framework folder cleanup (Remove-Item -Recurse)
- Tour content (pure text output)

---

## 6. Dependency Analysis

### 6.1 External Dependencies

**None**. All three scripts use only built-in PowerShell cmdlets:
- `ConvertFrom-Json` / `ConvertTo-Json` (PS 3.0+)
- `Get-ChildItem`, `Copy-Item`, `Remove-Item`, `New-Item`
- `Test-Path`, `Join-Path`, `Split-Path`
- `Read-Host`, `Write-Host`
- `Get-Content`, `Set-Content`

### 6.2 Internal Dependencies

| Script | Depends On | Notes |
|--------|-----------|-------|
| install.ps1 | src/claude/ (agents, skills, hooks, commands) | Copies these to .claude/ |
| install.ps1 | src/isdlc/ (config, checklists, templates) | Copies these to .isdlc/ |
| uninstall.ps1 | .isdlc/installed-files.json | Manifest from install |
| update.ps1 | .isdlc/installed-files.json (old) + new manifest | Diff for cleanup |
| update.ps1 | .isdlc/state.json | Version bump |

### 6.3 Testing Dependencies

New Pester tests (PowerShell testing framework) would be ideal but are NOT required (Article XI focuses on real execution). Instead, the CI/CD job will test actual install/uninstall/update on `windows-latest` runner.

---

## 7. Implementation Impact Summary

### Files Created: 3
- `install.ps1` (~800-1000 lines)
- `uninstall.ps1` (~500-600 lines)
- `update.ps1` (~350-450 lines)

### Files Modified: 7
- `README.md` (add Windows section)
- `framework-info.md` (add PS references)
- `docs/MONOREPO-GUIDE.md` (add Windows instructions)
- `src/claude/agents/discover-orchestrator.md` (add PS alternative)
- `src/claude/skills/discover/project-detection/SKILL.md` (add PS reference)
- `.github/workflows/ci.yml` (add PowerShell install test job)
- `lib/installer.js` (copy .ps1 scripts to .isdlc/scripts/ alongside .sh)

### Files Unchanged: Everything else
- All 3 bash scripts (install.sh, uninstall.sh, update.sh)
- All Node.js modules (lib/*.js)
- All hooks (src/claude/hooks/*.cjs)
- All agents except discover-orchestrator
- All existing tests

### Total Estimated Impact: ~2200 new lines, ~30 modified lines across 7 files

---

## 8. Recommended Implementation Strategy

1. **Create shared helper functions first** (output, JSON merge, path normalization)
2. **Port install.ps1** section-by-section following install.sh structure
3. **Test install.ps1** on Windows (verify output matches install.sh)
4. **Port uninstall.ps1** reusing helpers
5. **Port update.ps1** reusing helpers + manifest logic
6. **Update CI/CD** to add Windows PowerShell test job
7. **Update documentation** with Windows instructions
8. **Update lib/installer.js** to also copy .ps1 files to .isdlc/scripts/

---

## 9. Constitutional Compliance Notes

| Article | Impact | Status |
|---------|--------|--------|
| I (Specification Primacy) | PowerShell scripts implement requirements-spec.md | Compliant by design |
| III (Security by Design) | No secrets handling; same patterns as bash | Low risk |
| V (Simplicity First) | Port existing logic, no new abstractions | Compliant |
| VII (Artifact Traceability) | New code maps to REQ-001 through REQ-006 | Traceable |
| VIII (Documentation Currency) | README, framework-info, guides must be updated | Required |
| XII (Cross-Platform) | This feature IS the cross-platform compliance | Core purpose |
| XIII (Module System) | PowerShell is standalone; no ESM/CJS impact | N/A |
