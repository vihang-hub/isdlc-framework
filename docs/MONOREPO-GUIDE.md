# Monorepo Guide

How to use the iSDLC framework with monorepo projects.

## Overview

The iSDLC framework supports managing multiple projects from a single installation. Each project gets its own state, workflows, counters, and artifacts while sharing agents, skills, hooks, and configuration.

**Key principle**: Monorepo mode activates only when `.isdlc/monorepo.json` exists. Without it, everything works as a single-project installation.

## Setup

### Automatic Detection

When you run `install.sh`, the installer auto-detects monorepos by looking for:

| Indicator | Tool |
|-----------|------|
| `pnpm-workspace.yaml` | pnpm |
| `turbo.json` | Turborepo |
| `nx.json` | Nx |
| `lerna.json` | Lerna |
| `rush.json` | Rush |
| `apps/` + `packages/` (2+ sub-dirs) | Directory convention |

If detected, the installer prompts for confirmation and creates the monorepo structure automatically.

### Manual Setup

To convert an existing single-project installation to monorepo mode:

1. Create `.isdlc/monorepo.json`:

```json
{
  "version": "1.0.0",
  "default_project": "api-service",
  "docs_location": "root",
  "projects": {
    "api-service": {
      "name": "API Service",
      "path": "apps/api-service",
      "registered_at": "2026-01-01T00:00:00Z",
      "discovered": false
    },
    "web-frontend": {
      "name": "Web Frontend",
      "path": "apps/web-frontend",
      "registered_at": "2026-01-01T00:00:00Z",
      "discovered": false
    }
  },
  "scan_paths": ["apps/", "packages/", "services/"]
}
```

2. Create per-project state directories:

```bash
mkdir -p .isdlc/projects/api-service
mkdir -p .isdlc/projects/web-frontend
```

3. Create per-project state.json files (copy the structure from `.isdlc/state.json` and adjust the `project.name` and `project.path` fields).

4. Create per-project docs directories:

If `docs_location` is `"root"` (default):
```bash
mkdir -p docs/api-service/{requirements,architecture,design}
mkdir -p docs/web-frontend/{requirements,architecture,design}
```

If `docs_location` is `"project"`:
```bash
mkdir -p apps/api-service/docs/{requirements,architecture,design}
mkdir -p apps/web-frontend/docs/{requirements,architecture,design}
```

## Directory Structure

The docs layout depends on the `docs_location` setting in `monorepo.json`:

### `docs_location: "root"` (default) — shared-concern monorepos (FE/BE/shared)

```
monorepo/
├── .claude/                          # Shared (unchanged)
│   ├── agents/
│   ├── skills/
│   ├── hooks/
│   └── commands/
├── .isdlc/
│   ├── monorepo.json                 # Project registry
│   ├── config/                       # Shared config
│   ├── checklists/                   # Shared checklists
│   ├── templates/                    # Shared templates
│   └── projects/                     # Per-project runtime state
│       ├── api-service/
│       │   ├── state.json            # Independent state + counters
│       │   └── skills/
│       │       └── external/         # Project-scoped external skills
│       │           ├── nestjs.md
│       │           └── typescript.md
│       └── web-frontend/
│           ├── state.json
│           └── skills/
│               └── external/
├── docs/
│   ├── isdlc/                        # Shared iSDLC documents
│   │   ├── constitution.md           # Shared constitution
│   │   └── projects/                 # Per-project user documents
│   │       ├── api-service/
│   │       │   ├── constitution.md   # Optional override
│   │       │   ├── tasks.md
│   │       │   ├── external-skills-manifest.json
│   │       │   └── skill-customization-report.md
│   │       └── web-frontend/
│   │           ├── tasks.md
│   │           ├── external-skills-manifest.json
│   │           └── skill-customization-report.md
│   ├── api-service/                  # Per-project docs at root
│   │   ├── requirements/
│   │   ├── architecture/
│   │   └── design/
│   └── web-frontend/
│       ├── requirements/
│       ├── architecture/
│       └── design/
├── apps/
│   ├── api-service/                  # Actual project code
│   └── web-frontend/
```

### `docs_location: "project"` — multi-app monorepos (app1/app2/app3)

