# Architecture Overview: PowerShell Scripts for Windows

**Feature**: REQ-0002-powershell-windows-scripts
**Phase**: 03 - Architecture
**Created**: 2026-02-08
**Status**: Approved
**Constitution Articles**: I (Specification Primacy), III (Security by Design), V (Simplicity First), VII (Artifact Traceability), XII (Cross-Platform Compatibility)

---

## 1. Executive Summary

This document defines the architecture for three PowerShell scripts (`install.ps1`, `uninstall.ps1`, `update.ps1`) that provide Windows-native equivalents to the existing bash scripts. The architecture follows a **port-not-redesign** principle: the PowerShell scripts replicate the exact behavior, output, and generated artifacts of their bash counterparts using idiomatic PowerShell patterns.

### Design Philosophy

1. **Faithful port**: Same user-facing flow, same generated files, same JSON output
2. **Inline helpers**: Shared functions live at the top of each script (no external module dependency)
3. **PowerShell 5.1 floor**: No PS 7-only syntax (no ternary `?:`, no null-coalescing `??`, no pipeline chain `&&`)
4. **Zero external dependencies**: Only built-in cmdlets and .NET BCL classes
5. **LF output**: All generated files use Unix line endings for cross-platform compatibility

---

## 2. Component Architecture

### 2.1 File Layout

```
project-root/
  install.ps1          # NEW — Windows installation (port of install.sh)
  uninstall.ps1        # NEW — Windows safe removal (port of uninstall.sh)
  update.ps1           # NEW — Windows in-place update (port of update.sh)
  install.sh           # UNCHANGED — bash installation
  uninstall.sh         # UNCHANGED — bash safe removal
  update.sh            # UNCHANGED — bash in-place update
```

All three `.ps1` files live at the repository root alongside their `.sh` counterparts. Users run whichever matches their OS.

### 2.2 Internal Structure (Each Script)

Each script follows this structural pattern:

```
[CmdletBinding()]
param(...)

# ── Strict Mode ──────────────────────────────────────────────
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

# ── Helper Functions ─────────────────────────────────────────
function Write-Banner { ... }
function Write-Step { ... }
function Write-Success { ... }
function Write-Warn { ... }
function Write-Err { ... }
function ConvertTo-ForwardSlashPath { ... }
function Merge-JsonDeep { ... }
function Write-Utf8NoBom { ... }
# ... (script-specific helpers)

# ── Main Logic ───────────────────────────────────────────────
# Step 1/N ...
# Step 2/N ...
# ...
```

### 2.3 Script-to-Script Dependencies

```
install.ps1  ──> (standalone, no dependencies)
uninstall.ps1 ──> reads .isdlc/installed-files.json (created by install.ps1)
update.ps1   ──> reads .isdlc/installed-files.json (old manifest)
              ──> reads new framework's installed-files.json (new manifest)
```

No script calls or dot-sources another script. Each is fully self-contained.

---

## 3. Architecture Decision Records

### ADR-001: Inline Helper Functions (No Shared Module)

**Decision**: Helper functions are declared inline at the top of each script. No shared `isdlc-helpers.ps1` module file.

**Context**: Seven helper functions are shared across all three scripts (Write-Banner, Write-Step, Write-Success, Write-Warn, Write-Err, ConvertTo-ForwardSlashPath, Merge-JsonDeep). The options were:
1. Extract to a shared `isdlc-helpers.ps1` and dot-source it
2. Inline the helpers in each script

**Rationale**:
- **Single-file execution**: Users run `.\install.ps1` directly. If helpers were in a separate file, the user must ensure both files are present and the relative path is correct. This adds failure modes (wrong CWD, missing file, execution policy on the helper file).
- **Self-contained cleanup**: install.ps1 deletes the framework folder after installation. A shared helper file would need to be in a location that survives cleanup, or the script would need to load it into memory before deletion.
- **Bash parity**: The bash scripts are also fully self-contained (no sourced libraries).
- **Article V (Simplicity First)**: Duplication of ~80 lines of helpers across 3 files is simpler than introducing a module loading mechanism.
- **Maintenance cost**: The helper functions are small (~80 lines total) and stable. Changes to helper behavior are rare and easy to propagate with find-and-replace.

**Consequences**:
- ~80 lines of helper functions are duplicated across 3 files
- Each script works as a standalone single file
- No module loading errors or path resolution issues

---

### ADR-002: JSON Deep Merge Strategy

**Decision**: Implement `Merge-JsonDeep` as a recursive PowerShell function operating on PSCustomObject trees, with explicit array-replacement semantics.

