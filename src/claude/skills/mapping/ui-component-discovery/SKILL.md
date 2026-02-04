---
name: ui-component-discovery
description: Find UI components relevant to a feature
skill_id: MAP-202
owner: entry-point-finder
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: During M2 entry point discovery
dependencies: []
---

# UI Component Discovery

## Purpose

Identify existing UI components, pages, or views related to the feature and suggest new UI elements that may be needed.

## When to Use

- During M2 entry point discovery
- When the feature involves frontend changes

## Process

1. Search for pages/views matching keywords
2. Find components with related names
3. Check route definitions
4. Identify parent/container components
5. Suggest new UI elements

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| feature_context | JSON | Yes | Keywords and scope hints |
| feature_map | JSON | Yes | UI pages from discovery |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| existing_components | Array | Related existing UI elements |
| suggested_components | Array | New UI elements to create |

## Validation

- Components exist in codebase
- Suggestions fit existing patterns