```
monorepo/
├── .claude/                          # Shared (unchanged)
├── .isdlc/
│   ├── monorepo.json
│   └── projects/                     # Per-project runtime state (same as above)
│       ├── app1/
│       └── app2/
├── docs/
│   └── isdlc/                        # Shared iSDLC documents
│       ├── constitution.md           # Shared constitution
│       └── projects/                 # Per-project user documents
│           ├── app1/
│           └── app2/
├── apps/
│   ├── app1/
│   │   ├── docs/                     # Docs live inside each project
│   │   │   ├── requirements/
│   │   │   ├── architecture/
│   │   │   └── design/
│   │   └── src/
│   └── app2/
│       ├── docs/
│       │   ├── requirements/
│       │   ├── architecture/
│       │   └── design/
│       └── src/
```

## monorepo.json Schema

```json
{
  "version": "1.0.0",
  "default_project": "api-service",
  "docs_location": "root",
  "projects": {
    "api-service": {
      "name": "API Service",
      "path": "apps/api-service",
      "registered_at": "ISO-8601",
      "discovered": true
    }
  },
  "scan_paths": ["apps/", "packages/", "services/"]
}
```

| Field | Description |
|-------|-------------|
| `version` | Schema version |
| `default_project` | Project used when `--project` is not specified |
| `docs_location` | Where project docs live: `"root"` (default) puts docs at `docs/{project-id}/`, `"project"` puts docs at `{project-path}/docs/` |
| `projects` | Registry of all managed projects |
| `projects.{id}.name` | Human-readable project name |
| `projects.{id}.path` | Relative path from monorepo root to project code |
| `projects.{id}.registered_at` | When the project was registered |
| `projects.{id}.discovered` | Whether the project was auto-detected |
| `scan_paths` | Directories to scan when running `/isdlc project scan` |

## Working with Projects

### Selecting a Project

There are four ways to target a project (in priority order):

1. **`--project` flag** (highest priority):
   ```
   /isdlc feature "Add auth" --project api-service
   /discover --project web-frontend
   ```

2. **CWD-based auto-detection**: If your shell is inside a registered project directory, the project is auto-selected:
   ```
   cd apps/api-service
   /isdlc status          # Automatically targets api-service
   /discover             # Automatically scopes to api-service
   ```
   The framework matches CWD against registered project paths using longest prefix match.

3. **Default project** (set in monorepo.json):
   ```
   /isdlc project select api-service
   ```
   Then subsequent commands without `--project` target api-service.

4. **Interactive selection**: If no project is resolved, the framework presents a project selection menu.

### Managing Projects

```
/isdlc project list              # Show all registered projects
/isdlc project add {id} {path}   # Register a new project manually
/isdlc project scan              # Auto-detect projects from scan_paths
/isdlc project select {id}       # Set default project
```

### Running Discovery

```
/discover --project api-service
```

In monorepo mode, discovery:
- Scopes analysis to the project's path (not the entire monorepo)
- Outputs reports to the resolved docs path (`docs/{project-id}/` or `{project-path}/docs/` depending on `docs_location`)
- Creates the constitution at `docs/isdlc/projects/{project-id}/constitution.md`
- Updates the project-specific `state.json`

## Independent Workflows

Each project has its own workflow lifecycle:

- **One active workflow per project** (not globally). You can run a feature on api-service and a fix on web-frontend simultaneously.
- **Separate counters**: `next_req_id` and `next_bug_id` are per-project in each project's state.json.
- **Separate branch namespaces**: Monorepo branches include the project ID as a prefix.

### Branch Naming

| Mode | Feature Branch | Bugfix Branch |
|------|---------------|---------------|
| Single-project | `feature/REQ-0001-name` | `bugfix/BUG-0001-id` |
| Monorepo | `api-service/feature/REQ-0001-name` | `api-service/bugfix/BUG-0001-id` |

### Artifact Paths

| Artifact | Single-project | Monorepo (`docs_location: "root"`) | Monorepo (`docs_location: "project"`) |
|----------|---------------|----------|----------|
| Requirements | `docs/requirements/REQ-0001-name/` | `docs/api-service/requirements/REQ-0001-name/` | `apps/api-service/docs/requirements/REQ-0001-name/` |
| Architecture | `docs/architecture/` | `docs/api-service/architecture/` | `apps/api-service/docs/architecture/` |
| Design | `docs/design/` | `docs/api-service/design/` | `apps/api-service/docs/design/` |
| State | `.isdlc/state.json` | `.isdlc/projects/api-service/state.json` | `.isdlc/projects/api-service/state.json` |
| Constitution | `docs/isdlc/constitution.md` | `docs/isdlc/projects/api-service/constitution.md` | `docs/isdlc/projects/api-service/constitution.md` |
| Tasks | `docs/isdlc/tasks.md` | `docs/isdlc/projects/api-service/tasks.md` | `docs/isdlc/projects/api-service/tasks.md` |
| External skills | `.claude/skills/external/` | `.isdlc/projects/api-service/skills/external/` | `.isdlc/projects/api-service/skills/external/` |
| External manifest | `docs/isdlc/external-skills-manifest.json` | `docs/isdlc/projects/api-service/external-skills-manifest.json` | `docs/isdlc/projects/api-service/external-skills-manifest.json` |
| Skill report | `docs/isdlc/skill-customization-report.md` | `docs/isdlc/projects/api-service/skill-customization-report.md` | `docs/isdlc/projects/api-service/skill-customization-report.md` |

