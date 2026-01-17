---
name: integration-architecture
description: Design external service integration patterns
skill_id: ARCH-008
owner: architecture
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: External API integration, third-party services, B2B connections
dependencies: [ARCH-001, ARCH-004]
---

# Integration Architecture

## Purpose
Design robust integration patterns for external services, APIs, and third-party systems with proper error handling, resilience, and data synchronization.

## When to Use
- External API integration
- Third-party service connections
- B2B data exchange
- Service mesh design

## Prerequisites
- External services identified
- API documentation available
- SLAs and rate limits known
- Data mapping requirements

## Process

### Step 1: Catalog External Services
```
For each service:
- Service name and purpose
- API type (REST, SOAP, etc.)
- Authentication method
- Rate limits
- SLA/availability
- Data format
```

### Step 2: Design Integration Patterns
```
Pattern options:
- Direct sync: Real-time API calls
- Async queue: Message-based
- Webhook: Event-driven
- Batch: Scheduled sync
- Cache-first: Read from cache
```

### Step 3: Plan Resilience
```
Resilience patterns:
- Circuit breaker
- Retry with backoff
- Timeout configuration
- Fallback responses
- Bulkhead isolation
```

### Step 4: Design Data Mapping
```
For each integration:
- External → internal mapping
- Data transformation rules
- Validation requirements
- Error handling
- Conflict resolution
```

### Step 5: Document Integration Contracts
```
Contract includes:
- Endpoint details
- Request/response schemas
- Error codes
- Rate limits
- SLA expectations
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| external_apis | JSON | Yes | Service catalog |
| requirements | Markdown | Yes | Integration needs |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| integration_architecture.md | Markdown | Integration design |
| service_contracts | YAML | API contracts |
| data_mapping.md | Markdown | Field mappings |

## Project-Specific Considerations
- University databases: Batch sync recommended
- Visa services: Async queue-based
- Housing APIs: Cache-first pattern
- Rate limits vary by provider

## Integration Points
- **Developer Agent**: Implementation
- **Test Manager**: Integration test design
- **Operations Agent**: Health monitoring

## Examples
```
Integration Architecture - SDLC Framework

EXTERNAL SERVICES:

1. University Database API
   Type: REST API
   Auth: API Key
   Rate limit: 100 req/min
   SLA: 99.0%
   Pattern: Batch sync (nightly) + cache
   
2. Visa Service API
   Type: REST API
   Auth: OAuth2
   Rate limit: 50 req/min
   SLA: 99.5%
   Pattern: Async (queue-based)
   
3. Housing Provider API
   Type: GraphQL
   Auth: API Key
   Rate limit: 200 req/min
   SLA: 99.0%
   Pattern: Cache-first (1hr TTL)

INTEGRATION PATTERNS:

University Sync:
┌──────────┐     ┌──────────┐     ┌──────────┐
│ Scheduler│────>│ Sync Job │────>│University│
│ (nightly)│     │ Worker   │     │   API    │
└──────────┘     └────┬─────┘     └──────────┘
                      │
                      ▼
                ┌──────────┐
                │ Database │
                │ (upsert) │
                └──────────┘

Visa Status Check (Async):
┌──────────┐     ┌──────────┐     ┌──────────┐
│ User     │────>│   SQS    │────>│  Worker  │
│ Request  │     │  Queue   │     │          │
└──────────┘     └──────────┘     └────┬─────┘
                                       │
                      ┌────────────────┘
                      ▼
                ┌──────────┐     ┌──────────┐
                │  Visa    │────>│ Webhook/ │
                │  API     │     │ Callback │
                └──────────┘     └──────────┘

RESILIENCE:

Circuit Breaker Config:
- Failure threshold: 5 failures
- Recovery timeout: 30 seconds
- Half-open max calls: 3

Retry Policy:
- Max retries: 3
- Initial delay: 1 second
- Backoff multiplier: 2
- Max delay: 10 seconds

Fallback Strategies:
- University API down: Serve cached data
- Visa API down: Queue request, notify user
- Housing API down: Show "temporarily unavailable"
```

## Validation
- All external services cataloged
- Integration patterns defined
- Resilience mechanisms designed
- Data mappings documented
- SLAs understood and planned for