**Context**: The bash scripts use `jq -s '.[0] * .[1]'` for JSON merging (settings.json, settings.local.json). PowerShell has no built-in deep merge. The options were:
1. Custom recursive function on PSCustomObject (PS 5.1 compatible)
2. Convert PSCustomObject to Hashtable, merge, convert back
3. Use `ConvertFrom-Json -AsHashtable` (PS 7+ only)

**Implementation**:

```powershell
function Merge-JsonDeep {
    param(
        [Parameter(Mandatory)] $Base,
        [Parameter(Mandatory)] $Override
    )
    # Clone base to avoid mutation
    $Result = $Base.PSObject.Copy()
    foreach ($prop in $Override.PSObject.Properties) {
        $name = $prop.Name
        $overrideVal = $prop.Value
        if ($Result.PSObject.Properties[$name]) {
            $baseVal = $Result.$name
            if ($baseVal -is [PSCustomObject] -and $overrideVal -is [PSCustomObject]) {
                # Recurse into nested objects
                $Result.$name = Merge-JsonDeep -Base $baseVal -Override $overrideVal
            }
            else {
                # Scalar or array: override wins
                $Result.$name = $overrideVal
            }
        }
        else {
            # New key from override
            $Result | Add-Member -NotePropertyName $name -NotePropertyValue $overrideVal
        }
    }
    return $Result
}
```

**Semantics** (matching `jq -s '.[0] * .[1]'`):
- Object + Object: recursive merge (both keys preserved, override wins on conflict)
- Array + Array: override replaces base (no element-level merge)
- Scalar + Scalar: override replaces base
- Missing key: added from override

**PS 5.1 Compatibility Notes**:
- `PSObject.Copy()` performs a shallow clone. For nested objects, the recursion handles depth.
- `PSObject.Properties[$name]` works on PS 5.1 for existence checks.
- `-is [PSCustomObject]` reliably detects JSON objects on both PS 5.1 and 7+.

**Consequences**:
- JSON merge behavior matches `jq -s '.[0] * .[1]'` exactly
- Works on PS 5.1 without `-AsHashtable`
- Must be tested with nested objects, arrays, nulls, and mixed types

---

### ADR-003: Path Normalization Strategy

**Decision**: Use a single `ConvertTo-ForwardSlashPath` function applied to every path before writing to JSON. Internal operations use native OS paths.

**Context**: Windows uses backslashes (`\`) in file paths. The bash scripts produce JSON with forward slashes (`/`). Agents and hooks expect forward slashes. The state.json, manifest, and monorepo.json must be portable.

**Implementation**:

```powershell
function ConvertTo-ForwardSlashPath {
    param([string]$Path)
    return $Path -replace '\\', '/'
}
```

**Application Rules**:
1. **Join-Path for construction**: Always use `Join-Path` to build paths (OS-native, handles edge cases)
2. **Native paths for file operations**: `Test-Path`, `Copy-Item`, `Remove-Item`, `Get-ChildItem` all use native paths
3. **Forward-slash conversion at JSON boundary**: Apply `ConvertTo-ForwardSlashPath` immediately before inserting any path into a JSON structure
4. **Relative paths in manifest**: The manifest uses relative paths from project root (e.g., `.claude/agents/01-requirements-analyst.md`). Constructed via `$fullPath.Substring($ProjectRoot.Length + 1)` then converted.

**Verification**: Compare `installed-files.json` output from install.ps1 vs install.sh on the same project -- all paths must be identical strings.

**Consequences**:
- All JSON files produced on Windows are identical to those produced on macOS/Linux
- state.json is portable across platforms
- Internal PowerShell operations use native paths (no conversion overhead)

---

### ADR-004: Line Ending Handling (LF for Generated Files)

**Decision**: Use `[System.IO.File]::WriteAllText()` with explicit LF (`\n`) for all generated files. Do not use `Set-Content` (which writes CRLF on Windows by default in PS 5.1).

**Context**: PowerShell 5.1's `Set-Content` writes CRLF by default. PowerShell 7+ has `-NoNewline` and encoding options, but we target PS 5.1. JSON, YAML, and config files should use LF for cross-platform compatibility.

**Implementation**:

```powershell
function Write-Utf8NoBom {
    param(
        [Parameter(Mandatory)] [string]$Path,
        [Parameter(Mandatory)] [string]$Content
    )
    # Normalize to LF
    $Content = $Content -replace "`r`n", "`n"
    # UTF-8 without BOM
    $Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $Utf8NoBom)
}
```

**Application Rules**:
1. **All JSON output** (state.json, manifest, monorepo.json, settings.json): Use `Write-Utf8NoBom`
2. **All generated config files** (providers.yaml, constitution.md): Use `Write-Utf8NoBom`
3. **File copies** (agents, skills, hooks, commands): Use `Copy-Item` (preserves original line endings from repo)
4. **Console output**: Not affected (Write-Host uses whatever the console supports)

**Why not `Out-File -Encoding utf8`**: In PS 5.1, `-Encoding utf8` writes UTF-8 WITH BOM. The BOM byte (`EF BB BF`) can break some JSON parsers and creates a diff between bash-generated and PS-generated files.

**Consequences**:
- Generated files are byte-identical to bash output (UTF-8, LF, no BOM)
- File copies preserve their original encoding
- Explicit .NET call is slightly more verbose than `Set-Content` but guarantees behavior

---

### ADR-005: Error Handling Pattern

**Decision**: Use `$ErrorActionPreference = 'Stop'` globally, with targeted `try/catch` blocks around operations that may legitimately fail.

**Context**: The bash scripts use `set -e` (exit on error). PowerShell equivalent is `$ErrorActionPreference = 'Stop'`, but PowerShell also has structured exception handling.

**Pattern**:

```powershell
# Global: stop on any error (equivalent to set -e)
$ErrorActionPreference = 'Stop'

