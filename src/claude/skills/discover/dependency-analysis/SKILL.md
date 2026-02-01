---
name: dependency-analysis
description: Catalog project dependencies with versions and purposes
skill_id: DISC-103
owner: architecture-analyzer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: During architecture analysis to understand external dependency landscape
dependencies: [DISC-102]
---

# Dependency Analysis

## Purpose
Parse and catalog all project dependencies from package manifests, categorizing them by type and purpose. This provides visibility into the external libraries the project relies on and highlights potential risks.

## When to Use
- After tech detection identifies the package managers in use
- When evaluating the project's external dependency footprint
- When checking for outdated or potentially vulnerable dependencies

## Prerequisites
- Tech detection (DISC-102) has identified languages and package manifests
- Package manifest files are accessible and parseable
- Lock files (package-lock.json, yarn.lock, poetry.lock) are available for version pinning data

## Process

### Step 1: Parse Package Manifests
Read each detected manifest file and extract dependency entries. For `package.json`, separate `dependencies`, `devDependencies`, and `peerDependencies`. For `requirements.txt`, parse pinned and unpinned versions. For `go.mod`, extract `require` blocks. Record each dependency name and version constraint.

### Step 2: Categorize Dependencies
Classify each dependency into categories: runtime (production), development (testing, linting, building), peer (host-provided), and optional. Identify major library families: UI frameworks, ORMs, HTTP clients, authentication, logging, validation, and utility libraries.

### Step 3: Assess Dependency Health
Check version constraints for overly permissive ranges. Identify dependencies that appear unmaintained or deprecated based on known indicators. Count total direct and transitive dependencies where lock files provide this data. Flag any dependencies with known security advisories.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| manifest_files | list | Yes | Paths to package manifest files |
| lock_files | list | No | Paths to lock files for precise version data |
| tech_results | object | Yes | Output from tech-detection for context |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| dependency_catalog | list | All dependencies with name, version, and category |
| category_summary | object | Counts by category (runtime, dev, peer, optional) |
| risk_flags | list | Dependencies flagged for version or health concerns |
| total_counts | object | Direct and transitive dependency totals |

## Integration Points
- **tech-detection**: Provides manifest file locations and language context
- **architecture-documentation**: Dependency catalog feeds the architecture overview
- **test-framework-detection**: Test framework deps overlap with dev dependencies

## Validation
- All detected manifest files were successfully parsed
- Each dependency has a name and version constraint recorded
- Categories are assigned to every dependency entry
- Risk flags include rationale for each flagged dependency
