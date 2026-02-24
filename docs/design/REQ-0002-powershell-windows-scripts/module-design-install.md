# Module Design: install.ps1

**Feature**: REQ-0002-powershell-windows-scripts
**Phase**: 04 - Design
**Created**: 2026-02-08
**Status**: Draft
**Bash Reference**: install.sh (1404 lines)
**Estimated Lines**: 800-1000

---

## 1. Parameter Declaration

```powershell
[CmdletBinding()]
param(
    [switch]$Force,
    [switch]$Help
)
```

| Parameter | Type | Default | Bash Equivalent | Purpose |
|-----------|------|---------|-----------------|---------|
| `-Force` | switch | $false | N/A (bash has no equivalent -- prompts are always shown) | Skip all interactive prompts, use defaults |
| `-Help` | switch | $false | `--help` | Display usage and exit |

**`-Force` behavior** (from REQ-006):
- Skip installation confirmation prompt
- Auto-accept monorepo detection (default: single-project)
- Skip Claude Code detection warning (continue anyway)
- Default provider mode: `claude-code`
- Skip tour prompt
- Never call `Read-Host`

---

## 2. Script-Level Variables

```powershell
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$FrameworkDir = Join-Path $ScriptDir "src"
$ProjectRoot = Split-Path -Parent $ScriptDir
$FrameworkClaude = Join-Path $FrameworkDir "claude"
$FrameworkIsdlc = Join-Path $FrameworkDir "isdlc"
$Timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
```

