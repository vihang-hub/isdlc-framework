# Validation Rules: PowerShell Scripts for Windows

**Feature**: REQ-0002-powershell-windows-scripts
**Phase**: 04 - Design
**Created**: 2026-02-08
**Traced From**: requirements-spec.md (REQ-001 to REQ-006), architecture-overview.md (ADR-005)

---

## 1. Parameter Validation

### 1.1 All Scripts -- CmdletBinding Auto-Validation

All three scripts use `[CmdletBinding()]` which provides automatic parameter validation:
- Unknown parameters produce a PowerShell error: `A parameter cannot be found that matches parameter name 'InvalidParam'`
- All parameters are `[switch]` types (boolean) -- no type conversion errors possible
- No mandatory parameters in any script

### 1.2 install.ps1

| Parameter | Type | Default | Validation |
|-----------|------|---------|-----------|
| `-Force` | `[switch]` | `$false` | None needed |

### 1.3 uninstall.ps1

| Parameter | Type | Default | Validation |
|-----------|------|---------|-----------|
| `-Force` | `[switch]` | `$false` | None needed |
| `-Backup` | `[switch]` | `$false` | None needed |
| `-PurgeAll` | `[switch]` | `$false` | None needed |
| `-PurgeDocs` | `[switch]` | `$false` | None needed |
| `-DryRun` | `[switch]` | `$false` | None needed |

**Combination rules**: All combinations are valid. `-DryRun` takes precedence over destructive operations. `-Force` with `-PurgeAll` is dangerous but allowed.

### 1.4 update.ps1

| Parameter | Type | Default | Validation |
|-----------|------|---------|-----------|
| `-Force` | `[switch]` | `$false` | None needed |
| `-DryRun` | `[switch]` | `$false` | None needed |
| `-Backup` | `[switch]` | `$false` | None needed |

---

## 2. File Existence Checks

### 2.1 install.ps1 Fatal Checks

| Check | Path | Condition | Error Code | Action |
|-------|------|-----------|------------|--------|
| Framework source directory | `$ScriptDir/src` | Must exist | I-F01 | `exit 1` |
| Framework .claude source | `$ScriptDir/src/claude` | Must exist | I-F02 | `exit 1` |

### 2.2 install.ps1 Non-Fatal Checks

| Check | Path | If Missing |
|-------|------|-----------|
| Existing `.claude/` | `$ProjectRoot/.claude` | Create new directory |
| Existing `CLAUDE.md` | `$ProjectRoot/.claude/CLAUDE.md` | Skip backup |
| Framework `settings.local.json` | `$FrameworkClaude/settings.local.json` | Skip copy |
| Framework `settings.json` | `$FrameworkClaude/settings.json` | Skip merge |
| Existing `settings.local.json` | `$ProjectRoot/.claude/settings.local.json` | Copy instead of merge |
| Existing `settings.json` | `$ProjectRoot/.claude/settings.json` | Copy instead of merge |
| Config directory | `$FrameworkDir/isdlc/config` | Skip config copy |
| Checklists directory | `$FrameworkDir/isdlc/checklists` | Skip checklists copy |
| Templates directory | `$FrameworkDir/isdlc/templates` | Skip templates copy |
| Scripts directory | `$FrameworkDir/isdlc/scripts` | Skip scripts copy |
| Constitution template | `$FrameworkDir/isdlc/templates/constitution.md` | Skip constitution |
| providers.yaml.template | `$FrameworkDir/isdlc/templates/providers.yaml.template` | Skip provider config |
| Existing providers.yaml | `$ProjectRoot/.isdlc/providers.yaml` | Skip (preserve existing) |
| Node.js | `Get-Command node` | Warning only |
| Claude Code | `claude --version` | Warning + optional continue |
| Pre-built skills-manifest.json | Multiple paths | Try yq, python3/python, then warn |
| CLAUDE.md | `$ProjectRoot/CLAUDE.md` | Create empty file |
| uninstall.ps1 (for copy) | `$ScriptDir/uninstall.ps1` | Skip copy |
| update.ps1 (for copy) | `$ScriptDir/update.ps1` | Skip copy |

