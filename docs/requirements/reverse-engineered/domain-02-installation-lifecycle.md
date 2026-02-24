# Domain 02: Installation & Lifecycle

**Source Files**: `lib/installer.js`, `lib/updater.js`, `lib/uninstaller.js`, `lib/doctor.js`, `lib/project-detector.js`
**AC Count**: 16
**Priority**: 4 Critical, 8 High, 4 Medium

---

## AC-IL-001: Existing Installation Detection [CRITICAL]

**Given** a user runs `isdlc init` in a directory
**When** the installer checks for existing installations
**Then** it detects iSDLC presence by checking for `.isdlc/` and `.claude/` directories
**And** reads framework_version from `.isdlc/state.json` if it exists
**And** prompts the user to reinstall/upgrade (unless --force)

**Source**: `lib/installer.js:42-53`, `lib/project-detector.js:172-202`

---

## AC-IL-002: Project Type Detection [HIGH]

**Given** the installer scans the project root
**When** detecting project type
**Then** it checks for 20+ project markers across 12 ecosystems:
  - Node (package.json), TypeScript (tsconfig.json), Deno, Bun
  - Python (requirements.txt, pyproject.toml, setup.py, Pipfile, poetry.lock)
  - Go (go.mod), Rust (Cargo.toml), Java/Kotlin (pom.xml, build.gradle)
  - Ruby (Gemfile), PHP (composer.json), .NET (*.csproj, *.sln)
  - Make/CMake
**And** checks for source directories: src, lib, app, pkg, cmd, internal, source
**And** returns: isExisting, ecosystem, markers[]

**Source**: `lib/project-detector.js:13-118`

---

## AC-IL-003: Project Name Detection [HIGH]

**Given** the installer needs the project name
**When** detecting from the filesystem
**Then** it checks in order: package.json.name, pyproject.toml name, Cargo.toml name, directory basename
**And** returns the first match found

**Source**: `lib/project-detector.js:125-165`

---

## AC-IL-004: Six-Step Installation Flow [CRITICAL]

**Given** a user confirms installation
**When** the installer runs
**Then** it executes 6 sequential steps:
  1. Detect project type (new vs existing)
  2. Check for monorepo structure
  3. Copy framework files (.claude/agents, skills, commands, hooks)
  4. Setup .isdlc/ (phases, config, checklists, templates, scripts, providers.yaml)
  5. Setup docs/ (requirements, architecture, design, constitution)
  6. Generate state.json with initial project state

**Source**: `lib/installer.js:34-518`

---

## AC-IL-005: Settings.json Deep Merge [HIGH]

**Given** .claude/settings.json already exists in the project
**When** the installer or updater copies the framework settings
**Then** it deep-merges existing settings with framework settings
**And** preserves user-added keys that are not in the framework defaults
**And** framework keys override existing keys at the leaf level

**Source**: `lib/installer.js:213-228`, `lib/updater.js:371-389`

---

## AC-IL-006: Provider Mode Selection [HIGH]

**Given** the user has not passed --provider-mode flag
**When** the installer runs interactively (no --force)
**Then** it presents 5 provider mode options:
  - Free (Groq, Together, Google - no GPU needed)
  - Budget (Ollama locally, free cloud fallback)
  - Quality (Anthropic everywhere - requires API key)
  - Local (Ollama only - offline/air-gapped)
  - Hybrid (Smart per-phase routing)
**And** generates providers.yaml with the selected mode

**Source**: `lib/installer.js:137-153, 305-323`

---

## AC-IL-007: Eight-Step Update Flow [CRITICAL]

**Given** a user runs `isdlc update`
**When** an existing installation is found
**Then** it executes 8 sequential steps:
  1. Verify existing installation
  2. Compare versions (current vs available)
  3. Confirm with user (unless --force)
  4. Create backup (if --backup)
  5. Load old installation manifest
  6. Copy framework files (agents, skills, commands, hooks, settings, config)
  7. Clean removed files (diff old vs new manifest)
  8. Finalize (regenerate manifest, bump state.json version, update monorepo states)

**Source**: `lib/updater.js:227-543`

---

## AC-IL-008: User Artifact Preservation During Update [CRITICAL]

