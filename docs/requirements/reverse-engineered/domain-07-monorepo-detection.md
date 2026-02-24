# Domain 07: Monorepo & Project Detection

**Source Files**: `lib/monorepo-handler.js`, `src/claude/hooks/lib/common.js` (monorepo section)
**AC Count**: 12
**Priority**: 3 Critical, 6 High, 3 Medium

---

## AC-MD-001: Monorepo Detection by Workspace Files [CRITICAL]

**Given** a project root is being analyzed
**When** detectMonorepo() scans for markers
**Then** it checks for 5 workspace configuration files:
  - pnpm-workspace.yaml (type: "pnpm")
  - lerna.json (type: "lerna")
  - turbo.json (type: "turbo")
  - nx.json (type: "nx")
  - rush.json (type: "rush")
**And** returns isMonorepo=true with the detected type if any marker exists

**Source**: `lib/monorepo-handler.js:36-44`

---

## AC-MD-002: Monorepo Detection by Directory Structure [HIGH]

**Given** no workspace config file is found
**When** detectMonorepo() checks directory patterns
**Then** it scans 5 standard monorepo directories: apps, packages, services, libs, modules
**And** counts subdirectories that have project markers (package.json, go.mod, Cargo.toml, pyproject.toml, pom.xml, build.gradle, or src/)
**And** if 2+ project-like subdirectories are found, returns isMonorepo=true (type: "directory-structure")

**Source**: `lib/monorepo-handler.js:46-65`

---

## AC-MD-003: Root-Level Project Detection [HIGH]

**Given** no workspace files or standard monorepo directories are found
**When** detectMonorepo() checks root-level directories
**Then** it scans all directories at project root (excluding .claude, .isdlc, .git, docs, node_modules, scripts, vendor, dist, build, target, etc.)
**And** if 2+ directories have project markers, returns isMonorepo=true (type: "root-directories")

**Source**: `lib/monorepo-handler.js:99-119, 67-73`

---

## AC-MD-004: Project Discovery Across Monorepo [HIGH]

**Given** a monorepo is detected
**When** discoverProjects() scans the workspace
**Then** it finds projects in:
  1. Standard monorepo directories (apps/, packages/, services/, libs/, modules/)
  2. Root-level directories with project markers
**And** deduplicates by project name (using a Set)
**And** returns: name, relative path, discovered: true

**Source**: `lib/monorepo-handler.js:126-168`

---

## AC-MD-005: Monorepo Configuration Generation [HIGH]

**Given** projects have been discovered
**When** generateMonorepoConfig() is called
**Then** it creates a config with:
  - version: "1.0.0"
  - default_project: first project name
  - docs_location: "root" or "project"
  - projects: map of { name, path, registered_at, discovered }
  - scan_paths: unique parent directories of projects

**Source**: `lib/monorepo-handler.js:217-239`

---

## AC-MD-006: CWD-Based Project Resolution [CRITICAL]

**Given** hooks are running in monorepo mode
**When** resolveProjectFromCwd() determines the active project
**Then** it computes the relative path from project root to current working directory
**And** matches against registered project paths using longest prefix match
**And** returns null if CWD is outside the project root

**Source**: `src/claude/hooks/lib/common.js:92-134`

---

## AC-MD-007: Three-Level Project Resolution [CRITICAL]

**Given** a hook needs to determine the active project in monorepo mode
**When** getActiveProject() is called
**Then** it resolves in priority order:
  1. ISDLC_PROJECT environment variable
  2. CWD-based project detection (longest prefix match)
  3. default_project from monorepo.json
**And** returns null if not in monorepo mode

**Source**: `src/claude/hooks/lib/common.js:143-167`

---

## AC-MD-008: Project-Scoped State Routing [HIGH]

**Given** hooks operate in monorepo mode
**When** resolveStatePath() is called
**Then** it returns .isdlc/projects/{project-id}/state.json for the active project
**And** falls back to .isdlc/state.json in single-project mode
**And** accepts an optional projectId override parameter

**Source**: `src/claude/hooks/lib/common.js:176-188`

---

## AC-MD-009: Path Resolution Functions [HIGH]

**Given** any artifact path needs to be resolved
**When** the 8 resolve functions are called
**Then** they correctly route paths in both monorepo and single-project modes:
  - resolveConstitutionPath: docs/isdlc/[projects/{id}/]constitution.md
  - resolveDocsPath: docs/ or docs/{id}/ or {project-path}/docs/
  - resolveExternalSkillsPath: .isdlc/projects/{id}/skills/external/ or .claude/skills/external/
  - resolveExternalManifestPath: docs/isdlc/[projects/{id}/]external-skills-manifest.json
  - resolveSkillReportPath: docs/isdlc/[projects/{id}/]skill-customization-report.md
  - resolveTasksPath: docs/isdlc/[projects/{id}/]tasks.md
  - resolveTestEvaluationPath: docs/isdlc/[projects/{id}/]test-evaluation-report.md
  - resolveAtddChecklistPath: docs/isdlc/[projects/{id}/]atdd-checklist[-{domain}].json
**And** each checks new location first, legacy location second, defaults to new

**Source**: `src/claude/hooks/lib/common.js:195-494`

---

## AC-MD-010: Legacy to New Location Migration Detection [MEDIUM]

**Given** isMigrationNeeded() is called
**When** checking for doc location migration
**Then** it returns true if .isdlc/constitution.md exists AND docs/isdlc/constitution.md does NOT
**And** returns false otherwise

**Source**: `src/claude/hooks/lib/common.js:521-527`

---

## AC-MD-011: Per-Project State in Monorepo [HIGH]

**Given** a monorepo has multiple projects
**When** the installer sets up per-project state
**Then** it creates:
  - .isdlc/projects/{name}/state.json with project-specific state
  - .isdlc/projects/{name}/skills/external/ directory
  - docs/isdlc/projects/{name}/external-skills-manifest.json
**And** each project has isolated state, counters, and workflow history

**Source**: `lib/installer.js:420-452`

---

## AC-MD-012: Updater Monorepo State Propagation [MEDIUM]

**Given** an update is performed in a monorepo
**When** the updater finalizes
**Then** it reads monorepo.json to find all registered projects
**And** updates each project's state.json with:
  - framework_version bumped to new version
  - history entry recording the update

**Source**: `lib/updater.js:496-519`

---

## AC-MD-013: Scan Path Extraction [MEDIUM]

**Given** discovered projects have paths like "apps/web", "services/api", "frontend"
**When** getScanPaths() computes scan paths
**Then** it extracts unique parent directories:
  - "apps/web" -> "apps/"
  - "services/api" -> "services/"
  - "frontend" -> "frontend"
**And** returns them as an array

**Source**: `lib/monorepo-handler.js:175-190`