### 2.3 uninstall.ps1 Fatal Checks

| Check | Path | Condition | Error Code | Action |
|-------|------|-----------|------------|--------|
| Framework installation | `.isdlc/` OR `.claude/agents/` | At least one must exist | U-F01 | `exit 1` |

### 2.4 uninstall.ps1 Non-Fatal Checks

| Check | Path | If Missing |
|-------|------|-----------|
| Manifest file | `.isdlc/installed-files.json` | Warn, offer legacy mode |
| monorepo.json | `.isdlc/monorepo.json` | Not a monorepo |
| settings.json | `.claude/settings.json` | Skip settings cleanup |
| CLAUDE.md.backup | `$ProjectRoot/CLAUDE.md.backup` | Skip restore prompt |
| docs/ directory | `$ProjectRoot/docs` | Skip docs cleanup |

### 2.5 update.ps1 Fatal Checks

| Check | Path | Condition | Error Code | Action |
|-------|------|-----------|------------|--------|
| .isdlc/ exists | `$ProjectRoot/.isdlc` | Must exist | UP-F01 | `exit 1` |
| .claude/ exists | `$ProjectRoot/.claude` | Must exist | UP-F01 | `exit 1` |
| state.json exists | `$ProjectRoot/.isdlc/state.json` | Must exist | UP-F02 | `exit 1` |
| Framework package.json | `$ScriptDir/package.json` | Must exist | UP-F03 | `exit 1` |
| Framework src/claude/ | `$ScriptDir/src/claude` | Must exist | UP-F04 | `exit 1` |

### 2.6 update.ps1 Non-Fatal Checks

| Check | Path | If Missing |
|-------|------|-----------|
| Old manifest | `.isdlc/installed-files.json` | Skip obsolete file cleanup |
| monorepo.json | `.isdlc/monorepo.json` | Skip monorepo state updates |
| Per-project state.json | `.isdlc/projects/*/state.json` | Skip that project's version bump |
| settings.json (existing) | `.claude/settings.json` | Copy instead of merge |
| settings.local.json (existing) | `.claude/settings.local.json` | Copy instead of merge |

---

## 3. JSON Parse Error Handling

### 3.1 General Pattern

```powershell
try {
    $content = Get-Content $filePath -Raw -ErrorAction Stop | ConvertFrom-Json
}
catch {
    Write-Err "Failed to parse JSON: $filePath"
    Write-Err "Error: $_"
    # Action depends on criticality (see table)
}
```

### 3.2 Criticality Matrix

| File | Script | Criticality | On Parse Failure |
|------|--------|-------------|-----------------|
| state.json (read) | update.ps1 | FATAL | `exit 1` |
| package.json (read) | update.ps1 | FATAL | `exit 1` |
| installed-files.json (read) | uninstall.ps1 | DEGRADED | Fall back to legacy removal mode |
| installed-files.json (read) | update.ps1 | DEGRADED | Skip obsolete file cleanup |
| settings.json (read for merge) | install.ps1 | DEGRADED | Copy new instead of merging |
| settings.json (read for merge) | update.ps1 | DEGRADED | Copy new, save old as `.json.bak` |
| settings.json (read for cleanup) | uninstall.ps1 | DEGRADED | Warn user to clean manually |
| settings.local.json (read) | install.ps1 | DEGRADED | Copy new instead of merging |
| settings.local.json (read) | update.ps1 | DEGRADED | Copy new, save old as `.json.bak` |

### 3.3 ConvertTo-Json -Depth 10 Mandate

Every call to `ConvertTo-Json` MUST include `-Depth 10`. The default depth of 2 truncates nested objects. Affected calls:

