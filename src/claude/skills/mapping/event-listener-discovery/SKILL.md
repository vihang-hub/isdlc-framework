---
name: event-listener-discovery
description: Find event handlers and listeners relevant to a feature
skill_id: MAP-204
owner: entry-point-finder
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: During M2 entry point discovery
dependencies: []
---

# Event Listener Discovery

## Purpose

Identify existing event listeners, pub/sub handlers, or webhook processors related to the feature.

## When to Use

- During M2 entry point discovery
- When the feature involves event-driven patterns

## Process

1. Search for event listener definitions
2. Find pub/sub subscriptions
3. Check webhook handlers
4. Identify event emitters
5. Suggest new event handlers if needed

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| feature_context | JSON | Yes | Keywords and scope hints |
| project_structure | JSON | Yes | From discovery |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| existing_handlers | Array | Related event handlers |
| suggested_handlers | Array | New handlers to create |

## Validation

- Handlers exist in codebase
- Suggestions follow event patterns