**Path derivation** (matches bash):
- `$ScriptDir` = the cloned isdlc-framework folder (where install.ps1 lives)
- `$ProjectRoot` = parent of `$ScriptDir` (the user's project root)
- `$FrameworkDir` = `$ScriptDir/src` (framework source files)

---

## 3. Execution Flow (Step-by-Step)

### Step 0: Help + Prereqs

```
IF -Help:
    Display usage text
    exit 0

Remove development files from framework clone:
    $ScriptDir/.git (Remove-Item -Recurse -Force -ErrorAction SilentlyContinue)
    $ScriptDir/.gitignore
    $ScriptDir/CHANGELOG.md
    $ScriptDir/NEXT-SESSION.md
    $ScriptDir/docs/SESSION-*.md
    $ScriptDir/docs/archive/
```

**Bash mapping**: Lines 38-57 of install.sh

---

### Step 0b: Banner + Confirmation

```
Display installation banner (Write-Banner "iSDLC Framework - Project Installation")
Show project directory path

IF NOT -Force:
    Prompt: "Continue with installation? [Y/n]"
    IF not Y: exit 0

Derive $ProjectName from directory: Split-Path -Leaf $ProjectRoot
```

**Bash mapping**: Lines 59-85

---

### Step 0c: Detect Existing Project

```powershell
function Test-ProjectExists {
    param([string]$Root)
    # Check project marker files
    $markers = @(
        "package.json", "requirements.txt", "pyproject.toml",
        "go.mod", "Cargo.toml", "pom.xml", "build.gradle",
        "Gemfile", "composer.json", "Makefile"
    )
    foreach ($m in $markers) {
        if (Test-Path (Join-Path $Root $m)) { return $true }
    }
    # Check project marker directories
    $dirs = @("src", "lib", "app", "pkg", "cmd")
    foreach ($d in $dirs) {
        if (Test-Path (Join-Path $Root $d) -PathType Container) { return $true }
    }
    # Check for source code files (depth 3)
    $extensions = @("*.js","*.ts","*.py","*.go","*.rs","*.java","*.rb","*.php","*.cs")
    foreach ($ext in $extensions) {
        $found = Get-ChildItem $Root -Filter $ext -Recurse -Depth 3 -File -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found) { return $true }
    }
    return $false
}
```

**Bash mapping**: Lines 88-106

**Output**: `$IsExistingProject` (boolean)

---

### Step 0d: Detect Monorepo

```powershell
function Test-MonorepoIndicators {
    param([string]$Root)
    # Check workspace files
    $workspaceFiles = @{
        "pnpm-workspace.yaml" = "pnpm"
        "lerna.json"          = "lerna"
        "turbo.json"          = "turbo"
        "nx.json"             = "nx"
        "rush.json"           = "rush"
    }
    foreach ($entry in $workspaceFiles.GetEnumerator()) {
        if (Test-Path (Join-Path $Root $entry.Key)) {
            return @{ IsMonorepo = $true; Type = $entry.Value; Projects = @() }
        }
    }

    # Check directory structure (apps/, packages/, services/)
    $subprojectCount = 0
    foreach ($dir in @("apps", "packages", "services")) {
        $path = Join-Path $Root $dir
        if (Test-Path $path -PathType Container) {
            $subprojectCount += (Get-ChildItem $path -Directory -ErrorAction SilentlyContinue).Count
        }
    }
    if ($subprojectCount -ge 2) {
        return @{ IsMonorepo = $true; Type = "directory-structure"; Projects = @() }
    }

    # Check root-level directories with project markers
    $skipDirs = @(".claude",".isdlc",".git","docs","node_modules","scripts",
                  "vendor","dist","build","target",(Split-Path -Leaf $ScriptDir))
    $rootProjects = @()
    foreach ($dir in (Get-ChildItem $Root -Directory -ErrorAction SilentlyContinue)) {
        if ($skipDirs -contains $dir.Name) { continue }
        $hasMarker = $false
        foreach ($marker in @("package.json","go.mod","Cargo.toml","pyproject.toml","pom.xml","build.gradle")) {
            if (Test-Path (Join-Path $dir.FullName $marker)) { $hasMarker = $true; break }
        }
        if (-not $hasMarker -and (Test-Path (Join-Path $dir.FullName "src") -PathType Container)) {
            $hasMarker = $true
        }
        if ($hasMarker) { $rootProjects += $dir.Name }
    }
    if ($rootProjects.Count -ge 2) {
        return @{ IsMonorepo = $true; Type = "root-directories"; Projects = $rootProjects }
    }

    return @{ IsMonorepo = $false; Type = ""; Projects = @() }
}
```

**Bash mapping**: Lines 108-210

---

### Step 0e: Monorepo Confirmation + Project Entry

```
IF monorepo detected:
    Display "MONOREPO INDICATORS DETECTED" banner
    Show detected projects
    IF NOT -Force:
        Prompt: "Is this a monorepo? [Y/n]"
    ELSE:
        Default to single-project (NOT monorepo) in -Force mode
ELSE:
    Display "EXISTING PROJECT" or "NEW PROJECT" banner
    IF NOT -Force:
        Prompt: "Is this a monorepo? [y/N]"
    ELSE:
        Default to single-project

IF user confirms monorepo AND detected projects:
    IF NOT -Force:
        Prompt: "Use these projects? [Y/n]"
        IF rejected: Prompt for manual project entry

IF no projects after all detection:
    Fall back to single-project mode

Set $IsMonorepo, $MonorepoType, $DetectedProjects
```

**Bash mapping**: Lines 212-299

**-Force behavior**: Defaults to single-project mode (skips monorepo entirely). This is the safest default for CI/CD.

---

### Step 0f: Claude Code Detection

```
IF Get-Command "claude" -ErrorAction SilentlyContinue:
    $ClaudeCodeFound = $true
    $ClaudeCodeVersion = claude --version
ELSE:
    $ClaudeCodeFound = $false
    Display warning with install URL
    IF NOT -Force:
        Prompt: "Continue anyway? [y/N]"
        IF not Y: exit 0
```

**Bash mapping**: Lines 302-333

---

### Step 0g: Agent Model Configuration

```
IF NOT -Force:
    Display 6 provider options:
      1) Claude Code (Recommended)
      2) Quality
      3) Free
      4) Budget
      5) Local
      6) Hybrid
    $ProviderMode = Read-Host "Choice [1]"
    Map choice to mode name
ELSE:
    $ProviderMode = "claude-code"
```

**Bash mapping**: Lines 335-377

---

### Step 1/6: Set Up .claude/ Folder

```
IF .claude/ exists:
    Backup CLAUDE.md if it exists (copy to CLAUDE.md.backup)

IF NOT .claude/ exists:
    New-Item .claude -ItemType Directory

Copy agents, commands, skills from framework:
    Copy-Item (Join-Path $FrameworkClaude "agents") (Join-Path $ProjectRoot ".claude") -Recurse -Force
    Copy-Item (Join-Path $FrameworkClaude "commands") (Join-Path $ProjectRoot ".claude") -Recurse -Force
    Copy-Item (Join-Path $FrameworkClaude "skills") (Join-Path $ProjectRoot ".claude") -Recurse -Force

Merge or copy settings.local.json:
    IF both exist: Merge-JsonDeep
    ELSE: Copy-Item
```

**Bash mapping**: Lines 382-462

---

### Step 1b/6: Set Up Hooks

```
Check Node.js availability: Get-Command "node"
    IF missing: warn (hooks require Node.js)

Create directory: .claude/hooks/lib, .claude/hooks/tests/test-scenarios

Copy hooks from framework:
    Copy-Item (Join-Path $FrameworkClaude "hooks\*") (Join-Path $ProjectRoot ".claude\hooks") -Recurse -Force

Merge or copy settings.json:
    IF both exist:
        $existing = Read-JsonFile ".claude/settings.json"
        $framework = Read-JsonFile (Join-Path $FrameworkClaude "settings.json")
        $merged = Merge-JsonDeep -Base $existing -Override $framework
        Write-JsonFile ".claude/settings.json" $merged
    ELSE:
        Copy-Item
```

**Bash mapping**: Lines 468-506

**Critical**: settings.json merge must preserve user hooks while adding framework hooks. Order matters: existing settings are base, framework settings are override.

---

### Step 2/6: Create docs/ Folder

```
IF NOT docs/ exists:
    New-Item docs -ItemType Directory -Force

Create subdirectories:
    docs/requirements
    docs/architecture
    docs/design
    docs/isdlc/checklists

Copy requirement templates:
    IF src/isdlc/templates/requirements/*.md exists:
        Copy-Item to docs/requirements/

Generate docs/README.md (here-string template)
```

**Bash mapping**: Lines 508-568

---

### Step 3/6: Create .isdlc/ Folder

```
Create phase artifact directories:
    .isdlc/phases/{01-requirements,...,13-operations}/artifacts

Copy config, checklists, templates, scripts from framework

Copy skills manifest to hooks config:
    Priority order:
    1. Pre-built JSON from hooks/config/skills-manifest.json (preferred)
    2. Pre-built JSON from isdlc/config/skills-manifest.json
    3. Warn: yq/python not attempted (ConvertFrom-Json cannot read YAML)

Copy workflows.json to both .isdlc/config/ and .claude/hooks/config/

Generate providers.yaml from template:
    Read template
    Replace active_mode line with $ProviderMode
    Write-Utf8NoBom

Generate state.json (see New-StateJson below)
```

**Bash mapping**: Lines 570-765

**YAML manifest note**: PowerShell has no built-in YAML parser. Unlike bash (which can shell out to yq/python), we rely on pre-built JSON existing in the framework. If only YAML exists, we warn and skip -- hooks will fall back to the YAML file path if their code supports it.

---

### Step 3/6: state.json Template

```powershell
function New-StateJson {
    param(
        [string]$ProjectName,
        [bool]$IsExistingProject,
        [string]$Timestamp,
        [string]$ProviderMode
    )

    $state = [PSCustomObject]@{
        framework_version = "0.1.0-alpha"
        project = [PSCustomObject]@{
            name = $ProjectName
            created = $Timestamp
            description = ""
            is_new_project = (-not $IsExistingProject)
        }
        complexity_assessment = [PSCustomObject]@{
            level = $null
            track = "auto"
            assessed_at = $Timestamp
            assessed_by = "manual"
            dimensions = [PSCustomObject]@{
                architectural = $null
                security = $null
                testing = $null
                deployment = $null
                team = $null
                timeline = $null
            }
        }
        workflow = [PSCustomObject]@{
            track = "auto"
            track_name = "Orchestrator-managed"
            phases_required = $null
            phases_optional = $null
            phases_skipped = $null
        }
        constitution = [PSCustomObject]@{
            enforced = $true
            path = "docs/isdlc/constitution.md"
            validated_at = $null
        }
        autonomous_iteration = [PSCustomObject]@{
            enabled = $true
            max_iterations = 10
            timeout_per_iteration_minutes = 5
            circuit_breaker_threshold = 3
        }
        skill_enforcement = [PSCustomObject]@{
            enabled = $true
            mode = "observe"
            fail_behavior = "allow"
            manifest_version = "2.0.0"
        }
        cloud_configuration = [PSCustomObject]@{
            provider = "undecided"
            configured_at = $null
            credentials_validated = $false
            aws = $null
            gcp = $null
            azure = $null
            deployment = [PSCustomObject]@{
                staging_enabled = $false
                production_enabled = $false
                workflow_endpoint = "10-local-testing"
            }
        }
        iteration_enforcement = [PSCustomObject]@{
            enabled = $true
        }
        skill_usage_log = @()
        active_workflow = $null
        workflow_history = @()
        counters = [PSCustomObject]@{
            next_req_id = 1
            next_bug_id = 1
        }
        current_phase = "01-requirements"
        phases = [PSCustomObject]@{
            "01-requirements"  = [PSCustomObject]@{ status="pending"; started=$null; completed=$null; gate_passed=$null; artifacts=@() }
            "02-architecture"  = [PSCustomObject]@{ status="pending"; started=$null; completed=$null; gate_passed=$null; artifacts=@() }
            "03-design"        = [PSCustomObject]@{ status="pending"; started=$null; completed=$null; gate_passed=$null; artifacts=@() }
            "04-test-strategy" = [PSCustomObject]@{ status="pending"; started=$null; completed=$null; gate_passed=$null; artifacts=@() }
            "05-implementation"= [PSCustomObject]@{ status="pending"; started=$null; completed=$null; gate_passed=$null; artifacts=@(); iteration_tracking=[PSCustomObject]@{ current=0; max=$null; history=@(); final_status=$null } }
            "06-testing"       = [PSCustomObject]@{ status="pending"; started=$null; completed=$null; gate_passed=$null; artifacts=@(); iteration_tracking=[PSCustomObject]@{ current=0; max=$null; history=@(); final_status=$null } }
            "07-code-review"   = [PSCustomObject]@{ status="pending"; started=$null; completed=$null; gate_passed=$null; artifacts=@() }
            "08-validation"    = [PSCustomObject]@{ status="pending"; started=$null; completed=$null; gate_passed=$null; artifacts=@() }
            "09-cicd"          = [PSCustomObject]@{ status="pending"; started=$null; completed=$null; gate_passed=$null; artifacts=@() }
            "10-local-testing" = [PSCustomObject]@{ status="pending"; started=$null; completed=$null; gate_passed=$null; artifacts=@() }
            "11-test-deploy"   = [PSCustomObject]@{ status="pending"; started=$null; completed=$null; gate_passed=$null; artifacts=@() }
            "12-production"    = [PSCustomObject]@{ status="pending"; started=$null; completed=$null; gate_passed=$null; artifacts=@() }
            "13-operations"    = [PSCustomObject]@{ status="pending"; started=$null; completed=$null; gate_passed=$null; artifacts=@() }
        }
        blockers = @()
        active_agent = $null
        history = @(
            [PSCustomObject]@{
                timestamp = $Timestamp
                agent = "init-script"
                action = "Project initialized with iSDLC framework"
            }
        )
    }

    return $state
}
```

**Critical JSON fidelity requirements**:
- `is_new_project` must be a boolean (not a string "true"/"false")
- `null` values must serialize as JSON `null` (not empty string)
- Empty arrays `@()` must serialize as `[]`
- ConvertTo-Json -Depth 10 required to prevent truncation
- Path values (constitution.path) use forward slashes

---

### Step 3b/6: Monorepo Setup (Conditional)

```
IF $IsMonorepo:
    Determine $DefaultProject (first detected project name)
    Build scan_paths array from detected project paths
    Build projects object

    IF NOT -Force:
        Prompt: "Where should docs live? [1=root, 2=project]"
    ELSE:
        Default to "root"

    Generate monorepo.json:
        {
            version: "1.0.0",
            default_project: $DefaultProject,
            docs_location: $DocsLocation,
            projects: { ... },
            scan_paths: [ ... ]
        }

    For each project:
        Create .isdlc/projects/$name/
        Create .isdlc/projects/$name/skills/external/
        Create docs/isdlc/projects/$name/
        Generate per-project state.json (similar to root but with path field)
        Generate external-skills-manifest.json
        Create docs directories (root or project based on docs_location)

Create CLAUDE.md if missing (touch equivalent)
```

**Bash mapping**: Lines 770-963

---

### Step 4/6: Configure Constitution

```
Generate docs/isdlc/constitution.md from here-string template:
    - Include CONSTITUTION_STATUS: STARTER_TEMPLATE marker
    - Insert $ProjectName in preamble
    - Include generic Articles I-V
    - Include customization notes
    Write-Utf8NoBom
```

**Bash mapping**: Lines 965-1091

---

### Step 5/6: Generate Installation Manifest

```powershell
function New-ManifestJson {
    param(
        [string]$ProjectRoot,
        [string]$Timestamp,
        [string]$FrameworkVersion
    )

    $files = [System.Collections.ArrayList]::new()

    # Collect files from .claude directories
    foreach ($dir in @("agents","skills","commands","hooks")) {
        $dirPath = Join-Path $ProjectRoot ".claude" $dir
        # Note: Join-Path with 3 args requires PS 6+, use nested calls
        $dirPath = Join-Path (Join-Path $ProjectRoot ".claude") $dir
        if (Test-Path $dirPath) {
            Get-ChildItem $dirPath -Recurse -File | ForEach-Object {
                [void]$files.Add((Get-RelativePath $_.FullName $ProjectRoot))
            }
        }
    }

    # Add settings.json
    $settingsPath = Join-Path (Join-Path $ProjectRoot ".claude") "settings.json"
    if (Test-Path $settingsPath) {
        [void]$files.Add("$(ConvertTo-ForwardSlashPath '.claude/settings.json')")
    }

    return [PSCustomObject]@{
        version = "1.0.0"
        created = $Timestamp
        framework_version = $FrameworkVersion
        files = $files.ToArray()
    }
}
```

**Output**: Writes `.isdlc/installed-files.json`

**Critical**: All paths in the `files` array must use forward slashes (ConvertTo-ForwardSlashPath applied via Get-RelativePath).

**Bash mapping**: Lines 1092-1138

---

### Step 6/6: Cleanup + Copy Scripts

```
Copy uninstall.ps1 and update.ps1 to .isdlc/scripts/:
    Copy-Item (Join-Path $ScriptDir "uninstall.ps1") (Join-Path $ProjectRoot ".isdlc\scripts\")
    Copy-Item (Join-Path $ScriptDir "update.ps1") (Join-Path $ProjectRoot ".isdlc\scripts\")

Also copy bash scripts if they exist alongside:
    Copy-Item uninstall.sh, update.sh to .isdlc/scripts/ (for cross-platform)

Delete framework clone directory:
    Set-Location $ProjectRoot
    Remove-Item $ScriptDir -Recurse -Force
```

**Bash mapping**: Lines 1140-1166

---

### Step 7: Completion + Tour

```
Display "Installation Complete!" banner

Show project structure summary:
    .claude/ — Agent definitions and skills
    .isdlc/  — Project state and framework resources
    docs/    — Documentation

Show agent model configuration:
    Primary: Claude Code (version if found)
    Routing: $ProviderMode
    Config: .isdlc/providers.yaml

IF interactive (-not $Force) AND stdin is terminal:
    Display tour prompt:
        1) Light intro (5 sections)
        2) Full tour (8 sections)
        3) Skip
    Run selected tour sections

Display "NEXT STEPS" banner:
    IF Claude Code not found: show install URL first
    - Run claude
    - Run /discover
    - Run /sdlc start
    - Run /tour
```

**Bash mapping**: Lines 1168-1403

**Tour content**: Port all 8 tour sections from bash. Use Write-Host with -ForegroundColor instead of ANSI codes.

---

## 4. Error Handling Matrix

| Operation | Error Type | Response |
|-----------|-----------|----------|
| Framework dir not found | Fatal | Write-Err + exit 1 |
| .claude merge fails | Recoverable | Write-Warn, copy .new file |
| JSON parse fails | Recoverable | Write-Warn, skip operation |
| Directory creation fails | Fatal | $ErrorActionPreference catches |
| File copy fails | Fatal | $ErrorActionPreference catches |
| Node.js not found | Warning only | Write-Warn, continue |
| Claude Code not found | Warning + prompt | User decides continue/abort |
| YAML manifest missing JSON | Warning only | Write-Warn, hooks fall back |

---

## 5. Output Comparison Contract

The following files MUST be byte-identical (content, not metadata) between bash and PowerShell installations:

| File | Identical? | Notes |
|------|-----------|-------|
| .isdlc/state.json | Content-identical | Same JSON structure, same values, same key ordering |
| .isdlc/installed-files.json | Content-identical | Same forward-slash paths, same file list |
| .isdlc/monorepo.json | Content-identical | Same structure |
| .claude/settings.json | Content-identical | Same merge result |
| docs/isdlc/constitution.md | Content-identical | Same template text |
| docs/README.md | Content-identical | Same template text |
| .isdlc/providers.yaml | Content-identical | Same template with mode substituted |
| Console output | Visually similar | Colors differ (Write-Host vs ANSI), box chars may differ |

---

## 6. Traceability

| Step | Requirements | NFRs | ADRs |
|------|-------------|------|------|
| 0 (prereqs) | REQ-001, REQ-006 | NFR-006 | ADR-005 |
| 0b (confirm) | REQ-001, REQ-006 | - | ADR-005 |
| 0c (detect project) | REQ-001 | NFR-002 | - |
| 0d (detect monorepo) | REQ-001 | NFR-002 | - |
| 0f (Claude detection) | REQ-001 | NFR-002 | - |
| 0g (provider config) | REQ-001 | NFR-002 | - |
| 1/6 (.claude) | REQ-001 | NFR-002, NFR-007 | ADR-002 |
| 1b/6 (hooks) | REQ-001 | NFR-002, NFR-007 | ADR-002 |
| 2/6 (docs) | REQ-001 | NFR-002 | - |
| 3/6 (.isdlc) | REQ-001 | NFR-002, NFR-003 | ADR-004 |
| 3b/6 (monorepo) | REQ-001 | NFR-002 | ADR-003 |
| 4/6 (constitution) | REQ-001 | NFR-002 | ADR-004 |
| 5/6 (manifest) | REQ-001 | NFR-002 | ADR-003 |
| 6/6 (cleanup) | REQ-001 | NFR-002 | - |