1. state.json generation (install.ps1, update.ps1)
2. monorepo.json generation (install.ps1)
3. per-project state.json generation (install.ps1, update.ps1)
4. installed-files.json generation (install.ps1, update.ps1)
5. settings.json merge output (all three scripts)
6. settings.local.json merge output (install.ps1, update.ps1)
7. external-skills-manifest.json generation (install.ps1)

---

## 4. Path Validation Rules

### 4.1 Path Construction

All paths MUST be constructed using `Join-Path`:

```powershell
# CORRECT
$targetPath = Join-Path $ProjectRoot ".claude" "agents"

# INCORRECT -- string concatenation
$targetPath = "$ProjectRoot\.claude\agents"
```

**PS 5.1 note**: `Join-Path` only accepts two segments on PS 5.1. For 3+ segments, nest calls:

```powershell
$targetPath = Join-Path (Join-Path $ProjectRoot ".claude") "agents"
```

### 4.2 Path Traversal Prevention

- All file operations are relative to `$ProjectRoot` or `$ScriptDir`
- Manifest stores relative paths only (no absolute paths)
- `Resolve-Path` is NOT used (could resolve to unexpected locations)
- Monorepo manual entry validated with `Test-Path -PathType Container`

### 4.3 Forward-Slash Conversion Points

`ConvertTo-ForwardSlashPath` MUST be applied at these exact points:

| Script | Location | What is Converted |
|--------|----------|-------------------|
| install.ps1 | Manifest file paths | `$file.FullName.Substring($ProjectRoot.Length + 1)` |
| install.ps1 | monorepo.json scan_paths | Parent directory paths |
| install.ps1 | monorepo.json project paths | `$relPath` in project entries |
| install.ps1 | per-project state.json | `project.path` field |
| update.ps1 | New file list for diff | `$file.FullName.Substring($ProjectRoot.Length + 1)` |
| update.ps1 | Regenerated manifest paths | Same as install.ps1 |
| uninstall.ps1 | User file identification | `$file.FullName.Substring($ProjectRoot.Length + 1)` |

### 4.4 Relative Path Edge Case

When extracting relative paths from absolute paths:

```powershell
$normalizedRoot = $ProjectRoot.TrimEnd('\', '/')
$relPath = $file.FullName.Substring($normalizedRoot.Length + 1)
$relPath = ConvertTo-ForwardSlashPath $relPath
```

The `TrimEnd` prevents off-by-one errors when `$ProjectRoot` ends with a separator.

### 4.5 Manifest Path to Native Path Conversion

When reading manifest paths for file operations:

```powershell
# Manifest path: ".claude/agents/sdlc/01-requirements-analyst.md"
# Need native Windows path for Test-Path/Remove-Item
$nativePath = Join-Path $ProjectRoot ($manifestPath -replace '/', '\')
```

Or more robustly:

```powershell
$segments = $manifestPath -split '/'
$nativePath = $ProjectRoot
foreach ($segment in $segments) {
    $nativePath = Join-Path $nativePath $segment
}
```

---

## 5. Monorepo Validation Rules

### 5.1 Workspace File Detection Priority

| Priority | File | Type |
|----------|------|------|
| 1 | `pnpm-workspace.yaml` | pnpm |
| 2 | `lerna.json` | lerna |
| 3 | `turbo.json` | turbo |
| 4 | `nx.json` | nx |
| 5 | `rush.json` | rush |

First match wins. No multi-type detection.

### 5.2 Directory Structure Detection

```
Sum of subdirectory counts in: apps/, packages/, services/
If sum >= 2: monorepo (type "directory-structure")
```

### 5.3 Root-Level Project Detection

For each top-level directory (excluding skip list):
- Must contain at least one of: `package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `pom.xml`, `build.gradle`, or a `src/` subdirectory
- If 2+ such directories found: monorepo (type "root-directories")

### 5.4 Skip Directory List

```
.claude, .isdlc, .git, docs, node_modules, scripts, vendor, dist, build, target, <framework-folder-name>
```

### 5.5 Manual Entry Validation

```
Input: "frontend, backend, shared"
Processing:
  1. Split by comma
  2. Trim whitespace from each segment
  3. Filter empty segments
  4. For each: Test-Path (Join-Path $ProjectRoot $segment) -PathType Container
  5. Valid: add to DetectedProjects
  6. Invalid: display error, skip
  7. If zero valid: fall back to single-project mode
