---
name: api-endpoint-discovery
description: Find API endpoints relevant to a feature
skill_id: MAP-201
owner: entry-point-finder
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: During M2 entry point discovery
dependencies: []
---

# API Endpoint Discovery

## Purpose

Identify existing API endpoints related to the feature and suggest new endpoints that may need to be created.

## When to Use

- At the start of M2 entry point discovery
- When the feature involves backend API changes

## Process

1. Search route definitions for keyword matches
2. Find controllers handling related resources
3. Check OpenAPI/Swagger specs if available
4. Score relevance of each endpoint
5. Suggest new endpoints following REST conventions

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| feature_context | JSON | Yes | Keywords and scope hints |
| feature_map | JSON | Yes | API endpoints from discovery |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| existing_endpoints | Array | Related existing endpoints |
| suggested_endpoints | Array | New endpoints to create |

## Validation

- Endpoints exist in codebase
- Suggestions follow REST conventions