# For operations that may legitimately fail (e.g., removing optional files):
try {
    Remove-Item "$ScriptDir/.git" -Recurse -Force -ErrorAction SilentlyContinue
}
catch {
    # Silently ignore -- file may not exist
}

# For critical operations with user-facing error messages:
try {
    $json = Get-Content $ManifestPath -Raw | ConvertFrom-Json
}
catch {
    Write-Err "Failed to read manifest: $ManifestPath"
    Write-Err "Error: $_"
    exit 1
}
```

**Rules**:
1. **Global `Stop`**: Ensures unexpected errors halt execution (fail-safe, Article X)
2. **`-ErrorAction SilentlyContinue`**: Used for cleanup of optional files (matching `2>/dev/null || true` in bash)
3. **`try/catch` with exit 1**: Used for critical failures (JSON parse, file read, directory access)
4. **No `trap`**: PowerShell does not have bash-style trap. Unhandled errors propagate to the console naturally.
5. **`Set-StrictMode -Version 2.0`**: Catches uninitialized variables and invalid property references

**Consequences**:
- Script halts on unexpected errors (no silent failures)
- Optional cleanup operations do not block installation
- Error messages are clear and actionable

---

### ADR-006: CI/CD Testing Approach

**Decision**: Add a `powershell-install` job to `.github/workflows/ci.yml` that tests install/uninstall/update on `windows-latest` using both PowerShell 5.1 (Windows PowerShell) and PowerShell 7 (pwsh).

**Context**: The existing CI has a `bash-install` job that tests on `ubuntu-latest` and `macos-latest`. Windows is not tested. We need equivalent coverage for PowerShell.

**Implementation**:

```yaml
powershell-install:
  name: PowerShell Install Test
  runs-on: windows-latest
  strategy:
    matrix:
      shell: [pwsh, powershell]
  steps:
    - uses: actions/checkout@v4

    # Test install
    - name: Run install.ps1
      shell: ${{ matrix.shell }}
      run: |
        mkdir test-project
        cd test-project
        git init
        Copy-Item -Recurse ../. ./isdlc-framework -Exclude .git
        ./isdlc-framework/install.ps1 -Force

    # Verify installation
    - name: Verify installed files
      shell: ${{ matrix.shell }}
      run: |
        cd test-project
        if (-not (Test-Path ".claude/settings.json")) { throw "Missing settings.json" }
        if (-not (Test-Path ".isdlc/state.json")) { throw "Missing state.json" }
        if (-not (Test-Path ".isdlc/installed-files.json")) { throw "Missing manifest" }
        $manifest = Get-Content ".isdlc/installed-files.json" | ConvertFrom-Json
        if ($manifest.files.Count -lt 50) { throw "Manifest too small: $($manifest.files.Count) files" }

    # Test uninstall (dry-run)
    - name: Run uninstall.ps1 -DryRun
      shell: ${{ matrix.shell }}
      run: |
        cd test-project
        ./.isdlc/scripts/uninstall.ps1 -DryRun -Force

    # Test update (dry-run)
    - name: Run update.ps1 -DryRun
      shell: ${{ matrix.shell }}
      run: |
        cd test-project
        # Simulate update source
        Copy-Item -Recurse ../. ./isdlc-update -Exclude .git
        ./isdlc-update/update.ps1 -DryRun -Force
