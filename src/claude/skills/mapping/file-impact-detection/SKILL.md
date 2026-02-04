---
name: file-impact-detection
description: Detect files that will be affected by a feature
skill_id: MAP-101
owner: impact-analyzer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: During M1 impact analysis
dependencies: []
---

# File Impact Detection

## Purpose

Identify specific files that will be directly modified or affected by a proposed feature.

## When to Use

- At the start of M1 impact analysis
- When determining blast radius

## Process

1. Extract domain keywords from feature context
2. Search file names matching keywords
3. Search file contents for keyword references
4. Identify files in relevant modules
5. Classify as direct (will edit) or indirect (may need updates)

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| feature_context | JSON | Yes | Keywords and scope hints |
| discovery_report | String | Yes | Project structure info |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| direct_files | Array | Files that will be modified |
| indirect_files | Array | Files that may need updates |

## Validation

- At least one file identified (or greenfield noted)
- Files exist in project structure
