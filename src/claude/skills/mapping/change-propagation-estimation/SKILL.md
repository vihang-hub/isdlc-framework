---
name: change-propagation-estimation
description: Estimate how changes will propagate through the codebase
skill_id: MAP-104
owner: impact-analyzer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Final step of M1 impact analysis
dependencies: [MAP-101, MAP-102, MAP-103]
---

# Change Propagation Estimation

## Purpose

Estimate how changes will ripple through the codebase, identifying all potentially affected areas.

## When to Use

- After coupling analysis
- To finalize blast radius assessment

## Process

1. Start from directly affected files
2. Trace outward through dependencies
3. Classify by propagation level (0, 1, 2+)
4. Estimate total affected files
5. Classify blast radius

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| direct_files | Array | Yes | Level 0 files |
| dependency_graph | JSON | Yes | Dependency relationships |
| coupling_score | Number | Yes | From coupling analysis |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| propagation_levels | JSON | Files at each level |
| total_affected | Number | Total file count |
| blast_radius | String | low/medium/high |

## Propagation Levels

- Level 0: Direct changes (files you'll edit)
- Level 1: Direct dependents (may need updates)
- Level 2: Indirect dependents (should test)
- Level 3+: Unlikely affected

## Validation

- All dependencies traced
- Blast radius matches file counts
