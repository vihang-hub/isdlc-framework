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

```bash
mkdir -p docs/api-service/{requirements,architecture,design}
mkdir -p docs/web-frontend/{requirements,architecture,design}
```

## Directory Structure

```
monorepo/
├── .claude/                          # Shared (unchanged)
│   ├── agents/
│   ├── skills/
│   ├── hooks/
│   └── commands/
├── .isdlc/
│   ├── monorepo.json                 # Project registry
│   ├── constitution.md               # Shared constitution
│   ├── config/                       # Shared config
│   ├── checklists/                   # Shared checklists
│   ├── templates/                    # Shared templates
│   └── projects/                     # Per-project state
│       ├── api-service/
│       │   ├── state.json            # Independent state + counters
│       │   └── constitution.md       # Optional override
│       └── web-frontend/
│           ├── state.json
│           └── constitution.md
├── docs/
│   ├── api-service/                  # Per-project docs
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

## monorepo.json Schema

```json
{
  "version": "1.0.0",
  "default_project": "api-service",
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
| `projects` | Registry of all managed projects |
| `projects.{id}.name` | Human-readable project name |
| `projects.{id}.path` | Relative path from monorepo root to project code |
| `projects.{id}.registered_at` | When the project was registered |
| `projects.{id}.discovered` | Whether the project was auto-detected |
| `scan_paths` | Directories to scan when running `/sdlc project scan` |

## Working with Projects

### Selecting a Project

There are three ways to target a project:

1. **`--project` flag** (highest priority):
   ```
   /sdlc feature "Add auth" --project api-service
   /discover --project web-frontend
   ```

2. **Default project** (set in monorepo.json):
   ```
   /sdlc project select api-service
   ```
   Then subsequent commands without `--project` target api-service.

3. **Interactive selection**: If no project is resolved, the framework presents a project selection menu.

### Managing Projects

```
/sdlc project list              # Show all registered projects
/sdlc project add {id} {path}   # Register a new project manually
/sdlc project scan              # Auto-detect projects from scan_paths
/sdlc project select {id}       # Set default project
```

### Running Discovery

```
/discover --project api-service
```

In monorepo mode, discovery:
- Scopes analysis to the project's path (not the entire monorepo)
- Outputs reports to `docs/{project-id}/`
- Creates the constitution at `.isdlc/projects/{project-id}/constitution.md`
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

| Artifact | Single-project | Monorepo |
|----------|---------------|----------|
| Requirements | `docs/requirements/REQ-0001-name/` | `docs/api-service/requirements/REQ-0001-name/` |
| Architecture | `docs/architecture/` | `docs/api-service/architecture/` |
| Design | `docs/design/` | `docs/api-service/design/` |
| State | `.isdlc/state.json` | `.isdlc/projects/api-service/state.json` |

## Constitution: Shared + Override

The shared constitution at `.isdlc/constitution.md` applies to all projects. Individual projects can create overrides at `.isdlc/projects/{project-id}/constitution.md`.

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
2. `default_project` from `monorepo.json`
3. Falls back to `.isdlc/state.json` (single-project mode)

No hook configuration changes are needed for monorepo mode.

## Migrating from Single-Project

To convert an existing single-project iSDLC installation to a monorepo:

1. Create `monorepo.json` (see Manual Setup above)
2. Move `state.json` to `.isdlc/projects/{project-id}/state.json`
3. Move constitution override (if desired) to `.isdlc/projects/{project-id}/constitution.md`
4. Move docs to `docs/{project-id}/`
5. Rename existing branches to add project prefix

## FAQ

**Q: Do I need to reinstall the framework for monorepo support?**
A: No. Create `.isdlc/monorepo.json` and the project directories manually, or re-run `install.sh`.

**Q: Can different projects use different agents or skills?**
A: No. Agents, skills, hooks, and config are shared. Only state, workflows, counters, constitutions (overrides), and docs are per-project.

**Q: What if I have projects in different languages?**
A: Each project can have its own constitution override with language-specific articles. The shared constitution covers universal principles.

**Q: Can I run workflows on two projects simultaneously?**
A: Yes. Each project has independent workflow state. You can start a feature on project-a and a fix on project-b.

---

**Framework Version**: 2.0.0
