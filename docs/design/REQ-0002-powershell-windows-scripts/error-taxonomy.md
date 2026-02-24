# Error Taxonomy: PowerShell Scripts for Windows

**Feature**: REQ-0002-powershell-windows-scripts
**Phase**: 04 - Design
**Created**: 2026-02-08
**Status**: Approved
**ADR Reference**: ADR-005 (Error Handling Pattern)
**Traced From**: requirements-spec.md (REQ-001 to REQ-006), architecture-overview.md (ADR-005)

---

## 1. Error Classification

All errors fall into three categories:

| Category | Action | Exit Code | Bash Equivalent |
|----------|--------|-----------|-----------------|
| **Fatal** | `Write-Err` + `exit 1` | 1 | `echo -e "${RED}...${NC}" >&2; exit 1` |
| **Warning** | `Write-Warn` + fallback | 0 (continue) | `echo -e "${YELLOW}...${NC}"; <fallback>` |
| **Ignorable** | `-ErrorAction SilentlyContinue` | 0 (continue) | `2>/dev/null \|\| true` |

### Global Error Handling Setup

```powershell
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
```

This ensures:
- Uninitialized variable references throw errors (StrictMode)
- Unexpected cmdlet errors halt execution (ErrorActionPreference)
- Deliberate fallbacks use try/catch or -ErrorAction SilentlyContinue

---

## 2. install.ps1 Errors

### 2.1 Fatal Errors (exit 1)

| ID | Condition | Message (Exact) | Bash Equivalent (Line) |
|----|-----------|-----------------|----------------------|
| I-F01 | Framework `src/claude` directory missing | `"Error: Framework .claude folder not found at {path}"` | install.sh:389-391 |
| I-F02 | User declines installation confirmation | `"Installation cancelled."` | install.sh:77-79 |
| I-F03 | User declines Claude Code warning | `"Installation cancelled. Install Claude Code first, then re-run."` | install.sh:329-330 |

**Exit code**: All fatal errors exit with code 1 (matching bash `exit 1`).

**User cancellation** (I-F02, I-F03): These exit with code 0 (user chose to cancel, not an error). The bash script uses `exit 0` for these cases. The PowerShell scripts match this behavior.

### 2.2 Warnings (continue with fallback)

