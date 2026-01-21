---
name: scalability-planning
description: Design system for growth in users, data, and traffic
skill_id: ARCH-007
owner: solution-architect
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Capacity planning, scaling design, performance architecture
dependencies: [ARCH-001, ARCH-005]
---

# Scalability Planning

## Purpose
Design the system to handle growth in users, data volume, and traffic while maintaining performance, availability, and cost efficiency.

## When to Use
- Initial architecture design
- Anticipating growth
- Performance issues
- Capacity planning

## Prerequisites
- NFR scalability targets
- Growth projections
- Current/expected load patterns
- Budget constraints

## Process

### Step 1: Define Scalability Requirements
```
From NFRs:
- Peak concurrent users
- Requests per second
- Data growth rate
- Response time SLAs
- Geographic distribution
```

### Step 2: Identify Scaling Dimensions
```
Dimensions to scale:
- Compute: More/larger instances
- Database: Read replicas, sharding
- Storage: Tiered storage, CDN
- Network: Load balancing, CDN
- Background: Worker scaling
```

### Step 3: Choose Scaling Strategies
```
Strategies:
- Vertical: Bigger machines (limit exists)
- Horizontal: More machines (preferred)
- Auto-scaling: Demand-based
- Caching: Reduce backend load
- CDN: Geographic distribution
- Async: Queue-based processing
```

### Step 4: Design for Scale
```
Design patterns:
- Stateless services (enable horizontal)
- Connection pooling
- Caching layers
- Database read replicas
- Message queues for async
- Event-driven architecture
```

### Step 5: Plan Scaling Triggers
```
Auto-scaling rules:
- CPU > 70% → add instance
- Response time > 2s → add instance
- Queue depth > 100 → add worker
- Min/max bounds defined
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| nfr_matrix | Markdown | Yes | Scale targets |
| growth_projections | JSON | Optional | Expected growth |
| current_metrics | JSON | Optional | Baseline |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| scalability_plan.md | Markdown | Scaling strategy |
| auto_scaling_config | YAML | Scaling rules |
| capacity_model.md | Markdown | Capacity calculations |

## Project-Specific Considerations
- Peak load during application deadlines
- Seasonal patterns (enrollment periods)
- Document uploads spike with deadlines
- University API rate limits constrain scaling

## Integration Points
- **DevOps Agent**: Auto-scaling implementation
- **Operations Agent**: Capacity monitoring

## Examples
```
Scalability Plan - SDLC Framework

TARGETS:
- Normal: 5,000 concurrent users
- Peak: 25,000 concurrent users (deadline days)
- API: 500 req/sec normal, 2,000 peak
- Data: 100GB growth/month

SCALING STRATEGY:

Application Layer:
- Container-based (ECS Fargate)
- Horizontal scaling 2-10 instances
- Auto-scale on CPU > 70% or response > 2s
- Stateless design (session in Redis)

Database Layer:
- RDS PostgreSQL with read replica
- Connection pooling (PgBouncer)
- Read replica for search queries
- Consider read replicas in EU-WEST-2

Caching Layer:
- Redis for sessions
- Redis for university/program cache (1hr TTL)
- CDN for static assets

Storage Layer:
- S3 for documents
- CloudFront CDN
- Lifecycle policies for old documents

Background Processing:
- SQS queues for async tasks
- Email queue
- Document processing queue
- Auto-scaling workers 1-5

AUTO-SCALING RULES:

API Service:
- Min: 2 instances
- Max: 10 instances
- Scale up: CPU > 70% for 3 min
- Scale up: Response p95 > 2s
- Scale down: CPU < 30% for 10 min

Workers:
- Min: 1 instance
- Max: 5 instances
- Scale up: Queue depth > 100
- Scale down: Queue empty for 10 min

PEAK PREPARATION:
Before application deadlines:
1. Pre-scale to 5 API instances
2. Pre-scale to 3 workers
3. Warm database connection pools
4. Clear non-essential caches
5. Enable enhanced monitoring
```

## Validation
- Meets NFR scale targets
- Auto-scaling rules defined
- Peak handling planned
- Cost implications understood
- Bottlenecks identified