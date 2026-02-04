---
name: change-propagation-estimation
description: Estimate how changes will propagate through dependency chains
skill_id: IA-104
owner: impact-analyzer
collaborators: []
project: isdlc
version: 1.0.0
when_to_use: During M1 Impact Analysis to predict ripple effects
dependencies: [IA-102, IA-103]
---

# Change Propagation Estimation

## Purpose
Estimate how changes to directly affected files will propagate through the codebase via dependency chains, helping predict the full blast radius of the feature implementation.

## When to Use
- After dependency mapping complete
- Estimating total affected file count
- Identifying potential breaking changes
- Planning testing scope

## Prerequisites
- Dependency map available (IA-102)
- Coupling analysis complete (IA-103)
- Directly affected files known (IA-101)

## Process

### Step 1: Define Propagation Levels
```
Level 0: Files directly modified (from IA-101)
Level 1: Files importing Level 0 (may need updates)
Level 2: Files importing Level 1 (need testing)
Level 3+: Unlikely affected (monitor only)
```

### Step 2: Trace Propagation Paths
```
For each Level 0 file:
1. Find all importers (Level 1)
2. For each Level 1, find its importers (Level 2)
3. Continue to max depth (typically 3)
4. Deduplicate across paths
```

### Step 3: Classify Propagation Type
```
Types:
- SIGNATURE: Method/interface signature changes
- BEHAVIOR: Logic changes (same signature)
- DATA: Data structure changes
- CONFIG: Configuration changes

Impact by type:
- SIGNATURE: Likely breaks Level 1
- BEHAVIOR: May affect Level 1-2 tests
- DATA: May cascade through all levels
- CONFIG: Usually contained
```

### Step 4: Estimate Blast Radius
```
Based on propagation analysis:
- LOW: Changes contained to Level 0-1
- MEDIUM: Changes reach Level 2
- HIGH: Changes reach Level 3+

Include:
- File count per level
- Module count per level
- Confidence in estimation
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| level_0_files | Array | Yes | Directly affected files |
| dependency_map | Object | Yes | Full dependency graph |
| change_types | Array | No | Types of changes expected |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| propagation_levels | Object | Files grouped by level |
| blast_radius | String | low/medium/high classification |
| total_affected | Number | Total file count |
| propagation_paths | Array | Key change paths |

## Validation
- All levels traced to max depth
- Files deduplicated across paths
- Blast radius classified
- Paths documented
