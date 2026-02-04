---
name: module-dependency-mapping
description: Map dependencies between modules affected by a feature
skill_id: MAP-102
owner: impact-analyzer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: During M1 impact analysis after file detection
dependencies: [MAP-101]
---

# Module Dependency Mapping

## Purpose

Map the dependency relationships between modules that will be affected by the feature.

## When to Use

- After identifying affected files
- To understand change propagation paths

## Process

1. Group affected files by module
2. Analyze imports/exports between modules
3. Build dependency graph
4. Identify circular dependencies
5. Note external dependencies

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| affected_files | Array | Yes | Files identified by MAP-101 |
| project_structure | JSON | Yes | From discovery report |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| dependency_graph | JSON | Module dependency relationships |
| inward_deps | Array | Modules the affected code depends on |
| outward_deps | Array | Modules that depend on affected code |

## Validation

- Dependency directions correctly identified
- No missing modules in graph