| ID | Condition | Message (Exact) | Fallback | Bash Equivalent (Line) |
|----|-----------|-----------------|----------|----------------------|
| I-W01 | settings.json merge fails (parse error) | `"Warning: Could not merge settings.json — may need manual merge"` | Copy framework settings.json as `.json.new` | install.sh:498-500 |
| I-W02 | settings.local.json merge fails | `"Warning: Could not merge settings.local.json — may need manual merge"` | Copy framework file as `.json.new` | install.sh:434-436 |
| I-W03 | No pre-built JSON manifest, no yq, no python | `"Warning: Could not convert manifest. Install yq or Python+PyYAML."` | Skills manifest may need manual conversion | install.sh:609 |
| I-W04 | Node.js not found | `"Warning: Node.js not found. Hooks require Node.js to run."` | Continue installation (hooks won't work until Node.js installed) | install.sh:475-476 |
| I-W05 | Monorepo project directory not found (manual entry) | `"  X {dir} (not found -- skipping)"` | Skip that directory, continue with others | install.sh:288 |
| I-W06 | All manual monorepo entries invalid | `"No valid project directories found. Falling back to single-project mode."` | Set IsMonorepo = false | install.sh:292-293 |
| I-W07 | Invalid provider mode choice | `"Invalid choice -- defaulting to Claude Code"` | Use claude-code mode | install.sh:364 |
| I-W08 | Claude Code not found | `"Claude Code CLI not found on PATH"` | Prompt to continue or abort | install.sh:318-319 |
| I-W09 | providers.yaml.template not found | `"providers.yaml.template not found -- skipping provider config"` | No providers.yaml created | install.sh:661 |
| I-W10 | providers.yaml already exists | `"providers.yaml already exists -- skipping (use /provider set to change mode)"` | Preserve existing file | install.sh:648 |
| I-W11 | CLAUDE.md missing at project root | `"CLAUDE.md was missing - created empty one in project root"` | Create empty file | install.sh:961-963 |
| I-W12 | Framework CLAUDE.md removed | `"Removed framework CLAUDE.md (not needed for user projects)"` | N/A (informational) | install.sh:396 |

### 2.3 Ignorable Errors (silently continue)

| ID | Condition | PowerShell Pattern | Bash Equivalent |
|----|-----------|-------------------|----------------|
| I-G01 | .git directory removal fails | `Remove-Item "$ScriptDir/.git" -Recurse -Force -ErrorAction SilentlyContinue` | `rm -rf "$SCRIPT_DIR/.git"` |
| I-G02 | .gitignore removal fails | `Remove-Item "$ScriptDir/.gitignore" -Force -ErrorAction SilentlyContinue` | `rm -f "$SCRIPT_DIR/.gitignore"` |
| I-G03 | CHANGELOG.md removal fails | `Remove-Item ... -ErrorAction SilentlyContinue` | `rm -f ... 2>/dev/null \|\| true` |
| I-G04 | NEXT-SESSION.md removal fails | `Remove-Item ... -ErrorAction SilentlyContinue` | `rm -f ... 2>/dev/null \|\| true` |
| I-G05 | SESSION-*.md removal fails | `Get-ChildItem ... -ErrorAction SilentlyContinue \| Remove-Item` | `rm -f ... 2>/dev/null \|\| true` |
| I-G06 | docs/archive removal fails | `Remove-Item ... -ErrorAction SilentlyContinue` | `rm -rf ... 2>/dev/null \|\| true` |
| I-G07 | .DS_Store removal fails | `Get-ChildItem ... -ErrorAction SilentlyContinue \| Remove-Item` | `find ... -delete 2>/dev/null \|\| true` |

---

## 3. uninstall.ps1 Errors

### 3.1 Fatal Errors (exit 1)

| ID | Condition | Message (Exact) | Bash Equivalent (Line) |
|----|-----------|-----------------|----------------------|
| U-F01 | No .isdlc/ AND no .claude/agents/ | `"No iSDLC framework installation detected."` + `"Expected .isdlc/ and/or .claude/agents/ to exist."` | uninstall.sh:182-186 |
| U-F02 | User declines uninstall confirmation | `"Uninstall cancelled."` | uninstall.sh:479-480 (exit 0) |
| U-F03 | Unknown flag passed | `"Unknown option: {flag}"` + `"Run uninstall.ps1 -? for usage."` | uninstall.sh:108-111 (handled by CmdletBinding) |

**Note**: U-F02 exits with code 0 (user cancellation, not error). U-F03 is handled automatically by `[CmdletBinding()]` which produces a PowerShell error for unknown parameters.

### 3.2 Warnings (continue with fallback)

| ID | Condition | Message (Exact) | Fallback | Bash Equivalent (Line) |
|----|-----------|-----------------|----------|----------------------|
| U-W01 | Manifest JSON parse fails | `"Failed to parse manifest: {path}"` | Switch to legacy removal mode (HasManifest = false) | uninstall.sh:208-213 |
| U-W02 | No manifest file found | `"No installation manifest found at .isdlc/installed-files.json"` | Present options: continue/abort/create manifest | uninstall.sh:215-291 |
| U-W03 | settings.json parse fails during cleanup | `"Could not parse .claude/settings.json: {error}"` | Leave file untouched, warn user | uninstall.sh:582-589 |
| U-W04 | Legacy mode (no manifest, no jq equivalent) | `"Cannot parse manifest. Will use legacy removal mode (less safe)."` | Pattern-based removal | uninstall.sh:210-212 |

### 3.3 Ignorable Errors (silently continue)

| ID | Condition | PowerShell Pattern |
|----|-----------|-------------------|
| U-G01 | Tracked file already removed | `Test-Path` check before `Remove-Item` |
| U-G02 | Empty directory removal fails | `Remove-Item ... -ErrorAction SilentlyContinue` |
| U-G03 | .claude/ not fully empty after cleanup | Continue (may contain settings.local.json) |

---

## 4. update.ps1 Errors

### 4.1 Fatal Errors (exit 1)

| ID | Condition | Message (Exact) | Bash Equivalent (Line) |
|----|-----------|-----------------|----------------------|
| UP-F01 | No .isdlc/ or .claude/ | `"Error: No iSDLC installation found."` + `"Expected .isdlc/ and .claude/ to exist."` + `"Run install.ps1 first to set up the framework."` | update.sh:114-119 |
| UP-F02 | state.json missing | `"Error: .isdlc/state.json not found -- installation may be corrupted."` | update.sh:121-123 |
| UP-F03 | Framework package.json missing | `"Error: package.json not found at {path}"` | update.sh:151-153 |
| UP-F04 | Framework src/claude/ missing | `"Error: Framework source not found at {path}"` | update.sh:254-257 |
| UP-F05 | User declines update | `"Update cancelled."` | update.sh:184-186 (exit 0) |
| UP-F06 | state.json parse fails (version read) | `"Error: Failed to read state.json"` | update.sh:134-139 |
| UP-F07 | package.json parse fails | `"Error: Failed to read package.json"` | update.sh:143-149 |

**Note**: UP-F05 exits with code 0 (user cancellation). UP-F06 and UP-F07 are fatal because update cannot proceed without knowing versions.

### 4.2 Warnings (continue with fallback)

| ID | Condition | Message (Exact) | Fallback | Bash Equivalent (Line) |
|----|-----------|-----------------|----------|----------------------|
| UP-W01 | Old manifest parse fails | `"Warning: Could not parse old manifest"` | Skip obsolete file cleanup | update.sh:237-243 |
| UP-W02 | No old manifest found | `"No installation manifest found (legacy install)"` + `"Removed-files cleanup will be skipped"` | Skip cleanup | update.sh:242-244 |
| UP-W03 | settings.json merge fails | `"Warning: Could not merge settings.json -- may need manual merge"` | Copy framework as `.json.new` | update.sh:313-317 |
| UP-W04 | settings.local.json merge fails | `"Warning: Could not merge settings.local.json -- may need manual merge"` | Copy framework as `.json.new` | update.sh:341-346 |
| UP-W05 | state.json update (history append) fails | `"Warning: Failed to update state.json"` + `"Framework files were updated but state.json version may be stale."` | Continue (files already updated) | update.sh:555-562 |
| UP-W06 | Per-project state.json parse fails | (Warning for specific project, continue with others) | Skip that project | update.sh:540-551 |
| UP-W07 | Same version, no -Force | `"Already up to date!"` + `"Use -Force to reinstall the current version."` | Exit 0 (not an error) | update.sh:160-163 |
| UP-W08 | YAML manifest conversion tools not found | `"Warning: Could not convert manifest. Install yq or Python+PyYAML."` | Skills manifest not updated | update.sh:400-402 |

### 4.3 Ignorable Errors (silently continue)

| ID | Condition | PowerShell Pattern |
|----|-----------|-------------------|
| UP-G01 | Backup directory creation (already exists) | `New-Item -Force` (overwrites) |
| UP-G02 | Obsolete file already removed | `Test-Path` check before `Remove-Item` |
| UP-G03 | Framework source cleanup declined | Leave directory in place |

---

## 5. Error Message Format

### 5.1 Fatal Error Template

```powershell
Write-Err "{What happened}"
Write-Err "{What to do about it}"
exit 1
```

Example:
```
  X Error: No iSDLC installation found.
  X Expected .isdlc/ and .claude/ to exist.
  X Run install.ps1 first to set up the framework.
```

### 5.2 Warning Template

```powershell
Write-Warn "{What happened}"
Write-Warn "{Automatic fallback or manual action}"
```

Example:
```
  ! Warning: Could not merge settings.json -- may need manual merge
  ! Saved new settings to .claude/settings.json.new -- please merge manually
```

### 5.3 Console Output Rules

- All error/warning messages are indented with 2 spaces (matching bash alignment)
- Fatal errors use `Write-Err` (red text with `X` prefix)
- Warnings use `Write-Warn` (yellow text with `!` prefix)
- No stack traces displayed to user
- Actionable guidance always included
- Error messages match bash equivalents as closely as possible

---

## 6. Error Handling Patterns

### 6.1 $ErrorActionPreference Strategy

```powershell
# Global (top of script)
$ErrorActionPreference = 'Stop'

# Pattern 1: Optional cleanup (may fail silently)
Remove-Item $path -Force -ErrorAction SilentlyContinue

# Pattern 2: Tool detection
$result = Get-Command "node" -ErrorAction SilentlyContinue
if ($null -eq $result) { Write-Warn "..." }

# Pattern 3: JSON read with fallback
try {
    $content = Get-Content $path -Raw -ErrorAction Stop | ConvertFrom-Json
}
catch {
    Write-Warn "Failed to parse: $path"
    # Apply fallback...
}

# Pattern 4: Critical operation
try {
    [System.IO.File]::WriteAllText($path, $content, $encoding)
}
catch {
    Write-Err "Failed to write: $path"
    Write-Err "Error: $_"
    exit 1
}
```

### 6.2 Dry-Run Error Handling

In `-DryRun` mode, destructive operations are replaced with messages but error detection still runs:

```powershell
if ($DryRun) {
    Write-Host "  [dry-run] Would remove file: $path" -ForegroundColor Yellow
}
else {
    Remove-Item $path -Force
}
```

Validation errors (pre-conditions) still apply in dry-run mode. Only the execution phase is skipped.

### 6.3 Unhandled Error Behavior

If an error is not caught by any try/catch block:
1. `$ErrorActionPreference = 'Stop'` causes PowerShell to halt
2. The error message is displayed in the console (PowerShell default behavior)
3. The script exits with a non-zero exit code
4. This is the correct fail-safe behavior (per Article X: Fail-Safe Defaults)

---

## 7. Error-to-Bash Mapping Summary

### install.ps1

| PS Error | Bash Line | Bash Pattern |
|----------|-----------|-------------|
| I-F01 | 389 | `echo -e "${RED}Error: Framework...${NC}"; exit 1` |
| I-F02 | 78 | `echo -e "${RED}Installation cancelled.${NC}"; exit 0` |
| I-F03 | 329 | `echo -e "${RED}Installation cancelled...${NC}"; exit 0` |
| I-W01 | 498 | `echo -e "${YELLOW}Warning: jq not found...${NC}"` |
| I-W03 | 609 | `echo -e "${YELLOW}Warning: Could not convert...${NC}"` |
| I-W04 | 475 | `echo -e "${YELLOW}Warning: Node.js not found...${NC}"` |
| I-W08 | 318 | `echo -e "${RED}Claude Code CLI not found...${NC}"` |
| I-G01 | 40 | `rm -rf "$SCRIPT_DIR/.git"` |

### uninstall.ps1

| PS Error | Bash Line | Bash Pattern |
|----------|-----------|-------------|
| U-F01 | 183 | `echo -e "${RED}No iSDLC...${NC}"; exit 1` |
| U-F02 | 479 | `echo -e "${RED}Uninstall cancelled.${NC}"; exit 0` |
| U-W01 | 210 | `echo -e "${YELLOW}Warning: jq not available...${NC}"` |
| U-W02 | 220 | `echo -e "${YELLOW}No installation manifest found...${NC}"` |
| U-W03 | 583 | `echo -e "${YELLOW}Warning: Could not parse...${NC}"` |

### update.ps1

| PS Error | Bash Line | Bash Pattern |
|----------|-----------|-------------|
| UP-F01 | 114 | `echo -e "${RED}Error: No iSDLC...${NC}"; exit 1` |
| UP-F02 | 122 | `echo -e "${RED}Error: state.json not found...${NC}"; exit 1` |
| UP-F03 | 152 | `echo -e "${RED}Error: package.json not found...${NC}"; exit 1` |
| UP-F04 | 255 | `echo -e "${RED}Error: Framework source not found...${NC}"; exit 1` |
| UP-F05 | 184 | `echo -e "${RED}Update cancelled.${NC}"; exit 0` |
| UP-W01 | 238 | `echo -e "${YELLOW}Warning: jq not available...${NC}"` |
| UP-W03 | 314 | `echo -e "${YELLOW}Warning: jq not found...${NC}"` |
| UP-W07 | 161 | `echo -e "${GREEN}Already up to date!${NC}"; exit 0` |

---

## 8. Traceability

| Error Category | Requirements | NFRs | Constitution Articles |
|---------------|-------------|------|---------------------|
| Fatal (exit 1) | REQ-006 | NFR-006 (Graceful failure) | X (Fail-Safe Defaults) |
| Warning (continue) | REQ-001, REQ-002, REQ-003 | NFR-006 | V (Simplicity First) |
| Ignorable | REQ-001, REQ-002, REQ-003 | - | V (Simplicity First) |
| User cancellation (exit 0) | REQ-006 | - | - |
| Dry-run reporting | REQ-002, REQ-003 | NFR-002 | - |
