---
name: directory-scan
description: Scan project directory structure to identify architecture patterns
skill_id: DISC-101
owner: architecture-analyzer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: At the start of architecture analysis to map project structure
dependencies: [DISC-001]
---

# Directory Scan

## Purpose
Perform a comprehensive scan of the project directory structure to identify architectural patterns, framework conventions, and project organization. This provides the structural foundation for all subsequent architecture analysis.

## When to Use
- As the first step when the architecture-analyzer agent begins execution
- When validating that detected frameworks match the directory layout
- When identifying monorepo vs single-project structures

## Prerequisites
- Project root path is known and accessible
- Project detection (DISC-001) has confirmed the project type
- Glob tool is available for pattern matching

## Process

### Step 1: Map Top-Level Structure
Glob for top-level directories and files. Identify standard patterns: `src/`, `lib/`, `app/`, `cmd/`, `pkg/`, `internal/`, `pages/`, `components/`, `routes/`, `controllers/`, `models/`, `services/`. Record the complete first two levels of the directory tree.

### Step 2: Identify Framework Conventions
Match the directory layout against known framework conventions. Next.js uses `pages/` or `app/`, Rails uses `app/models/controllers/views`, Go projects use `cmd/` and `internal/`, Django uses app directories with `models.py` and `views.py`. Flag the most likely framework based on structure alone.

### Step 3: Detect Project Organization
Determine if this is a monorepo (presence of `packages/`, `apps/`, workspace config), a multi-module project, or a single application. Identify shared libraries, configuration directories, and build output paths. Map the complete directory tree for downstream analysis.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| project_root | string | Yes | Absolute path to the project root |
| max_depth | number | No | Maximum directory depth to scan (default: 4) |
| ignore_patterns | list | No | Glob patterns to exclude (node_modules, .git, etc.) |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| directory_tree | object | Nested tree structure of the project |
| detected_patterns | list | Framework and architecture patterns found |
| project_type | string | monorepo, multi-module, or single-app |
| convention_matches | list | Known framework conventions matched |

## Integration Points
- **tech-detection**: Uses directory patterns to narrow framework identification
- **architecture-documentation**: Consumes directory tree for architecture overview
- **deployment-topology-detection**: Uses project structure to identify deploy targets

## Validation
- Directory tree contains at least one level of structure
- Detected patterns include rationale for each match
- Ignored directories (node_modules, .git, dist) are excluded from analysis
- Monorepo detection checked workspace configuration files
