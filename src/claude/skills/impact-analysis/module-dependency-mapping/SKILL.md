---
name: module-dependency-mapping
description: Map module-level dependencies for affected areas (imports, exports, relationships)
skill_id: IA-102
owner: impact-analyzer
collaborators: []
project: isdlc
version: 1.0.0
when_to_use: During M1 Impact Analysis to understand module relationships
dependencies: [IA-101]
---

# Module Dependency Mapping

## Purpose
Map the module-level dependencies (imports, exports, extends, implements) for files affected by the feature to understand how changes will ripple through the codebase.

## When to Use
- After identifying directly affected files
- Understanding module relationships
- Finding outward/inward dependencies
- Estimating change propagation scope

## Prerequisites
- Directly affected files identified (IA-101)
- Codebase accessible
- Import/export patterns known

## Process

### Step 1: Analyze Imports
```
For each affected file:
1. Parse import/require statements
2. Identify local imports (same project)
3. Identify external imports (packages)
4. Note dynamic imports
```

### Step 2: Find Dependents
```
For each affected file:
1. Search for files that import this file
2. Identify classes that extend/implement this
3. Find configuration that references this
4. Note test files for this module
```

### Step 3: Map Relationships
```
Create dependency graph:
- Inward: What this file depends on
- Outward: What depends on this file
- Depth: How many levels of dependency
```

### Step 4: Identify Coupling
```
Note tightly coupled modules:
- Bidirectional dependencies
- Deep dependency chains
- Shared state patterns
- Event-based coupling
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| affected_files | Array | Yes | List of directly affected files |
| max_depth | Number | No | Max dependency depth (default: 3) |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| inward_dependencies | Array | What affected files depend on |
| outward_dependencies | Array | What depends on affected files |
| dependency_graph | Object | Full relationship map |
| coupling_points | Array | Tightly coupled modules |

## Validation
- All affected files analyzed
- Import/export relationships mapped
- Both inward and outward deps captured
- Coupling points identified
