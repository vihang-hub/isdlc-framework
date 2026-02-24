# Interface Specification: Project Skills Distillation

**Status**: Draft
**Confidence**: High
**Last Updated**: 2026-02-24
**Coverage**: 90%
**Source**: GitHub #88
**Slug**: REQ-0037-project-skills-distillation

---

## Overview

This feature has no new programmatic interfaces (no new functions, APIs, or modules). The interfaces documented here are:

1. **Skill file format** -- the contract between the distillation step (producer) and `rebuildSessionCache()` Section 7 (consumer)
2. **Manifest entry format** -- the contract between the distillation step (producer) and `loadExternalManifest()` / `writeExternalManifest()` (infrastructure)
3. **Existing interfaces consumed** -- functions in `common.cjs` used by the distillation step

---

## Interface 1: Project Skill File Format

### Contract

Each project skill file is a Markdown document with YAML frontmatter, written to `.claude/skills/external/`.

### Frontmatter Schema

```yaml
---
name: string          # Required. Skill name (e.g., "project-architecture")
description: string   # Required. One-line description
skill_id: string      # Required. PROJ-001 through PROJ-004
owner: string         # Required. Always "discover-orchestrator"
collaborators: array  # Required. Always empty array []
project: string       # Required. Project name from state.json or discovery context
version: string       # Required. Always "1.0.0"
when_to_use: string   # Required. Usage guidance for consuming agents
dependencies: array   # Required. Always empty array []
---
```

### Frontmatter Validation Rules

| Field | Type | Required | Constraint |
|-------|------|----------|------------|
| `name` | string | Yes | Must match filename without `.md` extension |
| `description` | string | Yes | Max 200 characters |
| `skill_id` | string | Yes | Must be `PROJ-001`, `PROJ-002`, `PROJ-003`, or `PROJ-004` |
| `owner` | string | Yes | Must be `discover-orchestrator` |
| `collaborators` | array | Yes | Must be empty array |
| `project` | string | Yes | Non-empty string |
| `version` | string | Yes | Semantic version string |
| `when_to_use` | string | Yes | Non-empty string |
| `dependencies` | array | Yes | Must be empty array |

### Body Structure

Each skill body follows a skill-specific template (see module-design.md for templates). All skill bodies must include:

1. **H1 title** matching the skill name
2. **Content sections** specific to the skill type (H2 headers)
3. **Provenance section** (H2) as the final section, containing:
   - `**Source**`: List of source artifact paths
   - `**Distilled**`: ISO-8601 timestamp of the discovery run
   - `**Discovery run**`: `full` or `incremental`

### Size Constraint

Total file size (frontmatter + body) must not exceed 5,000 characters.

### File Naming

| Skill ID | Filename |
|----------|----------|
| PROJ-001 | `project-architecture.md` |
| PROJ-002 | `project-conventions.md` |
| PROJ-003 | `project-domain.md` |
| PROJ-004 | `project-test-landscape.md` |

### Consumer

`rebuildSessionCache()` Section 7 (EXTERNAL_SKILLS) reads these files via `loadExternalManifest()` to find them, then reads file content directly. It truncates content at 5,000 characters (existing behavior, line 4058 in `common.cjs`).

---

## Interface 2: Manifest Entry Format

### Contract

Each distilled skill is registered in `external-skills-manifest.json`. The manifest format is governed by GH-89 (dependency). The distillation step must conform to whatever schema GH-89 establishes, with the following behavioral requirements:

### Required Fields Per Entry

```json
{
  "name": "project-architecture",
  "description": "Distilled project architecture -- components, boundaries, data flow, key patterns",
  "file": "project-architecture.md",
  "added_at": "2026-02-24T10:00:00.000Z",
  "source": "discover",
  "source_phase": "D1",
  "bindings": {
    "agents": [],
    "phases": [
      "01-requirements", "02-impact-analysis", "02-tracing",
      "03-architecture", "04-design", "05-test-strategy",
      "06-implementation", "07-testing", "08-code-review",
      "09-validation", "16-quality-loop"
    ],
    "injection_mode": "always",
    "delivery_type": "context"
  }
}
```