**Given** the updater runs
**When** it copies framework files
**Then** it NEVER touches these user artifacts:
  - .isdlc/state.json
  - .isdlc/providers.yaml
  - .isdlc/monorepo.json
  - docs/isdlc/constitution.md
  - CLAUDE.md
  - .claude/settings.local.json
**And** settings.json is deep-merged (user keys preserved)

**Source**: `lib/updater.js:274-281`

---

## AC-IL-009: Obsolete File Cleanup [HIGH]

**Given** the old installation manifest tracks files that no longer exist in the new version
**When** the updater runs step 7
**Then** it identifies files in the old manifest but not in the new file set
**And** removes those obsolete files from disk
**And** reports the count of removed files

**Source**: `lib/updater.js:430-457`

---

## AC-IL-010: Version Comparison Guard [HIGH]

**Given** the updater compares installed vs available versions
**When** versions are the same (and --force is not set)
**Then** it reports "Already up to date!" and exits
**When** the installed version is newer
**Then** it warns about downgrade and exits (unless --force)

**Source**: `lib/updater.js:255-268`

---

## AC-IL-011: Manifest-Based Uninstall [HIGH]

**Given** the uninstaller has an installation manifest
**When** it removes framework files
**Then** it only removes files listed in the manifest
**And** identifies user-created files (in .claude/ but not in manifest) and preserves them
**And** reports both removed and preserved file counts

**Source**: `lib/uninstaller.js:87-114`

---

## AC-IL-012: Legacy Pattern-Based Uninstall [MEDIUM]

**Given** the uninstaller has NO installation manifest (legacy install)
**When** it proceeds with removal
**Then** it uses pattern matching to identify framework files:
  - Numbered agents (01-*.md through 13-*.md)
  - Known hook filenames (gate-blocker.js, test-watcher.js, etc.)
**And** treats unmatched files as user files and preserves them

**Source**: `lib/uninstaller.js:416-451`

---

## AC-IL-013: Doctor Eight-Check Health Validation [HIGH]

**Given** a user runs `isdlc doctor`
**When** the health check executes
**Then** it validates 8 areas:
  1. Framework installation present
  2. .claude directory complete (agents, skills, commands, hooks)
  3. .isdlc directory exists
  4. state.json valid (has framework_version, project, phases)
  5. Constitution exists and is customized (not STARTER_TEMPLATE)
  6. Hooks configured (settings.json has hooks array)
  7. Skills manifest present (JSON or YAML)
  8. Installation manifest present and valid
**And** reports: passed count, warning count, issue count

**Source**: `lib/doctor.js:18-204`

---

## AC-IL-014: Dry-Run Mode [MEDIUM]

**Given** any CLI command is run with --dry-run
**When** the command would create, copy, or delete files
**Then** it shows what would happen without making any changes
**And** marks output with "[dry-run]" prefix
**And** all file system operations are skipped

**Source**: `lib/installer.js:175-177`, `lib/updater.js:358-364`, `lib/uninstaller.js:156-200`

---

## AC-IL-015: Backup Creation [MEDIUM]

**Given** --backup flag is provided
**When** update or uninstall runs
**Then** it creates a timestamped backup directory: `isdlc-backup-YYYY-MM-DDTHH-MM-SS/`
**And** copies .claude/ and .isdlc/ to the backup
**And** reports the backup directory path

**Source**: `lib/updater.js:293-316`, `lib/uninstaller.js:169-188`

---

## AC-IL-016: Installation Manifest Generation [HIGH]

**Given** installation or update completes
**When** manifest is generated
**Then** it writes `.isdlc/installed-files.json` with:
  - version: "1.0.0"
  - created: ISO timestamp
  - framework_version: current version
  - files: array of all tracked relative file paths
**And** this manifest is used by future updates and uninstalls

**Source**: `lib/installer.js:459-468`, `lib/updater.js:467-474`

---

## AC-IL-017: Tech Stack Detection [MEDIUM]

**Given** a project has a package.json
**When** `detectTechStack()` analyzes it
**Then** it detects frameworks from dependencies: react, vue, angular, svelte, next.js, nuxt, express, fastify, nestjs, jest, vitest, mocha
**And** detects languages: javascript, typescript, python, go, rust, java
**And** returns: primary language, frameworks[], languages[]

**Source**: `lib/project-detector.js:209-270`
