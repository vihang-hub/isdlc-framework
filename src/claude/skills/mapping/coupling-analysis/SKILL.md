---
name: coupling-analysis
description: Analyze coupling between components in affected areas
skill_id: MAP-103
owner: impact-analyzer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: During M1 impact analysis
dependencies: [MAP-102]
---

# Coupling Analysis

## Purpose

Analyze how tightly coupled the affected components are, identifying high-coupling areas that increase change risk.

## When to Use

- After dependency mapping
- To assess change difficulty

## Process

1. Count connections between components
2. Identify shared state/data
3. Detect tight coupling patterns
4. Note abstraction boundaries
5. Score coupling level

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| dependency_graph | JSON | Yes | From MAP-102 |
| affected_files | Array | Yes | Files to analyze |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| coupling_score | Number | 1-10 coupling level |
| high_coupling_areas | Array | Tightly coupled components |
| recommendations | Array | Decoupling suggestions |

## Coupling Indicators

- High import count between components
- Shared mutable state
- Direct database access from multiple layers
- Circular dependencies

## Validation

- Coupling score reflects actual connections
- High coupling areas documented