### Field Specifications

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Skill name, matches frontmatter `name` |
| `description` | string | Yes | One-line description, matches frontmatter `description` |
| `file` | string | Yes | Filename relative to `.claude/skills/external/` |
| `added_at` | string | Yes | ISO-8601 timestamp of when the skill was distilled |
| `source` | string | Yes | Must be `"discover"` for project skills |
| `source_phase` | string | Yes | Source discovery phase: `"D1"`, `"D2"`, or `"D6"` |
| `bindings.agents` | array | Yes | Empty array (all agents) |
| `bindings.phases` | array | Yes | All workflow phases |
| `bindings.injection_mode` | string | Yes | `"always"` |
| `bindings.delivery_type` | string | Yes | `"context"` |

### Idempotency Contract

- On re-discovery, the distillation step filters manifest entries by `source === "discover"` AND `source_phase === <phase that ran>`
- Matching entries are removed from the manifest and their `file` is deleted from disk
- Only successfully distilled skills are re-added
- Entries with `source !== "discover"` are never touched

### Consumer

`loadExternalManifest()` reads the manifest. `rebuildSessionCache()` Section 7 iterates over entries and reads each skill file. The `source` field is used by the distillation step for filtering; `bindings` are used by the cache builder for injection decisions.

---

## Interface 3: Existing Interfaces Consumed

### writeExternalManifest(manifest, projectId?)

- **Location**: `common.cjs` line 961
- **Purpose**: Write the full manifest object to `external-skills-manifest.json`
- **Input**: `manifest` (object) -- the complete manifest to write; `projectId` (string, optional) -- for monorepo mode
- **Output**: `{ success: boolean, error: string|null, path: string }`
- **Behavior**: Creates parent directories if needed. Re-reads and validates JSON after write.
- **Used by distillation**: After accumulating all manifest changes, call once with the complete updated manifest

### loadExternalManifest(projectId?)

- **Location**: `common.cjs` line 703
- **Purpose**: Load and parse the external skills manifest
- **Input**: `projectId` (string, optional) -- for monorepo mode
- **Output**: Parsed manifest object, or `null` if not found or parse error
- **Used by distillation**: Read at start of distillation to get existing entries; filter out discover-sourced entries for phases that ran

### resolveExternalManifestPath(projectId?)

- **Location**: `common.cjs` line 458
- **Purpose**: Resolve the manifest file path, accounting for monorepo mode
- **Input**: `projectId` (string, optional)
- **Output**: Absolute path string
- **Preference order**: New location (`docs/isdlc/external-skills-manifest.json`) > legacy location (`.isdlc/external-skills-manifest.json`)

### rebuildSessionCache(options?)

- **Location**: `common.cjs` line 3960
- **Purpose**: Rebuild the session cache file (`.isdlc/session-cache.md`)
- **Input**: `options` (object, optional) -- `{ projectRoot?: string, verbose?: boolean }`
- **Output**: `{ path: string, size: number, hash: string, sections: string[], skipped: string[] }`
- **Used by distillation**: Called once after all skill files and manifest are written
- **Modified by this REQ**: Section 9 (DISCOVERY_CONTEXT) removed from this function

---

## Validation Rules

### Skill File Validation (Pre-Write)

Before writing each skill file, the orchestrator instructions should verify:

1. Frontmatter is valid YAML with all required fields
2. `skill_id` is one of PROJ-001 through PROJ-004
3. `name` matches the expected filename
4. Total file content is under 5,000 characters
5. Body contains at least one H2 section
6. Provenance section is present

### Manifest Validation (Pre-Write)

Before writing the manifest, verify:

1. All entries have required fields (`name`, `file`, `source`, `bindings`)
2. No duplicate `name` values
3. All discover-sourced entries have `source_phase` set
4. `file` values reference files that exist on disk (for entries just written)

---

## Error Communication

### Warning Log Format

When a skill is skipped due to failure, log a structured warning:

```
[DISTILLATION WARNING] Skipped {skill_name} (PROJ-{NNN}): {reason}
  Source phase: {D1|D2|D6}
  Source artifact: {path}
  Error: {error description}
```

### Distillation Summary Log

After all distillation completes, log a summary:

```
[DISTILLATION COMPLETE]
  Produced: {N} skills ({list of skill names})
  Skipped: {N} skills ({list with reasons})
  Manifest: {updated|failed}
  Cache rebuild: {success|failed}
```

---

## Pending Sections

- Exact manifest schema format (depends on GH-89 landing)
- Monorepo path resolution for skill files (follows existing `resolveExternalSkillsPath()` pattern)
