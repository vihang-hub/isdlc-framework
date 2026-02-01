---
name: directory-scaffolding
description: Generate framework-specific project directory layout
skill_id: DISC-804
owner: architecture-designer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: When generating the initial project directory structure for a new project
dependencies: [DISC-801, DISC-802, DISC-803]
---

# Directory Scaffolding

## Purpose
Translate the architecture pattern, data model, and API design into a concrete, framework-specific directory layout. Produces a complete directory structure specification that follows the conventions of the selected tech stack and is ready for code scaffolding.

## When to Use
- After architecture, data model, and API design are complete for a new project
- When the team needs a standardized starting structure before writing code
- When migrating to a new framework and need to establish the target directory layout

## Prerequisites
- Architecture pattern selected from DISC-801
- Data model designed from DISC-802
- API design completed from DISC-803
- Tech stack fully specified including framework and language

## Process

### Step 1: Map Architecture Components to Directories
Translate each architecture component — API layer, business logic, data access, shared utilities, configuration — into top-level directory entries. Apply the selected architecture pattern's organizational principles (layered, feature-based, domain-driven).

### Step 2: Apply Framework Conventions
Adapt the directory structure to follow the conventions of the selected framework. For NestJS, create module directories with controller, service, and DTO files. For FastAPI, organize routers, schemas, and models. For Go, use the cmd/internal/pkg layout. For Next.js, follow App Router or Pages Router conventions.

### Step 3: Include Test Directory Structure
Mirror the source directory structure in a parallel test directory or co-locate test files per framework convention. Include directories for unit tests, integration tests, and end-to-end tests. Add fixture and mock directories where the testing strategy requires them.

### Step 4: Generate Directory Specification
Compile the full directory tree into a specification document showing every directory, its purpose, and example files it will contain. Include configuration file locations (environment files, linter configs, CI configs) and documentation directories.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| architecture_pattern | string | Yes | Selected architecture pattern from DISC-801 |
| tech_stack | object | Yes | Framework, language, and tooling selections |
| component_list | array | Yes | Architecture components and domain modules to scaffold |
| data_model | object | No | Entity definitions from DISC-802 for model files |
| api_design | object | No | Endpoint groups from DISC-803 for controller files |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| directory_layout | object | Complete directory tree with purpose annotations |
| file_manifest | array | List of files to create with their roles |
| scaffolding_ready | boolean | Whether the specification is complete enough to scaffold |

## Integration Points
- **architecture-pattern-selection**: Pattern determines top-level directory organization
- **data-model-design**: Entity definitions drive model and migration file placement
- **api-design**: Endpoint groups drive controller and route file placement
- **state-initialization**: Directory layout is recorded in project state for validation

## Validation
- Directory structure follows the conventions of the selected framework
- Every architecture component has a corresponding directory in the layout
- Test directories mirror or co-locate with source directories per convention
- Configuration files are placed in framework-standard locations
