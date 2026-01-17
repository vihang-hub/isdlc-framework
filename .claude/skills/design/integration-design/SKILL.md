---
name: integration-design
description: Design external API integration patterns
skill_id: DES-008
owner: design
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Third-party integrations, external API connections
dependencies: [DES-001]
---

# Integration Design

## Purpose
Design robust integration patterns for external APIs including adapters, error handling, and resilience.

## Process
1. Analyze external API
2. Design adapter layer
3. Plan error handling
4. Implement resilience patterns
5. Define sync strategy

## Project-Specific Considerations
- University database API (rate-limited)
- OAuth providers (Google)
- Document scanning service
- Email service

## Examples
```
Integration Pattern: University API

Adapter: UniversityApiAdapter
  - Transforms external format to internal
  - Handles rate limiting (100 req/min)
  - Implements circuit breaker
  - Caches responses (1 hour)

Sync Strategy:
  - Full sync: Daily at 2 AM
  - Incremental: Every 4 hours
  - On-demand: User triggers refresh
```