```

**Matrix**: `powershell` = Windows PowerShell 5.1 (built-in), `pwsh` = PowerShell 7+ (pre-installed on windows-latest runner).

**What is NOT tested**:
- Pester unit tests (avoided per Article XI -- real execution over mocked tests)
- Interactive mode (CI is non-interactive by definition)
- Monorepo flow (would require complex fixture setup; covered by manual testing)

**Consequences**:
- Both PS 5.1 and PS 7 are tested on every CI run
- Tests verify real install/uninstall/update behavior (not mocked)
- No new test framework dependency (Pester not required)

---

### ADR-007: PowerShell 5.1 Compatibility Constraints

**Decision**: Target PowerShell 5.1 as the minimum version. Avoid all PS 7-only syntax.

**Context**: Windows 10 and Windows 11 ship with Windows PowerShell 5.1. PowerShell 7 (pwsh) is a separate install. We must support both.

**Forbidden Syntax** (PS 7 only):

| Feature | PS 7 Syntax | PS 5.1 Alternative |
|---------|------------|---------------------|
| Ternary | `$x ? 'a' : 'b'` | `if ($x) { 'a' } else { 'b' }` |
| Null-coalescing | `$x ?? 'default'` | `if ($null -eq $x) { 'default' } else { $x }` |
| Null-conditional | `$x?.Property` | `if ($null -ne $x) { $x.Property }` |
| Pipeline chain | `cmd1 && cmd2` | Separate statements with error checking |
| `-AsHashtable` on ConvertFrom-Json | `ConvertFrom-Json -AsHashtable` | Work with PSCustomObject directly |
| `Join-Path -AdditionalChildPath` | 3+ path segments | Nested `Join-Path` calls |
| `Test-Json` | Built-in | `try { ConvertFrom-Json } catch { $false }` |

**Allowed Syntax** (PS 5.1+):

| Feature | Notes |
|---------|-------|
| `[CmdletBinding()]` | Advanced function metadata |
| `param()` with types | Parameter declarations |
| `[PSCustomObject]@{}` | Object literals |
| `ConvertFrom-Json` / `ConvertTo-Json` | JSON handling |
| `Add-Member` | Dynamic property addition |
| `.PSObject.Properties` | Reflection on objects |
| `$PSVersionTable` | Version detection |
| `Set-StrictMode -Version 2.0` | Strict mode (highest common version) |
| `New-Object System.Text.UTF8Encoding` | .NET BCL access |
| `[System.IO.File]::WriteAllText()` | Direct .NET file I/O |

**Consequences**:
- Scripts run on every Windows 10/11 machine without installing PowerShell 7
- Slightly more verbose code in places (if/else instead of ternary)
- No `-AsHashtable`, so JSON merge works on PSCustomObject (see ADR-002)

---

## 4. Data Flow

### 4.1 install.ps1 Data Flow

```
[Framework Source]              [Target Project]
  src/claude/agents/ ────────> .claude/agents/
  src/claude/skills/ ────────> .claude/skills/
  src/claude/commands/ ──────> .claude/commands/
  src/claude/hooks/ ─────────> .claude/hooks/
  src/claude/settings.json ──> .claude/settings.json (merged)
  src/isdlc/config/ ─────────> .isdlc/config/
  src/isdlc/checklists/ ────> .isdlc/checklists/
  src/isdlc/templates/ ─────> .isdlc/templates/
  src/isdlc/scripts/ ───────> .isdlc/scripts/

  [Generated]
    .isdlc/state.json ────────> (written from template)
    .isdlc/installed-files.json > (manifest of all copied files)
    .isdlc/providers.yaml ────> (agent model config)
    docs/isdlc/constitution.md > (starter template)
    .isdlc/scripts/uninstall.ps1 > (copied from framework root)
    .isdlc/scripts/update.ps1 ──> (copied from framework root)
```

### 4.2 uninstall.ps1 Data Flow

```
[Input]
  .isdlc/installed-files.json ──> (read manifest)

[Process]
  For each file in manifest:
    if (file exists AND not in preserved list):
      Remove-Item

[Output]
  .claude/settings.json ──> (hooks/permissions keys stripped)
  Empty directories ──────> (removed)
  Summary ────────────────> (console output: removed/preserved counts)
```

### 4.3 update.ps1 Data Flow

```
[Input]
  .isdlc/installed-files.json ──> (old manifest)
  new-framework/src/ ───────────> (new files)

[Process]
  1. Copy new framework files (overwrite)
  2. Deep-merge settings.json (preserve user keys)
  3. Diff old vs new manifest → remove obsolete files
  4. Update state.json version + history entry

[Output]
  .isdlc/installed-files.json ──> (regenerated)
  .isdlc/state.json ────────────> (version bumped)
  Summary ──────────────────────> (added/updated/removed/preserved counts)