## Constitution: Shared + Override

The shared constitution at `docs/isdlc/constitution.md` applies to all projects. Individual projects can create overrides at `docs/isdlc/projects/{project-id}/constitution.md`.

### Override Rules

1. Per-project constitutions **inherit** all shared articles
2. They can **add** project-specific articles
3. They can **tighten** thresholds but not weaken shared requirements
4. If no override exists, the shared constitution applies in full

### Example

Shared constitution has 10 universal articles. The api-service project adds:
- Article XII: PCI-DSS Compliance (payment processing)
- Article XIII: API Performance SLAs (p95 < 200ms)

The web-frontend project adds:
- Article XII: Accessibility (WCAG 2.1 AA)
- Article XIII: Performance (LCP < 2.5s)

## Hook Routing

All hooks (gate-blocker, test-watcher, constitution-validator, menu-tracker, skill-validator) automatically route to the correct project's state.json through the `common.js` library. The routing uses:

1. `ISDLC_PROJECT` environment variable (if set)
2. **CWD-based detection** — matches CWD against registered project paths (longest prefix match)
3. `default_project` from `monorepo.json`
4. Falls back to `.isdlc/state.json` (single-project mode)

CWD-based detection means that running commands from within a project subdirectory (e.g., `cd apps/api-service && /isdlc status`) automatically targets the correct project without needing `--project` or setting a default.

No hook configuration changes are needed for monorepo mode.

## Migrating from Single-Project

To convert an existing single-project iSDLC installation to a monorepo:

1. Create `monorepo.json` (see Manual Setup above)
2. Move `state.json` to `.isdlc/projects/{project-id}/state.json`
3. Move constitution override (if desired) to `docs/isdlc/projects/{project-id}/constitution.md`
4. Move project docs to `docs/{project-id}/` (or `{project-path}/docs/` if using `docs_location: "project"`)
5. Move iSDLC documents to `docs/isdlc/projects/{project-id}/`
6. Rename existing branches to add project prefix

## FAQ

**Q: Do I need to reinstall the framework for monorepo support?**
A: No. Create `.isdlc/monorepo.json` and the project directories manually, or re-run `install.sh`.

**Q: Can different projects use different agents or skills?**
A: No. Agents, skills, hooks, and config are shared. Only state, workflows, counters, constitutions (overrides), and docs are per-project.

**Q: What if I have projects in different languages?**
A: Each project can have its own constitution override with language-specific articles. The shared constitution covers universal principles.

**Q: Can I run workflows on two projects simultaneously?**
A: Yes. Each project has independent workflow state. You can start a feature on project-a and a fix on project-b.

**Q: What happens to external skills (from /discover) in a monorepo?**
A: External skills are isolated per project. Running `/discover --project frontend` installs skills to `.isdlc/projects/frontend/skills/external/`, not the shared `.claude/skills/external/`. This prevents one project's tech-stack skills from overwriting another's.

**Q: Does CWD-based detection work from any subdirectory?**
A: Yes. If you're anywhere inside a registered project path (e.g., `apps/api-service/src/controllers/`), the framework matches the longest prefix and resolves to `api-service`. If CWD is at the monorepo root or outside any registered path, it falls back to `default_project`.

**Q: How do I migrate an existing monorepo install to support per-project external skills?**
A: For each registered project:
1. Create the external skills directory: `mkdir -p .isdlc/projects/{id}/skills/external`
2. Create an empty manifest: `echo '{"version":"1.0.0","project_id":"{id}","updated_at":"","skills":{}}' > docs/isdlc/projects/{id}/external-skills-manifest.json`
3. If you previously ran `/discover` and have skills in `.claude/skills/external/`, move the relevant skill files to the appropriate project directory
4. Re-run `/discover --project {id}` to regenerate the manifest

---

**Framework Version**: 2.6.0
