---
name: job-handler-discovery
description: Find background job handlers relevant to a feature
skill_id: MAP-203
owner: entry-point-finder
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: During M2 entry point discovery
dependencies: []
---

# Job Handler Discovery

## Purpose

Identify existing background jobs, scheduled tasks, or queue processors related to the feature.

## When to Use

- During M2 entry point discovery
- When the feature involves background processing

## Process

1. Search for job definitions matching keywords
2. Find scheduled tasks related to feature
3. Check queue processor configurations
4. Identify cron jobs or triggers
5. Suggest new jobs if needed

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| feature_context | JSON | Yes | Keywords and scope hints |
| feature_map | JSON | Yes | Jobs from discovery |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| existing_jobs | Array | Related existing jobs |
| suggested_jobs | Array | New jobs to create |

## Validation

- Jobs exist in codebase
- Suggestions match job patterns