```

---

## 5. Cross-Platform Compatibility Matrix

| Aspect | Bash Scripts | PowerShell Scripts | Identical Output? |
|--------|-------------|-------------------|-------------------|
| state.json content | Yes | Yes | YES -- same JSON structure, same values |
| installed-files.json | Forward-slash paths | Forward-slash paths | YES -- paths normalized |
| monorepo.json | Forward-slash paths | Forward-slash paths | YES -- paths normalized |
| settings.json merge | jq deep merge | Merge-JsonDeep | YES -- same semantics |
| providers.yaml | Generated | Generated | YES -- same content |
| constitution.md | Heredoc template | Here-string template | YES -- same text |
| File encoding | UTF-8 LF | UTF-8 LF (no BOM) | YES -- byte-identical |
| Console output | ANSI escape codes | Write-Host -ForegroundColor | Visually similar, not identical |
| Exit codes | 0 (success), 1 (error) | 0 (success), 1 (error) | YES |

---

## 6. Security Considerations (Article III)

1. **No secrets**: Scripts do not handle API keys, tokens, or credentials. Provider configuration (providers.yaml) stores mode names, not keys.
2. **No network access**: Scripts operate entirely on local filesystem. No HTTP requests, no package downloads.
3. **No elevated privileges**: Scripts do not require Administrator/root. All operations are in user-writable directories.
4. **Execution policy**: Scripts include header comments with bypass instructions. The `-Force` parameter does NOT bypass execution policy -- that is a separate PowerShell security feature.
5. **Manifest safety**: uninstall.ps1 ONLY removes files listed in the manifest. No recursive deletion of user files.
6. **Input validation**: All user inputs (project name, monorepo answers) are validated before use. Path traversal is prevented by using `Join-Path` and `Resolve-Path`.

---

## 7. Performance Considerations

The scripts run once (install/uninstall/update) and are not performance-critical. However:

1. **File operations**: Use `Copy-Item -Recurse` for directory trees (single operation) rather than per-file loops where possible
2. **JSON handling**: Read files once with `Get-Content -Raw`, parse once with `ConvertFrom-Json`. Avoid multiple reads.
3. **Manifest generation**: Build the file list in memory with an ArrayList, serialize once at the end
4. **NFR-003 compliance**: All operations complete within 2x the time of bash equivalents (PowerShell startup is ~200ms slower; file operations are comparable)

---

## 8. Testing Strategy Preview

| Test Type | Tool | Scope |
|-----------|------|-------|
| CI integration | GitHub Actions | Full install/uninstall/update on windows-latest |
| PS 5.1 coverage | `powershell` shell in CI | Windows PowerShell 5.1 matrix entry |
| PS 7 coverage | `pwsh` shell in CI | PowerShell 7+ matrix entry |
| Output comparison | Manual + CI verification | Compare generated JSON against bash output |
| Monorepo testing | Manual | Complex setup, not automated in CI v1 |
| Non-interactive | CI (uses -Force) | Verified by default in CI |

---

## 9. Implementation Roadmap

| Order | Component | Est. Lines | Dependencies |
|-------|-----------|-----------|-------------|
| 1 | install.ps1 | 800-1000 | None (reference: install.sh) |
| 2 | uninstall.ps1 | 500-600 | Reads manifest from install.ps1 |
| 3 | update.ps1 | 350-450 | Reads manifest, updates state.json |
| 4 | CI job | 60-80 | All 3 scripts |
| 5 | Documentation | 30-50 | All 3 scripts |
| 6 | lib/installer.js | 5-10 | install.ps1 exists |

**Total estimated**: ~1750-2200 new lines of PowerShell + ~100 lines YAML/docs

---

## 10. Traceability

| ADR | Requirements | Articles |
|-----|-------------|----------|
| ADR-001 (Inline Helpers) | REQ-001, REQ-002, REQ-003 | V (Simplicity) |
| ADR-002 (JSON Deep Merge) | REQ-001, REQ-003, REQ-004 | I (Specification Primacy) |
| ADR-003 (Path Normalization) | REQ-004 | XII (Cross-Platform) |
| ADR-004 (Line Endings) | REQ-004 | XII (Cross-Platform) |
| ADR-005 (Error Handling) | REQ-001, REQ-002, REQ-003, REQ-006 | X (Fail-Safe Defaults) |
| ADR-006 (CI/CD Testing) | NFR-002, NFR-003 | II (Test-First), IX (Gate Integrity) |
| ADR-007 (PS 5.1 Compat) | CON-001 | XII (Cross-Platform) |