```

### 5.6 Duplicate Prevention

When combining auto-detected projects from apps/packages/services with root-level projects:

```
For each $RootProjectDir:
  If $DetectedProjects already contains entry with same .Name: skip
  Else: add to $DetectedProjects
```

---

## 6. User Input Validation

### 6.1 Confirmation Prompts (Y/N)

**Pattern**: `$answer -match '^[Yy]$'`

| Input | Result |
|-------|--------|
| `Y` | Yes |
| `y` | Yes |
| `N` | No |
| `n` | No |
| Empty string | Default (varies per prompt) |
| Any other string | No (conservative) |

### 6.2 Provider Mode Selection (1-6)

| Input | Result |
|-------|--------|
| `1` | claude-code |
| `2` | quality |
| `3` | free |
| `4` | budget |
| `5` | local |
| `6` | hybrid |
| Empty | claude-code (default) |
| Other | claude-code + warning |

### 6.3 Tour Selection (1-3)

| Input | Result |
|-------|--------|
| `1` | Light intro |
| `2` | Full tour |
| `3` | Skip |
| Empty | Light intro (default) |
| Other | Skip (conservative) |

### 6.4 Docs Location (1-2, monorepo only)

| Input | Result |
|-------|--------|
| `1` | root |
| `2` | project |
| Empty | root (default) |
| Other | root (default) |

---

## 7. Environment Checks

### 7.1 Node.js Availability

```powershell
if ($null -eq (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Warn "Node.js not found. Hooks require Node.js to run."
    Write-Warn "Install Node.js from https://nodejs.org/"
}
```

**Severity**: Warning only (non-blocking).

### 7.2 Claude Code Availability

```powershell
try {
    $version = & claude --version 2>&1
    if ($LASTEXITCODE -ne 0) { throw "exit code $LASTEXITCODE" }
    $ClaudeCodeFound = $true
}
catch {
    $ClaudeCodeFound = $false
    # Display warning and optional continue prompt
}
```

**Severity**: Warning with optional abort (user chooses to continue or exit).

### 7.3 YAML-to-JSON Conversion Tools

Checked only when pre-built JSON manifest is unavailable:

```
1. Pre-built JSON exists -> use it (no tool needed)
2. yq on PATH -> use yq -o=json
3. python3 on PATH with PyYAML -> use python3 -c "import yaml, json; ..."
4. python on PATH with PyYAML -> use python -c "import yaml, json; ..."
5. None available -> warning (manifest may need manual conversion)
```

**Windows-specific**: On Windows, Python may be `python` not `python3`. Check both.

### 7.4 Interactive Mode Detection

```powershell
$isInteractive = [Environment]::UserInteractive
```

Tour is only offered when `$isInteractive -and -not $Force`.

---

## 8. Traceability

| Validation Area | Requirements | NFRs |
|----------------|-------------|------|
| Parameter validation | REQ-006 | NFR-001 |
| File existence checks (fatal) | REQ-001, REQ-002, REQ-003 | NFR-006 |
| File existence checks (non-fatal) | REQ-001 | NFR-002 |
| JSON parse error handling | REQ-004 | NFR-006 |
| Path validation | REQ-004 | NFR-004 |
| Forward-slash conversion | REQ-004 | NFR-002 |
| Monorepo validation | REQ-001 | NFR-002 |
| User input validation | REQ-001, REQ-006 | NFR-006 |
| Version comparison | REQ-003 | NFR-002 |
| Manifest validation | REQ-002, REQ-003 | NFR-004, NFR-005 |
| Environment checks | REQ-001 | NFR-001 |
